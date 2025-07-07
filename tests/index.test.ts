/**
 * Tests for Main Agent Initialization (index.ts)
 * 
 * Tests the main agent initialization process, configu    });
    
    mockInitializeErrorRecovery.mockReturnValue(undefined);
    
    // Reset fs-extra mock
    const fsExtra = require('fs-extra');
    fsExtra.default.ensureDir.mockResolvedValue(undefined);
    
    mockConfigManager.validateConfig.mockReturnValue({ion validation,
 * error recovery setup, and infrastructure bootstrapping.
 */

import { jest } from '@jest/globals';

// Mock all dependencies
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  },
  agentLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

jest.mock('../src/utils/errors', () => ({
  initializeErrorRecovery: jest.fn()
}));

jest.mock('../src/core/config/ConfigManager', () => ({
  ConfigManager: {
    initialize: jest.fn(),
    validateConfig: jest.fn(),
    getConfig: jest.fn()
  }
}));

jest.mock('../src/core/providers/BuiltinProviders', () => ({
  initializeProviders: jest.fn()
}));

jest.mock('fs-extra', () => ({
  __esModule: true,
  default: {
    ensureDir: jest.fn()
  }
}));

import { initializeAgent } from '../src/index';
import logger from '../src/utils/logger';
import { initializeErrorRecovery } from '../src/utils/errors';
import { ConfigManager } from '../src/core/config/ConfigManager';

const mockLogger = logger as jest.Mocked<typeof logger>;
const mockInitializeErrorRecovery = initializeErrorRecovery as jest.MockedFunction<typeof initializeErrorRecovery>;
const mockConfigManager = ConfigManager as jest.Mocked<typeof ConfigManager>;

describe('Agent Initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset all mocks to their default behavior
    mockConfigManager.initialize.mockReturnValue({
      providers: {
        llm: {},
        channels: {}
      },
      agent: {
        maxLoopIterations: 100,
        contextWindowSize: 4000,
        autoCommitChanges: false,
        requireApprovalForDestructive: true
      },
      logging: {
        level: 'info',
        maxFileSize: 5242880,
        maxFiles: 5,
        enableConsole: true,
        enableFile: true,
        logDirectory: 'logs'
      },
      errorHandling: {
        enableRecovery: true,
        defaultRetries: 3,
        defaultRetryDelay: 1000,
        enableSecurityLogging: true,
        enablePerformanceLogging: true
      },
      security: {
        allowedUsers: [],
        jwtSecret: 'test-secret',
        enableRateLimit: false,
        rateLimitWindow: 60000,
        rateLimitMaxRequests: 100
      }
    });
    mockConfigManager.validateConfig.mockReturnValue({
      isValid: true,
      errors: []
    });
    
    mockConfigManager.getConfig.mockReturnValue({
      logging: {
        level: 'info',
        maxFileSize: 5242880,
        maxFiles: 5,
        enableConsole: true,
        enableFile: true,
        logDirectory: './logs'
      },
      errorHandling: {
        enableRecovery: true,
        defaultRetries: 3,
        defaultRetryDelay: 1000,
        enableSecurityLogging: true,
        enablePerformanceLogging: true
      },
      agent: {
        maxLoopIterations: 10,
        contextWindowSize: 8192,
        autoCommitChanges: false,
        requireApprovalForDestructive: true
      },
      security: {
        allowedUsers: ['user1'],
        jwtSecret: 'test-secret',
        enableRateLimit: true,
        rateLimitWindow: 60000,
        rateLimitMaxRequests: 100
      },
      providers: {
        llm: {
          openai: {
            apiKey: 'test-key',
            model: 'gpt-4',
            maxTokens: 4096,
            temperature: 0.7
          }
        },
        channels: {
          slack: {
            botToken: 'test-token',
            signingSecret: 'test-secret',
            appToken: 'test-app-token'
          }
        }
      }
    });
  });

  describe('Successful Initialization', () => {
    it('should initialize agent successfully with valid configuration', async () => {
      const result = await initializeAgent();

      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(mockConfigManager.validateConfig).toHaveBeenCalled();
      expect(mockInitializeErrorRecovery).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('🚀 Initializing LLM Agent...');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Configuration validated');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Error recovery strategies initialized');
      expect(mockLogger.info).toHaveBeenCalledWith('🎉 Agent infrastructure initialized successfully');

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('logger');
    });

    it('should ensure required directories exist', async () => {
      const fsExtra = await import('fs-extra');
      
      await initializeAgent();

      expect(fsExtra.default.ensureDir).toHaveBeenCalledWith('./logs');
      expect(fsExtra.default.ensureDir).toHaveBeenCalledWith('./workspaces');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Logs directory ensured');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Workspaces directory ensured');
    });
  });

  describe('Configuration Validation Errors', () => {
    it('should throw error when configuration validation fails', async () => {
      mockConfigManager.validateConfig.mockReturnValue({
        isValid: false,
        errors: ['Missing OpenAI API key', 'Invalid Slack configuration']
      });

      await expect(initializeAgent()).rejects.toThrow(
        'Configuration validation failed: Missing OpenAI API key, Invalid Slack configuration'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Failed to initialize agent infrastructure',
        expect.objectContaining({
          error: expect.stringContaining('Configuration validation failed')
        })
      );
    });

    it('should handle single configuration error', async () => {
      mockConfigManager.validateConfig.mockReturnValue({
        isValid: false,
        errors: ['Missing required environment variable']
      });

      await expect(initializeAgent()).rejects.toThrow(
        'Configuration validation failed: Missing required environment variable'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration manager initialization errors', async () => {
      mockConfigManager.initialize.mockImplementation(() => {
        throw new Error('Failed to initialize ConfigManager');
      });

      await expect(initializeAgent()).rejects.toThrow('Failed to initialize ConfigManager');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Failed to initialize agent infrastructure',
        expect.objectContaining({
          error: 'Failed to initialize ConfigManager',
          stack: expect.any(String)
        })
      );
    });

    it('should handle error recovery initialization errors', async () => {
      mockInitializeErrorRecovery.mockImplementation(() => {
        throw new Error('Failed to initialize error recovery');
      });

      await expect(initializeAgent()).rejects.toThrow('Failed to initialize error recovery');
    });

    it('should handle filesystem errors gracefully', async () => {
      // Reset the error recovery mock first
      mockInitializeErrorRecovery.mockReturnValue(undefined);
      
      const fsExtra = await import('fs-extra');
      (fsExtra.default.ensureDir as jest.MockedFunction<any>).mockRejectedValue(new Error('Permission denied'));

      await expect(initializeAgent()).rejects.toThrow('Permission denied');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Failed to initialize agent infrastructure',
        expect.objectContaining({
          error: 'Permission denied'
        })
      );
    });

    it('should handle non-Error exceptions', async () => {
      // Reset other mocks first
      mockInitializeErrorRecovery.mockReturnValue(undefined);
      const fsExtra = await import('fs-extra');
      (fsExtra.default.ensureDir as jest.MockedFunction<any>).mockResolvedValue(undefined);
      
      mockConfigManager.initialize.mockImplementation(() => {
        throw 'String error';
      });

      await expect(initializeAgent()).rejects.toEqual('String error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Failed to initialize agent infrastructure',
        expect.objectContaining({
          error: 'String error',
          stack: undefined
        })
      );
    });
  });

  describe('Logging Behavior', () => {
    it('should log initialization steps in correct order', async () => {
      // Reset all mocks to successful state
      mockInitializeErrorRecovery.mockReturnValue(undefined);
      mockConfigManager.initialize.mockReturnValue({
        providers: { llm: {}, channels: {} },
        agent: { maxLoopIterations: 100, contextWindowSize: 4000, autoCommitChanges: false, requireApprovalForDestructive: true },
        logging: { level: 'info', maxFileSize: 5242880, maxFiles: 5, enableConsole: true, enableFile: true, logDirectory: 'logs' },
        errorHandling: { enableRecovery: true, defaultRetries: 3, defaultRetryDelay: 1000, enableSecurityLogging: true, enablePerformanceLogging: true },
        security: { allowedUsers: [], jwtSecret: 'test-secret', enableRateLimit: false, rateLimitWindow: 60000, rateLimitMaxRequests: 100 }
      });
      const fsExtra = await import('fs-extra');
      (fsExtra.default.ensureDir as jest.MockedFunction<any>).mockResolvedValue(undefined);
      
      await initializeAgent();

      const infoCallOrder = mockLogger.info.mock.calls.map(call => call[0]);
      
      expect(infoCallOrder).toEqual([
        '🚀 Initializing LLM Agent...',
        '✅ Configuration validated',
        '✅ Error recovery strategies initialized',
        '✅ Logs directory ensured',
        '✅ Workspaces directory ensured',
        '🎉 Agent infrastructure initialized successfully'
      ]);
    });

    it('should log both console error and structured error on failure', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockConfigManager.validateConfig.mockReturnValue({
        isValid: false,
        errors: ['Test error']
      });

      await expect(initializeAgent()).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ Failed to initialize agent infrastructure:',
        expect.any(Error)
      );
      expect(mockLogger.error).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Return Value Structure', () => {
    it('should return configuration and logger on successful initialization', async () => {
      // Reset all mocks to successful state
      mockInitializeErrorRecovery.mockReturnValue(undefined);
      mockConfigManager.initialize.mockReturnValue({
        providers: { llm: {}, channels: {} },
        agent: { maxLoopIterations: 100, contextWindowSize: 4000, autoCommitChanges: false, requireApprovalForDestructive: true },
        logging: { level: 'info', maxFileSize: 5242880, maxFiles: 5, enableConsole: true, enableFile: true, logDirectory: 'logs' },
        errorHandling: { enableRecovery: true, defaultRetries: 3, defaultRetryDelay: 1000, enableSecurityLogging: true, enablePerformanceLogging: true },
        security: { allowedUsers: [], jwtSecret: 'test-secret', enableRateLimit: false, rateLimitWindow: 60000, rateLimitMaxRequests: 100 }
      });
      const fsExtra = await import('fs-extra');
      (fsExtra.default.ensureDir as jest.MockedFunction<any>).mockResolvedValue(undefined);
      
      const result = await initializeAgent();

      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('logger');
      expect(result.config).toBe(mockConfigManager.getConfig());
      expect(result.logger).toBe(logger);
    });
  });
});
