// C: optional "Show last answer" (off by default): a plain text box a screen reader can read, with a
// Copy button; long content can go there instead of being read out.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I = require("../public/i18n.js");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

test("the page has the button, a heading, plain text and a Copy button, all hidden by default", () => {
  assert.match(html, /<button id="lastBtn" type="button" aria-expanded="false" aria-controls="lastBox"[^>]*hidden>/);
  assert.match(html, /<section id="lastBox" class="last" aria-labelledby="lastHeading" hidden>\s*<h2 id="lastHeading"/);
  assert.match(html, /<div id="lastText" class="last-text"><\/div>/, "plain text, not a text field or a live region");
  assert.match(html, /<button id="copyBtn" type="button"/);
  assert.match(html, /<p id="copyStatus" role="status"><\/p>/);
  // It comes after the Talk button, so it never sits between the user and Start.
  assert.ok(html.indexOf('id="talk"') < html.indexOf('id="lastBtn"'));
  for (const lang of I.LANGS) for (const key of ["lastButton", "lastHeading", "copyButton", "copied", "copyFailed", "lastShown", "lastNone", "lastHidden"]) {
    assert.ok(I.S[lang][key], `${lang}/${key}`);
  }
});

function harness(saved = {}) {
  const values = { ...saved }, clip = [];
  const el = (hidden) => ({ hidden, textContent: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, contains: (x) => x === lastText || x === copyBtn, focus() { doc.activeElement = this; } });
  const doc = { activeElement: null };
  const talkBtn = el(false), lastBtn = el(true), lastBox = el(true), lastText = el(false), copyBtn = el(false), copyStatus = el(false);
  doc.activeElement = talkBtn;
  const c = vm.createContext({afterSpeech:()=>false, document: doc, talkBtn, lastBtn, lastBox, lastText, copyBtn, copyStatus, lastAnswer: "",
    get: (k) => (k in values ? values[k] : null), set: (k, v) => { values[k] = v; }, tt: (k) => I.t("en", k),
    navigator: { clipboard: { writeText: async (t) => { if (saved.noClipboard) throw new Error("denied"); clip.push(t); } } } });
  const start = app.indexOf("  function rememberAnswer("), end = app.indexOf("  lastBtn.addEventListener(");
  vm.runInContext(app.slice(start, end), c);
  return { c, values, clip, talkBtn, lastBtn, lastBox, lastText, copyStatus, doc };
}

test("off by default: answers are remembered but nothing appears until asked", () => {
  const h = harness();
  h.c.rememberAnswer("It opens at nine.");
  assert.equal(h.lastBtn.hidden, true);
  assert.equal(h.lastBox.hidden, true);
  assert.equal(h.lastText.textContent, "");
  assert.match(app, /lastBtn\.hidden = get\("showLast"\) !== "1";/, "the button stays hidden on load unless it was turned on");
});

test("\"show the last answer\" shows the text, keeps focus on Talk, and the button stays from then on", () => {
  const h = harness();
  assert.equal(h.c.showLast(), false, "nothing to show yet");
  h.c.rememberAnswer("Step 1: open Settings.\nStep 2: choose Sound.");
  assert.equal(h.c.showLast(), true);
  assert.equal(h.lastBox.hidden, false);
  assert.equal(h.lastBtn.hidden, false);
  assert.equal(h.lastBtn.attrs["aria-expanded"], "true");
  assert.equal(h.lastText.textContent, "Step 1: open Settings.\nStep 2: choose Sound.");
  assert.equal(h.doc.activeElement, h.talkBtn, "focus is not moved");
  assert.equal(h.values.showLast, "1");
  h.c.rememberAnswer("A newer answer.");
  assert.equal(h.lastText.textContent, "A newer answer.", "an open box follows the latest answer");
});

test("Copy puts the text on the clipboard and says so; a refused clipboard says how to copy by hand", async () => {
  const h = harness();
  h.c.rememberAnswer("console.log(1)");
  h.c.showLast();
  assert.equal(await h.c.copyLast(), true);
  assert.deepEqual(h.clip, ["console.log(1)"]);
  assert.equal(h.copyStatus.textContent, I.t("en", "copied"));
  const refused = harness({ noClipboard: true });
  refused.c.rememberAnswer("x");
  assert.equal(await refused.c.copyLast(), false);
  assert.equal(refused.copyStatus.textContent, I.t("en", "copyFailed"));
});

test("\"hide the last answer\" turns it off again, and focus inside the box goes back to Talk", () => {
  const h = harness();
  h.c.rememberAnswer("x");
  h.c.showLast();
  h.doc.activeElement = h.lastText;
  h.c.hideLast(true);
  assert.equal(h.lastBox.hidden, true);
  assert.equal(h.lastBtn.hidden, true);
  assert.equal(h.values.showLast, "");
  assert.equal(h.doc.activeElement, h.talkBtn);
});

test("the spoken commands are recognised in every language and never sent to the assistant", () => {
  const c = vm.createContext({ lang: "en" });
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  for (const p of ["Show the last answer.", "Show me the last answer please", "Mostra l'ultima risposta", "Affiche la dernière réponse",
    "Покажи последния отговор", "Покажи последний ответ", "显示上一个回答", "最後の回答を表示して"]) assert.equal(c.voiceCommand(p), "show", p);
  for (const p of ["Hide the answer", "Nascondi la risposta", "Masque la réponse", "Скрий отговора", "Скрой ответ", "隐藏回答", "回答を非表示"]) assert.equal(c.voiceCommand(p), "hide", p);
  assert.equal(c.voiceCommand("show me the answer to the maths homework"), null);
});

test("long content the assistant puts in the box reaches the page, not the voice", async () => {
  const calls = [];
  const c = { I18N: I, CHAT_MODEL: "mock", TOOLS: [], TRACE_RESEARCH: false, qa: { lastModelCall: () => false }, pageUrl: () => null,
    groqAnswer: async (body) => { calls.push(body); return { choices: [{ message: calls.length === 1
      ? { tool_calls: [{ id: "b", function: { name: "put_in_text_box", arguments: JSON.stringify({ text: "1. Open Blender.\n2. Add a cube." }) } }] }
      : { content: "I've put the eight steps on the page under Last answer." } }] }; } };
  vm.runInNewContext(source.slice(source.indexOf("function systemPrompt("), source.indexOf("// The answer is streamed as lines of JSON")), c);
  const voice = await c.runChat({ lang: "en", messages: [{ role: "user", content: "Give me a guide to model a cup in Blender" }] });
  assert.equal(voice.box, "1. Open Blender.\n2. Add a cube.");
  assert.equal(voice.text, "I've put the eight steps on the page under Last answer.");
  assert.match(calls[1].messages.at(-1).content, /now on the page/);
  calls.length = 0;
  const agent = await c.runChat({ lang: "en", agent: true, messages: [{ role: "user", content: "Give me a guide" }] });
  assert.equal(agent.box, undefined);
  assert.match(agent.text, /under Last answer\.\n\n1\. Open Blender\./, "an agent gets the content in the reply text");
  assert.match(source, /\.\.\.\(box \? \{ box \} : \{\}\)/, "the reply sent to the browser carries the box");
  assert.match(app, /if \(r2\.box\) \{ rememberAnswer\(String\(r2\.box\)\); showLast\(\); \}/);
});
