// Hidden text API for AI agents and developers.
//
// Nothing on the website links to it and the voice site does not use it.
// It runs the same assistant as the voice site (same model, web search and
// system prompt, plus a note that the caller is using text), so it can be
// used to test the assistant without a microphone.
//
// No key is needed. By default only the AI provider's limits apply; an agent
// message budget can be switched on with AGENT_DAILY_MESSAGES and
// AGENT_DAILY_MESSAGES_PER_IP (see limits.js).
//
// Conversations are kept in server memory only: they disappear when the server
// restarts (on Render's free plan, after 15 minutes without visitors) or after
// 24 hours without activity. The chat ID is long and random; anyone who has it
// can read or continue that conversation, so it works like a password.
//
// Each agent has an agent_id: the server gives one with the first chat, and the
// agent sends it back when it creates more chats (body "agent_id" or header
// X-Agent-Id). In the owner's statistics one agent_id is one unique user and each
// answered chat one conversation, exactly like a person's device.
//
//   GET    /api/agent                      how to use the API (JSON)
//   POST   /api/agent/chats                new chat; optional first message
//   GET    /api/agent/chats/:id            the chat and its messages
//   POST   /api/agent/chats/:id/messages   send a message, get the reply
//   POST   /api/agent/chats/:id/stop       stop the reply being written
//   DELETE /api/agent/chats/:id            delete the chat

const crypto = require("crypto");
const express = require("express");
const { agentLimit } = require("./limits.js");

const MAX_CHATS = 200;
const MAX_MESSAGES = 60; // per chat (user + assistant); the model sees the last 20
const MAX_LENGTH = 4000; // characters per message
const IDLE_MS = 24 * 3600 * 1000;

module.exports = function mountAgentApi(app, { runChat, limit, pickLang, errorCode, LANGS, stats }) {
  const chats = new Map();

  function sweep() {
    const now = Date.now();
    for (const [id, c] of chats) if (now - c.updated > IDLE_MS && !c.running) chats.delete(id);
    // Too many chats: drop the ones idle the longest.
    if (chats.size >= MAX_CHATS) {
      const idle = [...chats.values()].filter((c) => !c.running).sort((a, b) => a.updated - b.updated);
      for (const c of idle.slice(0, chats.size - MAX_CHATS + 1)) chats.delete(c.id);
    }
  }

  const view = (c) => ({
    chat_id: c.id,
    agent_id: c.agentId,
    lang: c.lang,
    created: new Date(c.created).toISOString(),
    updated: new Date(c.updated).toISOString(),
    ended: c.ended,
    busy: !!c.running,
    messages: c.messages.map((m) => ({ role: m.role, content: m.content, at: m.at })),
  });

  function readMessage(req, res, next) {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "bad request", message: 'Send JSON like {"message": "your question"}.' });
    if (message.length > MAX_LENGTH) return res.status(413).json({ error: "too long", message: `Messages are limited to ${MAX_LENGTH} characters.` });
    req.agentMessage = message;
    next();
  }

  function findChat(req, res, next) {
    const c = chats.get(req.params.id);
    if (!c) return res.status(404).json({ error: "not found", message: "No chat with this ID. It may have expired or the server restarted; create a new one." });
    req.chat = c;
    next();
  }

  function checkCanReply(req, res, next) {
    const c = req.chat;
    if (c.ended) return res.status(409).json({ error: "ended", message: "This chat has ended. Create a new one." });
    if (c.running) return res.status(409).json({ error: "busy", message: "A reply is still being written. Wait for it or stop it first." });
    if (c.messages.length + 2 > MAX_MESSAGES) return res.status(409).json({ error: "full", message: "This chat is full. Create a new one." });
    next();
  }

  // Runs one turn and answers the request. A stopped or failed turn removes the
  // unanswered message, so the chat can simply continue.
  async function reply(c, message, res, status = 200) {
    const controller = new AbortController();
    c.running = controller;
    c.updated = Date.now();
    c.messages.push({ role: "user", content: message, at: new Date().toISOString() });
    let searched = false;
    try {
      const { text, end } = await runChat({
        lang: c.lang,
        context: c.context,
        messages: c.messages,
        stop: controller.signal,
        onSearching: () => { searched = true; },
        agent: true,
      });
      c.messages.push({ role: "assistant", content: text, at: new Date().toISOString() });
      c.ended = end;
      // First answered message of this chat: one conversation for this agent in the statistics.
      if (!c.counted) { c.counted = true; stats?.recordAgentChat(c.agentId); }
      res.status(status).json({ chat_id: c.id, agent_id: c.agentId, reply: text, ended: end, searched_web: searched });
    } catch (err) {
      c.messages.pop();
      if (controller.signal.aborted) {
        res.status(status).json({ chat_id: c.id, reply: null, stopped: true });
      } else {
        console.error("agent chat:", err.message);
        const e = errorCode(err);
        res.status(e.status).json({ chat_id: c.id, error: e.error, message: e.error === "limit" ? "The AI's daily limit is used up. Try again tomorrow." : "The AI is busy right now. Try again in a moment." });
      }
    } finally {
      c.running = null;
      c.updated = Date.now();
    }
  }

  const json = express.json({ limit: "32kb" });
  const free = limit({ requests: 0 }); // per-minute protection only, costs nothing
  const paid = [limit({ requests: 1 }), agentLimit()];

  app.get("/api/agent", free, (req, res) =>
    res.json({
      name: "Talk with Artificial Intelligence – agent API",
      about:
        "A free AI assistant that searches the web for current information and names its sources. " +
        "Built for blind and visually impaired people; this text API lets AI agents and developers use the same assistant.",
      auth: "None. Identify yourself with the agent_id the API gives you (see POST /api/agent/chats).",
      languages: LANGS,
      limits: "Only the AI provider's own rate limits; HTTP 429 or 503 when the AI is over them (try again later; daily limits reset at midnight UTC).",
      storage: "Chats are kept in server memory only, for up to 24 hours of inactivity; they may disappear earlier if the server restarts.",
      endpoints: {
        "POST /api/agent/chats": 'Create a chat. Body (all optional): {"message": "first question", "lang": "en", "agent_id": "..."}. Returns {chat_id, agent_id, ...}; with a message also {reply, ended, searched_web}. Keep the agent_id you get the first time and send it with every new chat you create, so all your chats belong to you.',
        "POST /api/agent/chats/{chat_id}/messages": 'Send a message: {"message": "..."}. Returns {reply, ended, searched_web}. Replies can take up to a minute when the assistant searches the web.',
        "POST /api/agent/chats/{chat_id}/stop": "Stop the reply being written. The waiting request returns {stopped: true} and the unanswered message is removed.",
        "GET /api/agent/chats/{chat_id}": "Read the chat and all its messages.",
        "DELETE /api/agent/chats/{chat_id}": "Delete the chat.",
      },
      example: 'curl -X POST <this site>/api/agent/chats -H "Content-Type: application/json" -d \'{"message":"What are the newest navigation aids for blind people?"}\'',
    })
  );

  app.post("/api/agent/chats", json, (req, res, next) => {
    // Only a first message costs anything.
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return free(req, res, next);
    readMessage(req, res, () => paid[0](req, res, () => paid[1](req, res, next)));
  }, async (req, res) => {
    sweep();
    // The agent's own ID from an earlier chat, or a new one for a new agent.
    const given = String(req.body?.agent_id || req.get("x-agent-id") || "");
    const c = {
      id: crypto.randomUUID(),
      agentId: /^[\w-]{8,64}$/.test(given) ? given : crypto.randomUUID(),
      counted: false,
      lang: pickLang(req.body?.lang),
      context: typeof req.body?.context === "string" ? req.body.context.slice(0, 2000) : "",
      created: Date.now(),
      updated: Date.now(),
      ended: false,
      running: null,
      messages: [],
    };
    chats.set(c.id, c);
    if (req.agentMessage) return reply(c, req.agentMessage, res, 201);
    res.status(201).json(view(c));
  });

  app.get("/api/agent/chats/:id", free, findChat, (req, res) => res.json(view(req.chat)));

  app.post("/api/agent/chats/:id/messages", json, readMessage, findChat, checkCanReply, ...paid, (req, res) =>
    // Checked again: another message may have started while the limits were being checked.
    checkCanReply(req, res, () => reply(req.chat, req.agentMessage, res))
  );

  app.post("/api/agent/chats/:id/stop", free, findChat, (req, res) => {
    const running = req.chat.running;
    if (running) running.abort(new Error("stopped by the caller"));
    res.json({ chat_id: req.chat.id, stopped: !!running });
  });

  app.delete("/api/agent/chats/:id", free, findChat, (req, res) => {
    req.chat.running?.abort(new Error("chat deleted"));
    chats.delete(req.chat.id);
    res.status(204).end();
  });
};
