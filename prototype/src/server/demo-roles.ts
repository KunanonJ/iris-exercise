import { z } from "zod";
import type { Principal } from "../lib/suite-contracts";

// Demo only: a signed-in reviewer picks which synthetic persona their account plays.
// In production, roles come from the HR system. The server still checks the role on every request.
export const DEMO_TENANT_ID = process.env.DEMO_TENANT_ID ?? "iris-sandbox";
export const DEMO_PERSONAS: Record<Principal["role"], string> = { employee: "E0001", manager: "E0002", leader: "E9001" };
export const demoRoleSchema = z.object({ role: z.enum(["employee", "manager", "leader"]) }).strict();
export const demoRolePickerEnabled = () => process.env.DEMO_ROLE_PICKER === "1";
