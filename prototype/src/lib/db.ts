import { EMPLOYEES, directReports, employeeById } from "./skills";
import type { Approval, LearningPlan, Level } from "./types";
import type { ChatMsg } from "../components/store";

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface DbMeta {
  connected: boolean;
  engine: string;
  tables: {
    employees: number;
    assessments: number;
    plans: number;
    approvals: number;
    coach_logs: number;
  };
}

export interface SharedStatePayload {
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
  dbMeta?: DbMeta;
}

const HERO = "E0001";
const MANAGER = "E0002";
const day = 864e5;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

function defaultSeedState(): SharedStatePayload {
  const hero = employeeById(HERO)!;
  const self: Record<string, Level> = {};
  const quiz: Record<string, Level> = {};
  for (const [k, v] of Object.entries(hero.scores)) {
    self[k] = v.self;
    quiz[k] = v.quiz ?? v.self;
  }
  const team = directReports(MANAGER).filter((e) => e.id !== HERO);
  const [a, b, c, d] = team;
  const approvals: Approval[] = [
    { id: "ap-1", kind: "assessment", employeeId: a.id, submittedAt: iso(-1), dueAt: iso(4), status: "pending" },
    { id: "ap-2", kind: "assessment", employeeId: b.id, submittedAt: iso(-6), dueAt: iso(-1), status: "pending" },
    { id: "ap-3", kind: "plan", employeeId: c.id, submittedAt: iso(-2), dueAt: iso(3), status: "pending" },
    { id: "ap-4", kind: "project", employeeId: d.id, submittedAt: iso(-3), dueAt: iso(2), status: "pending", ref: "NEW-303" },
  ];
  return {
    assessment: { status: "not_started", self, quiz },
    overrides: {},
    plan: undefined,
    approvals,
    evidence: {},
    chats: {},
  };
}

export async function ensureSeeded(db: D1Database): Promise<void> {
  const row = await db.prepare("SELECT COUNT(*) AS cnt FROM employees").first<{ cnt: number }>();
  if (row && Number(row.cnt) > 0) return;
  await seedDatabase(db);
}

export async function seedDatabase(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  const seed = defaultSeedState();
  const stmts: D1PreparedStatement[] = [
    db.prepare("DELETE FROM coach_logs"),
    db.prepare("DELETE FROM approvals"),
    db.prepare("DELETE FROM plans"),
    db.prepare("DELETE FROM assessments"),
    db.prepare("DELETE FROM employees"),
  ];

  for (const emp of EMPLOYEES) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO employees (id, name_th, name_en, role_id, next_role_id, bu, site_id, manager_id, tenure_months, scores_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          emp.id,
          emp.name.th,
          emp.name.en,
          emp.roleId,
          emp.nextRoleId ?? null,
          emp.bu,
          emp.site.en,
          emp.managerId ?? null,
          18,
          JSON.stringify(emp.scores),
          now
        )
    );
  }

  stmts.push(
    db
      .prepare(
        `INSERT INTO assessments (employee_id, status, self_json, quiz_json, final_json, overrides_json, manager_note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        HERO,
        seed.assessment.status,
        JSON.stringify(seed.assessment.self),
        JSON.stringify(seed.assessment.quiz),
        null,
        JSON.stringify(seed.overrides),
        null,
        now
      )
  );

  for (const ap of seed.approvals) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO approvals (id, kind, employee_id, submitted_at, due_at, status, note, ref, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(ap.id, ap.kind, ap.employeeId, ap.submittedAt, ap.dueAt, ap.status, ap.note ?? null, ap.ref ?? null, now)
    );
  }

  await db.batch(stmts);
}

export async function getDbMeta(db: D1Database): Promise<DbMeta> {
  await ensureSeeded(db);
  const counts = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM employees) AS employees,
        (SELECT COUNT(*) FROM assessments) AS assessments,
        (SELECT COUNT(*) FROM plans) AS plans,
        (SELECT COUNT(*) FROM approvals) AS approvals,
        (SELECT COUNT(*) FROM coach_logs) AS coach_logs`
    )
    .first<{ employees: number; assessments: number; plans: number; approvals: number; coach_logs: number }>();

  return {
    connected: true,
    engine: "Cloudflare D1 (SQLite)",
    tables: {
      employees: Number(counts?.employees ?? 0),
      assessments: Number(counts?.assessments ?? 0),
      plans: Number(counts?.plans ?? 0),
      approvals: Number(counts?.approvals ?? 0),
      coach_logs: Number(counts?.coach_logs ?? 0),
    },
  };
}

export async function loadSharedState(db: D1Database): Promise<SharedStatePayload> {
  await ensureSeeded(db);
  const seed = defaultSeedState();

  const [assessRow, planRow, approvalRows, chatRows, dbMeta] = await Promise.all([
    db
      .prepare("SELECT status, self_json, quiz_json, final_json, overrides_json, manager_note FROM assessments WHERE employee_id = ?")
      .bind(HERO)
      .first<{
        status: "not_started" | "submitted" | "approved";
        self_json: string;
        quiz_json: string;
        final_json: string | null;
        overrides_json: string;
        manager_note: string | null;
      }>(),
    db
      .prepare(
        "SELECT target_role_id, status, steps_json, evidence_json, rationale_th, rationale_en, generated_by FROM plans WHERE employee_id = ?"
      )
      .bind(HERO)
      .first<{
        target_role_id: string;
        status: LearningPlan["status"];
        steps_json: string;
        evidence_json: string;
        rationale_th: string;
        rationale_en: string;
        generated_by: "ai" | "rules";
      }>(),
    db
      .prepare("SELECT id, kind, employee_id, submitted_at, due_at, status, note, ref FROM approvals ORDER BY submitted_at DESC, id ASC")
      .all<{
        id: string;
        kind: Approval["kind"];
        employee_id: string;
        submitted_at: string;
        due_at: string;
        status: Approval["status"];
        note: string | null;
        ref: string | null;
      }>(),
    db
      .prepare("SELECT chat_key, role, content, meta_json FROM coach_logs WHERE employee_id = ? ORDER BY id ASC")
      .bind(HERO)
      .all<{
        chat_key: string;
        role: "user" | "assistant";
        content: string;
        meta_json: string | null;
      }>(),
    getDbMeta(db),
  ]);

  const assessment: SharedStatePayload["assessment"] = assessRow
    ? {
        status: assessRow.status,
        self: JSON.parse(assessRow.self_json),
        quiz: JSON.parse(assessRow.quiz_json),
        final: assessRow.final_json ? JSON.parse(assessRow.final_json) : undefined,
        managerNote: assessRow.manager_note ?? undefined,
      }
    : seed.assessment;

  const overrides: Record<string, Level> = assessRow?.overrides_json ? JSON.parse(assessRow.overrides_json) : {};

  const plan: LearningPlan | undefined = planRow
    ? {
        employeeId: HERO,
        targetRoleId: planRow.target_role_id,
        status: planRow.status,
        steps: JSON.parse(planRow.steps_json),
        summary: { th: planRow.rationale_th, en: planRow.rationale_en },
        generatedBy: planRow.generated_by || "rules",
      }
    : undefined;

  const evidence: Record<string, string> = planRow?.evidence_json ? JSON.parse(planRow.evidence_json) : {};

  const approvals: Approval[] =
    approvalRows.results.length > 0
      ? approvalRows.results.map((r) => ({
          id: r.id,
          kind: r.kind,
          employeeId: r.employee_id,
          submittedAt: r.submitted_at,
          dueAt: r.due_at,
          status: r.status,
          note: r.note ?? undefined,
          ref: r.ref ?? undefined,
        }))
      : seed.approvals;

  const chats: Record<string, ChatMsg[]> = {};
  for (const row of chatRows.results) {
    if (!chats[row.chat_key]) chats[row.chat_key] = [];
    chats[row.chat_key].push({
      role: row.role,
      content: row.content,
      meta: row.meta_json ? JSON.parse(row.meta_json) : undefined,
    });
  }

  return {
    assessment,
    overrides,
    plan,
    approvals,
    evidence,
    chats,
    dbMeta,
  };
}

export async function saveSharedState(db: D1Database, state: SharedStatePayload): Promise<DbMeta> {
  await ensureSeeded(db);
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];

  stmts.push(
    db
      .prepare(
        `INSERT INTO assessments (employee_id, status, self_json, quiz_json, final_json, overrides_json, manager_note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(employee_id) DO UPDATE SET
           status = excluded.status,
           self_json = excluded.self_json,
           quiz_json = excluded.quiz_json,
           final_json = excluded.final_json,
           overrides_json = excluded.overrides_json,
           manager_note = excluded.manager_note,
           updated_at = excluded.updated_at`
      )
      .bind(
        HERO,
        state.assessment.status,
        JSON.stringify(state.assessment.self ?? {}),
        JSON.stringify(state.assessment.quiz ?? {}),
        state.assessment.final ? JSON.stringify(state.assessment.final) : null,
        JSON.stringify(state.overrides ?? {}),
        state.assessment.managerNote ?? null,
        now
      )
  );

  if (state.plan) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO plans (employee_id, target_role_id, status, steps_json, evidence_json, rationale_th, rationale_en, generated_by, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(employee_id) DO UPDATE SET
             target_role_id = excluded.target_role_id,
             status = excluded.status,
             steps_json = excluded.steps_json,
             evidence_json = excluded.evidence_json,
             rationale_th = excluded.rationale_th,
             rationale_en = excluded.rationale_en,
             generated_by = excluded.generated_by,
             updated_at = excluded.updated_at`
        )
        .bind(
          HERO,
          state.plan.targetRoleId,
          state.plan.status,
          JSON.stringify(state.plan.steps ?? []),
          JSON.stringify(state.evidence ?? {}),
          state.plan.summary.th,
          state.plan.summary.en,
          state.plan.generatedBy ?? "rules",
          now
        )
    );
  } else {
    stmts.push(db.prepare("DELETE FROM plans WHERE employee_id = ?").bind(HERO));
  }

  stmts.push(db.prepare("DELETE FROM approvals"));
  for (const ap of state.approvals ?? []) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO approvals (id, kind, employee_id, submitted_at, due_at, status, note, ref, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(ap.id, ap.kind, ap.employeeId, ap.submittedAt, ap.dueAt, ap.status, ap.note ?? null, ap.ref ?? null, now)
    );
  }

  stmts.push(db.prepare("DELETE FROM coach_logs WHERE employee_id = ?").bind(HERO));
  for (const [chatKey, msgs] of Object.entries(state.chats ?? {})) {
    for (const m of msgs ?? []) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO coach_logs (employee_id, chat_key, role, content, meta_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(HERO, chatKey, m.role, m.content, m.meta ? JSON.stringify(m.meta) : null, now)
      );
    }
  }

  await db.batch(stmts);
  return getDbMeta(db);
}
