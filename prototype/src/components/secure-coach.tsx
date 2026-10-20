"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { itemById, KNOWLEDGE } from "@/data/catalog";
import type { ConversationMessage } from "@/lib/suite-contracts";
import type { Lang } from "@/lib/types";
import { apiErrorMessage } from "./secure-client";
import { Badge, Button, Card, cx, Icon } from "./kit";

export type SendCoach = (
  message: string,
  lessonId: string | undefined,
  onText: (text: string) => void,
) => Promise<Record<string, unknown>>;

type Source = { n: number; sourceId: string; title: string; kind: "lesson" | "policy" };

const GUARDRAIL_LABELS: Record<string, { en: string; th: string; tone: "warn" | "danger" | "brand" }> = {
  other_person_data: {
    en: "Guardrail · Colleagues' data stays private",
    th: "เกราะความปลอดภัย · ไม่เปิดเผยข้อมูลของเพื่อนร่วมงาน",
    tone: "warn",
  },
  hr_decision: {
    en: "Guardrail · Pay and promotion questions go to HR",
    th: "เกราะความปลอดภัย · เรื่องเงินเดือนและการเลื่อนตำแหน่งให้ติดต่อ HR",
    tone: "warn",
  },
  wellbeing: {
    en: "Guardrail · Wellbeing support offered (EAP)",
    th: "เกราะความปลอดภัย · แนะนำบริการดูแลใจ (EAP)",
    tone: "brand",
  },
  crisis: {
    en: "Guardrail · Crisis lines shown: 1323 / 1669",
    th: "เกราะความปลอดภัย · แสดงสายด่วน 1323 / 1669",
    tone: "danger",
  },
  off_topic: {
    en: "Guardrail · Work learning topics only",
    th: "เกราะความปลอดภัย · ตอบเฉพาะเรื่องการเรียนรู้ในงาน",
    tone: "warn",
  },
  injection: {
    en: "Guardrail · Attempt to change coach rules blocked",
    th: "เกราะความปลอดภัย · ปิดกั้นคำสั่งที่พยายามเปลี่ยนกฎของโค้ช",
    tone: "danger",
  },
};

function sourcesFor(meta: Record<string, unknown> | undefined, lang: Lang): Source[] {
  if (!Array.isArray(meta?.sources)) return [];
  return meta.sources.flatMap((source: unknown) => {
    if (!source || typeof source !== "object") return [];
    const value = source as Record<string, unknown>;
    if (!Number.isInteger(value.n) || typeof value.sourceId !== "string") return [];
    const lesson = itemById(value.sourceId);
    const policy = KNOWLEDGE.find((doc) => doc.id === value.sourceId);
    const known = lesson ?? policy;
    const rawTitle =
      value.title && typeof value.title === "object"
        ? (value.title as Record<string, unknown>)[lang]
        : undefined;
    return [
      {
        n: value.n as number,
        sourceId: value.sourceId,
        title: known?.title[lang] ?? (typeof rawTitle === "string" ? rawTitle : value.sourceId),
        kind: policy || value.kind === "policy" ? "policy" : "lesson",
      },
    ];
  });
}

function ProvenanceStrip({ meta, lang }: { meta?: Record<string, unknown>; lang: Lang }) {
  const th = lang === "th";
  const provenance = typeof meta?.answerSource === "string" ? meta.answerSource : "unknown";
  const category = typeof meta?.category === "string" ? meta.category : undefined;
  const pii = Array.isArray(meta?.pii) ? (meta.pii.filter((x): x is string => typeof x === "string")) : [];
  const labels: Record<string, [string, string]> = {
    model: ["AI model answer", "คำตอบจาก AI"],
    safety_template: ["Safety reply", "คำตอบเพื่อความปลอดภัย"],
    no_source: ["No approved source found", "ไม่พบแหล่งข้อมูลที่อนุมัติ"],
    demo: ["Demo answer (scripted)", "คำตอบเดโม (ตั้งไว้ล่วงหน้า)"],
    provider_fallback: ["Backup answer · AI model unavailable", "คำตอบสำรอง · AI ไม่พร้อมใช้งาน"],
    unknown: ["Answer source not confirmed", "ยังไม่ยืนยันที่มาของคำตอบ"],
  };
  const guardrail = category && category !== "in_scope" ? GUARDRAIL_LABELS[category] : undefined;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <Badge
        tone={
          provenance === "provider_fallback" || provenance === "unknown"
            ? "warn"
            : provenance === "model"
              ? "brand"
              : "neutral"
        }
      >
        {(labels[provenance] ?? labels.unknown)[th ? 1 : 0]}
      </Badge>
      {guardrail && (
        <Badge tone={guardrail.tone}>
          <Icon name="shield" className="h-3 w-3" />
          {th ? guardrail.th : guardrail.en}
        </Badge>
      )}
      {pii.length > 0 && (
        <Badge tone="ok">
          <Icon name="lock" className="h-3 w-3" />
          {th ? `ซ่อนข้อมูลส่วนตัวแล้ว (${pii.join(", ")})` : `Personal details hidden (${pii.join(", ")})`}
        </Badge>
      )}
      {provenance === "model" && typeof meta?.model === "string" && (
        <span className="text-[11px] text-ink-3">{meta.model}</span>
      )}
    </div>
  );
}

function SourceBottomSheet({
  source,
  lang,
  currentLessonId,
  onClose,
  onOpenLesson,
}: {
  source: Source;
  lang: Lang;
  currentLessonId?: string;
  onClose: () => void;
  onOpenLesson?: (id: string) => void;
}) {
  const th = lang === "th";
  const lesson = itemById(source.sourceId);
  const policy = KNOWLEDGE.find((doc) => doc.id === source.sourceId);
  const passage = lesson
    ? (lesson.content?.[lang] ?? lesson.summary[lang])
    : (policy?.content[lang] ??
      (th ? "ไม่มีข้อความของแหล่งอ้างอิงนี้ในระบบ หากต้องการ โปรดติดต่อผู้ดูแลโปรแกรมค่ะ" : "The source text isn't available here. Ask your programme admin if you need it."));
  const canOpenLesson = Boolean(onOpenLesson && lesson && lesson.id !== currentLessonId);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end bg-ink/35 p-3 backdrop-blur-[1px] sm:items-center sm:justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={th ? "รายละเอียดแหล่งอ้างอิง" : "Source detail"}
    >
      <section
        className="animate-sheet-up max-h-[78dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">[S{source.n}]</Badge>
            <Badge tone="neutral">
              {source.kind === "policy"
                ? th ? "นโยบายโปรแกรม" : "Programme policy"
                : `${lesson?.source ?? "LMS"} · ${lesson?.minutes ?? ""} ${th ? "นาที" : "min"}`}
            </Badge>
            <span className="font-display text-xs font-semibold text-ink-3">{source.sourceId}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={th ? "ปิด" : "Close"}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-brand hover:bg-brand-soft cursor-pointer"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
            {th ? "ปิด" : "Close"}
          </button>
        </div>
        <h3 className="mt-2.5 text-base font-bold text-ink">{source.title}</h3>
        <div className="mt-3 rounded-xl bg-surface-2 p-3.5 text-xs leading-relaxed whitespace-pre-wrap text-ink-2 ring-1 ring-inset ring-line">
          {passage}
        </div>
        {canOpenLesson && (
          <Button
            className="mt-3.5 w-full text-xs"
            onClick={() => {
              onClose();
              onOpenLesson?.(source.sourceId);
            }}
          >
            <Icon name="book" className="h-3.5 w-3.5" />
            {th ? "เปิดบทเรียนฉบับเต็ม" : "Open full lesson"} →
          </Button>
        )}
      </section>
    </div>
  );
}

function Reply({
  message,
  lang,
  onSelectSource,
}: {
  message: ConversationMessage;
  lang: Lang;
  onSelectSource: (source: Source) => void;
}) {
  const [inlineSourceId, setInlineSourceId] = useState<string>();
  const sources = sourcesFor(message.meta, lang);
  const inlineSource = inlineSourceId
    ? (itemById(inlineSourceId) ?? KNOWLEDGE.find((doc) => doc.id === inlineSourceId))
    : undefined;
  const th = lang === "th";
  const cleanText = message.content
    .replace(/\u2063/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/^[ \t]*[*-][ \t]+/gm, "• ");
  const pieces = cleanText.split(/(\[S\d+\])/g);

  const openRef = (ref: Source) => {
    setInlineSourceId((prev) => (prev === ref.sourceId ? undefined : ref.sourceId));
    onSelectSource(ref);
  };

  return (
    <article
      className={cx(
        "max-w-full rounded-2xl p-3.5 text-sm leading-relaxed transition-all",
        message.role === "user"
          ? "ml-8 bg-brand text-white shadow-xs"
          : "mr-4 border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(15,29,31,0.03)]",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={cx(
            "flex items-center gap-1.5 text-[11px] font-semibold",
            message.role === "user" ? "text-white/85" : "text-brand",
          )}
        >
          {message.role === "assistant" && <Icon name="coach" className="h-3.5 w-3.5" />}
          {message.role === "user" ? (th ? "คุณ" : "You") : th ? "โค้ช AI" : "AI coach"}
        </span>
        {message.role === "assistant" && sources.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-ink-3 ring-1 ring-inset ring-line">
            <Icon name="book" className="h-3 w-3 text-brand" />
            {sources.length} {th ? "แหล่งอ้างอิง" : sources.length === 1 ? "source" : "sources"}
          </span>
        )}
      </div>

      <div className="whitespace-pre-wrap break-words">
        {pieces.map((piece, index) => {
          const citation = piece.match(/^\[S(\d+)\]$/);
          const reference = citation
            ? sources.find((source) => source.n === Number(citation[1]))
            : undefined;
          return reference ? (
            <button
              type="button"
              key={index}
              onClick={() => openRef(reference)}
              className="mx-0.5 inline-flex min-h-5 min-w-[24px] items-center justify-center rounded-md bg-brand-soft px-1.5 align-baseline text-[11px] font-bold tabular-nums text-brand ring-1 ring-inset ring-brand/25 transition hover:bg-brand hover:text-white cursor-pointer"
              aria-label={`${th ? "ดูแหล่งอ้างอิง" : "View source"} ${reference.n}: ${reference.title}`}
            >
              {piece}
            </button>
          ) : (
            <Fragment key={index}>{piece}</Fragment>
          );
        })}
      </div>

      {message.role === "assistant" && (
        <>
          <ProvenanceStrip meta={message.meta} lang={lang} />
          {sources.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {sources.map((source) => (
                <button
                  type="button"
                  key={`${source.n}:${source.sourceId}`}
                  onClick={() => openRef(source)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2.5 py-1 text-left text-xs font-medium text-brand transition hover:border-brand/45 hover:bg-brand-soft cursor-pointer"
                >
                  <span className="font-display font-bold tabular-nums">[S{source.n}]</span>
                  <span className="truncate max-w-[240px] text-ink-2">{source.title}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {inlineSourceId && (
        <section
          className="mt-3 rounded-xl border border-brand/20 bg-brand-soft/75 p-3 text-ink"
          aria-label={th ? "รายละเอียดแหล่งอ้างอิง" : "Source detail"}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand">
                {inlineSourceId}
              </span>
              <h3 className="text-sm font-semibold">{inlineSource?.title[lang] ?? inlineSourceId}</h3>
            </div>
            <button
              type="button"
              onClick={() => setInlineSourceId(undefined)}
              className="min-h-8 rounded-lg px-2 text-xs font-semibold text-brand hover:bg-surface/60 cursor-pointer"
            >
              {th ? "ปิด" : "Close"}
            </button>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
            {inlineSource && "summary" in inlineSource
              ? (inlineSource.content?.[lang] ?? inlineSource.summary[lang])
              : (inlineSource?.content[lang] ??
                (th ? "ไม่มีข้อความของแหล่งอ้างอิงนี้ในระบบ หากต้องการ โปรดติดต่อผู้ดูแลโปรแกรมค่ะ" : "The source text isn't available here. Ask your programme admin if you need it."))}
          </p>
        </section>
      )}
    </article>
  );
}

export function SecureCoach({
  messages,
  lessonId,
  lang,
  busy,
  send,
  onOpenLesson,
}: {
  messages: ConversationMessage[];
  lessonId?: string;
  lang: Lang;
  busy: boolean;
  send: SendCoach;
  onOpenLesson?: (id: string) => void;
}) {
  const th = lang === "th";
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<unknown>();
  const [sheetSource, setSheetSource] = useState<Source>();
  const scroll = useRef<HTMLDivElement>(null);
  const submitting = useRef(false);

  const activeLesson = lessonId ? itemById(lessonId) : undefined;
  const suggestions = lessonId
    ? th
      ? [
          "สรุปบทเรียนนี้ให้หน่อย",
          "ยกตัวอย่างในงานของฉัน",
          "ขอฝึกสถานการณ์จากบทเรียน",
          "ชวนสะท้อนคิดจากบทเรียน",
          "หลังบทนี้ควรเรียนอะไรต่อ",
        ]
      : [
          "Summarise this lesson",
          "Give me an example from my job",
          "Help me practise this lesson",
          "Help me reflect on this lesson",
          "What's next after this lesson?",
        ]
    : th
      ? [
          "อธิบายผลประเมินของฉันหน่อย",
          "ควรทำอะไรต่อ",
          "ฉันทำไปถึงไหนแล้ว",
          "ขอฝึกรับมือลูกค้าที่โกรธ",
          "ผลประเมินมีผลกับโบนัสไหม",
          "คะแนนการโค้ชของเพื่อนร่วมงานเท่าไหร่",
        ]
      : [
          "Explain my results",
          "What should I do next?",
          "How am I doing?",
          "Let me practise an angry customer",
          "Will my results affect my bonus?",
          "What is my colleague's coaching score?",
        ];

  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "instant" });
  }, [partial, messages.length]);

  const submit = async (text: string) => {
    if (!text.trim() || busy || submitting.current) return;
    submitting.current = true;
    setStreaming(true);
    setPartial("");
    setQuestion(text.trim());
    setError(undefined);
    try {
      await send(text.trim(), lessonId, (next) => setPartial((current) => current + next));
      setInput("");
      setQuestion("");
      setPartial("");
    } catch (failure) {
      setError(failure);
    } finally {
      submitting.current = false;
      setStreaming(false);
    }
  };

  return (
    <Card className="relative flex min-h-[540px] flex-col">
      {/* Header & Pinned Context Card */}
      <div className="border-b border-line pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name="coach" className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold leading-tight">{th ? "โค้ช AI" : "AI coach"}</h2>
              <p className="text-[11px] text-ink-3">
                {th ? "ตอบจากบทเรียนที่อนุมัติและข้อมูลของคุณเท่านั้น" : "Answers only from approved lessons and your own record"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {lessonId && <Badge tone="neutral">RAG · [{lessonId}]</Badge>}
            <Badge tone="brand">ไทย / English</Badge>
          </div>
        </div>

        {activeLesson ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-xs ring-1 ring-inset ring-line">
            <div className="flex min-w-0 items-center gap-2">
              <Icon name={activeLesson.format} className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate font-semibold text-ink">{activeLesson.title[lang]}</span>
            </div>
            <span className="shrink-0 text-[11px] text-ink-3">
              {activeLesson.source} · {activeLesson.minutes} {th ? "นาที" : "min"}
            </span>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-1.5 text-[11px] text-ink-2 ring-1 ring-inset ring-line">
            <Icon name="lock" className="h-3.5 w-3.5 shrink-0 text-brand" />
            <span>
              {th ? "แชตนี้เป็นความลับ หัวหน้าของคุณมองไม่เห็น โปรดอย่าใส่ข้อมูลส่วนตัวนะคะ" : "This chat is private. Your manager can't see it. Please don't share personal details."}
            </span>
          </div>
        )}
      </div>

      {/* Conversation Log */}
      <div
        ref={scroll}
        className="scroll-thin mt-4 max-h-[500px] min-h-52 flex-1 space-y-3 overflow-y-auto pr-1"
        role="log"
        aria-label={th ? "บทสนทนาโค้ช" : "Coach conversation"}
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && !question && (
          <div className="rounded-2xl border border-dashed border-line-strong bg-surface-2/70 p-4 text-sm text-ink-2">
            <p className="font-semibold text-ink">
              {th ? "สวัสดีค่ะ วันนี้อยากเรียนหรือฝึกเรื่องไหนดีคะ" : "Hi! What would you like to learn or practise today?"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              {lessonId
                ? th ? "แตะคำถามแนะนำด้านล่าง หรือพิมพ์คำถามเกี่ยวกับบทเรียนนี้ได้เลยค่ะ" : "Tap a suggestion below, or ask your own question about this lesson."
                : th ? "แตะคำถามแนะนำด้านล่างเพื่อดูผลประเมิน วางแผนขั้นถัดไป หรือดูว่าโค้ชรับมือคำถามนอกขอบเขตอย่างไรค่ะ" : "Tap a suggestion below to review your results, plan your next step, or see how the coach handles off-limits questions."}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <Reply
            key={`${index}:${message.role}`}
            message={message}
            lang={lang}
            onSelectSource={setSheetSource}
          />
        ))}

        {question && (
          <div className="ml-8 rounded-2xl border border-dashed border-brand/45 bg-brand-soft/60 p-3.5 text-sm text-ink">
            <p>{question}</p>
            <p className="mt-1.5 text-[11px] font-medium text-ink-3">
              {streaming
                ? th ? "กำลังส่ง…" : "Sending…"
                : th ? "ยังไม่แน่ใจว่าบันทึกแล้ว โปรดอัปเดตข้อมูลก่อนส่งอีกครั้ง" : "Not sure this was saved. Refresh before sending again."}
            </p>
          </div>
        )}

        {partial && (
          <div className="mr-4 whitespace-pre-wrap break-words rounded-2xl border border-line bg-surface p-3.5 text-sm text-ink-2">
            {partial}
            <p className="mt-2 text-xs text-warn">
              {th ? "กำลังตรวจสอบคำตอบนี้ จะยืนยันเมื่อบันทึกแชตเรียบร้อยแล้ว" : "Checking this answer. It's confirmed once the chat is saved."}
            </p>
          </div>
        )}

        {streaming && !partial && (
          <div className="mr-4 inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-xs text-ink-3" role="status">
            <span className="typing font-bold text-brand">
              <span>●</span> <span>●</span> <span>●</span>
            </span>
            <span>{th ? "โค้ชกำลังพิมพ์…" : "Coach is typing…"}</span>
          </div>
        )}
      </div>

      {error != null && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft p-3 text-xs text-danger">
          {apiErrorMessage(error, th)}
        </p>
      )}

      {/* Perplexity / Mindvalley Follow-up Prompt Chips */}
      <div className="mt-4 border-t border-line pt-3">
        <p className="mb-2 text-[11px] font-semibold text-ink-3">
          {th ? "คำถามแนะนำ" : "Suggestions"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              disabled={busy || streaming}
              onClick={() => void submit(suggestion)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-left text-xs font-medium text-ink-2 transition hover:border-brand/50 hover:bg-brand-soft hover:text-brand disabled:opacity-40 cursor-pointer"
            >
              <span className="font-bold text-brand" aria-hidden="true">
                ↳
              </span>
              <span>{suggestion}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Capsule Composer */}
      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{th ? "พิมพ์ข้อความถึงโค้ช" : "Message the coach"}</span>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit(input);
              }
            }}
            rows={2}
            maxLength={1000}
            required
            disabled={busy || streaming}
            placeholder={
              th ? "ถามเรื่องบทเรียน ผลประเมิน หรือแผนการเรียนได้เลย" : "Ask about a lesson, your results or your plan"
            }
            className="w-full resize-none rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-brand"
          />
        </label>
        <Button
          type="submit"
          disabled={busy || streaming || !input.trim()}
          className="min-h-11 rounded-2xl px-4"
        >
          <Icon name="send" className="h-4 w-4" />
          <span>{th ? "ส่ง" : "Send"}</span>
        </Button>
      </form>

      {sheetSource && (
        <SourceBottomSheet
          source={sheetSource}
          lang={lang}
          currentLessonId={lessonId}
          onClose={() => setSheetSource(undefined)}
          onOpenLesson={onOpenLesson}
        />
      )}
    </Card>
  );
}
