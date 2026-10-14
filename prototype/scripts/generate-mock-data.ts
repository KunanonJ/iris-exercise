// Generates the mock employees and dashboard metrics used by the prototype.
// Everything here is invented. Deterministic seed so the data is stable.
// Run: pnpm data
import { mkdirSync, writeFileSync } from "node:fs";
import { BUSINESS_UNITS, PILOT, roleById } from "../src/data/taxonomy";
import type { BUId, Bilingual, Employee, Level, SkillScore } from "../src/lib/types";

let seed = 20261014;
function rand() {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const clamp = (n: number): Level => Math.max(1, Math.min(4, Math.round(n))) as Level;

const FIRST: [string, string][] = [
  ["Somsri", "สมศรี"], ["Wichai", "วิชัย"], ["Prasert", "ประเสริฐ"], ["Sunee", "สุนีย์"], ["Thanakorn", "ธนากร"],
  ["Kamon", "กมล"], ["Napa", "นภา"], ["Pimchanok", "พิมพ์ชนก"], ["Sakchai", "ศักดิ์ชัย"], ["Anan", "อนันต์"],
  ["Chanpen", "จันทร์เพ็ญ"], ["Nattapon", "ณัฐพล"], ["Piya", "ปิยะ"], ["Wanna", "วรรณา"], ["Chaiwat", "ชัยวัฒน์"],
  ["Kitti", "กิตติ"], ["Rattana", "รัตนา"], ["Suda", "สุดา"], ["Teera", "ธีระ"], ["Ampai", "อำไพ"],
  ["Boonmee", "บุญมี"], ["Preecha", "ปรีชา"], ["Siriporn", "ศิริพร"], ["Ekkachai", "เอกชัย"], ["Nipa", "นิภา"],
  ["Sombat", "สมบัติ"], ["Lamduan", "ลำดวน"], ["Duangjai", "ดวงใจ"], ["Manop", "มานพ"], ["Orathai", "อรทัย"],
];
const LAST: [string, string][] = [
  ["Rakngan", "รักงาน"], ["Mankong", "มั่นคง"], ["Srisuk", "ศรีสุข"], ["Thongdee", "ทองดี"], ["Kaewsai", "แก้วใส"],
  ["Boonruang", "บุญเรือง"], ["Phuengton", "พึ่งตน"], ["Fairu", "ใฝ่รู้"], ["Piandee", "เพียรดี"], ["Saithong", "สายทอง"],
  ["Rungruang", "รุ่งเรือง"], ["Kaona", "ก้าวหน้า"], ["Khayan", "ขยัน"], ["Jaiyen", "ใจเย็น"], ["Sangsan", "สร้างสรรค์"],
];

let counter = 100;
const employees: Employee[] = [];

function name(): Bilingual {
  const f = pick(FIRST);
  const l = pick(LAST);
  return { en: `${f[0]} ${l[0]}`, th: `${f[1]} ${l[1]}` };
}

function scoresFor(roleId: string, nextRoleId: string | null, profile: "strong" | "typical" | "new"): Record<string, SkillScore> {
  const role = roleById(roleId);
  const next = nextRoleId ? roleById(nextRoleId) : null;
  const out: Record<string, SkillScore> = {};
  const bias = profile === "strong" ? 0.3 : profile === "new" ? -0.7 : -0.15;
  for (const req of role.requirements) {
    const final = clamp(req.level + bias + (rand() - 0.5) * 1.4);
    out[req.skillId] = { self: clamp(final + (rand() < 0.45 ? 1 : 0)), manager: final, final };
  }
  for (const req of next?.requirements ?? []) {
    if (out[req.skillId]) continue;
    const final = clamp(req.level - 1 + bias + (rand() - 0.5));
    out[req.skillId] = { self: clamp(final + (rand() < 0.45 ? 1 : 0)), manager: final, final };
  }
  return out;
}

function add(e: Omit<Employee, "id" | "scores"> & { id?: string; scores?: Employee["scores"] }, profile: "strong" | "typical" | "new" = "typical") {
  const emp: Employee = {
    ...e,
    id: e.id ?? `E${String(counter++).padStart(4, "0")}`,
    scores: e.scores ?? scoresFor(e.roleId, e.nextRoleId, profile),
  };
  employees.push(emp);
  return emp;
}

const site = (en: string, th: string): Bilingual => ({ en, th });
const nextOf = (roleId: string) => roleById(roleId).nextRoles[0] ?? null;

// --- Hero store: Store #112 Bang Na -------------------------------------
const areaMgr = add({ id: "E0010", name: { en: "Prasert Mankong", th: "ประเสริฐ มั่นคง" }, bu: "RD", roleId: "RD-AM", nextRoleId: null, managerId: null, site: site("Bangkok East Area", "เขตกรุงเทพฯ ตะวันออก"), lang: "th", frontline: false }, "strong");
const bangNa = site("Store #112 Bang Na", "สาขา 112 บางนา");
const malee = add({ id: "E0002", name: { en: "Malee Suksan", th: "มาลี สุขสันต์" }, bu: "RD", roleId: "RD-SM", nextRoleId: "RD-AM", managerId: areaMgr.id, site: bangNa, lang: "th", frontline: true }, "strong");

// Somchai Jaidee is the Thai equivalent of "John Doe": the hero persona.
add({
  id: "E0001", name: { en: "Somchai Jaidee", th: "สมชาย ใจดี" }, bu: "RD", roleId: "RD-SSA", nextRoleId: "RD-SS",
  managerId: malee.id, site: bangNa, lang: "th", frontline: true,
  scores: {
    "C-SAFE": { self: 3, final: 2 }, "C-CUST": { self: 3, final: 3 }, "T-POS": { self: 3, final: 3 },
    "T-MERCH": { self: 2, final: 2 }, "T-INV": { self: 2, final: 2 }, "T-CMPL": { self: 3, final: 2 },
    "C-COMM": { self: 2, final: 2 }, "L-COACH": { self: 2, final: 1 }, "L-PLAN": { self: 1, final: 1 },
    "L-PERF": { self: 1, final: 1 }, "L-DEC": { self: 2, final: 2 },
  },
});
const bangNaTeam: [string, number][] = [["RD-SS", 1], ["RD-SSA", 2], ["RD-SA", 4]];
for (const [roleId, n] of bangNaTeam)
  for (let i = 0; i < n; i++)
    add({ name: name(), bu: "RD", roleId, nextRoleId: nextOf(roleId), managerId: malee.id, site: bangNa, lang: "th", frontline: true }, pick(["strong", "typical", "typical", "new"]));

// --- Other RD stores and DCs ---------------------------------------------
const STORES = ["Rangsit", "Nonthaburi", "Chonburi", "Khon Kaen", "Chiang Mai", "Hat Yai", "Korat", "Ayutthaya", "Phitsanulok", "Udon Thani"];
const STORES_TH = ["รังสิต", "นนทบุรี", "ชลบุรี", "ขอนแก่น", "เชียงใหม่", "หาดใหญ่", "โคราช", "อยุธยา", "พิษณุโลก", "อุดรธานี"];
STORES.forEach((s, i) => {
  const st = site(`Store #${120 + i} ${s}`, `สาขา ${120 + i} ${STORES_TH[i]}`);
  const sm = add({ name: name(), bu: "RD", roleId: "RD-SM", nextRoleId: "RD-AM", managerId: areaMgr.id, site: st, lang: "th", frontline: true });
  const team: [string, number][] = [["RD-SS", 1], ["RD-SSA", 2], ["RD-SA", 4 + (i % 3)]];
  for (const [roleId, n] of team)
    for (let k = 0; k < n; k++)
      add({ name: name(), bu: "RD", roleId, nextRoleId: nextOf(roleId), managerId: sm.id, site: st, lang: "th", frontline: true }, pick(["strong", "typical", "typical", "new"]));
});
[["Wang Noi DC", "ศูนย์กระจายสินค้าวังน้อย"], ["Bang Phli DC", "ศูนย์กระจายสินค้าบางพลี"]].forEach(([en, th]) => {
  const st = site(en, th);
  const wm = add({ name: name(), bu: "RD", roleId: "RD-WM", nextRoleId: null, managerId: null, site: st, lang: "th", frontline: false });
  add({ name: name(), bu: "RD", roleId: "RD-LP", nextRoleId: null, managerId: wm.id, site: st, lang: "th", frontline: false });
  for (let t = 0; t < 2; t++) {
    const tl = add({ name: name(), bu: "RD", roleId: "RD-WTL", nextRoleId: "RD-WM", managerId: wm.id, site: st, lang: "th", frontline: true });
    for (let k = 0; k < 6; k++) add({ name: name(), bu: "RD", roleId: "RD-WO", nextRoleId: "RD-WTL", managerId: tl.id, site: st, lang: "th", frontline: true }, pick(["typical", "new"]));
  }
});

// --- Packaging plants --------------------------------------------------
[["Rayong Plant", "โรงงานระยอง"], ["Samut Prakan Plant", "โรงงานสมุทรปราการ"]].forEach(([en, th]) => {
  const st = site(en, th);
  const pm = add({ name: name(), bu: "PK", roleId: "PK-PM", nextRoleId: null, managerId: null, site: st, lang: "th", frontline: false });
  add({ name: name(), bu: "PK", roleId: "PK-PP", nextRoleId: null, managerId: pm.id, site: st, lang: "th", frontline: false });
  const ql = add({ name: name(), bu: "PK", roleId: "PK-QL", nextRoleId: null, managerId: pm.id, site: st, lang: "th", frontline: false });
  for (let k = 0; k < 3; k++) add({ name: name(), bu: "PK", roleId: "PK-QI", nextRoleId: "PK-QL", managerId: ql.id, site: st, lang: "th", frontline: true });
  for (let s = 0; s < 2; s++) {
    const shs = add({ name: name(), bu: "PK", roleId: "PK-SHS", nextRoleId: "PK-PM", managerId: pm.id, site: st, lang: "th", frontline: true });
    add({ name: name(), bu: "PK", roleId: "PK-MT", nextRoleId: "PK-LL", managerId: shs.id, site: st, lang: "th", frontline: true });
    for (let l = 0; l < 2; l++) {
      const ll = add({ name: name(), bu: "PK", roleId: "PK-LL", nextRoleId: "PK-SHS", managerId: shs.id, site: st, lang: "th", frontline: true });
      add({ name: name(), bu: "PK", roleId: "PK-SMO", nextRoleId: "PK-LL", managerId: ll.id, site: st, lang: "th", frontline: true });
      for (let k = 0; k < 3; k++) add({ name: name(), bu: "PK", roleId: "PK-MO", nextRoleId: "PK-SMO", managerId: ll.id, site: st, lang: "th", frontline: true }, pick(["typical", "new"]));
    }
  }
});

// --- Later-wave BUs (small samples) ---------------------------------------
const bmSite = site("Saraburi Plant", "โรงงานสระบุรี");
const pss = add({ name: name(), bu: "BM", roleId: "BM-PSS", nextRoleId: null, managerId: null, site: bmSite, lang: "th", frontline: true });
for (let k = 0; k < 8; k++) add({ name: name(), bu: "BM", roleId: "BM-PO", nextRoleId: "BM-PSS", managerId: pss.id, site: bmSite, lang: "th", frontline: true });
const chSite = site("Map Ta Phut Complex", "นิคมมาบตาพุด");
const pe = add({ name: name(), bu: "CH", roleId: "CH-PE", nextRoleId: null, managerId: null, site: chSite, lang: "th", frontline: false });
for (let k = 0; k < 6; k++) add({ name: name(), bu: "CH", roleId: "CH-PT", nextRoleId: "CH-PE", managerId: pe.id, site: chSite, lang: "th", frontline: true });
const hq = site("Group HQ, Bangkok", "สำนักงานใหญ่ กรุงเทพฯ");
add({ id: "E9001", name: { en: "Arunee Srisuk", th: "อรุณี ศรีสุข" }, bu: "CS", roleId: "CS-HR", nextRoleId: null, managerId: null, site: hq, lang: "en", frontline: false }, "strong");
for (const roleId of ["CS-FA", "CS-FA", "CS-FBP", "CS-PO", "CS-PO"]) add({ name: name(), bu: "CS", roleId, nextRoleId: nextOf(roleId), managerId: null, site: hq, lang: pick(["th", "en"]), frontline: false });

// --- Dashboard aggregates (pilot of 12,000; illustrative) ---------------
const weeks = Array.from({ length: 9 }, (_, w) => w);
// Staged go-live: 1,000 friendly users in week 0, everyone invited by week 2.
const sCurve = (w: number, k: number, mid: number) => 1 / (1 + Math.exp(-k * (w - mid)));
const funnel = weeks.map((w) => {
  const jitter = () => 1 + (rand() - 0.5) * 0.03;
  return {
    week: w,
    invited: w === 0 ? 1000 : w === 1 ? 6000 : PILOT.headcount,
    activated: Math.round(PILOT.headcount * 0.88 * sCurve(w, 1.1, 2.2) * jitter()),
    assessed: Math.round(PILOT.headcount * 0.74 * sCurve(w, 0.95, 3.0) * jitter()),
    approved: Math.round(PILOT.headcount * 0.66 * sCurve(w, 0.9, 3.6) * jitter()),
    planActive: Math.round(PILOT.headcount * 0.55 * sCurve(w, 0.85, 4.3) * jitter()),
  };
});

type Cat = "core" | "technical" | "leadership";
const cats: Cat[] = ["core", "technical", "leadership"];
const heatmap = BUSINESS_UNITS.map((bu) => ({
  bu: bu.id as BUId,
  cells: cats.map((c) => {
    if (!bu.pilot) return { category: c, baseline: null, now: null };
    const base = 0.42 + rand() * 0.2 - (c === "leadership" ? 0.12 : 0);
    return { category: c, baseline: +base.toFixed(2), now: +(base + 0.04 + rand() * 0.06).toFixed(2) };
  }),
}));

// Business link: readiness of supervisors vs KPI, one point per store / line.
const storesKpi = Array.from({ length: 40 }, (_, i) => {
  const readiness = 0.3 + rand() * 0.6;
  const shrink = 2.4 - readiness * 1.0 + (rand() - 0.5) * 1.1;
  return { id: `S${101 + i}`, readiness: +readiness.toFixed(2), kpi: +shrink.toFixed(2) };
});
const linesKpi = Array.from({ length: 24 }, (_, i) => {
  const readiness = 0.3 + rand() * 0.6;
  const oee = 62 + readiness * 14 + (rand() - 0.5) * 12;
  return { id: `L${11 + i}`, readiness: +readiness.toFixed(2), kpi: +oee.toFixed(1) };
});

const coach = weeks.slice(1).map((w) => ({
  week: w,
  conversations: Math.round(1200 + w * 900 + rand() * 300),
  csat: +(4.0 + rand() * 0.4).toFixed(2),
  escalationRate: +(0.012 + rand() * 0.01).toFixed(3),
  flagged: Math.round(8 + rand() * 10),
}));

const metrics = {
  note: "Illustrative mock data for the case exercise. Not real.",
  pilot: PILOT,
  funnel,
  heatmap,
  business: {
    rd: { label: { en: "Store shrink % vs supervisor readiness", th: "อัตราการสูญหาย % เทียบความพร้อมของหัวหน้างาน" }, kpi: { en: "Shrink %", th: "การสูญหาย %" }, points: storesKpi },
    pk: { label: { en: "Line OEE % vs line-leader readiness", th: "OEE % ของไลน์เทียบความพร้อมของหัวหน้าไลน์" }, kpi: { en: "OEE %", th: "OEE %" }, points: linesKpi },
  },
  coach,
};

mkdirSync("src/data/generated", { recursive: true });
writeFileSync("src/data/generated/employees.json", JSON.stringify(employees));
writeFileSync("src/data/generated/metrics.json", JSON.stringify(metrics, null, 1));
console.log(`employees: ${employees.length}, managers: ${new Set(employees.map((e) => e.managerId).filter(Boolean)).size}`);
