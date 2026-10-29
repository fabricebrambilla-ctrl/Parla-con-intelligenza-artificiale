"use strict";

// Server-only credentials. Public snapshots contain aliases and observed counts,
// never keys, prompts or transcripts. Provider organization quotas remain authoritative.
class ProviderKeys {
  #entries;
  constructor(names, { env = process.env, now = Date.now } = {}) {
    const seen = new Set();
    this.now = now;
    this.primaryAlias = names[0];
    this.#entries = names.flatMap(alias => {
      const key = String(env[alias] || "").trim();
      if (!key || seen.has(key)) return [];
      seen.add(key);
      return [{ alias, key, blocked: new Map(), observed: new Map() }];
    });
  }
  get size() { return this.#entries.length; }
  aliases() { return this.#entries.map(e => e.alias); }
  snapshot() {
    return this.#entries.map(e => ({ alias: e.alias,
      observed_since_process_start: Object.fromEntries(e.observed),
      cooldowns: Object.fromEntries([...e.blocked].filter(([,at]) => at > this.now())) }));
  }
  observe(entry, scope, result) {
    const current = entry.observed.get(scope) || { requests: 0, succeeded: 0, rejected: 0,
      measured_tokens: 0, usage_missing: 0 };
    current.requests++;
    if (result.response.ok) current.succeeded++; else current.rejected++;
    const u = result.data?.usage;
    if (Number.isSafeInteger(u?.prompt_tokens) && u.prompt_tokens >= 0 &&
        Number.isSafeInteger(u?.completion_tokens) && u.completion_tokens >= 0)
      current.measured_tokens += u.prompt_tokens + u.completion_tokens;
    else current.usage_missing++;
    entry.observed.set(scope, current);
  }
  async run(scope, dispatch, { primaryOnly = false, signal = null, quotaRejection = () => false } = {}) {
    const entries = primaryOnly ? this.#entries.filter(e => e.alias === this.primaryAlias) : this.#entries;
    if (!entries.length) throw new Error("Provider credential is missing");
    let last = null;
    for (const entry of entries) {
      signal?.throwIfAborted();
      if ((entry.blocked.get(scope) || 0) > this.now()) continue;
      // Transport failures, timeouts and cancellation propagate. An uncertain
      // POST is never replayed against another credential.
      const result = await dispatch(entry.key, entry.alias);
      this.observe(entry, scope, result);
      const code = String(result.data?.error?.code || "");
      const quota = quotaRejection(result);
      if ((result.response.status !== 429 && !quota) || /blocked_api_access|billing|payment|suspend/i.test(code))
        return { ...result, account: entry.alias };
      const retry = result.response.headers?.get("retry-after");
      const delay = quota ? Math.max(86400000, retryDelay(retry, this.now())) : retryDelay(retry, this.now());
      entry.blocked.set(scope, this.now() + delay);
      last = { ...result, account: entry.alias };
      if (primaryOnly) return last; // Existing QA ledger covers the primary key only.
    }
    if (last) return last;
    const wait = Math.max(1, Math.ceil((Math.min(...entries.map(e => e.blocked.get(scope) || this.now())) - this.now()) / 1000));
    throw Object.assign(new Error("Provider is cooling down"), { status: 429, retryAfter: wait });
  }
  // Startup validation uses no inference/search and never forwards a secret in a URL.
  async checkEach(check) {
    for (const entry of this.#entries) await check(entry.key, entry.alias);
  }
}

function retryDelay(value, now) {
  if (value == null || String(value).trim() === "") return 60000;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1000, date - now) : 60000;
}

module.exports = { ProviderKeys, retryDelay };
