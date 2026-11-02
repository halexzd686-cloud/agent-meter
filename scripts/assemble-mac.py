import pathlib,zipfile,stat,os,json,plistlib,shutil,struct
from PIL import Image
root=pathlib.Path.cwd();work=root/'.cache/mac-build';volume=work/'volume';volume.mkdir(exist_ok=True)
if (volume/'Agent Meter.app').exists():raise RuntimeError('Build output already exists; use a fresh staging volume before assembling to avoid modifying a signed bundle')
package=json.loads((root/'package.json').read_text());version=package['version'];runtime=package['devDependencies']['electron']
z=zipfile.ZipFile(work/f'electron-v{runtime}-darwin-arm64.zip');modes={};links=[]
def mapped(name):
 if not name.startswith('Electron.app/'): return None
 p=name.replace('Electron.app/','Agent Meter.app/',1)
 parts=p.split('/')
 parts=[part.replace('Electron Helper','Agent Meter Helper') if part.startswith('Electron Helper') else part for part in parts]
 p='/'.join(parts)
 if p=='Agent Meter.app/Contents/MacOS/Electron':p='Agent Meter.app/Contents/MacOS/Agent Meter'
 return p
for item in z.infolist():
 rel=mapped(item.filename)
 if not rel:continue
 dest=volume/rel
 if not dest.resolve().is_relative_to(volume.resolve()):raise RuntimeError('Unsafe archive path')
 mode=item.external_attr>>16;modes[rel]=mode
 if stat.S_ISLNK(mode):links.append((dest,z.read(item).decode()));continue
 if item.is_dir():dest.mkdir(parents=True,exist_ok=True)
 else:
  dest.parent.mkdir(parents=True,exist_ok=True)
  with z.open(item) as src,open(dest,'wb') as out:shutil.copyfileobj(src,out)
for attempt in range(5):
 remaining=[]
 for dest,target in links:
  actual=dest.parent/target
  if not actual.exists():remaining.append((dest,target));continue
  os.symlink(target,dest,target_is_directory=actual.is_dir())
 links=remaining
 if not links:break
if links:raise RuntimeError('Unresolved framework symlink')
app=volume/'Agent Meter.app';contents=app/'Contents'
for plist in contents.rglob('Info.plist'):
 if plist.is_symlink():continue
 data=plistlib.loads(plist.read_bytes())
 if plist==contents/'Info.plist':
  data.update(CFBundleName='Agent Meter',CFBundleDisplayName='Agent Meter',CFBundleExecutable='Agent Meter',CFBundleIdentifier='io.agentmeter.desktop',CFBundleShortVersionString=version,CFBundleVersion=version,CFBundleIconFile='app.icns',LSUIElement=True,NSHighResolutionCapable=True)
  data.pop('ElectronAsarIntegrity',None)
  minimum=data.get('LSMinimumSystemVersion')
 elif '.app' in str(plist.parent.parent.name) and 'Agent Meter Helper' in plist.parent.parent.name:
  helper=plist.parent.parent.stem;data.update(CFBundleName=helper,CFBundleDisplayName=helper,CFBundleExecutable=helper,CFBundleIdentifier='io.agentmeter.desktop.helper'+helper.replace('Agent Meter Helper','').replace(' ','').replace('(','').replace(')',''))
 else:continue
 plist.write_bytes(plistlib.dumps(data))
resources=contents/'Resources'
for source,dest in [('LICENSE','LICENSE.electron.txt'),('LICENSES.chromium.html','LICENSES.chromium.html')]:
 (resources/dest).write_bytes(z.read(source))
shutil.copy2(work/'app.asar',resources/'app.asar')
unpacked=work/'app.asar.unpacked'
if unpacked.exists():shutil.copytree(unpacked,resources/'app.asar.unpacked',dirs_exist_ok=True)
(resources/'default_app.asar').unlink(missing_ok=True)
Image.open(root/'assets/app.png').save(root/'assets/app.icns',format='ICNS');shutil.copy2(root/'assets/app.icns',resources/'app.icns')
with open(contents/'MacOS/Agent Meter','rb') as f:magic,cpu=struct.unpack('<II',f.read(8))
if magic!=0xfeedfacf or cpu!=0x0100000c:raise RuntimeError('Not an arm64 Mach-O executable')
(work/'unix-modes.json').write_text(json.dumps(modes))
(work/'bundle-meta.json').write_text(json.dumps({'version':version,'architecture':'arm64','minimumMacOS':minimum,'runtime':runtime,'bundleIdentifier':'io.agentmeter.desktop'}))
print(json.dumps({'app':str(app),'arm64':True,'minimumMacOS':minimum,'symlinks':sum(1 for m in modes.values() if stat.S_ISLNK(m))}),flush=True)
