import { config } from './config.js';

// Real backend adapter implementing the same three methods as mock-api.js:
//   POST /verify  GET /claims/{session_id}  GET /dashboard/{session_id}
// Selected automatically by api.js when config.mode === 'live'.
export function createLiveApi() {
  const endpoint = path => `${config.baseUrl.replace(/\/+$/, '')}${path}`;
  async function request(path, init = {}) {
    let response;
    try {
      response = await fetch(endpoint(path), { ...init, signal: init.signal ?? null });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new Error(`Could not reach the verification API at ${endpoint(path)}. ${error.message}`);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`API error ${response.status} on ${path}${detail ? `: ${detail}` : ''}`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error(`API returned invalid JSON on ${path}`);
    }
  }
  return {
    verify: ({ question, session_id }, { signal } = {}) =>
      request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, session_id }),
        signal,
      }),
    getClaims: (session_id, { signal } = {}) =>
      request(`/claims/${encodeURIComponent(session_id)}`, { signal }),
    getDashboard: (session_id, { signal } = {}) =>
      request(`/dashboard/${encodeURIComponent(session_id)}`, { signal }),
  };
}
