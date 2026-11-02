import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const severity={info:0,low:1,moderate:2,high:3,critical:4};
export function assessAudit(report,lock,policy,now=Date.now()){
 if(report.error||!report.metadata||!report.vulnerabilities)throw new Error('Incomplete npm audit response');
 const graph=report.vulnerabilities,accepted=[],blocked=[];
 function leaves(name,seen=new Set()){
  if(seen.has(name))return [];seen=new Set(seen);seen.add(name);
  const item=graph[name];if(!item)return ['unresolved:'+name];
  return (item.via||[]).flatMap(v=>typeof v==='string'?leaves(v,seen):[v.url?.match(/GHSA-[a-z0-9-]+/)?.[0]||'unknown-advisory']);
 }
 for(const [name,item] of Object.entries(graph)){
  const ids=[...new Set(leaves(name))];
  const devOnly=Array.isArray(item.nodes)&&item.nodes.length>0&&item.nodes.every(n=>lock.packages?.[n]?.dev===true);
  const allowed=devOnly&&ids.length>0&&ids.every(id=>(policy.exceptions||[]).some(e=>e.id===id&&e.developmentOnly===true&&e.packages.includes(name)&&(severity[item.severity]??99)<=(severity[e.maxSeverity]??-1)&&Date.parse(e.expires+'T23:59:59Z')>=now));
  (allowed?accepted:blocked).push({package:name,severity:item.severity,advisories:ids,developmentOnly:devOnly});
 }
 if((report.metadata.vulnerabilities?.total||0)>0&&!Object.keys(graph).length)throw new Error('Audit totals and findings disagree');
 return {accepted,blocked};
}
async function main(){
 if(!process.env.npm_execpath)throw new Error('Run with npm run audit:check');
 const result=spawnSync(process.execPath,[process.env.npm_execpath,'audit','--json','--registry=https://registry.npmjs.org'],{encoding:'utf8',maxBuffer:8*1024*1024,windowsHide:true});
 if(result.error)throw result.error;if(result.status!==0&&result.status!==1)throw new Error('npm audit could not complete');
 let report;try{report=JSON.parse(result.stdout)}catch{throw new Error('npm audit returned no valid JSON')}
 const lock=JSON.parse(await readFile('package-lock.json','utf8')),policy=JSON.parse(await readFile('security/audit-exceptions.json','utf8'));
 const outcome=assessAudit(report,lock,policy);
 await mkdir('.cache',{recursive:true});await writeFile('.cache/dependency-audit.json',JSON.stringify({report,outcome},null,2));
 console.log(JSON.stringify({reported:report.metadata.vulnerabilities,temporaryDevExceptions:outcome.accepted,blocked:outcome.blocked},null,2));
 if(outcome.blocked.length)throw new Error('Dependency audit failed: new, production, higher-severity, unreviewed or expired findings');
 if(outcome.accepted.length)console.log('Known development-only advisories remain reported. See docs/DEPENDENCY_SECURITY.md and the exception expiry.');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(e=>{console.error(e.message);process.exitCode=1});
