"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { employeeById } from "@/lib/skills";
import { EmployeeApp } from "./Employee";
import { tr } from "./i18n";
import { LeaderDashboard } from "./Leader";
import { ManagerApp } from "./Manager";
import { MANAGER, StoreProvider, useStore, type Persona } from "./store";
import { Badge, Button, cx, Icon } from "./ui";

function About({ onClose }: { onClose: () => void }) {
  const { s, dispatch } = useStore();
  const th = s.lang === "th";
  const rows: [string, string, string][] = th
    ? [
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
          "การอนุมัติของหัวหน้า",
          "ผลประเมิน แผน และโปรเจกต์ พร้อม SLA และการส่งต่อ",
        ],
        [
          "จำลอง",
          "HR, LMS, SSO, LINE",
          "ข้อมูลพนักงานและคลังการเรียนรู้เป็นข้อมูลจำลองที่สร้างด้วยสคริปต์",
        ],
        ["จำลอง", "แดชบอร์ด", "ตัวเลข 12,000 คนเป็นข้อมูลสมมติเพื่อแสดงตัวอย่าง"],
      ]
    : [
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
          "Manager approvals",
          "Assessment, plan and project sign-off with SLA and escalation",
        ],
        [
          "Mocked",
          "HR system, LMSs, SSO, LINE",
          "Employees and catalogue are generated mock data",
        ],
        ["Mocked", "Dashboard numbers", "The 12,000-person figures are illustrative"],
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
            ? "ต้นแบบสำหรับกรณีศึกษา: Learning Suite สำหรับพนักงานหน้างาน ลองทำตามเส้นทาง: พนักงานประเมินทักษะ → หัวหน้าอนุมัติ → AI สร้างเส้นทาง → หัวหน้าอนุมัติแผน → เรียนและถามโค้ช → ส่งโปรเจกต์ → แดชบอร์ดผู้บริหาร"
            : "Case prototype of the Learning Suite for frontline staff. Suggested walk-through: employee skill check → manager approves → AI builds the path → manager approves the plan → learn and ask the coach → submit a project → leader dashboard."}
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

  const personas: Persona[] = ["employee", "manager", "leader"];
  const pendingCount = s.approvals.filter(
    (a) => a.status === "pending" && employeeById(a.employeeId)?.managerId === MANAGER,
  ).length;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/94 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 max-sm:gap-1.5 max-sm:px-2">
          <div className="mr-2 flex items-center gap-2 text-sm font-semibold text-brand max-sm:hidden">
            <span className="font-display grid h-7 w-7 place-items-center rounded-lg bg-brand text-xs font-bold text-white shadow-xs">
              LS
            </span>
            <span>{t("appName")} · Prototype</span>
          </div>
          <div className="flex rounded-xl border border-line bg-surface-2 p-0.5">
            {personas.map((p) => {
              const active = s.persona === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => dispatch({ type: "set", patch: { persona: p } })}
                  className={cx(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer max-sm:px-1.5",
                    active ? "bg-surface text-brand shadow-xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  <span>{t(p)}</span>
                  {p === "manager" && pendingCount > 0 && (
                    <span
                      aria-hidden="true"
                      className={cx(
                        "font-display inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                        active ? "bg-brand text-white" : "bg-gap text-white",
                      )}
                    >
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
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
          <div className="ml-auto flex items-center gap-1.5">
            {live !== undefined && (
              <Badge tone={live ? "ok" : "warn"}>
                {live && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
                <span className="max-md:hidden">
                  {live ? `${t("liveMode")}${prov ? ` · ${prov}` : ""}` : t("demoMode")}
                </span>
                <span className="md:hidden">{live ? "Live AI" : "Demo"}</span>
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
          s.persona === "leader" && "max-sm:px-4 max-sm:py-4",
        )}
      >
        {s.persona === "employee" && <EmployeeApp />}
        {s.persona === "manager" && <ManagerApp />}
        {s.persona === "leader" && <LeaderDashboard />}
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
