# Learning Suite prototype

Working prototype for the IRIS Consulting case: an integrated, AI-powered learning suite for frontline staff, with a Thai/English AI coach. **Mock data only**: the company, people, roles and courses are fictional and were generated for this exercise.

## What to try (5 minutes)

Use the persona switch at the top (Employee / Manager / HR & Leaders) and the ไทย/EN toggle.

1. **Employee (Somchai, Senior Store Associate):** start the skill check. "Use sample answers" skips ahead. Submit it to the manager.
2. **Manager (Malee, Store Manager):** open Somchai's assessment, adjust a level if you disagree, and approve. Batch approval and the overdue → HRBP escalation are visible in the inbox.
3. **Employee → Path:** "Build my path with AI". A rules engine shortlists approved catalogue items for each skill gap; Claude sequences them and writes the rationale. Send the path for approval.
4. **Manager:** approve the plan. Approving it also approves the workshops in it.
5. **Employee → Home:** next step, plus a preview of the LINE nudge. Open the lesson and use **"Ask about this lesson"** (the chat sits beside the content).
6. **Coach tab:** try the suggested prompts, including the guardrail ones: a colleague's score, salary, prompt injection, stress.
7. **HR & Leaders:** adoption, the capability heatmap (baseline vs now), the link to business KPIs, and coach health.

"Reset demo" restores the starting state. Demo state is kept in your browser only.

## Run locally

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for the live AI coach
pnpm dev                     # http://localhost:3000
```

Without an API key the app runs in **demo mode**. Guardrails, retrieval, the rules-based path and the approvals all work, and the coach gives scripted, retrieval-backed answers. With a key, the coach and the path generator call Claude.

## Evals

```bash
pnpm eval          # live if ANTHROPIC_API_KEY is set, otherwise demo mode
pnpm eval --demo   # deterministic layers only, no model calls, free
```

There are 31 cases in `evals/cases.json`, in Thai and English:

- golden questions
- hallucination bait (courses that don't exist)
- red-team cases: colleague data, pay and promotion, prompt injection, wellbeing, crisis, PII, off-topic

Checks: category, correct citation, forbidden content, PII masking and reply language. In live mode an LLM judge also scores groundedness and Thai quality. Results go to `evals/report-*.md` with a release gate.

## How it works

| Layer | File | Notes |
|---|---|---|
| Data model | `src/lib/types.ts` | Roles → required skills → assessments → gaps → plan → approvals |
| Mock data | `src/data/taxonomy.ts`, `src/data/catalog.ts`, `scripts/generate-mock-data.ts` | 5 BUs, 26 roles, 33 skills, 120 catalogue items (21 with full TH/EN lesson text), 213 employees |
| Path engine | `src/lib/plan-rules.ts`, `src/lib/path.ts` | Rules shortlist → Claude sequencing with structured output → ids validated against the catalogue; critical gaps are always covered |
| Retrieval | `src/lib/coach/retrieval.ts` | BM25 with Thai word segmentation (`Intl.Segmenter`). Production adds multilingual embeddings |
| Guardrails | `src/lib/coach/guardrails.ts` | Layer 1: bilingual deterministic rules and PII masking, run before any model call. Layer 2: LLM intent classifier (live). Blocked categories get fixed, reviewed replies |
| Coach | `src/lib/coach/coach.ts`, `prompt.ts` | Only the signed-in employee's own record is sent; sources are numbered and cited; streaming |
| API | `src/app/api/*` | `coach` (stream), `path`, `status`; best-effort rate limit; optional passcode gate (`src/proxy.ts`) |

Models (configurable in `.env.local`): coach and path `claude-opus-5-5`, classifier `claude-haiku-5-5`, judge `claude-sonnet-5-5`.

## Deploy (Vercel)

Set `ANTHROPIC_API_KEY`, `DEMO_PASSCODE` and optionally `DAILY_LIMIT`, then deploy. The passcode keeps the link unlisted and protects the API budget.

## Tools used

Built with Claude Code (Claude Opus 5.5) for code, mock data and lesson text. All design decisions were reviewed by the author.
