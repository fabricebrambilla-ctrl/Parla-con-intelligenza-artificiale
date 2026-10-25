"use strict";
// Per-request envelope for the explicitly labelled QA client. No ordinary-user
// quota changes, no credentials in telemetry, and no persisted conversations.
const { AsyncLocalStorage } = require("node:async_hooks");
const local = new AsyncLocalStorage();
const KEYS = ["primary_requests", "primary_tokens", "fallback_requests", "fallback_tokens",
  "speech_requests", "audio_seconds", "searches"];
class BudgetError extends Error {
  constructor(message = "Synthetic QA budget reached") { super(message); this.qaBudget = true; this.status = 429; }
}
const current = () => local.getStore();
function decorate(value) {
  const c = current();
  return c ? { ...value, telemetry: { ...(value.telemetry || {}), qa: c.report() } } : value;
}
function middleware(req, res, next) {
  const raw = req.get("x-qa-budget");
  if (!raw) return next(); // Existing frontend and short tester unchanged.
  let budget;
  try {
    budget = JSON.parse(raw);
    if (req.get("x-synthetic-test") !== "true" || raw.length > 2048 ||
        KEYS.some(k => !Number.isSafeInteger(budget[k]) || budget[k] < 0 || budget[k] > 1000000))
      throw new Error("Invalid envelope");
  } catch {
    return res.status(400).json({ error: "qa_budget_invalid" });
  }
  const c = {
    budget, spent: Object.fromEntries(KEYS.map(k => [k, 0])), calls: [],
    take(cost) {
      if (Object.entries(cost).some(([k, v]) => this.spent[k] + v > this.budget[k])) throw new BudgetError();
      for (const [k, v] of Object.entries(cost)) this.spent[k] += v;
    },
    report() { return { version: 1, spent: { ...this.spent }, provider_calls: this.calls.map(x => ({ ...x })) }; },
  };
  const json = res.json.bind(res);
  res.json = value => json(decorate(value));
  return local.run(c, next);
}
function reserveModel(body, primary, fallback) {
  const c = current();
  if (!c) return null;
  const prefix = body.model === primary ? "primary" : body.model === fallback ? "fallback" : null;
  if (!prefix) throw new BudgetError("Unbudgeted synthetic QA model");
  // Byte upper bound for this text-only request (including tool schemas and
  // framing), plus the enforced completion limit. This is an allowance, NOT
  // a fabricated token measurement. Unknown usage keeps this full reservation.
  const completion = body.max_completion_tokens || body.max_tokens;
  if (!Number.isSafeInteger(completion) || completion < 1) throw new BudgetError("Missing completion bound");
  const bound = Buffer.byteLength(JSON.stringify(body), "utf8") + 512 + completion;
  c.take({ [prefix + "_requests"]: 1, [prefix + "_tokens"]: bound });
  const ticket = { model: body.model, accounted_tokens: bound, usage_measured: false,
    input_tokens: null, output_tokens: null, status: null };
  c.calls.push(ticket);
  return { c, prefix, bound, ticket };
}
function finishModel(t, data, status, requestId = null) {
  if (!t) return;
  t.ticket.status = status;
  if (typeof data?.error?.code === "string") t.ticket.error_code = data.error.code.slice(0, 100);
  if (typeof requestId === "string") t.ticket.provider_request_id = requestId.slice(0, 200);
  const u = data?.usage;
  if (!u || !Number.isSafeInteger(u.prompt_tokens) || !Number.isSafeInteger(u.completion_tokens) ||
      u.prompt_tokens < 0 || u.completion_tokens < 0) return;
  const total = Math.max(u.prompt_tokens + u.completion_tokens, Number.isSafeInteger(u.total_tokens) ? u.total_tokens : 0);
  if (total > t.bound) throw new BudgetError("Provider usage exceeded the reserved bound; stop QA");
  t.c.spent[t.prefix + "_tokens"] -= t.bound - total;
  Object.assign(t.ticket, { accounted_tokens: total, input_tokens: u.prompt_tokens,
    output_tokens: u.completion_tokens, usage_measured: true });
}
function audio(seconds) {
  if (!current()) return;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new BudgetError("Invalid QA audio");
  current().take({ speech_requests: 1, audio_seconds: Math.max(10, Math.ceil(seconds)) });
}
function searchAvailable() { const c = current(); return !c || c.spent.searches < c.budget.searches; }
function search() { current()?.take({ searches: 1 }); }
function lastModelCall() {
  const c = current();
  return !!c && c.calls.length >= c.budget.primary_requests + c.budget.fallback_requests - 1;
}
module.exports = { BudgetError, middleware, current, decorate, reserveModel, finishModel, audio,
  search, searchAvailable, lastModelCall, KEYS };
