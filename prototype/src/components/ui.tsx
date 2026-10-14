"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Format } from "@/lib/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "soft";
}) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none cursor-pointer",
        variant === "primary" &&
          "bg-brand text-white shadow-[0_1px_2px_rgba(12,65,70,0.22),inset_0_1px_0_rgba(255,255,255,0.16)] hover:bg-brand-2",
        variant === "soft" &&
          "bg-brand-soft text-brand ring-1 ring-inset ring-brand/20 hover:bg-brand hover:text-white",
        variant === "outline" &&
          "border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(15,29,31,0.04)] hover:border-line-strong hover:bg-surface-2",
        variant === "ghost" && "text-brand hover:bg-brand-soft/80",
        variant === "danger" &&
          "border border-danger/25 bg-surface text-danger hover:bg-danger-soft hover:border-danger/40",
        className,
      )}
    />
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "gap" | "ok" | "warn" | "danger";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap leading-snug",
        tone === "neutral" && "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line",
        tone === "brand" && "bg-brand-soft text-brand ring-1 ring-inset ring-brand/20",
        tone === "gap" && "bg-gap-soft text-gap ring-1 ring-inset ring-gap/25",
        tone === "ok" && "bg-ok-soft text-ok ring-1 ring-inset ring-ok/20",
        tone === "warn" && "bg-warn-soft text-warn ring-1 ring-inset ring-warn/25",
        tone === "danger" && "bg-danger-soft text-danger ring-1 ring-inset ring-danger/25",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cx(
        "rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_3px_rgba(15,29,31,0.03)] transition-all duration-150",
        onClick &&
          "cursor-pointer hover:border-brand/45 hover:shadow-[0_4px_14px_rgba(12,99,104,0.08)] active:scale-[0.992]",
        className,
      )}
    >
      {children}
    </div>
  );
}

const AVATAR_TONES = [
  "bg-brand-soft text-brand ring-brand/20",
  "bg-ok-soft text-ok ring-ok/20",
  "bg-gap-soft text-gap ring-gap/20",
  "bg-[#e8eefb] text-[#1c5cab] ring-[#1c5cab]/20",
];

function firstConsonantOrChar(word: string): string {
  const thaiConsonant = word.match(/[\u0E01-\u0E2E]/);
  if (thaiConsonant) return thaiConsonant[0];
  return (word[0] ?? "").toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const clean = name.replace(/^(คุณ|นาย|นาง|น\.ส\.)\s*/g, "").trim();
  const parts = clean.split(/\s+/);
  const initials =
    parts.length > 1
      ? `${firstConsonantOrChar(parts[0])}${firstConsonantOrChar(parts[1])}`
      : firstConsonantOrChar(clean);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  return (
    <div
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-display font-semibold ring-1 ring-inset select-none",
        size === "sm" && "h-7 w-7 text-[11px]",
        size === "md" && "h-9 w-9 text-xs",
        size === "lg" && "h-11 w-11 text-sm",
        tone,
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function PhoneFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="mx-auto w-full max-w-[428px]">
      {label && (
        <div className="mb-2.5 flex items-center justify-center gap-2 text-xs text-ink-2 max-sm:hidden">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" />
          <span className="font-medium">{label}</span>
        </div>
      )}
      <div className="relative flex h-[min(836px,calc(100dvh-116px))] flex-col overflow-hidden rounded-[28px] border border-line-strong bg-surface-2 shadow-[0_18px_48px_rgba(12,35,38,0.11),0_2px_8px_rgba(12,35,38,0.05)] ring-4 ring-surface/80 max-sm:h-[calc(100dvh-49px)] max-sm:rounded-none max-sm:border-0 max-sm:ring-0 max-sm:shadow-none">
        {/* Subtle iOS/Android status bar on desktop frame */}
        <div className="flex items-center justify-between bg-surface px-5 pt-2 pb-1 text-[11px] font-semibold tabular-nums text-ink-2 select-none max-sm:hidden">
          <span>09:41</span>
          <div className="h-3.5 w-20 rounded-full bg-ink/8" />
          <div className="flex items-center gap-1.5 text-[10px] text-ink-3">
            <span>5G</span>
            <span className="inline-block h-2.5 w-4 rounded-[3px] border border-ink-3/60 p-[1px]">
              <span className="block h-full w-3/4 rounded-[1px] bg-ink-2" />
            </span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LevelDots({ current, required }: { current: number; required: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`level ${current} of required ${required}`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={cx(
            "h-2 w-6 rounded-full transition-colors",
            n <= current
              ? "bg-brand"
              : n <= required
                ? "bg-gap/25 ring-1 ring-inset ring-gap/70"
                : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

export function Ring({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const stroke = size >= 64 ? 6 : 5;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--brand)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="font-display absolute inset-0 grid place-items-center text-sm font-bold tabular-nums text-ink">
        {label ?? `${Math.round(value * 100)}%`}
      </div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  video: "M8 5v14l11-7z",
  workshop:
    "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  project:
    "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z",
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  skills: "M3 13h2v8H3zm4-6h2v14H7zm4 3h2v11h-2zm4-7h2v18h-2zm4 9h2v9h-2z",
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
  coach: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  send: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z",
  close:
    "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  inbox:
    "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.34 3-3 3s-3-1.34-3-3H5V5h14v10z",
  team: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z",
  spark: "M12 2l2.4 7.2H22l-6 4.4 2.3 7.4L12 16.6 5.7 21l2.3-7.4-6-4.4h7.6z",
  chevronRight: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
  book: "M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  clock:
    "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
  trendUp: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z",
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z",
  logout:
    "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  key: "M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z",
};

export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: keyof typeof PATHS | Format;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
