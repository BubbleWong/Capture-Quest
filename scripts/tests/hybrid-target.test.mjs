import assert from "node:assert/strict";
import { test } from "node:test";
import { testPhoto, testTarget } from "../hybrid-smoke.mjs";
import { validatePhoto } from "../../server/localWorkerJobs.js";

test("hybrid gates default to loopback and reject credential-bearing URLs", () => {
  assert.equal(testTarget(), "http://127.0.0.1:19131");
  assert.equal(testTarget("http://localhost:1234"), "http://localhost:1234");
  assert.throws(() => testTarget("https://secret@example.com"));
  assert.throws(() => testTarget("https://example.com/?token=secret"));
  assert.throws(() => testTarget("https://example.com/api"));
});

test("remote smoke and production smoke need separate explicit opt-ins", () => {
  const env = {};
  assert.throws(() => testTarget("https://staging.example", { env }));
  env.HYBRID_ALLOW_REMOTE = "1";
  assert.equal(testTarget("https://staging.example", { env }),
    "https://staging.example");
  assert.throws(() => testTarget("https://cq.bubbleh.com", { env }));
  env.HYBRID_ALLOW_PRODUCTION = "1";
  assert.equal(testTarget("https://cq.bubbleh.com", { env }),
    "https://cq.bubbleh.com");
  assert.throws(() => testTarget("http://staging.example", { env }));
});

test("the 50-player gate cannot target remote origins even with smoke opt-ins", () => {
  assert.throws(() => testTarget("https://staging.example", {
    load: true, env: { HYBRID_ALLOW_REMOTE: "1", HYBRID_ALLOW_PRODUCTION: "1" }
  }));
});

test("the native transport capture fixture fully decodes in the local processor", async () => {
  const normalized = await validatePhoto(testPhoto);
  assert(normalized.startsWith("data:image/jpeg;base64,"));
});
