"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { employeeById } from "@/lib/skills";
import { EmployeeApp } from "./Employee";
import { tr } from "./i18n";
import { LeaderDashboard } from "./Leader";
import { ROLE_ACCOUNTS, RoleLoginScreen } from "./Login";
import { ManagerApp } from "./Manager";
import { MANAGER, StoreProvider, useStore } from "./store";
import { Avatar, Badge, Button, cx, Icon } from "./ui";

function About({ onClose }: { onClose: () => void }) {
  const { s, dispatch } = useStore();
  const th = s.lang === "th";
  const rows: [string, string, string][] = th
    ? [
        [
          "ทำงานจริง",
          "แยกพอร์ทัลเข้าสู่ระบบ 3 บทบาท (RBAC)",
          "พนักงาน (E0001 · LINE SSO), หัวหน้างาน (E0002 · Corp SSO) และ HR/ผู้บริหาร (E9001 · Entra ID) แยกเซสชันและสิทธิ์ข้อมูลตาม PDPA",
        ],
        [
          "ทำงานจริง",
          "AI สร้างเส้นทางการเรียนรู้",
          "ระบบกฎคัดรายการจากคลัง แล้วโมเดล AI จัดลำดับและเขียนเหตุผล ตรวจสอบรหัสรายการทุกครั้ง",
        ],
        [
          "ทำงานจริง",
          "โค้ช AI ภาษาไทย/อังกฤษ",
          "ค้นเนื้อหาด้วยการตัดคำภาษาไทย (BM25) ตอบพร้อมอ้างอิง สตรีมคำตอบ",
        ],
        [
          "ทำงานจริง",
          "ระบบป้องกัน 2 ชั้น",
          "กฎแบบกำหนดแน่นอน + ตัวจำแนกด้วย AI ปิดบังข้อมูลส่วนบุคคลก่อนส่งให้ AI",
        ],
        [
          "ทำงานจริง",
          "ฐานข้อมูล Cloudflare D1 (SQLite)",
          "จัดเก็บ 5 ตารางจริง (employees, assessments, plans, approvals, coach_logs) บน Cloudflare D1 และซิงก์ข้ามบทบาท",
        ],
        [
          "ทำงานจริง",
          "การอนุมัติของหัวหน้า",
          "ผลประเมิน แผน และโปรเจกต์ พร้อม SLA และการส่งต่อ",
        ],
        [
          "จำลอง",
          "HR, LMS, SSO, LINE",
          "ระบบ HR ต้นทางและ SSO ภายนอกจำลองผ่านข้อมูล Seed ในฐานข้อมูล D1",
        ],
      ]
    : [
        [
          "Real",
          "Role-separated login portals (RBAC)",
          "Employee (E0001 · LINE SSO), Manager (E0002 · Corp SSO), and HR & Leaders (E9001 · Entra ID) authenticate into isolated PDPA-scoped sessions",
        ],
        [
          "Real",
          "AI learning path",
          "Rules engine shortlists approved items; the AI model sequences them and writes the rationale; every item id is validated",
        ],
        [
          "Real",
          "Thai/English AI coach",
          "Thai-aware retrieval (word segmentation + BM25), cited answers, streamed",
        ],
        [
          "Real",
          "Two-layer guardrails",
          "Deterministic rules + AI intent classifier; personal data masked before any model call",
        ],
        [
          "Real",
          "Cloudflare D1 (SQLite) database",
          "Persists 5 relational tables (employees, assessments, plans, approvals, coach_logs) across Employee, Manager, and HR portals",
        ],
        [
          "Real",
          "Manager approvals",
          "Assessment, plan and project sign-off with SLA and escalation",
        ],
        [
          "Mocked",
          "External HRIS, LMSs, SSO, LINE",
          "Upstream HRIS & SSO identity providers are simulated via seeded D1 records",
        ],
      ];
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display grid h-7 w-7 place-items-center rounded-lg bg-brand text-xs font-bold text-white">
              LS
            </span>
            <h2 className="text-base font-semibold text-ink">{tr(s.lang)("about")}</h2>
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
        <p className="mt-2 rounded-2xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-2 ring-1 ring-inset ring-line">
          {th
            ? "ต้นแบบสำหรับกรณีศึกษา: แต่ละบทบาทเข้าสู่ระบบแยกกัน ลองทำตามเส้นทาง: เข้าสู่ระบบพนักงาน (E0001) ประเมินทักษะ → ออกจากระบบแล้วเข้าสู่ระบบหัวหน้า (E0002) เพื่ออนุมัติ → กลับเข้าพนักงานเพื่อให้ AI สร้างเส้นทาง → หัวหน้าอนุมัติแผน → เข้าสู่ระบบ HR และผู้บริหาร (E9001)"
            : "Case prototype with role-separated login: Sign in as Employee (E0001) for skill check → Sign out & sign in as Manager (E0002) to approve → Sign in as Employee to build AI path → Manager approves → Sign in as HR & Leaders (E9001) for executive dashboard."}
        </p>
        <table className="mt-3 w-full text-xs">
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={a} className="border-t border-line align-top">
                <td className="py-2 pr-2">
                  <Badge tone={k === "Real" || k === "ทำงานจริง" ? "ok" : "neutral"}>{k}</Badge>
                </td>
                <td className="py-2 pr-2 font-semibold text-ink">{a}</td>
                <td className="py-2 text-ink-2">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <p className="text-xs text-ink-3">{tr(s.lang)("mock")}</p>
          <Button
            variant="outline"
            className="px-2.5 py-1 text-xs"
            onClick={() => {
              dispatch({ type: "reset" });
              onClose();
            }}
          >
            {tr(s.lang)("reset")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Shell() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const [live, setLive] = useState<boolean>();
  const [prov, setProv] = useState<string>();
  const [about, setAbout] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        setLive(Boolean(d.live));
        setProv(
          d.provider === "opencode"
            ? "OpenCode"
            : d.provider === "anthropic"
              ? "Claude API"
              : d.provider === "workers-ai"
                ? "Workers AI"
                : undefined,
        );
      })
      .catch(() => setLive(false));
  }, []);

  useEffect(() => {
    document.documentElement.lang = s.lang;
  }, [s.lang]);

  const acct = ROLE_ACCOUNTS[s.persona];
  const currentUser = employeeById(acct.empId)!;
  const pendingCount = s.approvals.filter(
    (a) => a.status === "pending" && employeeById(a.employeeId)?.managerId === MANAGER,
  ).length;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/94 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 max-sm:gap-1.5 max-sm:px-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <span className="font-display grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold text-white shadow-xs">
              LS
            </span>
            <span className="max-sm:hidden">{t("appName")}</span>
          </div>

          {s.authed ? (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-2.5 py-1 text-xs">
              <Avatar name={currentUser.name[L]} size="sm" className="h-5 w-5 text-[10px]" />
              <span className="font-semibold text-ink">{currentUser.name[L]}</span>
              <Badge tone="brand">{t(s.persona)}</Badge>
              <span className="font-display hidden text-[11px] text-ink-3 md:inline">
                {acct.empId} · {acct.ssoBadge}
              </span>
              {s.persona === "manager" && pendingCount > 0 && (
                <Badge tone="gap">{pendingCount}</Badge>
              )}
            </div>
          ) : (
            <Badge tone="neutral" className="max-sm:hidden">
              {L === "th" ? "ยังไม่ได้เข้าสู่ระบบ" : "Not signed in"}
            </Badge>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex rounded-xl border border-line bg-surface-2 p-0.5">
              {(["th", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => dispatch({ type: "set", patch: { lang: l } })}
                  className={cx(
                    "rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer",
                    s.lang === l ? "bg-surface text-brand shadow-xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {l === "th" ? "ไทย" : "EN"}
                </button>
              ))}
            </div>

            {s.dbMeta?.connected && (
              <Badge
                tone="ok"
                className="max-md:hidden"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                <span>
                  D1 SQL · {s.dbMeta.tables.employees} emp / {s.dbMeta.tables.approvals} queue
                </span>
              </Badge>
            )}

            {live !== undefined && (
              <Badge tone={live ? "ok" : "warn"} className="max-sm:hidden">
                {live && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
                <span className="max-lg:hidden">
                  {live ? `${t("liveMode")}${prov ? ` · ${prov}` : ""}` : t("demoMode")}
                </span>
                <span className="lg:hidden">{live ? "Live AI" : "Demo"}</span>
              </Badge>
            )}

            <Button
              variant="ghost"
              className="whitespace-nowrap px-2 py-1 text-xs"
              onClick={() => setAbout(true)}
            >
              <span className="max-md:hidden">{t("about")}</span>
              <span className="md:hidden">?</span>
            </Button>

            {s.authed && (
              <Button
                variant="outline"
                className="whitespace-nowrap px-2.5 py-1 text-xs"
                onClick={() => dispatch({ type: "logout" })}
              >
                <Icon name="logout" className="h-3.5 w-3.5" />
                <span>{L === "th" ? "สลับบัญชี / ออกจากระบบ" : "Switch role / Sign out"}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              className="whitespace-nowrap px-2 py-1 text-xs max-sm:hidden"
              onClick={() => dispatch({ type: "reset" })}
            >
              {t("reset")}
            </Button>
          </div>
        </div>
      </header>

      <main
        className={cx(
          "px-4 py-4 max-sm:px-0 max-sm:py-0",
          (!s.authed || s.persona === "leader") && "max-sm:px-4 max-sm:py-4",
        )}
      >
        {!s.authed ? (
          <RoleLoginScreen />
        ) : (
          <>
            {s.persona === "employee" && <EmployeeApp />}
            {s.persona === "manager" && <ManagerApp />}
            {s.persona === "leader" && <LeaderDashboard />}
          </>
        )}
      </main>
      {about && <About onClose={() => setAbout(false)} />}
    </div>
  );
}

const noopSubscribe = () => () => {};

// Client-only: demo state lives in the browser (seeded relative to today and
// restored from localStorage), so nothing is prerendered on the server.
export function App() {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!mounted)
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-ink-3">
        Learning Suite…
      </div>
    );
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
