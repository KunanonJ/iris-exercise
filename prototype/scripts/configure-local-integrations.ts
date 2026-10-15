// Transfer only this lab's named credentials into the existing ignored local store.
import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync,renameSync,lstatSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {resolve,join} from "node:path";
import {EMPLOYEES} from "../src/lib/skills";
import {rulesPlan} from "../src/lib/plan-rules";
import {itemById} from "../src/data/catalog";
import {seedTenant} from "../src/lib/suite-domain";

const lab=resolve(process.argv[process.argv.indexOf("--lab")+1]??"sandbox/.local");
if(!process.argv.includes("--lab"))throw new Error("Provide --lab with the sandbox/.local directory; credentials are never command arguments");
execFileSync("git",["check-ignore","--quiet",".dev.vars"]);
const target=".dev.vars";if(existsSync(target)&&lstatSync(target).isSymbolicLink())throw new Error("Refusing a symlinked credential store");
let content=existsSync(target)?readFileSync(target,"utf8"):"";
const entries:Record<string,string>={INTEGRATION_TENANT_ID:"iris-integration-proof"};
const state=seedTenant(EMPLOYEES.filter(e=>["E0001","E0002","E9001"].includes(e.id)));
const employee=state.records.E0001;employee.assessment={status:"approved",self:{},quiz:{},final:{}};
employee.plan={...rulesPlan(employee.employee),status:"approved"};
for(const source of ["moodle-a","moodle-b"] as const){
 const p=JSON.parse(readFileSync(join(lab,"private",source+".json"),"utf8"));
 if(!p.serviceToken || !p.baseUrl || !p.courseId || !p.userId || !p.roleId)throw new Error("Local Moodle metadata is incomplete");
 const prefix=source==="moodle-a"?"MOODLE_A":"MOODLE_B";
 entries[`${prefix}_URL`]=p.baseUrl;entries[`${prefix}_TOKEN`]=p.serviceToken;entries[`${prefix}_CATEGORY_ID`]=String(p.categoryId);
 const step=employee.plan.steps.find(s=>itemById(s.itemId)?.source===(source==="moodle-a"?"LMS-A":"LMS-B"));if(!step)throw new Error("Fixture plan has no mapped step");
 state.lms[`${source}:E0001`]={employeeId:"E0001",source,userId:p.userId,courseId:p.courseId,roleId:p.roleId,itemId:step.itemId};
}
const hr=JSON.parse(readFileSync(join(lab,"private/hr.json"),"utf8"));entries.HR_URL="http://127.0.0.1:8083";entries.HR_TOKEN=hr.token;
if(!/^INTEGRATION_SECRET=/m.test(content))entries.INTEGRATION_SECRET=randomBytes(32).toString("base64url");
for(const [name,value] of Object.entries(entries)){
 const existing=content.match(new RegExp(`^${name}=(.*)$`,"m"));
 if(existing){let prior=existing[1];try{prior=JSON.parse(prior);}catch{/* dotenv unquoted value */}if(prior!==value)throw new Error(`Existing ${name} differs; explicit replacement is required`);}
 else content+=`\n${name}=${JSON.stringify(value)}`;
}
const temporary=target+".tmp";writeFileSync(temporary,content.trimEnd()+"\n",{mode:0o600});chmodSync(temporary,0o600);renameSync(temporary,target);
const quote=(s:string)=>`'${s.replaceAll("'","''")}'`;mkdirSync(".wrangler",{recursive:true});
const sql=".wrangler/integration-proof.sql";writeFileSync(sql,`INSERT INTO suite_v2_state(tenant_id,revision,payload) VALUES('iris-integration-proof',0,${quote(JSON.stringify(state))}) ON CONFLICT(tenant_id) DO NOTHING;`,{mode:0o600});
execFileSync("pnpm",["exec","wrangler","d1","execute","iris-learning-suite-db","--local","--file",sql,"--config","wrangler.sandbox.jsonc","--persist-to",".wrangler/suite-v2"],{stdio:["ignore","pipe","inherit"]});
console.log("Local integration credentials configured (ignored, mode 600); isolated synthetic proof tenant provisioned. No Clerk or cloud credentials changed.");
