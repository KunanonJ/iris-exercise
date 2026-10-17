-- IRIS Learning Suite suite_v2 (Postgres)
CREATE TABLE IF NOT EXISTS suite_v2_state (
  tenant_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suite_v2_memberships (
  clerk_user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee','manager','leader')),
  active SMALLINT NOT NULL DEFAULT 1,
  PRIMARY KEY (clerk_user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS suite_v2_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  action TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS suite_v2_idempotency (
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response TEXT NOT NULL,
  PRIMARY KEY (tenant_id, user_id, key)
);

CREATE TABLE IF NOT EXISTS suite_v2_quotas (
  key TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_suite_v2_memberships_user ON suite_v2_memberships (clerk_user_id) WHERE active = 1;
CREATE INDEX IF NOT EXISTS idx_suite_v2_audit_tenant ON suite_v2_audit (tenant_id, created_at DESC);
