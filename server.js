require("dotenv").config({ quiet: true });

const express = require("express");
const fs = require("fs");
const path = require("path");
const I18N = require("./public/i18n.js");
const LEGAL = require("./legal.js");
const ABOUT = require("./about.js");
const { limit, takeTavilySearch } = require("./limits.js");
const stats = require("./stats.js");
const qa = require("./synthetic-qa.js");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
// The base URLs can be changed only to test against stand-in services.
const GROQ_URL = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
const TAVILY_URL = process.env.TAVILY_BASE_URL || "https://api.tavily.com/search";

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
const SUMMARY_MODEL = process.env.GROQ_SUMMARY_MODEL || "openai/gpt-oss-20b";
// Used for an answer when Groq refuses the main model because of its rate limits
// (per minute or per day); each model has its own limits on Groq.
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-20b";
const STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo";
// Compound was retired on 2026-09-21. Never call it, even if an old Render
// environment variable still selects it. Other research models require opt-in.
const configuredSearchModel = process.env.GROQ_SEARCH_MODEL || "";
const retiredSearchModels = new Set(["groq/compound", "groq/compound-mini"]);
const SEARCH_FALLBACK_MODEL = retiredSearchModels.has(configuredSearchModel) ? "" : configuredSearchModel;
let searchFallbackBlocked = false;
// Natural AI voice, tried in this order:
// 1. Fish Audio (FISH_API_KEY) for all six languages, on its free developer model.
// 2. Groq Orpheus for English only.
// 3. Otherwise the browser uses the best voice on the device.
const TTS_MODEL = process.env.GROQ_TTS_MODEL || "canopylabs/orpheus-v1-english";
const TTS_VOICE = process.env.GROQ_TTS_VOICE || "hannah";
// Off unless GROQ_TTS=on: Orpheus needs its terms accepted on the Groq account, which the owner does not do.
const TTS_ENABLED = process.env.GROQ_TTS === "on";
const FISH_URL = process.env.FISH_BASE_URL || "https://api.fish.audio/v1/tts";
const FISH_MODEL = process.env.FISH_MODEL || "s2.1-pro-free";
// A voice from the Fish Audio voice library for each language (FISH_VOICE_IT, ...), or one for all (FISH_VOICE).
const fishVoice = (lang) => process.env["FISH_VOICE_" + lang.toUpperCase()] || process.env.FISH_VOICE || "";
// Set when Groq refuses Orpheus for this key (e.g. its terms were not accepted); then it is
// never called again until the server restarts, so it causes no more errors in the Groq logs.
let orpheusBlocked = false;
const orpheusUsable = () => TTS_ENABLED && !!process.env.GROQ_API_KEY && !orpheusBlocked;
const aiVoiceLangs = () =>
  process.env.FISH_API_KEY ? I18N.LANGS : orpheusUsable() ? ["en"] : [];

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

// Chat IDs grant access to temporary transcripts. Never cache API responses,
// including error responses; keep security headers on QA preflight failures too.
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.use(qa.middleware);
app.get("/api/qa", (req, res) => res.json({ version: 1, synthetic_only: true,
  primary_model: CHAT_MODEL, fallback_model: FALLBACK_MODEL, speech_model: STT_MODEL,
  budgets: qa.KEYS, output_voice_budgeted: false }));

// ---------- pages, rendered in the visitor's language ----------
const templates = {
  index: fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8"),
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
      key === "htmlLang" ? I18N.META[lang].html : key === "pageLang" ? lang : escapeHtml(I18N.t(lang, key))
    );
    if (name === "index" && req.method === "GET") stats.recordVisit();
    sendHtml(res, lang, html);
  };
}

function renderLegal(pages) {
  return (req, res) => {
    const lang = requestLang(req);
    const page = pages[lang] || pages.en;
    const fill = (text) =>
      escapeHtml(text)
        .replace(/\{owner\}/g, escapeHtml(process.env.OWNER_NAME || "Fabrice Brambilla"))
        .replace(/\{email\}/g, escapeHtml(process.env.OWNER_EMAIL || "brambillafabrice@gmail.com"));
    const links = LEGAL.POLICY_LINKS.map(([name, url]) => `<li><a href="${url}">${name}</a></li>`).join("");
    const body = page.sections
      // A list (one item per screen reader or command) is quicker to move through than a long paragraph.
      .map(([h, p], i) => `<h2>${fill(h)}</h2>\n` + (Array.isArray(p) ? `<ul>${p.map((x) => `<li>${fill(x)}</li>`).join("")}</ul>` : `<p>${fill(p)}</p>`) + (pages === LEGAL.PRIVACY && i === 5 ? `\n<ul>${links}</ul>` : ""))
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
// History is no longer saved; old links go to the main page.
app.get("/history", (req, res) => res.redirect(301, I18N.LANGS.includes(req.query.lang) ? "/?lang=" + req.query.lang : "/"));
app.get("/privacy", renderLegal(LEGAL.PRIVACY));
app.get("/accessibility", renderLegal(LEGAL.ACCESSIBILITY));
app.get("/about", (req, res) => {
  const lang = requestLang(req);
  sendHtml(res, lang, ABOUT.render(lang));
});
app.get("/organizations", (req, res) => {
  const lang = requestLang(req);
  sendHtml(res, lang, ABOUT.renderOrganizations(lang));
});
app.get("/index.html", (req, res) => res.redirect(301, "/"));
app.get("/history.html", (req, res) => res.redirect(301, "/"));
app.get("/health", (req, res) => res.status(200).send("ok"));
app.use(express.static(PUBLIC, { index: false }));

function pickLang(value) {
  return I18N.LANGS.includes(value) ? value : "en";
}

// Answers whether the visitor can start a conversation (costs nothing), and
// which languages have the natural AI voice.
// This endpoint does not record visitors or conversations.
app.get("/api/limit", limit({ seconds: 0, requests: 0, burst: false }), (req, res) => {
  res.json({ ok: true, aiVoice: aiVoiceLangs() });
});

// ---------- errors ----------
// Upstream error text can echo input or credentials. Never persist it in logs.
function logFailure(label, err = {}) {
  const status = Number.isInteger(err.status) && err.status >= 100 && err.status <= 599 ? ` (HTTP ${err.status})` : "";
  const kind = err.qaBudget ? "QA budget exhausted" : err.daily ? "daily limit" :
    err.name === "AbortError" ? "cancelled" : err.name === "TimeoutError" ? "timeout" : "request failed";
  console.error(`${label}: ${kind}${status}`);
}

// Groq's daily quota means "today's limit is used up"; per-minute limits and
// other failures are temporary, and the browser just asks the user to repeat.
function providerError(status, message, name) {
  const err = new Error(name + " " + status + ": " + (message || "unknown error"));
  err.status = status;
  err.daily = status === 429 && /per day|\bRPD\b|\bTPD\b|\bASD\b/i.test(message || "");
  return err;
}

function errorCode(err) {
  if (err.qaBudget) return { status: 429, error: "qa_budget" };
  if (err.daily) return { status: 429, error: "limit" };
  return { status: 503, error: "busy" };
}

function sendError(res, err, name) {
  logFailure(name, err);
  const e = errorCode(err);
  res.status(e.status).json({ error: e.error });
}

// ---------- Groq ----------
async function groqChat(body, timeoutMs = 30000, stop = null) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const ticket = qa.reserveModel(body, CHAT_MODEL, FALLBACK_MODEL);
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(GROQ_URL + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: stop ? AbortSignal.any([timeout, stop]) : timeout,
  });
  const data = await res.json().catch(() => null);
  qa.finishModel(ticket, data, res.status, res.headers.get("x-request-id"));
  if (!res.ok) throw providerError(res.status, data?.error?.message, "Groq");
  return data;
}

// The main chat model, or the fallback model when Groq says the main one is over a rate limit.
async function groqAnswer(body, stop) {
  try {
    return await groqChat(body, 30000, stop);
  } catch (err) {
    if (err.qaBudget || (qa.current() && err.status === 429) || err.status !== 429 || !FALLBACK_MODEL || body.model === FALLBACK_MODEL || stop?.aborted) throw err;
    console.warn(`chat: ${body.model} is over a Groq rate limit, answering with ${FALLBACK_MODEL}`);
    return await groqChat({ ...body, model: FALLBACK_MODEL }, 30000, stop);
  }
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
      // "auto": the language question, where we don't know the language yet.
      const auto = req.query.lang === "auto";

      const form = new FormData();
      form.append("file", new Blob([buf], { type: "audio/wav" }), "speech.wav");
      form.append("model", STT_MODEL);
      if (!auto) form.append("language", pickLang(req.query.lang));
      form.append("response_format", "verbose_json");
      form.append("temperature", "0");

      qa.audio(wavSeconds(buf));
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
      res.json(auto ? { text, language: String(data.language || "") } : { text });
    } catch (err) {
      sendError(res, err, "transcribe");
    }
  }
);

// ---------- natural voice ----------
async function fishSpeak(text, lang) {
  const body = { text, format: "mp3" };
  if (fishVoice(lang)) body.reference_id = fishVoice(lang);
  const r = await fetch(FISH_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.FISH_API_KEY, "Content-Type": "application/json", model: FISH_MODEL },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw providerError(r.status, (await r.text().catch(() => "")).slice(0, 200), "Fish TTS");
  return { type: "audio/mpeg", data: Buffer.from(await r.arrayBuffer()) };
}

async function groqSpeak(text) {
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
    // Refused for this key, not a passing problem: stop using it.
    if ([400, 401, 403, 404].includes(r.status) && /terms|permission|not (found|available)|does not exist|access/i.test(`${data?.error?.code} ${data?.error?.message}`)) {
      orpheusBlocked = true;
      console.warn("speak: Groq Orpheus is not available to this key; using other voices from now on.");
    }
    throw providerError(r.status, data?.error?.message, "Groq TTS");
  }
  return { type: "audio/wav", data: Buffer.from(await r.arrayBuffer()) };
}

app.post("/api/speak", express.json({ limit: "4kb" }), limit({ requests: 1 }), async (req, res) => {
  const text = String(req.body?.text || "").trim().slice(0, 400);
  const lang = pickLang(req.body?.lang);
  if (!text || !aiVoiceLangs().includes(lang)) return res.status(404).json({ error: "no voice" });
  let audio = null;
  if (process.env.FISH_API_KEY) {
    try { audio = await fishSpeak(text, lang); } catch (err) { logFailure("speak (Fish)", err); }
  }
  if (!audio && lang === "en" && orpheusUsable()) {
    try { audio = await groqSpeak(text); } catch (err) { logFailure("speak (Groq)", err); }
  }
  // The browser falls back to the device voice; this is never shown to the user.
  if (!audio) return res.status(503).json({ error: "busy" });
  res.set("Content-Type", audio.type);
  res.set("X-AI-Generated", "true");
  res.set("Cache-Control", "no-store");
  res.send(audio.data);
});

// ---------- search: Tavily first, optional configured research fallback ----------
async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !qa.searchAvailable() || !(await takeTavilySearch())) return null;
  qa.search();
  const r = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 5, include_answer: false }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data || !Array.isArray(data.results)) {
    logFailure("tavily", { status: r.status });
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
  if (!SEARCH_FALLBACK_MODEL || searchFallbackBlocked) return null;
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
    logFailure("tavily", err);
  }
  if (!qa.current() && SEARCH_FALLBACK_MODEL && !searchFallbackBlocked) {
    try {
      const result = await compoundSearch(query);
      if (result) return result;
    } catch (err) {
      // A missing/inaccessible model is configuration, not a transient outage.
      // Stop retrying it until restart, just as for unavailable speech models.
      if ([400, 401, 403, 404].includes(err.status) && /does not exist|not found|not available|access|permission/i.test(err.message)) {
        searchFallbackBlocked = true;
      }
      logFailure("search fallback", err);
    }
  }
  return { error: "Web search is not available right now. Tell the user you could not search." };
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

function systemPrompt(lang, context, agent = false) {
  const date = new Date().toISOString().slice(0, 10);
  let p =
    `You are a warm, patient voice assistant on the website "Talk with Artificial Intelligence". ` +
    `This interface is designed for spoken replies and screen-reader access; everything you write is read aloud. Today's date is ${date}.\n` +
    `Do not infer the user's health, disability, age or other personal attributes from their use of this service.\n` +
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
  if (agent) {
    p +=
      `\n\nThis conversation is different: you are being used through a text API, most likely by another AI agent or a ` +
      `developer testing the service, not by voice. Ignore the instructions above about speech, screen readers and spoken ` +
      `format; you may use plain text formatting and web addresses when useful. Everything else applies: be accurate, use ` +
      `web_search for anything current or uncertain, name your sources, and never invent facts.`;
  }
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

// One assistant turn, shared by the voice site and the agent API.
// Calls the model, runs any tools, and returns { text, end }.
// `stop` (an AbortSignal) cancels it; `onSearching` is called once when a web search starts;
// `agent` keeps the model's text as written instead of cleaning it for speech.
async function runChat({ lang, context = "", messages: history, stop = null, onSearching = () => {}, agent = false }) {
  const messages = [{ role: "system", content: systemPrompt(lang, context, agent) }, ...cleanMessages(history).slice(-20)];
  const clean = agent ? (t) => String(t || "").trim() : forSpeech;
  let end = false;
  let farewell = "";
  let announced = false;
  for (let round = 0; round < 4; round++) {
    if (stop?.aborted) throw stop.reason || new Error("stopped");
    const base = { model: CHAT_MODEL, messages, temperature: 0.6, reasoning_effort: "low", max_completion_tokens: 1200 };
    let data;
    try {
      data = await groqAnswer({ ...base, tools: TOOLS, tool_choice: round === 3 || qa.lastModelCall() ? "none" : "auto" }, stop);
    } catch (err) {
      // A malformed tool call: try once more without tools.
      if (err.status !== 400) throw err;
      data = await groqAnswer(base, stop);
    }
    const msg = data?.choices?.[0]?.message || {};
    const calls = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];

    if (!calls.length) return { text: clean(msg.content) || (end ? farewell : ""), end };

    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || "{}"); } catch {}
      let result;
      if (call.function?.name === "end_conversation") {
        end = true;
        farewell = clean(args.farewell) || I18N.t(lang, "farewell");
        result = { ok: true };
      } else if (call.function?.name === "web_search") {
        if (!announced) { onSearching(); announced = true; }
        if (stop?.aborted) throw stop.reason || new Error("stopped");
        result = await webSearch(String(args.query || "").slice(0, 300));
      } else {
        result = { error: "Unknown tool." };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
    if (end) return { text: clean(msg.content) || farewell, end: true };
  }
  return { text: "", end };
}

// The answer is streamed as lines of JSON so the browser can say
// "let me look that up" as soon as a search starts:
//   {"type":"searching"}  then  {"type":"reply","text":"...","end":false,"lang":"en"}  or  {"type":"error","error":"busy"|"limit"}
app.post("/api/chat", express.json({ limit: "200kb" }), limit({ requests: 1 }), async (req, res) => {
  // Reject empty/type-confused prompts before they can consume provider quota.
  const history = cleanMessages(req.body?.messages);
  if (!history.some(m => m.role === "user") ||
      (req.body?.context !== undefined && typeof req.body.context !== "string")) {
    return res.status(400).json({ error: "bad request" });
  }
  // Daily integer only, once per submitted voice question. Provider/tool
  // retries and the separate text API never pass this counting point.
  // Flagged tests are excluded even without a QA budget header. This cannot
  // establish whether an unflagged caller is human or deduplicate submissions.
  if (history.at(-1)?.role === "user" && !qa.current() &&
      req.get("x-qa-budget") === undefined &&
      String(req.get("x-synthetic-test") || "").toLowerCase() !== "true") {
    try { stats.recordQuestionSubmission(); }
    catch { console.error("stats: question counter unavailable"); }
  }
  res.set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  const send = (obj) => res.write(JSON.stringify(qa.decorate(obj)) + "\n");
  try {
    const lang = pickLang(req.body?.lang);
    const { text, end } = await runChat({
      lang,
      context: String(req.body?.context || "").slice(0, 2000),
      messages: history,
      onSearching: () => send({ type: "searching" }),
    });
    // The language the reply is actually written in, so the browser speaks it with a voice of
    // that language (the user may have asked for an answer in another language).
    send({ type: "reply", text, end, lang: I18N.detectLang(text, lang), ai_generated: true });
    res.end();
  } catch (err) {
    logFailure("chat", err);
    send({ type: "error", error: errorCode(err).error });
    res.end();
  }
});

// Hidden text API for AI agents (no page links to it; see agent.js).
require("./agent.js")(app, { runChat, limit, pickLang, errorCode, logFailure, LANGS: I18N.LANGS });

app.use((req, res) => res.status(404).type("text").send("Not found"));

// Never show stack traces or internals to visitors.
app.use((err, req, res, next) => {
  if (err.status !== 413 && err.status !== 400) logFailure("request", err);
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
    for (const m of [...new Set([CHAT_MODEL, FALLBACK_MODEL, SUMMARY_MODEL, STT_MODEL, ...(TTS_ENABLED ? [TTS_MODEL] : [])])]) {
      console.log(`check: Groq model ${m} ${ids.includes(m) ? "is available" : "is NOT available to this key"}`);
    }
  } catch (err) {
    logFailure("check: could not reach Groq", err);
  }
  console.log("check: Tavily key " + (process.env.TAVILY_API_KEY ? "is set" : "is missing"));
  if (retiredSearchModels.has(configuredSearchModel)) {
    console.warn("check: GROQ_SEARCH_MODEL selects retired Compound; that fallback is disabled.");
  }
  console.log("check: research fallback " + (SEARCH_FALLBACK_MODEL || "is disabled; web search needs Tavily"));
  console.log("check: Fish Audio key " + (process.env.FISH_API_KEY
    ? "is set: natural AI voice in all six languages" + (fishVoice("en") || process.env.FISH_VOICE_IT ? "" : " (no FISH_VOICE chosen, using Fish Audio's default)")
    : (TTS_ENABLED ? "is missing: natural AI voice in English only (Groq Orpheus), device voice for the other languages" : "is missing: device voice for all languages")));
  if (!process.env.OWNER_NAME || !process.env.OWNER_EMAIL) {
    console.log("check: using the confirmed Fabrice Brambilla privacy contact where an owner override is unset.");
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== "test") selfCheck();
});

