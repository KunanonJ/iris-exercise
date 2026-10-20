"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import metricsData from "@/data/generated/metrics.json";
import { BUSINESS_UNITS, roleById, skillById } from "@/data/taxonomy";
import type { IntegrationStatus, LearningRecord, OrgMetrics, SuiteCommand, SuiteView } from "@/lib/suite-contracts";
import type { Approval, Bilingual, Lang, Level, Role } from "@/lib/types";
import { Avatar, Badge, Button, Card, cx, Icon, LevelDots, Ring } from "./kit";
import { LearningContextSummary } from "./secure-learning-context";

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
  submitted: { en: "Awaiting approval", th: "รออนุมัติ" },
  approved: { en: "Approved", th: "อนุมัติแล้ว" },
  changes_requested: { en: "Changes requested", th: "ขอให้แก้ไข" },
  draft: { en: "Draft", th: "ฉบับร่าง" },
  pending: { en: "Awaiting approval", th: "รออนุมัติ" },
  todo: { en: "To do", th: "ยังไม่เริ่ม" },
  in_progress: { en: "In progress", th: "กำลังเรียน" },
  done: { en: "Completed", th: "เรียนจบแล้ว" },
  video: { en: "Video / lesson", th: "วิดีโอ / บทเรียน" },
  workshop: { en: "Workshop", th: "เวิร์กช็อป" },
  project: { en: "Work project", th: "โปรเจกต์หน้างาน" },
  assessment: { en: "Skill check", th: "ผลประเมินทักษะ" },
  plan: { en: "Learning plan", th: "แผนการเรียน" },
  unconfigured: { en: "Not set up", th: "ยังไม่ได้ตั้งค่า" },
  configured: { en: "Set up", th: "ตั้งค่าแล้ว" },
  verified: { en: "Tested in sandbox", th: "ทดสอบใน Sandbox แล้ว" },
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
                ? th ? "เกินกำหนด" : "Overdue"
                : th
                  ? `เหลือ ${daysLeft} วัน`
                  : `Due in ${daysLeft}d`}
            </Badge>
          )}
          <Status value={approval.status} lang={lang} />
        </div>
      </div>

      {approval.kind === "assessment" && <LearningContextSummary lang={lang} assessment={record.assessment} forManager />}
      {approval.kind === "assessment" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-[1fr_48px_56px_108px] items-center gap-1 border-b border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-3">
            <span>{th ? "ทักษะ" : "Skill"}</span>
            <span className="text-center">{th ? "ประเมินตนเอง" : "Self"}</span>
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
                        {th ? "ปรับแล้ว" : "Adjusted"}
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
            {th ? "หลักฐานจากพนักงาน" : "Evidence from employee"}
          </p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">
            {evidence ||
              (th ? "โหลดหลักฐานไม่ได้ โปรดอัปเดตข้อมูลก่อนตัดสินใจ" : "Couldn't load the evidence. Refresh before you decide.")}
          </p>
        </div>
      )}

      {approval.status === "pending" && (
        <div className="mt-4 space-y-3">
          {isCalibrated && (
            <p className="rounded-xl bg-gap-soft px-3 py-2 text-xs font-medium text-gap">
              {th ? "คุณปรับระดับทักษะแล้ว โปรดใส่เหตุผลสั้นๆ ด้านล่างก่อนอนุมัติ" : "You changed a skill level. Add a short reason below before approving."}
            </p>
          )}
          <label className="block text-sm font-medium" htmlFor={`approval-note-${approval.id}`}>
            {th ? "หมายเหตุ (จำเป็นเมื่อปรับระดับหรือขอให้แก้ไข)" : "Note (required if you adjust a level or request changes)"}
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
          <p className="text-xs text-ink-3">{th ? "ลูกทีม" : "Direct reports"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-ink">{team.length}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "รอคุณอนุมัติ" : "Waiting for you"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-brand">
            {pendingApprovals.length}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "ทันกำหนด" : "On time"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-ok">{withinSla}</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-ink-3">{th ? "เกินกำหนด" : "Overdue"}</p>
          <p className="font-display mt-1 text-2xl font-bold tabular-nums text-danger">{overdueCount}</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{th ? "ทีมของฉัน" : "My team"}</h2>
            <p className="mt-1 text-sm text-ink-2">
              {th ? "คุณเห็นเฉพาะลูกทีมปัจจุบัน แชตกับโค้ชของลูกทีมเป็นความลับและไม่แสดงที่นี่" : "You see only your current direct reports. Their coach chats stay private."}
            </p>
          </div>
          <Badge tone="neutral">
            <Icon name="lock" className="h-3 w-3" />
            {th ? "แชตโค้ชเป็นความลับ" : "Coach chats stay private"}
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
            {th ? "ยังไม่มีลูกทีม รายชื่อจะแสดงเมื่อ HR เชื่อมลูกทีมกับคุณแล้ว" : "No direct reports yet. Your team appears here once HR links them to you."}
          </p>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{th ? "รายการรออนุมัติ" : "To review"}</h2>
        <div className="flex gap-2">
          <Button variant={filter === "pending" ? "soft" : "ghost"} onClick={() => setFilter("pending")}>
            {th ? "รออนุมัติ" : "Pending"}
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
          <p className="text-sm text-ink-2">{th ? "ไม่มีรายการให้อนุมัติ" : "Nothing to review here."}</p>
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
            {th ? "แบบจำลองการวางแผน Wave 1 (12,000 คน) · ข้อมูลจำลอง ไม่ใช่ข้อมูลจริง" : "Wave 1 planning model (12,000 staff) · simulated, not live data"}
          </Badge>
          <h3 className="mt-2 text-base font-bold text-ink">
            {th ? "เป้าหมายสัปดาห์ที่ 8 สำหรับการประชุมผู้บริหาร (จำลอง)" : "Week 8 targets for the leadership forum (simulated)"}
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
                ? th ? "สัปดาห์ 8 (จำลอง)" : "Week 8 (simulated)"
                : th ? "จุดเริ่มต้น สัปดาห์ 0" : "Week 0 baseline"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
          <p className="text-xs font-semibold text-ink">
            {th ? "การใช้งานถึงสัปดาห์ที่ 8 (12,000 คน, จำลอง)" : "Week 8 adoption funnel (12,000 staff, simulated)"}
          </p>
          <div className="mt-3 space-y-2.5 text-xs">
            {(
              [
                [th ? "เข้าสู่ระบบแล้ว" : "Signed in", last.activated, "#0c6368"],
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
            {th ? "สัดส่วนทักษะถึงเกณฑ์แยกตามหน่วยธุรกิจ (จำลอง)" : "Skill readiness by business unit and category (simulated)"}
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

// Totals only: helpfulness ratings and "no approved source" answers, never chat text.
function CoachQualityCard({ stats, lang }: { stats: NonNullable<OrgMetrics["coach"]>; lang: Lang }) {
  const th = lang === "th";
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");
  const items = [
    { label: th ? "ได้รับคะแนนว่ามีประโยชน์" : "Rated helpful", value: pct(stats.helpful, stats.rated), sub: th ? `จาก ${stats.rated} คำตอบที่มีคนให้คะแนน` : `of ${stats.rated} rated answers` },
    { label: th ? "ส่งตรวจทานรายสัปดาห์" : "Flagged for weekly review", value: String(stats.rated - stats.helpful), sub: th ? "คำตอบที่ถูกกดว่าไม่มีประโยชน์" : "answers marked not helpful" },
    { label: th ? "ไม่พบแหล่งข้อมูลที่อนุมัติ" : "No approved source", value: pct(stats.noSource, stats.answers), sub: th ? `จาก ${stats.answers} คำตอบทั้งหมด` : `of ${stats.answers} answers` },
  ];
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-ink">{th ? "คุณภาพโค้ช AI" : "AI coach quality"}</h3>
        <Badge tone="neutral">{th ? "ตัวเลขรวม ไม่มีข้อความแชต" : "Totals only, no chat text"}</Badge>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-xs text-ink-3">{item.label}</p>
            <p className="font-display mt-1 text-2xl font-bold tabular-nums text-ink">{item.value}</p>
            <p className="mt-0.5 text-xs text-ink-3">{item.sub}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-3">
        {th
          ? "ผู้เชี่ยวชาญตรวจคำตอบที่ถูกแจ้งทุกสัปดาห์ และสัดส่วน \"ไม่พบแหล่งข้อมูล\" ที่สูงบอกว่าเนื้อหาส่วนไหนยังขาดอยู่"
          : "Subject experts review flagged answers every week, and a high \"no approved source\" rate shows where content is missing."}
      </p>
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
          {th ? "ยังไม่มีตัวเลขภาพรวมที่แสดงได้ กลุ่มที่มีน้อยกว่า 10 คนจะถูกซ่อนเพื่อปกป้องความเป็นส่วนตัว" : "No organisation figures to show yet. Groups under 10 people are hidden to protect privacy."}
        </p>
      </Card>
    );

  const total = Math.max(1, metrics.employees);
  const unassessed = Math.max(0, metrics.employees - metrics.assessed);
  const measures = [
    {
      name: th ? "พนักงาน" : "Employees",
      value: metrics.employees,
      sub: th ? `${unassessed} คนยังไม่ได้ประเมิน` : `${unassessed} not yet assessed`,
      bar: 1,
    },
    {
      name: th ? "ประเมินแล้ว" : "Assessed",
      value: metrics.assessed,
      sub: `${Math.round((metrics.assessed / total) * 100)}% ${th ? "ของพนักงานที่มีสิทธิ์ใช้งาน" : "of staff with access"}`,
      bar: metrics.assessed / total,
    },
    {
      name: th ? "อนุมัติผลประเมิน" : "Assessments approved",
      value: metrics.approved,
      sub: `${Math.round((metrics.approved / total) * 100)}% ${th ? "อนุมัติโดยหัวหน้า" : "approved by managers"}`,
      bar: metrics.approved / total,
    },
    {
      name: th ? "แผนที่กำลังเรียน" : "Active plans",
      value: metrics.plansActive,
      sub: `${Math.round((metrics.plansActive / total) * 100)}% ${th ? "เรียนตามแผนที่อนุมัติแล้ว" : "learning on an approved plan"}`,
      bar: metrics.plansActive / total,
    },
    {
      name: th ? "กิจกรรมที่เรียนจบ (ยืนยันแล้ว)" : "Completed steps (verified)",
      value: metrics.completedSteps,
      sub: th ? "ยืนยันโดย Moodle หรือหัวหน้า" : "confirmed by Moodle or a manager",
      bar: Math.min(1, metrics.completedSteps / 10),
    },
    {
      name: th ? "รออนุมัติ" : "Pending approvals",
      value: metrics.pendingApprovals,
      sub: th ? "รอหัวหน้าตัดสินใจ" : "waiting for a manager decision",
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
            {th ? "คำนวณจากข้อมูลสมมติ ผู้บริหารเห็นเฉพาะภาพรวมกลุ่ม ไม่เห็นข้อมูลรายบุคคล" : "Calculated from synthetic data. Leaders see group totals only, never individual records."}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowSim((v) => !v)}>
          {showSim
            ? th ? "ซ่อนเป้าหมาย Wave 1 (จำลอง)" : "Hide Wave 1 targets (simulated)"
            : th ? "ดูเป้าหมาย Wave 1 (จำลอง)" : "Show Wave 1 targets (simulated)"}
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
              {th ? "กลุ่มที่มีน้อยกว่า 10 คนจะถูกซ่อนเพื่อปกป้องความเป็นส่วนตัว" : "Groups under 10 people are hidden to protect privacy."}{" "}
              {metrics.suppressedGroups > 0 &&
                `${th ? "กลุ่มที่ซ่อนไว้" : "Groups hidden"}: ${metrics.suppressedGroups}`}
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
            {th ? "ยังไม่มีกลุ่มที่มีตั้งแต่ 10 คนขึ้นไป จึงยังไม่แสดงข้อมูล" : "No group has 10 or more people yet, so nothing is shown."}
          </p>
        )}
      </Card>

      {showSim && <Wave1SimulationPreview lang={lang} />}

      {metrics.coach && <CoachQualityCard stats={metrics.coach} lang={lang} />}

      <Card>
        <Badge tone="neutral">
          {th ? "วิธีวัดผลต่อธุรกิจ · ยังไม่ได้พิสูจน์" : "How we'll measure impact · not yet proven"}
        </Badge>
        <h3 className="mt-3 font-semibold text-ink">
          {th ? "เชื่อมการเรียนกับผลลัพธ์งาน" : "Connect learning to work outcomes"}
        </h3>
        <p className="mt-2 text-sm text-ink-2">
          {th ? "กำหนดค่าตั้งต้นและกลุ่มเปรียบเทียบ แล้วติดตามคุณภาพบริการ ความผิดพลาด และเวลาที่ใช้จนทำงานได้คล่อง ตัวเลขการเรียนด้านบนยังไม่ใช่หลักฐานว่าธุรกิจดีขึ้นเพราะการเรียน" : "Set a baseline and a comparison group, then track service quality, errors and time to proficiency. The learning numbers above don't prove business impact on their own."}
        </p>
      </Card>
    </div>
  );
}

// Reader-facing names and descriptions for the seeded connection ids; stored labels are technical.
const CONNECTION_COPY: Record<string, { label: Bilingual; detail: Bilingual }> = {
  clerk: {
    label: { en: "Sign-in (Clerk)", th: "การเข้าสู่ระบบ (Clerk)" },
    detail: {
      en: "Confirms who you are with Google or a case-study email. What you can see comes from the role given to your account, not from Google.",
      th: "ยืนยันตัวตนด้วย Google หรืออีเมลกรณีศึกษา สิ่งที่คุณเห็นขึ้นอยู่กับบทบาทของบัญชี ไม่ได้มาจาก Google",
    },
  },
  hr: {
    label: { en: "HR data (test service)", th: "ข้อมูล HR (ระบบทดสอบ)" },
    detail: {
      en: "Sends new joiners, manager changes and leavers. A synthetic test service, not the client's HR system.",
      th: "ส่งข้อมูลพนักงานใหม่ การเปลี่ยนหัวหน้า และพนักงานที่ลาออก เป็นระบบทดสอบที่ใช้ข้อมูลสมมติ ไม่ใช่ระบบ HR จริงของลูกค้า",
    },
  },
  "moodle-a": {
    label: { en: "LMS A (Moodle test site)", th: "LMS A (Moodle ทดสอบ)" },
    detail: {
      en: "Course catalogue, enrolment and completions. A local test site, not the client's LMS.",
      th: "รายการหลักสูตร การลงทะเบียน และผลการเรียนจบ เป็นระบบทดสอบ ไม่ใช่ LMS จริงของลูกค้า",
    },
  },
  "moodle-b": {
    label: { en: "LMS B (Moodle test site)", th: "LMS B (Moodle ทดสอบ)" },
    detail: {
      en: "Course catalogue, enrolment and completions. A local test site, not the client's LMS.",
      th: "รายการหลักสูตร การลงทะเบียน และผลการเรียนจบ เป็นระบบทดสอบ ไม่ใช่ LMS จริงของลูกค้า",
    },
  },
};

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
            {th ? "ระบบที่เชื่อมต่อ" : "Connected systems"}
          </h2>
          <Badge tone="brand">
            <Icon name="shield" className="h-3 w-3" />
            {th ? "สถานะจากเซิร์ฟเวอร์" : "Live from the server"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-ink-2">
          {th
            ? "สถานะล่าสุดของแต่ละระบบ การเชื่อมต่อ HR และ Moodle เป็นระบบทดสอบ ไม่ใช่ระบบจริงของลูกค้า และ Moodle ใช้การเข้าสู่ระบบแยกต่างหาก"
            : "The latest status of each system. The HR and Moodle connections are test systems, not the client's live systems, and Moodle has its own sign-in."}
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
                <h3 className="font-semibold text-ink">{CONNECTION_COPY[integration.id]?.label[lang] ?? integration.label}</h3>
              </div>
              <Status value={integration.status} lang={lang} />
            </div>
            <p className="mt-3 text-sm text-ink-2">{CONNECTION_COPY[integration.id]?.detail[lang] ?? integration.detail}</p>
            {integration.status === "error" && CONNECTION_COPY[integration.id] && (
              <p className="mt-2 text-xs text-danger">{integration.detail}</p>
            )}
            {integration.lastSuccess && (
              <p className="mt-3 text-xs text-ink-3">
                {th ? "ตรวจสอบสำเร็จล่าสุด" : "Last successful check"}:{" "}
                {new Date(integration.lastSuccess).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
              </p>
            )}
          </Card>
        ))}
      </div>
      {integrations.length === 0 && (
        <Card>
          <p className="text-sm text-ink-3">
            {th ? "ยังไม่มีข้อมูลสถานะการเชื่อมต่อ" : "No connection status yet."}
          </p>
        </Card>
      )}
    </div>
  );
}
