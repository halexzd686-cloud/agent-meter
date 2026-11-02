import{readFile}from'node:fs/promises';import path from'node:path';import os from'node:os';
let source='';for await(const chunk of process.stdin){source+=chunk;if(source.length>262144)break}
try{
 const data=JSON.parse(source||'{}'),mapping={UserPromptSubmit:'thinking',PreToolUse:'running',PostToolUse:'thinking',PermissionRequest:'waiting',Stop:'idle',Interrupt:'idle',SessionEnd:'idle'};
 const state=mapping[data.hook_event_name];if(state){
  const dir=process.env.AGENT_METER_DATA_DIR||(process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/Agent Meter'):path.join(process.env.APPDATA||path.join(os.homedir(),'AppData/Roaming'),'Agent Meter')),info=JSON.parse(await readFile(path.join(dir,'bridge.json'),'utf8'));
  await fetch('http://127.0.0.1:'+Number(info.port)+'/v1/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+info.token},body:JSON.stringify({type:'task.state',provider:'codex',source:'codex-hook',observedAt:new Date().toISOString(),task:{id:data.session_id||'codex-local',sessionId:data.session_id||'codex-local',state,completionScope:data.hook_event_name==='Stop'?'turn':'unknown',title:'Codex · '+(data.cwd?path.basename(data.cwd):'当前会话')}}),signal:AbortSignal.timeout(650)});
 }
}catch{}
process.stdout.write('{}');
