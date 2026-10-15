"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { itemById, KNOWLEDGE } from "@/data/catalog";
import type { ConversationMessage } from "@/lib/suite-contracts";
import type { Lang } from "@/lib/types";
import { apiErrorMessage } from "./secure-client";
import { Badge, Button, Card, cx } from "./ui";

export type SendCoach = (message: string, lessonId: string | undefined, onText: (text: string) => void) => Promise<Record<string, unknown>>;
type Source = { n: number; sourceId: string; title: string };

function sourcesFor(meta: Record<string, unknown> | undefined, lang: Lang): Source[] {
  if (!Array.isArray(meta?.sources)) return [];
  return meta.sources.flatMap((source: unknown) => {
    if (!source || typeof source !== "object") return [];
    const value = source as Record<string, unknown>;
    if (!Number.isInteger(value.n) || typeof value.sourceId !== "string") return [];
    const known = itemById(value.sourceId) ?? KNOWLEDGE.find(doc => doc.id === value.sourceId);
    const title = value.title && typeof value.title === "object" ? (value.title as Record<string, unknown>)[lang] : undefined;
    return [{ n: value.n as number, sourceId: value.sourceId, title: known?.title[lang] ?? (typeof title === "string" ? title : value.sourceId) }];
  });
}

function Provenance({ meta, lang }: { meta?: Record<string, unknown>; lang: Lang }) {
  const th = lang === "th";
  const provenance = typeof meta?.answerSource === "string" ? meta.answerSource : "unknown";
  const labels: Record<string, [string, string]> = {
    model: ["Live model answer", "คำตอบจากโมเดลสด"],
    safety_template: ["Safety response", "คำตอบด้านความปลอดภัย"],
    no_source: ["No supported source", "ไม่มีแหล่งข้อมูลรองรับ"],
    demo: ["Scripted demo answer", "คำตอบเดโมตามกฎ"],
    provider_fallback: ["Provider fallback · not a live-model pass", "คำตอบสำรอง · ไม่ใช่ผลผ่านจากโมเดลสด"],
    unknown: ["Answer provenance not verified", "ยังไม่ยืนยันแหล่งกำเนิดคำตอบ"],
  };
  return <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={provenance === "provider_fallback" || provenance === "unknown" ? "warn" : "neutral"}>{(labels[provenance] ?? labels.unknown)[th ? 1 : 0]}</Badge>{provenance === "model" && typeof meta?.model === "string" && <span className="text-[11px] text-ink-3">{meta.model}</span>}</div>;
}

function Reply({ message, lang }: { message: ConversationMessage; lang: Lang }) {
  const [sourceId, setSourceId] = useState<string>();
  const sources = sourcesFor(message.meta, lang);
  const source = sourceId ? itemById(sourceId) ?? KNOWLEDGE.find(doc => doc.id === sourceId) : undefined;
  const th = lang === "th";
  const pieces = message.content.split(/(\[S\d+\])/g);
  return <article className={cx("max-w-full rounded-2xl p-3 text-sm leading-relaxed", message.role === "user" ? "ml-6 bg-brand-soft text-ink" : "mr-4 border border-line bg-surface text-ink-2")}>
    <p className="mb-1 text-[11px] font-semibold text-ink-3">{message.role === "user" ? (th ? "คุณ" : "You") : (th ? "โค้ช AI" : "AI coach")}</p>
    <div className="whitespace-pre-wrap break-words">{pieces.map((piece, index) => { const citation = piece.match(/^\[S(\d+)\]$/); const reference = citation ? sources.find(source => source.n === Number(citation[1])) : undefined; return reference ? <button type="button" key={index} onClick={() => setSourceId(reference.sourceId)} className="mx-0.5 rounded-md bg-brand-soft px-1.5 text-xs font-semibold text-brand" aria-label={`${th ? "เปิดแหล่งอ้างอิง" : "Open source"} ${reference.n}: ${reference.title}`}>{piece}</button> : <Fragment key={index}>{piece}</Fragment>; })}</div>
    {message.role === "assistant" && <><Provenance meta={message.meta} lang={lang} />{sources.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{sources.map(source => <button type="button" key={`${source.n}:${source.sourceId}`} onClick={() => setSourceId(source.sourceId)} className="rounded-lg border border-line px-2 py-1 text-left text-xs text-brand">[S{source.n}] {source.title}</button>)}</div>}</>}
    {sourceId && <section className="mt-3 rounded-xl border border-brand/20 bg-brand-soft p-3" aria-label={th ? "รายละเอียดแหล่งอ้างอิง" : "Source detail"}><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{source?.title[lang] ?? sourceId}</h3><button type="button" onClick={() => setSourceId(undefined)} className="min-h-9 px-2 text-xs font-semibold text-brand">{th ? "ปิด" : "Close"}</button></div><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{source && "summary" in source ? source.content?.[lang] ?? source.summary[lang] : source?.content[lang] ?? (th ? "ไม่มีเนื้อหาแหล่งอ้างอิงในคลังสาธารณะ โปรดตรวจสอบกับผู้ดูแลโปรแกรม" : "Source text is unavailable in the public catalogue. Ask the programme administrator to verify it.")}</p></section>}
  </article>;
}

export function SecureCoach({ messages, lessonId, lang, busy, send }: { messages: ConversationMessage[]; lessonId?: string; lang: Lang; busy: boolean; send: SendCoach }) {
  const th = lang === "th";
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<unknown>();
  const scroll = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);
  const suggestions = lessonId ? (th ? ["สรุปบทเรียนนี้ให้หน่อย", "ยกตัวอย่างในงานของฉัน", "ขอฝึกสถานการณ์จากบทเรียน", "ชวนสะท้อนคิดจากบทเรียน"] : ["Summarise this lesson", "Give me an example from my job", "Help me practise this lesson", "Help me reflect on this lesson"]) : (th ? ["อธิบายผลประเมินของฉันหน่อย", "ควรทำอะไรต่อ", "ขอฝึกรับมือลูกค้าที่โกรธ", "ชวนสะท้อนคิดสิ่งที่ได้เรียนรู้"] : ["Explain my results", "What should I do next?", "Let me practise an angry customer", "Help me reflect on my learning"]);
  useEffect(() => { scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "instant" }); }, [partial, messages.length]);
  const submit = async (text: string) => {
    if (!text.trim() || busy || submitting.current) return;
    submitting.current = true; setStreaming(true); setPartial(""); setQuestion(text.trim()); setError(undefined);
    try { await send(text.trim(), lessonId, next => setPartial(current => current + next)); setInput(""); setQuestion(""); setPartial(""); }
    catch (failure) { setError(failure); }
    finally { submitting.current = false; setStreaming(false); }
  };
  return <Card className="flex min-h-[500px] flex-col"><div><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">{th ? "โค้ช AI" : "AI coach"}</h2><Badge tone="brand">ไทย / English</Badge></div><p className="mt-2 text-xs leading-relaxed text-ink-3">{lessonId ? (th ? "ถามจากบทเรียนที่เปิดอยู่ ฝึกสถานการณ์ หรือสะท้อนคิด" : "Ask about this lesson, practise a scenario or reflect on your learning.") : (th ? "อธิบายผลประเมิน วางขั้นตอนถัดไป ฝึกฝนและสะท้อนคิด" : "Understand your assessment, choose next steps, practise and reflect.")} {th ? "ใช้เฉพาะข้อมูลสมมติ ห้ามใส่ข้อมูลส่วนบุคคลหรือความลับ" : "Use synthetic details; do not enter personal or confidential information."}</p></div>
    <div ref={scroll} className="mt-4 max-h-[520px] min-h-48 flex-1 space-y-3 overflow-y-auto pr-1" role="log" aria-label={th ? "บทสนทนาโค้ช" : "Coach conversation"} aria-live="polite" aria-relevant="additions">
      {messages.length === 0 && !question && <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">{th ? "เริ่มจากคำถามด้านล่าง หรือพิมพ์สิ่งที่อยากฝึก" : "Choose a prompt below or tell me what you want to practise."}</div>}
      {messages.map((message, index) => <Reply key={`${index}:${message.role}`} message={message} lang={lang} />)}
      {question && <div className="ml-6 rounded-2xl bg-brand-soft p-3 text-sm">{question}<p className="mt-1 text-xs text-ink-3">{streaming ? (th ? "กำลังประมวลผล" : "Processing") : (th ? "ยังไม่ยืนยันการบันทึก — โหลดข้อมูลก่อนส่งซ้ำ" : "Persistence not confirmed — refresh before resending")}</p></div>}
      {partial && <div className="mr-4 whitespace-pre-wrap break-words rounded-2xl border border-line p-3 text-sm text-ink-2">{partial}<p className="mt-2 text-xs text-warn">{th ? "คำตอบยังไม่ยืนยัน จนกว่าจะได้รับสถานะสุดท้ายและโหลดบันทึกสำเร็จ" : "Response unverified until final metadata and the saved conversation are received."}</p></div>}
      {streaming && !partial && <p className="p-3 text-sm text-ink-3" role="status">{th ? "โค้ชกำลังตอบ…" : "Coach is responding…"}</p>}
    </div>
    {error != null && <p role="alert" className="mt-3 rounded-xl bg-danger-soft p-3 text-xs text-danger">{apiErrorMessage(error, th)}</p>}
    <div className="mt-4 flex flex-wrap gap-2">{suggestions.map(suggestion => <button type="button" key={suggestion} disabled={busy || streaming} onClick={() => void submit(suggestion)} className="min-h-11 rounded-xl border border-line px-3 py-2 text-left text-xs text-brand disabled:opacity-40">{suggestion}</button>)}</div>
    <form className="mt-3 flex items-end gap-2" onSubmit={event => { event.preventDefault(); void submit(input); }}><label className="min-w-0 flex-1"><span className="sr-only">{th ? "ข้อความถึงโค้ช" : "Message the coach"}</span><textarea value={input} onChange={event => setInput(event.target.value)} rows={2} maxLength={1000} required disabled={busy || streaming} placeholder={th ? "อยากเรียนรู้หรือฝึกอะไร…" : "What would you like to learn or practise?"} className="w-full resize-y rounded-xl border border-line bg-surface p-3 text-sm" /></label><Button type="submit" disabled={busy || streaming || !input.trim()}>{th ? "ส่ง" : "Send"}</Button></form>
  </Card>;
}
