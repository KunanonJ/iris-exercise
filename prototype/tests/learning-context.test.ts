import assert from "node:assert/strict";
import { test } from "node:test";
import employees from "../src/data/generated/employees.json";
import { itemById } from "../src/data/catalog";
import { CERTIFICATES } from "../src/data/certificates";
import { roleById } from "../src/data/taxonomy";
import { fitToLearningTime, rulesPlan, shortlist } from "../src/lib/plan-rules";
import { employeeById } from "../src/lib/skills";
import { applyCommand, commandSchema, seedTenant } from "../src/lib/suite-domain";
import type { Principal } from "../src/lib/suite-contracts";
import type { Employee } from "../src/lib/types";

const employee: Principal = { userId: "user_employee", tenantId: "fixture", employeeId: "E0001", role: "employee" };
const base = () => seedTenant(["E0001", "E0002", "E9001"].map((id) => structuredClone(employeeById(id)!)));
const ratings = () => {
  const e = employeeById("E0001")!;
  const ids = new Set([e.roleId, e.nextRoleId!].flatMap((id) => roleById(id).requirements.map((r) => r.skillId)));
  return Object.fromEntries([...ids].map((id) => [id, 2 as const]));
};
const submit = (extra: Record<string, unknown> = {}) => ({
  expectedRevision: 0,
  command: { type: "assessment.submit" as const, self: ratings(), answers: [1, 2, 1], ...extra },
});

test("the skill check stores monthly lesson time and certificates, without duplicates", () => {
  const state = applyCommand(base(), employee, submit({ minutesPerMonth: 240, certificates: ["CERT-CASH", "CERT-CASH"] }));
  assert.equal(state.records.E0001.assessment.minutesPerMonth, 240);
  assert.deepEqual(state.records.E0001.assessment.certificates, ["CERT-CASH"]);
});

test("older clients that send neither field get the paid-time default and no certificates", () => {
  const state = applyCommand(base(), employee, submit());
  assert.equal(state.records.E0001.assessment.minutesPerMonth, 120);
  assert.deepEqual(state.records.E0001.assessment.certificates, []);
});

test("only the listed time options and known certificates are accepted", () => {
  assert.equal(commandSchema.safeParse(submit({ minutesPerMonth: 120, certificates: ["CERT-SAFE"] })).success, true);
  assert.equal(commandSchema.safeParse(submit({ minutesPerMonth: 90 })).success, false);
  assert.equal(commandSchema.safeParse(submit({ certificates: ["CERT-PILOT"] })).success, false);
});

test("a certificate removes catalogue items it already covers from the shortlist", () => {
  // Find an employee whose shortlist contains an item fully covered by one certificate.
  for (const emp of employees as unknown as Employee[]) {
    for (const cert of CERTIFICATES) {
      const covered = shortlist(emp)
        .flatMap((s) => s.items)
        .find((i) => i.skills.every((sk) => sk.skillId === cert.skillId && sk.targetLevel <= cert.level));
      if (!covered) continue;
      const withCert = shortlist(emp, undefined, { certificates: [cert.id] }).flatMap((s) => s.items);
      assert.ok(!withCert.some((i) => i.id === covered.id), `${covered.id} should be skipped for ${cert.id}`);
      return;
    }
  }
  assert.fail("no employee in the synthetic data has an item a certificate covers");
});

test("monthly lesson time caps self-paced videos but always keeps the first one", () => {
  const videos = ["LB-G001", "LB-G002", "LB-G003"].map((itemId) => ({ itemId }));
  assert.deepEqual(fitToLearningTime(videos), videos);
  const tight = fitToLearningTime(videos, 20); // 60 minutes over three months
  assert.deepEqual(tight.map((s) => s.itemId), ["LB-G001"]);
  const roomy = fitToLearningTime(videos, 120);
  const minutes = roomy.reduce((sum, s) => sum + itemById(s.itemId)!.minutes, 0);
  assert.ok(minutes <= 360);
});

test("plans say what time they were sized for only when the employee told us", () => {
  const emp = employeeById("E0001")!;
  assert.ok(!rulesPlan(emp).summary.en.includes("hours of lessons"));
  assert.ok(rulesPlan(emp, undefined, { minutesPerMonth: 240 }).summary.en.includes("about 4 hours of lessons a month"));
});
