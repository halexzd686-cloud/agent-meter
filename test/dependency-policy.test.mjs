import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAudit} from '../scripts/check-dependencies.mjs';
const id='GHSA-g3hv-75wg-m249',node='node_modules/minimatch',now=Date.parse('2026-11-02T00:00:00Z');
function fixture(){return {report:{metadata:{vulnerabilities:{total:1}},vulnerabilities:{minimatch:{severity:'moderate',nodes:[node],via:[{url:'https://github.com/advisories/'+id}]}}},lock:{packages:{[node]:{dev:true}}},policy:{exceptions:[{id,expires:'2026-12-02',maxSeverity:'moderate',developmentOnly:true,packages:['minimatch']}]}}}
test('audit accepts only a current, scoped development exception',()=>{const f=fixture();assert.equal(assessAudit(f.report,f.lock,f.policy,now).accepted.length,1)});
test('audit blocks known advisories at a higher severity',()=>{const f=fixture();f.report.vulnerabilities.minimatch.severity='high';assert.equal(assessAudit(f.report,f.lock,f.policy,now).blocked.length,1)});
test('audit never exempts production packages',()=>{const f=fixture();f.lock.packages[node].dev=false;assert.equal(assessAudit(f.report,f.lock,f.policy,now).blocked.length,1)});
test('audit blocks expired exceptions and unknown advisories',()=>{const f=fixture();assert.equal(assessAudit(f.report,f.lock,f.policy,Date.parse('2026-12-03')).blocked.length,1);f.report.vulnerabilities.minimatch.via=[{url:'https://github.com/advisories/GHSA-aaaa-bbbb-cccc'}];assert.equal(assessAudit(f.report,f.lock,f.policy,now).blocked.length,1)});
test('audit rejects malformed or unavailable results',()=>{assert.throws(()=>assessAudit({error:{code:'NETWORK'}},{},{},now),/Incomplete/)});
