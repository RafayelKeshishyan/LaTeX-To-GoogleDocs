/**
 * speech-output.js — One announcement, one voice.
 *
 * NVDA and JAWS both read ARIA live regions. Chrome's own speech
 * synthesiser is a second, independent voice. Using both at once is what
 * made every message get spoken twice. The stored mode picks exactly one
 * channel; the default is the screen reader.
 */

const SpeechOutput = (() => {
  const MODES = {
    SCREEN_READER: 'screenReader',
    EXTENSION: 'extension'
  };

  const DEFAULT_MODE = MODES.SCREEN_READER;
  const LIVE_REGION_SETTLE_MS = 50;
  const LIVE_STYLE =
    'position:absolute;left:0;top:0;width:1px;height:1px;margin:0;padding:0;' +
    'overflow:hidden;white-space:nowrap;border:0;';

  let mode = DEFAULT_MODE;
  let liveRegionTimer = null;

  function setMode(next) {
    mode = Object.values(MODES).includes(next) ? next : DEFAULT_MODE;
    if (!usesSynth()) stopSynth();
    return mode;
  }

  function getMode() {
    return mode;
  }

  function usesSynth() {
    return mode === MODES.EXTENSION;
  }

  function usesLiveRegion() {
    return mode === MODES.SCREEN_READER;
  }

  function stopSynth() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tts?.stop) chrome.tts.stop();
    } catch {
      /* chrome.tts is missing in some content-script contexts */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* speechSynthesis missing */
    }
  }

  /**
   * A live region both NVDA and JAWS will actually read.
   *
   * role="alert" is omitted on purpose: JAWS treats that as a second
   * announcement on top of aria-live, so the same sentence is spoken twice.
   * clip:rect is omitted because recent JAWS builds skip clipped nodes.
   */
  function createLiveRegion(doc, id, politeness) {
    const existing = doc.getElementById(id);
    if (existing) return existing;

    const el = doc.createElement('div');
    el.id = id;
    el.setAttribute('aria-live', politeness === 'assertive' ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'latex-gdocs-sr-only';
    el.style.cssText = LIVE_STYLE;

    // Never append inside a contenteditable body: Google Docs' hidden input
    // iframe would then treat the announcement as document text.
    const host =
      doc.body?.getAttribute?.('contenteditable') === 'true'
        ? doc.documentElement
        : doc.body || doc.documentElement;
    host.appendChild(el);
    return el;
  }

  /**
   * Clear, then write once. A second write (the old workaround) is what made
   * JAWS and NVDA repeat the same sentence.
   */
  function announceInRegions(els, text, options = {}) {
    if (!usesLiveRegion()) return false;
    const message = (text || '').trim();
    const targets = (Array.isArray(els) ? els : [els]).filter(Boolean);
    if (!targets.length) return false;

    const mathml =
      options.latex && typeof LatexMathML !== 'undefined'
        ? LatexMathML.fromLatex(options.latex)
        : '';
    const prefix =
      options.latex && !mathml
        ? (options.fallback || message)
        : message;
    if (!prefix && !mathml) return false;

    if (liveRegionTimer) clearTimeout(liveRegionTimer);

    const write = () => {
      liveRegionTimer = null;
      for (const el of targets) fillRegion(el, prefix, mathml);
    };

    for (const el of targets) el.textContent = '';
    if (options.interrupt) {
      requestAnimationFrame(write);
    } else {
      liveRegionTimer = setTimeout(write, LIVE_REGION_SETTLE_MS);
    }
    return true;
  }

  /**
   * Prefix (e.g. "2 of 3. ") stays as text. The equation is a <math> node so
   * MathCAT can speak it. No aria-label — that would hide the MathML.
   */
  function fillRegion(el, prefix, mathml) {
    const doc = el.ownerDocument;
    el.textContent = '';
    if (prefix) el.appendChild(doc.createTextNode(prefix));
    if (!mathml) return;
    const wrap = doc.createElement('span');
    wrap.setAttribute('role', 'math');
    wrap.innerHTML = mathml;
    el.appendChild(wrap);
  }

  function announceInRegion(el, text, options = {}) {
    return announceInRegions([el], text, options);
  }

  function speakViaBackground(message, rate = 1.0) {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        return false;
      }
      chrome.runtime.sendMessage({ action: 'speak', text: message, rate });
      return !chrome.runtime.lastError;
    } catch {
      return false;
    }
  }

  function speakViaChromeTts(message, rate = 1.0) {
    if (typeof chrome === 'undefined' || !chrome.tts?.speak) return false;
    try {
      chrome.tts.stop();
      chrome.tts.speak(message, { rate, enqueue: false });
      return true;
    } catch (err) {
      console.warn('[LaTeX-GDocs] chrome.tts failed', err);
      return false;
    }
  }

  function speak(text) {
    const message = (text || '').trim();
    if (!message || !usesSynth()) return false;
    if (speakViaChromeTts(message)) return true;
    return speakViaBackground(message);
  }

  function speakNow(text) {
    return speak(text);
  }

  function speakKeystroke(text) {
    const message = (text || '').trim();
    if (!message || !usesSynth()) return false;
    if (speakViaChromeTts(message, 1.15)) return true;
    return speakViaBackground(message, 1.15);
  }

  function watchStoredMode() {
    stopSynth();
    try {
      chrome.storage.sync.get(['speechMode'], (data) => {
        if (chrome.runtime.lastError) return;
        setMode(data?.speechMode || DEFAULT_MODE);
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.speechMode) {
          setMode(changes.speechMode.newValue || DEFAULT_MODE);
        }
      });
    } catch {
      /* storage unavailable — stay on the screen-reader default */
    }
  }

  watchStoredMode();

  return {
    MODES,
    DEFAULT_MODE,
    speak,
    speakNow,
    speakKeystroke,
    announceInRegion,
    announceInRegions,
    createLiveRegion,
    setMode,
    getMode,
    usesSynth,
    usesLiveRegion,
    stopSynth
  };
})();

if (typeof window !== 'undefined') {
  window.SpeechOutput = SpeechOutput;
}
