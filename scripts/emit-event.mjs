import{readFile}from'node:fs/promises';import path from'node:path';import os from'node:os';
const input=process.argv.slice(2),arg=name=>{let i=input.indexOf('--'+name);return i>=0?input[i+1]:undefined};
const directory=process.env.AGENT_METER_DATA_DIR||(process.platform==='darwin'?path.join(os.homedir(),'Library/Application Support/Agent Meter'):path.join(process.env.APPDATA||path.join(os.homedir(),'AppData/Roaming'),'Agent Meter'));
try{
const info=JSON.parse(await readFile(path.join(directory,'bridge.json'),'utf8'));
const provider=arg('provider')||'codex',state=arg('state')||'thinking';
const event={type:'task.state',provider,observedAt:new Date().toISOString(),source:'local-event',task:{id:arg('task')||'local-task',title:arg('title')||'Agent 任务',state,completionScope:arg('scope')||'unknown'}};
const response=await fetch('http://127.0.0.1:'+Number(info.port)+'/v1/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+info.token},body:JSON.stringify(event),signal:AbortSignal.timeout(1500)});
if(!response.ok)throw new Error('Event rejected ('+response.status+')');console.log('状态已发送：'+provider+' / '+state);
}catch(e){console.error('未能发送状态：'+(e.code==='ENOENT'?'请先启动 Agent Meter':e.message));process.exitCode=1}
