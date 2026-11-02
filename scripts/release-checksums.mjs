import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const dir=process.argv[2]||'dist',pkg=JSON.parse(await readFile('package.json','utf8'));
const files=(await readdir(dir)).filter(f=>/\.(?:exe|dmg)$/.test(f)&&f.includes(pkg.version)).sort();
if(!files.length)throw new Error('No matching release artifacts for '+pkg.version);
for(const file of files){const hash=createHash('sha256').update(await readFile(path.join(dir,file))).digest('hex');await writeFile(path.join(dir,file+'.sha256'),hash+'  '+file+'\n');console.log(hash+'  '+file)}
