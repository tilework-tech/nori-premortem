/**
 * Mock implementation of @anthropic-ai/claude-agent-sdk for testing.
 * This file is required via NODE_OPTIONS when running e2e tests.
 */

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id) {
  if (id === '@anthropic-ai/claude-agent-sdk') {
    return {
      query: async function* ({ prompt, options }) {
        const sessionId = require('crypto').randomUUID();

        // Yield messages matching the real SDK format
        yield {
          type: 'system',
          session_id: sessionId,
          model: options?.model || 'claude-sonnet-4',
        };

        yield {
          type: 'init',
          session_id: sessionId,
          message: {
            role: 'user',
            content: prompt,
          },
        };

        yield {
          type: 'assistant',
          session_id: sessionId,
          message: {
            role: 'assistant',
            content: 'Mock diagnostic analysis: System metrics analyzed.',
          },
        };

        yield {
          type: 'result',
          session_id: sessionId,
          result: 'Mock agent completed successfully',
          total_cost_usd: 0.0,
          duration_ms: 100,
          usage: { input_tokens: 10, output_tokens: 20 },
        };
      },
    };
  }
  return originalRequire.apply(this, arguments);
};

console.log('[Mock SDK] Claude Agent SDK mock loaded');
