#!/usr/bin/env npx tsx
// Pull Clerk publishable/secret keys and materialise Worker JWT verification
// settings into ignored .env.local and .dev.vars (mode 600).
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";

execFileSync("npx", ["clerk", "env", "pull"], { stdio: "inherit" });

const envLocal = readFileSync(".env.local", "utf8");
const publishable = envLocal.match(/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim();
if (!publishable?.startsWith("pk_")) throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing after clerk env pull");

const encoded = publishable.split("_").slice(2).join("_");
const pad = "=".repeat((4 - (encoded.length % 4)) % 4);
const frontendApi = Buffer.from(encoded + pad, "base64").toString("utf8").replace(/\$$/, "");
const issuer = `https://${frontendApi}`;

const jwks = JSON.parse(execFileSync("npx", ["clerk", "api", "/v1/jwks"], { encoding: "utf8" })) as {
  keys: Record<string, string>[];
};
const pem = createPublicKey({ key: jwks.keys[0], format: "jwk" })
  .export({ type: "spki", format: "pem" })
  .toString()
  .trim();
const jwtKey = pem.replace(/\n/g, "\\n");

const existing = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
const keep = existing.split("\n").filter((line) => line && !/^(CLERK_|APP_ORIGINS=|# Clerk development)/.test(line));
const block = [
  `# Clerk development — synced ${new Date().toISOString()} (do not commit)`,
  `CLERK_PUBLISHABLE_KEY=${publishable}`,
  `CLERK_JWT_KEY="${jwtKey}"`,
  `CLERK_ISSUER_URL=${issuer}`,
  `APP_ORIGINS=http://localhost:3000,http://localhost:8797`,
];
writeFileSync(".dev.vars", [...keep, "", ...block, ""].join("\n").replace(/\n{3,}/g, "\n\n"), { mode: 0o600 });
chmodSync(".dev.vars", 0o600);
chmodSync(".env.local", 0o600);
console.log(`Synced Clerk local env. Issuer ${issuer}. Files mode 600.`);
