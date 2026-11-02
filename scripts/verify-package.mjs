import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),asar=require('@electron/asar'),pkg=JSON.parse(await readFile('package.json','utf8'));
const candidates=['dist/win-unpacked/resources/app.asar','dist/mac-arm64/Agent Meter.app/Contents/Resources/app.asar'];
let archive;
for(const candidate of candidates){try{await access(candidate);archive=candidate;break}catch{}}
if(!archive)throw new Error('No native packaged app.asar found');
const files=asar.listPackage(archive).map(f=>f.replaceAll('\\','/'));
for(const file of files)if(/(^|\/)(?:\.cache|test|node_modules|dist(?:-[^/]+)?|outputs)\//.test(file)||/(^|\/)(?:bridge|secrets|settings)\.json$/.test(file)||/(^|\/)smoke\.mjs$/.test(file))throw new Error('Unexpected packaged content: '+file);
const packed=JSON.parse(asar.extractFile(archive,'package.json'));
if(packed.version!==pkg.version||packed.main!==pkg.main)throw new Error('Packaged metadata differs from source');
for(const required of ['LICENSE','THIRD_PARTY_NOTICES.md','PRIVACY.md'])if(!asar.extractFile(archive,path.normalize(required)).length)throw new Error('Missing notice '+required);
for(const rel of ['electron/main.mjs','electron/settings.mjs','src/core/catalog.mjs','src/core/platform.mjs','renderer/app.mjs'])if(!asar.extractFile(archive,path.normalize(rel)).equals(await readFile(rel)))throw new Error('Stale packaged source: '+rel);
const runtimeDir=archive.includes('/mac-arm64/')?path.dirname(archive):path.resolve(path.dirname(archive),'..');
await access(path.join(runtimeDir,'LICENSE.electron.txt'));
await access(path.join(runtimeDir,'LICENSES.chromium.html'));
console.log('Packaged source, version '+pkg.version+' and required notices verified: '+archive);
