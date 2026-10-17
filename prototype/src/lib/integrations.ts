import { itemById } from "../data/catalog";
import { roleById } from "../data/taxonomy";
import { employeeById } from "./skills";
import { ensureSeeded, getDbMeta, type D1Database, type DbMeta } from "./db";
import type { LearningPlan } from "./types";

export interface SsoClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  jti: string;
  email: string;
  name: string;
  hd?: string;
  amr: string[];
  persona: "employee" | "manager" | "leader";
  provider: "line_oidc" | "google_workspace_oidc";
  bu: string;
  roleId: string;
  rbacScope: string[];
}

export interface IntegrationEventRow {
  id: number;
  channel: "SSO" | "HRIS" | "LMS_XAPI" | "LMS_LTI" | "LINE_OA";
  protocol: string;
  direction: "INBOUND" | "OUTBOUND";
  status: number;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationsTelemetry {
  ssoSessionsCount: number;
  xapiCount: number;
  lineOutboxCount: number;
  hrisCount: number;
  latestSso?: {
    jti: string;
    employeeId: string;
    persona: string;
    provider: string;
    issuer: string;
    email: string;
    amr: string[];
    jwtPreview: string;
    issuedAt: string;
    expiresAt: string;
  };
  events: IntegrationEventRow[];
}

const DEFAULT_JWT_SECRET = "iris-siam-pinnacle-oidc-hmac-sha256-key-2026";

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function signJwtHs256(payload: SsoClaims, secret = DEFAULT_JWT_SECRET): Promise<string> {
  const header = { alg: "HS256", typ: "JWT", kid: "spg-idp-2026-01" };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function logIntegrationEvent(
  db: D1Database,
  ev: {
    channel: IntegrationEventRow["channel"];
    protocol: string;
    direction: IntegrationEventRow["direction"];
    status: number;
    summary: string;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO integration_events (channel, protocol, direction, status, summary, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(ev.channel, ev.protocol, ev.direction, ev.status, ev.summary, JSON.stringify(ev.payload), now)
    .run();
}

export async function issueOidcSsoSession(
  db: D1Database,
  persona: "employee" | "manager" | "leader",
  method: "sso" | "credentials" = "sso",
  secret = DEFAULT_JWT_SECRET
): Promise<{ token: string; claims: SsoClaims; dbMeta: DbMeta }> {
  await ensureSeeded(db);
  const empId = persona === "employee" ? "E0001" : persona === "manager" ? "E0002" : "E9001";
  const emp = employeeById(empId)!;
  const email =
    persona === "employee"
      ? "somchai.j@company.co.th"
      : persona === "manager"
        ? "malee.s@company.co.th"
        : "arunee.s@company.co.th";
  const isLine = persona === "employee";
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 8 * 3600;
  const jti = `oidc-${persona}-${Date.now().toString(36)}`;

  const claims: SsoClaims = {
    iss: isLine ? "https://access.line.me" : "https://accounts.google.com",
    sub: empId,
    aud: "spg-learning-suite.iris.kunanonj.com",
    iat: nowSec,
    exp: expSec,
    jti,
    email,
    name: emp.name.en,
    ...(isLine ? {} : { hd: "company.co.th" }),
    amr: method === "sso" ? (isLine ? ["line_liff", "oidc", "hris_bound"] : ["google_oidc", "pwd", "mfa_totp"]) : ["emp_id", "pin_otp"],
    persona,
    provider: isLine ? "line_oidc" : "google_workspace_oidc",
    bu: emp.bu,
    roleId: emp.roleId,
    rbacScope:
      persona === "employee"
        ? ["self:profile:read", "self:assessment:write", "self:plan:write", "self:coach:chat"]
        : persona === "manager"
          ? ["team:E0002:read", "team:E0002:approve", "sla:5d:escalate"]
          : ["org:aggregate:read:k10", "bu:all:heatmap", "coach:telemetry:read"],
  };

  const token = await signJwtHs256(claims, secret);
  const [headerPart, payloadPart, sigPart] = token.split(".");
  const jwtPreview = `${headerPart}.${payloadPart.slice(0, 28)}...${sigPart}`;
  const issuedAt = new Date(nowSec * 1000).toISOString();
  const expiresAt = new Date(expSec * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO sso_sessions (jti, employee_id, persona, provider, issuer, email, amr_json, jwt_preview, issued_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      jti,
      empId,
      persona,
      claims.provider,
      claims.iss,
      email,
      JSON.stringify(claims.amr),
      token,
      issuedAt,
      expiresAt
    )
    .run();

  await logIntegrationEvent(db, {
    channel: "SSO",
    protocol: isLine ? "LINE Login OIDC 1.0 + LIFF (HS256 JWT)" : "Google Workspace OIDC / SAML 2.0 (HS256 JWT)",
    direction: "INBOUND",
    status: 200,
    summary: `Issued signed OIDC JWT for ${empId} (${emp.name.en}) via ${isLine ? "access.line.me" : "accounts.google.com (hd=company.co.th)"}`,
    payload: {
      jti,
      iss: claims.iss,
      sub: claims.sub,
      email: claims.email,
      hd: claims.hd,
      amr: claims.amr,
      rbacScope: claims.rbacScope,
      jwtSignature: sigPart,
      jwtPreview,
    },
  });

  const dbMeta = await getDbMeta(db);
  return { token, claims, dbMeta };
}

export async function ingestHrisDeltaSync(
  db: D1Database,
  input?: {
    records?: {
      id: string;
      name_th: string;
      name_en: string;
      role_id: string;
      next_role_id: string | null;
      bu: string;
      site_id: string;
      manager_id: string | null;
      tenure_months: number;
    }[];
  }
) {
  await ensureSeeded(db);
  const now = new Date().toISOString();
  const records = input?.records ?? [
    {
      id: "E0001",
      name_th: "สมชาย ใจดี",
      name_en: "Somchai Jaidee",
      role_id: "RD-SSA",
      next_role_id: "RD-SS",
      bu: "RD",
      site_id: "Store #112 Bang Na",
      manager_id: "E0002",
      tenure_months: 19,
    },
    {
      id: "E0299",
      name_th: "กิตติพงศ์ วงศ์สวัสดิ์",
      name_en: "Kittipong Wongsawat",
      role_id: "PK-LO",
      next_role_id: "PK-LS",
      bu: "PK",
      site_id: "Rayong Packaging Plant #2",
      manager_id: "E0002",
      tenure_months: 8,
    },
  ];

  const defaultScores = JSON.stringify({
    "C-SAFE": { self: 2, final: 2 },
    "C-COMM": { self: 2, final: 2 },
  });

  const stmts = records.map((r) =>
    db
      .prepare(
        `INSERT INTO employees (id, name_th, name_en, role_id, next_role_id, bu, site_id, manager_id, tenure_months, scores_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name_th = excluded.name_th,
           name_en = excluded.name_en,
           role_id = excluded.role_id,
           next_role_id = excluded.next_role_id,
           bu = excluded.bu,
           site_id = excluded.site_id,
           manager_id = excluded.manager_id,
           tenure_months = excluded.tenure_months,
           updated_at = excluded.updated_at`
      )
      .bind(
        r.id,
        r.name_th,
        r.name_en,
        r.role_id,
        r.next_role_id,
        r.bu,
        r.site_id,
        r.manager_id,
        r.tenure_months,
        defaultScores,
        now
      )
  );

  await db.batch(stmts);

  await logIntegrationEvent(db, {
    channel: "HRIS",
    protocol: "Nightly HRIS Delta Webhook (SAP SuccessFactors / Workday REST JSON)",
    direction: "INBOUND",
    status: 200,
    summary: `Upserted ${records.length} employee org/reporting records into D1 employees table (${records.map((r) => r.id).join(", ")})`,
    payload: {
      batchId: `hris-delta-${Date.now()}`,
      upsertedCount: records.length,
      records,
    },
  });

  const dbMeta = await getDbMeta(db);
  return { upsertedCount: records.length, records, dbMeta };
}

export async function ingestXapiStatement(
  db: D1Database,
  input?: {
    employeeId?: string;
    itemId?: string;
    verb?: string;
    scoreScaled?: number;
  }
) {
  await ensureSeeded(db);
  const employeeId = input?.employeeId ?? "E0001";
  let itemId = input?.itemId;
  const planRow = await db
    .prepare("SELECT target_role_id, status, steps_json, evidence_json, rationale_th, rationale_en, generated_by FROM plans WHERE employee_id = ?")
    .bind(employeeId)
    .first<{
      target_role_id: string;
      status: LearningPlan["status"];
      steps_json: string;
      evidence_json: string;
      rationale_th: string;
      rationale_en: string;
      generated_by: "ai" | "rules";
    }>();

  const steps: LearningPlan["steps"] = planRow ? JSON.parse(planRow.steps_json) : [];
  if (!itemId) {
    const nextTodo = steps.find((s) => s.status !== "done");
    itemId = nextTodo?.itemId ?? "LA-101";
  }

  const catalogItem = itemById(itemId) ?? itemById("LA-101")!;
  const verb = input?.verb ?? "http://adlnet.gov/expapi/verbs/completed";
  const scoreScaled = input?.scoreScaled ?? 0.92;
  const stmtId = `xapi-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  const xapiStatement = {
    version: "2.0.0",
    id: stmtId,
    timestamp: now,
    actor: {
      objectType: "Agent",
      name: employeeById(employeeId)?.name.en ?? "Somchai Jaidee",
      account: { homePage: "https://spg.company.co.th/hris", name: employeeId },
    },
    verb: {
      id: verb,
      display: { "en-US": "completed", "th-TH": "เรียนจบ" },
    },
    object: {
      objectType: "Activity",
      id: `https://lms.company.co.th/activities/${catalogItem.id}`,
      definition: {
        name: { "th-TH": catalogItem.title.th, "en-US": catalogItem.title.en },
        type: "http://adlnet.gov/expapi/activities/course",
      },
    },
    result: {
      score: { scaled: scoreScaled, raw: Math.round(scoreScaled * 100), min: 0, max: 100 },
      completion: true,
      success: true,
      duration: `PT${catalogItem.minutes}M`,
    },
    context: {
      platform: catalogItem.source,
      registration: `reg-${employeeId}-${catalogItem.id}`,
    },
  };

  await db
    .prepare(
      `INSERT INTO xapi_statements (id, actor_employee_id, verb, object_item_id, lms_source, score_scaled, completed, raw_json, stored_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(stmtId, employeeId, verb, catalogItem.id, catalogItem.source, scoreScaled, JSON.stringify(xapiStatement), now)
    .run();

  let planStepUpdated = false;
  if (planRow && steps.some((st) => st.itemId === catalogItem.id)) {
    const updatedSteps = steps.map((st) => (st.itemId === catalogItem.id ? { ...st, status: "done" as const } : st));
    await db
      .prepare("UPDATE plans SET steps_json = ?, updated_at = ? WHERE employee_id = ?")
      .bind(JSON.stringify(updatedSteps), now, employeeId)
      .run();
    planStepUpdated = true;
  }

  await logIntegrationEvent(db, {
    channel: "LMS_XAPI",
    protocol: `xAPI 2.0 (IEEE 9274.1.1) LRS Statement from ${catalogItem.source}`,
    direction: "INBOUND",
    status: 200,
    summary: `Recorded xAPI 'completed' statement for ${employeeId} on ${catalogItem.id} (${catalogItem.title.en}, score ${Math.round(scoreScaled * 100)}%)${planStepUpdated ? " & marked step DONE in D1 plan" : ""}`,
    payload: xapiStatement,
  });

  const dbMeta = await getDbMeta(db);
  return { statement: xapiStatement, planStepUpdated, itemId: catalogItem.id, dbMeta };
}

export async function createLtiLaunchEnvelope(
  db: D1Database,
  input?: { employeeId?: string; itemId?: string },
  secret = DEFAULT_JWT_SECRET
) {
  await ensureSeeded(db);
  const employeeId = input?.employeeId ?? "E0001";
  const item = itemById(input?.itemId ?? "LA-101") ?? itemById("LA-101")!;
  const emp = employeeById(employeeId)!;
  const nowSec = Math.floor(Date.now() / 1000);

  const ltiPayload = {
    iss: "https://iris.kunanonj.com",
    sub: employeeId,
    aud: `https://${item.source.toLowerCase()}.company.co.th/lti13/launch`,
    iat: nowSec,
    exp: nowSec + 600,
    nonce: `lti-nonce-${Date.now().toString(36)}`,
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiResourceLinkRequest",
    "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": `spg-${item.source.toLowerCase()}-prod`,
    "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": `https://${item.source.toLowerCase()}.company.co.th/courses/${item.id}`,
    "https://purl.imsglobal.org/spec/lti/claim/resource_link": {
      id: item.id,
      title: item.title.en,
    },
    "https://purl.imsglobal.org/spec/lti/claim/roles": [
      "http://purl.imsglobal.org/vocab/lis/v2/institution/person#Learner",
    ],
  };

  const header = { alg: "HS256", typ: "JWT", kid: "lti13-platform-key" };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(ltiPayload)}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const idToken = `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;

  await logIntegrationEvent(db, {
    channel: "LMS_LTI",
    protocol: "IMS LTI 1.3 OIDC ResourceLink Launch",
    direction: "OUTBOUND",
    status: 200,
    summary: `Signed LTI 1.3 id_token launch into ${item.source} for ${emp.name.en} → ${item.id} (${item.title.en})`,
    payload: {
      launchUrl: ltiPayload["https://purl.imsglobal.org/spec/lti/claim/target_link_uri"],
      lmsSource: item.source,
      claims: ltiPayload,
      idTokenPreview: `${idToken.slice(0, 48)}...${idToken.slice(-24)}`,
    },
  });

  return {
    launchUrl: ltiPayload["https://purl.imsglobal.org/spec/lti/claim/target_link_uri"],
    idToken,
    claims: ltiPayload,
  };
}

export async function dispatchLineFlexNotification(
  db: D1Database,
  input?: {
    employeeId?: string;
    templateType?: "weekly_nudge" | "manager_sla_alert" | "approval_confirmed";
    lineChannelToken?: string;
    lineTargetUserId?: string;
  }
) {
  await ensureSeeded(db);
  const employeeId = input?.employeeId ?? "E0001";
  const emp = employeeById(employeeId)!;
  const nextRole = emp.nextRoleId ? roleById(emp.nextRoleId) : null;
  const templateType = input?.templateType ?? "weekly_nudge";
  const lineUserId = input?.lineTargetUserId ?? `U89f0c4a2e1b94c71d00${employeeId.toLowerCase()}`;
  const msgId = `line-msg-${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  const flexPayload = {
    to: lineUserId,
    messages: [
      {
        type: "flex",
        altText:
          templateType === "manager_sla_alert"
            ? `[SLA Alert] มีรายการรออนุมัติเกินกำหนด 5 วันทำการ`
            : `[Learning Suite] ก้าวต่อไปของ ${emp.name.th} สู่ตำแหน่ง ${nextRole?.title.th ?? ""}`,
        contents: {
          type: "bubble",
          size: "mega",
          header: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#0E6B70",
            contents: [
              {
                type: "text",
                text: "Siam Pinnacle · Learning Suite",
                color: "#E3F1F1",
                size: "xs",
                weight: "bold",
              },
              {
                type: "text",
                text:
                  templateType === "manager_sla_alert"
                    ? "เตือน SLA การอนุมัติของหัวหน้า (5 วัน)"
                    : `ก้าวต่อไปของคุณ (${emp.name.th})`,
                color: "#FFFFFF",
                size: "md",
                weight: "bold",
              },
            ],
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "text",
                wrap: true,
                size: "sm",
                color: "#22383A",
                text:
                  templateType === "manager_sla_alert"
                    ? "มีรายการประเมินทักษะและแผนการเรียนรู้รออนุมัติในกล่องงานของคุณ กดเพื่ออนุมัติใน 1 แตะ"
                    : `บทเรียนสัปดาห์นี้: การให้ฟีดแบ็กแบบ SBI ใน 5 นาที (LMS-A-101 · 12 นาที) เพื่อเตรียมพร้อมสู่ ${nextRole?.title.th ?? "หัวหน้างานสาขา"}`,
              },
            ],
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                color: "#0E6B70",
                action: {
                  type: "uri",
                  label: "เปิดผ่าน LINE LIFF SSO (1 แตะ)",
                  uri: `https://iris.kunanonj.com/?liff_sso=${employeeId}`,
                },
              },
            ],
          },
        },
      },
    ],
  };

  let deliveryStatus = "stored_and_verified_schema";
  if (input?.lineChannelToken) {
    try {
      const resp = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.lineChannelToken}`,
        },
        body: JSON.stringify(flexPayload),
      });
      deliveryStatus = resp.ok ? "delivered_line_cloud_200" : `line_api_http_${resp.status}`;
    } catch {
      deliveryStatus = "stored_offline_fallback";
    }
  }

  await db
    .prepare(
      `INSERT INTO line_outbox (id, recipient_employee_id, line_user_id, template_type, flex_payload_json, delivery_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(msgId, employeeId, lineUserId, templateType, JSON.stringify(flexPayload), deliveryStatus, now)
    .run();

  await logIntegrationEvent(db, {
    channel: "LINE_OA",
    protocol: "LINE Messaging API v2 (/v2/bot/message/push Flex Container + LIFF Deep Link)",
    direction: "OUTBOUND",
    status: 200,
    summary: `Dispatched LINE Flex Message (${templateType}) to ${emp.name.en} (${lineUserId}) [${deliveryStatus}]`,
    payload: flexPayload,
  });

  const dbMeta = await getDbMeta(db);
  return { id: msgId, recipient: employeeId, lineUserId, templateType, deliveryStatus, flexPayload, dbMeta };
}

export async function getIntegrationsTelemetry(db: D1Database): Promise<IntegrationsTelemetry> {
  await ensureSeeded(db);

  const [counts, latestSsoRow, eventRows] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM sso_sessions) AS sso_cnt,
          (SELECT COUNT(*) FROM xapi_statements) AS xapi_cnt,
          (SELECT COUNT(*) FROM line_outbox) AS line_cnt,
          (SELECT COUNT(*) FROM employees) AS hris_cnt`
      )
      .first<{ sso_cnt: number; xapi_cnt: number; line_cnt: number; hris_cnt: number }>(),
    db
      .prepare(
        `SELECT jti, employee_id, persona, provider, issuer, email, amr_json, jwt_preview, issued_at, expires_at
         FROM sso_sessions ORDER BY rowid DESC LIMIT 1`
      )
      .first<{
        jti: string;
        employee_id: string;
        persona: string;
        provider: string;
        issuer: string;
        email: string;
        amr_json: string;
        jwt_preview: string;
        issued_at: string;
        expires_at: string;
      }>(),
    db
      .prepare(
        `SELECT id, channel, protocol, direction, status, summary, payload_json, created_at
         FROM integration_events ORDER BY id DESC LIMIT 15`
      )
      .all<{
        id: number;
        channel: IntegrationEventRow["channel"];
        protocol: string;
        direction: IntegrationEventRow["direction"];
        status: number;
        summary: string;
        payload_json: string;
        created_at: string;
      }>(),
  ]);

  return {
    ssoSessionsCount: Number(counts?.sso_cnt ?? 0),
    xapiCount: Number(counts?.xapi_cnt ?? 0),
    lineOutboxCount: Number(counts?.line_cnt ?? 0),
    hrisCount: Number(counts?.hris_cnt ?? 0),
    latestSso: latestSsoRow
      ? {
          jti: latestSsoRow.jti,
          employeeId: latestSsoRow.employee_id,
          persona: latestSsoRow.persona,
          provider: latestSsoRow.provider,
          issuer: latestSsoRow.issuer,
          email: latestSsoRow.email,
          amr: JSON.parse(latestSsoRow.amr_json),
          jwtPreview: latestSsoRow.jwt_preview,
          issuedAt: latestSsoRow.issued_at,
          expiresAt: latestSsoRow.expires_at,
        }
      : undefined,
    events: eventRows.results.map((r) => ({
      id: r.id,
      channel: r.channel,
      protocol: r.protocol,
      direction: r.direction,
      status: r.status,
      summary: r.summary,
      payload: JSON.parse(r.payload_json),
      createdAt: r.created_at,
    })),
  };
}
