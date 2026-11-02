import{createWriteStream}from'node:fs';import{readFile,mkdir,writeFile,stat}from'node:fs/promises';import{createHash}from'node:crypto';import{Readable,Transform}from'node:stream';import{pipeline}from'node:stream/promises';
const pkg=JSON.parse(await readFile('node_modules/electron/package.json','utf8')),version=pkg.version,filename='electron-v'+version+'-'+process.platform+'-'+process.arch+'.zip';
try{if((await stat('node_modules/electron/dist/electron.exe')).size>1e6){console.log('Electron runtime already installed');process.exit(0)}}catch{}
await mkdir('.cache/runtime',{recursive:true});const target='.cache/runtime/'+filename;
const sums=JSON.parse(await readFile('node_modules/electron/checksums.json','utf8'));const expected=sums[filename];if(!expected)throw new Error('Official package checksum missing');
let previous=0;try{previous=(await stat(target)).size}catch{}
const response=await fetch('https://github.com/electron/electron/releases/download/v'+version+'/'+filename,{headers:previous?{Range:'bytes='+previous+'-'}:{},signal:AbortSignal.timeout(600000)});if(!response.ok)throw new Error('Runtime download HTTP '+response.status);
const append=previous>0&&response.status===206;let total=append?previous:0,reported=total;console.log('Resume at',Math.round(total/1024/1024),'MiB');
await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,encoding,callback){total+=chunk.length;if(total-reported>32*1024*1024){reported=total;console.log('Downloaded',Math.round(total/1024/1024),'MiB')}callback(null,chunk)}}),createWriteStream(target,{flags:append?'a':'w'}));
const hash=createHash('sha256');for await(const chunk of (await import('node:fs')).createReadStream(target))hash.update(chunk);
if(hash.digest('hex')!==expected)throw new Error('Electron checksum mismatch');
console.log('Verified official SHA-256:',expected);await writeFile('.cache/runtime/verified.txt',target,'utf8');
