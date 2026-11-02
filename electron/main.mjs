import{app,BrowserWindow,ipcMain,Tray,Menu,screen,Notification,safeStorage,shell,dialog,clipboard,nativeImage,nativeTheme}from'electron';
import{mkdirSync}from'node:fs';import{writeFile,unlink}from'node:fs/promises';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';
import{KimiAdapter}from'../src/adapters/kimi.mjs';
import{MeterState,seedDemo}from'../src/core/state.mjs';import{PROVIDERS,PROVIDER_IDS}from'../src/core/catalog.mjs';import{startBridge}from'../src/core/bridge.mjs';import{CodexAdapter,resolveCodexExecutable}from'../src/adapters/codex.mjs';import{pollDeepSeek}from'../src/adapters/deepseek.mjs';import{Settings}from'./settings.mjs';import{activateProvider,discoverProviderApplication}from'./activation.mjs';
const project=fileURLToPath(new URL('../',import.meta.url)),renderer=path.join(project,'renderer/index.html');
app.setName('Agent Meter');
if(process.env.AGENT_METER_DATA_DIR){mkdirSync(process.env.AGENT_METER_DATA_DIR,{recursive:true});app.setPath('userData',process.env.AGENT_METER_DATA_DIR);app.setPath('sessionData',process.env.AGENT_METER_DATA_DIR);const dumps=path.join(process.env.AGENT_METER_DATA_DIR,'crashes');mkdirSync(dumps,{recursive:true});app.setPath('crashDumps',dumps)}
if(process.platform==='win32')app.setAppUserModelId('io.agentmeter.desktop');
const lock=app.requestSingleInstanceLock();if(!lock){app.quit()}
let rail,panel,settingsWindow,tray,settings,bridge,currentProvider=null,quitting=false,moving=false,moveTimer,sendTimer,codexTimer,deepseekTimer,pollingCodex=false,pollingDeepSeek=false,demo=false,kimiTimer,pollingKimi=false,panelHeight=470,panelBlurTimer,panelRequestId=0,panelOpenRequest=null,panelPaintReady=false,setupComplete=false;
const state=new MeterState(),codex=new CodexAdapter(),kimi=new KimiAdapter();
function currentDisplay(){const all=screen.getAllDisplays();return all.find(d=>d.id===settings.value.displayId)||screen.getDisplayNearestPoint(screen.getCursorScreenPoint())}
function enabledCount(){return PROVIDERS.filter(p=>settings.value.providers[p.id]?.enabled).length}
function railSize(){return settings.value.collapsed?{width:24,height:70}:{width:50,height:19+Math.max(1,enabledCount())*78+38}}
function positionRail(display=currentDisplay()){
 if(!rail||rail.isDestroyed())return;const area=display.workArea,size=railSize();size.height=Math.min(size.height,area.height);
 const y=area.y+Math.round(Math.max(0,area.height-size.height)*settings.value.verticalRatio);
 moving=true;rail.setBounds({x:area.x+area.width-size.width,y,...size});setTimeout(()=>moving=false,180);positionPanel();
}
function positionPanel(){
 if(!panel||panel.isDestroyed()||!rail)return;let area=screen.getDisplayMatching(rail.getBounds()).workArea,b=rail.getBounds();
 let enabled=PROVIDERS.filter(p=>settings.value.providers[p.id]?.enabled),index=Math.max(0,enabled.findIndex(p=>p.id===currentProvider));
 const width=Math.min(326,Math.max(260,area.width-70)),height=Math.min(panelHeight,area.height-24);
 const next={x:Math.max(area.x+8,b.x-width-12),y:Math.min(area.y+area.height-height-8,Math.max(area.y+8,b.y+index*38)),width,height};
 const previous=panel.getBounds();if(Object.keys(next).some(key=>previous[key]!==next[key]))panel.setBounds(next);
}
function secureWindow(view,options={}){
 const win=new BrowserWindow({show:false,icon:path.join(project,'assets/app.png'),backgroundColor:'#f2eee6',webPreferences:{preload:path.join(project,'electron/preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:view!=='panel'},...options});
 if(process.platform==='darwin'&&view!=='settings')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
 win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith(pathToFileURL(renderer).href))e.preventDefault()});
 win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 win.webContents.on('console-message',details=>{if(details?.level==='error')console.error('Renderer '+view+': '+details.message)});
 win.webContents.on('preload-error',(_event,_file,error)=>console.error('Preload '+view+': '+error.message));
 win.webContents.on('render-process-gone',(_event,details)=>console.error('Renderer exited '+view+': '+details.reason));
 win.webContents.on('did-fail-load',(_e,code,description)=>{if(code!==-3)console.error('Renderer load failed:',view,code,description)});
 win.webContents.on('did-finish-load',()=>{win.webContents.setZoomFactor(1);broadcast()});
 win.loadFile(renderer,{query:{view}});return win;
}
function publicSnapshot(){return{...state.snapshot(settings?.value),settings:settings?.public(),currentProvider,panelRequestId,collapsed:settings?.value.collapsed||false,bridge:{port:bridge?.port||null},version:app.getVersion(),platform:process.platform,packaged:app.isPackaged}}
function broadcast(){clearTimeout(sendTimer);sendTimer=setTimeout(()=>{if(!settings)return;const value=publicSnapshot();for(const w of[rail,panel,settingsWindow])if(w&&!w.isDestroyed())w.webContents.send('meter:snapshot',value)},30)}
function hidePanel(){
 clearTimeout(panelBlurTimer);panelOpenRequest=null;panelRequestId++;panel?.hide();
}
function presentPreparedPanel(){
 const request=panelOpenRequest;if(!request?.prepared||!panelPaintReady||!panel||panel.isDestroyed())return;
 panelOpenRequest=null;clearTimeout(panelBlurTimer);positionPanel();
 if(!panel.isVisible()){
  panel.webContents.send('meter:panel-open');request.inactive?panel.showInactive():panel.show();
 }else if(!request.inactive&&!panel.isFocused())panel.focus();
}
function acceptPanelReady(value){
 const request=panelOpenRequest;
 if(!request||!value||value.provider!==currentProvider||value.requestId!==request.id||!Number.isFinite(value.height))return;
 panelHeight=Math.max(180,Math.min(560,Math.ceil(value.height)));request.prepared=true;presentPreparedPanel();
}
function showProvider(id,{inactive=false}={}){
 if(!PROVIDER_IDS.has(id))throw new Error('无效的应用');clearTimeout(panelBlurTimer);currentProvider=id;
 panelOpenRequest={id:++panelRequestId,inactive,prepared:false};
 if(!panel||panel.isDestroyed()){
  panelPaintReady=false;
  panel=secureWindow('panel',{width:326,height:470,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,skipTaskbar:true,alwaysOnTop:settings.value.alwaysOnTop,hasShadow:false,title:'Agent Meter · 账户详情'});
  panel.on('focus',()=>clearTimeout(panelBlurTimer));
  panel.on('blur',()=>{clearTimeout(panelBlurTimer);panelBlurTimer=setTimeout(()=>{if(!panelOpenRequest&&panel&&!panel.isDestroyed()&&!panel.isFocused()&&!rail?.isFocused()&&!settingsWindow?.isFocused())hidePanel()},120)});
  panel.on('closed',()=>{clearTimeout(panelBlurTimer);panel=null;panelPaintReady=false;panelOpenRequest=null});
  panel.once('ready-to-show',()=>{panelPaintReady=true;presentPreparedPanel()});
 }
 panel.webContents.send('meter:snapshot',publicSnapshot());broadcast();
}
function openSettings(){
 hidePanel();
 if(settingsWindow&&!settingsWindow.isDestroyed()){settingsWindow.show();settingsWindow.focus();return}
 settingsWindow=secureWindow('settings',{width:840,height:740,minWidth:650,minHeight:540,title:'Agent Meter · 设置',autoHideMenuBar:true});
 settingsWindow.on('closed',()=>settingsWindow=null);settingsWindow.once('ready-to-show',()=>settingsWindow.show());
}
function buildMenu(){return Menu.buildFromTemplate([{label:'打开设置',click:openSettings},{label:'收起轨道',type:'checkbox',checked:settings.value.collapsed,click:async()=>{await settings.update({collapsed:!settings.value.collapsed});positionRail();broadcast();tray.setContextMenu(buildMenu())}},{label:'回到屏幕右侧',click:()=>positionRail(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()))},{label:demo?'切换为真实数据':'查看演示数据',click:()=>setDemo(!demo)},{type:'separator'},{label:'退出 Agent Meter',click:()=>app.quit()}])}
function updateTray(){
 const iconPath=path.join(project,'assets',process.platform==='darwin'?'tray-dark.png':nativeTheme.shouldUseDarkColors?'tray-light.png':'tray-dark.png');
 let icon=nativeImage.createFromPath(iconPath);if(process.platform==='darwin'){icon=icon.resize({width:18,height:18});icon.setTemplateImage(true)}
 if(!tray){tray=new Tray(icon);tray.on('double-click',openSettings);tray.on('click',()=>{if(!rail.isVisible())rail.showInactive();positionRail()})}
 tray.setImage(icon);tray.setToolTip('Agent Meter'+(demo?' · 演示数据':' · 额度与任务状态'));tray.setContextMenu(buildMenu());
}
async function activate(id,taskId){
 const provider=state.snapshot(settings.value).providers.find(p=>p.id===id),task=provider?.tasks.find(t=>t.id===taskId)||provider?.currentTask;
 if(demo)return{opened:false,message:'当前为演示数据，切换到真实数据后可唤醒应用。'};
 const result=await activateProvider({provider:id,config:settings.value.providers[id],task,shell});
 return{...result,message:result.locatedTask?'已打开对应任务':'已唤醒应用；请在应用中选择对应会话。'};
}
async function attention({provider,task}){
 if(demo||process.argv.includes('--no-notifications'))return;
 const p=PROVIDERS.find(p=>p.id===provider);
 if(settings.value.notifications&&Notification.isSupported()){
  const n=new Notification({title:task.state==='waiting'?p.name+(task.waitingReason==='question'?' 等待你回复':' 等待你确认'):task.state==='completed'?p.name+' 任务已完成':p.name+' 任务异常',body:task.title||'点击查看任务',silent:true});
  n.on('click',()=>activate(provider,task.id).catch(()=>showProvider(provider)));n.on('failed',()=>{});n.show();
 }
 if(task.state==='waiting'&&settings.value.attentionMode==='panel')showProvider(provider,{inactive:true});
 if(settings.value.attentionMode==='activate-app')await activate(provider,task.id).catch(()=>showProvider(provider,{inactive:true}));
}
async function pollCodex(){
 if(!setupComplete||demo||pollingCodex||!settings.value.providers.codex.enabled)return;pollingCodex=true;
 try{const items=await codex.poll(settings.value);if(!demo)for(const {event,historical}of items)state.apply(event,{historical})}catch{state.apply({provider:'codex',type:'provider.connection',connection:'error',message:'无法读取 Codex 本地状态，请检查路径或权限'})}finally{pollingCodex=false}
}
async function pollKimi({forceQuota=false}={}){
 if(!setupComplete||demo||pollingKimi||!settings.value.providers.kimi.enabled)return;pollingKimi=true;
 try{const items=await kimi.poll({forceQuota});if(!demo)for(const{event,historical}of items)state.apply(event,{historical})}catch{if(!demo)state.apply({provider:'kimi',type:'provider.connection',connection:'error',message:'无法读取 Kimi 本地状态，请确认 Kimi Code 已打开并登录'})}finally{pollingKimi=false}
}
async function pollBalance(){
 if(!setupComplete||demo||pollingDeepSeek||!settings.value.providers.deepseek.enabled)return;pollingDeepSeek=true;
 try{const key=await settings.getSecret('deepseek');if(!key){state.apply({provider:'deepseek',type:'provider.connection',connection:'not-configured',message:'在设置中添加 DeepSeek API Key 后可读取余额'});return}const event=await pollDeepSeek({apiKey:key,budget:settings.value.deepseekBudget});if(!demo){state.apply(event);state.apply({provider:'deepseek',type:'provider.connection',connection:'connected',message:'官方余额接口已连接'})}}
 catch(e){if(!demo)state.apply({provider:'deepseek',type:'provider.connection',connection:'error',message:e.message})}finally{pollingDeepSeek=false}
}
function setDemo(value){demo=!!value;state.clear();state.demo=demo;if(demo)seedDemo(state);else{codex.lastRpc=0;kimi.lastQuota=0;pollCodex();pollBalance();pollKimi({forceQuota:true})}updateTray();broadcast()}
function authorize(event,settingsOnly=false){
 const sender=event.sender,allowed=[rail,panel,settingsWindow].filter(w=>w&&!w.isDestroyed());
 if(!allowed.some(w=>w.webContents.id===sender.id)||event.senderFrame!==sender.mainFrame)throw new Error('未授权的界面');
 if(settingsOnly&&(!settingsWindow||settingsWindow.webContents.id!==sender.id))throw new Error('只能从设置界面修改配置');
}
function handle(name,handler,{settingsOnly=false}={}){ipcMain.handle('meter:'+name,async(event,...args)=>{authorize(event,settingsOnly);try{return{ok:true,value:await handler(...args)}}catch(e){return{ok:false,error:e.message||'操作失败'}}})}
function registerIpc(){
 handle('panel-ready',value=>acceptPanelReady(value));
 handle('panel-height',height=>{if(typeof height==='number'&&Number.isFinite(height)){panelHeight=Math.max(180,Math.min(560,Math.ceil(height)));positionPanel()}});handle('snapshot',()=>publicSnapshot());handle('open-provider',id=>showProvider(id));handle('close-panel',hidePanel);handle('open-settings',openSettings);
 handle('collapse',async()=>{await settings.update({collapsed:!settings.value.collapsed});hidePanel();positionRail();updateTray();broadcast()});
 handle('activate-task',(id,taskId)=>{if(!PROVIDER_IDS.has(id))throw new Error('无效的应用');return activate(id,typeof taskId==='string'?taskId:'')});
 handle('refresh',async()=>{codex.lastRpc=0;await Promise.allSettled([pollCodex(),pollBalance(),pollKimi({forceQuota:true})]);return publicSnapshot()});
 handle('save-settings',async value=>{if(!value||typeof value!=='object')throw new Error('配置无效');const result=await settings.update(value);setupComplete=true;rail.setAlwaysOnTop(result.alwaysOnTop);panel?.setAlwaysOnTop(result.alwaysOnTop);if(app.isPackaged)app.setLoginItemSettings({openAtLogin:result.startAtLogin});positionRail();updateTray();broadcast();pollCodex();pollBalance();pollKimi({forceQuota:true});return result},{settingsOnly:true});
 handle('choose-executable',async id=>{if(!PROVIDER_IDS.has(id)&&id!=='codex-cli')throw new Error('无效的应用');const result=await dialog.showOpenDialog(settingsWindow,{title:id==='codex-cli'?'选择 Codex CLI':'选择应用启动程序',properties:['openFile'],...(process.platform==='darwin'?(id==='codex-cli'?{}:{filters:[{name:'macOS 应用',extensions:['app']}]}):{filters:[{name:'Windows 应用',extensions:['exe']}]})});return result.canceled?null:result.filePaths[0]},{settingsOnly:true});
 handle('set-secret',async(id,value)=>{const result=await settings.setSecret(id,value);broadcast();pollBalance();return result},{settingsOnly:true});
 handle('set-demo',value=>setDemo(value),{settingsOnly:true});
 handle('demo-state',(id,s)=>{if(!demo||!PROVIDER_IDS.has(id)||!['thinking','running','waiting','completed','idle','error'].includes(s))throw new Error('仅演示模式可切换状态');state.apply({provider:id,type:'task.state',source:'demo',task:{id:'demo-'+id,state:s,title:'组件状态演示'}},{historical:true})},{settingsOnly:true});
 handle('copy-bridge-command',()=>{clipboard.writeText('node "'+path.join(project.replace('app.asar','app.asar.unpacked'),'scripts/emit-event.mjs')+'" --provider kimi --state waiting --task sample-task');return true},{settingsOnly:true});
}
app.on('second-instance',()=>{rail?.showInactive();openSettings()});
app.whenReady().then(async()=>{
 if(!lock)return;
 if(process.platform==='darwin')app.dock?.hide();
 settings=await new Settings(app.getPath('userData'),safeStorage).load();
 setupComplete=!settings.firstRun;
 for(const p of PROVIDERS){const config=settings.value.providers[p.id];if(!config.executablePath)config.executablePath=await discoverProviderApplication(p.id)||'';}
 bridge=await startBridge({onEvent:event=>{if(!demo){state.apply(event);if(event.type!=='provider.connection')state.apply({provider:event.provider,type:'provider.connection',connection:'connected',message:'本地事件已连接',source:'bridge'})}}});
 await writeFile(path.join(app.getPath('userData'),'bridge.json'),JSON.stringify({port:bridge.port,token:bridge.token,pid:process.pid},null,2),{encoding:'utf8',mode:0o600});
 registerIpc();demo=process.argv.includes('--demo');if(demo)seedDemo(state);
 rail=secureWindow('rail',{...railSize(),frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,skipTaskbar:true,alwaysOnTop:settings.value.alwaysOnTop,hasShadow:false,title:'Agent Meter',maximizable:false,fullscreenable:false});
 rail.once('ready-to-show',()=>{positionRail();rail.showInactive();if(settings.firstRun||process.argv.includes('--settings'))openSettings()});
 rail.webContents.on('context-menu',()=>buildMenu().popup({window:rail}));
 rail.on('moved',()=>{if(moving||quitting)return;clearTimeout(moveTimer);moveTimer=setTimeout(async()=>{const b=rail.getBounds(),display=screen.getDisplayMatching(b),a=display.workArea;await settings.update({displayId:display.id,verticalRatio:(b.y-a.y)/Math.max(1,a.height-b.height)});positionRail(display)},350)});
 screen.on('display-metrics-changed',()=>positionRail());screen.on('display-removed',()=>positionRail(screen.getPrimaryDisplay()));
 state.on('change',broadcast);state.on('attention',event=>attention(event).catch(()=>{}));
 updateTray();nativeTheme.on('updated',updateTray);broadcast();
 kimiTimer=setInterval(pollKimi,2000);codexTimer=setInterval(pollCodex,3000);deepseekTimer=setInterval(pollBalance,60000);setInterval(broadcast,30000).unref();
 if(!demo){pollCodex();pollBalance();pollKimi()}
}).catch(error=>{console.error('Agent Meter startup failed:',error.message);app.quit()});
app.on('window-all-closed',()=>{});
app.on('before-quit',()=>{quitting=true;clearInterval(kimiTimer);clearInterval(codexTimer);clearInterval(deepseekTimer);clearTimeout(moveTimer);clearTimeout(sendTimer);clearTimeout(panelBlurTimer);bridge?.close();unlink(path.join(app.getPath('userData'),'bridge.json')).catch(()=>{});tray?.destroy()});
