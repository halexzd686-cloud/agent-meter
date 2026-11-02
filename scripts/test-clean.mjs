import {mkdtemp,mkdir,cp,copyFile,rm,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const parent=path.resolve(os.tmpdir(),'agent-meter-clean-source');await mkdir(parent,{recursive:true});const target=await mkdtemp(path.join(parent,'checkout-'));
try{
 for(const folder of ['src','electron','renderer','scripts','test','integrations'])await cp(folder,path.join(target,folder),{recursive:true});
 await copyFile('package.json',path.join(target,'package.json'));
 let cachePresent=true;try{await access(path.join(target,'.cache'))}catch{cachePresent=false}if(cachePresent)throw new Error('Clean source unexpectedly has cache');
 console.log('Running tests without repository cache or node_modules');
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--test','test/*.test.mjs'],{cwd:target,stdio:'inherit',windowsHide:true});p.once('error',reject);p.once('exit',resolve)});
 if(code!==0)process.exitCode=code||1;
}finally{
 const resolved=path.resolve(target),relative=path.relative(parent,resolved);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unsafe cleanup');await rm(resolved,{recursive:true,force:true});
}
