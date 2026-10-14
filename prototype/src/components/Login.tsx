"use client";

import { useState } from "react";
import { roleById } from "@/data/taxonomy";
import { employeeById } from "@/lib/skills";
import { tr } from "./i18n";
import { HERO, LEADER, MANAGER, useStore, type Persona } from "./store";
import { Avatar, Badge, Button, Card, cx, Icon } from "./ui";

interface RoleAccountConfig {
  persona: Persona;
  empId: string;
  email: string;
  pin: string;
  ssoLabel: { th: string; en: string };
  ssoBadge: string;
  ssoTone: "line" | "corp" | "entra";
  portalTitle: { th: string; en: string };
  portalSub: { th: string; en: string };
  rbacAllowed: { th: string[]; en: string[] };
  rbacBlocked: { th: string; en: string };
}

export const ROLE_ACCOUNTS: Record<Persona, RoleAccountConfig> = {
  employee: {
    persona: "employee",
    empId: HERO,
    email: "somchai.j@company.co.th",
    pin: "1120",
    ssoLabel: {
      th: "เข้าสู่ระบบด้วย LINE Official Account (SSO)",
      en: "Continue with LINE Official Account (SSO)",
    },
    ssoBadge: "LINE OA SSO",
    ssoTone: "line",
    portalTitle: { th: "พอร์ทัลพนักงานหน้างาน", en: "Frontline Employee Portal" },
    portalSub: {
      th: "สำหรับพนักงานสาขาและโรงงาน (85% ของพนักงานเข้าผ่าน LINE OA บนมือถือ)",
      en: "For store & plant frontline staff (85% mobile access via LINE OA SSO)",
    },
    rbacAllowed: {
      th: [
        "ทำแบบประเมินทักษะ 5 นาที และดูช่องว่างทักษะของตนเอง (E0001)",
        "สร้างเส้นทางการเรียนรู้ 70-20-10 ด้วย AI และส่งหลักฐานโปรเจกต์",
        "ถามโค้ช AI ภาษาไทย/อังกฤษ พร้อมอ้างอิงแหล่งข้อมูล [S1]",
      ],
      en: [
        "Take the 5-min skill check & inspect own skill gaps (E0001)",
        "Generate AI 70-20-10 learning path & submit OJT project evidence",
        "Chat with bilingual AI Coach grounded in approved sources [S1]",
      ],
    },
    rbacBlocked: {
      th: "PDPA & RBAC: ล็อกการเข้าถึงคะแนนของเพื่อนร่วมงาน กล่องอนุมัติของหัวหน้า และแดชบอร์ดผู้บริหาร",
      en: "PDPA & RBAC: Peer scores, Manager Approval Inbox, and Executive Analytics are strictly locked.",
    },
  },
  manager: {
    persona: "manager",
    empId: MANAGER,
    email: "malee.s@company.co.th",
    pin: "2240",
    ssoLabel: {
      th: "เข้าสู่ระบบด้วย Google Workspace SSO (Manager)",
      en: "Continue with Google Workspace SSO (Manager)",
    },
    ssoBadge: "Google SSO",
    ssoTone: "corp",
    portalTitle: { th: "พอร์ทัลหัวหน้างานและผู้จัดการสาขา", en: "People Manager Portal" },
    portalSub: {
      th: "สำหรับตรวจสอบ ปรับเทียบคะแนน และอนุมัติแผนของลูกทีมโดยตรง (SLA 5 วันทำการ)",
      en: "Calibrate skill checks, approve 70-20-10 plans & sign off OJT evidence (5-day SLA)",
    },
    rbacAllowed: {
      th: [
        "กล่องงานอนุมัติ (ผลประเมิน แผนการเรียน และโปรเจกต์) พร้อม SLA 5 วันทำการ",
        "ปรับเทียบระดับทักษะ (Self vs. Quiz → Final) ก่อนกดอนุมัติ",
        "ดูความพร้อมของลูกทีมโดยตรงในสาขา 112 บางนา (7 คน)",
      ],
      en: [
        "Approval Inbox (skill checks, learning plans, project sign-offs) with 5-day SLA",
        "Calibrate skill levels (Self vs. Quiz → Final) or batch-approve on-track items",
        "Inspect readiness of direct reports at Store #112 Bang Na (7 staff only)",
      ],
    },
    rbacBlocked: {
      th: "PDPA & RBAC: เห็นเฉพาะลูกทีมโดยตรงของรหัส E0002 เท่านั้น ไม่สามารถดูประวัติแชทโค้ช AI ส่วนตัวของพนักงานได้",
      en: "PDPA & RBAC: Scoped strictly to direct reports of E0002. Private employee AI Coach transcripts are hidden.",
    },
  },
  leader: {
    persona: "leader",
    empId: LEADER,
    email: "arunee.s@company.co.th",
    pin: "9001",
    ssoLabel: {
      th: "เข้าสู่ระบบด้วย Google Workspace SSO (HR / Exec)",
      en: "Continue with Google Workspace SSO (HR / Exec)",
    },
    ssoBadge: "Google SSO",
    ssoTone: "entra",
    portalTitle: { th: "พอร์ทัล HR และผู้บริหารหน่วยธุรกิจ", en: "HR & BU Executive Portal" },
    portalSub: {
      th: "ติดตามความพร้อมระดับองค์กร การใช้งานรายสัปดาห์ และความเชื่อมโยงกับ KPI ธุรกิจ",
      en: "Organization-wide capability heatmap, adoption funnel & business KPI correlation",
    },
    rbacAllowed: {
      th: [
        "ตารางความพร้อมรายทักษะ × หน่วยธุรกิจ (เทียบสัปดาห์ 0 กับสัปดาห์ 8)",
        "ความเชื่อมโยงความพร้อมของหัวหน้างานกับ Shrink % และ OEE %",
        "สุขภาพของโค้ช AI (จำนวนบทสนทนา CSAT และอัตราการส่งต่อคน)",
      ],
      en: [
        "Skill × BU capability heatmap (Baseline Week 0 vs. Week 8 gain)",
        "Site-level readiness correlation against Store Shrink % and Line OEE %",
        "AI Coach health telemetry (weekly volume, CSAT, human escalation rate)",
      ],
    },
    rbacBlocked: {
      th: "PDPA & RBAC: แสดงเฉพาะข้อมูลรวมที่มีกลุ่มตัวอย่าง N ≥ 10 คนขึ้นไป ซ่อนข้อมูลและคะแนนรายบุคคลทั้งหมด",
      en: "PDPA & RBAC: Aggregate metrics only (minimum group size N ≥ 10). Zero individual records exposed.",
    },
  },
};

export function RoleLoginScreen() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;

  const [selectedRole, setSelectedRole] = useState<Persona>(s.persona);
  const cfg = ROLE_ACCOUNTS[selectedRole];
  const emp = employeeById(cfg.empId)!;
  const roleTitle = roleById(emp.roleId).title[L];

  const [loginId, setLoginId] = useState<string>(cfg.empId);
  const [pin, setPin] = useState<string>(cfg.pin);
  const [err, setErr] = useState<string>();

  const pendingMgrCount = s.approvals.filter(
    (a) => a.status === "pending" && employeeById(a.employeeId)?.managerId === MANAGER,
  ).length;

  const selectTab = (p: Persona) => {
    setSelectedRole(p);
    setLoginId(ROLE_ACCOUNTS[p].empId);
    setPin(ROLE_ACCOUNTS[p].pin);
    setErr(undefined);
  };

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginId.trim().toLowerCase();
    const validId =
      cleanId === cfg.empId.toLowerCase() ||
      cleanId === cfg.email.toLowerCase() ||
      cleanId === emp.name.en.split(" ")[0].toLowerCase();
    const validPin = pin.trim() === cfg.pin;
    if (!validId || !validPin) {
      setErr(
        L === "th"
          ? `รหัสพนักงานหรือรหัสผ่านไม่ถูกต้องสำหรับบทบาทนี้ (เดโม: ${cfg.empId} / PIN ${cfg.pin})`
          : `Invalid Employee ID or PIN for this role (Demo: ${cfg.empId} / PIN ${cfg.pin})`,
      );
      return;
    }
    dispatch({ type: "login", persona: selectedRole });
  };

  const signInDirect = (p: Persona) => {
    dispatch({ type: "login", persona: p });
  };

  const personas: Persona[] = ["employee", "manager", "leader"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
      {/* Handoff banner when redirected from Employee submission */}
      {s.handoffNotice === "fromEmployee" && (
        <div className="animate-fade-in mb-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/35 bg-brand-soft/80 px-4 py-3 text-xs text-ink shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Icon name="inbox" className="h-3.5 w-3.5" />
            </span>
            <div>
              <div className="font-semibold text-brand">
                {L === "th"
                  ? "สลับเซสชัน: กรุณาเข้าสู่ระบบในฐานะหัวหน้างาน (มาลี สุขสันต์ · E0002)"
                  : "Session Handoff: Sign in as Manager (Malee Suksan · E0002)"}
              </div>
              <div className="text-ink-2">
                {L === "th"
                  ? "รายการที่สมชายส่งถูกบันทึกในคิวรออนุมัติของหัวหน้าเรียบร้อยแล้ว"
                  : "Somchai's submission is queued in Malee's approval inbox."}
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            className="shrink-0 px-3 py-1.5 text-xs"
            onClick={() => signInDirect("manager")}
          >
            {L === "th" ? "เข้าสู่ระบบหัวหน้าทันที →" : "Sign in as Malee →"}
          </Button>
        </div>
      )}

      {/* Title & Role Separation Header */}
      <div className="mb-5 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-brand shadow-2xs">
          <Icon name="lock" className="h-3.5 w-3.5" />
          <span>
            {L === "th"
              ? "การควบคุมสิทธิ์ตามบทบาท (RBAC) · แยกเซสชันตามตำแหน่ง"
              : "Role-Based Access Control (RBAC) · Separated Role Sessions"}
          </span>
        </div>
        <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {L === "th" ? "เข้าสู่ระบบ Learning Suite" : "Sign in to Learning Suite"}
        </h1>
        <p className="mt-1 text-sm text-ink-2">
          {L === "th"
            ? "เลือกบทบาทเพื่อเข้าสู่ระบบด้วยบัญชีเดโมที่แยกสิทธิ์การเข้าถึงข้อมูลตาม PDPA"
            : "Select a role portal to sign in with isolated permissions and PDPA data boundaries."}
        </p>
      </div>

      {/* 3 Role Selector Tabs */}
      <div
        role="tablist"
        aria-label={L === "th" ? "เลือกบทบาทผู้ใช้งาน" : "Select role portal"}
        className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-xs"
      >
        {personas.map((p) => {
          const active = selectedRole === p;
          const acc = ROLE_ACCOUNTS[p];
          const u = employeeById(acc.empId)!;
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(p)}
              className={cx(
                "relative flex flex-col items-start gap-1 rounded-xl p-3 text-left transition-all cursor-pointer",
                active
                  ? "bg-brand text-white shadow-sm"
                  : "bg-transparent text-ink hover:bg-surface-2",
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="text-xs font-bold sm:text-sm">{t(p)}</span>
                {p === "manager" && pendingMgrCount > 0 && (
                  <span
                    className={cx(
                      "font-display inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                      active ? "bg-white text-brand" : "bg-gap text-white",
                    )}
                  >
                    {pendingMgrCount}
                  </span>
                )}
              </div>
              <div
                className={cx(
                  "truncate text-[11px]",
                  active ? "text-white/85" : "text-ink-3",
                )}
              >
                {u.name[L]} · <span className="font-display">{acc.empId}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Split Card: Left = Login Form, Right = Role Identity & RBAC Scope */}
      <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_1fr]">
        {/* Left: Login Form for Selected Role */}
        <Card className="flex flex-col justify-between p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Badge tone="brand">{cfg.ssoBadge}</Badge>
              <span className="font-display text-xs font-medium text-ink-3">
                ID: {cfg.empId}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-bold text-ink">{cfg.portalTitle[L]}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{cfg.portalSub[L]}</p>

            {/* Primary SSO Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => signInDirect(selectedRole)}
                className={cx(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.99] cursor-pointer",
                  cfg.ssoTone === "line" && "bg-[#06c755] hover:bg-[#05b34c]",
                  cfg.ssoTone === "corp" && "bg-brand hover:bg-brand-2",
                  cfg.ssoTone === "entra" && "bg-ink hover:opacity-95",
                )}
              >
                <Icon name="shield" className="h-4 w-4" />
                <span>{cfg.ssoLabel[L]}</span>
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 text-[11px] text-ink-3">
              <div className="h-px flex-1 bg-line" />
              <span>
                {L === "th"
                  ? "หรือเข้าสู่ระบบด้วยรหัสพนักงาน"
                  : "or sign in with Employee ID & PIN"}
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            {/* Employee ID + PIN Form */}
            <form onSubmit={handleCredentialSubmit} className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="login-id" className="font-medium text-ink-2">
                    {L === "th" ? "รหัสพนักงาน หรือ อีเมล" : "Employee ID or Corporate Email"}
                  </label>
                  <span className="font-display text-[11px] text-ink-3">{cfg.email}</span>
                </div>
                <input
                  id="login-id"
                  type="text"
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => {
                    setLoginId(e.target.value);
                    setErr(undefined);
                  }}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
                  required
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <label htmlFor="login-pin" className="font-medium text-ink-2">
                    {L === "th" ? "รหัสผ่าน / PIN เดโม" : "Passcode / Demo PIN"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginId(cfg.empId);
                      setPin(cfg.pin);
                      setErr(undefined);
                    }}
                    className="font-display text-[11px] font-medium text-brand hover:underline cursor-pointer"
                  >
                    {L === "th" ? `ค่าเริ่มต้น: ${cfg.pin}` : `Demo PIN: ${cfg.pin}`}
                  </button>
                </div>
                <input
                  id="login-pin"
                  type="password"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setErr(undefined);
                  }}
                  className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
                  required
                />
              </div>

              {err && (
                <div className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                  {err}
                </div>
              )}

              <Button type="submit" className="w-full">
                <Icon name="key" className="h-4 w-4" />
                <span>
                  {L === "th"
                    ? `เข้าสู่ระบบในฐานะ${t(selectedRole)} (${emp.name.th.split(" ")[0]})`
                    : `Sign in as ${t(selectedRole)} (${emp.name.en.split(" ")[0]})`}
                </span>
              </Button>
            </form>
          </div>
        </Card>

        {/* Right: Selected Persona Identity & RBAC/PDPA Boundary */}
        <Card className="flex flex-col justify-between bg-surface-2/60 p-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs">
              <Avatar name={emp.name[L]} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-bold text-ink">{emp.name[L]}</span>
                  <Badge tone="neutral">{cfg.empId}</Badge>
                </div>
                <div className="truncate text-xs font-medium text-brand">{roleTitle}</div>
                <div className="truncate text-[11px] text-ink-3">{emp.site[L]}</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold text-ink">
                {L === "th"
                  ? "สิทธิ์การเข้าถึงในเซสชันนี้ (Role Permissions)"
                  : "Session Capabilities (Role Permissions)"}
              </div>
              <ul className="space-y-2 text-xs text-ink-2">
                {cfg.rbacAllowed[L].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
                      <Icon name="check" className="h-2.5 w-2.5" />
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-brand/25 bg-brand-soft/60 p-3 text-xs leading-relaxed text-ink-2">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-brand">
              <Icon name="lock" className="h-3.5 w-3.5" />
              <span>
                {L === "th"
                  ? "การแยกข้อมูลตามกฎหมาย PDPA"
                  : "PDPA Data Isolation Boundary"}
              </span>
            </div>
            <p>{cfg.rbacBlocked[L]}</p>
          </div>
        </Card>
      </div>

      {/* Quick 1-Tap Demo Switcher Strip for Evaluators */}
      <div className="mt-4 rounded-2xl border border-line bg-surface p-3.5 shadow-2xs">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-ink-2">
            {L === "th"
              ? "เข้าสู่ระบบด่วนสำหรับผู้ตรวจประเมิน (1-Tap Demo Login):"
              : "Quick 1-Tap Login for Evaluators:"}
          </span>
          <span className="text-[11px] text-ink-3">
            {L === "th"
              ? "ข้อมูลความก้าวหน้าจะถูกเชื่อมโยงกันข้ามบทบาทโดยอัตโนมัติ"
              : "Workflow state (assessments, plans, approvals) syncs across role logins"}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {personas.map((p) => {
            const acc = ROLE_ACCOUNTS[p];
            const u = employeeById(acc.empId)!;
            return (
              <button
                key={p}
                type="button"
                onClick={() => signInDirect(p)}
                className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/70 px-3 py-2 text-left text-xs transition hover:border-brand/50 hover:bg-brand-soft/50 cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={u.name[L]} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">
                      {t(p)} · {u.name[L].split(" ")[0]}
                    </div>
                    <div className="font-display text-[10px] text-ink-3">
                      {acc.empId} · PIN {acc.pin}
                    </div>
                  </div>
                </div>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-brand" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
