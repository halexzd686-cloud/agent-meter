import{readFile}from'node:fs/promises';import vm from'node:vm';import{EventEmitter}from'node:events';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{PROVIDERS,PROVIDER_IDS}from'../../src/core/catalog.mjs';
export async function panelHarness(){
 let clock=0,nextTimer=1;const timers=new Map(),handlers=new Map(),windows=[];
 const later=(fn,ms=0)=>{const id=nextTimer++;timers.set(id,{fn,at:clock+ms});return id};
 const tick=ms=>{const end=clock+ms;for(;;){const due=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;clock=due[1].at;timers.delete(due[0]);due[1].fn()}clock=end};
 class Window extends EventEmitter{
  constructor(options={}){super();this.bounds={x:0,y:0,width:326,height:470,...options};this.visible=false;this.focused=false;this.hideCount=0;this.showCount=0;this.boundsCount=0;this.destroyed=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:windows.length+1,mainFrame:{},session:{setPermissionRequestHandler(){}},setWindowOpenHandler(){},setZoomFactor(){},send(){}});windows.push(this)}
  isDestroyed(){return this.destroyed}isFocused(){return this.focused}isVisible(){return this.visible}getBounds(){return this.bounds}setBounds(value){this.bounds={...this.bounds,...value};this.boundsCount++}setMenuBarVisibility(){}loadFile(){}setAlwaysOnTop(){}
  show(){this.showCount++;this.visible=true;for(const w of windows)w.focused=false;this.focused=true;this.emit('focus')}
  showInactive(){this.showCount++;this.visible=true}focus(){for(const w of windows)w.focused=false;this.focused=true;this.emit('focus')}
  hide(){this.visible=false;this.focused=false;this.hideCount++;this.emit('hide')}
 }
 const application=new EventEmitter();Object.assign(application,{setName(){},setAppUserModelId(){},requestSingleInstanceLock:()=>true,whenReady:()=>new Promise(()=>{}),getVersion:()=> 'test',isPackaged:false});
 const area={x:0,y:0,width:1920,height:1080};const display={id:1,workArea:area};
 const context={app:application,BrowserWindow:Window,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},path,fileURLToPath,pathToFileURL,URL,PROVIDERS,PROVIDER_IDS,MeterState:class extends EventEmitter{snapshot(){return{providers:[]}}},CodexAdapter:class{},KimiAdapter:class{},screen:{getAllDisplays:()=>[display],getDisplayNearestPoint:()=>display,getDisplayMatching:()=>display},process:{env:{},argv:[]},setTimeout:later,clearTimeout:id=>timers.delete(id),setInterval:later,clearInterval:id=>timers.delete(id),console};
 const filename=fileURLToPath(new URL('../../electron/main.mjs',import.meta.url));let source=await readFile(filename,'utf8');source=source.replace(/^import[^\n]*\n/gm,'').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(filename).href));
 source+='\n;globalThis.testSubject={showProvider,positionPanel,registerIpc,publicSnapshot,initialize:(r,s)=>{rail=r;settings=s},getPanel:()=>panel};';vm.runInNewContext(source,context,{filename});
 const rail=new Window({x:1870,y:300,width:50,height:369}),settings={value:{alwaysOnTop:true,providers:Object.fromEntries(PROVIDERS.map(p=>[p.id,{enabled:p.enabled}]))},public:()=>({})};rail.visible=true;context.testSubject.initialize(rail,settings);context.testSubject.registerIpc();
 const ready=()=>{const panel=context.testSubject.getPanel();panel.emit('ready-to-show');tick(35);const fn=handlers.get('meter:panel-ready');if(fn){const snapshot=context.testSubject.publicSnapshot();fn({sender:panel.webContents,senderFrame:panel.webContents.mainFrame},{provider:snapshot.currentProvider,requestId:snapshot.panelRequestId,height:340});tick(35)}return panel};
 return{...context.testSubject,rail,tick,ready,handlers,Window};
}
