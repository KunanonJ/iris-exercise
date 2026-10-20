# Deck storyline (12 slides, English)

Each slide title states the slide's conclusion. Every number traces to `model/cost-model.xlsx` or `notes/research.md`.

Format (consulting style): a section tracker on every slide (Summary · Client · Product · AI · Technology · Delivery · Commercials · Next steps), an action title of at most two lines, at most three content blocks, one "So what" takeaway bar and one source line. Technical choices stay visible in plain words with the term in brackets; implementation specifics live in the speaker notes.

1. **Exec summary.** Launch a thin, integrated skills-and-coach layer for 12,000 frontline staff in 12 weeks, then scale to 45,000 within a year.
   - The date is fixed, so scope and cohort are the variables.
   - Nothing is replaced: the HR system and both LMSs stay.
   - The AI chooses from approved content and never invents it.
   - Security and PDPA are the critical path, so they start in week 1.
   - Price: THB 15.5M fixed + THB 39 per employee per month. Client spend over 3 years: THB 80M. IRIS gross margin: 38%. Value: about THB 53M a year at scale.
2. **Client and wave 1.** Start where 18 role frameworks cover 12,000 people and results show within quarters.
   - RD Thailand 8,500 + PK Thailand 3,500, 18 roles, about 85% frontline.
   - Week-12 success criteria for the leadership forum.
   - All assumptions to confirm in week 1 in one box.
3. **Scope.** Ship all five parts thin rather than three parts deep. Now / Next / Later, plus what we leave out and why.
4. **Journeys.** Frontline staff get in from LINE in one tap; managers approve three things, in batches. Uses prototype screenshots.
5. **AI design I.** The AI picks from approved content and the employee's own record. It never invents courses, rules or scores. Covers the path engine, the coach, Thai handling and the two-layer guardrails.
6. **AI design II.** Every release passes an eval gate. At scale the coach costs about THB 6 per active user per month.
7. **Architecture.** Integrate, don't replace. HRIS, LMS A/B, SSO, LINE and the LLM, plus build / configure / buy.
8. **Data and PDPA.** A small core data model, with privacy designed in from week 1.
9. **Plan.** 12 weeks with a staged go-live from week 10. The critical path runs through security, data and frameworks. Includes the team.
10. **Risks and scale.** The top risks to the date have weekly owners. Scaling to 45,000 means producing more frameworks, not rebuilding the platform.
11. **Business.** THB 15.5M to build and about THB 25 per employee per month to run, priced at THB 39 with AI included. Value is 2.5x the subscription.
12. **Next steps.** Four decisions this week keep the forum date safe; a compact panel of what the prototype proves today (live link, offline 55/55, live gate not yet passed); the AI tools disclosure.

Key numbers (from the model, verified with zero formula errors):

**Build**
- Team cost THB 5.91M; plus third-party 0.81M and contingency 0.59M, for a total cost of THB 7.31M.
- Fee THB 15.5M; margin 52.8%.

**Run cost per enrolled employee per month**
- Month 4 (12k): about THB 62 (744k / 12k).
- Month 36 (45k): THB 24.7.

**AI cost per coach active user per month**
- Sonnet 5.5: THB 6.2.
- Opus 5.5: THB 10.9.
- Coach AI at full scale: THB 1.34M a year, 10% of run cost.

**Revenue = client spend (THB)**

| | Total | Implementation | Subscription | Waves | Gross profit |
|---|---|---|---|---|---|
| Year 1 | 29.2M | 15.5M | 7.7M | 6.0M | 11.0M (38%) |
| Year 2 | 30.1M | – | 21.1M | 9.0M | 12.2M (41%) |
| Year 3 | 21.1M | – | 21.1M | – | 7.7M (37%) |
| 3 years | 80.3M | | | | 31.0M (38.5%) |

**Client spend per employee per year:** Y1 1,082, Y2 668, Y3 468 THB. Y3 is 14% of current L&D spend per head (THB 3,300).

**Value (full scale, per year):** L&D redirect 14.85M + internal fills 14.4M + shrink 18.0M + OEE 4.0M + admin 2.0M = THB 53.25M. That is 2.53x the subscription. 3-year value is 93.2M, 1.16x spend. The shrink lever alone breaks even at a 3.5% relative reduction.
