"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const qa = require("../synthetic-qa.js");
const caps = () => ({ primary_requests: 2, primary_tokens: 150000, fallback_requests: 0,
  fallback_tokens: 0, speech_requests: 1, audio_seconds: 25, searches: 1 });
function inContext(budget, fn) {
  const req = { get: name => name === "x-synthetic-test" ? "true" : name === "x-qa-budget" ? JSON.stringify(budget) : "" };
  const res = { status(n) { this.code = n; return this; }, json(x) { this.value = x; return x; } };
  return qa.middleware(req, res, () => fn(res));
}
const body = { model: "primary", messages: [{ role: "user", content: "test" }], max_completion_tokens: 1200 };
test("ordinary requests do not acquire accounting or quotas", () => {
  qa.middleware({ get: () => "" }, {}, () => assert.equal(qa.current(), undefined));
  assert.equal(qa.reserveModel(body, "primary", "fallback"), null);
  assert.deepEqual(qa.decorate({text:"normal"}), {text:"normal"});
});
test("QA reserves before dispatch, refunds only measured usage and bounds tool calls", () => inContext(caps(), () => {
  const t = qa.reserveModel(body, "primary", "fallback");
  assert.ok(qa.current().spent.primary_tokens >= 1200);
  qa.finishModel(t, { usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 } }, 200, "req-test");
  assert.equal(qa.current().spent.primary_tokens, 130);
  assert.equal(qa.lastModelCall(), true);
  qa.search(); assert.equal(qa.searchAvailable(), false);
  assert.throws(() => qa.search(), qa.BudgetError);
  qa.audio(5); assert.equal(qa.current().spent.audio_seconds, 10);
  assert.throws(() => qa.audio(5), qa.BudgetError);
  const out = qa.decorate({ text: "answer" });
  assert.equal(out.telemetry.qa.provider_calls[0].input_tokens, 100);
  assert.equal(out.telemetry.qa.provider_calls[0].provider_request_id, "req-test");
}));
test("no provider dispatch when token allowance is too small", () => inContext({...caps(),primary_tokens:10}, () => {
  assert.throws(() => qa.reserveModel(body,"primary","fallback"), qa.BudgetError);
  assert.equal(qa.current().calls.length, 0);
}));
test("unknown/failing usage keeps its reservation; third hidden call refused", () => inContext(caps(), () => {
  const a=qa.reserveModel(body,"primary","fallback");qa.finishModel(a,{},429);
  assert.equal(qa.current().spent.primary_tokens,a.bound);
  qa.reserveModel(body,"primary","fallback");
  assert.throws(()=>qa.reserveModel(body,"primary","fallback"),qa.BudgetError);
  assert.throws(()=>qa.reserveModel({...body,model:"unlisted"},"primary","fallback"),qa.BudgetError);
}));
test("concurrent async requests cannot share QA accounting", async () => {
  await Promise.all([1,2].map(n => inContext(caps(), async () => {
    await new Promise(resolve=>setTimeout(resolve,n));
    qa.reserveModel(body,"primary","fallback");
    assert.equal(qa.current().spent.primary_requests,1);
  })));
});
