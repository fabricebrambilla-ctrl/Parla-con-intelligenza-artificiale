# Hands-free and device-aware update

Implemented, awaiting real-user confirmation. H was separately verified and pushed as `964b24a` before this work. No real provider requests, paid tests, billing changes, email work or synthetic adoption runs were used for this update.

## Behavior

- Start/Enter opens the session and requests microphone permission when necessary. Listening then restarts automatically. Sustained speech interrupts an answer, preserves its beginning in the recording, and invalidates the older answer's pending UI actions. Silence alone does not submit requests or repeat reminders.
- The main button and a lone Ctrl tap pause both speech and the microphone. A second activation reopens listening. Ctrl chords remain native. Escape ends the session. The custom global talk shortcut using the space key is removed; native HTML button/assistive-technology activation is deliberately preserved.
- Spoken pause, speed, instructions, language, microphone and installation commands work locally in the ten maintained locales. The AI can also request supported page commands. The app can read its own privacy, terms, accessibility, About, instructions and footer text without a search-provider request. A named microphone can be selected after listing microphones. Switching languages remains available; the general initial language interview is removed. The later Portuguese preference is preserved: when both Portuguese variants are enabled, a one-time Portugal/Brazil question selects the variant. Dutch and both Portuguese variants remain gated until enabled by the owner.
- Returning visitors with permission and the current notice already heard receive only the short welcome. The updated privacy notice must be heard once. A first-time visitor gets the notice, a short browser-specific permission line and operating instructions. Browser permission itself cannot be granted or persisted by site code.
- OS, browser family and major version are detected using client hints, user-agent fallback and touch fallback. Feature support determines whether recording is possible. Device context is not announced and is passed to the assistant only for the current request/session.
- `/api/device-count` stores seven Zurich-calendar-day aggregate page visits by allowlisted OS/browser/major categories. It does not retain IPs, raw user agents, identities or conversation links. The authenticated stats page displays these counts. They are not unique users; infrastructure/provider logging remains separate. The activity reset button resets activity totals, not these separately retained seven-day device counts.
- The default speaking rate remains 1.0. Faster/slower changes it by 0.1, bounded to 0.6–1.6, in memory only. Native voices use SpeechSynthesisUtterance.rate. Provider audio uses HTML audio playbackRate with preservesPitch, and falls back to the device voice if playback fails.
- Instructions are the third and last footer link. The existing accessibility-page headphones sentence is unchanged, per the owner's decision.
- PWA manifest/icons and minimal offline help are supplied. Only the informational offline page is cached; APIs, conversations, stats and app responses are not cached. A browser-offered install button requires user activation. Voice can reveal/focus it and explain the next step; voice alone cannot satisfy browser install consent. Apple devices receive Add to Home Screen guidance. No store publication.

## Echo and speed decisions

Browser AEC, noise suppression and automatic gain control remain enabled. Input stays open during speech to permit interruption: muting it throughout output would make that impossible. A sustained-speech threshold, the existing screen-reader interaction gate, and a conservative leading-transcript echo filter provide complementary mitigation. Latin matching permits small transcription differences; CJK matching is exact and requires a longer prefix. Novel suffixes and short intentional responses are preserved. These measures cannot guarantee zero acoustic echo or distinguish all screen-reader speech from the user.

Two speed paths exist: Fish's bounded `prosody.speed` server option and pitch-preserving browser playback. Browser playback is selected because it works consistently for returned audio from either configured voice provider without another synthesis request. The device-voice fallback uses its native rate. This is an engineering choice, **not a claimed listening comparison**. An audible A/B comparison with the actual enabled voices remains pending; no live provider quota was spent to invent one.

Sources checked during implementation:

- [MDN echoCancellation constraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/echoCancellation): best-effort browser capture processing, not a universal echo guarantee.
- [MDN preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch): pitch compensation with playback-rate changes.
- [Fish text-to-speech API](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech): `prosody.speed` request option.
- Installation sources and future Google Play prerequisites are in [the PWA note](hands-free-pwa.md). A future new personal Play account generally needs the US$25 registration, identity verification and the applicable 12-testers/14-days closed test. This is not required for web installation.

## Verification and remaining limits

- Both full suites: **323 tests, 322 passed, 1 optional Redis test skipped, 0 failed**, default and `NEW_LANGUAGES=nl,pt,pt-BR`. Node 24.22.1; provider fixtures only. Logs in `hands-free-validation/`.
- Regression groups cover OS/browser detection, unsupported capabilities, Ctrl chords, CJK/Latin echo filtering, speed bounds, continuous silence, speech interruption, pause during microphone acquisition, missing-microphone recovery, pitch-preserving audio cancellation and aggregate storage/retention.
- Isolated Chromium keyboard check with a **silent simulated microphone and mocked speech**: Enter starts listening; Ctrl closes tracks; Ctrl resumes; Ctrl+A and Space on a footer link preserve native behavior; Escape ends. Returning flow speaks one welcome. This is not a real microphone/screen-reader test.
- Axe WCAG A/AA scans on English home, instructions and privacy plus Brazilian Portuguese instructions and privacy returned **zero violations and zero incomplete findings** in that isolated browser. This does not certify accessibility.
- Chromium reported no manifest errors; offline navigation successfully loaded offline help. Install prompt handling was checked with simulated events. Actual Android/iOS installation remains unverified.
- Not tested physically: NVDA/JAWS delivery of Ctrl, VoiceOver/TalkBack microphone prompts, speaker double-talk/echo, iOS output routing with input open, naturalness of rate changes, or native-speaker approval of translations. Echo and simultaneous speech need blind-user/device confirmation before being described as resolved.
- Native browser permission controls and native screen-reader key commands remain browser-owned. No promise of fully hands-free first permission, guaranteed persistent grants, or spoken resume while the microphone is closed.

## Remote merge reconciliation

Preserved the November 19 Portuguese updates from remote commit `ffffd94`, including regional browser detection, the variant question, native voice selection and Portugal-specific answer corrections. Applied the hands-free wording, instructions, privacy aggregates, offline page and install guidance to Brazilian Portuguese. A dedicated language question does not arm automatic interruption; its own recording collects the choice. Error retries now request repetition rather than accidentally using the returning greeting. Added regressions for the prompt guard and Brazilian hands-free commands.
