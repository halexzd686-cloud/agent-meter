import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationChoices} from '../src/core/platform.mjs';
import {defaultSettings} from '../electron/settings.mjs';

test('fresh settings contain no developer-specific or unverified executable paths',()=>{
 for(const platform of ['win32','darwin']){
  const config=defaultSettings({platform});
  assert.ok(Object.values(config.providers).every(p=>p.executablePath===''));
  assert.equal(config.providers.glm.enabled,false);
 }
});
test('Windows candidates use the current user environment',()=>{
 const choices=applicationChoices('kimi',{platform:'win32',home:'D:/Profiles/sample',env:{LOCALAPPDATA:'D:/Profiles/sample/Local',ProgramFiles:'D:/Applications'}});
 assert.equal(choices[0].split(String.fromCharCode(92)).join('/'),'D:/Profiles/sample/Local/Programs/Kimi Code/Kimi Code.exe');
 assert.ok(choices.every(p=>!p.includes('C:')&&!p.includes('E:')));
});

import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {temporaryDirectory} from './helpers/temp.mjs';
import {discoverProviderApplication} from '../electron/activation.mjs';
test('application discovery validates candidates and honors a custom executable',async t=>{const home=await temporaryDirectory(t,'app-discovery');assert.equal(await discoverProviderApplication('kimi',{platform:'darwin',home}),null);const bundle=path.join(home,'Applications/Kimi Code.app');await mkdir(bundle,{recursive:true});assert.equal(path.normalize(await discoverProviderApplication('kimi',{platform:'darwin',home})),path.normalize(bundle));const custom=path.join(home,'custom-app');await writeFile(custom,'fixture');assert.equal(await discoverProviderApplication('kimi',{platform:'darwin',home,configured:custom}),custom)});
