import {PROVIDER_IDS,TASK_STATES} from './catalog.mjs';
export function plainText(value,max=120){return typeof value==='string'?value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,max):''}
function finite(value,name){if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(name+' must be finite');return value}
export function validateQuota(q){
 if(!q||typeof q!=='object')throw new TypeError('quota required');
 if(q.kind==='balance'){let amount=finite(q.amount,'amount');if(amount<0)throw new RangeError('negative balance');if(!['CNY','USD'].includes(q.currency))throw new TypeError('unsupported currency');let budget=q.budget==null?null:finite(q.budget,'budget');if(budget!==null&&budget<=0)throw new RangeError('budget must be positive');return{kind:'balance',amount,currency:q.currency,budget}}
 if(q.kind==='window'){
  const used=finite(q.usedPercent,'usedPercent');if(used<0||used>100)throw new RangeError('percentage outside 0..100');
  const monthly=q.period==='monthly',mins=monthly&&q.windowMinutes==null?null:finite(q.windowMinutes,'windowMinutes');if(mins!==null&&mins<=0)throw new RangeError('window must be positive');
  const resetsAt=q.resetsAt==null?null:finite(q.resetsAt,'resetsAt'),extra=q.additionalWindows??[];if(!Array.isArray(extra)||extra.length>3)throw new TypeError('invalid additional quota windows');
  return{kind:'window',usedPercent:used,windowMinutes:mins,period:monthly?'monthly':'rolling',windowLabel:plainText(q.windowLabel,36)||null,resetsAt,secondary:q.secondary?validateQuota({...q.secondary,kind:'window',additionalWindows:[]}):null,additionalWindows:extra.map(w=>validateQuota({...w,kind:'window',secondary:null,additionalWindows:[]}))};
 }
 throw new TypeError('unsupported quota kind')
}
export function validateEvent(input,now=Date.now()){
 if(!input||typeof input!=='object'||!PROVIDER_IDS.has(input.provider))throw new TypeError('unknown provider');
 if(!['task.state','quota.snapshot','provider.connection'].includes(input.type))throw new TypeError('unknown event type');
 const at=input.observedAt==null?now:Date.parse(input.observedAt);if(!Number.isFinite(at)||at>now+60000)throw new TypeError('invalid event time');
 let out={provider:input.provider,type:input.type,observedAt:new Date(at).toISOString(),source:plainText(input.source||'bridge',40)};
 if(input.type==='task.state'){if(!input.task||!TASK_STATES.has(input.task.state))throw new TypeError('invalid task state');const completionScope=input.task.completionScope??'unknown';if(!['unknown','turn','task'].includes(completionScope))throw new TypeError('invalid completion scope');const id=plainText(input.task.id,160);if(!id)throw new TypeError('task id required');out.task={id,state:input.task.state,completionScope,waitingReason:input.task.waitingReason==='question'?'question':'approval',title:plainText(input.task.title||'Agent 任务'),workspace:plainText(input.task.workspace,260),sessionId:plainText(input.task.sessionId||id,160)}}
 if(input.type==='quota.snapshot')out.quota=validateQuota(input.quota);
 if(input.type==='provider.connection'){if(!['connected','disconnected','not-configured','error'].includes(input.connection))throw new TypeError('invalid connection');out.connection=input.connection;out.message=plainText(input.message,180)}
 return out;
}
export function remainingRatio(q){if(!q)return null;if(q.kind==='window')return 1-q.usedPercent/100;if(q.kind==='balance'&&q.budget)return Math.min(1,q.amount/q.budget);return null}
