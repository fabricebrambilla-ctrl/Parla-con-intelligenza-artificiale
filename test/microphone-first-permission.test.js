// A2: the first microphone permission must be passable by a blind user alone.
// Reproduced before the change (real Chromium, permission state not readable as in Firefox):
// the explanation was focused 0 to 1 ms before the browser prompt was requested, so a screen
// reader had no time to announce it, and a returning user heard no microphone words at all.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I = require("../public/i18n.js");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const settle = () => new Promise(r => setImmediate(r));

function micHarness({ permission, labels = false, userAgent = "Mozilla/5.0 Chrome/150.0 Safari/537.36" } = {}) {
  const events = [];
  const document = { activeElement: null, body: {}, documentElement: {}, hasFocus: () => true };
  const talkBtn = { focus() { events.push("focus Talk"); document.activeElement = this; } };
  document.activeElement = talkBtn;
  const track = { stop() {}, label: "", getSettings: () => ({ sampleRate: 48000 }) };
  const c = vm.createContext({C:require("../public/app-capabilities"),device:{},paused:false,continuous:false,speed:1,spokenEcho:"",echoUntil:0,micShortText:()=>I.t("en","micShortFirefox"), active: true, session: 1, state: "processing", rec: null, document, talkBtn, IS_TOUCH: false,
    micPermission: { textContent: "", focus() { events.push("focus explanation: " + this.textContent); document.activeElement = this; } },
    ctx: { createMediaStreamSource: () => ({ connect() {}, disconnect() {} }), audioWorklet: { addModule: async () => {} },
      createGain: () => ({ gain: {}, connect() { return this; }, disconnect() {} }), destination: {} },
    get: () => null, set() {}, tt: k => I.t("en", k), say: async () => false,
    announcePause: async ms => { events.push("pause " + (ms >= 2000 ? "for the screen reader" : "too short")); },
    window: { addEventListener() {}, removeEventListener() {} },
    AudioWorkletNode: function () { this.port = {}; this.connect = () => this; this.disconnect = () => {}; }, onFrame() {},
    navigator: { userAgent, ...(permission ? { permissions: { query: async () => ({ state: permission }) } } : {}),
      mediaDevices: { enumerateDevices: async () => [{ kind: "audioinput", deviceId: labels ? "a" : "", label: labels ? "Mic" : "" }],
        async getUserMedia() { events.push("browser prompt"); return { getTracks: () => [track], getAudioTracks: () => [track] }; } } } });
  vm.runInContext(app.slice(app.indexOf("  var stream = null"), app.indexOf("  // Frames are 20 ms.")), c);
  return { c, events };
}

test("the explanation is focused and the screen reader gets time before the browser prompt opens", async () => {
  const { c, events } = micHarness({ permission: "prompt" });
  await c.openMic();
  assert.equal(events.length, 4);
  assert.match(events[0], /^focus explanation: .*Allow while visiting the site/);
  assert.deepEqual(events.slice(1), ["pause for the screen reader", "browser prompt", "focus Talk"]);
});

test("allowed, blocked and not asked yet are told apart, also where the browser cannot be asked", async () => {
  assert.equal(await micHarness({ permission: "granted" }).c.microphonePermissionState(), "granted");
  assert.equal(await micHarness({ permission: "denied" }).c.microphonePermissionState(), "denied");
  assert.equal(await micHarness({ permission: "prompt" }).c.microphonePermissionState(), "prompt");
  // Firefox-like: no permission query. Readable device names mean it is already allowed.
  assert.equal(await micHarness({ labels: true }).c.microphonePermissionState(), "granted");
  assert.equal(await micHarness({}).c.microphonePermissionState(), "unknown");
});

test("an allowed microphone opens at once: no explanation, no focus move, no pause", async () => {
  const { c, events } = micHarness({ permission: "granted" });
  await c.openMic();
  assert.deepEqual(events, ["browser prompt"]);
  const again = micHarness({});       // once allowed on this page, later turns (iPhone reopens it) stay silent
  await again.c.openMic(); again.c.closeMic(); again.events.length = 0;
  await again.c.openMic();
  assert.deepEqual(again.events, ["browser prompt"]);
});

test("what to choose is named per browser, and nothing is promised that a site cannot do", () => {
  const chrome = micHarness({}).c, firefox = micHarness({ userAgent: "Mozilla/5.0 Gecko/20100101 Firefox/159.0" }).c;
  const edge = micHarness({ userAgent: "Mozilla/5.0 Chrome/150.0 Safari/537.36 Edg/150.0" }).c;
  const iphone = micHarness({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 20_0 like Mac OS X) AppleWebKit/605.1.15 Version/20.0 Mobile Safari/604.1" }).c;
  assert.equal(chrome.micBrowser(), "Chrome"); assert.equal(firefox.micBrowser(), "Firefox");
  assert.equal(edge.micBrowser(), ""); assert.equal(iphone.micBrowser(), "");
  for (const lang of I.LANGS) {
    const s = I.S[lang];
    assert.match(s.micChoiceChrome, /Allow while visiting the site/, lang);
    assert.match(s.micChoiceChrome, /Allow on every visit/, lang);
    assert.match(s.micChoiceChrome, /Allow this time/, lang);
    assert.match(s.micChoiceFirefox, /Remember this decision/, lang);
    for (const key of ["micGuide", "micChoice", "micShort", "micShortChrome", "micShortFirefox", "errMicDenied"]) assert.ok(s[key], lang + "/" + key);
    // Untested platforms get no specific instructions.
    assert.doesNotMatch(JSON.stringify([s.micGuide, s.micChoice, s.micShort, s.micGuideTouch]), /Safari|iPhone|iPad/i, lang);
  }
  assert.match(I.S.en.micChoiceChrome, /asks again/);
  assert.match(I.S.en.errMicDenied, /lock.*Microphone.*Allow/s);
});

function start(saved = {}, state = "prompt") {
  const events = [], values = { ...saved };
  const c = vm.createContext({C:require("../public/app-capabilities"),device:{},paused:false,continuous:false,speed:1,spokenEcho:"",echoUntil:0,micShortText:()=>I.t("en","micShortFirefox"), IS_TOUCH: false, active: false, session: 0, lang: "en", aiVoiceLangs: [], failures: 0, pendingTalk: false,
    choosing: false, transcript: [], context: "", lastSaid: "", alertBox: { textContent: "" }, window: { AudioContext:function(){}, AudioWorkletNode: function () {} },
    microphonePermissionState: async () => state, micBrowser: () => "Firefox", navigator: { mediaDevices: { getUserMedia() {} } },
    ensureContext() {}, showConversationControls() {}, setState() {}, get: k => values[k], set: (k, v) => { values[k] = v; },
    tt: k => I.t("en", k), tk: k => I.t("en", k), api: async () => ({ aiVoice: [] }),
    say: async t => { events.push(["say", t]); return false; }, ensureMic: async () => events.push(["microphone"]),
    chooseLanguage: async () => {}, sounds: { start() {} }, setTimeout: f => f(), goReady() {}, closeMic() {},
    announce: key => events.push(["alert", key]), fail() {} });
  vm.runInContext(app.slice(app.indexOf("  async function startConversation"), app.indexOf("  function endConversation")), c);
  return { c, events, values };
}

test("first visit: the voice says what to choose before the browser asks", async () => {
  const f = start();
  await f.c.startConversation();
  assert.equal(f.events[0][0], "say");
  assert.match(f.events[0][1], /Remember this decision/);
  assert.equal(f.events[1][0], "microphone");
  assert.ok(f.values.micPermissionGuide);
});

test("a returning user who already heard the guide hears one short line", async () => {
  const first = start(); await first.c.startConversation();
  const f = start({ ...first.values, langChosen: "1" });
  await f.c.startConversation();
  const spoken = f.events[0][1];
  assert.match(spoken, /choose Allow/);
  assert.equal(spoken.split(I.t("en", "micShortFirefox")).length - 1, 1, "one short browser-specific line");
  assert.doesNotMatch(spoken, /outside services/, "return visit does not repeat the privacy notice");
  assert.doesNotMatch(spoken, /Tab or Shift/);
});

test("a blocked microphone: the exact steps are spoken, then shown, and the microphone is never opened", async () => {
  const f = start({}, "denied");
  await f.c.startConversation();
  assert.deepEqual(f.events.map(e => e[0]), ["say", "alert"]);
  assert.match(f.events[0][1], /lock.*Microphone.*Allow/s);
  assert.deepEqual(f.events[1], ["alert", "errMicDenied"]);
});
