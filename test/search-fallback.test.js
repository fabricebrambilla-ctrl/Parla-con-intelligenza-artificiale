// Focused offline checks of the actual search functions in server.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const settings = source.slice(source.indexOf('const configuredSearchModel ='), source.indexOf('// Natural AI voice'));
const functions = source.slice(source.indexOf('async function compoundSearch('), source.indexOf('// ---------- chat ----------'));

function fixture(model, search, completion) {
  const calls = [];
  const context = {
    qa: require("../synthetic-qa.js"),
    process: { env: model === undefined ? {} : { GROQ_SEARCH_MODEL: model } },
    console: { error() {}, warn() {} },
    tavilySearch: search || (async () => null),
    groqChat: async (body) => {
      calls.push(body);
      return completion ? completion(body, calls.length) : { choices: [{ message: { content: 'fixture research' } }] };
    },
  };
  vm.runInNewContext(settings + '\n' + functions, context);
  return { calls, search: context.webSearch };
}

test('no research model is called by default when Tavily is unavailable', async () => {
  const f = fixture();
  assert.match((await f.search('test')).error, /could not search/);
  assert.equal(f.calls.length, 0);
});

test('retired model overrides never trigger Groq calls', async () => {
  for (const model of ['groq/compound', 'groq/compound-mini']) {
    const f = fixture(model);
    await f.search('first');
    await f.search('second');
    assert.equal(f.calls.length, 0, model);
  }
});

test('working Tavily results are preserved without another model call', async () => {
  const f = fixture(undefined, async () => ({ results: [{ title: 'fixture source' }] }));
  const result = await f.search('query');
  assert.equal(result.results[0].title, 'fixture source');
  assert.equal(f.calls.length, 0);
});

test('an explicitly configured research model can still be used', async () => {
  const f = fixture('fixture-supported-research-model');
  assert.equal((await f.search('query')).report, 'fixture research');
  assert.equal(f.calls[0].model, 'fixture-supported-research-model');
});

test('an inaccessible custom model is blocked after its first error', async () => {
  const f = fixture('fixture-unavailable-model', null, async () => {
    const error = new Error('The model does not exist or you do not have access to it.');
    error.status = 404;
    throw error;
  });
  await f.search('first');
  await f.search('second');
  assert.equal(f.calls.length, 1);
});

test('a transient rate limit does not permanently block a custom model', async () => {
  const f = fixture('fixture-research-model', null, async (_, count) => {
    if (count === 1) {
      const error = new Error('rate limit');
      error.status = 429;
      throw error;
    }
    return { choices: [{ message: { content: 'recovered' } }] };
  });
  await f.search('first');
  assert.equal((await f.search('second')).report, 'recovered');
  assert.equal(f.calls.length, 2);
});
