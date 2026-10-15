// Hybrid-search stand-in: BM25 over approved content with Thai word
// segmentation (Intl.Segmenter). Production adds multilingual embeddings and
// re-ranking; the contract (top-k passages with ids for citation) is the same.
import { CATALOG, KNOWLEDGE } from "../../data/catalog";
import type { Bilingual, Lang, LearningItem } from "../types";

const sessionsText = (c: LearningItem, lang: Lang) =>
  c.sessions ? ` ${lang === "th" ? "รอบอบรม" : "Sessions"}: ${c.sessions.map((x) => `${x.date} (${x.location[lang]})`).join("; ")}.` : "";

export interface Passage {
  id: string; // e.g. "LA-101:th"
  sourceId: string; // catalogue item or knowledge doc id
  kind: "lesson" | "policy";
  lang: Lang;
  title: Bilingual;
  text: string; // indexed text: title + summary + body
  body: string; // lesson or policy body only
}

const STOP = new Set([
  "the", "a", "an", "is", "are", "to", "of", "and", "in", "for", "on", "how", "what", "i", "my", "do", "does", "can", "it", "me", "you", "be", "with", "this", "that", "about", "tell", "please", "explain", "should", "will", "would", "could",
  "ที่", "และ", "ใน", "ของ", "ให้", "ได้", "ไม่", "เป็น", "มี", "จะ", "คือ", "ว่า", "กับ", "แล้ว", "ครับ", "ค่ะ", "คะ", "นะ", "ไหม", "อย่างไร", "ยังไง", "อะไร", "ผม", "ฉัน", "หนู", "ดิฉัน", "บ้าง", "หรือ", "ก็", "นี้", "ต้อง", "ทำ", "ช่วย", "หน่อย", "บอก", "อธิบาย", "ควร",
]);

const segmenter = new Intl.Segmenter("th", { granularity: "word" });

export function tokenize(text: string): string[] {
  const out: string[] = [];
  for (const s of segmenter.segment(text.toLowerCase())) {
    if (!s.isWordLike) continue;
    const t = s.segment.trim();
    if (t.length < 2 && !/[฀-๿]/.test(t)) continue;
    if (!STOP.has(t)) out.push(t);
  }
  return out;
}

const PASSAGES: Passage[] = [
  ...CATALOG.filter((c) => c.content).flatMap((c) =>
    (["th", "en"] as Lang[]).map((lang) => ({
      id: `${c.id}:${lang}`, sourceId: c.id, kind: "lesson" as const, lang, title: c.title,
      text: `${c.title[lang]}. ${c.summary[lang]} ${c.content![lang]}${sessionsText(c, lang)}`,
      body: `${c.content![lang]}${sessionsText(c, lang)}`,
    })),
  ),
  ...KNOWLEDGE.flatMap((k) =>
    (["th", "en"] as Lang[]).map((lang) => ({
      id: `${k.id}:${lang}`, sourceId: k.id, kind: "policy" as const, lang, title: k.title,
      text: `${k.title[lang]}. ${k.content[lang]}`,
      body: k.content[lang],
    })),
  ),
];

const DOCS = PASSAGES.map((p) => {
  const toks = tokenize(p.text);
  const tf = new Map<string, number>();
  for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
  return { p, tf, len: toks.length };
});
const AVG = DOCS.reduce((s, d) => s + d.len, 0) / DOCS.length;
const DF = new Map<string, number>();
for (const d of DOCS) for (const t of d.tf.keys()) DF.set(t, (DF.get(t) ?? 0) + 1);

function bm25(q: string[], d: (typeof DOCS)[number]) {
  const k1 = 1.4, b = 0.75, N = DOCS.length;
  let score = 0, matched = 0;
  const uniq = new Set(q);
  for (const t of uniq) {
    const f = d.tf.get(t);
    if (!f) continue;
    matched++;
    const idf = Math.log(1 + (N - (DF.get(t) ?? 0) + 0.5) / ((DF.get(t) ?? 0) + 0.5));
    score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / AVG)));
  }
  return { score, coverage: uniq.size ? matched / uniq.size : 0 };
}

export interface Retrieved extends Passage { score: number }

/**
 * Returns up to k passages, one language version per source (the user's
 * language preferred). `pinned` sources (the lesson open next to the chat,
 * items in the approved plan) get a boost so answers stay on the learner's path.
 */
export function retrieve(query: string, lang: Lang, opts: { k?: number; pinned?: string[]; boost?: string[] } = {}): Retrieved[] {
  const { k = 4, pinned = [], boost = [] } = opts;
  const q = tokenize(query);
  const scored = DOCS.map((d) => {
    const m = bm25(q, d);
    let s = m.score;
    if (boost.includes(d.p.sourceId)) s *= 1.25;
    const isPinned = pinned.includes(d.p.sourceId);
    if (isPinned) s += 8;
    return { ...d.p, score: s, ok: isPinned || (m.coverage >= 0.4 && m.score > 1.2) };
  })
    .filter((r) => r.ok)
    .sort((a, b) => b.score - a.score);
  // One passage per source, served in the learner's language.
  const seen = new Set<string>();
  const out: Retrieved[] = [];
  for (const r of scored) {
    if (seen.has(r.sourceId)) continue;
    seen.add(r.sourceId);
    const local = PASSAGES.find((p) => p.sourceId === r.sourceId && p.lang === lang) ?? r;
    out.push({ ...local, score: r.score });
    if (out.length === k) break;
  }
  return out;
}

export const passageCount = PASSAGES.length;
export const passageFor = (sourceId: string, lang: Lang) => PASSAGES.find((p) => p.sourceId === sourceId && p.lang === lang)?.text ?? "";

// Reject a named course whose Latin topic token is absent from the approved
// corpus. Generic scheduling words must not make an unknown title look known.
const OFFER_WORDS = new Set("course courses workshop workshops certificate certification advanced attend registration register available location schedule date dates where when which learn learning please can could would show tell more about open session sessions teaching training".split(" "));
const APPROVED_WORDS = new Set(PASSAGES.flatMap((p) => tokenize(p.text)));
export function hasUnknownOfferTerm(query: string) {
  return tokenize(query).some((token) => /^[a-z][a-z0-9+.-]{2,}$/.test(token) && !OFFER_WORDS.has(token) && !APPROVED_WORDS.has(token));
}
