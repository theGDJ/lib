import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockApi } from '../mock-api.js';
import { delay, VERDICTS } from '../utils.js';
test('mock matches contract and gradually publishes all four verdicts', async () => {
  const api = createMockApi({ initialDelayMs: 0, verdictDelayMs: 20, networkDelayMs: 0 });
  const result = await api.verify({ question: 'Explain solar energy', session_id: 'test' });
  assert.equal(typeof result.answer, 'string');
  assert.deepEqual(result.claims, []);
  assert.ok((await api.getClaims('test')).length < 5);
  await delay(120);
  const claims = await api.getClaims('test');
  assert.equal(claims.length, 5);
  for (const c of claims) {
    for (const key of ['claim', 'evidence', 'source']) assert.equal(typeof c[key], 'string');
    assert.equal(typeof c.similarity, 'number');
    assert.ok(VERDICTS.includes(c.verdict));
  }
  assert.deepEqual(await api.getDashboard('test'), { SUPPORTED: 2, PARTIAL: 1, INSUFFICIENT: 1, CONTRADICTED: 1 });
});
test('mock supports alternate fixture, explicit failure, validation and cancellation', async () => {
  const api = createMockApi({ initialDelayMs: 1 });
  assert.match((await api.verify({ question: 'How reliable is AI?', session_id: 'ai' })).answer, /tokens/);
  await assert.rejects(api.verify({ question: '/error', session_id: 'fail' }), /Simulated/);
  await assert.rejects(api.verify({ question: ' ', session_id: 'bad' }), /required/);
  await assert.rejects(api.getClaims('missing'), /not found/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.verify({ question: 'solar', session_id: 'stop' }, { signal: controller.signal }), { name: 'AbortError' });
});
