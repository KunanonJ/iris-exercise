-- IRIS Learning Suite — Cloudflare D1 (SQLite) Relational Schema
-- Covers: employees, assessments, plans, approvals, coach_logs,
--         sso_sessions, xapi_statements, line_outbox, integration_events

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

CREATE TABLE IF NOT EXISTS sso_sessions (
  jti TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  persona TEXT NOT NULL,
  provider TEXT NOT NULL,
  issuer TEXT NOT NULL,
  email TEXT NOT NULL,
  amr_json TEXT NOT NULL,
  jwt_preview TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS xapi_statements (
  id TEXT PRIMARY KEY,
  actor_employee_id TEXT NOT NULL,
  verb TEXT NOT NULL,
  object_item_id TEXT NOT NULL,
  lms_source TEXT NOT NULL,
  score_scaled REAL,
  completed INTEGER NOT NULL DEFAULT 1,
  raw_json TEXT NOT NULL,
  stored_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS line_outbox (
  id TEXT PRIMARY KEY,
  recipient_employee_id TEXT NOT NULL,
  line_user_id TEXT NOT NULL,
  template_type TEXT NOT NULL,
  flex_payload_json TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integration_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL,
  protocol TEXT NOT NULL,
  direction TEXT NOT NULL,
  status INTEGER NOT NULL,
  summary TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_bu ON employees(bu);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_coach_logs_key ON coach_logs(employee_id, chat_key);
CREATE INDEX IF NOT EXISTS idx_integration_events_created ON integration_events(created_at DESC);
