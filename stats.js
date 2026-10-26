// Aggregate page visits only. No visitor IDs, IP addresses, transcripts or
// per-visit timestamps are stored here. Refreshes and bots can add visits.
const crypto = require("crypto");
const express = require("express");
const TZ = "Europe/Zurich", KEEP_DAYS = 7;
let pool = null, ready = null, flushing = null;
const pending = new Map();
const clearToken = crypto.randomBytes(32).toString("hex");
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit" });

function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    const url = process.env.DATABASE_URL;
    const connection = new URL(url);
    const host = connection.hostname;
    const internal = !host.includes(".") || host === "127.0.0.1" || host === "localhost";
    const ssl = process.env.DATABASE_SSL === "off" || internal ? false : {
      rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {})
    };
    // pg lets URL SSL options replace the explicit TLS object. Keep one source
    // of TLS configuration so sslmode=no-verify cannot silently undo checking.
    for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"]) connection.searchParams.delete(key);
    pool = new Pool({ connectionString: connection.toString(), ssl, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    pool.on("error", () => console.error("stats: database connection unavailable"));
  }
  return pool;
}
function day(date = new Date()) {
  return dayFormat.format(date);
}
function lastDays() {
  const days = [], seen = new Set();
  for (let t = Date.now(); days.length < KEEP_DAYS; t -= 12 * 3600000) {
    const value = day(new Date(t));
    if (!seen.has(value)) { seen.add(value); days.push(value); }
  }
  return days;
}
async function ensureTables() {
  if (!db()) return;
  if (!ready) ready = db().query(`
    CREATE TABLE IF NOT EXISTS stat_daily_visits (
      day date PRIMARY KEY, visits bigint NOT NULL CHECK (visits >= 0)
    );
    DROP TABLE IF EXISTS stat_events;
    DROP TABLE IF EXISTS stat_visits;
    DROP TABLE IF EXISTS stat_presses;
  `).then(result => {
    console.log("stats: aggregate-only storage initialized; legacy identifier tables removed");
    return result;
  }).catch(err => { ready = null; throw err; });
  return ready;
}
function recordVisit() {
  const d = day();
  pending.set(d, (pending.get(d) || 0) + 1);
  const oldest = lastDays().at(-1);
  for (const key of pending.keys()) if (key < oldest) pending.delete(key);
}
async function flush() {
  if (!db() || !pending.size) return;
  if (flushing) return flushing;
  const rows = [...pending];
  pending.clear();
  flushing = (async () => {
    try {
      await ensureTables();
      const slots = rows.map((_, i) => `($${i*2+1}::date, $${i*2+2}::bigint)`).join(",");
      await db().query(`INSERT INTO stat_daily_visits (day, visits) VALUES ${slots}
        ON CONFLICT (day) DO UPDATE SET visits = stat_daily_visits.visits + EXCLUDED.visits`, rows.flat());
    } catch (err) {
      for (const [d, count] of rows) pending.set(d, (pending.get(d) || 0) + count);
      console.error("stats: aggregate counter could not be saved");
    }
  })().finally(() => { flushing = null; });
  return flushing;
}
async function cleanup() {
  if (!db()) return;
  try {
    await ensureTables();
    await db().query("DELETE FROM stat_daily_visits WHERE day < $1::date", [lastDays().at(-1)]);
  } catch { console.error("stats: aggregate cleanup unavailable"); }
}
setInterval(flush, 3000).unref();
setInterval(cleanup, 3600000).unref();
setTimeout(cleanup, 10000).unref();
async function readStats() {
  const days = lastDays();
  let counts;
  if (db()) {
    await flush();
    await ensureTables();
    const result = await db().query("SELECT to_char(day, 'YYYY-MM-DD') AS d, visits FROM stat_daily_visits WHERE day >= $1::date", [days.at(-1)]);
    counts = new Map(result.rows.map(r => [r.d, Number(r.visits)]));
  } else counts = pending;
  const rows = days.map(date => ({ date, visits: counts.get(date) || 0 }));
  return { rows, today: rows[0], week: { visits: rows.reduce((sum, row) => sum + row.visits, 0) }, persistent: !!db() };
}
async function clearAll() {
  await flush();
  if (db()) { await ensureTables(); await db().query("DELETE FROM stat_daily_visits"); }
  pending.clear();
}
function passwordOk(req) {
  const expected = process.env.STATS_PASSWORD || "";
  const header = String(req.get("authorization") || "");
  if (!expected || !header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const given = decoded.slice(decoded.indexOf(":") + 1);
  return crypto.timingSafeEqual(crypto.createHash("sha256").update(given).digest(), crypto.createHash("sha256").update(expected).digest());
}
const failures = new Map();
function guard(req, res, next) {
  res.set({"Cache-Control":"no-store", "X-Robots-Tag":"noindex, nofollow"});
  if (!process.env.STATS_PASSWORD) return res.status(404).send("Not found");
  if (!passwordOk(req)) {
    // Short-lived counter without an IP or user identifier. It cannot track a visitor.
    const minute = Math.floor(Date.now()/60000);
    const count = (failures.get(minute) || 0) + 1;
    failures.clear(); failures.set(minute, count);
    if (count > 20) return res.status(429).send("Too many attempts. Wait a minute.");
    res.set("WWW-Authenticate", 'Basic realm="Stats", charset="UTF-8"');
    return res.status(401).send("Password required");
  }
  next();
}
function requireClearToken(req, res, next) {
  const given = typeof req.body?.csrf === "string" ? req.body.csrf : "";
  if (!/^[a-f0-9]{64}$/.test(given) || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(clearToken))) return res.status(403).send("Forbidden");
  next();
}
function page(body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Page visits</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body><main>${body}</main></body></html>`;
}
const router = express.Router();
// Compatibility only: older clients can still call the beacon. Discard its
// payload; actual GET / requests are counted by the server without identifiers.
router.post("/api/stats/visit", express.json({type:["application/json","text/plain"],limit:"1kb"}), (req,res) => res.status(204).end());
router.get("/stats", guard, async (req, res) => {
  res.set("Content-Security-Policy", "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const s = await readStats();
    res.type("html").send(page(`<h1>Page visits</h1><p>Today (${s.today.date}): <strong>${s.today.visits}</strong>.</p><p>Last seven days: <strong>${s.week.visits}</strong>.</p><p>Visits are page openings, not unique people. Refreshes and automated visits can be counted. No visitor identifiers are stored.</p>${s.persistent ? "" : "<p>Counter is in memory and resets when the server restarts.</p>"}<form method="post" action="/stats/clear"><input type="hidden" name="csrf" value="${clearToken}"><button type="submit">Reset visit counter</button></form>`));
  } catch { res.status(503).type("html").send(page("<h1>Page visits</h1><p>The counter is temporarily unavailable.</p>")); }
});
router.post("/stats/clear", guard, express.urlencoded({extended:false,limit:"1kb",parameterLimit:2}), requireClearToken, async (req,res) => {
  try { await clearAll(); res.redirect(303,"/stats"); }
  catch { res.status(503).send("The counter could not be reset."); }
});
module.exports = { router, recordVisit, readStats, clearAll, flush, cleanup };
