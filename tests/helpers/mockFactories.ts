/**
 * Test utilities for mocking with proper TypeScript support
 */

import { jest } from '@jest/globals';

/**
 * Create mock implementations for async functions
 */
export function createAsyncMock<T = undefined>(value?: T) {
  return jest.fn().mockResolvedValue(value) as jest.MockedFunction<() => Promise<T>>;
}

/**
 * Create mock implementations for sync functions
 */
export function createSyncMock<T>(value: T) {
  return jest.fn().mockReturnValue(value) as jest.MockedFunction<() => T>;
}

/**
 * Create a mock with error simulation
 */
export function createErrorMock(error: Error) {
  return jest.fn().mockRejectedValue(error) as jest.MockedFunction<() => Promise<never>>;
}

/**
 * Create a basic mock function
 */
export function createMockFn() {
  return jest.fn() as jest.MockedFunction<(...args: any[]) => any>;
}

/**
 * Common mock factory functions
 */
export const mockFactories = {
  logger: () => ({
    info: createMockFn(),
    warn: createMockFn(),
    error: createMockFn(),
    debug: createMockFn(),
    child: jest.fn(() => mockFactories.logger()),
  }),

  configManager: () => ({
    initialize: createAsyncMock({}),
    getConfig: createSyncMock({
      openai: { apiKey: 'test-key' },
      slack: { botToken: 'test-token', signingSecret: 'test-secret', appToken: 'test-app-token' },
      llm: { defaultModel: 'gpt-3.5-turbo' },
      agent: { features: { monitoring: true } },
    }),
    validateConfiguration: createSyncMock({ isValid: true, errors: [] }),
  }),

  llmProvider: () => ({
    generateResponse: createAsyncMock('Mock response'),
    getProviderName: createSyncMock('openai'),
    getCapabilities: createSyncMock({}),
    healthCheck: createAsyncMock(true),
    destroy: createMockFn(),
  }),

  messageChannel: () => ({
    sendMessage: createAsyncMock(undefined),
    start: createAsyncMock(undefined),
    stop: createAsyncMock(undefined),
    getChannelName: createSyncMock('slack'),
    getCapabilities: createSyncMock({}),
    healthCheck: createAsyncMock(true),
  }),

  orchestrator: () => ({
    initialize: createAsyncMock(undefined),
    processRequest: createAsyncMock({
      response: 'Mock orchestrated response',
      metadata: { tokens: 100 },
    }),
    destroy: createMockFn(),
  }),

  errorRecovery: () => ({
    initialize: createAsyncMock(undefined),
    handleError: createAsyncMock(undefined),
  }),

  slackApp: () => ({
    start: createAsyncMock(undefined),
    stop: createAsyncMock(undefined),
    event: createMockFn(),
  }),

  slackWebClient: () => ({
    chat: {
      postMessage: createAsyncMock({ ok: true, ts: '12345' }),
      update: createAsyncMock({ ok: true }),
    },
    conversations: {
      history: createAsyncMock({
        ok: true,
        messages: []
      }),
    },
  }),

  openAIIntegration: () => ({
    processStructuredRequest: createAsyncMock({
      response: { userMessage: 'Test response' },
      validation: { validCommands: [], invalidCommands: [] },
      tokenUsage: { total: 100 },
      budgetStatus: { isNearLimit: false }
    }),
  }),

  builtinProviders: () => ({
    initialize: createAsyncMock(undefined),
  }),
};
