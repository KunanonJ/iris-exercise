// Cloudflare Worker: serves the static Next.js export (env.ASSETS) and the
// API. One Worker, no server; the passcode gate runs in front of everything.
import { provider, isLive, models } from "../src/lib/ai";
import { prepareCoach, type CoachInput } from "../src/lib/coach/coach";
import { aiPlan } from "../src/lib/path";
import { allow, clientKey } from "../src/lib/ratelimit";
import { employeeById } from "../src/lib/skills";
import type { Level } from "../src/lib/types";

interface Env {
  ASSETS: { fetch(req: Request | string): Promise<Response> };
  DEMO_PASSCODE?: string;
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// UTF-8 safe base64 for the coach metadata header.
function b64(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const OPEN = [/^\/unlock(\.html)?$/, /^\/api\/unlock$/, /^\/_next\//, /^\/favicon\.ico$/];
function cookie(req: Request, name: string) {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

async function coach(req: Request) {
  const body = (await req.json()) as CoachInput;
  const last = body.messages?.at(-1)?.content ?? "";
  if (!last.trim() || last.length > 1000) return json({ error: "Message must be 1-1000 characters." }, 400);
  if (!allow(clientKey(req))) return json({ error: "Too many requests. Try again in a minute." }, 429);
  const { meta, stream } = await prepareCoach({
    ...body,
    forceDemo: false,
    messages: body.messages.map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) })),
  });
  const enc = new TextEncoder();
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const piece of stream()) controller.enqueue(enc.encode(piece));
      } catch (err) {
        console.error("coach stream failed", err);
        controller.enqueue(enc.encode(meta.lang === "th" ? "\n\n(ขออภัยค่ะ ระบบขัดข้องชั่วคราว)" : "\n\n(Sorry, something went wrong. Please try again.)"));
      }
      controller.close();
    },
  });
  return new Response(out, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-coach-meta": b64(meta) } });
}

async function path(req: Request) {
  const { employeeId, overrides } = (await req.json()) as { employeeId: string; overrides?: Record<string, Level> };
  const emp = employeeById(employeeId);
  if (!emp?.nextRoleId) return json({ error: "No target role" }, 400);
  if (!allow(clientKey(req), 4)) return json({ error: "Too many requests. Try again in a minute." }, 429);
  return json(await aiPlan(emp, overrides));
}

async function unlock(req: Request, env: Env) {
  const pass = String((await req.formData()).get("passcode") ?? "");
  const ok = !env.DEMO_PASSCODE || pass === env.DEMO_PASSCODE;
  const headers = new Headers({ location: ok ? "/" : "/unlock?e=1" });
  if (ok) headers.append("set-cookie", `demo_pass=${encodeURIComponent(pass)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`);
  return new Response(null, { status: 303, headers });
}

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    if (env.DEMO_PASSCODE && !OPEN.some((re) => re.test(p)) && cookie(req, "demo_pass") !== env.DEMO_PASSCODE) {
      return p.startsWith("/api/") ? json({ error: "Locked" }, 401) : Response.redirect(new URL("/unlock", url).toString(), 302);
    }
    try {
      if (p === "/api/status" && req.method === "GET") return json({ live: isLive(), provider: provider(), models: isLive() ? models() : null });
      if (p === "/api/coach" && req.method === "POST") return await coach(req);
      if (p === "/api/path" && req.method === "POST") return await path(req);
      if (p === "/api/unlock" && req.method === "POST") return await unlock(req, env);
      if (p.startsWith("/api/")) return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Server error" }, 500);
    }
    return env.ASSETS.fetch(req);
  },
};

export default worker;
