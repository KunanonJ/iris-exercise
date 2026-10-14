"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { itemById } from "@/data/catalog";
import type { CoachMeta } from "@/lib/coach/coach";
import { tr } from "./i18n";
import { HERO, useStore, type ChatMsg } from "./store";
import { Badge, cx, Icon } from "./ui";

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
  // Models sometimes emit Markdown despite the prompt; the chat shows plain text.
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
            <button key={i} onClick={() => onCite(Number(m[1]))} className="mx-0.5 rounded bg-brand-soft px-1 align-super text-[10px] font-semibold text-brand">
              {m[1]}
            </button>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function CoachChat({ chatKey, lessonId, suggestions, compact }: { chatKey: string; lessonId?: string; suggestions: string[]; compact?: boolean }) {
  const { s, dispatch } = useStore();
  const t = tr(s.lang);
  const messages = s.chats[chatKey] ?? EMPTY;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
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
        dispatch({ type: "chat", key: chatKey, messages: [...history, { role: "assistant", content: acc, meta }] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function openCite(meta: CoachMeta | undefined, n: number) {
    const src = meta?.sources.find((x) => x.n === n);
    if (src && itemById(src.sourceId)?.content) dispatch({ type: "set", patch: { lessonId: src.sourceId } });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroller} className={cx("scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto", compact ? "p-3" : "p-4")}>
        {!messages.length && (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-3 text-xs text-ink-2">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-ink">
              <Icon name="shield" className="h-3.5 w-3.5 text-brand" /> {t("coachTitle")}
            </div>
            {t("coachHint")}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-10 rounded-2xl rounded-br-md bg-brand px-3 py-2 text-sm text-white whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-6 space-y-1.5">
              <div className="rounded-2xl rounded-bl-md border border-line bg-surface px-3 py-2 text-sm whitespace-pre-wrap">
                <Rendered text={m.content} onCite={(n) => openCite(m.meta, n)} />
              </div>
              {m.meta && (
                <div className="flex flex-wrap gap-1">
                  {m.meta.category !== "in_scope" && (
                    <Badge tone="warn">
                      <Icon name="shield" className="h-3 w-3" /> {t("guardrail")}: {CATEGORY_LABEL[m.meta.category]?.[s.lang]}
                    </Badge>
                  )}
                  {m.meta.pii.length > 0 && <Badge tone="warn">{t("piiRedacted")}</Badge>}
                  {m.meta.sources
                    .filter((src) => m.content.includes(`[S${src.n}]`))
                    .map((src) => (
                      <button key={src.n} onClick={() => openCite(m.meta, src.n)}>
                        <Badge tone="brand">
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
          <div className="typing mr-6 w-14 rounded-2xl border border-line bg-surface px-3 py-2 text-lg leading-none text-ink-3">
            <span>•</span>
            <span>•</span>
            <span>•</span>
          </div>
        )}
        {error && <div className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">{error}</div>}
      </div>
      <div className="border-t border-line bg-surface p-2">
        <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-1">
          {suggestions.map((q) => (
            <button key={q} disabled={busy} onClick={() => send(q)} className="shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2 hover:border-brand/50 hover:text-brand">
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
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button disabled={busy || !input.trim()} aria-label={t("send")} className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white disabled:opacity-40">
            <Icon name="send" />
          </button>
        </form>
      </div>
    </div>
  );
}
