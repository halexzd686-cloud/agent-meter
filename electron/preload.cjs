const{contextBridge,ipcRenderer}=require('electron');
const invoke=(name,...args)=>ipcRenderer.invoke('meter:'+name,...args);
contextBridge.exposeInMainWorld('meter',Object.freeze({
 snapshot:()=>invoke('snapshot'),resizePanel:height=>invoke('panel-height',height),panelReady:value=>invoke('panel-ready',value),
 onPanelOpen:callback=>{const listener=()=>callback();ipcRenderer.on('meter:panel-open',listener);return()=>ipcRenderer.removeListener('meter:panel-open',listener)},
 subscribe:callback=>{const listener=(_e,data)=>callback(data);ipcRenderer.on('meter:snapshot',listener);return()=>ipcRenderer.removeListener('meter:snapshot',listener)},
 openProvider:id=>invoke('open-provider',id),closePanel:()=>invoke('close-panel'),openSettings:()=>invoke('open-settings'),
 collapse:()=>invoke('collapse'),activateTask:(id,taskId)=>invoke('activate-task',id,taskId),
 refresh:()=>invoke('refresh'),saveSettings:value=>invoke('save-settings',value),chooseExecutable:id=>invoke('choose-executable',id),
 setSecret:(id,value)=>invoke('set-secret',id,value),demoState:(id,state)=>invoke('demo-state',id,state),
 setDemo:value=>invoke('set-demo',value),copyBridgeCommand:()=>invoke('copy-bridge-command')
}));
