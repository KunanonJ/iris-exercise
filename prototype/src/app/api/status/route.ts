import { connection } from "next/server";
import { isLive, MODELS } from "@/lib/llm";

export async function GET() {
  await connection();
  return Response.json({ live: isLive(), models: isLive() ? MODELS : null });
}
