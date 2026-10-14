-- IRIS Learning Suite — Cloudflare D1 (SQLite) Relational Schema
-- Covers: employees, assessments, plans, approvals, coach_logs

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_en TEXT NOT NULL,
  role_id TEXT NOT NULL,
  next_role_id TEXT,
  bu TEXT NOT NULL,
  site_id TEXT NOT NULL,
  manager_id TEXT,
  tenure_months INTEGER NOT NULL DEFAULT 0,
  scores_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'not_started',
  self_json TEXT NOT NULL,
  quiz_json TEXT NOT NULL,
  final_json TEXT,
  overrides_json TEXT NOT NULL DEFAULT '{}',
  manager_note TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  employee_id TEXT PRIMARY KEY REFERENCES employees(id),
  target_role_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  steps_json TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  rationale_th TEXT NOT NULL,
  rationale_en TEXT NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'rules',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  submitted_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT,
  ref TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coach_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  chat_key TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_bu ON employees(bu);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_coach_logs_key ON coach_logs(employee_id, chat_key);
