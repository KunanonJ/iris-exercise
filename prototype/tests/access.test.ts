import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index";

const env = { ASSETS: { fetch: async () => new Response("static") } };
for (const path of ["/api/state", "/api/integrations", "/api/sso/session"]) {
  test(`anonymous callers cannot read ${path}`, async () => {
    const r = await worker.fetch(new Request(`http://localhost${path}`), env);
    assert.equal(r.status, path === "/api/sso/session" ? 410 : 401);
  });
}
test("retired identity minting cannot grant a manager session", async () => {
  const r = await worker.fetch(new Request("http://localhost/api/sso/token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: "manager" }) }), env);
  assert.equal(r.status, 410);
});
test("anonymous coach requests are rejected before parsing untrusted bodies", async () => {
  const r = await worker.fetch(new Request("http://localhost/api/coach", { method: "POST", body: "invalid" }), env);
  assert.equal(r.status, 401);
});
