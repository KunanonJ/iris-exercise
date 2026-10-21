// Renders the sample clips for video lessons (one Thai, one English) from each lesson's transcript.
// Slides are HTML screenshotted by headless Chrome, then joined by ffmpeg with short fades.
// Prototype content only: no narration, and production plays the client's own LMS videos.
// Needs Google Chrome, ffmpeg and network access for Google Fonts. Run: pnpm videos [lesson ids...]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CATALOG } from "../src/data/catalog";
import type { Lang, LearningItem } from "../src/lib/types";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const W = 1280;
const H = 720;
const FADE = 0.4;
const FPS = 15;
const FONTS = "https://fonts.googleapis.com/css2?family=Anuphan:wght@400;600&family=Bricolage+Grotesque:wght@600&family=Figtree:wght@400;600&display=block";

const COPY = {
  kicker: { en: "Video lesson", th: "บทเรียนวิดีโอ" },
  demo: { en: "Sample clip (demo)", th: "คลิปตัวอย่าง (เดโม)" },
  endTitle: { en: "Questions about this lesson?", th: "มีคำถามเกี่ยวกับบทเรียนนี้ไหมคะ" },
  endBody: { en: "Ask the coach beside this video. It answers from approved lessons and policies.", th: "ถามโค้ชข้างวิดีโอนี้ได้เลย โค้ชตอบจากบทเรียนและนโยบายที่อนุมัติแล้ว" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const graphemes = (s: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;

// English splits on sentences. Thai has no full stops, so it splits on the spaces between phrases,
// keeping very short tokens (like the "1" in "ขั้นที่ 1") with the phrase before them.
function chunks(text: string, lang: Lang): string[] {
  const max = lang === "th" ? 150 : 190;
  const parts = lang === "en"
    ? [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)].map((s) => s.segment.trim())
    : text.split(/\s+/).reduce<string[]>((acc, token) => {
        if (acc.length && graphemes(token) <= 2) acc[acc.length - 1] += ` ${token}`;
        else acc.push(token);
        return acc;
      }, []);
  const out: string[] = [];
  for (const part of parts.filter(Boolean)) {
    const last = out.at(-1);
    if (last !== undefined && graphemes(last) + 1 + graphemes(part) <= max) out[out.length - 1] = `${last} ${part}`;
    else out.push(part);
  }
  return out;
}

// About 16 characters a second, plus time to settle on the slide.
const seconds = (text: string) => Math.min(12, Math.max(4, 2 + graphemes(text) / 16));

function page(item: LearningItem, lang: Lang, body: string[]): string {
  const text = lang === "th" ? "'Anuphan'" : "'Figtree', 'Anuphan'";
  const display = lang === "th" ? "'Anuphan'" : "'Bricolage Grotesque', 'Anuphan'";
  const total = body.length + 2;
  const frame = (i: number, main: string) => `<section lang="${lang}">
    <header><span>${esc(item.source)} · ${esc(item.title[lang])}</span><span>${i + 1} / ${total}</span></header>
    <main>${main}</main>
    <footer><span>${esc(COPY.demo[lang])}</span><div class="bars">${Array.from({ length: total }, (_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div></footer>
  </section>`;
  const slides = [
    frame(0, `<p class="kicker">${esc(COPY.kicker[lang])}</p><h1>${esc(item.title[lang])}</h1><p class="summary">${esc(item.summary[lang])}</p>`),
    ...body.map((chunk, i) => frame(i + 1, `<p class="chunk">${esc(chunk)}</p>`)),
    frame(total - 1, `<h2>${esc(COPY.endTitle[lang])}</h2><p class="summary">${esc(COPY.endBody[lang])}</p>`),
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${FONTS}"><style>
    * { box-sizing: border-box; margin: 0 }
    body { width: ${W}px; background: oklch(0.210 0.024 196) }
    section { width: ${W}px; height: ${H}px; padding: 56px 96px 48px; display: flex; flex-direction: column; color: #fff;
      font-family: ${text}, system-ui, sans-serif; background: linear-gradient(160deg, oklch(0.250 0.030 196), oklch(0.190 0.022 196)) }
    header, footer { display: flex; justify-content: space-between; align-items: center; font-size: 20px; color: oklch(0.82 0.03 194) }
    main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 24px; max-width: 1040px }
    .kicker { font-size: 24px; font-weight: 600; letter-spacing: 0.04em; color: oklch(0.80 0.09 194) }
    h1, h2 { font-family: ${display}, system-ui, sans-serif; font-weight: 600; line-height: 1.25 }
    h1 { font-size: 60px } h2 { font-size: 52px }
    .summary { font-size: 30px; line-height: 1.5; color: oklch(0.88 0.02 194) }
    .chunk { font-size: ${lang === "th" ? 42 : 44}px; line-height: ${lang === "th" ? 1.7 : 1.45}; border-left: 6px solid oklch(0.60 0.10 194); padding-left: 32px }
    .bars { display: flex; gap: 8px } .bars i { width: 36px; height: 6px; border-radius: 3px; background: oklch(1 0 0 / 0.2) } .bars i.on { background: oklch(0.70 0.10 194) }
  </style></head><body>${slides.join("")}</body></html>`;
}

// Headless Chrome can exit early when the machine is busy, so try once more before failing.
function screenshot(args: string[]) {
  try {
    execFileSync(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
  } catch {
    execFileSync(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
  }
}

function render(item: LearningItem, lang: Lang, work: string) {
  const body = chunks(item.content![lang], lang);
  const durations = [4.5, ...body.map(seconds), 4];
  const html = join(work, `${item.id}.${lang}.html`);
  const png = join(work, `${item.id}.${lang}.png`);
  writeFileSync(html, page(item, lang, body));
  screenshot([
    "--headless", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${join(work, "chrome")}`, "--force-device-scale-factor=1", "--virtual-time-budget=10000",
    `--window-size=${W},${H * durations.length}`, `--screenshot=${png}`, `file://${html}`,
  ]);

  const mp4 = join("public", item.video!.src[lang]);
  const jpg = join("public", item.video!.poster[lang]);
  mkdirSync(dirname(mp4), { recursive: true });
  const inputs = durations.flatMap((d) => ["-loop", "1", "-framerate", String(FPS), "-t", String(d), "-i", png]);
  const filters = durations.map((d, i) =>
    `[${i}:v]crop=${W}:${H}:0:${H * i},setsar=1,format=yuv420p,fade=t=in:st=0:d=${FADE},fade=t=out:st=${(d - FADE).toFixed(2)}:d=${FADE}[v${i}]`);
  const concat = `${durations.map((_, i) => `[v${i}]`).join("")}concat=n=${durations.length}:v=1:a=0[out]`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", ...inputs, "-filter_complex", [...filters, concat].join(";"), "-map", "[out]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-tune", "stillimage", "-g", String(FPS * 20), "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", mp4,
  ]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", `crop=${W}:${H}:0:0`, "-q:v", "4", jpg]);
  const total = durations.reduce((a, b) => a + b, 0);
  console.log(`${mp4}  ${durations.length} slides  ${total.toFixed(0)} s  ${(statSync(mp4).size / 1024).toFixed(0)} KB`);
}

const only = process.argv.slice(2);
const work = mkdtempSync(join(tmpdir(), "lesson-videos-"));
try {
  for (const item of CATALOG.filter((c) => c.video && c.content && (!only.length || only.includes(c.id)))) {
    for (const lang of ["th", "en"] as const) render(item, lang, work);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
