const thinking=['M3 8C4 4 9 2 16 3C22 4 24 3 30 6C35 9 29 16 22 17C16 18 14 15 8 14C4 13 2 11 3 8Z','M9 8C10 5 15 6 19 6C23 7 27 6 27 10C27 13 21 15 17 13C13 12 8 12 9 8Z'];
const running=['M2 5H12','M11 10H23','M22 15H33'];
export function mark(state){
 if(state==='thinking'||state==='running'){const paths=state==='thinking'?thinking:running;return '<span class="motion" aria-hidden="true"><svg viewBox="0 0 36 20">'+paths.map(d=>'<path class="sand-core" d="'+d+'"/>').join('')+paths.map((d,i)=>'<path class="sand-flow '+(state==='thinking'&&i===0?'counter':'')+'" pathLength="120" d="'+d+'" style="--dash:'+(state==='thinking'?'24 36':'40 20')+';--phase:'+(-i*(state==='thinking'?.53:.35))+'s"/>').join('')+(state==='running'?'<path class="sand-tip" d="M29.5 11.5L33 15L29.5 18.5"/>':'')+'</svg></span>'}
 if(state==='waiting')return '<span class="motion" aria-hidden="true"><svg viewBox="0 0 22 12" fill="none"><path class="waiting-cut" d="M7 2.5C4.6 2.5 3.8 3.6 3.8 6S4.6 9.5 7 9.5M15 2.5C17.4 2.5 18.2 3.6 18.2 6S17.4 9.5 15 9.5"/><circle class="waiting-breath" cx="11" cy="6" r="1.3" fill="currentColor"/></svg></span>';
 const paths={completed:'M3 5l3 3 5-6',idle:'M4 5h6',error:'M7 2v4m0 2v.1',unknown:'m3 2 8 6M4 6l-1 1m7-4 1-1'};
 return '<span class="static-state" aria-hidden="true"><svg viewBox="0 0 14 10" fill="none"><path d="'+(paths[state]||paths.unknown)+'" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
}
export function preserveMark(container,state){if(container.dataset.state!==state){container.innerHTML=mark(state);container.dataset.state=state}}
export const stateLabels={thinking:'思考中',running:'执行中',waiting:'等待授权',completed:'已完成',idle:'空闲',error:'任务异常',unknown:'未同步'};
