import { readJson } from "../src/server/request";
import { z } from "zod";
import { setAIBinding } from "../src/lib/ai";
import { prepareCoach } from "../src/lib/coach/coach";
import { aiPlan } from "../src/lib/path";
import type { Principal } from "../src/lib/suite-contracts";
import { applyCommand, commandSchema, HttpError, scopedView, storeGeneratedPlan } from "../src/lib/suite-domain";
import { commitTenant, fingerprint, loadTenant, priorResult, reserveQuota } from "../src/lib/suite-repository";
import { authenticate, requireOrigin, type AuthEnvironment } from "../src/server/auth";
import { integrationService, type IntegrationEnv } from "../src/server/integration-service";

export interface Env extends AuthEnvironment,IntegrationEnv {
  ASSETS:{fetch(req:Request|string):Promise<Response>};
  AI?:{run(model:string,inputs:Record<string,unknown>):Promise<unknown>}; AI_FREE_ONLY_VERIFIED?:string;
}
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
function requestKey(req:Request){const key=req.headers.get("idempotency-key");if(!key || !/^[a-zA-Z0-9_-]{8,128}$/.test(key))throw new HttpError(422,"A unique Idempotency-Key is required");return key;}
const revisionSchema=z.object({expectedRevision:z.number().int().nonnegative()}).strict();
const chatSchema=z.object({message:z.string().trim().min(1).max(1000),lessonId:z.string().max(64).optional()}).strict();
const retired=new Set(["/api/sso/token","/api/sso/session","/api/state/reset","/api/unlock","/api/integrations/hris-sync","/api/integrations/lms-xapi","/api/integrations/lti-launch","/api/integrations/line-push"]);
export function createWorker(deps:{authenticate?:typeof authenticate}={}){
 return {async fetch(req:Request,env:Env):Promise<Response>{
  const path=new URL(req.url).pathname;
  if(retired.has(path)||(path==="/api/state"&&req.method!=="GET"))return json({error:"Legacy demo authority retired"},410);
  if(!path.startsWith("/api/"))return env.ASSETS.fetch(req);
  if(path==="/api/status"&&req.method==="GET")return json({service:"Learning Suite sandbox",authentication:"Clerk",data:"synthetic"});
  try{
   if(path==="/api/integrations/sync")return json(await integrationService(req,env));
   const p:Principal=await(deps.authenticate??authenticate)(req,env);if(!env.DB)throw new HttpError(503,"Sandbox database is not configured");
   const db=env.DB;const {state,revision}=await loadTenant(db,p.tenantId);const view=scopedView(state,p,revision);
   if(req.method==="GET"){
    if(path==="/api/session")return json({principal:p});if(path==="/api/state")return json(view);if(path==="/api/integrations")return json({integrations:view.integrations});
   }
   if(req.method!=="POST")throw new HttpError(404,"Endpoint not found");requireOrigin(req,env);
   if(path==="/api/commands"){
    const parsed=commandSchema.safeParse(await readJson(req));if(!parsed.success)throw new HttpError(422,"Invalid workflow command");
    const input=parsed.data as Parameters<typeof applyCommand>[2];const key=requestKey(req);const hash=await fingerprint(input);const previous=await priorResult(db,p,key,hash);if(previous)return json(previous);
    if(input.expectedRevision!==revision)throw new HttpError(409,"Data changed. Refresh before retrying.");
    return json(await commitTenant(db,p,revision,applyCommand(state,p,input),key,hash,input.command.type));
   }
   // No paid-provider fallback. Enable live inference only after account-level free-only limits are verified.
   setAIBinding(env.AI_FREE_ONLY_VERIFIED==="1"?env.AI:undefined);process.env.DEMO_MODE=env.AI_FREE_ONLY_VERIFIED==="1"?"0":"1";process.env.AI_PROVIDER="workers-ai";
   if(path==="/api/path"){
    if(p.role==="leader")throw new HttpError(403,"Learning permission required");const parsed=revisionSchema.safeParse(await readJson(req));if(!parsed.success)throw new HttpError(422,"Expected revision required");
    const key=requestKey(req);const hash=await fingerprint({type:"plan.generate",...parsed.data});const previous=await priorResult(db,p,key,hash);if(previous)return json(previous);
    if(parsed.data.expectedRevision!==revision)throw new HttpError(409,"Data changed. Refresh before generating a plan.");const r=state.records[p.employeeId];
    if(r.assessment.status!=="approved"||(r.plan&&!["draft","changes_requested"].includes(r.plan.status)))throw new HttpError(409,"An approved assessment and editable plan are required");
    await reserveQuota(db,`${p.tenantId}:user:${p.userId}`,20);await reserveQuota(db,`${p.tenantId}:ai`,100);
    const generated=await aiPlan(r.employee,r.overrides);
    for(let attempt=0;attempt<5;attempt++){
     const cur=attempt===0?{state,revision}:await loadTenant(db,p.tenantId);
     try{return json(await commitTenant(db,p,cur.revision,storeGeneratedPlan(cur.state,p,generated),key,hash,"plan.generate"));}
     catch(err){if(!(err instanceof HttpError)||err.status!==409||attempt===4)throw err;}
    }
   }
   if(path==="/api/coach"){
    if(p.role==="leader")throw new HttpError(403,"Learning permission required");const parsed=chatSchema.safeParse(await readJson(req));if(!parsed.success)throw new HttpError(422,"A message of 1-1000 characters is required");
    const r=state.records[p.employeeId];const key=parsed.data.lessonId??"general";if(parsed.data.lessonId&&!r.plan?.steps.some(s=>s.itemId===parsed.data.lessonId))throw new HttpError(404,"Lesson is not in your plan");
    await reserveQuota(db,`${p.tenantId}:user:${p.userId}`,20);await reserveQuota(db,`${p.tenantId}:ai`,100);
    const messages=[...(r.chats[key]??[]).slice(-8).map(m=>({role:m.role,content:m.content})),{role:"user" as const,content:parsed.data.message}];
    const prepared=await prepareCoach({employeeId:p.employeeId,employee:r.employee,messages,plan:r.plan,overrides:r.overrides,lessonId:parsed.data.lessonId});
    const enc=new TextEncoder();const event=(name:string,data:unknown)=>enc.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    return new Response(new ReadableStream<Uint8Array>({async start(controller){let answer="";
     try{for await(const text of prepared.stream()){answer+=text;controller.enqueue(event("text",{text}));}
      const id=crypto.randomUUID();const fp=await fingerprint(id);
      for(let attempt=0;attempt<5;attempt++){
       const latest=await loadTenant(db,p.tenantId);const record=latest.state.records[p.employeeId];if(!record)throw new HttpError(403,"Employee access was removed");
       record.chats[key]=[...(record.chats[key]??[]).slice(-38),{role:"user",content:prepared.redactedMessage},{role:"assistant",content:answer,meta:prepared.meta as unknown as Record<string,unknown>}];
       try{await commitTenant(db,p,latest.revision,latest.state,id,fp,"coach.message");break;}
       catch(err){if(!(err instanceof HttpError)||err.status!==409||attempt===4)throw err;}
      }
      controller.enqueue(event("final",{meta:prepared.meta}));
     }catch(error){controller.enqueue(event("error",{error:error instanceof HttpError?error.message:"The response could not be completed or saved. Please refresh."}));}finally{controller.close();}
    }}),{headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
   }
   throw new HttpError(404,"Endpoint not found");
  }catch(error){
   if(env.SANDBOX_MODE==="1" && !(error instanceof HttpError)){
    const known=["Sandbox upstream unavailable","Sandbox upstream returned an invalid response","Sandbox upstream response failed validation"];
    console.error("Local sandbox failure",error instanceof Error?(known.includes(error.message)?error.message:error.name):"UnknownError");
   }
   return json({error:error instanceof HttpError?error.message:"Sandbox operation failed"},error instanceof HttpError?error.status:500);}
 }};
}
export default createWorker();
