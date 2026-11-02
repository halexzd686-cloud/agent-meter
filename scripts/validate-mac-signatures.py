import hashlib,json,plistlib,struct,os,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else Path.cwd()/'.cache'/'mac-build'
bundle=root/'volume'/'Agent Meter.app'
links=dict(line.split('\t',1) for line in (root/'symlinks.tsv').read_text().splitlines())
results=[]
for base,dirs,files in os.walk(bundle,followlinks=False):
    dirs[:]=[n for n in dirs if (Path(base)/n).relative_to(root/'volume').as_posix() not in links]
    for name in files:
        p=Path(base)/name
        if p.relative_to(root/'volume').as_posix() in links:continue
        with p.open('rb') as f: magic=f.read(4)
        if magic!=bytes.fromhex('cffaedfe'):continue
        data=p.read_bytes();cpu=struct.unpack_from('<I',data,4)[0]
        assert cpu==0x100000c,(str(p),'not arm64',hex(cpu))
        pos=32;signature=None
        for _ in range(struct.unpack_from('<I',data,16)[0]):
            cmd,size=struct.unpack_from('<II',data,pos)
            if cmd==0x1d:signature=struct.unpack_from('<II',data,pos+8)
            pos+=size
        assert signature,(str(p),'unsigned')
        off,size=signature;sb=data[off:off+size]
        assert struct.unpack_from('>I',sb)[0]==0xfade0cc0
        blobs={}
        for i in range(struct.unpack_from('>I',sb,8)[0]):
            slot,start=struct.unpack_from('>II',sb,12+8*i);length=struct.unpack_from('>I',sb,start+4)[0];blobs[slot]=sb[start:start+length]
        cd=blobs[0];_,_,version,flags,hashoff,identoff,nspecial,ncode,codelimit,hashsize,hashtype,platform,pageexp=struct.unpack_from('>9I4B',cd)
        assert hashtype==2 and hashsize==32
        page=1<<pageexp
        assert ncode==(codelimit+page-1)//page
        for i in range(ncode):
            actual=hashlib.sha256(data[i*page:min((i+1)*page,codelimit)]).digest()
            assert actual==cd[hashoff+i*hashsize:hashoff+(i+1)*hashsize],(str(p),'code page hash',i)
        for slot in (2,5,7):
            if slot in blobs:
                assert hashlib.sha256(blobs[slot]).digest()==cd[hashoff-slot*hashsize:hashoff-(slot-1)*hashsize],(str(p),'special hash',slot)
        entitlements=plistlib.loads(blobs[5][8:]) if 5 in blobs else {}
        if '.app/Contents/MacOS/' in p.as_posix():
            assert flags&0x10000,(str(p),'missing hardened runtime')
            assert entitlements.get('com.apple.security.cs.allow-jit') is True,(str(p),'missing JIT')
            contents=p.parent.parent
            for slot,rp in [(1,contents/'Info.plist'),(3,contents/'_CodeSignature'/'CodeResources')]:
                assert hashlib.sha256(rp.read_bytes()).digest()==cd[hashoff-slot*hashsize:hashoff-(slot-1)*hashsize],(str(p),'bundle seal',slot)
        results.append({'path':p.relative_to(bundle).as_posix(),'architecture':'arm64','codePagesVerified':ncode,'flags':hex(flags),'allowJit':entitlements.get('com.apple.security.cs.allow-jit',False)})
assert len(results)>=8,len(results)
report={'machOFiles':len(results),'verified':results,'frameworkSymlinks':len(links),'appleCodesignVerification':False,'macRuntimeTested':False}
(root/'signature-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'machOFiles':len(results),'allCodePageHashesValid':True,'frameworkSymlinks':len(links)}))
