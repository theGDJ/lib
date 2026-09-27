// All illustrative data and mock timing live here, not in UI components.
// These are invented source excerpts for demonstration, not retrieved documents.
import { delay, emptyCounts } from './utils.js';
const solar = [
  { claim: 'Solar panels generate electricity from sunlight without direct greenhouse gas emissions during operation.', evidence: 'Photovoltaic cells convert sunlight into electricity. During operation, the panels do not burn fuel or directly emit greenhouse gases; manufacturing and disposal still have environmental impacts.', source: 'Demo · Solar energy primer.pdf', similarity: 0.96, verdict: 'SUPPORTED' },
  { claim: 'Installing solar panels can reduce electricity bills, although savings depend on local conditions.', evidence: 'Bill savings vary with system size, sunlight, electricity tariffs, financing costs, and the amount of power used on site.', source: 'Demo · Residential solar guide.pdf', similarity: 0.92, verdict: 'SUPPORTED' },
  { claim: 'A typical home solar installation pays for itself within five years.', evidence: 'Some installations can recover their initial cost in around five years under favorable incentives and tariffs, but payback periods vary widely and may be substantially longer.', source: 'Demo · Residential solar guide.pdf', similarity: 0.84, verdict: 'PARTIAL' },
  { claim: 'Solar panels increase the resale value of every home by exactly four percent.', evidence: 'The available demo documents contain no evidence establishing a universal percentage increase in home resale value.', source: 'Demo · Residential solar guide.pdf', similarity: 0.24, verdict: 'INSUFFICIENT' },
  { claim: 'Solar panels continue generating electricity at full capacity throughout the night.', evidence: 'Photovoltaic panels require sunlight and do not generate electricity at night. Batteries or the grid can supply power when solar generation is unavailable.', source: 'Demo · Solar energy primer.pdf', similarity: 0.97, verdict: 'CONTRADICTED' },
];
const ai = [
  { claim: 'AI language models generate text by predicting tokens based on patterns learned during training.', evidence: 'Language models learn statistical relationships between tokens and use the preceding context to estimate likely next tokens.', source: 'Demo · Language models explained.pdf', similarity: 0.95, verdict: 'SUPPORTED' },
  { claim: 'Providing source documents can improve the factual grounding of an AI answer.', evidence: 'Retrieval can supply relevant context and improve grounding, but does not guarantee that a generated response accurately represents the source.', source: 'Demo · Grounded generation notes.pdf', similarity: 0.91, verdict: 'SUPPORTED' },
  { claim: 'Larger language models always produce more accurate answers.', evidence: 'Increasing model size can improve performance on some evaluations. Accuracy also depends on data quality, task, prompting, and evaluation conditions.', source: 'Demo · Language models explained.pdf', similarity: 0.83, verdict: 'PARTIAL' },
  { claim: 'AI assistants save every worker exactly ten hours each week.', evidence: 'The demo documents contain no study establishing this universal weekly time saving.', source: 'Demo · Grounded generation notes.pdf', similarity: 0.21, verdict: 'INSUFFICIENT' },
  { claim: 'A language model can never produce a factual error when it sounds confident.', evidence: 'Fluent and confident text can contain fabricated or incorrect information. Confidence of expression is not a reliable indicator of factual accuracy.', source: 'Demo · Grounded generation notes.pdf', similarity: 0.98, verdict: 'CONTRADICTED' },
];
export function createMockApi({ initialDelayMs = 850, verdictDelayMs = 1100, networkDelayMs = 160 } = {}) {
  const sessions = new Map();
  const find = id => {
    if (!sessions.has(id)) throw new Error('Demo session not found. Please submit your question again.');
    return sessions.get(id);
  };
  const available = session => structuredClone(session.claims.slice(0, Math.min(session.claims.length, Math.floor((Date.now() - session.startedAt) / verdictDelayMs))));
  return {
    async verify({ question, session_id }, { signal } = {}) {
      if (!question?.trim() || !session_id) throw new Error('A question and session ID are required.');
      await delay(initialDelayMs, signal);
      if (question.trim().toLowerCase() === '/error') throw new Error('Simulated request failure. Please try another question.');
      const claims = /\b(ai|artificial intelligence|language model|llm)\b/i.test(question) ? ai : solar;
      sessions.clear();
      sessions.set(session_id, { claims, startedAt: Date.now() });
      return { answer: claims.map(c => c.claim).join(' '), claims: [] };
    },
    async getClaims(session_id, { signal } = {}) {
      await delay(networkDelayMs, signal);
      return available(find(session_id));
    },
    async getDashboard(session_id, { signal } = {}) {
      await delay(networkDelayMs, signal);
      return available(find(session_id)).reduce((counts, c) => { counts[c.verdict]++; return counts; }, emptyCounts());
    },
  };
}
