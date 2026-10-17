#!/usr/bin/env npx tsx
// Pull Clerk publishable/secret keys and materialise JWT verification settings
// into ignored .env.local (Next.js / Vercel) and .dev.vars (Worker), mode 600.
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";

execFileSync("npx", ["clerk", "env", "pull"], { stdio: "inherit" });

const envLocalPath = ".env.local";
const envLocal = readFileSync(envLocalPath, "utf8");
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

const appOrigins = [
  "http://localhost:3000",
  "http://localhost:8797",
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://iris-learning-suite.vercel.app",
].join(",");

const clerkBlock: Record<string, string> = {
  CLERK_PUBLISHABLE_KEY: publishable,
  CLERK_JWT_KEY: `"${jwtKey}"`,
  CLERK_ISSUER_URL: issuer,
  APP_ORIGINS: appOrigins,
};

function upsertEnvFile(path: string, updates: Record<string, string>, banner: string) {
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = existing.split("\n");
  const keys = new Set(Object.keys(updates));
  const kept = lines.filter((line) => {
    if (!line || line.startsWith("# Clerk development")) return false;
    const key = line.split("=", 1)[0];
    return !keys.has(key);
  });
  const block = [
    banner,
    ...Object.entries(updates).map(([k, v]) => `${k}=${v}`),
  ];
  writeFileSync(path, [...kept.filter(Boolean), "", ...block, ""].join("\n").replace(/\n{3,}/g, "\n\n"), {
    mode: 0o600,
  });
  chmodSync(path, 0o600);
}

upsertEnvFile(envLocalPath, clerkBlock, `# Clerk development — synced ${new Date().toISOString()} (do not commit)`);
upsertEnvFile(
  ".dev.vars",
  clerkBlock,
  `# Clerk development — synced ${new Date().toISOString()} (do not commit)`
);

console.log(`Synced Clerk local env into .env.local and .dev.vars. Issuer ${issuer}. Files mode 600.`);
