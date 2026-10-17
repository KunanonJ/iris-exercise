# Live Google + LINE Login SSO (Clerk)

**Status (17 Oct 2026):** Linked to Clerk application **IRIS Learning Suite** (`app_3KpAThJJWmOUNJ445CxjVknazcT` / development `ins_3KpATcDrr7oYePzbZVpem6iy7gr`). Google + LINE Login enabled. This is real Clerk social OAuth, not the retired local HS256 “mint OIDC JWT” demo. (Previous sandbox app `app_3FR2A54…` / “Tutor Me” is no longer the linked target.)

## What is live

| Provider | Dev instance | Credentials |
|---|---|---|
| Google | Enabled + authenticatable | Clerk-shared (no custom client required in development) |
| LINE Login | Enabled + authenticatable | Clerk-shared (no custom channel required in development) |

Suite permissions still come from D1 `suite_v2_memberships` keyed by `clerk_user_id`. The IdP does not grant a role by itself.

## One-time / repeatable setup

From `prototype/` (requires `npx clerk auth login` as the app owner):

```bash
npx clerk link --app app_3KpAThJJWmOUNJ445CxjVknazcT
npm run sso:enable          # or: npm run sso:enable -- --dry-run
npm run sso:sync-env        # writes ignored .env.local + .dev.vars (mode 600)
```

Then start the suite (`npm run dev`) and open the sign-in screen. Google and LINE buttons appear on the Clerk `<SignIn />` widget.

## Mapping a Google/LINE identity to a role

Existing sandbox actors:

| Role | Employee | Existing Clerk user (email) |
|---|---|---|
| employee | E0001 | `iris.e0001+clerk_test@example.com` |
| manager | E0002 | `iris.e0002+clerk_test@example.com` |
| leader | E9001 | `iris.e9001+clerk_test@example.com` |

After someone signs in with Google or LINE, Clerk may create a **new** `user_…` id. Map it before they can load Suite data:

1. `npx clerk users list` — copy the new `id`.
2. Update ignored `.wrangler/clerk-memberships.json` (mode 600), for example:

```json
[
  { "userId": "user_…googleOrLine…", "employeeId": "E0001", "role": "employee" },
  { "userId": "user_…", "employeeId": "E0002", "role": "manager" },
  { "userId": "user_…", "employeeId": "E9001", "role": "leader" }
]
```

3. `pnpm sandbox:provision --memberships .wrangler/clerk-memberships.json`

Alternatively, in the Clerk Dashboard, link Google/LINE to an existing case-study user (same email / account linking) so the `user_…` id stays unchanged.

## Proof checklist (do not claim until done)

- [ ] Sign-in screen shows Google and LINE.
- [ ] Complete a Google sign-in; membership resolves; employee/manager/leader journey loads.
- [ ] Complete a LINE Login sign-in; membership resolves; journey loads.
- [ ] Save browser receipts/screenshots under `docs/screenshots/` (label as live SSO proof).
- [ ] Update `SUBMISSION.md` / README boundaries only after those receipts exist.

## Production (later)

Development shared credentials are **not** valid for a production Clerk instance. Before production:

1. Create a Google Cloud OAuth client; paste client ID/secret into Clerk `connection_oauth_google`.
2. Create a LINE Login channel; paste channel ID/secret into Clerk `connection_oauth_line`.
3. Set Clerk redirect / callback URLs from the Dashboard connection pages.
4. Re-run membership mapping against the production instance.

## Out of scope here

- LINE Messaging / Flex push (delivery channel, separate from Login SSO)
- Google Workspace SAML / `hd` domain restriction (can be added later)
- Fabricated local JWT minting (`/api/sso/*` remains 410)
