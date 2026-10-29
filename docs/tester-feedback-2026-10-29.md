# Tester feedback, 29 October 2026

## Reproduced and changed

- **Vicenza, latest AC Milan result:** the exact submitted wording uses singular `risultato` and the transcription typo `utlimo`. The previous classifier could skip mandatory research. Sports detection now recognizes singular/plural results, championships and scores. A regression first failed and now requires real search results for the exact phrase.
- **Vicenza, Sandrigo weather:** a model tool query could substitute a larger town even when the user supplied Sandrigo. Weather and sports queries now retain the user's explicit wording, including contextual follow-ups. Referential requests such as “weather in my town” still allow the model to resolve an earlier supplied location. No result means an honest unavailable message, not invented current facts. This is not proof that every provider result is fresh or every model summary correct.
- **Lombardia, follow-up questions:** code retains dialogue in memory and sends it on each turn. A reproduced separate weakness lost the mandatory research requirement after a second short follow-up. The safeguard now carries the topic through several short follow-ups and tests that the full dialogue remains present. Lombardia's exact failing conversation and device setup are still requested; do not claim that unprovided case reproduced.
- **Vibo Valentia/Calabria, Firefox + NVDA:** the existing permission explanation already receives focus before the native prompt. A reproduced lifecycle gap failed to restore Talk when the browser returned DOM focus to the document body. Restore it only when the app owned the explanation focus, after the permission request has settled and the document regains focus. Preserve explicit user focus on another control and reject stale sessions. Native NVDA speech output remains to be retested by a human.
- **Caserta, first access:** brief home guidance now names NVDA/JAWS B navigation, followed by Space/Enter. Browser permission controls remain outside the page. The site cannot move focus into browser chrome or force its language.
- **Caserta, voice and download claims:** the app has no gender selector or file-execution tool. Recognized requests now receive a localized factual limitation without an AI completion. The general prompt also prohibits claiming device control, downloads, saved files or sent mail. A male/female voice selector or downloadable transcript has not been invented or added.

## Still open

- Samuel's real TalkBack report: screen-reader speech can enter the microphone. Existing mute gates and turn taking reduce opportunities, but the page cannot observe another app's audio. No physical Android reproduction or universal fix is claimed.
- Benoît's iPhone report still lacks an exact failing interaction.
- Full native screen-reader testing across Windows Firefox/NVDA, JAWS and real phones requires those environments. Passing DOM/mock tests is not reader certification.
- Download request wording from Caserta is requested. This release corrects false capability claims rather than implementing a new file/history feature contrary to the simple voice design.

## Sources used for keyboard and status behavior

- [NVDA user guide](https://api.nvaccess.org/documentation/userGuide.html), single-letter B navigation and system focus.
- [Firefox microphone permissions](https://support.mozilla.org/en-US/kb/how-manage-your-camera-and-microphone-permissions), browser-owned permission controls and Page Info recovery.
- [MDN status role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role), do not combine live status updates with unsolicited focus changes.

## Verification

Six new regressions failed against the previous implementation. The first focused repaired run passed 58/58, then the onboarding-inclusive focused run passed 65/65. The final full suite passed twice on Node 24.22.1: 172 tests, 171 passed, one optional Redis integration skipped, no failures per run. The direct mirror attempt stalled during dependency loading and was interrupted; the first isolated attempt used an incomplete old dependency directory and lacked localhost permission. Those failures were retained. The final isolated copy used complete pre-existing locked dependencies and granted local network access for stand-in services. Logs: /tmp/fabrice-feedback29-full-1-authorized.log and /tmp/fabrice-feedback29-full-2-authorized.log. No real provider requests or paid synthetic run were used. Live deployment evidence is recorded separately after publication.
