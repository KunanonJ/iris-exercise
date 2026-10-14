import { aiPlan } from "@/lib/path";
import { allow, clientKey } from "@/lib/ratelimit";
import { employeeById } from "@/lib/skills";
import type { Level } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { employeeId, overrides } = (await req.json()) as { employeeId: string; overrides?: Record<string, Level> };
  const emp = employeeById(employeeId);
  if (!emp?.nextRoleId) return Response.json({ error: "No target role" }, { status: 400 });
  if (!allow(clientKey(req), 4)) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  return Response.json(await aiPlan(emp, overrides));
}
