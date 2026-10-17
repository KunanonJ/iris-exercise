import { handleSuiteApi } from "../../../server/suite-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleSuiteApi(req, "/api/status");
}
