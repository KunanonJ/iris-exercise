import { EMPLOYEES, directReports, employeeById } from "./skills";
import type { Approval, Level } from "./types";

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

/** Seed-only shape for the Worker/D1 sandbox bootstrap. */
interface SeedState {
  assessment: {
    status: "not_started" | "submitted" | "approved";
    self: Record<string, Level>;
    quiz: Record<string, Level>;
  };
  overrides: Record<string, Level>;
  approvals: Approval[];
}

const HERO = "E0001";
const MANAGER = "E0002";
const day = 864e5;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

function defaultSeedState(): SeedState {
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
    approvals,
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
    db.prepare("DELETE FROM integration_events"),
    db.prepare("DELETE FROM line_outbox"),
    db.prepare("DELETE FROM xapi_statements"),
    db.prepare("DELETE FROM sso_sessions"),
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
