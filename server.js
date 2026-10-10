require("dotenv").config({ quiet: true });

const express = require("express");
const fs = require("fs");
const path = require("path");
const I18N = require("./public/i18n.js");
const LEGAL = require("./legal.js");
const { limit, takeTavilySearch } = require("./limits.js");
const stats = require("./stats.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
// The base URLs can be changed only to test against stand-in services.
const GROQ_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const TAVILY_URL = process.env.TAVILY_BASE_URL || "https://api.tavily.com/search";

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
const SUMMARY_MODEL = process.env.GROQ_SUMMARY_MODEL || "openai/gpt-oss-20b";
const STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
const SEARCH_FALLBACK_MODEL = process.env.GROQ_SEARCH_MODEL || "groq/compound";
// Natural AI voice. Groq's voice models only speak English; other languages use the device voice.
const TTS_MODEL = process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english";
const TTS_VOICE = process.env.GROQ_TTS_VOICE || "hannah";
const TTS_ENABLED = process.env.GROQ_TTS !== "off";

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; " +
      "media-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "microphone=(self), camera=(), geolocation=()",
    "Strict-Transport-Security": "max-age=31536000",
  });
  next();
});

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

// ?lang=xx (from the site's own links) wins over the browser's language.
function requestLang(req) {
  return I18N.LANGS.includes(req.query.lang) ? req.query.lang : langFromHeader(req.get("accept-language"));
}

function sendHtml(res, lang, html) {
  res.set("Content-Language", I18N.META[lang].html);
  res.set("Cache-Control", "no-cache");
  res.type("html").send(html);
}

function renderPage(name) {
  return (req, res) => {
    const lang = requestLang(req);
    const html = templates[name].replace(/\{\{(\w+)\}\}/g, (_, key) =>
      key === "htmlLang" ? I18N.META[lang].html : escapeHtml(I18N.t(lang, key))
    );
    sendHtml(res, lang, html);
  };
}

function renderLegal(pages) {
  return (req, res) => {
    const lang = requestLang(req);
    const page = pages[lang] || pages.en;
    const fill = (text) =>
      escapeHtml(text)
        .replace(/\{owner\}/g, escapeHtml(process.env.OWNER_NAME || "the owner of this website"))
        .replace(/\{email\}/g, escapeHtml(process.env.OWNER_EMAIL || "(contact address not set yet)"));
    const links = LEGAL.POLICY_LINKS.map(([name, url]) => `<li><a href="${url}">${name}</a></li>`).join("");
    const body = page.sections
      .map(([h, p], i) => `<h2>${fill(h)}</h2>\n<p>${fill(p)}</p>` + (pages === LEGAL.PRIVACY && i === 5 ? `\n<ul>${links}</ul>` : ""))
      .join("\n");
    const html = `<!doctype html>
<html lang="${I18N.META[lang].html}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <main class="history">
    <h1>${escapeHtml(page.h1)}</h1>
    <p><a href="/?lang=${lang}">${escapeHtml(page.back)}</a></p>
${body}
    <p>${escapeHtml(page.updated)} ${LEGAL.UPDATED}</p>
  </main>
</body>
</html>`;
    sendHtml(res, lang, html);
  };
}

// Private usage statistics (beacons and the password-protected /stats page).
app.use(stats.router);

app.get("/", renderPage("index"));
app.get("/history", renderPage("history"));
app.get("/privacy", renderLegal(LEGAL.PRIVACY));
app.get("/accessibility", renderLegal(LEGAL.ACCESSIBILITY));
app.get("/index.html", (req, res) => res.redirect(301, "/"));
app.get("/history.html", (req, res) => res.redirect(301, "/history"));
app.get("/health", (req, res) => res.status(200).send("ok"));
app.use(express.static(PUBLIC, { index: false }));

function pickLang(value) {
  return I18N.LANGS.includes(value) ? value : "en";
}

// Answers whether the visitor can start a conversation (costs nothing), and
// which languages have the natural AI voice.
app.get("/api/limit", limit({ seconds: 0, requests: 0, burst: false }), (req, res) =>
  res.json({ ok: true, aiVoice: TTS_ENABLED && !!process.env.GROQ_API_KEY ? ["en"] : [] })
);

// ---------- errors ----------
// Groq's daily quota means "today's limit is used up"; per-minute limits and
// other failures are temporary, and the browser just asks the user to repeat.
function providerError(status, message, name) {
  const err = new Error(name + " " + status + ": " + (message || "unknown error"));
  err.status = status;
  err.daily = status === 429 && /per day|\bRPD\b|\bTPD\b|\bASD\b/i.test(message || "");
  return err;
}

function errorCode(err) {
  if (err.daily) return { status: 429, error: "limit" };
  return { status: 503, error: "busy" };
}

function sendError(res, err, name) {
  console.error(name + ":", err.message);
  const e = errorCode(err);
  res.status(e.status).json({ error: e.error });
}

// ---------- Groq ----------
async function groqChat(body, timeoutMs = 30000) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const res = await fetch(GROQ_URL + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw providerError(res.status, data?.error?.message, "Groq");
  return data;
}

// Whisper often "hears" these in silence or noise.
const HALLUCINATIONS = /(thank(s| you) for watching|subtitles by|amara\.org|sottotitoli|sous-titr|субтитр|продолжение следует|字幕|请不吝点赞|订阅)/i;

// Only plain 16 kHz, 16-bit mono PCM WAV is accepted, so the length in bytes
// gives the exact duration that is charged against the limits.
function wavSeconds(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 44 || buf.length > 1100000) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  if (buf.toString("ascii", 12, 16) !== "fmt " || buf.toString("ascii", 36, 40) !== "data") return null;
  if (buf.readUInt16LE(20) !== 1 || buf.readUInt16LE(22) !== 1 || buf.readUInt32LE(24) !== 16000 || buf.readUInt16LE(34) !== 16) return null;
  if (buf.readUInt32LE(40) !== buf.length - 44) return null;
  return (buf.length - 44) / 32000;
}

app.post(
  "/api/transcribe",
  express.raw({ type: "audio/wav", limit: "1100kb" }),
  limit((req) => {
    const seconds = wavSeconds(req.body);
    return seconds === null ? null : { seconds };
  }),
  async (req, res) => {
    try {
      const buf = req.body;
      if (buf.length < 2000) return res.json({ text: "" });

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
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw providerError(r.status, data?.error?.message, "Groq STT");

      const segments = Array.isArray(data.segments) ? data.segments : null;
      let text = segments
        ? segments.filter((s) => !(s.no_speech_prob > 0.6)).map((s) => s.text).join(" ")
        : data.text || "";
      text = text.replace(/\s+/g, " ").trim();
      if (HALLUCINATIONS.test(text)) text = "";
      res.json({ text });
    } catch (err) {
      sendError(res, err, "transcribe");
    }
  }
);

// ---------- natural voice (English) ----------
app.post("/api/speak", express.json({ limit: "4kb" }), limit({ requests: 1 }), async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim().slice(0, 400);
    if (!TTS_ENABLED || pickLang(req.body?.lang) !== "en" || !text) return res.status(404).json({ error: "no voice" });
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY is not set");
    const r = await fetch(GROQ_URL + "/audio/speech", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TTS_MODEL, voice: TTS_VOICE, input: text, response_format: "wav" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      throw providerError(r.status, data?.error?.message, "Groq TTS");
    }
    res.set("Content-Type", "audio/wav");
    res.set("Cache-Control", "no-store");
    res.send(Buffer.from(await r.arrayBuffer()));
  } catch (err) {
    // The browser falls back to the device voice; this is never shown to the user.
    console.error("speak:", err.message);
    res.status(503).json({ error: "busy" });
  }
});

// ---------- search: Tavily first, Groq Compound as fallback ----------
async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !(await takeTavilySearch())) return null;
  const r = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 5, include_answer: false }),
    signal: AbortSignal.timeout(15000),
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
        properties: { farewell: { type: "string", description: "A very short, warm goodbye in the user's language." } },
      },
    },
  },
];

function systemPrompt(lang, context) {
  const date = new Date().toISOString().slice(0, 10);
  let p =
    `You are a warm, patient voice assistant on the website "Talk with Artificial Intelligence". ` +
    `The user is blind or visually impaired and talks to you by voice; everything you write is read aloud. Today's date is ${date}.\n` +
    `Language: reply in ${I18N.META[lang].english} unless the user clearly switches language; then reply in their language.\n` +
    `How to talk: like a kind, knowledgeable friend on the phone. Use natural, everyday spoken language, short sentences and ` +
    `contractions where the language has them. Answer in 2 to 4 sentences, then, when useful, offer to say more or ask one short ` +
    `follow-up question. Remember what was said earlier in the conversation. Don't start with filler like "Great question" or ` +
    `"Certainly", and don't repeat the question back. If the user just chats, chat back naturally.\n` +
    `Spoken format only: no lists, no headings, no markdown, no symbols, no emojis, no web addresses, no tables. ` +
    `Never say "as you can see" and never describe visuals. Write numbers, dates and units the way people say them aloud.\n` +
    `Facts: use the web_search tool for anything about recent events, products, prices, research, studies, organisations, ` +
    `assistive technology and inventions for blind people, or anything you are not completely sure of. ` +
    `Say where information comes from in a spoken way, for example "According to the RNIB website, updated in March...". ` +
    `If you cannot find something, say so plainly. Never invent products, studies, names, dates, numbers or links. ` +
    `Clearly separate what is confirmed from what is only reported or announced. For health, legal or money questions, ` +
    `give general information and suggest checking with a professional.\n` +
    `Do not simply agree with the user; if the facts differ, correct them politely.\n` +
    `The user's words come from automatic speech recognition and may contain mistakes; if something is unclear, ask briefly. ` +
    `The text may sometimes contain screen reader words such as "button", "heading level 1", "browse mode", "focus mode", ` +
    `"link", or text from the web page. That is the screen reader, not the user: ignore it completely and do not reply to it.\n` +
    `When the user says goodbye, stop, or that they are finished, call end_conversation.\n` +
    `You are an artificial intelligence. If asked, say so clearly, and never claim to be human.`;
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

// The answer is streamed as lines of JSON so the browser can say
// "let me look that up" as soon as a search starts:
//   {"type":"searching"}  then  {"type":"reply","text":"...","end":false}  or  {"type":"error","error":"busy"|"limit"}
app.post("/api/chat", express.json({ limit: "200kb" }), limit({ requests: 1 }), async (req, res) => {
  res.set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const send = (obj) => res.write(JSON.stringify(obj) + "\n");
  try {
    const lang = pickLang(req.body?.lang);
    const context = String(req.body?.context || "").slice(0, 2000);
    const messages = [{ role: "system", content: systemPrompt(lang, context) }, ...cleanMessages(req.body?.messages).slice(-20)];

    let end = false;
    let farewell = "";
    let announced = false;
    for (let round = 0; round < 4; round++) {
      const base = { model: CHAT_MODEL, messages, temperature: 0.6, reasoning_effort: "low", max_completion_tokens: 1200 };
      let data;
      try {
        data = await groqChat({ ...base, tools: TOOLS, tool_choice: round === 3 ? "none" : "auto" });
      } catch (err) {
        // A malformed tool call: try once more without tools.
        if (err.status !== 400) throw err;
        data = await groqChat(base);
      }
      const msg = data?.choices?.[0]?.message || {};
      const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

      if (!calls.length) {
        send({ type: "reply", text: forSpeech(msg.content) || (end ? farewell : ""), end });
        return res.end();
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
          if (!announced) { send({ type: "searching" }); announced = true; }
          result = await webSearch(String(args.query || "").slice(0, 300));
        } else {
          result = { error: "Unknown tool." };
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
      if (end) {
        send({ type: "reply", text: forSpeech(msg.content) || farewell, end: true });
        return res.end();
      }
    }
    send({ type: "reply", text: "", end });
    res.end();
  } catch (err) {
    console.error("chat:", err.message);
    send({ type: "error", error: errorCode(err).error });
    res.end();
  }
});

// ---------- summary for the on-device history ----------
app.post("/api/summary", express.json({ limit: "300kb" }), limit({ requests: 1 }), async (req, res) => {
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
    sendError(res, err, "summary");
  }
});

// Never show stack traces or internals to visitors.
app.use((err, req, res, next) => {
  if (err.status !== 413 && err.status !== 400) console.error("request:", err.message);
  res.status(err.status === 413 || err.status === 400 ? err.status : 500).json({ error: "request" });
});

// ---------- start-up check, so problems show in the Render logs ----------
async function selfCheck() {
  if (!process.env.GROQ_API_KEY) return console.error("check: GROQ_API_KEY is missing. Add it in Render > Environment.");
  try {
    const r = await fetch(GROQ_URL + "/models", {
      headers: { Authorization: "Bearer " + process.env.GROQ_API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return console.error("check: Groq refused the key (HTTP " + r.status + "). Check GROQ_API_KEY.");
    const ids = ((await r.json())?.data || []).map((m) => m.id);
    for (const m of [CHAT_MODEL, SUMMARY_MODEL, STT_MODEL, TTS_MODEL]) {
      console.log(`check: Groq model ${m} ${ids.includes(m) ? "is available" : "is NOT available to this key"}`);
    }
  } catch (err) {
    console.error("check: could not reach Groq:", err.message);
  }
  console.log("check: Tavily key " + (process.env.TAVILY_API_KEY ? "is set" : "is missing (searches will use Groq)"));
  if (!process.env.OWNER_NAME || !process.env.OWNER_EMAIL) {
    console.warn("check: OWNER_NAME / OWNER_EMAIL are not set; the privacy notice needs them.");
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== "test") selfCheck();
});
