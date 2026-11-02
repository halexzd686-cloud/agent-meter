import path from 'node:path';
import os from 'node:os';
import {PROVIDERS} from './catalog.mjs';
export const APP_NAMES={deepseek:'DeepSeek Harness',kimi:'Kimi Code',codex:'Codex',glm:'ZCode',claude:'Claude',cursor:'Cursor'};
export function dataDirectory({platform=process.platform,home=os.homedir(),env=process.env}={}){
 if(env.AGENT_METER_DATA_DIR)return env.AGENT_METER_DATA_DIR;
 if(platform==='darwin')return path.posix.join(home,'Library/Application Support/Agent Meter');
 if(platform==='win32')return path.win32.join(env.APPDATA||path.win32.join(home,'AppData/Roaming'),'Agent Meter');
 return path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'Agent Meter');
}
// Only discovery may populate a path. Defaults must not pretend an app is installed.
export function defaultApplicationPath(){return ''}
export function applicationChoices(id,{platform=process.platform,home=os.homedir(),env=process.env}={}){
 const name=APP_NAMES[id],provider=PROVIDERS.find(p=>p.id===id);if(!name||!provider)return [];
 if(platform==='darwin')return ['/Applications/'+name+'.app',path.posix.join(home,'Applications',name+'.app')];
 if(platform!=='win32')return [];
 const local=env.LOCALAPPDATA||path.win32.join(home,'AppData/Local');
 const programs=[env.ProgramW6432,env.ProgramFiles,env['ProgramFiles(x86)']].filter(Boolean);
 const candidates=[path.win32.join(local,'Programs',name,provider.executable||name+'.exe'),...programs.map(base=>path.win32.join(base,name,provider.executable||name+'.exe'))];
 if(id==='claude')candidates.push(path.win32.join(local,'AnthropicClaude','claude.exe'));
 return [...new Set(candidates)];
}
