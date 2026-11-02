import test from'node:test';import assert from'node:assert/strict';import{panelHarness}from'./helpers/panel-harness.mjs';
test('agent switch keeps detail visible after the old blur timer expires',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.ready();assert.equal(panel.isVisible(),true);
 panel.focused=false;h.rail.focused=true;panel.emit('blur');h.tick(40);h.showProvider('kimi');h.ready();h.tick(200);
 assert.equal(panel.isVisible(),true,'switching agents must not let an old blur timer close the detail');
});
test('detail focus regained during transient blur keeps it open',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.ready();panel.focused=false;panel.emit('blur');h.tick(35);panel.focus();h.tick(200);
 assert.equal(panel.isVisible(),true,'focused detail must stay visible');
});
test('unchanged size reports do not resize the native window again',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.ready();h.positionPanel();const count=panel.boundsCount;for(let i=0;i<12;i++)h.positionPanel();assert.equal(panel.boundsCount,count,'unchanged layout should not issue setBounds');
});
test('genuine focus departure still dismisses detail',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.ready();panel.focused=false;h.rail.focused=false;panel.emit('blur');h.tick(250);assert.equal(panel.isVisible(),false);
});

test('first detail remains hidden until selected content reports ready',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.getPanel();panel.emit('ready-to-show');h.tick(100);assert.equal(panel.isVisible(),false,'native ready-to-show alone must not display an empty detail');h.ready();assert.equal(panel.isVisible(),true);
});
test('rapid switching ignores a stale content-ready acknowledgement',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const old=h.publicSnapshot();h.showProvider('kimi');const panel=h.getPanel();panel.emit('ready-to-show');const handler=h.handlers.get('meter:panel-ready');assert.ok(handler,'detail needs an explicit content-ready handshake');handler({sender:panel.webContents,senderFrame:panel.webContents.mainFrame},{provider:'deepseek',requestId:old.panelRequestId,height:340});assert.equal(panel.isVisible(),false);h.ready();assert.equal(panel.isVisible(),true);
});
test('closing during preparation cannot be undone by a late acknowledgement',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.getPanel(),old=h.publicSnapshot();panel.emit('ready-to-show');const event={sender:panel.webContents,senderFrame:panel.webContents.mainFrame};await h.handlers.get('meter:close-panel')(event);const handler=h.handlers.get('meter:panel-ready');assert.ok(handler);handler(event,{provider:'deepseek',requestId:old.panelRequestId,height:340});assert.equal(panel.isVisible(),false);
});
test('switching visible accounts reuses the window without a hide-show cycle',async()=>{
 const h=await panelHarness();h.showProvider('deepseek');const panel=h.ready(),shows=panel.showCount;h.showProvider('kimi');h.ready();assert.equal(h.getPanel(),panel);assert.equal(panel.hideCount,0);assert.equal(panel.showCount,shows);
});
