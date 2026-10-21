# Deployment branches and environments

GitHub default branch: **`main`**.

| Git branch | GitHub Environment | Vercel Environment | When |
|---|---|---|---|
| `main` | `preview` | Preview | Push / PR — integration line |
| `preview` | `preview` | Preview | Push / PR — staging-style previews |
| `production` | `production` | Production | Push only — live site |

PRs targeting `main`, `preview`, or `production` always deploy to **Preview**.

## Current Vercel project

- Project: `iris-learning-suite`
- Root directory: `prototype`
- Git: `KunanonJ/iris-exercise` (connected)
- **Production branch: `production`**
- Production URL: https://iris.kunanonj.com (custom domain; https://iris-learning-suite.vercel.app still resolves to the same deployment)
- Env vars are set for Vercel targets `development`, `preview`, and `production` (Clerk, Supabase, Prisma `DATABASE_URL` / `DIRECT_URL`)

Native Git integration deploys on push:

- `production` → Production
- all other branches / PRs → Preview

## GitHub Actions

| Workflow | Trigger | Role |
|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Push / PR to `main`, `preview`, `production` | Typecheck, lint, tests, offline evals, Next.js build, model/PDF/secret scan |
| [`.github/workflows/vercel.yml`](../.github/workflows/vercel.yml) | Manual (`workflow_dispatch`) | Optional CLI redeploy using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |

CI does **not** deploy. Hosting CD is Vercel Git. Keep the Vercel workflow manual-only so pushes are not double-deployed.

The hosted Cloudflare Worker that served `iris.kunanonj.com` was retired on 21 Oct 2026 and the domain moved to Vercel. The Worker/D1 sandbox still runs locally (`pnpm dev:worker`); `pnpm deploy:worker` now targets `workers.dev` only and needs `APP_ORIGINS` set to that origin.

## Local branch tips

```sh
git fetch origin
git switch main
git switch preview      # tracks origin/preview
git switch production   # tracks origin/production
```

Promote by merging into the target branch (e.g. `main` → `preview` → `production`), then push.
