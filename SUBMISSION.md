# Submission Package & Panel Defense Guide — IRIS Consulting Case

**Role:** Digital & AI Solution Product Manager  
**Candidate:** Kunanon Jarat  
**Contact:** Ekanat ("Barge") Boonlue (`ekanat.boonlue@iris.consulting`)  
**Deadline:** Wednesday, 21 October 2026  

---

## 1. Ready-to-Send Submission Email

**To:** `ekanat.boonlue@iris.consulting`  
**Subject:** Case Assessment Submission — Digital & AI Solution Product Manager — Kunanon Jarat  
**Attachments:**
1. `IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf` *(12-slide presentation deck)*
2. `cost-model.xlsx` *(from `model/cost-model.xlsx` — 36-month build, run, AI unit economics & pricing model)*

---

> Hi Barge,
>
> Please find attached my submission for the **Digital & AI Solution Product Manager** case assessment (*Siam Pinnacle Group — AI-Powered Learning Suite*):
>
> 1. **12-Slide Presentation Deck (PDF):** `IRIS-Learning-Suite-Launch-Plan-Kunanon-Jarat.pdf`
> 2. **Working Prototype (Live Link + Source Code):** **[https://iris.kunanonj.com](https://iris.kunanonj.com)** *(GitHub: [github.com/KunanonJ/iris-exercise](https://github.com/KunanonJ/iris-exercise))*
>    - **Role-Separated Login (1-tap evaluator access or pre-filled credentials):**
>      - **Employee (`พนักงาน`):** `E0001` / PIN `1120` (*Somchai Jaidee · Senior Store Associate · LINE OA SSO*)
>      - **Manager (`หัวหน้า`):** `E0002` / PIN `2240` (*Malee Suksan · Store Manager · Corporate SSO*)
>      - **HR & Leaders (`HR และผู้บริหาร`):** `E9001` / PIN `9001` (*Arunee Srisuk · HRBP · Microsoft Entra ID SSO*)
> 3. **Supporting 36-Month Financial & AI Cost Model (Excel):** `cost-model.xlsx` (7 tabs, 100% live formulas, zero formula errors)
>
> ### Summary of Core Calls
> - **Fixed Date, Flexed Cohort & Depth:** To hit the fixed 12-week CEO Leadership Forum deadline with real capability baseline data, **Wave 1 launches all 5 modules thin** for **12,000 employees across 18 standardized roles in Retail & Distribution (8,500) and Packaging (3,500) in Thailand** (~85% frontline mobile users), scaling to Building Materials & Corporate Services in **Wave 2 (Month 7, +15,000)** and Chemicals & the 3 ASEAN countries in **Wave 3 (Month 13, +18,000)**.
> - **Integrate, Don't Replace:** The HR system and both legacy LMSs stay in place. Frontline staff authenticate in one tap via LINE OA (SSO) or Employee ID + OTP matched to their HR record; courses launch via deep link / LTI 1.3; completions sync nightly.
> - **Constrained, Grounded AI + Thai NLP + 2-Layer Guardrails:** A deterministic rules engine shortlists approved catalogue items for each skill gap before the LLM sequences the 70-20-10 path and validates every item ID. The Thai/English AI Coach retrieves over word-segmented (`Intl.Segmenter` / `PyThaiNLP`) passages, masks PII (`Thai National ID`, `phone`, `email`) before any model call, enforces role-scoped access on the server, and gates every release against an executable evaluation harness (`pnpm eval`).
> - **Commercials & ROI:** **THB 15.5M fixed-scope Wave 1 build fee** (IRIS build cost **THB 7.31M**, 52.8% margin) + **THB 39 PEPM subscription** (AI included; run cost drops from **THB 62 PEPM** at 12k to **THB 25 PEPM** at 45k, with the AI Coach costing **~THB 6/active user/month** on Claude Sonnet 5.5). Over 3 years, total client spend is **THB 80.3M** (38.5% IRIS gross margin) against **THB 53.3M/year** in estimated steady-state value (2.53x annual subscription).
> - **AI Tools Disclosure & Mock Data Notice:** All data in the prototype and deck is 100% fictional and generated for this case. I used Claude Code (Claude Opus 5.5) and Cursor to write the prototype code, generate synthetic data, build the `openpyxl` model script, and draft the slides, and Cloudflare Workers AI (`SEA-LION v4 27B` + `Qwen3 30B`) to run the live hosted demo and live evaluation benchmark. All product, architectural, and commercial decisions are my own.
>
> Looking forward to discussing the case with you and the team.
>
> Best regards,  
> **Kunanon Jarat**

---

## 2. Executive & Technical Panel Q&A Defense Guide (Top 10 Questions)

### Q1. Why did you choose Retail & Distribution (8,500) + Packaging (3,500) for the first 12,000 employees instead of Corporate Services or Chemicals?
- **Leverage per framework:** In Retail & Distribution and Packaging, **18 standard roles cover all 12,000 people** (~670 employees per role framework). In Corporate Services, 3,000 people span 60+ specialist roles, which would bottleneck SME framework sign-off in Weeks 1–6.
- **Proves the hardest user constraint first:** 60% of the conglomerate works on the frontline on phones. Proving 1-tap LINE OA entry, a 5-minute mobile skill check, and shift-based micro-learning in stores and packaging plants de-risks the rest of the rollout.
- **Fast-moving operational KPIs:** Store shrinkage, customer complaints, and packaging line OEE move within quarters, giving the CHRO credible board metrics, whereas Chemicals requires regulated process-safety validation and the 3 ASEAN countries require local translations and country-by-country DPIAs (Wave 3).

### Q2. Why ship all 5 parts "thin" in 12 weeks instead of launching only Skill Assessment + Dashboard first and adding the AI Path and AI Coach in Phase 2?
- **The CHRO's mandate is a closed loop:** *"know which skills their role needs, where they stand, and what to do next, with a coach that helps them every day."* Launching assessment without a path or coach turns the Week-12 launch into an HR compliance exercise with zero daily learner value.
- **What "thin" means in practice:** We cut high-schedule-risk features (no native iOS/Android app, no LMS migration, no SCORM player rewrite, no 360 peer reviews, no compensation linkage) while keeping the core loop complete end to end.

### Q3. How do frontline factory and store workers log in if they don't have corporate emails or Microsoft Entra ID accounts?
- **Dual authentication pattern (Slide 7 & Live Prototype `Login.tsx`):**
  - **Office staff, Managers (`E0002`), and HR/Leaders (`E9001`):** Authenticate via Corporate IdP (`SAML 2.0 / OIDC` with MFA).
  - **Frontline staff (`E0001`):** Authenticate via **LINE Login (LIFF / OIDC)** or **Employee ID + SMS OTP**, bound once on first login against `employee_id` + date of birth/phone suffix from the nightly HR extract. Subsequent taps from a LINE Official Account nudge open their session in one tap.

### Q4. How do you guarantee the AI doesn't hallucinate non-existent courses, wrong company policies, or inappropriate HR promises?
- **Menu-constrained Path Engine (`prototype/src/lib/plan-rules.ts` & `path.ts`):** The LLM never searches or invents courses. Deterministic rules first filter the LMS A + B catalogue by `skillId`, target `level`, language, and 70-20-10 format mix. The LLM only sequences those shortlisted items and writes the bilingual rationale. A post-check verifies every returned `itemId` exists in the shortlist and every critical gap is covered; if validation fails, deterministic rules take over.
- **Strict Grounding + Two-Layer Guardrails (`prototype/src/lib/coach/guardrails.ts` & `coach.ts`):**
  1. **Server-side RBAC context:** The prompt builder only injects the authenticated employee's own record (`E0001`), never peer records.
  2. **Layer 1 (<5 ms deterministic regex + PII redaction):** Redacts Thai 13-digit National IDs, phone numbers, and emails before any model call, and catches explicit peer-data snooping, salary/bonus/promotion questions, prompt injection, stress/burnout, and self-harm crisis in Thai and English.
  3. **Layer 2 (LLM intent classifier):** Catches nuanced/paraphrased out-of-scope prompts across 7 categories (`in_scope`, `other_person_data`, `hr_decision`, `wellbeing`, `crisis`, `off_topic`, `injection`). Stricter verdict wins.
  4. **Fixed reviewed replies:** Out-of-scope categories never let the LLM improvise; they return human-reviewed Thai/English templates (e.g., routing `crisis` to Thailand's Department of Mental Health hotline **1323** and emergency **1669**).

### Q5. What makes Thai NLP uniquely challenging here, and what did you discover when testing your prototype?
- **No word boundaries + mixed code-switching:** Thai script has no spaces between words and mixes Thai with English acronyms (`SBI`, `OEE`, `LAST`, `5S`). Standard whitespace tokenizers fail completely. We use Thai word segmentation (`Intl.Segmenter("th", { granularity: "word" })` in the edge prototype; `PyThaiNLP` + `BGE-M3` dense/sparse hybrid retrieval in production).
- **Real Thai bug caught by our 31-case eval harness:** Naive substring matching for a colleague's name (`นภา` / Napha) triggered a false positive inside the common Thai phrase `แผนภายใน` ("internal plan" — `แผ` + `นภา` + `ยใน`). We fixed this in `guardrails.ts` by requiring Thai person-honorific or possessive boundaries (`คุณ|ของ|น้อง|พี่|กับ|ให้`) before short given names.
- **Model benchmark insight (`evals/report-live.md`):** Running our 31-case harness against the free `SEA-LION v4 27B` model on Cloudflare Workers AI showed **100% red-team safety** and **4.09/5 Thai naturalness**, but **83% groundedness** (hallucinating extra bullet points beyond short lesson passages). That proves our **95% groundedness release gate** catches subtle model drift and justifies **Claude Sonnet 5.5** in production.

### Q6. Where is data hosted, and how do you comply with Thailand's PDPA when calling frontier LLMs?
- **Data at rest in Thailand:** Primary PostgreSQL (`pgvector`), Redis, object storage, and audit logs run in an onshore Thailand cloud region (**AWS `ap-southeast-7` Bangkok** or **GCP `asia-southeast3` Bangkok**).
- **Cross-border LLM inference under PDPA Sections 28–29:** Frontier Claude models are not yet hosted inside Bangkok data centers; the nearest regional endpoint is **Vertex AI or AWS Bedrock in Singapore (`ap-southeast-1`)**. We comply with PDPA Section 29 via:
  1. **Pre-call PII masking** + pseudonymised identifiers (`emp_id` token only, no full name/National ID/salary sent to the model).
  2. **Enterprise zero-data-retention & no-training terms** with Standard Contractual Clauses (SCCs) documented in the **Week-3 DPIA**.
  3. **Correct lawful basis:** Contractual necessity / Legitimate Interest (with documented LIA) for core skill development records, reserving revocable Consent strictly for optional LINE OA notifications.

### Q7. Store and plant managers are already overloaded. How do you prevent manager approvals from becoming a bottleneck?
- **Only 3 high-value checkpoints (A: Assessment result, B: 12-week Learning Plan + workshop seats, C: On-the-Job Project evidence):** Managers do not approve individual videos.
- **Pre-calibrated defaults & 1-tap Batch Approval:** In Approval A, the system pre-calculates `Proposed Final = min(Self, Quiz)` so managers only adjust exceptions ($\pm 1$ level with a short note). On-track items can be approved in a single batch tap.
- **5-Working-Day SLA with auto-escalation:** Day 3 sends a LINE/digest reminder; after Day 5, overdue items auto-escalate to the BU HR Business Partner (`HRBP`) so a busy manager never blocks an employee's learning path.

### Q8. What is the true critical path in your 12-week plan, and what happens if the client's IT Security or SMEs slip by 2 weeks?
- **Code is not the critical path—three client-dependent streams are (Slide 9 & Slide 10):**
  1. **IT Security & PDPA DPIA (`W1–W9`):** We submit the security architecture pack in **Week 2** and the DPIA in **Week 3**. *Fallback if delayed:* Launch Week 10–12 with pseudonymised employee codes and restrict the AI Coach to course/SOP content only until DPO sign-off completes.
  2. **18 Role Skill Frameworks (`W1–W6`):** Seeded ~70% from IRIS's existing competency library so SMEs edit rather than write from scratch. *Fallback if delayed:* Launch assessment on current-role skills only at Week 12 and unlock next-role career paths in Month 4.
  3. **HR & LMS Data Feeds (`W1–W4`):** Nightly SFTP/CSV fallback if real-time LMS APIs aren't ready; "Wrong manager?" self-service button routing to HRBP if org hierarchy data has gaps.

### Q9. Walk us through your numbers: how did you calculate Build Cost, Run Cost, AI Cost, and Pricing?
All figures come from `model/cost-model.xlsx` (zero formula errors):
- **Build Cost (12 Weeks):** **14.2 average FTE** (Delivery Lead, Solution Architect, 4 Full-Stack Engineers, AI/ML Engineer, Data/Integration Engineer, QA, Product Designer, DevSecOps, Skills Lead + 2 Consultants, Content Analyst, Change Lead) = **THB 5.91M** internal cost + **THB 0.81M** third-party (pen-test, PDPA legal review, SMS/LINE setup) + **THB 0.59M** (10% contingency) = **THB 7.31M total cost to IRIS**.
- **Wave 1 Fixed Implementation Price:** **THB 15.50M** (rate-card effort + 10% fixed-deadline risk premium, yielding **52.8% build gross margin**), billed 30% kick-off / 30% Week-6 demo / 40% Week-12 go-live.
- **Monthly Run Cost to IRIS:**
  - At **Wave 1 (12,000 staff):** **THB 744k/month** (**THB 61.99 PEPM**).
  - At **Full Scale (45,000 staff):** **THB 1,113k/month** (**THB 24.73 PEPM**), composed of **66% Managed Service People (3.7 FTE)**, **14% Thailand Cloud**, **11% AI tokens**, and **9% LINE OA/monitoring/annual pen-test**.
- **AI Coach Token Economics (`AI Cost` tab):** Assuming 45% monthly active coach users sending 12 messages/month (~2,050 input tokens with 65% prompt caching + 380 output tokens on **Claude Sonnet 5.5**, plus **Haiku 5.5** for Layer-2 guardrails and weekly nudges, plus **Batch API** at 50% discount for path generation) + 30% safety buffer = **THB 6.2 per active user/month** (**THB 1.34M/year** across all 45,000 staff).
- **Subscription & Rollout Pricing:** **THB 39 PEPM** (all-inclusive of platform, hosting, L2 support, and AI Coach; 20,000-seat floor from Wave 2; 10% at risk on adoption KPIs) + fixed rollout fees of **THB 6.0M (Wave 2)** and **THB 9.0M (Wave 3)** $\rightarrow$ **THB 80.33M 3-year revenue** and **THB 30.96M IRIS gross profit (38.5% margin)**.

### Q10. How does the CHRO prove to the Board that this THB 80.3M 3-year investment creates real business value?
- **Steady-state subscription is THB 21.06M/year (THB 468/employee/year)**—only **14% of their current ~THB 3,300/employee L&D spend**.
- **Conservative Annual Value at Full Scale = THB 53.25M/year (2.53x annual subscription):**
  1. **Retail Shrinkage Reduction (`THB 18.00M/yr`):** Just a **3.0% relative reduction** in store shrink (e.g., from 1.20% to 1.164% of sales via inventory & POS skill mastery). Break-even on the entire subscription requires only a 3.5% relative shrink reduction.
  2. **Redirected Low-Value L&D Spend (`THB 14.85M/yr`):** Reallocating 10% of generic catalogue/classroom spend via targeted gap-based paths.
  3. **Internal Supervisor Fill Rate (`THB 14.40M/yr`):** Filling 120 more frontline supervisor roles internally instead of external hiring + faster ramp-up.
  4. **Packaging Line OEE (`THB 4.00M/yr`):** A **+0.5 percentage point** OEE gain across 2 packaging plants from SMED changeover projects.
  5. **HR & Manager Admin Time Saved (`THB 2.00M/yr`):** Replacing manual spreadsheet skill matrices and training nominations.
- **Causal Proof Design:** Because Wave 1 launches in Month 4 while Wave 2 (Month 7) and Wave 3 (Month 13) roll out in stages, later sites serve as a natural **difference-in-differences comparison group** for the Board after 2–3 quarters.
