import{readdir,readFile,stat,open}from'node:fs/promises';
import path from'node:path';import os from'node:os';import{plainText}from'../core/contracts.mjs';
const SESSION_ID=/^[a-zA-Z0-9_-]{1,160}$/;
function windowValue(raw,label,minutes,period='rolling'){
 if(!raw)return null;if(typeof raw.usedRatio!=='number'||!Number.isFinite(raw.usedRatio)||raw.usedRatio<0||raw.usedRatio>1)throw new Error('Kimi 额度比例无效');
 const reset=raw.resetAt?Date.parse(raw.resetAt):NaN;
 return{kind:'window',usedPercent:Math.round(raw.usedRatio*1e8)/1e6,windowMinutes:minutes,period,windowLabel:label,resetsAt:Number.isFinite(reset)?Math.floor(reset/1000):null};
}
export function normalizeKimiQuota(data){
 if(data?.kind!=='ok'||!data.quota?.usages)throw new Error('Kimi 账户额度暂不可用，请确认应用已登录');
 const usages=data.quota.usages,windows=[windowValue(usages.limit5h,'5 小时额度',300),windowValue(usages.limit7d,'7 天额度',10080),windowValue(usages.monthTotal,'本月总额度',null,'monthly'),windowValue(usages.monthCode,'本月代码额度',null,'monthly')].filter(Boolean);
 if(!windows.length)throw new Error('Kimi 未返回可用的额度窗口');
 return{...windows[0],secondary:windows[1]||null,additionalWindows:windows.slice(2)};
}
export function projectKimiEvent(record){
 const envelope=record?.envelope||record,p=envelope?.payload;if(!p||p.agentId!=='main')return null;
 const at=envelope.timestamp;let state=null,toolStart=null,toolEnd=null;
 if(p.type==='goal.updated'){const s=p.snapshot;if(!s||typeof s.goalId!=='string'||!['active','paused','blocked','complete'].includes(s.status))return null;return{at,goal:{id:s.goalId,status:s.status}}}
 if(p.type==='agent.status.updated'){
  const phase=p.phase||{};state=({idle:'idle',running:'thinking',tool_call:'running',retrying:'thinking',awaiting_approval:'waiting'})[phase.kind]||null;
  if(phase.kind==='ended')state=phase.reason==='failed'?'error':'idle';
  if(phase.kind==='interrupted')state=phase.reason==='error'?'error':'idle';
  if(phase.kind==='tool_call')toolStart=plainText(phase.toolCallId,160);
 }else if(['turn.started','turn.step.started','thinking.delta','tool.call.delta','turn.step.retrying'].includes(p.type))state='thinking';
 else if(p.type==='tool.call.started'){state='running';toolStart=plainText(p.toolCallId,160)}
 else if(p.type==='tool.progress')state='running';
 else if(p.type==='tool.result'){state='thinking';toolEnd=plainText(p.toolCallId,160)}
 else if(p.type==='turn.ended')state=p.reason==='failed'?'error':'idle';
 if(!state)return null;return{at,state,toolStart,toolEnd,resetTools:p.type==='turn.started'||state==='idle'||state==='error'};
}
export function kimiSessionState(session,phase){
 const status=session?.activity?.status;
 if(status==='approval'||status==='question')return'waiting';
 if(status==='failed')return'error';
 if(status==='idle')return'idle';
 if(status==='running')return['thinking','running','waiting'].includes(phase?.state)?phase.state:'running';
 return'unknown';
}
export class KimiAdapter{
 constructor({home=process.env.KIMI_CODE_HOME||path.join(os.homedir(),'.kimi-code'),fetchImpl=fetch,clock=()=>Date.now()}={}){
  this.home=home;this.fetch=fetchImpl;this.clock=clock;this.endpoint=null;this.lastDiscovery=0;this.lastQuota=0;this.lastGoals=0;this.warmed=false;this.quotaError='';this.readers=new Map();this.sessions=new Map();this.goals=new Map();
 }
 async get(endpoint,route){
  let response;try{response=await this.fetch(endpoint.base+route,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+endpoint.token},signal:AbortSignal.timeout(4500)})}catch{throw new Error('无法连接 Kimi 本地服务，请保持 Kimi Code 已打开')}
  if(!response.ok)throw new Error(response.status===401?'Kimi 本地连接已失效，请重新打开应用':'Kimi 本地接口暂不可用');
  let body;try{body=await response.json()}catch{throw new Error('Kimi 本地接口格式异常')}if(body?.code!==0)throw new Error('Kimi 本地接口返回异常，请检查应用版本');return body.data;
 }
 async discover(){
  if(this.endpoint&&this.clock()-this.lastDiscovery<10000)return this.endpoint;
  let records,token;try{records=await readdir(path.join(this.home,'server/instances'));token=(await readFile(path.join(this.home,'server.token'),'utf8')).trim()}catch{throw new Error('未找到 Kimi 本地服务，请打开已登录的 Kimi Code')}
  if(token.length<16||token.length>2048)throw new Error('Kimi 本地连接凭据无效');
  const candidates=[];for(const file of records.filter(n=>n.endsWith('.json')).slice(0,24)){try{const value=JSON.parse(await readFile(path.join(this.home,'server/instances',file),'utf8'));if(value.host==='127.0.0.1'&&Number.isInteger(value.port)&&value.port>0&&value.port<65536)candidates.push(value)}catch{}}
  candidates.sort((a,b)=>(b.heartbeat_at||b.started_at||0)-(a.heartbeat_at||a.started_at||0));
  for(const value of candidates){const endpoint={base:'http://127.0.0.1:'+value.port,token};try{await this.get(endpoint,'/api/v1/healthz');this.endpoint=endpoint;this.lastDiscovery=this.clock();return endpoint}catch{}}
  throw new Error('Kimi 本地服务尚未就绪，请保持应用打开');
 }
 async readEvents(id){
  const file=path.join(this.home,'server/events',id+'.jsonl');let size;try{size=(await stat(file)).size}catch{return{phase:null,goals:[]}}
  let reader=this.readers.get(id),first=!reader;if(!reader||size<reader.offset){reader={offset:Math.max(0,size-128*1024),carry:'',phase:null,tools:new Set()};first=true}
  const goals=[];if(size>reader.offset){
   let start=reader.offset,skipPartial=first&&start>0;if(size-start>512*1024){start=size-128*1024;reader.carry='';skipPartial=true}
   const handle=await open(file,'r');try{const bytes=Buffer.alloc(size-start);const{bytesRead}=await handle.read(bytes,0,bytes.length,start);let content=reader.carry+bytes.subarray(0,bytesRead).toString('utf8');if(skipPartial)content=content.slice(content.indexOf('\n')+1);const lines=content.split('\n');reader.carry=lines.pop()||'';if(reader.carry.length>256*1024)reader.carry='';reader.offset=start+bytesRead;
    for(const line of lines){let raw;try{raw=JSON.parse(line)}catch{continue}const event=projectKimiEvent(raw);if(!event)continue;
     if(event.goal){goals.push({...event.goal,at:event.at,historical:first});continue}
     if(event.resetTools)reader.tools.clear();if(event.toolStart)reader.tools.add(event.toolStart);if(event.toolEnd)reader.tools.delete(event.toolEnd);
     reader.phase={state:event.state==='thinking'&&reader.tools.size?'running':event.state,at:event.at};
    }
   }finally{await handle.close()}
  }
  this.readers.set(id,reader);return{phase:reader.phase,goals};
 }
 goalEvent(id,title,goal,{historical=false}={}){
  if(!goal||typeof goal.id!=='string'||!goal.id)return null;const key=id+':'+goal.id,previous=this.goals.get(key);this.goals.set(key,{status:goal.status});if(previous?.status===goal.status||goal.status!=='complete')return null;
  const timestamp=Date.parse(goal.at);const observedAt=Number.isFinite(timestamp)&&timestamp<=this.clock()+60000?new Date(timestamp).toISOString():new Date(this.clock()).toISOString();
  return{event:{provider:'kimi',type:'task.state',source:'kimi-native-goal',observedAt,task:{id:'goal:'+goal.id,sessionId:id,title, state:'completed',completionScope:'task'}},historical:historical||!this.warmed||(!previous&&goal.historical!==false)};
 }
 async poll({forceQuota=false}={}){
  const events=[],observedAt=new Date(this.clock()).toISOString();let endpoint;
  try{endpoint=await this.discover()}catch(error){this.endpoint=null;for(const id of this.sessions.keys())events.push({event:{provider:'kimi',type:'task.state',observedAt,source:'kimi-local-api',task:{id,sessionId:id,title:this.sessions.get(id).title,state:'unknown'}},historical:true});events.push({event:{provider:'kimi',type:'provider.connection',observedAt,connection:'disconnected',message:error.message}});return events}
  let quotaError=this.quotaError;if(forceQuota||!this.lastQuota||this.clock()-this.lastQuota>=60000){try{const data=await this.get(endpoint,'/api/v1/oauth/usage');events.push({event:{provider:'kimi',type:'quota.snapshot',source:'kimi-local-api',observedAt,quota:normalizeKimiQuota(data)},historical:true});this.lastQuota=this.clock();this.quotaError='';quotaError=''}catch(error){quotaError=error.message;this.quotaError=quotaError;this.lastQuota=this.clock()}}
  let items;try{
   const query=new URLSearchParams({view:'flat',page_size:'24',sort:'meta.updated_at_desc','meta.archived':'false'}),activeQuery=new URLSearchParams({view:'flat',page_size:'100','meta.archived':'false'});for(const status of['running','approval','question'])activeQuery.append('activity.status',status);
   const[recent,active]=await Promise.all([this.get(endpoint,'/api/v2/sessions?'+query),this.get(endpoint,'/api/v2/sessions?'+activeQuery)]);
   if(!Array.isArray(recent?.items)||!Array.isArray(active?.items))throw new Error('Kimi 会话状态格式不兼容');items=[...new Map([...recent.items,...active.items].filter(s=>SESSION_ID.test(s.id)).map(s=>[s.id,s])).values()];
  }catch(error){this.endpoint=null;events.push({event:{provider:'kimi',type:'provider.connection',connection:'error',message:error.message,observedAt}});return events}
  const currentIds=new Set(),readGoal=forceQuota||!this.lastGoals||this.clock()-this.lastGoals>=15000;
  await Promise.all(items.map(async(session,index)=>{
   const id=session.id,title=plainText(session.meta?.title||'Kimi 会话 '+id.slice(-8),90);currentIds.add(id);let info={phase:null,goals:[]};try{info=await this.readEvents(id)}catch{}
   for(const goal of info.goals){const result=this.goalEvent(id,title,goal,{historical:goal.historical});if(result)events.push(result)}
   const state=kimiSessionState(session,info.phase),previous=this.sessions.get(id);this.sessions.set(id,{title,state});
   events.push({event:{provider:'kimi',type:'task.state',source:'kimi-local-api',observedAt,task:{id,sessionId:id,title,state,waitingReason:session.activity?.status==='question'?'question':'approval'}},historical:!this.warmed});
   if(readGoal&&(index<6||state!=='idle'||previous?.state!=='idle'&&previous))try{const data=await this.get(endpoint,'/api/v1/sessions/'+encodeURIComponent(id)+'/goal');if(data){const goal={id:data.goalId,status:data.status,historical:!this.warmed};const result=this.goalEvent(id,title,goal,{historical:!this.warmed||!this.goals.has(id+':'+goal.id)});if(result)events.push(result)}}catch{}
  }));
  if(readGoal)this.lastGoals=this.clock();for(const[id,value]of this.sessions)if(!currentIds.has(id)){events.push({event:{provider:'kimi',type:'task.state',observedAt,source:'kimi-local-api',task:{id,sessionId:id,title:value.title,state:'idle'}},historical:true});this.sessions.delete(id);this.readers.delete(id)}
  while(this.readers.size>150)this.readers.delete(this.readers.keys().next().value);while(this.goals.size>300)this.goals.delete(this.goals.keys().next().value);
  this.warmed=true;events.push({event:{provider:'kimi',type:'provider.connection',observedAt,connection:'connected',source:'kimi-local-api',message:quotaError?'会话状态已连接；'+quotaError:'Kimi 本地服务已连接 · 原生额度与会话状态'}});return events;
 }
}
