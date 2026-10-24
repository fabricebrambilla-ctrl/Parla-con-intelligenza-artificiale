// Agent API, against a stand-in Groq service (uses no real quota).
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const PORT = 3997;
const FAKE_PORT = 3996;
const BASE = `http://127.0.0.1:${PORT}`;
let server, fake;
let lastBody = null;

before(async () => {
  // Stand-in Groq: replies "echo: <last user message>"; "slow" waits 3 s; "search" calls web_search first.
  fake = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      lastBody = body;
      const msgs = body.messages || [];
      const last = [...msgs].reverse().find((m) => m.role === "user")?.content || "";
      const toolDone = msgs.some((m) => m.role === "tool");
      const answer = (content, extra = {}) =>
        res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content, ...extra } }] }));
      if (last.includes("search") && !toolDone && body.tools) {
        return answer("", { tool_calls: [{ id: "c1", type: "function", function: { name: "web_search", arguments: '{"query":"x"}' } }] });
      }
      if (last.includes("bye") && body.tools) {
        return answer("", { tool_calls: [{ id: "c2", type: "function", function: { name: "end_conversation", arguments: '{"farewell":"Goodbye!"}' } }] });
      }
      if (last.includes("ratelimited") && body.model === "openai/gpt-oss-120b") {
        res.statusCode = 429;
        return res.end(JSON.stringify({ error: { message: "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000" } }));
      }
      if (last.includes("ratelimited")) return answer("answered by " + body.model);
      const delay = last.includes("slow") ? 3000 : 0;
      setTimeout(() => answer("**echo**: " + last), delay);
    });
  }).listen(FAKE_PORT);

  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      PATH: process.env.PATH, NODE_ENV: "test", PORT: String(PORT),
      GROQ_API_KEY: "test", GROQ_BASE_URL: `http://127.0.0.1:${FAKE_PORT}`,
      TAVILY_API_KEY: "", AGENT_DAILY_MESSAGES: "8", AGENT_DAILY_MESSAGES_PER_IP: "8",
    },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/health")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
});

after(() => { server.kill(); fake.close(); });

const post = (url, body) =>
  fetch(BASE + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

test("the main page does not mention the agent API", async () => {
  const html = await (await fetch(BASE + "/")).text();
  assert.doesNotMatch(html, /agent/i);
});

test("GET /api/agent describes the API", async () => {
  const r = await fetch(BASE + "/api/agent");
  assert.equal(r.status, 200);
  assert.ok((await r.json()).endpoints["POST /api/agent/chats"]);
});

test("create, reply with history, read, and text kept as written", async () => {
  let r = await post("/api/agent/chats", { message: "hello", lang: "it" });
  assert.equal(r.status, 201);
  const first = await r.json();
  assert.equal(first.reply, "**echo**: hello");
  assert.equal(first.ended, false);
  assert.match(lastBody.messages[0].content, /text API/);

  r = await post(`/api/agent/chats/${first.chat_id}/messages`, { message: "second" });
  assert.equal((await r.json()).reply, "**echo**: second");
  assert.deepEqual(lastBody.messages.slice(1).map((m) => m.content), ["hello", "**echo**: hello", "second"]);

  const chat = await (await fetch(BASE + `/api/agent/chats/${first.chat_id}`)).json();
  assert.equal(chat.lang, "it");
  assert.equal(chat.messages.length, 4);
});

test("empty chat, then web search is reported", async () => {
  const c = await (await post("/api/agent/chats", {})).json();
  assert.equal(c.messages.length, 0);
  const r = await (await post(`/api/agent/chats/${c.chat_id}/messages`, { message: "please search" })).json();
  assert.equal(r.searched_web, true);
});

test("stop cancels a reply and the chat can continue", async () => {
  const c = await (await post("/api/agent/chats", {})).json();
  const pending = post(`/api/agent/chats/${c.chat_id}/messages`, { message: "slow one" });
  await new Promise((r) => setTimeout(r, 300));
  const busy = await post(`/api/agent/chats/${c.chat_id}/messages`, { message: "again" });
  assert.equal(busy.status, 409);
  const s = await (await post(`/api/agent/chats/${c.chat_id}/stop`)).json();
  assert.equal(s.stopped, true);
  assert.equal((await (await pending).json()).stopped, true);
  const chat = await (await fetch(BASE + `/api/agent/chats/${c.chat_id}`)).json();
  assert.equal(chat.messages.length, 0);
});

test("goodbye ends the chat; delete removes it", async () => {
  const c = await (await post("/api/agent/chats", { message: "bye" })).json();
  assert.equal(c.ended, true);
  assert.equal((await post(`/api/agent/chats/${c.chat_id}/messages`, { message: "hi" })).status, 409);
  assert.equal((await fetch(BASE + `/api/agent/chats/${c.chat_id}`, { method: "DELETE" })).status, 204);
  assert.equal((await fetch(BASE + `/api/agent/chats/${c.chat_id}`)).status, 404);
});

test("bad input is refused and costs nothing", async () => {
  assert.equal((await post("/api/agent/chats/nope/messages", { message: "x" })).status, 404);
  const c = await (await post("/api/agent/chats", {})).json();
  assert.equal((await post(`/api/agent/chats/${c.chat_id}/messages`, {})).status, 400);
});

test("the agents' daily budget is enforced", async () => {
  // 5 messages used above (hello, second, search, slow (stopped), bye); budget is 8.
  const c = await (await post("/api/agent/chats", {})).json();
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await post(`/api/agent/chats/${c.chat_id}/messages`, { message: "m" + i })).status);
  assert.ok(codes.includes(429), "expected a 429, got " + codes);
  assert.equal(codes.filter((x) => x === 200).length + 5, 8);
});

test("voice site: a reply in another language says which language to speak it in", async () => {
  const r = await post("/api/chat", { lang: "fr", messages: [{ role: "user", content: "answer in English: the newest smart canes and apps for blind people" }] });
  const line = JSON.parse((await r.text()).trim().split("\n").pop());
  assert.equal(line.type, "reply");
  assert.equal(line.lang, "en");
});

test("when the main model is rate-limited, the answer comes from gpt-oss-20b", async () => {
  const r = await post("/api/chat", { lang: "en", messages: [{ role: "user", content: "ratelimited question" }] });
  const line = JSON.parse((await r.text()).trim().split("\n").pop());
  assert.equal(line.type, "reply");
  assert.equal(line.text, "answered by openai/gpt-oss-20b");
});
