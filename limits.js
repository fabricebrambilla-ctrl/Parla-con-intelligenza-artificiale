// Usage limits. All limits are decided here on the server from environment
// variables; nothing the browser sends can change them.
//
// Counters are kept in Redis / Render Key Value when REDIS_URL is set, so they
// survive server restarts. If REDIS_URL is set but the store can't be reached,
// every request is refused (fail closed). Without REDIS_URL, counters are kept
// in memory and reset whenever the server restarts.

const net = require("net");
const crypto = require("crypto");

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

const LIMITS = {
  userSeconds: num("DAILY_MINUTES_PER_USER", 60) * 60,
  ipSeconds: num("DAILY_MINUTES_PER_IP", 60) * 60,
  globalSeconds: num("DAILY_MINUTES_GLOBAL", 600) * 60,
  // Each turn uses about 2 requests plus one per spoken sentence in English.
  userRequests: num("DAILY_REQUESTS_PER_USER", 1500),
  ipRequests: num("DAILY_REQUESTS_PER_IP", 1500),
  globalRequests: num("DAILY_REQUESTS_GLOBAL", 15000),
  burstPerMinute: num("REQUESTS_PER_MINUTE_PER_IP", 60),
  tavilyPerDay: num("DAILY_TAVILY_SEARCHES", 30),
  tavilyPerMonth: num("MONTHLY_TAVILY_SEARCHES", 950),
  // The hidden agent API has its own small daily budget, so agents can never use up
  // the free AI quota that blind visitors depend on. 0 turns the agent API off.
  agentPerDay: num("AGENT_DAILY_MESSAGES", 40),
  agentPerIpPerDay: num("AGENT_DAILY_MESSAGES_PER_IP", 20),
};

// ---------- stores ----------
class MemoryStore {
  constructor() { this.map = new Map(); }
  async incr(key, amount, ttlSeconds) {
    const now = Date.now();
    let e = this.map.get(key);
    if (!e || e.exp <= now) e = { v: 0, exp: now + ttlSeconds * 1000 };
    e.v += amount;
    this.map.set(key, e);
    if (this.map.size > 50000) for (const [k, x] of this.map) if (x.exp <= now) this.map.delete(k);
    return e.v;
  }
}

class RedisStore {
  constructor(url) {
    const { createClient } = require("redis");
    this.client = createClient({ url, disableOfflineQueue: true });
    this.client.on("error", (err) => console.error("redis:", err.message));
    this.ready = this.client.connect().catch((err) => console.error("redis connect:", err.message));
  }
  async incr(key, amount, ttlSeconds) {
    await this.ready;
    const [value] = await this.client
      .multi()
      .incrByFloat(key, amount)
      .expire(key, ttlSeconds, "NX")
      .exec();
    return Number(value);
  }
}

const store = process.env.REDIS_URL ? new RedisStore(process.env.REDIS_URL) : new MemoryStore();
if (!process.env.REDIS_URL) {
  console.warn("limits: REDIS_URL is not set, so usage counters reset when the server restarts.");
}

// ---------- who is calling ----------
const PRIVATE = [/^10\./, /^127\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^169\.254\./, /^::1$/, /^f[cd]/i, /^fe80/i];

function expandV6(ip) {
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const fill = ip.includes("::") ? Array(8 - h.length - t.length).fill("0") : [];
  return [...h, ...fill, ...t].map((x) => x.padStart(4, "0").toLowerCase());
}

// IPv6 users usually own a whole /64, so count the /64 as one address.
function normalize(ip) {
  ip = String(ip || "").trim().replace(/^::ffff:/i, "");
  if (net.isIPv6(ip)) return expandV6(ip).slice(0, 4).join(":") + "::/64";
  return ip;
}

// Addresses are never stored as they are, only as a keyed hash (GDPR: pseudonymisation).
const SECRET = process.env.LIMITS_SECRET || process.env.GROQ_API_KEY || "local-development";
function pseudonym(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url").slice(0, 22);
}

// Render sits behind Cloudflare, which overwrites CF-Connecting-IP with the
// real visitor address. X-Forwarded-For can be faked by the client, so only
// its right-most public entry is used as a fallback.
function clientIp(req) {
  const cf = String(req.get("cf-connecting-ip") || "").trim();
  if (net.isIP(cf)) return normalize(cf);
  const xff = String(req.get("x-forwarded-for") || "").split(",").map((s) => s.trim());
  for (let i = xff.length - 1; i >= 0; i--) {
    if (net.isIP(xff[i]) && !PRIVATE.some((r) => r.test(xff[i]))) return normalize(xff[i]);
  }
  return normalize(req.socket.remoteAddress || "unknown");
}

// The anonymous ID only splits people who share one address; it can't raise any limit.
function clientId(req) {
  const id = String(req.get("x-anon-id") || "");
  return /^[\w-]{8,64}$/.test(id) ? id : "none";
}

// ---------- checks ----------
const DAY = 26 * 3600;
const day = () => new Date().toISOString().slice(0, 10);
const month = () => new Date().toISOString().slice(0, 7);

// Adds this request's cost and returns false if any limit is now exceeded.
// The request that crosses a limit is refused too, so limits are never exceeded.
async function charge(req, { seconds = 0, requests = 1, burst = true } = {}) {
  const d = day(), ip = pseudonym(clientIp(req)), id = clientId(req);
  if (burst) {
    const minute = Math.floor(Date.now() / 60000);
    if ((await store.incr(`b:${minute}:${ip}`, 1, 120)) > LIMITS.burstPerMinute) return false;
  }
  const [gs, us, is, gr, ur, ir] = await Promise.all([
    store.incr(`s:${d}:g`, seconds, DAY),
    store.incr(`s:${d}:u:${id}:${ip}`, seconds, DAY),
    store.incr(`s:${d}:i:${ip}`, seconds, DAY),
    store.incr(`r:${d}:g`, requests, DAY),
    store.incr(`r:${d}:u:${id}:${ip}`, requests, DAY),
    store.incr(`r:${d}:i:${ip}`, requests, DAY),
  ]);
  // A request with no cost still fails once a limit has been reached.
  const over = (v, cost, max) => (cost > 0 ? v > max : v >= max);
  const refused =
    over(gs, seconds, LIMITS.globalSeconds) || over(us, seconds, LIMITS.userSeconds) || over(is, seconds, LIMITS.ipSeconds) ||
    over(gr, requests, LIMITS.globalRequests) || over(ur, requests, LIMITS.userRequests) || over(ir, requests, LIMITS.ipRequests);
  if (refused && (seconds || requests)) {
    // A refused request uses nothing.
    await Promise.all([
      store.incr(`s:${d}:g`, -seconds, DAY), store.incr(`s:${d}:u:${id}:${ip}`, -seconds, DAY), store.incr(`s:${d}:i:${ip}`, -seconds, DAY),
      store.incr(`r:${d}:g`, -requests, DAY), store.incr(`r:${d}:u:${id}:${ip}`, -requests, DAY), store.incr(`r:${d}:i:${ip}`, -requests, DAY),
    ]);
  }
  return !refused;
}

// Express middleware: 429 when over a limit, 503 when the counter store is down.
function limit(cost) {
  return async (req, res, next) => {
    try {
      const c = typeof cost === "function" ? cost(req) : cost;
      if (c === null) return res.status(400).json({ error: "bad request" });
      if (!(await charge(req, c))) return res.status(429).json({ error: "limit" });
      next();
    } catch (err) {
      console.error("limits:", err.message);
      res.status(503).json({ error: "unavailable" });
    }
  };
}

// True if one more Tavily search is allowed (counted globally, per day and per month).
async function takeTavilySearch() {
  const [perDay, perMonth] = await Promise.all([
    store.incr(`t:${day()}`, 1, DAY),
    store.incr(`t:${month()}`, 1, 32 * 24 * 3600),
  ]);
  return perDay <= LIMITS.tavilyPerDay && perMonth <= LIMITS.tavilyPerMonth;
}

// Express middleware for the agent API: one message from the agents' own daily budget
// (whole site and per address). A refused message uses nothing.
function agentLimit() {
  return async (req, res, next) => {
    try {
      if (!LIMITS.agentPerDay) return res.status(404).json({ error: "not found" });
      const d = day(), ip = pseudonym(clientIp(req));
      const [all, mine] = await Promise.all([store.incr(`a:${d}:g`, 1, DAY), store.incr(`a:${d}:i:${ip}`, 1, DAY)]);
      if (all > LIMITS.agentPerDay || mine > LIMITS.agentPerIpPerDay) {
        await Promise.all([store.incr(`a:${d}:g`, -1, DAY), store.incr(`a:${d}:i:${ip}`, -1, DAY)]);
        return res.status(429).json({ error: "limit", message: "Today's agent message limit is used up. It resets at midnight UTC." });
      }
      next();
    } catch (err) {
      console.error("limits:", err.message);
      res.status(503).json({ error: "unavailable" });
    }
  };
}

module.exports = { LIMITS, limit, agentLimit, takeTavilySearch, clientIp, normalize };
