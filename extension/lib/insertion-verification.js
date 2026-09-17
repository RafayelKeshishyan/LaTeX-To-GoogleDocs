/**
 * Pure helpers for deciding whether Google Docs actually accepted an insert.
 * Kept DOM-free so the edge cases can be regression-tested in Node.
 */

const InsertionVerification = (() => {
  function normalize(text) {
    return (text || '')
      .replace(/[\u200B-\u200D\uFEFF\u034F\u00AD\u2060]/g, '')
      .replace(/\u00A0/g, ' ');
  }

  function countOccurrences(text, needle) {
    if (!needle) return 0;
    let count = 0;
    let from = 0;
    while (from <= text.length - needle.length) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      count += 1;
      from = at + needle.length;
    }
    return count;
  }

  /** True only when the exact inserted zone appears more often afterwards. */
  function insertedTextCountIncreased(before, after, inserted) {
    const needle = normalize(inserted);
    const beforeText = normalize(before);
    const afterText = normalize(after);
    if (!needle || !afterText || beforeText === afterText) return false;
    return (
      countOccurrences(afterText, needle) >
      countOccurrences(beforeText, needle)
    );
  }

  /** True only when at least one exact copy of the text disappeared. */
  function textCountDecreased(before, after, removed) {
    const needle = normalize(removed);
    const beforeText = normalize(before);
    const afterText = normalize(after);
    if (!needle || !beforeText || beforeText === afterText) return false;
    return (
      countOccurrences(afterText, needle) <
      countOccurrences(beforeText, needle)
    );
  }

  /**
   * A trailing newline is safe only when the insert is proven and nothing but
   * whitespace follows the newly inserted zone. Unknown/unchanged text is not
   * treated as document end.
   */
  function landedAtDocumentEnd(before, after, inserted) {
    if (!insertedTextCountIncreased(before, after, inserted)) return false;

    const beforeText = normalize(before);
    const afterText = normalize(after);
    const needle = normalize(inserted).trim();

    let common = 0;
    while (
      common < beforeText.length &&
      common < afterText.length &&
      beforeText[common] === afterText[common]
    ) {
      common += 1;
    }

    const changedTail = afterText.slice(common);
    const insertedAt = changedTail.indexOf(needle);
    if (insertedAt < 0) return false;
    return !changedTail.slice(insertedAt + needle.length).trim();
  }

  return {
    normalize,
    countOccurrences,
    insertedTextCountIncreased,
    textCountDecreased,
    landedAtDocumentEnd
  };
})();

if (typeof window !== 'undefined') {
  window.InsertionVerification = InsertionVerification;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InsertionVerification;
}
