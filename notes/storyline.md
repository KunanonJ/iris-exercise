# Deck storyline (12 slides, English)

Each slide title states the slide's conclusion. Every number traces to `model/cost-model.xlsx` or `notes/research.md`.

Format (clean, minimal consulting style): a section label naming the brief question on every slide (Summary · Product · Technology · Delivery · Business), an action title of at most two lines, at most three content blocks, one "So what" takeaway bar and one source line. Technical choices stay visible in plain words with the term in brackets; implementation specifics live in the speaker notes.

1. **Exec summary.** Launch a thin, integrated skills-and-coach layer for 12,000 frontline staff in 12 weeks, then scale to 45,000 within a year.
   - The date is fixed, so scope and cohort are the variables.
   - Nothing is replaced: the HR system and both LMSs stay.
   - The AI chooses from approved content and never invents it.
   - Security and PDPA are the critical path, so they start in week 1.
   - Price: THB 17.5M fixed + THB 39 per employee per month. Client spend over 3 years: THB 82M. IRIS gross margin: 34%. Value: about THB 45M a year at scale.
2. **Client and wave 1.** Start where 18 role frameworks cover 12,000 people and results show within quarters.
   - RD Thailand 8,500 + PK Thailand 3,500, 18 roles, about 85% frontline.
   - Week-12 success criteria for the leadership forum.
   - All assumptions to confirm in week 1 in one box.
3. **Scope.** Ship all five parts thin rather than three parts deep. Now / Next / Later, plus what we leave out and why.
4. **Journeys.** Frontline staff get in from LINE in one tap; managers approve three things, in batches. Uses prototype screenshots.
5. **AI design I.** The AI picks from approved content and the employee's own record. It never invents courses, rules or scores. Covers the path engine, the coach, Thai handling and the two-layer guardrails.
6. **AI design II.** Every release passes an eval gate. On DeepSeek V4.1 Flash the coach costs about THB 0.9 per active user per month; compared with Claude on cost and speed.
7. **Architecture.** Integrate, don't replace. HRIS, LMS A/B, SSO, LINE and the LLM, plus build / configure / buy.
8. **Data and PDPA.** A small core data model, with privacy designed in from week 1.
9. **Plan.** 12 weeks with a staged go-live from week 10. The critical path runs through security, data and frameworks. Includes the team.
10. **Risks.** Four high risks to the date, each with an owner, a decision week and a pre-agreed fallback.
11. **Scale.** The career flywheel: the coach works until people reach their next role; promotion stories (opt-in) pull the next wave in. Run cost falls from THB 76 to THB 27 per employee.
12. **Business.** THB 17.5M to build and about THB 27 per employee per month to run at scale, priced at THB 39 with AI included. Value is about 2x the subscription; payback early in year 4.

Key numbers (from the model, verified with zero formula errors):

**Build**
- Team cost THB 6.73M (16.4 FTE); plus third-party 0.81M, contingency (15%) 1.01M and team software (Claude Max, GitHub, Jira, Figma) 0.32M, for a total cost of THB 8.86M.
- Fee THB 17.5M; margin 49.3%.

**Run cost per enrolled employee per month**
- Month 4 (12k): about THB 76 (910k / 12k).
- Month 36 (45k): THB 27.0.

**AI cost per coach active user per month**
- DeepSeek V4.1 Flash (costed, peak): THB 0.87 coach + classifier; THB 1.35 all AI.
- Claude Sonnet 5.5 (scenario): THB 5.6 coach + classifier.
- Coach AI at full scale: THB 0.21M a year, 1.4% of run cost; all AI 2.3%.

**Revenue = client spend (THB)**

| | Total | Implementation | Subscription | Waves | Gross profit |
|---|---|---|---|---|---|
| Year 1 | 31.2M | 17.5M | 7.7M | 6.0M | 10.2M (33%) |
| Year 2 | 30.1M | – | 21.1M | 9.0M | 11.0M (37%) |
| Year 3 | 21.1M | – | 21.1M | – | 6.5M (31%) |
| 3 years | 82.3M | | | | 27.6M (33.6%) |

**Client spend per employee per year:** Y1 1,156, Y2 668, Y3 468 THB. Y3 is 14% of current L&D spend per head (THB 3,300).

**Value (full scale, per year):** L&D redirect 14.85M + internal fills 6.0M (5-point uplift) + shrink 18.0M + OEE 4.0M + admin 2.0M = THB 44.85M. That is 2.13x the subscription. 3-year value is 78.5M, 0.95x spend; payback early in year 4. The shrink lever alone breaks even at a 3.5% relative reduction.
