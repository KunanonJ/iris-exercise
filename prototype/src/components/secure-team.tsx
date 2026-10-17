"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import metricsData from "@/data/generated/metrics.json";
import { BUSINESS_UNITS, roleById, skillById } from "@/data/taxonomy";
import type { IntegrationStatus, LearningRecord, SuiteCommand, SuiteView } from "@/lib/suite-contracts";
import type { Approval, Bilingual, Lang, Level, Role } from "@/lib/types";
import { Avatar, Badge, Button, Card, cx, Icon, LevelDots, Ring } from "./kit";

type Command = (command: SuiteCommand) => Promise<void>;
type SimPoint = { id: string; readiness: number; kpi: number };

const SIM_METRICS = metricsData as unknown as {
  pilot: { headcount: number };
  funnel: { week: number; activated: number; assessed: number; approved: number; planActive: number }[];
  heatmap: { bu: string; cells: { category: string; baseline: number | null; now: number | null }[] }[];
  business: Record<"rd" | "pk", { label: Bilingual; kpi: Bilingual; points: SimPoint[] }>;
};

const labels: Record<string, Bilingual> = {
  not_started: { en: "Not started", th: "ยังไม่เริ่ม" },
  submitted: { en: "Awaiting approval", th: "รอการอนุมัติ" },
  approved: { en: "Approved", th: "อนุมัติแล้ว" },
  changes_requested: { en: "Changes requested", th: "ขอแก้ไข" },
  draft: { en: "Draft", th: "ฉบับร่าง" },
  pending: { en: "Awaiting approval", th: "รอการอนุมัติ" },
  todo: { en: "To do", th: "ยังไม่เริ่ม" },
  in_progress: { en: "In progress", th: "กำลังเรียน" },
  done: { en: "Verified complete", th: "ยืนยันสำเร็จแล้ว" },
  video: { en: "Video / lesson", th: "วิดีโอ / บทเรียน" },
  workshop: { en: "Workshop", th: "เวิร์กช็อป" },
  project: { en: "Work project", th: "โปรเจกต์หน้างาน" },
  assessment: { en: "Skill assessment", th: "ผลประเมินทักษะ" },
  plan: { en: "Learning plan", th: "แผนการเรียน" },
  unconfigured: { en: "Not configured", th: "ยังไม่ตั้งค่า" },
  configured: { en: "Configured, not proven", th: "ตั้งค่าแล้ว ยังไม่ยืนยัน" },
  verified: { en: "Sandbox proof recorded", th: "มีหลักฐาน Sandbox" },
  error: { en: "Connection error", th: "การเชื่อมต่อขัดข้อง" },
};

function label(value: string, lang: Lang) {
  return labels[value]?.[lang] ?? value;
}

function Status({ value, lang }: { value: string; lang: Lang }) {
  return (
    <Badge
      tone={
        ["approved", "done", "verified"].includes(value)
          ? "ok"
          : ["changes_requested", "error"].includes(value)
            ? "danger"
            : ["submitted", "pending", "in_progress"].includes(value)
              ? "warn"
              : "neutral"
      }
    >
      {label(value, lang)}
    </Badge>
  );
}

function skillsFor(record: LearningRecord) {
  return [
    ...new Set(
      [record.employee.roleId, record.employee.nextRoleId]
        .filter((id): id is string => !!id)
        .flatMap((id) => roleById(id)?.requirements.map((req) => req.skillId) ?? []),
    ),
  ];
}

function levelFor(record: LearningRecord, id: string): Level {
  return record.overrides[id] ?? record.assessment.final?.[id] ?? record.employee.scores[id]?.final ?? 1;
}

function readiness(record: LearningRecord, role: Role | undefined) {
  return role?.requirements.length
    ? Math.round(
        (role.requirements.filter((req) => levelFor(record, req.skillId) >= req.level).length /
          role.requirements.length) *
          100,
      )
    : 0;
}

function CompactSkillOverview({ record, lang }: { record: LearningRecord; lang: Lang }) {
  const th = lang === "th";
  const current = roleById(record.employee.roleId);
  const next = record.employee.nextRoleId ? roleById(record.employee.nextRoleId) : undefined;
  const role = next ?? current;
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink">
          {current?.title[lang]}
          {next ? ` → ${next.title[lang]}` : ""}
        </p>
        <Badge tone="brand">
          {th ? "ความพร้อม" : "Readiness"} {readiness(record, role)}%
        </Badge>
      </div>
      <div className="mt-2 divide-y divide-line">
        {role?.requirements.map((req) => (
          <div key={req.skillId} className="flex items-center justify-between gap-3 py-1.5 text-xs">
            <span className="truncate font-medium text-ink">
              {skillById(req.skillId)?.name[lang] ?? req.skillId}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-display tabular-nums text-ink-3">
                L{levelFor(record, req.skillId)}/L{req.level}
              </span>
              <LevelDots current={levelFor(record, req.skillId)} required={req.level} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({
  approval,
  record,
  lang,
  busy,
  command,
}: {
  approval: Approval;
  record: LearningRecord;
  lang: Lang;
  busy: boolean;
  command: Command;
}) {
  const th = lang === "th";
  const [note, setNote] = useState("");
  const ids = skillsFor(record);
  const initialFinal: Record<string, Level> = Object.fromEntries(
    ids.map((id) => [
      id,
      record.assessment.final?.[id] ??
        record.assessment.quiz[id] ??
        record.assessment.self[id] ??
        levelFor(record, id),
    ]),
  );
  const [final, setFinal] = useState<Record<string, Level>>(initialFinal);
  const isCalibrated =
    approval.kind === "assessment" &&
    JSON.stringify(final) !== JSON.stringify(record.assessment.final ?? initialFinal);
  const evidence = approval.ref ? record.evidence[approval.ref] : undefined;
  const [showRecord, setShowRecord] = useState(false);
  const [now] = useState(() => Date.now());
  const daysLeft = Math.round((Date.parse(approval.dueAt) - now) / 864e5);

  const decide = (approve: boolean) =>
    void command({
      type: "approval.decide",
      approvalId: approval.id,
      approve,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(approve && isCalibrated && approval.kind === "assessment" ? { final } : {}),
    });

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <Avatar name={record.employee.name[lang]} />
          <div>
            <h3 className="font-semibold text-ink">{record.employee.name[lang]}</h3>
            <p className="mt-0.5 text-sm font-medium text-brand">
              {label(approval.kind, lang)}
              {approval.ref ? ` · ${itemById(approval.ref)?.title[lang] ?? approval.ref}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-ink-3">
              {th ? "กำหนดตรวจสอบ" : "Review due"}:{" "}
              {new Date(approval.dueAt).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {approval.status === "pending" && (
            <Badge tone={daysLeft < 0 ? "danger" : "neutral"}>
              {daysLeft < 0
                ? th
                  ? "เกินกำหนด SLA"
                  : "Overdue"
                : th
                  ? `เหลือ ${daysLeft} วัน`
                  : `Due in ${daysLeft}d`}
            </Badge>
          )}
          <Status value={approval.status} lang={lang} />
        </div>
      </div>

      {approval.kind === "assessment" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-[1fr_48px_56px_108px] items-center gap-1 border-b border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-3">
            <span>{th ? "ทักษะ" : "Skill"}</span>
            <span className="text-center">{th ? "ตนเอง" : "Self"}</span>
            <span className="text-center">{th ? "สถานการณ์" : "Scenario"}</span>
            <span className="text-center">{th ? "ระดับที่อนุมัติ" : "Final level"}</span>
          </div>
          <div className="divide-y divide-line">
            {ids.map((id) => {
              const selfV = record.assessment.self[id];
              const quizV = record.assessment.quiz[id];
              const baseV = record.assessment.final?.[id] ?? initialFinal[id];
              const curV = final[id] ?? baseV;
              const differs = curV !== baseV;
              return (
                <div
                  key={id}
                  className={cx(
                    "grid grid-cols-[1fr_48px_56px_108px] items-center gap-1 px-3 py-2 text-xs transition",
                    differs && "bg-brand-soft/45",
                  )}
                >
                  <span className="truncate font-medium text-ink">
                    {skillById(id)?.name[lang] ?? id}
                    {differs && (
                      <span className="ml-1.5 inline-block rounded bg-gap-soft px-1.5 py-0.5 text-[10px] font-semibold text-gap">
                        {th ? "ปรับเทียบ" : "Calibrated"}
                      </span>
                    )}
                  </span>
                  <span className="text-center font-display tabular-nums text-ink-2">
                    {selfV ? `L${selfV}` : "-"}
                  </span>
                  <span className="text-center font-display tabular-nums text-ink-3">
                    {quizV ? `L${quizV}` : "-"}
                  </span>
                  {approval.status === "pending" ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy || curV <= 1}
                        aria-label={`${th ? "ลดระดับ" : "Decrease"} ${skillById(id)?.name[lang] ?? id}`}
                        onClick={() =>
                          setFinal((cur) => ({ ...cur, [id]: Math.max(1, curV - 1) as Level }))
                        }
                        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface-2 font-bold text-ink hover:border-brand/40 disabled:opacity-40 cursor-pointer"
                      >
                        -
                      </button>
                      <span
                        className={cx(
                          "font-display w-6 text-center text-xs font-bold tabular-nums",
                          differs ? "text-gap" : "text-brand",
                        )}
                      >
                        L{curV}
                      </span>
                      <button
                        type="button"
                        disabled={busy || curV >= 4}
                        aria-label={`${th ? "เพิ่มระดับ" : "Increase"} ${skillById(id)?.name[lang] ?? id}`}
                        onClick={() =>
                          setFinal((cur) => ({ ...cur, [id]: Math.min(4, curV + 1) as Level }))
                        }
                        className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface-2 font-bold text-ink hover:border-brand/40 disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="text-center font-display font-bold tabular-nums text-brand">
                      L{baseV}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {approval.kind === "plan" && record.plan && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3.5 ring-1 ring-inset ring-line">
          <p className="text-sm font-medium text-ink">{record.plan.summary[lang]}</p>
          <ol className="mt-2.5 space-y-1.5 text-xs text-ink-2">
            {record.plan.steps.map((step) => {
              const it = itemById(step.itemId);
              return (
                <li key={step.itemId} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate">
                    <Icon name={it?.format ?? "book"} className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span>
                      {th ? "สัปดาห์" : "Week"} {step.week} · {it?.title[lang] ?? step.itemId}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-3">
                    {it?.minutes} {th ? "นาที" : "min"}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {approval.kind === "project" && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3.5 ring-1 ring-inset ring-line">
          <p className="text-xs font-semibold text-ink-3">
            {th ? "หลักฐานที่พนักงานส่ง" : "Employee-submitted evidence"}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">
            {evidence ||
              (th ? "ไม่พบหลักฐาน โปรดโหลดข้อมูลล่าสุดก่อนตัดสินใจ" : "Evidence is unavailable. Refresh before deciding.")}
          </p>
        </div>
      )}

      {approval.status === "pending" && (
        <div className="mt-4 space-y-3">
          {isCalibrated && (
            <p className="rounded-xl bg-gap-soft px-3 py-2 text-xs font-medium text-gap">
              {th
                ? "คุณได้ปรับเทียบระดับทักษะ กรุณาระบุเหตุผลประกอบก่อนกดอนุมัติ"
                : "You calibrated one or more skill levels. Please provide a reason note below before approving."}
            </p>
          )}
          <label className="block text-sm font-medium" htmlFor={`approval-note-${approval.id}`}>
            {th
              ? "หมายเหตุ (จำเป็นเมื่อขอแก้ไขหรือปรับเทียบคะแนน)"
              : "Review note (required for changes or calibration)"}
          </label>
          <textarea
            id={`approval-note-${approval.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={2}
            disabled={busy}
            className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-brand"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || (isCalibrated && !note.trim()) || (approval.kind === "project" && !evidence)}
              onClick={() => decide(true)}
            >
              <Icon name="check" className="h-4 w-4" />
              {th ? "อนุมัติ" : "Approve"}
            </Button>
            <Button variant="danger" disabled={busy || !note.trim()} onClick={() => decide(false)}>
              {th ? "ขอให้แก้ไข" : "Request changes"}
            </Button>
          </div>
        </div>
      )}

      {approval.note && <p className="mt-3 text-sm text-ink-2">{approval.note}</p>}

      <button
        type="button"
        onClick={() => setShowRecord((value) => !value)}
        aria-expanded={showRecord}
        className="mt-3 min-h-10 text-sm font-medium text-brand hover:underline cursor-pointer"
      >
        {showRecord
          ? th
            ? "ซ่อนภาพรวมทักษะ"
            : "Hide skill overview"
          : th
            ? "ดูภาพรวมทักษะ"
            : "View skill overview"}
      </button>
      {showRecord && (
        <div className="mt-2">
          <CompactSkillOverview record={record} lang={lang} />
        </div>
      )}
    </Card>
  );
}

export function ManagerJourney({
  view,
  lang,
  busy,
  command,
}: {
  view: SuiteView;
  lang: Lang;
  busy: boolean;
  command: Command;
}) {
  const th = lang === "th";
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [now] = useState(() => Date.now());
  const team = view.team ?? [];
  const pendingApprovals = view.approvals.filter((a) => a.status === "pending");
  const withinSla = pendingApprovals.filter((a) => Date.parse(a.dueAt) >= now).length;
  const overdueCount = pendingApprovals.length - withinSla;
  const approvals = view.approvals.filter((approval) => filter === "all" || approval.status === "pending");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "ลูกทีมโดยตรง" : "Direct reports"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-ink">{team.length}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "รอการอนุมัติ" : "Pending reviews"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-brand">
            {pendingApprovals.length}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "อยู่ในเกณฑ์ SLA" : "Within SLA"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-ok">{withinSla}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "เกินกำหนด SLA" : "Overdue"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-danger">{overdueCount}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{th ? "ทีมของฉัน" : "My direct reports"}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {th
                ? "แสดงเฉพาะผู้ใต้บังคับบัญชาปัจจุบันที่เซิร์ฟเวอร์อนุญาต บทสนทนาส่วนตัวกับโค้ชไม่รวมในมุมมองนี้"
                : "Only current direct reports permitted by the server are shown. Private coach conversations are excluded."}
            </p>
          </div>
          <Badge tone="neutral">
            <Icon name="lock" className="h-3 w-3" />
            {th ? "ไม่รวมแชตส่วนตัว" : "Private chats excluded"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {team.map((record) => {
            const curRole = roleById(record.employee.roleId);
            const nextRole = record.employee.nextRoleId ? roleById(record.employee.nextRoleId) : undefined;
            const nextPct = readiness(record, nextRole ?? curRole);
            return (
              <div
                key={record.employee.id}
                className="flex items-start gap-3 rounded-2xl border border-line bg-surface-2/45 p-3.5"
              >
                <Ring value={nextPct / 100} size={48} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-ink">
                    {record.employee.name[lang]}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {curRole?.title[lang]}
                    {nextRole ? ` → ${nextRole.title[lang]}` : ""}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Status value={record.assessment.status} lang={lang} />
                    {record.plan && <Status value={record.plan.status} lang={lang} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {team.length === 0 && (
          <p className="mt-4 text-sm text-ink-3">
            {th ? "ยังไม่มีผู้ใต้บังคับบัญชาในขอบเขตของคุณ" : "You have no direct reports in your current scope."}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{th ? "รายการอนุมัติ" : "Review queue"}</h2>
        <div className="flex gap-2">
          <Button variant={filter === "pending" ? "soft" : "ghost"} onClick={() => setFilter("pending")}>
            {th ? "รอตรวจสอบ" : "Pending"}
          </Button>
          <Button variant={filter === "all" ? "soft" : "ghost"} onClick={() => setFilter("all")}>
            {th ? "ทั้งหมด" : "All"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {approvals.map((approval) => {
          const record = team.find((r) => r.employee.id === approval.employeeId);
          return record ? (
            <ApprovalCard
              key={`${approval.id}:${approval.status}`}
              approval={approval}
              record={record}
              lang={lang}
              busy={busy}
              command={command}
            />
          ) : null;
        })}
      </div>

      {approvals.length === 0 && (
        <Card>
          <p className="text-sm text-ink-2">{th ? "ไม่มีรายการในมุมมองนี้" : "No reviews in this view."}</p>
        </Card>
      )}
    </div>
  );
}

const HEAT_STEPS = ["#d7ecef", "#9dd0d5", "#4ca1a8", "#167a81", "#0c565b"];
const heatStep = (v: number) => (v < 0.35 ? 0 : v < 0.45 ? 1 : v < 0.55 ? 2 : v < 0.65 ? 3 : 4);
const HEAT_CATS: Record<string, Bilingual> = {
  core: { en: "Core", th: "ทักษะพื้นฐาน" },
  technical: { en: "Technical", th: "ทักษะเทคนิค" },
  leadership: { en: "Leadership", th: "ภาวะผู้นำ" },
};

function Wave1SimulationPreview({ lang }: { lang: Lang }) {
  const th = lang === "th";
  const [heatView, setHeatView] = useState<"now" | "baseline">("now");
  const last = SIM_METRICS.funnel.at(-1)!;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <Card className="space-y-4 border-brand/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Badge tone="warn">
            {th
              ? "ข้อมูลจำลองสำหรับการวางแผน Wave 1 (12,000 คน) · ไม่ใช่ข้อมูลจริงจาก D1"
              : "Illustrative Wave-1 planning model (12,000 staff) · not live D1 data"}
          </Badge>
          <h3 className="mt-2 text-base font-bold text-ink">
            {th
              ? "ภาพจำลองเป้าหมายสัปดาห์ที่ 8 สำหรับการประชุมผู้บริหาร"
              : "Week-8 forum target simulation (Adoption & BU capability heatmap)"}
          </h3>
        </div>
        <div className="flex gap-1.5">
          {(["now", "baseline"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setHeatView(v)}
              className={cx(
                "rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer",
                heatView === v
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-surface text-ink-2",
              )}
            >
              {v === "now"
                ? th
                  ? "จำลองสัปดาห์ 8"
                  : "Simulated W8"
                : th
                  ? "ค่าตั้งต้นสัปดาห์ 0"
                  : "Baseline W0"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
          <p className="text-xs font-semibold text-ink">
            {th ? "เป้าหมาย Funnel สัปดาห์ที่ 8 (12,000 คน)" : "Simulated Week-8 funnel (12,000 cohort)"}
          </p>
          <div className="mt-3 space-y-2.5 text-xs">
            {(
              [
                [th ? "เข้าใช้งานระบบ" : "Logged in", last.activated, "#0c6368"],
                [th ? "ประเมินทักษะแล้ว" : "Assessed", last.assessed, "#c2501f"],
                [th ? "หัวหน้าอนุมัติแล้ว" : "Manager-approved", last.approved, "#156d49"],
                [th ? "เรียนตามแผน" : "Learning on a plan", last.planActive, "#a15807"],
              ] as const
            ).map(([title, count, color]) => {
              const share = count / SIM_METRICS.pilot.headcount;
              return (
                <div key={title}>
                  <div className="flex justify-between font-medium">
                    <span>{title}</span>
                    <span className="font-display tabular-nums">
                      {count.toLocaleString(lang === "th" ? "th-TH" : "en-GB")} ({pct(share)})
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(share * 100)}%`, background: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
          <p className="mb-2 text-xs font-semibold text-ink">
            {th ? "สัดส่วนทักษะถึงเกณฑ์แยกตามหน่วยธุรกิจ (จำลอง)" : "Simulated skill readiness by BU & category"}
          </p>
          <div className="grid grid-cols-[minmax(100px,1.3fr)_repeat(3,1fr)] gap-1 text-xs">
            <div />
            {Object.values(HEAT_CATS).map((c) => (
              <div key={c.en} className="pb-1 text-center text-[11px] font-medium text-ink-3">
                {c[lang]}
              </div>
            ))}
            {SIM_METRICS.heatmap.map((row) => (
              <div key={row.bu} className="contents">
                <div className="flex items-center pr-2 text-[11px] font-medium text-ink-2">
                  {BUSINESS_UNITS.find((b) => b.id === row.bu)?.name[lang] ?? row.bu}
                </div>
                {row.cells.map((cell) => {
                  const val = cell[heatView];
                  if (val === null) {
                    return (
                      <div
                        key={cell.category}
                        className="grid h-9 place-items-center rounded-lg bg-surface text-[10px] text-ink-3"
                      >
                        {th ? "ระยะถัดไป" : "Later wave"}
                      </div>
                    );
                  }
                  const k = heatStep(val);
                  const delta =
                    cell.now !== null && cell.baseline !== null
                      ? Math.round((cell.now - cell.baseline) * 100)
                      : 0;
                  return (
                    <div
                      key={cell.category}
                      className="font-display flex h-9 items-center justify-center gap-1 rounded-lg font-bold tabular-nums"
                      style={{ background: HEAT_STEPS[k], color: k >= 2 ? "white" : "var(--ink)" }}
                    >
                      <span>{pct(val)}</span>
                      {heatView === "now" && delta > 0 && (
                        <span className="text-[10px] font-medium opacity-85">+{delta}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function LeaderJourney({ view, lang }: { view: SuiteView; lang: Lang }) {
  const th = lang === "th";
  const [showSim, setShowSim] = useState(false);
  const metrics = view.metrics;
  if (!metrics)
    return (
      <Card>
        <p>
          {th
            ? "ยังไม่มีข้อมูลสรุปองค์กรที่แสดงได้ ระบบซ่อนข้อมูลเมื่อมีพนักงานต่ำกว่า 10 คนเพื่อปกป้องความเป็นส่วนตัว"
            : "Organisation metrics are unavailable. Cohorts with fewer than 10 employees are suppressed for privacy."}
        </p>
      </Card>
    );

  const total = Math.max(1, metrics.employees);
  const unassessed = Math.max(0, metrics.employees - metrics.assessed);
  const measures = [
    {
      name: th ? "พนักงาน" : "Employees",
      value: metrics.employees,
      sub: th ? `${unassessed} คนยังไม่ได้รับการประเมิน` : `${unassessed} not yet assessed`,
      bar: 1,
    },
    {
      name: th ? "ส่งผลประเมิน" : "Assessed",
      value: metrics.assessed,
      sub: `${Math.round((metrics.assessed / total) * 100)}% ${th ? "ของพนักงานทั้งหมด" : "of enabled staff"}`,
      bar: metrics.assessed / total,
    },
    {
      name: th ? "อนุมัติผลประเมิน" : "Assessments approved",
      value: metrics.approved,
      sub: `${Math.round((metrics.approved / total) * 100)}% ${th ? "ผ่านการอนุมัติจากหัวหน้า" : "calibrated by manager"}`,
      bar: metrics.approved / total,
    },
    {
      name: th ? "แผนที่อนุมัติ" : "Active plans",
      value: metrics.plansActive,
      sub: `${Math.round((metrics.plansActive / total) * 100)}% ${th ? "มีแผนการเรียนที่อนุมัติ" : "learning on an approved path"}`,
      bar: metrics.plansActive / total,
    },
    {
      name: th ? "กิจกรรมที่ยืนยันแล้ว" : "Verified completed steps",
      value: metrics.completedSteps,
      sub: th ? "ซิงค์จาก Moodle หรืออนุมัติหลักฐานแล้ว" : "Moodle reconciled or manager-signed",
      bar: Math.min(1, metrics.completedSteps / 10),
    },
    {
      name: th ? "รอการอนุมัติ" : "Pending approvals",
      value: metrics.pendingApprovals,
      sub: th ? "รายการที่อยู่ในคิวหัวหน้างาน" : "Awaiting manager decision",
      bar: Math.min(1, metrics.pendingApprovals / 10),
    },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {th ? "ความก้าวหน้าการเรียนรู้ขององค์กร" : "Organisation learning progress"}
          </h2>
          <p className="mt-1.5 text-sm text-ink-2">
            {th
              ? "ตัวเลขคำนวณจากข้อมูลสมมติที่จัดเก็บบนเซิร์ฟเวอร์ ไม่มีข้อมูลรายบุคคลในมุมมองผู้บริหาร"
              : "Calculated from server-held synthetic records. This leadership view contains no individual employee records."}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowSim((v) => !v)}>
          {showSim
            ? th
              ? "ซ่อนแบบจำลองเป้าหมาย Wave 1"
              : "Hide Wave-1 target simulation"
            : th
              ? "ดูแบบจำลองเป้าหมาย Wave 1 (จำลอง)"
              : "View Wave-1 target simulation"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {measures.map((m) => (
          <Card key={m.name} className="p-4">
            <p className="text-xs font-medium text-ink-3">{m.name}</p>
            <p className="font-display mt-2 text-3xl font-bold tabular-nums text-brand">
              {m.value.toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
            </p>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round(m.bar * 100))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-2">{m.sub}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">
              {th ? "ความพร้อมแยกตามหน่วยธุรกิจ" : "Readiness by business unit"}
            </h3>
            <p className="mt-1 text-xs text-ink-3">
              {th
                ? "ซ่อนกลุ่มที่มีพนักงานต่ำกว่า 10 คนเพื่อปกป้องความเป็นส่วนตัว"
                : "Groups with fewer than 10 employees are suppressed for privacy."}{" "}
              {metrics.suppressedGroups > 0 &&
                `${th ? "กลุ่มที่ซ่อน" : "Groups suppressed"}: ${metrics.suppressedGroups}`}
            </p>
          </div>
          <Badge tone="brand">
            <Icon name="shield" className="h-3 w-3" />
            PDPA n ≥ 10
          </Badge>
        </div>

        <div className="mt-4 space-y-4">
          {metrics.groups.map((group) => {
            const buMeta = BUSINESS_UNITS.find((b) => b.id === group.bu);
            const pct = Math.round(Math.max(0, Math.min(1, group.readiness)) * 100);
            return (
              <div key={group.bu} className="rounded-xl border border-line bg-surface-2/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">
                      {group.bu} · {group.count} {th ? "คน" : "employees"}
                    </Badge>
                    {buMeta && <span className="font-medium text-ink">{buMeta.name[lang]}</span>}
                  </div>
                  <strong className="font-display text-base tabular-nums text-brand">{pct}%</strong>
                </div>
                <div className="mt-2.5 h-2.5 rounded-full bg-surface-3">
                  <div
                    className="h-2.5 rounded-full bg-brand transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {metrics.groups.length === 0 && (
          <p className="mt-4 text-sm text-ink-3">
            {th ? "ยังไม่มีกลุ่มที่ผ่านเกณฑ์ความเป็นส่วนตัว" : "No groups meet the privacy threshold yet."}
          </p>
        )}
      </Card>

      {showSim && <Wave1SimulationPreview lang={lang} />}

      <Card>
        <Badge tone="neutral">
          {th ? "กรอบการวัดผล · ไม่ใช่ผลลัพธ์ที่พิสูจน์แล้ว" : "Measurement framework · not proven business impact"}
        </Badge>
        <h3 className="mt-3 font-semibold text-ink">
          {th ? "เชื่อมการเรียนกับผลลัพธ์งาน" : "Connect learning to work outcomes"}
        </h3>
        <p className="mt-2 text-sm text-ink-2">
          {th
            ? "กำหนดค่าตั้งต้นและกลุ่มเปรียบเทียบ แล้วติดตามคุณภาพบริการ ข้อผิดพลาด และเวลาสู่ความพร้อม ตัวเลขการเรียนด้านบนไม่ใช่หลักฐานว่าเกิดผลลัพธ์เชิงสาเหตุแล้ว"
            : "Establish a baseline and comparison group, then track service quality, errors and time to proficiency. Learning metrics above do not establish a causal business improvement."}
        </p>
      </Card>
    </div>
  );
}

export function IntegrationsPanel({
  integrations,
  lang,
}: {
  integrations: IntegrationStatus[];
  lang: Lang;
}) {
  const th = lang === "th";
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">
            {th ? "สถานะการเชื่อมต่อจริงของสภาพแวดล้อมนี้" : "Connections in this environment"}
          </h2>
          <Badge tone="brand">
            <Icon name="shield" className="h-3 w-3" />
            {th ? "ตรวจสอบสิทธิ์ฝั่งเซิร์ฟเวอร์" : "Server-verified"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {th
            ? "สถานะมาจากเซิร์ฟเวอร์ Clerk พัฒนาเปิด Google และ LINE Login แล้ว แต่สิทธิ์ยังมาจากรายการสมาชิก Suite หลักฐาน Sandbox ไม่ยืนยัน HR/LMS ของลูกค้าจริง การเข้าสู่ระบบ Suite และ Moodle แยกจากกัน"
            : "Statuses come from the server. Clerk development has Google and LINE Login enabled; Suite permissions still come from memberships. Sandbox proof does not verify client HR/LMS production. Suite and Moodle sign-in remain separate."}
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Icon
                    name={integration.id === "clerk" ? "key" : integration.id === "hr" ? "team" : "book"}
                    className="h-4 w-4"
                  />
                </span>
                <h3 className="font-semibold text-ink">{integration.label}</h3>
              </div>
              <Status value={integration.status} lang={lang} />
            </div>
            <p className="mt-3 text-sm text-ink-2">{integration.detail}</p>
            {integration.lastSuccess && (
              <p className="mt-3 text-xs text-ink-3">
                {th ? "สำเร็จล่าสุด" : "Last recorded success"}:{" "}
                {new Date(integration.lastSuccess).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
              </p>
            )}
          </Card>
        ))}
      </div>
      {integrations.length === 0 && (
        <Card>
          <p className="text-sm text-ink-3">
            {th ? "ยังไม่มีข้อมูลการเชื่อมต่อ" : "No connection status has been supplied."}
          </p>
        </Card>
      )}
    </div>
  );
}
