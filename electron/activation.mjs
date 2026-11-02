import{APP_NAMES,applicationChoices}from'../src/core/platform.mjs';
import{spawn}from'node:child_process';import{stat,readdir}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
const schemes={codex:['codex:'],cursor:['cursor:','vscode:'],kimi:['kimi:','kimicode:'],glm:['zcode:'],deepseek:['deepseek:'],claude:['claude:']};
const hosts={codex:['chatgpt.com'],cursor:['cursor.com'],kimi:['kimi.com','www.kimi.com'],glm:['z.ai','zcode.z.ai'],deepseek:['chat.deepseek.com'],claude:['claude.ai']};
export function taskUrl(provider,template,taskId){
 if(!template)return null;let url;try{url=new URL(template.replaceAll('{taskId}',encodeURIComponent(taskId||'')))}catch{throw new Error('会话链接模板无效')}
 if(url.username||url.password)throw new Error('链接不能包含登录凭据');
 if((schemes[provider]||[]).includes(url.protocol))return url.href;
 if(url.protocol==='https:'&&(hosts[provider]||[]).includes(url.hostname))return url.href;
 throw new Error('仅支持对应应用的链接协议或官网地址');
}
export async function discoverExecutable(configured,{platform=process.platform}={}){
 if(!configured)return null;
 try{const entry=await stat(configured);return entry.isFile()||(platform==='darwin'&&entry.isDirectory()&&/\.app$/i.test(configured))?configured:null}catch{return null}
}
export async function discoverProviderApplication(provider,{configured='',platform=process.platform,home,env=process.env}={}){
 const selected=await discoverExecutable(configured,{platform});if(selected)return selected;
 for(const candidate of applicationChoices(provider,{platform,home,env})){
  const found=await discoverExecutable(candidate,{platform});if(found)return found;
 }
 return null;
}
export async function activateProvider({provider,config,task,shell,platform=process.platform,spawnImpl=spawn,home,env=process.env}){
 const link=taskUrl(provider,config.deepLinkTemplate,task?.sessionId||task?.id);
 if(link){await shell.openExternal(link);return{opened:true,locatedTask:true}}
 let exe=await discoverProviderApplication(provider,{configured:config.executablePath,platform,home,env});
 if(platform==='darwin'){
  await new Promise((resolve,reject)=>{const child=spawnImpl('/usr/bin/open',['-a',exe||APP_NAMES[provider]],{stdio:'ignore'});child.once('error',()=>reject(new Error('无法打开应用，请在设置中选择 .app')));child.once('exit',code=>code===0?resolve():reject(new Error('未找到应用，请在设置中选择 .app')))});return{opened:true,locatedTask:false};
 }
if(!exe&&provider!=='codex')throw new Error('尚未配置可用的应用启动程序，请在设置中选择 .exe');
 if(platform==='win32'){
  const script=fileURLToPath(new URL('./wake-app.ps1',import.meta.url)).replace('app.asar','app.asar.unpacked');
  await new Promise((resolve,reject)=>{const child=spawnImpl('powershell.exe',['-NoProfile','-NonInteractive','-File',script,'-ProcessName',provider==='codex'?'Codex':path.basename(exe,'.exe'),...(exe?['-ExecutablePath',exe]:[])],{windowsHide:true,stdio:['ignore','pipe','ignore']});let output='';child.stdout.on('data',d=>output+=d);child.on('error',()=>reject(new Error('无法唤醒应用')));child.on('exit',code=>code===0?resolve(output):reject(new Error('无法启动应用，请检查启动程序路径')))});
 }else{const child=spawn(exe,[],{detached:true,stdio:'ignore'});child.on('error',()=>{});child.unref()}
 return{opened:true,locatedTask:false};
}
