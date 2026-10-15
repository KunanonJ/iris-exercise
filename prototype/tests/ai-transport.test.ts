import assert from "node:assert/strict";
import test from "node:test";
import { setAIBinding, streamText } from "../src/lib/ai";
import { prepareCoach } from "../src/lib/coach/coach";

const wire = (text: string) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
async function withBinding(run: () => Promise<unknown>, callback: () => Promise<void>) {
  const saved = { provider: process.env.AI_PROVIDER, demo: process.env.DEMO_MODE };
  process.env.AI_PROVIDER = "workers-ai";
  delete process.env.DEMO_MODE;
  setAIBinding({ run });
  try { await callback(); }
  finally {
    setAIBinding(undefined);
    if (saved.provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = saved.provider;
    if (saved.demo === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = saved.demo;
  }
}
async function consume() {
  let text = "";
  for await (const piece of streamText({ model: "synthetic-test", system: "test", messages: [{ role: "user", content: "test" }], maxTokens: 10 })) text += piece;
  return text;
}

test("legacy Workers AI stream completes with DONE", async () => {
  await withBinding(async () => wire('data: {"response":"Complete answer"}\n\ndata: [DONE]\n\n'), async () => assert.equal(await consume(), "Complete answer"));
});
test("OpenAI compatible explicit stop completes without a redundant DONE frame", async () => {
  await withBinding(async () => wire('data: {"choices":[{"delta":{"content":"Complete answer"},"finish_reason":null}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'), async () => assert.equal(await consume(), "Complete answer"));
});
test("a stream ending after ordinary text is incomplete", async () => {
  await withBinding(async () => wire('data: {"response":"Partial answer"}\n\n'), async () => assert.rejects(consume(), /incomplete|terminal/i));
});
test("malformed data cannot be ignored after a valid text chunk", async () => {
  await withBinding(async () => wire('data: {"response":"Partial answer"}\n\ndata: {"response":\n\ndata: [DONE]\n\n'), async () => assert.rejects(consume(), /invalid|malformed/i));
});
test("a length-limited finish cannot certify a complete model answer", async () => {
  await withBinding(async () => wire('data: {"choices":[{"delta":{"content":"Partial answer"},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'), async () => assert.rejects(consume(), /incomplete|finish|limit/i));
});
test("upstream error objects and malformed choice payloads are rejected", async () => {
  for (const data of ['{"error":{"message":"synthetic provider error"}}', '{"choices":[42]}']) {
    await withBinding(async () => wire(`data: ${data}\n\ndata: [DONE]\n\n`), async () => assert.rejects(consume(), /malformed|invalid/i));
  }
});
test("split UTF-8 and CRLF frames preserve Thai text and DONE without trailing newline", async () => {
  const bytes = new TextEncoder().encode('data: {"response":"คำตอบค่ะ"}\r\n\r\ndata: [DONE]');
  await withBinding(async () => new ReadableStream<Uint8Array>({ start(controller) { for (const byte of bytes) controller.enqueue(Uint8Array.of(byte)); controller.close(); } }), async () => assert.equal(await consume(), "คำตอบค่ะ"));
});
test("premature EOF updates final coach provenance and propagates an error", async () => {
  let calls = 0;
  await withBinding(async () => ++calls === 1 ? { response: JSON.stringify({ category: "in_scope", reason: "learning" }) } : wire('data: {"response":"SBI means situation, behaviour, impact. [S1]"}\n\n'), async () => {
    const prepared = await prepareCoach({ employeeId: "E0001", messages: [{ role: "user", content: "What is SBI?" }] });
    let partial = "";
    await assert.rejects(async () => { for await (const piece of prepared.stream()) partial += piece; }, /incomplete|terminal/i);
    assert.match(partial, /SBI/);
    assert.equal(prepared.meta.answerSource, "provider_fallback");
  });
});
