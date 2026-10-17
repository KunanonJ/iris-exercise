# LINE OA Messaging — Phase 2 (not Wave-1 delivered)

LINE **Login** (identity via Clerk) is separate from LINE **Official Account Messaging** (push/nudges).

## Wave-1 (demo / submission)

- LINE Login: enabled on Clerk development; hosted SignIn shows the LINE button.
- LINE OA Flex push: **not delivered**. Legacy `/api/integrations/line-push` returns 410.

## Phase-2 delivery checklist (client engagement)

1. Client LINE OA channel + Messaging API credentials (not Login channel).
2. Explicit PDPA consent for notification delivery.
3. Templates: assessment reminder, manager SLA, path nudge (Thai/English).
4. Server-side outbox with idempotency; no secrets in client bundles.
5. Proof receipt: delivery ID + redacted payload sample in sandbox before production.

Until those exist, the deck treats LINE OA as a configure/buy channel on the architecture slide — not a sandbox completion claim.
