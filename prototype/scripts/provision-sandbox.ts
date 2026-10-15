// Local-only provisioning. Provider subjects come from a protected input file,
// never a browser persona, email domain, or public registration request.
import { readFileSync, writeFileSync, mkdirSync, chmodSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { EMPLOYEES } from "../src/lib/skills";
import { seedTenant } from "../src/lib/suite-domain";

const index=process.argv.indexOf("--memberships");
const members=index<0?[]:z.array(z.object({userId:z.string().regex(/^user_[a-zA-Z0-9_]+$/),employeeId:z.enum(["E0001","E0002","E9001"]),role:z.enum(["employee","manager","leader"])}).strict()).parse(JSON.parse(readFileSync(process.argv[index+1],"utf8")));
if(new Set(members.map(m=>m.userId)).size!==members.length)throw new Error("Clerk identities must be distinct");
const expected={E0001:"employee",E0002:"manager",E9001:"leader"};
if(members.some(m=>expected[m.employeeId]!==m.role))throw new Error("Membership does not match the sandbox actor");
const quote=(s:string)=>`'${s.replaceAll("'","''")}'`;
mkdirSync(".wrangler",{recursive:true});
const payload=JSON.stringify(seedTenant(EMPLOYEES));
const chunks=Array.from({length:Math.ceil(payload.length/4096)},(_,i)=>payload.slice(i*4096,(i+1)*4096));
const sql=["BEGIN TRANSACTION;", "INSERT INTO suite_v2_state(tenant_id,revision,payload) VALUES('iris-sandbox',-1,'') ON CONFLICT(tenant_id) DO NOTHING;", "UPDATE suite_v2_state SET payload='' WHERE tenant_id='iris-sandbox' AND revision=-1;", ...chunks.map(chunk=>`UPDATE suite_v2_state SET payload=payload||${quote(chunk)} WHERE tenant_id='iris-sandbox' AND revision=-1;`), "UPDATE suite_v2_state SET revision=0 WHERE tenant_id='iris-sandbox' AND revision=-1;", ...members.map(m=>`INSERT INTO suite_v2_memberships(clerk_user_id,tenant_id,employee_id,role) VALUES(${quote(m.userId)},'iris-sandbox',${quote(m.employeeId)},${quote(m.role)}) ON CONFLICT(clerk_user_id,tenant_id) DO NOTHING;`), "COMMIT;"];
const file=".wrangler/suite-provision.sql";const temp=file+".tmp";writeFileSync(temp,sql.join("\n"),{mode:0o600});chmodSync(temp,0o600);renameSync(temp,file);
for(const args of [["d1","migrations","apply","iris-learning-suite-db","--local"],["d1","execute","iris-learning-suite-db","--local","--file",file]])execFileSync("pnpm",["exec","wrangler",...args,"--config","wrangler.sandbox.jsonc","--persist-to",".wrangler/suite-v2"],{stdio:"inherit"});
console.log(`Local synthetic tenant provisioned; ${members.length} Clerk identity memberships requested. Existing records were preserved.`);
