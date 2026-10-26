# Responsive and keyboard checks

Checked on 26 October 2026. The app is designed for NVDA and JAWS on Windows, plus native screen readers on other platforms. These results describe actual checks, not universal compatibility or a claim of real JAWS/NVDA certification.

## Reproduced and fixed

- At 320 CSS pixels wide with doubled text, the English privacy page scrolled to 524 pixels because the operator email and long words could not wrap. Shared border-box sizing, a constrained main column and emergency word wrapping now keep the page at 320 pixels.
- At that size, the fixed-aspect Talk button had 248 pixels of inner height but 254 pixels of overflowing content. It now retains its usual circular minimum size while growing vertically when larger text needs more room. Its text is contained.
- The former yellow keyboard outline had insufficient contrast on the light background. The light theme now uses blue; the dark theme retains yellow. Text, active controls and focus colors have computed contrast regression coverage. Native controls, the simple voice interface and keyboard behavior remain intact.

## Executed coverage

The local application ran with provider credentials disabled. A test-only proxy supplied a same-origin stylesheet setting the root font to 200% for text enlargement. This proxy and stylesheet are not production files.

- 186 browser layout cases: all six languages; home at 320, 360, 390, 568, 768, 1024, 1440 and 1920 CSS pixels; portrait and landscape sizes; normal and doubled text; expanded language groups; privacy and accessibility pages at 320, 568 and 1440 pixels. All document widths fit their viewports, and visible button contents fit their boxes.
- Six keyboard checks: Tab from Talk to Language; Enter opens the language group and focuses the current choice; Escape closes it and returns focus; Space opens the group and Enter selects a language; selection returns focus to Talk; Space on a privacy link keeps native behavior and Enter follows the link.
- Inspect the final accessibility tree: native named Talk and Language buttons, correct page language, one heading, two labelled footer links and a single initially empty error alert. No live conversation transcript was introduced.
- Full Node regression suite twice: 69 passed, one optional Redis integration skipped, zero failures per run. Includes microphone permission, late stream cancellation, session end, shortcut handling, language and provider-flow mocks.
- Python runner suite twice: 35 passed per run using local mock HTTP and a virtual clock, including four catch-up tests. No production quota consumed by those tests.

Browser evidence and screenshots are saved locally under `output/playwright/responsive-2026-10-26/`. Provider tests use mocks; the separate live synthetic runner is not a screen-reader test.

## Remaining manual checks

No usable Windows VM or installed JAWS/NVDA environment was available on this Mac. Mac Chromium layout and accessibility-tree checks do not substitute for those programs. The project's manual checklist in the brief remains open for JAWS with Chrome/Edge, NVDA with Chrome/Firefox, iPhone VoiceOver, Android TalkBack, actual microphone permissions, speaker echo, interruption and network loss on physical devices. Viewport resizing is not mobile OS or touch emulation. Forced colors and reduced motion retain their existing CSS but were not exercised in an OS-level session here.

Use real testers' browser, OS and screen-reader versions in future bug reports. Do not tell recipients all devices or all screen readers have been certified. Say the app is designed for NVDA and JAWS and welcome concrete test findings.

References: [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [text resizing](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
