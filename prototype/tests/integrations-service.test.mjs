import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from './helpers/sqlite.mjs';
import {seedTenant} from '../src/lib/suite-domain.ts';
import {loadTenant} from '../src/lib/suite-repository.ts';
import {employeeById} from '../src/lib/skills.ts';
import {integrationService} from '../src/server/integration-service.ts';
const secret='synthetic-local-fixture-credential';
const envFor=db=>({DB:db,SANDBOX_MODE:'1',INTEGRATION_SECRET:secret,INTEGRATION_TENANT_ID:'fixture',HR_URL:'http://127.0.0.1:8083',HR_TOKEN:'synthetic-hr-fixture'});
const req=body=>new Request('http://localhost:8787/api/integrations/sync',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'content-type':'application/json','idempotency-key':crypto.randomUUID()},body:JSON.stringify(body)});
test('integration service is disabled outside the local sandbox and rejects unauthenticated calls',async()=>{
 await assert.rejects(integrationService(req({type:'hr.sync'}),{}),e=>e.status===404);
 await assert.rejects(integrationService(new Request('http://localhost/api/integrations/sync'),envFor(database())),e=>e.status===401);
});
test('invalid HR role leaves tenant state and cursor unchanged',async()=>{
 const db=database();const state=seedTenant(['E0001','E0002','E9001'].map(id=>structuredClone(employeeById(id))));
 await db.prepare('INSERT INTO suite_v2_state VALUES(?,?,?)').bind('fixture',0,JSON.stringify(state)).run();
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({changes:[{id:'E0003',active:true,employee:{...structuredClone(employeeById('E0001')),id:'E0003',roleId:'UNKNOWN'}}],nextCursor:'1'});
 try{await assert.rejects(integrationService(req({type:'hr.sync'}),envFor(db)),e=>e.status===422);}finally{globalThis.fetch=previous;}
 const after=await loadTenant(db,'fixture');assert.equal(after.revision,0);assert.equal(after.state.hrCursor,'0');assert.equal(after.state.records.E0003,undefined);
});
test('HR manager transfer changes approval visibility and a leaver loses record access',async()=>{
 const db=database();const state=seedTenant(['E0001','E0002','E9001'].map(id=>structuredClone(employeeById(id))));
 await db.prepare('INSERT INTO suite_v2_state VALUES(?,?,?)').bind('fixture',0,JSON.stringify(state)).run();
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({changes:[{id:'E0001',active:true,employee:{...structuredClone(employeeById('E0001')),managerId:'E9001'}}],nextCursor:'1'});
 try{await integrationService(req({type:'hr.sync'}),envFor(db));}finally{globalThis.fetch=previous;}
 let after=await loadTenant(db,'fixture');assert.equal(after.state.records.E0001.employee.managerId,'E9001');assert.equal(after.state.hrCursor,'1');
 globalThis.fetch=async()=>Response.json({changes:[{id:'E0001',active:false}],nextCursor:'2'});
 try{await integrationService(req({type:'hr.sync'}),envFor(db));}finally{globalThis.fetch=previous;}
 after=await loadTenant(db,'fixture');assert.equal(after.state.records.E0001,undefined);assert.equal(after.state.hrCursor,'2');
});
