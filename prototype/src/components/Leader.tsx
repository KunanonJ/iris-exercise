"use client";

import { useState } from "react";
import metrics from "@/data/generated/metrics.json";
import { BUSINESS_UNITS } from "@/data/taxonomy";
import type { Bilingual, Lang } from "@/lib/types";
import { useStore } from "./store";
import { Badge, Card, cx } from "./ui";

type Point = { id: string; readiness: number; kpi: number };
const M = metrics as unknown as {
  pilot: { headcount: number };
  funnel: { week: number; activated: number; assessed: number; approved: number; planActive: number }[];
  heatmap: { bu: string; cells: { category: string; baseline: number | null; now: number | null }[] }[];
  business: Record<"rd" | "pk", { label: Bilingual; kpi: Bilingual; points: Point[] }>;
  coach: { week: number; conversations: number; csat: number; escalationRate: number; flagged: number }[];
};

const T = {
  title: { en: "Capability & impact", th: "ขีดความสามารถและผลลัพธ์" },
  sub: { en: "Wave 1: 12,000 employees, Retail & Distribution and Packaging (Thailand). Week 8 after go-live. Illustrative mock data.", th: "ระยะที่ 1: พนักงาน 12,000 คน ค้าปลีกและกระจายสินค้า และบรรจุภัณฑ์ (ประเทศไทย) สัปดาห์ที่ 8 หลังเปิดใช้ ข้อมูลจำลอง" },
  privacy: { en: "Aggregates only; groups under 10 people are hidden. No individual records in this view.", th: "แสดงเฉพาะภาพรวม กลุ่มที่ต่ำกว่า 10 คนจะถูกซ่อน ไม่มีข้อมูลรายบุคคลในมุมมองนี้" },
  adoption: { en: "Adoption by week", th: "การใช้งานรายสัปดาห์" },
  heat: { en: "Share of people meeting their role's skill requirements", th: "สัดส่วนพนักงานที่มีทักษะถึงเกณฑ์ของตำแหน่ง" },
  baseline: { en: "Baseline (week 0)", th: "ค่าตั้งต้น (สัปดาห์ 0)" },
  now: { en: "Now (week 8)", th: "ปัจจุบัน (สัปดาห์ 8)" },
  later: { en: "Later wave", th: "ระยะถัดไป" },
  link: { en: "Link to business results", th: "เชื่อมโยงกับผลลัพธ์ทางธุรกิจ" },
  linkNote: {
    en: "Correlation at launch, not causation. The staggered rollout gives us a comparison group: later-wave BUs act as controls, so we can read cause after two to three quarters.",
    th: "ช่วงเริ่มต้นเป็นความสัมพันธ์ ไม่ใช่เหตุและผล การทยอยเปิดใช้ทำให้มีกลุ่มเปรียบเทียบ หน่วยธุรกิจในระยะถัดไปเป็นกลุ่มควบคุม จึงสรุปผลเชิงเหตุได้หลัง 2-3 ไตรมาส",
  },
  coach: { en: "AI coach health", th: "สุขภาพของโค้ช AI" },
  table: { en: "Table", th: "ตาราง" },
  chart: { en: "Chart", th: "กราฟ" },
};

const SERIES = [
  { key: "activated", color: "#2a78d6", label: { en: "Logged in", th: "เข้าใช้งาน" } },
  { key: "assessed", color: "#eb6834", label: { en: "Assessed", th: "ประเมินแล้ว" } },
  { key: "approved", color: "#1baf7a", label: { en: "Manager-approved", th: "หัวหน้าอนุมัติ" } },
  { key: "planActive", color: "#eda100", label: { en: "Learning on a plan", th: "เรียนตามแผน" } },
] as const;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const fmt = (n: number) => n.toLocaleString("en-US");

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-ink-2">{sub}</div>}
    </Card>
  );
}

function AdoptionChart({ lang }: { lang: Lang }) {
  const [hover, setHover] = useState<number>();
  const W = 600, H = 230, P = { l: 44, r: 150, t: 12, b: 26 };
  const xs = M.funnel.map((f) => f.week);
  const x = (w: number) => P.l + (w / (xs.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / M.pilot.headcount) * (H - P.t - P.b);
  const last = M.funnel.at(-1)!;
  // Spread end labels so they never collide.
  const ends = SERIES.map((s) => ({ s, y: y(last[s.key]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  const h = hover !== undefined ? M.funnel[hover] : undefined;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(undefined)}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={P.l} x2={W - P.r} y1={y(g * M.pilot.headcount)} y2={y(g * M.pilot.headcount)} stroke="var(--grid)" />
            <text x={P.l - 6} y={y(g * M.pilot.headcount) + 4} textAnchor="end" className="fill-[var(--ink-3)] text-[10px]">
              {pct(g)}
            </text>
          </g>
        ))}
        {xs.map((w) => (
          <text key={w} x={x(w)} y={H - 8} textAnchor="middle" className="fill-[var(--ink-3)] text-[10px]">
            {lang === "th" ? `ส.${w}` : `W${w}`}
          </text>
        ))}
        {SERIES.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" points={M.funnel.map((f) => `${x(f.week)},${y(f[s.key])}`).join(" ")} />
        ))}
        {ends.map(({ s, y: ly }) => (
          <text key={s.key} x={W - P.r + 8} y={ly + 4} className="fill-[var(--ink-2)] text-[10px]">
            {s.label[lang]} {pct(last[s.key] / M.pilot.headcount)}
          </text>
        ))}
        {h && (
          <g>
            <line x1={x(h.week)} x2={x(h.week)} y1={P.t} y2={H - P.b} stroke="var(--ink-3)" strokeDasharray="3 3" />
            {SERIES.map((s) => (
              <circle key={s.key} cx={x(h.week)} cy={y(h[s.key])} r={4} fill={s.color} stroke="white" strokeWidth={2} />
            ))}
          </g>
        )}
        {xs.map((w, i) => (
          <rect key={w} x={x(w) - 20} y={P.t} width={40} height={H - P.t - P.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] shadow-sm" style={{ left: `${Math.min(70, (x(h.week) / W) * 100)}%` }}>
          <div className="font-medium">{lang === "th" ? `สัปดาห์ ${h.week}` : `Week ${h.week}`}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label[lang]}: {fmt(h[s.key])}
            </div>
          ))}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-ink-2">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className="h-0.5 w-4" style={{ background: s.color }} /> {s.label[lang]}
          </span>
        ))}
      </div>
    </div>
  );
}

const STEPS = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
const step = (v: number) => (v < 0.35 ? 0 : v < 0.45 ? 1 : v < 0.55 ? 2 : v < 0.65 ? 3 : 4);
const CATS: Record<string, Bilingual> = { core: { en: "Core", th: "ทักษะพื้นฐาน" }, technical: { en: "Technical", th: "ทักษะเทคนิค" }, leadership: { en: "Leadership", th: "ภาวะผู้นำ" } };

function Heatmap({ lang }: { lang: Lang }) {
  const [view, setView] = useState<"baseline" | "now">("now");
  const [asTable, setAsTable] = useState(false);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(["baseline", "now"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cx("rounded-full border px-2.5 py-1 text-xs", view === v ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2")}>
            {T[v][lang]}
          </button>
        ))}
        <button onClick={() => setAsTable(!asTable)} className="ml-auto text-xs text-brand">
          {asTable ? T.chart[lang] : T.table[lang]}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-ink-3">
              <th className="py-1 font-medium">BU</th>
              {Object.values(CATS).map((c) => (
                <th key={c.en} className="py-1 font-medium">{c[lang]} ({T.baseline[lang].split(" ")[0]} → {T.now[lang].split(" ")[0]})</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {M.heatmap.map((row) => (
              <tr key={row.bu} className="border-t border-line">
                <td className="py-1">{BUSINESS_UNITS.find((b) => b.id === row.bu)!.name[lang]}</td>
                {row.cells.map((c) => (
                  <td key={c.category} className="py-1 tabular-nums">{c.now === null ? T.later[lang] : `${pct(c.baseline!)} → ${pct(c.now)}`}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-[minmax(110px,1.3fr)_repeat(3,1fr)] gap-0.5 text-xs">
          <div />
          {Object.values(CATS).map((c) => (
            <div key={c.en} className="px-1 pb-1 text-center text-[11px] text-ink-3">{c[lang]}</div>
          ))}
          {M.heatmap.map((row) => (
            <div key={row.bu} className="contents">
              <div className="flex items-center pr-2 text-[11px] text-ink-2">{BUSINESS_UNITS.find((b) => b.id === row.bu)!.name[lang]}</div>
              {row.cells.map((c) => {
                const v = c[view];
                if (v === null)
                  return (
                    <div key={c.category} className="grid h-10 place-items-center rounded-md text-[10px] text-ink-3" style={{ background: "repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 4px, var(--grid) 4px, var(--grid) 6px)" }}>
                      {T.later[lang]}
                    </div>
                  );
                const k = step(v);
                const delta = c.now !== null && c.baseline !== null ? c.now - c.baseline : 0;
                return (
                  <div key={c.category} title={`${pct(v)}${view === "now" ? ` (+${Math.round(delta * 100)} pts)` : ""}`} className="grid h-10 place-items-center rounded-md font-medium tabular-nums" style={{ background: STEPS[k], color: k >= 2 ? "white" : "var(--ink)" }}>
                    {pct(v)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-ink-3">
        <span>&lt;35%</span>
        {STEPS.map((c) => (
          <span key={c} className="h-2 w-6 rounded-sm" style={{ background: c }} />
        ))}
        <span>65%+</span>
      </div>
    </div>
  );
}

function Scatter({ data, lang }: { data: { label: Bilingual; kpi: Bilingual; points: Point[] }; lang: Lang }) {
  const [hover, setHover] = useState<Point>();
  const W = 480, H = 260, P = { l: 40, r: 12, t: 10, b: 34 };
  const ys = data.points.map((p) => p.kpi);
  const ymin = Math.floor(Math.min(...ys)), ymax = Math.ceil(Math.max(...ys));
  const x = (v: number) => P.l + ((v - 0.2) / 0.8) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - ymin) / (ymax - ymin)) * (H - P.t - P.b);
  const n = data.points.length;
  const mx = data.points.reduce((s, p) => s + p.readiness, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  const slope = data.points.reduce((s, p) => s + (p.readiness - mx) * (p.kpi - my), 0) / data.points.reduce((s, p) => s + (p.readiness - mx) ** 2, 0);
  const r = data.points.reduce((s, p) => s + (p.readiness - mx) * (p.kpi - my), 0) / Math.sqrt(data.points.reduce((s, p) => s + (p.readiness - mx) ** 2, 0) * ys.reduce((s, v) => s + (v - my) ** 2, 0));
  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{data.label[lang]}</span>
        <Badge>r = {r.toFixed(2)}</Badge>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(undefined)}>
        {[0.2, 0.4, 0.6, 0.8, 1].map((g) => (
          <g key={g}>
            <line x1={x(g)} x2={x(g)} y1={P.t} y2={H - P.b} stroke="var(--grid)" />
            <text x={x(g)} y={H - P.b + 12} textAnchor="middle" className="fill-[var(--ink-3)] text-[10px]">{pct(g)}</text>
          </g>
        ))}
        {[ymin, (ymin + ymax) / 2, ymax].map((g) => (
          <text key={g} x={P.l - 4} y={y(g) + 3} textAnchor="end" className="fill-[var(--ink-3)] text-[10px]">{g.toFixed(1)}</text>
        ))}
        <text x={(P.l + W - P.r) / 2} y={H - 2} textAnchor="middle" className="fill-[var(--ink-3)] text-[10px]">{lang === "th" ? "ความพร้อมของหัวหน้างาน" : "Leader readiness"}</text>
        <clipPath id={`clip-${data.kpi.en.replace(/\W/g, "")}`}>
          <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} />
        </clipPath>
        <line clipPath={`url(#clip-${data.kpi.en.replace(/\W/g, "")})`} x1={x(0.25)} x2={x(0.95)} y1={y(my + slope * (0.25 - mx))} y2={y(my + slope * (0.95 - mx))} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 3" />
        {data.points.map((p) => (
          <g key={p.id} onMouseEnter={() => setHover(p)}>
            <circle cx={x(p.readiness)} cy={y(p.kpi)} r={10} fill="transparent" />
            <circle cx={x(p.readiness)} cy={y(p.kpi)} r={4} fill="#2a78d6" stroke="white" strokeWidth={2} opacity={hover && hover.id !== p.id ? 0.4 : 1} />
          </g>
        ))}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute right-2 top-7 rounded-lg border border-line bg-surface px-2 py-1 text-[11px] shadow-sm">
          {hover.id}: {pct(hover.readiness)} · {data.kpi[lang]} {hover.kpi}
        </div>
      )}
    </div>
  );
}

export function LeaderDashboard() {
  const { s } = useStore();
  const L = s.lang;
  const last = M.funnel.at(-1)!;
  const c = M.coach.at(-1)!;
  const growth = M.heatmap.flatMap((r) => r.cells).filter((x) => x.now !== null);
  const avgGain = growth.reduce((sum, x) => sum + (x.now! - x.baseline!), 0) / growth.length;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{T.title[L]}</h1>
        <p className="text-sm text-ink-2">{T.sub[L]}</p>
        <p className="mt-1 text-xs text-ink-3">{T.privacy[L]}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label={L === "th" ? "พนักงานระยะที่ 1" : "Wave 1 employees"} value={fmt(M.pilot.headcount)} />
        <Tile label={L === "th" ? "เข้าใช้งาน" : "Logged in"} value={pct(last.activated / M.pilot.headcount)} sub={fmt(last.activated)} />
        <Tile label={L === "th" ? "ผลประเมินอนุมัติแล้ว" : "Results approved"} value={pct(last.approved / M.pilot.headcount)} sub={fmt(last.approved)} />
        <Tile label={L === "th" ? "ความพร้อมเพิ่มขึ้น" : "Readiness gain"} value={`+${Math.round(avgGain * 100)} pts`} sub={L === "th" ? "เทียบค่าตั้งต้น" : "vs baseline"} />
        <Tile label={L === "th" ? "บทสนทนากับโค้ช/สัปดาห์" : "Coach chats / week"} value={fmt(c.conversations)} sub={`CSAT ${c.csat}/5`} />
        <Tile label={L === "th" ? "ค่า AI ต่อผู้ใช้ต่อเดือน" : "AI cost / active user / mo"} value="฿6" sub={L === "th" ? "ประมาณการ ดูแบบจำลองต้นทุน" : "estimate, see cost model"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 text-sm font-semibold">{T.adoption[L]}</div>
          <AdoptionChart lang={L} />
        </Card>
        <Card>
          <div className="mb-2 text-sm font-semibold">{T.heat[L]}</div>
          <Heatmap lang={L} />
        </Card>
      </div>
      <Card>
        <div className="text-sm font-semibold">{T.link[L]}</div>
        <p className="mb-3 text-xs text-ink-2">{T.linkNote[L]}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <Scatter data={M.business.rd} lang={L} />
          <Scatter data={M.business.pk} lang={L} />
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-semibold">{T.coach[L]}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="text-left text-ink-3">
                <th className="py-1 font-medium">{L === "th" ? "สัปดาห์" : "Week"}</th>
                <th className="py-1 font-medium">{L === "th" ? "บทสนทนา" : "Conversations"}</th>
                <th className="py-1 font-medium">CSAT</th>
                <th className="py-1 font-medium">{L === "th" ? "ส่งต่อคน" : "Escalated to a person"}</th>
                <th className="py-1 font-medium">{L === "th" ? "คำตอบที่ถูกแจ้ง (ตรวจโดย SME)" : "Flagged answers (SME-reviewed)"}</th>
              </tr>
            </thead>
            <tbody>
              {M.coach.map((r) => (
                <tr key={r.week} className="border-t border-line tabular-nums">
                  <td className="py-1">{r.week}</td>
                  <td className="py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-r-full bg-[#2a78d6]" style={{ width: `${(r.conversations / 9000) * 120}px` }} />
                      {fmt(r.conversations)}
                    </div>
                  </td>
                  <td className="py-1">{r.csat}</td>
                  <td className="py-1">{(r.escalationRate * 100).toFixed(1)}%</td>
                  <td className="py-1">{r.flagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
