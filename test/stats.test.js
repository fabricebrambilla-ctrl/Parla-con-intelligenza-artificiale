// Needs a Postgres database: set TEST_DATABASE_URL to run (skipped otherwise).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");

const DB = process.env.TEST_DATABASE_URL;
const PORT = 4201;
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH = "Basic " + Buffer.from("owner:test-password").toString("base64");
let server;

before(async () => {
  if (!DB) return;
  const { Client } = require("pg");
  const c = new Client({ connectionString: DB });
  await c.connect();
  await c.query("DROP TABLE IF EXISTS stat_visits, stat_presses");
  await c.end();
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { PATH: process.env.PATH, NODE_ENV: "test", PORT: String(PORT), DATABASE_URL: DB, STATS_PASSWORD: "test-password" },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/health")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});
after(() => server && server.kill());

const beacon = (kind, id) => fetch(`${BASE}/api/stats/${kind}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ id }) });

test("stats page refuses access without the right password", { skip: !DB }, async () => {
  assert.equal((await fetch(BASE + "/stats")).status, 401);
  const wrong = "Basic " + Buffer.from("owner:nope").toString("base64");
  const r = await fetch(BASE + "/stats", { headers: { Authorization: wrong } });
  assert.equal(r.status, 401);
  assert.doesNotMatch(await r.text(), /Unique users/);
});

test("one browser, two button presses = 1 user, 2 conversations", { skip: !DB }, async () => {
  const id = "test-browser-123456";
  assert.equal((await beacon("visit", id)).status, 204);
  await beacon("press", id);
  await beacon("press", id);
  await beacon("visit", "x"); // invalid id: ignored
  await new Promise((r) => setTimeout(r, 3500)); // saved in the background every 3 s
  const html = await (await fetch(BASE + "/stats", { headers: { Authorization: AUTH } })).text();
  assert.match(html, /Today \([\d-]+\)<\/h2>\s*<p>Unique users: <strong>1<\/strong>\. Conversations: <strong>2<\/strong>/);
});

test("generating 317 visitors gives exactly 317 users over 30 days, with varying conversations", { skip: !DB }, async () => {
  const post = (url, body) => fetch(BASE + url, {
    method: "POST", redirect: "manual",
    headers: { Authorization: AUTH, "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  assert.equal((await post("/stats/clear", "")).status, 303);
  assert.equal((await post("/stats/demo", "visitors=317")).status, 303);
  const html = await (await fetch(BASE + "/stats", { headers: { Authorization: AUTH } })).text();
  const m = html.match(/Last 30 days<\/h2>\s*<p>Unique users: <strong>(\d+)<\/strong>\. Conversations: <strong>(\d+)/);
  assert.equal(Number(m[1]), 317);
  const conv = Number(m[2]);
  assert.ok(conv > 317 * 2 && conv < 317 * 8, "about 3–5 conversations per visitor on average, got " + conv);
  assert.doesNotMatch(html, /test data/i);
  // Growth: the newest 10 days have clearly more users than the oldest 10.
  const daily = [...html.matchAll(/<tr><th scope="row">[\d-]+<\/th><td>(\d+)<\/td>/g)].map((x) => Number(x[1]));
  assert.equal(daily.length, 30);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  assert.ok(sum(daily.slice(0, 10)) > 1.5 * sum(daily.slice(20)), "grows over the month: " + daily.join(","));
  // A form post from the stats page itself is accepted, even with Origin "null" (no-referrer).
  const own = await fetch(BASE + "/stats/demo", { method: "POST", redirect: "manual",
    headers: { Authorization: AUTH, "Content-Type": "application/x-www-form-urlencoded", Origin: "null", "Sec-Fetch-Site": "same-origin" }, body: "visitors=3" });
  assert.equal(own.status, 303);
  const foreign = await fetch(BASE + "/stats/demo", { method: "POST", redirect: "manual",
    headers: { Authorization: AUTH, "Content-Type": "application/x-www-form-urlencoded", "Sec-Fetch-Site": "cross-site" }, body: "visitors=3" });
  assert.equal(foreign.status, 403);
  assert.equal((await fetch(BASE + "/stats/demo", { method: "POST", redirect: "manual" })).status, 401);
  assert.equal((await fetch(BASE + "/stats/clear", { method: "POST", redirect: "manual" })).status, 401);
});
