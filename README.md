# IRIS Consulting case: AI Learning Suite

Kunanon Jarat's case response for the Digital & AI Solution Product Manager role. The task: launch an integrated, AI-powered learning suite (skill assessment, AI learning paths, a Thai/English AI coach, an impact dashboard and manager approvals) for 12,000 of the fictional Siam Pinnacle Group's 45,000 employees, in 12 weeks.

**Mock data only.** The company, people, roles and courses are fictional and were generated for this exercise.

## What's here

| Folder | What it is |
|---|---|
| [`prototype/`](prototype/) | Working Next.js prototype: employee, manager and leader views; AI path engine; Thai/English coach with citations and guardrails; eval harness. See its [README](prototype/README.md) for how to run it. |
| [`model/`](model/) | `cost-model.xlsx`: build cost, 36-month run cost, pricing, AI cost scenarios and value case, all live formulas. `build_model.py` regenerates it. |
| [`deck/`](deck/) | Source of the 12-slide deck (one HTML file per slide). The PDF is submitted separately. |
| [`notes/`](notes/) | `research.md` (sourced facts: PDPA, cloud regions, Thai NLP, LINE, LMS standards, benchmarks) and `storyline.md` (the deck's argument and key numbers). |
| [`docs/screenshots/`](docs/screenshots/) | Screens from the prototype. |

## Quick start

```bash
cd prototype
pnpm install
pnpm dev          # http://localhost:3000, demo mode without an API key
pnpm eval --demo  # 31 Thai/English eval cases, no model calls
```

Add `ANTHROPIC_API_KEY` to `prototype/.env.local` to turn on the live coach and AI path generation.

## Tools used

Claude Code (Claude Opus 5.5) wrote the prototype code, mock data and lesson text, gathered research and drafted the slides. The prototype calls the Claude API. Playwright ran the automated UI walkthroughs. The product, design and commercial decisions are the author's.
