"use client";

import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { itemById } from "@/data/catalog";
import { rulesPlan } from "@/lib/plan-rules";
import { directReports, employeeById } from "@/lib/skills";
import type { Approval, Lang, LearningPlan, Level } from "@/lib/types";
import type { CoachMeta } from "@/lib/coach/coach";

export const HERO = "E0001";
export const MANAGER = "E0002";
export const LEADER = "E9001";

export type Persona = "employee" | "manager" | "leader";
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  meta?: CoachMeta;
}

export interface State {
  authed: boolean;
  persona: Persona;
  handoffNotice?: "fromEmployee";
  lang: Lang;
  tab: "home" | "skills" | "path" | "coach";
  lessonId?: string;
  assessing: boolean;
  assessment: {
    status: "not_started" | "submitted" | "approved";
    self: Record<string, Level>;
    quiz: Record<string, Level>;
    final?: Record<string, Level>;
    managerNote?: string;
  };
  overrides: Record<string, Level>;
  plan?: LearningPlan;
  approvals: Approval[];
  evidence: Record<string, string>;
  chats: Record<string, ChatMsg[]>;
  toast?: string;
}

const day = 864e5;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

function seedApprovals(): Approval[] {
  const team = directReports(MANAGER).filter((e) => e.id !== HERO);
  const [a, b, c, d] = team;
  return [
    { id: "ap-1", kind: "assessment", employeeId: a.id, submittedAt: iso(-1), dueAt: iso(4), status: "pending" },
    { id: "ap-2", kind: "assessment", employeeId: b.id, submittedAt: iso(-6), dueAt: iso(-1), status: "pending" },
    { id: "ap-3", kind: "plan", employeeId: c.id, submittedAt: iso(-2), dueAt: iso(3), status: "pending" },
    { id: "ap-4", kind: "project", employeeId: d.id, submittedAt: iso(-3), dueAt: iso(2), status: "pending", ref: "NEW-303" },
  ];
}

export function initialState(): State {
  const hero = employeeById(HERO)!;
  const self: Record<string, Level> = {};
  for (const [k, v] of Object.entries(hero.scores)) self[k] = v.self;
  return {
    authed: false,
    persona: "employee",
    lang: "th",
    tab: "home",
    assessing: false,
    assessment: { status: "not_started", self, quiz: {} },
    overrides: {},
    approvals: seedApprovals(),
    evidence: {},
    chats: {},
  };
}

export type Action =
  | { type: "set"; patch: Partial<State> }
  | { type: "login"; persona: Persona }
  | { type: "logout"; nextPersona?: Persona; handoffNotice?: "fromEmployee" }
  | { type: "submitAssessment"; self: Record<string, Level>; quiz: Record<string, Level> }
  | { type: "decideAssessment"; approvalId: string; final?: Record<string, Level>; note?: string; approve: boolean }
  | { type: "setPlan"; plan: LearningPlan }
  | { type: "submitPlan" }
  | { type: "decidePlan"; approvalId: string; approve: boolean; note?: string }
  | { type: "stepStatus"; itemId: string; status: "in_progress" | "done" }
  | { type: "submitProject"; itemId: string; evidence: string }
  | { type: "decideProject"; approvalId: string; approve: boolean; note?: string }
  | { type: "chat"; key: string; messages: ChatMsg[] }
  | { type: "reset" };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "set":
      return { ...s, ...a.patch };
    case "login":
      return {
        ...s,
        authed: true,
        persona: a.persona,
        handoffNotice: undefined,
        toast: undefined,
      };
    case "logout":
      return {
        ...s,
        authed: false,
        persona: a.nextPersona ?? s.persona,
        handoffNotice: a.handoffNotice,
        lessonId: undefined,
        assessing: false,
        toast: undefined,
      };
    case "submitAssessment": {
      // Proposed result: self-rating, moderated by the knowledge check where one exists.
      const final: Record<string, Level> = {};
      for (const [k, v] of Object.entries(a.self))
        final[k] = (a.quiz[k] ? Math.min(v, a.quiz[k]) : v) as Level;
      const ap: Approval = {
        id: `ap-assess-${Date.now()}`,
        kind: "assessment",
        employeeId: HERO,
        submittedAt: iso(0),
        dueAt: iso(5),
        status: "pending",
      };
      return {
        ...s,
        assessing: false,
        assessment: { status: "submitted", self: a.self, quiz: a.quiz, final },
        approvals: [ap, ...s.approvals],
        toast: "assessmentSent",
      };
    }
    case "decideAssessment": {
      const approvals = s.approvals.map((x) =>
        x.id === a.approvalId
          ? { ...x, status: a.approve ? ("approved" as const) : ("changes_requested" as const), note: a.note }
          : x,
      );
      const ap = s.approvals.find((x) => x.id === a.approvalId);
      if (ap?.employeeId !== HERO) return { ...s, approvals };
      if (!a.approve)
        return { ...s, approvals, assessment: { ...s.assessment, status: "not_started", managerNote: a.note } };
      const final = a.final ?? s.assessment.final ?? {};
      return {
        ...s,
        approvals,
        assessment: { ...s.assessment, status: "approved", final, managerNote: a.note },
        overrides: { ...final },
      };
    }
    case "setPlan":
      return { ...s, plan: a.plan };
    case "submitPlan": {
      if (!s.plan) return s;
      const ap: Approval = {
        id: `ap-plan-${Date.now()}`,
        kind: "plan",
        employeeId: HERO,
        submittedAt: iso(0),
        dueAt: iso(5),
        status: "pending",
      };
      return {
        ...s,
        plan: { ...s.plan, status: "pending" },
        approvals: [
          ap,
          ...s.approvals.filter((x) => !(x.employeeId === HERO && x.kind === "plan" && x.status === "pending")),
        ],
        toast: "planSent",
      };
    }
    case "decidePlan": {
      const approvals = s.approvals.map((x) =>
        x.id === a.approvalId
          ? { ...x, status: a.approve ? ("approved" as const) : ("changes_requested" as const), note: a.note }
          : x,
      );
      const ap = s.approvals.find((x) => x.id === a.approvalId);
      if (ap?.employeeId !== HERO || !s.plan) return { ...s, approvals };
      return {
        ...s,
        approvals,
        plan: { ...s.plan, status: a.approve ? "approved" : "changes_requested", managerNote: a.note },
      };
    }
    case "stepStatus":
      if (!s.plan) return s;
      return {
        ...s,
        plan: {
          ...s.plan,
          steps: s.plan.steps.map((st) => (st.itemId === a.itemId ? { ...st, status: a.status } : st)),
        },
      };
    case "submitProject": {
      if (!s.plan) return s;
      const ap: Approval = {
        id: `ap-proj-${Date.now()}`,
        kind: "project",
        employeeId: HERO,
        submittedAt: iso(0),
        dueAt: iso(5),
        status: "pending",
        ref: a.itemId,
      };
      return {
        ...s,
        evidence: { ...s.evidence, [a.itemId]: a.evidence },
        approvals: [ap, ...s.approvals],
        plan: {
          ...s.plan,
          steps: s.plan.steps.map((st) => (st.itemId === a.itemId ? { ...st, status: "submitted" } : st)),
        },
        toast: "projectSent",
      };
    }
    case "decideProject": {
      const approvals = s.approvals.map((x) =>
        x.id === a.approvalId
          ? { ...x, status: a.approve ? ("approved" as const) : ("changes_requested" as const), note: a.note }
          : x,
      );
      const ap = s.approvals.find((x) => x.id === a.approvalId);
      if (ap?.employeeId !== HERO || !s.plan || !ap.ref) return { ...s, approvals };
      const item = itemById(ap.ref);
      const overrides = { ...s.overrides };
      // An approved project is evidence of the target level for its skills.
      if (a.approve)
        for (const sk of item?.skills ?? [])
          overrides[sk.skillId] = Math.max(overrides[sk.skillId] ?? 1, sk.targetLevel) as Level;
      return {
        ...s,
        approvals,
        overrides,
        plan: {
          ...s.plan,
          steps: s.plan.steps.map((st) =>
            st.itemId === ap.ref ? { ...st, status: a.approve ? "done" : "in_progress" } : st,
          ),
        },
      };
    }
    case "chat":
      return { ...s, chats: { ...s.chats, [a.key]: a.messages } };
    case "reset":
      return initialState();
  }
}

const Ctx = createContext<{ s: State; dispatch: (a: Action) => void } | null>(null);
const KEY = "learning-suite-demo-v2";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, dispatch] = useReducer(reducer, undefined, initialState);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) dispatch({ type: "set", patch: { ...JSON.parse(raw), toast: undefined } });
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s]);
  return <Ctx.Provider value={{ s, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("StoreProvider missing");
  return v;
}

export function rulesPlanFor(overrides: Record<string, Level>) {
  return rulesPlan(employeeById(HERO)!, overrides);
}
