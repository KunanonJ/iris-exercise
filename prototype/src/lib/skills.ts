import employeesJson from "../data/generated/employees.json";
import { roleById, skillById } from "../data/taxonomy";
import type { Employee, Gap, Level, Role } from "./types";

export const EMPLOYEES = employeesJson as unknown as Employee[];
export const employeeById = (id: string) => EMPLOYEES.find((e) => e.id === id);
export const directReports = (managerId: string) => EMPLOYEES.filter((e) => e.managerId === managerId);

export function levelOf(emp: Employee, skillId: string, overrides?: Record<string, Level>): Level {
  return overrides?.[skillId] ?? emp.scores[skillId]?.final ?? 1;
}

function gapsAgainst(emp: Employee, role: Role, forRole: Gap["forRole"], overrides?: Record<string, Level>): Gap[] {
  return role.requirements.map((req) => {
    const current = levelOf(emp, req.skillId, overrides);
    return { skillId: req.skillId, current, required: req.level, gap: Math.max(0, req.level - current), critical: req.critical, forRole };
  });
}

// Gaps for the next role, sorted by priority: critical first, then size.
export function nextRoleGaps(emp: Employee, overrides?: Record<string, Level>): Gap[] {
  if (!emp.nextRoleId) return [];
  return gapsAgainst(emp, roleById(emp.nextRoleId), "next", overrides)
    .filter((g) => g.gap > 0)
    .sort((a, b) => Number(b.critical) - Number(a.critical) || b.gap - a.gap);
}

export function profile(emp: Employee, overrides?: Record<string, Level>) {
  const role = roleById(emp.roleId);
  const next = emp.nextRoleId ? roleById(emp.nextRoleId) : null;
  const current = gapsAgainst(emp, role, "current", overrides);
  const nextGaps = next ? gapsAgainst(emp, next, "next", overrides) : [];
  const met = (gs: Gap[]) => (gs.length ? gs.filter((g) => g.gap === 0).length / gs.length : 1);
  return {
    role,
    next,
    current,
    nextGaps,
    currentReadiness: met(current),
    nextReadiness: met(nextGaps),
    criticalReady: nextGaps.filter((g) => g.critical).every((g) => g.gap === 0),
  };
}

// Plain-text profile handed to the coach and path generator. Only the
// signed-in employee's own record is ever included (enforced server-side).
export function profileForPrompt(emp: Employee, overrides?: Record<string, Level>) {
  const p = profile(emp, overrides);
  const line = (g: Gap) => {
    const s = skillById(g.skillId);
    return `- ${s.name.en} (${s.name.th}) [${g.skillId}]: current L${g.current}, required L${g.required}${g.critical ? ", critical" : ""}${g.gap ? `, gap ${g.gap}` : ", met"}. Next level means: ${g.gap ? s.levels[Math.min(3, g.current)].en : "-"}`;
  };
  return [
    `Name: ${emp.name.en} (${emp.name.th}); preferred language: ${emp.lang}`,
    `Current role: ${p.role.title.en} (${p.role.title.th}), site: ${emp.site.en}`,
    p.next ? `Target next role: ${p.next.title.en} (${p.next.title.th}); readiness ${Math.round(p.nextReadiness * 100)}% of required skills met` : "No target next role set",
    "Skills against target role:",
    ...p.nextGaps.map(line),
  ].join("\n");
}
