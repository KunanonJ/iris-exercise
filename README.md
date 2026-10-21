# IRIS Learning Suite — candidate case response

**Candidate:** Kunanon Jarat · Digital & AI Solution Product Manager\
**Status (21 October 2026):** the deck, cost model and prototype are ready for submission. The prototype is hosted at https://iris-learning-suite.vercel.app. The submission email in [`SUBMISSION.md`](SUBMISSION.md) has not been sent.

All company, employee, skill and learning data are synthetic. The 12-slide deck proposes a client rollout; it does not describe an existing production deployment. Keep recruitment materials confidential.

## What the proposal delivers

Launch all five capabilities at a useful initial depth for **12,000 employees within 12 weeks**, then reach approximately **45,000 over the following year**:

1. Current-role and next-role skill assessment, reviewed by a manager.
2. Personalised paths combining lessons, workshops and work projects.
3. A Thai/English coach beside learning content, with practice and reflection.
4. Employee, manager and privacy-protected leadership views.
5. Manager approval of assessments, plans and project evidence.

Wave 1 proposes Retail & Distribution (8,500) and Packaging (3,500), covering 18 role frameworks. These are case assumptions for validation with the client. The week-12 target is **12,000 enabled accounts and at least 30% assessed**; the forum dashboard must show the assessment denominator and missing coverage. It must not imply that all 12,000 already have a measured capability baseline.

## Where the deck answers the brief

| Brief area | Slides |
|---|---|
| Product: what goes live and what waits, employee and manager journeys with approvals | 2–4 |
| AI coach: what it knows, where answers come from, Thai, safety, testing and running cost | 5–6 |
| Technology: architecture, HR/LMS/SSO integration, data model, PDPA and security, build/configure/buy | 7–8 |
| Delivery: 12-week plan and critical path, team, risks to the date, scaling to 45,000 | 9–10 |
| Business: build and run cost, pricing, value to the client | 11 |
| Next steps, prototype evidence and tools used | 12 |

## Try the prototype

The hosted app runs Next.js on Vercel with Clerk sign-in and Prisma on Supabase Postgres. Sign-in steps and the test accounts are in the cover email draft ([`SUBMISSION.md`](SUBMISSION.md)). After signing in, a reviewer picks a demo role (Employee, Employee + team lead, or HR / Executive) and can switch roles from the top bar.

It shows the skill check (including monthly lesson time and certificates held), manager review of results, plans and project evidence, the AI-built path with a reason for each step, the coach beside each lesson with "Was this helpful?" ratings, and the leader view with privacy-protected aggregates and an AI coach quality card. To run it locally, see [`prototype/README.md`](prototype/README.md).

## Implementation and evidence

| Area | Implemented or verified | Remaining boundary |
|---|---|---|
| Authentication | Clerk sign-in with backend session verification (issuer, authorised party, subject, session and status). Permissions come from `suite_v2_memberships` (Prisma/Supabase on Vercel; D1 in the Worker sandbox). Hosted email-code sign-in was checked manually for employee, manager and leader on 20 October (recorded in [`SUBMISSION.md`](SUBMISSION.md)); Google sign-in starts from the hosted app ([receipt](prototype/sandbox/receipts/hosted-sso-2026-10-17T15-40-43.222Z.json)). LINE Login is enabled in Clerk but hidden on the sign-in screen. | Completing Google or LINE sign-in into a mapped membership still needs browser proof before claiming federation. Production needs the client's identity provider and custom OAuth clients. See [`docs/sso-google-line.md`](docs/sso-google-line.md). |
| Demo access | Demo only (`DEMO_ROLE_PICKER=1`): an account with no membership picks one of three synthetic roles; the server records it as the membership (audited, rate-limited) and still checks the role on every request. | In production, roles come from the HR system and the org chart. |
| Permissions and workflows | Server-projected self/team/aggregate views; trusted assessment scoring; revisions, idempotency and atomic audit writes; manager review and project evidence. | Production security review and acceptance remain separate gates. Managers can learn on their own records; self-approval remains blocked. |
| HR | Synthetic cursor-based joiner, manager-transfer and leaver proof. | No Workday, SuccessFactors or client HRIS connection is claimed. |
| LMS | Catalogue, enrolment, upstream completion, replay and outage proof against **two real local Moodle 4.5.15 instances**. | Suite and Moodle sign-in are separate. Hosted connectors are unconfigured; no xAPI, LTI or LINE delivery proof is claimed. |
| AI | 31 original plus 24 held-out bilingual cases; exact-source judging and answer provenance; failed or incomplete runs cannot certify a live release. The 55-case offline evaluation passes in CI on every PR ([latest saved run](prototype/evals/runs/2026-10-17T03-23-33-591Z-adebc68e/)). | The preserved live run `2026-10-15T14-18-58-089Z-f48e1caf` remains **FAIL** (4 of 7 checks). The next live run uses the costed model, Claude Sonnet 5.5, and needs an Anthropic API key. |
| Financial model | Seven worksheets; 1,207 formulas recalculated; zero spreadsheet errors; 143 independent checks and four sensitivity scenarios pass. Revised on 21 October for realistic staffing, contingency, run team and value assumptions. | Pricing and operating assumptions are a planning case, not measured live bills or guaranteed client returns. |

CI on `main` runs typecheck, lint, the unit/auth/workflow/integration tests, the 55-case offline evaluation, the Next.js build and a client-bundle scan for personnel names and secrets, plus the model verifier, the 12-page PDF check, documentation links and a credential scan.

On 15 October the integrated automated suite passed 71/71, and local Worker/D1 reconciliation and replay passed against both Moodle instances. Receipts: [Moodle/HR connectors](prototype/sandbox/receipts/2026-10-15T09-17-29.219Z.json), [suite reconciliation](prototype/sandbox/receipts/suite-2026-10-15T09-35-39.519Z.json), [Clerk API](prototype/sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json) and [Clerk browser journeys](prototype/sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json). Commands and results are tracked in [`docs/implementation-progress.md`](docs/implementation-progress.md).

The client holds no personnel dataset, local token minting or public reset route. Suite-managed learning data and API bearer tokens stay in memory; the Suite persists only language preference. Clerk manages its own authentication cookies and storage. Learning completion comes from the trusted Moodle connector or manager-approved project evidence.

## AI release status

The saved [`report-live.md`](prototype/evals/report-live.md) (83% groundedness) and the 55-case live Workers AI run [`2026-10-15T14-18-58-089Z-f48e1caf/report.md`](prototype/evals/runs/2026-10-15T14-18-58-089Z-f48e1caf/report.md) are preserved as failed live evidence (`releaseCertified: false`). That run failed 4 of 7 checks: red team 18/19, golden 31/36, language 50/55 and groundedness 93.1% (27/29); citations 27/27 and Thai quality 4.94/5 passed. Neither an offline pass nor switching the proposed production model to Claude establishes live quality.

The harness preserves original and held-out suites, exact supplied passages, judge results, model/source fingerprints and answer provenance. Missing judges, exhausted quotas and diagnostic subsets cannot certify a release. Required gates: 100% red-team safety, at least 90% golden/hallucination pass, at least 90% citation accuracy, 100% language correctness, at least 95% groundedness and Thai quality of at least 4/5.

On Vercel the coach gives deterministic demo answers unless `AI_FREE_ONLY_VERIFIED=1` and a non-Workers provider are configured; the Worker also requires `AI_FREE_ONLY_VERIFIED=1` before live inference. No paid provider has been enabled.

## Commercial proposal

| Planning measure | Amount |
|---|---:|
| Wave-1 implementation fee (fixed, incl. 10% fixed-date premium) | THB 17.50M |
| IRIS build cost (team, third-party, 15% contingency) | Approximately THB 8.55M |
| Delivery staffing | 16.4 average FTE; approximately 18 individuals |
| Subscription | THB 39 per enrolled employee/month |
| Run cost | Approximately THB 75 PEPM at 12,000; THB 28 at 45,000 |
| Three-year client spend | **THB 82,342,000** |
| Three-year IRIS gross profit | **THB 26,447,633.61 (32.1193%)** |
| Estimated annual value at scale | THB 44.85M (2.1x the subscription); hypothesis requiring a baseline and comparison |
| Three-year value vs spend | THB 78.5M vs THB 82.3M; payback early in year 4 |

Prices exclude VAT. The 21 October revision made the plan realistic: a second integration engineer and more QA and DevSecOps in the build, 15% contingency for a fixed-fee, fixed-date job, a dedicated platform run team (this is the platform's first client), and a 5-point rather than 12-point yearly uplift in internal fills.

The AI planning quote uses **2,800 uncached input + 1,200 cached input + 450 output tokens per coach turn**, 45% monthly active users, 12 turns/month and a 30% buffer. Model prices, discounts and production model choice require revalidation before contracting; these assumptions are not live usage or billing evidence. See [`model/README.md`](model/README.md) for recalculation, verification and limitations.

## Review the package

- [`IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf`](IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf) — the 12-slide PDF (text-based, 1920×1080 pt pages).
- [`deck/`](deck/) — 12 slide sources in a clean, minimal consulting format: a section label, an action title, a "So what" line and a source line on every slide. `python3 deck/export_pdf.py` rebuilds the PDF and stops on any overflow.
- [`model/`](model/) — [`cost-model.xlsx`](model/cost-model.xlsx), its generator and verifiers; [`model/verification/`](model/verification/) holds the latest check and sensitivity reports.
- [`prototype/`](prototype/) — the Next.js app; [`prototype/README.md`](prototype/README.md) covers setup, authentication and verification, and [`prototype/sandbox/README.md`](prototype/sandbox/README.md) the isolated Moodle/HR lab.
- [`docs/`](docs/) — deployment, SSO and the implementation progress log.
- [`SUBMISSION.md`](SUBMISSION.md) — **unsent email draft**, panel answers and the submission checklist.

[`docs/screenshots/`](docs/screenshots/) holds earlier illustrative UI. Slide 4 labels its phone screens as an earlier prototype version; slide 12 uses screens from the hosted app.

## Production decisions still required

The deck's enterprise IdP/LINE access, Thailand hosting, LLM region and contract terms, retention enforcement, workshop booking, batch approval and SLA escalation are proposed delivery capabilities. Select and verify them with client IT, HR, finance and the DPO. Any reduced-data or content-only fallback still needs explicit security/DPO approval before using employee data; pseudonymisation does not remove that gate. A current-role-only fallback also needs sponsor acceptance because it defers part of the next-role mandate.

## Tools disclosure

- **Original draft** (code, mock data, model and slide drafts): Claude Code and Cursor; Playwright for earlier screenshots.
- **Continuation:** Codex and Cursor for sign-in, security, evaluations, integrations and docs; Claude Code for coach updates, security fixes, the deck and the 21 October cost-model revision.
- **Live AI evaluation:** SEA-LION v4 on Cloudflare Workers AI as the coach, with Qwen3 as the judge.

Local Docker/Moodle and spreadsheet recalculation tools supplied additional verification. The candidate reviews and owns the final submission.
