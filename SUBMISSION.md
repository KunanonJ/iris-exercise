# IRIS case submission — draft and final checks

**Status: DRAFT — NOT SENT.** The updated application has not been deployed. Do not reuse the former PIN login instructions or represent the historical hosted demo as the revised implementation.

**Candidate:** Kunanon Jarat\
**Role:** Digital & AI Solution Product Manager\
**Recipient recorded in the prior draft:** Ekanat ("Barge") Boonlue, `ekanat.boonlue@iris.consulting`\
**Deadline:** verify the original recruiter email. The prior draft listed 21 October 2026; that date is not verified by the candidate PDF or this continuation.

## Email draft

**To:** reply to the verified original recruitment email\
**Subject:** Case Assessment Submission — Digital & AI Solution Product Manager — Kunanon Jarat\
**Proposed attachments:** revised 12-slide PDF and supporting `cost-model.xlsx`

> Hi Barge,
>
> Please find attached my Learning Suite case response: a 12-slide PDF covering the launch recommendation, five product capabilities, AI and integration design, delivery, privacy controls and commercial model. The accompanying seven-sheet workbook supports the build, run and pricing assumptions.
>
> I propose a staged launch for 12,000 employees across 18 roles in Retail & Distribution and Packaging within 12 weeks, followed by expansion to approximately 45,000 over the next year. The forum target distinguishes enabled access from measured assessment coverage.
>
> The supporting implementation includes Clerk session verification, server-enforced learning workflows across employee/manager/leader roles, and a local integration proof against two Moodle 4.5.15 instances plus a synthetic HR lifecycle feed. Real Clerk sign-in and cross-role API/browser journeys were verified locally against the development instance; these are sandbox proofs, not client production integrations. Offline AI regression passed 55/55 (including post-fix checks for PII refusal and assessment grounding). The last complete 55-case live Workers AI evaluation (`2026-10-15T14-18-58-089Z-f48e1caf`) achieved 93.1% groundedness (27/29) and 100% valid citations—remaining below the 95% release gate until a new live run. No updated hosted demo is claimed in this submission draft.
>
> The financial model has recalculated formula caches and independent checks. Its THB 80.342M three-year spend and 38.5389% IRIS gross margin are planning outputs, subject to validation of the underlying commercial assumptions.
>
> All business and employee data are synthetic. The original draft attributes assistance to Claude Code and Cursor; Codex and Cursor supported the subsequent implementation, security and verification work. Live AI benchmarking used Cloudflare Workers AI (SEA-LION v4) and a Qwen3 judge. The deck discloses the tools and distinguishes proposed production capabilities from demonstrated sandbox behavior.
>
> Best regards,
> Kunanon Jarat

Update this draft only after the final evidence changes. Add a prototype link and access instructions only when that exact release and its real sign-in journey have been verified. Sending remains a separate authorised action.

## Panel answers grounded in the current package

| Topic | Answer and boundary |
|---|---|
| Why this cohort? | Eighteen shared frameworks cover the proposed 12,000 RD/PK employees while testing frontline mobile constraints. Headcounts and SME capacity are case assumptions to confirm in week 1. |
| What does week 12 prove? | All 12,000 can access the five thin capabilities; target at least 30% assessed by the forum, 70% within eight weeks. Show coverage and missing records, not a complete 12,000-person measured baseline. |
| What authenticates users? | Clerk integration verifies issuer, authorised party, subject, session and status; D1 memberships supply permissions. Real Clerk development sign-in and cross-role API/browser journeys are verified locally across employee, manager and leader accounts. **Google + LINE Login are enabled** on the Clerk development instance; browser proof into mapped memberships is still required before claiming live federation in the email. |
| What can each role see? | Employees and managers can learn on their own records. Managers review current direct reports, without their private coach conversations; they cannot approve themselves. Leaders receive aggregates with groups below 10 suppressed. |
| What integration proof exists? | Two separate local Moodle instances: catalogue, enrolment, upstream completion, replay and partial outage. Synthetic HR: cursor-based joiner, manager transfer and leaver. Suite/Moodle logins remain separate; hosted connections are unconfigured. |
| What prevents invented courses? | The path generator selects from an approved shortlist and validates item IDs. Grounding and safety still require empirical evaluation; no prompt can guarantee the live model never hallucinates. |
| Has the AI passed? | The integrated offline 55-case run passed (55/55). The complete 55-case live Workers AI run (`2026-10-15T14-18-58-089Z-f48e1caf`) achieved 100% valid citations (27/27) and Thai quality 4.92/5, but 93.1% groundedness (27/29; `R12` and `HO-G12` failed), so the release gate remains **FAIL** (`releaseCertified: false`). No Claude or free-model production pass is established. |
| What happens when AI fails? | Final response metadata distinguishes model, safety template, no-source, demo and provider fallback. Missing judges/quota interruption mean incomplete evaluation; demo/fallback replies cannot certify live-model success. |
| Is PDPA approval complete? | No. The deck proposes privacy, retention, hosting and transfer controls for client/DPO validation. Pseudonymised or content-only fallback requires explicit security/DPO sign-off. It is not permission to launch while approval is late. |
| How much staffing? | The model assumes 14.2 average FTE across approximately 17 individuals over the delivery period; average capacity and headcount are different measures. |
| What supports the money? | Seven sheets, 1,207 cached formulas, no errors, 143 independent checks and four sensitivity scenarios. Three-year spend THB 80,342,000; IRIS GP THB 30,962,919.32, or 38.5389%. Value estimates require a client baseline and comparison design. |
| What is the AI cost basis? | Frozen planning quote: 2,800 uncached input + 1,200 cached input + 450 output tokens/turn, with adoption and buffer assumptions. It is not a measured provider bill. Model choice and prices must be revalidated before purchase. |
| Which proposed features are absent locally? | Google/LINE Login enabled but browser proof pending; LINE delivery, xAPI/LTI, workshop seat reservation, batch approval, automated SLA escalation and production retention jobs have no completion claim yet. |

## Before submission

- [ ] Confirm recipient, deadline and attachment rules from the original email.
- [ ] Export the updated deck and verify **12 pages maximum**, readable layouts and consistent figures.
- [ ] Preserve labels identifying prior screenshots and production proposals.
- [ ] Verify the recalculated workbook and include its verification evidence if useful.
- [ ] Record final integrated tests, build and local Worker/D1 acceptance results.
- [ ] Complete real Clerk authentication proof before supplying access instructions.
- [ ] Either pass the complete live AI gate or keep the failed/incomplete status explicit.
- [ ] Review tools disclosure and synthetic-data/confidentiality notices.
- [ ] Remove any unverified hosted-version claims and obsolete PIN instructions.
- [ ] Obtain the user's separate authority before committing, pushing, deploying or sending.
