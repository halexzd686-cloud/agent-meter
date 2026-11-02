import {readFile,readdir,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=process.cwd(),pkg=JSON.parse(await readFile('package.json','utf8')),lock=JSON.parse(await readFile('package-lock.json','utf8'));
const issues=[];
if(pkg.version!==lock.version||pkg.version!==lock.packages['']?.version)issues.push('Package and lock versions differ');
if(pkg.license!=='MIT')issues.push('Project license metadata is missing');
if(pkg.build.electronVersion!==pkg.devDependencies.electron)issues.push('Electron build/runtime versions differ');
for(const required of ['LICENSE','PRIVACY.md','THIRD_PARTY_NOTICES.md','SECURITY.md','README.md'])await stat(required).catch(()=>issues.push('Missing '+required));
const tagAt=process.argv.indexOf('--tag');if(tagAt>=0&&process.argv[tagAt+1]!=='v'+pkg.version)issues.push('Tag does not match package version');
const git=spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8',windowsHide:true});
if(git.status!==0&&await stat('.git').then(()=>true,()=>false))throw new Error('Git cannot enumerate this repository; check directory ownership/trust before release');
let files=[];
if(git.status===0)files=[...new Set(git.stdout.split('\0').filter(Boolean))];
else {async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){if(['node_modules','.cache','.git','outputs','coverage','__pycache__'].includes(e.name)||/^dist(?:-|$)/.test(e.name))continue;const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else files.push(path.relative(root,f))}}await walk(root)}
const patterns=[/\bsk-[A-Za-z0-9_-]{20,}\b/,/\bgh[pousr]_[A-Za-z0-9]{20,}\b/,/\bgithub_pat_[A-Za-z0-9_]{20,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,/Bearer\s+[A-Za-z0-9_-]{24,}/];
for(const file of files){
 const normalized=file.replaceAll(path.sep,'/');
 if(/(^|\/)(?:node_modules|\.cache|dist(?:-[^/]+)?|outputs|coverage)\//.test(normalized)||/(^|\/)(?:secrets|bridge)\.json$/.test(normalized)||/\.(?:p12|pfx|key)$/.test(normalized)||/(^|\/)\.env(?:\..+)?$/.test(normalized)&&!normalized.endsWith('.env.example'))issues.push('Private/generated file included: '+file);
 const info=await stat(file);if(/[.](?:exe|dmg|blockmap)$/.test(file))issues.push('Build artifact included: '+file);if(info.size>20*1024*1024)issues.push('Source file exceeds 20 MiB: '+file);
 if(info.size<2*1024*1024&&/\.(?:mjs|cjs|js|json|md|txt|html|css|py|ps1|cmd|yml|yaml|go)$/.test(file)){
  const text=await readFile(file,'utf8');if(patterns.some(re=>re.test(text)))issues.push('Possible secret pattern in '+file+' (value withheld)');
 }
}
if(issues.length){console.error(issues.join('\n'));process.exitCode=1}else console.log('Release source checks passed: '+files.length+' files; version '+pkg.version+'; no generated binaries or common secret patterns included.');
