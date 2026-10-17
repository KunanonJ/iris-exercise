import { z } from "zod";
import { itemById } from "../data/catalog";
import { roleById } from "../data/taxonomy";
import { profile } from "./skills";
import type { Approval, Employee, LearningPlan, Level } from "./types";
import type { CommandRequest, IntegrationStatus, LearningRecord, Principal, SuiteView } from "./suite-contracts";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const levels = z.record(z.string().max(64), z.number().int().min(1).max(4));
export const commandSchema = z.object({ expectedRevision: z.number().int().nonnegative(), command: z.discriminatedUnion("type", [
  z.object({ type: z.literal("assessment.submit"), self: levels, answers: z.array(z.number().int().min(0).max(2)).length(3) }).strict(),
  z.object({ type: z.literal("plan.submit") }).strict(),
  z.object({ type: z.literal("learning.start"), itemId: z.string().max(64) }).strict(),
  z.object({ type: z.literal("project.submit"), itemId: z.string().max(64), evidence: z.string().trim().min(10).max(4000) }).strict(),
  z.object({ type: z.literal("approval.decide"), approvalId: z.string().max(128), approve: z.boolean(), note: z.string().trim().max(1000).optional(), final: levels.optional() }).strict(),
]) }).strict();
export interface TenantState {
  records: Record<string, LearningRecord>;
  approvals: Approval[];
  integrations: IntegrationStatus[];
  hrCursor: string;
  lms: Record<string, { employeeId: string; source: "moodle-a" | "moodle-b"; userId: number; courseId: number; itemId: string; roleId: number }>;
}
export const blankRecord = (employee: Employee): LearningRecord => ({ employee, assessment: { status: "not_started", self: {}, quiz: {} }, overrides: {}, evidence: {}, chats: {} });
export function seedTenant(employees: Employee[]): TenantState {
  return { records: Object.fromEntries(employees.map(e => [e.id, blankRecord(e)])), approvals: [], hrCursor: "0", lms: {}, integrations: [
    { id: "clerk", label: "Clerk development authentication", status: "configured", detail: "API identity verified by Clerk (Google + LINE Login social connections enabled on the development instance); permissions still come from Suite memberships, not the IdP." },
    { id: "hr", label: "Synthetic HR service", status: "unconfigured", detail: "Local sandbox proof required; no vendor HRIS connection claimed." },
    ...["moodle-a", "moodle-b"].map(id => ({ id, label: `${id} REST`, status: "unconfigured" as const, detail: "Local sandbox only. Catalogue, enrolment and completion proof required." })),
  ] };
}
function own(state: TenantState, p: Principal) { const r = state.records[p.employeeId]; if (!r) throw new HttpError(403, "No active employee membership"); return r; }
export function scopedView(state: TenantState, p: Principal, revision: number): SuiteView {
  const me = own(state, p);
  const result: SuiteView = { principal: p, revision, approvals: [], integrations: state.integrations };
  if (p.role !== "leader") result.self = structuredClone(me);
  if (p.role === "employee") result.approvals = state.approvals.filter(a => a.employeeId === p.employeeId);
  if (p.role === "manager") {
    result.team = Object.values(state.records).filter(r => r.employee.managerId === p.employeeId).map(r => ({ ...structuredClone(r), chats: {} }));
    const ids = new Set(result.team.map(r => r.employee.id));
    result.approvals = state.approvals.filter(a => ids.has(a.employeeId));
  }
  if (p.role === "leader") {
    const rs = Object.values(state.records);
    if (rs.length < 10) return result;
    const bus = [...new Set(rs.map(r => r.employee.bu))];
    const groups = bus.map(bu => { const members = rs.filter(r => r.employee.bu === bu); return { bu, count: members.length, readiness: members.reduce((n,r) => n + profile(r.employee,r.overrides).currentReadiness,0) / members.length }; });
    result.metrics = { employees: rs.length, assessed: rs.filter(r => r.assessment.status !== "not_started").length, approved: rs.filter(r => r.assessment.status === "approved").length, plansActive: rs.filter(r => r.plan?.status === "approved").length, completedSteps: rs.reduce((n,r) => n + (r.plan?.steps.filter(s => s.status === "done").length ?? 0),0), pendingApprovals: state.approvals.filter(a => a.status === "pending").length, groups: groups.filter(g => g.count >= 10), suppressedGroups: groups.filter(g => g.count < 10).length };
  }
  return result;
}
function requireEmployee(p: Principal) { if (p.role === "leader") throw new HttpError(403, "Learning permission required"); }
function skillIds(r: LearningRecord) { return new Set([r.employee.roleId, r.employee.nextRoleId].filter(Boolean).flatMap(id => roleById(id!).requirements.map(s => s.skillId))); }
function validateLevels(values: Record<string, number>, allowed: Set<string>, complete = false) {
  if (Object.keys(values).some(k => !allowed.has(k)) || (complete && Object.keys(values).length !== allowed.size)) throw new HttpError(422, "Submit exactly the skills required by the current and target roles");
}
function pending(state: TenantState, employeeId: string, kind: Approval["kind"], now: string, ref?: string) {
  if (state.approvals.some(a => a.employeeId === employeeId && a.kind === kind && a.ref === ref && a.status === "pending")) throw new HttpError(409, "Already awaiting approval");
  state.approvals.push({ id: crypto.randomUUID(), employeeId, kind, status: "pending", submittedAt: now, dueAt: new Date(Date.parse(now) + 7 * 864e5).toISOString(), ...(ref ? {ref} : {}) });
}
export function applyCommand(state: TenantState, p: Principal, input: CommandRequest, now = new Date().toISOString()): TenantState {
  const next = structuredClone(state); const r = own(next, p); const a = input.command;
  if (a.type === "approval.decide") {
    if (p.role !== "manager") throw new HttpError(403, "Manager permission required");
    const ap = next.approvals.find(x => x.id === a.approvalId);
    const target = ap && next.records[ap.employeeId];
    if (!ap || !target || target.employee.managerId !== p.employeeId || ap.employeeId === p.employeeId) throw new HttpError(404, "Approval not found");
    if (ap.status !== "pending") throw new HttpError(409, "Approval already decided");
    if (!a.approve && !a.note?.trim()) throw new HttpError(422, "A reason is required when returning work");
    if (ap.kind === "assessment") {
      if (target.assessment.status !== "submitted") throw new HttpError(409, "Assessment is not awaiting approval");
      if (a.final) {
        validateLevels(a.final, skillIds(target), true);
        if (JSON.stringify(a.final) !== JSON.stringify(target.assessment.final) && !a.note?.trim()) throw new HttpError(422, "Calibration requires a reason");
      }
      target.assessment.status = a.approve ? "approved" : "changes_requested";
      target.assessment.managerNote = a.note;
      if (a.approve) { target.assessment.final = a.final ?? target.assessment.final; target.overrides = { ...target.assessment.final }; }
    } else if (ap.kind === "plan") {
      if (target.plan?.status !== "pending") throw new HttpError(409, "Plan is not awaiting approval");
      target.plan.status = a.approve ? "approved" : "changes_requested"; target.plan.managerNote = a.note;
    } else {
      const step = target.plan?.steps.find(s => s.itemId === ap.ref);
      if (!step || step.status !== "submitted" || !target.evidence[step.itemId]) throw new HttpError(409, "Project evidence is not awaiting approval");
      step.status = a.approve ? "done" : "in_progress";
      if (a.approve) for (const sk of itemById(step.itemId)?.skills ?? []) target.overrides[sk.skillId] = Math.max(target.overrides[sk.skillId] ?? target.employee.scores[sk.skillId]?.final ?? 1, sk.targetLevel) as Level;
    }
    ap.status = a.approve ? "approved" : "changes_requested"; ap.note = a.note;
    return next;
  }
  requireEmployee(p);
  if (a.type === "assessment.submit") {
    if (r.assessment.status === "submitted" || r.assessment.status === "approved") throw new HttpError(409, "Assessment cannot be replaced in this state");
    const ids = skillIds(r); validateLevels(a.self, ids, true);
    const quiz: Record<string,Level> = {}; ["T-CMPL","L-COACH","T-INV"].forEach((id,i) => { if (ids.has(id)) quiz[id] = a.answers[i] === [1,2,1][i] ? 3 : 2; });
    const final = Object.fromEntries([...ids].map(id => [id, Math.min(a.self[id], quiz[id] ?? a.self[id]) as Level]));
    r.assessment = { status: "submitted", self: a.self, quiz, final };
    pending(next,p.employeeId,"assessment",now);
  } else if (a.type === "plan.submit") {
    if (r.assessment.status !== "approved" || !r.plan || !["draft","changes_requested"].includes(r.plan.status)) throw new HttpError(409,"An approved assessment and draft plan are required");
    r.plan.status = "pending"; pending(next,p.employeeId,"plan",now);
  } else {
    if (r.plan?.status !== "approved") throw new HttpError(409,"Approved learning plan required");
    const step = r.plan.steps.find(s => s.itemId === a.itemId); const item = step && itemById(step.itemId);
    if (!step || !item) throw new HttpError(404,"Learning step not found");
    if (a.type === "learning.start") {
      if (!["todo","in_progress"].includes(step.status)) throw new HttpError(409,"Learning step cannot be restarted");
      step.status = "in_progress";
    } else {
      if (item.format !== "project" || !["todo","in_progress"].includes(step.status)) throw new HttpError(409,"Only unfinished projects accept evidence");
      r.evidence[a.itemId] = a.evidence; step.status = "submitted"; pending(next,p.employeeId,"project",now,a.itemId);
    }
  }
  return next;
}
export function storeGeneratedPlan(state: TenantState,p: Principal,plan: LearningPlan): TenantState {
  requireEmployee(p); const next = structuredClone(state); const r = own(next,p);
  if (r.assessment.status !== "approved" || (r.plan && !["draft","changes_requested"].includes(r.plan.status))) throw new HttpError(409,"Plan generation requires an approved assessment and editable plan");
  r.plan = {...plan,employeeId:p.employeeId,status:"draft"}; return next;
}
