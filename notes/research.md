# Verified facts for the deck (research run 2026-10-14)

Confidence: H = primary source checked, M = reputable secondary, L = single/vendor estimate.

## PDPA
- Cross-border (s.28/29): no PDPC adequacy list yet. Transfers rely on s.29 safeguards: ASEAN Model Contractual Clauses / EU SCCs / PDPC-prescribed contract terms, or BCRs. The notifications took effect 24 Mar 2024. BCR certification regulation published Feb 2026 (H, Tilleke, Baker McKenzie).
- LLM inference is processing, so the cloud "transit" carve-out does not apply. Treat each offshore LLM call as a transfer (M).
- Lawful basis: contract or legal obligation for core learning records; legitimate interest with a documented assessment for AI personalisation; consent only for optional features (weak in employment) (M).
- DPIA: PDPC guidance points to one when new technology is used on large data volumes. Draft PDPC AI guidelines (Feb 2026) expect a design-stage DPIA for high-risk AI and treat prompts and logs as personal data. Final guidelines reportedly issued 12 Oct 2026, non-binding (M, single source).
- Enforcement: first fine THB 7M (Aug 2024); 8 fines across 5 cases in Aug 2025, including a processor fined THB 3M for failing to notify its controller (H).
- Sensitive data (health, union, biometrics) needs explicit consent. Avoid it.

## Cloud / LLM region
- AWS Thailand (ap-southeast-7) is GA and has Bedrock. Current Claude models are reachable only via Global cross-Region inference (data at rest stays in TH, inference can run anywhere) (H, AWS docs).
- GCP Bangkok (asia-southeast3) launched 21 Jan 2026, but Vertex AI is not available there. Vertex AI Singapore (asia-southeast1) offers in-region Claude Opus 5.5 and Sonnet 5.5, not Haiku 5.5 (H, Vertex data residency page).
- Azure Thailand South: not GA.
- => Recommendation: data at rest in a Thailand region; LLM inference on Vertex AI Singapore (in-region), pseudonymised prompts, s.29 contract safeguards. Decide with IT security in week 1.
- Partner (Bedrock/Vertex) pricing is separate from Anthropic list prices. The cost model uses list prices as a proxy.

## Claude list prices (Anthropic, cached 2026-10-06), per 1M tokens
- Opus 5.5: $4 in / $20 out (cache read $0.20)
- Sonnet 5.5: $2 / $10 (cache read $0.20)
- Haiku 5.5: $0.10 / $0.50 (prompts up to 100K tokens)
- Batch API: 50% off (use it for overnight path generation)

## Thai NLP
- Thai LLM options: Typhoon 2.5 (SCB 10X, Apache-2.0, Qwen3-based) and ThaiLLM (national programme, launched Apr 2026). Both are candidates for on-shore, low-risk tasks later.
- Embeddings: BGE-M3 (MIT, self-hostable, so embeddings can run on-shore), Cohere Embed v4 (Bedrock).
- Segmentation: PyThaiNLP 5.4 (newmm). The prototype uses Intl.Segmenter (ICU) for Thai word breaks.
- ASR for video transcripts: Typhoon Whisper Large v3 (MIT), AWS Transcribe (Thai batch and streaming), Azure Speech.
- No verified current Thai ranking of frontier models, so build an in-house Thai eval set (this is a deck point).

## LINE
- 56M users in Thailand (company-disclosed, Aug 2026).
- OA packages excl. VAT: Free 300 msgs; Basic 1,280 THB/mo for 15k msgs (+0.10); Pro 1,780 THB/mo for 35k msgs (+0.06). Push messages count per recipient; replies are free.

## LMS integration
- SCORM 1.2/2004 (catalogue packages), xAPI 2.0 = IEEE 9274.1.1-2023 (statements into an LRS), cmi5, LTI 1.3 (OIDC launch, deep linking, grade passback).
- Cornerstone REST (transcript and catalogue APIs); SuccessFactors OData v4 (catalogue delta feed, recordLearningEvents); Moodle REST/LTI.

## Commercial benchmarks
- PDMO public-sector consultant reference (FY2026, with the 2.64 firm multiplier): developer 3 yrs about 3,700 THB/day; developer 5 yrs about 4,960; senior consultant 10 yrs about 8,410; principal/PM 15 yrs about 12,120. Private firms charge more.
- No public per-employee price for LXP/skills platforms. Eightfold is estimated at $3-10 PEPM (L). Cornerstone learning-only is estimated at mid-single-digit $ per user per month (L).
- L&D spend: ATD 2025 reports $1,254 per employee (global). Thai listed companies disclose about 3,000-4,000 THB per employee (Osotspa 3,311; Supalai 3,024; TTW 4,038).
- Skill Development Promotion Act: employers with 100+ staff must train at least 50% of staff each year or pay into the fund. The platform can track this (compliance value).
