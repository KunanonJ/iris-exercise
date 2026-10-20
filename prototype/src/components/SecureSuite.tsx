"use client";

import { ClerkProvider, SignIn, UserButton, useAuth } from "@clerk/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Principal, SuiteCommand, SuiteView } from "@/lib/suite-contracts";
import type { Lang } from "@/lib/types";
import { apiErrorMessage, assertPrincipal, consumeCoachStream, SuiteApiError } from "./secure-client";
import { EmployeeJourney, LeaderJourney, ManagerJourney, IntegrationsPanel } from "./secure-journeys";
import { RolePicker } from "./secure-roles";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, Badge, Button, Card, cx, Icon } from "./kit";

const subscribe = () => () => {};
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
type Tab = "learning" | "team" | "dashboard" | "integrations";
type PendingMutation = { path: string; body: string; key: string };

export function SecureSuite() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  useEffect(() => { localStorage.removeItem("learning-suite-demo-v2"); }, []);
  if (!mounted) return <div className="grid min-h-dvh place-items-center p-6 text-ink-2" role="status">กำลังโหลด · Loading…</div>;
  if (!publishableKey) {
    return (
      <main className="mx-auto max-w-xl p-6 pt-20">
        <Card className="gap-0 py-0">
          <CardHeader className="border-b">
            <Badge tone="warn">Setup required · ต้องตั้งค่าระบบ</Badge>
            <CardTitle className="font-display text-2xl font-bold">Learning Suite</CardTitle>
            <CardDescription>
              Sign-in is not configured for this build. Ask the programme administrator to finish the development
              authentication setup and rebuild the frontend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 py-4">
            <p className="text-sm text-ink-2" lang="th">
              ยังไม่ได้ตั้งค่าการเข้าสู่ระบบสำหรับรุ่นนี้ โปรดให้ผู้ดูแลโปรแกรมตั้งค่าระบบยืนยันตัวตนและสร้างเว็บใหม่
            </p>
            <p className="text-xs text-ink-3">Synthetic case-study data only · ข้อมูลสมมติสำหรับกรณีศึกษา</p>
          </CardContent>
        </Card>
      </main>
    );
  }
  return <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/"><SessionGate /></ClerkProvider>;
}

function SessionGate() {
  const { isLoaded, isSignedIn, userId, sessionId, getToken } = useAuth();
  if (!isLoaded) return <div className="grid min-h-dvh place-items-center" role="status">Loading secure sign-in · กำลังเตรียมการเข้าสู่ระบบ…</div>;
  if (!isSignedIn || !userId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-6 px-4 py-10">
        <Card className="w-full max-w-md gap-0 py-0 text-center">
          <CardHeader>
            <Badge tone="brand" className="mx-auto w-fit">IRIS · Learning Suite</Badge>
            <CardTitle className="font-display text-3xl font-bold">Learn. Practise. Grow.</CardTitle>
            <CardDescription className="text-balance">
              Sign in with <strong className="font-semibold text-ink">Google</strong> or your case-study email. What
              you see depends on the role given to your account.
            </CardDescription>
            <p className="text-sm text-muted-foreground" lang="th">
              เข้าสู่ระบบด้วย <strong className="font-semibold text-ink">Google</strong> หรืออีเมลกรณีศึกษา
              สิ่งที่คุณเห็นขึ้นอยู่กับบทบาทของบัญชีค่ะ
            </p>
            <p className="mb-4 rounded-xl bg-brand-soft px-3 py-2 text-xs text-ink-2">
              Reviewing the case? Sign in with Google, then choose a role. No Google account? Use a test email from
              the cover email: “Use another method”, then “Email code”, and enter 424242.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <SignIn
              routing="hash"
              // New reviewers sign up inside this card, so the hosted sign-up page (and its LINE button) never shows.
              withSignUp
              appearance={{
                elements: {
                  socialButtonsBlockButton: "border border-line bg-paper hover:bg-brand-soft",
                  // LINE Login stays enabled in Clerk but is hidden for the case submission.
                  socialButtonsBlockButton__line: { display: "none" },
                  socialButtonsIconButton__line: { display: "none" },
                  formButtonPrimary: "bg-brand hover:bg-brand/90",
                },
              }}
            />
            <p className="text-xs text-muted-foreground">
              Demo sign-in (Clerk development mode) · synthetic data only
              <br />
              ระบบเดโม · ใช้ข้อมูลสมมติเท่านั้น
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }
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
  const [rolePicker, setRolePicker] = useState<"required" | "switch">();
  const [demoRoles, setDemoRoles] = useState(false);
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
    // Demo role picker: an account without a role chooses one instead of seeing an error.
    if (failure instanceof SuiteApiError && failure.status === 428) { setRolePicker("required"); setView(undefined); setPending(undefined); return; }
    setError(failure);
    if (failure instanceof SuiteApiError && (failure.status === 401 || failure.status === 403)) { setView(undefined); setPending(undefined); }
  }, []);

  const load = useCallback(async () => {
    const session = await (await request("/api/session")).json() as { principal: Principal; demoRoles?: boolean };
    if (session.principal?.userId !== userId) throw new SuiteApiError(401);
    const next = await (await request("/api/state")).json() as SuiteView;
    assertPrincipal(session.principal, next.principal);
    return { principal: session.principal, view: next, demoRoles: session.demoRoles === true };
  }, [request, userId]);

  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    void load().then(result => { if (!controller.signal.aborted) { principal.current = result.principal; setDemoRoles(result.demoRoles); acceptView(result.view); } }).catch(failure => { if (!controller.signal.aborted) fail(failure); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); principal.current = undefined; };
  }, [load, fail, acceptView]);

  const refresh = () => { setLoading(true); setError(undefined); setPending(undefined); void load().then(result => { principal.current = result.principal; setDemoRoles(result.demoRoles); acceptView(result.view); }).catch(fail).finally(() => setLoading(false)); };

  const chooseRole = async (next: Principal["role"]) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(undefined);
    try {
      await request("/api/demo/role", { method: "POST", body: JSON.stringify({ role: next }) });
      // The account now plays a different persona, so start from a fresh session view.
      principal.current = undefined; setView(undefined); setPending(undefined); setRolePicker(undefined);
      setTab(next === "leader" ? "dashboard" : "learning");
      setLoading(true);
      const result = await load();
      principal.current = result.principal; setDemoRoles(result.demoRoles); acceptView(result.view);
    } catch (failure) { fail(failure); }
    finally { lock.current = false; setBusy(false); setLoading(false); }
  };

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
    ["integrations", th ? "การเชื่อมต่อ" : "Connections", "shield"],
  ];
  const canRetry = pending && (!error || !(error instanceof SuiteApiError) || [0, 429, 500, 502, 503, 504].includes(error.status));

  return <div className="min-h-dvh pb-12">
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3.5 sm:gap-3 sm:px-6">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white shadow-xs">IR</span><div><p className="font-display text-lg font-bold leading-tight text-brand">IRIS <span className="font-normal text-ink">Learning Suite</span></p><p className="text-xs text-ink-3">{th ? "เรียนรู้ ฝึกฝน และเติบโต" : "Learn, practise and grow"}</p></div></div>
      <div className="flex items-center gap-2.5"><Badge tone="neutral" className="hidden sm:inline-flex">{th ? "เดโม · ข้อมูลสมมติ" : "Demo · synthetic data"}</Badge>{demoRoles && view && !rolePicker && <button type="button" onClick={() => setRolePicker("switch")} disabled={busy} className="min-h-10 rounded-xl border border-line bg-surface-2 px-2.5 text-xs font-semibold transition hover:border-brand/40 cursor-pointer sm:px-3">{th ? "เปลี่ยนบทบาท" : "Switch role"}</button>}<button type="button" onClick={() => changeLanguage(th ? "en" : "th")} className="min-h-10 rounded-xl border border-line bg-surface-2 px-3 text-xs font-semibold transition hover:border-brand/40 cursor-pointer" aria-label={th ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}>{th ? "EN" : "ไทย"}</button><UserButton /></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      {!rolePicker && view && <><div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xs"><div className="flex items-center gap-3.5"><Avatar name={view.self?.employee.name[lang] ?? "IRIS"} size="lg" /><div><h1 className="text-xl font-bold">{view.self?.employee.name[lang] ?? (th ? "ภาพรวมการเรียนรู้" : "Learning overview")}</h1><p className="mt-0.5 text-xs text-ink-3">{role === "manager" ? (th ? "หัวหน้า · เห็นเฉพาะลูกทีมของคุณ" : "Manager · your direct reports only") : role === "leader" ? (th ? "HR และผู้บริหาร · ภาพรวมกลุ่มเท่านั้น ไม่มีข้อมูลรายบุคคล" : "HR and leaders · group totals only, no individual records") : (th ? "พนักงาน · ข้อมูลการเรียนของคุณเอง" : "Employee · your own learning record")}</p></div></div><Button variant="outline" disabled={busy || loading} onClick={refresh}>{th ? "อัปเดตข้อมูล" : "Refresh"}</Button></div><nav aria-label={th ? "เมนูหลัก" : "Main navigation"} className="mb-5 flex gap-2 overflow-x-auto pb-1">{tabs.map(([id, label, icon]) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={actualTab === id ? "page" : undefined} className={cx("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition cursor-pointer", actualTab === id ? "bg-brand text-white shadow-xs" : "border border-line bg-surface text-ink-2 hover:bg-surface-2")}><Icon name={icon} className="h-4 w-4 shrink-0" /><span>{label}{id === "team" && view.approvals.some(a => a.status === "pending") ? ` (${view.approvals.filter(a => a.status === "pending").length})` : ""}</span></button>)}</nav></>}
      {error != null && <div role="alert" className="mb-5 rounded-2xl border border-danger/25 bg-danger-soft p-4"><p className="text-sm text-danger">{apiErrorMessage(error, th)}</p><div className="mt-3 flex flex-wrap gap-2">{canRetry && <Button variant="outline" disabled={busy || loading} onClick={() => pending && void perform(pending)}>{th ? "ลองอีกครั้ง" : "Try again"}</Button>}<Button variant="outline" disabled={busy || loading} onClick={refresh}>{th ? "อัปเดตข้อมูล" : "Refresh"}</Button></div></div>}
      {rolePicker && <RolePicker lang={lang} current={view?.principal.role} busy={busy} onChoose={chooseRole} onCancel={rolePicker === "switch" ? () => setRolePicker(undefined) : undefined} />}
      {!rolePicker && loading && <p role="status" className="py-10 text-center text-sm text-ink-2">{th ? "กำลังโหลดข้อมูลการเรียนของคุณ…" : "Loading your learning…"}</p>}
      {!rolePicker && !loading && view && <>
        {actualTab === "learning" && view.self && <EmployeeJourney key={view.self.employee.id} record={view.self} lang={lang} busy={busy} command={command} generate={generate} coach={coach} />}
        {actualTab === "team" && role === "manager" && <ManagerJourney view={view} lang={lang} busy={busy} command={command} />}
        {actualTab === "dashboard" && role === "leader" && <LeaderJourney view={view} lang={lang} />}
        {actualTab === "integrations" && <IntegrationsPanel integrations={view.integrations} lang={lang} />}
      </>}
      {!rolePicker && !loading && !view && !error && <p role="status">{th ? "ไม่พบข้อมูลการเรียนของบัญชีนี้ โปรดติดต่อผู้ดูแลโปรแกรมเพื่อตรวจสอบสิทธิ์ค่ะ" : "We couldn't find a learning record for this account. Ask your programme admin to check your access."}</p>}
      <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">{th ? "ต้นแบบสำหรับกรณีศึกษา ใช้ข้อมูลสมมติทั้งหมด ผลประเมินทักษะใช้เพื่อการพัฒนาเท่านั้น ไม่มีผลต่อเงินเดือนหรือการเลื่อนตำแหน่ง การเชื่อมต่อ HR และ LMS เป็นระบบทดสอบ ไม่ใช่ระบบจริงของลูกค้า" : "Case-study prototype with synthetic data. Skill results are for development only and never affect pay or promotion. The HR and LMS connections are test systems, not the client's live systems."}</footer>
    </main>
  </div>;
}
