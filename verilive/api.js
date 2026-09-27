import { config } from './config.js';
import { createMockApi } from './mock-api.js';
import { createLiveApi } from './live-api.js';

// Single swap point for the whole app: components only ever import `api`.
// config.mode === 'mock' → offline demo with artificial delays.
// config.mode === 'live' → real backend via live-api.js.
export const api = config.mode === 'live' ? createLiveApi() : createMockApi();
