export function splitSentences(answer) {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(answer)]
      .map(s => s.segment.trim())
      .filter(Boolean);
  }
  return (answer.match(/[^.!?]+[.!?]+(?:["'”’]+)?|[^.!?]+$/g) || []).map(s => s.trim()).filter(Boolean);
}
const norm = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
// Match an answer sentence to its claim: exact after normalization, or one-way
// containment (tolerates minor punctuation/quoting differences from the backend).
// Short strings are excluded from containment to avoid false positives like "ai".
export function matchClaim(sentence, claims) {
  const s = norm(sentence);
  return claims.find(c => {
    const k = norm(String(c?.claim ?? ''));
    if (!k) return false;
    return k === s || (k.length >= 12 && s.includes(k)) || (s.length >= 12 && k.includes(s));
  });
}
