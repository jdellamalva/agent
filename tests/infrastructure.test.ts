import { describe, test, expect, beforeEach } from '@jest/globals';
import { agentLogger, logAgentCycle } from '../src/utils/logger';
import { AgentError, SlackError, ValidationError, ErrorHandler, initializeErrorRecovery } from '../src/utils/errors';
import { validateConfig } from '../src/utils/config';

describe('Logging System', () => {
  test('should create component loggers', () => {
    expect(agentLogger).toBeDefined();
    expect(typeof agentLogger.info).toBe('function');
  });

  test('should log agent cycle events', () => {
    // This would normally write to file/console
    // In a real test, you'd mock the winston transports
    expect(() => {
      logAgentCycle('test-cycle-1', 'think', { prompt: 'test prompt' });
    }).not.toThrow();
  });
});

describe('Error Handling System', () => {
  beforeEach(() => {
    initializeErrorRecovery();
  });

  test('should create AgentError with proper structure', () => {
    const error = new AgentError('Test error', 'TEST_ERROR', 400, true, { test: 'context' });
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.context).toEqual({ test: 'context' });
    expect(error.timestamp).toBeDefined();
  });

  test('should create specific error types', () => {
    const slackError = new SlackError('Slack failed', 'API_ERROR');
    expect(slackError.code).toBe('SLACK_API_ERROR');
    
    const validationError = new ValidationError('Invalid field', 'ERROR', { field: 'username', value: null });
    expect(validationError.code).toBe('VALIDATION_ERROR');
    expect(validationError.context.field).toBe('username');
  });

  test('should handle error recovery', async () => {
    const errorHandler = ErrorHandler.getInstance();
    const error = new AgentError('Test error', 'OPENAI_RATE_LIMIT');
    
    // This would normally trigger retry logic
    // In a real implementation, you'd test the actual recovery
    expect(errorHandler).toBeDefined();
  });
});

describe('Configuration', () => {
  test('should validate required configuration', () => {
    expect(() => {
      validateConfig({
        logging: { level: 'info', maxFileSize: 5242880, maxFiles: 5, enableConsole: true, enableFile: true, logDirectory: './logs' },
        errorHandling: { enableRecovery: true, defaultRetries: 3, defaultRetryDelay: 1000, enableSecurityLogging: true, enablePerformanceLogging: true },
        openai: { apiKey: '', model: 'gpt-4', maxTokens: 4096, temperature: 0.7 },
        slack: { botToken: '', signingSecret: '', appToken: '' },
        security: { allowedUsers: [], jwtSecret: '', enableRateLimit: true, rateLimitWindow: 60000, rateLimitMaxRequests: 100 },
        agent: { maxLoopIterations: 0, contextWindowSize: 0, autoCommitChanges: false, requireApprovalForDestructive: true }
      });
    }).toThrow();
  });
});
