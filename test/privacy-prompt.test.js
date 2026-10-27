// Inspect the real outbound chat body with an in-process provider mock.
// No provider credentials, network requests or production data are used.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I18N = require("../public/i18n.js");
const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const promptAndChat = source.slice(source.indexOf("function systemPrompt("), source.indexOf("// The answer is streamed as lines of JSON"));

function fixture() {
  const calls = [];
  const context = {
    I18N, CHAT_MODEL: "fixture-model", TOOLS: [], qa: { lastModelCall: () => false },
    groqAnswer: async body => {
      calls.push(body);
      return { choices: [{ message: { content: "Fixture answer." } }] };
    },
  };
  vm.runInNewContext(promptAndChat, context);
  return { calls, run: context.runChat };
}

for (const agent of [false, true]) {
  test(`${agent ? "text API" : "voice"} does not tell Groq an ordinary caller has a disability`, async () => {
    const f = fixture();
    await f.run({ lang: "en", agent, messages: [{ role: "user", content: "What time is sunset?" }] });
    const prompt = f.calls[0].messages[0].content;
    assert.doesNotMatch(prompt, /the user is blind or visually impaired/i);
    assert.match(prompt, /Do not infer .*health, disability, age/);
    assert.match(prompt, /screen.reader/);
    assert.match(prompt, /read aloud/);
    assert.equal(f.calls[0].messages[1].content, "What time is sunset?");
  });
}

test("the prompt change preserves a caller's own relevant words", async () => {
  const f = fixture();
  const message = "I am blind. Which keyboard commands open the menu?";
  await f.run({ lang: "en", messages: [{ role: "user", content: message }] });
  assert.equal(f.calls[0].messages[1].content, message);
  assert.equal(f.calls.length, 1);
});
