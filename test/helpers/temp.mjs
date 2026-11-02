import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export async function temporaryDirectory(t,prefix){
 const root=path.resolve(os.tmpdir(),'agent-meter-tests');
 await mkdir(root,{recursive:true});
 const directory=await mkdtemp(path.join(root,prefix+'-'));
 t.after(async()=>{
  const target=path.resolve(directory),relative=path.relative(root,target);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Unsafe test cleanup');
  await rm(target,{recursive:true,force:true});
 });
 return directory;
}
