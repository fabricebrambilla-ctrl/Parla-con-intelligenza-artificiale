<script>
  let italianVoice = null;

  function selectItalianVoice() {
    const voices = window.speechSynthesis.getVoices() || [];
    italianVoice =
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith("it") && /google|enhanced|premium|natural/i.test(v.name)) ||
      voices.find(v => v.lang && v.lang.toLowerCase().startsWith("it")) ||
      null;
  }

  // Initial attempt
  selectItalianVoice();

  // Voices load asynchronously in Chrome
  window.speechSynthesis.onvoiceschanged = () => {
    selectItalianVoice();
  };

  function speakText(text) {
    if (!text) return;

    // Stop anything currently speaking
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";

    if (italianVoice) {
      utterance.voice = italianVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  }
</script>