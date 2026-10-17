import type { PrismaClient } from "@/generated/prisma/client";
import type { Principal, SuiteView } from "./suite-contracts";
import { HttpError, scopedView, type TenantState } from "./suite-domain";
import { fingerprint } from "./suite-repository";

export { fingerprint };

const ROLES = new Set<Principal["role"]>(["employee", "manager", "leader"]);

function parseTenantPayload(payload: string): TenantState {
  try {
    const state = JSON.parse(payload) as TenantState;
    if (!state || typeof state !== "object" || !state.records || typeof state.records !== "object") {
      throw new Error("invalid payload shape");
    }
    return state;
  } catch {
    throw new HttpError(503, "Sandbox tenant data is corrupt");
  }
}

export async function loadTenant(db: PrismaClient, tenantId: string) {
  const row = await db.suiteState.findUnique({ where: { tenantId } });
  if (!row || row.revision < 0) throw new HttpError(503, "Sandbox has not been provisioned");
  return { revision: row.revision, state: parseTenantPayload(row.payload) };
}

export async function lookupPrincipal(db: PrismaClient, userId: string): Promise<Principal> {
  const rows = await db.suiteMembership.findMany({
    where: { clerkUserId: userId, active: 1 },
    select: { tenantId: true, employeeId: true, role: true },
    take: 2,
  });
  if (rows.length !== 1) throw new HttpError(403, "An administrator must assign one sandbox membership");
  const r = rows[0];
  if (!ROLES.has(r.role as Principal["role"])) {
    throw new HttpError(403, "An administrator must assign one sandbox membership");
  }
  return {
    userId,
    tenantId: r.tenantId,
    employeeId: r.employeeId,
    role: r.role as Principal["role"],
  };
}

export async function priorResult(
  db: PrismaClient,
  p: Principal,
  key: string,
  hash: string
): Promise<SuiteView | null> {
  const row = await db.suiteIdempotency.findUnique({
    where: { tenantId_userId_key: { tenantId: p.tenantId, userId: p.userId, key } },
  });
  if (!row) return null;
  if (row.fingerprint !== hash) throw new HttpError(409, "Idempotency key already belongs to another request");
  const current = await loadTenant(db, p.tenantId);
  return scopedView(current.state, p, current.revision);
}

export async function commitTenant(
  db: PrismaClient,
  p: Principal,
  expectedRevision: number,
  next: TenantState,
  key: string,
  hash: string,
  action: string
): Promise<SuiteView> {
  const result = scopedView(next, p, expectedRevision + 1);
  const auditId = crypto.randomUUID();
  try {
    const rows = await db.$queryRaw<Array<{ suite_v2_commit_tenant: boolean }>>`
      SELECT suite_v2_commit_tenant(
        ${p.tenantId}::text,
        ${p.userId}::text,
        ${p.employeeId}::text,
        ${expectedRevision}::integer,
        ${JSON.stringify(next)}::text,
        ${key}::text,
        ${hash}::text,
        ${action}::text,
        ${JSON.stringify(result)}::text,
        ${auditId}::text,
        ${new Date().toISOString()}::timestamptz
      ) AS suite_v2_commit_tenant
    `;
    if (rows[0]?.suite_v2_commit_tenant === true) return result;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const previous = await priorResult(db, p, key, hash);
    if (previous) return previous;
    throw error;
  }
  const previous = await priorResult(db, p, key, hash);
  if (previous) return previous;
  throw new HttpError(409, "Data changed. Refresh and review before retrying.");
}

export async function reserveQuota(db: PrismaClient, key: string, limit: number, cost = 1) {
  if (cost > limit) throw new HttpError(429, "Daily free sandbox quota exhausted");
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db.$queryRaw<Array<{ suite_v2_reserve_quota: number | null }>>`
    SELECT suite_v2_reserve_quota(
      ${key}::text,
      ${day}::text,
      ${cost}::integer,
      ${limit}::integer
    ) AS suite_v2_reserve_quota
  `;
  if (rows[0]?.suite_v2_reserve_quota == null) {
    throw new HttpError(429, "Daily free sandbox quota exhausted");
  }
}
