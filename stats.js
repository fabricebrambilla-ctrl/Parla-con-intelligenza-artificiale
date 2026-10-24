// Private usage statistics, shown at /stats behind STATS_PASSWORD.
//
// Stored in Postgres (DATABASE_URL), in one table, stat_events, that holds only
// a kind ("visit" or "conversation"), an anonymous ID and a timestamp. No IP
// addresses, audio, text or browser details. Records older than 7 days
// (Europe/Zurich calendar days) are deleted.
//
// What is counted (people and AI agents together, not told apart):
//   - a unique user: one device that opened the site or started a conversation,
//     or one AI agent (its agent_id) that had a chat answered;
//   - a conversation: "Start conversation" / "Continue last conversation" let
//     through by the server (counted on the server, not by a browser beacon),
//     or an agent chat whose first message was answered.
// Nothing can be generated or faked from the stats page, and a single internet
// address can add at most STATS_DEVICES_PER_IP new devices a day.
//
// Recording never blocks or slows the site: events are saved in the background
// in small batches. If the database is missing or down, events are dropped.

const crypto = require("crypto");
const express = require("express");

const TZ = "Europe/Zurich";
const KEEP_DAYS = 7;
const { statsIdAllowed, clientId } = require("./limits.js");
const ID_RE = /^[\w-]{8,64}$/;

let pool = null;
let ready = null;

function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require("pg");
    const url = process.env.DATABASE_URL;
    let host = "";
    try { host = new URL(url).hostname; } catch {}
    // Render's internal address has no dot and no TLS; external addresses need TLS.
    const ssl = process.env.DATABASE_SSL === "off" || !host.includes(".") || host === "127.0.0.1" || host === "localhost"
      ? false
      : { rejectUnauthorized: false };
    pool = new Pool({ connectionString: url, ssl, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    pool.on("error", (err) => quietLog("stats db:", err.message));
  }
  return pool;
}

let lastLog = 0;
function quietLog(...args) {
  if (Date.now() - lastLog > 60000) { lastLog = Date.now(); console.error(...args); }
}

async function ensureTables() {
  const p = db();
  if (!p) throw new Error("DATABASE_URL is not set");
  if (!ready) {
    ready = p.query(`
      DROP TABLE IF EXISTS stat_visits;
      DROP TABLE IF EXISTS stat_presses;
      CREATE TABLE IF NOT EXISTS stat_events (kind text NOT NULL, anon_id text NOT NULL, ts timestamptz NOT NULL);
      CREATE INDEX IF NOT EXISTS stat_events_ts ON stat_events (ts);
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// ---------- recording ----------
const KINDS = ["visit", "conversation"];
const queue = [];
const MAX_QUEUE = 2000;
let flushing = false;

function record(kind, id) {
  if (!db() || !KINDS.includes(kind) || !ID_RE.test(id) || queue.length >= MAX_QUEUE) return;
  queue.push([kind, id, new Date()]);
}

// A device of a person, from the anonymous ID its browser sends (X-Anon-Id or the beacon).
// Never throws and never delays the caller.
function recordDevice(req, kind, id = clientId(req)) {
  if (!db() || !ID_RE.test(id)) return;
  statsIdAllowed(req, id).then((ok) => { if (ok) record(kind, id); }, (err) => quietLog("stats:", err.message));
}

// An AI agent of the agent API (already limited by the agents' daily budget).
function recordAgentChat(agentId) {
  record("conversation", "agent-" + agentId);
}

async function flush() {
  if (flushing || !db()) return;
  flushing = true;
  try {
    const rows = queue.splice(0, 500);
    if (!rows.length) return;
    try {
      await ensureTables();
      const values = rows.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",");
      await db().query(`INSERT INTO stat_events (kind, anon_id, ts) VALUES ${values}`, rows.flat());
    } catch (err) {
      quietLog("stats: could not save " + rows.length + " events:", err.message);
    }
  } finally {
    flushing = false;
  }
}

async function cleanup() {
  if (!db()) return;
  try {
    await ensureTables();
    const cutoff = `((now() AT TIME ZONE '${TZ}')::date - ${KEEP_DAYS - 1})`;
    await db().query(`DELETE FROM stat_events WHERE (ts AT TIME ZONE '${TZ}')::date < ${cutoff}`);
  } catch (err) {
    quietLog("stats cleanup:", err.message);
  }
}

setInterval(flush, 3000).unref();
setInterval(cleanup, 3600 * 1000).unref();
setTimeout(cleanup, 10000).unref();

// Light protection against someone inflating the numbers (memory only, nothing stored).
const burst = new Map();
function tooMany(key, max) {
  const minute = Math.floor(Date.now() / 60000);
  const k = minute + ":" + key;
  const n = (burst.get(k) || 0) + 1;
  burst.set(k, n);
  if (burst.size > 20000) burst.clear();
  return n > max;
}

// ---------- reading ----------
function zurichDate(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function lastDays(n) {
  const out = [];
  const seen = new Set();
  // Step back in 12-hour steps so daylight-saving changes can't skip a day.
  for (let t = Date.now(); out.length < n; t -= 12 * 3600 * 1000) {
    const d = zurichDate(new Date(t));
    if (!seen.has(d)) { seen.add(d); out.push(d); }
  }
  return out;
}

async function readStats() {
  await ensureTables();
  const p = db();
  const days = lastDays(KEEP_DAYS);
  const since = days[days.length - 1];
  const day = `(ts AT TIME ZONE '${TZ}')::date`;
  const [perDay, week] = await Promise.all([
    p.query(`SELECT to_char(${day}, 'YYYY-MM-DD') AS d, COUNT(DISTINCT anon_id)::int AS users,
                    COUNT(*) FILTER (WHERE kind = 'conversation')::int AS conversations
             FROM stat_events WHERE ${day} >= $1::date GROUP BY 1`, [since]),
    p.query(`SELECT COUNT(DISTINCT anon_id)::int AS users, COUNT(*) FILTER (WHERE kind = 'conversation')::int AS conversations
             FROM stat_events WHERE ${day} >= $1::date`, [since]),
  ]);
  const byDay = Object.fromEntries(perDay.rows.map((r) => [r.d, r]));
  const rows = days.map((d) => ({ date: d, users: byDay[d]?.users || 0, conversations: byDay[d]?.conversations || 0 }));
  return { rows, today: rows[0], week: week.rows[0] };
}

async function clearAll() {
  await ensureTables();
  await db().query("DELETE FROM stat_events");
}

// ---------- access ----------
function passwordOk(req) {
  const expected = process.env.STATS_PASSWORD || "";
  const header = String(req.get("authorization") || "");
  if (!expected || !header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const given = decoded.slice(decoded.indexOf(":") + 1); // any user name is accepted
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${title}</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="history stats">
${body}
  </main>
</body>
</html>`;
}

const router = express.Router();

// Browser beacon when the site is opened: answer immediately, save later.
// Only from this site's own pages (browsers mark those requests "same-origin").
router.post("/api/stats/visit", express.json({ type: ["application/json", "text/plain"], limit: "1kb" }), (req, res) => {
  res.status(204).end();
  const site = req.get("sec-fetch-site");
  if (site && site !== "same-origin") return;
  const id = String(req.body?.id || "");
  if (tooMany(id, 30)) return;
  recordDevice(req, "visit", id);
});

// Every /stats request needs the password; nothing is shown without it.
function guard(req, res, next) {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  const ip = String(req.get("cf-connecting-ip") || req.socket.remoteAddress || "");
  if (!process.env.STATS_PASSWORD) return res.status(404).type("text").send("Not found");
  if (!passwordOk(req)) {
    // Slow down password guessing (memory only).
    if (tooMany("auth:" + ip, 10)) return res.status(429).type("text").send("Too many attempts. Wait a minute.");
    res.set("WWW-Authenticate", 'Basic realm="Stats", charset="UTF-8"');
    return res.status(401).type("text").send("Password required");
  }
  next();
}

// Buttons on the stats page post forms; only accept them from this site.
// Browsers say where a request comes from in Sec-Fetch-Site; older ones only in Origin,
// which can be "null" because the site sends no referrer.
function sameSite(req, res, next) {
  const site = req.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none" ? next() : res.status(403).type("text").send("Forbidden");
  const origin = req.get("origin");
  if (origin && origin !== "null") {
    let host = "";
    try { host = new URL(origin).host; } catch {}
    if (host !== req.get("host")) return res.status(403).type("text").send("Forbidden");
  }
  next();
}

router.post("/stats/clear", guard, sameSite, async (req, res) => {
  try { await clearAll(); } catch (err) { console.error("stats clear:", err.message); }
  res.redirect(303, "/stats");
});

router.get("/stats", guard, async (req, res) => {
  // This page has a small form, so allow form posts back to this site.
  res.set("Referrer-Policy", "same-origin");
  res.set("Content-Security-Policy",
    "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  try {
    const s = await readStats();
    const tr = s.rows
      .map((r) => `<tr><th scope="row">${r.date}</th><td>${r.users}</td><td>${r.conversations}</td></tr>`)
      .join("\n");
    res.type("html").send(page("Stats – Talk with Artificial Intelligence", `
    <h1>Usage statistics</h1>
    <h2>Today (${s.today.date})</h2>
    <p>Unique users: <strong>${s.today.users}</strong>. Conversations: <strong>${s.today.conversations}</strong>.</p>
    <h2>Last 7 days</h2>
    <p>Unique users: <strong>${s.week.users}</strong>. Conversations: <strong>${s.week.conversations}</strong>.</p>
    <table>
      <caption>Days in Europe/Zurich time, newest first. A unique user is a device that used the site or an AI agent that used the agent API; a conversation is one started conversation or agent chat.</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Unique users</th><th scope="col">Conversations</th></tr></thead>
      <tbody>
${tr}
      </tbody>
    </table>
    <h2>Start again</h2>
    <form method="post" action="/stats/clear"><p><button type="submit">Delete all statistics</button></p></form>`));
  } catch (err) {
    console.error("stats page:", err.message);
    res.status(503).type("html").send(page("Stats unavailable", `
    <h1>Usage statistics</h1>
    <p>The statistics database can't be reached right now${process.env.DATABASE_URL ? "" : " (DATABASE_URL is not set)"}. The website itself keeps working.</p>`));
  }
});

module.exports = { router, flush, cleanup, readStats, clearAll, recordDevice, recordAgentChat };
