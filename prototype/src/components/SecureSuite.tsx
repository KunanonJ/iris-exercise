"use client";

import { ClerkProvider, SignIn, UserButton, useAuth } from "@clerk/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Principal, SuiteCommand, SuiteView } from "@/lib/suite-contracts";
import type { Lang } from "@/lib/types";
import { apiErrorMessage, assertPrincipal, consumeCoachStream, SuiteApiError } from "./secure-client";
import { EmployeeJourney, LeaderJourney, ManagerJourney, IntegrationsPanel } from "./secure-journeys";
import { Avatar, Badge, Button, Card, cx, Icon } from "./ui";

const subscribe = () => () => {};
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
type Tab = "learning" | "team" | "dashboard" | "integrations";
type PendingMutation = { path: string; body: string; key: string };

export function SecureSuite() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  useEffect(() => { localStorage.removeItem("learning-suite-demo-v2"); }, []);
  if (!mounted) return <div className="grid min-h-dvh place-items-center p-6 text-ink-2" role="status">Learning Suite…</div>;
  if (!publishableKey) return <main className="mx-auto max-w-xl p-6 pt-20"><Card>
    <Badge tone="warn">Setup required · ต้องตั้งค่าระบบ</Badge>
    <h1 className="mt-4 text-2xl font-bold">Learning Suite</h1>
    <p className="mt-3 text-sm text-ink-2">Sign-in is not configured for this build. Ask the programme administrator to finish the development authentication setup and rebuild the frontend.</p>
    <p className="mt-3 text-sm text-ink-2" lang="th">ยังไม่ได้ตั้งค่าการเข้าสู่ระบบสำหรับรุ่นนี้ โปรดให้ผู้ดูแลโปรแกรมตั้งค่าระบบยืนยันตัวตนและสร้างเว็บใหม่</p>
    <p className="mt-4 text-xs text-ink-3">Synthetic case-study data only · ข้อมูลสมมติสำหรับกรณีศึกษา</p>
  </Card></main>;
  return <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/"><SessionGate /></ClerkProvider>;
}

function SessionGate() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  if (!isLoaded) return <div className="grid min-h-dvh place-items-center" role="status">Loading secure sign-in · กำลังเตรียมการเข้าสู่ระบบ…</div>;
  if (!isSignedIn || !userId) return <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-6 px-4 py-10">
    <div className="max-w-md text-center">
      <Badge tone="brand">IRIS · Learning Suite</Badge>
      <h1 className="mt-4 text-3xl font-bold">Learn. Practise. Grow.</h1>
      <p className="mt-3 text-sm text-ink-2">
        Sign in with <strong className="font-semibold text-ink">Google</strong> or <strong className="font-semibold text-ink">LINE</strong> (Clerk social SSO), or your assigned case-study email. Access still comes from the administrator membership map — not from the identity provider.
      </p>
      <p className="mt-2 text-sm text-ink-2" lang="th">
        เข้าสู่ระบบด้วย <strong className="font-semibold text-ink">Google</strong> หรือ <strong className="font-semibold text-ink">LINE</strong> (SSO ผ่าน Clerk) หรืออีเมลกรณีศึกษา สิทธิ์ยังมาจากรายการสมาชิกที่ผู้ดูแลกำหนด ไม่ใช่จากผู้ให้บริการตัวตน
      </p>
    </div>
    <SignIn
      routing="hash"
      appearance={{
        elements: {
          socialButtonsBlockButton: "border border-line bg-paper hover:bg-brand-soft",
          formButtonPrimary: "bg-brand hover:bg-brand/90",
        },
      }}
    />
    <p className="max-w-md text-center text-xs text-ink-3">
      Development SSO uses Clerk-shared Google/LINE credentials. Production needs your own OAuth clients.
      <br />
      Synthetic learning data. No client HR or LMS production connection.
      <br />
      ข้อมูลการเรียนสมมติ ไม่มีการเชื่อมต่อ HR หรือ LMS ของลูกค้าจริง
    </p>
  </main>;
  return <SessionSuite key={`${sessionId}:${userId}`} userId={userId} getToken={getToken} />;
}

function SessionSuite({ userId, getToken }: { userId: string; getToken: () => Promise<string | null> }) {
  const [lang, setLang] = useState<Lang>(() => localStorage.getItem("iris-language") === "en" ? "en" : "th");
  const [view, setView] = useState<SuiteView>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [tab, setTab] = useState<Tab>("learning");
  const [pending, setPending] = useState<PendingMutation>();
  const principal = useRef<Principal | undefined>(undefined);
  const lifetime = useRef<AbortController | undefined>(undefined);
  const lock = useRef(false);
  const th = lang === "th";

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const changeLanguage = (next: Lang) => { setLang(next); localStorage.setItem("iris-language", next); };

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const signal = lifetime.current?.signal;
    const token = await getToken();
    if (signal?.aborted) throw new DOMException("Request aborted", "AbortError");
    if (!token) throw new SuiteApiError(401);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers, cache: "no-store", signal });
    if (!response.ok) throw new SuiteApiError(response.status);
    return response;
  }, [getToken]);

  const acceptView = useCallback((next: SuiteView) => {
    if (!principal.current) throw new SuiteApiError(401);
    assertPrincipal(principal.current, next.principal);
    if (!Array.isArray(next.approvals) || !Array.isArray(next.integrations) || !Number.isInteger(next.revision)) throw new SuiteApiError(503);
    setView(next);
  }, []);

  const refreshState = useCallback(async () => {
    const next = await (await request("/api/state")).json() as SuiteView;
    acceptView(next);
  }, [request, acceptView]);

  const fail = useCallback((failure: unknown) => {
    setError(failure);
    if (failure instanceof SuiteApiError && (failure.status === 401 || failure.status === 403)) { setView(undefined); setPending(undefined); }
  }, []);

  const load = useCallback(async () => {
    const session = await (await request("/api/session")).json() as { principal: Principal };
    if (session.principal?.userId !== userId) throw new SuiteApiError(401);
    const next = await (await request("/api/state")).json() as SuiteView;
    assertPrincipal(session.principal, next.principal);
    return { principal: session.principal, view: next };
  }, [request, userId]);

  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    void load().then(result => { if (!controller.signal.aborted) { principal.current = result.principal; acceptView(result.view); } }).catch(failure => { if (!controller.signal.aborted) fail(failure); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); principal.current = undefined; };
  }, [load, fail, acceptView]);

  const refresh = () => { setLoading(true); setError(undefined); setPending(undefined); void load().then(result => { principal.current = result.principal; acceptView(result.view); }).catch(fail).finally(() => setLoading(false)); };

  const perform = async (mutation: PendingMutation) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined); setPending(mutation);
    try {
      acceptView(await (await request(mutation.path, { method: "POST", headers: { "Idempotency-Key": mutation.key }, body: mutation.body })).json() as SuiteView);
      setPending(undefined);
    } catch (failure) { fail(failure); }
    finally { lock.current = false; setBusy(false); }
  };
  const command = async (command: SuiteCommand) => {
    if (!view) return;
    await perform({ path: "/api/commands", body: JSON.stringify({ expectedRevision: view.revision, command }), key: crypto.randomUUID() });
  };
  const generate = async () => {
    if (!view) return;
    await perform({ path: "/api/path", body: JSON.stringify({ expectedRevision: view.revision }), key: crypto.randomUUID() });
  };
  const coach = async (message: string, lessonId: string | undefined, onText: (text: string) => void) => {
    if (lock.current) throw new SuiteApiError(409);
    lock.current = true; setBusy(true);
    try {
      const response = await request("/api/coach", { method: "POST", body: JSON.stringify({ message, ...(lessonId ? { lessonId } : {}) }) });
      if (!response.body) throw new SuiteApiError(503);
      const meta = await consumeCoachStream(response.body, onText);
      await refreshState();
      return meta;
    } catch (failure) { fail(failure); throw failure; }
    finally { lock.current = false; setBusy(false); }
  };

  const role = view?.principal.role;
  const actualTab = tab === "team" && role !== "manager" ? "learning" : tab === "dashboard" && role !== "leader" ? "learning" : role === "leader" && tab === "learning" ? "dashboard" : tab;
  const tabs: [Tab, string, "home" | "team" | "skills" | "shield"][] = [
    ...(role === "leader" ? [["dashboard", th ? "ภาพรวมองค์กร" : "Organisation", "skills"] as [Tab, string, "skills"]] : [["learning", th ? "การเรียนของฉัน" : "My learning", "home"] as [Tab, string, "home"]]),
    ...(role === "manager" ? [["team", th ? "ทีมและการอนุมัติ" : "Team & approvals", "team"] as [Tab, string, "team"]] : []),
    ["integrations", th ? "สถานะการเชื่อมต่อ" : "Connections", "shield"],
  ];
  const canRetry = pending && (!error || !(error instanceof SuiteApiError) || [0, 429, 500, 502, 503, 504].includes(error.status));

  return <div className="min-h-dvh pb-12">
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white shadow-xs">IR</span><div><p className="font-display text-lg font-bold leading-tight text-brand">IRIS <span className="font-normal text-ink">Learning Suite</span></p><p className="text-xs text-ink-3">{th ? "เรียนรู้ ฝึกฝน และเติบโต" : "Learn, practise and grow"}</p></div></div>
      <div className="flex items-center gap-2.5"><Badge tone="neutral">{th ? "ข้อมูลสมมติ · Sandbox" : "Synthetic data · Sandbox"}</Badge><button type="button" onClick={() => changeLanguage(th ? "en" : "th")} className="min-h-10 rounded-xl border border-line bg-surface-2 px-3 text-xs font-semibold transition hover:border-brand/40 cursor-pointer" aria-label={th ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}>{th ? "EN" : "ไทย"}</button><UserButton /></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      {view && <><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xs"><div className="flex items-center gap-3.5"><Avatar name={view.self?.employee.name[lang] ?? "IRIS"} size="lg" /><div><h1 className="text-xl font-bold">{view.self?.employee.name[lang] ?? (th ? "ภาพรวมการเรียนรู้" : "Learning overview")}</h1><p className="mt-0.5 text-xs text-ink-3">{role === "manager" ? (th ? "หัวหน้างาน · เข้าถึงเฉพาะทีมที่รับผิดชอบ" : "Manager · current direct reports only") : role === "leader" ? (th ? "HR / ผู้บริหาร · ข้อมูลสรุปที่ปกป้องความเป็นส่วนตัว" : "HR / leadership · privacy-protected aggregates") : (th ? "พนักงาน · ข้อมูลการเรียนของคุณเท่านั้น" : "Employee · your learning record only")}</p></div></div><Button variant="outline" disabled={busy || loading} onClick={refresh}>{th ? "โหลดข้อมูลล่าสุด" : "Refresh latest"}</Button></div><nav aria-label={th ? "เมนูหลัก" : "Main navigation"} className="mb-5 flex gap-2 overflow-x-auto pb-1">{tabs.map(([id, label, icon]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={actualTab === id ? "page" : undefined} className={cx("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition cursor-pointer", actualTab === id ? "bg-brand text-white shadow-xs" : "border border-line bg-surface text-ink-2 hover:bg-surface-2")}><Icon name={icon} className="h-4 w-4 shrink-0" /><span>{label}{id === "team" && view.approvals.some(a => a.status === "pending") ? ` (${view.approvals.filter(a => a.status === "pending").length})` : ""}</span></button>)}</nav></>}
      {error != null && <div role="alert" className="mb-5 rounded-2xl border border-danger/25 bg-danger-soft p-4"><p className="text-sm text-danger">{apiErrorMessage(error, th)}</p><div className="mt-3 flex flex-wrap gap-2">{canRetry && <Button variant="outline" disabled={busy || loading} onClick={() => pending && void perform(pending)}>{th ? "ลองคำสั่งเดิมอีกครั้ง" : "Retry same request"}</Button>}<Button variant="outline" disabled={busy || loading} onClick={refresh}>{th ? "โหลดข้อมูลล่าสุด" : "Refresh latest"}</Button></div></div>}
      {loading && <p role="status" className="py-10 text-center text-sm text-ink-2">{th ? "กำลังโหลดข้อมูลที่คุณมีสิทธิ์เข้าถึง…" : "Loading your permitted learning records…"}</p>}
      {!loading && view && <>
        {actualTab === "learning" && view.self && <EmployeeJourney key={view.self.employee.id} record={view.self} lang={lang} busy={busy} command={command} generate={generate} coach={coach} />}
        {actualTab === "team" && role === "manager" && <ManagerJourney view={view} lang={lang} busy={busy} command={command} />}
        {actualTab === "dashboard" && role === "leader" && <LeaderJourney view={view} lang={lang} />}
        {actualTab === "integrations" && <IntegrationsPanel integrations={view.integrations} lang={lang} />}
      </>}
      {!loading && !view && !error && <p role="status">{th ? "ไม่พบข้อมูลการเรียนสำหรับบัญชีนี้" : "No learning record is available for this account."}</p>}
      <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{th ? "ต้นแบบสำหรับกรณีศึกษา ใช้ข้อมูลสมมติทั้งหมด ความคืบหน้าทักษะเป็นข้อมูลการพัฒนา ไม่ใช่การตัดสินใจเรื่องเงินเดือนหรือเลื่อนตำแหน่ง การเชื่อมต่อ Sandbox ไม่ได้ยืนยันการเชื่อมต่อระบบของลูกค้าจริง" : "Case-study prototype using synthetic data. Skill progress supports development; it does not determine pay or promotion. Sandbox connection proof does not establish connectivity to client production systems."}</footer>
    </main>
  </div>;
}
