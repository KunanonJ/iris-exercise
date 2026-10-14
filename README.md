# IRIS Consulting case: AI Learning Suite

Kunanon Jarat's case response for the Digital & AI Solution Product Manager role. The task: launch an integrated, AI-powered learning suite (skill assessment, AI learning paths, a Thai/English AI coach, an impact dashboard and manager approvals) for 12,000 of the fictional Siam Pinnacle Group's 45,000 employees, in 12 weeks.

**Live prototype: https://iris.kunanonj.com**

**Mock data only.** The company, people, roles and courses are fictional and were generated for this exercise.

## What's here

| Folder | What it is |
|---|---|
| [`prototype/`](prototype/) | Working prototype (Next.js static export + Cloudflare Worker): employee, manager and leader views; AI path engine; Thai/English coach with citations and guardrails; Workers AI (free), OpenCode or the Claude API as the AI provider; eval harness. See its [README](prototype/README.md). |
| [`model/`](model/) | `cost-model.xlsx`: build cost, 36-month run cost, pricing, AI cost scenarios and value case, all live formulas. `build_model.py` regenerates it. |
| [`deck/`](deck/) | Source of the 12-slide deck (one HTML file per slide). The PDF is submitted separately. |
| [`notes/`](notes/) | `research.md` (sourced facts: PDPA, cloud regions, Thai NLP, LINE, LMS standards, benchmarks) and `storyline.md` (the deck's argument and key numbers). |
| [`docs/screenshots/`](docs/screenshots/) | Screens from the prototype. |

## Quick start

```bash
cd prototype
pnpm install
pnpm dev          # UI on http://localhost:3000 + Cloudflare Worker API on :8787 (demo mode without a key)
pnpm eval --demo  # 31 Thai/English eval cases, no model calls
```

The live site runs its AI on free models (SEA-LION v4 on Cloudflare Workers AI). Locally, set a provider in `prototype/.dev.vars`: Workers AI, the OpenCode gateway or the Claude API. Hosting is a Cloudflare Worker serving a static Next.js export (`pnpm deploy`); see the [prototype README](prototype/README.md).

## Tools used

Claude Code (Claude Opus 5.5) wrote the prototype code, mock data and lesson text, gathered research and drafted the slides. The prototype calls models through Cloudflare Workers AI (live demo, free), the OpenCode gateway or the Claude API. Playwright ran the automated UI walkthroughs. The product, design and commercial decisions are the author's.
