#!/usr/bin/env python3
"""Export the deck to a text-based PDF (12 pages, 1920x1080 pt) with headless Chrome.

Builds deck/export.html from deck.json and slides/*.html, checks every slide for
overflow, then prints IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf at the repo root.

usage: python3 deck/export_pdf.py [--chrome PATH] [--out PATH]
"""
import argparse, html, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path

DECK = Path(__file__).resolve().parent
ROOT = DECK.parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CSS = """
@page { size: 1920pt 1080pt; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff }
.page { width: 1920pt; height: 1080pt; overflow: hidden; position: relative; break-after: page }
.page:last-of-type { break-after: auto }
.page > section { width: 1920px; height: 1080px; box-sizing: border-box; position: relative; overflow: hidden;
  transform: scale(1.3333333); transform-origin: 0 0 }
section *, section *::before, section *::after { box-sizing: border-box }
section h1, section h2, section h3, section h4, section p, section ul, section ol, section figure { margin: 0 }
section ul, section ol { padding-left: 1.15em }
section img { max-width: 100%; display: block }
section aside { display: none }
#overflow-report { display: none }
"""

CHECK = """
<script>
document.fonts.ready.then(() => {
  const rows = [...document.querySelectorAll('.page > section')].map((s, i) => {
    const r = s.getBoundingClientRect();
    let worst = 0;
    s.querySelectorAll('*').forEach(el => {
      if (el.closest('aside')) return;
      const b = el.getBoundingClientRect();
      worst = Math.max(worst, (b.bottom - r.top) / 1.3333333 - 1080, (b.right - r.left) / 1.3333333 - 1920);
    });
    const broken = [...s.querySelectorAll('img')].filter(im => !im.complete || im.naturalWidth === 0).length;
    return `${i + 1} ${s.id} overflow_px=${Math.max(0, Math.round(worst))} broken_images=${broken}`;
  });
  const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).join(',');
  document.getElementById('overflow-report').textContent = rows.join('\\n') + '\\nfonts_loaded=' + fonts;
});
</script>
"""


def build():
    deck = json.loads((DECK / "deck.json").read_text())
    links = "\n".join(f'<link rel="stylesheet" href="{html.escape(f["href"])}">' for f in deck["faces"].values())
    pages = []
    for name in deck["order"]:
        src = (DECK / "slides" / f"{name}.html").read_text()
        src = src.replace('src="../../', 'src="../')
        pages.append(f'<div class="page">{src}</div>')
    doc = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(deck["title"])}</title>'
           f'{links}<style>{CSS}</style></head><body>{"".join(pages)}<pre id="overflow-report"></pre>{CHECK}</body></html>')
    out = DECK / "export.html"
    out.write_text(doc)
    return out


def chrome(binary, profile, *args):
    base = [binary, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            f"--user-data-dir={profile}", "--virtual-time-budget=30000", "--run-all-compositor-stages-before-draw"]
    return subprocess.run(base + list(args), capture_output=True, text=True, timeout=180)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chrome", default=CHROME)
    ap.add_argument("--out", default=str(ROOT / "IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf"))
    a = ap.parse_args()
    page = build()
    profile = tempfile.mkdtemp(prefix="deck-export-")
    try:
        dom = chrome(a.chrome, profile, "--dump-dom", page.as_uri()).stdout
        report = re.search(r'<pre id="overflow-report">(.*?)</pre>', dom, re.S)
        report = html.unescape(report.group(1)) if report else "no report"
        print(report)
        bad = [l for l in report.splitlines() if re.search(r"overflow_px=[1-9]|broken_images=[1-9]", l)]
        if bad or "Source Serif 4" not in report or "IBM Plex Sans" not in report:
            sys.exit("export stopped: overflow, broken images or fonts not loaded (see report above)")
        r = chrome(a.chrome, profile, "--no-pdf-header-footer", f"--print-to-pdf={a.out}", page.as_uri())
        if r.returncode != 0 or not Path(a.out).is_file():
            sys.exit(f"chrome print failed: {r.stderr[-500:]}")
        print(f"wrote {a.out}")
    finally:
        shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    main()
