import { verifyToken } from "@clerk/backend";
import type { D1Database } from "../lib/db";
import { HttpError } from "../lib/suite-domain";
import { lookupPrincipal } from "../lib/suite-repository";
export interface AuthEnvironment { DB?: D1Database; CLERK_PUBLISHABLE_KEY?: string; CLERK_JWT_KEY?: string; CLERK_ISSUER_URL?: string; APP_ORIGINS?: string }
export const allowedOrigins=(env:AuthEnvironment)=>(env.APP_ORIGINS ?? "").split(",").map(s=>s.trim()).filter(Boolean);
export function requireOrigin(req:Request,env:AuthEnvironment) {
  if(!allowedOrigins(env).includes(req.headers.get("origin") ?? "")) throw new HttpError(403,"Request origin is not allowed");
  if(!req.headers.get("content-type")?.startsWith("application/json")) throw new HttpError(415,"JSON request required");
}
export async function authenticate(req:Request,env:AuthEnvironment) {
  if(!/^Bearer [A-Za-z0-9_.-]+$/.test(req.headers.get("authorization") ?? "")) throw new HttpError(401,"Sign in with Clerk");
  if(!env.CLERK_PUBLISHABLE_KEY || !env.CLERK_JWT_KEY || !env.CLERK_ISSUER_URL || !allowedOrigins(env).length) throw new HttpError(503,"Clerk development authentication is not configured");
  let userId:string;
  try {
    const claims=await verifyToken(req.headers.get("authorization")!.slice(7),{jwtKey:env.CLERK_JWT_KEY,authorizedParties:allowedOrigins(env)});
    if(typeof claims.sub!=="string" || !claims.sub.startsWith("user_") || typeof claims.sid!=="string" || !claims.sid.startsWith("sess_") || (claims.sts!==undefined && claims.sts!=="active") || claims.iss!==env.CLERK_ISSUER_URL || !allowedOrigins(env).includes(String(claims.azp ?? ""))) throw new Error("invalid session claims");
    userId=claims.sub;
  } catch { throw new HttpError(401,"Invalid or expired Clerk session"); }
  if(!env.DB) throw new HttpError(503,"Sandbox database is not configured");
  return lookupPrincipal(env.DB,userId);
}
