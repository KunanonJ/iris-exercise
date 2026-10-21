# IRIS case submission — draft and final checks

**Status: DRAFT, ready to send** once you confirm recipient/deadline. Hosted login verified on 20 Oct for all three test accounts. Send it yourself.

**Candidate:** Kunanon Jarat  
**Role:** Digital & AI Solution Product Manager  
**Recipient recorded in the prior draft:** Ekanat ("Barge") Boonlue, `ekanat.boonlue@iris.consulting`  
**Deadline:** verify the original recruiter email (prior draft listed 21 October 2026; not verified by the candidate PDF).

## Email draft

**To:** reply to the verified original recruitment email  
**Subject:** Case Assessment Submission: Digital & AI Solution Product Manager, Kunanon Jarat  
**Attachments:** `IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf` (12 slides) and `model/cost-model.xlsx`

> Hi Barge,
>
> Please find attached my response to the Learning Suite case: a 12-slide PDF, plus the cost model (Excel) behind the build, run and pricing numbers.
>
> In short: the date is fixed, so I flex scope and cohort, not quality. All five parts go live in a thin first version for 12,000 Retail & Distribution and Packaging staff in Thailand (18 roles), on top of the existing HR system and both LMSs. The AI coach works only from approved content and the employee's own record, and security and PDPA approval start in week 1 because they, not the code, set the critical path. I propose a THB 17.5M fixed build fee plus THB 39 per employee per month, which is THB 82M of client spend over three years at a 36% gross margin for IRIS. At full scale, the value to the client is about twice the subscription.
>
> There is also an optional working prototype with synthetic data: https://iris.kunanonj.com
>
> Sign in with Google, then choose a role: Employee, Employee + team lead, or HR / Executive. You can switch roles at any time from the top bar. If you'd rather not use Google, sign in with iris.e0001+clerk_test@example.com: choose "Use another method", then "Email code", and enter 424242 (a test code, so no inbox is needed). Each role is a shared demo profile, so you may see changes made by other reviewers.
>
> On AI quality: the offline test set passes 55/55, but a live run on a free stand-in model failed 4 of 7 release checks, so the release gate is not passed yet. Slide 6 shows the detail and the next step.
>
> AI tools used: Claude Code and Cursor for the original draft; Codex and Cursor for sign-in, security, evaluations, integrations and docs; Claude Code for coach updates, security fixes, the deck and the final cost-model revision. The live evaluation used SEA-LION v4 as the coach with a Qwen3 judge.
>
> I'd be glad to walk through any part of it, or share the source code.
>
> Best regards,  
> Kunanon Jarat

Sending remains a separate authorised action.

## Panel answers grounded in the current package

| Topic | Answer and boundary |
|---|---|
| Why this cohort? | Eighteen shared frameworks cover the proposed 12,000 RD/PK employees while testing frontline mobile constraints. Headcounts and SME capacity are case assumptions to confirm in week 1. |
| What does week 12 prove? | All 12,000 can access the five thin capabilities; target at least 30% assessed by the forum, 70% within eight weeks. Show coverage and missing records, not a complete 12,000-person measured baseline. |
| What authenticates users? | Clerk verifies issuer, authorised party, subject, session and status; `suite_v2_memberships` (Prisma/Supabase on host) supply permissions. Hosted app live; email-code login verified for employee, manager and leader on 20 Oct. Google Login shown; LINE Login enabled in Clerk but hidden on the sign-in screen for now (frontline LINE sign-in remains the production design on slide 7). Demo only (`DEMO_ROLE_PICKER=1`): an account with no role picks one of three synthetic personas; the server records it as the membership (audited, rate-limited) and still checks the role on every request. In production, roles come from the HR system and the org chart. |
| What can each role see? | Employees and managers learn on their own records. Managers review current direct reports without private coach chats; no self-approval. Leaders get aggregates with groups below 10 suppressed. |
| What integration proof exists? | Two local Moodle 4.5.15 instances: catalogue, enrol, completion, replay, partial outage. Synthetic HR: joiner, manager transfer, leaver. Suite/Moodle logins remain separate; hosted LMS/HRIS connectors unconfigured. |
| What prevents invented courses? | Path generator uses approved shortlist + ID validation. Live grounding still empirical; no prompt guarantees the model never hallucinates. |
| Has the AI passed? | Offline 55/55. Live run (SEA-LION v4 on Workers AI, 15 Oct) **failed 4 of 7 checks**: red team 18/19 (R12: ID masked, answer ungrounded), golden 31/36, language 50/55, grounded 27/29 (93.1%); citations 27/27 and Thai 4.94/5 passed. The run predates PRs #5/#6. Next run: DeepSeek V4.1 Flash (the costed model), which needs a DeepSeek API key. Keep FAIL explicit until a complete live pass. |
| What happens when AI fails? | Provenance distinguishes model, safety template, no-source, demo and provider fallback. Demo/fallback cannot certify live success. |
| Is PDPA approval complete? | No. Deck proposes controls for client/DPO validation. Not permission to launch while approval is late. |
| How much staffing? | Model assumes ~16.4 average FTE across ~18 individuals over delivery. |
| What supports the money? | Seven sheets, 1,207 formulas, 143 controls, four sensitivities. 3-year spend THB 82,342,000; IRIS GP 35.5099%. |
| What is the AI cost basis? | Frozen planning quote in the workbook — not a measured bill. |
| Wave-1 omissions (judgement) | LINE OA push, workshop seats, batch/SLA automation, client production HRIS/LMS hosting — Phase-2 / architecture only. See `docs/line-oa-phase2.md`. |

## Evidence index (17 Oct continuation)

| Item | Location |
|---|---|
| Hosted app | https://iris.kunanonj.com |
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
- [x] Hosted login works end to end with the three `+clerk_test` accounts (code 424242): employee, manager and leader views load, `/api/session` and `/api/state` return 200. Fixed on 20 Oct by pointing Vercel `CLERK_ISSUER_URL` and `CLERK_JWT_KEY` (production + preview) at the current Clerk app (`literate-magpie-5641`) and redeploying.
- [x] Production branch promoted to `main` (PR #6 security fixes live).
- [x] LINE Login hidden on the sign-in screen for the submission (still enabled in Clerk).
- [x] Slide 6 states the full live-run result (4 of 7 checks failed), not only groundedness.
- [x] Tools disclosure is in the email (the deck no longer has a next-steps/tools slide).
- [x] Export the updated deck and verify **12 pages** at 1920×1080.
- [x] Preserve labels identifying prior screenshots and production proposals.
- [x] Workbook verification evidence remains under `model/verification/`.
- [x] Hosted `/api/status` + SignIn with Google/LINE buttons verified.
- [x] Google OAuth starts from hosted app (mapped membership completion still interactive).
- [x] Live AI gate kept explicit FAIL / blocked re-run documented.
- [x] Synthetic-data notices in the deck; tools disclosure in the email draft.
- [x] Obsolete “app not deployed” / PIN claims removed; the hosted app link is on slides 1, 3 and 4.
- [ ] Obtain your authority before **sending** the email (push of this package is separate).
