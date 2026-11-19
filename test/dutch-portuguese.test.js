// F: Dutch and Portuguese (Portugal). Complete in every part of the site, but offered only when the
// owner switches them on with NEW_LANGUAGES=nl,pt, after listening to recognition and voice.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I = require("../public/i18n.js");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const NEW = ["nl", "pt"];

function start(port, env) {
  const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), GROQ_API_KEY: "", TAVILY_API_KEY: "", NEW_LANGUAGES: "", ...env }, stdio: "ignore" });
  return server;
}
async function ready(base) {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(base + "/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("server did not start");
}
const OFF = 3981, ON = 3982;
let off, on;
before(async () => { off = start(OFF, {}); on = start(ON, { NEW_LANGUAGES: "nl,pt" }); await ready(`http://127.0.0.1:${OFF}`); await ready(`http://127.0.0.1:${ON}`); });
after(() => { off.kill(); on.kill(); });

test("every interface string exists in Dutch and Portuguese and is really translated", () => {
  assert.deepEqual(I.GATED, [...NEW, "pt-BR"]); // pt-BR (2026-11-19) has its own switch; see brazilian-portuguese.test.js
  for (const lang of NEW) {
    assert.ok(I.META[lang]);
    for (const key of Object.keys(I.S.en)) {
      assert.ok(I.S[lang][key], `${lang}.${key} missing`);
      if (I.S.en[key].length > 12) assert.notEqual(I.S[lang][key], I.S.en[key], `${lang}.${key} is still English`);
    }
  }
  assert.equal(I.META.pt.speech, "pt-PT", "Portugal, as the owner chose");
  assert.equal(I.META.nl.speech, "nl-NL");
});

test("every page has a Dutch and a Portuguese version", () => {
  const legal = require("../legal.js"), about = require("../about.js");
  for (const lang of NEW) {
    for (const page of [legal.TERMS, legal.PRIVACY, legal.ACCESSIBILITY]) {
      assert.ok(page[lang] && page[lang].sections.length === page.en.sections.length, lang);
    }
    assert.ok(about.PAGES[lang]);
    for (const key of Object.keys(about.PAGES.en)) assert.ok(about.PAGES[lang][key], `about ${lang}.${key}`);
    // The additions every notice carries (remembered microphone, page reading, text of answers).
    assert.match(legal.PRIVACY[lang].sections[2][1], /Tavily[\s\S]*Tavily[\s\S]*20/);
    assert.match(legal.PRIVACY[lang].sections[3][1], /Starten|Iniciar/);
  }
});

test("switched off (the default): not offered on the page, by the server or by voice", async () => {
  // Test the off configuration independently of the outer suite configuration.
  const offModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/i18n.js"), "utf8"),
    { module: offModule, process: { env: { NEW_LANGUAGES: "" } } });
  const offI = offModule.exports;
  assert.deepEqual(Array.from(offI.LANGS).filter((l) => NEW.includes(l)), []);
  const html = await (await fetch(`http://127.0.0.1:${OFF}/?lang=nl`, { headers: { "Accept-Language": "nl-NL,nl;q=0.9" } })).text();
  assert.match(html, /<html lang="en">/, "a Dutch browser gets the default language");
  assert.match(html, /data-new-langs=""/);
  assert.match(app, /if \(I\.LANGS\.indexOf\(all\[i\]\.getAttribute\("data-set-lang"\)\) === -1\) all\[i\]\.parentNode\.removeChild\(all\[i\]\);/);
  const terms = await (await fetch(`http://127.0.0.1:${OFF}/terms?lang=pt`)).text();
  assert.doesNotMatch(terms, /Termos/);
  const c = vm.createContext({ lang: "en", I: { LANGS: offI.LANGS } });
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  assert.equal(c.matchLanguage("Nederlands"), null);
  assert.notEqual(c.voiceCommand("Speak Dutch"), "nl");
});

test("switched on: pages in Dutch and Portuguese, buttons kept, the browser's language followed", async () => {
  const base = `http://127.0.0.1:${ON}`;
  const nl = await (await fetch(base + "/", { headers: { "Accept-Language": "nl-BE,nl;q=0.9" } })).text();
  assert.match(nl, /<html lang="nl">/);
  assert.match(nl, /data-new-langs="nl pt"/);
  assert.match(nl, />Gesprek starten</);
  assert.match(nl, /<button type="button" lang="pt-PT" data-set-lang="pt">Português \(Portugal\)<\/button>/);
  const pt = await (await fetch(base + "/?lang=pt")).text();
  assert.match(pt, /<html lang="pt-PT">/);
  assert.match(pt, />Iniciar conversa</);
  assert.doesNotMatch(pt + nl, /\{\{/);
  for (const page of ["/privacy", "/terms", "/accessibility", "/about"]) {
    for (const lang of NEW) {
      const r = await fetch(base + page + "?lang=" + lang);
      assert.equal(r.status, 200, page + lang);
      assert.equal(r.headers.get("content-language"), I.META[lang].html, page + lang);
    }
  }
});

test("spoken commands and language switching work in Dutch and Portuguese", () => {
  const c = vm.createContext({ lang: "nl", I: { LANGS: I.ALL_LANGS, pick: I.pick }, get: () => null, navigator: { languages: ["nl-NL"] } });
  vm.runInContext(app.slice(app.indexOf("  var GOODBYE"), app.indexOf("  // ---------- conversation controls")), c);
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  const cases = [["Spreek Nederlands", "nl"], ["Speak Dutch", "nl"], ["Fala português, por favor", "pt"], ["Parla portoghese", "pt"],
    ["オランダ語で話して", "nl"], ["说葡萄牙语", "pt"], ["Spreek Engels", "en"], ["Fale inglês", "en"], ["Taal wijzigen", "ask"],
    ["Mudar de língua", "ask"], ["Herhaal", "repeat"], ["Repete", "repeat"], ["Microfoon wijzigen", "mic"], ["Mudar de microfone", "mic"],
    ["Laatste antwoord tonen", "show"], ["Mostra a última resposta", "show"], ["Verberg het antwoord", "hide"], ["Esconde a resposta", "hide"],
    ["Hulp", "help"], ["Ajuda", "help"]];
  for (const [phrase, want] of cases) assert.equal(c.voiceCommand(phrase), want, phrase);
  assert.equal(c.voiceCommand("Wat is de hoofdstad van Nederland?"), null);
  assert.equal(c.isGoodbye("Tot ziens"), true);
  assert.equal(c.isGoodbye("Adeus"), true);
  assert.equal(c.matchLanguage("ja", "dutch"), "nl", "a one-word answer in Dutch to the language question");
});

test("replies in Dutch or Portuguese are spoken with a Dutch or Portuguese voice", () => {
  assert.equal(I.detectLang("Het weer is vandaag mooi en ik ga met de fiets naar de stad.", "en"), "nl");
  assert.equal(I.detectLang("O tempo hoje está bom e eu vou para a cidade com a minha família.", "en"), "pt");
  assert.equal(I.detectLang("Il tempo oggi è bello e vado in città con la mia famiglia.", "en"), "it");
  assert.equal(I.detectLang("The weather is nice today and I am going to the city.", "nl"), "en");
  const c = vm.createContext({ I });
  vm.runInContext(app.slice(app.indexOf("  // Voices known to sound natural"), app.indexOf("  function pickVoice(code)")) +
    app.slice(app.indexOf("  function pickVoice(code)"), app.indexOf("\n  }\n", app.indexOf("  function pickVoice(code)")) + 4), c);
  c.voices = [{ lang: "pt-BR", name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)" }, { lang: "pt-PT", name: "Joana" }];
  assert.equal(c.pickVoice("pt").lang, "pt-PT", "Portugal before a better-sounding Brazilian voice");
});

test("research words in Dutch and Portuguese trigger live search and page reading", () => {
  const c = {};
  vm.runInNewContext(source.slice(source.indexOf("function liveResearchPlan("), source.indexOf("function unsupportedAction(")), c);
  const plan = (q) => c.liveResearchPlan([{ role: "user", content: q }], "2026-11-15");
  assert.equal(plan("Hoe is het weer morgen in Utrecht?").required, true);
  assert.equal(plan("Kun je dat weer zeggen?").required, false, "'weer' as 'again' is not the weather");
  assert.equal(plan("Hoe laat vertrekt de eerste trein van Amsterdam naar Utrecht?").read, true);
  assert.equal(plan("Wat kost een treinkaartje naar Rotterdam?").read, true);
  assert.equal(plan("Como está o tempo amanhã em Lisboa?").required, true);
  assert.equal(plan("A que horas sai o primeiro comboio de Lisboa para o Porto?").read, true);
  assert.equal(plan("Quanto custa o bilhete de autocarro?").read, true);
  assert.equal(plan("Quais são as últimas notícias?").required, true);
  assert.equal(plan("Lê-me o artigo, por favor").readAloud, true);
  assert.equal(plan("Geef me de antwoorden op de vragen van het artikel").readAloud, true);
  assert.equal(plan("Qual é a capital de Portugal?").required, false);
});

test("the instructions ask for Portugal's Portuguese, not Brazilian", () => {
  const c = { I18N: I };
  vm.runInNewContext(source.slice(source.indexOf("function systemPrompt("), source.indexOf("function forSpeech(")), c);
  assert.match(c.systemPrompt("pt", ""), /reply in European Portuguese \(Portugal\)[\s\S]*Portugal's Portuguese, not Brazilian/);
  // The variant instruction is only for Portuguese (the list of languages may name Brazilian Portuguese).
  assert.doesNotMatch(c.systemPrompt("nl", ""), /Portugal's Portuguese, not Brazilian|Write Brazilian Portuguese/);
});
