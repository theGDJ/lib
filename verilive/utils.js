// Small shared helpers used by both API layers and the UI.
export const VERDICTS = ['SUPPORTED', 'PARTIAL', 'INSUFFICIENT', 'CONTRADICTED'];
export const emptyCounts = () => Object.fromEntries(VERDICTS.map(v => [v, 0]));
export function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
