"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import { roleById, skillById } from "@/data/taxonomy";
import { employeeById, profile } from "@/lib/skills";
import type { Lang, LearningPlan, Level } from "@/lib/types";
import { CoachChat } from "./CoachChat";
import { tr } from "./i18n";
import { HERO, MANAGER, useStore } from "./store";
import { Avatar, Badge, Button, Card, cx, Icon, LevelDots, PhoneFrame, Ring } from "./ui";

const hero = employeeById(HERO)!;
const manager = employeeById(MANAGER)!;

const COACH_SUGGESTIONS: Record<Lang, string[]> = {
  th: [
    "อธิบายผลประเมินของฉันหน่อย",
    "ควรทำอะไรต่อ",
    "ขอฝึกรับมือลูกค้าที่โกรธ",
    "ผลประเมินมีผลกับโบนัสไหม",
    "คะแนนการโค้ชของสมศรีเท่าไหร่",
    "หัวหน้างานสาขาได้เงินเดือนเท่าไหร่",
  ],
  en: [
    "Explain my results",
    "What should I do next?",
    "Let me practise an angry customer",
    "Will my results affect my bonus?",
    "What is Somsri's coaching score?",
    "How much does a store supervisor earn?",
  ],
};
const LESSON_SUGGESTIONS: Record<Lang, string[]> = {
  th: ["สรุปบทเรียนนี้ให้หน่อย", "ยกตัวอย่างในงานของฉัน", "ขอฝึกรับมือลูกค้า"],
  en: ["Summarise this lesson", "Give me an example from my job", "Let me practise"],
};

const LEVEL_TAG: Record<number, { en: string; th: string }> = {
  1: { en: "Foundation", th: "พื้นฐาน" },
  2: { en: "Independent", th: "ทำได้ด้วยตนเอง" },
  3: { en: "Coach others", th: "สอนงานทีมได้" },
  4: { en: "Role model", th: "ต้นแบบมาตรฐาน" },
};

const FORMAT_MIX: Record<"video" | "workshop" | "project", { pct: string; en: string; th: string }> = {
  video: { pct: "10%", en: "10% Course", th: "10% บทเรียน" },
  workshop: { pct: "20%", en: "20% Peer/Coach", th: "20% โค้ช/เวิร์กช็อป" },
  project: { pct: "70%", en: "70% On-the-Job", th: "70% ลงมือทำจริง" },
};

// Three scenario questions; a correct answer validates knowledge up to L3.
const QUIZ = [
  {
    skillId: "T-CMPL",
    q: {
      en: "A customer is angry about a broken fan. What do you do first?",
      th: "ลูกค้าโกรธเรื่องพัดลมเสีย คุณควรทำอะไรก่อน",
    },
    options: [
      { en: "Explain the returns policy", th: "อธิบายนโยบายการคืนสินค้า" },
      {
        en: "Listen without interrupting, then repeat the main point",
        th: "ฟังโดยไม่ขัดจังหวะ แล้วทวนประเด็นหลัก",
      },
      { en: "Call the store manager straight away", th: "เรียกผู้จัดการสาขาทันที" },
    ],
    answer: 1,
  },
  {
    skillId: "L-COACH",
    q: {
      en: "A new colleague keeps closing the till wrongly. Best way to coach?",
      th: "พนักงานใหม่ปิดเครื่องคิดเงินผิดซ้ำๆ วิธีโค้ชที่ดีที่สุดคือ",
    },
    options: [
      { en: "Do it for them so the queue moves", th: "ทำให้เขาเลยเพื่อให้คิวเดินเร็ว" },
      { en: "Send them the manual", th: "ส่งคู่มือให้อ่าน" },
      {
        en: "Show, let them try while you watch, then give feedback",
        th: "สาธิต ให้ลองทำขณะที่คุณดู แล้วให้ฟีดแบ็ก",
      },
    ],
    answer: 2,
  },
  {
    skillId: "T-INV",
    q: {
      en: "A cycle count shows a 5% variance on hair dryers. What next?",
      th: "การนับสต็อกพบส่วนต่าง 5% ในไดร์เป่าผม ควรทำอย่างไรต่อ",
    },
    options: [
      { en: "Adjust the stock to match the count", th: "ปรับยอดสต็อกให้ตรงกับที่นับได้" },
      {
        en: "Check recent receiving, transfers and returns before adjusting",
        th: "ตรวจการรับสินค้า การโอน และการคืนล่าสุดก่อนปรับยอด",
      },
      { en: "Ignore it until the yearly count", th: "รอไว้จนถึงการนับประจำปี" },
    ],
    answer: 1,
  },
];

function assessSkills() {
  const ids = new Set<string>();
  for (const r of [roleById(hero.roleId), roleById(hero.nextRoleId!)])
    for (const req of r.requirements) ids.add(req.skillId);
  return [...ids];
}

const ASSESS_SKILLS = assessSkills();

function targetForSkill(skillId: string): number {
  const nextReq = roleById(hero.nextRoleId!).requirements.find((r) => r.skillId === skillId);
  const curReq = roleById(hero.roleId).requirements.find((r) => r.skillId === skillId);
  return nextReq?.level ?? curReq?.level ?? 2;
}

function Assessment() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const skills = ASSESS_SKILLS;
  const [self, setSelf] = useState<Record<string, Level>>(s.assessment.self);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [i, setI] = useState(0);
  const total = skills.length + QUIZ.length + 1;
  const sample = () => {
    setAnswers({ 0: 1, 1: 2, 2: 0 });
    setI(total - 1);
  };
  const submit = () => {
    const quiz: Record<string, Level> = {};
    QUIZ.forEach((q, k) => (quiz[q.skillId] = (answers[k] === q.answer ? 3 : 2) as Level));
    dispatch({ type: "submitAssessment", self, quiz });
  };

  let body;
  if (i < skills.length) {
    const sk = skillById(skills[i]);
    const reqLvl = targetForSkill(sk.id);
    body = (
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="text-xs font-medium text-ink-3">
            {t("rateYourself")} ({i + 1}/{skills.length})
          </span>
          <Badge tone="brand">
            {L === "th" ? `เป้าหมายตำแหน่งถัดไป: L${reqLvl}` : `Next-role target: L${reqLvl}`}
          </Badge>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-ink">{sk.name[L]}</h3>
        <p className="mt-0.5 text-xs text-ink-2">{sk.description[L]}</p>
        <div className="mt-3.5 space-y-2">
          {sk.levels.map((lv, k) => {
            const selected = self[sk.id] === k + 1;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSelf({ ...self, [sk.id]: (k + 1) as Level });
                  setI(i + 1);
                }}
                className={cx(
                  "flex w-full items-start gap-3 rounded-2xl border p-3 text-left text-sm transition-all cursor-pointer active:scale-[0.99]",
                  selected
                    ? "border-brand bg-brand-soft/80 shadow-[0_2px_8px_rgba(12,99,104,0.10)]"
                    : "border-line bg-surface hover:border-brand/40 hover:bg-surface-2/50",
                )}
              >
                <span
                  className={cx(
                    "font-display mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-bold tabular-nums",
                    selected ? "bg-brand text-white" : "bg-surface-2 text-brand ring-1 ring-inset ring-line",
                  )}
                >
                  L{k + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-ink-3">
                      {LEVEL_TAG[k + 1]?.[L]}
                    </span>
                    {k + 1 === reqLvl && (
                      <span className="text-[10px] font-medium text-brand">
                        {L === "th" ? "เกณฑ์ที่ต้องการ" : "Target"}
                      </span>
                    )}
                  </div>
                  <div className="text-sm leading-snug text-ink">{lv[L]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else if (i < skills.length + QUIZ.length) {
    const k = i - skills.length;
    const q = QUIZ[k];
    const sk = skillById(q.skillId);
    body = (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between gap-2">
          <Badge tone="gap">
            {t("quiz")} · {k + 1}/{QUIZ.length}
          </Badge>
          <span className="text-[11px] text-ink-3">{sk.name[L]}</span>
        </div>
        <h3 className="mt-2.5 text-base font-semibold leading-snug text-ink">{q.q[L]}</h3>
        <div className="mt-3.5 space-y-2">
          {q.options.map((o, j) => {
            const selected = answers[k] === j;
            return (
              <button
                key={j}
                type="button"
                onClick={() => {
                  setAnswers({ ...answers, [k]: j });
                  setI(i + 1);
                }}
                className={cx(
                  "flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left text-sm transition-all cursor-pointer active:scale-[0.99]",
                  selected
                    ? "border-brand bg-brand-soft/80"
                    : "border-line bg-surface hover:border-brand/40",
                )}
              >
                <span
                  className={cx(
                    "font-display mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                    selected ? "bg-brand text-white" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
                  )}
                >
                  {String.fromCharCode(65 + j)}
                </span>
                <span className="leading-snug text-ink">{o[L]}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  } else {
    const quizPreview: Record<string, Level> = {};
    QUIZ.forEach((q, k) => (quizPreview[q.skillId] = (answers[k] === q.answer ? 3 : 2) as Level));
    body = (
      <div className="animate-fade-in space-y-3">
        <div>
          <h3 className="text-base font-semibold text-ink">
            {L === "th" ? "ตรวจสอบก่อนส่ง" : "Review and submit"}
          </h3>
          <p className="text-xs text-ink-2">
            {L === "th"
              ? "ระบบเทียบผลประเมินตนเองกับคำถามสถานการณ์ เพื่อเสนอระดับเริ่มต้นให้หัวหน้าอนุมัติ"
              : "Self-ratings are calibrated with scenario checks before your manager reviews."}
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-[1fr_44px_44px_52px] items-center border-b border-line bg-surface-2 px-3 py-1.5 text-[10px] font-semibold text-ink-3">
            <span>{t("skills")}</span>
            <span className="text-center">{t("selfRating")}</span>
            <span className="text-center">{t("quizShort")}</span>
            <span className="text-right">{t("proposed")}</span>
          </div>
          <div className="divide-y divide-line">
            {skills.map((id) => {
              const sLvl = self[id] ?? 1;
              const qLvl = quizPreview[id];
              const propLvl = qLvl ? Math.min(sLvl, qLvl) : sLvl;
              return (
                <div
                  key={id}
                  className="grid grid-cols-[1fr_44px_44px_52px] items-center px-3 py-2 text-xs"
                >
                  <span className="truncate font-medium text-ink">{skillById(id).name[L]}</span>
                  <span className="text-center tabular-nums text-ink-2">L{sLvl}</span>
                  <span className="text-center tabular-nums text-ink-3">
                    {qLvl ? `L${qLvl}` : "–"}
                  </span>
                  <span className="text-right">
                    <Badge tone={propLvl < sLvl ? "gap" : "brand"}>L{propLvl}</Badge>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-surface p-2.5 text-xs text-ink-2 ring-1 ring-inset ring-line">
          <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <span>
            {L === "th"
              ? `ผลจะถูกส่งให้คุณ${manager.name.th}ตรวจสอบและอนุมัติ ผลใช้เพื่อการพัฒนาเท่านั้น`
              : `${manager.name.en} will review and approve your result. Results are used for development only.`}
          </span>
        </div>
        <Button className="w-full" onClick={submit}>
          {t("submitToManager")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <button
          type="button"
          className="text-sm font-medium text-ink-2 hover:text-ink cursor-pointer"
          onClick={() => (i ? setI(i - 1) : dispatch({ type: "set", patch: { assessing: false } }))}
        >
          ← {t("back")}
        </button>
        <span className="text-sm font-semibold text-ink">
          {t("assessment")}{" "}
          <span className="font-normal tabular-nums text-ink-3">
            ({i + 1}/{total})
          </span>
        </span>
        <button
          type="button"
          className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-medium text-brand hover:bg-brand hover:text-white transition cursor-pointer"
          onClick={sample}
        >
          {t("useSample")}
        </button>
      </div>
      {/* Segmented progress bar */}
      <div className="grid grid-cols-3 gap-1 bg-surface px-4 pb-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: `${Math.min(100, ((i + 1) / skills.length) * 100)}%` }}
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{
              width: `${i < skills.length ? 0 : Math.min(100, ((i - skills.length + 1) / QUIZ.length) * 100)}%`,
            }}
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full bg-brand transition-all duration-300"
            style={{ width: i >= skills.length + QUIZ.length ? "100%" : "0%" }}
          />
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">{body}</div>
    </div>
  );
}

function useHero() {
  const { s } = useStore();
  const overrides = s.assessment.status === "approved" ? s.overrides : undefined;
  return { p: profile(hero, overrides), overrides };
}

function StatusCard() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const toManager = () =>
    dispatch({ type: "logout", nextPersona: "manager", handoffNotice: "fromEmployee" });
  if (s.assessment.status === "not_started")
    return (
      <Card className="border-brand/30 bg-brand-soft/65">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink">{t("assessment")}</div>
          <Badge tone="brand">
            <Icon name="clock" className="h-3 w-3" /> 5 {t("min")}
          </Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">{t("assessmentIntro")}</p>
        {s.assessment.managerNote && (
          <p className="mt-2 rounded-xl bg-surface p-2.5 text-xs ring-1 ring-inset ring-line">
            <b>{t("managerNote")}:</b> {s.assessment.managerNote}
          </p>
        )}
        <Button
          className="mt-3 w-full"
          onClick={() => dispatch({ type: "set", patch: { assessing: true } })}
        >
          {t("startAssessment")}
        </Button>
      </Card>
    );
  if (s.assessment.status === "submitted" || s.plan?.status === "pending")
    return (
      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-ink">
            {s.plan?.status === "pending" ? t("kind_plan") : t("kind_assessment")}
          </div>
          <Badge tone="warn">{t("waitingManager")}</Badge>
        </div>
        <p className="mt-1 text-xs text-ink-2">
          {L === "th"
            ? `ส่งให้คุณ${manager.name.th}แล้ว (SLA 5 วันทำการ)`
            : `Sent to ${manager.name.en} (5-day SLA).`}
        </p>
        <Button variant="outline" className="mt-3 w-full" onClick={toManager}>
          {t("switchToManager")} →
        </Button>
      </Card>
    );
  if (!s.plan || s.plan.status !== "approved")
    return (
      <Card className="border-brand/30 bg-brand-soft/65">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink">{t("path")}</div>
          <Badge tone="ok">{t("approved")}</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          {L === "th"
            ? "ผลประเมินอนุมัติแล้ว ให้ AI จัดเส้นทางการเรียนรู้ 70-20-10 จากช่องว่างทักษะของคุณ"
            : "Your results are approved. Let the AI build a 70-20-10 path from your skill gaps."}
        </p>
        <Button
          className="mt-3 w-full"
          onClick={() => dispatch({ type: "set", patch: { tab: "path" } })}
        >
          <Icon name="spark" /> {t("buildPath")}
        </Button>
      </Card>
    );
  const step = s.plan.steps.find((x) => x.status !== "done");
  const item = step && itemById(step.itemId);
  if (!item)
    return (
      <Card className="border-ok/30 bg-ok-soft/50">
        <div className="flex items-center gap-2 text-sm font-semibold text-ok">
          <Icon name="check" />
          {L === "th" ? "ทำครบทุกขั้นตอนแล้ว" : "All steps complete"}
        </div>
      </Card>
    );
  const mix = FORMAT_MIX[item.format];
  return (
    <>
      <Card onClick={() => dispatch({ type: "set", patch: { lessonId: item.id } })}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-brand">{t("nextStep")}</span>
          <Badge tone="brand">{mix[L]}</Badge>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand ring-1 ring-inset ring-brand/20">
            <Icon name={item.format} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-ink">{item.title[L]}</div>
            <div className="mt-0.5 text-xs text-ink-2">
              {t(item.format)} · {item.minutes} {t("min")} · {t("week")} {step!.week} · {item.source}
            </div>
          </div>
          <Icon name="chevronRight" className="mt-2 h-5 w-5 shrink-0 text-ink-3" />
        </div>
      </Card>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-ink-3">
          <span>{t("lineNudge")}</span>
          <span className="text-[10px]">LINE Official Account · SSO</span>
        </div>
        <div className="rounded-2xl border border-[#06c755]/25 bg-[#06c755]/8 p-3">
          <div className="flex items-start gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#06c755] text-[10px] font-bold text-white shadow-sm">
              LINE
            </div>
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-surface px-3 py-2.5 text-xs leading-relaxed text-ink shadow-sm ring-1 ring-inset ring-line">
              {L === "th"
                ? `คุณ${hero.name.th.split(" ")[0]} วันนี้มีช่วงพักไหมคะ "${item.title.th}" ใช้เวลาแค่ ${item.minutes} นาที และช่วยปิดช่องว่างทักษะ${skillById(step!.skillId).name.th}ค่ะ`
                : `${hero.name.en.split(" ")[0]}, got a break today? "${item.title.en}" takes ${item.minutes} min and closes your ${skillById(step!.skillId).name.en} gap.`}
              <button
                type="button"
                onClick={() => dispatch({ type: "set", patch: { lessonId: item.id } })}
                className="mt-1.5 block font-semibold text-[#05963f] hover:underline cursor-pointer"
              >
                {L === "th" ? "เปิดบทเรียน ›" : "Open lesson ›"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-3">{t("lineNote")}</p>
        </div>
      </div>
    </>
  );
}

function Home() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const { p } = useHero();
  const met = p.nextGaps.filter((g) => g.gap === 0).length;
  return (
    <div className="space-y-3 p-4">
      <Card className="p-3.5">
        <div className="flex items-center gap-3.5">
          <Ring value={p.nextReadiness} size={64} />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-ink-2">
              {t("hello")} {hero.name[L].split(" ")[0]}
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-ink">
              {t("readyFor")} {p.next!.title[L]}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
              <Badge tone="neutral">
                {met}/{p.nextGaps.length} {t("skillsMet")}
              </Badge>
              <span>· {p.role.title[L]}</span>
            </div>
          </div>
        </div>
      </Card>
      <StatusCard />
      <Card className="p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="coach" className="h-4 w-4 text-brand" />
            {t("coachTitle")}
          </div>
          <span className="text-[11px] text-ink-3">{L === "th" ? "ไทย / EN" : "TH / EN"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COACH_SUGGESTIONS[L].slice(0, 3).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => dispatch({ type: "set", patch: { tab: "coach" } })}
              className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-brand/50 hover:bg-brand-soft/60 hover:text-brand cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Skills() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const { p } = useHero();
  const [open, setOpen] = useState<string>();
  const [filter, setFilter] = useState<"all" | "gaps" | "met">("all");

  const sorted = p.nextGaps
    .slice()
    .sort((a, b) => b.gap - a.gap || Number(b.critical) - Number(a.critical));
  const filtered = sorted.filter((g) =>
    filter === "gaps" ? g.gap > 0 : filter === "met" ? g.gap === 0 : true,
  );
  const gapCount = sorted.filter((g) => g.gap > 0).length;
  const metCount = sorted.length - gapCount;

  return (
    <div className="space-y-3 p-4">
      {s.assessment.status !== "approved" && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3 py-2 text-xs text-warn">
          <Icon name="info" className="h-4 w-4 shrink-0" />
          <span>{t("notAssessed")}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-center gap-3">
          <Ring value={p.nextReadiness} size={56} />
          <div>
            <div className="text-sm font-semibold text-ink">{t("forNextRole")}</div>
            <div className="text-xs text-ink-2">{p.next!.title[L]}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-brand" /> {t("current")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-gap/25 ring-1 ring-inset ring-gap/70" /> {t("gap")}
          </span>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {(
          [
            ["all", L === "th" ? `ทั้งหมด (${sorted.length})` : `All (${sorted.length})`],
            ["gaps", `${t("gap")} (${gapCount})`],
            ["met", `${t("met")} (${metCount})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cx(
              "rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer",
              filter === k
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface text-ink-2 hover:bg-surface-2",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {filtered.map((g) => {
          const sk = skillById(g.skillId);
          return (
            <div key={g.skillId} className="px-3.5 py-2.5">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left cursor-pointer"
                onClick={() => setOpen(open === g.skillId ? undefined : g.skillId)}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{sk.name[L]}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <LevelDots current={g.current} required={g.required} />
                    <span className="font-display text-[11px] font-medium tabular-nums text-ink-3">
                      L{g.current}/L{g.required}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {g.gap ? (
                    <Badge tone="gap">
                      {t("gap")} {g.gap}
                    </Badge>
                  ) : (
                    <Badge tone="ok">{t("met")}</Badge>
                  )}
                  {g.critical && <Badge>{t("critical")}</Badge>}
                </div>
              </button>
              {open === g.skillId && (
                <div className="animate-fade-in mt-2.5 space-y-1.5 rounded-xl bg-surface-2 p-3 text-xs text-ink-2 ring-1 ring-inset ring-line">
                  {sk.levels.map((lv, k) => (
                    <div
                      key={k}
                      className={cx(
                        "flex items-start gap-2 rounded-lg px-2 py-1",
                        k + 1 === g.current && "bg-brand-soft/70 font-semibold text-brand",
                        k + 1 === g.required && k + 1 !== g.current && "bg-gap-soft/70 font-semibold text-gap",
                      )}
                    >
                      <span className="font-display shrink-0 tabular-nums">L{k + 1}:</span>
                      <span>{lv[L]}</span>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    className="mt-1 px-1.5 py-1 text-xs"
                    onClick={() => {
                      dispatch({ type: "set", patch: { tab: "coach" } });
                    }}
                  >
                    {t("askCoachExplain")} →
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PathView() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  if (s.assessment.status !== "approved")
    return (
      <div className="p-4">
        <Card>
          <p className="text-sm text-ink-2">{t("needApprovedAssessment")}</p>
          {s.assessment.status === "not_started" && (
            <Button
              className="mt-3 w-full"
              onClick={() => dispatch({ type: "set", patch: { assessing: true } })}
            >
              {t("startAssessment")}
            </Button>
          )}
          {s.assessment.status === "submitted" && (
            <Badge tone="warn" className="mt-3">
              {t("waitingManager")}
            </Badge>
          )}
        </Card>
      </div>
    );

  async function build() {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch("/api/path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId: HERO, overrides: s.overrides }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      dispatch({ type: "setPlan", plan: (await res.json()) as LearningPlan });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!s.plan)
    return (
      <div className="space-y-3 p-4">
        <Card className="border-brand/30 bg-brand-soft/65">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-ink">
            <Icon name="spark" className="h-4 w-4 text-brand" />
            {L === "th" ? "สร้างเส้นทาง 70-20-10 ด้วย AI" : "AI 70-20-10 Learning Path"}
          </div>
          <p className="text-xs leading-relaxed text-ink-2">
            {L === "th"
              ? "AI จะเลือกจากคลังการเรียนรู้ที่ได้รับอนุมัติของทั้งสองระบบ LMS ตามช่องว่างทักษะสำหรับตำแหน่งถัดไป แล้วจัดลำดับเป็นแผน 12 สัปดาห์ หัวหน้าจะเป็นผู้อนุมัติ"
              : "The AI picks from the approved catalogue of both learning systems, based on your gaps for your next role, and sequences a 12-week plan. Your manager approves it."}
          </p>
          <Button className="mt-3 w-full" disabled={busy} onClick={build}>
            <Icon name="spark" /> {busy ? t("building") : t("buildPath")}
          </Button>
          {err && <p className="mt-2 text-xs text-danger">{err}</p>}
        </Card>
      </div>
    );

  const plan = s.plan;
  const editable = plan.status === "draft" || plan.status === "changes_requested";
  const counts = { video: 0, workshop: 0, project: 0 };
  for (const st of plan.steps) {
    const it = itemById(st.itemId);
    if (it) counts[it.format]++;
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <Badge tone={plan.generatedBy === "ai" ? "brand" : "neutral"}>
          <Icon name="spark" className="h-3 w-3" />{" "}
          {plan.generatedBy === "ai" ? t("aiGenerated") : t("rulesGenerated")}
        </Badge>
        <Badge
          tone={
            plan.status === "approved"
              ? "ok"
              : plan.status === "pending"
                ? "warn"
                : plan.status === "changes_requested"
                  ? "danger"
                  : "neutral"
          }
        >
          {plan.status === "approved"
            ? t("approved")
            : plan.status === "pending"
              ? t("pending")
              : plan.status === "changes_requested"
                ? t("changesRequested")
                : t("draft")}
        </Badge>
      </div>

      <p className="text-xs leading-relaxed text-ink-2">{plan.summary[L]}</p>

      {/* 70-20-10 Mix Summary Strip */}
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-line bg-surface p-2 text-center text-[11px]">
        <div className="rounded-lg bg-surface-2 px-2 py-1">
          <div className="font-display font-bold text-brand">70% · {counts.project}</div>
          <div className="text-[10px] text-ink-3">{t("project")}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-2 py-1">
          <div className="font-display font-bold text-ink">20% · {counts.workshop}</div>
          <div className="text-[10px] text-ink-3">{t("workshop")}</div>
        </div>
        <div className="rounded-lg bg-surface-2 px-2 py-1">
          <div className="font-display font-bold text-ink-2">10% · {counts.video}</div>
          <div className="text-[10px] text-ink-3">{t("video")}</div>
        </div>
      </div>

      {plan.managerNote && (
        <div className="rounded-xl border border-line bg-surface p-2.5 text-xs">
          <b>{t("managerNote")}:</b> {plan.managerNote}
        </div>
      )}

      {/* Connected timeline list */}
      <ol className="relative space-y-2.5 before:absolute before:top-4 before:bottom-4 before:left-[22px] before:w-[2px] before:bg-line">
        {plan.steps.map((st) => {
          const item = itemById(st.itemId)!;
          const sk = skillById(st.skillId);
          return (
            <li key={st.itemId} className="relative">
              <Card
                className="p-3"
                onClick={
                  plan.status === "approved"
                    ? () => dispatch({ type: "set", patch: { lessonId: item.id } })
                    : undefined
                }
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cx(
                      "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-2 ring-surface",
                      st.status === "done"
                        ? "bg-ok-soft text-ok"
                        : "bg-brand-soft text-brand",
                    )}
                  >
                    <Icon name={st.status === "done" ? "check" : item.format} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold leading-snug text-ink">
                        {item.title[L]}
                      </div>
                      {editable && (
                        <button
                          type="button"
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-ink-3 hover:bg-danger-soft hover:text-danger cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({
                              type: "setPlan",
                              plan: {
                                ...plan,
                                steps: plan.steps
                                  .filter((x) => x.itemId !== st.itemId)
                                  .map((x, k) => ({ ...x, order: k + 1 })),
                              },
                            });
                          }}
                        >
                          {t("remove")}
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
                      <Badge tone="neutral">
                        {t("week")} {st.week}
                      </Badge>
                      <span>{t(item.format)}</span>·
                      <span>
                        {item.minutes} {t("min")}
                      </span>
                      ·<span>{item.source}</span>
                      {sk && (
                        <span className="font-medium text-brand">· {sk.name[L]}</span>
                      )}
                      {st.status === "submitted" && (
                        <Badge tone="warn">{t("waitingManager")}</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs leading-relaxed text-ink-2">
                      <span className="font-semibold text-ink">{t("why")}:</span>{" "}
                      {st.rationale[L]}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      {editable && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] text-ink-3">{t("workshopNote")}</p>
          <Button
            className="w-full"
            onClick={() => dispatch({ type: "submitPlan" })}
            disabled={!plan.steps.length}
          >
            {t("sendForApproval")}
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={build}>
            {busy ? t("building") : t("regenerate")}
          </Button>
        </div>
      )}
      {plan.status === "pending" && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            dispatch({ type: "logout", nextPersona: "manager", handoffNotice: "fromEmployee" })
          }
        >
          {t("switchToManager")} →
        </Button>
      )}
    </div>
  );
}

function Lesson({ id }: { id: string }) {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const item = itemById(id)!;
  const step = s.plan?.status === "approved" ? s.plan.steps.find((x) => x.itemId === id) : undefined;
  const [evidence, setEvidence] = useState(s.evidence[id] ?? "");
  const [expanded, setExpanded] = useState(false);
  const close = () => dispatch({ type: "set", patch: { lessonId: undefined } });
  return (
    <div className="animate-sheet-up absolute inset-0 z-20 flex flex-col bg-surface-2">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <button
          type="button"
          onClick={close}
          className="text-sm font-medium text-ink-2 hover:text-ink cursor-pointer"
        >
          ← {t("back")}
        </button>
        <div className="flex items-center gap-1.5">
          <Badge tone="brand">
            {item.source === "NEW"
              ? L === "th"
                ? "สร้างใหม่สำหรับ Suite"
                : "New for the Suite"
              : item.source}
          </Badge>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2 hover:text-ink cursor-pointer"
          >
            {expanded
              ? L === "th"
                ? "ย่อเนื้อหา"
                : "Split view"
              : L === "th"
                ? "ขยายเนื้อหา"
                : "Expand text"}
          </button>
        </div>
      </div>
      <div
        className={cx(
          "scroll-thin shrink-0 overflow-y-auto bg-surface p-4 transition-all",
          expanded ? "max-h-[72%]" : "max-h-[46%]",
        )}
      >
        {item.format === "video" && (
          <div className="mb-3 flex aspect-[16/8] flex-col justify-between rounded-2xl bg-ink p-3 text-white shadow-inner">
            <div className="flex items-center justify-between text-[10px] opacity-75">
              <span>{item.source}</span>
              <span>
                {item.minutes} {t("min")}
              </span>
            </div>
            <div className="grid place-items-center">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                <Icon name="video" className="h-5 w-5 text-white" />
              </div>
              <div className="mt-1 text-[11px] opacity-80">
                {t("fromLms")} {item.source} (mock) · {item.minutes} {t("min")}
              </div>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full w-1/3 rounded-full bg-brand" />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <Icon name={item.format} className="h-3.5 w-3.5 text-brand" /> {t(item.format)} ·{" "}
          {item.minutes} {t("min")}
        </div>
        <h2 className="mt-1 text-base font-semibold text-ink">{item.title[L]}</h2>
        {item.sessions && (
          <div className="mt-2 rounded-xl bg-surface-2 p-2 text-xs text-ink-2">
            <b>{t("sessions")}:</b>{" "}
            {item.sessions.map((x) => `${x.date} · ${x.location[L]}`).join(" | ")}
          </div>
        )}
        <div className="mt-3 text-xs font-semibold text-ink-3">{t("transcript")}</div>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          {item.content?.[L] ?? item.summary[L]}
        </p>
        {step && item.format === "project" && step.status !== "done" && (
          <div className="mt-3 space-y-2">
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder={t("evidencePh")}
              rows={3}
              className="w-full rounded-xl border border-line bg-surface-2 p-2.5 text-sm outline-none focus:border-brand focus:bg-surface"
              disabled={step.status === "submitted"}
            />
            {step.status === "submitted" ? (
              <Badge tone="warn">{t("waitingManager")}</Badge>
            ) : (
              <Button
                className="w-full"
                disabled={evidence.trim().length < 10}
                onClick={() => dispatch({ type: "submitProject", itemId: id, evidence })}
              >
                {t("submitEvidence")}
              </Button>
            )}
          </div>
        )}
        {step && item.format !== "project" && step.status !== "done" && (
          <Button
            className="mt-3 w-full"
            onClick={() => {
              dispatch({ type: "stepStatus", itemId: id, status: "done" });
              close();
            }}
          >
            <Icon name="check" /> {t("markDone")}
          </Button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col border-t border-line bg-surface-2">
        <div className="flex items-center justify-between px-4 pt-2 text-xs font-semibold text-ink-2">
          <span className="flex items-center gap-1.5">
            <Icon name="coach" className="h-3.5 w-3.5 text-brand" /> {t("askLesson")}
          </span>
          <span className="text-[10px] font-normal text-ink-3">RAG · [{id}]</span>
        </div>
        <CoachChat
          chatKey={`lesson:${id}`}
          lessonId={id}
          suggestions={LESSON_SUGGESTIONS[L]}
          compact
        />
      </div>
    </div>
  );
}

const TOASTS: Record<string, { en: string; th: string }> = {
  assessmentSent: { en: "Sent to your manager for approval", th: "ส่งให้หัวหน้าอนุมัติแล้ว" },
  planSent: { en: "Plan sent to your manager", th: "ส่งแผนให้หัวหน้าแล้ว" },
  projectSent: { en: "Evidence sent to your manager", th: "ส่งหลักฐานให้หัวหน้าแล้ว" },
};

export function EmployeeApp() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const tabs = [
    { id: "home", icon: "home" },
    { id: "skills", icon: "skills" },
    { id: "path", icon: "path" },
    { id: "coach", icon: "coach" },
  ] as const;
  return (
    <PhoneFrame label={`${hero.name[s.lang]} · ${roleById(hero.roleId).title[s.lang]}`}>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar name={hero.name[s.lang]} size="sm" />
          <div>
            <div className="text-sm font-semibold leading-tight text-brand">{t("appName")}</div>
            <div className="text-[11px] text-ink-3">{hero.site[s.lang]}</div>
          </div>
        </div>
        <Badge tone="neutral">{hero.name[s.lang].split(" ")[0]}</Badge>
      </div>
      {s.toast && TOASTS[s.toast] && (
        <button
          type="button"
          onClick={() => dispatch({ type: "set", patch: { toast: undefined } })}
          className="animate-fade-in mx-3 mt-2 flex items-center gap-1.5 rounded-xl border border-ok/25 bg-ok-soft px-3 py-2 text-left text-xs font-medium text-ok cursor-pointer"
        >
          <Icon name="check" className="h-3.5 w-3.5 shrink-0" />
          {TOASTS[s.toast][s.lang]}
        </button>
      )}
      {s.assessing ? (
        <Assessment />
      ) : (
        <>
          <div
            className={cx(
              "min-h-0 flex-1",
              s.tab === "coach" ? "flex flex-col" : "scroll-thin overflow-y-auto",
            )}
          >
            {s.tab === "home" && <Home />}
            {s.tab === "skills" && <Skills />}
            {s.tab === "path" && <PathView />}
            {s.tab === "coach" && (
              <CoachChat chatKey="coach" suggestions={COACH_SUGGESTIONS[s.lang]} />
            )}
          </div>
          <nav className="grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
            {tabs.map((x) => {
              const active = s.tab === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => dispatch({ type: "set", patch: { tab: x.id, toast: undefined } })}
                  className={cx(
                    "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition cursor-pointer",
                    active ? "text-brand" : "text-ink-3 hover:text-ink-2",
                  )}
                >
                  {active && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand" />
                  )}
                  <Icon name={x.icon} className="h-5 w-5" />
                  {t(x.id)}
                </button>
              );
            })}
          </nav>
        </>
      )}
      {s.lessonId && <Lesson id={s.lessonId} />}
    </PhoneFrame>
  );
}
