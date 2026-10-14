import { prepareCoach, type CoachInput } from "@/lib/coach/coach";
import { allow, clientKey } from "@/lib/ratelimit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as CoachInput;
  const last = body.messages?.at(-1)?.content ?? "";
  if (!last.trim() || last.length > 1000) return Response.json({ error: "Message must be 1-1000 characters." }, { status: 400 });
  if (!allow(clientKey(req))) return Response.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });

  try {
    const { meta, stream } = await prepareCoach({ ...body, messages: body.messages.map((m) => ({ role: m.role, content: String(m.content).slice(0, 1500) })) });
    const encoder = new TextEncoder();
    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const piece of stream()) controller.enqueue(encoder.encode(piece));
        } catch (err) {
          console.error("coach stream failed", err);
          controller.enqueue(encoder.encode(meta.lang === "th" ? "\n\n(ขออภัยค่ะ ระบบขัดข้องชั่วคราว)" : "\n\n(Sorry, something went wrong. Please try again.)"));
        }
        controller.close();
      },
    });
    return new Response(out, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-coach-meta": Buffer.from(JSON.stringify(meta)).toString("base64"),
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Coach unavailable" }, { status: 500 });
  }
}
