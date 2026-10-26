(function () {
  "use strict";
  var I = window.I18N;
  var $ = function (id) { return document.getElementById(id); };

  // iPhone/iPad (also iPadOS, which reports itself as a Mac with touch).
  var IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
               (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Phones and tablets without a keyboard or mouse: instructions say "the Talk button", not "the space bar".
  var IS_TOUCH = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches);

  // ---------- storage (never required to work) ----------
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // Previous releases saved a tracking identifier. It is no longer needed.
  try { localStorage.removeItem("anonId"); } catch (e) {}

  // Conversations are never saved (owner's choice, 2026-10-24); delete what older versions saved.
  try { localStorage.removeItem("history"); } catch (e) {}

  // ---------- language ----------
  var lang = I.pick(get("lang") ? [get("lang")] : navigator.languages || [navigator.language]);
  var tt = function (key) { return I.t(lang, key); };
  // Same, but with the touch wording on phones and tablets.
  var tk = function (key) { return IS_TOUCH && I.S[lang][key + "Touch"] ? tt(key + "Touch") : tt(key); };

  var talkBtn = $("talk"), endBtn = $("endConv"), langBtn = $("lang"),
      langsBox = $("langs"), alertBox = $("alert"), micPermission = $("micPermission");

  if (IS_TOUCH) $("helpText").setAttribute("data-i18n", "helpTouch");

  function renderTexts() {
    I.applyPage(lang);
    $("helpText").textContent = tk("help") + (IS_TOUCH ? "" : " " + tt("shortcutHelp"));
    if (micPermission.textContent) micPermission.textContent = tt("micPending");
    talkBtn.textContent = talkLabel ? tt("talk") : tt("start");
    endBtn.textContent = tt("end");
    // Keep the chosen language on the other pages too.
    $("privacyLink").href = "/privacy?lang=" + lang;
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
  var state = "idle";      // idle | ready (waiting for the space bar) | listening | processing | speaking
  var transcript = [];     // [{role, content}] kept in memory only
  var context = "";        // always empty: conversations are not saved
  var failures = 0;        // failed turns in a row
  var choosing = false;    // the assistant is asking which language to use
  var talkLabel = false;   // the button reads "Talk" (from the first time the assistant waits for the user)
  var pendingTalk = false; // the space bar interrupted the assistant: start recording when it has stopped
  var aiVoiceLangs = [];   // languages with the natural AI voice (from the server)

  function setState(s) {
    state = s;
    document.body.setAttribute("data-state", s);
  }

  // ---------- mute gate: the screen reader is probably talking ----------
  var muteUntil = 0;
  // While muted, microphone frames are skipped (not recorded).
  function muteFor(ms) {
    muteUntil = Math.max(muteUntil, performance.now() + ms);
  }
  // The space bar works as the talk button even when focus is somewhere else on the page.
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
  function isSpace(e) { return e.key === " " || e.key === "Spacebar"; }
  ["keydown", "focusin", "click", "pointerdown", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      // The screen reader says little when the talk button or the space bar is pressed,
      // so only pause the mic briefly then.
      var talk = e.target === talkBtn || (e.type === "keydown" && (isTalkShortcut(e) || (isSpace(e) && !isOtherControl(e.target))));
      muteFor(talk ? 300 : 1500);
    }, { capture: true, passive: true });
  });
  window.addEventListener("focus", function () { muteFor(1000); });
  document.addEventListener("visibilitychange", function () { muteFor(1000); });

  // ---------- errors: one alert, only after audio stopped ----------
  function announce(key) {
    muteFor(4000);
    alertBox.textContent = "";
    setTimeout(function () { alertBox.textContent = tt(key); }, 150);
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
    zh: /xiaoxiao|xiaoyi|yunxi|yunjian|tingting|lili|google 普通话|google 中文/
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
      var i = 0, watchdog = null;
      function next() {
        clearTimeout(watchdog);
        if (isCancelled()) return resolve();
        if (i >= chunks.length) return resolve();
        var chunk = chunks[i++];
        var u = new SpeechSynthesisUtterance(chunk);
        u.lang = I.META[code].speech;
        if (voice) u.voice = voice;
        u.onend = next;
        u.onerror = next;
        // Some browsers never fire onend; never get stuck.
        var perChar = code === "zh" ? 300 : 110;
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
      return r.arrayBuffer();
    }).then(function (buf) {
      return new Promise(function (ok, bad) { ctx.decodeAudioData(buf, ok, bad); });
    }).finally(function () { clearTimeout(timer); });
  }

  function playBuffer(buffer, isCancelled) {
    return new Promise(function (resolve) {
      if (isCancelled()) return resolve();
      ensureContext();
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      var done = false;
      function finish() { if (!done) { done = true; clearInterval(poll); resolve(); } }
      src.onended = finish;
      var poll = setInterval(function () { if (isCancelled()) { try { src.stop(); } catch (e) {} finish(); } }, 100);
      src.start();
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
      await playBuffer(buffer, isCancelled);
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
    stopSpeaking = function () {
      cancelled = true;
      if (window.speechSynthesis) speechSynthesis.cancel();
    };
    setState("speaking");
    // iPhone: release the microphone while talking, or the voice comes out of the earpiece.
    if (IS_IOS) closeMic();

    var rest = splitSentences(text, 220);
    if (aiVoiceLangs.indexOf(code) !== -1 && aiVoiceFailures < 3) {
      rest = await speakAi(splitSentences(text, 300), isCancelled, code);
    }
    if (rest.length && !cancelled) await speakBrowser(rest, isCancelled, code);
    stopSpeaking = null;
    return cancelled;
  }

  // ---------- microphone + voice activity detection ----------
  var stream = null, source = null, node = null, sink = null, workletCtx = null;

  // One recording = one turn: it starts with the space bar (or the button) and ends
  // with the next press, or by itself after 7 s of silence.
  var rec = null;
  var noise = 0.004;   // background noise level, learned while recording

  var micRequest = 0, restoreMicFocus = null;
  function cancelMicFocusRestore() {
    if (restoreMicFocus) window.removeEventListener("focus", restoreMicFocus);
    restoreMicFocus = null;
  }
  function clearMicPermission() {
    cancelMicFocusRestore();
    micPermission.textContent = "";
    if (document.activeElement !== micPermission) return;
    var my = session, request = micRequest;
    restoreMicFocus = function () {
      if (my !== session || request !== micRequest || document.activeElement !== micPermission) {
        cancelMicFocusRestore();
        return;
      }
      // Browser permission controls may still own focus when the request settles.
      if (!document.hasFocus()) return;
      cancelMicFocusRestore();
      talkBtn.focus({ preventScroll: true });
    };
    window.addEventListener("focus", restoreMicFocus);
    restoreMicFocus();
  }
  async function openMic() {
    cancelMicFocusRestore();
    var my = session, request = ++micRequest, acquired = null, audioSource = null;
    function current() { return active && my === session && request === micRequest; }
    function cancelled() { var e = new Error("Microphone request cancelled"); e.name = "AbortError"; return e; }
    try {
      var granted = false;
      if (navigator.permissions && navigator.permissions.query) {
        try { granted = (await navigator.permissions.query({ name: "microphone" })).state === "granted"; } catch (e) {}
      }
      if (!current()) throw cancelled();
      if (!granted) {
        micPermission.textContent = tt("micPending");
        // Focus once, before the browser opens its prompt. Never schedule a later
        // focus move that could interrupt the browser's permission controls.
        if (document.hasFocus()) micPermission.focus({ preventScroll: true });
      }
      acquired = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true,
          voiceIsolation: { ideal: true }, channelCount: 1 }
      });
      if (!current()) throw cancelled();
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
    if (state !== "listening" || !rec) return;
    if (performance.now() < muteUntil) return;
    var sum = 0;
    for (var i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    var rms = Math.sqrt(sum / frame.length);
    var threshold = Math.max(noise * 3, 0.012);
    rec.elapsed++;

    if (!rec.speechStarted) {
      rec.frames.push(frame);
      if (rec.frames.length > 25) rec.frames.shift();
      if (rms > threshold) rec.voiced++;
      else {
        rec.voiced = Math.max(0, rec.voiced - 2);
        noise = Math.min(0.05, noise * 0.95 + rms * 0.05);
      }
      if (rec.voiced >= 10) { rec.speechStarted = true; rec.speechFrames = rec.voiced; }
      // Nothing said: after 7 s (or 7 s for the language question too) stop waiting.
      else if (rec.elapsed >= SEVEN_SECONDS) finishRecording();
      return;
    }

    rec.frames.push(frame);
    if (rms > threshold * 0.7) { rec.silence = 0; rec.speechFrames++; }
    else rec.silence++;
    // The language question ends by itself after a short pause; a normal turn after 7 s of silence.
    if (rec.silence >= (rec.auto ? 60 : SEVEN_SECONDS) || rec.frames.length >= MAX_FRAMES) finishRecording();
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
    // Generous: a sleeping free server can take ~50 s to wake up.
    var timer = setTimeout(function () { ctl.abort(); }, 60000);
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
                 "arrête", "arrete", "довиждане", "чао", "стоп", "до свидания", "пока", "хватит"];
  function isGoodbye(text) {
    var clean = text.toLowerCase().replace(/[.,!?¡¿;:。，！？«»"“”]/g, " ").replace(/\s+/g, " ").trim();
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
    if (!on) { talkLabel = false; talkBtn.textContent = tt("start"); }
    if (on) { talkBtn.setAttribute("data-active", "true"); talkBtn.removeAttribute("aria-describedby"); }
    else { talkBtn.removeAttribute("data-active"); talkBtn.setAttribute("aria-describedby", "helpText"); }
    // Never leave focus on a button that disappears.
    if (!on && document.activeElement === endBtn) talkBtn.focus();
    endBtn.hidden = !on;
  }

  function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }

  // ---------- conversation ----------
  // Waiting for the user to press the space bar (or the button) to talk.
  function goReady() {
    if (!active) return;
    if (!talkLabel) { talkLabel = true; talkBtn.textContent = tt("talk"); }
    if (pendingTalk) { pendingTalk = false; return startRecording(false); }
    setState("ready");
  }

  async function startRecording(auto) {
    var my = session;
    if (!stream) {
      setState("processing");
      try { await openMic(); } catch (e) { if (my === session) fail(micErrorKey(e)); return; }
      if (!active || my !== session) return;
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
    en: ["english", "inglese", "anglais", "английски", "английск", "англий", "英语", "英文"],
    it: ["italian", "italien", "италиански", "итальянск", "意大利"],
    fr: ["french", "français", "francais", "francese", "френски", "французск", "法语", "法文"],
    bg: ["bulgarian", "българск", "bulgaro", "bulgare", "болгарск", "保加利亚"],
    ru: ["russian", "русск", "russo", "russe", "руски", "俄语", "俄文"],
    zh: ["chinese", "mandarin", "cinese", "chinois", "китайск", "中文", "汉语", "普通话", "华语", "中国"]
  };
  var WHISPER_LANGS = { english: "en", italian: "it", french: "fr", bulgarian: "bg", russian: "ru", chinese: "zh" };

  function matchLanguage(text, detected) {
    var t = String(text || "").toLowerCase();
    var best = null, bestPos = Infinity;
    Object.keys(LANG_WORDS).forEach(function (code) {
      LANG_WORDS[code].forEach(function (w) {
        var p = t.indexOf(w);
        if (p !== -1 && p < bestPos) { best = code; bestPos = p; }
      });
    });
    if (best) return best;
    // Just a word or two in some language ("Italiano", "Русский"): use the language it was spoken in.
    var short = t.trim().split(/\s+/).length <= 3;
    return short && WHISPER_LANGS[String(detected || "").toLowerCase()] || null;
  }

  // ---------- changing language by voice, during a conversation ----------
  // "Speak Italian", "parla francese", "говори по-русски", "说英语": switch at once.
  // "Change language" (no language named): ask the language question again.
  var SWITCH_WORDS = ["speak", "talk", "switch", "change", "use", "reply", "answer", "respond",
                      "parla", "parlami", "parliamo", "parlare", "passa", "passiamo", "usa", "cambia", "rispondi",
                      "parle", "parlez", "parler", "parlons", "passe", "passez", "passons", "utilise", "changer", "réponds", "répondez",
                      "говори", "говорете", "говорим", "премини", "преминем", "смени", "отговаряй", "отговори",
                      "говорите", "говорить", "перейди", "перейдите", "переключи", "переключись", "давай", "отвечай", "ответь", "разговаривай"];
  var CHANGE_LANG = ["change language", "change the language", "switch language", "another language", "different language",
                     "other language", "cambia lingua", "cambiare lingua", "cambia la lingua", "altra lingua",
                     "changer de langue", "change de langue", "changer la langue", "autre langue",
                     "смени езика", "смяна на езика", "друг език", "смени язык", "сменить язык", "поменяй язык",
                     "другой язык", "换语言", "换一种语言", "切换语言", "更改语言", "改变语言"];
  var ZH_SWITCH = /(说|讲|切换到|切换成|换成|换到|改成|改用)\s*(中文|汉语|普通话|英语|英文|意大利语|法语|法文|俄语|俄文|保加利亚语)/;

  // Other spoken commands; the whole request must be one of these (polite words aside),
  // so "help me write a letter" still goes to the assistant.
  var COMMANDS = {
    repeat: ["repeat", "repeat that", "repeat it", "say that again", "say it again", "can you repeat that", "could you repeat that",
             "what did you say", "again", "ripeti", "ripetilo", "puoi ripetere", "ripeti per favore", "come hai detto", "cosa hai detto",
             "répète", "répétez", "tu peux répéter", "vous pouvez répéter", "pardon", "повтори", "повторете", "кажи пак", "кажете пак",
             "повторите", "ещё раз", "еще раз", "что ты сказал", "再说一遍", "再说一次", "重复", "重复一遍", "没听清"],
    help: ["help", "what can i say", "instructions", "how does this work", "aiuto", "cosa posso dire", "istruzioni",
           "aide", "à l'aide", "que puis-je dire", "qu'est-ce que je peux dire", "помощ", "какво мога да кажа", "инструкции",
           "помощь", "помогите", "что я могу сказать", "инструкция", "帮助", "我能说什么", "我可以说什么", "说明", "怎么用"]
  };
  var POLITE = /^(ok|okay|please|per favore|s'il te plaît|s'il vous plaît|моля|пожалуйста|请) | (please|per favore|s'il te plaît|s'il vous plaît|моля|пожалуйста)$/g;

  // Returns "repeat", "help", a language code, "ask" (ask the language again), or null.
  function voiceCommand(text) {
    var clean = text.toLowerCase().replace(/[.,!?¡¿;:。，！？«»"“”]/g, " ").replace(/\s+/g, " ").trim();
    var bare = clean.replace(POLITE, "").replace(POLITE, "").replace(/^请|吧$/g, "").trim();
    for (var k in COMMANDS) if (COMMANDS[k].indexOf(bare) !== -1) return k;
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
    var words = clean.replace(/ (please|per favore|s'il vous plaît|s'il te plaît|моля|пожалуйста)$/, "").split(" ");
    var code = hasSwitch ? matchLanguage(words[words.length - 1]) : null;
    if (code) return code;
    return CHANGE_LANG.some(function (w) { return padded.indexOf(" " + w + " ") !== -1; }) ? "ask" : null;
  }

  async function runCommand(cmd) {
    var my = session, reply;
    if (cmd === "repeat") { if (lastSaid) { await say(lastSaid, lastSaidLang); if (my === session) goReady(); return; } reply = tt("voiceHelp"); }
    else if (cmd === "help") reply = tt("voiceHelp");
    else {
      if (cmd === "ask") await chooseLanguage(my);
      else { lang = cmd; set("lang", lang); set("langChosen", "1"); renderTexts(); }
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
      // Pressing Space/Talk during the question skips the list and goes straight to answering.
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
      if (!text) { stopThinking(); return nothingHeard(); }
      var cmd = voiceCommand(text);
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
      var r2 = await chat({ lang: lang, context: context, messages: transcript.slice(-20) }, function () {
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
      var reply = String(r2.text || "");
      // Spoken by a voice of the language the reply is written in, not always the page's language.
      var replyLang = I.LANGS.indexOf(r2.lang) !== -1 ? r2.lang : lang;
      if (reply) { transcript.push({ role: "assistant", content: reply }); lastSaid = reply; lastSaidLang = replyLang; }
      await say(reply || (r2.end ? tt("farewell") : ""), reply ? replyLang : lang);
      if (my !== session) return;
      if (r2.end) return endConversation();
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

  async function startConversation(withContext) {
    if (active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioWorkletNode) {
      return announce("errSupport");
    }
    alertBox.textContent = "";
    active = true;
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

    // Give the AI disclosure and first-layer privacy information before any
    // microphone access or language recording. A new notice version refreshes
    // the old, incomplete notice without saving conversation content.
    var firstPrivacyNotice = get("privacyNoticeVersion") !== "2026-10-26";
    var disclosure = tt("aiDisclosure") + (firstPrivacyNotice ? " " + tt("notice") : "");
    var disclosureInterrupted = await say(disclosure);
    if (my !== session) return;
    if (firstPrivacyNotice && !disclosureInterrupted) set("privacyNoticeVersion", "2026-10-26");
    setState("processing");

    try {
      await openMic();
    } catch (e) {
      if (my === session) giveUp(micErrorKey(e));
      return;
    }
    if (my !== session) return;

    sounds.start();
    await new Promise(function (r) { setTimeout(r, 500); });
    if (my !== session) return;

    // The first time, ask which language to use.
    if (!get("langChosen")) {
      try { await chooseLanguage(my); } catch (e) { if (my === session) fail(e.code || "errConnection"); return; }
      if (my !== session) return;
    }

    // Identity was disclosed once before microphone access. Keep the remaining
    // instructions brief, with a shorter return-visit version.
    var intro = get("introHeard") ? tk("greetingShort") : tk("greeting");
    set("introHeard", "1");
    lastSaid = intro;
    await say(intro);
    if (my !== session) return;
    goReady();
  }

  function endConversation(silent) {
    if (!active) return;
    active = false;
    session++;
    choosing = false;
    pendingTalk = false;
    stopThinking();
    if (stopSpeaking) { stopSpeaking(); stopSpeaking = null; }
    closeMic();
    rec = null;
    transcript = [];
    context = "";
    lastSaid = "";
    lastSaidLang = null;
    if (recResolve) { var done = recResolve; recResolve = null; done(null); }
    setState("idle");
    showConversationControls(false);
    if (!silent) sounds.end();
  }

  function fail(code) {
    endConversation(true);
    sounds.end();
    setTimeout(function () { announce(code); }, 700);
  }

  // ---------- buttons ----------
  // The talk button and the space bar: press to start talking, press again to get the answer.
  function onTalkPress() {
    if (!active) return startConversation(false);
    if (choosing) {
      // Skip the question / finish saying the language.
      if (state === "speaking" && stopSpeaking) stopSpeaking();
      else if (state === "listening") finishRecording();
      return;
    }
    // While the assistant talks: interrupt it and start recording.
    if (state === "speaking") { pendingTalk = true; if (stopSpeaking) stopSpeaking(); return; }
    if (state === "ready") return startRecording(false);
    if (state === "listening") return finishRecording();
    // Waiting for the answer: nothing to do.
  }

  talkBtn.addEventListener("click", onTalkPress);
  endBtn.addEventListener("click", function () { endConversation(); });

  document.addEventListener("keydown", function (e) {
    if (isTalkShortcut(e)) {
      e.preventDefault();
      if (!e.repeat) { talkBtn.focus(); onTalkPress(); }
      return;
    }
    // Escape ends the conversation (when the screen reader lets the key through).
    if (active && e.key === "Escape" && !e.repeat) { endConversation(); return; }
    if (!active || !isSpace(e) || e.repeat || e.target === talkBtn || isOtherControl(e.target)) return;
    e.preventDefault();
    onTalkPress();
  });

  langBtn.addEventListener("click", function () {
    var open = langsBox.hidden;
    langsBox.hidden = !open;
    langBtn.setAttribute("aria-expanded", open ? "true" : "false");
    // Move straight into the list, onto the current language.
    if (open) { var cur = langsBox.querySelector('[data-set-lang="' + lang + '"]'); if (cur) cur.focus(); }
  });

  langsBox.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    langsBox.hidden = true;
    langBtn.setAttribute("aria-expanded", "false");
    langBtn.focus();
  });

  langsBox.addEventListener("click", function (e) {
    var b = e.target.closest("[data-set-lang]");
    if (!b) return;
    lang = b.getAttribute("data-set-lang");
    set("lang", lang);
    set("langChosen", "1");
    langsBox.hidden = true;
    langBtn.setAttribute("aria-expanded", "false");
    renderTexts();
    talkBtn.focus();
  });

  // ---------- start-up ----------
  renderTexts();
  // Wake a sleeping free server early so the first answer is not slow.
  fetch("/health").catch(function () {});
})();

