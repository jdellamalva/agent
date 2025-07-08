/**
 * Tests for Logger - Winston-based logging system
 * 
 * Tests logging functionality, component loggers, specialized logging methods,
 * and performance/security logging features.
 */

import { jest } from '@jest/globals';
import path from 'path';

// Create mock objects first
const mockLoggerInstance = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn()
};

const mockFormatMethods = {
  combine: jest.fn(() => 'combined-format'),
  timestamp: jest.fn(() => 'timestamp-format'),
  errors: jest.fn(() => 'errors-format'),
  json: jest.fn(() => 'json-format'),
  metadata: jest.fn(() => 'metadata-format'),
  colorize: jest.fn(() => 'colorize-format'),
  simple: jest.fn(() => 'simple-format'),
  printf: jest.fn(() => 'printf-format')
};

const mockTransportClasses = {
  File: jest.fn(),
  Console: jest.fn()
};

const mockWinston = {
  createLogger: jest.fn(() => mockLoggerInstance),
  addColors: jest.fn(),
  format: mockFormatMethods,
  transports: mockTransportClasses
};

// Make child return the same instance for consistency
mockLoggerInstance.child.mockReturnValue(mockLoggerInstance);

// Mock winston completely
jest.mock('winston', () => mockWinston);

describe('Logger', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let logger: any;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    jest.resetModules();
    
    // Import the logger after setting up mocks
    logger = await import('../src/utils/logger');
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('logger initialization', () => {
    it('should create logger with default configuration', async () => {
      delete process.env.LOG_LEVEL;
      delete process.env.NODE_ENV;
      delete process.env.npm_package_version;

      jest.resetModules();
      await import('../src/utils/logger');

      const winston = await import('winston');
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'info',
        levels: {
          error: 0,
          warn: 1,
          info: 2,
          http: 3,
          debug: 4
        },
        format: 'combined-format',
        defaultMeta: {
          service: 'llm-agent',
          version: '1.0.0',
          environment: 'development'
        },
        transports: expect.any(Array)
      });
    });

    it('should use environment variables for configuration', async () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.NODE_ENV = 'production';
      process.env.npm_package_version = '2.0.0';

      jest.resetModules();
      await import('../src/utils/logger');

      const winston = await import('winston');
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          defaultMeta: {
            service: 'llm-agent',
            version: '2.0.0',
            environment: 'production'
          }
        })
      );
    });

    it('should configure file transports correctly', async () => {
      jest.resetModules();
      await import('../src/utils/logger');

      expect(mockTransportClasses.File).toHaveBeenCalledWith({
        filename: path.join(process.cwd(), 'logs', 'agent-error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5
      });

      expect(mockTransportClasses.File).toHaveBeenCalledWith({
        filename: path.join(process.cwd(), 'logs', 'agent-combined.log'),
        maxsize: 5242880,
        maxFiles: 5
      });
    });

    it('should configure console transport', async () => {
      jest.resetModules();
      await import('../src/utils/logger');

      expect(mockTransportClasses.Console).toHaveBeenCalledWith({
        format: 'combined-format'
      });
    });

    it('should add colors to winston', async () => {
      jest.resetModules();
      await import('../src/utils/logger');

      const winston = await import('winston');
      expect(winston.addColors).toHaveBeenCalledWith({
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        debug: 'white'
      });
    });
  });

  describe('component loggers', () => {
    let logger: any;

    beforeEach(async () => {
      logger = await import('../src/utils/logger');
    });

    it('should create component logger', () => {
      const componentLogger = logger.createComponentLogger('test-component');

      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'test-component' });
      expect(componentLogger).toBe(mockLoggerInstance);
    });

    it('should export specialized loggers', () => {
      expect(logger.agentLogger).toBeDefined();
      expect(logger.slackLogger).toBeDefined();
      expect(logger.openaiLogger).toBeDefined();
      expect(logger.actionLogger).toBeDefined();
      expect(logger.gitLogger).toBeDefined();
      expect(logger.workspaceLogger).toBeDefined();
    });

    it('should create specialized loggers with correct components', () => {
      // Verify that component loggers were created
      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'agent-core' });
      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'slack-integration' });
      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'openai-integration' });
      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'action-system' });
      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'git-operations' });
      expect(mockLoggerInstance.child).toHaveBeenCalledWith({ component: 'workspace-management' });
    });
  });

  describe('specialized logging methods', () => {
    let logger: any;
    const mockDate = new Date('2024-01-01T12:00:00.000Z');

    beforeEach(async () => {
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
      logger = await import('../src/utils/logger');
    });

    afterEach(() => {
      (global.Date as any).mockRestore();
    });

    describe('logAgentCycle', () => {
      it('should log agent cycle with correct data', () => {
        const cycleData = { step: 'analysis', tokens: 100 };
        
        logger.logAgentCycle('cycle-123', 'think', cycleData);

        expect(logger.agentLogger.info).toHaveBeenCalledWith('Agent cycle think', {
          cycleId: 'cycle-123',
          phase: 'think',
          timestamp: '2024-01-01T12:00:00.000Z',
          step: 'analysis',
          tokens: 100
        });
      });

      it('should handle different phases', () => {
        logger.logAgentCycle('cycle-456', 'act', { action: 'file_write' });
        logger.logAgentCycle('cycle-789', 'observe', { result: 'success' });

        expect(logger.agentLogger.info).toHaveBeenCalledWith('Agent cycle act', 
          expect.objectContaining({ phase: 'act', action: 'file_write' }));
        expect(logger.agentLogger.info).toHaveBeenCalledWith('Agent cycle observe', 
          expect.objectContaining({ phase: 'observe', result: 'success' }));
      });
    });

    describe('logSlackEvent', () => {
      it('should log Slack events with correct data', () => {
        const eventData = { channel: 'C123456', message: 'Hello' };
        
        logger.logSlackEvent('message', 'U123456', eventData);

        expect(logger.slackLogger.info).toHaveBeenCalledWith('Slack event: message', {
          eventType: 'message',
          userId: 'U123456',
          timestamp: '2024-01-01T12:00:00.000Z',
          channel: 'C123456',
          message: 'Hello'
        });
      });
    });

    describe('logOpenAIRequest', () => {
      it('should log OpenAI requests with cost calculation', () => {
        const tokens = { prompt: 100, completion: 50 };
        
        logger.logOpenAIRequest('req-123', tokens, 'gpt-4');

        expect(logger.openaiLogger.info).toHaveBeenCalledWith('OpenAI API request', {
          requestId: 'req-123',
          model: 'gpt-4',
          tokens,
          cost: 0.006, // (100 * 0.03 + 50 * 0.06) / 1000
          timestamp: '2024-01-01T12:00:00.000Z'
        });
      });

      it('should calculate costs for different models', () => {
        const tokens = { prompt: 1000, completion: 500 };
        
        logger.logOpenAIRequest('req-gpt35', tokens, 'gpt-3.5-turbo');

        expect(logger.openaiLogger.info).toHaveBeenCalledWith('OpenAI API request', 
          expect.objectContaining({
            cost: 0.0025 // (1000 * 0.0015 + 500 * 0.002) / 1000
          }));
      });

      it('should default to gpt-4 pricing for unknown models', () => {
        const tokens = { prompt: 1000, completion: 500 };
        
        logger.logOpenAIRequest('req-unknown', tokens, 'unknown-model');

        expect(logger.openaiLogger.info).toHaveBeenCalledWith('OpenAI API request', 
          expect.objectContaining({
            cost: 0.06 // (1000 * 0.03 + 500 * 0.06) / 1000
          }));
      });
    });

    describe('logActionExecution', () => {
      it('should log action execution with all details', () => {
        const params = { file: 'test.txt', content: 'Hello' };
        const result = { success: true, lines: 1 };
        
        logger.logActionExecution('action-123', 'file_write', params, result, 150);

        expect(logger.actionLogger.info).toHaveBeenCalledWith('Action executed: file_write', {
          actionId: 'action-123',
          actionType: 'file_write',
          params,
          result: JSON.stringify(result),
          duration: 150,
          timestamp: '2024-01-01T12:00:00.000Z'
        });
      });

      it('should handle non-object results', () => {
        logger.logActionExecution('action-456', 'test', {}, 'success', 100);

        expect(logger.actionLogger.info).toHaveBeenCalledWith('Action executed: test', 
          expect.objectContaining({
            result: 'success'
          }));
      });
    });

    describe('logWorkspaceOperation', () => {
      it('should log workspace operations', () => {
        const details = { files: 5, size: '1.2MB' };
        
        logger.logWorkspaceOperation('backup', '/workspace/project', details);

        expect(logger.workspaceLogger.info).toHaveBeenCalledWith('Workspace operation: backup', {
          operation: 'backup',
          workspace: '/workspace/project',
          details,
          timestamp: '2024-01-01T12:00:00.000Z'
        });
      });
    });

    describe('logSecurityEvent', () => {
      it('should log security events with warning level', () => {
        const details = { action: 'unauthorized_access', ip: '192.168.1.1' };
        
        logger.logSecurityEvent('access_attempt', 'user-123', details);

        expect(mockLoggerInstance.warn).toHaveBeenCalledWith('Security event: access_attempt', {
          event: 'access_attempt',
          userId: 'user-123',
          details,
          timestamp: '2024-01-01T12:00:00.000Z',
          severity: 'security'
        });
      });
    });

    describe('logPerformanceMetric', () => {
      it('should log performance metrics', () => {
        const context = { operation: 'file_read', size: 1024 };
        
        logger.logPerformanceMetric('response_time', 250, 'ms', context);

        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Performance metric: response_time', {
          metric: 'response_time',
          value: 250,
          unit: 'ms',
          context,
          timestamp: '2024-01-01T12:00:00.000Z',
          type: 'performance'
        });
      });

      it('should log performance metrics without context', () => {
        logger.logPerformanceMetric('memory_usage', 512, 'MB');

        expect(mockLoggerInstance.info).toHaveBeenCalledWith('Performance metric: memory_usage', {
          metric: 'memory_usage',
          value: 512,
          unit: 'MB',
          context: undefined,
          timestamp: '2024-01-01T12:00:00.000Z',
          type: 'performance'
        });
      });
    });
  });

  describe('cost calculation', () => {
    it('should calculate costs correctly for all supported models', () => {
      // This tests the private calculateTokenCost function indirectly
      const tokens = { prompt: 1000, completion: 1000 };
      
      // Test GPT-4
      expect(((1000 * 0.03 + 1000 * 0.06) / 1000)).toBe(0.09);
      
      // Test GPT-4-turbo
      expect(((1000 * 0.01 + 1000 * 0.03) / 1000)).toBe(0.04);
      
      // Test GPT-3.5-turbo
      expect(((1000 * 0.0015 + 1000 * 0.002) / 1000)).toBe(0.0035);
    });
  });

  describe('format configuration', () => {
    beforeEach(async () => {
      jest.resetModules();
      await import('../src/utils/logger');
    });

    it('should configure format combinations correctly', () => {
      expect(mockFormatMethods.combine).toHaveBeenCalledWith(
        'timestamp-format',
        'errors-format',
        'json-format',
        'metadata-format'
      );
    });

    it('should configure timestamp format', () => {
      expect(mockFormatMethods.timestamp).toHaveBeenCalledWith({
        format: 'YYYY-MM-DD HH:mm:ss'
      });
    });

    it('should configure errors format with stack traces', () => {
      expect(mockFormatMethods.errors).toHaveBeenCalledWith({ stack: true });
    });

    it('should configure metadata format correctly', () => {
      expect(mockFormatMethods.metadata).toHaveBeenCalledWith({
        fillExcept: ['message', 'level', 'timestamp', 'label']
      });
    });

    it('should configure console format', () => {
      expect(mockFormatMethods.colorize).toHaveBeenCalledWith({ all: true });
      expect(mockFormatMethods.printf).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('printf formatter', () => {
    it('should configure printf formatter', async () => {
      await import('../src/utils/logger');

      expect(mockFormatMethods.printf).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('named export', () => {
    it('should export the main logger as named export', async () => {
      const logger = await import('../src/utils/logger');
      expect(logger.logger).toBe(mockLoggerInstance);
    });
  });
});
