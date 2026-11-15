// B: research reads the page and gives the real answer. The fixtures below are small copies of the
// layouts Tavily Extract returned for real pages on 2026-11-15 (Metrolink, LA Metro and Amtrak PDFs).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I18N = require("../public/i18n.js");
const PAGE = require("../page-text.js");
const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

// ---------- page text ----------

// Metrolink SB-line PDF: the "L.A. → San Bernardino" heading is printed above the table that goes the
// OTHER way, and L.A. Union Station's 5:31 is an arrival. The first departure towards San Bernardino is 6:38.
const METROLINK = [
  "San Bernardino Line + Arrow train connections L.A. → San Bernardino", "",
  "San Bernardino–Downtown departs 3:41 4:41 5:41 6:11 6:41 7:41",
  "San Bernardino Depot 3:46 4:46 5:46 6:16 6:46 7:46",
  "Rialto 3:54 4:54 5:54 6:24 6:54 7:54",
  "Fontana 4:00 5:00 6:00 6:30 7:00 8:00",
  "El Monte 5:04 6:04 7:04 7:34 8:04 9:04",
  "Cal State L.A. 5:15 6:15 7:15 7:45 8:15 9:15", "",
  "L.A. Union Station 5:31 6:31 7:31 8:01 8:31 9:31",
  "MONDAY–FRIDAY 300 304 308 312 316 320", "",
  "L.A. Union Station 6:38 7:38 8:38 9:38 10:38 11:38",
  "Cal State L.A. 6:53 7:53 8:53 9:53 10:53 11:53",
  "El Monte 7:08 8:08 9:08 10:08 11:08 12:08",
  "Fontana 8:10 9:10 10:10 11:10 12:10 1:10",
  "Rialto 8:16 9:16 10:16 11:16 12:16 1:16",
  "San Bernardino Depot 8:24 9:24 10:24 11:24 12:24 1:24", "",
  "Effective Monday, May 4, 2026. Updated May 2026, subject to change without notice.", "",
  ...Array.from({ length: 40 }, (_, i) => `Station notes and ticket information paragraph ${i} with fares, parking and bicycles on board.`),
].join("\n");
const Q = "What time does the first Metrolink train leave Union Station for San Bernardino on a weekday morning?";

test("a timetable keeps its stops in order and says which way it travels, worked out from the times", () => {
  const part = PAGE.relevantPart(PAGE.cleanPage(METROLINK), Q, 2500);
  const toLA = part.indexOf("(Worked out from the times: trains in this table travel from San Bernardino Depot to L.A. Union Station.)");
  const toSB = part.indexOf("(Worked out from the times: trains in this table travel from L.A. Union Station to San Bernardino Depot.)");
  assert.ok(toLA >= 0 && toSB > toLA, part);
  assert.ok(part.indexOf("L.A. Union Station 5:31") > toLA && part.indexOf("L.A. Union Station 5:31") < toSB, "5:31 sits in the table going to L.A.");
  assert.ok(part.indexOf("L.A. Union Station 6:38") > toSB, "6:38 sits in the table going to San Bernardino");
  assert.match(part, /El Monte 7:08 \.\.\. 12:08/, "stops that were not asked about stay, shortened, so the order is kept");
});

test("a PDF that arrives as one long line is cut into pieces and the asked-for table is found", () => {
  const filler = Array.from({ length: 30 }, (_, i) => `Ticket information ${i}: buy a ticket before boarding, discounts for seniors and students.`).join(" ");
  const line = filler + " San Bernardino Line L.A. → San Bernardino MONDAY–FRIDAY 300 302 304 L.A. Union Station 6:38 7:08 7:38 " +
    "Cal State L.A. 6:53 7:23 7:53 El Monte 7:08 7:38 8:08 San Bernardino Depot 8:24 8:54 9:24 " + filler;
  const part = PAGE.relevantPart(PAGE.cleanPage(line), Q, 1500);
  assert.match(part, /L\.A\. Union Station 6:38 7:08/);
  assert.ok(part.length <= 1500);
});

test("times written 4:01a or 11:44P count as times", () => {
  assert.equal(PAGE.layoutLost("Train 761 4:01a 4:10a 4:40a 4:57a 5:34a 5:49a 6:01a 6:10a 6:18a 7:13a 7:26a 7:33a 7:39a 7:47a 7:55a 8:01a 8:10a 8:20a 8:30a 8:40a"), true);
});

test("a timetable whose times run down columns is flagged as unreliable instead of being read as rows", () => {
  const columns = "Union Station ll — — — 4:31A 4:33A 4:35A 4:38A 4:40A 4:42A 4:44A 4:46A 4:47A 4:48A 4:54A 4:32A 4:37A 4:41A 4:43A 4:45A 4:47A 4:49A 4:51A 12:07A";
  assert.equal(PAGE.layoutLost(columns), true);
  assert.equal(PAGE.layoutLost(PAGE.relevantPart(PAGE.cleanPage(METROLINK), Q, 2500)), false);
  // Station names with no times next to them, while the page is full of times.
  assert.equal(PAGE.layoutLost("Los Angeles, CA - Union Station (LAX)\n\nSan Diego, CA - Santa Fe Depot (SAN)", columns + " " + columns), true);
});

test("the page's own dates are found, also inside long PDF text, and the newest year is known", () => {
  assert.deepEqual(PAGE.pageDates(METROLINK), ["Effective Monday, May 4, 2026.", "Updated May 2026, subject to change without notice."]);
  const long = "151074 Monday through Friday Effective Jun 7 2026 Eastbound Al Este North Hollywood Universal City Hollywood Los Angeles ".repeat(3);
  assert.match(PAGE.pageDates(long)[0], /Effective Jun 7 2026/);
  assert.equal(PAGE.newestYear(["MODIFIED SERVICE TIMETABLE EFFECTIVE APRIL 30, 2021"]), 2021);
  assert.equal(PAGE.newestYear([]), 0);
});

test("a long article is split into parts at paragraph ends", () => {
  const text = Array.from({ length: 12 }, (_, i) => `Paragraph ${i}. ` + "Words of the article. ".repeat(40)).join("\n\n");
  const parts = PAGE.splitParts(text, 2500);
  assert.ok(parts.length >= 4);
  for (const p of parts) assert.ok(p.length <= 2500);
  assert.equal(parts.join("\n\n").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
});

// ---------- Tavily Extract and its counting ----------

test("a page is read with Tavily Extract's advanced setting and every read is counted first", async () => {
  const bodies = [], order = [];
  let allowed = true;
  const c = {
    tavilyKeys: new (require("../provider-keys.js").ProviderKeys)(["TAVILY_API_KEY"], { env: { TAVILY_API_KEY: "fixture" } }),
    qa: { current: () => null, searchAvailable: () => true, search() {} },
    takeTavilySearch: async () => true, takeTavilyExtract: async () => { order.push("count"); return allowed; },
    TAVILY_URL: "https://fixture.invalid", TAVILY_EXTRACT_URL: "https://fixture.invalid/extract", AbortSignal, URL, logFailure() {},
    fetch: async (url, opts) => { order.push("fetch"); bodies.push(JSON.parse(opts.body));
      return { ok: true, status: 200, json: async () => ({ results: [{ title: "Timetable", raw_content: "L.A. Union Station 6:38" }] }) }; },
  };
  vm.runInNewContext(source.slice(source.indexOf("async function tavilySearch("), source.indexOf("async function compoundSearch(")), c);
  const page = await c.tavilyExtract("https://metrolinktrains.com/timetable.pdf");
  assert.equal(page.raw, "L.A. Union Station 6:38");
  assert.deepEqual(bodies[0], { urls: ["https://metrolinktrains.com/timetable.pdf"], extract_depth: "advanced", format: "markdown" });
  assert.deepEqual(order, ["count", "fetch"]);
  allowed = false;
  await assert.rejects(c.tavilyExtract("https://metrolinktrains.com/other.pdf"), /page-reading limit/);
  assert.equal(bodies.length, 1, "a refused read never reaches Tavily");
});

test("DAILY_TAVILY_EXTRACTS limits page reads, and reads are counted when no limit is set", () => {
  const { execFileSync } = require("node:child_process");
  const script = `const L=require(${JSON.stringify(path.join(__dirname, "../limits.js"))});(async()=>{const r=[];for(let i=0;i<3;i++)r.push(await L.takeTavilyExtract());console.log(JSON.stringify({r,count:await L.tavilyExtractCount()}));})()`;
  const env = { ...process.env, REDIS_URL: "" };
  delete env.REDIS_URL;
  const limited = JSON.parse(execFileSync(process.execPath, ["-e", script], { env: { ...env, DAILY_TAVILY_EXTRACTS: "2" }, encoding: "utf8" }).trim().split("\n").at(-1));
  assert.deepEqual(limited.r, [true, true, false]);
  const open = JSON.parse(execFileSync(process.execPath, ["-e", script], { env, encoding: "utf8" }).trim().split("\n").at(-1));
  assert.deepEqual(open.r, [true, true, true]);
  assert.equal(open.count.day, 3);
});

// ---------- what read_page gives the model ----------

function reader(raw) {
  const c = { PAGE, URL, Date, Map, logFailure() {}, tavilyExtract: async () => ({ title: "T", raw }), extracts: 0 };
  vm.runInNewContext(source.slice(source.indexOf("const pageCache = new Map();"), source.indexOf("async function compoundSearch(")), c);
  return c;
}

test("read_page gives the relevant part, the page's dates and useful links, never the whole page", async () => {
  const r = await reader(METROLINK + "\n\n[Full timetable (PDF)](/schedules/sb-line.pdf)").readPage("https://metrolinktrains.com/sb", { question: Q });
  assert.ok(r.text.length <= 3500 && r.shortened);
  assert.match(r.text, /L\.A\. Union Station 6:38/);
  assert.deepEqual(r.dates, ["Effective Monday, May 4, 2026.", "Updated May 2026, subject to change without notice."]);
  assert.deepEqual(r.links, [{ text: "Full timetable (PDF)", url: "https://metrolinktrains.com/schedules/sb-line.pdf" }]);
  assert.equal(r.warning, undefined);
  assert.equal(r.age, undefined);
});

test("read_page warns about a lost table layout and an old page instead of passing them on as facts", async () => {
  const columns = Array.from({ length: 30 }, (_, i) => `Union Station ${4 + (i % 8)}:${String(10 + i).padStart(2, "0")}A`).join(" — ");
  const raw = "MODIFIED SERVICE TIMETABLE EFFECTIVE APRIL 30, 2021.\n\n" + ("Los Angeles, CA - Union Station (LAX)\n\n" + columns + "\n\n").repeat(10);
  const r = await reader(raw).readPage("https://example.org/old.pdf", { question: "When does the last train leave Union Station?" });
  assert.match(r.warning, /could not read the timetable reliably/);
  assert.ok(r.text.length <= 604, "an unusable page is cut short");
  assert.match(r.age, /from 2021/);
});

test("a long article is read in numbered parts", async () => {
  const article = Array.from({ length: 12 }, (_, i) => `Paragraph ${i}. ` + "Words of the article. ".repeat(40)).join("\n\n");
  const c = reader(article);
  const one = await c.readPage("https://news.example/story", { question: "read it", part: 1 });
  assert.equal(one.part, 1);
  assert.ok(one.parts >= 4 && one.more);
  assert.match(one.text, /^Paragraph 0\./);
  const last = await c.readPage("https://news.example/story", { question: "read it", part: 99 });
  assert.equal(last.part, one.parts);
  assert.equal(last.more, false);
});

// ---------- one assistant turn ----------

const call = (name, args, id = name + Math.random()) => ({ id, function: { name, arguments: JSON.stringify(args) } });
function turn({ script, pages = {}, results = [{ title: "Timetable", website: "metrolinktrains.com", url: "https://metrolinktrains.com/sb.pdf", content: "Long excerpt with an old time 5:31" }] }) {
  const calls = [], reads = [], searches = [];
  const c = {
    I18N, CHAT_MODEL: "mock", TOOLS: [], TRACE_RESEARCH: false, PAGE, qa: { lastModelCall: () => false },
    pageUrl: (u) => (/^https?:\/\//.test(String(u)) ? String(u) : null),
    groqAnswer: async (body) => {
      calls.push(structuredClone(body));
      const step = script[calls.length - 1];
      if (typeof step === "function") return step(body);
      return { choices: [{ message: step || { content: "Fallback answer." } }] };
    },
    webSearch: async (...args) => { searches.push(args); return { results: structuredClone(results) }; },
    readPage: async (url, opts) => { reads.push({ url, ...opts }); return structuredClone(pages[url] || { url, text: "L.A. Union Station 6:38", dates: [] }); },
  };
  vm.runInNewContext(source.slice(source.indexOf("function systemPrompt("), source.indexOf("// The answer is streamed as lines of JSON")), c);
  const run = (messages, extra = {}) => c.runChat({ lang: "en", messages, ...extra });
  return { c, calls, reads, searches, run };
}
const user = (content) => [{ role: "user", content }];

test("a timetable question must read a page after searching, and the search excerpts shrink once it is read", async () => {
  const t = turn({ script: [
    { tool_calls: [call("web_search", { query: "metrolink" })] },
    { tool_calls: [call("read_page", { url: "https://metrolinktrains.com/sb.pdf", part: 2 })] },
    { content: "The first weekday train leaves at 6:38 a.m." },
  ] });
  const answer = await t.run(user(Q));
  assert.equal(answer.text, "The first weekday train leaves at 6:38 a.m.");
  assert.equal(t.calls[0].tool_choice.function.name, "web_search");
  assert.equal(t.calls[1].tool_choice.function.name, "read_page", "the page must be read, not only found");
  assert.equal(t.reads[0].part, 0, "a timetable is never read in article parts");
  assert.equal(t.searches[0][1].deep, true, "time-sensitive questions use the deeper search");
  const search = t.calls[2].messages.find((m) => m.role === "tool" && m.content.includes("metrolinktrains.com/sb.pdf"));
  assert.doesNotMatch(search.content, /old time 5:31/, "the excerpt is dropped once the page text is there");
  assert.match(t.calls[0].messages[0].content, /Worked out from the times/, "the research rules are sent for this turn");
});

test("a named service with no word for train still counts as a timetable question", () => {
  const t = turn({ script: [] });
  const plan = t.c.liveResearchPlan(user("What time does the first Pacific Surfliner leave Los Angeles for San Diego?"));
  assert.equal(plan.read, true);
  assert.equal(t.c.liveResearchPlan(user("Read me the article about the telescope")).readAloud, true);
  assert.equal(t.c.liveResearchPlan(user("Tell me a joke")).readAloud, false);
});

test("a timetable answer gets at most two searches, each followed by a read, and after two unusable pages the model must answer", async () => {
  const bad = { error: "This page could not be read." };
  const t = turn({ pages: { "https://a.example/1": bad, "https://a.example/2": bad }, script: [
    { tool_calls: [call("web_search", { query: "one" })] },
    { tool_calls: [call("read_page", { url: "https://a.example/1" })] },
    { tool_calls: [call("web_search", { query: "two" })] },
    { tool_calls: [call("read_page", { url: "https://a.example/2" })] },
    { content: "I tried two pages and could not read the timetable." },
  ] });
  await t.run(user("When does the last train leave Union Station on Saturday?"));
  assert.equal(t.calls[3].tool_choice.function.name, "read_page", "the second search is also followed by a read");
  assert.equal(t.calls[4].tool_choice, "none", "two unusable pages: answer now");
  const third = turn({ script: [
    { tool_calls: [call("web_search", { query: "one" })] },
    { tool_calls: [call("read_page", { url: "https://a.example/1" })] },
    { tool_calls: [call("web_search", { query: "two" })] },
    { tool_calls: [call("read_page", { url: "https://a.example/2" })] },
    { tool_calls: [call("web_search", { query: "three" })] },
    { content: "Answer." },
  ] });
  await third.run(user("When does the last train leave Union Station on Saturday?"));
  assert.equal(third.searches.length, 2);
  assert.match(third.calls[5].messages.at(-1).content, /No more searches/);
});

test("the same page is not read twice in one answer", async () => {
  const t = turn({ script: [
    { tool_calls: [call("web_search", { query: "one" })] },
    { tool_calls: [call("read_page", { url: "https://a.example/1" })] },
    { tool_calls: [call("read_page", { url: "https://a.example/1" })] },
    { content: "Answer." },
  ] });
  await t.run(user(Q));
  assert.equal(t.reads.length, 1);
  assert.match(t.calls[3].messages.at(-1).content, /already read this page/);
});

test("when the model refuses the required read and wants to search again, the turn goes on instead of failing", async () => {
  const t = turn({ script: [
    { tool_calls: [call("web_search", { query: "one" })] },
    (body) => { if (body.tool_choice?.function?.name === "read_page") throw Object.assign(new Error("tool_use_failed"), { status: 400 }); },
    { content: "From the page: 6:38." },
  ] });
  const answer = await t.run(user(Q));
  assert.equal(t.calls[2].tool_choice, "auto");
  assert.equal(answer.text, "From the page: 6:38.");
});

test("\"check the website\" after a search gets one push to read the page instead", async () => {
  const t = turn({ script: [
    { tool_calls: [call("web_search", { query: "museum opening hours" })] },
    { content: "You can check the official website for the opening hours." },
    { tool_calls: [call("read_page", { url: "https://metrolinktrains.com/sb.pdf" })] },
    { content: "It opens at nine." },
  ] });
  const answer = await t.run(user("What are the latest opening hours of the British Museum?"));
  assert.equal(answer.text, "It opens at nine.");
  assert.equal(t.reads.length, 1);
  assert.ok(t.calls[2].messages.some((m) => m.role === "system" && /cannot look at it/.test(m.content)));
});

test("reading aloud: part 1 by default, one part per turn, and the position goes back to the browser", async () => {
  const url = "https://news.example/story";
  const t = turn({ pages: { [url]: { url, part: 1, parts: 3, text: "First part.", more: true } }, script: [
    { tool_calls: [call("read_page", { url })] },
    { tool_calls: [call("read_page", { url, part: 2 })] },
    { content: "First part. Shall I continue?" },
  ] });
  const answer = await t.run(user("Please read me the article about the telescope"));
  assert.equal(t.reads.length, 1);
  assert.equal(t.reads[0].part, 1);
  assert.match(t.calls[2].messages.at(-1).content, /Shall I continue/);
  assert.deepEqual(JSON.parse(JSON.stringify(answer.reading)), { url, part: 1, parts: 3 });
});

test("\"continue\" goes on from the part the browser says was read last", async () => {
  const url = "https://news.example/story";
  const t = turn({ pages: { [url]: { url, part: 2, parts: 3, text: "Second part.", more: true } }, script: [
    { tool_calls: [call("read_page", { url, part: 2 })] },
    { content: "Second part. Shall I continue?" },
  ] });
  const answer = await t.run([{ role: "user", content: "Read it to me" }, { role: "assistant", content: "First part. Shall I continue?" }, { role: "user", content: "Yes, continue." }],
    { reading: { url, part: 1, parts: 3 } });
  assert.match(t.calls[0].messages[0].content, /call read_page with this url and part 2/);
  assert.equal(t.reads[0].part, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(answer.reading)), { url, part: 2, parts: 3 });
  const nonsense = turn({ script: [{ content: "Hi." }] });
  await nonsense.run(user("Yes, continue."), { reading: { url: "javascript:alert(1)", part: 1, parts: 3 } });
  assert.doesNotMatch(nonsense.calls[0].messages[0].content, /Reading aloud/, "an invalid position from the browser is ignored");
});

test("ordinary chat does not carry the research rules", async () => {
  const t = turn({ script: [{ content: "Hello!" }] });
  await t.run(user("Hello, how are you?"));
  assert.doesNotMatch(t.calls[0].messages[0].content, /Worked out from the times/);
  assert.match(t.calls[0].messages[0].content, /never answer "check the website"/);
});

test("the browser keeps the reading position and sends it with the next question", () => {
  const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
  assert.match(app, /reading: readingPage \|\| undefined/);
  assert.match(app, /readingPage = r2\.reading \|\| null/);
});

test("the privacy notice says that page addresses go to Tavily and that page text is kept for 20 minutes, in every language", () => {
  const notice = require("../privacy-notice.js");
  for (const lang of I18N.LANGS) {
    const search = notice[lang].sections[2][1];
    assert.match(search, /Tavily[\s\S]*Tavily/, lang);
    assert.match(search, /20/, lang);
  }
});
