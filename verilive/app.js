import { api } from './api.js';
import { config } from './config.js';
import { VERDICTS, emptyCounts, delay } from './utils.js';
import { splitSentences, matchClaim } from './answer.js';

const $ = id => document.getElementById(id);
const labels = { SUPPORTED: 'Supported', PARTIAL: 'Partial', INSUFFICIENT: 'Insufficient', CONTRADICTED: 'Contradicted' };
const symbols = { SUPPORTED: '✓', PARTIAL: '≈', INSUFFICIENT: '?', CONTRADICTED: '×' };
const mock = config.mode === 'mock';

let rows = [], claims = [], selected = null, busy = false;

if (!mock) {
  $('mode-label').textContent = 'LIVE API';
  $('demo-note').textContent = 'Answers and evidence are supplied by your verification backend.';
  $('footer-mode').textContent = 'Connected to your verification API';
  $('evidence-disclaimer').textContent = 'Verdicts reflect the supplied source evidence, not an independent guarantee of truth.';
}

function badge(el, claim) {
  el.className = `badge ${claim ? claim.verdict.toLowerCase() : 'pending'}`;
  el.textContent = claim ? `${symbols[claim.verdict]} ${labels[claim.verdict]}` : '◌ Awaiting verdict';
}

// Recompute every row against the latest claims array, refresh badges and
// counts, and keep the open evidence panel in sync. Returns verified count.
function refresh() {
  const counts = emptyCounts();
  for (const row of rows) {
    row.claim = row.fallbackIndex != null
      ? (claims[row.fallbackIndex] || null)
      : matchClaim(row.text, claims);
    if (row.claim) counts[row.claim.verdict]++;
    row.button.className = `sentence-button ${row.claim ? row.claim.verdict.toLowerCase() : ''}`;
    row.button.setAttribute('aria-pressed', String(selected === row));
    badge(row.badge, row.claim);
  }
  VERDICTS.forEach(v => { $(`count-${v}`).textContent = counts[v]; });
  const verified = Object.values(counts).reduce((a, b) => a + b, 0);
  $('claim-progress').textContent = rows.length ? `${verified} / ${rows.length} verified` : '';
  if (selected) showEvidence(selected, false);
  return verified;
}

function showEvidence(row, focus = true) {
  selected = row;
  rows.forEach(r => r.button.setAttribute('aria-pressed', String(r === row)));
  $('evidence-empty').hidden = true;
  $('evidence-detail').hidden = false;
  $('close-evidence').hidden = false;
  $('claim-label').textContent = `CLAIM ${String(rows.indexOf(row) + 1).padStart(2, '0')}`;
  $('detail-claim').textContent = row.text;
  badge($('detail-verdict'), row.claim);
  $('detail-evidence').textContent = row.claim?.evidence || (busy
    ? 'Verification is in progress. Matched evidence will appear here when this sentence’s verdict arrives.'
    : 'No matched evidence was returned for this sentence. Please try again.');
  $('detail-source').textContent = row.claim?.source || (busy ? 'Waiting for a source…' : 'No source returned');
  if (focus) {
    $('evidence-title').focus({ preventScroll: true });
    if (window.innerWidth <= 740) {
      $('evidence-panel').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }
}

function closeEvidence() {
  const previous = selected;
  selected = null;
  $('evidence-empty').hidden = false;
  $('evidence-detail').hidden = true;
  $('close-evidence').hidden = true;
  rows.forEach(r => r.button.setAttribute('aria-pressed', 'false'));
  previous?.button.focus?.({ preventScroll: true });
}
$('close-evidence').addEventListener('click', closeEvidence);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && selected) closeEvidence(); });

function addSentence(text, index) {
  const li = document.createElement('li');
  li.className = 'sentence-row';
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-controls', 'evidence-panel');
  const number = document.createElement('span');
  number.className = 'sentence-number';
  number.textContent = String(index + 1).padStart(2, '0');
  const content = document.createElement('div');
  const sentence = document.createElement('div');
  sentence.className = 'sentence-text';
  sentence.textContent = text;
  const bottom = document.createElement('div');
  bottom.className = 'sentence-bottom';
  const verdict = document.createElement('span');
  const link = document.createElement('span');
  link.className = 'inspect-link';
  link.textContent = 'View evidence ↗';
  bottom.append(verdict, link);
  content.append(sentence, bottom);
  button.append(number, content);
  li.append(button);
  $('sentences').append(li);
  const row = { text, button, badge: verdict, claim: null, fallbackIndex: null };
  rows.push(row);
  button.addEventListener('click', () => showEvidence(row));
  refresh();
}

function setBusy(value) {
  busy = value;
  $('submit').disabled = value;
  $('question').readOnly = value;
  $('submit-label').textContent = value ? 'Verifying…' : 'Verify answer';
  $('submit-icon').textContent = value ? '' : '↗';
  $('submit-icon').className = value ? 'spinner' : '';
  $('working').hidden = !value;
  $('status').className = value ? 'status active' : 'status';
}

function showError(message) {
  $('error').textContent = message;
  $('error').hidden = false;
}

$('question').addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    $('question-form').requestSubmit();
  }
});
$('question').addEventListener('input', () => $('question').setCustomValidity(''));

$('question-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const question = $('question').value.trim();
  if (!question) {
    $('question').setCustomValidity('Please enter a question.');
    $('question').reportValidity();
    return;
  }
  closeEvidence();
  rows = []; claims = []; selected = null;
  $('sentences').replaceChildren();
  $('error').hidden = true;
  $('answer-empty').hidden = true;
  $('answer-context').textContent = mock
    ? 'Illustrative demo answer · not a generated response'
    : 'AI answer · verified against source evidence';
  refresh();
  setBusy(true);
  $('status').textContent = 'Preparing answer';
  $('working-label').textContent = 'Preparing your answer…';

  const controller = new AbortController();
  let timedOut = false, verified = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, config.verificationTimeoutMs);
  const session_id = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const options = { signal: controller.signal };

  try {
    const result = await api.verify({ question, session_id }, options);
    if (typeof result?.answer !== 'string' || !result.answer.trim()) {
      throw new Error('The API returned an empty answer. Please check your /verify response.');
    }
    if (result.claims !== undefined && !Array.isArray(result.claims)) {
      throw new Error('The API returned an unexpected /verify shape: "claims" must be an array.');
    }
    const sentences = splitSentences(result.answer);
    claims = Array.isArray(result.claims) ? [...result.claims] : [];
    $('status').textContent = 'Verifying sentence by sentence';
    $('working-label').textContent = 'Checking claims against the evidence…';

    // Stream sentences while verdicts arrive via GET /claims (polling fallback
    // per the contract). One cancellation signal covers both loops.
    const stream = async () => {
      for (let i = 0; i < sentences.length; i++) {
        if (i) await delay(config.sentenceDelayMs, controller.signal);
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        addSentence(sentences[i], i);
      }
    };
    const poll = async () => {
      let lastSize = claims.length, stagnant = 0;
      while (!sentences.every(s => matchClaim(s, claims))) {
        await delay(config.pollIntervalMs, controller.signal);
        const updates = await api.getClaims(session_id, options);
        if (!Array.isArray(updates)) {
          throw new Error('GET /claims returned an unexpected shape; expected an array of claims.');
        }
        // Merge growing responses; a re-sent claim replaces its earlier verdict.
        const merged = new Map(claims.map(c => [String(c.claim), c]));
        updates.forEach(c => merged.set(String(c.claim), c));
        claims = [...merged.values()];
        refresh();
        if (claims.length > 0 && claims.length === lastSize) {
          stagnant += 1;
          // ~6.5s without growth → the backend has likely finished; stop polling
          // rather than hanging (zero-claim sessions keep polling until timeout).
          if (stagnant >= 10) break;
        } else {
          if (claims.length !== lastSize) { stagnant = 0; lastSize = claims.length; }
        }
      }
    };
    await Promise.all([stream(), poll()]);

    // If no claim text lined up with any sentence (backend may paraphrase
    // claims or segment differently), pair them by position as a fallback so
    // evidence is still attributable instead of the UI waiting forever.
    if (claims.length && !rows.some(r => matchClaim(r.text, claims))) {
      rows.forEach((row, i) => { if (claims[i]) row.fallbackIndex = i; });
    }
    if (!claims.length) {
      throw new Error('The API returned no verdicts for this answer. Please check your /claims endpoint.');
    }
    const matched = refresh();
    verified = true;
    $('status').textContent = matched === rows.length
      ? 'Verification complete'
      : `Verification complete · ${matched}/${rows.length} claims matched`;

    // GET /dashboard is a consistency check; counts shown always reflect the
    // visible sentences. A failed/mismatched dashboard must not bury the answer.
    try {
      const dashboard = await api.getDashboard(session_id, options);
      const local = emptyCounts();
      rows.forEach(row => { if (row.claim) local[row.claim.verdict]++; });
      if (VERDICTS.some(v => Number(dashboard?.[v]) !== local[v])) {
        console.warn('GET /dashboard counts differ from the visible answer:', dashboard, local);
      }
    } catch (dashboardError) {
      console.warn('GET /dashboard failed:', dashboardError);
      showError(`Answer verified, but GET /dashboard failed: ${dashboardError.message}`);
    }
  } catch (error) {
    controller.abort();
    showError(timedOut
      ? 'Verification timed out. Some sentences may still be unverified. Please try again or check your backend connection.'
      : (error.name === 'AbortError' && !timedOut
        ? 'The request was interrupted. Please try again.'
        : (error.message || 'Something went wrong. Please try again.')));
    $('status').textContent = verified ? $('status').textContent : 'Could not complete verification';
    $('answer-empty').hidden = rows.length > 0;
  } finally {
    clearTimeout(timeout);
    setBusy(false);
    refresh();
  }
});
