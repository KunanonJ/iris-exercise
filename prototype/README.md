# Learning Suite prototype — implementation and local proof

The Next.js app (UI + `/api`) hosts on **Vercel** with **Supabase Postgres** for `suite_v2_*` state and memberships, accessed through **Prisma 7** (`@prisma/adapter-pg` + transaction pooler) so the API can scale toward tens of thousands of users without exhausting Postgres connections. The UI uses **shadcn/ui** (Radix + Tailwind v4) under `src/components/ui/`, with suite-specific wrappers in `src/components/kit.tsx`. The Cloudflare Worker/D1 path remains available for local Moodle/HR sandbox work (`pnpm dev:worker`) and optional Workers AI. Production URL: [iris-learning-suite.vercel.app](https://iris-learning-suite.vercel.app).

Add components with `npx shadcn@latest add <name>`.

## Authentication and permissions

Clerk supplies session identity. The Next.js API (or Worker) verifies the public-key JWT and expected issuer, authorised party, user/session claims and session status. Supabase (or local D1) membership records map the verified user to one tenant, employee and role. The browser cannot grant itself a role or pick an arbitrary employee. Demo exception: with `DEMO_ROLE_PICKER=1`, a signed-in account that has no membership sees a role picker and `POST /api/demo/role` binds it to one of three synthetic personas (E0001 employee, E0002 manager, E9001 leader). The choice is audited and rate-limited, and every request still checks the stored role. Leave the flag unset to require administrator-assigned memberships.

- Employees access their own learning record.
- Managers can learn on their own record and review their current direct reports. Team views exclude private coach conversations; self-approval is blocked.
- HR/leadership views return server-calculated aggregates, suppressing groups below 10.
- Mutations use typed commands, an expected revision, idempotency key and atomic audit writes. The browser cannot replace shared state or claim verified lesson completion.
- Suite-managed learning data and API bearer tokens stay in memory; the Suite persists only language preference. Clerk manages its own authentication cookies and storage. Legacy public reset and token-minting routes are retired.

The client fails closed if its Clerk publishable key is absent. Verifier unit tests use local signed fixtures. The linked Clerk development application is **IRIS Learning Suite** (`app_3KpAThJJWmOUNJ445CxjVknazcT`). Earlier cross-role API/browser receipts against the previous Tutor Me app remain under [`sandbox/receipts/`](sandbox/receipts/); re-verify after this switch before citing them as current. Suite and Moodle authentication remain separate. See [`../docs/sso-google-line.md`](../docs/sso-google-line.md).

## Local setup

Use the repository's installed Node/pnpm versions and dependencies. Run commands from `prototype/`. Copy `.env.example` → `.env.local` (mode 600). Never put token values in commands, tracked files or screenshots.

### Default: Next.js + Supabase (matches Vercel)

1. Select the Clerk development app **IRIS Learning Suite** (`app_3KpAThJJWmOUNJ445CxjVknazcT`) via `pnpm dlx clerk@latest auth login` / `npx clerk link`.
2. Link the CLI to the hosted project (once): `npx supabase link --project-ref cyxbhietwlcqpdjafate`.
3. Set Clerk + Supabase keys in `.env.local` (`npm run sso:sync-env` helps with Clerk; `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the project API settings).
4. Provision the synthetic tenant and memberships:

```sh
pnpm supabase:provision --memberships /absolute/path/to/protected-memberships.json
pnpm dev
```

`APP_ORIGINS` must include every browser origin that will call `/api` (e.g. `http://localhost:3000` and the Vercel URL). Schema lives in `supabase/migrations/` (already applied remotely).

### Optional: Worker + local D1

```sh
pnpm sandbox:provision --memberships /absolute/path/to/protected-memberships.json
pnpm dev:worker
```

`USE_WORKER_API=1` proxies `/api` to Wrangler on port **8797** (8787 is occupied elsewhere). Moodle/HR connector proofs still use this path.

Worker asset deploy (static `out/` export):

```sh
pnpm deploy:worker   # runs WORKER_STATIC_EXPORT=1 next build && wrangler deploy
```

### Deploy (Vercel)

Branch model (see [`docs/deployment.md`](../docs/deployment.md)):

| Branch | Vercel env |
|---|---|
| `main`, `preview`, PRs | Preview |
| `production` (push) | Production |

```sh
npx vercel deploy          # preview
npx vercel deploy --prod   # production
```

Vercel project: `iris-learning-suite` (root `prototype`). Git is connected; **Production Branch = `production`**. GitHub Actions `CI` verifies the app; Vercel Git deploys on push. Manual CLI redeploy: Actions → **Vercel**. `pnpm sso:sync-env` writes Clerk verification keys into **both** `.env.local` (Next) and `.dev.vars` (Worker).

## Verify the five journeys

1. Sign in with the provisioned employee account. Review current/next-role skills, complete self-ratings and the three scenarios, then submit. Scores are calculated on the server.
2. Sign out and sign in with the assigned manager account. Approve or return the assessment; calibration requires a reason. Other managers and employees cannot make this decision.
3. Return as the employee, generate a draft path, submit it, then have the manager approve. Rules-based generation is labelled distinctly from an AI-generated path.
4. Open the video/lesson, workshop or project content. The contextual coach can explain, practise and reflect in Thai/English. Its final answer provenance is visible. Video lessons with a transcript play a sample clip in the reader's language, rendered from that transcript by `pnpm videos` (needs Chrome and ffmpeg). The clips have no narration, and playing one does not mark the step complete.
5. Complete a mapped Moodle activity upstream and reconcile through the administrative connector. The browser has no "verified complete" action. Submit project evidence for the manager's separate approval.
6. Inspect the leader's server-generated aggregates and the environment's connection status. Business impact is a measurement hypothesis, not a demonstrated causal result.

The sandbox has individual reviews and due dates. Batch approval, workshop reservations, LINE reminders and automatic SLA escalation remain production proposals.

## HR and Moodle evidence

See [`sandbox/README.md`](sandbox/README.md) for the isolated lab:

```sh
node sandbox/run.mjs setup
node sandbox/run.mjs start
node sandbox/run.mjs proof
```

The recorded proof against two **real Moodle 4.5.15** instances covers catalogue, enrolment, upstream completion, replay and one-instance-down behavior. The synthetic HR feed demonstrates persistent-cursor joiner, manager-transfer and leaver events. Receipt: [`sandbox/receipts/2026-10-15T09-17-29.219Z.json`](sandbox/receipts/2026-10-15T09-17-29.219Z.json).

This connector proof is distinct from Suite-to-D1 reconciliation and permission acceptance. Hosted connectors remain **unconfigured**. No client HRIS, Google/LINE federation, xAPI, LTI or LINE delivery has been proven. Tokens remain server-side in ignored protected configuration.

## Checks and AI release gate

The integrated automated suite passed **71/71**, with TypeScript, lint and the default Turbopack build passing. Local Worker/D1 reconciliation and idempotent replay against both Moodle instances passed; [receipt](sandbox/receipts/suite-2026-10-15T09-35-39.519Z.json). Real Clerk login, cross-role API checks and authenticated browser journeys also passed across employee, manager and leader accounts; [API receipt](sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json), [browser receipt](sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json).

```sh
pnpm test
pnpm lint
pnpm exec tsc --noEmit --incremental false
pnpm build
pnpm eval --demo
```

The evaluator runs the original 31 cases plus 24 held-out cases. The integrated offline run passed 55/55; this is deterministic regression evidence, **not live-model certification**. Both the historical [`evals/report-live.md`](evals/report-live.md) (83% groundedness) and the new 55-case live Workers AI run [`evals/runs/2026-10-15T14-18-58-089Z-f48e1caf/report.md`](evals/runs/2026-10-15T14-18-58-089Z-f48e1caf/report.md) (93.1% groundedness across 27/29 judged answers; 100% valid citations; Thai quality 5.00 / 4.83) remain below the 95% groundedness gate (**FAIL**, `releaseCertified: false`). A proposed production Claude configuration has no established passing result either.

The harness requires exact-source judgments, validates citations, preserves model/source fingerprints, and sends final answer provenance through SSE. Missing judges, interrupted/quota-limited runs and diagnostic subsets cannot certify release. Required thresholds: 100% safety and language correctness; at least 90% golden/hallucination and citation pass; at least 95% groundedness; Thai quality at least 4/5.

Live execution is blocked until the operator verifies account-level free-only limits; the plan-read request returned 403. The harness does not read secret files. Supply only the named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through the existing secure process environment. Only after free-only verification, use the configured provider:

```sh
AI_PROVIDER=workers-ai AI_FREE_ONLY=1 pnpm eval --live --free-tier-confirmed
```

Do not treat the flag as billing evidence. The Worker requires `AI_FREE_ONLY_VERIFIED=1` before live inference; otherwise it uses deterministic mode. No paid-provider fallback is enabled in the Worker. Preserve failed runs and report incomplete usage: classifier/judge billing is not currently captured as a complete total.

## Main code boundaries

| Layer | Source |
|---|---|
| Client, no personnel dataset | `src/components/SecureSuite.tsx` and `secure-*` |
| Identity and workflow contracts | `src/server/auth.ts`, `src/lib/suite-contracts.ts` |
| Scope, scoring and state transitions | `src/lib/suite-domain.ts` |
| D1 revision/idempotency/audit transaction | `src/lib/suite-repository.ts`, `db/migrations/` |
| Synthetic HR and local Moodle adapters | `src/lib/sandbox-integrations.ts`, `src/server/integration-service.ts` |
| Grounded coach and evaluation | `src/lib/coach/`, `src/lib/evaluation.ts`, `scripts/eval.ts` |

## Tools and outstanding acceptance

The original draft attributes initial implementation and earlier screenshots to Claude Code, Cursor and Playwright. Codex supported this continuation's authentication, workflows, evaluation integrity, integration/security review, financial verification and documentation. Historical live benchmarking used SEA-LION v4 with Qwen judging. No current assistant model identity or unperformed human review is claimed.

Before any deployment: complete real Clerk sign-in, final integrated local Worker/D1/browser acceptance, the full live AI quality gate, and production security/DPO decisions. Deployment, remote database changes, secret replacement and publication require separate authority. Follow [`../docs/implementation-progress.md`](../docs/implementation-progress.md) for current receipts.

## Deployment branches

See [`docs/deployment.md`](../docs/deployment.md): `main`/`preview` → Vercel Preview; `production` → Production.
