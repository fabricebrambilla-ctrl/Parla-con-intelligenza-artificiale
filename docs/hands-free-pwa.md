# Hands-free instructions and PWA preparation

2026-11-19. Implemented, awaiting real-user confirmation. No paid calls, store account, publishing or provider changes.

## Integration

- `instructions.js` exports the same nine-locale page map as legal.js. Wire `/instructions` through `renderLegal(require('./instructions.js'))`; place `#instructionsLink` third and last in the home footer. Existing locale gating continues to apply through `requestLang`.
- In the page head: `<link rel="manifest" href="/manifest.webmanifest">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`, and `<meta name="theme-color" content="#164b98">`.
- Add one native `<button id="installApp" type="button" data-i18n="installLabel" hidden>{{installLabel}}</button>` near other secondary controls. Load `/install.js` after the DOM and shared i18n. Existing styles handle the button. Native hidden semantics are required.
- `window.requestAppInstall(lang)` returns a localized string to speak. It reveals/focuses the install button only when an install event exists. It does not call the browser prompt from asynchronous speech recognition: the actual button activation calls `prompt()` immediately. Browser confirmation remains required.
- The script registers `/service-worker.js` only on a secure context with service-worker support. Ensure the existing CSP permits same-origin workers (worker-src, or its script-src/default-src fallback). Serve the worker and manifest with revalidation, never an immutable cache policy.
- `beforeinstallprompt` availability is browser-controlled. The install button stays hidden without it, after dismissal, and when running standalone. iPhone/iPad guidance directs users to Safari's Share → Add to Home Screen → Add (Open as Web App when available). Desktop browser-menu guidance is also included. No automatic installation is claimed.

## Offline and data boundary

The worker stores only `/offline.html`, a short informational page with nine language sections and correctly marked languages. It fetches ordinary navigations from the network and uses that page only on network failure. It does not cache the app shell, voices, transcripts, API requests, API responses, private statistics or user conversations. The static fallback needs neither JavaScript nor an external stylesheet. It cannot provide conversations without internet. Cache cleanup deletes only old caches with this worker's own prefix. No forced activation/reload interrupts an existing conversation.

Icons are original, deterministic, locally generated PNG microphone marks (192, 512 and Apple 180 pixels); the separate maskable icon keeps its glyph inside the safe area. No remote image service was used. App language and browser preferences remain owned by the existing app, not the manifest.

## Research and decisions

- [MDN: Trigger installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt) and [beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event): retain the install event, reveal UI when available, and use a user activation to prompt. The event is not universally supported and has no guaranteed firing time. Voice alone is not a replacement for browser-required activation.
- [Apple: Turn a website into an app in Safari on iPhone](https://support.apple.com/en-az/guide/iphone/iphea86e5236/26/ios/26): Share, Add to Home Screen, Open as Web App if shown, Add. This is a manual installation path, not a JavaScript prompt.
- [Google Play: Get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?rd=1): a future Play release requires a US$25 one-time registration fee, identity verification (a government ID may be requested), and account eligibility. This is not needed to install the website as a PWA.
- [Google Play: App testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en): personal accounts created after November 13, 2023 need a closed test with at least 12 testers opted in continuously for at least 14 days before applying for production access. This condition is not a universal requirement for every existing account and does not by itself guarantee production approval. Google Play publication is outside this work and has not been attempted.

## Verification

`node --check` passed for install.js and service-worker.js. An isolated Node VM check (`/tmp/check-handsfree-pwa.cjs`) passed all of these behavioral assertions without network or provider calls: nine instruction locales and section shapes; hidden initial install button; no-event fallback; localized Portuguese guidance; capture and cancellation of beforeinstallprompt; voice request focuses but never prompts; button activation prompts exactly once; dismissal hides and restores focus; installed state; worker registration; only offline.html precached; old owned cache cleanup preserving unrelated caches; API, stats, cross-origin and non-navigation exclusions; offline navigation fallback; manifest PNG dimensions.

These checks do not establish actual installability on Android/iOS, native permission-prompt speech, real screen-reader behavior, or a physical phone offline launch. Those remain to be checked after integration and HTTPS deployment. Translation wording needs native-speaker review. No headphones sentence was changed.
