// Test-only stub of the real backend, implementing the API contract:
//   POST /verify · GET /claims/{session_id} · GET /dashboard/{session_id}
// Claims arrive gradually over /claims (700ms each). Deliberately, claim text is
// PARAPHRASED relative to the answer sentences so tests exercise the UI's
// positional fallback for backends that don't echo sentence text verbatim.
import http from 'node:http';

export const STUB_PORT = 5055;

const ANSWER = [
  'Solar panels convert sunlight into electricity without burning fuel.',
  'Most homes can cut their electricity bills by going solar, depending on local rates.',
  'A typical installation pays for itself in about five years in favorable markets.',
  'Solar panels add exactly four percent to every home’s resale value.',
  'Solar panels keep producing full power all night.',
];
const CLAIMS = [
  { claim: 'Photovoltaic systems turn sunlight into electricity without combustion.', evidence: 'A photovoltaic array converts sunlight directly into electricity; no fuel is burned during operation.', source: 'stub-corpus.md', similarity: 0.94, verdict: 'SUPPORTED' },
  { claim: 'Going solar can reduce electricity bills when local tariffs are favorable.', evidence: 'Self-generation offsets grid purchases; savings scale with local tariff rates and on-site consumption.', source: 'stub-corpus.md', similarity: 0.89, verdict: 'SUPPORTED' },
  { claim: 'Under favorable incentives, installations can recoup costs in roughly five years, though payback varies.', evidence: 'Payback around five years is achievable with strong incentives, but real-world payback ranges much wider.', source: 'stub-corpus.md', similarity: 0.82, verdict: 'PARTIAL' },
  { claim: 'Solar panels raise every home’s resale value by exactly four percent.', evidence: 'No document in the stub corpus establishes a fixed percentage increase for every home.', source: 'stub-corpus.md', similarity: 0.19, verdict: 'INSUFFICIENT' },
  { claim: 'Solar panels continue generating at full capacity overnight.', evidence: 'Photovoltaic cells require daylight and produce no output at full darkness.', source: 'stub-corpus.md', similarity: 0.97, verdict: 'CONTRADICTED' },
];
const VERDICTS = ['SUPPORTED', 'PARTIAL', 'INSUFFICIENT', 'CONTRADICTED'];
const sessions = new Map();
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
};
const available = session =>
  CLAIMS.slice(0, Math.min(CLAIMS.length, Math.floor((Date.now() - session.startedAt) / 700)));

export function startStub() {
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
    const url = new URL(req.url, `http://127.0.0.1:${STUB_PORT}`);
    if (req.method === 'POST' && url.pathname === '/verify') {
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        try {
          const { question, session_id } = JSON.parse(raw || '{}');
          if (typeof question !== 'string' || !question.trim() || typeof session_id !== 'string') {
            return json(res, 400, { error: 'question and session_id required' });
          }
          sessions.set(session_id, { startedAt: Date.now() });
          setTimeout(() => json(res, 200, { answer: ANSWER.join(' '), claims: [] }), 400);
        } catch { json(res, 400, { error: 'invalid JSON' }); }
      });
      return;
    }
    const claimsMatch = url.pathname.match(/^\/claims\/([^/]+)$/);
    if (req.method === 'GET' && claimsMatch) {
      const session = sessions.get(decodeURIComponent(claimsMatch[1]));
      if (!session) return json(res, 404, { error: 'unknown session' });
      return json(res, 200, available(session));
    }
    const dashMatch = url.pathname.match(/^\/dashboard\/([^/]+)$/);
    if (req.method === 'GET' && dashMatch) {
      const session = sessions.get(decodeURIComponent(dashMatch[1]));
      if (!session) return json(res, 404, { error: 'unknown session' });
      const counts = Object.fromEntries(VERDICTS.map(v => [v, 0]));
      available(session).forEach(c => { counts[c.verdict] += 1; });
      return json(res, 200, counts);
    }
    json(res, 404, { error: 'not found' });
  });
  return new Promise(resolve => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}
