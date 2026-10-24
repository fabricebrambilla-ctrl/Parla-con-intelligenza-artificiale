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
