// Limits must hold: per user, per address, after restarts, and when the store is down.
const { test, after } = require("node:test");
const assert = require("node:assert");
const { spawn, execSync } = require("node:child_process");
const path = require("node:path");

const servers = [];
after(() => servers.forEach((s) => s.kill()));

async function startServer(port, env) {
  const s = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { PATH: process.env.PATH, NODE_ENV: "test", PORT: String(port), GROQ_API_KEY: "", TAVILY_API_KEY: "", ...env },
    stdio: "ignore",
  });
  servers.push(s);
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return s; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

function chat(port, headers = {}) {
  return fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Anon-Id": "user-aaaaaaaa", ...headers },
    body: JSON.stringify({ lang: "en", messages: [{ role: "user", content: "hi" }] }),
  }).then((r) => r.status);
}

function wav(seconds, rate = 16000) {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  return b;
}

function transcribe(port, body) {
  return fetch(`http://127.0.0.1:${port}/api/transcribe?lang=en`, {
    method: "POST", headers: { "Content-Type": "audio/wav", "X-Anon-Id": "user-aaaaaaaa" }, body,
  }).then((r) => r.status);
}

test("request limit blocks everything once reached, and a new ID does not help", async () => {
  const port = 4101;
  await startServer(port, { DAILY_REQUESTS_PER_USER: "3", DAILY_REQUESTS_PER_IP: "3" });
  for (let i = 0; i < 3; i++) assert.notEqual(await chat(port), 429); // allowed (it fails later only because there is no key)
  assert.equal(await chat(port), 429);
  assert.equal(await chat(port, { "X-Anon-Id": "someone-else-1" }), 429);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/limit`)).status, 429);
  assert.equal(await transcribe(port, wav(1)), 429);
});

test("speech minutes are charged from the audio and capped", async () => {
  const port = 4102;
  await startServer(port, { DAILY_MINUTES_PER_USER: "0.05", DAILY_MINUTES_PER_IP: "0.05" }); // 3 seconds
  assert.notEqual(await transcribe(port, wav(2)), 429);
  assert.equal(await transcribe(port, wav(2)), 429); // would reach 4 s > 3 s
  assert.notEqual(await chat(port), 429); // 2 s used, under the limit
  assert.notEqual(await transcribe(port, wav(1)), 429); // exactly 3 s
  assert.equal(await chat(port), 429); // limit reached: everything blocks
});

test("only real 16 kHz mono WAV is accepted", async () => {
  const port = 4103;
  await startServer(port, {});
  assert.equal(await transcribe(port, wav(1, 8000)), 400);
  assert.equal(await transcribe(port, Buffer.from("not audio at all, definitely not")), 400);
  const lying = wav(1); lying.writeUInt32LE(10, 40);
  assert.equal(await transcribe(port, lying), 400);
});

test("burst limit per minute", async () => {
  const port = 4104;
  await startServer(port, { REQUESTS_PER_MINUTE_PER_IP: "2" });
  assert.notEqual(await chat(port), 429);
  assert.notEqual(await chat(port), 429);
  assert.equal(await chat(port), 429);
});

let hasRedis = true;
try { execSync("command -v redis-server", { stdio: "ignore" }); } catch { hasRedis = false; }

test("with Redis, limits survive a restart and the server fails closed", { skip: !hasRedis }, async () => {
  const redis = spawn("redis-server", ["--port", "6391", "--save", "", "--appendonly", "no"], { stdio: "ignore" });
  servers.push(redis);
  await new Promise((r) => setTimeout(r, 300));
  const env = { REDIS_URL: "redis://127.0.0.1:6391", DAILY_REQUESTS_PER_USER: "2", DAILY_REQUESTS_PER_IP: "2" };

  let s = await startServer(4105, env);
  assert.notEqual(await chat(4105), 429);
  assert.notEqual(await chat(4105), 429);
  s.kill();

  s = await startServer(4106, env);
  assert.equal(await chat(4106), 429, "limit must still apply after a restart");

  redis.kill();
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await fetch("http://127.0.0.1:4106/api/limit")).status, 503, "must refuse when the store is down");
});

test("with no limit variables set, none of the site's own limits apply", async () => {
  const port = 4115;
  await startServer(port, {});
  const codes = new Set();
  for (let i = 0; i < 80; i++) {
    const r = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: "en", messages: [{ role: "user", content: "hi" }] }),
    });
    codes.add(r.status);
    await r.text();
  }
  assert.deepEqual([...codes], [200]); // never 429 from our own limits (more than the old 60 per minute)
});
