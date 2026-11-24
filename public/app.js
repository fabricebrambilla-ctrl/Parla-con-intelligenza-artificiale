(function () {
  "use strict";
  var I = window.I18N;
  var C = window.AppCapabilities;
  var $ = function (id) { return document.getElementById(id); };

  // iPhone/iPad (also iPadOS, which reports itself as a Mac with touch).
  var IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
               (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Coarse-pointer devices use the main button to pause.
  var IS_TOUCH = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches);

  var device = C.detectDevice(navigator, IS_TOUCH);
  var paused = false, continuous = false, speed = 1, spokenEcho = "", echoUntil = 0;

  // ---------- storage (never required to work) ----------
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Previous releases saved a tracking identifier. It is no longer needed.
  try { localStorage.removeItem("anonId"); } catch (e) {}

  // Conversations are never saved (owner's choice, 2026-10-24); delete what older versions saved.
  try { localStorage.removeItem("history"); } catch (e) {}

  // ---------- language ----------
  // Links back from About and the legal pages carry the selected language.
  var urlLang = null;
  try {
    var pageParams = new URLSearchParams(window.location.search);
    if (pageParams.getAll("lang").length === 1) urlLang = pageParams.get("lang");
  } catch (e) {}
  var lang = I.LANGS.indexOf(urlLang) !== -1 ? urlLang :
    I.pick(get("lang") ? [get("lang")] : navigator.languages || [navigator.language]);
  var tt = function (key) { return I.t(lang, key); };
  // Same, but with the touch wording on phones and tablets.
  var tk = function (key) { return IS_TOUCH && I.S[lang][key + "Touch"] ? tt(key + "Touch") : tt(key); };

  var talkBtn = $("talk"), endBtn = $("endConv"), langBtn = $("lang"),
      langsBox = $("langs"), alertBox = $("alert"), micPermission = $("micPermission"),
      micBtn = $("micBtn"), micsBox = $("mics"),
      lastBtn = $("lastBtn"), lastBox = $("lastBox"), lastText = $("lastText"), copyBtn = $("copyBtn"), copyStatus = $("copyStatus");

  if (IS_TOUCH) $("helpText").setAttribute("data-i18n", "helpTouch");
  // Languages not switched on yet (see NEW_LANGUAGES) are not offered.
  (function () {
    var all = langsBox.querySelectorAll("[data-set-lang]");
    for (var i = 0; i < all.length; i++) if (I.LANGS.indexOf(all[i].getAttribute("data-set-lang")) === -1) all[i].parentNode.removeChild(all[i]);
  })();

  function renderTexts() {
    if (afterSpeech(renderTexts)) return;
    I.applyPage(lang);
    $("helpText").textContent = tk("help") + (IS_TOUCH ? "" : " " + tt("shortcutHelp"));
    if (micPermission.textContent) micPermission.textContent = micShortText();
    talkBtn.textContent = active ? tt(paused ? "resume" : "pause") : tt("start");
    endBtn.textContent = tt("end");
    micBtn.textContent = tt("micButton");
    lastBtn.textContent = tt("lastButton");
    copyBtn.textContent = tt("copyButton");
    $("lastHeading").textContent = tt("lastHeading");
    // Keep the chosen language on the other pages too.
    $("instructionsLink").href = "/instructions?lang=" + lang;
    $("aboutLink").href = "/about?lang=" + lang;
    $("privacyLink").href = "/privacy?lang=" + lang;
    $("termsLink").href = "/terms?lang=" + lang;
    $("accessibilityLink").href = "/accessibility?lang=" + lang;
    var opts = langsBox.querySelectorAll("[data-set-lang]");
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].getAttribute("data-set-lang") === lang) opts[i].setAttribute("aria-current", "true");
      else opts[i].removeAttribute("aria-current");
    }
  }

  // ---------- state ----------
  var active = false;      // a conversation is running
  var session = 0;         // increases on every start/end, to drop stale async work
  var state = "idle";      // idle | ready (waiting for microphone readiness) | listening | processing | speaking
  var transcript = [];     // [{role, content}] kept in memory only
  var context = "";        // always empty: conversations are not saved
  var failures = 0;        // failed turns in a row
  var choosing = false;    // the assistant is asking which language to use
  var talkLabel = false;   // the button reads "Talk" (from the first time the assistant waits for the user)
  var pendingTalk = false; // speech interrupted the assistant: start recording when it has stopped
  var aiVoiceLangs = [];   // languages with the natural AI voice (from the server)
  var readingPage = null;  // the page being read aloud in parts ({url, part, parts}), in memory only
  var lastAnswer = "";     // text of the last answer (or the long content the assistant put in the box), in memory only

  function setState(s) {
    state = s;
    document.body.setAttribute("data-state", s);
    if (s !== "speaking") {
      var queued = afterSpeech.queue || [];
      afterSpeech.queue = [];
      queued.forEach(function (job) { if (job.session === session) job.run(); });
    }
  }

  // Defer page announcements until playback ends; discard work from older sessions.
  function afterSpeech(run) {
    if (state !== "speaking") return false;
    (afterSpeech.queue || (afterSpeech.queue = [])).push({ session: session, run: run });
    return true;
  }

  // ---------- mute gate: the screen reader is probably talking ----------
  var muteUntil = 0;
  // While muted, microphone frames are skipped (not recorded).
  function muteFor(ms) {
    muteUntil = Math.max(muteUntil, performance.now() + ms);
  }
  // Preserve native controls and screen-reader keyboard combinations.
  function isOtherControl(el) {
    return !!(el && el.closest && el !== talkBtn && el.closest("button, a, input, select, textarea, [contenteditable]"));
  }
  function isTalkShortcut(e) {
    return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey &&
      (e.code === "KeyT" || String(e.key).toLowerCase() === "t");
  }
  function micErrorKey(e) {
    return e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") ? "errMicDenied" : "errMic";
  }
  ["keydown", "focusin", "click", "pointerdown", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      // The screen reader says little when the main control is pressed,
      // so only pause the mic briefly then.
      var talk = e.target === talkBtn || (e.type === "keydown" && isTalkShortcut(e));
      muteFor(talk && !IS_TOUCH ? 300 : 1500);
    }, { capture: true, passive: true });
  });
  window.addEventListener("focus", function () { muteFor(1000); });
  document.addEventListener("visibilitychange", function () { muteFor(1000); });

  // ---------- errors: one alert, only after audio stopped ----------
  function announce(key) {
    if (!/^err/.test(key) && afterSpeech(function () { announce(key); })) return;
    muteFor(4000);
    alertBox.textContent = "";
    setTimeout(function () {
      if (!/^err/.test(key) && afterSpeech(function () { announce(key); })) return;
      alertBox.textContent = tt(key);
    }, 150);
  }

  // ---------- audio context and sounds ----------
  var ctx = null;
  function ensureContext() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS can leave the context "interrupted" after a call or another app.
    if (ctx.state !== "running") ctx.resume().catch(function () {});
  }
  function tone(freq, startIn, dur, vol) {
    if (!ctx) return;
    var t0 = ctx.currentTime + startIn;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  var sounds = {
    start: function () { tone(523, 0, 0.18, 0.15); tone(784, 0.15, 0.25, 0.15); },
    end: function () { tone(784, 0, 0.18, 0.15); tone(523, 0.15, 0.3, 0.15); },
    turn: function () { tone(880, 0, 0.12, 0.08); },             // recording starts
    stop: function () { tone(660, 0, 0.1, 0.07); },              // recording sent
    tick: function () { tone(440, 0, 0.05, 0.04); }
  };
  var thinkTimer = null, thinkDelay = null;
  function startThinking() {
    stopThinking();
    thinkDelay = setTimeout(function () {
      sounds.tick();
      thinkTimer = setInterval(sounds.tick, 1000);
    }, 1500);
  }
  function stopThinking() {
    clearTimeout(thinkDelay);
    clearInterval(thinkTimer);
    thinkDelay = thinkTimer = null;
  }

  // ---------- speech output ----------
  // English: natural AI voice from the server, played in this page (so echo
  // cancellation knows about it). Other languages, or if that fails: the best
  // voice installed on the device.
  var voices = [];
  function loadVoices() { if (window.speechSynthesis) voices = speechSynthesis.getVoices() || []; }
  if (window.speechSynthesis) {
    loadVoices();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener("voiceschanged", loadVoices);
    else speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Voices known to sound natural (Microsoft Edge online voices, Apple and Google voices).
  var NICE_VOICES = {
    en: /aria|jenny|ava|andrew|emma|brian|guy|samantha|ava|zoe|serena|daniel|google us english/,
    it: /elsa|isabella|diego|giuseppe|alice|federica|luca|google italiano/,
    fr: /denise|vivienne|henri|remy|eloise|amélie|amelie|thomas|audrey|google français/,
    bg: /kalina|borislav|daria/,
    ru: /svetlana|dariya|dmitry|milena|yuri|katya|google русский/,
    ja: /nanami|keita|kyoko|otoya|haruka|ichiro|sayaka|google 日本語/,
    zh: /xiaoxiao|xiaoyi|yunxi|yunjian|tingting|lili|google 普通话|google 中文/,
    nl: /colette|fenna|maarten|xander|claire|google nederlands/,
    pt: /raquel|duarte|fernanda|joana|catarina|google português de portugal/,
    "pt-BR": /francisca|antonio|thalita|luciana|felipe|google português do brasil/
  };

  function pickVoice(code) {
    var want = I.META[code].speech.toLowerCase();
    var base = want.split("-")[0];
    var best = null, bestScore = -Infinity;
    voices.forEach(function (v) {
      var vl = String(v.lang || "").replace("_", "-").toLowerCase();
      if (vl.split("-")[0] !== base) return;
      var n = String(v.name || "").toLowerCase();
      var s = 0;
      if (vl === want) s += 2;
      // Portugal's Portuguese gets a Portugal voice and Brazilian a Brazilian one; the other only when there is none.
      if ((code === "pt" || code === "pt-BR") && vl !== want) s -= 9;
      if (/natural|neural/.test(n)) s += 8;          // Edge online voices, Windows 11 natural voices
      if (/premium|enhanced|siri/.test(n)) s += 6;   // Apple high-quality voices
      if (/google/.test(n)) s += 4;                  // Chrome and Android voices
      if (/online/.test(n)) s += 2;
      if (/espeak|compact|robot|novelty/.test(n)) s -= 6;
      if (/desktop/.test(n)) s -= 2;                 // older Windows voices
      if (NICE_VOICES[code] && NICE_VOICES[code].test(n)) s += 3;
      if (s > bestScore) { best = v; bestScore = s; }
    });
    return best;
  }

  function splitSentences(text, max) {
    var parts = String(text).match(/[^.!?;。！？；]+[.!?;。！？；]*["'»”)]*\s*/g) || [String(text)];
    var out = [], cur = "";
    parts.forEach(function (p) {
      if ((cur + p).length > max && cur) { out.push(cur); cur = p; } else cur += p;
    });
    if (cur.trim()) out.push(cur);
    // Very long sentences are cut at a comma or space so nothing is dropped.
    var final = [];
    out.forEach(function (c) {
      while (c.length > max) {
        var cut = Math.max(c.lastIndexOf(",", max), c.lastIndexOf(" ", max));
        if (cut < max / 2) cut = max;
        final.push(c.slice(0, cut + 1));
        c = c.slice(cut + 1);
      }
      if (c.trim()) final.push(c);
    });
    return final;
  }

  var lastSaid = "";        // the assistant's last reply or greeting, for "repeat"
  var lastSaidLang = null; // the language it was said in

  var stopSpeaking = null;  // set while something is being said
  var aiVoiceFailures = 0;

  function speakBrowser(chunks, isCancelled, code) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis || !chunks.length) return resolve();
      var voice = pickVoice(code);
      var i = 0, watchdog = null, cancelPoll = null;
      function finish() { clearTimeout(watchdog); clearInterval(cancelPoll); resolve(); }
      cancelPoll = setInterval(function () { if (isCancelled()) finish(); }, 50);
      function next() {
        clearTimeout(watchdog);
        if (isCancelled()) return finish();
        if (i >= chunks.length) return finish();
        var chunk = chunks[i++];
        var u = new SpeechSynthesisUtterance(chunk);
        u.lang = I.META[code].speech;
        u.rate = speed;
        if (voice) u.voice = voice;
        u.onend = next;
        u.onerror = next;
        // Some browsers never fire onend; never get stuck.
        var perChar = (code === "zh" || code === "ja") ? 300 : 110;
        watchdog = setTimeout(next, 4000 + chunk.length * perChar);
        speechSynthesis.speak(u);
      }
      next();
    });
  }

  function fetchAiVoice(text, code) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 12000);
    return fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang: code, text: text }),
      signal: ctl.signal
    }).then(function (r) {
      if (!r.ok) throw new Error("voice " + r.status);
      return r.blob();
    }).finally(function () { clearTimeout(timer); });
  }

  function playBuffer(buffer, isCancelled) {
    return new Promise(function (resolve, reject) {
      if (isCancelled()) return resolve();
      var url = URL.createObjectURL(buffer), audio = new Audio(url), done = false;
      audio.playbackRate = speed;
      audio.preservesPitch = true;
      audio.webkitPreservesPitch = true;
      var poll, watchdog;
      function finish(error) {
        if (done) return; done = true;
        clearInterval(poll); clearTimeout(watchdog); audio.pause();
        audio.removeAttribute("src"); audio.load(); URL.revokeObjectURL(url);
        if (error) reject(error); else resolve();
      }
      audio.onended = function () { finish(); };
      audio.onerror = function () { finish(new Error("Audio playback failed")); };
      poll = setInterval(function () { if (isCancelled()) finish(); }, 50);
      watchdog = setTimeout(function () { finish(new Error("Audio playback timeout")); }, 120000);
      audio.play().catch(finish);
    });
  }

  // Returns the chunks that could not be said with the AI voice.
  async function speakAi(chunks, isCancelled, code) {
    var next = fetchAiVoice(chunks[0], code);
    for (var i = 0; i < chunks.length; i++) {
      var buffer;
      try { buffer = await next; } catch (e) {
        aiVoiceFailures++;
        return chunks.slice(i);
      }
      // Fetch the next sentence while this one plays.
      if (i + 1 < chunks.length) { next = fetchAiVoice(chunks[i + 1], code); next.catch(function () {}); }
      try { await playBuffer(buffer, isCancelled); } catch (e) { return chunks.slice(i); }
      if (isCancelled()) return [];
    }
    aiVoiceFailures = 0;
    return [];
  }

  // Says `text` in language `code` (default: the chosen language). Resolves true if interrupted.
  async function say(text, code) {
    code = code || lang;
    text = String(text || "").trim();
    if (!text) return false;
    if (stopSpeaking) stopSpeaking();
    var cancelled = false;
    var isCancelled = function () { return cancelled; };
    var my = session;
    var cancelSpeech = stopSpeaking = function () {
      cancelled = true;
      if (window.speechSynthesis) speechSynthesis.cancel();
    };
    setState("speaking");
    // Keep input available for interruption. AEC and a conservative text filter mitigate echo.
    spokenEcho = text; echoUntil = performance.now() + 120000;
    if (continuous && !paused && !choosing && stream) rec = { auto:false, frames:[], elapsed:0, voiced:0, silence:0, speechFrames:0, speechStarted:false };

    var rest = splitSentences(text, 220);
    if (aiVoiceLangs.indexOf(code) !== -1 && aiVoiceFailures < 3) {
      rest = await speakAi(splitSentences(text, 300), isCancelled, code);
    }
    if (rest.length && !cancelled) await speakBrowser(rest, isCancelled, code);
    if (stopSpeaking === cancelSpeech) {
      stopSpeaking = null;
      if (my === session && state === "speaking") setState("processing");
    }
    return cancelled;
  }

  // ---------- microphone + voice activity detection ----------
  var stream = null, source = null, node = null, sink = null, workletCtx = null;

  // Continuous listening: a turn ends after a pause in speech.
  var rec = null;
  var noise = 0.004;   // background noise level, learned while recording

  // ---------- remembered microphone ----------
  // The device ID and name of the microphone are readable only after permission.
  // They are kept in this browser so the same microphone is requested next time.
  var mics = [];                  // [{id, label}], built after the first grant
  var micFallbackNotice = false;  // the saved microphone was missing on the last request
  var micFallbackSaid = false;    // ...and the user was told, once per conversation
  var micDefaultId = "";          // the real device behind Chrome's "default" entry
  function micConstraints(id) {
    var audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      voiceIsolation: { ideal: true }, channelCount: 1 };
    if (id) audio.deviceId = { exact: id };
    return { audio: audio };
  }
  function micTrackInfo(s) {
    var track = s && s.getAudioTracks ? s.getAudioTracks()[0] : null;
    var settings = track && track.getSettings ? track.getSettings() : {};
    return { id: settings.deviceId || "", label: (track && track.label) || "" };
  }
  async function refreshMics() {
    var list = [], seen = {};
    try { list = await navigator.mediaDevices.enumerateDevices(); } catch (e) {}
    // Chrome reports the system default as a copy named "default"; find the real device behind it.
    micDefaultId = "";
    (list || []).forEach(function (d) {
      if (d.kind !== "audioinput" || d.deviceId !== "default" || !d.groupId) return;
      (list || []).forEach(function (x) {
        if (x.kind === "audioinput" && x.groupId === d.groupId && x.deviceId && x.deviceId !== "default" && x.deviceId !== "communications") micDefaultId = x.deviceId;
      });
    });
    mics = (list || []).filter(function (d) {
      // "default" and "communications" are Chrome's duplicates of a real device.
      if (d.kind !== "audioinput" || !d.label || !d.deviceId || d.deviceId === "default" || d.deviceId === "communications") return false;
      if (seen[d.deviceId]) return false;
      seen[d.deviceId] = true;
      return true;
    }).map(function (d) { return { id: d.deviceId, label: d.label }; });
    return mics;
  }
  function missingDevice(e) { return !!e && (e.name === "OverconstrainedError" || e.name === "NotFoundError"); }
  // The saved microphone exactly; if it is unplugged, the default one (the caller says so by voice).
  async function requestMicStream() {
    micFallbackNotice = false;
    var md = navigator.mediaDevices, saved = get("micDeviceId"), label = get("micDeviceLabel");
    if (saved) {
      try { return await md.getUserMedia(micConstraints(saved)); }
      catch (e) { if (!missingDevice(e)) throw e; }
    }
    var got = await md.getUserMedia(micConstraints(null)), info = micTrackInfo(got);
    if (!saved) {
      if (info.id === "default" || info.id === "communications") {
        await refreshMics();
        var real = mics.filter(function (m) { return m.id === micDefaultId; })[0];
        if (real) info = real;
      }
      if (info.id) { set("micDeviceId", info.id); set("micDeviceLabel", info.label); }
      return got;
    }
    // Some browsers give devices new IDs in a new session: the same microphone under
    // a new ID is not a missing microphone.
    if (label && info.label === label) { if (info.id) set("micDeviceId", info.id); return got; }
    var same = label ? (await refreshMics()).filter(function (m) { return m.label === label; })[0] : null;
    if (same) {
      try {
        var again = await md.getUserMedia(micConstraints(same.id));
        got.getTracks().forEach(function (t) { t.stop(); });
        set("micDeviceId", same.id);
        return again;
      } catch (e2) {}
    }
    micFallbackNotice = true;
    return got;
  }
  function currentMicId() {
    var saved = get("micDeviceId");
    if (mics.some(function (m) { return m.id === saved; })) return saved;
    var open = micTrackInfo(stream).id;
    if (mics.some(function (m) { return m.id === open; })) return open;
    return mics.length ? mics[0].id : "";
  }
  // Saves the choice and releases the open microphone; the next turn opens the new one.
  function chooseMic(m) {
    set("micDeviceId", m.id);
    set("micDeviceLabel", m.label);
    micFallbackSaid = false;
    if (rec && rec.auto) finishRecording();
    else if (rec) rec = null;
    var wasListening = state === "listening";
    closeMic();
    if (active && wasListening) goReady();
  }
  // "Change microphone": the next one in the list. Null when there is only one.
  async function nextMicrophone() {
    await refreshMics();
    if (mics.length < 2) return null;
    var cur = currentMicId(), at = 0;
    for (var i = 0; i < mics.length; i++) if (mics[i].id === cur) at = i;
    var next = mics[(at + 1) % mics.length];
    chooseMic(next);
    return next;
  }
  // Opens the microphone and, once per conversation, says that the default one is in use.
  async function ensureMic() {
    for (var attempt = 0; attempt < 2 && !stream; attempt++) {
      await openMic();
      if (!micFallbackNotice || micFallbackSaid) return;
      micFallbackSaid = true;
      await say(tt("micFallback"));   // on iPhone, speaking releases the microphone: open it again
    }
  }

  // ---------- first microphone permission ----------
  // Only browsers whose prompt wording was checked get specific words; iPhone, Safari and
  // Android get the general "choose Allow" until they are tested.
  function micBrowser() {
    var ua = String(navigator.userAgent || "");
    if (/Android|iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/.test(ua)) return "";
    if (/Firefox\//.test(ua)) return "Firefox";
    if (/Chrome\//.test(ua) && !/Edg\/|OPR\/|SamsungBrowser|YaBrowser|Vivaldi/.test(ua)) return "Chrome";
    return "";
  }
  function micShortText() { return tt("micShort" + micBrowser()); }
  // "granted", "denied", "prompt" (not asked yet), or "unknown". A remembered guide is not
  // a grant: this is asked again on every Start, because browsers can end a permission.
  async function microphonePermissionState() {
    var state = "unknown";
    if (navigator.permissions && navigator.permissions.query) {
      try { state = (await navigator.permissions.query({ name: "microphone" })).state || "unknown"; } catch (e) {}
    }
    // Where the browser cannot be asked: microphone names are readable only once access is allowed.
    if (state === "unknown" && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      try {
        var list = await navigator.mediaDevices.enumerateDevices();
        if ((list || []).some(function (d) { return d.kind === "audioinput" && d.label; })) state = "granted";
      } catch (e2) {}
    }
    return state;
  }
  var micAllowedHere = false;   // the microphone was already opened on this page

  var micRequest = 0, restoreMicFocus = null, micFocusOwner = null;
  function cancelMicFocusRestore() {
    if (restoreMicFocus) window.removeEventListener("focus", restoreMicFocus);
    restoreMicFocus = null;
  }
  function clearMicPermission() {
    cancelMicFocusRestore();
    micPermission.textContent = "";
    // Firefox may return DOM focus to the document after its permission panel.
    // Restore only focus we owned; never displace a link/control the user chose.
    function ownsFocus() {
      return document.activeElement === micPermission || (micFocusOwner === micRequest &&
        (document.activeElement === document.body || document.activeElement === document.documentElement));
    }
    if (!ownsFocus()) { micFocusOwner = null; return; }
    var my = session, request = micRequest;
    restoreMicFocus = function () {
      if (my !== session || request !== micRequest || !ownsFocus()) {
        cancelMicFocusRestore();
        micFocusOwner = null;
        return;
      }
      // Browser permission controls may still own focus when the request settles.
      if (!document.hasFocus()) return;
      cancelMicFocusRestore();
      micFocusOwner = null;
      talkBtn.focus({ preventScroll: true });
    };
    window.addEventListener("focus", restoreMicFocus);
    restoreMicFocus();
  }
  async function openMic() {
    cancelMicFocusRestore();
    micFocusOwner = null;
    var my = session, request = ++micRequest, acquired = null, audioSource = null;
    function current() { return active && my === session && request === micRequest; }
    function cancelled() { var e = new Error("Microphone request cancelled"); e.name = "AbortError"; return e; }
    try {
      var granted = micAllowedHere || (await microphonePermissionState()) === "granted";
      if (!current()) throw cancelled();
      if (!granted) {
        var explanation = micShortText();
        micPermission.textContent = explanation;
        // Focus once, then wait before asking the browser: its prompt takes focus at once,
        // and a screen reader needs time to announce the explanation first. Never schedule
        // a later focus move that could interrupt the browser's permission controls.
        if (document.hasFocus()) {
          micPermission.focus({ preventScroll: true });
          if (document.activeElement === micPermission) micFocusOwner = request;
          await announcePause(Math.min(4500, 2000 + explanation.length * 30));
          if (!current()) throw cancelled();
        }
      }
      acquired = await requestMicStream();
      if (!current()) throw cancelled();
      micAllowedHere = true;
      refreshMics();
      clearMicPermission();
      try {
        audioSource = ctx.createMediaStreamSource(acquired);
      } catch (e) {
        // Firefox requires the context and microphone sample rates to match.
        var rate = acquired.getAudioTracks()[0].getSettings().sampleRate;
        if (!rate) throw e;
        try { ctx.close(); } catch (e2) {}
        ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: rate });
        audioSource = ctx.createMediaStreamSource(acquired);
      }
      var micCtx = ctx;
      if (workletCtx !== micCtx) {
        await micCtx.audioWorklet.addModule("/capture-worklet.js");
        if (!current()) throw cancelled();
        workletCtx = micCtx;
      }
      stream = acquired;
      source = audioSource;
      node = new AudioWorkletNode(micCtx, "capture");
      node.port.onmessage = function (e) { onFrame(e.data); };
      sink = micCtx.createGain();
      sink.gain.value = 0;
      source.connect(node);
      node.connect(sink).connect(micCtx.destination);
    } catch (e) {
      if (audioSource) { try { audioSource.disconnect(); } catch (ignore) {} }
      if (acquired) acquired.getTracks().forEach(function (t) { t.stop(); });
      throw e;
    } finally {
      if (my === session && request === micRequest) clearMicPermission();
    }
  }

  function closeMic() {
    micRequest++;
    clearMicPermission();
    try { if (source) source.disconnect(); } catch (e) {}
    try { if (node) { node.port.onmessage = null; node.disconnect(); } } catch (e) {}
    try { if (sink) sink.disconnect(); } catch (e) {}
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = source = node = sink = null;
  }

  // Frames are 20 ms. Speech counts as started after ~200 ms of voice
  // (low sensitivity, short pauses allowed); 300 ms before that are kept.
  var SEVEN_SECONDS = 350, MAX_FRAMES = 1500;  // 30 s
  function onFrame(frame) {
    if (paused || (state !== "listening" && state !== "speaking") || !rec) return;
    if (performance.now() < muteUntil) return;
    var sum = 0;
    for (var i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    var rms = Math.sqrt(sum / frame.length);
    var threshold = Math.max(noise * (state === "speaking" ? 5 : 3), state === "speaking" ? 0.025 : 0.012);
    rec.elapsed++;

    if (!rec.speechStarted) {
      rec.frames.push(frame);
      if (rec.frames.length > 25) rec.frames.shift();
      if (rms > threshold) rec.voiced++;
      else {
        rec.voiced = Math.max(0, rec.voiced - 2);
        noise = Math.min(0.05, noise * 0.95 + rms * 0.05);
      }
      if (rec.voiced >= (state === "speaking" ? 15 : 10)) {
        rec.speechStarted = true; rec.speechFrames = rec.voiced;
        if (state === "speaking") {
          session++; // Invalidate the interrupted answer and its pending page command.
          if (stopSpeaking) stopSpeaking();
          stopThinking(); setState("listening");
        }
      }
      // Nothing said: after 7 s (or 7 s for the language question too) stop waiting.
      else if (rec.elapsed >= SEVEN_SECONDS) { rec.elapsed = 0; }
      return;
    }

    rec.frames.push(frame);
    if (rms > threshold * 0.7) { rec.silence = 0; rec.speechFrames++; }
    else rec.silence++;
    // The language question ends by itself after a short pause; a normal turn after 7 s of silence.
    if (rec.silence >= (rec.auto ? 60 : 75) || rec.frames.length >= MAX_FRAMES) finishRecording();
  }

  function encodeWav(frames, rate) {
    var total = 0;
    frames.forEach(function (f) { total += f.length; });
    var input = new Float32Array(total), off = 0;
    frames.forEach(function (f) { input.set(f, off); off += f.length; });

    var outRate = 16000, ratio = rate / outRate;
    var n = Math.floor(input.length / ratio);
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
    str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      // average the samples that fall into this output sample
      var a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio)), s = 0;
      for (var j = a; j < b; j++) s += input[j];
      s = b > a ? s / (b - a) : 0;
      s = Math.max(-1, Math.min(1, s));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([buf], { type: "audio/wav" });
  }

  // ---------- server calls ----------
  // Errors: {code: "errLimit"} (daily limit, ends the conversation) or
  // {code: "temporary"} (network, sleeping server, busy AI: ask to repeat).
  async function request(url, opts) {
    var ctl = new AbortController();
    // Generous: a sleeping free server can take ~50 s to wake up, and reading a page takes time.
    var timer = setTimeout(function () { ctl.abort(); }, 90000);
    opts.signal = ctl.signal;
    opts.headers = Object.assign({}, opts.headers || {});
    try {
      var res = await fetch(url, opts);
      if (res.status === 429) throw { code: "errLimit" };
      if (!res.ok) throw { code: "temporary" };
      return res;
    } catch (e) {
      throw e && e.code ? e : { code: "temporary" };
    } finally {
      clearTimeout(timer);
    }
  }

  async function api(url, opts) {
    var res = await request(url, opts);
    try { return await res.json(); } catch (e) { throw { code: "temporary" }; }
  }

  // /api/chat sends lines of JSON: maybe {"type":"searching"}, then the reply.
  async function chat(body, onSearching) {
    var res = await request("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    var text = "";
    var handle = function (line) {
      if (!line.trim()) return null;
      var msg = JSON.parse(line);
      if (msg.type === "searching") { onSearching(); return null; }
      if (msg.type === "error") throw { code: msg.error === "limit" ? "errLimit" : "temporary" };
      if (msg.type === "reply") return msg;
      return null;
    };
    try {
      if (res.body && res.body.getReader) {
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
        for (;;) {
          var part = await reader.read();
          if (part.done) break;
          buf += dec.decode(part.value, { stream: true });
          var nl;
          while ((nl = buf.indexOf("\n")) !== -1) {
            var reply = handle(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
            if (reply) return reply;
          }
        }
        text = buf;
      } else {
        text = await res.text();
      }
      var lines = text.split("\n");
      for (var i = 0; i < lines.length; i++) { var r = handle(lines[i]); if (r) return r; }
    } catch (e) {
      throw e && e.code ? e : { code: "temporary" };
    }
    throw { code: "temporary" };
  }

  // ---------- goodbye detection (backup for the model's end_conversation) ----------
  // (\b does not work for Cyrillic, so match whole words by padding with spaces)
  var GOODBYE = ["goodbye", "good bye", "bye", "stop", "arrivederci", "ciao ciao", "basta", "au revoir",
                 "arrête", "arrete", "довиждане", "чао", "стоп", "до свидания", "пока", "хватит",
                 "tot ziens", "doei", "dag dag", "stoppen", "adeus", "tchau", "até logo", "até à próxima", "parar",
                 "xau", "adeusinho", "até já", "até amanhã"];
  function isGoodbye(text) {
    var clean = text.toLowerCase().replace(/[.,!?¡¿;:。，！？«»"“”]/g, " ").replace(/\s+/g, " ").trim();
    var compact = clean.replace(/[\s「」『』。]/g, "");
    if (/^(さようなら|さよなら|終了|終わり|会話を終了|会話を終了して|会話を終了してください|会話を終わります|ストップ)$/.test(compact)) return true;
    if (lang === "zh" || /[一-鿿]/.test(clean)) {
      return clean.length <= 6 && /再见|拜拜|停止/.test(clean);
    }
    if (clean.split(" ").length > 4) return false;
    var padded = " " + clean + " ";
    return GOODBYE.some(function (w) { return padded.indexOf(" " + w + " ") !== -1; });
  }

  // ---------- conversation controls ----------
  // During a conversation: the Talk button (no description, so moving back to it is short to hear)
  // and an End conversation button right after it.
  // The label becomes "Talk" only when the assistant first waits for the user (see goReady), so the
  // screen reader's "Talk, button" doesn't talk over the greeting and works as the cue to press it.
  function showConversationControls(on) {
    if (afterSpeech(function () { showConversationControls(on); })) return;
    if (!on) { talkLabel = false; talkBtn.textContent = tt("start"); }
    if (on) { talkBtn.setAttribute("data-active", "true"); talkBtn.removeAttribute("aria-describedby"); }
    else { talkBtn.removeAttribute("data-active"); talkBtn.setAttribute("aria-describedby", "agree helpText"); }
    // Never leave focus on a button that disappears.
    if (!on && document.activeElement === endBtn) talkBtn.focus();
    endBtn.hidden = !on;
  }

  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }

  // ---------- conversation ----------
  // Return directly to listening, with no second activation.
  function goReady() {
    if (!active || paused || state === "listening") return;
    setState("ready");
    if (!talkLabel) { talkLabel = true; talkBtn.textContent = tt("pause"); }
    // Only recover lost page focus. End, Copy, Language and all chosen controls win.
    if (document.hasFocus() && (document.activeElement === document.body ||
        document.activeElement === document.documentElement)) talkBtn.focus({ preventScroll: true });
    pendingTalk = false;
    return startRecording(false);
  }

  async function startRecording(auto) {
    var my = session, request = startRecording.request = (startRecording.request || 0) + 1;
    if (!stream) {
      setState("processing");
      try { await ensureMic(); } catch (e) { if (my === session) fail(micErrorKey(e)); return; }
      if (!active || paused || my !== session) return;
      if (!stream) { fail("errMic"); return; }
    }
    if (IS_TOUCH) {
      rec = null;
      setState("processing");
      // Mitigation only: the page cannot hear or detect TalkBack/VoiceOver speech.
      // Hold all recording and the speak-now cue until the gesture announcement settles.
      muteFor(1500);
      do {
        await new Promise(function (resolve) { setTimeout(resolve, Math.max(0, muteUntil - performance.now())); });
        if (!active || paused || my !== session || request !== startRecording.request) return;
      } while (performance.now() < muteUntil);
    }
    if (!active || paused || my !== session || request !== startRecording.request) return;
    if (IS_TOUCH && !stream) {
      if (auto && recResolve) { var done = recResolve; recResolve = null; done(null); }
      else fail("errMic");
      return;
    }
    rec = { auto: auto, frames: [], elapsed: 0, voiced: 0, silence: 0, speechFrames: 0, speechStarted: false };
    setState("listening");
    sounds.turn();
    buzz(40);
  }

  var recResolve = null; // used by the language question
  function finishRecording() {
    var r = rec;
    rec = null;
    if (!r || !ctx) return;
    var heard = r.speechStarted && r.speechFrames >= 10;
    // Drop long trailing silence, keep a little.
    var frames = heard ? r.frames.slice(0, r.frames.length - Math.max(0, r.silence - 25)) : [];
    var wav = heard ? encodeWav(frames, ctx.sampleRate) : null;
    if (r.auto) { setState("processing"); var done = recResolve; recResolve = null; if (done) done(wav); return; }
    sounds.stop();
    buzz([30, 60, 30]);
    if (heard) handleUtterance(wav);
    else nothingHeard();
  }

  async function nothingHeard() {
    var my = session;
    await say(tk("notHeard"));
    if (my === session) goReady();
  }

  // ---------- language question (first conversation only) ----------
  var LANG_WORDS = {
    ja: ["japanese", "giapponese", "japonais", "японск", "日本語", "日语", "日文", "nihongo", "japans", "japonês", "japones"],
    en: ["英語", "english", "inglese", "anglais", "английски", "английск", "англий", "英语", "英文", "engels", "inglês", "ingles"],
    it: ["イタリア語", "italian", "italien", "италиански", "итальянск", "意大利", "italiaans"],
    fr: ["フランス語", "french", "français", "francais", "francese", "френски", "французск", "法语", "法文", "frans", "francês", "frances"],
    bg: ["ブルガリア語", "bulgarian", "българск", "bulgaro", "bulgare", "болгарск", "保加利亚", "bulgaars", "búlgaro"],
    ru: ["ロシア語", "russian", "русск", "russo", "russe", "руски", "俄语", "俄文", "russisch"],
    zh: ["中国語", "chinese", "mandarin", "cinese", "chinois", "китайск", "中文", "汉语", "普通话", "华语", "中国", "chinees", "chinês", "chines"],
    nl: ["オランダ語", "dutch", "olandese", "néerlandais", "neerlandais", "нидерландск", "холандски", "голландск", "荷兰语", "荷兰",
         "nederlands", "hollands", "neerlandês", "neerlandes", "holandês", "holandes"],
    pt: ["ポルトガル語", "portuguese", "portoghese", "portugais", "португалски", "португальск", "葡萄牙语", "葡萄牙",
         "português", "portugues", "portugees", "brasileiro", "brazilian"]
  };
  var WHISPER_LANGS = { japanese: "ja", english: "en", italian: "it", french: "fr", bulgarian: "bg", russian: "ru", chinese: "zh",
                        dutch: "nl", portuguese: "pt" };

  function matchLanguage(text, detected) {
    var t = String(text || "").toLowerCase();
    var best = null, bestPos = Infinity;
    Object.keys(LANG_WORDS).forEach(function (code) {
      LANG_WORDS[code].forEach(function (w) {
        var p = t.indexOf(w);
        if (p !== -1 && p < bestPos) { best = code; bestPos = p; }
      });
    });
    if (best === "pt") return portugueseVariant(t);
    // A language that is not switched on yet (NEW_LANGUAGES) is not chosen.
    if (best) return I.LANGS.indexOf(best) !== -1 ? best : null;
    // Just a word or two in some language ("Italiano", "Русский"): use the language it was spoken in.
    var short = t.trim().split(/\s+/).length <= 3;
    var spoken = short && WHISPER_LANGS[String(detected || "").toLowerCase()];
    if (spoken === "pt") return portugueseVariant(t);
    return spoken && I.LANGS.indexOf(spoken) !== -1 ? spoken : null;
  }

  // ---------- Portugal or Brazil (2026-11-19) ----------
  // "Português do Brasil" / "brasileiro" is Brazilian, "português de Portugal" / "europeu" Portugal's.
  // Just "português": the variant in use, else the one chosen before, else the browser's.
  function ptNamed(text) {
    var br = /brasil|brazil/.test(text), pt = /portugal|europeu|europeia|european/.test(text);
    return br && !pt ? "pt-BR" : pt && !br ? "pt" : null;
  }
  function portugueseVariant(text) {
    var want = ptNamed(text) ||
      (lang === "pt" || lang === "pt-BR" ? lang : I.LANGS.indexOf(get("ptVariant")) !== -1 ? get("ptVariant") :
       I.pick(navigator.languages || [navigator.language]));
    if (want !== "pt" && want !== "pt-BR") want = "pt";
    if (I.LANGS.indexOf(want) !== -1) return want;
    var other = want === "pt" ? "pt-BR" : "pt";
    return I.LANGS.indexOf(other) !== -1 ? other : null;
  }
  // A short answer to "Portugal ou Brasil?" ("Brasil", "do Brasil", "português de Portugal", "brasileiro").
  function ptVariantAnswer(text) {
    var t = String(text || "").toLowerCase().replace(/[.,!?;:"“”]/g, " ").replace(/\s+/g, " ").trim();
    return t && t.split(" ").length <= 6 ? ptNamed(t) : null;
  }

  // ---------- changing language by voice, during a conversation ----------
  // "Speak Italian", "parla francese", "говори по-русски", "说英语": switch at once.
  // "Change language" (no language named): ask the language question again.
  var SWITCH_WORDS = ["speak", "talk", "switch", "change", "use", "reply", "answer", "respond",
                      "parla", "parlami", "parliamo", "parlare", "passa", "passiamo", "usa", "cambia", "rispondi",
                      "parle", "parlez", "parler", "parlons", "passe", "passez", "passons", "utilise", "changer", "réponds", "répondez",
                      "говори", "говорете", "говорим", "премини", "преминем", "смени", "отговаряй", "отговори",
                      "говорите", "говорить", "перейди", "перейдите", "переключи", "переключись", "давай", "отвечай", "ответь", "разговаривай",
                      "spreek", "praat", "schakel", "gebruik", "antwoord", "fala", "fale", "falar", "muda", "mude", "usa", "responde", "responda",
                      "fala-me", "fale-me", "responde-me", "responda-me", "troca", "troque"];
  var CHANGE_LANG = ["change language", "change the language", "switch language", "another language", "different language",
                     "other language", "cambia lingua", "cambiare lingua", "cambia la lingua", "altra lingua",
                     "cambio la lingua", "cambio lingua", "cambiare la lingua", "lingua diversa",
                     "changer de langue", "change de langue", "changer la langue", "autre langue",
                     "смени езика", "смяна на езика", "друг език", "смени язык", "сменить язык", "поменяй язык",
                     "другой язык", "换语言", "换一种语言", "切换语言", "更改语言", "改变语言",
                     "taal wijzigen", "taal veranderen", "verander de taal", "andere taal", "wijzig de taal",
                     "mudar de língua", "mudar a língua", "mudar de idioma", "mudar o idioma", "outra língua", "outro idioma",
                     "muda de língua", "mude de língua", "muda a língua", "mude a língua", "muda de idioma", "mude de idioma", "trocar de língua"];
  var JA_SWITCH = /^(日本語|英語|イタリア語|フランス語|ブルガリア語|ロシア語|中国語|オランダ語|ポルトガル語)(?:で|に)(?:話して|話してください|答えて|答えてください|切り替えて|切り替えてください|変更して|して)(?:ください)?$/;
  var ZH_SWITCH = /(说|讲|切换到|切换成|换成|换到|改成|改用)\s*(中文|汉语|普通话|英语|英文|意大利语|法语|法文|俄语|俄文|保加利亚语|日语|日文|日本語|荷兰语|葡萄牙语)/;

  // Other spoken commands; the whole request must be one of these (polite words aside),
  // so "help me write a letter" still goes to the assistant.
  var COMMANDS = {
    mic: ["change microphone", "change the microphone", "change my microphone", "switch microphone", "switch the microphone",
          "another microphone", "next microphone", "cambia microfono", "cambia il microfono", "cambiare microfono", "altro microfono",
          "changer de microphone", "change de microphone", "changer le microphone", "change le microphone", "autre microphone",
          "смени микрофона", "смяна на микрофона", "друг микрофон", "сменить микрофон", "смени микрофон", "поменяй микрофон",
          "другой микрофон", "换麦克风", "更换麦克风", "切换麦克风", "换一个麦克风",
          "マイクを変更", "マイクを変更して", "マイクを変更してください", "マイクを変えて", "マイクを変えてください", "マイクを切り替えて",
          "microfoon wijzigen", "wijzig de microfoon", "andere microfoon", "verander de microfoon", "volgende microfoon",
          "mudar de microfone", "mudar o microfone", "muda o microfone", "outro microfone", "trocar de microfone", "troca o microfone",
          "mude de microfone", "mude o microfone", "troque de microfone", "troque o microfone", "usa outro microfone", "use outro microfone"],
    show: ["show the last answer", "show last answer", "show me the last answer", "show the answer", "show me the answer", "show answers",
           "mostra l'ultima risposta", "mostrami l'ultima risposta", "mostra la risposta", "mostrami la risposta",
           "affiche la dernière réponse", "montre la dernière réponse", "montre-moi la dernière réponse", "affiche la réponse", "montre la réponse",
           "покажи последния отговор", "покажи отговора", "покажи последний ответ", "покажи ответ", "покажите ответ",
           "显示上一个回答", "显示最后的回答", "显示回答", "显示答案", "最後の回答を表示", "最後の回答を表示して", "回答を表示", "回答を表示して", "回答を見せて",
           "laatste antwoord tonen", "toon het laatste antwoord", "laat het laatste antwoord zien", "toon het antwoord", "laat het antwoord zien",
           "mostra a última resposta", "mostrar a última resposta", "mostra-me a última resposta", "mostra a resposta", "mostrar a resposta",
           "mostre a última resposta", "mostre a resposta", "mostra-me a resposta", "mostre-me a resposta", "mostre-me a última resposta"],
    hide: ["hide the last answer", "hide the answer", "hide answers", "hide the answers", "nascondi l'ultima risposta", "nascondi la risposta", "nascondi le risposte",
           "masque la réponse", "cache la réponse", "masque les réponses", "скрий отговора", "скрий отговорите", "скрой ответ", "скрыть ответ", "скрой ответы",
           "隐藏回答", "隐藏答案", "回答を隠して", "回答を非表示", "回答を非表示にして",
           "verberg het antwoord", "verberg het laatste antwoord", "antwoord verbergen", "esconde a resposta", "esconder a resposta", "esconde a última resposta",
           "esconda a resposta", "esconda a última resposta", "oculta a resposta", "oculte a resposta"],
    repeat: ["repeat", "repeat that", "repeat it", "say that again", "say it again", "can you repeat that", "could you repeat that",
             "what did you say", "again", "ripeti", "ripetilo", "puoi ripetere", "ripeti per favore", "come hai detto", "cosa hai detto",
             "répète", "répétez", "tu peux répéter", "vous pouvez répéter", "pardon", "повтори", "повторете", "кажи пак", "кажете пак",
             "повторите", "ещё раз", "еще раз", "что ты сказал", "再说一遍", "再说一次", "重复", "重复一遍", "没听清", "もう一度", "もう一度お願いします", "繰り返して", "繰り返してください", "もう一度言って", "もう一度言ってください", "もう一度話して", "もう一度話してください",
             "herhaal", "herhaal dat", "nog een keer", "kun je dat herhalen", "wat zei je", "repete", "repita", "podes repetir", "pode repetir", "diz outra vez", "o que disseste",
             "diga outra vez", "outra vez", "repete isso", "repita isso", "podes repetir isso", "pode repetir isso", "o que disse", "o que é que disse", "o que é que disseste"],
    help: ["repeat the instructions", "ripeti le istruzioni", "répète les instructions", "повтори инструкциите", "повтори инструкции", "重复使用说明", "使い方をもう一度教えて", "herhaal de instructies", "repete as instruções", "help", "what can i say", "instructions", "how does this work", "aiuto", "cosa posso dire", "istruzioni",
           "aide", "à l'aide", "que puis-je dire", "qu'est-ce que je peux dire", "помощ", "какво мога да кажа", "инструкции",
           "помощь", "помогите", "что я могу сказать", "инструкция", "帮助", "我能说什么", "我可以说什么", "说明", "怎么用", "ヘルプ", "使い方", "操作方法", "使い方を教えて", "使い方を教えてください",
           "help", "hulp", "wat kan ik zeggen", "uitleg", "ajuda", "o que posso dizer", "instruções",
           "repita as instruções", "o que é que posso dizer", "como funciona", "como é que funciona"]
  };
  // Commands the assistant can ask the page to carry out (server tool page_command).
  var PAGE_COMMANDS = { choose_language: "ask", show_last_answer: "show", change_microphone: "mic", list_microphones: "mics", speed_up: "faster", slow_down: "slower", pause: "pause", resume: "resume", read_footer: "page:footer", repeat_instructions: "help", install_app: "install", read_privacy: "page:privacy", read_terms: "page:terms", read_about: "page:about", read_accessibility: "page:accessibility", read_instructions: "page:instructions" };
  COMMANDS.resume = ["resume", "riprendi", "reprends", "продължи", "продолжить", "继续", "再開", "hervatten", "retomar"];
  COMMANDS.pause = ["pause", "pausa", "пауза", "暂停", "一時停止", "pauze", "pausar"];
  COMMANDS.faster = ["talk faster", "speak faster", "parla più velocemente", "parla più veloce", "parle plus vite", "говори по-бързо", "говори быстрее", "说快一点", "もっと速く話して", "praat sneller", "fala mais depressa", "fale mais rápido", "fale mais depressa"];
  COMMANDS.slower = ["talk slower", "speak slower", "parla più lentamente", "parle plus lentement", "говори по-бавно", "говори медленнее", "说慢一点", "もっとゆっくり話して", "praat langzamer", "fala mais devagar", "fale mais devagar"];
  COMMANDS.mics = ["list microphones", "elenca i microfoni", "liste les microphones", "списък с микрофони", "список микрофонов", "列出麦克风", "マイクの一覧", "microfoons weergeven", "lista os microfones"];
  COMMANDS.install = ["install the app", "installa l'app", "installe l'application", "инсталирай приложението", "установи приложение", "安装应用", "アプリをインストール", "installeer de app", "instala a aplicação", "instale o aplicativo", "instala o aplicativo"];
  var POLITE = /^(ok|okay|oké|please|per favore|s'il te plaît|s'il vous plaît|моля|пожалуйста|请|alsjeblieft|alstublieft|por favor) | (please|per favore|s'il te plaît|s'il vous plaît|моля|пожалуйста|alsjeblieft|alstublieft|por favor)$/g;

  // Returns "repeat", "help", a language code, "ask" (ask the language again), or null.
  function voiceCommand(text) {
    var clean = text.toLowerCase().replace(/[.,!?¡¿;:。，！？«»"“”]/g, " ").replace(/\s+/g, " ").trim();
    var bare = clean.replace(POLITE, "").replace(POLITE, "").replace(/^请|吧$/g, "").trim();
    for (var k in COMMANDS) if (COMMANDS[k].indexOf(bare) !== -1) return k;
    var japanese = clean.replace(/\s/g, "");
    if (JA_SWITCH.test(japanese)) return matchLanguage(japanese);
    // "言語を変えて", and questions such as "言語を変えるにはどうすればいいですか".
    if (/^言語を(変更|変え|切り替え)/.test(japanese) && japanese.length <= 24) return "ask";
    if (/[一-鿿]/.test(clean)) {
      if (clean.replace(/\s/g, "").length > 12) return null;
      var m = clean.match(ZH_SWITCH);
      if (m) return matchLanguage(m[2]);
      return CHANGE_LANG.some(function (w) { return clean.indexOf(w) !== -1; }) ? "ask" : null;
    }
    // Only short requests, so questions like "how do you say hello in Italian?" go to the assistant.
    if (clean.split(" ").length > 8) return null;
    var padded = " " + clean + " ";
    var hasSwitch = SWITCH_WORDS.some(function (w) { return padded.indexOf(" " + w + " ") !== -1; });
    // The language must come at the end ("talk about Italian food" is not a request).
    var words = clean.replace(/ (please|per favore|s'il vous plaît|s'il te plaît|моля|пожалуйста|alsjeblieft|alstublieft|por favor)$/, "").split(" ");
    var tail = words.slice(-3).join(" ");
    var code = !hasSwitch ? null :
      /(^| )(portugu[eê]s (do brasil|de portugal|europeu|brasileiro)|(brazilian|european) portuguese)$/.test(tail) ? portugueseVariant(tail) : matchLanguage(words[words.length - 1]);
    if (code) return code;
    return CHANGE_LANG.some(function (w) { return padded.indexOf(" " + w + " ") !== -1; }) ? "ask" : null;
  }

  async function runCommand(cmd) {
    var my = session, reply;
    if (cmd === "pause") return togglePause();
    if (cmd === "resume") return paused ? togglePause() : goReady();
    if (cmd === "faster" || cmd === "slower") {
      speed = C.clampSpeed(speed + (cmd === "faster" ? .1 : -.1));
      reply = tt("speedLabel") + ": " + Math.round(speed * 100) + "%.";
    }
    else if (cmd === "mics") {
      await refreshMics(); if (my !== session) return;
      reply = mics.map(function(m) { return m.label; }).join(". ") || tt("micOnlyOne");
    }
    else if (cmd.indexOf("mic:") === 0) {
      var target = mics.find(function(m) { return m.label.toLowerCase() === cmd.slice(4); });
      if (target) { chooseMic(target); closeMic(); await ensureMic(); reply = tt("micNow") + " " + target.label; }
      else reply = tt("micOnlyOne");
    }
    else if (cmd === "install") { reply = window.requestAppInstall ? window.requestAppInstall(lang) : tt("installLabel"); }
    else if (cmd.indexOf("page:") === 0) {
      var page = await api("/api/site-page/" + cmd.slice(5) + "?lang=" + lang, { method:"GET" });
      if (my !== session) return; reply = page.text;
    }
    else if (cmd === "repeat") { if (lastSaid) { await say(lastSaid, lastSaidLang); if (my === session) goReady(); return; } reply = tk("voiceHelp"); }
    else if (cmd === "help") reply = tk("greeting") + " " + tk("voiceHelp");
    else if (cmd === "show") reply = showLast() ? tt("lastShown") : tt("lastNone");
    else if (cmd === "hide") { hideLast(true); reply = tt("lastHidden"); }
    else if (cmd === "mic") {
      var next = await nextMicrophone();
      if (my !== session) return;
      reply = next ? tt("micNow") + " " + next.label + "." : tt("micOnlyOne");
    }
    else {
      if (cmd === "ask") await chooseLanguage(my);
      else { lang = cmd; set("lang", lang); set("langChosen", "1"); if (/^pt/.test(lang)) set("ptVariant", lang); renderTexts(); }
      if (my !== session) return;
      reply = tt("langChanged");
    }
    if (my !== session) return;
    await say(reply);
    if (my === session) goReady();
  }

  function recordOnce() {
    return new Promise(function (resolve) { recResolve = resolve; startRecording(true); });
  }

  async function chooseLanguage(my) {
    choosing = true;
    for (var attempt = 0; attempt < 2; attempt++) {
      // Activating Pause during the question skips the list and goes straight to answering.
      var skipped = await say(attempt ? tt("langNotUnderstood") : tt("askLanguage"));
      if (my !== session) return;
      if (!attempt && !skipped) {
        // Each language name in its own voice.
        for (var i = 0; i < I.LANGS.length; i++) {
          var code = I.LANGS[i];
          if (await say(I.META[code].native, code)) break;
          if (my !== session) return;
        }
      }
      if (my !== session) return;
      var wav = await recordOnce();
      if (my !== session) return;
      if (!wav) continue;
      startThinking();
      var r;
      try {
        r = await api("/api/transcribe?lang=auto", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
      } catch (e) {
        stopThinking();
        if (e.code === "errLimit") { choosing = false; throw e; }
        continue;
      }
      stopThinking();
      if (my !== session) return;
      var found = matchLanguage(r.text, r.language);
      if (found) {
        lang = found;
        set("lang", lang);
        renderTexts();
        break;
      }
    }
    // Asked once; the language button can still change it later.
    set("langChosen", "1");
    choosing = false;
  }

  async function choosePortuguese(my) {
    choosing = true;
    for (var attempt = 0; attempt < 2; attempt++) {
      // The main control can pause this question; normal recording starts after speech.
      await say(tt(attempt ? "ptVariantNotUnderstood" : "askPtVariant"));
      if (my !== session) return;
      var wav = await recordOnce();
      if (my !== session) return;
      if (!wav) continue;
      startThinking();
      var r;
      try {
        r = await api("/api/transcribe?lang=pt", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
      } catch (e) {
        stopThinking();
        if (e.code === "errLimit") { choosing = false; throw e; }
        continue;
      }
      stopThinking();
      if (my !== session) return;
      var found = ptVariantAnswer(r.text);
      if (found) { lang = found; set("lang", lang); renderTexts(); break; }
    }
    // Asked once; "fala português do Brasil" and the language button can still change it.
    set("ptVariant", lang);
    choosing = false;
  }

  async function handleUtterance(wav) {
    var my = session;
    setState("processing");
    startThinking();
    try {
      var r1 = await api("/api/transcribe?lang=" + lang, {
        method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav
      });
      if (my !== session) return;
      var text = String(r1.text || "").trim();
      if (performance.now() < echoUntil) text = C.stripEcho(text, spokenEcho);
      if (!text) { stopThinking(); return goReady(); }
      var cmd = voiceCommand(text);
      // A named microphone is selected only when the entire utterance matches its label.
      var requestedMic = text.toLowerCase().replace(/^(?:use|switch to|usa|utilise|utilisez|използвай|используй|使用|使って|gebruik|usa o)\s+/u, "").trim();
      var named = mics.find(function(m) { return m.label.toLowerCase() === requestedMic; });
      if (named) cmd = "mic:" + named.label.toLowerCase();
      if (cmd) { stopThinking(); return runCommand(cmd); }
      transcript.push({ role: "user", content: text });

      if (isGoodbye(text)) {
        stopThinking();
        await say(tt("farewell"));
        if (my === session) endConversation();
        return;
      }

      // If the assistant searches the web, say so instead of staying silent.
      var searching = Promise.resolve();
      var r2 = await chat({ lang: lang, device: { os:device.os, browser:device.browser, major:device.major }, context: context, messages: transcript.slice(-20), reading: readingPage || undefined }, function () {
        if (my !== session) return;
        stopThinking();
        searching = say(tt("searching")).then(function () {
          if (my === session && state === "speaking" && !pendingTalk) { setState("processing"); startThinking(); }
        });
      });
      await searching;
      stopThinking();
      if (my !== session) return;
      failures = 0;
      readingPage = r2.reading || null;
      var reply = String(r2.text || "");
      // Long content the assistant put in the text box is shown at once; it said so in its reply.
      if (r2.box) { rememberAnswer(String(r2.box)); showLast(); }
      else if (reply && r2.command !== "show_last_answer") rememberAnswer(reply);
      // Spoken by a voice of the language the reply is written in, not always the page's language.
      var replyLang = I.LANGS.indexOf(r2.lang) !== -1 ? r2.lang : lang;
      if (reply) { transcript.push({ role: "assistant", content: reply }); lastSaid = reply; lastSaidLang = replyLang; }
      await say(reply || (r2.end ? tt("farewell") : ""), reply ? replyLang : lang);
      if (my !== session) return;
      if (r2.end) return endConversation();
      // The assistant asked the page to carry out one of its own commands.
      var pageCmd = PAGE_COMMANDS[r2.command];
      if (pageCmd) return runCommand(pageCmd);
      goReady();
    } catch (e) {
      stopThinking();
      if (my !== session) return;
      // The last question got no answer; forget it so it is not sent twice.
      if (transcript.length && transcript[transcript.length - 1].role === "user") transcript.pop();
      if (e.code === "errLimit") return fail("errLimit");
      if (++failures >= 3) return fail("errConnection");
      await say(tk("errRetry"));
      if (my === session) goReady();
    }
  }

  function announcePause(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function startConversation(withContext) {
    if (active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioWorkletNode || !(window.AudioContext || window.webkitAudioContext)) {
      return announce("errSupport");
    }
    alertBox.textContent = "";
    active = true;
    paused = false; continuous = false;
    failures = 0;
    pendingTalk = false;
    choosing = false;
    var my = ++session;
    transcript = [];
    context = "";

    // Must happen inside the click: unlock audio and speech (iOS Safari).
    ensureContext();
    if (window.speechSynthesis) {
      var unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0;
      speechSynthesis.speak(unlock);
    }
    showConversationControls(true);
    setState("processing");

    function giveUp(code) {
      active = false;
      session++;
      closeMic();
      setState("idle");
      showConversationControls(false);
      announce(code);
    }

    // Once a daily limit is reached, nothing starts until it resets.
    try {
      var status = await api("/api/limit", { method: "GET" });
      aiVoiceLangs = Array.isArray(status.aiVoice) ? status.aiVoice : [];
    } catch (e) {
      if (my === session) giveUp(e.code === "errLimit" ? "errLimit" : "errConnection");
      return;
    }
    if (my !== session) return;

    // Agreement by pressing Start (the line with the Privacy Policy and Terms links sits
    // before the button). The agreed version is saved at the press; one short sentence
    // is spoken with the AI disclosure, before any microphone access, until it was heard.
    var AGREEMENT_VERSION = "2026-11-23";
    set("agreedVersion", AGREEMENT_VERSION);
    var firstPrivacyNotice = get("agreementHeard") !== AGREEMENT_VERSION;
    var permissionState = await microphonePermissionState();
    if (my !== session) return;
    if (permissionState === "denied") {
      // Blocked: say the exact steps, then leave them on the page. The microphone is not requested.
      await say(tt("errMicDenied"));
      if (my === session) giveUp("errMicDenied");
      return;
    }
    // Not allowed yet: the first time, say what to choose in this browser; a returning
    // user who already heard that hears one short line.
    var micAsk = permissionState !== "granted";
    var firstMicGuide = micAsk && get("micPermissionGuide") !== "2026-11-23";
    var micWords = micAsk ? micShortText() : "";
    var disclosure = (firstPrivacyNotice ? tt("aiDisclosure") + " " + tt("agreeSpoken") : "") + (micWords ? " " + micWords : "");
    var disclosureInterrupted = disclosure.trim() ? await say(disclosure) : false;
    if (my !== session) return;
    if (firstPrivacyNotice && !disclosureInterrupted) set("agreementHeard", AGREEMENT_VERSION);
    setState("processing");

    micFallbackSaid = false;
    try {
      await ensureMic();
      if (my === session && firstMicGuide && !disclosureInterrupted) set("micPermissionGuide", "2026-11-23");
    } catch (e) {
      if (my === session) giveUp(micErrorKey(e));
      return;
    }
    if (my !== session) return;

    continuous = true;
    sounds.start();
    await new Promise(function (r) { setTimeout(r, 500); });
    if (my !== session) return;

    // Start in the selected/browser language; spoken language changes remain available.
    set("langChosen", "1");

    // Portugal or Brazil, asked once when both are switched on.
    if ((lang === "pt" || lang === "pt-BR") && I.LANGS.indexOf("pt") !== -1 && I.LANGS.indexOf("pt-BR") !== -1 && !get("ptVariant")) {
      try { await choosePortuguese(my); } catch (e) { if (my === session) giveUp(e.code || "errConnection"); return; }
      if (my !== session) return;
    }

    // Identity was disclosed once before microphone access. Keep the remaining
    // instructions brief, with a shorter return-visit version.
    var intro = get("introHeard") ? tk("greetingShort") : tk("greeting");
    set("introHeard", "1");
    lastSaid = intro;
    await say(intro);
    if (my !== session) return;
    continuous = true;
    goReady();
  }

  function endConversation(silent) {
    if (!active) return;
    active = false;
    paused = false; continuous = false;
    session++;
    choosing = false;
    pendingTalk = false;
    stopThinking();
    if (stopSpeaking) { stopSpeaking(); stopSpeaking = null; }
    closeMic();
    rec = null;
    transcript = [];
    context = "";
    readingPage = null;
    lastSaid = "";
    lastSaidLang = null;
    if (recResolve) { var done = recResolve; recResolve = null; done(null); }
    setState("idle");
    showConversationControls(false);
    if (!silent) sounds.end();
    refreshMics().then(renderMics);
  }

  function fail(code) {
    endConversation(true);
    sounds.end();
    setTimeout(function () { announce(code); }, 700);
  }

  // ---------- buttons ----------
  async function togglePause() {
    if (!active) return;
    if (paused) {
      paused = false; continuous = true; renderTexts();
      return startRecording(false);
    }
    paused = true; session++; startRecording.request = (startRecording.request || 0) + 1;
    if (stopSpeaking) stopSpeaking();
    stopThinking(); closeMic(); rec = null;
    if (recResolve) { var done = recResolve; recResolve = null; done(null); }
    setState("paused"); renderTexts();
    var my = session;
    await say(tt("paused"));
    if (my === session && paused) setState("paused");
  }
  function onTalkPress() {
    if (!active) return startConversation(false);
    return togglePause();
  }
  var ctrlTap = C.createCtrlTap(function () { if (active) togglePause(); });
  document.addEventListener("keydown", ctrlTap.keydown);
  document.addEventListener("keyup", ctrlTap.keyup);
  window.addEventListener("blur", ctrlTap.reset);

  talkBtn.addEventListener("click", onTalkPress);
  endBtn.addEventListener("click", function () { endConversation(); });

  document.addEventListener("keydown", function (e) {
    if (isTalkShortcut(e)) {
      e.preventDefault();
      if (!e.repeat) {
        if (!afterSpeech(function () { talkBtn.focus(); })) talkBtn.focus();
        onTalkPress();
      }
      return;
    }
    // Escape ends the conversation (when the screen reader lets the key through).
    if (active && e.key === "Escape" && !e.repeat) { endConversation(); return; }

  });

  langBtn.addEventListener("click", function toggleLanguages() {
    if (afterSpeech(toggleLanguages)) return;
    var open = langsBox.hidden;
    langsBox.hidden = !open;
    langBtn.setAttribute("aria-expanded", open ? "true" : "false");
    // Move straight into the list, onto the current language.
    if (open) { var cur = langsBox.querySelector('[data-set-lang="' + lang + '"]'); if (cur) cur.focus(); }
  });

  langsBox.addEventListener("keydown", function closeLanguages(e) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (afterSpeech(function () { closeLanguages(e); })) return;
    langsBox.hidden = true;
    langBtn.setAttribute("aria-expanded", "false");
    langBtn.focus();
  });

  langsBox.addEventListener("click", function selectLanguage(e) {
    if (afterSpeech(function () { selectLanguage(e); })) return;
    var b = e.target.closest("[data-set-lang]");
    if (!b) return;
    lang = b.getAttribute("data-set-lang");
    set("lang", lang);
    if (/^pt/.test(lang)) set("ptVariant", lang);
    set("langChosen", "1");
    langsBox.hidden = true;
    langBtn.setAttribute("aria-expanded", "false");
    renderTexts();
    talkBtn.focus();
  });

  // ---------- microphone button ----------
  // Shown only when there are two or more microphones to choose from, and never
  // re-drawn during a conversation (the page stays still while the assistant talks).
  function closeMicList() { micsBox.hidden = true; micBtn.setAttribute("aria-expanded", "false"); }
  function renderMics() {
    if (active) return;
    var show = mics.length >= 2, cur = currentMicId();
    if (!show) {
      var hadFocus = document.activeElement === micBtn || micsBox.contains(document.activeElement);
      closeMicList();
      micBtn.hidden = true;
      if (hadFocus) talkBtn.focus();
    } else micBtn.hidden = false;
    micsBox.textContent = "";
    mics.forEach(function (m) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = m.label;
      b.setAttribute("data-mic", m.id);
      if (m.id === cur) b.setAttribute("aria-current", "true");
      micsBox.appendChild(b);
    });
  }
  micBtn.addEventListener("click", function toggleMicrophones() {
    if (afterSpeech(toggleMicrophones)) return;
    var open = micsBox.hidden;
    micsBox.hidden = !open;
    micBtn.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) { var cur = micsBox.querySelector('[aria-current]') || micsBox.querySelector("button"); if (cur) cur.focus(); }
  });
  micsBox.addEventListener("keydown", function closeMicrophones(e) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    if (afterSpeech(function () { closeMicrophones(e); })) return;
    closeMicList();
    micBtn.focus();
  });
  micsBox.addEventListener("click", function selectMicrophone(e) {
    if (afterSpeech(function () { selectMicrophone(e); })) return;
    var b = e.target.closest("[data-mic]");
    if (!b) return;
    var id = b.getAttribute("data-mic");
    var chosen = mics.filter(function (m) { return m.id === id; })[0];
    if (chosen) chooseMic(chosen);
    var all = micsBox.querySelectorAll("[data-mic]");
    for (var i = 0; i < all.length; i++) {
      if (all[i] === b) all[i].setAttribute("aria-current", "true"); else all[i].removeAttribute("aria-current");
    }
    closeMicList();
    talkBtn.focus();
  });
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    refreshMics().then(renderMics);
    if (navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", function () { refreshMics().then(renderMics); });
    }
  }

  // ---------- the last answer as text (off by default) ----------
  // Plain text a screen reader reads line by line, with a Copy button. Nothing moves focus here:
  // during a conversation focus stays on the Talk button.
  function rememberAnswer(text) {
    lastAnswer = text;
    if (afterSpeech(function () { rememberAnswer(text); })) return;
    if (!lastBox.hidden) lastText.textContent = text;
  }
  // Returns false when there is nothing to show yet.
  function showLast() {
    if (!lastAnswer) return false;
    if (afterSpeech(showLast)) return true;
    set("showLast", "1");
    lastText.textContent = lastAnswer;
    copyStatus.textContent = "";
    lastBtn.hidden = false;
    lastBox.hidden = false;
    lastBtn.setAttribute("aria-expanded", "true");
    return true;
  }
  // `forget`: the button goes away too (the feature is off again).
  function hideLast(forget) {
    if (afterSpeech(function () { hideLast(forget); })) return;
    lastBox.hidden = true;
    lastBtn.setAttribute("aria-expanded", "false");
    if (forget) { set("showLast", ""); lastBtn.hidden = true; }
    if (lastBox.contains(document.activeElement) || (forget && document.activeElement === lastBtn)) talkBtn.focus();
  }
  function setCopyStatus(text) {
    if (afterSpeech(function () { setCopyStatus(text); })) return;
    copyStatus.textContent = text;
  }
  async function copyLast() {
    if (!lastAnswer) { setCopyStatus(tt("lastNone")); return false; }
    var ok = false;
    try { await navigator.clipboard.writeText(lastAnswer); ok = true; } catch (e) {}
    setCopyStatus(ok ? tt("copied") : tt("copyFailed"));
    return ok;
  }
  lastBtn.addEventListener("click", function toggleLastAnswer() {
    if (afterSpeech(toggleLastAnswer)) return;
    if (lastBox.hidden) { if (!showLast()) { copyStatus.textContent = ""; lastText.textContent = tt("lastNone"); lastBox.hidden = false; lastBtn.setAttribute("aria-expanded", "true"); } }
    else hideLast(false);
  });
  copyBtn.addEventListener("click", copyLast);
  lastBtn.hidden = get("showLast") !== "1";

  // ---------- start-up ----------
  renderTexts();
  // Wake a sleeping free server early so the first answer is not slow.
  fetch("/health").catch(function () {});
  fetch("/api/device-count", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({os:device.os,browser:device.browser,major:device.major}) }).catch(function () {});
})();

