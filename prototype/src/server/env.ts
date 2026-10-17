import { HttpError } from "../lib/suite-domain";
import type { AuthEnvironment } from "./auth";

export function clerkEnv(): AuthEnvironment {
  return {
    CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_JWT_KEY: process.env.CLERK_JWT_KEY,
    CLERK_ISSUER_URL: process.env.CLERK_ISSUER_URL,
    APP_ORIGINS: process.env.APP_ORIGINS,
  };
}

export function requestKey(req: Request): string {
  const key = req.headers.get("idempotency-key");
  if (!key || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    throw new HttpError(422, "A unique Idempotency-Key is required");
  }
  return key;
}

export function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  const message = error instanceof Error ? error.message : String(error);
  // Surface configuration gaps as 503 without leaking connection strings.
  if (/DATABASE_URL|Database is not configured|Can't reach database/i.test(message)) {
    console.error("API configuration failure", message.split(/[?\s]/)[0]);
    return json({ error: "Database is not configured" }, 503);
  }
  console.error("API failure", message);
  return json({ error: "Sandbox operation failed" }, 500);
}
