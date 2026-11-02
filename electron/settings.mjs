import{defaultApplicationPath}from'../src/core/platform.mjs';
import{readFile,writeFile,rename,mkdir}from'node:fs/promises';import path from'node:path';import{PROVIDERS,PROVIDER_IDS}from'../src/core/catalog.mjs';import{plainText}from'../src/core/contracts.mjs';
export function defaultSettings({platform=process.platform}={}){return{version:1,notifications:true,attentionMode:'panel',alwaysOnTop:true,startAtLogin:false,collapsed:false,verticalRatio:.42,displayId:null,deepseekBudget:null,codexCliPath:'',providers:Object.fromEntries(PROVIDERS.map(p=>[p.id,{enabled:p.enabled,executablePath:defaultApplicationPath(p.id,{platform}),deepLinkTemplate:''}]))}}
export class Settings{
 constructor(directory,secretStorage){this.directory=directory;this.crypto=secretStorage;this.value=defaultSettings();this.secrets={};this.firstRun=true;this.queue=Promise.resolve()}
 async load(){await mkdir(this.directory,{recursive:true,mode:0o700});try{const data=JSON.parse(await readFile(path.join(this.directory,'settings.json'),'utf8'));this.value=this.validated(data);this.firstRun=false}catch{}try{this.secrets=JSON.parse(await readFile(path.join(this.directory,'secrets.json'),'utf8'))}catch{}return this}
 validated(input){
  const out=defaultSettings();
  for(const key of['notifications','alwaysOnTop','startAtLogin','collapsed'])if(typeof input[key]==='boolean')out[key]=input[key];
  if(['notify','panel','activate-app'].includes(input.attentionMode))out.attentionMode=input.attentionMode;
  if(typeof input.verticalRatio==='number'&&Number.isFinite(input.verticalRatio))out.verticalRatio=Math.min(1,Math.max(0,input.verticalRatio));
  if(typeof input.displayId==='number')out.displayId=input.displayId;
  if(typeof input.deepseekBudget==='number'&&input.deepseekBudget>0)out.deepseekBudget=input.deepseekBudget;
  out.codexCliPath=plainText(input.codexCliPath,500);
  for(const p of PROVIDERS){const v=input.providers?.[p.id];if(!v)continue;out.providers[p.id]={enabled:typeof v.enabled==='boolean'?v.enabled:p.enabled,executablePath:plainText(v.executablePath,500),deepLinkTemplate:plainText(v.deepLinkTemplate,1000)}}
  return out;
 }
 public(){return {...this.value,secretConfigured:Object.fromEntries([...PROVIDER_IDS].map(id=>[id,!!this.secrets[id]]))}}
 async atomic(name,data){this.queue=this.queue.catch(()=>{}).then(async()=>{let file=path.join(this.directory,name),tmp=file+'.tmp';await writeFile(tmp,JSON.stringify(data,null,2),{encoding:'utf8',mode:0o600});await rename(tmp,file)});return this.queue}
 async update(input){this.value=this.validated({...this.value,...input,providers:{...this.value.providers,...input.providers}});await this.atomic('settings.json',this.value);return this.public()}
 async getSecret(id){if(!this.secrets[id])return null;try{return(await this.crypto.decryptStringAsync(Buffer.from(this.secrets[id],'base64'))).result}catch{return null}}
 async setSecret(id,value){if(!PROVIDER_IDS.has(id)||typeof value!=='string'||value.length>4000)throw new Error('无效的凭据');if(!value){delete this.secrets[id]}else{if(!await this.crypto.isAsyncEncryptionAvailable())throw new Error('系统凭据加密不可用');this.secrets[id]=(await this.crypto.encryptStringAsync(value)).toString('base64')}await this.atomic('secrets.json',this.secrets);return this.public()}
}
