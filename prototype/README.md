# Learning Suite prototype — implementation and local proof

The Next.js static frontend and Cloudflare Worker/D1 API implement the five learning journeys using synthetic case-study data. **The revised version is local and has not been deployed.** Historical public screenshots and demo links do not verify this version.

## Authentication and permissions

Clerk supplies session identity. The Worker verifies the public-key JWT and expected issuer, authorised party, user/session claims and session status. D1 membership records map the verified user to one tenant, employee and role; the browser cannot choose a persona or grant itself a role.

- Employees access their own learning record.
- Managers can learn on their own record and review their current direct reports. Team views exclude private coach conversations; self-approval is blocked.
- HR/leadership views return server-calculated aggregates, suppressing groups below 10.
- Mutations use typed commands, an expected revision, idempotency key and atomic audit writes. The browser cannot replace shared state or claim verified lesson completion.
- Suite-managed learning data and API bearer tokens stay in memory; the Suite persists only language preference. Clerk manages its own authentication cookies and storage. Legacy public reset and token-minting routes are retired.

The client fails closed if its Clerk publishable key is absent. Verifier unit tests use local signed fixtures, and **real Clerk sign-in, cross-role API verification and authenticated browser journeys have been verified locally** against the linked development application (`app_3FR2A54nq68wzHcRSjfMWabSBU5`); receipts: [`sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json`](sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json) and [`sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json`](sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json). Suite and Moodle authentication remain separate.

## Local setup

Use the repository's installed Node/pnpm versions, Docker Desktop with its daemon running, and the existing dependencies. Run commands from `prototype/`. This guide makes no changes to production D1 or hosted secrets.

1. Select the existing Clerk development application. The user may authenticate its official CLI with `pnpm dlx clerk@latest auth login`; do not create an unrelated app automatically.
2. Configure the frontend's `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` through its ignored local environment convention. It is bundled at build time, so rebuild when it changes.
3. Configure `CLERK_PUBLISHABLE_KEY`, public `CLERK_JWT_KEY`, `CLERK_ISSUER_URL` and `APP_ORIGINS` for the local Worker. Use the existing ignored local secret mechanism for integration credentials; never put token values in commands, tracked files or screenshots.
4. Prepare a protected membership input containing the selected Clerk `userId` values and synthetic employee/role mappings. Provision locally:

```sh
pnpm sandbox:provision --memberships /absolute/path/to/protected-memberships.json
pnpm build
```

Start the explicitly local Worker/D1 configuration, then the frontend in a second terminal:

```sh
pnpm exec wrangler dev --config wrangler.sandbox.jsonc --local --persist-to .wrangler/suite-v2 --port 8797 --inspector-port 0
```

```sh
pnpm exec next dev --port 3000
```

Use the configured localhost origin. The `dev` and `preview` scripts use this isolated local sandbox configuration. Port 8797 is intentional because an unrelated service occupies 8787; the Next.js development API proxy targets 8797. Do not infer production authentication or integration readiness from a successful build.

## Verify the five journeys

1. Sign in with the provisioned employee account. Review current/next-role skills, complete self-ratings and the three scenarios, then submit. Scores are calculated on the server.
2. Sign out and sign in with the assigned manager account. Approve or return the assessment; calibration requires a reason. Other managers and employees cannot make this decision.
3. Return as the employee, generate a draft path, submit it, then have the manager approve. Rules-based generation is labelled distinctly from an AI-generated path.
4. Open the video/lesson, workshop or project content. The contextual coach can explain, practise and reflect in Thai/English. Its final answer provenance is visible.
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
