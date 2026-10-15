import type { D1Database } from "./db";
import type { Principal, SuiteView } from "./suite-contracts";
import { HttpError, scopedView, type TenantState } from "./suite-domain";

export async function loadTenant(db:D1Database,tenantId:string) {
  const row = await db.prepare("SELECT revision,payload FROM suite_v2_state WHERE tenant_id = ?").bind(tenantId).first<{revision:number;payload:string}>();
  if (!row || row.revision < 0) throw new HttpError(503,"Sandbox has not been provisioned");
  return { revision:row.revision, state:JSON.parse(row.payload) as TenantState };
}
export async function lookupPrincipal(db:D1Database,userId:string):Promise<Principal> {
  const rows = await db.prepare("SELECT tenant_id,employee_id,role FROM suite_v2_memberships WHERE clerk_user_id = ? AND active = 1").bind(userId).all<{tenant_id:string;employee_id:string;role:Principal["role"]}>();
  if (rows.results.length !== 1) throw new HttpError(403,"An administrator must assign one sandbox membership");
  const r=rows.results[0]; return {userId,tenantId:r.tenant_id,employeeId:r.employee_id,role:r.role};
}
export async function fingerprint(value:unknown) {
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
export async function priorResult(db:D1Database,p:Principal,key:string,hash:string):Promise<SuiteView|null> {
  const r=await db.prepare("SELECT fingerprint,response FROM suite_v2_idempotency WHERE tenant_id=? AND user_id=? AND key=?").bind(p.tenantId,p.userId,key).first<{fingerprint:string;response:string}>();
  if (!r) return null;
  if(r.fingerprint!==hash) throw new HttpError(409,"Idempotency key already belongs to another request");
  // Replays preserve the operation, not stale permissions or personnel snapshots.
  const current=await loadTenant(db,p.tenantId);
  return scopedView(current.state,p,current.revision);
}
export async function commitTenant(db:D1Database,p:Principal,expectedRevision:number,next:TenantState,key:string,hash:string,action:string):Promise<SuiteView> {
  const result=scopedView(next,p,expectedRevision+1); const auditId=crypto.randomUUID();
  try {
    await db.batch([
      db.prepare("UPDATE suite_v2_state SET revision=revision+1,payload=? WHERE tenant_id=? AND revision=?").bind(JSON.stringify(next),p.tenantId,expectedRevision),
      db.prepare("INSERT INTO suite_v2_audit(id,tenant_id,user_id,employee_id,action,revision,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1").bind(auditId,p.tenantId,p.userId,p.employeeId,action,expectedRevision+1,new Date().toISOString()),
      db.prepare("INSERT INTO suite_v2_idempotency(tenant_id,user_id,key,fingerprint,response) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM suite_v2_audit WHERE id=?)").bind(p.tenantId,p.userId,key,hash,JSON.stringify(result),auditId),
    ]);
  } catch (error) {
    const previous=await priorResult(db,p,key,hash); if(previous) return previous;
    throw error;
  }
  const previous=await priorResult(db,p,key,hash); if(previous) return previous;
  throw new HttpError(409,"Data changed. Refresh and review before retrying.");
}
export async function reserveQuota(db:D1Database,key:string,limit:number,cost=1) {
  if(cost>limit) throw new HttpError(429,"Daily free sandbox quota exhausted");
  const day=new Date().toISOString().slice(0,10);
  const row=await db.prepare("INSERT INTO suite_v2_quotas(key,day,used) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET day=excluded.day,used=CASE WHEN suite_v2_quotas.day=excluded.day THEN suite_v2_quotas.used+excluded.used ELSE excluded.used END WHERE suite_v2_quotas.day<>excluded.day OR suite_v2_quotas.used+excluded.used<=? RETURNING used").bind(key,day,cost,limit).first<{used:number}>();
  if(!row) throw new HttpError(429,"Daily free sandbox quota exhausted");
}
