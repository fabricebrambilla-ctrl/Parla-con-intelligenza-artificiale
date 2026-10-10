(function () {
  "use strict";
  var I = window.I18N;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- storage (never required to work) ----------
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
  var anonId = get("anonId");
  if (!anonId) { anonId = randomId(); set("anonId", anonId); }

  function loadHistory() {
    try { var h = JSON.parse(get("history") || "[]"); return Array.isArray(h) ? h : []; } catch (e) { return []; }
  }
  function saveHistory(entry) {
    var h = loadHistory();
    h.unshift(entry);
    set("history", JSON.stringify(h.slice(0, 10)));
  }

  // ---------- language ----------
  var lang = I.pick(get("lang") ? [get("lang")] : navigator.languages || [navigator.language]);
  var tt = function (key) { return I.t(lang, key); };

  var talkBtn = $("talk"), continueBtn = $("continue"), langBtn = $("lang"),
      langsBox = $("langs"), historyP = $("history"), alertBox = $("alert");

  function renderTexts() {
    I.applyPage(lang);
    talkBtn.textContent = active ? tt("end") : tt("start");
  }

  function showHistoryControls() {
    var has = loadHistory().length > 0;
    continueBtn.hidden = !has;
    historyP.hidden = !has;
  }

  // ---------- state ----------
  var active = false;      // a conversation is running
  var session = 0;         // increases on every start/end, to drop stale async work
  var state = "idle";      // idle | listening | processing | speaking
  var transcript = [];     // [{role, content}] kept in memory only
  var context = "";        // summary of the previous conversation, when continuing

  function setState(s) {
    state = s;
    document.body.setAttribute("data-state", s);
  }

  // ---------- mute gate: the screen reader is probably talking ----------
  var muteUntil = 0;
  function muteFor(ms) {
    muteUntil = Math.max(muteUntil, performance.now() + ms);
    if (vad.speaking) resetVad();
  }
  ["keydown", "focusin", "click", "pointerdown"].forEach(function (ev) {
    document.addEventListener(ev, function () { muteFor(1500); }, true);
  });
  window.addEventListener("focus", function () { muteFor(1000); });
  document.addEventListener("visibilitychange", function () { muteFor(1000); });

  // ---------- errors: one alert, only after audio stopped ----------
  function announce(key) {
    muteFor(4000);
    alertBox.textContent = "";
    setTimeout(function () { alertBox.textContent = tt(key); }, 150);
  }

  // ---------- sounds ----------
  var ctx = null;
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
    turn: function () { tone(880, 0, 0.12, 0.08); },
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

  // ---------- speech output (browser voice) ----------
  var voices = [];
  function loadVoices() { if (window.speechSynthesis) voices = speechSynthesis.getVoices() || []; }
  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener("voiceschanged", loadVoices)
                                     : (speechSynthesis.onvoiceschanged = loadVoices);
  }

  function pickVoice() {
    var want = I.META[lang].speech.toLowerCase();
    var base = want.split("-")[0];
    var best = null, bestScore = -1;
    voices.forEach(function (v) {
      var vl = String(v.lang || "").replace("_", "-").toLowerCase();
      if (vl.split("-")[0] !== base) return;
      var n = String(v.name || "").toLowerCase();
      var s = 0;
      if (vl === want) s += 3;
      if (/natural|neural/.test(n)) s += 4;
      if (/online|google|premium|enhanced|siri/.test(n)) s += 2;
      if (s > bestScore) { best = v; bestScore = s; }
    });
    return best;
  }

  function splitSentences(text) {
    var parts = String(text).match(/[^.!?。！？]+[.!?。！？]*\s*/g) || [String(text)];
    var out = [], cur = "";
    parts.forEach(function (p) {
      if ((cur + p).length > 220 && cur) { out.push(cur); cur = p; } else cur += p;
    });
    if (cur.trim()) out.push(cur);
    return out;
  }

  var speakingResolve = null;
  function say(text) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis || !text) return resolve();
      setState("speaking");
      speechSynthesis.cancel();
      var chunks = splitSentences(text);
      var voice = pickVoice();
      var i = 0, watchdog = null, done = false;
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(watchdog);
        speakingResolve = null;
        resolve();
      }
      speakingResolve = function () { speechSynthesis.cancel(); finish(); };
      function next() {
        clearTimeout(watchdog);
        if (done) return;
        if (i >= chunks.length) return finish();
        var chunk = chunks[i++];
        var u = new SpeechSynthesisUtterance(chunk);
        u.lang = I.META[lang].speech;
        if (voice) u.voice = voice;
        u.onend = next;
        u.onerror = next;
        // Some browsers never fire onend; never get stuck.
        var perChar = lang === "zh" ? 280 : 110;
        watchdog = setTimeout(next, 3000 + chunk.length * perChar);
        speechSynthesis.speak(u);
      }
      next();
    });
  }

  // ---------- microphone + voice activity detection ----------
  var stream = null, source = null, node = null, sink = null, workletLoaded = false;

  var vad;
  function resetVad() {
    vad = { speaking: false, voiced: 0, silence: 0, speechFrames: 0, frames: [], pre: [], noise: vad ? vad.noise : 0.004 };
  }
  resetVad();

  async function openMic() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        voiceIsolation: { ideal: true },
        channelCount: 1
      }
    });
    if (!workletLoaded) {
      await ctx.audioWorklet.addModule("/capture-worklet.js");
      workletLoaded = true;
    }
    source = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, "capture");
    node.port.onmessage = function (e) { onFrame(e.data); };
    sink = ctx.createGain();
    sink.gain.value = 0;
    source.connect(node);
    node.connect(sink).connect(ctx.destination);
  }

  function closeMic() {
    try { if (source) source.disconnect(); } catch (e) {}
    try { if (node) { node.port.onmessage = null; node.disconnect(); } } catch (e) {}
    try { if (sink) sink.disconnect(); } catch (e) {}
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = source = node = sink = null;
  }

  // Frames are 20 ms. Start needs ~200 ms of voice (low sensitivity),
  // end after ~800 ms of silence, 300 ms of audio kept before the start.
  function onFrame(frame) {
    if (state !== "listening") return;
    if (performance.now() < muteUntil) return;
    var sum = 0;
    for (var i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
    var rms = Math.sqrt(sum / frame.length);
    var threshold = Math.max(vad.noise * 3, 0.012);

    if (!vad.speaking) {
      vad.pre.push(frame);
      if (vad.pre.length > 25) vad.pre.shift();
      if (rms > threshold) vad.voiced++;
      else {
        vad.voiced = 0;
        vad.noise = Math.min(0.05, vad.noise * 0.95 + rms * 0.05);
      }
      if (vad.voiced >= 10) {
        vad.speaking = true;
        vad.frames = vad.pre.slice();
        vad.pre = [];
        vad.speechFrames = vad.voiced;
        vad.silence = 0;
      }
      return;
    }

    vad.frames.push(frame);
    if (rms > threshold * 0.7) { vad.silence = 0; vad.speechFrames++; }
    else vad.silence++;
    if (vad.silence >= 40 || vad.frames.length >= 1500) {
      var frames = vad.frames, speech = vad.speechFrames;
      resetVad();
      if (speech >= 15) handleUtterance(encodeWav(frames, ctx.sampleRate));
    }
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
  async function api(url, opts) {
    var ctl = new AbortController();
    // Generous: a sleeping free server can take ~50 s to wake up.
    var timer = setTimeout(function () { ctl.abort(); }, 60000);
    opts.signal = ctl.signal;
    opts.headers = Object.assign({ "X-Anon-Id": anonId }, opts.headers || {});
    try {
      var res = await fetch(url, opts);
      if (res.status === 429) throw { code: "errLimit" };
      if (!res.ok) throw { code: "errConnection" };
      return await res.json();
    } catch (e) {
      throw e && e.code ? e : { code: "errConnection" };
    } finally {
      clearTimeout(timer);
    }
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

  // ---------- conversation ----------
  function backToListening() {
    var my = session;
    setTimeout(function () {
      if (!active || my !== session) return;
      resetVad();
      setState("listening");
      sounds.turn();
    }, 400);
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
      if (!text) { stopThinking(); return backToListening(); }
      transcript.push({ role: "user", content: text });

      if (isGoodbye(text)) {
        stopThinking();
        await say(tt("farewell"));
        if (my === session) endConversation();
        return;
      }

      var r2 = await api("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: lang, context: context, messages: transcript.slice(-20) })
      });
      stopThinking();
      if (my !== session) return;
      var reply = String(r2.reply || "");
      if (reply) transcript.push({ role: "assistant", content: reply });
      await say(reply || (r2.end ? tt("farewell") : ""));
      if (my !== session) return;
      if (r2.end) return endConversation();
      backToListening();
    } catch (e) {
      stopThinking();
      if (my !== session) return;
      fail(e.code || "errConnection");
    }
  }

  async function startConversation(withContext) {
    if (active) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioWorkletNode) {
      return announce("errSupport");
    }
    alertBox.textContent = "";
    active = true;
    var my = ++session;
    transcript = [];
    var last = loadHistory()[0];
    context = withContext && last ? last.summary || "" : "";

    // Must happen inside the click: unlock audio and speech (iOS Safari).
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    if (window.speechSynthesis) {
      var unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0;
      speechSynthesis.speak(unlock);
    }
    talkBtn.textContent = tt("end");
    talkBtn.setAttribute("data-active", "true");
    setState("processing");

    try {
      await openMic();
    } catch (e) {
      active = false;
      session++;
      closeMic();
      setState("idle");
      talkBtn.textContent = tt("start");
      talkBtn.removeAttribute("data-active");
      return announce("errMic");
    }
    if (my !== session) return closeMic();

    sounds.start();
    await new Promise(function (r) { setTimeout(r, 500); });
    if (my !== session) return;
    await say(context ? tt("greetingContinue") : tt("greeting"));
    if (my !== session) return;
    backToListening();
  }

  function endConversation(silent) {
    if (!active) return;
    active = false;
    session++;
    stopThinking();
    if (speakingResolve) speakingResolve();
    if (window.speechSynthesis) speechSynthesis.cancel();
    closeMic();
    resetVad();
    setState("idle");
    talkBtn.textContent = tt("start");
    talkBtn.removeAttribute("data-active");
    if (!silent) sounds.end();
    summarize(transcript.slice(), context);
  }

  function fail(code) {
    endConversation(true);
    sounds.end();
    setTimeout(function () { announce(code); }, 700);
  }

  async function summarize(messages, prevContext) {
    if (!messages.some(function (m) { return m.role === "user"; })) return;
    try {
      var r = await api("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: lang, context: prevContext, messages: messages.slice(-40) })
      });
      if (r.summary) {
        saveHistory({ date: new Date().toISOString(), topic: r.topic || "", summary: r.summary });
        showHistoryControls();
      }
    } catch (e) { /* history is a nice-to-have; stay silent */ }
  }

  // ---------- buttons ----------
  talkBtn.addEventListener("click", function () {
    if (!active) return startConversation(false);
    // While the AI talks, the button interrupts it and gives the turn to the user.
    if (state === "speaking" && speakingResolve) return speakingResolve();
    endConversation();
  });

  continueBtn.addEventListener("click", function () {
    if (active) return;
    talkBtn.focus();
    startConversation(true);
  });

  langBtn.addEventListener("click", function () {
    var open = langsBox.hidden;
    langsBox.hidden = !open;
    langBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  langsBox.addEventListener("click", function (e) {
    var b = e.target.closest("[data-set-lang]");
    if (!b) return;
    lang = b.getAttribute("data-set-lang");
    set("lang", lang);
    langsBox.hidden = true;
    langBtn.setAttribute("aria-expanded", "false");
    renderTexts();
    talkBtn.focus();
  });

  // ---------- start-up ----------
  renderTexts();
  showHistoryControls();
  // Wake a sleeping free server early so the first answer is not slow.
  fetch("/health").catch(function () {});
})();
