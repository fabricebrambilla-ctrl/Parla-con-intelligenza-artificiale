// Needs a Postgres database: set TEST_DATABASE_URL to run (skipped otherwise).
// Uses a stand-in Groq service for the agent API part (no real quota).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const DB = process.env.TEST_DATABASE_URL;
const PORT = 4201;
const FAKE_PORT = 4202;
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH = "Basic " + Buffer.from("owner:test-password").toString("base64");
let server, fake;

before(async () => {
  if (!DB) return;
  const { Client } = require("pg");
  const c = new Client({ connectionString: DB });
  await c.connect();
  // Old tables from the 30-day version, with data in them: must be wiped on start.
  await c.query("DROP TABLE IF EXISTS stat_events; CREATE TABLE IF NOT EXISTS stat_visits (anon_id text, ts timestamptz); INSERT INTO stat_visits VALUES ('old-fake-visitor', now())");
  await c.end();
  fake = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "ok" } }] })));
  }).listen(FAKE_PORT);
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      PATH: process.env.PATH, NODE_ENV: "test", PORT: String(PORT), DATABASE_URL: DB, STATS_PASSWORD: "test-password",
      GROQ_API_KEY: "test", GROQ_BASE_URL: `http://127.0.0.1:${FAKE_PORT}`, STATS_DEVICES_PER_IP: "3",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/health")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
});
after(() => { server && server.kill(); fake && fake.close(); });

const visit = (id, site = "same-origin") =>
  fetch(`${BASE}/api/stats/visit`, { method: "POST", headers: { "Content-Type": "text/plain", "Sec-Fetch-Site": site }, body: JSON.stringify({ id }) });
const start = (id) => fetch(`${BASE}/api/limit`, { headers: { "X-Anon-Id": id } });
const agentChat = (body) =>
  fetch(`${BASE}/api/agent/chats`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const statsPage = async () => (await fetch(BASE + "/stats", { headers: { Authorization: AUTH } })).text();
const today = (html) => html.match(/Today \([\d-]+\)<\/h2>\s*<p>Unique users: <strong>(\d+)<\/strong>\. Conversations: <strong>(\d+)/).slice(1).map(Number);
const saved = () => new Promise((r) => setTimeout(r, 3500)); // saved in the background every 3 s

test("stats page refuses access without the right password", { skip: !DB }, async () => {
  assert.equal((await fetch(BASE + "/stats")).status, 401);
  const wrong = "Basic " + Buffer.from("owner:nope").toString("base64");
  const r = await fetch(BASE + "/stats", { headers: { Authorization: wrong } });
  assert.equal(r.status, 401);
  assert.doesNotMatch(await r.text(), /Unique users/);
});

test("old data is wiped, only 7 days are shown, nothing can be generated", { skip: !DB }, async () => {
  const html = await statsPage();
  assert.deepEqual(today(html), [0, 0]);
  assert.doesNotMatch(html, /Last 30 days|Generate|demo/i);
  assert.equal(html.match(/<tr><th scope="row">/g).length, 7);
  const r = await fetch(BASE + "/stats/demo", { method: "POST", headers: { Authorization: AUTH } });
  assert.equal(r.status, 404);
});

test("a person: same device, 3 conversations = 1 user, 3 conversations", { skip: !DB }, async () => {
  const id = "person-device-123456";
  await visit(id);
  for (let i = 0; i < 3; i++) assert.equal((await start(id)).status, 200);
  await visit("x"); // invalid id: ignored
  await visit("cross-site-device-1", "cross-site"); // not from this site: ignored
  await saved();
  assert.deepEqual(today(await statsPage()), [1, 3]);
});

test("AI agents: one agent with 3 chats = 1 user; a new agent = another user", { skip: !DB }, async () => {
  const first = await agentChat({ message: "hi" });
  assert.ok(first.agent_id);
  await agentChat({ message: "again", agent_id: first.agent_id });
  await agentChat({ message: "third", agent_id: first.agent_id });
  await agentChat({}); // a chat with no answered message: not a conversation
  const other = await agentChat({ message: "I'm a different agent" });
  assert.notEqual(other.agent_id, first.agent_id);
  await saved();
  // person (1 user, 3 conversations) + agent A (1 user, 3 chats) + agent B (1 user, 1 chat)
  assert.deepEqual(today(await statsPage()), [3, 7]);
});

test("one address can't add more than the allowed number of new devices", { skip: !DB }, async () => {
  // STATS_DEVICES_PER_IP = 3 and this address already added 1 device.
  for (let i = 0; i < 6; i++) await visit("made-up-device-" + i + "-xyz");
  await saved();
  assert.deepEqual(today(await statsPage()), [5, 7]);
});

test("delete all statistics still works", { skip: !DB }, async () => {
  const r = await fetch(BASE + "/stats/clear", { method: "POST", redirect: "manual", headers: { Authorization: AUTH } });
  assert.equal(r.status, 303);
  assert.deepEqual(today(await statsPage()), [0, 0]);
});
