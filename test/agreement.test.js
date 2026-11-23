// A3: agreement by pressing Start. A line with two links comes before the Start button,
// one short sentence is spoken, the agreed version is saved, and the Terms page exists.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I = require("../public/i18n.js");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const PORT = 3987, BASE = "http://127.0.0.1:" + PORT;
let server;
before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")],
    { env: { ...process.env, NODE_ENV: "test", PORT: String(PORT), GROQ_API_KEY: "", TAVILY_API_KEY: "" }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE + "/health")).ok) return; } catch {} await new Promise(r => setTimeout(r, 100)); }
  throw new Error("server did not start");
});
after(() => server.kill());

test("the agreement line with Privacy Policy and Terms links comes before the Start button, in every language", async () => {
  for (const lang of I.LANGS) {
    const html = await (await fetch(`${BASE}/?lang=${lang}`)).text();
    const agree = html.match(/<p id="agree"[^>]*>([\s\S]*?)<\/p>/);
    assert.ok(agree, lang + ": agreement line");
    assert.ok(html.indexOf('<p id="agree"') < html.indexOf('<button id="talk"'), lang + ": read before the button");
    assert.ok(agree[1].includes(`href="/privacy?lang=${lang}"`) && agree[1].includes(`href="/terms?lang=${lang}"`), lang);
    assert.equal((agree[1].match(/<a\b/g) || []).length, 2);
    assert.doesNotMatch(agree[1], />\s+</, "no whitespace-only stops for VoiceOver");
    // It is also the first part of the focused button's description.
    assert.match(html, /<button id="talk"[^>]*aria-describedby="agree helpText"/);
    for (const key of ["agreeBefore", "agreePrivacy", "agreeAnd", "agreeTerms", "agreeAfter", "agreeSpoken"]) assert.ok(I.S[lang][key] !== undefined, lang + "/" + key);
  }
  const text = (await (await fetch(`${BASE}/?lang=en`)).text()).match(/<p id="agree"[^>]*>([\s\S]*?)<\/p>/)[1].replace(/<[^>]+>/g, "");
  assert.equal(text, "By pressing Start you agree to the Privacy Policy and Terms.");
});

test("the Terms page exists in every language and says what the site really does", async () => {
  for (const lang of I.LANGS) {
    const r = await fetch(`${BASE}/terms?lang=${lang}`);
    assert.equal(r.status, 200, lang);
    const html = await r.text();
    assert.match(html, new RegExp(`<html lang="${I.META[lang].html}">`));
    assert.equal(html.match(/<h1/g).length, 1);
    for (const provider of ["Groq", "Tavily", "Fish Audio"]) assert.ok(html.includes(provider), `${lang}: names ${provider}`);
    assert.ok(html.includes(`href="/privacy?lang=${lang}"`) || html.includes(`href="/?lang=${lang}"`));
  }
  const en = (await (await fetch(`${BASE}/terms?lang=en`)).text()).replace(/<[^>]+>/g, " ");
  assert.match(en, /no account/i);
  assert.match(en, /transcri/i); assert.match(en, /search/i); assert.match(en, /voice/i);
  assert.match(en, /can be wrong|may be wrong|inaccurate/i);
  assert.doesNotMatch(en, /we never share|no data leaves|fully compliant|GDPR compliant/i);
});

test("the privacy notice also covers what the browser now remembers", () => {
  const privacy = require("../privacy-notice.js");
  for (const lang of I.LANGS) assert.ok(privacy[lang].sections[3][1].length > 0);
  assert.match(privacy.en.sections[3][1], /microphone/i);
  assert.match(privacy.en.sections[3][1], /agreed/i);
});

function start(saved = {}) {
  const events = [], values = { ...saved };
  const c = vm.createContext({C:require("../public/app-capabilities"),device:{},paused:false,continuous:false,speed:1,spokenEcho:"",echoUntil:0,micShortText:()=>I.t("en","micShortFirefox"), IS_TOUCH: false, active: false, session: 0, lang: "en", aiVoiceLangs: [], failures: 0, pendingTalk: false,
    choosing: false, transcript: [], context: "", lastSaid: "", alertBox: { textContent: "" }, window: { AudioContext:function(){}, AudioWorkletNode: function () {} },
    microphonePermissionState: async () => "granted", micBrowser: () => "", navigator: { mediaDevices: { getUserMedia() {} } },
    ensureContext() {}, showConversationControls() {}, setState() {}, get: k => values[k], set: (k, v) => { values[k] = v; },
    tt: k => I.t("en", k), tk: k => I.t("en", k), api: async () => ({ aiVoice: [] }),
    say: async t => { events.push(t); return false; }, ensureMic: async () => {}, chooseLanguage: async () => {},
    sounds: { start() {} }, setTimeout: f => f(), goReady() {}, closeMic() {}, announce() {}, fail() {} });
  vm.runInContext(app.slice(app.indexOf("  async function startConversation"), app.indexOf("  function endConversation")), c);
  return { c, events, values };
}

test("pressing Start saves the agreed version; one short sentence and the AI disclosure are spoken once", async () => {
  const f = start();
  await f.c.startConversation();
  assert.equal(f.events[0], "I'm an AI assistant. " + I.t("en", "agreeSpoken"));
  assert.ok(I.t("en", "agreeSpoken").length < 110, "one short sentence");
  assert.equal((I.t("en", "agreeSpoken").match(/[.!?]/g) || []).length, 1, "one sentence");
  assert.match(f.values.agreedVersion, /^\d{4}-\d{2}-\d{2}$/);
  const again = start({ ...f.values, langChosen: "1" });
  await again.c.startConversation();
  assert.deepEqual(again.events, [I.t("en", "greetingShort")]);
  assert.equal(again.values.agreedVersion, f.values.agreedVersion);
});
