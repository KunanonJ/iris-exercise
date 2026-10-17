CREATE OR REPLACE FUNCTION suite_v2_commit_tenant(
  p_tenant_id text,
  p_user_id text,
  p_employee_id text,
  p_expected_revision integer,
  p_payload text,
  p_key text,
  p_fingerprint text,
  p_action text,
  p_response text,
  p_audit_id text,
  p_created_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  updated integer;
BEGIN
  UPDATE suite_v2_state
  SET revision = revision + 1, payload = p_payload
  WHERE tenant_id = p_tenant_id AND revision = p_expected_revision;
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 1 THEN
    RETURN false;
  END IF;
  INSERT INTO suite_v2_audit(id, tenant_id, user_id, employee_id, action, revision, created_at)
  VALUES (p_audit_id, p_tenant_id, p_user_id, p_employee_id, p_action, p_expected_revision + 1, p_created_at);
  INSERT INTO suite_v2_idempotency(tenant_id, user_id, key, fingerprint, response)
  VALUES (p_tenant_id, p_user_id, p_key, p_fingerprint, p_response);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION suite_v2_reserve_quota(
  p_key text,
  p_day text,
  p_cost integer,
  p_limit integer
) RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_used integer;
BEGIN
  INSERT INTO suite_v2_quotas(key, day, used)
  VALUES (p_key, p_day, p_cost)
  ON CONFLICT (key) DO UPDATE
  SET day = EXCLUDED.day,
      used = CASE
        WHEN suite_v2_quotas.day = EXCLUDED.day THEN suite_v2_quotas.used + EXCLUDED.used
        ELSE EXCLUDED.used
      END
  WHERE suite_v2_quotas.day <> EXCLUDED.day
     OR suite_v2_quotas.used + EXCLUDED.used <= p_limit
  RETURNING used INTO new_used;
  RETURN new_used;
END;
$$;
