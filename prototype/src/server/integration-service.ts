import { z } from "zod";
import { readJson } from "./request";
import type { D1Database } from "../lib/db";
import { itemById } from "../data/catalog";
import { roleById } from "../data/taxonomy";
import { MoodleConnector, fetchHrDelta } from "../lib/sandbox-integrations";
import { blankRecord, HttpError } from "../lib/suite-domain";
import { commitTenant, fingerprint, loadTenant, priorResult } from "../lib/suite-repository";
import type { Principal } from "../lib/suite-contracts";

export interface IntegrationEnv {
 DB?:D1Database; SANDBOX_MODE?:string; INTEGRATION_SECRET?:string; INTEGRATION_TENANT_ID?:string;
 HR_URL?:string; HR_TOKEN?:string; MOODLE_A_URL?:string; MOODLE_A_TOKEN?:string; MOODLE_A_CATEGORY_ID?:string; MOODLE_B_URL?:string; MOODLE_B_TOKEN?:string; MOODLE_B_CATEGORY_ID?:string;
}
const actionSchema=z.discriminatedUnion("type",[
 z.object({type:z.literal("hr.sync")}).strict(),
 z.object({type:z.literal("moodle.catalogue"),source:z.enum(["moodle-a","moodle-b"])}).strict(),
 z.object({type:z.enum(["moodle.enrol","moodle.reconcile"]),source:z.enum(["moodle-a","moodle-b"]),employeeId:z.string().regex(/^E\d{4,8}$/),itemId:z.string().max(64)}).strict(),
]);
async function equalSecret(a:string,b:string){const digest=async(v:string)=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));const [x,y]=await Promise.all([digest(a),digest(b)]);let n=0;for(let i=0;i<x.length;i++)n|=x[i]^y[i];return n===0;}
export async function integrationService(req:Request,env:IntegrationEnv) {
 if(env.SANDBOX_MODE!=="1")throw new HttpError(404,"Endpoint not found");
 const authHeader=req.headers.get("authorization")??"";
 const supplied=authHeader.startsWith("Bearer ")?authHeader.slice(7):"";
 if(!env.INTEGRATION_SECRET || !supplied || supplied.length>512 || !await equalSecret(supplied,env.INTEGRATION_SECRET))throw new HttpError(401,"Integration service credential required");
 if(req.method!=="POST" || !req.headers.get("content-type")?.startsWith("application/json"))throw new HttpError(415,"JSON POST required");
 if(!env.DB || !env.INTEGRATION_TENANT_ID)throw new HttpError(503,"Local integration tenant is not configured");
 const raw=await readJson(req,4096);
 const parsed=actionSchema.safeParse(raw);if(!parsed.success)throw new HttpError(422,"Invalid integration command");
 const action=parsed.data;const db=env.DB;const p:Principal={userId:"service:local-integrations",tenantId:env.INTEGRATION_TENANT_ID,employeeId:"E9001",role:"leader"};
 const key=req.headers.get("idempotency-key");if(!key || !/^[a-zA-Z0-9_-]{8,128}$/.test(key))throw new HttpError(422,"A unique Idempotency-Key is required");
 const hash=await fingerprint(action);const previous=await priorResult(db,p,key,hash);if(previous)return {ok:true,revision:previous.revision,replayed:true};
 const {state,revision}=await loadTenant(db,p.tenantId);const next=structuredClone(state);let receipt:unknown;
 if(action.type==="hr.sync"){
  if(!env.HR_URL || !env.HR_TOKEN)throw new HttpError(503,"Synthetic HR service is not configured");
  const delta=await fetchHrDelta(env.HR_URL,env.HR_TOKEN,state.hrCursor);
  if(delta.nextCursor===state.hrCursor)return {ok:true,changed:false,revision};
  for(const change of delta.changes){
   if(change.active&&change.employee){
    if(!roleById(change.employee.roleId) || (change.employee.nextRoleId && !roleById(change.employee.nextRoleId)))throw new HttpError(422,"HR role is not in the approved framework");
    const existing=next.records[change.id];next.records[change.id]=existing?{...existing,employee:change.employee}:blankRecord(change.employee);
   }else{
    if(change.id===p.employeeId)throw new HttpError(409,"The local integration administrator cannot be removed by a fixture delta");
    delete next.records[change.id];for(const approval of next.approvals.filter(a=>a.employeeId===change.id&&a.status==="pending")){approval.status="changes_requested";approval.note="Synthetic HR marked this employee inactive";}
   }
  }
  next.hrCursor=delta.nextCursor;receipt={changes:delta.changes.map(c=>({employeeId:c.id,active:c.active})),cursor:delta.nextCursor};
  const status=next.integrations.find(s=>s.id==="hr")!;Object.assign(status,{status:"verified",detail:"Synthetic local HR delta applied transactionally; no vendor HRIS claim.",lastSuccess:new Date().toISOString()});
 }else{
  const a=action.source==="moodle-a";const token=a?env.MOODLE_A_TOKEN:env.MOODLE_B_TOKEN;const baseUrl=a?env.MOODLE_A_URL:env.MOODLE_B_URL;
  if(!token || !baseUrl)throw new HttpError(503,"Local Moodle connector is not configured");
  const connector=new MoodleConnector({source:action.source,baseUrl,token});
  const status=next.integrations.find(s=>s.id===action.source)!;
  if(action.type==="moodle.catalogue"){
   const categoryId=Number(a?env.MOODLE_A_CATEGORY_ID:env.MOODLE_B_CATEGORY_ID);if(!Number.isSafeInteger(categoryId)||categoryId<=0)throw new HttpError(503,"Moodle category is not configured");
   const courses=await connector.catalogue(categoryId);receipt={source:action.source,courses};Object.assign(status,{status:"configured",detail:"Real local Moodle catalogue retrieved. Enrolment/completion proof is separate."});
  }else{
   const record=next.records[action.employeeId];const mapping=Object.values(next.lms).find(m=>m.source===action.source&&m.employeeId===action.employeeId&&m.itemId===action.itemId);
   const step=record?.plan?.steps.find(s=>s.itemId===action.itemId);const item=itemById(action.itemId);
   if(!mapping || !step || !item || item.format==="project")throw new HttpError(404,"Approved local learner/course mapping not found");
   if(record.plan?.status!=="approved")throw new HttpError(409,"Approved learning plan required");
   if(action.type==="moodle.enrol")receipt=await connector.enrol(mapping.userId,mapping.courseId,mapping.roleId);
   else{
    const result=await connector.completion(mapping.userId,mapping.courseId);receipt=result;
    if(result.completed){step.status="done";Object.assign(status,{status:"verified",detail:"Real local Moodle enrolment and upstream completion verified; hosted connection remains unconfigured."});}
   }
  }
  status.lastSuccess=new Date().toISOString();
 }
 const result=await commitTenant(db,p,revision,next,key,hash,action.type);
 return {ok:true,revision:result.revision,receipt};
}
