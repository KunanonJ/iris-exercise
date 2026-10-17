// Provision synthetic tenant + Clerk memberships into Supabase (suite_v2_*).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EMPLOYEES } from "../src/lib/skills";
import { seedTenant } from "../src/lib/suite-domain";

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

  const index = process.argv.indexOf("--memberships");
  const members =
    index < 0
      ? []
      : z
          .array(
            z
              .object({
                userId: z.string().regex(/^user_[a-zA-Z0-9_]+$/),
                employeeId: z.enum(["E0001", "E0002", "E9001"]),
                role: z.enum(["employee", "manager", "leader"]),
              })
              .strict()
          )
          .parse(JSON.parse(readFileSync(process.argv[index + 1], "utf8")));

  if (new Set(members.map((m) => m.userId)).size !== members.length) {
    throw new Error("Clerk identities must be distinct");
  }
  const expected = { E0001: "employee", E0002: "manager", E9001: "leader" } as const;
  if (members.some((m) => expected[m.employeeId] !== m.role)) {
    throw new Error("Membership does not match the sandbox actor");
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const tenantId = "iris-sandbox";
  const payload = JSON.stringify(seedTenant(EMPLOYEES));

  const { data: existing } = await db.from("suite_v2_state").select("revision").eq("tenant_id", tenantId).maybeSingle();
  if (!existing) {
    const { error } = await db.from("suite_v2_state").insert({ tenant_id: tenantId, revision: 0, payload });
    if (error) throw error;
    console.log("Inserted suite_v2_state for iris-sandbox");
  } else if ((existing.revision as number) < 0) {
    const { error } = await db
      .from("suite_v2_state")
      .update({ revision: 0, payload })
      .eq("tenant_id", tenantId)
      .eq("revision", -1);
    if (error) throw error;
    console.log("Finalized pending suite_v2_state for iris-sandbox");
  } else {
    console.log(`suite_v2_state already provisioned (revision=${existing.revision}); leaving payload unchanged`);
  }

  for (const m of members) {
    const { error } = await db.from("suite_v2_memberships").upsert(
      {
        clerk_user_id: m.userId,
        tenant_id: tenantId,
        employee_id: m.employeeId,
        role: m.role,
        active: 1,
      },
      { onConflict: "clerk_user_id,tenant_id" }
    );
    if (error) throw error;
  }

  console.log(`Supabase tenant ready; ${members.length} Clerk memberships upserted.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
