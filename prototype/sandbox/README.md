# Local integration sandbox

This lab proves REST catalogue import, learner enrolment and upstream completion against **two real Moodle 4.5.15 instances**. It also supplies a **synthetic HR service** with persistent cursor-based joiner, manager-transfer and leaver events. All people and learning content are synthetic. Nothing here proves a client-system integration or hosted connectivity.

The Suite and Moodle have separate logins. Clerk authenticates the Suite; this lab does not implement Moodle SSO, Google/LINE identity federation, xAPI, LTI or LINE delivery.

## Prerequisites and commands

Use Node 20+, the existing project dependencies, Git, Docker Desktop with a running daemon, at least 4 GB available memory, and free loopback ports 8081–8083. Initial source/image downloads consume disk and network; there is no cloud account or paid API requirement.

Run from `prototype/`:

```sh
node sandbox/run.mjs setup
node sandbox/run.mjs start
node sandbox/run.mjs status
node sandbox/run.mjs proof
```

`setup` fetches the exact official source revisions below, records SHA-256 source archive checksums, pulls the official PHP 8.3 and PostgreSQL 17 images, and locks their immutable image digests in `sandbox/.local/pins.json`. Subsequent setup runs retain those digests and existing credentials. `start` creates only the task-specific Docker Compose projects `iris-moodle-a` and `iris-moodle-b`, with separate networks, databases and data volumes. No database port is published; HTTP binds only to `127.0.0.1`.

`proof` changes only these local synthetic fixtures: it enrols the synthetic learner through each restricted Moodle service, marks an activity complete using that learner's separate token, runs Moodle's completion task, reads course completion back through the connector, and verifies replay. It also releases and reads the three HR lifecycle events. For outage proof it pauses only Moodle A's web container, verifies A is unavailable while B remains readable, then resumes A in `finally`. Receipts describe whether a completion changed from incomplete or was already complete from an earlier run.

Successful proof prints only a redacted JSON report and saves it in `sandbox/.local/receipts/`. A failed assertion returns a nonzero exit code and preserves a failed receipt. Startup/status alone cannot certify integration behavior. Suite-to-D1 mapping, tenant authorization and workflow reconciliation require the application's separate acceptance tests.

```sh
node sandbox/run.mjs hr advance     # release the next synthetic event
node sandbox/run.mjs cron moodle-a # explicitly process completion
node sandbox/run.mjs stop          # preserve databases and credentials
```

There is no public reset route or automatic volume deletion. Stop uses the named Compose projects only and validates the HR process command before signalling it. Resuming via `start` restores the private runtime configuration held in a container tmpfs.

## Credential handling

`sandbox/.local/` is ignored. Setup verifies the ignore rule when run in a Git repository, creates a private directory with mode 700 and secret files with mode 600, and refuses to overwrite existing credential values. Do not print these files, paste values into chat, or put them in CLI flags, URLs, screenshots or tickets.

The generated `private/moodle-a.json` and `private/moodle-b.json` hold the REST service token, a separate learner-only completion token, synthetic login credentials, and nonsecret mapping metadata (`source`, `baseUrl`, `categoryId`, `courseId`, `userId`, `employeeId`, `roleId`, `activityId`). `private/hr.json` holds the synthetic HR bearer token. The Worker must read only the required service tokens through its existing local secret configuration; never deliver a service or learner token to the browser. Mapping metadata must be configured administratively, not accepted from a browser request.

The REST connector is a non-administrator. Its permissions apply to the synthetic course category and its external service allows exactly:

- `core_course_get_courses_by_field`
- `enrol_manual_enrol_users`
- `core_enrol_get_users_courses`
- `core_completion_get_course_completion_status`

A transport-only system role enables REST use; the learner service allows only `core_completion_update_activity_completion_status_manually`, acting as the enrolled learner. Tokens expire within seven days. An expired existing token causes setup/start to stop; renewal is a separate explicit operation. The administrative password is used only to initialize the local Moodle database, never as an integration token. Passwords travel through stdin into private container tmpfs files, not process arguments or diagnostic output. The database password is mounted as a protected file and is never published as a port or CLI argument.

Do not run `docker compose config` or unrestricted Docker inspection in shared logs: Compose definitions may include unrelated upstream development defaults. This lab overrides the PostgreSQL password default with its generated private secret file and does not start upstream Selenium, mail or external-test containers.

## Adapter contracts

`src/lib/sandbox-integrations.ts` is server-only. Its origins deliberately accept only `http://127.0.0.1:8081` / `http://localhost:8081` for Moodle A, port 8082 for Moodle B and port 8083 for HR. Paths, query strings, userinfo, alternate ports, arbitrary hosts and redirects are rejected. Hosted connectors therefore remain **unconfigured**; public sandbox deployment and an exact HTTPS allowlist require separate configuration and verification.

- `MoodleConnector({ baseUrl, token, source, fetch? }).catalogue(categoryId)` returns source-qualified IDs such as `moodle-a:2`, native course IDs and names.
- `.enrol(userId, courseId, roleId)` checks the upstream enrolment before writing, then verifies the result. Replays return `alreadyEnrolled: true`. Ambiguous write failures are never automatically retried.
- `.completion(userId, courseId)` returns an upstream boolean and source/learner/course identity; it never accepts a browser completion flag.
- `fetchHrDelta(baseUrl, token, cursor, fetch?)` returns `{ changes: [{ id, active, employee? }], nextCursor }`. `id` is the employee ID, `employee` is required for active changes and may be absent for leavers. Persist the change and cursor atomically per tenant. Re-reading the same cursor returns the same page.

HR cursor 0–3 supplies the three synthetic identities. Cursor 3 supplies E0003 joining under E0002; cursor 4 transfers E0003 to E9001; cursor 5 deactivates E0003. `hr advance` releases each lifecycle event; the persisted release count survives a service restart. There is one event per page so a transfer cannot collapse into a later leaver event.

Upstream JSON is size-bounded and schema-validated. Read calls have a five-second timeout and at most one transient retry; writes run once. Credentials use POST bodies for Moodle and a bearer header for HR. Upstream error text and response payloads are omitted from public errors.

## Provenance, licenses and verification

Pinned official sources:

- Moodle tag `v4.5.15`, commit `215f44380bdc3ccf852a3a22e34f8423ff64033a`: <https://github.com/moodle/moodle/tree/v4.5.15>
- Official moodlehq/moodle-docker commit `f4c2324d32fb74d7753264381f0a9b418b6034b2`: <https://github.com/moodlehq/moodle-docker/tree/f4c2324d32fb74d7753264381f0a9b418b6034b2>
- Moodle Docker documentation: <https://github.com/moodlehq/moodle-docker#run-several-moodle-instances>

Moodle is GPL-3.0-or-later and runs as a separate local service. Its source and Docker helper checkout stay in ignored caches and are not copied into the Suite or submission. The tracked PHP files here are original local setup glue using installed Moodle APIs. Review the locked image manifests and downloaded source before reusing this development lab outside its synthetic local scope; pinning records provenance and does not constitute a complete supply-chain audit.

```sh
pnpm exec tsx --test tests/integrations*.test.ts
pnpm exec eslint src/lib/sandbox-integrations.ts tests/integrations*.test.ts sandbox/*.mjs sandbox/proof.ts
```

The adapter tests prove validation, timeout/retry boundaries, source isolation and replay behavior using HTTP fixtures; the HR service test uses a real ephemeral HTTP listener. Only a complete successful `proof` receipt establishes real local Moodle integration evidence. Preserve both failed and successful receipts.
