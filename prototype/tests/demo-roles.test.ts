import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseDemoRole, lookupPrincipal } from "../src/lib/suite-repository-prisma";
import { DEMO_PERSONAS, demoRoleSchema } from "../src/server/demo-roles";

type Stub = Parameters<typeof lookupPrincipal>[0];

function stubDb(memberships: { tenantId: string; employeeId: string; role: string }[], records: string[] = ["E0001", "E0002", "E9001"]) {
  const calls: { upsert?: unknown; audit?: { action: string; employeeId: string; revision: number } } = {};
  const db = {
    suiteMembership: {
      findMany: async () => memberships,
      upsert: (args: unknown) => { calls.upsert = args; return args; },
    },
    suiteAudit: { create: (args: { data: { action: string; employeeId: string; revision: number } }) => { calls.audit = args.data; return args; } },
    suiteState: {
      findUnique: async () => ({ revision: 7, payload: JSON.stringify({ records: Object.fromEntries(records.map((id) => [id, {}])) }) }),
    },
    $transaction: async (ops: unknown[]) => ops,
  };
  return { db: db as unknown as Stub, calls };
}

test("an account without a role is asked to choose one only when the demo picker is on", async () => {
  const { db } = stubDb([]);
  await assert.rejects(lookupPrincipal(db, "user_new", { allowRoleChoice: true }), (e: { status: number }) => e.status === 428);
  await assert.rejects(lookupPrincipal(db, "user_new"), (e: { status: number }) => e.status === 403);
});

test("an existing membership still decides the role", async () => {
  const { db } = stubDb([{ tenantId: "iris-sandbox", employeeId: "E0002", role: "manager" }]);
  const p = await lookupPrincipal(db, "user_a", { allowRoleChoice: true });
  assert.deepEqual(p, { userId: "user_a", tenantId: "iris-sandbox", employeeId: "E0002", role: "manager" });
});

test("choosing a demo role binds the account to that persona and writes an audit row", async () => {
  const { db, calls } = stubDb([]);
  const p = await chooseDemoRole(db, "user_a", "iris-sandbox", DEMO_PERSONAS.manager, "manager");
  assert.deepEqual(p, { userId: "user_a", tenantId: "iris-sandbox", employeeId: "E0002", role: "manager" });
  assert.deepEqual(calls.upsert, {
    where: { clerkUserId_tenantId: { clerkUserId: "user_a", tenantId: "iris-sandbox" } },
    create: { clerkUserId: "user_a", tenantId: "iris-sandbox", employeeId: "E0002", role: "manager", active: 1 },
    update: { employeeId: "E0002", role: "manager", active: 1 },
  });
  assert.equal(calls.audit?.action, "demo.role.manager");
  assert.equal(calls.audit?.revision, 7);
});

test("a persona missing from the tenant is refused", async () => {
  const { db } = stubDb([], ["E0001"]);
  await assert.rejects(chooseDemoRole(db, "user_a", "iris-sandbox", DEMO_PERSONAS.leader, "leader"), (e: { status: number }) => e.status === 503);
});

test("only the three demo roles are accepted", () => {
  assert.equal(demoRoleSchema.safeParse({ role: "leader" }).success, true);
  assert.equal(demoRoleSchema.safeParse({ role: "admin" }).success, false);
  assert.equal(demoRoleSchema.safeParse({ role: "employee", employeeId: "E0010" }).success, false);
  assert.deepEqual(DEMO_PERSONAS, { employee: "E0001", manager: "E0002", leader: "E9001" });
});
