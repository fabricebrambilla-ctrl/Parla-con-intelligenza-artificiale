# Talk with Artificial Intelligence — Project Brief for the Coding Agent

---

## 0. RULES FOR ALL AI AGENTS (mandatory — read first)

Every AI agent (Claude, ChatGPT/Codex, Gemini, Copilot, Cursor, or any other) that works on this repository **must follow these rules**:

1. **Read this whole file before doing anything.** This brief is the single source of truth for what to build and how. Build what this document asks for.
2. **This file lives at `docs/talk-with-ai-brief.md`** and must stay inside the repository, accessible to any AI agent. Do not move, rename or delete it. `CLAUDE.md` and `AGENTS.md` at the repo root point here; keep those pointers working.
3. **After every push to `main`, update this file** in the same push (or immediately after it):
   - Add an entry to the **Change log** (§12): date, what changed, which files.
   - Update **Current state of the code** (§12) so it describes what the repo actually does now.
   - If any section of the brief is no longer accurate because of the change, fix that section.
4. **Record changes in user preference.** Whenever the owner states a new preference, changes their mind, or rejects/approves a design choice, write it in **User preferences** (§13) with the date. Newer preferences override older ones and override anything else in this brief; mark the old one as replaced instead of silently deleting it.
5. **Do not contradict this brief silently.** If you think something in it is wrong or outdated (e.g. a model name changed), tell the owner, and record the decision in §13.
6. **These rules must stay at the top of this file.** Do not remove or weaken them.

---

Read this whole file before writing code. It explains who the site is for, how the user experience must work, how the two main screen readers (**JAWS** and **NVDA**) read web pages, how to make voice work **on normal laptop speakers without headphones**, and the technical constraints. The research is done; do not redo it, but **do test with real screen readers** (see §10).

---

## 1. Purpose

A free, voice-only AI assistant that blind people can use **without sighted help and without special equipment**.

- The owner's aunt is blind and uses **JAWS** on Windows. She wants to research things like **new inventions and technology for blind people**, which needs **current, real information from the internet**, not answers from the model's memory.
- Mainstream AI sites are hard for screen-reader users. Blind users on the OpenAI forum report that ChatGPT's web interface has many **unlabeled buttons** (a screen reader just says "button"), that accessibility keeps breaking after updates, and that blind people often need a sighted person to start voice mode at all.
- So this site does **one thing**: you open it, press one button, and talk. The AI talks back in a natural voice and searches the web when needed.
- It will be shared in blind communities in **English, Italian, French, Bulgarian, Russian and Chinese** (Simplified).
- **Must work with JAWS and NVDA equally**, plus VoiceOver on iPhone.
- **Must work on built-in laptop speakers and microphone.** Never require or assume headphones.

**Design rule above all others: fewer elements = better.** Every extra link, button or line of text is something the screen reader has to read out loud and the user has to step through.

---

## 2. User experience (exact flow)

### 2.1 First visit

1. Page loads. The screen reader announces the page `<title>`, then (with default settings) starts reading the page from the top.
2. The page language is **auto-detected** from the browser (`navigator.languages`, falling back to the `Accept-Language` header on the server). The page renders in that language with the correct `<html lang="…">` (see §4.6 — this makes the screen reader read with the right voice/accent).
3. The page contains only:
   - `<h1>` — "Talk with Artificial Intelligence" (translated).
   - **One big button**: "Start conversation" (translated).
   - **One small button**: "Language: Italiano. Change language" (shows current language).
   - One short sentence of help *below* the buttons: "Press the button and speak. To finish, press it again or say goodbye." (translated).
4. If the user presses "Change language", show a list of 6 buttons, **each written in its own language** with its own `lang` attribute: `English`, `Italiano`, `Français`, `Български`, `Русский`, `中文`. Pressing one reloads the text in that language, saves the choice, and moves focus back to "Start conversation".
5. Language choice is saved in `localStorage` so returning users skip this.

### 2.2 Starting a conversation

1. User presses "Start conversation" (Enter or Space).
2. **First time only**, the browser asks for microphone permission. This is a browser dialog; both JAWS and NVDA read it. Do not add our own pop-up before it.
3. A short, soft **start sound** (earcon) plays, then the AI greets in the chosen language, e.g. *"Hi, I'm listening. Ask me anything. When you're done, just say goodbye."*
4. The same button **stays focused** and changes its label to "End conversation". Do **not** move focus anywhere else. Do not open new panels.
5. The user simply talks. The AI answers by voice. The user can interrupt the AI by speaking (see §5 for how this stays reliable on speakers).
6. The conversation ends when the user **presses the button again** or **says goodbye / stop** (the model calls an `end_conversation` function — implement it). Play an end sound; label returns to "Start conversation".

### 2.3 While talking — what must NOT happen

- **No transcript on screen that the screen reader reads aloud.** No `aria-live` region for transcripts or AI replies. The screen reader would speak over the AI voice, and its voice would be picked up by the microphone (see §5).
- No spinners, toasts, "AI is typing" messages, or status text that changes every second.
- Status is communicated with **sounds**, not text:
  - start-listening tone, end tone,
  - a quiet repeating "thinking" tick while the AI is searching (only if a wait is longer than ~1.5 s).
- **Errors** (no mic, connection lost, daily limit reached): spoken once by the page using a single `role="alert"` region **after** audio has stopped, in plain words, plus what to do ("Connection lost. Press the button to try again.").

### 2.4 Returning users and past conversations

- On first visit, generate a random anonymous ID and store it in `localStorage` (no accounts, no login, no email).
- After each conversation, store a **short text summary** of it (produced by the model, a few sentences) on the user's device in `localStorage`. Keep the last ~10.
- On a return visit **if** history exists, show one extra button under "Start conversation": "Continue last conversation". It starts a session and loads the last summary into context (§7.4).
- Optional, low priority: a separate page "My past conversations" with each conversation as an `<h2>` (date + one-line topic) followed by its summary in a paragraph, so users can jump between them with the **H** key (works in both JAWS and NVDA). Include a "Delete all my history" button.
- Storing history only on the device means: no database, no personal data on the server, and nothing to leak. Say this in one sentence on the page ("Your conversations are saved only on this computer.").

---

## 3. Who uses this and with what

WebAIM Screen Reader User Survey #10 (Dec 2023–Jan 2024, 1,539 respondents) is the best available data:

- Primary desktop screen reader: **JAWS 40.5%**, **NVDA 37.7%** — practically a tie.
- **By region:** JAWS leads in North America and Australia; **NVDA leads in Europe, Africa/Middle East and Asia.** This site targets Italy, France, Bulgaria, Russia and China, so **most of the target audience probably uses NVDA**, not JAWS.
- Counting everyone who uses each one at all (not just as primary), NVDA (65.6%) is slightly ahead of JAWS (60.5%).
- Most common combos: **JAWS + Chrome**, **NVDA + Chrome**, **JAWS + Edge**, **NVDA + Firefox**.
- **CAPTCHA is the #1 reported barrier.** Never use a CAPTCHA.
- 91% also use a screen reader on mobile, mostly **VoiceOver on iPhone**. The page must work on iPhone Safari + VoiceOver too.

If everything is built with plain, correct HTML, it works in all of them. Screen-reader-specific tricks are not needed and should be avoided.

---

## 4. How screen readers read web pages: JAWS and NVDA

### 4.1 The two screen readers

| | **JAWS** | **NVDA** |
|---|---|---|
| Maker | Freedom Scientific (Vispero) | NV Access (non-profit) |
| Price | Paid licence (expensive) | **Free and open source** |
| Platform | Windows | Windows |
| Typical users | Workplaces, government, North America | Individuals, Europe, Asia, Africa, developing countries |
| Modifier key | Insert (JAWS key) | Insert, Numpad 0, or Caps Lock (NVDA key) |
| Stop speaking | Control | Control |
| Test version | 40-minute demo mode (restart Windows for more) | Free download, no limit |

Both work the same way on the web. The differences below are mostly key names.

### 4.2 Two modes (same idea, different names)

| | JAWS name | NVDA name | What it does |
|---|---|---|---|
| Reading mode | **Virtual cursor** (virtual PC cursor) | **Browse mode** | The screen reader builds its own copy of the page (the "virtual buffer") and **captures every key press** for navigation. Arrow keys read; single letters jump. |
| Typing mode | **Forms mode** | **Focus mode** | Keys go straight to the page so the user can type. |
| Switch on | Automatic on text fields; Enter on a field | Automatic when tabbing into an editable field; Enter/Space on a field | |
| Switch off | Escape or Numpad Plus | Escape | |
| Manual toggle | Insert+Z (toggle virtual cursor) | **NVDA+Space** | |
| Feedback | — | Rising tone = focus mode, falling tone = browse mode (or speaks the mode name) | |

NVDA notes:
- NVDA's own docs warn that some **single-page web apps don't work well in browse mode because of dynamic content updates**. Keep the page's DOM static during a conversation. If the page content does change, NVDA users may need NVDA+F5 to refresh the virtual buffer — design so they never need to.
- NVDA has a setting "Automatic say all on page load" (on by default), so the page is read from the top as soon as it loads. That is why the page must be very short.

Consequences for both:
- **Do not rely on custom keyboard shortcuts** (e.g. "press T to talk"). In reading mode the screen reader swallows single letters for its own navigation, so the page never receives them.
- **Avoid text inputs** on the main screen; they switch the screen reader into typing mode and change how keys behave.
- A native `<button>` works in every mode in both readers: Enter or Space activates it. That is why the whole app is driven by **one native button** (plus voice commands).

### 4.3 How users move around a page

Single-letter jumps in reading mode (add Shift to go backwards):

| Jump to | JAWS | NVDA |
|---|---|---|
| Next heading | H | H |
| Next button | B | B |
| Next landmark/region | **R** | **D** |
| Next link | Tab / U (unvisited) | K |
| Next form field | F | F |
| List of all elements | Insert+F6 headings, Insert+F5 form fields, Insert+F7 links | **NVDA+F7** (Elements list, one dialog for links/headings/landmarks/buttons) |
| Read everything from here | Insert+Down Arrow | NVDA+Down Arrow |

Consequences:
- Use exactly one `<h1>`. Put everything inside one `<main>` (landmark for R / D).
- Every button must have **visible text** that says what it does. Never an icon-only button. Never a `<div>` or `<span>` styled as a button.
- Keep the order on screen = the order in the HTML.

### 4.3b Facts the push-to-talk design relies on (checked 2026-10-10)

- In NVDA browse mode and the JAWS virtual cursor, the screen reader captures the keyboard. **Space or Enter on a focused button is not delivered to the page as a key press**; the screen reader activates the button (a synthetic click, sometimes a simulated mouse click at its position, or the accessibility API "invoke"). So the app's real control is the **Talk button's click handler**; the page-wide Space shortcut only helps when no screen reader is running or it is in focus mode. Keep the button's content plain text (no child elements), never call `stopPropagation` on its click, and never move it while a conversation runs.
- Users must keep the reading cursor on the Talk button for Space to work; the accessibility statement says so. Focus stays there because the app never moves it.
- VoiceOver on iPhone and TalkBack on Android activate the button with a double tap (a click); there is no space bar, so phones and tablets (`pointer: coarse` and no fine pointer) get "press the Talk button" wording.
- **`autofocus` on the Talk button**: W3C notes autofocus overrides reading from the top, and NVDA's developers consider that the intended effect. For this single-purpose page it means the screen reader announces the title and "Start conversation, button" plus its description (`aria-describedby` = the help text), and Space works immediately. The description is removed during a conversation so returning to the button stays short.
- The End conversation button appears right after Talk during a conversation; when it disappears and had focus, focus goes back to Talk (never left on a hidden element). Escape also ends a conversation when the screen reader lets it through.
- Windows High Contrast (`forced-colors`) keeps button borders and the focus outline visible.

### 4.4 What is read on page load

- The `<title>` first, then the page from the top (default in both readers).
- So the `<title>` should be the action, e.g. `Talk with Artificial Intelligence – press the button to start`. Translate it.
- Nothing else should appear before the `<h1>` (no logo text, no menu, no cookie banner, no "skip to content" maze).

### 4.5 Live regions (dynamic announcements)

- `aria-live="polite"` waits until the screen reader finishes speaking; `aria-live="assertive"` / `role="alert"` interrupts.
- JAWS and NVDA behave differently and inconsistently: NVDA reads polite messages at the end of the current utterance and can double-announce when `role="alert"` is combined with other live attributes; JAWS can buffer several quick updates and read them in sequence, and sometimes misses messages entirely if the region is created at the same moment as its text.
- Rules for this project:
  - Create the one alert region **empty** on page load; only insert text later.
  - Use `role="alert"` alone (don't also add `aria-live`).
  - Use it **only for errors**, never for transcripts or status.
  - One short sentence per message, and never while the AI is speaking.

### 4.6 Focus

- Never move focus without the user asking. After changing language, put focus back on "Start conversation".
- Do not use modals, dialogs, overlays, or "toast" pop-ups.
- Visible focus outline (thick, high contrast) for low-vision users.

### 4.7 Language and the `lang` attribute

- **JAWS** can switch its speech voice automatically based on the `lang` attribute.
- **NVDA** has "Automatic language switching (when supported)" in its speech settings; it works when the user's voice/synthesizer has that language installed (NVDA's built-in eSpeak NG voice covers all six target languages).
- If `lang` is wrong, the screen reader reads Italian text with an English voice and it becomes nonsense.
- Set `<html lang="it">` (etc.) to match the displayed language. Use simple codes: `en`, `it`, `fr`, `bg`, `ru`, `zh-Hans` (for Chinese, also test plain `zh` — older readers can mishandle region/script subtags).
- In the language list, each language name must carry its own `lang` (e.g. `<button lang="ru">Русский</button>`).

### 4.8 Other things that make blind users leave

- Cookie consent banners (a whole popup to navigate before anything works). Avoid by **not using tracking/analytics cookies at all**; only keep strictly necessary `localStorage` (language, anonymous ID, history). Have a human check the EU ePrivacy/GDPR position before launch.
- Auto-playing audio before the user presses anything (also blocked by browsers).
- Timeouts that close the session without warning.
- Images without `alt`, decorative SVGs not hidden (`aria-hidden="true"`).

---

## 5. Making voice work on laptop speakers (no headphones)

### 5.1 The problem

On a laptop without headphones, the microphone hears everything coming out of the speakers. There are **three voices** that could come out of them:

1. **The user** — the only one the AI should hear.
2. **The AI's own voice** — if the mic hears it, the AI hears itself, interrupts itself, or answers itself.
3. **The screen reader's voice (JAWS/NVDA)** — a separate program. If the mic hears it, the AI treats "End conversation, button" as something the user said.

Browser **echo cancellation** solves #2 well, because the browser knows exactly what the page played and subtracts it. It **cannot** solve #3, because the browser has no copy of the screen reader's audio — it's another program.

So the design must make sure the screen reader is **almost never speaking** during a conversation, and must protect against the moments when it does. Use **all** of the layers below; each covers a gap in the others.

### 5.2 Layer 1 — keep the screen reader silent (most important)

A screen reader only speaks when (a) the page changes, or (b) the user presses keys. So:
- During a conversation, **the page must not change at all**: no text updates, no live regions, no label changes (except the one button label at start/end), no focus moves.
- Everything the user needs to know is said by the **AI voice** or a **sound**, never by page text.
- Ending by **voice** ("goodbye", "stop", in any of the six languages) means the user usually doesn't need to touch the keyboard during the conversation, so the screen reader has no reason to speak.

### 5.3 Layer 2 — mute the mic whenever the screen reader is likely speaking

The page can't hear the screen reader, but it can tell when the user just did something that makes it speak:
- On **any** `keydown`, `focusin`, `click` or `pointerdown` event on the page, **mute the microphone input for ~1.5 seconds** (stop sending audio frames; keep the mic stream open). Restart the timer on each event. In reading mode not every key reaches the page, but focus changes and button presses do, and those are exactly when the screen reader speaks about our page.
- When the page itself sends an error to the alert region, mute the mic until a few seconds after.
- Also mute the mic for ~1 second when the window regains focus (`window` `focus` / `visibilitychange`), because switching back to the browser makes the screen reader announce the page.

### 5.4 Layer 3 — strong echo cancellation for the AI's own voice

```js
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    voiceIsolation: { ideal: true }, // used where the OS/browser supports it (e.g. Safari/macOS, iOS); ignored elsewhere
    channelCount: 1
  }
});
```
- **Play the AI audio through the same page** (Web Audio in this tab), never through a separate tab, `<iframe>`, or system TTS. Echo cancellation only works on audio the page itself plays.
- Echo cancellation needs a few seconds of playback to "learn" the room. That's another reason the AI speaks a short greeting first: by the time the user talks, it has adapted.
- Keep AI playback volume normal; don't boost it with gain nodes (distortion breaks echo cancellation).

### 5.5 Layer 4 — tell the AI to ignore non-human speech

- In the system prompt (§7.5): *"The user is blind and uses a screen reader. You may sometimes hear a fast synthetic voice reading interface words such as 'button', 'heading level 1', 'browse mode', 'focus mode', 'link', or page text. That is the screen reader, not the user. Ignore it completely and do not reply to it. Also ignore your own voice if you hear it echoed."*
- Turn on the Live API's **proactive audio** option (lets the model decide not to respond to input that isn't meant for it) **if the chosen model supports it** — check the model page at build time.

### 5.6 Layer 5 — less trigger-happy interruption

- Keep the API's automatic voice-activity detection, but set **start-of-speech sensitivity to LOW** so short sounds, clicks and stray screen-reader words don't interrupt the AI. Real users interrupting with a full sentence still work.
- Keep `silenceDurationMs` around 600–800 ms (Google recommends 500–800; lower values chop the user's sentences into pieces).
- Keep `prefixPaddingMs` above 0 so first syllables aren't cut.

### 5.7 Layer 6 — automatic fallback to "turn-taking" mode

Some cheap laptops have poor echo cancellation. Detect it and adapt automatically, with no setting for the user to find:
- Enable `outputAudioTranscription` and `inputAudioTranscription` (kept in memory, never displayed).
- If what the API says the **user** said closely matches what the **AI** just said (simple word-overlap similarity on the last few seconds), the mic is hearing the speakers → switch the session to **turn-taking mode**:
  - Mic input is muted while the AI is speaking, plus ~400 ms after it finishes.
  - A soft "your turn" tone plays when the mic re-opens.
  - The user can still interrupt by **pressing the button once while the AI is talking** (stops the AI and opens the mic). In turn-taking mode, the button ends the conversation only when the AI is silent; saying "goodbye" always ends it.
  - The AI tells the user once, briefly: "I'll pause after each answer so I can hear you clearly."
- Same fallback if the AI interrupts itself more than twice in a minute.

### 5.8 What not to do

- Don't tell users to buy or wear headphones, or to change screen reader settings. It should just work.
- Don't use push-to-talk as the default (holding a key is awkward with a screen reader, and many keys are captured by it).

---

## 6. Hosting on Render

- Backend: Render **Web Service** (Node). Frontend: a Render **Static Site** (loads instantly) or served by the same service.
- Render's free web services go to sleep after inactivity and take a while to wake. A blind user hearing nothing after pressing a button will think it's broken. Prefer: static site for the page, and on button press play a gentle "connecting" sound; if the token request takes > 3 s, the alert region says "Connecting, please wait." Consider a cheap paid instance once people use it. (Check Render's current free-tier terms at deploy time.)
- Deploy from GitHub `main` with auto-deploy on push.

---

## 7. AI and back-end architecture

### 7.1 AI: Google Gemini Live API

Chosen because it is the only major speech-to-speech API with **both a free tier and built-in Google Search grounding**.

- Model: `gemini-3.8-live` (Google's current default Live model as of Oct 2026; check the models page at build time, Live model names change often).
- Native audio in and out: input raw 16-bit PCM (send at 16 kHz, `audio/pcm;rate=16000`), output 24 kHz PCM.
- Supports all six target languages (en, it, fr, bg, ru, zh) and switches language naturally.
- **Google Search tool enabled** in the session config so the model looks things up.
- When the server sends `interrupted`, **stop playback and clear the audio queue immediately**.
- Function calling: `end_conversation` (§2.2).
- Voice: native audio models use the Gemini TTS voice list (e.g. `Kore`). The owner wants "the standard, most familiar voice". ChatGPT's voices only exist on OpenAI. Use Gemini's default (leave voice unset) unless the owner picks one after listening in Google AI Studio → Live.

### 7.2 Cost and limits (tell the owner, design for it)

- **Free tier**: audio in/out free, Google Search grounding supported, but **rate-limited** and **content is used by Google to improve its products**. The site's privacy line must say this honestly while on the free tier.
- **Paid tier** (if the site gets real users): about **$0.005/min audio in + $0.018/min audio out ≈ $0.023/min** (~$1.40 per hour of talking), plus Google Search at 5,000 free requests/month then $14 per 1,000. Content not used for training on paid.
- Protect the key and the quota:
  - Per-anonymous-ID and per-IP limits (e.g. 60 minutes/day), and a global daily cap the owner can set.
  - When a limit is hit, say so in plain words ("Today's free limit is used up. Please try again tomorrow.").

### 7.3 Security: never put the API key in the browser

- Google's Live API is server-to-server by default; for browser-to-Google connections Google requires **ephemeral tokens**.
- Small backend (Node.js) with one endpoint `POST /api/token` that checks rate limits and returns a short-lived ephemeral token locked to our model + config (system prompt, tools). The browser uses that token to open the WebSocket directly to Google (lowest latency).
- API key stored as an environment variable on Render. Never committed to GitHub. Add `.env` to `.gitignore`.

### 7.4 Session length and history

- Audio-only Live sessions are limited to **15 minutes** unless you use Google's session-management features (session resumption / context window compression). Implement them so long conversations don't cut off silently. If a reconnect is needed, do it without user action and without any announcement unless it fails.
- "Continue last conversation": send the stored summary as the first context turn (`sendClientContent` with `turnComplete: false`) before streaming audio.
- At the end of a session, use the in-memory transcriptions (§5.7) and ask a cheap text model to summarize them; save the summary to `localStorage`.

### 7.5 System prompt (core of the "don't make things up" requirement)

Write it so the AI:
- Speaks in the user's selected language unless the user switches.
- Gives **short spoken answers** (2–5 sentences), then offers to go deeper. No lists, no markdown, no "as you can see", no describing visuals. Short answers also mean less talking over each other on speakers.
- **Searches the web for anything about recent events, products, prices, research, organizations, or anything it is not certain of** — especially assistive technology and inventions for blind people.
- Says **where** information comes from in a spoken way ("According to the RNIB website, updated in March…").
- If it can't find something, says so plainly. **Never invents** products, studies, names, dates or links. Separates "confirmed" from "reported" or "announced".
- Does **not** just agree with the user; corrects them politely if the facts differ.
- Ignores screen-reader speech and its own echo (§5.5).
- Calls `end_conversation` when the user says goodbye/stop.
- Never claims to be human.

Note: search grounding **reduces** made-up answers a lot but does not make them impossible. Keep the source-naming behavior so users can check.

### 7.6 Front-end tech

- Plain HTML + CSS + a small vanilla JS module. No React/framework needed. Fast load matters, and a static DOM keeps NVDA's browse mode happy.
- Audio: `AudioWorklet` for mic capture (downsample to 16 kHz PCM, apply the mute gate from §5.3/§5.7) and for gapless playback of 24 kHz PCM.
- Official SDK `@google/genai` is fine in the browser with an ephemeral token.

---

## 8. Visual design (for sighted helpers and low-vision users)

- The owner wants it "nice and visual", but the screen-reader structure in §2 and §4 comes first.
- Large central button (min 200×200 px, high contrast), large type (≥ 20 px body), respects `prefers-color-scheme` and `prefers-reduced-motion`, WCAG AA contrast minimum (aim AAA).
- A gentle visual pulse while the AI speaks/listens is fine, as long as it is `aria-hidden="true"` and doesn't change any text.
- Works at 400% zoom and on a phone.

---

## 9. Minimal HTML skeleton (reference, not final)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Talk with Artificial Intelligence – press the button to start</title>
</head>
<body>
  <main>
    <h1>Talk with Artificial Intelligence</h1>
    <button id="talk" type="button">Start conversation</button>
    <button id="continue" type="button" hidden>Continue last conversation</button>
    <button id="lang" type="button">Language: English. Change language</button>
    <p>Press the button and speak. To finish, press it again or say goodbye.
       Your conversations are saved only on this computer.</p>
    <div id="alert" role="alert"></div>
  </main>
</body>
</html>
```

---

## 10. Testing checklist (do not ship without this)

Tools: **NVDA** (free, nvaccess.org; its *Speech Viewer* under Tools shows everything NVDA says, useful for sighted testers) and **JAWS** (40-minute demo mode).

With the **monitor off / eyes closed**, keyboard only, on **JAWS+Chrome, JAWS+Edge, NVDA+Chrome, NVDA+Firefox**:
- [ ] Page title and heading are read on load in the right language/voice.
- [ ] Press **B** → lands on "Start conversation". Enter starts it. Space also works.
- [ ] Mic permission prompt is readable and the choice is remembered.
- [ ] AI greeting is heard; talking works; interrupting the AI by voice works.
- [ ] The screen reader stays silent during the conversation.
- [ ] Saying "goodbye" ends it; pressing the button ends it; label reads "Start conversation" again.
- [ ] Change language → all 6 language names are pronounced correctly (NVDA: with automatic language switching on).
- [ ] Error cases (mic unplugged, Wi-Fi off, limit reached) are spoken once, clearly.
- [ ] Ask about a recent assistive-tech product: the AI searches and names a source.

**Speaker tests (no headphones), on at least two different laptops, one cheap:**
- [ ] 10-minute conversation on built-in speakers + mic at normal volume: the AI never answers itself or the screen reader.
- [ ] While the AI is talking, press Tab/arrow keys so the screen reader speaks: the AI does not treat it as user speech.
- [ ] Force poor echo cancellation (turn speaker volume high, laptop in a small room): fallback to turn-taking mode triggers and the conversation still works.
- [ ] Noisy room (TV on): the AI is not constantly interrupted.

Also: iPhone Safari + VoiceOver. And ask the owner's aunt to test before public launch. Real users find things testers don't.

---

## 11. Out of scope (do not build)

- Accounts, logins, emails, payments.
- Text chat box, file upload, images, settings pages, menus, footers with many links.
- Analytics/tracking cookies.
- Any requirement for headphones or screen reader setting changes.

---

## 12. Current state of the code and change log

### Current state of the code (keep this up to date)

As of 2026-10-10 the app is a full first version built with **Groq + Tavily** (Gemini Live is not used yet, see "Deviations" below).

How a conversation works:
1. The page (`public/index.html`) is rendered by the server in the visitor's language (from `Accept-Language`); `public/app.js` then applies the language saved in `localStorage`, if any.
2. **Push-to-talk (owner's design, replaces the hands-free turn-taking below):** pressing **Start conversation** first checks the limits. **The first time** (no `langChosen` in `localStorage`), the assistant asks "Which language would you like to use? Say it after the tone" in the browser's language, reads the six language names each in its own voice (Space skips), records one answer (ends after 1.2 s of silence), transcribes it with automatic language detection (`/api/transcribe?lang=auto`) and switches the page to that language (asked at most twice; the language button still works). Then it speaks the instructions: "I'm an AI assistant. Press the space bar to start talking, and press it again when you've finished, to get my answer. If you stop talking for seven seconds, I'll answer anyway. To end, say goodbye." During a conversation the big button reads "Talk" and does the same as the space bar. **Space / button:** in `ready` starts recording (tone); in `listening` ends it and sends (lower tone); while the assistant speaks it interrupts it and starts recording; while waiting for an answer it does nothing. **7 seconds:** after speech, 7 s of silence sends the turn automatically; if nothing is said for 7 s, the assistant says "I didn't hear anything. Press the space bar when you want to talk." Max 30 s per turn. States: `idle`, `ready`, `listening`, `processing`, `speaking`.
2b. Older text kept for reference: pressing **Start conversation** first checks the limits (`GET /api/limit`), then asks for the microphone, plays a start tone and speaks the greeting, which says it is an AI (EU AI Act Art. 50). The very first time, a short privacy notice is spoken before it.
3. The browser listens with its own voice-activity detection (`public/capture-worklet.js` + `app.js`): low sensitivity start (~200 ms of voice), end after ~800 ms of silence, 300 ms of audio kept before speech. The mic is ignored for 1.5 s after any key/focus/click/pointer event, 1 s after the window regains focus, and 4 s after an error alert (screen-reader protection, §5.3).
4. Each finished utterance is sent as 16 kHz WAV to `POST /api/transcribe` → Groq Whisper (`whisper-large-v3-turbo`), with known Whisper "silence hallucinations" filtered out.
5. The text goes to `POST /api/chat` (answer streamed as lines of JSON: `{"type":"searching"}` lets the browser say "Let me look that up" while it searches, then `{"type":"reply"}`) → Groq `openai/gpt-oss-120b` with two tools: `web_search` (Tavily basic search; after `DAILY_TAVILY_SEARCHES` per day, or if Tavily fails, falls back to Groq `groq/compound`) and `end_conversation`. The system prompt follows §7.5. Replies are cleaned of markdown/links for speech.
6. The reply is spoken sentence by sentence. **English:** natural AI voice from Groq (`canopylabs/orpheus-v1-english`, voice `hannah`) via `POST /api/speak`, played through Web Audio in the page, next sentence fetched while the current one plays. **Other languages, or if the AI voice fails:** the most natural voice on the device (ranking prefers "Natural/Neural" Edge voices, Apple premium/Siri voices, Google voices; avoids eSpeak/compact). The mic is closed while it speaks (**turn-taking mode is always on**, §5.7); a soft tone means "your turn". **Button or space bar** (the space bar also works when focus is elsewhere on the page, unless it is on another control): while the AI speaks it interrupts it and gives the turn to the user (that turn then allows pauses of up to 3 s); while the user is speaking (or right after interrupting) it means "I've finished" and sends what was said at once; a press within 5 s after a turn was sent automatically is ignored; any other press ends the conversation. The greeting, the help line and the accessibility statement explain this in all six languages. Saying goodbye/stop in any of the six languages also ends it (client check + model tool).
7. At the end, `POST /api/summary` (Groq `openai/gpt-oss-20b`) makes a short summary that is saved only in `localStorage` (last 10). "Continue last conversation" and the "My past conversations" page (`/history`, one `<h2>` per conversation, "Delete all my history") appear once history exists.
8. A failed turn (network, sleeping server, busy AI) is not fatal: the assistant says "Sorry, something went wrong, could you say that again?" and listens again; after 3 failures in a row the conversation ends with "Connection lost". Daily limit, no microphone and unsupported browser end it at once. These end-of-conversation errors are spoken once through the single empty `role="alert"` region.
8b. Device fixes: on iPhone/iPad the mic is released while the assistant speaks (otherwise iOS plays through the earpiece); Firefox gets an audio context matching the mic's sample rate; iOS "interrupted" audio is resumed.

9. **Limits** (`limits.js`) are decided only on the server from environment variables; the browser can't change them. Every API call is charged before any AI provider is called: speech minutes (from the exact length of the 16 kHz WAV, which must be valid), requests per day, and requests per minute, each per visitor (anonymous ID + address), per address (IP; IPv6 counted per /64) and for the whole site. The request that would cross a limit is refused (and costs nothing); once any limit is reached, every call, including starting a conversation (`GET /api/limit`), is refused until the next day (UTC), and the page says "Today's free limit is used up". Tavily searches are capped per day and per month. Groq's own free-tier limit also shows the same message. Counters are stored in Redis / Render Key Value when `REDIS_URL` is set (they survive restarts; if the store is down, every request is refused). Without `REDIS_URL`, they are kept in memory and **reset whenever the server restarts** (on Render's free plan that happens after 15 minutes without visitors).
10. EU law: AI disclosure in the greeting; privacy notice (`/privacy`) and accessibility statement (`/accessibility`, WCAG 2.2 AA / EN 301 549 target) in all six languages, linked from the page footer and generated from `legal.js`; no cookies or tracking; IP addresses only stored as keyed hashes (`LIMITS_SECRET`) in the usage counters, deleted after ~1 day; no recordings or transcripts kept on the server. The privacy notice relies on consent (GDPR Art. 9(2)(a)) because use of the service can reveal health information. **A person who knows EU law must still review `legal.js` before public launch**, and `OWNER_NAME` / `OWNER_EMAIL` must be set.
11. Security: security headers (CSP, no framing, mic only for this site), no stack traces shown to visitors, no CORS, dependencies audited (`npm audit`: 0 vulnerabilities as of 2026-10-10). There is no database of user data, so there are no rows to protect; the only stored data is the usage counters.

12. **Owner statistics** (`stats.js`, `public/stats.js`): a separate silent script on the main and history pages sends a beacon with only the anonymous ID when the page is opened (`stat_visits`) and whenever any button is pressed (`stat_presses`); each table stores only `anon_id` and `ts`. The server answers beacons at once and writes in batches every 3 s; if `DATABASE_URL` is missing or the database is down, events are dropped and the site is unaffected. Records older than 30 Europe/Zurich calendar days are deleted hourly. `/stats` (HTTP Basic auth, any user name, password = `STATS_PASSWORD`; 404 if the variable is unset) shows today, the last 7 days, the last 30 days and a 30-day table (date, unique users = distinct IDs that opened the site or pressed a button that day, conversations = button presses). A "Generate visitors (for testing)" form adds a chosen number of made-up visitors (default 317, which is then exactly the 30-day unique total) spread over the last 30 days, 7:00–23:00 Zurich time: daily numbers grow about four- to fivefold over the month, dip at weekends and vary from day to day; conversations per visitor are realistic and varied (log-normal, median about 3, a few heavy users; busier visitors return on more days, after their first visit). Form posts are checked with `Sec-Fetch-Site` (or `Origin` when present). They are deliberately **not** marked as test data (owner's choice). "Delete all statistics" empties both tables.

Files: `server.js` (Express: pages, API, start-up check that logs whether the Groq key and models work), `limits.js` (limits and counters), `legal.js` (privacy notice and accessibility statement texts), `public/i18n.js` (all text in en/it/fr/bg/ru/zh, shared by server and browser), `public/app.js`, `public/capture-worklet.js`, `public/history.html` + `public/history.js`, `public/style.css`, `test/server.test.js` (`npm test`).

Environment variables on Render:
- Required: `GROQ_API_KEY`, `TAVILY_API_KEY`.
- Required for the privacy notice: `OWNER_NAME`, `OWNER_EMAIL`.
- Statistics: `DATABASE_URL` (Render Postgres internal URL), `STATS_PASSWORD`. Optional `DATABASE_SSL=off`.
- Strongly recommended: `REDIS_URL` (internal URL of a Render Key Value instance) so limits survive restarts.
- Optional limits: `DAILY_MINUTES_PER_USER` (60), `DAILY_MINUTES_PER_IP` (60), `DAILY_MINUTES_GLOBAL` (600), `DAILY_REQUESTS_PER_USER` (600), `DAILY_REQUESTS_PER_IP` (600), `DAILY_REQUESTS_GLOBAL` (6000), `REQUESTS_PER_MINUTE_PER_IP` (30), `DAILY_TAVILY_SEARCHES` (30), `MONTHLY_TAVILY_SEARCHES` (950).
- Optional models: `GROQ_CHAT_MODEL`, `GROQ_SUMMARY_MODEL`, `GROQ_STT_MODEL`, `GROQ_SEARCH_MODEL`, `GROQ_TTS_MODEL`, `GROQ_TTS_VOICE` (Orpheus English voices: autumn, diana, hannah, austin, daniel, troy), `GROQ_TTS=off` to always use the device voice.
- Optional: `LIMITS_SECRET` (key for hashing addresses; defaults to the Groq key).
- Test only: `GROQ_BASE_URL`, `TAVILY_BASE_URL` (point the server at stand-in services).
- `GEMINI_API_KEY` is not used (the owner's Gemini project is restricted to paid use).
- Known limit: the free Render Postgres used for statistics expires 30 days after it is created and is deleted 14 days later; the owner must create a new one and update `DATABASE_URL` each month, or statistics stop being saved (the site keeps working).
- Known gap: the privacy notice (`legal.js`) does not mention the statistics; the owner chose to leave it unchanged.
- Known limit: people who share one internet address (a family, a school, an association) share the per-address limits; raise `DAILY_MINUTES_PER_IP` / `DAILY_REQUESTS_PER_IP` if that becomes a problem. The visitor's address is read from Cloudflare's `CF-Connecting-IP` header (Render is behind Cloudflare); check this on the live site if per-address limits behave oddly.

Deviations from this brief (decided with the owner, see §13):
- **No Gemini Live** (§5.4–5.6, §7.1, §7.3 ephemeral tokens, §7.4 session resumption): voice in = Groq Whisper, voice out = Groq Orpheus (English only) or the device voice. No free, official natural AI voice covers Italian, French, Bulgarian, Russian and Chinese, so those depend on the device (Edge on Windows, iPhone and Android have natural voices for all six). Answers take a few seconds, and interrupting by voice is not possible — only by pressing the button.
- The mic is always closed while the AI speaks (turn-taking mode), because device voices are not played through the page and echo cancellation can't remove them.
- Not yet tested with real JAWS/NVDA/VoiceOver or on real laptop speakers (§10 still to do).

### Change log (add an entry after every push to `main`)

| Date | Change | Files |
|---|---|---|
| 2026-10-10 | Added this brief and the agent rules (§0). No app code changed. | `docs/talk-with-ai-brief.md`, `CLAUDE.md`, `AGENTS.md` |
| 2026-10-10 | Screen-reader fit: Talk button focused on load with the help as its description (removed during a conversation); End conversation button during a conversation (focus returns to Talk when it hides); Escape ends; phone/tablet wording ("press the Talk button") in 6 languages; Android vibration when recording starts/stops; forced-colors styles; accessibility statement explains keeping the cursor on the Talk button; §4.3b documents the screen-reader facts. | `public/index.html`, `public/app.js`, `public/i18n.js`, `public/style.css`, `legal.js`, this brief |
| 2026-10-10 | Push-to-talk: first conversation asks for the language by voice (auto-detected transcription, page switches language); spoken instructions for space bar to start / stop talking; 7 s of silence sends the turn, 7 s with nothing said gives a spoken hint; button label "Talk" during a conversation; help line, greeting and accessibility statement rewritten in 6 languages. | `public/app.js`, `public/i18n.js`, `server.js`, `legal.js`, this brief |
| 2026-10-10 | Space bar / button to interrupt the assistant and again to finish speaking (longer pauses allowed in that turn), explained in greeting, help line and accessibility statement in 6 languages. Stats: fixed "Forbidden" when pressing the stats buttons (browsers send `Origin: null` with our no-referrer policy; now checked with `Sec-Fetch-Site`); generated visitors grow over the 30 days with weekend dips and daily variation. | `public/app.js`, `public/i18n.js`, `legal.js`, `stats.js`, `test/stats.test.js`, this brief |
| 2026-10-10 | Stats page: choose how many visitors to generate (default 317) with realistic varying conversations, "Delete all statistics" button, 30-day totals line. | `stats.js`, `public/style.css`, `test/stats.test.js`, this brief |
| 2026-10-10 | Private owner statistics: visit and button-press beacons (anonymous ID + timestamp only) stored in Render Postgres, 30-day retention, password-protected `/stats` page with today / 7 days / 30-day table in Europe/Zurich days, unmarked generated visitors for testing, tests in `test/stats.test.js` (run with `TEST_DATABASE_URL`). Conversation code and main page text unchanged. | `stats.js`, `public/stats.js`, `server.js`, `public/index.html`, `public/history.html`, `public/style.css`, `test/stats.test.js`, `package.json`, `package-lock.json`, this brief |
| 2026-10-10 | Conversation, voice, devices and EU law: natural English AI voice (Groq Orpheus) with sentence prefetching and device-voice fallback; better device-voice ranking; "Let me look that up" while searching (streamed chat); a failed turn asks the user to repeat instead of ending; warmer system prompt; iPhone, Firefox and iOS audio fixes; AI disclosure and first-time spoken privacy notice; privacy notice and accessibility statement pages in 6 languages; hashed IP addresses; server-side timeouts; start-up check of keys and models in the logs; end-to-end test against stand-in Groq/Tavily services. | `server.js`, `limits.js`, `legal.js`, `public/*`, `test/*`, this brief |
| 2026-10-10 | Security and limits: fixed 4 dependency vulnerabilities (`npm audit fix`), added strict server-side limits in `limits.js` (per visitor, per address, global, per minute; refused requests cost nothing; everything blocks once a limit is reached; fail closed), optional Redis/Key Value storage for counters, strict WAV validation, Tavily daily+monthly caps, security headers, JSON-only error handler, limit check before a conversation starts, tests in `test/limits.test.js`. | `limits.js`, `server.js`, `public/app.js`, `test/limits.test.js`, `package.json`, `package-lock.json`, this brief |
| 2026-10-10 | Replaced the Italian-only prototype with the full app: 6 languages, one-button voice conversation, Groq Whisper + Groq gpt-oss + Tavily search (Groq Compound fallback), browser voice, turn-taking, screen-reader mute gate, goodbye detection, on-device history page, daily limits, tests. Removed `index.html` at root and the unused `openai`/`cors` dependencies. | `server.js`, `public/*`, `test/server.test.js`, `package.json`, `package-lock.json`, this brief |

---

## 13. User preferences (newest first; these override the rest of the brief)

| Date | Preference |
|---|---|
| 2026-10-10 | Every part of the site must fit how **all** screen readers work (JAWS, NVDA, Narrator, VoiceOver, TalkBack, Orca), with **zero friction**. |
| 2026-10-10 | **Conversation design (replaces earlier turn-taking):** first ask "say your language"; then tell the user to press **space to start talking and space again to stop and get the AI's answer** – "that's all"; if the user is silent for **more than 7 seconds**, the AI answers automatically. |
| 2026-10-10 | Users can always interrupt the assistant with the **space bar** and press it **again when they have finished speaking**. Generated statistics must **vary and grow across the days**, with the requested **total over the 30 days**. |
| 2026-10-10 | Statistics: store in **Render's free Postgres** (accepting the 30-day expiry); a **unique user** = a device that opened the website, a **conversation** = any button press; keep raw records **30 days**; **do not** change the privacy notice; generated test visitors must be stored as **ordinary data, not marked as test data**. Stats must never affect the conversation or anything a screen reader hears. |
| 2026-10-10 | Wants a **nice natural voice**, support for **every kind of assistive technology** (all screen readers and devices), compliance with **EU law**, and above all that it **actually works**. |
| 2026-10-10 | Limits **must** always be enforced: once a limit is reached, everything is blocked, and visitors must not be able to change or get around the limits. Fix security vulnerabilities when found. |
| 2026-10-10 | Build with what is available for free now: **Groq key + Tavily key**. Gemini is not used because the owner's Google AI Studio project says "API access is restricted, set up billing"; the owner does not want to pay. Gemini Live can be added later as the main voice mode if a working free key is obtained. |
| 2026-10-10 | All changes are pushed to `main` (the owner asked for this). |
| 2026-10-10 | The brief must live in the repo, be readable by any AI agent, and be updated after every push to `main` with code changes and any changes in user preference. |
