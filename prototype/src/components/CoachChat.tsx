"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { itemById, KNOWLEDGE } from "@/data/catalog";
import type { CoachMeta, SourceRef } from "@/lib/coach/coach";
import { tr } from "./i18n";
import { HERO, useStore, type ChatMsg } from "./store";
import { Badge, Button, cx, Icon } from "./ui";

const CATEGORY_LABEL: Record<string, { en: string; th: string }> = {
  other_person_data: { en: "Other people's data blocked", th: "ปิดกั้นข้อมูลของผู้อื่น" },
  hr_decision: { en: "Pay / promotion: referred to HR", th: "เรื่องเงินเดือน/เลื่อนตำแหน่ง: ส่งต่อ HR" },
  wellbeing: { en: "Wellbeing: referred to EAP", th: "เรื่องความเป็นอยู่: ส่งต่อ EAP" },
  crisis: { en: "Crisis: hotline shown", th: "ภาวะวิกฤต: แสดงสายด่วน" },
  off_topic: { en: "Off-topic", th: "นอกขอบเขต" },
  injection: { en: "Prompt injection blocked", th: "ปิดกั้นการแทรกคำสั่ง" },
};

const EMPTY: ChatMsg[] = [];

function decodeMeta(b64: string | null): CoachMeta | undefined {
  if (!b64) return undefined;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

function Rendered({ text, onCite }: { text: string; onCite: (n: number) => void }) {
  const clean = text
    .replace(/\u2063/g, "")
    .replace(/\*\*|__/g, "")
    .replace(/^[ \t]*[*-][ \t]+/gm, "• ")
    .replace(/^#{1,6}[ \t]+/gm, "");
  const parts = clean.split(/(\[S\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[S(\d+)\]$/);
        if (m)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCite(Number(m[1]))}
              title={`Source [${m[1]}]`}
              className="mx-0.5 inline-flex h-4 min-w-[18px] items-center justify-center rounded-md bg-brand-soft px-1 align-baseline text-[10px] font-bold tabular-nums text-brand ring-1 ring-inset ring-brand/25 transition hover:bg-brand hover:text-white cursor-pointer"
            >
              {m[1]}
            </button>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function SourceDrawer({
  src,
  currentLessonId,
  onClose,
  onOpenLesson,
}: {
  src: SourceRef;
  currentLessonId?: string;
  onClose: () => void;
  onOpenLesson: (id: string) => void;
}) {
  const { s } = useStore();
  const L = s.lang;
  const lesson = itemById(src.sourceId);
  const policy = KNOWLEDGE.find((k) => k.id === src.sourceId);
  const passage = lesson ? lesson.content?.[L] ?? lesson.summary[L] : policy?.content[L] ?? "";
  const canOpenLesson = Boolean(lesson?.content && lesson.id !== currentLessonId);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-end bg-ink/35 p-2 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up max-h-[75%] overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-line-strong" />
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="brand">S{src.n}</Badge>
            <Badge tone="neutral">
              {src.kind === "policy"
                ? L === "th"
                  ? "นโยบายโปรแกรม"
                  : "Programme Policy"
                : `${lesson?.source ?? "LMS"} · ${lesson?.minutes ?? ""} ${L === "th" ? "นาที" : "min"}`}
            </Badge>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close source preview"
            className="rounded-lg p-1 text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <h4 className="mt-2 text-sm font-semibold text-ink">{src.title[L]}</h4>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{passage}</p>
        {canOpenLesson && (
          <Button
            className="mt-3 w-full text-xs"
            onClick={() => {
              onClose();
              onOpenLesson(src.sourceId);
            }}
          >
            <Icon name="book" className="h-3.5 w-3.5" />
            {L === "th" ? "เปิดบทเรียนฉบับเต็ม" : "Open full lesson"} →
          </Button>
        )}
      </div>
    </div>
  );
}

export function CoachChat({
  chatKey,
  lessonId,
  suggestions,
  compact,
}: {
  chatKey: string;
  lessonId?: string;
  suggestions: string[];
  compact?: boolean;
}) {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const L = s.lang;
  const messages = s.chats[chatKey] ?? EMPTY;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [activeSource, setActiveSource] = useState<SourceRef>();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(undefined);
    setInput("");
    const history: ChatMsg[] = [...messages, { role: "user", content: text.trim() }];
    dispatch({ type: "chat", key: chatKey, messages: history });
    setBusy(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employeeId: HERO,
          lessonId,
          plan: s.plan,
          overrides: s.overrides,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const meta = decodeMeta(res.headers.get("x-coach-meta"));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        dispatch({
          type: "chat",
          key: chatKey,
          messages: [...history, { role: "assistant", content: acc, meta }],
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function openCite(meta: CoachMeta | undefined, n: number) {
    const src = meta?.sources.find((x) => x.n === n);
    if (!src) return;
    setActiveSource(src);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className={cx("scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto", compact ? "p-3" : "p-4")}
      >
        {!messages.length && (
          <div className="rounded-2xl border border-line bg-surface p-3.5 text-xs text-ink-2 shadow-[0_1px_2px_rgba(15,29,31,0.03)]">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-ink">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name="shield" className="h-3.5 w-3.5" />
                </span>
                {t("coachTitle")}
              </div>
              <Badge tone="brand">
                {L === "th" ? "ป้องกัน 2 ชั้น · PDPA" : "2-Layer Guardrails · PDPA"}
              </Badge>
            </div>
            <p className="leading-relaxed">{t("coachHint")}</p>
            {!compact && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2 text-[11px] text-ink-3">
                <span>• {L === "th" ? "กรอบทักษะ 18 ตำแหน่ง" : "18 Role Frameworks"}</span>
                <span>• {L === "th" ? "คลัง LMS-A & LMS-B" : "LMS-A & LMS-B Catalogue"}</span>
                <span>• {L === "th" ? "อ้างอิงแหล่งที่มา [S1]" : "Cited Sources [S1]"}</span>
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3.5 py-2.5 text-sm text-white shadow-[0_1px_2px_rgba(12,65,70,0.18)] whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="animate-fade-in mr-4 space-y-1.5">
              <div
                className={cx(
                  "rounded-2xl rounded-bl-sm border px-3.5 py-2.5 text-sm shadow-[0_1px_2px_rgba(15,29,31,0.03)] whitespace-pre-wrap",
                  m.meta && m.meta.category !== "in_scope"
                    ? m.meta.category === "crisis"
                      ? "border-danger/35 bg-danger-soft/40 text-ink"
                      : "border-warn/35 bg-warn-soft/45 text-ink"
                    : "border-line bg-surface text-ink",
                )}
              >
                <Rendered text={m.content} onCite={(n) => openCite(m.meta, n)} />
              </div>
              {m.meta && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {m.meta.category !== "in_scope" && (
                    <Badge tone={m.meta.category === "crisis" ? "danger" : "warn"}>
                      <Icon name="shield" className="h-3 w-3" /> {t("guardrail")}:{" "}
                      {CATEGORY_LABEL[m.meta.category]?.[s.lang]}
                      {m.meta.rule ? " (L1)" : m.meta.classifier ? " (L2)" : ""}
                    </Badge>
                  )}
                  {m.meta.pii.length > 0 && (
                    <Badge tone="warn">
                      <Icon name="lock" className="h-3 w-3" /> {t("piiRedacted")}
                    </Badge>
                  )}
                  {m.meta.sources
                    .filter((src) => m.content.includes(`[S${src.n}]`))
                    .map((src) => (
                      <button
                        key={src.n}
                        type="button"
                        onClick={() => openCite(m.meta, src.n)}
                        className="cursor-pointer transition hover:opacity-85"
                      >
                        <Badge tone="brand">
                          <Icon name="book" className="h-2.5 w-2.5" />
                          {src.n}. {src.kind === "policy" ? (s.lang === "th" ? "นโยบาย: " : "Policy: ") : ""}
                          {src.title[s.lang]}
                        </Badge>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && messages.at(-1)?.role === "user" && (
          <div className="typing mr-6 inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5 text-base leading-none text-brand">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-danger/25 bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
      </div>
      <div className="border-t border-line bg-surface px-3 pt-2 pb-2.5">
        <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={busy}
              onClick={() => send(q)}
              className="shrink-0 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2 transition hover:border-brand/50 hover:bg-brand-soft/60 hover:text-brand active:scale-[0.98] disabled:opacity-40 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder={t("typeMessage")}
            aria-label={t("typeMessage")}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm text-ink placeholder:text-ink-3 outline-none transition focus:border-brand focus:bg-surface"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label={t("send")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm transition hover:bg-brand-2 active:scale-95 disabled:opacity-40 cursor-pointer"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </form>
      </div>
      {activeSource && (
        <SourceDrawer
          src={activeSource}
          currentLessonId={lessonId}
          onClose={() => setActiveSource(undefined)}
          onOpenLesson={(id) => dispatch({ type: "set", patch: { lessonId: id } })}
        />
      )}
    </div>
  );
}
