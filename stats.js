// Private usage statistics, shown at /stats behind STATS_PASSWORD.
//
// Stored in Postgres (DATABASE_URL), in two tables that hold only an anonymous
// ID and a timestamp: stat_visits (the site was opened) and stat_presses (a
// button was pressed). No IP addresses, audio, text or browser details.
// Records older than 30 days (Europe/Zurich calendar days) are deleted.
//
// Recording never blocks or slows the site: the browser sends a beacon, the
// server answers at once and writes in the background in small batches. If
// the database is missing or down, events are simply dropped.

const crypto = require("crypto");
const express = require("express");

const TZ = "Europe/Zurich";
const KEEP_DAYS = 30;
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
      CREATE TABLE IF NOT EXISTS stat_visits (anon_id text NOT NULL, ts timestamptz NOT NULL);
      CREATE TABLE IF NOT EXISTS stat_presses (anon_id text NOT NULL, ts timestamptz NOT NULL);
      CREATE INDEX IF NOT EXISTS stat_visits_ts ON stat_visits (ts);
      CREATE INDEX IF NOT EXISTS stat_presses_ts ON stat_presses (ts);
    `).catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// ---------- recording ----------
const queue = { visit: [], press: [] };
const MAX_QUEUE = 2000;
let flushing = false;

function record(kind, id) {
  if (!db() || !ID_RE.test(id) || queue[kind].length >= MAX_QUEUE) return;
  queue[kind].push([id, new Date()]);
}

async function flush() {
  if (flushing || !db()) return;
  flushing = true;
  try {
    for (const [kind, table] of [["visit", "stat_visits"], ["press", "stat_presses"]]) {
      const rows = queue[kind].splice(0, 500);
      if (!rows.length) continue;
      try {
        await ensureTables();
        const values = rows.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(",");
        await db().query(`INSERT INTO ${table} (anon_id, ts) VALUES ${values}`, rows.flat());
      } catch (err) {
        quietLog("stats: could not save " + rows.length + " events:", err.message);
      }
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
    await db().query(`DELETE FROM stat_visits WHERE (ts AT TIME ZONE '${TZ}')::date < ${cutoff}`);
    await db().query(`DELETE FROM stat_presses WHERE (ts AT TIME ZONE '${TZ}')::date < ${cutoff}`);
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
  const all = `SELECT anon_id, ts FROM stat_visits UNION ALL SELECT anon_id, ts FROM stat_presses`;

  const [perDay, presses, week] = await Promise.all([
    p.query(`SELECT to_char(${day}, 'YYYY-MM-DD') AS d, COUNT(DISTINCT anon_id)::int AS users
             FROM (${all}) e WHERE ${day} >= $1::date GROUP BY 1`, [since]),
    p.query(`SELECT to_char(${day}, 'YYYY-MM-DD') AS d, COUNT(*)::int AS n
             FROM stat_presses WHERE ${day} >= $1::date GROUP BY 1`, [since]),
    p.query(`SELECT (SELECT COUNT(DISTINCT anon_id)::int FROM (${all}) e WHERE ${day} >= $1::date) AS users,
                    (SELECT COUNT(*)::int FROM stat_presses WHERE ${day} >= $1::date) AS presses`, [days[6]]),
  ]);

  const users = Object.fromEntries(perDay.rows.map((r) => [r.d, r.users]));
  const conv = Object.fromEntries(presses.rows.map((r) => [r.d, r.n]));
  const rows = days.map((d) => ({ date: d, users: users[d] || 0, conversations: conv[d] || 0 }));
  return {
    rows,
    today: rows[0],
    week: { users: week.rows[0].users, conversations: week.rows[0].presses },
  };
}

// ---------- generated visitors (for testing before launch) ----------
// The owner asked for these to look exactly like real visitors: they are not
// marked, and are removed only by the normal 30-day deletion.

async function insertRows(table, rows) {
  for (let i = 0; i < rows.length; i += 1000) {
    const part = rows.slice(i, i + 1000);
    const values = part.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(",");
    await db().query(`INSERT INTO ${table} (anon_id, ts) VALUES ${values}`, part.flat());
  }
}

async function seedDemo() {
  await ensureTables();
  const pool = Array.from({ length: 900 + Math.floor(Math.random() * 700) }, () => crypto.randomUUID());
  const visits = [], presses = [];
  for (let k = 0; k < KEEP_DAYS; k++) {
    // Irregular daily numbers: a slow upward trend, quieter weekends, plenty of noise.
    const date = new Date(Date.now() - k * 86400000);
    const weekend = [0, 6].includes(date.getDay());
    const users = Math.round((60 + (KEEP_DAYS - k) * 4) * (weekend ? 0.7 : 1) * (0.75 + Math.random() * 0.5)) + Math.floor(Math.random() * 9);
    const today = new Set();
    while (today.size < Math.min(users, pool.length)) today.add(pool[Math.floor(Math.random() * pool.length)]);
    for (const id of today) {
      // Times spread over the hours before this moment on day k.
      const at = () => new Date(date.getTime() - Math.random() * 6 * 3600000);
      const opens = 1 + (Math.random() < 0.25 ? 1 : 0);
      for (let i = 0; i < opens; i++) visits.push([id, at()]);
      const n = Math.floor(Math.random() * 9) + (Math.random() < 0.15 ? 0 : 1);
      for (let i = 0; i < n; i++) presses.push([id, at()]);
    }
  }
  await insertRows("stat_visits", visits);
  await insertRows("stat_presses", presses);
  return { visits: visits.length, presses: presses.length };
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

// Browser beacons: answer immediately, save later.
router.post("/api/stats/:kind", express.json({ type: ["application/json", "text/plain"], limit: "1kb" }), (req, res) => {
  res.status(204).end();
  const kind = req.params.kind;
  const id = String(req.body?.id || "");
  if ((kind !== "visit" && kind !== "press") || tooMany(id, 120)) return;
  record(kind, id);
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
function sameSite(req, res, next) {
  const origin = req.get("origin");
  if (origin && origin !== `${req.protocol}://${req.get("host")}` && origin !== `https://${req.get("host")}`) {
    return res.status(403).type("text").send("Forbidden");
  }
  next();
}

router.post("/stats/demo", guard, sameSite, async (req, res) => {
  try { await seedDemo(); } catch (err) { console.error("stats demo:", err.message); }
  res.redirect(303, "/stats");
});

router.get("/stats", guard, async (req, res) => {
  // This page has two small forms, so allow form posts back to this site.
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
    <h2>Last 30 days</h2>
    <table>
      <caption>Days in Europe/Zurich time, newest first. A unique user is a device that opened the site; a conversation is a button press.</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Unique users</th><th scope="col">Conversations</th></tr></thead>
      <tbody>
${tr}
      </tbody>
    </table>
    <form method="post" action="/stats/demo"><button type="submit">Generate visitors (for testing)</button></form>`));
  } catch (err) {
    console.error("stats page:", err.message);
    res.status(503).type("html").send(page("Stats unavailable", `
    <h1>Usage statistics</h1>
    <p>The statistics database can't be reached right now${process.env.DATABASE_URL ? "" : " (DATABASE_URL is not set)"}. The website itself keeps working.</p>`));
  }
});

module.exports = { router, flush, cleanup, readStats, seedDemo };
