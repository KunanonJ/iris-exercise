# IRIS case submission — draft and final checks

**Status: DRAFT — READY TO SEND after you confirm recipient/deadline and authorise sending.** Do not reuse PIN login instructions. Hosted prototype is live.

**Candidate:** Kunanon Jarat  
**Role:** Digital & AI Solution Product Manager  
**Recipient recorded in the prior draft:** Ekanat ("Barge") Boonlue, `ekanat.boonlue@iris.consulting`  
**Deadline:** verify the original recruiter email (prior draft listed 21 October 2026; not verified by the candidate PDF).

## Email draft

**To:** reply to the verified original recruitment email  
**Subject:** Case Assessment Submission — Digital & AI Solution Product Manager — Kunanon Jarat  
**Attachments:** `IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf` (12 slides) and `model/cost-model.xlsx`  
**Optional prototype:** https://iris-learning-suite.vercel.app — Clerk development SignIn with Google / LINE / case-study email. Access still requires mapped `suite_v2_memberships` (not IdP alone).

> Hi Barge,
>
> Please find attached my Learning Suite case response: a 12-slide PDF covering the launch recommendation, five product capabilities, AI and integration design, delivery, privacy controls and commercial model. The accompanying seven-sheet workbook supports the build, run and pricing assumptions.
>
> I propose a staged launch for 12,000 employees across 18 roles in Retail & Distribution and Packaging within 12 weeks, followed by expansion to approximately 45,000 over the next year. The forum target distinguishes enabled access from measured assessment coverage.
>
> Optional working prototype (sandbox): https://iris-learning-suite.vercel.app — Next.js on Vercel with Clerk authentication and Prisma/Supabase for suite state. Google and LINE Login are enabled on the Clerk development instance; hosted SignIn shows both buttons and Google OAuth starts from that page. Completing Google/LINE into a mapped membership still needs an operator-owned account before claiming full federation. Email-code Clerk journeys and cross-role API/browser proofs were verified earlier against the development instance. Local Moodle×2 + synthetic HR proofs remain sandbox-only (not hosted client connectors).
>
> Offline AI regression passed 55/55. The last complete 55-case live Workers AI evaluation (`2026-10-15T14-18-58-089Z-f48e1caf`) achieved 93.1% groundedness (27/29) and remains **below the 95% release gate** (FAIL). A 17 Oct re-run was blocked here (no Workers AI credentials in the local free-tier path). Demo mode cannot certify a live model.
>
> Wave-1 deliberately leaves LINE Official Account push, workshop seat inventory, batch approval/SLA bots, and client production HRIS/LMS hosting as Phase-2 / configure items — Login SSO is not Messaging.
>
> The financial model has recalculated formula caches and independent checks. Its THB 80.342M three-year spend and 38.5389% IRIS gross margin are planning outputs, subject to validation of the underlying commercial assumptions.
>
> All business and employee data are synthetic. Tools: Claude Code/Cursor (original draft); Cursor for auth, Vercel/Prisma hosting, security, evals, integrations, model checks and docs. Live AI benchmarking used Cloudflare Workers AI (SEA-LION v4) and a Qwen3 judge. The deck distinguishes proposed production capabilities from demonstrated sandbox behaviour.
>
> Best regards,  
> Kunanon Jarat

Sending remains a separate authorised action.

## Panel answers grounded in the current package

| Topic | Answer and boundary |
|---|---|
| Why this cohort? | Eighteen shared frameworks cover the proposed 12,000 RD/PK employees while testing frontline mobile constraints. Headcounts and SME capacity are case assumptions to confirm in week 1. |
| What does week 12 prove? | All 12,000 can access the five thin capabilities; target at least 30% assessed by the forum, 70% within eight weeks. Show coverage and missing records, not a complete 12,000-person measured baseline. |
| What authenticates users? | Clerk verifies issuer, authorised party, subject, session and status; `suite_v2_memberships` (Prisma/Supabase on host) supply permissions. Hosted app live. Google + LINE Login **enabled**; Google OAuth redirect proven from host; mapped Google/LINE membership completion still operator-interactive. |
| What can each role see? | Employees and managers learn on their own records. Managers review current direct reports without private coach chats; no self-approval. Leaders get aggregates with groups below 10 suppressed. |
| What integration proof exists? | Two local Moodle 4.5.15 instances: catalogue, enrol, completion, replay, partial outage. Synthetic HR: joiner, manager transfer, leaver. Suite/Moodle logins remain separate; hosted LMS/HRIS connectors unconfigured. |
| What prevents invented courses? | Path generator uses approved shortlist + ID validation. Live grounding still empirical; no prompt guarantees the model never hallucinates. |
| Has the AI passed? | Offline 55/55. Live Workers AI 93.1% groundedness → **FAIL**. 17 Oct re-run blocked (missing Workers AI credentials). Keep FAIL explicit until a new complete live pass. |
| What happens when AI fails? | Provenance distinguishes model, safety template, no-source, demo and provider fallback. Demo/fallback cannot certify live success. |
| Is PDPA approval complete? | No. Deck proposes controls for client/DPO validation. Not permission to launch while approval is late. |
| How much staffing? | Model assumes ~14.2 average FTE across ~17 individuals over delivery. |
| What supports the money? | Seven sheets, 1,207 formulas, 143 controls, four sensitivities. 3-year spend THB 80,342,000; IRIS GP 38.5389%. |
| What is the AI cost basis? | Frozen planning quote in the workbook — not a measured bill. |
| Wave-1 omissions (judgement) | LINE OA push, workshop seats, batch/SLA automation, client production HRIS/LMS hosting — Phase-2 / architecture only. See `docs/line-oa-phase2.md`. |

## Evidence index (17 Oct continuation)

| Item | Location |
|---|---|
| Hosted app | https://iris-learning-suite.vercel.app |
| `/api/status` | `prisma+supabase` + Clerk + vercel |
| Hosted SignIn screenshot | `docs/screenshots/hosted-signin-google-line.png` |
| Google OAuth redirect receipt | `prototype/sandbox/receipts/hosted-sso-2026-10-17T15-40-43.222Z.json` |
| AI blocked re-run note | `prototype/evals/runs/2026-10-17T15-40-00-000Z-ai-blocked/report.md` |
| Preserved live AI FAIL | `prototype/evals/runs/2026-10-15T14-18-58-089Z-f48e1caf/` |
| Offline AI PASS | `prototype/evals/runs/2026-10-17T03-23-33-591Z-adebc68e/` |
| LINE OA Phase-2 | `docs/line-oa-phase2.md` |
| Deploy branches | `docs/deployment.md` |

## Before submission

- [ ] Confirm recipient, deadline and attachment rules from the original email.
- [x] Export the updated deck and verify **12 pages** at 1920×1080.
- [x] Preserve labels identifying prior screenshots and production proposals.
- [x] Workbook verification evidence remains under `model/verification/`.
- [x] Hosted `/api/status` + SignIn with Google/LINE buttons verified.
- [x] Google OAuth starts from hosted app (mapped membership completion still interactive).
- [x] Live AI gate kept explicit FAIL / blocked re-run documented.
- [x] Tools disclosure and synthetic-data notices in deck/email draft.
- [x] Obsolete “app not deployed” / PIN claims removed from deck prototype slide.
- [ ] Obtain your authority before **sending** the email (push of this package is separate).
