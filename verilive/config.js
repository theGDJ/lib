// ── API switch ─────────────────────────────────────────────────────────────
// 'mock' = fully offline demo (default). Works with zero network calls.
// 'live' = real backend implementing the API contract:
//            POST /verify
//            GET  /claims/{session_id}
//            GET  /dashboard/{session_id}
// Set baseUrl to the backend origin, e.g. 'http://localhost:8000',
// or '' when the backend is served from the same origin as this page.
// Nothing else needs to change: api.js picks the matching client.
export const config = {
  mode: 'mock',
  baseUrl: '',
  requestTimeoutMs: 12000,
  verificationTimeoutMs: 60000,
  pollIntervalMs: 650,
  sentenceDelayMs: 650,
};
