const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const I18N = require("../public/i18n.js");

const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, NODE_ENV: "test", PORT: String(PORT), GROQ_API_KEY: "", TAVILY_API_KEY: "" },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + "/health")).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
});

after(() => server.kill());

test("every language has every string", () => {
  for (const lang of I18N.LANGS) {
    for (const key of Object.keys(I18N.S.en)) assert.ok(I18N.S[lang][key], `${lang}.${key} missing`);
  }
});

test("page is rendered in the Accept-Language language", async () => {
  const cases = { "it-IT,it;q=0.9,en;q=0.8": "it", "ru": "ru", "zh-CN": "zh-Hans", "de-DE": "en", "en;q=0.1, bg;q=0.9": "bg" };
  for (const [header, htmlLang] of Object.entries(cases)) {
    const html = await (await fetch(BASE + "/", { headers: { "Accept-Language": header } })).text();
    assert.match(html, new RegExp(`<html lang="${htmlLang}">`));
    assert.doesNotMatch(html, /\{\{/);
  }
});

test("page has one h1, one main and an empty alert", async () => {
  const html = await (await fetch(BASE + "/")).text();
  assert.equal(html.match(/<h1/g).length, 1);
  assert.equal(html.match(/<main/g).length, 1);
  assert.match(html, /<div id="alert" role="alert"><\/div>/);
  assert.doesNotMatch(html, /aria-live/);
});

test("raw templates and server files are not served", async () => {
  assert.equal((await fetch(BASE + "/index.html", { redirect: "manual" })).status, 301);
  assert.equal((await fetch(BASE + "/server.js")).status, 404);
});

test("API errors are reported without leaking details", async () => {
  const r = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lang: "en", messages: [{ role: "user", content: "hi" }] }),
  });
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse((await r.text()).trim()), { type: "error", error: "busy" });
  const t = await fetch(BASE + "/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(t.status, 400);
});

test("legal pages exist in every language", async () => {
  for (const lang of I18N.LANGS) {
    for (const page of ["privacy", "accessibility"]) {
      const r = await fetch(`${BASE}/${page}?lang=${lang}`);
      assert.equal(r.status, 200);
      const html = await r.text();
      assert.match(html, new RegExp(`<html lang="${I18N.META[lang].html}">`));
      assert.equal(html.match(/<h1/g).length, 1);
      assert.doesNotMatch(html, /\{(owner|email)\}/);
    }
  }
});

test("About is server-rendered in all six languages with the same confirmed profile and contact", async () => {
  const about = require("../about.js");
  for (const lang of I18N.LANGS) {
    const r = await fetch(`${BASE}/about?lang=${lang}`, { headers: { "Accept-Language": "de" } });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get("content-language"), I18N.META[lang].html);
    const html = await r.text();
    assert.match(html, new RegExp(`<html lang="${I18N.META[lang].html}">`));
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.match(html, /<h1>Fabrice Brambilla<\/h1>/);
    assert.match(html, /17/);
    assert.match(html, /JAWS/);
    assert.match(html, /NVDA/);
    assert.match(html, /href="mailto:brambillafabrice@gmail\.com"/);
    assert.match(html, /href="tel:\+41783351572"/);
    assert.doesNotMatch(html, /pilot-section|UICI Teramo|uicite\.it/);
    assert.match(html, new RegExp(`href="/\\?lang=${lang}"`));
    assert.ok(html.includes(about.PAGES[lang].title.replace(/&/g, "&amp;")));
    assert.doesNotMatch(html, /<script\b|<iframe\b|<form\b|fonts\.google|\{\{|[\u2013\u2014]/);
  }
});

test("About honours the language header and safely rejects malicious or unsupported language values", async () => {
  const byHeader = await (await fetch(BASE + "/about", { headers: { "Accept-Language": "fr-FR,fr;q=0.9" } })).text();
  assert.match(byHeader, /<html lang="fr">/);
  for (const lang of ['<script>alert("fixture")</script>', "constructor", "../../server.js", "de"]) {
    const r = await fetch(BASE + "/about?lang=" + encodeURIComponent(lang), { headers: { "Accept-Language": "it" } });
    const html = await r.text();
    assert.equal(r.status, 200);
    assert.match(html, /<html lang="it">/);
    assert.doesNotMatch(html, /fixture|<script|\.\.\/|constructor/);
  }
  assert.equal((await fetch(BASE + "/about.js")).status, 404);
});

test("the original local portrait is served without external image or font requests", async () => {
  const fs = require("node:fs");
  const original = fs.readFileSync(path.join(__dirname, "../public/images/fabrice-brambilla.png"));
  const r = await fetch(BASE + "/images/fabrice-brambilla.png");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /image\/png/);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), original);
  assert.equal(original.readUInt32BE(16), 130);
  assert.equal(original.readUInt32BE(20), 130);
  const html = await (await fetch(BASE + "/about")).text();
  assert.match(html, /src="\/images\/fabrice-brambilla\.png" width="130" height="130" alt="Fabrice Brambilla"/);
  assert.equal((html.match(/<img\b/g) || []).length, 1);
  assert.doesNotMatch(html, /(?:src|href)="https:\/\/(?!uicite\.it\/)/);
});

test("home has just three footer links with server-rendered language destinations", async () => {
  for (const lang of I18N.LANGS) {
    const html = await (await fetch(`${BASE}/?lang=${lang}`)).text();
    const footer = html.match(/<footer>([\s\S]*?)<\/footer>/)[1];
    assert.equal((footer.match(/<a\b/g) || []).length, 3);
    for (const page of ["about", "privacy", "accessibility"]) assert.ok(footer.includes(`href="/${page}?lang=${lang}"`));
  }
});

test("security headers are set", async () => {
  const r = await fetch(BASE + "/");
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("reply language detection picks the language the text is written in", () => {
  const cases = [
    ["Here is what I found: the newest navigation aids for blind people are smart canes and apps you can use with your phone.", "fr", "en"],
    ["Selon le site de la RNIB, le livre Harry Potter and the Philosopher Stone est disponible en braille pour les lecteurs.", "fr", "fr"],
    ["Ecco cosa ho trovato: il nuovo bastone intelligente è disponibile anche in Italia e si può usare con il telefono.", "en", "it"],
    ["Ето какво намерих: новият умен бастун е достъпен и в България и може да се използва с телефона.", "ru", "bg"],
    ["Вот что я нашёл: новая умная трость уже есть в России, и её можно использовать с телефоном.", "bg", "ru"],
    ["这是我找到的：新的智能手杖已经上市，可以和手机一起使用。", "en", "zh"],
    ["OK.", "fr", "fr"],
  ];
  for (const [text, fallback, want] of cases) assert.equal(I18N.detectLang(text, fallback), want, text);
});

