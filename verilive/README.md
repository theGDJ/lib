# Verilive — AI answers, verified claim by claim

Frontend for the Verilive hackathon demo: type a question, watch an answer stream
in sentence by sentence, see a color-coded verdict badge on each sentence, click
any sentence for its matched evidence/source/verdict, and watch the summary counts
update live.

Plain HTML/CSS/ES modules — **no build step, no runtime dependencies.**

## Run the demo (mock mode, fully offline)

```bash
cd verilive
python3 -m http.server 8080        # any static file server works
# open http://localhost:8080
```

The default config is `mode: 'mock'`: every response comes from `mock-api.js`
with artificial delays (sentences stream ~650ms apart; verdicts trickle in via
`GET /claims` polling). Nothing on the network needs to work.

Two demo fixtures: ask about **solar energy** (default suggestion) or **AI /
language models** — each returns 5 sentences with the full 2 supported / 1 partial
/ 1 insufficient / 1 contradicted mix. Typing `/error` as the question triggers
the mock's failure path to demo the error state.

## Point it at the real backend

Edit **`config.js`** only:

```js
export const config = {
  mode: 'live',                  // ← 'mock' | 'live'
  baseUrl: 'http://localhost:8000',  // backend origin; '' = same origin
  ...
};
```

`api.js` is the single swap point — it selects `mock-api.js` or `live-api.js`
based on `config.mode`. No component imports mock data. `live-api.js` calls the
contract as specified:

- `POST /verify` with `{ question, session_id }` → `{ answer, claims }`
- `GET /claims/{session_id}` → growing claims array (polled every 650ms until
  every sentence has a verdict, or ~6.5s with no new claims)
- `GET /dashboard/{session_id}` → verdict counts (consistency check)

Backend requirements to note:

- `session_id` is generated client-side per submission (`crypto.randomUUID`).
- Claim matching is text-based (exact after normalization, or containment).
  If a backend returns **no text overlap** between claims and answer sentences,
  the UI falls back to pairing claims to sentences **by position** — so claims
  should ideally be 1:1 with the answer's sentences.
- CORS: if `baseUrl` is a different origin, allow this page's origin.
- A 60s watchdog (`verificationTimeoutMs`) turns any true hang into a visible
  error message.

## Tests

```bash
node --test verilive/tests/mock.test.mjs   # zero-dependency mock contract tests
```

Optional browser smoke tests (dev-only, need Playwright):

```bash
npm install --no-save playwright && npx playwright install chromium
node verilive/tests/browser.mjs    # full mock-mode UI flow, offline, mobile
node verilive/tests/live-browser.mjs  # flips config to live, runs against tests/live-stub.mjs, restores config
```

## Scope

Built exactly to the agreed six features (input → streaming answer → verdict
badges → evidence panel → summary counts → loading/error states). No file
upload, cross-model comparison, risk weighting, or drift tracking.

Mock disclaimer: mock answers and source excerpts are **illustrative fixtures,
not retrieved or real citations** — the UI labels them as such.
