import{EventEmitter}from'node:events';
import{PROVIDERS}from'./catalog.mjs';
import{validateEvent}from'./contracts.mjs';
const priority={waiting:0,running:1,thinking:2,error:3,completed:4,idle:5,unknown:6};
export class MeterState extends EventEmitter{
 constructor({clock=()=>Date.now(),taskTimeoutMs=15*60e3}={}){super();this.clock=clock;this.taskTimeoutMs=taskTimeoutMs;this.providers=new Map(PROVIDERS.map(p=>[p.id,{...p,connection:'not-configured',message:'尚未连接',quota:null,quotaObservedAt:null,quotaSource:null,tasks:new Map()}]));this.demo=false}
 apply(raw,{historical=false}={}){
  let event=validateEvent(raw,this.clock()),p=this.providers.get(event.provider),at=Date.parse(event.observedAt);
  if(event.type==='quota.snapshot'){
   if(p.quotaObservedAt&&at<Date.parse(p.quotaObservedAt))return false;
   p.quota=event.quota;p.quotaObservedAt=event.observedAt;p.quotaSource=event.source;
  }else if(event.type==='provider.connection'){p.connection=event.connection;p.message=event.message||''}
  else{
   let previous=p.tasks.get(event.task.id);if(previous&&at<Date.parse(previous.observedAt))return false;
   if(previous&&at===Date.parse(previous.observedAt)&&previous.state===event.task.state&&previous.completionScope===event.task.completionScope)return false;
   const task={...event.task,observedAt:event.observedAt,source:event.source,completionNotified:previous?.completionNotified||false};
   if(task.state==='completed'&&task.completionScope==='turn')task.state='idle';
   const wholeTaskCompleted=task.state==='completed'&&task.completionScope==='task'&&!task.completionNotified;
   if(wholeTaskCompleted)task.completionNotified=true;p.tasks.set(task.id,task);
   if(p.tasks.size>100){const oldest=[...p.tasks.values()].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));p.tasks.delete(oldest[0].id)}
   if(!historical&&(wholeTaskCompleted||(previous?.state!==task.state&&['waiting','error'].includes(task.state))))this.emit('attention',{provider:p.id,task,previous:previous?.state||null});
  }
  this.emit('change');return true;
 }
 snapshot(config={}){
  const now=this.clock();
  return {demo:this.demo,generatedAt:new Date(now).toISOString(),providers:[...this.providers.values()].map(p=>{
   let tasks=[...p.tasks.values()].map(t=>{const age=now-Date.parse(t.observedAt);if(age>this.taskTimeoutMs&&['running','thinking','waiting'].includes(t.state))return{...t,state:'unknown',stale:true};return t}).filter(t=>now-Date.parse(t.observedAt)<24*3600e3).sort((a,b)=>(priority[a.state]-priority[b.state])||(Date.parse(b.observedAt)-Date.parse(a.observedAt)));
   let active=tasks.filter(t=>!['idle','completed'].includes(t.state));
   let current=active[0]||tasks.find(t=>t.state==='completed'&&now-Date.parse(t.observedAt)<5*60e3)||null;
   let quotaExpired=p.quota?.kind==='window'&&p.quota.resetsAt!=null&&p.quota.resetsAt*1000<=now;
   let quotaStale=p.quotaObservedAt?now-Date.parse(p.quotaObservedAt)>15*60e3:true;
   return {id:p.id,name:p.name,icon:p.icon,enabled:config.providers?.[p.id]?.enabled??p.enabled,connection:p.connection,message:p.message,quota:p.quota,quotaObservedAt:p.quotaObservedAt,quotaSource:p.quotaSource,quotaStale,quotaExpired,state:current?.state||(p.connection==='connected'?'idle':'unknown'),currentTask:current,tasks,waitingCount:active.filter(t=>t.state==='waiting').length}
  })};
 }
 clear(){for(const p of this.providers.values()){p.quota=null;p.quotaObservedAt=null;p.quotaSource=null;p.tasks.clear();p.connection='not-configured';p.message='尚未连接'}this.emit('change')}
}
export function seedDemo(state){
 const now=Date.now(),iso=new Date(now).toISOString();state.demo=true;
 for(const p of PROVIDERS){state.apply({provider:p.id,type:'provider.connection',connection:'connected',message:'演示数据',observedAt:iso,source:'demo'},{historical:true});state.apply({provider:p.id,type:'quota.snapshot',observedAt:iso,source:'demo',quota:p.id==='deepseek'?{kind:'balance',amount:26.8,currency:'CNY'}:{kind:'window',usedPercent:({kimi:62,codex:36,glm:28,claude:45,cursor:18})[p.id],windowMinutes:300,resetsAt:Math.floor(now/1000)+7200}},{historical:true})}
 for(const [provider,s,title]of[['deepseek','running','连接额度适配器'],['codex','thinking','梳理会话状态'],['kimi','waiting','验证组件构建'],['glm','idle','整理通知文案']])state.apply({provider,type:'task.state',observedAt:iso,source:'demo',task:{id:'demo-'+provider,state:s,title}},{historical:true})
}
