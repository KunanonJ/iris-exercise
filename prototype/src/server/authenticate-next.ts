import { verifyToken } from "@clerk/backend";
import { HttpError } from "../lib/suite-domain";
import { lookupPrincipal } from "../lib/suite-repository-prisma";
import { allowedOrigins, type AuthEnvironment } from "./auth";
import { getPrisma } from "./prisma";

export async function authenticateNext(req: Request, env: AuthEnvironment = {}) {
  if (!/^Bearer [A-Za-z0-9_.-]+$/.test(req.headers.get("authorization") ?? "")) {
    throw new HttpError(401, "Sign in with Clerk");
  }
  const origins = allowedOrigins(env);
  if (!env.CLERK_PUBLISHABLE_KEY || !env.CLERK_JWT_KEY || !env.CLERK_ISSUER_URL || !origins.length) {
    throw new HttpError(503, "Clerk development authentication is not configured");
  }
  let userId: string;
  try {
    const claims = await verifyToken(req.headers.get("authorization")!.slice(7), {
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: origins,
    });
    if (
      typeof claims.sub !== "string" ||
      !claims.sub.startsWith("user_") ||
      typeof claims.sid !== "string" ||
      !claims.sid.startsWith("sess_") ||
      (claims.sts !== undefined && claims.sts !== "active") ||
      claims.iss !== env.CLERK_ISSUER_URL ||
      !origins.includes(String(claims.azp ?? ""))
    ) {
      throw new Error("invalid session claims");
    }
    userId = claims.sub;
  } catch {
    throw new HttpError(401, "Invalid or expired Clerk session");
  }
  return lookupPrincipal(getPrisma(), userId);
}
