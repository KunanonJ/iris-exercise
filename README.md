# IRIS Learning Suite — candidate case response

**Candidate:** Kunanon Jarat · Digital & AI Solution Product Manager\
**Status:** local implementation and evidence updated on 15 October 2026; the revised application has not been deployed or submitted.

All company, employee, skill and learning data are synthetic. The 12-slide deck proposes a client rollout; it does not describe an existing production deployment.

## What the proposal delivers

Launch all five capabilities at a useful initial depth for **12,000 employees within 12 weeks**, then reach approximately **45,000 over the following year**:

1. Current-role and next-role skill assessment, reviewed by a manager.
2. Personalised paths combining lessons, workshops and work projects.
3. A Thai/English coach beside learning content, with practice and reflection.
4. Employee, manager and privacy-protected leadership views.
5. Manager approval of assessments, plans and project evidence.

Wave 1 proposes Retail & Distribution (8,500) and Packaging (3,500), covering 18 role frameworks. These are case assumptions for validation with the client. The week-12 target is **12,000 enabled accounts and at least 30% assessed**; the forum dashboard must show the assessment denominator and missing coverage. It must not imply that all 12,000 already have a measured capability baseline.

## Implementation and evidence

| Area | Implemented or verified | Remaining boundary |
|---|---|---|
| Authentication | Clerk client sign-in and backend public-key session verification; issuer, authorised party, subject, session and status checks; roles from D1 memberships; real Clerk sign-in and cross-role API/browser journeys verified locally across employee, manager and leader accounts | Hosted deployment and enterprise Google/LINE federation remain separate production gates. |
| Permissions and workflows | Server-projected self/team/aggregate views; trusted assessment scoring; revisions, idempotency and atomic audit writes; manager review and project evidence | Production security review, deployment and acceptance remain separate gates. Managers can learn on their own records; self-approval remains blocked. |
| HR | Synthetic cursor-based joiner, manager-transfer and leaver proof | No Workday, SuccessFactors or client HRIS connection is claimed. |
| LMS | Catalogue, enrolment, upstream completion, replay and outage proof against **two real local Moodle 4.5.15 instances** | Suite and Moodle sign-in are separate. Hosted connectors are unconfigured; no Google/LINE federation, xAPI, LTI or LINE delivery proof is claimed. |
| AI | Original 31 cases plus 24 held-out bilingual cases; exact-source judging and final answer provenance; failed/incomplete runs cannot certify a live release | The integrated 55/55 offline run passed. A complete 55-case live Workers AI run (`2026-10-15T14-18-58-089Z-f48e1caf`) achieved 100% valid citations and 4.92/5 Thai quality, but 93.1% groundedness (27/29; `R12`, `HO-G12`), remaining below the 95% release gate (**FAIL**). |
| Financial model | Seven worksheets; 1,207 formula caches recalculated; zero spreadsheet errors; 143 independent checks and four sensitivity scenarios passed | Pricing and operating assumptions are a frozen planning case, not measured live bills or guaranteed client returns. |

Local integration receipt: [`prototype/sandbox/receipts/2026-10-15T09-17-29.219Z.json`](prototype/sandbox/receipts/2026-10-15T09-17-29.219Z.json). Application-to-D1 acceptance is distinct from this connector proof. The integrated automated suite passed **71/71**; TypeScript, lint and the default Turbopack build also passed. Local Worker/D1 reconciliation and replay passed against both Moodle instances; [receipt](prototype/sandbox/receipts/suite-2026-10-15T09-35-39.519Z.json). Real Clerk provider API and authenticated browser journeys also passed across all three roles; receipts: [`clerk-api-2026-10-15T14-10-06.023Z.json`](prototype/sandbox/receipts/clerk-api-2026-10-15T14-10-06.023Z.json) and [`clerk-browser-2026-10-15T14-17-17.135Z.json`](prototype/sandbox/receipts/clerk-browser-2026-10-15T14-17-17.135Z.json). Commands and results are tracked in [`docs/implementation-progress.md`](docs/implementation-progress.md).

The revised client contains no personnel dataset, persona switch, local token minting or public reset route. Suite-managed learning data and API bearer tokens stay in memory; the Suite persists only language preference. Clerk manages its own authentication cookies and storage. Learning completion comes from the trusted Moodle connector or manager-approved project evidence.

## AI release status

The saved [`report-live.md`](prototype/evals/report-live.md) (83% groundedness) and the new 55-case live Workers AI run [`2026-10-15T14-18-58-089Z-f48e1caf/report.md`](prototype/evals/runs/2026-10-15T14-18-58-089Z-f48e1caf/report.md) (93.1% groundedness across 27/29 judged model answers; 94.1% original, 91.7% held-out; 100% valid citations; Thai quality 5.00 / 4.83) are preserved as failed live evidence (`releaseCertified: false`, exit code 1). Neither an offline pass nor switching the proposed production model to Claude establishes live quality.

The current harness preserves original and held-out suites, exact supplied passages, judge results, model/source fingerprints and answer provenance. Missing judges, exhausted quotas and diagnostic subsets cannot certify a release. Required gates include 100% red-team safety, at least 90% golden/hallucination pass, at least 90% citation accuracy, 100% language correctness, at least 95% groundedness and Thai quality of at least 4/5.

Live Worker inference stays disabled by default (`AI_FREE_ONLY_VERIFIED=1` required) and no paid provider has been enabled.

## Commercial proposal

| Planning measure | Amount |
|---|---:|
| Wave-1 implementation fee | THB 15.50M |
| IRIS build cost | Approximately THB 7.31M |
| Delivery staffing | 14.2 average FTE; approximately 17 individuals |
| Subscription | THB 39 per enrolled employee/month |
| Run cost | Approximately THB 62 PEPM at 12,000; THB 25 at 45,000 |
| Three-year client spend | **THB 80,342,000** |
| Three-year IRIS gross profit | **THB 30,962,919.32 (38.5389%)** |
| Estimated annual value at scale | THB 53.25M; hypothesis requiring a baseline and comparison |

The AI planning quote uses **2,800 uncached input + 1,200 cached input + 450 output tokens per coach turn**, 45% monthly active users, 12 turns/month and a 30% buffer. Model prices, discounts and production model choice require revalidation before contracting; these assumptions are not live usage or billing evidence. See [`model/README.md`](model/README.md) for recalculation, verification and limitations.

## Review the package

- [`deck/`](deck/) — 12 slide sources in their existing order. Slides 1–11 describe the proposed rollout; slide 12 distinguishes implementation from evidence.
- [`IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf`](IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf) — regenerate and inspect after integrating the updated sources; the existing PDF may predate this continuation.
- [`prototype/README.md`](prototype/README.md) — local authentication, workflow and verification guide.
- [`prototype/sandbox/README.md`](prototype/sandbox/README.md) — isolated Moodle/HR lab and proof commands.
- [`model/cost-model.xlsx`](model/cost-model.xlsx) — recalculated planning workbook; [`model/verification/`](model/verification/) contains model checks.
- [`SUBMISSION.md`](SUBMISSION.md) — **unsent email draft**, panel answers and final submission checklist.

Existing screenshots are **prior illustrative UI**, not evidence of the revised Clerk client or a new hosted release. The historical public demo is not presented as the current implementation. Keep recruitment materials confidential.

## Production decisions still required

The deck's enterprise IdP/LINE access, Thailand hosting, LLM region and contract terms, retention enforcement, workshop booking, batch approval and SLA escalation are proposed delivery capabilities. Select and verify them with client IT, HR, finance and the DPO. Any reduced-data or content-only fallback still needs explicit security/DPO approval before using employee data; pseudonymisation does not remove that gate. A current-role-only fallback also needs sponsor acceptance because it defers part of the next-role mandate.

## Tools disclosure

The prior submission draft attributes the original code, mock data, model and slide drafting to **Claude Code (reported as Claude Opus 5.5) and Cursor**, with Playwright used for earlier screenshots. Those are historical author disclosures, not independently established model/session records in this continuation. Historical live AI evaluation used **SEA-LION v4 on Cloudflare Workers AI**, with **Qwen3** judging.

**Codex** was used for this continuation's code and security review, frontend/backend changes, evaluation repair, local integration work, financial verification and documentation updates. Local Docker/Moodle and spreadsheet recalculation tools supplied additional verification. No new assistant model identifier or production approval is claimed. The candidate must review and own the final submission and disclose these tools.
