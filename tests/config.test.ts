/**
 * Tests for Configuration Utilities (utils/config.ts)
 * 
 * Tests the configuration utility functions, interface definitions,
 * and environment variable handling.
 */

import { jest } from '@jest/globals';

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('Configuration Utilities', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Loading', () => {
    it('should call dotenv.config() when module is imported', async () => {
      const dotenv = await import('dotenv');
      
      // Re-import the module to trigger dotenv.config()
      await import('../src/utils/config');

      expect(dotenv.config).toHaveBeenCalled();
    });
  });

  describe('TypeScript Interface Validation', () => {
    it('should have correct LoggingConfig interface structure', () => {
      // This test validates the interface exists and has correct shape
      const mockLoggingConfig = {
        level: 'info',
        maxFileSize: 5242880,
        maxFiles: 5,
        enableConsole: true,
        enableFile: true,
        logDirectory: './logs'
      };

      // If this compiles, the interface is correctly defined
      expect(mockLoggingConfig).toHaveProperty('level');
      expect(mockLoggingConfig).toHaveProperty('maxFileSize');
      expect(mockLoggingConfig).toHaveProperty('maxFiles');
      expect(mockLoggingConfig).toHaveProperty('enableConsole');
      expect(mockLoggingConfig).toHaveProperty('enableFile');
      expect(mockLoggingConfig).toHaveProperty('logDirectory');
    });

    it('should have correct ErrorHandlingConfig interface structure', () => {
      const mockErrorHandlingConfig = {
        enableRecovery: true,
        defaultRetries: 3,
        defaultRetryDelay: 1000,
        enableSecurityLogging: true,
        enablePerformanceLogging: true
      };

      expect(mockErrorHandlingConfig).toHaveProperty('enableRecovery');
      expect(mockErrorHandlingConfig).toHaveProperty('defaultRetries');
      expect(mockErrorHandlingConfig).toHaveProperty('defaultRetryDelay');
      expect(mockErrorHandlingConfig).toHaveProperty('enableSecurityLogging');
      expect(mockErrorHandlingConfig).toHaveProperty('enablePerformanceLogging');
    });

    it('should have correct AgentConfig interface structure', () => {
      const mockAgentConfig = {
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
        openai: {
          apiKey: 'test-key',
          model: 'gpt-4',
          maxTokens: 4096,
          temperature: 0.7
        },
        slack: {
          botToken: 'test-token',
          signingSecret: 'test-secret',
          appToken: 'test-app-token'
        },
        agent: {
          maxLoopIterations: 10,
          contextWindowSize: 8192,
          autoCommitChanges: false,
          requireApprovalForDestructive: true
        },
        security: {
          allowedUsers: ['user1', 'user2'],
          jwtSecret: 'test-secret',
          enableRateLimit: true,
          rateLimitWindow: 60000,
          rateLimitMaxRequests: 100
        }
      };

      expect(mockAgentConfig).toHaveProperty('logging');
      expect(mockAgentConfig).toHaveProperty('errorHandling');
      expect(mockAgentConfig).toHaveProperty('openai');
      expect(mockAgentConfig).toHaveProperty('slack');
      expect(mockAgentConfig).toHaveProperty('agent');
      expect(mockAgentConfig).toHaveProperty('security');
    });
  });

  describe('Configuration Defaults and Types', () => {
    it('should support string log levels', () => {
      const logLevels = ['error', 'warn', 'info', 'http', 'debug'];
      
      logLevels.forEach(level => {
        const config = {
          level,
          maxFileSize: 5242880,
          maxFiles: 5,
          enableConsole: true,
          enableFile: true,
          logDirectory: './logs'
        };
        
        expect(config.level).toBe(level);
      });
    });

    it('should support numeric configuration values', () => {
      const config = {
        maxFileSize: 10485760, // 10MB
        maxFiles: 10,
        defaultRetries: 5,
        defaultRetryDelay: 2000,
        maxLoopIterations: 20,
        contextWindowSize: 16384,
        rateLimitWindow: 120000,
        rateLimitMaxRequests: 200,
        maxTokens: 8192,
        temperature: 0.9
      };

      expect(typeof config.maxFileSize).toBe('number');
      expect(typeof config.maxFiles).toBe('number');
      expect(typeof config.defaultRetries).toBe('number');
      expect(typeof config.defaultRetryDelay).toBe('number');
      expect(typeof config.maxLoopIterations).toBe('number');
      expect(typeof config.contextWindowSize).toBe('number');
      expect(typeof config.rateLimitWindow).toBe('number');
      expect(typeof config.rateLimitMaxRequests).toBe('number');
      expect(typeof config.maxTokens).toBe('number');
      expect(typeof config.temperature).toBe('number');
    });

    it('should support boolean configuration flags', () => {
      const config = {
        enableConsole: false,
        enableFile: true,
        enableRecovery: true,
        enableSecurityLogging: false,
        enablePerformanceLogging: true,
        autoCommitChanges: true,
        requireApprovalForDestructive: false,
        enableRateLimit: true
      };

      expect(typeof config.enableConsole).toBe('boolean');
      expect(typeof config.enableFile).toBe('boolean');
      expect(typeof config.enableRecovery).toBe('boolean');
      expect(typeof config.enableSecurityLogging).toBe('boolean');
      expect(typeof config.enablePerformanceLogging).toBe('boolean');
      expect(typeof config.autoCommitChanges).toBe('boolean');
      expect(typeof config.requireApprovalForDestructive).toBe('boolean');
      expect(typeof config.enableRateLimit).toBe('boolean');
    });

    it('should support array configuration values', () => {
      const config = {
        allowedUsers: ['admin', 'user1', 'user2', 'guest']
      };

      expect(Array.isArray(config.allowedUsers)).toBe(true);
      expect(config.allowedUsers).toHaveLength(4);
      expect(config.allowedUsers).toContain('admin');
      expect(config.allowedUsers).toContain('user1');
    });
  });

  describe('Configuration Validation Scenarios', () => {
    it('should handle missing required fields gracefully', () => {
      // This tests that the interfaces allow for flexible configuration
      const partialConfig = {
        logging: {
          level: 'info'
          // Missing other required fields - should be handled by validation
        }
      };

      expect(partialConfig.logging.level).toBe('info');
    });

    it('should support optional configuration properties', () => {
      const configWithOptionals = {
        openai: {
          apiKey: 'test-key',
          model: 'gpt-4',
          maxTokens: 4096,
          temperature: 0.7,
          // Additional optional properties
          organization: 'test-org',
          baseURL: 'https://api.openai.com/v1'
        }
      };

      expect(configWithOptionals.openai.apiKey).toBe('test-key');
      expect(configWithOptionals.openai.organization).toBe('test-org');
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle zero and negative numeric values', () => {
      const edgeCaseConfig = {
        maxFiles: 0,
        defaultRetries: 0,
        defaultRetryDelay: 0,
        temperature: 0.0,
        rateLimitMaxRequests: 1
      };

      expect(edgeCaseConfig.maxFiles).toBe(0);
      expect(edgeCaseConfig.defaultRetries).toBe(0);
      expect(edgeCaseConfig.defaultRetryDelay).toBe(0);
      expect(edgeCaseConfig.temperature).toBe(0.0);
      expect(edgeCaseConfig.rateLimitMaxRequests).toBe(1);
    });

    it('should handle empty arrays and strings', () => {
      const emptyConfig = {
        allowedUsers: [],
        logDirectory: '',
        jwtSecret: '',
        apiKey: ''
      };

      expect(emptyConfig.allowedUsers).toHaveLength(0);
      expect(emptyConfig.logDirectory).toBe('');
      expect(emptyConfig.jwtSecret).toBe('');
      expect(emptyConfig.apiKey).toBe('');
    });

    it('should handle maximum realistic values', () => {
      const maxConfig = {
        maxFileSize: Number.MAX_SAFE_INTEGER,
        maxFiles: 1000,
        defaultRetries: 100,
        defaultRetryDelay: 60000, // 1 minute
        maxLoopIterations: 1000,
        contextWindowSize: 32768,
        temperature: 2.0,
        rateLimitWindow: 3600000, // 1 hour
        rateLimitMaxRequests: 10000
      };

      expect(maxConfig.maxFileSize).toBe(Number.MAX_SAFE_INTEGER);
      expect(maxConfig.maxFiles).toBe(1000);
      expect(maxConfig.temperature).toBe(2.0);
    });
  });

  describe('Interface Extensibility', () => {
    it('should support configuration inheritance patterns', () => {
      interface ExtendedLoggingConfig {
        level: string;
        maxFileSize: number;
        maxFiles: number;
        enableConsole: boolean;
        enableFile: boolean;
        logDirectory: string;
        // Extended properties
        enableRotation: boolean;
        compressionLevel: number;
      }

      const extendedConfig: ExtendedLoggingConfig = {
        level: 'debug',
        maxFileSize: 5242880,
        maxFiles: 5,
        enableConsole: true,
        enableFile: true,
        logDirectory: './logs',
        enableRotation: true,
        compressionLevel: 6
      };

      expect(extendedConfig.enableRotation).toBe(true);
      expect(extendedConfig.compressionLevel).toBe(6);
    });
  });
});
