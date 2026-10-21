import test from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins } from "../src/server/auth";
import { appOrigins } from "../src/server/env";

test("the Vercel production domain is trusted alongside APP_ORIGINS", () => {
  const origins = allowedOrigins({ APP_ORIGINS: appOrigins({ APP_ORIGINS: "https://iris-learning-suite.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "iris.kunanonj.com" }) });
  assert.deepEqual(origins, ["https://iris-learning-suite.vercel.app", "https://iris.kunanonj.com"]);
});

test("without Vercel's production domain, only APP_ORIGINS is trusted", () => {
  assert.equal(appOrigins({ APP_ORIGINS: "http://localhost:3000" }), "http://localhost:3000");
  assert.equal(appOrigins({}), "");
});
