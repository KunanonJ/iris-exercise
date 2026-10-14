// Core data model for the Learning Suite prototype. Mirrors the production
// model on the deck: roles -> required skills -> assessments -> gaps -> plan.

export type Lang = "th" | "en";
export type Bilingual = { th: string; en: string };

export type BUId = "BM" | "CH" | "PK" | "RD" | "CS";
export interface BusinessUnit {
  id: BUId;
  name: Bilingual;
  headcount: number;
  frontlineShare: number;
  pilot: boolean;
}

export type SkillCategory = "core" | "technical" | "leadership";
export type Level = 1 | 2 | 3 | 4;

export interface Skill {
  id: string;
  name: Bilingual;
  category: SkillCategory;
  description: Bilingual;
  // Behavioural indicator for proficiency levels 1-4
  levels: [Bilingual, Bilingual, Bilingual, Bilingual];
}

export interface RoleRequirement {
  skillId: string;
  level: Level;
  critical: boolean;
}

export interface Role {
  id: string;
  bu: BUId;
  family: string;
  title: Bilingual;
  grade: number;
  frontline: boolean;
  requirements: RoleRequirement[];
  nextRoles: string[];
}

export type Format = "video" | "workshop" | "project";
export type Source = "LMS-A" | "LMS-B" | "NEW";

export interface LearningItem {
  id: string;
  source: Source;
  format: Format;
  title: Bilingual;
  summary: Bilingual;
  skills: { skillId: string; targetLevel: Level }[];
  minutes: number;
  language: Lang | "both";
  sessions?: { date: string; location: Bilingual }[];
  // Lesson text / video transcript, indexed for the coach (RAG)
  content?: Bilingual;
}

export interface KnowledgeDoc {
  id: string;
  title: Bilingual;
  content: Bilingual;
}

export interface SkillScore {
  self: Level;
  manager?: Level;
  quiz?: Level;
  final: Level;
}

export interface Employee {
  id: string;
  name: Bilingual;
  bu: BUId;
  roleId: string;
  nextRoleId: string | null;
  managerId: string | null;
  site: Bilingual;
  lang: Lang;
  frontline: boolean;
  scores: Record<string, SkillScore>;
}

export interface Gap {
  skillId: string;
  current: Level;
  required: Level;
  gap: number;
  critical: boolean;
  forRole: "current" | "next";
}

export type PlanStatus = "draft" | "pending" | "approved" | "changes_requested";

export interface PlanStep {
  itemId: string;
  skillId: string;
  order: number;
  week: number;
  rationale: Bilingual;
  status: "todo" | "in_progress" | "submitted" | "done";
}

export interface LearningPlan {
  employeeId: string;
  targetRoleId: string;
  status: PlanStatus;
  steps: PlanStep[];
  summary: Bilingual;
  generatedBy: "ai" | "rules";
  managerNote?: string;
}

export type ApprovalKind = "assessment" | "plan" | "project";
export interface Approval {
  id: string;
  kind: ApprovalKind;
  employeeId: string;
  submittedAt: string;
  dueAt: string;
  status: "pending" | "approved" | "changes_requested";
  ref?: string;
  note?: string;
}
