import { handleSuiteApi } from "../../../server/suite-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function dispatch(req: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const apiPath = `/api/${path.join("/")}`;
  return handleSuiteApi(req, apiPath);
}

export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const PATCH = dispatch;
export const DELETE = dispatch;
