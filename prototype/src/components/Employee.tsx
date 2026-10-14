"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import { roleById, skillById } from "@/data/taxonomy";
import { employeeById, profile } from "@/lib/skills";
import type { Lang, LearningPlan, Level } from "@/lib/types";
import { CoachChat } from "./CoachChat";
import { tr } from "./i18n";
import { HERO, MANAGER, useStore } from "./store";
import { Badge, Button, Card, cx, Icon, LevelDots, PhoneFrame, Ring } from "./ui";

const hero = employeeById(HERO)!;
const manager = employeeById(MANAGER)!;

const COACH_SUGGESTIONS: Record<Lang, string[]> = {
  th: ["อธิบายผลประเมินของฉันหน่อย", "ควรทำอะไรต่อ", "ขอฝึกรับมือลูกค้าที่โกรธ", "ผลประเมินมีผลกับโบนัสไหม", "คะแนนการโค้ชของสมศรีเท่าไหร่", "หัวหน้างานสาขาได้เงินเดือนเท่าไหร่"],
  en: ["Explain my results", "What should I do next?", "Let me practise an angry customer", "Will my results affect my bonus?", "What is Somsri's coaching score?", "How much does a store supervisor earn?"],
};
const LESSON_SUGGESTIONS: Record<Lang, string[]> = {
  th: ["สรุปบทเรียนนี้ให้หน่อย", "ยกตัวอย่างในงานของฉัน", "ขอฝึกรับมือลูกค้า"],
  en: ["Summarise this lesson", "Give me an example from my job", "Let me practise"],
};

// Three scenario questions; a correct answer validates knowledge up to L3.
const QUIZ = [
  {
    skillId: "T-CMPL",
    q: { en: "A customer is angry about a broken fan. What do you do first?", th: "ลูกค้าโกรธเรื่องพัดลมเสีย คุณควรทำอะไรก่อน" },
    options: [
      { en: "Explain the returns policy", th: "อธิบายนโยบายการคืนสินค้า" },
      { en: "Listen without interrupting, then repeat the main point", th: "ฟังโดยไม่ขัดจังหวะ แล้วทวนประเด็นหลัก" },
      { en: "Call the store manager straight away", th: "เรียกผู้จัดการสาขาทันที" },
    ],
    answer: 1,
  },
  {
    skillId: "L-COACH",
    q: { en: "A new colleague keeps closing the till wrongly. Best way to coach?", th: "พนักงานใหม่ปิดเครื่องคิดเงินผิดซ้ำๆ วิธีโค้ชที่ดีที่สุดคือ" },
    options: [
      { en: "Do it for them so the queue moves", th: "ทำให้เขาเลยเพื่อให้คิวเดินเร็ว" },
      { en: "Send them the manual", th: "ส่งคู่มือให้อ่าน" },
      { en: "Show, let them try while you watch, then give feedback", th: "สาธิต ให้ลองทำขณะที่คุณดู แล้วให้ฟีดแบ็ก" },
    ],
    answer: 2,
  },
  {
    skillId: "T-INV",
    q: { en: "A cycle count shows a 5% variance on hair dryers. What next?", th: "การนับสต็อกพบส่วนต่าง 5% ในไดร์เป่าผม ควรทำอย่างไรต่อ" },
    options: [
      { en: "Adjust the stock to match the count", th: "ปรับยอดสต็อกให้ตรงกับที่นับได้" },
      { en: "Check recent receiving, transfers and returns before adjusting", th: "ตรวจการรับสินค้า การโอน และการคืนล่าสุดก่อนปรับยอด" },
      { en: "Ignore it until the yearly count", th: "รอไว้จนถึงการนับประจำปี" },
    ],
    answer: 1,
  },
];

function assessSkills() {
  const ids = new Set<string>();
  for (const r of [roleById(hero.roleId), roleById(hero.nextRoleId!)]) for (const req of r.requirements) ids.add(req.skillId);
  return [...ids];
}

const ASSESS_SKILLS = assessSkills();

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
    body = (
      <div>
        <div className="text-xs text-ink-3">{t("rateYourself")}</div>
        <h3 className="mt-1 text-lg font-semibold">{sk.name[L]}</h3>
        <p className="text-sm text-ink-2">{sk.description[L]}</p>
        <div className="mt-4 space-y-2">
          {sk.levels.map((lv, k) => (
            <button
              key={k}
              onClick={() => {
                setSelf({ ...self, [sk.id]: (k + 1) as Level });
                setI(i + 1);
              }}
              className={cx("w-full rounded-xl border p-3 text-left text-sm", self[sk.id] === k + 1 ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40")}
            >
              <span className="mr-2 font-semibold text-brand">{k + 1}</span>
              {lv[L]}
            </button>
          ))}
        </div>
      </div>
    );
  } else if (i < skills.length + QUIZ.length) {
    const k = i - skills.length;
    const q = QUIZ[k];
    body = (
      <div>
        <div className="text-xs text-ink-3">{t("quiz")} · {k + 1}/3</div>
        <h3 className="mt-1 text-base font-semibold">{q.q[L]}</h3>
        <div className="mt-4 space-y-2">
          {q.options.map((o, j) => (
            <button
              key={j}
              onClick={() => {
                setAnswers({ ...answers, [k]: j });
                setI(i + 1);
              }}
              className={cx("w-full rounded-xl border p-3 text-left text-sm", answers[k] === j ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-brand/40")}
            >
              {o[L]}
            </button>
          ))}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <h3 className="text-base font-semibold">{L === "th" ? "ตรวจสอบก่อนส่ง" : "Review and submit"}</h3>
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          {skills.map((id) => (
            <div key={id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{skillById(id).name[L]}</span>
              <span className="font-medium text-brand">L{self[id] ?? 1}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-2">
          {L === "th" ? `ผลจะถูกส่งให้คุณ${manager.name.th}ตรวจสอบและอนุมัติ ผลใช้เพื่อการพัฒนาเท่านั้น` : `${manager.name.en} will review and approve your result. Results are used for development only.`}
        </p>
        <Button className="w-full" onClick={submit}>
          {t("submitToManager")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button className="text-sm text-ink-2" onClick={() => (i ? setI(i - 1) : dispatch({ type: "set", patch: { assessing: false } }))}>
          ← {t("back")}
        </button>
        <span className="text-sm font-medium">{t("assessment")}</span>
        <button className="text-xs text-brand" onClick={sample}>
          {t("useSample")}
        </button>
      </div>
      <div className="h-1 bg-line">
        <div className="h-1 bg-brand transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} />
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
  const toManager = () => dispatch({ type: "set", patch: { persona: "manager" } });
  if (s.assessment.status === "not_started")
    return (
      <Card className="border-brand/30 bg-brand-soft">
        <div className="text-sm font-semibold">{t("assessment")}</div>
        <p className="mt-1 text-sm text-ink-2">{t("assessmentIntro")}</p>
        {s.assessment.managerNote && <p className="mt-2 rounded-lg bg-surface p-2 text-xs"><b>{t("managerNote")}:</b> {s.assessment.managerNote}</p>}
        <Button className="mt-3 w-full" onClick={() => dispatch({ type: "set", patch: { assessing: true } })}>
          {t("startAssessment")}
        </Button>
      </Card>
    );
  if (s.assessment.status === "submitted" || s.plan?.status === "pending")
    return (
      <Card>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{s.plan?.status === "pending" ? t("kind_plan") : t("kind_assessment")}</div>
          <Badge tone="warn">{t("waitingManager")}</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-2">{L === "th" ? `ส่งให้คุณ${manager.name.th}แล้ว` : `Sent to ${manager.name.en}.`}</p>
        <Button variant="outline" className="mt-3 w-full" onClick={toManager}>
          {t("switchToManager")} →
        </Button>
      </Card>
    );
  if (!s.plan || s.plan.status !== "approved")
    return (
      <Card className="border-brand/30 bg-brand-soft">
        <div className="text-sm font-semibold">{t("path")}</div>
        <p className="mt-1 text-sm text-ink-2">{L === "th" ? "ผลประเมินอนุมัติแล้ว ให้ AI จัดเส้นทางการเรียนรู้จากช่องว่างทักษะของคุณ" : "Your results are approved. Let the AI build a path from your skill gaps."}</p>
        <Button className="mt-3 w-full" onClick={() => dispatch({ type: "set", patch: { tab: "path" } })}>
          <Icon name="spark" /> {t("buildPath")}
        </Button>
      </Card>
    );
  const step = s.plan.steps.find((x) => x.status !== "done");
  const item = step && itemById(step.itemId);
  if (!item) return <Card><div className="text-sm font-semibold">{L === "th" ? "ทำครบทุกขั้นตอนแล้ว" : "All steps complete"}</div></Card>;
  return (
    <>
      <Card onClick={() => dispatch({ type: "set", patch: { lessonId: item.id } })}>
        <div className="text-xs text-ink-3">{t("nextStep")}</div>
        <div className="mt-1 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Icon name={item.format} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{item.title[L]}</div>
            <div className="text-xs text-ink-2">
              {t(item.format)} · {item.minutes} {t("min")} · {t("week")} {step!.week}
            </div>
          </div>
        </div>
      </Card>
      <div>
        <div className="mb-1 text-xs font-medium text-ink-3">{t("lineNudge")}</div>
        <div className="rounded-2xl bg-[#06c755]/10 p-3">
          <div className="flex items-start gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#06c755] text-[10px] font-bold text-white">LINE</div>
            <div className="rounded-2xl rounded-tl-md bg-white px-3 py-2 text-sm shadow-sm">
              {L === "th"
                ? `คุณ${hero.name.th.split(" ")[0]} วันนี้มีช่วงพักไหมคะ "${item.title.th}" ใช้เวลาแค่ ${item.minutes} นาที และช่วยปิดช่องว่างทักษะ${skillById(step!.skillId).name.th}ค่ะ`
                : `${hero.name.en.split(" ")[0]}, got a break today? "${item.title.en}" takes ${item.minutes} min and closes your ${skillById(step!.skillId).name.en} gap.`}
              <div className="mt-1 text-xs font-medium text-[#06a447]">{L === "th" ? "เปิดบทเรียน ›" : "Open lesson ›"}</div>
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
      <div className="flex items-center gap-3">
        <Ring value={p.nextReadiness} />
        <div>
          <div className="text-sm text-ink-2">
            {t("hello")} {hero.name[L].split(" ")[0]}
          </div>
          <div className="font-semibold">
            {t("readyFor")} {p.next!.title[L]}
          </div>
          <div className="text-xs text-ink-3">
            {met}/{p.nextGaps.length} {t("skillsMet")} · {p.role.title[L]} · {hero.site[L]}
          </div>
        </div>
      </div>
      <StatusCard />
      <Card>
        <div className="mb-2 text-sm font-semibold">{t("coachTitle")}</div>
        <div className="flex flex-wrap gap-1.5">
          {COACH_SUGGESTIONS[L].slice(0, 3).map((q) => (
            <button key={q} onClick={() => dispatch({ type: "set", patch: { tab: "coach" } })} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-2">
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
  return (
    <div className="space-y-3 p-4">
      {s.assessment.status !== "approved" && <div className="rounded-xl bg-warn-soft px-3 py-2 text-xs text-[#8a5a00]">{t("notAssessed")}</div>}
      <div className="flex items-center gap-3">
        <Ring value={p.nextReadiness} size={56} />
        <div>
          <div className="text-sm font-semibold">{t("forNextRole")}</div>
          <div className="text-xs text-ink-2">{p.next!.title[L]}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-ink-3">
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-brand" /> {t("current")}</span>
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-gap/30 outline outline-1 outline-gap/60" /> {t("gap")}</span>
      </div>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {p.nextGaps
          .slice()
          .sort((a, b) => b.gap - a.gap || Number(b.critical) - Number(a.critical))
          .map((g) => {
            const sk = skillById(g.skillId);
            return (
              <div key={g.skillId} className="px-3 py-2.5">
                <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(open === g.skillId ? undefined : g.skillId)}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{sk.name[L]}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <LevelDots current={g.current} required={g.required} />
                      <span className="text-[11px] text-ink-3">L{g.current}/L{g.required}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {g.gap ? <Badge tone="gap">{t("gap")} {g.gap}</Badge> : <Badge tone="ok">{t("met")}</Badge>}
                    {g.critical && <Badge>{t("critical")}</Badge>}
                  </div>
                </button>
                {open === g.skillId && (
                  <div className="mt-2 space-y-2 rounded-xl bg-surface-2 p-2.5 text-xs text-ink-2">
                    {sk.levels.map((lv, k) => (
                      <div key={k} className={cx(k + 1 === g.current && "font-semibold text-brand", k + 1 === g.required && k + 1 !== g.current && "font-semibold text-gap")}>
                        L{k + 1}: {lv[L]}
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      className="px-0"
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
            <Button className="mt-3 w-full" onClick={() => dispatch({ type: "set", patch: { assessing: true } })}>
              {t("startAssessment")}
            </Button>
          )}
          {s.assessment.status === "submitted" && <Badge tone="warn" className="mt-3">{t("waitingManager")}</Badge>}
        </Card>
      </div>
    );

  async function build() {
    setBusy(true);
    setErr(undefined);
    try {
      const res = await fetch("/api/path", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ employeeId: HERO, overrides: s.overrides }) });
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
        <Card className="border-brand/30 bg-brand-soft">
          <p className="text-sm text-ink-2">
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
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <Badge tone={plan.generatedBy === "ai" ? "brand" : "neutral"}>
          <Icon name="spark" className="h-3 w-3" /> {plan.generatedBy === "ai" ? t("aiGenerated") : t("rulesGenerated")}
        </Badge>
        <Badge tone={plan.status === "approved" ? "ok" : plan.status === "pending" ? "warn" : plan.status === "changes_requested" ? "danger" : "neutral"}>
          {plan.status === "approved" ? t("approved") : plan.status === "pending" ? t("pending") : plan.status === "changes_requested" ? t("changesRequested") : t("draft")}
        </Badge>
      </div>
      <p className="text-sm text-ink-2">{plan.summary[L]}</p>
      {plan.managerNote && (
        <div className="rounded-xl bg-surface p-2.5 text-xs">
          <b>{t("managerNote")}:</b> {plan.managerNote}
        </div>
      )}
      <ol className="space-y-2">
        {plan.steps.map((st) => {
          const item = itemById(st.itemId)!;
          return (
            <li key={st.itemId}>
              <Card className="p-3" onClick={plan.status === "approved" ? () => dispatch({ type: "set", patch: { lessonId: item.id } }) : undefined}>
                <div className="flex items-start gap-3">
                  <div className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", st.status === "done" ? "bg-ok-soft text-ok" : "bg-brand-soft text-brand")}>
                    <Icon name={st.status === "done" ? "check" : item.format} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{item.title[L]}</div>
                      {editable && (
                        <button
                          className="shrink-0 text-[11px] text-ink-3 hover:text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch({ type: "setPlan", plan: { ...plan, steps: plan.steps.filter((x) => x.itemId !== st.itemId).map((x, k) => ({ ...x, order: k + 1 })) } });
                          }}
                        >
                          {t("remove")}
                        </button>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-ink-3">
                      <span>{t("week")} {st.week}</span>·<span>{t(item.format)}</span>·<span>{item.minutes} {t("min")}</span>·<span>{item.source}</span>
                      {st.status === "submitted" && <Badge tone="warn">{t("waitingManager")}</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-ink-2">
                      <span className="font-medium">{t("why")}:</span> {st.rationale[L]}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
      {editable && (
        <div className="space-y-2">
          <p className="text-[11px] text-ink-3">{t("workshopNote")}</p>
          <Button className="w-full" onClick={() => dispatch({ type: "submitPlan" })} disabled={!plan.steps.length}>
            {t("sendForApproval")}
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={build}>
            {busy ? t("building") : t("regenerate")}
          </Button>
        </div>
      )}
      {plan.status === "pending" && (
        <Button variant="outline" className="w-full" onClick={() => dispatch({ type: "set", patch: { persona: "manager" } })}>
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
  const close = () => dispatch({ type: "set", patch: { lessonId: undefined } });
  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface-2">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button onClick={close} className="text-sm text-ink-2">
          ← {t("back")}
        </button>
        <Badge>{item.source === "NEW" ? (L === "th" ? "สร้างใหม่สำหรับ Suite" : "New for the Suite") : item.source}</Badge>
      </div>
      <div className="scroll-thin max-h-[48%] shrink-0 overflow-y-auto p-4">
        {item.format === "video" && (
          <div className="mb-3 grid aspect-video place-items-center rounded-2xl bg-ink text-white">
            <div className="text-center">
              <Icon name="video" className="mx-auto h-10 w-10 opacity-80" />
              <div className="mt-1 text-[11px] opacity-70">
                {t("fromLms")} {item.source} (mock) · {item.minutes} {t("min")}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <Icon name={item.format} className="h-3.5 w-3.5" /> {t(item.format)} · {item.minutes} {t("min")}
        </div>
        <h2 className="mt-1 text-base font-semibold">{item.title[L]}</h2>
        {item.sessions && (
          <div className="mt-2 text-xs text-ink-2">
            <b>{t("sessions")}:</b> {item.sessions.map((x) => `${x.date} · ${x.location[L]}`).join(" | ")}
          </div>
        )}
        <div className="mt-3 text-xs font-medium text-ink-3">{t("transcript")}</div>
        <p className="mt-1 text-sm text-ink-2">{item.content?.[L] ?? item.summary[L]}</p>
        {step && item.format === "project" && step.status !== "done" && (
          <div className="mt-3 space-y-2">
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={t("evidencePh")} rows={3} className="w-full rounded-xl border border-line bg-surface p-2 text-sm outline-none focus:border-brand" disabled={step.status === "submitted"} />
            {step.status === "submitted" ? (
              <Badge tone="warn">{t("waitingManager")}</Badge>
            ) : (
              <Button className="w-full" disabled={evidence.trim().length < 10} onClick={() => dispatch({ type: "submitProject", itemId: id, evidence })}>
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
        <div className="flex items-center gap-1.5 px-4 pt-2 text-xs font-medium text-ink-2">
          <Icon name="coach" className="h-3.5 w-3.5 text-brand" /> {t("askLesson")}
        </div>
        <CoachChat chatKey={`lesson:${id}`} lessonId={id} suggestions={LESSON_SUGGESTIONS[L]} compact />
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
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div className="text-sm font-semibold text-brand">{t("appName")}</div>
        <div className="text-[11px] text-ink-3">{hero.site[s.lang]}</div>
      </div>
      {s.toast && TOASTS[s.toast] && (
        <button onClick={() => dispatch({ type: "set", patch: { toast: undefined } })} className="mx-3 mt-2 rounded-xl bg-ok-soft px-3 py-2 text-left text-xs text-ok">
          ✓ {TOASTS[s.toast][s.lang]}
        </button>
      )}
      {s.assessing ? (
        <Assessment />
      ) : (
        <>
          <div className={cx("min-h-0 flex-1", s.tab === "coach" ? "flex flex-col" : "scroll-thin overflow-y-auto")}>
            {s.tab === "home" && <Home />}
            {s.tab === "skills" && <Skills />}
            {s.tab === "path" && <PathView />}
            {s.tab === "coach" && <CoachChat chatKey="coach" suggestions={COACH_SUGGESTIONS[s.lang]} />}
          </div>
          <nav className="grid grid-cols-4 border-t border-line bg-surface">
            {tabs.map((x) => (
              <button key={x.id} onClick={() => dispatch({ type: "set", patch: { tab: x.id, toast: undefined } })} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px]", s.tab === x.id ? "text-brand" : "text-ink-3")}>
                <Icon name={x.icon} className="h-5 w-5" />
                {t(x.id)}
              </button>
            ))}
          </nav>
        </>
      )}
      {s.lessonId && <Lesson id={s.lessonId} />}
    </PhoneFrame>
  );
}
