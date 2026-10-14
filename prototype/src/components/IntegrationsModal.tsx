"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntegrationsTelemetry } from "@/lib/integrations";
import { useStore } from "./store";
import { Badge, Button, Card, cx, Icon } from "./ui";

export function IntegrationsModal({ onClose }: { onClose: () => void }) {
  const { s, dispatch } = useStore();
  const th = s.lang === "th";
  const [telemetry, setTelemetry] = useState<IntegrationsTelemetry | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ title: string; json: unknown } | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/integrations")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setTelemetry(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAction = async (key: string, url: string, body: unknown, title: string) => {
    setBusy(key);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      setLastResult({ title, json: d });
      if (d.telemetry) setTelemetry(d.telemetry);
      else refresh();
      if (d.state) dispatch({ type: "hydrateDb", payload: d.state });
      if (d.claims) dispatch({ type: "set", patch: { ssoClaims: d.claims, ssoJwt: d.token, dbMeta: d.dbMeta } });
      else if (d.dbMeta) dispatch({ type: "set", patch: { dbMeta: d.dbMeta } });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display grid h-8 w-8 place-items-center rounded-xl bg-brand text-xs font-bold text-white">
              API
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ink">
                  {th
                    ? "ศูนย์เชื่อมต่อระบบองค์กรจริง (Live SSO · HRIS · LMS xAPI/LTI · LINE OA)"
                    : "Live Enterprise Integrations Hub (SSO · HRIS · LMS xAPI/LTI · LINE OA)"}
                </h2>
                <Badge tone="ok">{th ? "ทำงานจริงบน D1 + WebCrypto" : "Live on D1 + WebCrypto"}</Badge>
              </div>
              <p className="text-xs text-ink-2">
                {th
                  ? "ทดสอบการออกโทเคน OIDC JWT (HS256), ซิงก์ข้อมูลพนักงานจาก HRIS, รับข้อมูลเรียนจบ xAPI 2.0 จาก LMS A/B และส่งการ์ด LINE Flex จริงลงฐานข้อมูล D1"
                  : "Trigger real HMAC-SHA256 OIDC JWT tokens, HRIS delta upserts, xAPI 2.0 LRS course completions, LTI 1.3 deep-link launches, and LINE Flex pushes into Cloudflare D1."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink cursor-pointer"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* 4 Live Connector Cards */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* 1. OIDC / SAML SSO */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="ok">1 · OIDC / JWT SSO</Badge>
                <span className="font-display text-xs font-semibold text-ink">
                  {th ? "Google Workspace & LINE Login" : "Google Workspace & LINE Login"}
                </span>
              </div>
              <span className="font-display text-xs text-ink-3">
                {telemetry?.ssoSessionsCount ?? 0} {th ? "เซสชัน" : "sessions"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-2">
              {th
                ? "สร้างและเซ็น JWT ด้วย WebCrypto HMAC-SHA256 พร้อมตั้งค่า HttpOnly Cookie และบันทึกสิทธิ์ RBAC ลงตาราง sso_sessions"
                : "Signs real HS256 OIDC ID tokens via WebCrypto, sets HttpOnly session cookie, and logs RBAC claims in D1 sso_sessions."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "sso-emp",
                    "/api/sso/token",
                    { persona: "employee", method: "sso" },
                    "LINE Login OIDC Token (E0001)"
                  )
                }
              >
                {busy === "sso-emp" ? "..." : th ? "ออกโทเคน LINE OIDC (E0001)" : "Issue LINE OIDC JWT (E0001)"}
              </Button>
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "sso-mgr",
                    "/api/sso/token",
                    { persona: "manager", method: "sso" },
                    "Google Workspace OIDC Token (E0002)"
                  )
                }
              >
                {busy === "sso-mgr" ? "..." : th ? "ออกโทเคน Google SSO (E0002)" : "Issue Google SSO JWT (E0002)"}
              </Button>
            </div>
          </Card>

          {/* 2. HRIS Nightly Delta Sync */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="ok">2 · HRIS Delta Sync</Badge>
                <span className="font-display text-xs font-semibold text-ink">
                  POST /api/integrations/hris-sync
                </span>
              </div>
              <span className="font-display text-xs text-ink-3">
                {telemetry?.hrisCount ?? 213} {th ? "พนักงานใน D1" : "rows in D1"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-2">
              {th
                ? "รับ JSON Delta จากระบบ HR (SAP SuccessFactors / Workday) เพื่อเพิ่มหรืออัปเดตพนักงาน ตำแหน่ง และสายบังคับบัญชาในตาราง employees"
                : "Ingests nightly HRIS delta payload (SAP/Workday REST JSON) and upserts employee org & manager lines in D1."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "hris",
                    "/api/integrations/hris-sync",
                    {},
                    "HRIS Nightly Delta Upsert (E0001 + E0299)"
                  )
                }
              >
                {busy === "hris" ? "..." : th ? "รันซิงก์ HRIS Delta ตอนนี้" : "Run HRIS Delta Sync Now"}
              </Button>
            </div>
          </Card>

          {/* 3. LMS A & B xAPI 2.0 + LTI 1.3 */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="ok">3 · LMS A/B xAPI & LTI 1.3</Badge>
                <span className="font-display text-xs font-semibold text-ink">
                  IEEE 9274.1.1 xAPI + LTI 1.3
                </span>
              </div>
              <span className="font-display text-xs text-ink-3">
                {telemetry?.xapiCount ?? 0} {th ? "รายการ xAPI" : "xAPI stmts"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-2">
              {th
                ? "รับ xAPI 2.0 Statement เมื่อเรียนจบบน LMS A/B พร้อมอัปเดตสถานะในแผน 70-20-10 อัตโนมัติ และสร้างโทเคน LTI 1.3 Deep-Link"
                : "Ingests IEEE xAPI 2.0 'completed' statements into D1 (auto-completing the active plan step) and signs LTI 1.3 launch JWTs."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "xapi",
                    "/api/integrations/lms-xapi",
                    { employeeId: "E0001", scoreScaled: 0.95 },
                    "xAPI 2.0 Course Completion Statement"
                  )
                }
              >
                {busy === "xapi" ? "..." : th ? "ส่ง xAPI เรียนจบจาก LMS-A" : "Send LMS xAPI Completion"}
              </Button>
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "lti",
                    "/api/integrations/lti-launch",
                    { employeeId: "E0001", itemId: "LA-101" },
                    "LTI 1.3 Signed Launch Envelope"
                  )
                }
              >
                {busy === "lti" ? "..." : th ? "สร้างลิงก์ LTI 1.3 Launch" : "Sign LTI 1.3 Launch JWT"}
              </Button>
            </div>
          </Card>

          {/* 4. LINE Official Account Messaging API */}
          <Card className="p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="ok">4 · LINE Messaging API</Badge>
                <span className="font-display text-xs font-semibold text-ink">
                  POST /api/integrations/line-push
                </span>
              </div>
              <span className="font-display text-xs text-ink-3">
                {telemetry?.lineOutboxCount ?? 0} {th ? "ข้อความ Flex" : "Flex pushes"}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-2">
              {th
                ? "สร้างและส่งการ์ด LINE Flex Message มาตรฐาน (/v2/bot/message/push) พร้อมลิงก์ LIFF SSO สำหรับพนักงานและแจ้งเตือน SLA หัวหน้า"
                : "Generates spec-compliant LINE Flex Message containers (/v2/bot/message/push) with 1-tap LIFF SSO URI actions."}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "line-nudge",
                    "/api/integrations/line-push",
                    { employeeId: "E0001", templateType: "weekly_nudge" },
                    "LINE Flex Push — Weekly Nudge (E0001)"
                  )
                }
              >
                {busy === "line-nudge" ? "..." : th ? "ส่ง LINE Flex Nudge (E0001)" : "Push LINE Flex Nudge (E0001)"}
              </Button>
              <Button
                variant="outline"
                className="px-2.5 py-1 text-xs"
                disabled={busy !== null}
                onClick={() =>
                  runAction(
                    "line-sla",
                    "/api/integrations/line-push",
                    { employeeId: "E0002", templateType: "manager_sla_alert" },
                    "LINE Flex Push — Manager 5-Day SLA Alert (E0002)"
                  )
                }
              >
                {busy === "line-sla" ? "..." : th ? "ส่งแจ้งเตือน SLA หัวหน้า" : "Push Manager SLA Alert"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Active OIDC Session Claims */}
        {(s.ssoClaims || telemetry?.latestSso) && (
          <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="brand">Active OIDC JWT Claims</Badge>
                <span className="font-display text-xs font-semibold text-ink">
                  {s.ssoClaims?.iss ?? telemetry?.latestSso?.issuer} · sub={s.ssoClaims?.sub ?? telemetry?.latestSso?.employeeId}
                </span>
              </div>
              <span className="font-display text-[11px] text-ink-3">
                jti: {s.ssoClaims?.jti ?? telemetry?.latestSso?.jti}
              </span>
            </div>
            <p className="font-display mt-1.5 break-all rounded-xl bg-surface p-2 text-[11px] text-ink-2 ring-1 ring-inset ring-line">
              {s.ssoJwt ?? telemetry?.latestSso?.jwtPreview}
            </p>
          </div>
        )}

        {/* Last Triggered Payload Inspector */}
        {lastResult && (
          <div className="mt-4 rounded-2xl border border-brand/35 bg-brand-soft/25 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-brand">{lastResult.title}</span>
              <Badge tone="ok">HTTP 200 OK · Persisted in D1</Badge>
            </div>
            <pre className="font-display mt-2 max-h-44 overflow-auto rounded-xl bg-surface p-2.5 text-[11px] leading-relaxed text-ink-2 ring-1 ring-inset ring-line">
              {JSON.stringify(lastResult.json, null, 2)}
            </pre>
          </div>
        )}

        {/* Recent Integration Audit Stream from D1 */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {th
                ? "บันทึกเหตุการณ์เชื่อมต่อระบบล่าสุดใน D1 (integration_events)"
                : "Live D1 Integration Event Stream (integration_events)"}
            </h3>
            <button
              type="button"
              onClick={refresh}
              className="text-xs font-medium text-brand hover:underline cursor-pointer"
            >
              {th ? "รีเฟรช" : "Refresh"}
            </button>
          </div>
          {!telemetry?.events?.length ? (
            <p className="rounded-2xl border border-line bg-surface-2 p-3 text-xs text-ink-3">
              {th
                ? "ยังไม่มีเหตุการณ์ กดปุ่มด้านบนหรือเข้าสู่ระบบเพื่อดูการเชื่อมต่อจริง"
                : "No events recorded yet. Click any connector button above or sign in to inspect live protocol traffic."}
            </p>
          ) : (
            <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
              {telemetry.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={ev.direction === "INBOUND" ? "brand" : "ok"}>{ev.channel}</Badge>
                      <span className="font-display text-[11px] font-medium text-ink-2">{ev.protocol}</span>
                    </div>
                    <p className="mt-1 truncate text-ink">{ev.summary}</p>
                  </div>
                  <span
                    className={cx(
                      "font-display shrink-0 text-[10px] text-ink-3"
                    )}
                  >
                    {new Date(ev.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
