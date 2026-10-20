"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import { DEFAULT_LEARNING_MINUTES } from "@/data/certificates";
import { roleById, skillById } from "@/data/taxonomy";
import type { LearningRecord, SuiteCommand } from "@/lib/suite-contracts";
import type { Bilingual, Lang, Level, Role } from "@/lib/types";
import { progressNudge } from "@/lib/coach/nudge";
import { SecureCoach, type SendCoach } from "./secure-coach";
import { LearningContextFields, LearningContextSummary } from "./secure-learning-context";
import { Avatar, Badge, Button, Card, cx, Icon, LevelDots, Ring } from "./kit";

type Command = (command: SuiteCommand) => Promise<void>;
type JourneyProps = { record: LearningRecord; lang: Lang; busy: boolean; command: Command; generate: () => Promise<void>; coach: SendCoach };
const labels: Record<string, Bilingual> = {
  not_started: { en: "Not started", th: "ยังไม่เริ่ม" }, submitted: { en: "Awaiting approval", th: "รออนุมัติ" }, approved: { en: "Approved", th: "อนุมัติแล้ว" }, changes_requested: { en: "Changes requested", th: "ขอให้แก้ไข" }, draft: { en: "Draft", th: "ฉบับร่าง" }, pending: { en: "Awaiting approval", th: "รออนุมัติ" }, todo: { en: "To do", th: "ยังไม่เริ่ม" }, in_progress: { en: "In progress", th: "กำลังเรียน" }, done: { en: "Completed", th: "เรียนจบแล้ว" }, video: { en: "Video / lesson", th: "วิดีโอ / บทเรียน" }, workshop: { en: "Workshop", th: "เวิร์กช็อป" }, project: { en: "Work project", th: "โปรเจกต์หน้างาน" }, assessment: { en: "Skill check", th: "ผลประเมินทักษะ" }, plan: { en: "Learning plan", th: "แผนการเรียน" }, unconfigured: { en: "Not set up", th: "ยังไม่ได้ตั้งค่า" }, configured: { en: "Set up", th: "ตั้งค่าแล้ว" }, verified: { en: "Tested in sandbox", th: "ทดสอบใน Sandbox แล้ว" }, error: { en: "Connection error", th: "การเชื่อมต่อขัดข้อง" },
};
const LEVEL_TAG: Record<number, Bilingual> = {
  1: { en: "Foundation", th: "พื้นฐาน" },
  2: { en: "Independent", th: "ทำได้ด้วยตนเอง" },
  3: { en: "Coach others", th: "สอนงานทีมได้" },
  4: { en: "Role model", th: "ต้นแบบมาตรฐาน" },
};
const FORMAT_MIX: Record<"video" | "workshop" | "project", { pct: string; en: string; th: string }> = {
  video: { pct: "10%", en: "10% Lesson", th: "10% บทเรียน" },
  workshop: { pct: "20%", en: "20% Workshop", th: "20% เวิร์กช็อป" },
  project: { pct: "70%", en: "70% On-the-Job", th: "70% ลงมือทำจริง" },
};
function label(value: string, lang: Lang) { return labels[value]?.[lang] ?? value; }
function Status({ value, lang }: { value: string; lang: Lang }) { return <Badge tone={["approved", "done", "verified"].includes(value) ? "ok" : ["changes_requested", "error"].includes(value) ? "danger" : ["submitted", "pending", "in_progress"].includes(value) ? "warn" : "neutral"}>{label(value, lang)}</Badge>; }
function skillsFor(record: LearningRecord) { return [...new Set([record.employee.roleId, record.employee.nextRoleId].filter((id): id is string => !!id).flatMap(id => roleById(id)?.requirements.map(req => req.skillId) ?? []))]; }
function levelFor(record: LearningRecord, id: string): Level { return record.overrides[id] ?? record.assessment.final?.[id] ?? record.employee.scores[id]?.final ?? 1; }
function readiness(record: LearningRecord, role: Role | undefined) { return role?.requirements.length ? Math.round(role.requirements.filter(req => levelFor(record, req.skillId) >= req.level).length / role.requirements.length * 100) : 0; }
function targetLevelForSkill(record: LearningRecord, skillId: string): Level {
  const nextRole = record.employee.nextRoleId ? roleById(record.employee.nextRoleId) : undefined;
  const curRole = roleById(record.employee.roleId);
  return nextRole?.requirements.find(r => r.skillId === skillId)?.level ?? curRole?.requirements.find(r => r.skillId === skillId)?.level ?? 2;
}

const QUESTIONS = [
  { skillId: "T-CMPL", q: { en: "A customer is angry about a broken fan. What do you do first?", th: "ลูกค้าโกรธเรื่องพัดลมเสีย คุณควรทำอะไรก่อน" }, options: [{ en: "Explain the returns policy", th: "อธิบายนโยบายการคืนสินค้า" }, { en: "Listen without interrupting, then repeat the main point", th: "ฟังโดยไม่ขัดจังหวะ แล้วทวนประเด็นหลัก" }, { en: "Call the store manager straight away", th: "เรียกผู้จัดการสาขาทันที" }] },
  { skillId: "L-COACH", q: { en: "A new colleague keeps closing the till wrongly. Best way to coach?", th: "พนักงานใหม่ปิดเครื่องคิดเงินผิดซ้ำๆ วิธีโค้ชที่ดีที่สุดคือ" }, options: [{ en: "Do it for them so the queue moves", th: "ทำให้เขาเลยเพื่อให้คิวเดินเร็ว" }, { en: "Send them the manual", th: "ส่งคู่มือให้อ่าน" }, { en: "Show, let them try while you watch, then give feedback", th: "สาธิต ให้ลองทำขณะที่คุณดู แล้วให้ฟีดแบ็ก" }] },
  { skillId: "T-INV", q: { en: "A cycle count shows a 5% variance on hair dryers. What next?", th: "การนับสต็อกพบส่วนต่าง 5% ในไดร์เป่าผม ควรทำอย่างไรต่อ" }, options: [{ en: "Adjust the stock to match the count", th: "ปรับยอดสต็อกให้ตรงกับที่นับได้" }, { en: "Check recent receiving, transfers and returns before adjusting", th: "ตรวจการรับสินค้า การโอน และการคืนล่าสุดก่อนปรับยอด" }, { en: "Ignore it until the yearly count", th: "รอไว้จนถึงการนับประจำปี" }] },
];

function Profile({ record, lang, onAskCoach }: Pick<JourneyProps, "record" | "lang"> & { onAskCoach?: () => void }) {
  const th = lang === "th";
  const current = roleById(record.employee.roleId);
  const next = record.employee.nextRoleId ? roleById(record.employee.nextRoleId) : undefined;
  const [target, setTarget] = useState<"current" | "next">("current");
  const [skillFilter, setSkillFilter] = useState<"all" | "gaps" | "met">("all");
  const [expandedSkill, setExpandedSkill] = useState<string>();
  const role = target === "next" && next ? next : current;
  const reqs = role?.requirements ?? [];
  const gapCount = reqs.filter(r => levelFor(record, r.skillId) < r.level).length;
  const metCount = reqs.length - gapCount;
  const filteredReqs = reqs.filter(r => {
    const gap = Math.max(0, r.level - levelFor(record, r.skillId));
    return skillFilter === "gaps" ? gap > 0 : skillFilter === "met" ? gap === 0 : true;
  });
  return <Card>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3.5">
        <Avatar name={record.employee.name[lang]} size="lg" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">{th ? "เส้นทางการเติบโต" : "Your growth"}</p>
          <h2 className="mt-1 text-xl font-bold">{current?.title[lang] ?? record.employee.roleId}</h2>
          <p className="mt-1 text-sm text-ink-2">{record.employee.site[lang]}</p>
          {next && <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-1 text-xs text-ink-2 ring-1 ring-inset ring-line">{th ? "เป้าหมายถัดไป" : "Next goal"}: <strong className="text-ink">{next.title[lang]}</strong></p>}
        </div>
      </div>
      <div className="flex gap-6"><div className="text-center"><Ring value={readiness(record, current) / 100} /><p className="mt-1 text-xs text-ink-3">{th ? "บทบาทปัจจุบัน" : "Current role"}</p></div>{next && <div className="text-center"><Ring value={readiness(record, next) / 100} /><p className="mt-1 text-xs text-ink-3">{th ? "บทบาทถัดไป" : "Next role"}</p></div>}</div>
    </div>
    <p className="mt-3 text-xs text-ink-3">{record.assessment.status === "approved" ? (th ? "อิงผลที่หัวหน้าอนุมัติและการเรียนที่จบแล้ว" : "Based on manager-approved results and completed learning") : (th ? "ค่าประมาณเริ่มต้น ทำแบบประเมินทักษะและรอหัวหน้าอนุมัติเพื่อดูระดับจริงของคุณ" : "Starting estimate. Finish your skill check and get it approved to see your real level.")}</p>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
      <div className="flex gap-2" role="group" aria-label={th ? "เลือกบทบาทเพื่อดูทักษะ" : "Choose a role to see its skills"}>{(["current", ...(next ? ["next"] : [])] as const).map(value => <Button key={value} variant={target === value ? "soft" : "ghost"} aria-pressed={target === value} onClick={() => setTarget(value as "current" | "next")}>{value === "current" ? (th ? "ทักษะบทบาทปัจจุบัน" : "Current-role skills") : (th ? "ทักษะบทบาทถัดไป" : "Next-role skills")}</Button>)}</div>
      <div className="flex flex-wrap gap-1.5">
        {([["all", th ? `ทั้งหมด (${reqs.length})` : `All (${reqs.length})`], ["gaps", th ? `ยังขาด (${gapCount})` : `Gaps (${gapCount})`], ["met", th ? `ถึงเกณฑ์ (${metCount})` : `Met (${metCount})`]] as const).map(([id, text]) => (
          <button key={id} type="button" onClick={() => setSkillFilter(id)} className={cx("rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer", skillFilter === id ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}>{text}</button>
        ))}
      </div>
    </div>
    <div className="mt-3 divide-y divide-line">{filteredReqs.map(req => {
      const sk = skillById(req.skillId);
      const curLvl = levelFor(record, req.skillId);
      const gap = Math.max(0, req.level - curLvl);
      const isOpen = expandedSkill === req.skillId;
      return <div key={req.skillId} className="py-3">
        <button type="button" onClick={() => setExpandedSkill(isOpen ? undefined : req.skillId)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-4 text-left cursor-pointer">
          <div>
            <p className="text-sm font-medium">{sk?.name[lang] ?? req.skillId}{req.critical && <span className="ml-2 text-xs text-gap">{th ? "สำคัญ" : "Critical"}</span>}</p>
            <p className="mt-1 text-xs text-ink-3">{th ? "ปัจจุบัน" : "Current"} L{curLvl} · {th ? "เป้าหมาย" : "Target"} L{req.level}</p>
          </div>
          <div className="flex items-center gap-2.5">
            {gap > 0 ? <Badge tone="gap">{th ? `ขาดอีก ${gap} ระดับ` : `${gap} to go`}</Badge> : <Badge tone="ok">{th ? "ถึงเกณฑ์" : "Met"}</Badge>}
            <LevelDots current={curLvl} required={req.level} />
          </div>
        </button>
        {isOpen && sk && (
          <div className="animate-fade-in mt-3 space-y-1.5 rounded-xl bg-surface-2 p-3 text-xs text-ink-2 ring-1 ring-inset ring-line">
            <p className="mb-1.5 text-[11px] text-ink-3">{sk.description[lang]}</p>
            {sk.levels.map((lv, idx) => {
              const lvl = idx + 1;
              const isCurrent = lvl === curLvl;
              const isTarget = lvl === req.level;
              return <div key={lvl} className={cx("flex items-start justify-between gap-2 rounded-lg px-2.5 py-1.5", isCurrent && "bg-brand-soft/80 font-semibold text-brand", isTarget && !isCurrent && "bg-gap-soft/80 font-semibold text-gap")}>
                <span className="flex gap-2"><strong className="font-display shrink-0 tabular-nums">L{lvl}:</strong><span>{lv[lang]}</span></span>
                {isCurrent ? <Badge tone="brand">{th ? "ปัจจุบัน" : "Current"}</Badge> : isTarget ? <Badge tone="gap">{th ? "เป้าหมาย" : "Target"}</Badge> : null}
              </div>;
            })}
            {onAskCoach && <Button variant="ghost" className="mt-1 text-xs" onClick={onAskCoach}><Icon name="coach" className="h-3.5 w-3.5" />{th ? "ถามโค้ชเรื่องทักษะนี้ →" : "Ask the coach about this skill →"}</Button>}
          </div>
        )}
      </div>;
    })}</div>
  </Card>;
}

function Assessment({ record, lang, busy, command }: Pick<JourneyProps, "record" | "lang" | "busy" | "command">) {
  const th = lang === "th";
  const ids = skillsFor(record);
  const [self, setSelf] = useState<Record<string, Level>>(() => {
    const initial: Record<string, Level> = { ...record.assessment.self };
    for (const id of ids) if (!initial[id] && record.employee.scores[id]?.self) initial[id] = record.employee.scores[id].self;
    return initial;
  });
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [mode, setMode] = useState<"wizard" | "all">("wizard");
  const [minutes, setMinutes] = useState<number>(record.assessment.minutesPerMonth ?? DEFAULT_LEARNING_MINUTES);
  const [certificates, setCertificates] = useState<string[]>(record.assessment.certificates ?? []);
  const [stepIndex, setStepIndex] = useState(0);
  const editable = ["not_started", "changes_requested"].includes(record.assessment.status);
  const ready = ids.length > 0 && ids.every(id => self[id]) && QUESTIONS.every((_, i) => Number.isInteger(answers[i]));
  const totalWizardSteps = ids.length + QUESTIONS.length + 1;
  const fillSample = () => {
    const filled: Record<string, Level> = {};
    for (const id of ids) filled[id] = self[id] ?? record.employee.scores[id]?.self ?? 2;
    setSelf(filled);
    setAnswers([1, 2, 1]);
    setStepIndex(totalWizardSteps - 1);
  };
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><h2 className="text-lg font-bold">{th ? "ประเมินทักษะ" : "Skill check"}</h2><Status value={record.assessment.status} lang={lang} /></div>
      {editable && <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={fillSample} disabled={busy} className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white cursor-pointer">{th ? "กรอกคำตอบตัวอย่าง (เดโม)" : "Fill in sample answers (demo)"}</button>
        <button type="button" onClick={() => setMode(m => m === "wizard" ? "all" : "wizard")} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2 hover:text-ink cursor-pointer">{mode === "wizard" ? (th ? "แสดงทั้งหมดในหน้าเดียว" : "Show all on one page") : (th ? "ทีละข้อ" : "One question at a time")}</button>
      </div>}
    </div>
    <p className="mt-2 text-sm text-ink-2">{th ? "ให้คะแนนตัวเองในทักษะของบทบาทปัจจุบันและบทบาทถัดไป แล้วตอบคำถามสถานการณ์สั้นๆ 3 ข้อ ใช้เวลาประมาณ 5 นาที จากนั้นหัวหน้าจะตรวจผลให้ค่ะ" : "Rate yourself on the skills for your current and next role, then answer 3 short scenarios. It takes about 5 minutes, then your manager reviews the results."}</p>
    {record.assessment.managerNote && <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">{th ? "หมายเหตุจากหัวหน้า" : "Note from your manager"}: {record.assessment.managerNote}</p>}
    {editable ? (
      mode === "wizard" ? (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs text-ink-3">
            <span className="font-semibold text-ink">
              {stepIndex < ids.length ? (th ? `ขั้นที่ 1/3 · ให้คะแนนทักษะ (${stepIndex + 1}/${ids.length})` : `Step 1 of 3 · Rate your skills (${stepIndex + 1}/${ids.length})`) : stepIndex < ids.length + QUESTIONS.length ? (th ? `ขั้นที่ 2/3 · คำถามสถานการณ์ (${stepIndex - ids.length + 1}/${QUESTIONS.length})` : `Step 2 of 3 · Scenarios (${stepIndex - ids.length + 1}/${QUESTIONS.length})`) : (th ? "ขั้นที่ 3/3 · ตรวจทานแล้วส่งให้หัวหน้า" : "Step 3 of 3 · Review and send")}
            </span>
            <span className="font-display tabular-nums">{stepIndex + 1} / {totalWizardSteps}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all duration-300" style={{ width: `${Math.min(100, ((stepIndex + 1) / Math.max(1, ids.length)) * 100)}%` }} /></div>
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all duration-300" style={{ width: `${stepIndex < ids.length ? 0 : Math.min(100, ((stepIndex - ids.length + 1) / QUESTIONS.length) * 100)}%` }} /></div>
            <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all duration-300" style={{ width: stepIndex >= ids.length + QUESTIONS.length ? "100%" : "0%" }} /></div>
          </div>
          {stepIndex < ids.length ? (() => {
            const skillId = ids[stepIndex];
            const skill = skillById(skillId);
            const reqLvl = targetLevelForSkill(record, skillId);
            return <div key={skillId} className="animate-fade-in mt-4 rounded-2xl border border-line bg-surface-2/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="brand">{th ? `ระดับเป้าหมาย: L${reqLvl}` : `Target: L${reqLvl}`}</Badge><span className="font-display text-xs text-ink-3">{skillId}</span></div>
              <h3 className="mt-2.5 text-lg font-bold text-ink">{skill?.name[lang] ?? skillId}</h3>
              {skill?.description && <p className="mt-1 text-xs text-ink-2">{skill.description[lang]}</p>}
              <div className="mt-4 space-y-2.5">{([1, 2, 3, 4] as const).map(level => {
                const selected = self[skillId] === level;
                return <button key={level} type="button" disabled={busy} onClick={() => { setSelf(cur => ({ ...cur, [skillId]: level })); setStepIndex(i => Math.min(totalWizardSteps - 1, i + 1)); }} className={cx("flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left text-sm transition-all cursor-pointer active:scale-[0.99]", selected ? "border-brand bg-brand-soft shadow-xs" : "border-line bg-surface hover:border-brand/40")}>
                  <span className={cx("font-display mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-bold tabular-nums", selected ? "bg-brand text-white" : "bg-surface-2 text-brand ring-1 ring-inset ring-line")}>L{level}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink-3">{LEVEL_TAG[level]?.[lang]}</span>{level === reqLvl && <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">{th ? "ระดับเป้าหมาย" : "Role target"}</span>}</div>
                    <p className="mt-0.5 text-sm leading-snug text-ink">{skill?.levels[level - 1]?.[lang]}</p>
                  </div>
                </button>;
              })}</div>
            </div>;
          })() : stepIndex < ids.length + QUESTIONS.length ? (() => {
            const qIdx = stepIndex - ids.length;
            const question = QUESTIONS[qIdx];
            const sk = skillById(question.skillId);
            return <div key={qIdx} className="animate-fade-in mt-4 rounded-2xl border border-line bg-surface-2/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone="gap">{th ? `คำถามสถานการณ์ ${qIdx + 1}/${QUESTIONS.length}` : `Scenario ${qIdx + 1}/${QUESTIONS.length}`}</Badge>{sk && <span className="text-xs font-medium text-ink-3">{sk.name[lang]}</span>}</div>
              <h3 className="mt-2.5 text-base font-bold leading-snug text-ink">{question.q[lang]}</h3>
              <div className="mt-4 space-y-2.5">{question.options.map((option, choice) => {
                const selected = answers[qIdx] === choice;
                return <button key={choice} type="button" disabled={busy} onClick={() => { setAnswers(cur => { const next = [...cur]; next[qIdx] = choice; return next; }); setStepIndex(i => Math.min(totalWizardSteps - 1, i + 1)); }} className={cx("flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left text-sm transition-all cursor-pointer active:scale-[0.99]", selected ? "border-brand bg-brand-soft shadow-xs" : "border-line bg-surface hover:border-brand/40")}>
                  <span className={cx("font-display mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", selected ? "bg-brand text-white" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line")}>{String.fromCharCode(65 + choice)}</span>
                  <span className="leading-snug text-ink">{option[lang]}</span>
                </button>;
              })}</div>
            </div>;
          })() : (
            <div className="animate-fade-in mt-4 space-y-4">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="grid grid-cols-[1fr_72px_72px] items-center border-b border-line bg-surface-2 px-3.5 py-2 text-[11px] font-semibold text-ink-3">
                  <span>{th ? "ทักษะ" : "Skill"}</span><span className="text-center">{th ? "ประเมินตนเอง" : "Self"}</span><span className="text-right">{th ? "เป้าหมาย" : "Target"}</span>
                </div>
                <div className="divide-y divide-line">{ids.map((id, idx) => (
                  <button key={id} type="button" onClick={() => setStepIndex(idx)} className="grid w-full grid-cols-[1fr_72px_72px] items-center px-3.5 py-2.5 text-left text-xs hover:bg-surface-2 cursor-pointer">
                    <span className="truncate font-medium text-ink">{skillById(id)?.name[lang] ?? id}</span>
                    <span className="text-center font-display font-bold tabular-nums text-brand">{self[id] ? `L${self[id]}` : "—"}</span>
                    <span className="text-right font-display tabular-nums text-ink-3">L{targetLevelForSkill(record, id)}</span>
                  </button>
                ))}</div>
              </div>
              <LearningContextFields lang={lang} skillIds={ids} minutes={minutes} onMinutes={setMinutes} certificates={certificates} onCertificates={setCertificates} disabled={busy} />
              <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3 text-xs text-ink-2 ring-1 ring-inset ring-line"><Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span>{th ? "ระบบจะรวมคะแนนของคุณกับคำตอบสถานการณ์ แล้วส่งให้หัวหน้าอนุมัติ ผลประเมินใช้เพื่อการพัฒนาเท่านั้น ไม่มีผลต่อเงินเดือนหรือการเลื่อนตำแหน่งค่ะ" : "We combine your ratings with your scenario answers and send the result to your manager. Results are for development only, never pay or promotion."}</span></div>
              <Button type="button" disabled={busy || !ready} onClick={() => ready && void command({ type: "assessment.submit", self, answers: answers as number[], minutesPerMonth: minutes, certificates })} className="w-full">{th ? "ส่งให้หัวหน้า" : "Send to my manager"}</Button>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
            <Button variant="outline" disabled={stepIndex === 0 || busy} onClick={() => setStepIndex(i => Math.max(0, i - 1))}>← {th ? "ก่อนหน้า" : "Previous"}</Button>
            {stepIndex < totalWizardSteps - 1 && <Button variant="soft" disabled={busy} onClick={() => setStepIndex(i => Math.min(totalWizardSteps - 1, i + 1))}>{th ? "ถัดไป" : "Next"} →</Button>}
          </div>
        </div>
      ) : (
        <form className="mt-5" onSubmit={event => { event.preventDefault(); if (ready) void command({ type: "assessment.submit", self, answers: answers as number[], minutesPerMonth: minutes, certificates }); }}>
          <div className="space-y-4">{ids.map(id => { const skill = skillById(id); return <fieldset key={id} disabled={busy} className="rounded-xl border border-line p-3"><legend className="px-1 text-sm font-semibold">{skill?.name[lang] ?? id}</legend><div className="grid gap-2 sm:grid-cols-2">{([1, 2, 3, 4] as const).map(level => <label key={level} className={cx("flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-xs leading-relaxed", self[id] === level ? "border-brand bg-brand-soft" : "border-line")}><input type="radio" name={`skill-${id}`} value={level} checked={self[id] === level} onChange={() => setSelf(current => ({ ...current, [id]: level }))} required className="mt-1 accent-brand" /><span><strong>L{level}</strong> · {skill?.levels[level - 1]?.[lang]}</span></label>)}</div></fieldset>; })}</div>
          <div className="mt-5 space-y-4">{QUESTIONS.map((question, index) => <fieldset key={index} disabled={busy} className="rounded-xl border border-line p-3"><legend className="px-1 text-sm font-semibold">{index + 1}. {question.q[lang]}</legend><div className="space-y-2">{question.options.map((option, choice) => <label key={choice} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-surface-2 p-3 text-sm"><input type="radio" name={`question-${index}`} checked={answers[index] === choice} onChange={() => setAnswers(current => { const next = [...current]; next[index] = choice; return next; })} required className="mt-1 accent-brand" /><span>{option[lang]}</span></label>)}</div></fieldset>)}</div>
          <div className="mt-5"><LearningContextFields lang={lang} skillIds={ids} minutes={minutes} onMinutes={setMinutes} certificates={certificates} onCertificates={setCertificates} disabled={busy} /></div>
          <Button type="submit" disabled={busy || !ready} className="mt-5 w-full">{th ? "ส่งให้หัวหน้า" : "Send to my manager"}</Button>
        </form>
      )
    ) : <><div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface"><div className="grid grid-cols-[1fr_64px_64px_76px] items-center border-b border-line bg-surface-2 px-3.5 py-2 text-[11px] font-semibold text-ink-3"><span>{th ? "ทักษะ" : "Skill"}</span><span className="text-center">{th ? "ประเมินตนเอง" : "Self"}</span><span className="text-center">{th ? "สถานการณ์" : "Scenario"}</span><span className="text-right">{th ? "ที่อนุมัติ" : "Approved"}</span></div><div className="divide-y divide-line">{ids.map(id => <div key={id} className="grid grid-cols-[1fr_64px_64px_76px] items-center px-3.5 py-2.5 text-sm"><span className="truncate font-medium">{skillById(id)?.name[lang] ?? id}</span><span className="text-center font-display text-xs tabular-nums text-ink-2">L{record.assessment.self[id] ?? "—"}</span><span className="text-center font-display text-xs tabular-nums text-ink-3">{record.assessment.quiz[id] ? `L${record.assessment.quiz[id]}` : "—"}</span><span className="text-right">{record.assessment.final?.[id] ? <Badge tone="brand">L{record.assessment.final[id]}</Badge> : "—"}</span></div>)}</div></div><LearningContextSummary lang={lang} assessment={record.assessment} /></>}
  </Card>;
}

function LearningPlan({ record, lang, busy, command, generate, onOpen }: Omit<JourneyProps, "coach"> & { onOpen: (id: string) => void }) {
  const th = lang === "th";
  const plan = record.plan;
  const [format, setFormat] = useState<"all" | "video" | "workshop" | "project">("all");
  const counts = { video: 0, workshop: 0, project: 0 };
  for (const step of plan?.steps ?? []) { const it = itemById(step.itemId); if (it) counts[it.format]++; }
  return <Card><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h2 className="text-lg font-bold">{th ? "แผนการเรียนของฉัน" : "My learning plan"}</h2>{plan && <Badge tone={plan.generatedBy === "ai" ? "brand" : "neutral"}><Icon name="spark" className="h-3 w-3" />{plan.generatedBy === "ai" ? (th ? "จัดแผนด้วย AI" : "AI-sequenced") : (th ? "แผนตามกฎ" : "Rule-based plan")}</Badge>}</div>{plan && <Status value={plan.status} lang={lang} />}</div>
    {!plan ? <><p className="mt-3 text-sm text-ink-2">{th ? "เมื่อหัวหน้าอนุมัติผลประเมินแล้ว คุณสร้างแผนการเรียนได้เลย ระบบจะเลือกวิดีโอ เวิร์กช็อป และโปรเจกต์หน้างานจากคลังเนื้อหาที่อนุมัติแล้วค่ะ" : "Once your manager approves your skill check, build a plan of videos, workshops and work projects picked from approved courses."}</p><Button disabled={busy || record.assessment.status !== "approved"} onClick={() => void generate()} className="mt-4"><Icon name="spark" className="h-4 w-4" />{th ? "สร้างแผนการเรียน" : "Build my plan"}</Button>{record.assessment.status !== "approved" && <p className="mt-2 text-xs text-ink-3">{th ? "รอหัวหน้าอนุมัติผลประเมินก่อนนะคะ" : "Your manager needs to approve your skill check first."}</p>}</> : <>
      <p className="mt-3 text-sm text-ink-2">{plan.summary[lang]}</p><p className="mt-2 text-xs text-ink-3">{plan.generatedBy === "ai" ? (th ? "AI จัดลำดับจากเนื้อหาที่อนุมัติแล้ว" : "Ordered by AI from approved courses") : (th ? "สร้างตามกฎในโหมดเดโม ไม่ได้ใช้ AI จริง" : "Built by rules in demo mode, not by the live AI model")}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface-2 p-2.5 text-center text-xs">
        <div className="rounded-xl bg-surface p-2"><div className="font-display text-sm font-bold text-brand">70% · {counts.project}</div><div className="mt-0.5 text-[11px] text-ink-3">{label("project", lang)}</div></div>
        <div className="rounded-xl bg-surface p-2"><div className="font-display text-sm font-bold text-ink">20% · {counts.workshop}</div><div className="mt-0.5 text-[11px] text-ink-3">{label("workshop", lang)}</div></div>
        <div className="rounded-xl bg-surface p-2"><div className="font-display text-sm font-bold text-ink-2">10% · {counts.video}</div><div className="mt-0.5 text-[11px] text-ink-3">{label("video", lang)}</div></div>
      </div>
      {plan.managerNote && <p className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">{th ? "หมายเหตุจากหัวหน้า" : "Note from your manager"}: {plan.managerNote}</p>}
      {["draft", "changes_requested"].includes(plan.status) && <div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void command({ type: "plan.submit" })}>{th ? "ส่งแผนให้หัวหน้าอนุมัติ" : "Send plan to my manager"}</Button><Button variant="outline" disabled={busy} onClick={() => void generate()}>{th ? "สร้างแผนใหม่" : "Rebuild plan"}</Button></div>}
      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={th ? "กรองรูปแบบการเรียน" : "Filter learning formats"}>{(["all", "video", "workshop", "project"] as const).map(value => <Button key={value} variant={format === value ? "soft" : "ghost"} onClick={() => setFormat(value)} aria-pressed={format === value}>{value === "all" ? (th ? "ทั้งหมด" : "All") : label(value, lang)}</Button>)}</div>
      <ol className="relative mt-4 space-y-3 before:absolute before:top-5 before:bottom-5 before:left-[26px] before:w-[2px] before:bg-line">{plan.steps.filter(step => format === "all" || itemById(step.itemId)?.format === format).map(step => {
        const item = itemById(step.itemId);
        const sk = skillById(step.skillId);
        const mix = item ? FORMAT_MIX[item.format] : undefined;
        return <li key={step.itemId} className="relative"><article className="rounded-2xl border border-line bg-surface p-4 transition hover:border-brand/40">
          <div className="flex items-start gap-3.5">
            <div className={cx("relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-4 ring-surface", step.status === "done" ? "bg-ok-soft text-ok" : step.status === "in_progress" || step.status === "submitted" ? "bg-warn-soft text-warn" : "bg-brand-soft text-brand")}><Icon name={step.status === "done" ? "check" : (item?.format ?? "book")} className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5"><Badge tone="brand">{th ? "สัปดาห์" : "Week"} {step.week} · {item ? label(item.format, lang) : step.itemId}</Badge>{mix && <Badge tone="neutral">{th ? mix.th : mix.en}</Badge>}</div><Status value={step.status} lang={lang} /></div>
              <h3 className="mt-2 font-semibold">{item?.title[lang] ?? step.itemId}</h3>
              <p className="mt-1 text-xs text-ink-3">{item?.source} · {item?.minutes} {th ? "นาที" : "min"}{sk ? ` · ${sk.name[lang]}` : ""}</p>
              <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2"><strong className="font-semibold text-ink">{th ? "ทำไมถึงเลือกขั้นนี้" : "Why this step"}:</strong> {step.rationale[lang]}</p>
              <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => onOpen(step.itemId)}><Icon name="coach" className="h-3.5 w-3.5" />{th ? "เปิดบทเรียนและโค้ช" : "Open lesson and coach"}</Button>{plan.status === "approved" && step.status === "todo" && <Button disabled={busy} onClick={() => void command({ type: "learning.start", itemId: step.itemId })}>{th ? "เริ่มเรียน" : "Start learning"}</Button>}</div>
            </div>
          </div>
        </article></li>;
      })}</ol>
      {plan.steps.length === 0 && <p className="mt-4 text-sm text-ink-3">{th ? "แผนนี้ยังไม่มีรายการเรียน ลองสร้างแผนใหม่อีกครั้งค่ะ" : "This plan is empty. Rebuild it to add learning items."}</p>}
    </>}
  </Card>;
}

function Lesson({ itemId, record, lang, busy, command, coach, onClose, onSelectLesson }: Pick<JourneyProps, "record" | "lang" | "busy" | "command" | "coach"> & { itemId: string; onClose: () => void; onSelectLesson: (id: string) => void }) {
  const th = lang === "th";
  const item = itemById(itemId);
  const step = record.plan?.steps.find(step => step.itemId === itemId);
  const [evidence, setEvidence] = useState(record.evidence[itemId] ?? "");
  if (!item) return <Card><p>{th ? "ไม่พบบทเรียนนี้แล้ว" : "This lesson is no longer available."}</p><Button onClick={onClose}>{th ? "กลับไปที่แผน" : "Back to plan"}</Button></Card>;
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name={item.format} className="h-4 w-4" /></span><div><h2 className="text-lg font-bold">{item.title[lang]}</h2><p className="text-xs text-ink-3">{label(item.format, lang)} · {item.source} · {item.minutes} {th ? "นาที" : "min"}</p></div></div><Button variant="outline" onClick={onClose}>← {th ? "กลับไปที่แผน" : "Back to plan"}</Button></div><div className="grid items-start gap-5 lg:grid-cols-2"><Card>
    <div className="flex flex-wrap gap-2"><Badge tone="brand">{label(item.format, lang)}</Badge><Badge>{item.source} · {item.minutes} {th ? "นาที" : "min"}</Badge>{step && <Status value={step.status} lang={lang} />}</div>
    {item.format === "video" && <div className="mt-4 flex aspect-[16/7] flex-col justify-between rounded-2xl bg-ink p-4 text-white shadow-inner"><div className="flex items-center justify-between text-xs opacity-80"><span>{item.source}</span><span>{item.minutes} {th ? "นาที" : "min"}</span></div><div className="grid place-items-center text-center"><div className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><Icon name="video" className="h-5 w-5 text-white" /></div><p className="mt-2 text-xs opacity-85">{th ? "บทเรียนและบทถอดเสียงตัวอย่าง (เดโม) ระบบจริงจะเปิดบทเรียนใน LMS ของลูกค้า" : "Sample lesson and transcript (demo). The live version opens the lesson in the client's LMS."}</p></div><div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20"><div className="h-full w-1/3 rounded-full bg-brand" /></div></div>}
    <p className="mt-4 text-sm font-medium">{item.summary[lang]}</p>
    {item.content && <div className="mt-4 rounded-xl bg-surface-2 p-3.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-2 ring-1 ring-inset ring-line">{item.content[lang]}</div>}
    {item.sessions?.length ? <section className="mt-4 rounded-xl border border-line bg-surface-2 p-3"><h3 className="text-sm font-semibold">{th ? "รอบตัวอย่าง (เดโม)" : "Example sessions (demo)"}</h3>{item.sessions.map(session => <p key={session.date + session.location.en} className="mt-2 text-sm text-ink-2">{session.date} · {session.location[lang]}</p>)}</section> : null}
    {item.format !== "project" && <p className="mt-4 rounded-xl bg-brand-soft p-3 text-sm text-brand">{th ? "ทำกิจกรรมนี้ใน Moodle (LMS ทดสอบ) ระบบจะขึ้นว่าเรียนจบเมื่อ Moodle ยืนยันผล คุณไม่ต้องกดยืนยันเองค่ะ" : "Do this activity in Moodle (the test LMS). It shows as complete here once Moodle confirms it, so there's nothing to tick yourself."}</p>}
    {item.format === "project" && <form className="mt-5" onSubmit={event => { event.preventDefault(); if (evidence.trim().length >= 10) void command({ type: "project.submit", itemId, evidence: evidence.trim() }); }}>
      {item.skills.length > 0 && <div className="mb-3 flex items-start gap-2 rounded-xl bg-brand-soft/65 p-3 text-xs text-ink-2"><Icon name="trendUp" className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><span>{th ? "เมื่อหัวหน้าอนุมัติ ทักษะของคุณจะขึ้นเป็นระดับ: " : "Once your manager approves, your skill moves up to: "}<strong className="text-brand">{item.skills.map(x => `${skillById(x.skillId)?.name[lang] ?? x.skillId} → L${x.targetLevel}`).join(", ")}</strong></span></div>}
      <label className="text-sm font-semibold" htmlFor={`evidence-${itemId}`}>{th ? "หลักฐานโปรเจกต์" : "Project evidence"}</label><p className="mt-1 text-xs text-ink-3">{th ? "เล่าว่าคุณทำอะไร ได้ผลอย่างไร และได้เรียนรู้อะไร โปรดอย่าใส่ข้อมูลลูกค้าหรือข้อมูลส่วนตัวนะคะ" : "What did you do, what changed, and what did you learn? Leave out customer and personal details."}</p><textarea id={`evidence-${itemId}`} value={evidence} onChange={event => setEvidence(event.target.value)} minLength={10} maxLength={4000} required rows={6} disabled={busy || step?.status === "done" || step?.status === "submitted" || record.plan?.status !== "approved"} className="mt-3 w-full rounded-xl border border-line bg-surface p-3 text-sm" /><Button type="submit" disabled={busy || evidence.trim().length < 10 || step?.status === "done" || step?.status === "submitted" || record.plan?.status !== "approved"} className="mt-3">{th ? "ส่งหลักฐานให้หัวหน้าอนุมัติ" : "Send to my manager"}</Button>
    </form>}
  </Card><SecureCoach key={itemId} messages={record.chats[itemId] ?? []} lessonId={itemId} lang={lang} busy={busy} send={coach} onOpenLesson={onSelectLesson} /></div></div>;
}

// "Keep going" nudge on the home screen: plan progress and the next step,
// from the same helper the coach uses.
function NextStepCard({ record, lang, onArea, onOpen }: { record: LearningRecord; lang: Lang; onArea: (area: "assessment" | "plan" | "coach") => void; onOpen: (id: string) => void }) {
  const th = lang === "th";
  const approved = record.assessment.status === "approved";
  const nudge = record.plan ? progressNudge(record.plan, lang) : undefined;
  const next = nudge?.next;
  const text = nudge ? nudge.text : approved ? (th ? "สร้างแผนการเรียนของคุณ" : "Build your learning plan.") : (th ? "เริ่มประเมินทักษะ (ประมาณ 5 นาที)" : "Start your 5-minute skill check.");
  return <Card className="border-brand/25 bg-brand-soft/35"><div className="flex flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 flex-1 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand ring-1 ring-inset ring-brand/25"><Icon name={nudge ? "trendUp" : approved ? "path" : "clock"} className="h-5 w-5" /></span><div className="min-w-0 flex-1">
      <h2 className="font-semibold">{nudge ? (th ? "เรียนต่ออีกนิด" : "Keep going") : (th ? "ขั้นตอนถัดไป" : "Your next step")}</h2>
      <p className="mt-1 text-sm text-ink-2">{text}</p>
      {nudge && nudge.total > 0 && <div className="mt-2.5 h-2 max-w-sm overflow-hidden rounded-full bg-line" role="progressbar" aria-label={th ? "ความคืบหน้าของแผน" : "Plan progress"} aria-valuemin={0} aria-valuemax={nudge.total} aria-valuenow={nudge.done}><div className="h-full bg-brand transition-all duration-300" style={{ width: `${Math.round((nudge.done / nudge.total) * 100)}%` }} /></div>}
    </div></div>
    <div className="flex flex-wrap gap-2">{nudge && <Button variant="outline" onClick={() => onArea("coach")}><Icon name="coach" className="h-3.5 w-3.5" />{th ? "ถามโค้ช" : "Ask the coach"}</Button>}<Button onClick={() => (next ? onOpen(next.itemId) : onArea(approved ? "plan" : "assessment"))}>{next ? (th ? "เปิดขั้นตอนถัดไป" : "Open next step") : th ? "ไปต่อ" : "Continue"}</Button></div>
  </div></Card>;
}

export function EmployeeJourney(props: JourneyProps) {
  const [area, setArea] = useState<"overview" | "assessment" | "plan" | "coach">("overview");
  const [lessonId, setLessonId] = useState<string>();
  const th = props.lang === "th";
  if (lessonId) return <Lesson key={lessonId} {...props} itemId={lessonId} onClose={() => { setLessonId(undefined); setArea("plan"); }} onSelectLesson={setLessonId} />;
  const navItems: [typeof area, string, "skills" | "check" | "path" | "coach"][] = [
    ["overview", th ? "ทักษะและเป้าหมาย" : "Skills & goals", "skills"],
    ["assessment", th ? "ประเมินทักษะ" : "Skill check", "check"],
    ["plan", th ? "แผนการเรียน" : "Learning plan", "path"],
    ["coach", th ? "โค้ช AI" : "AI coach", "coach"],
  ];
  return <div className="grid items-start gap-5 lg:grid-cols-[232px_minmax(0,1fr)]"><aside className="rounded-2xl border border-line bg-surface p-3"><nav aria-label={th ? "การเรียนของฉัน" : "My learning sections"} className="flex flex-wrap gap-1.5 lg:flex-col">{navItems.map(([value, text, icon]) => <button key={value} type="button" onClick={() => setArea(value)} aria-current={area === value ? "page" : undefined} className={cx("inline-flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium cursor-pointer", area === value ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-surface-2")}><Icon name={icon} className="h-4 w-4 shrink-0" /><span>{text}</span></button>)}</nav><p className="mt-3 hidden border-t border-line pt-3 text-xs leading-relaxed text-ink-3 lg:block">{th ? "ประเมิน → หัวหน้าอนุมัติ → สร้างแผน → หัวหน้าอนุมัติ → เรียนและทำโปรเจกต์" : "Skill check → manager approves → build plan → manager approves → learn and practise"}</p></aside><div className="min-w-0 space-y-4">
    {area === "overview" && <><NextStepCard record={props.record} lang={props.lang} onArea={setArea} onOpen={setLessonId} /><Profile {...props} onAskCoach={() => setArea("coach")} /></>}
    {area === "assessment" && <Assessment {...props} />}
    {area === "plan" && <LearningPlan {...props} onOpen={setLessonId} />}
    {area === "coach" && <SecureCoach messages={props.record.chats.general ?? []} lang={props.lang} busy={props.busy} send={props.coach} onOpenLesson={setLessonId} />}
  </div></div>;
}

export { ManagerJourney, LeaderJourney, IntegrationsPanel } from "./secure-team";
