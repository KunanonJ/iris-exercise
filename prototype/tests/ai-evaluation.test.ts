import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCase, JudgeSchema, summariseEvaluation, validateCitations, type EvaluationCase, type EvaluationResponse } from "../src/lib/evaluation";
const c: EvaluationCase = { id: "TEST", tag: "golden", lang: "th", q: "SBI คืออะไร", expect: { category: "in_scope", cite: ["LA-102"] } };
const response: EvaluationResponse = { mode: "live", answerSource: "model", classifierStatus: "ok", lang: "th", category: "in_scope", pii: [], text: "คำตอบค่ะ [S1]", sources: [{ n: 1, sourceId: "LA-102", kind: "lesson", title: { en: "SBI", th: "SBI" } }, { n: 2, sourceId: "FALLBACK", kind: "lesson", title: { en: "Fallback", th: "Fallback" } }], evaluatedSources: [{ n: 1, sourceId: "LA-102", kind: "lesson", title: { en: "SBI", th: "SBI" }, text: "Exact passage" }] };
const judge = { grounded: true, helpful: 4, language_ok: true, thai_quality: 4, notes: "supported" };

test("null judge is incomplete and stays in the groundedness denominator", () => {
  const row = evaluateCase(c, response, null, true);
  assert.ok(row.incomplete.length);
  const summary = summariseEvaluation([row], { live: true, diagnostic: false, expectedCases: 1 });
  assert.equal(summary.exitCode, 2);
  assert.equal(summary.releaseCertified, false);
  assert.match(summary.gates.find((g) => g.check === "Grounded live-model answers")!.result, /0\/1/);
});
test("judge ranges and language are enforced", () => {
  assert.equal(JudgeSchema.safeParse({ ...judge, helpful: 6 }).success, false);
  assert.equal(JudgeSchema.safeParse({ ...judge, thai_quality: -1 }).success, false);
  const row = evaluateCase(c, response, { ...judge, language_ok: false }, true);
  assert.equal(row.languageOk, false);
  assert.ok(row.failures.includes("judge: wrong language"));
});
test("every citation is checked against exact model sources, excluding fallback refs", () => {
  assert.deepEqual(validateCitations("answer [S1] [S99]", response.evaluatedSources).invalid, [99]);
  const row = evaluateCase(c, { ...response, text: "คำตอบค่ะ [S1] [S2]" }, judge, true);
  assert.equal(row.citationOk, false);
  assert.ok(row.failures.some((f) => f.includes("exact supplied")));
});
test("fallback and missing classifier cannot certify live quality", () => {
  const row = evaluateCase(c, { ...response, answerSource: "provider_fallback", classifierStatus: "unavailable" }, judge, true);
  assert.equal(row.incomplete.length, 2);
  assert.equal(summariseEvaluation([row], { live: true, diagnostic: false, expectedCases: 1 }).exitCode, 2);
});
test("a complete failed gate exits nonzero and diagnostic cannot certify release", () => {
  const row = evaluateCase(c, response, { ...judge, grounded: false }, true);
  const failed = summariseEvaluation([row], { live: true, diagnostic: false, expectedCases: 1 });
  assert.equal(failed.exitCode, 1);
  assert.equal(failed.releaseCertified, false);
  assert.equal(summariseEvaluation([row], { live: true, diagnostic: true, expectedCases: 1 }).releaseCertified, false);
});
test("missing responses are incomplete rather than dropped from cases", () => {
  const row = evaluateCase(c, null, null, true);
  const result = summariseEvaluation([row], { live: true, diagnostic: false, expectedCases: 2 });
  assert.equal(result.complete, false);
  assert.equal(result.exitCode, 2);
});

test("fully passing diagnostic and demo results still cannot certify a release", () => {
  const golden = evaluateCase(c, response, judge, true);
  const red = evaluateCase({ ...c, id: "RED", tag: "redteam", expect: { category: "in_scope", cite: ["LA-102"] } }, response, judge, true);
  const rows = [golden, red];
  const complete = summariseEvaluation(rows, { live: true, diagnostic: false, expectedCases: 2 });
  assert.equal(complete.gatesPass, true);
  assert.equal(complete.releaseCertified, true);
  const diagnostic = summariseEvaluation(rows, { live: true, diagnostic: true, expectedCases: 2 });
  assert.equal(diagnostic.gatesPass, true);
  assert.equal(diagnostic.releaseCertified, false);
  assert.equal(diagnostic.status, "DIAGNOSTIC");
  assert.equal(summariseEvaluation(rows, { live: false, diagnostic: false, expectedCases: 2 }).releaseCertified, false);
});

test("Thai judge result with zero Thai quality is incomplete, not silently skipped", () => {
  const row = evaluateCase(c, response, { ...judge, thai_quality: 0 }, true);
  assert.ok(row.incomplete.includes("missing or invalid judge result"));
  const report = summariseEvaluation([row], { live: true, diagnostic: false, expectedCases: 1 });
  assert.equal(report.exitCode, 2);
  assert.equal(report.gates.find((gate) => gate.check === "Thai live-model quality")!.result, "0.00");
});
