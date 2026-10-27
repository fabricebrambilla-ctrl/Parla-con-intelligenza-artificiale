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
   - At most three footer links: About the project, Privacy notice and Accessibility. The separate About page carries the creator story and public contact details so the voice screen stays short.
4. If the user presses "Change language", show a list of 6 buttons, **each written in its own language** with its own `lang` attribute: `English`, `Italiano`, `Français`, `Български`, `Русский`, `中文`. Pressing one reloads the text in that language, saves the choice, and moves focus back to "Start conversation".
5. Language choice is saved in `localStorage` so returning users skip this.

### 2.2 Starting a conversation

1. User presses "Start conversation" (Enter or Space).
2. **First time only**, the browser asks for microphone permission. This is a browser dialog; both JAWS and NVDA read it. Do not add our own pop-up before it.
3. A short, soft **start sound** (earcon) plays, then the AI greets in the chosen language, e.g. *"Hi, I'm listening. Ask me anything. When you're done, just say goodbye."*
4. The same button **stays focused** and changes its label to "End conversation". The microphone-permission explanation is the exception: it receives focus immediately before a permission request, then returns focus to Talk when it clears if the user has not moved elsewhere. Do not open new panels. See the current push-to-talk behavior in §12 for the current button labels.
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

> **Replaced on 2026-10-24:** conversations are never saved; there is no history, summary or "Continue last conversation" (see §12 item 7 and §13). The text below is kept for reference only.

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

> **Owner override (2026-10-11):** the screen-reader rules in this section were written without first-hand knowledge of how JAWS and NVDA work. Agents must **not** follow them blindly: decide from how the screen readers really behave, adapt the site to them, and tell users the exact screen-reader command where one is needed.

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
- Users must keep the reading cursor on the Talk button for Space to work; the accessibility statement says so. Focus normally stays there. The microphone-permission explanation temporarily receives focus before the browser prompt and restores Talk afterward if it still owns page focus; changing language also moves focus as documented below.
- VoiceOver on iPhone and TalkBack on Android activate the button with a double tap (a click); there is no space bar, so phones and tablets (`pointer: coarse` and no fine pointer) get "press the Talk button" wording.
- **`autofocus` on the Talk button**: W3C notes autofocus overrides reading from the top, and NVDA's developers consider that the intended effect. For this single-purpose page it means the screen reader announces the title and "Start conversation, button" plus its description (`aria-describedby` = the help text), and Space works immediately. The description is removed during a conversation so returning to the button stays short.
- The End conversation button appears right after Talk during a conversation; when it disappears and had focus, focus goes back to Talk (never left on a hidden element). Escape also ends a conversation when the screen reader lets it through.
- Windows High Contrast (`forced-colors`) keeps button borders and the focus outline visible.
- The visible help text is `aria-hidden` (it is already the Talk button's description, so it isn't read twice), and there is no whitespace text node between the help and privacy spans (VoiceOver on iPhone stopped on an empty " " item).
- The Talk button's label changes from "Start conversation" to "Talk" only when the assistant first waits for the user, so the screen reader's "Talk, button" comes right after the instructions, as the cue to press it, instead of talking over the greeting. Screen readers stop their own speech when a key is pressed, so pressing Space at once is safe.
- Simulated walk-through (2026-10-10, Chromium accessibility tree; NVDA = accessibility "invoke" click, JAWS = simulated mouse click, VoiceOver iPhone = swipe order + tap; controllable fake microphone; stand-in Groq/Tavily/Fish services): language question skipped with Space, answer by voice, ask, send with Space, interrupt with Space, auto-send 7.0–7.1 s after silence, hint after 7 s with nothing said, "goodbye" ends and focus returns to Start — passed for all three. Real screen-reader testing (§10) is still required.

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
- The microphone-permission explanation is programmatically focusable and has no live-region role or attributes. It receives focus synchronously before `getUserMedia`, avoiding a second live-region announcement of the same text. Actual JAWS/NVDA speech behavior still requires a real-reader retest.

### 4.6 Focus

- Never move focus without the user asking. After changing language, put focus back on "Start conversation". Starting a conversation may focus the microphone-permission explanation immediately before the browser request. When it clears, return to Talk only if the explanation still owns focus. Do not pull focus from browser controls, another app, a user-selected control or a newer session.
- Do not use modals, dialogs, overlays, or "toast" pop-ups.
- Visible focus outline (thick, high contrast) for low-vision users.

### 4.7 Language and the `lang` attribute

- **JAWS** can switch its speech voice automatically based on the `lang` attribute.
- **NVDA** has "Automatic language switching (when supported)" in its speech settings; it works when the user's voice/synthesizer has that language installed (NVDA's built-in eSpeak NG voice covers all six target languages).
- If `lang` is wrong, the screen reader reads Italian text with an English voice and it becomes nonsense.
- Set `<html lang="it">` (etc.) to match the displayed language. Use simple codes: `en`, `it`, `fr`, `bg`, `ru`, `zh-Hans` (for Chinese, also test plain `zh` — older readers can mishandle region/script subtags).
- In the language list, each language name must carry its own `lang` (e.g. `<button lang="ru">Русский</button>`).

### 4.8 Other things that make blind users leave

- Cookie consent banners (a whole popup to navigate before anything works). Avoid by **not using tracking/analytics cookies at all**; only keep browser preferences needed for the chosen language and short introduction. The former anonymous ID/history design is replaced by the 2026-10-26 privacy decision. Have a human check the EU ePrivacy/GDPR position before launch.
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

- In the system prompt (§7.5), describe the interface rather than assuming a disability: *"This interface is designed for spoken replies and screen-reader access. Do not infer the user's health, disability, age or other personal attributes from their use of this service. You may sometimes hear a fast synthetic voice reading interface words such as 'button', 'heading level 1', 'browse mode', 'focus mode', 'link', or page text. That is the screen reader, not the user. Ignore it completely and do not reply to it. Also ignore your own voice if you hear it echoed."*
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
- 2026-10-27: the voice page uses a restrained blue-and-white surface, clearer spacing and high-contrast native controls, with a matching dark theme. System fonts only; no external font requests. The About page uses the owner's original 130 by 130 portrait, a readable profile/story layout and native contact links. Keep the Talk button's stable position in the reading order, label and focus behavior.

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
- Text chat box, file upload, images on the main voice screen, settings pages, menus, footers with many links. The owner's portrait on the separate About page is an approved exception (2026-10-27).
- Analytics/tracking cookies.
- Any requirement for headphones or screen reader setting changes.

---

## 12. Current state of the code and change log

### Current state of the code (keep this up to date)

- 2026-10-27, latest owner edit: remove the entire About pilot/trial/feedback section in all six languages, including the public UICI Teramo reference. Keep the creator story, portrait, mission and contact section. The internally confirmed pilot is not withdrawn by this copy change. Do not restore a logo or pilot section merely because an earlier permission request receives a response.

- 2026-10-27 release preparation: the integrated About, privacy-prompt and daily-question-counter code passed the full local suite twice: 97 tests, 96 passed, one optional Redis integration skipped and zero failures per run. Evidence: `/tmp/fabrice-app-20261027-full-1-authorized.log` and `/tmp/fabrice-app-20261027-full-2.log`. Subsequent changes correct documentation only, including the confirmed age of 17, original portrait and aggregate-question scope. Provider contracts, sensitive-data handling, transfer safeguards and real assistive-technology testing remain unresolved. Copy-back is a local release-preparation step; no deployment or push is included.
- 2026-10-27: activity statistics now keep only a Zurich calendar date, page-opening total and valid voice-question submission total for seven days. Valid `/api/chat` submissions count once after validation, even when the answer later fails; flagged synthetic/QA traffic and the separate text API do not contribute to the question total. Repeated submissions and unflagged automation may still count, so this does not identify unique or verified humans or count successful answers. Question totals start with this update; no historical questions are reconstructed. Six-language privacy text and the private counter describe these limits. Counter-focused local checks passed twice (23 per run); the integrated full suite also passed twice with 97 tests, 96 passed and one optional Redis integration skipped per run. `LEGAL.UPDATED` is 2026-10-27 for the material privacy update.
- 2026-10-27: a six-language, server-rendered `/about?lang=...` page identifies Fabrice Brambilla, 17, a high school student in Switzerland who wants to study engineering. It explains the project through his aunt's experience using JAWS and gives the owner-approved email and phone contact. The original trial/feedback section and Teramo link were removed later the same day at the owner's request. No partnership/endorsement claim or logo is used. The original local 130 by 130 portrait is unchanged; inspection found no EXIF chunk. Home has exactly three footer links and a clearer blue-and-white visual surface. Allowlisted URL language now takes precedence over saved/browser preferences, preserving language on return from About/legal pages. CUA-only Chrome checks passed for 36 layout/language cases (all six languages, home/About at 320 and 1280 CSS pixels, plus doubled text at 320), with no horizontal or button-content overflow. Keyboard checks confirmed language-list focus/return, native link Space/Enter and About return-language behavior. Focused Node suite: 42 passed, zero failures. The integrated full suite passed twice with 97 tests, 96 passed and one optional Redis integration skipped per run; real JAWS/NVDA/VoiceOver retests remain pending.
- 2026-10-27: the outbound Groq system prompt describes spoken/screen-reader interface requirements rather than asserting that every caller has a disability, and instructs the model not to infer personal attributes from service use. Mock tests inspect both voice and text-API payloads and preserve a person's own relevant words. This is a data-minimisation improvement, not proof of a lawful basis for sensitive content or contractual eligibility. Fabrice's confirmed age of 17 supersedes the earlier age-18/adult conclusion; actual account/provider agreement review remains open. Groq is still the provider; an OpenAI model name hosted by Groq is not an OpenAI API migration.
- 2026-10-26: the microphone-permission explanation receives direct focus synchronously before the browser request when page focus is available. It is outside the Tab order and has a visible focus outline; its former live-region role is removed to avoid duplicate announcements. Grant, denial and cancellation clear it and restore Talk only if it still owns focus. Window-return restoration is guarded by both request and session; no delayed focus move can interrupt the browser prompt or a newer session. Local mock regression coverage passes twice (77 passed, one optional Redis integration skipped per run). Real JAWS/NVDA and physical permission-prompt retests remain pending; this is not a claim that the explanation has been heard in those programs.
- 2026-10-26: narrow layouts and 200% text now wrap long content without horizontal overflow; the Talk button grows to contain enlarged labels, and the light keyboard-focus outline has improved contrast. All six languages were checked across phone, landscape, tablet and desktop viewport sizes. See `docs/responsive-accessibility-checks.md` for executed checks and real screen-reader testing still pending.
- 2026-10-26: the synthetic runner can carry never-started visits from expired plans into a fresh eight-hour schedule with `--carry-unstarted`. Old UUIDs/questions and journals are preserved, completed/partial/uncertain visits are excluded, and current request times and the same rolling budget remain authoritative. Combining cohorts does not create more budget or guarantee every queued visit finishes.
- 2026-10-26: privacy review changes replace persistent visitor analytics with aggregate page openings, shorten the spoken introduction to a single AI identity statement, deliver privacy information before microphone access, and identify Fabrice Brambilla in Switzerland as operator. Groq inference zero data retention was enabled in the account with explicit owner approval. These changes are technical/privacy improvements, not a certification of worldwide compliance. See `docs/privacy-security-checklist.md`.
- 2026-10-26: API responses are no-store, empty voice-chat payloads are rejected before paid dispatch, agent expiry is enforced on access and periodically, a fully busy chat store returns 503, external Postgres connections verify TLS certificates, counter resets require a CSRF token, and application logs omit raw upstream error text.

- 2026-10-25: daily QA visits now sample 1–5 exchanges independently and uniformly (20% each), allowing repeats. The mean remains three, so the 40-identity planning estimate is unchanged; hard budgets still stop requests. Safe `--resume` keeps the original deadline, IDs, journal and budget, skips previously started visits, and replans only unstarted counts.
- 2026-10-25: opt-in synthetic QA budget envelopes and safe per-provider accounting for the eight-hour tester. `/api/qa` describes the guard; labelled requests carrying `X-QA-Budget` bound hidden model/search/audio calls and expose measured usage (or conservative reserved allowances when unknown). Normal visitors keep existing behavior and no new general quotas. QA stops on provider 429, disables unbudgeted research fallback, and never requires API credentials in the client.

- 2026-10-24 Render advisory follow-up: pin native Node runtime to 24.22.1 with `.node-version` and patched 24.x engines; upgrade locked body-parser 2.3.0 to 2.4.0 (compatible qs/iconv-lite patches). npm audit reports zero vulnerabilities after update. See Render eMudhra advisory and Node October 21 security release.

- Julian feedback (2026-10-24, focus follow-up 2026-10-26): localized microphone-permission explanation and blocked-permission recovery; the explanation now receives direct focus rather than a live-region update. Pending requests are cancelled safely on end/restart. Dedicated Alt+Shift+T operates Talk from other page controls when delivered by browser/screen reader; ordinary link keyboard behavior stays native. Automated regression coverage; real NVDA/JAWS retest is still pending.

As of 2026-10-10 the app is a full first version built with **Groq + Tavily** (Gemini Live is not used yet, see "Deviations" below).

How a conversation works:
1. The page (`public/index.html`) is rendered by the server in the visitor's language (an allowlisted `?lang=...` takes precedence over `Accept-Language`). `public/app.js` keeps an allowlisted URL language first, then the language saved in `localStorage`, then browser language. `/about` is rendered in all six languages without client scripts; its return/privacy/accessibility links preserve that language.
2. **Push-to-talk (updated 2026-10-26):** Start checks `/api/limit`, speaks a single short AI identity disclosure and, once per privacy-notice version, the cloud-processing/sensitive-information notice. Only then does it request microphone access and offer first-use spoken language selection. The following short greeting explains Space/button to talk and send, interruption, goodbye and help, without repeating AI. Return visits use shorter controls. No transcript is displayed. Button/Space starts or sends an utterance and interrupts playback. Seven seconds of post-speech silence sends automatically; no speech for seven seconds gives a hint. Maximum audio turn remains 30 seconds. Detailed controls remain in help and the accessibility statement.
2c. **Voice commands (2026-10-11):** besides goodbye and language changes, the whole request (polite words aside) can be "repeat" (says the last reply or greeting again) or "help" (lists what you can say). All six languages; exact phrase lists in `COMMANDS` in `public/app.js`; commands are not sent to the AI. The short greeting points to goodbye/help; language commands remain available without repeating the AI identity. The accessibility statement has "Things you can say" and "Commands for your screen reader" sections (lists: NVDA, JAWS, Narrator, VoiceOver Mac, VoiceOver iOS, TalkBack, Orca, with the real keys: Space/Enter work in browse mode / virtual cursor / scan mode, B and Shift+B jump between buttons, Control silences speech, Escape ends); a section's text may now be an array, rendered as a list. **No speaking-speed control** (removed at the owner's request).
2b. **Changing language (2026-10-11):** at any time in a conversation the user can say a short request (at most 8 words) such as "speak Italian", "parla inglese", "говори по-русски", "说英语": a switch verb plus a language name as the last word (polite words like "please" ignored), so "talk about Italian food" or "how do you say hello in Italian?" still go to the assistant. Speech recognition, voice, page and the AI's replies switch at once and the assistant confirms in the new language (`langChanged`). "Change language" (no language named, all six languages) asks the spoken language question again. The command is not added to the conversation sent to the AI. The first-time greeting ends with "To change language, just say so." The Language button now moves focus onto the current language in the list (a labelled group, current one marked `aria-current`); Escape closes it and returns to the button. No single-letter shortcut (screen readers swallow letters, §4.3).
2b. Historical text, replaced by the 2026-10-26 onboarding above: pressing **Start conversation** first checks the limits (`GET /api/limit`), then asks for the microphone, plays a start tone and speaks the greeting, which says it is an AI (EU AI Act Art. 50). The very first time, a short privacy notice is spoken before it.
3. The browser listens with its own voice-activity detection (`public/capture-worklet.js` + `app.js`): low sensitivity start (~200 ms of voice), end after ~800 ms of silence, 300 ms of audio kept before speech. The mic is ignored for 1.5 s after any key/focus/click/pointer event, 1 s after the window regains focus, and 4 s after an error alert (screen-reader protection, §5.3).
4. Each finished utterance is sent as 16 kHz WAV to `POST /api/transcribe` → Groq Whisper (`whisper-large-v3-turbo`), with known Whisper "silence hallucinations" filtered out.
5. The text goes to `POST /api/chat` (answer streamed as lines of JSON: `{"type":"searching"}` lets the browser say "Let me look that up" while it searches, then `{"type":"reply"}`) → Groq `openai/gpt-oss-120b` with two tools: `web_search` (Tavily basic search; if Tavily is unavailable, an explicitly configured, non-retired `GROQ_SEARCH_MODEL` may be used; the retired Compound IDs are never called, and without a usable search service the assistant states that it could not search) and `end_conversation`. The system prompt follows §7.5. Replies are cleaned of markdown/links for speech.
6. **Voice (updated):** if `FISH_API_KEY` is set, **all six languages** use Fish Audio's natural AI voice (`POST https://api.fish.audio/v1/tts`, header `model: s2.1-pro-free` = free developer model, MP3; optional voice per language `FISH_VOICE_EN` … `FISH_VOICE_ZH` or `FISH_VOICE` for all, IDs from the Fish Audio voice library). If Fish fails: English → Groq Orpheus, others → device voice. The device-voice ranking now also prefers known natural voices by name (Edge Elsa/Denise/Kalina/Svetlana/Xiaoxiao/Aria…, Apple Alice/Amélie/Daria/Milena/Tingting…, Google voices) and avoids old "Desktop" voices.
6b. Earlier description: the reply is spoken sentence by sentence. **English:** natural AI voice from Groq (`canopylabs/orpheus-v1-english`, voice `hannah`) via `POST /api/speak`, played through Web Audio in the page, next sentence fetched while the current one plays. **Other languages, or if the AI voice fails:** the most natural voice on the device (ranking prefers "Natural/Neural" Edge voices, Apple premium/Siri voices, Google voices; avoids eSpeak/compact). The mic is closed while it speaks (**turn-taking mode is always on**, §5.7); a soft tone means "your turn". **Button or space bar** (the space bar also works when focus is elsewhere on the page, unless it is on another control): while the AI speaks it interrupts it and gives the turn to the user (that turn then allows pauses of up to 3 s); while the user is speaking (or right after interrupting) it means "I've finished" and sends what was said at once; a press within 5 s after a turn was sent automatically is ignored; any other press ends the conversation. The greeting, the help line and the accessibility statement explain this in all six languages. Saying goodbye/stop in any of the six languages also ends it (client check + model tool).
7. **No saved voice history (updated 2026-10-26):** the voice page does not write audio or conversation text to browser storage or the application database, and ending a conversation clears its text from page memory. There is no summary or Continue feature. Old local history is removed on page load. The separate text API retains temporary chats in server memory for up to about 24 hours of inactivity; this and provider processing are disclosed, so do not claim that no conversation data is ever held anywhere.
8. A failed turn (network, sleeping server, busy AI) is not fatal: the assistant says "Sorry, something went wrong, could you say that again?" and listens again; after 3 failures in a row the conversation ends with "Connection lost". Daily limit, no microphone and unsupported browser end it at once. These end-of-conversation errors are spoken once through the single empty `role="alert"` region.
8b. Device fixes: on iPhone/iPad the mic is released while the assistant speaks (otherwise iOS plays through the earpiece); Firefox gets an audio context matching the mic's sample rate; iOS "interrupted" audio is resumed.

9. **Limits (changed 2026-10-24, owner's decision): none of the site's own limits apply by default.** Only the providers' limits do: Groq free tier (per model: gpt-oss-120b and gpt-oss-20b 30 requests and 8,000 tokens a minute, 1,000 requests and 200,000 tokens a day; whisper-large-v3-turbo 20 requests a minute, 2,000 requests and 8 hours of audio a day; limits are per Groq organization), Tavily's free credits, Fish Audio's unpublished limits. A Groq daily limit gives "The AI has reached its free limit for today"; a per-minute limit on gpt-oss-120b falls back to gpt-oss-20b. **Known risk accepted by the owner:** one heavy user or bot can use up the whole day's Groq quota for everyone. Every own limit still exists in `limits.js` and is switched on only by setting its variable on Render (see "Optional limits" below; an unset variable = no limit): speech minutes and requests per visitor / per address / whole site, requests per minute per address, Tavily searches per day / month, agent messages (all agents / per address; `AGENT_DAILY_MESSAGES=0` turns the agent API off), new devices counted in the statistics per address. When any are on, counting works as before (charged before calling a provider, refused request costs nothing, blocked until the next UTC day, Redis via `REDIS_URL`, fail closed). Kept because they protect the server itself, not usage: agent API 200 chats in memory, 60 messages per chat, 4,000 characters per message; audio files about 34 s maximum; request body sizes.
10. Privacy and accessibility (2026-10-26): a short AI identity disclosure and the versioned first-layer cloud-processing notice are spoken before microphone access, including before the first language recording. The following greeting contains only brief controls, with detailed rules in help. The six-language `/privacy` notice (`privacy-notice.js`, rendered through `legal.js`) identifies the confirmed Swiss operator, cloud providers, known destinations, aggregate counter, API RAM storage, browser preferences, sensitive-data warning and rights contact. A button press or microphone permission is explicitly not blanket Article 9 consent. Ordinary-service/security lawful bases and international transfers still need qualified review. Accessibility targets remain WCAG 2.2 AA / EN 301 549; automated checks are not real JAWS/NVDA/VoiceOver certification.
11. Security (2026-10-26): strict security headers, same-origin APIs, no public stack traces, no API-response caching, malformed/empty voice-chat rejection before provider dispatch, and sanitized error logs. API chats have real expiry/capacity enforcement. External Postgres uses certificate verification unless an operator explicitly disables TLS or uses an internal/local host; URL parameters cannot silently override verification. The private counter uses Basic auth and a per-process CSRF token for reset. Production dependency audit found zero reported vulnerabilities on 2026-10-25; this is not proof of complete security.

12. **Daily aggregate activity only (updated 2026-10-27):** `stats.js` increments page openings for successful GET requests to the main page and separately counts valid voice-question submissions once after `/api/chat` input validation. A question can count even if its answer fails; provider/tool retries do not add counts. Flagged synthetic/QA requests and the separate text API are excluded from questions. The Postgres table is `stat_daily_visits(day date PRIMARY KEY, visits bigint, questions_submitted bigint)`, kept for the last seven Europe/Zurich calendar days. There are no persistent browser visitor IDs, individual event timestamps, IPs, question text, audio, conversation counts or agent identity statistics in these aggregates. Initialization removes the former identifier tables; the new question column defaults to zero and does not reconstruct historical questions. Repeated submissions and unflagged automation can contribute, so neither aggregate identifies unique or verified human users. No client beacon is loaded; the old `POST /api/stats/visit` is a compatibility no-op. `/stats` remains a minimal private Today/Last seven days display; password required, no-store, CSRF-protected reset. Without a database it is in-memory and clearly says so; database outages leave the public voice service working. There is no generator or claim to distinguish all human visitors.

12b. **Each reply is spoken by a voice of its own language (2026-10-24):** `/api/chat` also returns `lang`, the language the reply is actually written in (`I18N.detectLang` in `public/i18n.js`: Chinese characters, Russian- or Bulgarian-only letters, then common words; short or mixed replies keep the conversation's language, so a French answer quoting an English title stays French). The browser speaks the reply (and "repeat") in that language: Fish voice for that language (`FISH_VOICE_<LANG>`), else the device's voice for that language. The page language, speech recognition and the AI's default reply language do not change; only the voice follows the reply.

12c. **Voices (2026-10-24):** Groq Orpheus is off unless `GROQ_TTS=on`. So: Fish Audio voice for all six languages when `FISH_API_KEY` is set, otherwise the device's voice. This removes the `model_terms_required` errors from the Groq logs.

12d. **Rate-limit fallback (2026-10-24):** when Groq refuses the chat model (`openai/gpt-oss-120b`) with a 429 rate limit (per minute or per day), the same answer is asked of `GROQ_FALLBACK_MODEL` (default `openai/gpt-oss-20b`), which has its own separate Groq limits. Applies to the voice site and the agent API (shared `runChat()`). Groq limits are per organization, so extra API keys would not help.

13. **Hidden text API (`agent.js`, updated 2026-10-26):** `/api/agent` describes create/read/message/stop/delete routes. No key is required and it is absent from the voice UI, as requested. Chats are temporary server RAM, capped at 200 and 60 total messages per chat. Idle expiry is checked on every access and every minute; a fully busy store refuses new chats instead of exceeding capacity. The random chat ID is a bearer capability; never expose it. `agent_id` groups the caller's temporary chats only and is not counted as a visitor. Ordinary optional budgets remain off unless configured, preserving the owner's accepted quota-exhaustion risk. JSON replies disclose `ai_generated: true`; this metadata alone is not certified compliance with all synthetic-content marking duties.

Files: `server.js` (Express: pages, API, start-up check that logs whether the Groq key and models work), `about.js` (six-language creator/contact page), `agent.js` (hidden agent API), `limits.js` (limits and counters), `legal.js` (accessibility and legal-page exports), `privacy-notice.js` (privacy texts), `public/i18n.js` (all text in en/it/fr/bg/ru/zh, shared by server and browser), `public/app.js`, `public/capture-worklet.js`, `public/style.css`, `test/server.test.js` (`npm test`).

Environment variables on Render:
- Required: `GROQ_API_KEY`, `TAVILY_API_KEY`.
- Privacy contact: confirmed Fabrice Brambilla / brambillafabrice@gmail.com / Switzerland. `OWNER_NAME` and `OWNER_EMAIL` may override the renderer contact where appropriate; update the complete notice if the legal operator changes.
- Aggregate counter: `DATABASE_URL` (Render Postgres internal URL), `STATS_PASSWORD`. External database TLS verification is on by default; optional `DATABASE_SSL_CA` supplies a trusted CA. `DATABASE_SSL=off` is an explicit operator override, appropriate only where transport is otherwise protected.
- Strongly recommended: `REDIS_URL` (internal URL of a Render Key Value instance) so limits survive restarts.
- Optional limits, **all off unless set** (values the owner used before 2026-10-24 in brackets): `DAILY_MINUTES_PER_USER` (60), `DAILY_MINUTES_PER_IP` (60), `DAILY_MINUTES_GLOBAL` (600), `DAILY_REQUESTS_PER_USER` (1500), `DAILY_REQUESTS_PER_IP` (1500), `DAILY_REQUESTS_GLOBAL` (15000), `REQUESTS_PER_MINUTE_PER_IP` (60), `DAILY_TAVILY_SEARCHES` (30), `MONTHLY_TAVILY_SEARCHES` (950), `AGENT_DAILY_MESSAGES` (40), `AGENT_DAILY_MESSAGES_PER_IP` (20), `STATS_DEVICES_PER_IP` (10).
- Optional models: `GROQ_CHAT_MODEL`, `GROQ_FALLBACK_MODEL` (default `openai/gpt-oss-20b`, used when the chat model is rate-limited), `GROQ_SUMMARY_MODEL`, `GROQ_STT_MODEL`, `GROQ_SEARCH_MODEL` (optional research fallback, disabled unless set; `groq/compound` and `groq/compound-mini` are ignored because they were retired), `GROQ_TTS_MODEL`, `GROQ_TTS_VOICE` (Orpheus English voices: autumn, diana, hannah, austin, daniel, troy), `GROQ_TTS=on` to enable the Groq Orpheus English voice (**off by default since 2026-10-24**: the owner does not accept Orpheus's terms on Groq, which made every call fail with `model_terms_required`; if Groq refuses it, it is also switched off until the next restart).
- Natural voice in all languages: `FISH_API_KEY` (free account at fish.audio), optional `FISH_VOICE_EN`, `FISH_VOICE_IT`, `FISH_VOICE_FR`, `FISH_VOICE_BG`, `FISH_VOICE_RU`, `FISH_VOICE_ZH` or `FISH_VOICE`, `FISH_MODEL` (default `s2.1-pro-free`). Fish Audio's free-tier limits are not published; on any failure the next voice is used.
- Optional: `LIMITS_SECRET` (key for hashing addresses; defaults to the Groq key).
- Test only: `GROQ_BASE_URL`, `TAVILY_BASE_URL` (point the server at stand-in services).
- `GEMINI_API_KEY` is not used (the owner's Gemini project is restricted to paid use).
- Known limit: the free Render Postgres used for statistics expires 30 days after it is created and is deleted 14 days later; the owner must create a new one and update `DATABASE_URL` each month, or statistics stop being saved (the site keeps working).
- Legal review still needed: actual provider contract eligibility, DPAs and transfer grounds/country inventory, incidental sensitive information, children using the service, GDPR territorial/representative obligations and applicable AI Act marking duties. No account terms were accepted on the owner's behalf during this review.
- Known limit: people who share one internet address (a family, a school, an association) share the per-address limits; raise `DAILY_MINUTES_PER_IP` / `DAILY_REQUESTS_PER_IP` if that becomes a problem. The visitor's address is read from Cloudflare's `CF-Connecting-IP` header (Render is behind Cloudflare); check this on the live site if per-address limits behave oddly.

Deviations from this brief (decided with the owner, see §13):
- **No Gemini Live** (§5.4–5.6, §7.1, §7.3 ephemeral tokens, §7.4 session resumption): voice in = Groq Whisper, voice out = Groq Orpheus (English only) or the device voice. No free, official natural AI voice covers Italian, French, Bulgarian, Russian and Chinese, so those depend on the device (Edge on Windows, iPhone and Android have natural voices for all six). Answers take a few seconds, and interrupting by voice is not possible — only by pressing the button.
- The mic is always closed while the AI speaks (turn-taking mode), because device voices are not played through the page and echo cancellation can't remove them.
- Not yet tested with real JAWS/NVDA/VoiceOver or on real laptop speakers (§10 still to do).

### Change log (add an entry after every push to `main`)

| Date | Change | Files |
|---|---|---|
| 2026-10-27 | Remove the owner-selected About pilot/trial/feedback section and its six-language strings. Keep creator/mission/contact content. Adjust the existing About regression and document the superseding preference. | `about.js`, `test/server.test.js`, this brief |
| 2026-10-27 | Complete integrated regression verification twice (97 tests, 96 passed, one optional Redis skip and zero failures per run). Correct the privacy/security checklist and asset inventory for confirmed age 17, the owner-supplied original portrait and day-only submitted-question aggregates. Preserve open legal/provider and real-reader checks; prepare local copy-back without deploying or pushing. | Privacy/security checklist, `THIRD_PARTY_NOTICES.md`, this brief |
| 2026-10-27 | Add a day-only voice-question submission aggregate beside page openings, excluding labelled synthetic/QA traffic and the separate text API. Document that failures, repeats and unflagged automation can count, without identifying unique humans or reconstructing historical questions. Update six-language privacy text and its date. Counter-focused mock checks passed twice (23 per run); integrated full suite passed twice (97 tests, 96 passed, one optional Redis skip per run). | `stats.js`, `server.js`, `privacy-notice.js`, `legal.js`, counter tests, this brief |
| 2026-10-27 | Add the six-language SSR About page with the unchanged local portrait, confirmed age 17, creator story, factual UICI Teramo pilot invitation and owner-approved public contacts. Add the third home footer link, refine the voice-page surface/spacing, and preserve return-link language ahead of stored/browser preferences. Cover SSR languages, malicious language values, contact/asset integrity, three-link footer and client language priority. CUA-only responsive/keyboard checks passed; 42 focused Node checks passed. Integrated full suite passed twice (97 tests, 96 passed, one optional Redis skip per run); real assistive-technology retesting remains pending. | `about.js`, `server.js`, `public/index.html`, `public/app.js`, `public/i18n.js`, `public/style.css`, `public/images/fabrice-brambilla.png`, `test/server.test.js`, `test/accessibility-feedback.test.js`, this brief |
| 2026-10-27 | Replace the automatic disability assertion in the Groq prompt with interface requirements and a no-personal-attribute-inference instruction. Verify voice/text outbound payloads with local mocks. Confirmed age 17 supersedes the earlier adult/account-eligibility assertion; provider contract and sensitive-data decisions remain open. No OpenAI migration or provider-account change. | `server.js`, `test/privacy-prompt.test.js`, this brief |
| 2026-10-26 | Focus the microphone-permission explanation synchronously before the browser request, remove its live-region role to avoid a duplicate announcement, add a visible focus outline, and restore Talk only while the explanation owns focus. Window return and stale requests are guarded by request/session. Local mock regression suite passed twice (77 passed, one optional Redis integration skipped per run); real JAWS/NVDA and browser-prompt retests pending. | `public/app.js`, `public/index.html`, `public/style.css`, `test/accessibility-feedback.test.js`, this brief |
| 2026-10-26 | Fix long-word and enlarged-text overflow, allow the Talk button to grow with its label, improve light-theme keyboard focus contrast and add color regression checks. Document six-language responsive/keyboard verification and pending real-device tests. Add safe catch-up of only never-started synthetic visits with current timestamps and unchanged shared budgets. | `public/style.css`, `test/accessibility-contrast.test.js`, responsive checklist, `tools/voice-session-tester/daily_runner.py`, `test_catchup.py`, runner instructions, this brief |
| 2026-10-26 | Remove persistent visitor tracking and old ID tables; keep a simple seven-day page-opening counter. Correct six-language privacy/accessibility text, name the Swiss operator, shorten onboarding, disclose AI/privacy before microphone access, clear ended session memory and remove raw upstream error logging. Harden API caching/input validation, temporary agent-chat retention/capacity, external database TLS and stats reset CSRF. Add license inventory and regression coverage. | `server.js`, `agent.js`, `limits.js`, `stats.js`, `privacy-notice.js`, `legal.js`, `public/app.js`, `public/i18n.js`, `public/index.html`, `public/stats.js`, tests, `THIRD_PARTY_NOTICES.md`, privacy checklist, this brief |
| 2026-10-25 | Replace fixed three-question visits with independent uniform 1–5 draws; add safe same-deadline continuation, append-preserved journals, no-replay checks and updated instructions. | `tools/voice-session-tester/daily_runner.py`, `tools/voice-session-tester/test_daily_runner.py`, tester documentation, this brief |
| 2026-10-25 | Add opt-in synthetic-only QA envelopes, usage telemetry and capability endpoint to support an eight-hour local tester with 75% ceilings, 5% returning identities and at most three real 5–25-second spoken questions per visit. Existing frontend and ordinary visitors unchanged. | `synthetic-qa.js`, `server.js`, `test/synthetic-qa*.test.js`, `test/search-fallback.test.js`, `tools/voice-session-tester/*`, this brief |
| 2026-10-24 | Act on the preserved Render security notice: select patched Node 24.22.1 and update body-parser to 2.4.0, qs to 6.16.1, iconv-lite to 0.7.3. npm audit now reports zero vulnerabilities. | `.node-version`, `package.json`, `package-lock.json`, this brief |
| 2026-10-24 | Implement Julian’s microphone-permission guidance and dedicated Alt+Shift+T Talk shortcut in all six languages. Prevent cancelled microphone requests from affecting a new session. Update accessibility instructions and add regression tests. Real NVDA/JAWS retest remains pending. | `public/app.js`, `public/index.html`, `public/i18n.js`, `legal.js`, `test/accessibility-feedback.test.js`, this brief |
| 2026-10-24 | Prevent repeated `model_not_found` errors from retired Groq Compound: no default research-model fallback, retired IDs ignored even if configured, inaccessible custom research models blocked until restart. Tavily remains the primary search; unavailable search is reported honestly. Focused offline regression checks added. | `server.js`, `test/search-fallback.test.js`, this brief |
| 2026-10-24 | Conversation history removed: no summaries (`/api/summary` gone), no Continue button, no past-conversations page (`/history` redirects home), old saved history deleted from each device; page privacy sentence and privacy notice updated in 6 languages. | `public/index.html`, `public/app.js`, `public/i18n.js`, `legal.js`, `server.js`, `public/history.html` and `public/history.js` (deleted), this brief |
| 2026-10-24 | All of the site's own limits switched off by default (only Groq/Tavily/Fish limits apply); each can be switched back on with its Render variable. Server-protection caps kept. Agent API description updated. Test added. | `limits.js`, `agent.js`, `test/limits.test.js`, this brief |
| 2026-10-24 | Spoken error messages (6 languages): limit reached now says the AI has reached its free limit for today; lost connection / 3 failures in a row now asks to reload the page and try again. | `public/i18n.js`, this brief |
| 2026-10-24 | Answers fall back to `openai/gpt-oss-20b` when `gpt-oss-120b` hits a Groq rate limit (per minute or per day), instead of failing. Test added. Also: a live inflation test (3 agents x 5 chats) showed forged address headers are blocked (Cloudflare) or ignored, and agent users are capped only by the agents' message budget. | `server.js`, `test/agent.test.js`, this brief |
| 2026-10-24 | Statistics rebuilt: all old data (including generated visitors) wiped, 7-day retention, generator removed, one `stat_events` table, conversations counted on the server at conversation start (not per button press), AI agents counted as users by `agent_id` (one agent, many chats = 1 user; new agent = new user), visit beacons only from the site itself, at most `STATS_DEVICES_PER_IP` new devices per address per day. Tested against a real Postgres. UI unchanged. | `stats.js`, `public/stats.js`, `limits.js`, `server.js`, `agent.js`, `test/stats.test.js`, this brief |
| 2026-10-24 | Groq Orpheus English voice off by default (`GROQ_TTS=on` to enable) and switched off automatically if Groq refuses it, ending the `model_terms_required` errors in the Groq logs. Live agent API checked with a real call. | `server.js`, this brief |
| 2026-10-24 | Replies written in another language (e.g. English asked for in a French conversation) are now spoken by a voice of that language instead of the page-language voice: reply-language detection shared in `i18n.js`, `lang` in the `/api/chat` reply, used by `say()` and "repeat". Tests added. | `public/i18n.js`, `public/app.js`, `server.js`, `test/server.test.js`, `test/agent.test.js`, this brief |
| 2026-10-24 | Hidden text API for AI agents at `/api/agent` (create chat, send message, stop reply, read, delete), no key, separate agent daily budget; chat loop moved into shared `runChat()` (voice site behaviour unchanged); UI unchanged. Tests against stand-in Groq. | `agent.js`, `server.js`, `limits.js`, `test/agent.test.js`, this brief |
| 2026-10-10 | Added this brief and the agent rules (§0). No app code changed. | `docs/talk-with-ai-brief.md`, `CLAUDE.md`, `AGENTS.md` |
| 2026-10-11 | Removed the "faster" / "slower" speaking-speed commands and all speed code (client, `/api/speak`, Fish `prosody`), help text and accessibility statement updated. | `public/app.js`, `public/i18n.js`, `server.js`, `legal.js`, this brief |
| 2026-10-11 | Adapted to how screen readers really work: voice commands "repeat", "faster", "slower", "help" (six languages, work identically in every screen reader); adjustable, remembered speaking speed (Fish `prosody.speed`, device-voice `rate`); accessibility statement gets "Things you can say" and per-screen-reader command lists (NVDA, JAWS, Narrator, VoiceOver Mac/iOS, TalkBack, Orca); legal pages can render lists. Sandbox: NVDA/JAWS/VoiceOver-iOS walk-throughs and a commands run pass. | `public/app.js`, `public/i18n.js`, `server.js`, `legal.js`, this brief |
| 2026-10-11 | Change language by voice at any time ("speak Italian", "change language") in all six languages, with spoken confirmation; greeting mentions it; Language button moves focus into the list onto the current language, Escape closes it; accessibility statement updated. Tested in the sandbox with mock services (switch command, re-asked question, list focus). | `public/app.js`, `public/i18n.js`, `public/index.html`, `legal.js`, this brief |
| 2026-10-11 | Shorter UX after a second simulated walk-through (JAWS, NVDA, VoiceOver iPhone; first and second visit): spoken privacy notice cut to two short sentences (first layer of the notice; full text stays on /privacy); first-time instructions shortened (~5 s with the notice instead of ~20 s); returning users get a one-sentence greeting (`introHeard`); Talk button description shortened, so screen readers repeat less at the end of a conversation; all six languages. | `public/i18n.js`, `public/app.js`, this brief |
| 2026-10-10 | Screen-reader walk-through fixes: Space during the language question now also skips the list of language names; "Talk" label appears only when the assistant first waits (screen reader cue instead of talking over the greeting); greeting and help explain interrupting with Space / the Talk button in 6 languages; help text no longer read twice; empty VoiceOver stop removed. | `public/app.js`, `public/i18n.js`, `public/index.html`, `public/style.css`, this brief |
| 2026-10-10 | Natural AI voice in all six languages via Fish Audio (free developer model), with per-language voice choice, falling back to Groq (English) and the device voice; better device-voice ranking by known natural voice names; privacy notice and accessibility statement updated for the new voice service. | `server.js`, `public/app.js`, `legal.js`, this brief |
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
| 2026-10-27 | Latest edit: delete the entire About section headed "Help shape the next version", including the UICI Teramo pilot link and trial/feedback text, in every language. This supersedes the earlier public pilot-listing preference; retain internal factual adoption records. |
| 2026-10-27 | Measure adoption with real pilots and aggregate activity while preserving privacy. Count submitted voice questions with synthetic/QA and text-API traffic excluded. Keep only daily totals for seven days, with no new tracking IDs or reconstruction of earlier questions. Do not describe these totals as unique or verified human users. |
| 2026-10-27 | Fabrice explicitly confirmed he is **17**, replacing the earlier statement of 18. The public About page may state 17. Do not infer a guardian's approval or provider/account contractual eligibility from this fact. |
| 2026-10-27 | Add an About page with Fabrice Brambilla's original headshot, his high school background in Switzerland and wish to study engineering, his aunt's experience using JAWS, and the free voice/web-research mission. Public contact is explicitly approved: brambillafabrice@gmail.com and +41 78 335 15 72. Keep the voice screen simple, with no more than three footer links, high contrast and no external fonts. |
| 2026-10-27 | The owner confirms a UICI Teramo pilot. Link its official site and invite honest trials/feedback, without claiming formal endorsement or partnership. Logo use remains unapproved. |
| 2026-10-27 | Improve privacy by removing the automatic claim that each caller has a disability. Preserve relevant user-provided information and keep provider-contract, transfer and sensitive-data decisions explicit. Groq zero data retention is previously enabled; do not describe an OpenAI API migration that has not occurred. |
| 2026-10-26 | Apply the tester's request to focus the microphone-permission explanation directly when it appears so the screen reader can read it. Preserve browser-prompt focus, user-selected focus, the simple voice interface, privacy before microphone access, native link keys and Alt+Shift+T. Confirm behavior with real JAWS/NVDA before claiming it is read reliably. |
| 2026-10-26 | Proactively apply substantive recipient feedback to future outreach, testing and documentation. Mention both NVDA and JAWS in future app emails, without resending old introductions or claiming real-device certification. Improve responsive behavior across screen sizes while preserving the simple voice interface. |
| 2026-10-26 | Run yesterday's never-started visits with today's plan using current timestamps, the same identities and the same 75% rolling budget. Do not backdate traffic, replay completed/partial/uncertain visits, or start duplicate runners. |
| 2026-10-26 | **Superseded by the 2026-10-27 confirmation of 17.** Earlier statement: Fabrice confirmed he is 18 and remains a high school student in Switzerland. Do not rely on this replaced age/account-eligibility conclusion. |
| 2026-10-26 | Replace persistent visitor IDs and conversation statistics with a simple aggregate count of page openings. No new statistics consent checkbox, no user identifiers. Explain that page visits are not unique people. This replaces the 2026-10-24 unique-agent/device counting preference. |
| 2026-10-26 | Fabrice is a high school student in Switzerland. Public operator/contact: Fabrice Brambilla, brambillafabrice@gmail.com. Keep the introduction short, state AI identity once, avoid em dashes and stock AI wording, and do not advertise the coding method unless legally required. |
| 2026-10-26 | Explicitly approved enabling Groq Inference APIs zero data retention. Enabled and checked in the account. Do not claim this removes usage metadata or controls other providers. No new provider agreement, paid plan or legal commitment is authorized by the general review. |
| 2026-10-25 | Latest QA instruction: vary the number of questions independently from 1 to 5 per visit, with equal probabilities and repeats allowed. Replaces the fixed/maximum three-exchange setting below. Preserve timing, synthetic labels, identities and 75% budgets. |
| 2026-10-25 | Eight-hour synthetic QA runner: use 75% (not 45%) of the supplied daily limits, 5% returning identities, at most three question-and-answer exchanges per visit (latest instruction replaces 3–10), real randomly sampled 5–25-second audio, response-dependent pauses and random arrivals over eight elapsed hours after launch. Label test traffic and use actual provider metrics. This replaces earlier three-conversation/3–5-turn test settings. |
| 2026-10-24 | Act on private tester feedback, verify changes before reporting them as implemented, and keep NVDA product-testing correspondence off the locked group topic. Explain microphone permissions and add a dedicated Talk shortcut. |
| 2026-10-24 | Voice-session testing: one agent keeps one anonymous identity across three separate conversations, with 3–5 contextual exchanges per conversation and actual 5–25-second spoken inputs. Avoid retired-model errors; preserve measured timing/token information rather than inventing it. |
| 2026-10-24 | **Never save conversation history.** No summaries, no "Continue last conversation", no past-conversations page. |
| 2026-10-24 | **Remove all of the site's own limits; only Groq's (and other providers') limits apply.** The owner accepted the risk that one heavy user or bot can use up the day's quota for everyone. Replaces the 2026-10-10 "limits must always be enforced" preference and the agent daily budget. |
| 2026-10-24 | Error messages must say plainly what happened and what to do: **the AI's limit is reached** (try tomorrow), or **reload the page** when the connection is lost. |
| 2026-10-24 | When the main model is over Groq's rate limit, **fall back to `gpt-oss-20b`** rather than showing an error. No extra Groq accounts or keys to get around limits. |
| 2026-10-24 | *(Unique-ID counting replaced on 2026-10-26; see above.)* **Statistics must be real:** delete all existing data, keep only the **last 7 days**, remove the visitor generator and **anything that can fake numbers**. **Do not separate AI agents from people.** One AI agent making several chats = **1 unique user**; a new agent (even the same kind, e.g. another Claude) = **another unique user**. Replaces the 2026-10-10 statistics preference (30 days, unmarked generated visitors, conversation = any button press). |
| 2026-10-24 | When a reply is in another language, it must be spoken by **a native voice of that language**, never the conversation language's voice with the wrong accent. **Do not ask the owner to accept model terms on Groq** (Orpheus `model_terms_required` errors are to be ignored). |
| 2026-10-24 | **Agent API:** AI agents must be able to use the assistant by text (new chats, replies, stop, etc.) through a backend-only API, **not shown in the UI** (the UI must not change), and **without a key**. The free Groq plan (no card) is a very tight budget, so agents get their own small daily cap. |
| 2026-10-11 | **No "speak faster / slower" function.** Do not add a speaking-speed control. |
| 2026-10-11 | **Do not follow the brief's screen-reader rules blindly** (written without knowing how JAWS/NVDA work): adapt the whole site to how screen readers really work, tell users the exact screen-reader command when one is needed, and make it the best website for them. |
| 2026-10-11 | **All changes always go to `main`** (no asking first); also push the working branch. Changing language must be easy for blind users. |
| 2026-10-11 | The spoken legal notice must be **as short as possible**; keep improving the UX from the screen-reader point of view. |
| 2026-10-10 | Must be explained clearly that you **start with Space, stop with Space, and can interrupt at any time with Space and answer straight away**. |
| 2026-10-10 | Wants the voice to sound as natural as possible **in all languages**, still free. |
| 2026-10-10 | Every part of the site must fit how **all** screen readers work (JAWS, NVDA, Narrator, VoiceOver, TalkBack, Orca), with **zero friction**. |
| 2026-10-10 | **Conversation design (replaces earlier turn-taking):** first ask "say your language"; then tell the user to press **space to start talking and space again to stop and get the AI's answer** – "that's all"; if the user is silent for **more than 7 seconds**, the AI answers automatically. |
| 2026-10-10 | Users can always interrupt the assistant with the **space bar** and press it **again when they have finished speaking**. Generated statistics must **vary and grow across the days**, with the requested **total over the 30 days**. |
| 2026-10-10 | *(Replaced on 2026-10-24, see above.)* Statistics: store in **Render's free Postgres** (accepting the 30-day expiry); a **unique user** = a device that opened the website, a **conversation** = any button press; keep raw records **30 days**; **do not** change the privacy notice; generated test visitors must be stored as **ordinary data, not marked as test data**. Stats must never affect the conversation or anything a screen reader hears. |
| 2026-10-10 | Wants a **nice natural voice**, support for **every kind of assistive technology** (all screen readers and devices), compliance with **EU law**, and above all that it **actually works**. |
| 2026-10-10 | *(Replaced on 2026-10-24: own limits removed.)* Limits **must** always be enforced: once a limit is reached, everything is blocked, and visitors must not be able to change or get around the limits. Fix security vulnerabilities when found. |
| 2026-10-10 | Build with what is available for free now: **Groq key + Tavily key**. Gemini is not used because the owner's Google AI Studio project says "API access is restricted, set up billing"; the owner does not want to pay. Gemini Live can be added later as the main voice mode if a working free key is obtained. |
| 2026-10-10 | All changes are pushed to `main` (the owner asked for this). |
| 2026-10-10 | The brief must live in the repo, be readable by any AI agent, and be updated after every push to `main` with code changes and any changes in user preference. |

