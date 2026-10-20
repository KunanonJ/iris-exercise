import type { Approval, Employee, LearningPlan, Level } from "./types";

export type SuiteRole = "employee" | "manager" | "leader";
export interface Principal { userId: string; tenantId: string; employeeId: string; role: SuiteRole }
export interface ConversationMessage { role: "user" | "assistant"; content: string; meta?: Record<string, unknown>; feedback?: "helpful" | "not_helpful" }
export interface LearningRecord {
  employee: Employee;
  assessment: { status: "not_started" | "submitted" | "approved" | "changes_requested"; self: Record<string, Level>; quiz: Record<string, Level>; final?: Record<string, Level>; managerNote?: string; minutesPerMonth?: number; certificates?: string[] };
  overrides: Record<string, Level>;
  plan?: LearningPlan;
  evidence: Record<string, string>;
  chats: Record<string, ConversationMessage[]>;
}
export interface IntegrationStatus { id: string; label: string; status: "unconfigured" | "configured" | "verified" | "error"; detail: string; lastSuccess?: string }
export interface OrgMetrics { employees: number; assessed: number; approved: number; plansActive: number; completedSteps: number; pendingApprovals: number; groups: { bu: string; count: number; readiness: number }[]; suppressedGroups: number; coach?: { answers: number; rated: number; helpful: number; noSource: number } }
export interface SuiteView { principal: Principal; revision: number; self?: LearningRecord; team?: LearningRecord[]; approvals: Approval[]; metrics?: OrgMetrics; integrations: IntegrationStatus[] }
export type SuiteCommand =
  | { type: "assessment.submit"; self: Record<string, Level>; answers: number[]; minutesPerMonth?: number; certificates?: string[] }
  | { type: "coach.feedback"; key: string; index: number; helpful: boolean }
  | { type: "plan.submit" }
  | { type: "learning.start"; itemId: string }
  | { type: "project.submit"; itemId: string; evidence: string }
  | { type: "approval.decide"; approvalId: string; approve: boolean; note?: string; final?: Record<string, Level> };
export interface CommandRequest { expectedRevision: number; command: SuiteCommand }
