// E: a copyrighted text is not refused outright: the assistant reads it, answers in its own words,
// says plainly what it cannot read word for word, and covers every question of a study article.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I18N = require("../public/i18n.js");
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
// The tester's exact words (2026-11).
const TESTER = "Dimmi le risposte delle domande dell'articolo studio torre di guardia settimana dall'8 al 14 novembre";

function turn(script) {
  const calls = [], reads = [];
  const c = { I18N, CHAT_MODEL: "mock", TOOLS: [], TRACE_RESEARCH: false, qa: { lastModelCall: () => false },
    pageUrl: (u) => (/^https?:\/\//.test(String(u)) ? String(u) : null),
    readPage: async (url, opts) => { reads.push(opts); return { url, part: opts.part, parts: 8, text: "**1.** Domanda? Testo.", more: true }; },
    webSearch: async () => ({ results: [{ title: "Articolo", url: "https://www.jw.org/it/articolo" }] }),
    groqAnswer: async (body) => { calls.push(structuredClone(body)); return { choices: [{ message: script[calls.length - 1] || { content: "Fine." } }] }; } };
  vm.runInNewContext(source.slice(source.indexOf("function systemPrompt("), source.indexOf("// The answer is streamed as lines of JSON")), Object.assign(c, {appCapabilities:require('../public/app-capabilities')}));
  return { c, calls, reads, run: (content, extra = {}) => c.runChat({ lang: "it", messages: [{ role: "user", content }], ...extra }) };
}

test("the instructions say never to refuse only because a text is copyrighted, and how to answer instead", () => {
  const prompt = turn([]).c.systemPrompt("it", "");
  assert.match(prompt, /never refuse only because a text is copyrighted/);
  assert.match(prompt, /answer each question briefly in your own words from what the article says/);
  assert.match(prompt, /say plainly that you cannot read it out word for word/);
  assert.match(prompt, /If you could not find or read the text, say so instead of guessing/);
  assert.equal((prompt.match(/copyright/gi) || []).length, 2, "copyright appears only in this rule (\"Copyrighted texts\", \"copyrighted\")");
});

test("the tester's sentence makes the assistant read the whole article part by part, starting at part 1", async () => {
  const t = turn([
    { tool_calls: [{ id: "s", function: { name: "web_search", arguments: JSON.stringify({ query: "torre di guardia studio" }) } }] },
    { tool_calls: [{ id: "r", function: { name: "read_page", arguments: JSON.stringify({ url: "https://www.jw.org/it/articolo" }) } }] },
    { content: "Domanda 1: ... Vuoi che continui con le prossime domande?" },
  ]);
  assert.equal(t.c.liveResearchPlan([{ role: "user", content: TESTER }]).readAloud, true);
  const reply = await t.run(TESTER);
  assert.equal(t.reads[0].part, 1, "part 1, not only the 3,500 characters that matched the question");
  assert.deepEqual(JSON.parse(JSON.stringify(reply.reading)), { url: "https://www.jw.org/it/articolo", part: 1, parts: 8 });
  assert.match(t.calls[0].messages[0].content, /answer all the questions of a study article, call read_page with part 1/);
});

test("other wordings of \"answers to the questions\" count too, in several languages", () => {
  const { c } = turn([]);
  for (const q of ["Give me the answers to the questions of this week's study article", "Donne-moi les réponses aux questions de l'article",
    "Дай ответы на вопросы статьи", "Кажи ми отговорите на въпросите от статията", "告诉我这篇文章问题的答案", "記事の質問の答えを教えて"]) {
    assert.equal(c.liveResearchPlan([{ role: "user", content: q }]).readAloud, true, q);
  }
  assert.equal(c.liveResearchPlan([{ role: "user", content: "What is the capital of France?" }]).readAloud, false);
});
