// Page-visit device aggregates only. Never inspect headers or retain request objects.
const express = require('express');
const OS = new Set(['windows', 'mac', 'iphone', 'ipad', 'android', 'linux', 'unknown']);
const BROWSERS = new Set(['chrome', 'edge', 'firefox', 'safari', 'opera', 'samsung', 'unknown']);
const MAX_BUCKETS = 4096;
const pending = new Map();
let pool, ready, work = Promise.resolve(), incomplete = false;
const format = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' });
function days() {
  const result = new Set();
  for (let t = Date.now(); result.size < 7; t -= 12 * 3600000) result.add(format.format(new Date(t)));
  return [...result];
}
function normalizeDevice(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some(key => !['os', 'browser', 'major'].includes(key))) return null;
  const os = typeof value.os === 'string' ? value.os.toLowerCase() : '';
  let browser = typeof value.browser === 'string' ? value.browser.toLowerCase() : '';
  if (browser === 'samsung internet') browser = 'samsung';
  const major = value.major === null ? 0 : value.major;
  if (!OS.has(os) || !BROWSERS.has(browser) || !Number.isInteger(major) || major < 0 || major > 999) return null;
  return { os, browser, major: browser === 'unknown' ? 0 : major };
}
function trim() {
  const oldest = days().at(-1);
  for (const [key, row] of pending) if (row.date < oldest) pending.delete(key);
}
function add(row) {
  const key = `${row.date}/${row.os}/${row.browser}/${row.major}`;
  const current = pending.get(key);
  if (!current && pending.size >= MAX_BUCKETS) { incomplete = true; return; }
  pending.set(key, { ...row, visits: Math.min(Number.MAX_SAFE_INTEGER, (current?.visits || 0) + row.visits) });
}
function recordDevice(value) {
  const device = normalizeDevice(value);
  if (!device) return false;
  trim();
  add({ date: days()[0], ...device, visits: 1 });
  return true;
}
function db() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const { Pool } = require('pg');
    const connection = new URL(process.env.DATABASE_URL);
    const host = connection.hostname;
    const internal = !host.includes('.') || host === '127.0.0.1' || host === 'localhost';
    const ssl = process.env.DATABASE_SSL === 'off' || internal ? false : {
      rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {})
    };
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) connection.searchParams.delete(key);
    pool = new Pool({ connectionString: connection.toString(), ssl, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    pool.on('error', () => console.error('device counts: database unavailable'));
  }
  return pool;
}
async function ensureTables() {
  if (!ready) ready = db().query(`CREATE TABLE IF NOT EXISTS stat_daily_devices (
    day date NOT NULL, os text NOT NULL, browser text NOT NULL,
    major smallint NOT NULL CHECK (major BETWEEN 0 AND 999),
    visits bigint NOT NULL CHECK (visits >= 0), PRIMARY KEY (day, os, browser, major)
  )`).catch(error => { ready = null; throw error; });
  return ready;
}
// Serialize flush/read/cleanup so a read cannot count a batch both in memory and SQL.
function serial(fn) {
  const next = work.then(fn);
  work = next.catch(() => {});
  return next;
}
async function save() {
  trim();
  let batch;
  try {
    if (!db()) return false;
    await ensureTables();
    if (!pending.size) return true;
    batch = [...pending.values()]; pending.clear();
    // Stay below PostgreSQL's parameter limit even at the buffer's maximum size.
    const slots = batch.map((_, i) => `($${i*5+1}::date,$${i*5+2},$${i*5+3},$${i*5+4}::smallint,$${i*5+5}::bigint)`).join(',');
    await db().query(`INSERT INTO stat_daily_devices (day,os,browser,major,visits) VALUES ${slots}
      ON CONFLICT (day,os,browser,major) DO UPDATE SET visits = stat_daily_devices.visits + EXCLUDED.visits`,
    batch.flatMap(r => [r.date,r.os,r.browser,r.major,r.visits]));
    return true;
  } catch {
    if (batch) for (const row of batch) add(row);
    trim();
    console.error('device counts: aggregate storage unavailable');
    return false;
  }
}
function flush() { return serial(save); }
function cleanup() {
  return serial(async () => {
    trim();
    try {
      if (!db()) return;
      await ensureTables();
      await db().query('DELETE FROM stat_daily_devices WHERE day < $1::date', [days().at(-1)]);
    } catch { console.error('device counts: aggregate cleanup unavailable'); }
  });
}
function readCounts() {
  return serial(async () => {
    const persistent = await save();
    const buffered = [...pending.values()].map(row => ({ ...row }));
    let rows = [], available = persistent;
    if (persistent) {
      try {
        const result = await db().query("SELECT to_char(day, 'YYYY-MM-DD') AS date, os, browser, major, visits FROM stat_daily_devices WHERE day >= $1::date", [days().at(-1)]);
        rows = result.rows.map(row => ({ date: row.date, os: row.os, browser: row.browser, major: Number(row.major), visits: Number(row.visits) }));
      } catch { available = false; }
    }
    const merged = new Map();
    for (const row of [...rows, ...buffered]) {
      const key = `${row.date}/${row.os}/${row.browser}/${row.major}`;
      const previous = merged.get(key);
      merged.set(key, { ...row, visits: row.visits + (previous?.visits || 0) });
    }
    rows = [...merged.values()].sort((a,b) => b.date.localeCompare(a.date) || a.os.localeCompare(b.os) || a.browser.localeCompare(b.browser) || a.major-b.major);
    return { rows, visits: rows.reduce((n,row) => n+row.visits,0), persistent: available,
      incomplete: incomplete || Boolean(process.env.DATABASE_URL && !available) };
  });
}
const router = express.Router();
router.post('/api/device-count', express.json({ limit: '1kb' }), (req,res) => {
  res.set('Cache-Control','no-store');
  if (!recordDevice(req.body)) return res.status(400).json({ error: 'Invalid device categories' });
  res.status(204).end();
});
setInterval(() => { void flush(); }, 3000).unref();
setInterval(() => { void cleanup(); }, 3600000).unref();
setTimeout(() => { void cleanup(); }, 10000).unref();
module.exports = { router, readCounts, recordDevice, normalizeDevice, flush, cleanup };
