// Portuguese (Portugal, pt-PT) ready for review: answers in pt-PT, spoken commands, speech recognition.
// Only local stand-in providers. Never consumes API credits.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http"), path = require("node:path"), fs = require("node:fs"), vm = require("node:vm");
const { spawn } = require("node:child_process");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const I = require("../public/i18n.js");
const ON = 3988, OFF = 3989, UPSTREAM = 3990;
const BRAZILIAN = "Para acessem o arquivo, o senhor está fazendo isso na tela do celular. Estou procurando o contato da equipe.";
let fake, on, off, sttBody = "";

function start(port, langs) {
  return spawn(process.execPath, [path.join(__dirname, "../server.js")], { stdio: "ignore", env: { PATH: process.env.PATH, NODE_ENV: "test",
    PORT: String(port), GROQ_API_KEY: "fixture", GROQ_BASE_URL: `http://127.0.0.1:${UPSTREAM}`, TAVILY_API_KEY: "", NEW_LANGUAGES: langs } });
}
async function ready(base) {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base + "/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("server did not start");
}
before(async () => {
  fake = http.createServer((req, res) => { const chunks = []; req.on("data", (d) => chunks.push(d)); req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    if (req.url.endsWith("/audio/transcriptions")) { sttBody = raw; return res.end(JSON.stringify({ text: "Olá, bom dia.", language: "portuguese" })); }
    res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: BRAZILIAN } }] }));
  }); }).listen(UPSTREAM, "127.0.0.1");
  on = start(ON, "nl,pt"); off = start(OFF, "");
  await ready(`http://127.0.0.1:${ON}`); await ready(`http://127.0.0.1:${OFF}`);
});
after(async () => { on?.kill(); off?.kill(); if (fake) await new Promise((r) => fake.close(r)); });

async function chat(port, lang) {
  const r = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang, messages: [{ role: "user", content: "Como é que acedo ao site da biblioteca?" }] }) });
  return JSON.parse((await r.text()).trim().split("\n").at(-1));
}

test("Brazilian forms are found, and the certain ones are changed to Portugal's Portuguese", () => {
  const { brazilianForms, toPortugal } = require("../pt-pt.js");
  assert.equal(toPortugal("Para acessem o site, está fazendo isso na tela do celular."), "Para acedam o site, está a fazer isso no ecrã do telemóvel.");
  assert.equal(toPortugal("Estou procurando o contato da equipe. Os usuários registrados."), "Estou a procurar o contacto da equipa. Os utilizadores registados.");
  assert.equal(toPortugal("De fato, os ônibus e o trem. Está pondo a mesa."), "De facto, os autocarros e o comboio. Está a pôr a mesa.");
  // Not gerunds, not Brazilian, or not certain: left as they are.
  for (const same of ["O tempo está lindo.", "Onde estava quando ligou?", "A membrana celular.", "Quer baixar o volume?", "Você pode ver o arquivo."])
    assert.equal(toPortugal(same), same);
  assert.deepEqual(brazilianForms("Você pode baixar o arquivo.").sort(), ["arquivo", "baixar", "você"]);
  assert.deepEqual(brazilianForms("Está bem, vou procurar no ecrã do telemóvel."), []);
});

test("the instructions spell out Portugal's words, 'estar a' and polite address without 'você'", () => {
  const c = { I18N: I };
  vm.runInNewContext(source.slice(source.indexOf("function systemPrompt("), source.indexOf("function forSpeech(")), c);
  const p = c.systemPrompt("pt", "");
  for (const w of ['"ficheiro"', '"descarregar"', '"acedam"', '"está a fazer"', '"diga-me"', 'without "você"', "Portugal's Portuguese, not Brazilian"])
    assert.ok(p.includes(w), w);
  assert.doesNotMatch(c.systemPrompt("en", ""), /ficheiro/);
});

test("switched on: a Portuguese answer reaches the user in pt-PT", async () => {
  const last = await chat(ON, "pt");
  assert.equal(last.lang, "pt");
  assert.match(last.text, /acedam/); assert.match(last.text, /no ecrã do telemóvel/); assert.match(last.text, /está a fazer/);
  assert.match(last.text, /Estou a procurar o contacto da equipa/);
  assert.doesNotMatch(last.text, /acessem|na tela|fazendo|contato|equipe/);
});

test("switched off: nothing changes (Portuguese is not offered, the text is left alone)", async () => {
  const last = await chat(OFF, "pt");
  assert.equal(last.text, BRAZILIAN.replace(/\s+/g, " "));
});

test("speech recognition sends Whisper the code pt when Portuguese is on, and never when it is off", async () => {
  const wav = Buffer.alloc(44 + 32000); wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(32000, 40);
  const send = (port) => fetch(`http://127.0.0.1:${port}/api/transcribe?lang=pt`, { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
  assert.equal((await send(ON)).status, 200); assert.match(sttBody, /name="language"\r\n\r\npt\r\n/);
  assert.equal((await send(OFF)).status, 200); assert.match(sttBody, /name="language"\r\n\r\nen\r\n/);
});

test("spoken commands in Portugal's everyday and polite forms", () => {
  const c = vm.createContext({ lang: "pt", I: { LANGS: I.ALL_LANGS } });
  vm.runInContext(app.slice(app.indexOf("  var GOODBYE"), app.indexOf("  // ---------- conversation controls")), c);
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  const cases = [["Diga outra vez", "repeat"], ["Pode repetir isso?", "repeat"], ["O que é que disse?", "repeat"], ["Outra vez, por favor", "repeat"],
    ["Repete as instruções", "help"], ["Como funciona?", "help"], ["O que é que posso dizer?", "help"],
    ["Mostre a última resposta", "show"], ["Mostre-me a resposta", "show"], ["Esconda a resposta", "hide"], ["Oculte a resposta", "hide"],
    ["Mude de microfone", "mic"], ["Use outro microfone", "mic"], ["Troque o microfone", "mic"],
    ["Mude de língua", "ask"], ["Muda de idioma", "ask"], ["Fale-me em inglês", "en"], ["Fala-me em português", "pt"],
    ["Responda em francês, por favor", "fr"], ["Passa para italiano", "it"]];
  for (const [phrase, want] of cases) assert.equal(c.voiceCommand(phrase), want, phrase);
  // Questions still go to the assistant.
  assert.equal(c.voiceCommand("Como se diz obrigado em inglês?"), null);
  for (const bye of ["Xau", "Até amanhã", "Obrigado, até já"]) assert.equal(c.isGoodbye(bye), true, bye);
  assert.equal(c.isGoodbye("Até amanhã de manhã vai chover em Viseu?"), false);
  assert.equal(c.matchLanguage("Português", "portuguese"), "pt");
  assert.equal(c.matchLanguage("olá", "portuguese"), "pt", "a short answer recognised as Portuguese by Whisper");
});
