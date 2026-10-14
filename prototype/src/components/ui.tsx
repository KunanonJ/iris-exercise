"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Format } from "@/lib/types";

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Button({ variant = "primary", className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed",
        variant === "primary" && "bg-brand text-white hover:bg-brand-2",
        variant === "outline" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-brand hover:bg-brand-soft",
        variant === "danger" && "border border-line bg-surface text-danger hover:bg-danger-soft",
        className,
      )}
    />
  );
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "brand" | "gap" | "ok" | "warn" | "danger"; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone === "neutral" && "bg-surface-2 text-ink-2 border border-line",
        tone === "brand" && "bg-brand-soft text-brand",
        tone === "gap" && "bg-gap-soft text-gap",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-[#8a5a00]",
        tone === "danger" && "bg-danger-soft text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={cx("rounded-2xl border border-line bg-surface p-4", onClick && "cursor-pointer hover:border-brand/40", className)}>
      {children}
    </div>
  );
}

export function PhoneFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="mx-auto w-full max-w-[420px]">
      {label && <div className="mb-2 text-center text-xs text-ink-3 max-sm:hidden">{label}</div>}
      <div className="relative flex h-[min(820px,calc(100dvh-120px))] flex-col overflow-hidden rounded-[28px] border border-line bg-surface-2 shadow-[0_8px_30px_rgba(15,29,31,0.08)] max-sm:h-[calc(100dvh-49px)] max-sm:rounded-none max-sm:border-0">
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
            "h-2 w-6 rounded-full",
            n <= current ? "bg-brand" : n <= required ? "bg-gap/30 outline outline-1 outline-gap/60" : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

export function Ring({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--line)" strokeWidth={6} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--brand)" strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold">{label ?? `${Math.round(value * 100)}%`}</div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  video: "M8 5v14l11-7z",
  workshop: "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  project: "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z",
  home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  skills: "M3 13h2v8H3zm4-6h2v14H7zm4 3h2v11h-2zm4-7h2v18h-2zm4 9h2v9h-2z",
  path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z",
  coach: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  send: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  inbox: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12h-4c0 1.66-1.34 3-3 3s-3-1.34-3-3H5V5h14v10z",
  team: "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z",
  spark: "M12 2l2.4 7.2H22l-6 4.4 2.3 7.4L12 16.6 5.7 21l2.3-7.4-6-4.4h7.6z",
};

export function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof PATHS | Format; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
