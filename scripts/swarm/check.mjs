// Read-only manifest validation. No agent execution, network calls, or filesystem mutation.
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const policy=JSON.parse(fs.readFileSync(path.join(root,'.agents/snowfight/ownership.json'),'utf8'));
const ledger=JSON.parse(fs.readFileSync(path.join(root,'.agents/snowfight/tasks.json'),'utf8'));
const fail=(message)=>{console.error('FAIL:',message);process.exitCode=1};
const agentById=new Map(policy.agents.map(a=>[a.id,a]));
const tasks=new Map(ledger.tasks.map(t=>[t.id,t]));
if(agentById.size!==policy.agents.length)fail('Duplicate agent IDs');
if(tasks.size!==ledger.tasks.length)fail('Duplicate task IDs');
if(!policy.constraints.noProductionDeploy||!policy.constraints.noDirectMain||!policy.constraints.requireOwnerMergeApproval)fail('Critical safety policy missing');
for(const t of ledger.tasks){
  if(!agentById.has(t.owner))fail(t.id+': unknown owner');
  if(!agentById.has(t.reviewer)&&t.reviewer!=='andrew')fail(t.id+': unknown reviewer');
  if(t.owner===t.reviewer)fail(t.id+': owner reviews their own work');
  if(!t.branch||t.branch==='main'||t.branch==='feature/fullstack-rewrite')fail(t.id+': invalid branch');
  if(!Array.isArray(t.acceptance)||!t.acceptance.length)fail(t.id+': no acceptance criteria');
  const allowed=agentById.get(t.owner)?.write||[];
  for(const p of t.write||[]){
    if(!allowed.includes(p))fail(t.id+': write path outside agent ownership: '+p);
    if(p.includes('..')||p.startsWith('/'))fail(t.id+': unsafe path '+p);
  }
  for(const dependency of t.dependencies||[])if(!tasks.has(dependency))fail(t.id+': missing dependency '+dependency);
}
const visited=new Set(),active=new Set();
function visit(id){
  if(active.has(id)){fail('Dependency cycle at '+id);return;}
  if(visited.has(id))return;
  active.add(id);for(const dep of tasks.get(id).dependencies||[])visit(dep);
  active.delete(id);visited.add(id);
}
for(const id of tasks.keys())visit(id);
if(process.exitCode!==1){
  console.log('PASS: SnowFight Ruflo coordination policy; '+policy.agents.length+' agents and '+ledger.tasks.length+' tasks.');
  for(const t of ledger.tasks)console.log(t.id,'->',t.owner,'| depends:',t.dependencies.join(',')||'none');
}
