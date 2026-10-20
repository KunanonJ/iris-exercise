import assert from "node:assert/strict";
import { test } from "node:test";
import { askCoach } from "../src/lib/coach/coach";
import type { CoachJourney } from "../src/lib/coach/journey";
import { rulesPlan } from "../src/lib/plan-rules";
import { employeeById } from "../src/lib/skills";
import { applyCommand, scopedView, seedTenant } from "../src/lib/suite-domain";
import type { Principal } from "../src/lib/suite-contracts";
import type { Employee, LearningPlan } from "../src/lib/types";
import employees from "../src/data/generated/employees.json";

const ask = (q: string, journey?: CoachJourney, plan?: LearningPlan) =>
  askCoach({ employeeId: "E0001", messages: [{ role: "user", content: q }], journey, plan, forceDemo: true });

test("before the skill check, 'explain my results' calls the levels estimates, not results", async () => {
  const reply = await ask("Explain my results", { assessment: "not_started" });
  assert.match(reply.text, /starting estimates, not results/);
  assert.doesNotMatch(reply.text, /Results combine/);
  assert.match(reply.text, /Skill check tab/);
});

test("while the manager reviews it, the levels are described as not final", async () => {
  const reply = await ask("Explain my results", { assessment: "submitted" });
  assert.match(reply.text, /with your manager, so these levels aren't final/);
});

test("after approval, results are explained and certificates are acknowledged", async () => {
  const reply = await ask("Explain my results", { assessment: "approved", certificates: ["CERT-CASH"] });
  assert.match(reply.text, /Results combine/);
  assert.match(reply.text, /Cash handling certificate/);
});

test("'what should I do next' follows the journey stage", async () => {
  assert.match((await ask("What should I do next?", { assessment: "not_started" })).text, /Start with your skill check/);
  assert.match((await ask("What should I do next?", { assessment: "submitted" })).text, /with your manager/);
  assert.match((await ask("What should I do next?", { assessment: "approved", minutesPerMonth: 240 })).text, /Build my plan.*4 hours a month/);
  const draft = { ...rulesPlan(employeeById("E0001")!), status: "draft" as const };
  assert.match((await ask("What should I do next?", { assessment: "approved" }, draft)).text, /Send plan to my manager/);
});

test("with an approved plan, the next step mentions the monthly lesson time for a video", async () => {
  const plan = { ...rulesPlan(employeeById("E0001")!), status: "approved" as const };
  const reply = await ask("What should I do next?", { assessment: "approved", minutesPerMonth: 120 }, plan);
  assert.match(reply.text, /Your next step is/);
});

test("without journey context the coach behaves as before (eval harness path)", async () => {
  const reply = await ask("What should I do next?");
  assert.match(reply.text, /don't have an approved plan yet/);
  assert.match(reply.text, /Learning plan tab/);
});

const employee: Principal = { userId: "user_e", tenantId: "fixture", employeeId: "E0001", role: "employee" };
const leader: Principal = { userId: "user_l", tenantId: "fixture", employeeId: "E9001", role: "leader" };
// Leader metrics need 10+ employees (privacy threshold), so seed the whole synthetic company.
const withChat = () => {
  const state = seedTenant(structuredClone(employees as unknown as Employee[]));
  state.records.E0001.chats.general = [
    { role: "user", content: "What should I do next?" },
    { role: "assistant", content: "Start with your skill check.", meta: { answerSource: "demo" } },
    { role: "user", content: "Tell me about forklifts" },
    { role: "assistant", content: "Sorry, I don't have approved material on that.", meta: { answerSource: "no_source" } },
  ];
  return state;
};
const feedback = (index: number, helpful: boolean) => ({ expectedRevision: 0, command: { type: "coach.feedback" as const, key: "general", index, helpful } });

test("an employee can rate a saved coach answer", () => {
  const state = applyCommand(withChat(), employee, feedback(1, true));
  assert.equal(state.records.E0001.chats.general[1].feedback, "helpful");
  const changed = applyCommand(state, employee, feedback(1, false));
  assert.equal(changed.records.E0001.chats.general[1].feedback, "not_helpful");
});

test("only coach answers can be rated", () => {
  assert.throws(() => applyCommand(withChat(), employee, feedback(0, true)), (e: { status: number }) => e.status === 404);
  assert.throws(() => applyCommand(withChat(), employee, feedback(9, true)), (e: { status: number }) => e.status === 404);
});

test("leaders see coach quality totals, never chat text", () => {
  const state = applyCommand(withChat(), employee, feedback(3, false));
  const view = scopedView(state, leader, 1);
  assert.deepEqual(view.metrics?.coach, { answers: 2, rated: 1, helpful: 0, noSource: 1 });
  assert.equal(JSON.stringify(view).includes("forklifts"), false);
});
