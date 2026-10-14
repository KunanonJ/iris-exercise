"use client";

import { useState } from "react";
import { itemById } from "@/data/catalog";
import { roleById, skillById } from "@/data/taxonomy";
import { rulesPlan } from "@/lib/plan-rules";
import { directReports, employeeById, profile } from "@/lib/skills";
import type { Approval, Level } from "@/lib/types";
import { tr } from "./i18n";
import { HERO, MANAGER, useStore } from "./store";
import { Avatar, Badge, Button, Card, cx, Icon, PhoneFrame, Ring } from "./ui";

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
    if (ap.kind === "assessment")
      dispatch({ type: "decideAssessment", approvalId: ap.id, approve, final, note: n });
    if (ap.kind === "plan")
      dispatch({ type: "decidePlan", approvalId: ap.id, approve, note: n });
    if (ap.kind === "project")
      dispatch({ type: "decideProject", approvalId: ap.id, approve, note: n });
    onClose();
  };

  let body;
  if (ap.kind === "assessment") {
    const ids = Object.keys(final);
    body = (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-[1fr_42px_42px_96px] gap-1 border-b border-line bg-surface-2 px-3 py-2 text-[10px] font-semibold text-ink-3">
          <span>{t("skills")}</span>
          <span className="text-center">{t("selfRating")}</span>
          <span className="text-center">{t("quizShort")}</span>
          <span className="text-center">{t("proposed")}</span>
        </div>
        <div className="divide-y divide-line">
          {ids.map((id) => {
            const selfV = isHero ? s.assessment.self[id] : emp.scores[id]?.self;
            const quizV = isHero ? s.assessment.quiz[id] : undefined;
            const differs = selfV !== final[id];
            return (
              <div
                key={id}
                className={cx(
                  "grid grid-cols-[1fr_42px_42px_96px] items-center gap-1 px-3 py-2 text-xs transition",
                  differs && "bg-brand-soft/45",
                )}
              >
                <span className="truncate font-medium text-ink">
                  {skillById(id).name[L]}
                  {differs && (
                    <span className="ml-1.5 inline-block rounded bg-gap-soft px-1 py-0.2 text-[9px] font-semibold text-gap">
                      {L === "th" ? "ปรับเทียบ" : "Calibrated"}
                    </span>
                  )}
                </span>
                <span className="text-center tabular-nums text-ink-3">
                  {selfV ? `L${selfV}` : "–"}
                </span>
                <span className="text-center tabular-nums text-ink-3">
                  {quizV ? `L${quizV}` : "–"}
                </span>
                <span className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Decrease level"
                    className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface-2 font-bold text-ink hover:border-brand/40 cursor-pointer"
                    onClick={() =>
                      setFinal({ ...final, [id]: Math.max(1, final[id] - 1) as Level })
                    }
                  >
                    −
                  </button>
                  <span
                    className={cx(
                      "font-display w-6 text-center text-xs font-bold tabular-nums",
                      differs ? "text-gap" : "text-brand",
                    )}
                  >
                    L{final[id]}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase level"
                    className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface-2 font-bold text-ink hover:border-brand/40 cursor-pointer"
                    onClick={() =>
                      setFinal({ ...final, [id]: Math.min(4, final[id] + 1) as Level })
                    }
                  >
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (ap.kind === "plan") {
    const plan = isHero ? s.plan : rulesPlan(emp);
    body = (
      <div className="space-y-2">
        {plan?.summary && (
          <p className="text-xs leading-relaxed text-ink-2">{plan.summary[L]}</p>
        )}
        {plan?.steps.map((st) => {
          const item = itemById(st.itemId)!;
          return (
            <div key={st.itemId} className="rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name={item.format} className="h-4 w-4 text-brand" /> {item.title[L]}
                </div>
                <Badge tone="neutral">
                  {t("week")} {st.week}
                </Badge>
              </div>
              <div className="mt-1 text-[11px] text-ink-3">
                {t(item.format)} · {item.minutes} {t("min")} · {item.source}
                {item.format === "workshop"
                  ? ` · ${L === "th" ? "ออกจากกะ" : "off-shift"}`
                  : ""}
              </div>
              <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-ink-2">
                <b>{t("why")}:</b> {st.rationale[L]}
              </p>
            </div>
          );
        })}
      </div>
    );
  } else {
    const item = itemById(ap.ref!)!;
    body = (
      <div className="space-y-2.5">
        <div className="text-sm font-semibold text-ink">{item.title[L]}</div>
        <p className="text-xs leading-relaxed text-ink-2">{item.content?.[L]}</p>
        <div className="rounded-2xl border border-line bg-surface p-3 text-sm leading-relaxed text-ink">
          {isHero ? s.evidence[item.id] : CANNED_EVIDENCE[L]}
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-brand-soft/60 p-2.5 text-[11px] text-ink-2">
          <Icon name="trendUp" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
          <span>
            {L === "th"
              ? "เมื่ออนุมัติ ระดับทักษะจะอัปเดตเป็นระดับเป้าหมายของโปรเจกต์:"
              : "Approving updates the skill to the project's target level:"}{" "}
            <b className="text-brand">
              {item.skills
                .map((x) => `${skillById(x.skillId).name[L]} → L${x.targetLevel}`)
                .join(", ")}
            </b>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-sheet-up absolute inset-0 z-20 flex flex-col bg-surface-2">
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-ink-2 hover:text-ink cursor-pointer"
        >
          ← {t("back")}
        </button>
        <Badge tone="brand">{t(`kind_${ap.kind}`)}</Badge>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <Avatar name={emp.name[L]} />
          <div>
            <div className="font-semibold text-ink">{emp.name[L]}</div>
            <div className="text-xs text-ink-3">
              {roleById(emp.roleId).title[L]}
              {emp.nextRoleId ? ` → ${roleById(emp.nextRoleId).title[L]}` : ""}
            </div>
          </div>
        </div>
        {body}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("notePh")}
          rows={2}
          className="w-full rounded-xl border border-line bg-surface p-2.5 text-sm outline-none focus:border-brand"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line bg-surface p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button variant="danger" onClick={() => decide(false)}>
          {t("requestChanges")}
        </Button>
        <Button onClick={() => decide(true)}>
          <Icon name="check" /> {t("approve")}
        </Button>
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
  const pending = mine
    .filter((a) => a.status === "pending")
    .sort((a, b) => Number(b.employeeId === HERO) - Number(a.employeeId === HERO));
  const done = mine.filter((a) => a.status !== "pending");
  const batch = pending.filter((a) => a.employeeId !== HERO && a.kind !== "project");
  const active = s.approvals.find((a) => a.id === open);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center gap-3 text-xs">
          <div>
            <div className="font-display text-base font-bold tabular-nums text-ink">
              {pending.length}
            </div>
            <div className="text-[10px] text-ink-3">{t("inbox")}</div>
          </div>
          <div className="h-6 w-px bg-line" />
          <div>
            <div className="font-display text-base font-bold tabular-nums text-ok">
              {pending.filter((a) => daysBetween(a.dueAt, now) >= 0).length}
            </div>
            <div className="text-[10px] text-ink-3">≤5d SLA</div>
          </div>
          <div className="h-6 w-px bg-line" />
          <div>
            <div className="font-display text-base font-bold tabular-nums text-danger">
              {pending.filter((a) => daysBetween(a.dueAt, now) < 0).length}
            </div>
            <div className="text-[10px] text-ink-3">HRBP</div>
          </div>
        </div>
        {batch.length > 1 && (
          <Button
            variant="soft"
            className="shrink-0 px-2.5 py-1.5 text-xs"
            onClick={() =>
              batch.forEach((a) =>
                dispatch(
                  a.kind === "assessment"
                    ? { type: "decideAssessment", approvalId: a.id, approve: true }
                    : { type: "decidePlan", approvalId: a.id, approve: true },
                ),
              )
            }
          >
            <Icon name="check" /> {t("approveAll")} ({batch.length})
          </Button>
        )}
      </div>
      <p className="text-[11px] text-ink-3">{t("slaNote")}</p>

      {!pending.length && (
        <Card className="border-ok/30 bg-ok-soft/45 text-center text-sm text-ink-2">
          {t("nothingPending")}
        </Card>
      )}

      {pending.map((a) => {
        const emp = employeeById(a.employeeId)!;
        const left = daysBetween(a.dueAt, now);
        return (
          <Card
            key={a.id}
            onClick={() => setOpen(a.id)}
            className={cx(
              "p-3.5",
              a.employeeId === HERO && "border-brand/45 bg-brand-soft/35",
            )}
          >
            <div className="flex items-center gap-3">
              <Avatar name={emp.name[L]} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{emp.name[L]}</div>
                    <div className="text-xs font-medium text-brand">{t(`kind_${a.kind}`)}</div>
                  </div>
                  {left < 0 ? (
                    <Badge tone="danger">{t("overdue")}</Badge>
                  ) : (
                    <Badge tone="neutral">
                      {t("due")} {left}d
                    </Badge>
                  )}
                </div>
              </div>
              <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-ink-3" />
            </div>
          </Card>
        );
      })}

      {done.length > 0 && (
        <div className="space-y-1.5 pt-2">
          <div className="text-xs font-semibold text-ink-3">
            {L === "th" ? "ตัดสินใจแล้ว" : "Decided"}
          </div>
          {done.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2 text-xs"
            >
              <span className="truncate text-ink-2">
                <b className="text-ink">{employeeById(a.employeeId)!.name[L]}</b> ·{" "}
                {t(`kind_${a.kind}`)}
              </span>
              <Badge tone={a.status === "approved" ? "ok" : "danger"}>
                {a.status === "approved" ? t("approved") : t("changesRequested")}
              </Badge>
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
    <div className="space-y-2.5 p-4">
      <div>
        <div className="text-sm font-semibold text-ink">{t("readiness")}</div>
        <p className="text-[11px] text-ink-3">
          {L === "th"
            ? "หัวหน้าเห็นข้อมูลเฉพาะลูกทีมโดยตรงเท่านั้น"
            : "Managers see their direct reports only."}
        </p>
      </div>
      {team.map((e) => {
        const p = profile(
          e,
          e.id === HERO && s.assessment.status === "approved" ? s.overrides : undefined,
        );
        const crit = p.nextGaps.filter((g) => g.critical && g.gap > 0).length;
        return (
          <Card key={e.id} className="p-3.5">
            <div className="flex items-center gap-3">
              {p.next ? (
                <Ring value={p.nextReadiness} size={46} />
              ) : (
                <Avatar name={e.name[L]} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold text-ink">{e.name[L]}</div>
                  {crit > 0 ? (
                    <Badge tone="gap">
                      {crit} {L === "th" ? "ทักษะสำคัญที่ยังขาด" : "critical gaps"}
                    </Badge>
                  ) : (
                    <Badge tone="ok">{t("met")}</Badge>
                  )}
                </div>
                <div className="truncate text-xs text-ink-2">
                  {roleById(e.roleId).title[L]}
                  {p.next ? ` → ${p.next.title[L]}` : ""}
                </div>
                {p.next && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300"
                      style={{ width: `${p.nextReadiness * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function ManagerApp() {
  const { s } = useStore();
  const t = tr(s.lang);
  const [tab, setTab] = useState<"inbox" | "team">("inbox");
  const pending = s.approvals.filter(
    (a) => a.status === "pending" && employeeById(a.employeeId)?.managerId === MANAGER,
  ).length;
  return (
    <PhoneFrame label={`${manager.name[s.lang]} · ${roleById(manager.roleId).title[s.lang]}`}>
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar name={manager.name[s.lang]} size="sm" />
          <div>
            <div className="text-sm font-semibold leading-tight text-brand">{t("appName")}</div>
            <div className="text-[11px] text-ink-3">{manager.site[s.lang]}</div>
          </div>
        </div>
        <Badge tone="neutral">{manager.name[s.lang].split(" ")[0]}</Badge>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {tab === "inbox" ? <Inbox /> : <Team />}
      </div>
      <nav className="grid grid-cols-2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        {(["inbox", "team"] as const).map((x) => {
          const active = tab === x;
          return (
            <button
              key={x}
              type="button"
              onClick={() => setTab(x)}
              className={cx(
                "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition cursor-pointer",
                active ? "text-brand" : "text-ink-3 hover:text-ink-2",
              )}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-10 rounded-b-full bg-brand" />
              )}
              <Icon name={x} className="h-5 w-5" />
              {t(x)}
              {x === "inbox" && pending > 0 && (
                <span
                  aria-hidden="true"
                  className="font-display absolute top-1 right-[36%] rounded-full bg-danger px-1.5 text-[9px] font-bold tabular-nums text-white"
                >
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </PhoneFrame>
  );
}
