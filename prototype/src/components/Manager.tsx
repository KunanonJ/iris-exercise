"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import { roleById, skillById } from "@/data/taxonomy";
import { rulesPlan } from "@/lib/plan-rules";
import { directReports, employeeById, profile } from "@/lib/skills";
import type { Approval, Level } from "@/lib/types";
import { tr } from "./i18n";
import { HERO, MANAGER, useStore } from "./store";
import { Badge, Button, Card, cx, Icon, PhoneFrame } from "./ui";

const manager = employeeById(MANAGER)!;
const CANNED_EVIDENCE = {
  en: "Coached our new starter on receiving, till close, complaints, replenishment and the safety walk over 2 weeks. Log attached. She now closes the till alone without errors.",
  th: "โค้ชพนักงานใหม่เรื่องการรับสินค้า การปิดเครื่องคิดเงิน การรับเรื่องร้องเรียน การเติมสินค้า และการเดินตรวจความปลอดภัยตลอด 2 สัปดาห์ แนบบันทึกแล้ว ตอนนี้เธอปิดเครื่องคิดเงินเองได้โดยไม่ผิดพลาด",
};

const daysBetween = (a: string, b: number) => Math.round((Date.parse(a) - b) / 864e5);

function Detail({ ap, onClose }: { ap: Approval; onClose: () => void }) {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const emp = employeeById(ap.employeeId)!;
  const isHero = emp.id === HERO;
  const [note, setNote] = useState("");
  const [final, setFinal] = useState<Record<string, Level>>(() => {
    if (isHero) return { ...(s.assessment.final ?? {}) };
    const out: Record<string, Level> = {};
    for (const [k, v] of Object.entries(emp.scores)) out[k] = v.manager ?? v.final;
    return out;
  });

  const decide = (approve: boolean) => {
    const n = note.trim() || undefined;
    if (ap.kind === "assessment") dispatch({ type: "decideAssessment", approvalId: ap.id, approve, final, note: n });
    if (ap.kind === "plan") dispatch({ type: "decidePlan", approvalId: ap.id, approve, note: n });
    if (ap.kind === "project") dispatch({ type: "decideProject", approvalId: ap.id, approve, note: n });
    onClose();
  };

  let body;
  if (ap.kind === "assessment") {
    const ids = Object.keys(final);
    body = (
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="grid grid-cols-[1fr_40px_40px_92px] gap-1 border-b border-line bg-surface-2 px-2 py-1.5 text-[10px] font-medium text-ink-3">
          <span />
          <span className="text-center">{t("selfRating")}</span>
          <span className="text-center">{t("quizShort")}</span>
          <span className="text-center">{t("proposed")}</span>
        </div>
        {ids.map((id) => {
          const selfV = isHero ? s.assessment.self[id] : emp.scores[id]?.self;
          const quizV = isHero ? s.assessment.quiz[id] : undefined;
          const differs = selfV !== final[id];
          return (
            <div key={id} className="grid grid-cols-[1fr_40px_40px_92px] items-center gap-1 border-b border-line px-2 py-1.5 text-xs last:border-0">
              <span className="truncate">{skillById(id).name[L]}</span>
              <span className="text-center text-ink-3">{selfV ?? "-"}</span>
              <span className="text-center text-ink-3">{quizV ?? "-"}</span>
              <span className="flex items-center justify-center gap-1">
                <button className="h-6 w-6 rounded-lg border border-line" onClick={() => setFinal({ ...final, [id]: Math.max(1, final[id] - 1) as Level })}>
                  −
                </button>
                <span className={cx("w-5 text-center font-semibold", differs && "text-gap")}>{final[id]}</span>
                <button className="h-6 w-6 rounded-lg border border-line" onClick={() => setFinal({ ...final, [id]: Math.min(4, final[id] + 1) as Level })}>
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
    );
  } else if (ap.kind === "plan") {
    const plan = isHero ? s.plan : rulesPlan(emp);
    body = (
      <div className="space-y-2">
        {plan?.summary && <p className="text-xs text-ink-2">{plan.summary[L]}</p>}
        {plan?.steps.map((st) => {
          const item = itemById(st.itemId)!;
          return (
            <div key={st.itemId} className="rounded-xl border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon name={item.format} className="h-3.5 w-3.5 text-brand" /> {item.title[L]}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-3">
                {t("week")} {st.week} · {item.minutes} {t("min")}
                {item.format === "workshop" ? ` · ${L === "th" ? "ออกจากกะ" : "off-shift"}` : ""}
              </div>
              <p className="mt-1 text-xs text-ink-2">{st.rationale[L]}</p>
            </div>
          );
        })}
      </div>
    );
  } else {
    const item = itemById(ap.ref!)!;
    body = (
      <div className="space-y-2">
        <div className="text-sm font-medium">{item.title[L]}</div>
        <p className="text-xs text-ink-2">{item.content?.[L]}</p>
        <div className="rounded-xl border border-line bg-surface p-2.5 text-sm">{isHero ? s.evidence[item.id] : CANNED_EVIDENCE[L]}</div>
        <p className="text-[11px] text-ink-3">
          {L === "th" ? "เมื่ออนุมัติ ระดับทักษะจะอัปเดตเป็นระดับเป้าหมายของโปรเจกต์" : "Approving updates the skill to the project's target level."}{" "}
          {item.skills.map((x) => `${skillById(x.skillId).name[L]} → L${x.targetLevel}`).join(", ")}
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-surface-2">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <button onClick={onClose} className="text-sm text-ink-2">
          ← {t("back")}
        </button>
        <span className="text-sm font-medium">{t(`kind_${ap.kind}`)}</span>
        <span />
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div>
          <div className="font-semibold">{emp.name[L]}</div>
          <div className="text-xs text-ink-3">
            {roleById(emp.roleId).title[L]}
            {emp.nextRoleId ? ` → ${roleById(emp.nextRoleId).title[L]}` : ""}
          </div>
        </div>
        {body}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePh")} rows={2} className="w-full rounded-xl border border-line bg-surface p-2 text-sm outline-none focus:border-brand" />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line bg-surface p-3">
        <Button variant="danger" onClick={() => decide(false)}>
          {t("requestChanges")}
        </Button>
        <Button onClick={() => decide(true)}>{t("approve")}</Button>
      </div>
    </div>
  );
}

function Inbox() {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const [open, setOpen] = useState<string>();
  const [now] = useState(() => Date.now());
  const mine = s.approvals.filter((a) => employeeById(a.employeeId)?.managerId === MANAGER);
  const pending = mine.filter((a) => a.status === "pending").sort((a, b) => Number(b.employeeId === HERO) - Number(a.employeeId === HERO));
  const done = mine.filter((a) => a.status !== "pending");
  const batch = pending.filter((a) => a.employeeId !== HERO && a.kind !== "project");
  const active = s.approvals.find((a) => a.id === open);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {t("inbox")} <span className="text-ink-3">({pending.length})</span>
        </div>
        {batch.length > 1 && (
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() =>
              batch.forEach((a) =>
                dispatch(a.kind === "assessment" ? { type: "decideAssessment", approvalId: a.id, approve: true } : { type: "decidePlan", approvalId: a.id, approve: true }),
              )
            }
          >
            {t("approveAll")} ({batch.length})
          </Button>
        )}
      </div>
      <p className="text-[11px] text-ink-3">{t("slaNote")}</p>
      {!pending.length && <Card className="text-sm text-ink-2">{t("nothingPending")}</Card>}
      {pending.map((a) => {
        const emp = employeeById(a.employeeId)!;
        const left = daysBetween(a.dueAt, now);
        return (
          <Card key={a.id} onClick={() => setOpen(a.id)} className={cx("p-3", a.employeeId === HERO && "border-brand/40")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{emp.name[L]}</div>
                <div className="text-xs text-ink-2">{t(`kind_${a.kind}`)}</div>
              </div>
              {left < 0 ? <Badge tone="danger">{t("overdue")}</Badge> : <Badge tone="neutral">{t("due")} {left}d</Badge>}
            </div>
          </Card>
        );
      })}
      {done.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-medium text-ink-3">{L === "th" ? "ตัดสินใจแล้ว" : "Decided"}</div>
          {done.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-xs">
              <span className="truncate">
                {employeeById(a.employeeId)!.name[L]} · {t(`kind_${a.kind}`)}
              </span>
              <Badge tone={a.status === "approved" ? "ok" : "danger"}>{a.status === "approved" ? t("approved") : t("changesRequested")}</Badge>
            </div>
          ))}
        </div>
      )}
      {active && <Detail ap={active} onClose={() => setOpen(undefined)} />}
    </div>
  );
}

function Team() {
  const { s } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const team = directReports(MANAGER);
  return (
    <div className="space-y-2 p-4">
      <div className="text-sm font-semibold">{t("readiness")}</div>
      <p className="text-[11px] text-ink-3">{L === "th" ? "หัวหน้าเห็นข้อมูลเฉพาะลูกทีมโดยตรงเท่านั้น" : "Managers see their direct reports only."}</p>
      {team.map((e) => {
        const p = profile(e, e.id === HERO && s.assessment.status === "approved" ? s.overrides : undefined);
        const crit = p.nextGaps.filter((g) => g.critical && g.gap > 0).length;
        return (
          <div key={e.id} className="rounded-xl border border-line bg-surface px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{e.name[L]}</div>
                <div className="truncate text-[11px] text-ink-3">
                  {roleById(e.roleId).title[L]}
                  {p.next ? ` → ${p.next.title[L]}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{p.next ? `${Math.round(p.nextReadiness * 100)}%` : "-"}</div>
                {crit > 0 && <div className="text-[10px] text-gap">{crit} {L === "th" ? "ทักษะสำคัญที่ยังขาด" : "critical gaps"}</div>}
              </div>
            </div>
            {p.next && (
              <div className="mt-1.5 h-1.5 rounded-full bg-line">
                <div className="h-1.5 rounded-full bg-brand" style={{ width: `${p.nextReadiness * 100}%` }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ManagerApp() {
  const { s } = useStore();
  const t = tr(s.lang);
  const [tab, setTab] = useState<"inbox" | "team">("inbox");
  const pending = s.approvals.filter((a) => a.status === "pending" && employeeById(a.employeeId)?.managerId === MANAGER).length;
  return (
    <PhoneFrame label={`${manager.name[s.lang]} · ${roleById(manager.roleId).title[s.lang]}`}>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div className="text-sm font-semibold text-brand">{t("appName")}</div>
        <div className="text-[11px] text-ink-3">{manager.site[s.lang]}</div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{tab === "inbox" ? <Inbox /> : <Team />}</div>
      <nav className="grid grid-cols-2 border-t border-line bg-surface">
        {(["inbox", "team"] as const).map((x) => (
          <button key={x} onClick={() => setTab(x)} className={cx("relative flex flex-col items-center gap-0.5 py-2 text-[11px]", tab === x ? "text-brand" : "text-ink-3")}>
            <Icon name={x} className="h-5 w-5" />
            {t(x)}
            {x === "inbox" && pending > 0 && <span className="absolute right-[38%] top-1 rounded-full bg-danger px-1.5 text-[9px] text-white">{pending}</span>}
          </button>
        ))}
      </nav>
    </PhoneFrame>
  );
}
