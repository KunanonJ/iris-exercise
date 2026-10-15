import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {z} from "zod";
// Read only the named local service credential; never export or print its value.
const line=readFileSync(".dev.vars","utf8").match(/^INTEGRATION_SECRET=(.*)$/m);
if(!line)throw new Error("Local integration credential is missing");
const key=z.string().min(32).parse(JSON.parse(line[1]));
const url="http://localhost:8797/api/integrations/sync";
async function command(action:unknown,id=randomUUID()){
 const r=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${key}`,"content-type":"application/json","idempotency-key":id},body:JSON.stringify(action)});
 const data=await r.json() as {ok?:boolean;revision?:number;receipt?:{completed?:boolean;cursor?:string};replayed?:boolean};
 assert.equal(r.status,200,"Local Worker integration operation failed");assert.equal(data.ok,true);return data;
}
async function main(){
const evidence=[];
for(const source of ["moodle-a","moodle-b"]){
 await command({type:"moodle.catalogue",source});
 const itemId=source==="moodle-a"?"LA-105":"LB-205";
 await command({type:"moodle.enrol",source,employeeId:"E0001",itemId});
 const id=randomUUID();const completion=await command({type:"moodle.reconcile",source,employeeId:"E0001",itemId},id);
 assert.equal(completion.receipt?.completed,true,"Complete the activity inside Moodle before reconciliation");
 const replay=await command({type:"moodle.reconcile",source,employeeId:"E0001",itemId},id);assert.equal(replay.replayed,true);
 evidence.push({source,upstreamCompleted:true,persistedRevision:completion.revision,idempotentReplay:true});
}
for(let i=0;i<6;i++)await command({type:"hr.sync"});
const anonymous=await fetch("http://localhost:8797/api/state");assert.equal(anonymous.status,401);
mkdirSync("sandbox/receipts",{recursive:true});const file=`sandbox/receipts/suite-${new Date().toISOString().replaceAll(":","-")}.json`;
writeFileSync(file,JSON.stringify({kind:"local_worker_d1_moodle_proof",status:"PASS",fixture:"Pre-approved synthetic integration fixture; not Clerk login evidence",evidence,anonymousRead:401,hosted:"unconfigured"},null,2)+"\n");console.log(`PASS: Worker/D1 reconciliation and replay for both real Moodle instances. Redacted receipt: ${file}`);

}
main().catch((error)=>{console.error("FAIL: local Worker integration proof:", error instanceof Error ? error.message : "unknown error");process.exitCode=1;});
