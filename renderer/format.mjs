export function metric(p){
 if(!p?.quota||p.quotaExpired)return'—';
 if(p.quota.kind==='window')return Math.round(100-p.quota.usedPercent)+'%';
 return(p.quota.currency==='CNY'?'¥':'$')+p.quota.amount.toFixed(2);
}
export function ratio(p){if(!p?.quota||p.quotaExpired)return null;const q=p.quota;if(q.kind==='window')return 1-q.usedPercent/100;return q.budget?Math.min(1,q.amount/q.budget):null}
export function ago(iso){if(!iso)return'尚未更新';const seconds=Math.max(0,(Date.now()-Date.parse(iso))/1000);if(seconds<60)return'刚刚更新';if(seconds<3600)return Math.floor(seconds/60)+' 分钟前更新';return Math.floor(seconds/3600)+' 小时前更新'}
function duration(mins){return mins>=1440&&mins%1440===0?mins/1440+' 天':mins>=60&&mins%60===0?mins/60+' 小时':mins+' 分钟'}
function windowName(q){return q.windowLabel||(q.period==='monthly'?'月度额度':duration(q.windowMinutes))}
export function quotaLabel(p){if(!p?.quota)return'额度尚未连接';if(p.quota.kind==='balance')return'API 可用余额';return(p.quota.windowLabel|| (p.quota.period==='monthly'?'月度额度':duration(p.quota.windowMinutes)+'额度'))+'剩余'}
export function quotaNote(p){
 if(!p.quota)return'在连接设置中配置数据来源后显示。';
 if(p.quotaExpired)return'额度窗口已结束，等待应用提供新额度。';
 if(p.quota.kind==='balance')return(p.quota.budget?'预算上限 '+(p.quota.currency==='CNY'?'¥':'$')+p.quota.budget.toFixed(2):'未设置预算上限，不推算余额比例。')+' · '+ago(p.quotaObservedAt);
 let reset=p.quota.resetsAt?new Date(p.quota.resetsAt*1000).toLocaleString('zh-CN',p.quota.period==='monthly'?{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}:{hour:'2-digit',minute:'2-digit'}):null;
 const others=[p.quota.secondary,...(p.quota.additionalWindows||[])].filter(Boolean).map(q=>windowName(q)+'剩余 '+(q.resetsAt&&q.resetsAt*1000<=Date.now()?'待更新':Math.round(100-q.usedPercent)+'%')).join(' · ');
 return(reset?'预计 '+reset+' 重置 · ':'')+ago(p.quotaObservedAt)+(others?' · '+others:'')+(p.quotaStale?'，记录可能已变化。':'');
}
