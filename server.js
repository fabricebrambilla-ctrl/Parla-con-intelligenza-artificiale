require("dotenv").config({ quiet: true });

const express = require("express");
const fs = require("fs");
const path = require("path");
const I18N = require("./public/i18n.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const GROQ_URL = "https://api.groq.com/openai/v1";
const TAVILY_URL = "https://api.tavily.com/search";

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
const SUMMARY_MODEL = process.env.GROQ_SUMMARY_MODEL || "openai/gpt-oss-20b";
const STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
const SEARCH_FALLBACK_MODEL = process.env.GROQ_SEARCH_MODEL || "groq/compound";

// Daily limits (minutes of user speech). Counters live in memory and reset each day.
const USER_MINUTES = Number(process.env.DAILY_MINUTES_PER_USER || 60);
const IP_MINUTES = Number(process.env.DAILY_MINUTES_PER_IP || USER_MINUTES * 3);
const GLOBAL_MINUTES = Number(process.env.DAILY_MINUTES_GLOBAL || 600);
// Tavily free plan is 1,000 searches a month; after this many per day, use the Groq fallback.
const TAVILY_PER_DAY = Number(process.env.DAILY_TAVILY_SEARCHES || 30);

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ---------- pages, rendered in the visitor's language ----------
const templates = {
  index: fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8"),
  history: fs.readFileSync(path.join(PUBLIC, "history.html"), "utf8"),
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function langFromHeader(header) {
  const tags = String(header || "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag, q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
  return I18N.pick(tags);
}

function renderPage(name) {
  return (req, res) => {
    const lang = langFromHeader(req.get("accept-language"));
    const html = templates[name].replace(/\{\{(\w+)\}\}/g, (_, key) =>
      key === "htmlLang" ? I18N.META[lang].html : escapeHtml(I18N.t(lang, key))
    );
    res.set("Content-Language", I18N.META[lang].html);
    res.set("Cache-Control", "no-cache");
    res.type("html").send(html);
  };
}

app.get("/", renderPage("index"));
app.get("/history", renderPage("history"));
app.get("/index.html", (req, res) => res.redirect(301, "/"));
app.get("/history.html", (req, res) => res.redirect(301, "/history"));
app.get("/health", (req, res) => res.status(200).send("ok"));
app.use(express.static(PUBLIC, { index: false }));

// ---------- limits ----------
let usageDay = "";
const usage = new Map();
let tavilyToday = 0;

function today() {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== usageDay) {
    usageDay = d;
    usage.clear();
    tavilyToday = 0;
  }
  return d;
}

function clientKeys(req) {
  const id = String(req.get("x-anon-id") || "");
  return {
    user: "u:" + (/^[\w-]{8,64}$/.test(id) ? id : "none:" + req.ip),
    ip: "i:" + req.ip,
  };
}

function overLimit(req) {
  today();
  const k = clientKeys(req);
  return (
    (usage.get("global") || 0) >= GLOBAL_MINUTES * 60 ||
    (usage.get(k.user) || 0) >= USER_MINUTES * 60 ||
    (usage.get(k.ip) || 0) >= IP_MINUTES * 60
  );
}

function addUsage(req, seconds) {
  today();
  const k = clientKeys(req);
  for (const key of ["global", k.user, k.ip]) usage.set(key, (usage.get(key) || 0) + seconds);
}

function pickLang(value) {
  return I18N.LANGS.includes(value) ? value : "en";
}

// ---------- Groq ----------
async function groqChat(body) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const res = await fetch(GROQ_URL + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error("Groq " + res.status + ": " + (data?.error?.message || "unknown error"));
    err.status = res.status;
    throw err;
  }
  return data;
}

// Whisper often "hears" these in silence or noise.
const HALLUCINATIONS = /(thank(s| you) for watching|subtitles by|amara\.org|sottotitoli|sous-titr|субтитр|продолжение следует|字幕|请不吝点赞|订阅)/i;

app.post("/api/transcribe", express.raw({ type: "audio/wav", limit: "3mb" }), async (req, res) => {
  try {
    if (overLimit(req)) return res.status(429).json({ error: "limit" });
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length < 2000) return res.json({ text: "" });

    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not set");
    const lang = pickLang(req.query.lang);

    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/wav" }), "speech.wav");
    form.append("model", STT_MODEL);
    form.append("language", lang);
    form.append("response_format", "verbose_json");
    form.append("temperature", "0");

    const r = await fetch(GROQ_URL + "/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      body: form,
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error("Groq STT " + r.status + ": " + (data?.error?.message || "unknown error"));

    addUsage(req, (buf.length - 44) / 32000); // 16 kHz, 16-bit mono

    const segments = Array.isArray(data.segments) ? data.segments : null;
    let text = segments
      ? segments.filter((s) => !(s.no_speech_prob > 0.6)).map((s) => s.text).join(" ")
      : data.text || "";
    text = text.replace(/\s+/g, " ").trim();
    if (HALLUCINATIONS.test(text)) text = "";
    res.json({ text });
  } catch (err) {
    console.error("transcribe:", err.message);
    res.status(502).json({ error: "transcribe" });
  }
});

// ---------- search: Tavily first, Groq Compound as fallback ----------
async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || tavilyToday >= TAVILY_PER_DAY) return null;
  tavilyToday++;
  const r = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 5, include_answer: false }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data || !Array.isArray(data.results)) {
    console.error("tavily:", r.status, data?.detail?.error || data?.error || "");
    return null;
  }
  return {
    results: data.results.map((x) => {
      let site = "";
      try { site = new URL(x.url).hostname.replace(/^www\./, ""); } catch {}
      return {
        title: x.title || "",
        website: site,
        published: x.published_date || undefined,
        content: String(x.content || "").slice(0, 700),
      };
    }),
  };
}

async function compoundSearch(query) {
  const data = await groqChat({
    model: SEARCH_FALLBACK_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a web research assistant. Search the web and report the key facts you find. " +
          "For each fact give the website or organisation it comes from and the date if known. " +
          "Be factual and concise. Never invent anything; if you find nothing, say so.",
      },
      { role: "user", content: query },
    ],
  });
  return { report: String(data?.choices?.[0]?.message?.content || "").slice(0, 3000) };
}

async function webSearch(query) {
  try {
    const t = await tavilySearch(query);
    if (t && t.results.length) return t;
  } catch (err) {
    console.error("tavily:", err.message);
  }
  try {
    return await compoundSearch(query);
  } catch (err) {
    console.error("compound:", err.message);
    return { error: "Web search is not available right now. Tell the user you could not search." };
  }
}

// ---------- chat ----------
const TOOLS = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the internet for current, real information. Use it for recent events, products, prices, research, " +
        "organisations, assistive technology and inventions for blind people, or anything you are not sure about.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "The search query." } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "end_conversation",
      description: "End the conversation when the user says goodbye, stop, or that they are finished.",
      parameters: {
        type: "object",
        properties: { farewell: { type: "string", description: "A very short goodbye in the user's language." } },
      },
    },
  },
];

function systemPrompt(lang, context) {
  const date = new Date().toISOString().slice(0, 10);
  let p =
    `You are a friendly voice assistant on the website "Talk with Artificial Intelligence". ` +
    `The user is blind and talks to you by voice; your replies are read aloud by a speech synthesizer. Today's date is ${date}.\n` +
    `Language: reply in ${I18N.META[lang].english} unless the user clearly switches language; then reply in their language.\n` +
    `Style: short spoken answers of 2 to 5 sentences, then offer to go deeper. Plain sentences only: no lists, no markdown, ` +
    `no symbols, no emojis, no web addresses, no tables. Never say "as you can see" and never describe visuals. ` +
    `Write numbers and dates the way they are spoken.\n` +
    `Facts: use the web_search tool for anything about recent events, products, prices, research, studies, organisations, ` +
    `assistive technology and inventions for blind people, or anything you are not completely sure of. ` +
    `Say where information comes from in a spoken way, for example "According to the RNIB website, updated in March...". ` +
    `If you cannot find something, say so plainly. Never invent products, studies, names, dates, numbers or links. ` +
    `Clearly separate what is confirmed from what is only reported or announced.\n` +
    `Do not simply agree with the user; if the facts differ, correct them politely.\n` +
    `The user's words come from automatic speech recognition and may contain mistakes; if something is unclear, ask briefly. ` +
    `The text may sometimes contain screen reader words such as "button", "heading level 1", "browse mode", "focus mode", ` +
    `"link", or text from the web page. That is the screen reader, not the user: ignore it completely and do not reply to it.\n` +
    `When the user says goodbye, stop, or that they are finished, call end_conversation.\n` +
    `You are an AI. Never claim to be human.`;
  if (context) p += `\n\nSummary of an earlier conversation with this user, to continue from:\n${context}`;
  return p;
}

// Speech synthesizers read symbols literally; keep only plain text.
function forSpeech(text) {
  return String(text || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>|~]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMessages(list) {
  return (Array.isArray(list) ? list : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .filter((m) => m.content.trim());
}

app.post("/api/chat", express.json({ limit: "200kb" }), async (req, res) => {
  try {
    if (overLimit(req)) return res.status(429).json({ error: "limit" });
    const lang = pickLang(req.body?.lang);
    const context = String(req.body?.context || "").slice(0, 2000);
    const messages = [{ role: "system", content: systemPrompt(lang, context) }, ...cleanMessages(req.body?.messages).slice(-20)];

    let end = false;
    let farewell = "";
    for (let round = 0; round < 4; round++) {
      const lastRound = round === 3;
      let data;
      try {
        data = await groqChat({
          model: CHAT_MODEL,
          messages,
          tools: TOOLS,
          tool_choice: lastRound ? "none" : "auto",
          temperature: 0.5,
          reasoning_effort: "low",
          max_completion_tokens: 1200,
        });
      } catch (err) {
        // A malformed tool call: try once more without tools.
        if (err.status !== 400) throw err;
        data = await groqChat({ model: CHAT_MODEL, messages, temperature: 0.5, reasoning_effort: "low", max_completion_tokens: 1200 });
      }
      const msg = data?.choices?.[0]?.message || {};
      const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

      if (!calls.length) {
        return res.json({ reply: forSpeech(msg.content) || (end ? farewell : ""), end });
      }

      messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
      for (const call of calls) {
        let args = {};
        try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
        let result;
        if (call.function?.name === "end_conversation") {
          end = true;
          farewell = forSpeech(args.farewell) || I18N.t(lang, "farewell");
          result = { ok: true };
        } else if (call.function?.name === "web_search") {
          result = await webSearch(String(args.query || "").slice(0, 300));
        } else {
          result = { error: "Unknown tool." };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      if (end) {
        const spoken = forSpeech(msg.content);
        return res.json({ reply: spoken || farewell, end: true });
      }
    }
    res.json({ reply: "", end });
  } catch (err) {
    console.error("chat:", err.message);
    res.status(502).json({ error: "chat" });
  }
});

// ---------- summary for the on-device history ----------
app.post("/api/summary", express.json({ limit: "300kb" }), async (req, res) => {
  try {
    const lang = pickLang(req.body?.lang);
    const context = String(req.body?.context || "").slice(0, 2000);
    const convo = cleanMessages(req.body?.messages)
      .slice(-40)
      .map((m) => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
      .join("\n");
    if (!convo) return res.json({});

    const data = await groqChat({
      model: SUMMARY_MODEL,
      messages: [
        {
          role: "system",
          content:
            `Summarise the conversation in ${I18N.META[lang].english}. Reply with JSON only, in this form: ` +
            `{"topic": "one short line", "summary": "two to four sentences with the main questions, facts found and sources named"}.`,
        },
        { role: "user", content: (context ? "Earlier summary: " + context + "\n\n" : "") + convo },
      ],
      temperature: 0.2,
      reasoning_effort: "low",
      max_completion_tokens: 800,
    });
    const text = String(data?.choices?.[0]?.message?.content || "");
    let out = {};
    try { out = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)); } catch {}
    res.json({
      topic: forSpeech(out.topic).slice(0, 120),
      summary: forSpeech(out.summary || text).slice(0, 1200),
    });
  } catch (err) {
    console.error("summary:", err.message);
    res.status(502).json({ error: "summary" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
