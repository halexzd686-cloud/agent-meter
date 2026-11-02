export const PROVIDERS=Object.freeze([
{id:'deepseek',name:'DeepSeek Harness',icon:'deepseek',enabled:true,executable:'DeepSeek Harness.exe',adapter:'deepseek'},
{id:'kimi',name:'Kimi Code',icon:'kimi',enabled:true,executable:'Kimi Code.exe',adapter:'kimi'},
{id:'codex',name:'Codex',icon:'codex',enabled:true,executable:'',adapter:'codex'},
{id:'glm',name:'ZCode / GLM',icon:'zai',enabled:false,executable:'ZCode.exe',adapter:'bridge'},
{id:'claude',name:'Claude',icon:'claude',enabled:false,executable:'',adapter:'bridge'},
{id:'cursor',name:'Cursor',icon:'cursor',enabled:false,executable:'',adapter:'bridge'}
]);
export const PROVIDER_IDS=new Set(PROVIDERS.map(p=>p.id));
export const TASK_STATES=new Set(['thinking','running','waiting','completed','idle','error','unknown']);
export const STATE_LABELS={thinking:'思考中',running:'执行中',waiting:'等待授权',completed:'已完成',idle:'空闲',error:'任务异常',unknown:'未同步'};
