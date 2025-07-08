/**
 * Tests for Error Classes - Custom error types and error handling system
 * 
 * Tests error class hierarchies, error recovery strategies, validation helpers,
 * and error handler functionality.
 */

import { jest } from '@jest/globals';

// Mock logger before importing
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  logger: mockLogger
}));

import {
  AgentError,
  SlackError,
  OpenAIError,
  ActionError,
  ValidationError,
  WorkspaceError,
  GitError,
  SecurityError,
  ErrorHandler,
  RecoveryStrategy,
  withErrorHandling,
  handleRateLimit,
  validateRequired,
  validateType,
  initializeErrorRecovery
} from '../src/utils/errors';

describe('Error Classes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AgentError', () => {
    it('should create error with all properties', () => {
      const context = { userId: 'test-user', action: 'test-action' };
      const error = new AgentError('Test error', 'TEST_CODE', 400, true, context);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.context).toBe(context);
      expect(error.timestamp).toBeDefined();
      expect(error.name).toBe('AgentError');
    });

    it('should use default values', () => {
      const error = new AgentError('Test error', 'TEST_CODE');

      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.context).toBeUndefined();
    });

    it('should have proper stack trace', () => {
      const error = new AgentError('Test error', 'TEST_CODE');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AgentError');
    });

    it('should serialize to JSON correctly', () => {
      const context = { test: 'data' };
      const error = new AgentError('Test error', 'TEST_CODE', 400, true, context);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AgentError',
        message: 'Test error',
        code: 'TEST_CODE',
        statusCode: 400,
        isOperational: true,
        context: context,
        timestamp: error.timestamp,
        stack: error.stack
      });
    });
  });

  describe('SlackError', () => {
    it('should create Slack error with correct prefix', () => {
      const error = new SlackError('Slack API failed', 'API_ERROR', { channel: 'C123' });

      expect(error.code).toBe('SLACK_API_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ channel: 'C123' });
    });

    it('should inherit from AgentError', () => {
      const error = new SlackError('Test', 'TEST');
      expect(error).toBeInstanceOf(AgentError);
      expect(error).toBeInstanceOf(SlackError);
    });
  });

  describe('OpenAIError', () => {
    it('should map error codes to correct status codes', () => {
      const testCases = [
        { code: 'RATE_LIMIT_EXCEEDED', expectedStatus: 429 },
        { code: 'INSUFFICIENT_QUOTA', expectedStatus: 401 },
        { code: 'INVALID_API_KEY', expectedStatus: 401 },
        { code: 'INVALID_REQUEST', expectedStatus: 400 },
        { code: 'MODEL_NOT_FOUND', expectedStatus: 404 },
        { code: 'SERVER_ERROR', expectedStatus: 500 },
        { code: 'TIMEOUT', expectedStatus: 408 },
        { code: 'UNKNOWN_ERROR', expectedStatus: 500 }
      ];

      testCases.forEach(({ code, expectedStatus }) => {
        const error = new OpenAIError('Test error', code);
        expect(error.code).toBe(`OPENAI_${code}`);
        expect(error.statusCode).toBe(expectedStatus);
      });
    });

    it('should inherit from AgentError', () => {
      const error = new OpenAIError('Test', 'TEST');
      expect(error).toBeInstanceOf(AgentError);
      expect(error).toBeInstanceOf(OpenAIError);
    });
  });

  describe('ActionError', () => {
    it('should create action error with correct prefix', () => {
      const error = new ActionError('Action failed', 'EXECUTION_FAILED', { actionId: '123' });

      expect(error.code).toBe('ACTION_EXECUTION_FAILED');
      expect(error.statusCode).toBe(500);
      expect(error.context).toEqual({ actionId: '123' });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with field context', () => {
      const error = new ValidationError('Field is required', 'ERROR', { field: 'username', value: null });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.context).toEqual({ field: 'username', value: null });
    });
  });

  describe('WorkspaceError', () => {
    it('should create workspace error with workspace context', () => {
      const error = new WorkspaceError('Access denied', 'ACCESS_DENIED', { workspace: '/workspace/test', reason: 'permissions' });

      expect(error.code).toBe('WORKSPACE_ACCESS_DENIED');
      expect(error.context).toEqual({ workspace: '/workspace/test', reason: 'permissions' });
    });

    it('should handle missing workspace parameter', () => {
      const error = new WorkspaceError('Test error', 'TEST');

      expect(error.code).toBe('WORKSPACE_TEST');
      expect(error.context).toBeUndefined();
    });
  });

  describe('GitError', () => {
    it('should create git error with repository context', () => {
      const error = new GitError('Commit failed', 'COMMIT_FAILED', { repository: '/repo/test', branch: 'main' });

      expect(error.code).toBe('GIT_COMMIT_FAILED');
      expect(error.context).toEqual({ repository: '/repo/test', branch: 'main' });
    });
  });

  describe('SecurityError', () => {
    it('should create security error with user context', () => {
      const error = new SecurityError('Unauthorized access', 'UNAUTHORIZED', { user: 'user-123', ip: '192.168.1.1' });

      expect(error.code).toBe('SECURITY_UNAUTHORIZED');
      expect(error.statusCode).toBe(403);
      expect(error.context).toEqual({ user: 'user-123', ip: '192.168.1.1' });
    });
  });
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    // Clear any existing recovery configs
    (errorHandler as any).recoveryConfigs.clear();
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const handler1 = ErrorHandler.getInstance();
      const handler2 = ErrorHandler.getInstance();
      expect(handler1).toBe(handler2);
    });
  });

  describe('registerRecoveryStrategy', () => {
    it('should register recovery strategy', () => {
      const config = {
        strategy: RecoveryStrategy.RETRY,
        maxRetries: 3,
        retryDelay: 1000
      };

      errorHandler.registerRecoveryStrategy('TEST_ERROR', config);

      const recoveryConfigs = (errorHandler as any).recoveryConfigs;
      expect(recoveryConfigs.get('TEST_ERROR')).toBe(config);
    });
  });

  describe('handleError', () => {
    it('should log and re-throw non-agent errors', async () => {
      const regularError = new Error('Regular error');
      
      await expect(errorHandler.handleError(regularError, { context: 'test' }))
        .rejects.toThrow('Regular error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error: Regular error',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Regular error'
          }),
          context: { context: 'test' }
        })
      );
    });

    it('should attempt recovery for agent errors with registered strategies', async () => {
      const agentError = new AgentError('Test error', 'TEST_ERROR');
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.SKIP
      });

      const result = await errorHandler.handleError(agentError);

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting recovery for error TEST_ERROR using strategy skip',
        expect.any(Object)
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping operation due to error TEST_ERROR',
        expect.any(Object)
      );
    });

    it('should re-throw agent errors without recovery strategies', async () => {
      const agentError = new AgentError('Test error', 'UNREGISTERED_ERROR');
      
      await expect(errorHandler.handleError(agentError))
        .rejects.toThrow('Test error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Agent error: Test error',
        expect.objectContaining({
          error: agentError.toJSON()
        })
      );
    });
  });

  describe('recovery strategies', () => {
    it('should handle SKIP strategy', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.SKIP
      });

      const result = await errorHandler.handleError(error);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping operation due to error TEST_ERROR',
        expect.objectContaining({ error: error.toJSON() })
      );
    });

    it('should handle FALLBACK strategy with successful fallback', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      const fallbackResult = { success: true };
      const fallbackAction = jest.fn() as jest.MockedFunction<() => Promise<any>>;
      fallbackAction.mockResolvedValue(fallbackResult);
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.FALLBACK,
        fallbackAction
      });

      const result = await errorHandler.handleError(error);

      expect(result).toBe(fallbackResult);
      expect(fallbackAction).toHaveBeenCalledTimes(1);
    });

    it('should handle FALLBACK strategy with failed fallback', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      const fallbackError = new Error('Fallback failed');
      const fallbackAction = jest.fn() as jest.MockedFunction<() => Promise<any>>;
      fallbackAction.mockRejectedValue(fallbackError);
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.FALLBACK,
        fallbackAction
      });

      await expect(errorHandler.handleError(error)).rejects.toThrow('Test error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Fallback action failed',
        expect.objectContaining({
          originalError: error.toJSON(),
          fallbackError
        })
      );
    });

    it('should handle FALLBACK strategy without fallback action', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.FALLBACK
      });

      await expect(errorHandler.handleError(error)).rejects.toThrow('Test error');
    });

    it('should handle MANUAL_INTERVENTION strategy', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.MANUAL_INTERVENTION
      });

      await expect(errorHandler.handleError(error)).rejects.toThrow('Manual intervention required');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Manual intervention required for error TEST_ERROR',
        expect.any(Object)
      );
    });

    it('should handle ABORT strategy', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.ABORT
      });

      await expect(errorHandler.handleError(error)).rejects.toThrow('Test error');
    });

    it('should handle RETRY strategy (placeholder implementation)', async () => {
      const error = new AgentError('Test error', 'TEST_ERROR');
      
      errorHandler.registerRecoveryStrategy('TEST_ERROR', {
        strategy: RecoveryStrategy.RETRY,
        maxRetries: 1,
        retryDelay: 100
      });

      // Mock setTimeout to avoid actual delays
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await expect(errorHandler.handleError(error)).rejects.toThrow('Test error');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrying operation (attempt 1/1) after 100ms',
        expect.any(Object)
      );

      (global.setTimeout as any).mockRestore();
    });
  });
});

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withErrorHandling', () => {
    it('should execute operation successfully', async () => {
      const operation = jest.fn() as jest.MockedFunction<() => Promise<string>>;
      operation.mockResolvedValue('success');
      
      const result = await withErrorHandling(operation, { context: 'test' });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle errors through error handler', async () => {
      const operation = jest.fn() as jest.MockedFunction<() => Promise<string>>;
      operation.mockRejectedValue(new Error('Test error'));
      
      await expect(withErrorHandling(operation, { context: 'test' }))
        .rejects.toThrow('Test error');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('handleRateLimit', () => {
    it('should wait for specified delay', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await handleRateLimit(new Error('Rate limit'), 2000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limit encountered, waiting 2000ms before retry',
        { delay: 2000 }
      );

      (global.setTimeout as any).mockRestore();
    });

    it('should use default delay when not specified', async () => {
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      await handleRateLimit(new Error('Rate limit'));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Rate limit encountered, waiting 5000ms before retry',
        { delay: 5000 }
      );

      (global.setTimeout as any).mockRestore();
    });
  });

  describe('validateRequired', () => {
    it('should not throw for valid values', () => {
      expect(() => validateRequired('value', 'field')).not.toThrow();
      expect(() => validateRequired(0, 'field')).not.toThrow();
      expect(() => validateRequired(false, 'field')).not.toThrow();
    });

    it('should throw ValidationError for undefined values', () => {
      expect(() => validateRequired(undefined, 'field'))
        .toThrow(ValidationError);
      expect(() => validateRequired(undefined, 'field'))
        .toThrow('field is required');
    });

    it('should throw ValidationError for null values', () => {
      expect(() => validateRequired(null, 'field'))
        .toThrow(ValidationError);
    });

    it('should throw ValidationError for empty strings', () => {
      expect(() => validateRequired('', 'field'))
        .toThrow(ValidationError);
    });
  });

  describe('validateType', () => {
    it('should not throw for correct types', () => {
      expect(() => validateType('string', 'string', 'field')).not.toThrow();
      expect(() => validateType(123, 'number', 'field')).not.toThrow();
      expect(() => validateType(true, 'boolean', 'field')).not.toThrow();
      expect(() => validateType({}, 'object', 'field')).not.toThrow();
    });

    it('should throw ValidationError for incorrect types', () => {
      expect(() => validateType(123, 'string', 'field'))
        .toThrow(ValidationError);
      expect(() => validateType(123, 'string', 'field'))
        .toThrow('field must be of type string');
    });
  });

  describe('initializeErrorRecovery', () => {
    it('should register default recovery strategies', () => {
      const errorHandler = ErrorHandler.getInstance();
      const recoveryConfigs = (errorHandler as any).recoveryConfigs;
      
      // Clear existing configs
      recoveryConfigs.clear();
      
      initializeErrorRecovery();

      expect(recoveryConfigs.has('OPENAI_RATE_LIMIT')).toBe(true);
      expect(recoveryConfigs.has('SLACK_API_ERROR')).toBe(true);
      expect(recoveryConfigs.has('GIT_OPERATION_FAILED')).toBe(true);
      expect(recoveryConfigs.has('WORKSPACE_ACCESS_DENIED')).toBe(true);
      expect(recoveryConfigs.has('SECURITY_VIOLATION')).toBe(true);
    });

    it('should configure OpenAI rate limit strategy correctly', () => {
      const errorHandler = ErrorHandler.getInstance();
      const recoveryConfigs = (errorHandler as any).recoveryConfigs;
      
      recoveryConfigs.clear();
      initializeErrorRecovery();

      const config = recoveryConfigs.get('OPENAI_RATE_LIMIT');
      expect(config).toEqual({
        strategy: RecoveryStrategy.RETRY,
        maxRetries: 3,
        retryDelay: 5000,
        shouldRetry: expect.any(Function)
      });

      // Test shouldRetry function
      if (config?.shouldRetry) {
        expect(config.shouldRetry(new Error(), 1)).toBe(true);
        expect(config.shouldRetry(new Error(), 3)).toBe(true);
        expect(config.shouldRetry(new Error(), 4)).toBe(false);
      }
    });

    it('should configure security violation strategy as ABORT', () => {
      const errorHandler = ErrorHandler.getInstance();
      const recoveryConfigs = (errorHandler as any).recoveryConfigs;
      
      recoveryConfigs.clear();
      initializeErrorRecovery();

      const config = recoveryConfigs.get('SECURITY_VIOLATION');
      expect(config?.strategy).toBe(RecoveryStrategy.ABORT);
    });

    it('should configure workspace access denied as MANUAL_INTERVENTION', () => {
      const errorHandler = ErrorHandler.getInstance();
      const recoveryConfigs = (errorHandler as any).recoveryConfigs;
      
      recoveryConfigs.clear();
      initializeErrorRecovery();

      const config = recoveryConfigs.get('WORKSPACE_ACCESS_DENIED');
      expect(config?.strategy).toBe(RecoveryStrategy.MANUAL_INTERVENTION);
    });
  });
});

describe('Error Integration', () => {
  it('should work with error handler initialization', () => {
    initializeErrorRecovery();
    const errorHandler = ErrorHandler.getInstance();
    
    expect(errorHandler).toBeInstanceOf(ErrorHandler);
    
    const recoveryConfigs = (errorHandler as any).recoveryConfigs;
    expect(recoveryConfigs.size).toBeGreaterThan(0);
  });

  it('should create errors with proper timestamps', () => {
    const now = Date.now();
    const error = new AgentError('Test', 'TEST');
    const errorTime = new Date(error.timestamp).getTime();
    
    expect(errorTime).toBeGreaterThanOrEqual(now);
    expect(errorTime).toBeLessThanOrEqual(now + 1000);
  });

  it('should maintain error inheritance chain', () => {
    const slackError = new SlackError('Test', 'TEST');
    
    expect(slackError instanceof SlackError).toBe(true);
    expect(slackError instanceof AgentError).toBe(true);
    expect(slackError instanceof Error).toBe(true);
  });
});
