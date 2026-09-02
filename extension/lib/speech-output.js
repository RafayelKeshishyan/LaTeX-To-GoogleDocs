/**
 * speech-output.js — Reliable speech for screen readers (NVDA, VoiceOver)
 * Uses chrome.tts in extension pages; falls back to speechSynthesis.
 */

const SpeechOutput = (() => {
  let enabled = true;

  function speakViaChromeTts(message, rate = 1.0) {
    if (typeof chrome === 'undefined' || !chrome.tts?.speak) {
      return false;
    }

    try {
      chrome.tts.stop();
      chrome.tts.speak(message, {
        rate,
        enqueue: false
      });
      return true;
    } catch (err) {
      console.warn('[LaTeX-GDocs] chrome.tts failed', err);
      return false;
    }
  }

  function speakViaWebApi(message) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return false;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1;
      utterance.pitch = 1;
      synth.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[LaTeX-GDocs] speechSynthesis failed', err);
      return false;
    }
  }

  function speak(text) {
    const message = (text || '').trim();
    if (!message || !enabled) return false;

    if (speakViaChromeTts(message)) {
      return true;
    }

    return speakViaWebApi(message);
  }

  /** Fast insert feedback — does not call stop() first. */
  function speakNow(text) {
    const message = (text || '').trim();
    if (!message || !enabled) return false;

    if (typeof chrome !== 'undefined' && chrome.tts?.speak) {
      try {
        chrome.tts.speak(message, { rate: 1.05, enqueue: false });
        return true;
      } catch {
        /* fall through */
      }
    }

    return speakViaWebApi(message);
  }

  /** Linear-mode keystrokes — cancel prior speech for responsiveness. */
  function speakKeystroke(text) {
    const message = (text || '').trim();
    if (!message || !enabled) return false;

    if (speakViaChromeTts(message, 1.15)) {
      return true;
    }

    return speakViaWebApi(message);
  }

  function setEnabled(value) {
    enabled = value !== false;
  }

  return { speak, speakNow, speakKeystroke, setEnabled };
})();

if (typeof window !== 'undefined') {
  window.SpeechOutput = SpeechOutput;
}
