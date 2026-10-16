import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/sqlite.mjs';
import { seedTenant, applyCommand, scopedView, commandSchema, storeGeneratedPlan } from '../src/lib/suite-domain.ts';
import { commitTenant, loadTenant, priorResult, fingerprint, reserveQuota } from '../src/lib/suite-repository.ts';
import { employeeById } from '../src/lib/skills.ts';
import { roleById } from '../src/data/taxonomy.ts';
import { rulesPlan } from '../src/lib/plan-rules.ts';


const employee={userId:'user_employee',tenantId:'fixture',employeeId:'E0001',role:'employee'};
const manager={userId:'user_manager',tenantId:'fixture',employeeId:'E0002',role:'manager'};
const leader={userId:'user_leader',tenantId:'fixture',employeeId:'E9001',role:'leader'};
const base=()=>seedTenant(['E0001','E0002','E9001'].map(id=>structuredClone(employeeById(id))));
const ratings=()=>Object.fromEntries([...new Set([employeeById('E0001').roleId,employeeById('E0001').nextRoleId].flatMap(id=>roleById(id).requirements.map(s=>s.skillId)))].map(id=>[id,2]));
const submit={expectedRevision:0,command:{type:'assessment.submit',self:ratings(),answers:[1,2,1]}};
test('assessment scores are computed on the server and arbitrary final scores are rejected',()=>{
 const state=applyCommand(base(),employee,submit);
 assert.equal(state.records.E0001.assessment.quiz['T-INV'],3);
 assert.equal(state.records.E0001.assessment.status,'submitted');
 assert.equal(commandSchema.safeParse({...submit,command:{...submit.command,final:{'T-INV':4}}}).success,false);
});
test('employee cannot approve own work; another manager cannot approve a non-report',()=>{
 const s=applyCommand(base(),employee,submit); const approvalId=s.approvals[0].id;
 const input={expectedRevision:1,command:{type:'approval.decide',approvalId,approve:true}};
 assert.throws(()=>applyCommand(s,employee,input),e=>e.status===403);
 const other={...manager,employeeId:'E9001'};
 assert.throws(()=>applyCommand(s,other,input),e=>e.status===404);
});
test('a manager can learn on their own record without gaining self-approval',()=>{
 const s=base();const emp=s.records.E0002.employee;
 const ids=new Set([emp.roleId,emp.nextRoleId].filter(Boolean).flatMap(id=>roleById(id).requirements.map(s=>s.skillId)));
 const next=applyCommand(s,manager,{expectedRevision:0,command:{type:'assessment.submit',self:Object.fromEntries([...ids].map(id=>[id,2])),answers:[1,2,1]}});
 assert.equal(next.records.E0002.assessment.status,'submitted');
 const ap=next.approvals[0];assert.throws(()=>applyCommand(next,manager,{expectedRevision:1,command:{type:'approval.decide',approvalId:ap.id,approve:true}}),e=>e.status===404);
});
test('manager cannot see private coach history and leader cannot see individual records',()=>{
 const s=base();s.records.E0001.chats.general=[{role:'user',content:'private reflection'}];
 assert.deepEqual(scopedView(s,manager,0).team[0].chats,{});
 const v=scopedView(s,leader,0);assert.equal(v.self,undefined);assert.equal(v.team,undefined);assert.equal(v.metrics,undefined);
});
test('assessment approval, plan approval and project signoff require valid transitions',()=>{
 let s=applyCommand(base(),employee,submit);
 s=applyCommand(s,manager,{expectedRevision:1,command:{type:'approval.decide',approvalId:s.approvals[0].id,approve:true}});
 s=storeGeneratedPlan(s,employee,rulesPlan(s.records.E0001.employee,s.records.E0001.overrides));
 s=applyCommand(s,employee,{expectedRevision:2,command:{type:'plan.submit'}});
 const ap=s.approvals.find(a=>a.kind==='plan');
 s=applyCommand(s,manager,{expectedRevision:3,command:{type:'approval.decide',approvalId:ap.id,approve:true}});
 assert.equal(s.records.E0001.plan.status,'approved');
 assert.throws(()=>applyCommand(s,employee,{expectedRevision:4,command:{type:'project.submit',itemId:s.records.E0001.plan.steps.find(st=>st.itemId.startsWith('LA-'))?.itemId??'LA-101',evidence:'A synthetic project evidence document'}}),e=>[404,409].includes(e.status));
});
test('D1 compare-and-swap atomically prevents stale decisions and duplicate audits',async()=>{
 const db=database();const p=employee;const s=base();await db.prepare('INSERT INTO suite_v2_state VALUES(?,?,?)').bind(p.tenantId,0,JSON.stringify(s)).run();
 const next=applyCommand(s,p,submit);const hash=await fingerprint(submit);
 const first=await commitTenant(db,p,0,next,'request-0001',hash,'assessment.submit');assert.equal(first.revision,1);
 assert.equal((await priorResult(db,p,'request-0001',hash)).revision,1);
 await assert.rejects(commitTenant(db,p,0,next,'request-0002',hash,'assessment.submit'),e=>e.status===409);
 await assert.rejects(priorResult(db,p,'request-0001','different'),e=>e.status===409);
 assert.equal(db.sql.prepare('SELECT count(*) n FROM suite_v2_audit').get().n,1);
 assert.equal((await loadTenant(db,p.tenantId)).revision,1);
});
test('idempotent replies obey current reporting lines rather than returning cached personnel',async()=>{
 const db=database();const s=base();await db.prepare('INSERT INTO suite_v2_state VALUES(?,?,?)').bind('fixture',0,JSON.stringify(s)).run();
 await commitTenant(db,manager,0,s,'manager-0001','same','fixture');
 const changed=structuredClone(s);changed.records.E0001.employee.managerId='E9001';await db.prepare('UPDATE suite_v2_state SET payload=?,revision=2 WHERE tenant_id=?').bind(JSON.stringify(changed),'fixture').run();
 const reply=await priorResult(db,manager,'manager-0001','same');assert.equal(reply.team.length,0);
});
test('daily quotas are persistent and reject a request beyond the cap',async()=>{
 const db=database();await reserveQuota(db,'fixture:user',2);await reserveQuota(db,'fixture:user',2);
 await assert.rejects(reserveQuota(db,'fixture:user',2),e=>e.status===429);
});

test('organisation metrics enforce the ten-person privacy threshold',()=>{
 const cohort=(n)=>seedTenant(Array.from({length:n},(_,i)=>({...structuredClone(employeeById('E0001')),id:i===0?'E9001':`E${String(i).padStart(4,'0')}`})));
 assert.equal(scopedView(cohort(9),leader,0).metrics,undefined);
 const metrics=scopedView(cohort(10),leader,0).metrics;
 assert.equal(metrics.employees,10);assert.equal(metrics.groups.length,1);assert.equal(metrics.groups[0].count,10);
});
test('POST /api/coach persists redacted PII in D1 state rather than raw national ID',async()=>{
 const {createWorker}=await import('../worker/index.ts');
 const db=database();const s=base();await db.prepare('INSERT INTO suite_v2_state VALUES(?,?,?)').bind(employee.tenantId,0,JSON.stringify(s)).run();
 const w=createWorker({authenticate:async()=>employee});
 const env={DB:db,APP_ORIGINS:'http://localhost:3000',ASSETS:{fetch:async()=>new Response('ok')}};
 const res=await w.fetch(new Request('http://localhost:3000/api/coach',{method:'POST',headers:{origin:'http://localhost:3000','content-type':'application/json'},body:JSON.stringify({message:'My ID card number is 1-2345-67890-12-3, can you check my plan?'})}),env);
 assert.equal(res.status,200);await res.text();
 const loaded=await loadTenant(db,employee.tenantId);
 const userTurn=loaded.state.records.E0001.chats.general[0].content;
 assert.doesNotMatch(userTurn,/67890/);
 assert.match(userTurn,/\[THAI_NATIONAL_ID\]/);
});
