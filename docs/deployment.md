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
- Production URL: https://iris-learning-suite.vercel.app
- Env vars are set for Vercel targets `development`, `preview`, and `production` (Clerk, Supabase, Prisma `DATABASE_URL` / `DIRECT_URL`)

Native Git integration deploys on push:

- `production` → Production
- all other branches / PRs → Preview

## Optional CI deploy (Actions)

`.github/workflows/vercel.yml` can also deploy via CLI secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`). With Git connected, leave that workflow disabled or remove it to avoid **double deploys** on the same push.

## Local branch tips

```sh
git fetch origin
git switch main
git switch preview      # tracks origin/preview
git switch production   # tracks origin/production
```

Promote by merging into the target branch (e.g. `main` → `preview` → `production`), then push.
