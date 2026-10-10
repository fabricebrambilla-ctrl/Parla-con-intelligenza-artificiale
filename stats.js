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

  const totals = (from) =>
    p.query(`SELECT (SELECT COUNT(DISTINCT anon_id)::int FROM (${all}) e WHERE ${day} >= $1::date) AS users,
                    (SELECT COUNT(*)::int FROM stat_presses WHERE ${day} >= $1::date) AS presses`, [from]);
  const [perDay, presses, week, month] = await Promise.all([
    p.query(`SELECT to_char(${day}, 'YYYY-MM-DD') AS d, COUNT(DISTINCT anon_id)::int AS users
             FROM (${all}) e WHERE ${day} >= $1::date GROUP BY 1`, [since]),
    p.query(`SELECT to_char(${day}, 'YYYY-MM-DD') AS d, COUNT(*)::int AS n
             FROM stat_presses WHERE ${day} >= $1::date GROUP BY 1`, [since]),
    totals(days[6]),
    totals(since),
  ]);

  const users = Object.fromEntries(perDay.rows.map((r) => [r.d, r.users]));
  const conv = Object.fromEntries(presses.rows.map((r) => [r.d, r.n]));
  const rows = days.map((d) => ({ date: d, users: users[d] || 0, conversations: conv[d] || 0 }));
  return {
    rows,
    today: rows[0],
    week: { users: week.rows[0].users, conversations: week.rows[0].presses },
    month: { users: month.rows[0].users, conversations: month.rows[0].presses },
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

// Normally distributed random number (Box–Muller).
function gaussian() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

// A random moment on the Zurich day that is `daysAgo` days back, between 7:00
// and 23:00 local time, never in the future.
function momentOn(daysAgo) {
  const now = Date.now();
  for (let tries = 0; tries < 20; tries++) {
    const t = now - daysAgo * 86400000 - Math.random() * 86400000;
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(t)));
    if (hour >= 7 && hour <= 22 && zurichDate(new Date(t)) === zurichDate(new Date(now - daysAgo * 86400000))) return new Date(t);
  }
  return new Date(now - daysAgo * 86400000);
}

// Adds `count` made-up visitors spread over the last 30 days. Like real people,
// most try it once or twice, some come back on several days, a few use it a lot:
// conversations per visitor follow a skewed (log-normal) curve, median about 3.
async function seedDemo(count = 317) {
  await ensureTables();
  const visits = [], presses = [];
  for (let v = 0; v < count; v++) {
    const id = crypto.randomUUID();
    const total = Math.min(60, Math.max(1, Math.round(Math.exp(1.1 + 0.85 * gaussian()))));
    // Busier visitors tend to come back on more days; newer days are a bit more likely (growth).
    const dayCount = Math.min(total, KEEP_DAYS, 1 + Math.floor(Math.random() * Math.sqrt(total) * 1.6));
    const days = new Set();
    while (days.size < dayCount) days.add(Math.floor(KEEP_DAYS * Math.pow(Math.random(), 1.4)));
    const list = [...days];
    const perDay = new Map(list.map((d) => [d, 1]));
    for (let i = list.length; i < total; i++) {
      const d = list[Math.floor(Math.random() * list.length)];
      perDay.set(d, perDay.get(d) + 1);
    }
    for (const [d, n] of perDay) {
      visits.push([id, momentOn(d)]);
      if (Math.random() < 0.3) visits.push([id, momentOn(d)]);
      for (let i = 0; i < n; i++) presses.push([id, momentOn(d)]);
    }
  }
  await insertRows("stat_visits", visits);
  await insertRows("stat_presses", presses);
  return { visitors: count, conversations: presses.length };
}

async function clearAll() {
  await ensureTables();
  await db().query("DELETE FROM stat_visits");
  await db().query("DELETE FROM stat_presses");
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

router.post("/stats/demo", express.urlencoded({ extended: false, limit: "1kb" }), guard, sameSite, async (req, res) => {
  const n = Math.round(Number(req.body?.visitors));
  const count = Number.isFinite(n) && n >= 1 && n <= 5000 ? n : 317;
  try { await seedDemo(count); } catch (err) { console.error("stats demo:", err.message); }
  res.redirect(303, "/stats");
});

router.post("/stats/clear", guard, sameSite, async (req, res) => {
  try { await clearAll(); } catch (err) { console.error("stats clear:", err.message); }
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
    <p>Unique users: <strong>${s.month.users}</strong>. Conversations: <strong>${s.month.conversations}</strong>.</p>
    <table>
      <caption>Days in Europe/Zurich time, newest first. A unique user is a device that opened the site; a conversation is a button press.</caption>
      <thead><tr><th scope="col">Date</th><th scope="col">Unique users</th><th scope="col">Conversations</th></tr></thead>
      <tbody>
${tr}
      </tbody>
    </table>
    <h2>Generate visitors (for testing)</h2>
    <form method="post" action="/stats/demo">
      <p><label for="visitors">Number of visitors</label>
      <input id="visitors" name="visitors" type="number" min="1" max="5000" value="317"></p>
      <p><button type="submit">Generate visitors</button></p>
    </form>
    <h2>Start again</h2>
    <form method="post" action="/stats/clear"><p><button type="submit">Delete all statistics</button></p></form>`));
  } catch (err) {
    console.error("stats page:", err.message);
    res.status(503).type("html").send(page("Stats unavailable", `
    <h1>Usage statistics</h1>
    <p>The statistics database can't be reached right now${process.env.DATABASE_URL ? "" : " (DATABASE_URL is not set)"}. The website itself keeps working.</p>`));
  }
});

module.exports = { router, flush, cleanup, readStats, seedDemo, clearAll };
