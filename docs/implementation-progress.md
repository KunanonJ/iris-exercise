# Learning Suite implementation and acceptance checklist

Updated 17 October 2026. Baseline: `main`, `8f1e891` (cloned into an empty local workspace). Coach grounding fixes for the prior live FAIL are local and uncommitted. No push, deployment, recruiter message or remote database mutation was performed.

## Four-gap status

| Gap | Completed locally | Acceptance still open |
|---|---|---|
| Integration claims and proof | Retired fabricated SSO, LTI, xAPI and LINE authority. Documented sandbox versus production boundaries. Two actual Moodle 4.5.15 instances proved catalogue, enrolment, upstream completion, replay and partial outage; synthetic HTTP HR proved joiner, manager transfer and leaver. Worker-to-Moodle-to-D1 reconciliation also passed. | Client HRIS/LMS connectivity, federation and hosted deployment are unproven. Suite and Moodle logins remain separate. |
| Server permissions | Clerk SDK session-signature/issuer/authorised-party/status checks; D1 memberships; own-record and current-report scope; aggregate-only leader access with a ten-person privacy threshold; server scoring; approval state transitions; CAS, idempotency, quotas and atomic audit writes. Public persona minting, resets and whole-state writes return 410. Existing Clerk development app (`app_3FR2A54nq68wzHcRSjfMWabSBU5`) linked; three distinct Clerk provider identities (`E0001` employee, `E0002` manager, `E9001` leader) provisioned; real provider sign-in, cross-role API boundaries and authenticated browser journeys verified. | Production security review, hosted deployment and enterprise IdP federation remain separate gates. |
| Live AI quality | Preserved original 31 cases and added 24 held-out bilingual cases. Exact-source judging, complete denominators, final provenance, frozen fingerprints and nonzero failed/incomplete exits. Malformed/truncated upstream streams fail. Offline regression: **55/55** after 17 Oct coach fixes (`2026-10-17T03-23-33-591Z-adebc68e`). Prior complete 55-case live Workers AI run (`2026-10-15T14-18-58-089Z-f48e1caf`): 100% valid citations (27/27), Thai quality 4.92/5, 100% golden live coverage (28/28), 93.1% groundedness (27/29). Local fixes: in-scope PII turns refuse without model answers (`R12`); assessment explain pins KB-01; coach prompt tightened for employee-context gaps; judge already scores question language + trusted context. | Live release gate still **FAIL** on the preserved 15 Oct evidence until a new complete live run. This machine has no `.dev.vars` / Workers AI binding; re-run needs credentials + `--free-tier-confirmed`. |
| Financial workbook | Seven sheets and all 1,244 formulas preserved; 1,244 caches populated, zero formula errors, 143 independent controls and four sensitivity scenarios passed. Proposal figures reconciled. | Native Microsoft Excel recalculation/rendering was not run. Vendor prices and client benefits remain planning assumptions. |

## Verification receipts

Commands run from `prototype/` unless stated otherwise. Passing scripted/offline checks do not establish provider or client-system connectivity.

| Command or check | Result | Evidence |
|---|---|---|
| `npm test` (17 Oct) | PASS | 74/74; prior suite plus PII refusal, assessment KB-01 pin, and bulk+email other-person-data cases. |
| `pnpm test` (15 Oct) | PASS | 71/71; authentication fixtures, permissions, workflow transitions, privacy, CAS/replay, quotas, integrations, coach transport and eval integrity. |
| `pnpm test:integration` | PASS | 26/26; includes actual local SQLite transactions and a synthetic HR HTTP service. |
| `pnpm exec tsc --noEmit --incremental false` | PASS | No type errors. |
| `pnpm lint` | PASS | No ESLint errors. |
| `pnpm build` | PASS | Default Next.js 16.4.0 Turbopack static export. |
| `pnpm audit --prod --json` | PASS | 108 production dependencies; zero reported advisories. This is an advisory snapshot, not a security certification. |
| `pnpm sandbox:provision --memberships .wrangler/clerk-memberships.json` | PASS | Additive local D1 migration, synthetic tenant seed and 3 distinct Clerk user memberships (`E0001` employee, `E0002` manager, `E9001` leader). |
| `pnpm exec tsx scripts/configure-local-integrations.ts --lab <existing-lab>/.local` | PASS | Only this lab's named service credentials transferred to ignored mode-600 `.dev.vars`; isolated pre-approved integration fixture provisioned. |
| `node sandbox/run.mjs proof` in the isolated lab | PASS | [Moodle/HR receipt](../prototype/sandbox/receipts/2026-10-15T09-17-29.219Z.json). Actual upstream activity completion, replay and one-instance-down proof. |
| `pnpm sandbox:verify` | PASS | [Worker/D1 receipt](../prototype/sandbox/receipts/suite-2026-10-15T09-35-39.519Z.json): both real Moodle sources persisted completion; replay did not duplicate operations; anonymous state read returned 401. |
| Real Clerk provider API proof | PASS | [Clerk API receipt](../prototype/sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json): real Clerk FAPI session JWTs verified for `E0001`, `E0002`, `E9001` and an unmapped Clerk user (403); full assessment → manager approval → plan → coach SSE → project evidence → manager approval workflow and negative role/origin checks passed. |
| Real Clerk authenticated browser journeys | PASS | [Clerk browser receipt](../prototype/sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json): live Clerk email-code sign-in and role-scoped UI verified across employee ([screenshot](screenshots/clerk-employee-live.png)), manager ([screenshot](screenshots/clerk-manager-live.png)) and leader ([screenshot](screenshots/clerk-leader-live.png)) accounts, plus sign-in screen ([screenshot](screenshots/clerk-signin-live.png)) and fail-closed setup screen ([screenshot](screenshots/clerk-setup-required.png)), with 0 console/page errors. |
| `npm run eval -- --demo` (17 Oct) | PASS | [55-case offline report](../prototype/evals/runs/2026-10-17T03-23-33-591Z-adebc68e/report.md); `R12`/`HO-G12`/`HO-R03`/`G10` all PASS; release certified **NO** (demo cannot certify). |
| `pnpm eval --demo` (15 Oct) | PASS | [55-case offline report](../prototype/evals/runs/2026-10-15T14-50-08-304Z-72a30879/report.md); release certified **NO**. |
| `pnpm eval --live` without free-only prerequisites | INCOMPLETE, exit 2 | [Blocked-run receipt](../prototype/evals/runs/2026-10-15T09-38-02-314Z-769ed906/report.md). The gate rejected execution before any provider call. |
| `AI_PROVIDER=workers-ai AI_FREE_ONLY=1 pnpm eval --live --free-tier-confirmed` | COMPLETE, FAIL (exit 1) | [55-case live report](../prototype/evals/runs/2026-10-15T14-18-58-089Z-f48e1caf/report.md); 55/55 completed, 29/29 judged, 0 fallbacks, 100% valid citations, Thai 5.00/4.83, groundedness 94.1% original (16/17) and 91.7% held-out (11/12); release certified **NO**. |
| `python3 model/verify_model.py model/cost-model.xlsx` from repository root | PASS | 143 independent controls; all caches present and no formula errors. [Workbook verification](../model/verification/verification.json). |
| `python3 model/verify_sensitivity.py model/cost-model.xlsx` in isolated model copy | PASS | Additional enrolment, subscription price, doubled AI usage and zero coach usage; deliverable unchanged. [Sensitivity receipt](../model/verification/sensitivity.json). |
| Exported client bundle inspection | PASS | No employee fixture IDs, names or personnel JSON in the active JavaScript bundle. The old storage key occurs only in a removal call. |
| Deck export and native PDF rendering | PASS | Twelve individual 1920×1080pt browser PDF captures merged into the final 12-page PDF; PDFKit renders reviewed for layout, text and images. Previous UI screenshots are labelled illustrative. |
| Fresh independent code/content review | PASS within scope | No remaining Critical, High or Medium findings from the reviewed changes after fixing small-cohort totals, incomplete evaluation fingerprints and truncated stream handling. Production review remains separate. |
| `git diff --check` | PASS | No whitespace errors. |

The workbook SHA-256 is `8d5abb2f591d6d217ddca7b74f53022330b560c5604913696aa5872616609835`. Three-year revenue is THB 82,342,000; gross profit THB 28,780,305.10; gross margin 34.9522% (after adding team software subscriptions and itemising cloud servers on 21 Oct).

## External prerequisites and remaining acceptance

- [x] Authenticate the Clerk CLI (`fronk.kunanon@gmail.com`) and link **IRIS Learning Suite** (`app_3KpAThJJWmOUNJ445CxjVknazcT`, instance `ins_3KpATcDrr7oYePzbZVpem6iy7gr`). Prior Tutor Me app (`app_3FR2A54…`) retained in the Clerk workspace but is no longer the linked target.
- [x] Provision distinct employee (`E0001`), manager (`E0002`) and leader (`E9001`) subjects on the new app into protected `.wrangler/clerk-memberships.json` (mode 600). Configure publishable key, public JWT verification key, issuer and allowed origins through ignored `.env.local` / `.dev.vars` (mode 600). Re-run `pnpm sandbox:provision --memberships .wrangler/clerk-memberships.json` after switching.
- [x] Prior real Clerk sign-in proofs against Tutor Me remain on disk ([`clerk-api-2026-10-15T14-10-06.023Z.json`](../prototype/sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json), [`clerk-browser-2026-10-15T14-17-17.135Z.json`](../prototype/sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json)); re-verify against IRIS Learning Suite before citing them as current.
- [x] Operator confirmed free-only account limits for the existing Cloudflare account (`fronk.kunanon@gmail.com`) and authorised running the complete 55-case live Workers AI evaluation.
- [ ] Pass the complete live AI quality gate (`>= 95%` groundedness, `100%` red-team safety, `>= 90%` golden/hallucination pass, `100%` language correctness). Preserved fail evidence: `2026-10-15T14-18-58-089Z-f48e1caf`. Local 17 Oct fixes address `R12` (PII → safety template, no plan dump) and tighten `HO-G12` (KB-01 pin + prompt). Judge language/trusted-context repairs in `scripts/eval.ts` remain. **Blocked here:** restore ignored `.dev.vars` (Workers AI) and re-run `AI_PROVIDER=workers-ai AI_FREE_ONLY=1 AI_FREE_ONLY_VERIFIED=1 npm run eval -- --live --free-tier-confirmed` with explicit operator confirmation.
- [x] **Enable live Google + LINE Login on Clerk development** (17 Oct): Linked to Dashboard app **IRIS Learning Suite** `app_3KpAThJJWmOUNJ445CxjVknazcT` (`ins_3KpATcDrr7oYePzbZVpem6iy7gr`). Google + LINE enabled; three case-study users recreated and written to ignored `.wrangler/clerk-memberships.json`. Local helpers: `npm run sso:enable`, `npm run sso:sync-env`. Guide: [`docs/sso-google-line.md`](sso-google-line.md). Not the retired HS256 mint path.
- [ ] **Prove Google + LINE browser sign-in** into mapped D1 memberships and save receipts/screenshots. Until then, do not claim federation in the submission email. LINE Messaging/Flex remains a separate optional follow-on. Production still needs custom Google/LINE credentials.
- [ ] Before production: client-system sandbox evidence, security/DPO approval, intended-language review, rollout/rollback acceptance and production capacity/data design. Batch approvals, workshop bookings, LINE nudges/escalation, guaranteed critical-gap coverage and a two-hour learning budget remain proposed acceptance targets unless proven above.
- [ ] Deployment or publication requires separate explicit authority. The updated hosted application and submission have not been sent. Deck export stays last.

## Implementation decisions and observed failures

- Native agents prepared bounded changes in isolated scratch copies; the parent reviewed and copied files sequentially. No app-managed branch or worktree was created.
- Preserved the static frontend/Worker boundary. Clerk React manages sign-in; the official Backend SDK verifies public-key session JWTs; D1 owns permissions. The installed SDK's `authenticateRequest` requires a secret even with a public key, so the API uses `verifyToken` plus explicit session, issuer and authorised-party checks. No privileged Clerk secret is required by this implementation.
- Additive `suite_v2_*` tables leave legacy demo data untouched. Tenant-document compare-and-swap and a D1 batch protect workflow, audit and replay writes. This sandbox design does not establish production-scale performance.
- Runtime inference stays deterministic unless `AI_FREE_ONLY_VERIFIED=1`; the Worker forces Workers AI and enables no paid-provider fallback.
- Port 8787 belonged to an unrelated service. This lab uses 8797 and the Next.js development proxy points there; the existing service was left untouched.
- Local Moodle instances stopped gracefully during verification. Restarting the existing lab restored them. A second failure was workerd rejecting `redirect: "error"`; `manual` plus explicit non-OK rejection now blocks redirects without forwarding credentials. Regression tests and the actual Worker/D1 proof passed afterward.
- Formula-cache export used Artifact Tool public APIs and independent Python checks. It preserves formulas, inputs and visible formatting; native Excel behavior remains unverified. Package metadata normalization is described in [model/README.md](../model/README.md).

## Local configuration, running services and delivery state

Only named Moodle/HR service credentials, a local integration-service credential, and public Clerk verification settings were configured in the existing ignored local stores (`.dev.vars` and `.env.local`, mode 600). Secret values are absent from source, receipts and this document. Existing unrelated credential entries were preserved. No production secrets were changed.

At verification, local services were tested against Worker 8797, Moodle A 8081, Moodle B 8082 and synthetic HR 8083. Moodle uses two isolated Docker projects with separate databases. The lab's private caches/configuration remain ignored in its isolated scratch location; source and redacted receipts are in the repository. No paid cloud resource or recurring vendor subscription was created.

17 Oct continuation: cloned `KunanonJ/iris-exercise`, fixed coach PII/assessment grounding, re-verified offline eval 55/55 and tests 74/74. Later the same day: Vercel MCP sign-in was broken (“No sign-in link”), so hosting used the **Vercel CLI** (`kunanonj`). Created Supabase project `iris-learning-suite` (`cyxbhietwlcqpdjafate`, `ap-southeast-1`), applied `suite_v2_*` schema + commit/quota RPCs, provisioned memberships, moved `/api` into Next.js route handlers, dropped static-export-only hosting, deployed to [iris-learning-suite.vercel.app](https://iris-learning-suite.vercel.app) (`/api/status` → Clerk + supabase + vercel). Local CLI linked (`npx supabase link --project-ref cyxbhietwlcqpdjafate`); migration files under `prototype/supabase/migrations/` match remote history. **Prisma 7** added against the same Postgres (`prisma/schema.prisma`, pooled `DATABASE_URL` + session `DIRECT_URL`); Next `/api` uses `suite-repository-prisma` with existing commit/quota RPCs. Scale indexes added for memberships/audit/quotas. Cloudflare Worker/D1 kept as `pnpm dev:worker` for Moodle/HR sandbox and optional Workers AI. Live AI gate and Google/LINE browser proofs remain open.

## 17 Oct evening — full brief coverage push

- Merged `cursor/google-line-live-sso` → `main` / `preview` / `production` (`d9fc31d`+). Hosted `/api/status` returns Clerk + prisma+supabase.
- Google + LINE OAuth authorize redirects proven from https://iris-learning-suite.vercel.app (receipt `prototype/sandbox/receipts/hosted-sso-2026-10-17T15-40-43.222Z.json`; screenshot `docs/screenshots/hosted-signin-google-line.png`). Mapped-membership completion after social login still needs an operator-owned account.
- Live AI re-run blocked (no Workers AI credentials); preserved FAIL `2026-10-15T14-18-58-089Z-f48e1caf`. Note: `prototype/evals/runs/2026-10-17T15-40-00-000Z-ai-blocked/`.
- Deck PDF regenerated 12×1920×1080 with hosted/SSO/AI honesty. LINE OA Messaging documented as Phase-2 (`docs/line-oa-phase2.md`).
- `SUBMISSION.md` updated with prototype link; **email not sent**.
