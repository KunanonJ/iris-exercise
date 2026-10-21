# Project Instructions

Candidate case response for IRIS Consulting (Digital & AI Solution PM): a 12-slide launch plan for a
bilingual (Thai/English) corporate Learning Suite, a financial model, and a working prototype.
All employee/company data is synthetic. Treat recruitment materials as confidential.

## Layout

- `prototype/` - Next.js 16 app (UI + `/api`), the only code with a build. Run all pnpm commands here.
- `deck/` - 12 HTML slides (`deck.json` sets order); `python3 deck/export_pdf.py` regenerates the root PDF.
- `model/` - `cost-model.xlsx` plus Python verifiers; see `model/README.md` before touching numbers.
- `docs/` - deployment, SSO, progress receipts. `SUBMISSION.md` is an unsent email draft.
- `notes/` - research and storyline drafts.

## Stack (prototype)

Next.js 16.4 + React 19.3 (read `prototype/AGENTS.md`: APIs differ from older Next), TypeScript,
Tailwind v4 + shadcn/ui (`src/components/ui/`, wrappers in `src/components/kit.tsx`), Clerk auth,
Prisma 7 on Supabase Postgres (Vercel path), optional Cloudflare Worker + D1 (Moodle/HR sandbox), zod,
pnpm 10.

## Commands (from `prototype/`)

- Dev: `pnpm dev` (Next + Supabase) | `pnpm dev:worker` (Next proxied to Wrangler on 8797)
- Test: `pnpm test` (node:test via tsx; `tests/*.test.{ts,mjs}`, `src/components/__tests__/`)
- Types: `pnpm exec tsc --noEmit --incremental false` (run `pnpm exec next typegen` first on a clean tree)
- Lint: `pnpm lint` | Build: `pnpm build` | Offline AI eval: `pnpm eval --demo` (55 cases, must pass)
- Model (from repo root): `python3 model/verify_model.py model/cost-model.xlsx`

## Architecture rules

- One API, two runtimes: `src/server/suite-api.ts` (Vercel/Prisma) and `worker/index.ts` (Worker/D1)
  duplicate the same routes. A change to one usually needs the same change in the other.
- Two repository adapters share one contract: `src/lib/suite-repository-prisma.ts` and
  `src/lib/suite-repository.ts` (D1). Commit SQL lives in `supabase/migrations/` and `db/`.
- Tenant state is one JSON document per tenant with a CAS `revision`. Every write goes through
  `applyCommand`/`storeGeneratedPlan` (pure, in `src/lib/suite-domain.ts`) then `commitTenant`
  (atomic state + audit + idempotency). Never write state outside that path.
- New workflow actions: add to `SuiteCommand` (`src/lib/suite-contracts.ts`), the zod `commandSchema`,
  and `applyCommand`. Enforce role checks on the server; the client is never trusted.
- Reads go through `scopedView`: managers never see team chats; leader groups under 10 are suppressed.
- Coach pipeline (`src/lib/coach/`): guardrails -> retrieval -> classifier (live only) -> answer.
  Unsupported questions abstain deterministically. Only redacted user text is persisted.
- The client holds no personnel dataset; CI fails if employee names or secrets reach `.next/static`.

## Conventions

- Files: kebab-case in `lib/`, `secure-*.tsx` for client journeys; bilingual strings as `{ th, en }`.
- Errors: throw `HttpError(status, message)`; `errorResponse` maps them. Client copy per status lives
  in `src/components/secure-client.ts`.
- Mutations need `Idempotency-Key` and `expectedRevision`; POSTs need an allowed `Origin`.
- Commits: plain-English imperative sentence, squash-merged PRs with `(#N)`.
- Branches: `main`/`preview` deploy to Vercel Preview; `production` deploys to Production.

## Claims discipline

Docs distinguish verified evidence (receipts in `prototype/sandbox/receipts/`, eval runs in
`prototype/evals/runs/`) from proposals. The live AI gate is FAIL until a complete live run passes.
Do not upgrade a claim in README/SUBMISSION/deck without a matching receipt. CI checks relative
links in the main docs and requires the PDF to have exactly 12 pages at 1920x1080.
