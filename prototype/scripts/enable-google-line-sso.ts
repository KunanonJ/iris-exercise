#!/usr/bin/env npx tsx
// Enable Google + LINE Login social connections on the linked Clerk development
// instance. Development uses Clerk-shared OAuth credentials; production needs
// your own Google OAuth client and LINE Login channel credentials.
import { execFileSync } from "node:child_process";

const patch = {
  connection_oauth_google: { enabled: true, authenticatable: true },
  connection_oauth_line: { enabled: true, authenticatable: true },
};

const dryRun = process.argv.includes("--dry-run");
const args = ["clerk", "config", "patch", "--json", JSON.stringify(patch)];
if (dryRun) args.push("--dry-run");

execFileSync("npx", args, { stdio: "inherit" });
console.log(dryRun
  ? "Dry-run only. Re-run without --dry-run to apply."
  : "Google and LINE Login are enabled for sign-in/sign-up on the linked development instance.");
