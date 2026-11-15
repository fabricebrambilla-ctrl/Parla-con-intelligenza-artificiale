// A1: the chosen microphone is remembered, a missing one falls back to the default
// (and the user is told by voice), and it can be changed by voice or with a button.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const I = require("../public/i18n.js");
const app = fs.readFileSync(path.join(__dirname, "../public/app.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");

function harness({ saved = {}, devices = [], missing = [] } = {}) {
  const values = { ...saved }, requests = [], said = [];
  function media(id) {
    const d = devices.find(x => x.deviceId === id) || devices[0] || { deviceId: "", label: "" };
    const track = { stop() { this.stopped = true; }, label: d.label, getSettings: () => ({ sampleRate: 48000, deviceId: d.deviceId }) };
    return { getTracks: () => [track], getAudioTracks: () => [track] };
  }
  const document = { activeElement: null, body: {}, documentElement: {}, hasFocus: () => true };
  const talkBtn = { focus() { document.activeElement = this; } };
  document.activeElement = talkBtn;
  const c = vm.createContext({
    active: true, session: 1, state: "ready", rec: null, document, talkBtn, console,
    micPermission: { textContent: "", focus() { document.activeElement = this; } },
    ctx: { createMediaStreamSource: () => ({ connect() {}, disconnect() {} }), audioWorklet: { addModule: async () => {} },
      createGain: () => ({ gain: {}, connect() { return this; }, disconnect() {} }), destination: {} },
    get: k => (k in values ? values[k] : null), set: (k, v) => { values[k] = v; },
    tt: k => I.t("en", k), say: async t => { said.push(t); return false; },
    window: { addEventListener() {}, removeEventListener() {} },
    AudioWorkletNode: function () { this.port = {}; this.connect = () => this; this.disconnect = () => {}; }, onFrame() {},
    renderMics() {}, setState(s) { c.state = s; }, goReady() {},
    navigator: { permissions: { query: async () => ({ state: "granted" }) }, mediaDevices: {
      enumerateDevices: async () => devices.map(d => ({ kind: "audioinput", ...d })),
      async getUserMedia(q) {
        const exact = q.audio.deviceId && q.audio.deviceId.exact;
        requests.push(exact || "default");
        if (exact && (missing.includes(exact) || !devices.some(d => d.deviceId === exact))) {
          throw Object.assign(new Error("gone"), { name: "OverconstrainedError" });
        }
        return media(exact);
      } } },
  });
  vm.runInContext(app.slice(app.indexOf("  var stream = null"), app.indexOf("  // Frames are 20 ms.")), c);
  return { c, values, requests, said };
}
const BUILT_IN = { deviceId: "built-in-id", label: "Built-in microphone" };
const HEADSET = { deviceId: "headset-id", label: "USB headset" };

test("the first successful permission saves the microphone's device ID and name", async () => {
  const h = harness({ devices: [HEADSET, BUILT_IN] });
  await h.c.ensureMic();
  assert.deepEqual(h.requests, ["default"]);
  assert.equal(h.values.micDeviceId, "headset-id");
  assert.equal(h.values.micDeviceLabel, "USB headset");
  assert.deepEqual(h.said, []);
});

test("the next visit requests exactly the saved microphone", async () => {
  const h = harness({ saved: { micDeviceId: "headset-id", micDeviceLabel: "USB headset" }, devices: [BUILT_IN, HEADSET] });
  await h.c.ensureMic();
  assert.deepEqual(h.requests, ["headset-id"]);
  assert.deepEqual(h.said, []);
});

test("an unplugged saved microphone falls back to the default and says so once, keeping the saved choice", async () => {
  const h = harness({ saved: { micDeviceId: "headset-id", micDeviceLabel: "USB headset" }, devices: [BUILT_IN] });
  await h.c.ensureMic();
  assert.deepEqual(h.requests, ["headset-id", "default"]);
  assert.deepEqual(h.said, [I.t("en", "micFallback")]);
  assert.equal(h.values.micDeviceId, "headset-id", "the choice returns when the microphone is plugged in again");
  h.c.closeMic();
  await h.c.ensureMic();
  assert.equal(h.said.length, 1, "said once per conversation, not on every turn");
});

test("a browser that only renamed the device ID does not announce a fallback", async () => {
  const h = harness({ saved: { micDeviceId: "old-id", micDeviceLabel: "USB headset" }, devices: [HEADSET, BUILT_IN] });
  await h.c.ensureMic();
  assert.deepEqual(h.said, []);
  assert.equal(h.values.micDeviceId, "headset-id");
});

test("the microphone list is built only from devices whose names are readable (after permission)", async () => {
  const before = harness({ devices: [{ deviceId: "", label: "" }, { deviceId: "", label: "" }] });
  assert.equal((await before.c.refreshMics()).length, 0);
  const after = harness({ devices: [{ deviceId: "default", label: "Default - USB headset" }, HEADSET, BUILT_IN] });
  assert.deepEqual(JSON.parse(JSON.stringify(await after.c.refreshMics())),
    [{ id: "headset-id", label: "USB headset" }, { id: "built-in-id", label: "Built-in microphone" }]);
});

test("\"change microphone\" moves to the next microphone, saves it and reopens with it", async () => {
  const h = harness({ saved: { micDeviceId: "headset-id", micDeviceLabel: "USB headset" }, devices: [HEADSET, BUILT_IN] });
  await h.c.ensureMic();
  const next = await h.c.nextMicrophone();
  assert.equal(next.label, "Built-in microphone");
  assert.equal(h.values.micDeviceId, "built-in-id");
  assert.equal(h.c.stream, null, "the old microphone is released");
  await h.c.ensureMic();
  assert.equal(h.requests.at(-1), "built-in-id");
  const single = harness({ devices: [BUILT_IN] });
  await single.c.ensureMic();
  assert.equal(await single.c.nextMicrophone(), null);
});

test("the spoken command is recognised in every language and is not sent to the assistant", () => {
  const c = vm.createContext({ lang: "en" });
  vm.runInContext(app.slice(app.indexOf("  var LANG_WORDS = {"), app.indexOf("  async function runCommand")), c);
  for (const phrase of ["Change microphone.", "Please change the microphone", "Cambia microfono", "Changer de microphone",
    "Смени микрофона", "Сменить микрофон", "换麦克风", "マイクを変更して"]) {
    assert.equal(c.voiceCommand(phrase), "mic", phrase);
  }
  assert.equal(c.voiceCommand("which microphone should I buy for a podcast"), null);
});

test("the page has a Change microphone button and list, hidden until microphones are known", () => {
  assert.match(html, /<button id="micBtn"[^>]*aria-expanded="false"[^>]*hidden[^>]*>/);
  assert.match(html, /<div id="mics" role="group" aria-labelledby="micBtn" hidden>/);
  for (const lang of I.LANGS) for (const key of ["micButton", "micFallback", "micNow", "micOnlyOne"]) assert.ok(I.S[lang][key], `${lang}/${key}`);
});
