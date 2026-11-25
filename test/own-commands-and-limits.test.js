// D: the assistant knows the page's own commands and its limits, can carry out a page command,
// and does not claim to have made, saved or sent something.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I18N = require("../public/i18n.js");
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");

function turn(script) {
  const calls = [];
  const c = { I18N, CHAT_MODEL: "mock", TOOLS: [], TRACE_RESEARCH: false, qa: { lastModelCall: () => false }, pageUrl: () => null,
    groqAnswer: async (body) => { calls.push(structuredClone(body)); return { choices: [{ message: script[calls.length - 1] || { content: "Fallback." } }] }; } };
  vm.runInNewContext(source.slice(source.indexOf("function systemPrompt("), source.indexOf("// The answer is streamed as lines of JSON")), Object.assign(c, {appCapabilities:require('../public/app-capabilities')}));
  return { c, calls, run: (content, extra = {}) => c.runChat({ lang: "en", messages: [{ role: "user", content }], ...extra }) };
}
const call = (name, args) => ({ tool_calls: [{ id: name, function: { name, arguments: JSON.stringify(args) } }] });

test("the instructions list the page's commands, every site language, and what the assistant cannot do", () => {
  const prompt = turn([]).c.systemPrompt("en", "");
  for (const words of ["change language", "show the last answer", "hide the last answer", "change microphone", "repeat", "goodbye"]) {
    assert.ok(prompt.includes(words), words);
  }
  for (const lang of I18N.LANGS) assert.ok(prompt.includes(I18N.META[lang].english), lang);
  assert.match(prompt, /cannot create, save, send or download files, documents, images, 3D models, games or apps/);
  assert.match(prompt, /Never say you made, saved, sent or attached something/);
});

test("the assistant can ask the page to open the language list, show the last answer or change the microphone", async () => {
  for (const command of ["choose_language", "show_last_answer", "change_microphone"]) {
    const t = turn([call("page_command", { command }), { content: "Sure." }]);
    const reply = await t.run("I'd like a different tongue");
    assert.equal(reply.command, command);
    assert.equal(reply.text, "Sure.");
  }
  const bad = turn([call("page_command", { command: "format_disk" }), { content: "I can't do that." }]);
  assert.equal((await bad.run("format my disk")).command, undefined);
  const agent = turn([call("page_command", { command: "choose_language" }), { content: "OK." }]);
  assert.equal((await agent.run("change language", { agent: true })).command, undefined, "an agent has no page");
});

test("the browser carries out the command after the spoken reply", () => {
  assert.match(app, /var PAGE_COMMANDS = \{ choose_language: "ask", show_last_answer: "show", change_microphone: "mic",/);
  assert.match(app, /var pageCmd = PAGE_COMMANDS\[r2\.command\];\s*if \(pageCmd\) return runCommand\(pageCmd\);/);
  assert.match(source, /\.\.\.\(command \? \{ command \} : \{\}\)/);
});

test("a reply claiming a made, saved or sent file gets one push to say plainly what it can do", async () => {
  const t = turn([{ content: "I have created a 3D model file for you to download." }, { content: "I can't make files, but here are the steps as text." }]);
  const reply = await t.run("Make me a 3D model of a cup");
  assert.equal(reply.text, "I can't make files, but here are the steps as text.");
  assert.match(t.calls[1].messages.at(-1).content, /no file was made/);
  const once = turn([{ content: "I made you a game file." }, { content: "I made you a game file." }]);
  assert.equal((await once.run("game")).text, "I could not do that.", "a second unsupported claim never reaches the user");
  assert.equal(once.calls.length, 2);
});

test("saying the text is on the page without putting it there is caught; putting it there is fine", async () => {
  const fake = turn([{ content: "I've put the steps on the page under Last answer." }, { content: "Here are the first three steps." }]);
  await fake.run("guide please");
  assert.equal(fake.calls.length, 2);
  const real = turn([call("put_in_text_box", { text: "1. Step." }), { content: "The steps are on the page under Last answer." }]);
  const reply = await real.run("guide please");
  assert.equal(reply.box, "1. Step.");
  assert.equal(real.calls.length, 2, "no push when the text really is there");
});

test("ordinary sentences are not mistaken for claims, in several languages", () => {
  const { c } = turn([]);
  for (const t of ["I made a mistake earlier, sorry.", "The museum was created in 1753.", "Here are the steps to bake bread."]) assert.equal(c.falseClaim(t, false), false, t);
  for (const t of ["I’ve generated the code strings for you.", "I sent the email.", "Ho creato il file per te.", "J'ai créé le document.",
    "Я создал для вас файл.", "我已经为你生成了", "ファイルを作成しました。"]) assert.equal(c.falseClaim(t, false), true, t);
});

test("questions about changing the language open the language list, in more wordings", () => {
  const c = vm.createContext({ lang: "en", get: () => null, navigator: { languages: ["en"] } });
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  for (const p of ["How do I change the language?", "Come cambio la lingua?", "Comment changer la langue ?", "Как сменить язык?",
    "怎么换语言？", "言語を変えるにはどうすればいいですか"]) assert.equal(c.voiceCommand(p), "ask", p);
  assert.equal(c.voiceCommand("What languages do you speak?"), null, "a question about languages is answered, not a command");
});

test("the spoken help names every page command, in every language, and each named phrase works", () => {
  const c = vm.createContext({ lang: "en", get: () => null, navigator: { languages: ["en"] } });
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  const said = { en: ["repeat", "change language", "show the last answer", "change microphone"], it: ["ripeti", "cambia lingua", "mostra l'ultima risposta", "cambia microfono"],
    fr: ["répète", "changer de langue", "affiche la dernière réponse", "changer de microphone"], bg: ["повтори", "смени езика", "покажи последния отговор", "смени микрофона"],
    ru: ["повтори", "смени язык", "покажи последний ответ", "сменить микрофон"], zh: ["再说一遍", "换语言", "显示上一个回答", "换麦克风"],
    ja: ["もう一度", "言語を変更", "最後の回答を表示", "マイクを変更"],
    nl: ["herhaal", "taal wijzigen", "laatste antwoord tonen", "microfoon wijzigen"], pt: ["repete", "mudar de língua", "mostra a última resposta", "mudar de microfone"],
    "pt-BR": ["repete", "mudar de idioma", "mostra a última resposta", "trocar de microfone"] };
  for (const lang of I18N.ALL_LANGS) {
    const help = I18N.t(lang, "voiceHelp");
    for (const phrase of said[lang]) {
      assert.ok(help.includes(phrase), `${lang}: help names "${phrase}"`);
      assert.ok(c.voiceCommand(phrase), `${lang}: "${phrase}" is a command`);
    }
  }
});
