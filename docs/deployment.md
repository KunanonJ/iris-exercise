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
- Production URL: https://iris-learning-suite.vercel.app
- Env vars are set for Vercel targets `development`, `preview`, and `production` (Clerk, Supabase, Prisma `DATABASE_URL` / `DIRECT_URL`)

## CI deploy

`.github/workflows/vercel.yml` deploys via the Vercel CLI using repo secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Optional: native Vercel ↔ GitHub auto-deploy

CLI linking currently fails until a Vercel **Login Connection** to GitHub exists:

1. Open https://vercel.com/account/login-connections (or Vercel → Account Settings → Login Connections)
2. Connect GitHub for `KunanonJ`
3. In the project: Settings → Git → Connect `KunanonJ/iris-exercise`
4. Set **Production Branch** to `production`

After that, Vercel can deploy on push without the Actions workflow (you may disable the workflow if you prefer native git integration only).

## Local branch tips

```sh
git fetch origin
git switch main
git switch preview      # tracks origin/preview
git switch production   # tracks origin/production
```

Promote by merging into the target branch (e.g. `main` → `preview` → `production`), then push.