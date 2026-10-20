import { z } from "zod";
import { setAIBinding } from "../lib/ai";
import { prepareCoach } from "../lib/coach/coach";
import { aiPlan } from "../lib/path";
import {
  chooseDemoRole,
  commitTenant,
  fingerprint,
  loadTenant,
  priorResult,
  reserveQuota,
} from "../lib/suite-repository-prisma";
import { applyCommand, commandSchema, HttpError, scopedView, storeGeneratedPlan } from "../lib/suite-domain";
import { authenticateNext, verifyClerkUser } from "./authenticate-next";
import { DEMO_PERSONAS, DEMO_TENANT_ID, demoRolePickerEnabled, demoRoleSchema } from "./demo-roles";
import { clerkEnv, errorResponse, json, requestKey } from "./env";
import { readJson } from "./request";
import { requireOrigin } from "./auth";
import { getPrisma, prismaConfigured } from "./prisma";

const revisionSchema = z.object({ expectedRevision: z.number().int().nonnegative() }).strict();
const chatSchema = z
  .object({ message: z.string().trim().min(1).max(1000), lessonId: z.string().max(64).optional() })
  .strict();

const retired = new Set([
  "/api/sso/token",
  "/api/sso/session",
  "/api/state/reset",
  "/api/unlock",
  "/api/integrations/hris-sync",
  "/api/integrations/lms-xapi",
  "/api/integrations/lti-launch",
  "/api/integrations/line-push",
]);

function configureDemoAi() {
  // Workers AI is unavailable on Vercel; stay in deterministic demo mode unless a paid key is configured.
  const freeOnly = process.env.AI_FREE_ONLY_VERIFIED === "1";
  setAIBinding(undefined);
  process.env.DEMO_MODE = freeOnly && process.env.AI_PROVIDER && process.env.AI_PROVIDER !== "workers-ai" ? "0" : "1";
  if (!process.env.AI_PROVIDER || process.env.AI_PROVIDER === "workers-ai") {
    process.env.AI_PROVIDER = process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.OPENCODE_API_KEY
        ? "opencode"
        : "workers-ai";
    if (process.env.AI_PROVIDER === "workers-ai") process.env.DEMO_MODE = "1";
  }
}

// Every tenant write bumps one revision, so an unrelated write during a slow AI call
// conflicts. Only that conflict is retried; precondition and idempotency errors are not.
const revisionConflict = (e: unknown) => e instanceof HttpError && e.status === 409 && e.message.startsWith("Data changed");

export async function handleSuiteApi(req: Request, path: string): Promise<Response> {
  if (retired.has(path) || (path === "/api/state" && req.method !== "GET")) {
    return json({ error: "Legacy demo authority retired" }, 410);
  }
  if (path === "/api/status" && req.method === "GET") {
    return json({
      service: "Learning Suite",
      authentication: "Clerk",
      data: "prisma+supabase",
      host: "vercel",
      database: prismaConfigured() ? "configured" : "missing",
    });
  }

  try {
    // Moodle/HR sync remains on the Worker+D1 sandbox (`pnpm dev:worker`), not the Prisma path.
    if (path === "/api/integrations/sync") {
      throw new HttpError(404, "Endpoint not found");
    }

    const env = clerkEnv();
    const db = getPrisma();

    if (path === "/api/demo/role") {
      if (!demoRolePickerEnabled() || req.method !== "POST") throw new HttpError(404, "Endpoint not found");
      requireOrigin(req, env);
      const userId = await verifyClerkUser(req, env);
      const parsed = demoRoleSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(422, "Choose employee, manager or leader");
      await reserveQuota(db, `${DEMO_TENANT_ID}:demo-role:${userId}`, 30);
      const { role } = parsed.data;
      return json({ principal: await chooseDemoRole(db, userId, DEMO_TENANT_ID, DEMO_PERSONAS[role], role) });
    }

    const p = await authenticateNext(req, env, { allowRoleChoice: demoRolePickerEnabled() });
    const { state, revision } = await loadTenant(db, p.tenantId);
    const view = scopedView(state, p, revision);

    if (req.method === "GET") {
      if (path === "/api/session") return json({ principal: p, demoRoles: demoRolePickerEnabled() });
      if (path === "/api/state") return json(view);
      if (path === "/api/integrations") return json({ integrations: view.integrations });
    }

    if (req.method !== "POST") throw new HttpError(404, "Endpoint not found");
    requireOrigin(req, env);
    configureDemoAi();

    if (path === "/api/commands") {
      const parsed = commandSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(422, "Invalid workflow command");
      const input = parsed.data as Parameters<typeof applyCommand>[2];
      const key = requestKey(req);
      const hash = await fingerprint(input);
      const previous = await priorResult(db, p, key, hash);
      if (previous) return json(previous);
      if (input.expectedRevision !== revision) throw new HttpError(409, "Data changed. Refresh before retrying.");
      return json(await commitTenant(db, p, revision, applyCommand(state, p, input), key, hash, input.command.type));
    }

    if (path === "/api/path") {
      if (p.role === "leader") throw new HttpError(403, "Learning permission required");
      const parsed = revisionSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(422, "Expected revision required");
      const key = requestKey(req);
      const hash = await fingerprint({ type: "plan.generate", ...parsed.data });
      const previous = await priorResult(db, p, key, hash);
      if (previous) return json(previous);
      if (parsed.data.expectedRevision !== revision) {
        throw new HttpError(409, "Data changed. Refresh before generating a plan.");
      }
      const r = state.records[p.employeeId];
      if (r.assessment.status !== "approved" || (r.plan && !["draft", "changes_requested"].includes(r.plan.status))) {
        throw new HttpError(409, "An approved assessment and editable plan are required");
      }
      await reserveQuota(db, `${p.tenantId}:user:${p.userId}`, 20);
      await reserveQuota(db, `${p.tenantId}:ai`, 100);
      const generated = await aiPlan(r.employee, r.overrides, {
        minutesPerMonth: r.assessment.minutesPerMonth,
        certificates: r.assessment.certificates,
      });
      for (let attempt = 0; ; attempt++) {
        const current = attempt === 0 ? { state, revision } : await loadTenant(db, p.tenantId);
        const next = storeGeneratedPlan(current.state, p, generated);
        try {
          return json(await commitTenant(db, p, current.revision, next, key, hash, "plan.generate"));
        } catch (err) {
          if (!revisionConflict(err) || attempt === 4) throw err;
        }
      }
    }

    if (path === "/api/coach") {
      if (p.role === "leader") throw new HttpError(403, "Learning permission required");
      const parsed = chatSchema.safeParse(await readJson(req));
      if (!parsed.success) throw new HttpError(422, "A message of 1-1000 characters is required");
      const r = state.records[p.employeeId];
      const key = parsed.data.lessonId ?? "general";
      if (parsed.data.lessonId && !r.plan?.steps.some((s) => s.itemId === parsed.data.lessonId)) {
        throw new HttpError(404, "Lesson is not in your plan");
      }
      await reserveQuota(db, `${p.tenantId}:user:${p.userId}`, 20);
      await reserveQuota(db, `${p.tenantId}:ai`, 100);
      const messages = [
        ...(r.chats[key] ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: parsed.data.message },
      ];
      const prepared = await prepareCoach({
        employeeId: p.employeeId,
        employee: r.employee,
        messages,
        plan: r.plan,
        overrides: r.overrides,
        lessonId: parsed.data.lessonId,
      });
      const enc = new TextEncoder();
      const event = (name: string, data: unknown) => enc.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      return new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            let answer = "";
            try {
              for await (const text of prepared.stream()) {
                answer += text;
                controller.enqueue(event("text", { text }));
              }
              const id = crypto.randomUUID();
              const fp = await fingerprint(id);
              for (let attempt = 0; ; attempt++) {
                const latest = await loadTenant(db, p.tenantId);
                const record = latest.state.records[p.employeeId];
                if (!record) throw new HttpError(403, "Employee access was removed");
                // Persist the redacted message so a pasted ID or phone number never reaches stored state.
                record.chats[key] = [
                  ...(record.chats[key] ?? []).slice(-38),
                  { role: "user", content: prepared.redactedMessage },
                  { role: "assistant", content: answer, meta: prepared.meta as unknown as Record<string, unknown> },
                ];
                try {
                  await commitTenant(db, p, latest.revision, latest.state, id, fp, "coach.message");
                  break;
                } catch (err) {
                  if (!revisionConflict(err) || attempt === 4) throw err;
                }
              }
              controller.enqueue(event("final", { meta: prepared.meta }));
            } catch (error) {
              controller.enqueue(
                event("error", {
                  error: error instanceof HttpError ? error.message : "The response could not be completed or saved. Please refresh.",
                })
              );
            } finally {
              controller.close();
            }
          },
        }),
        {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        }
      );
    }

    throw new HttpError(404, "Endpoint not found");
  } catch (error) {
    return errorResponse(error);
  }
}
