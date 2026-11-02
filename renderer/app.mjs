import{ICONS}from'./icons.mjs';import{mark,preserveMark,stateLabels}from'./motion.mjs';import{metric,ratio,quotaLabel,quotaNote}from'./format.mjs';
const $=s=>document.querySelector(s),view=new URLSearchParams(location.search).get('view')||'rail';
document.body.className='view-'+view;
let snapshot=null,settingsInitialized=false,panelProvider=null,tasksKey='',feedbackTimer;
const rows=new Map();let panelReadyFrame=0,panelReadyKey='',panelEntrance;
function preparePanel(data){
 if(!Number.isInteger(data.panelRequestId))return;const key=data.currentProvider+':'+data.panelRequestId;if(key===panelReadyKey)return;panelReadyKey=key;cancelAnimationFrame(panelReadyFrame);
 panelReadyFrame=requestAnimationFrame(()=>{panelReadyFrame=requestAnimationFrame(()=>{const panel=$('#panel-view');if(panel.isConnected)call('panelReady',{provider:data.currentProvider,requestId:data.panelRequestId,height:panel.scrollHeight}).catch(e=>showFeedback(e.message,true))})});
}
function revealPanel(){
 const panel=$('#panel-view');panelEntrance?.cancel();if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 panelEntrance=panel.animate([{opacity:.84,clipPath:'inset(0 0 0 8px)'},{opacity:1,clipPath:'inset(0 0 0 0)'}],{duration:150,easing:'cubic-bezier(0.16, 1, 0.3, 1)'});
}
async function call(name,...args){const r=await window.meter[name](...args);if(!r?.ok)throw new Error(r?.error||'操作失败');return r.value}
function taskLabel(task){return task?.state==='waiting'&&task.waitingReason==='question'?'等待回复':stateLabels[task?.state||'unknown']}
function text(selector,value){const e=$(selector);if(e&&e.textContent!==value)e.textContent=value}
function brand(p){return '<span class="brand" aria-hidden="true">'+(ICONS[p.id]||'<svg viewBox="0 0 20 20" fill="none"><path d="M3 15V5h14v10Z" stroke="currentColor"/></svg>')+'</span>'}
function showFeedback(message,error=false){const target=view==='settings'?$('#settings-feedback'):$('#panel-feedback');if(target){target.textContent=message;target.classList.toggle('error-text',error)}}
function railRender(data){
 $('#rail-view').hidden=data.collapsed;$('#rail-peek').hidden=!data.collapsed;
 const providers=data.providers.filter(p=>p.enabled),present=new Set(providers.map(p=>p.id)),list=$('#rail-accounts');
 for(const[id,row]of rows)if(!present.has(id)){row.remove();rows.delete(id)}
 if(!providers.length){list.innerHTML='<button class="rail-empty" id="empty-settings">连接应用</button>';$('#empty-settings').onclick=()=>call('openSettings');return}
 list.querySelector('.rail-empty')?.remove();
 for(const [index,p] of providers.entries()){
  let row=rows.get(p.id);if(!row){row=document.createElement('button');row.className='account-row';row.innerHTML=brand(p)+'<span class="account-value"></span><span class="quota" aria-hidden="true"></span><span class="account-state"></span><span class="task-count"></span>';row.onclick=()=>call('openProvider',p.id).catch(()=>{});rows.set(p.id,row);list.append(row)}
  if(list.children[index]!==row)list.insertBefore(row,list.children[index]||null);
  row.classList.toggle('active',p.id===data.currentProvider);
  const amount=metric(p);row.querySelector('.account-value').textContent=amount;preserveMark(row.querySelector('.account-state'),p.state);
  row.setAttribute('aria-label',p.name+'，'+amount+'，'+stateLabels[p.state]+(p.waitingCount?'，'+p.waitingCount+' 项待确认':'')+'，查看详情');row.title=p.name+' · '+stateLabels[p.state]+(data.demo?' · 演示数据':'');
  const r=ratio(p),meter=row.querySelector('.quota'),unknown=r===null;
  if(meter.dataset.mode!==(unknown?'unknown':'known')){meter.dataset.mode=unknown?'unknown':'known';meter.innerHTML=unknown?'<svg viewBox="0 0 2 30"><path d="M1 0v30" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 3"/></svg>':'<i class="quota-fill"></i>'}
  meter.classList.toggle('unknown',unknown);meter.classList.toggle('stale',p.quotaStale);if(!unknown)meter.firstChild.style.transform='scaleY('+r+')';
  row.querySelector('.task-count').textContent=p.waitingCount>1?String(p.waitingCount):'';
 }
 const waiting=providers.some(p=>p.waitingCount>0);preserveMark($('#peek-mark'),waiting?'waiting':'idle');
 $('#rail-peek').setAttribute('aria-label','展开额度轨道'+(waiting?'，有任务等待确认':''));
}
function panelRender(data){
 const p=data.providers.find(p=>p.id===data.currentProvider);if(!p)return;
 if(panelProvider!==p.id){$('#panel-brand').innerHTML=brand(p);panelProvider=p.id;tasksKey='';text('#panel-feedback','')}
 $('#panel-demo').hidden=!data.demo;text('#panel-name',p.name);text('#panel-connection',p.message||'等待数据接入');text('#panel-state',taskLabel(p.currentTask||{state:p.state}));
 preserveMark($('#panel-mark'),p.state);text('#panel-quota-label',quotaLabel(p));text('#panel-quota-value',metric(p));text('#panel-quota-note',quotaNote(p));
 const r=ratio(p);$('#panel-meter').hidden=r===null;if(r!==null)$('#panel-meter i').style.transform='scaleX('+r+')';
 const key=JSON.stringify(p.tasks.map(t=>[t.id,t.state,t.title,t.observedAt]));
 if(key!==tasksKey){tasksKey=key;const list=$('#panel-tasks');list.replaceChildren();for(const task of p.tasks.slice(0,5)){const row=document.createElement('button');row.className='task-row';const title=document.createElement('span');title.className='task-row-title';title.textContent=task.title;const details=document.createElement('span');details.className='task-row-detail';details.innerHTML=mark(task.state);const label=document.createElement('span');label.textContent=taskLabel(task)+(task.stale?' · 状态待更新':'');details.append(label);row.append(title,details);row.onclick=()=>activate(p.id,task.id);list.append(row)}}
 text('#panel-open-label',p.state==='waiting'?(p.currentTask?.waitingReason==='question'?'查看待回复任务':'查看待确认任务'):'在应用中查看');
 preserveMark($('#panel-open-mark'),p.state==='waiting'?'waiting':'idle');$('#panel-open-mark').hidden=p.state!=='waiting';
 $('#panel-open').onclick=()=>activate(p.id,p.currentTask?.id||'');preparePanel(data);
}
async function activate(id,task){try{const result=await call('activateTask',id,task);showFeedback(result.message)}catch(e){showFeedback(e.message,true)}}
function makeField(label,input,help=''){const wrap=document.createElement('label');wrap.className='field';const title=document.createElement('span');title.textContent=label;wrap.append(title,input);if(help){const small=document.createElement('small');small.textContent=help;wrap.append(small)}return wrap}
function pathInput(id,value){const row=document.createElement('div');row.className='input-row';const input=document.createElement('input');input.type='text';input.value=value||'';input.id='path-'+id;input.spellcheck=false;input.autocomplete='off';input.placeholder=id==='codex-cli'?'选择 Codex CLI':snapshot?.platform==='darwin'?'选择应用 .app':'选择应用 .exe';const button=document.createElement('button');button.type='button';button.className='plain-button';button.textContent='选择';button.onclick=async()=>{try{let selected=await call('chooseExecutable',id);if(selected)input.value=selected}catch(e){showFeedback(e.message,true)}};row.append(input,button);return row}
function initSettings(data){
 const config=data.settings;$('#always-on-top').checked=config.alwaysOnTop;$('#notifications').checked=config.notifications;$('#start-at-login').checked=config.startAtLogin;$('#start-at-login').disabled=!data.packaged;$('#attention-mode').value=config.attentionMode;
 text('#login-note',data.packaged?'':'开发运行期间不设置开机启动，打包后可开启。');
 const form=$('#providers-form');form.replaceChildren();
 for(const p of data.providers){
  const card=document.createElement('section');card.className='provider-config';card.dataset.provider=p.id;
  const head=document.createElement('header');head.className='provider-config-head';const identity=document.createElement('label');identity.className='check';const toggle=document.createElement('input');toggle.type='checkbox';toggle.id='enabled-'+p.id;toggle.checked=config.providers[p.id].enabled;identity.append(toggle);const icon=document.createElement('span');icon.innerHTML=brand(p);identity.append(icon,document.createTextNode(p.name));const status=document.createElement('span');status.className='provider-config-status';status.id='status-'+p.id;head.append(identity,status);card.append(head);
  card.append(makeField('应用启动程序',pathInput(p.id,config.providers[p.id].executablePath),p.id==='codex'?'未配置路径时，尝试唤醒正在运行的 Codex。':p.id==='kimi'?'自动连接已登录的 Kimi Code 本地服务，读取原生额度与任务状态，无需填写 API Key。':''));
  const connection=document.createElement('p');connection.className='connection-detail';connection.id='connection-'+p.id;card.append(connection);
  if(p.id==='deepseek'){
   const row=document.createElement('div');row.className='input-row';const secret=document.createElement('input');secret.type='password';secret.id='deepseek-key';secret.autocomplete='new-password';secret.placeholder=config.secretConfigured.deepseek?'已保存，加密存储；留空可保持原值':'输入 DeepSeek API Key';const save=document.createElement('button');save.type='button';save.className='plain-button';save.textContent='保存密钥';save.onclick=async()=>{if(!secret.value)return;try{await call('setSecret','deepseek',secret.value);secret.value='';secret.placeholder='已保存，加密存储';showFeedback('DeepSeek 密钥已保存，正在更新余额')}catch(e){showFeedback(e.message,true)}};const remove=document.createElement('button');remove.type='button';remove.className='plain-button';remove.textContent='移除';remove.onclick=async()=>{try{await call('setSecret','deepseek','');secret.value='';secret.placeholder='输入 DeepSeek API Key';showFeedback('已移除 DeepSeek 密钥')}catch(e){showFeedback(e.message,true)}};row.append(secret,save,remove);card.append(makeField('余额接口凭据',row,'仅向 DeepSeek 官方余额接口发送；使用系统密钥存储加密保存。'));
   const budget=document.createElement('input');budget.type='number';budget.min='0';budget.step='.01';budget.id='deepseek-budget';budget.value=config.deepseekBudget||'';budget.placeholder='可选：用于计算左侧刻度';card.append(makeField('预算上限（与账户余额同币种）',budget,'留空时只显示金额，不推算百分比。'));
  }
  if(p.id==='codex')card.append(makeField('Codex CLI（可选）',pathInput('codex-cli',config.codexCliPath),'自动读取本地会话，额度优先通过 Codex 自带接口查询。'));
  const advanced=document.createElement('details');advanced.className='provider-extra';const summary=document.createElement('summary');summary.textContent='会话定位（可选）';const input=document.createElement('input');input.type='text';input.id='link-'+p.id;input.value=config.providers[p.id].deepLinkTemplate||'';input.placeholder='已确认可用的应用链接，任务 ID 用 {taskId}';advanced.append(summary,makeField('会话链接模板',input,'未配置时唤醒应用，不保证定位到具体会话。'));card.append(advanced);form.append(card);
 }
 $('#demo-provider').replaceChildren(...data.providers.map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;return o}));
 settingsInitialized=true;
}
function settingsRender(data){
 if(!settingsInitialized)initSettings(data);
 for(const p of data.providers){text('#status-'+p.id,stateLabels[p.state]+' · '+metric(p));text('#connection-'+p.id,p.message||'等待本地事件接入')}
 $('#demo-mode').checked=data.demo;$('#demo-controls').hidden=!data.demo;text('#bridge-status',data.bridge.port?'本地事件接收已开启，可连接任务状态与额度来源。':'本地事件接收未启动。');
}
function render(data){snapshot=data;if(view==='rail')railRender(data);if(view==='panel')panelRender(data);if(view==='settings')settingsRender(data)}
function bind(){
 $('#rail-settings').onclick=()=>call('openSettings');$('#rail-collapse').onclick=()=>call('collapse');$('#rail-peek').onclick=()=>call('collapse');
 $('#panel-close').onclick=()=>call('closePanel');$('#panel-settings').onclick=()=>call('openSettings');
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&view==='panel')call('closePanel')});
 $('#save-settings').onclick=async()=>{
  const providers={};for(const p of snapshot.providers)providers[p.id]={enabled:$('#enabled-'+p.id).checked,executablePath:$('#path-'+p.id).value.trim(),deepLinkTemplate:$('#link-'+p.id).value.trim()};
  const budget=Number($('#deepseek-budget').value);
  try{await call('saveSettings',{providers,alwaysOnTop:$('#always-on-top').checked,notifications:$('#notifications').checked,startAtLogin:$('#start-at-login').checked,attentionMode:$('#attention-mode').value,codexCliPath:$('#path-codex-cli').value.trim(),deepseekBudget:budget>0?budget:null});showFeedback('设置已保存')}catch(e){showFeedback(e.message,true)}
 };
 $('#refresh').onclick=async()=>{const b=$('#refresh');b.disabled=true;showFeedback('正在更新…');try{render(await call('refresh'));showFeedback('已完成本次更新')}catch(e){showFeedback(e.message,true)}finally{b.disabled=false}};
 $('#demo-mode').onchange=async e=>{try{await call('setDemo',e.target.checked);showFeedback(e.target.checked?'当前显示演示数据':'已切换到真实数据')}catch(error){showFeedback(error.message,true)}};
 $('#apply-demo').onclick=()=>call('demoState',$('#demo-provider').value,$('#demo-state').value).catch(e=>showFeedback(e.message,true));
 $('#copy-bridge').onclick=()=>call('copyBridgeCommand').then(()=>showFeedback('本地接入命令已复制')).catch(e=>showFeedback(e.message,true));
}
function animationVisibility(){
 document.addEventListener('visibilitychange',()=>document.getAnimations().forEach(a=>document.hidden?a.pause():a.play()));
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.getAnimations({subtree:true}).forEach(a=>entry.isIntersecting&&!document.hidden?a.play():a.pause())});
 const observed=new Set();const watch=()=>{for(const e of observed)if(!e.isConnected){observer.unobserve(e);observed.delete(e)}document.querySelectorAll('.motion').forEach(e=>{if(!observed.has(e)){observed.add(e);observer.observe(e)}})};new MutationObserver(watch).observe(document.body,{childList:true,subtree:true});watch();
}
if(!window.meter){document.body.textContent='请从 Agent Meter 桌面程序打开此界面。'}else{
 $('#'+view+'-view').hidden=false;if(view==='panel')window.meter.onPanelOpen(revealPanel);bind();animationVisibility();window.meter.subscribe(render);if(view==='panel'){const panel=$('#panel-view');new ResizeObserver(()=>{if(panel.isConnected)call('resizePanel',panel.scrollHeight).catch(()=>{})}).observe(panel);}call('snapshot').then(render).catch(e=>{console.error(e.stack||e.message);document.body.textContent='组件未能连接：'+e.message});
}
