// Brazilian Portuguese (pt-BR, 2026-11-19), next to Portugal's (pt). Off until NEW_LANGUAGES includes pt-BR.
// The browser's region is respected (pt-BR → Brazilian, pt-PT → Portugal), and a Portuguese user is asked
// once "Portugal ou Brasil?" when both are switched on. Only local stand-in providers: no credits, no real audio.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http"), path = require("node:path"), fs = require("node:fs"), vm = require("node:vm");
const { spawn } = require("node:child_process");
const I = require("../public/i18n.js");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const i18nSource = fs.readFileSync(path.join(__dirname, "../public/i18n.js"), "utf8");

// i18n.js as the server loads it with a given NEW_LANGUAGES.
function i18nWith(newLanguages) {
  const c = { module: { exports: {} }, process: { env: { NEW_LANGUAGES: newLanguages } } };
  vm.runInNewContext(i18nSource, c);
  return c.module.exports;
}

const ALL = 3993, PT_ONLY = 3994, OFF = 3995, UPSTREAM = 3998;
const BR_REPLY = "Você pode acessar o arquivo na tela do celular. Estou procurando o contato da equipe.";
let servers = [], fake, sttBody = "", chatBody, ttsBody;
function start(port, newLanguages) {
  const env = { PATH: process.env.PATH, NODE_ENV: "test", PORT: String(port), GROQ_API_KEY: "fixture", GROQ_BASE_URL: `http://127.0.0.1:${UPSTREAM}`,
    TAVILY_API_KEY: "", FISH_API_KEY: "fixture", FISH_BASE_URL: `http://127.0.0.1:${UPSTREAM}/tts`, FISH_VOICE_PT_BR: "brazil-voice-fixture", FISH_VOICE_PT: "portugal-voice-fixture" };
  if (newLanguages) env.NEW_LANGUAGES = newLanguages;
  servers.push(spawn(process.execPath, [path.join(__dirname, "../server.js")], { env, stdio: "ignore" }));
}
async function ready(port) {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw Error("server did not start on " + port);
}
before(async () => {
  fake = http.createServer((req, res) => { const chunks = []; req.on("data", (d) => chunks.push(d)); req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    if (req.url.endsWith("/audio/transcriptions")) { sttBody = raw; return res.end(JSON.stringify({ text: "Oi, tudo bem?", language: "portuguese" })); }
    if (req.url === "/tts") { ttsBody = JSON.parse(raw); res.setHeader("Content-Type", "audio/mpeg"); return res.end(Buffer.from("ID3fixture")); }
    chatBody = JSON.parse(raw); res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: BR_REPLY } }] }));
  }); }).listen(UPSTREAM, "127.0.0.1");
  start(ALL, "nl,pt,pt-BR"); start(PT_ONLY, "nl,pt"); start(OFF, "");
  await Promise.all([ready(ALL), ready(PT_ONLY), ready(OFF)]);
});
after(async () => { for (const s of servers) s.kill(); if (fake) await new Promise((r) => fake.close(r)); });

test("the browser's region is respected: pt-BR gets Brazilian, pt-PT and bare pt get Portugal's", () => {
  const all = i18nWith("nl,pt,pt-BR");
  assert.ok(all.LANGS.includes("pt-BR"));
  assert.equal(all.pick(["pt-BR", "en"]), "pt-BR");
  assert.equal(all.pick(["pt_BR"]), "pt-BR");
  assert.equal(all.pick(["pt-PT"]), "pt");
  assert.equal(all.pick(["pt"]), "pt");
  // Only Portugal's switched on: a Brazilian browser still gets Portuguese, not English.
  const ptOnly = i18nWith("nl,pt");
  assert.ok(!ptOnly.LANGS.includes("pt-BR"));
  assert.equal(ptOnly.pick(["pt-BR"]), "pt");
  // Only Brazilian switched on: a Portugal browser gets Brazilian.
  assert.equal(i18nWith("pt-BR").pick(["pt-PT"]), "pt-BR");
  // Off by default.
  const off = i18nWith("");
  assert.ok(!off.LANGS.includes("pt-BR") && !off.LANGS.includes("pt"));
  assert.equal(off.pick(["pt-BR"]), "en");
});

test("every interface string exists in Brazilian Portuguese, in Brazilian wording", () => {
  assert.equal(I.META["pt-BR"].html, "pt-BR");
  assert.equal(I.META["pt-BR"].speech, "pt-BR");
  for (const key of Object.keys(I.S.en)) {
    assert.ok(I.S["pt-BR"][key], `pt-BR.${key} missing`);
    if (I.S.en[key].length > 12) assert.notEqual(I.S["pt-BR"][key], I.S.en[key], `pt-BR.${key} is still English`);
  }
  const all = Object.values(I.S["pt-BR"]).join(" ");
  assert.doesNotMatch(all, /ecrã|telemóvel|ficheiro|descarregar|utilizador|contacto|\bprima\b|premir|está a |percebi|auscultadores/i);
  // The question is in both variants, so it can be asked in either.
  for (const lang of ["pt", "pt-BR"]) assert.match(I.S[lang].askPtVariant, /Portugal[\s\S]*Brasil/);
});

test("a Brazilian browser gets the Brazilian page and both Portuguese buttons when both are on", async () => {
  const br = await fetch(`http://127.0.0.1:${ALL}/`, { headers: { "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" } });
  const html = await br.text();
  assert.equal(br.headers.get("content-language"), "pt-BR");
  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /data-set-lang="pt-BR">Português \(Brasil\)/);
  assert.match(html, /data-set-lang="pt">Português \(Portugal\)/);
  assert.match(html, /data-new-langs="nl pt pt-BR"/);
  const pt = await fetch(`http://127.0.0.1:${ALL}/`, { headers: { "Accept-Language": "pt-PT,pt;q=0.9" } });
  assert.match(await pt.text(), /<html lang="pt-PT">/);
  for (const page of ["/", "/about", "/organizations", "/privacy", "/terms", "/accessibility"]) {
    const r = await fetch(`http://127.0.0.1:${ALL}${page}?lang=pt-BR`);
    const body = await r.text();
    assert.equal(r.status, 200, page);
    assert.equal(r.headers.get("content-language"), "pt-BR", page);
    assert.doesNotMatch(body, /\{\{|undefined|ecrã|telemóvel|contacto/, page);
  }
});

test("with Brazilian off, a Brazilian browser gets Portugal's Portuguese (pt only) or English (all off)", async () => {
  const ptOnly = await (await fetch(`http://127.0.0.1:${PT_ONLY}/`, { headers: { "Accept-Language": "pt-BR" } })).text();
  assert.match(ptOnly, /<html lang="pt-PT">/);
  const off = await (await fetch(`http://127.0.0.1:${OFF}/`, { headers: { "Accept-Language": "pt-BR" } })).text();
  assert.match(off, /<html lang="en">/);
  assert.match(await (await fetch(`http://127.0.0.1:${OFF}/?lang=pt-BR`)).text(), /<html lang="en">/);
});

test("Brazilian chat: Brazilian instructions, answer not turned into Portugal's Portuguese, Brazilian voice", async () => {
  const r = await fetch(`http://127.0.0.1:${ALL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang: "pt-BR", messages: [{ role: "user", content: "Oi, tudo bem?" }] }) });
  const last = JSON.parse((await r.text()).trim().split("\n").at(-1));
  assert.equal(last.text, BR_REPLY);
  assert.equal(last.lang, "pt-BR");
  assert.match(chatBody.messages[0].content, /reply in Brazilian Portuguese[\s\S]*Write Brazilian Portuguese/);
  assert.doesNotMatch(chatBody.messages[0].content, /Portugal's Portuguese, not Brazilian/);
  // Portugal's Portuguese is still corrected on the same server.
  const p = await fetch(`http://127.0.0.1:${ALL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang: "pt", messages: [{ role: "user", content: "Olá" }] }) });
  assert.match(JSON.parse((await p.text()).trim().split("\n").at(-1)).text, /aceder|ecrã|telemóvel|contacto/);
  const s = await fetch(`http://127.0.0.1:${ALL}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang: "pt-BR", text: "Oi." }) });
  assert.equal(s.status, 200);
  assert.equal(ttsBody.reference_id, "brazil-voice-fixture");
});

test("Brazilian speech recognition sends Whisper the language pt, not pt-BR", async () => {
  const wav = Buffer.alloc(44 + 32000); wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(32000, 40);
  const r = await fetch(`http://127.0.0.1:${ALL}/api/transcribe?lang=pt-BR`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
  assert.equal(r.status, 200);
  assert.match(sttBody, /name="language"\r\n\r\npt\r\n/);
});

function commands(lang, saved = {}) {
  const c = vm.createContext({ lang, I: { LANGS: I.ALL_LANGS, pick: I.pick }, get: (k) => saved[k] || null, navigator: { languages: ["en"] } });
  vm.runInContext(app.slice(app.indexOf("  var GOODBYE"), app.indexOf("  // ---------- conversation controls")), c);
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  return c;
}

test("spoken: Portugal or Brazil can be named, and a question about Brazil is not a command", () => {
  const c = commands("en");
  assert.equal(c.voiceCommand("Fala português do Brasil"), "pt-BR");
  assert.equal(c.voiceCommand("Fala português de Portugal"), "pt");
  assert.equal(c.voiceCommand("Fala brasileiro"), "pt-BR");
  assert.equal(c.voiceCommand("Speak Brazilian Portuguese"), "pt-BR");
  assert.equal(c.voiceCommand("Speak European Portuguese"), "pt");
  assert.equal(c.voiceCommand("Fala-me do Brasil"), null);
  assert.equal(c.voiceCommand("Fale sobre o Brasil"), null);
  assert.equal(commands("pt-BR").voiceCommand("Fala português"), "pt-BR", "just \"português\" keeps the variant in use");
  assert.equal(commands("en", { ptVariant: "pt-BR" }).voiceCommand("Speak Portuguese"), "pt-BR", "else the one chosen before");
  assert.equal(c.ptVariantAnswer("Brasil."), "pt-BR");
  assert.equal(c.ptVariantAnswer("Do Brasil"), "pt-BR");
  assert.equal(c.ptVariantAnswer("Português de Portugal"), "pt");
  assert.equal(c.ptVariantAnswer("Europeu"), "pt");
  assert.equal(c.ptVariantAnswer("Não sei"), null);
  assert.equal(c.ptVariantAnswer("Qual é a diferença entre o Brasil e Portugal na língua?"), null);
});

function conversation(lang, langs, saved = {}) {
  const events = [], values = { ...saved };
  const c = vm.createContext({ IS_TOUCH: false, active: false, session: 0, lang, aiVoiceLangs: [], failures: 0, pendingTalk: false, choosing: false,
    transcript: [], context: "", lastSaid: "", alertBox: { textContent: "" }, window: { AudioWorkletNode: function () {}, AudioContext: function () {} },
    microphonePermissionState: async () => "granted", micBrowser: () => "Firefox", navigator: { mediaDevices: { getUserMedia() {} } },
    ensureContext() {}, showConversationControls() {}, setState() {}, I: { LANGS: langs },
    get: (k) => values[k], set: (k, v) => { values[k] = v; }, tt: (k) => I.t(c.lang, k), tk: (k) => I.t(c.lang, k),
    api: async () => ({ aiVoice: [] }), say: async (text) => { events.push(["say", text]); return false; },
    ensureMic: async () => {}, choosePortuguese: async () => { events.push(["question"]); c.lang = "pt-BR"; },
    sounds: { start() {} }, setTimeout: (f) => f(), goReady: () => events.push(["ready"]),
    closeMic() {}, announce() { throw Error("unexpected failure"); }, fail() { throw Error("unexpected failure"); } });
  vm.runInContext(app.slice(app.indexOf("  async function startConversation"), app.indexOf("  function endConversation")), c);
  return { c, events, values };
}

test("a Portuguese user is asked Portugal or Brazil once, before the instructions, when both are on", async () => {
  const both = ["en", "pt", "pt-BR"];
  const f = conversation("pt", both, { agreementHeard: "2026-11-15", introHeard: "1" });
  await f.c.startConversation();
  const q = f.events.findIndex((e) => e[0] === "question"), greet = f.events.findIndex((e) => e[0] === "say" && /Olá de novo/.test(e[1]));
  assert.ok(q !== -1 && greet > q, "question first, then the greeting in the chosen variant");
  for (const [lang, langs, saved] of [["pt", both, { ptVariant: "pt" }], ["pt", ["en", "pt"], {}], ["en", both, {}]]) {
    const g = conversation(lang, langs, saved);
    await g.c.startConversation();
    assert.equal(g.events.filter((e) => e[0] === "question").length, 0, `${lang} ${langs} ${JSON.stringify(saved)}`);
  }
});

test("the question records once, transcribes as Portuguese and remembers the answer", async () => {
  const values = {}, said = [], urls = [];
  const c = vm.createContext({ lang: "pt", session: 1, choosing: false, I: { LANGS: I.ALL_LANGS, pick: I.pick }, navigator: { languages: [] },
    get: (k) => values[k], set: (k, v) => { values[k] = v; }, tt: (k) => I.t(c.lang, k),
    say: async (t) => { said.push(t); return false; }, recordOnce: async () => "wav", startThinking() {}, stopThinking() {}, renderTexts() {},
    api: async (url) => { urls.push(url); return { text: "Do Brasil." }; } });
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  vm.runInContext(app.slice(app.indexOf("  async function choosePortuguese"), app.indexOf("  async function handleUtterance")), c);
  await c.choosePortuguese(1);
  assert.equal(said[0], I.S.pt.askPtVariant);
  assert.deepEqual(urls, ["/api/transcribe?lang=pt"]);
  assert.equal(c.lang, "pt-BR");
  assert.equal(values.lang, "pt-BR");
  assert.equal(values.ptVariant, "pt-BR");
  assert.equal(c.choosing, false);
});

test("the Brazilian voice is preferred for Brazilian Portuguese, and Portugal's for Portugal", () => {
  const c = vm.createContext({ I, voices: [{ lang: "pt-PT", name: "Microsoft Raquel Online (Natural)" }, { lang: "pt-BR", name: "Microsoft Francisca Online (Natural)" }] });
  vm.runInContext(app.slice(app.indexOf("  var NICE_VOICES"), app.indexOf("  function splitSentences")), c);
  assert.match(c.pickVoice("pt-BR").name, /Francisca/);
  assert.match(c.pickVoice("pt").name, /Raquel/);
});
