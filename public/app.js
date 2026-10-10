(function () {
  "use strict";
  var I = window.I18N;
  var $ = function (id) { return document.getElementById(id); };

  // iPhone/iPad (also iPadOS, which reports itself as a Mac with touch).
  var IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
               (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

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
    // Keep the chosen language on the other pages too.
    historyP.querySelector("a").href = "/history?lang=" + lang;
    $("privacyLink").href = "/privacy?lang=" + lang;
    $("accessibilityLink").href = "/accessibility?lang=" + lang;
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
  var failures = 0;        // failed turns in a row
  var aiVoiceLangs = [];   // languages with the natural AI voice (from the server)

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
  ["keydown", "focusin", "click", "pointerdown", "touchstart"].forEach(function (ev) {
    document.addEventListener(ev, function () { muteFor(1500); }, { capture: true, passive: true });
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

  function pickVoice() {
    var want = I.META[lang].speech.toLowerCase();
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

  var stopSpeaking = null;  // set while something is being said
  var aiVoiceFailures = 0;

  function speakBrowser(chunks, isCancelled) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis || !chunks.length) return resolve();
      var voice = pickVoice();
      var i = 0, watchdog = null;
      function next() {
        clearTimeout(watchdog);
        if (isCancelled()) return resolve();
        if (i >= chunks.length) return resolve();
        var chunk = chunks[i++];
        var u = new SpeechSynthesisUtterance(chunk);
        u.lang = I.META[lang].speech;
        if (voice) u.voice = voice;
        u.onend = next;
        u.onerror = next;
        // Some browsers never fire onend; never get stuck.
        var perChar = lang === "zh" ? 300 : 110;
        watchdog = setTimeout(next, 4000 + chunk.length * perChar);
        speechSynthesis.speak(u);
      }
      next();
    });
  }

  function fetchAiVoice(text) {
    var ctl = new AbortController();
    var timer = setTimeout(function () { ctl.abort(); }, 12000);
    return fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Anon-Id": anonId },
      body: JSON.stringify({ lang: lang, text: text }),
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
  async function speakAi(chunks, isCancelled) {
    var next = fetchAiVoice(chunks[0]);
    for (var i = 0; i < chunks.length; i++) {
      var buffer;
      try { buffer = await next; } catch (e) {
        aiVoiceFailures++;
        return chunks.slice(i);
      }
      // Fetch the next sentence while this one plays.
      if (i + 1 < chunks.length) { next = fetchAiVoice(chunks[i + 1]); next.catch(function () {}); }
      await playBuffer(buffer, isCancelled);
      if (isCancelled()) return [];
    }
    aiVoiceFailures = 0;
    return [];
  }

  async function say(text) {
    text = String(text || "").trim();
    if (!text) return;
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
    if (aiVoiceLangs.indexOf(lang) !== -1 && aiVoiceFailures < 3) {
      rest = await speakAi(splitSentences(text, 300), isCancelled);
    }
    if (rest.length && !cancelled) await speakBrowser(rest, isCancelled);
    if (!cancelled) stopSpeaking = null;
  }

  // ---------- microphone + voice activity detection ----------
  var stream = null, source = null, node = null, sink = null, workletCtx = null;

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
    try {
      source = ctx.createMediaStreamSource(stream);
    } catch (e) {
      // Firefox refuses a microphone whose sample rate differs from the context.
      var rate = stream.getAudioTracks()[0].getSettings().sampleRate;
      if (!rate) throw e;
      try { ctx.close(); } catch (e2) {}
      ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: rate });
      source = ctx.createMediaStreamSource(stream);
    }
    if (workletCtx !== ctx) {
      await ctx.audioWorklet.addModule("/capture-worklet.js");
      workletCtx = ctx;
    }
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

  // Frames are 20 ms. Start needs ~200 ms of voice (low sensitivity, short
  // pauses between sounds are allowed), end after ~800 ms of silence,
  // 300 ms of audio kept from before the start.
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
        vad.voiced = Math.max(0, vad.voiced - 2);
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
  // Errors: {code: "errLimit"} (daily limit, ends the conversation) or
  // {code: "temporary"} (network, sleeping server, busy AI: ask to repeat).
  async function request(url, opts) {
    var ctl = new AbortController();
    // Generous: a sleeping free server can take ~50 s to wake up.
    var timer = setTimeout(function () { ctl.abort(); }, 60000);
    opts.signal = ctl.signal;
    opts.headers = Object.assign({ "X-Anon-Id": anonId }, opts.headers || {});
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

  // ---------- conversation ----------
  function backToListening() {
    var my = session;
    setTimeout(async function () {
      if (!active || my !== session) return;
      if (!stream) {
        try { await openMic(); } catch (e) { if (my === session) fail("errMic"); return; }
        if (!active || my !== session) return closeMic();
      }
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

      // If the assistant searches the web, say so instead of staying silent.
      var searching = Promise.resolve();
      var r2 = await chat({ lang: lang, context: context, messages: transcript.slice(-20) }, function () {
        if (my !== session) return;
        stopThinking();
        searching = say(tt("searching")).then(function () {
          if (my === session && state === "speaking") { setState("processing"); startThinking(); }
        });
      });
      await searching;
      stopThinking();
      if (my !== session) return;
      failures = 0;
      var reply = String(r2.text || "");
      if (reply) transcript.push({ role: "assistant", content: reply });
      await say(reply || (r2.end ? tt("farewell") : ""));
      if (my !== session) return;
      if (r2.end) return endConversation();
      backToListening();
    } catch (e) {
      stopThinking();
      if (my !== session) return;
      // The last question got no answer; forget it so it is not sent twice.
      if (transcript.length && transcript[transcript.length - 1].role === "user") transcript.pop();
      if (e.code === "errLimit") return fail("errLimit");
      if (++failures >= 3) return fail("errConnection");
      await say(tt("errRetry"));
      if (my === session) backToListening();
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
    var my = ++session;
    transcript = [];
    var last = loadHistory()[0];
    context = withContext && last ? last.summary || "" : "";

    // Must happen inside the click: unlock audio and speech (iOS Safari).
    ensureContext();
    if (window.speechSynthesis) {
      var unlock = new SpeechSynthesisUtterance(" ");
      unlock.volume = 0;
      speechSynthesis.speak(unlock);
    }
    talkBtn.textContent = tt("end");
    talkBtn.setAttribute("data-active", "true");
    setState("processing");

    function giveUp(code) {
      active = false;
      session++;
      closeMic();
      setState("idle");
      talkBtn.textContent = tt("start");
      talkBtn.removeAttribute("data-active");
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

    try {
      await openMic();
    } catch (e) {
      if (my === session) giveUp("errMic");
      return;
    }
    if (my !== session) return closeMic();

    sounds.start();
    await new Promise(function (r) { setTimeout(r, 500); });
    if (my !== session) return;
    // EU AI Act: the greeting says it is an AI. The first time, also say where the voice goes.
    var intro = context ? tt("greetingContinue") : tt("greeting");
    if (!get("noticeHeard")) { intro = tt("notice") + " " + intro; set("noticeHeard", "1"); }
    await say(intro);
    if (my !== session) return;
    backToListening();
  }

  function endConversation(silent) {
    if (!active) return;
    active = false;
    session++;
    stopThinking();
    if (stopSpeaking) { stopSpeaking(); stopSpeaking = null; }
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
    if (state === "speaking" && stopSpeaking) { stopSpeaking(); return; }
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
