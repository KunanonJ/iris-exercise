# Learning Suite prototype

**Live: https://iris.kunanonj.com** *(Role-Based Login with 1-tap demo sign-in: Employee `E0001`/PIN `1120`, Manager `E0002`/PIN `2240`, HR & Leaders `E9001`/PIN `9001`)*

Working prototype for the IRIS Consulting case: an integrated, AI-powered learning suite for frontline staff, with a Thai/English AI coach. **Mock data only**: the company, people, roles and courses are fictional and were generated for this exercise.

## What to try (5 minutes)

Each role signs into an isolated, PDPA-scoped session via the **Role-Based Login Portal** (use the pre-filled credentials, SSO button, or the **1-Tap Evaluator Quick Login** strip at the bottom; use **"สลับบัญชี / ออกจากระบบ · Switch role / Sign out"** in the top bar and the **ไทย/EN** toggle at any time):

1. **Employee (`E0001` · Somchai, Senior Store Associate · LINE OA SSO):** start the 5-minute skill check. "Use sample answers" skips ahead. Submit it to the manager, then click **"เข้าสู่ระบบหัวหน้า (E0002) เพื่ออนุมัติ / Sign in as Manager (E0002) to approve"**.
2. **Manager (`E0002` · Malee, Store Manager · Google Workspace SSO):** open Somchai's assessment in the approval inbox, adjust a level if you disagree, and approve. Batch approval and the overdue → HRBP escalation are visible in the inbox.
3. **Employee (`E0001`) → Path:** sign back in as Somchai and tap "Build my path with AI". A rules engine shortlists approved catalogue items for each skill gap; the model sequences them into a 70-20-10 plan and writes the rationale. Send the path for approval.
4. **Manager (`E0002`):** sign in as Malee and approve the plan. Approving it also approves the workshops in it.
5. **Employee (`E0001`) → Home:** view your next step, plus a preview of the LINE nudge. Open the lesson and use **"Ask about this lesson"** (the chat sits beside the content with clickable `[S1]` source drawer).
6. **Coach tab:** try all 4 core capabilities (*Explain results*, *Recommend next steps*, *Practise role-play*, *Reflect on learning*) as well as the red-team guardrail prompts: a colleague's score, salary, prompt injection, stress.
7. **HR & Leaders (`E9001` · Arunee, HRBP · Google Workspace SSO):** sign in to inspect adoption, the capability heatmap (baseline vs now), the link to business KPIs, and coach health (anonymised aggregates $N \ge 10$ only).

"Reset demo" restores the starting state and re-seeds the Cloudflare D1 database.

## Run locally

Requires Node 20+ and pnpm.

```bash
pnpm install
cp .dev.vars.example .dev.vars   # optional: configure Workers AI, OpenCode or Anthropic
npx wrangler d1 execute iris-learning-suite-db --local --file=db/schema.sql
pnpm dev                         # UI on http://localhost:3000, API (Worker + D1) on :8787
pnpm preview                     # production-like: static build + Worker on http://localhost:8787
```

## Database (Cloudflare D1 SQLite)

The prototype persists state in a **Cloudflare D1** relational SQLite database (`iris-learning-suite-db`, schema in [`db/schema.sql`](db/schema.sql), repository in [`src/lib/db.ts`](src/lib/db.ts)) across 5 tables:
- `employees` (213 seeded Siam Pinnacle Group employees across 5 BUs)
- `assessments` (self-assessment, anchor quiz, manager calibration, and overrides)
- `plans` (70-20-10 learning path steps, status, rationale, and project evidence)
- `approvals` (manager approval inbox with SLA due dates and escalation status)
- `coach_logs` (grounded AI Coach conversation history per employee and lesson)

Every Employee $\rightarrow$ Manager $\rightarrow$ HR action syncs via `GET/POST /api/state`, and clicking **Reset demo (`รีเซ็ตเดโม`)** calls `POST /api/state/reset` to cleanly re-seed all 5 D1 tables.

Without a key the app runs in **demo mode**. Guardrails, retrieval, the rules-based path and the approvals all work, and the coach gives scripted, retrieval-backed answers. With a key, the coach, the guardrail classifier and the path generator call a model.

## AI providers

One provider layer (`src/lib/ai.ts`) with three backends. It is chosen by `AI_PROVIDER`, otherwise by whichever key is set.

| Provider | Setup | Default models | Notes |
|---|---|---|---|
| **Cloudflare Workers AI** (free; the live demo uses this) | `AI_PROVIDER=workers-ai`. The Worker uses its `AI` binding; Node scripts need `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` | coach, path and classifier `@cf/aisingapore/gemma-sea-lion-v4-27b-it` (SEA-LION v4, tuned for Southeast Asian languages); judge `@cf/qwen/qwen3-30b-a3b-fp8` | 10,000 neurons/day free, about 60-70 coach messages. When the allowance runs out, the coach falls back to retrieval answers. |
| **OpenCode** gateway (`https://opencode.ai/inference/v1`) | `OPENCODE_API_KEY` (needs credits and model access) | coach and path `claude-sonnet-5-5`, classifier `claude-haiku-5-5` | Claude and Qwen use the gateway's Anthropic-format `/messages`; Kimi, DeepSeek, GLM and MiniMax use `/chat/completions`. OpenCode's free models only work inside the OpenCode app, not over its API. |
| **Anthropic** (Claude API) | `ANTHROPIC_API_KEY` | coach and path `claude-opus-5-5`, classifier `claude-haiku-5-5` | Adds structured outputs, prompt caching and server-side refusal fallback. |

On OpenCode and Workers AI, structured results (the classifier, the path, the judge) are requested as JSON and validated against the same zod schemas. One retry is allowed, then the app falls back to the rules engine. If any provider fails before replying, the coach serves the retrieval answer with an "AI unavailable" note.

Before you switch the coach to another model, run `pnpm eval` on it.

**Live eval on the free model** (`evals/report-live.md`):

| Check | Result |
|---|---|
| Overall | 90% |
| Red-team cases handled safely | 100% |
| Thai quality (LLM judge) | 4.09 / 5 |
| Correct citations | 92% |
| Grounded (LLM judge) | 83%, below the 95% gate |

Three fixes made after that run (`report-live-subset.md`): lesson-only sources, no extra courses, and citing only existing sources. By the release gate, production would stay on Claude.

## Evals

```bash
pnpm eval          # live if a key is in .dev.vars, otherwise demo mode
pnpm eval --demo   # deterministic layers only, no model calls, free
pnpm eval --only=G12,H02   # re-check a few cases (writes report-*-subset.md)
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
| Path engine | `src/lib/plan-rules.ts`, `src/lib/path.ts` | Rules shortlist → model sequencing → item ids checked against the catalogue; critical gaps always covered |
| Retrieval | `src/lib/coach/retrieval.ts` | BM25 with Thai word segmentation (`Intl.Segmenter`, same output on Node and Workers). Production adds multilingual embeddings |
| Guardrails | `src/lib/coach/guardrails.ts` | Layer 1: bilingual deterministic rules and PII masking before any model call. Layer 2: model intent classifier (live). Blocked categories get fixed, reviewed replies |
| Coach | `src/lib/coach/coach.ts`, `prompt.ts` | Only the signed-in employee's own record is sent; sources are numbered and cited; streaming |
| AI providers | `src/lib/ai.ts` | Cloudflare Workers AI (free default), OpenCode or Anthropic; streaming text and schema-checked JSON |
| API + hosting | `worker/index.ts`, `wrangler.jsonc` | Cloudflare Worker serves the static Next.js export and `/api/status`, `/api/coach` (stream), `/api/path`, `/api/unlock`; best-effort rate limit; optional passcode gate |

## Deploy (Cloudflare Workers)

```bash
npx wrangler login                       # once
npx wrangler secret put OPENCODE_API_KEY # optional; the default provider is Workers AI (free, no key)
npx wrangler secret put DEMO_PASSCODE    # optional: gate the whole site
pnpm run deploy                          # next build (static export) + wrangler deploy
```

Use `pnpm run deploy`, not `pnpm deploy`: the latter is a built-in pnpm command. If your login has several Cloudflare accounts, set `CLOUDFLARE_ACCOUNT_ID`. The custom domain (`iris.kunanonj.com`) is set in `wrangler.jsonc`. Its zone must be in the same account; change or remove the `routes` entry to deploy elsewhere.

It runs on the Workers free plan: the static assets are free, and the Worker bundle is about 290 KB gzipped against a 3 MB limit. The free plan caps each request at 10 ms of CPU time. Model calls are network waits, not CPU, but if requests hit error 1102, move to Workers Paid (USD 5 a month).

## Tools used

Built with Claude Code (Claude Opus 5.5) for code, mock data and lesson text. Playwright ran the automated UI walkthroughs. All design decisions were reviewed by the author.
