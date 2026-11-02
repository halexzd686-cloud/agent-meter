import{spawn}from'node:child_process';import{readdir,stat,open}from'node:fs/promises';import path from'node:path';import os from'node:os';
function windowQuota(w){if(!w)return null;const used=w.usedPercent??w.used_percent,mins=w.windowDurationMins??w.window_minutes??w.window_duration_mins;if(!Number.isFinite(used)||used<0||used>100||!Number.isFinite(mins)||mins<=0)return null;return{kind:'window',usedPercent:used,windowMinutes:mins,resetsAt:w.resetsAt??w.resets_at??null}}
export function normalizeCodexLimits(result){
 const limits=result?.rateLimitsByLimitId?.codex||result?.rate_limits_by_limit_id?.codex||result?.rateLimits||result?.rate_limits||result;
 if(!limits)return null;const id=limits.limitId??limits.limit_id;if(id&&id!=='codex')return null;
 let primary=windowQuota(limits.primary),secondary=windowQuota(limits.secondary);if(primary)return{...primary,secondary};return secondary;
}
export function parseCodexRecord(record,sessionId='local-session'){
 const at=record.timestamp;if(!at||!Number.isFinite(Date.parse(at)))return[];
 const p=record.payload||{},events=[];let state=null;
 if(record.type==='event_msg'){
  const map={task_started:'thinking',turn_started:'thinking',task_complete:'idle',turn_complete:'idle',turn_aborted:'idle',agent_reasoning:'thinking',exec_command_begin:'running',exec_command_end:'thinking',exec_approval_request:'waiting',apply_patch_approval_request:'waiting',error:'error'};
  state=map[p.type]||null;
  if(p.type==='token_count'){let q=normalizeCodexLimits(p.rate_limits);if(q)events.push({provider:'codex',type:'quota.snapshot',quota:q,observedAt:at,source:'codex-local-log'})}
 }
 if(record.type==='response_item'){if(p.type==='reasoning')state='thinking';if(p.type==='function_call')state=p.name==='request_user_input'?'waiting':'running';if(p.type==='function_call_output')state='thinking'}
 if(state)events.push({provider:'codex',type:'task.state',observedAt:at,source:'codex-local-log',task:{id:sessionId,sessionId,completionScope:['task_complete','turn_complete'].includes(p.type)?'turn':'unknown',title:'Codex 会话 '+sessionId.slice(-8),state}});
 return events;
}
export async function resolveCodexExecutable(configured='',{platform=process.platform,home=os.homedir(),env=process.env}={}){
 if(configured){try{if((await stat(configured)).isFile())return configured}catch{}}
 for(const folder of(env.PATH||'').split(platform==='win32'?';':':')){if(!folder)continue;const exe=path.join(folder,platform==='win32'?'codex.exe':'codex');try{if((await stat(exe)).size>1024)return exe}catch{}}
 if(platform==='darwin'){
  const candidates=['/Applications/Codex.app/Contents/Resources/codex','/Applications/Codex.app/Contents/Resources/bin/codex',path.join(home,'Applications/Codex.app/Contents/Resources/codex'),'/opt/homebrew/bin/codex','/usr/local/bin/codex',path.join(home,'.local/bin/codex'),path.join(home,'.codex/bin/codex')];
  for(const exe of candidates)try{const info=await stat(exe);if(info.isFile()&&info.size>1024)return exe}catch{}return null;
 }
 if(platform!=='win32')return null;
 const base=path.join(env.LOCALAPPDATA||path.join(home,'AppData/Local'),'OpenAI/Codex/bin');
 try{const dirs=await readdir(base,{withFileTypes:true});const candidates=[];for(const d of dirs.filter(d=>d.isDirectory())){const exe=path.join(base,d.name,'codex.exe');try{const s=await stat(exe);if(s.size>1024)candidates.push({exe,time:s.mtimeMs})}catch{}}return candidates.sort((a,b)=>b.time-a.time)[0]?.exe||null}catch{return null}
}
export function readCodexQuota(executable,{timeoutMs=15000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,['app-server'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let buffer='',settled=false;
  const done=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);child.stdin.destroy();child.kill();err?reject(err):resolve(result)};
  const timer=setTimeout(()=>done(new Error('Codex 额度接口响应超时')),timeoutMs);
  const send=data=>{if(!settled&&!child.stdin.destroyed)child.stdin.write(JSON.stringify(data)+'\n')};
  child.on('error',()=>done(new Error('无法启动 Codex 本地额度接口')));child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});
  child.on('exit',()=>{if(!settled)done(new Error('Codex 额度接口已退出'))});
  child.stdout.on('data',chunk=>{
   buffer+=chunk.toString('utf8');if(buffer.length>2*1024*1024){done(new Error('Codex 额度接口返回过大'));return}
   let cut;while((cut=buffer.indexOf('\n'))>=0){let line=buffer.slice(0,cut);buffer=buffer.slice(cut+1);let msg;try{msg=JSON.parse(line)}catch{continue}
    if(msg.id===0){if(msg.error){done(new Error('Codex 接口初始化失败'));return}send({method:'initialized',params:{}});send({method:'account/rateLimits/read',id:1})}
    if(msg.id===1){if(msg.error){done(new Error('Codex 额度暂不可用，请确认 Codex 已登录 ChatGPT 账户'));return}const q=normalizeCodexLimits(msg.result);if(!q){done(new Error('Codex 未返回可用的额度窗口'));return}done(null,{provider:'codex',type:'quota.snapshot',quota:q,observedAt:new Date().toISOString(),source:'codex-app-server'})}
   }
  });
  send({method:'initialize',id:0,params:{clientInfo:{name:'agent_meter',title:'Agent Meter',version:'0.1.0'}}});
 });
}
async function recentRollouts(root){
 const result=[];async function walk(dir,depth){let entries;try{entries=await readdir(dir,{withFileTypes:true})}catch{return}
  let dirs=entries.filter(e=>e.isDirectory()).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,depth===0?2:depth===1?2:3);
  for(const e of entries){if(e.isFile()&&e.name.endsWith('.jsonl')){let file=path.join(dir,e.name);try{let s=await stat(file);result.push({file,...s})}catch{}}}
  if(depth<3)for(const d of dirs)await walk(path.join(dir,d.name),depth+1);
 }await walk(root,0);return result.sort((a,b)=>b.mtimeMs-a.mtimeMs).slice(0,6);
}
export class CodexAdapter{
 constructor({home=process.env.CODEX_HOME||path.join(os.homedir(),'.codex')}={}){this.home=home;this.readers=new Map();this.warmed=false;this.lastRpc=0;this.executable=null;this.lastRpcError=''}
 async poll(config={}){
  const events=[],files=await recentRollouts(path.join(this.home,'sessions'));let saw=files.length>0;
  for(const f of files){
   let reader=this.readers.get(f.file),first=!reader;if(!reader||f.size<reader.offset)reader={offset:Math.max(0,f.size-256*1024),carry:'',sessionId:(f.file.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[]).at(-1)||path.basename(f.file,'.jsonl')};
   if(f.size===reader.offset){this.readers.set(f.file,reader);continue}
   let start=reader.offset,skipPartial=first&&start>0;if(f.size-start>512*1024){start=f.size-256*1024;reader.carry='';skipPartial=true}
   const handle=await open(f.file,'r');try{const bytes=Buffer.alloc(f.size-start);await handle.read(bytes,0,bytes.length,start);let text=reader.carry+bytes.toString('utf8');if(skipPartial)text=text.slice(text.indexOf('\n')+1);let lines=text.split('\n');reader.carry=lines.pop()||'';reader.offset=f.size;
    for(const line of lines){let record;try{record=JSON.parse(line)}catch{continue}for(const event of parseCodexRecord(record,reader.sessionId)){events.push({event,historical:!this.warmed||Date.now()-Date.parse(event.observedAt)>60000})}}
   }finally{await handle.close()}this.readers.set(f.file,reader);
  }
  this.warmed=true;
  if(Date.now()-this.lastRpc>60000){this.lastRpc=Date.now();this.executable=await resolveCodexExecutable(config.codexCliPath||'');if(this.executable){try{events.push({event:await readCodexQuota(this.executable),historical:false});this.lastRpcError='';saw=true}catch(e){this.lastRpcError=e.message}}}
  events.push({event:{provider:'codex',type:'provider.connection',connection:saw?'connected':'not-configured',message:saw?(this.lastRpcError?'本地会话已连接；'+this.lastRpcError:'Codex 本地会话已连接'):'未找到 Codex 本地会话或 CLI，请在设置中指定路径',source:'codex-local',observedAt:new Date().toISOString()},historical:true});
  return events;
 }
}
