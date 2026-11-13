# Microphone access improvement, 13 November 2026

## Browser facts
- The site cannot grant or persist microphone permission itself. `getUserMedia` requires browser permission; the browser can revoke it. Browser grants are scoped to an origin, browser/profile and device. The two Render hostnames do not share permission.
- Chrome offers temporary and longer-lived choices, whose labels vary with version. Firefox offers “Remember this decision”. Private browsing, cleared settings, managed policies and operating-system permission can prevent persistence.
- Local storage records only completion of guidance, never authorization to record.

Sources checked:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://support.google.com/chrome/answer/2693767
- https://developer.chrome.google.cn/blog/one-time-permissions?hl=en
- https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions
- https://support.google.com/chrome/answer/157179

## What changed
- Start checks current permission before speaking microphone guidance. Granted skips it; prompt repeats it even if guidance was heard before; denied explains site-settings recovery without requesting capture.
- Unsupported/rejected Permissions API queries retain the safe original getUserMedia flow.
- First-use instructions explain the browser's optional remember/always-allow choice. Keyboard users receive Tab/Shift+Tab, Enter and checkbox Space instructions before the browser prompt, while the mic is still closed. Touch users retain double-tap instructions.
- The Accessibility page repeats the help so it can be reviewed without recording. Seven supported languages are covered.
- Existing single focused explanation, cancellation, late-stream cleanup and return-to-Talk rules are preserved. No fake permission toggle, additional popup, automatic capture on page load or private browsing workaround.

## Verification
Automated behavior checks cover grants, temporary permissions after stored onboarding, denied permission, unsupported queries, cancellation during lookup/disclosure/prompt, focus restoration, user-selected focus and late stream cleanup. Final results below.

Native Windows NVDA/JAWS tests cannot be executed in this Mac environment and remain pending. Automated mocks do not verify spoken announcements or browser chrome navigation. Retest Chrome/Edge with NVDA and JAWS, and Firefox with NVDA: fresh grant, persistent grant after reload, temporary grant after closing/reopening, deny/re-enable, cancel pending prompt and navigate elsewhere. Confirm no speech enters recording and no focus is stolen. Browser permission dialogs cannot be controlled by the page.

Final offline suite on Node 24.22.1 passed twice: 179 checks, 178 passed, one optional Redis integration skipped, zero failures per run. Focused onboarding/focus suite also passed twice, 34/34. No live provider usage or synthetic users were generated. Native reader testing remains pending.
