import assert from "node:assert/strict";
import { test } from "node:test";
import { apiErrorMessage, assertPrincipal, consumeCoachStream, SuiteApiError } from "../secure-client";

function stream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } });
}

test("coach SSE survives split events and carries final fallback provenance", async () => {
  const output: string[] = [];
  const meta = await consumeCoachStream(stream([
    'event: text\r\ndata: {"text":"สวัสดี"}\r\n\r',
    '\nevent: text\ndata: {"text":" hello"}\n\nevent: fi',
    'nal\ndata: {"meta":{"answerSource":"provider_fallback","mode":"demo"}}\n\n',
  ]), text => output.push(text));
  assert.equal(output.join(""), "สวัสดี hello");
  assert.equal(meta.answerSource, "provider_fallback");
});

test("an interrupted coach response cannot be presented as a completed model answer", async () => {
  await assert.rejects(consumeCoachStream(stream(['event: text\ndata: {"text":"partial"}\n\n']), () => {}), /incomplete/i);
});

test("malformed and duplicate final events fail visibly", async () => {
  await assert.rejects(consumeCoachStream(stream(['event: text\ndata: {"text":42}\n\n']), () => {}), /invalid/i);
  await assert.rejects(consumeCoachStream(stream(['event: final\ndata: {"meta":{}}\n\nevent: final\ndata: {"meta":{}}\n\n']), () => {}), /invalid/i);
});

test("server error events cannot silently become successful coach replies", async () => {
  await assert.rejects(consumeCoachStream(stream(['event: error\ndata: {"error":"quota"}\n\n']), () => {}), SuiteApiError);
});

test("a projected response from another user, tenant or role is rejected", () => {
  const expected = { userId: "u1", tenantId: "t1", employeeId: "e1", role: "employee" as const };
  assertPrincipal(expected, { ...expected });
  for (const changed of [{ userId: "u2" }, { tenantId: "t2" }, { employeeId: "e2" }, { role: "manager" as const }]) {
    assert.throws(() => assertPrincipal(expected, { ...expected, ...changed }), /session/i);
  }
});

test("validation errors ask for corrected fields rather than a service retry", () => {
  assert.match(apiErrorMessage(new SuiteApiError(422), false), /required fields/i);
  assert.match(apiErrorMessage(new SuiteApiError(422), true), /ตรวจ.*ข้อมูล/);
  assert.doesNotMatch(apiErrorMessage(new SuiteApiError(422), false), /service|reached the server/i);
});
