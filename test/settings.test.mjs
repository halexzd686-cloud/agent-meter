import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Settings} from '../electron/settings.mjs';
import {temporaryDirectory} from './helpers/temp.mjs';

test('fresh setup is pending until preferences are saved and reloaded',async t=>{const home=await temporaryDirectory(t,'settings');const initial=await new Settings(home,{}).load();assert.equal(initial.firstRun,true);await initial.update({notifications:false});const reopened=await new Settings(home,{}).load();assert.equal(reopened.firstRun,false);assert.equal(reopened.value.notifications,false)});
test('existing user application paths survive loading the generic release',async t=>{const home=await temporaryDirectory(t,'settings-existing');await writeFile(path.join(home,'settings.json'),JSON.stringify({providers:{kimi:{enabled:true,executablePath:'D:/custom/Kimi Code.exe'}}}));const existing=await new Settings(home,{}).load();assert.equal(existing.firstRun,false);assert.equal(existing.value.providers.kimi.executablePath,'D:/custom/Kimi Code.exe')});
