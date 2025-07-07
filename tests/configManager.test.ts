/**
 * Tests for ConfigManager - Provider-Agnostic Configuration System
 * 
 * Tests initialization, provider config management, validation,
 * and environment handling.
 */

import { jest } from '@jest/globals';
import { ConfigManager, SystemConfig, ProviderConfig } from '../src/core/config/ConfigManager';

// Mock logger to avoid file system operations during tests
jest.mock('../src/utils/logger', () => ({
  agentLogger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Clear any existing configuration
    (ConfigManager as any).config = null;
    (ConfigManager as any).customConfigs = new Map();
    
    // Reset environment variables
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
    delete process.env.MAX_LOOP_ITERATIONS;
    delete process.env.CONTEXT_WINDOW_SIZE;
    delete process.env.AUTO_COMMIT_CHANGES;
    delete process.env.REQUIRE_APPROVAL_FOR_DESTRUCTIVE_ACTIONS;
    delete process.env.ALLOWED_USERS;
    delete process.env.JWT_SECRET;
    delete process.env.ENABLE_RATE_LIMIT;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MAX_TOKENS;
    delete process.env.OPENAI_TEMPERATURE;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.SLACK_APP_TOKEN;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('initialize', () => {
    it('should initialize with default configuration', () => {
      const config = ConfigManager.initialize();

      expect(config).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.errorHandling).toBeDefined();
      expect(config.agent).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.providers).toBeDefined();
      expect(config.providers.llm).toBeDefined();
      expect(config.providers.channels).toBeDefined();
    });

    it('should return same config instance on subsequent calls', () => {
      const config1 = ConfigManager.initialize();
      const config2 = ConfigManager.initialize();

      expect(config1).toBe(config2);
    });

    it('should load configuration from environment variables', () => {
      process.env.LOG_LEVEL = 'debug';
      process.env.MAX_LOOP_ITERATIONS = '100';
      process.env.CONTEXT_WINDOW_SIZE = '16000';
      process.env.AUTO_COMMIT_CHANGES = 'true';
      process.env.REQUIRE_APPROVAL_FOR_DESTRUCTIVE_ACTIONS = 'false';
      process.env.ALLOWED_USERS = 'user1,user2,user3';
      process.env.JWT_SECRET = 'test-secret';
      process.env.ENABLE_RATE_LIMIT = 'false';
      process.env.RATE_LIMIT_WINDOW_MS = '30000';
      process.env.RATE_LIMIT_MAX_REQUESTS = '200';

      const config = ConfigManager.initialize();

      expect(config.logging.level).toBe('debug');
      expect(config.agent.maxLoopIterations).toBe(100);
      expect(config.agent.contextWindowSize).toBe(16000);
      expect(config.agent.autoCommitChanges).toBe(true);
      expect(config.agent.requireApprovalForDestructive).toBe(false);
      expect(config.security.allowedUsers).toEqual(['user1', 'user2', 'user3']);
      expect(config.security.jwtSecret).toBe('test-secret');
      expect(config.security.enableRateLimit).toBe(false);
      expect(config.security.rateLimitWindow).toBe(30000);
      expect(config.security.rateLimitMaxRequests).toBe(200);
    });

    it('should configure OpenAI provider when API key is present', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.OPENAI_MODEL = 'gpt-3.5-turbo';
      process.env.OPENAI_MAX_TOKENS = '2048';
      process.env.OPENAI_TEMPERATURE = '0.5';

      const config = ConfigManager.initialize();

      expect(config.providers.llm.openai).toBeDefined();
      expect(config.providers.llm.openai!.enabled).toBe(true);
      expect(config.providers.llm.openai!.apiKey).toBe('test-openai-key');
      expect(config.providers.llm.openai!.model).toBe('gpt-3.5-turbo');
      expect(config.providers.llm.openai!.maxTokens).toBe(2048);
      expect(config.providers.llm.openai!.temperature).toBe(0.5);
    });

    it('should configure Slack provider when tokens are present', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test-bot-token';
      process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
      process.env.SLACK_APP_TOKEN = 'xapp-test-app-token';

      const config = ConfigManager.initialize();

      expect(config.providers.channels.slack).toBeDefined();
      expect(config.providers.channels.slack!.enabled).toBe(true);
      expect(config.providers.channels.slack!.botToken).toBe('xoxb-test-bot-token');
      expect(config.providers.channels.slack!.signingSecret).toBe('test-signing-secret');
      expect(config.providers.channels.slack!.appToken).toBe('xapp-test-app-token');
    });

    it('should set console logging based on NODE_ENV', () => {
      process.env.NODE_ENV = 'production';
      const prodConfig = ConfigManager.initialize();
      expect(prodConfig.logging.enableConsole).toBe(false);

      // Reset for development test
      (ConfigManager as any).config = null;
      process.env.NODE_ENV = 'development';
      const devConfig = ConfigManager.initialize();
      expect(devConfig.logging.enableConsole).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return existing config if already initialized', () => {
      const config1 = ConfigManager.initialize();
      const config2 = ConfigManager.getConfig();

      expect(config1).toBe(config2);
    });

    it('should initialize config if not already initialized', () => {
      const config = ConfigManager.getConfig();

      expect(config).toBeDefined();
      expect(config.logging).toBeDefined();
    });
  });

  describe('getLLMProviderConfig', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'test-key';
      ConfigManager.initialize();
    });

    it('should return provider config if it exists', () => {
      const openaiConfig = ConfigManager.getLLMProviderConfig('openai');

      expect(openaiConfig).toBeDefined();
      expect(openaiConfig?.apiKey).toBe('test-key');
    });

    it('should return undefined for non-existent provider', () => {
      const nonExistentConfig = ConfigManager.getLLMProviderConfig('non-existent');

      expect(nonExistentConfig).toBeUndefined();
    });
  });

  describe('getChannelProviderConfig', () => {
    beforeEach(() => {
      process.env.SLACK_BOT_TOKEN = 'test-bot-token';
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      process.env.SLACK_APP_TOKEN = 'test-app-token';
      ConfigManager.initialize();
    });

    it('should return provider config if it exists', () => {
      const slackConfig = ConfigManager.getChannelProviderConfig('slack');

      expect(slackConfig).toBeDefined();
      expect(slackConfig?.botToken).toBe('test-bot-token');
    });

    it('should return undefined for non-existent provider', () => {
      const nonExistentConfig = ConfigManager.getChannelProviderConfig('non-existent');

      expect(nonExistentConfig).toBeUndefined();
    });
  });

  describe('registerConfigLoader and getCustomConfig', () => {
    it('should register and retrieve custom configuration', () => {
      const customData = { feature: 'enabled', value: 42 };
      const loader = jest.fn(() => customData);

      ConfigManager.registerConfigLoader('custom-feature', loader);

      expect(loader).toHaveBeenCalledTimes(1);

      const retrieved = ConfigManager.getCustomConfig('custom-feature');
      expect(retrieved).toEqual(customData);
    });

    it('should handle loader errors', () => {
      const loader = jest.fn(() => {
        throw new Error('Loader failed');
      });

      expect(() => {
        ConfigManager.registerConfigLoader('failing-loader', loader);
      }).toThrow('Loader failed');
    });

    it('should return undefined for non-existent custom config', () => {
      const result = ConfigManager.getCustomConfig('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateProviderConfig', () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = 'original-key';
      ConfigManager.initialize();
    });

    it('should update existing LLM provider config', () => {
      const newConfig = { model: 'gpt-4-turbo', temperature: 0.3 };
      
      ConfigManager.updateProviderConfig('llm', 'openai', newConfig);
      
      const updatedConfig = ConfigManager.getLLMProviderConfig('openai');
      expect(updatedConfig?.model).toBe('gpt-4-turbo');
      expect(updatedConfig?.temperature).toBe(0.3);
      expect(updatedConfig?.apiKey).toBe('original-key'); // Should preserve existing values
    });

    it('should create new provider config if it does not exist', () => {
      const newConfig = { apiKey: 'new-provider-key', model: 'new-model' };
      
      ConfigManager.updateProviderConfig('llm', 'new-provider', newConfig);
      
      const providerConfig = ConfigManager.getLLMProviderConfig('new-provider');
      expect(providerConfig?.apiKey).toBe('new-provider-key');
      expect(providerConfig?.model).toBe('new-model');
    });

    it('should update channel provider config', () => {
      process.env.SLACK_BOT_TOKEN = 'original-token';
      process.env.SLACK_SIGNING_SECRET = 'original-secret';
      process.env.SLACK_APP_TOKEN = 'original-app-token';
      
      // Re-initialize to pick up Slack config
      (ConfigManager as any).config = null;
      ConfigManager.initialize();
      
      const newConfig = { customSetting: 'custom-value' };
      
      ConfigManager.updateProviderConfig('channels', 'slack', newConfig);
      
      const updatedConfig = ConfigManager.getChannelProviderConfig('slack');
      expect(updatedConfig?.customSetting).toBe('custom-value');
      expect(updatedConfig?.botToken).toBe('original-token'); // Should preserve existing values
    });
  });

  describe('validateConfig', () => {
    it('should pass validation for valid configuration', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.SLACK_BOT_TOKEN = 'test-bot-token';
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      process.env.SLACK_APP_TOKEN = 'test-app-token';
      process.env.MAX_LOOP_ITERATIONS = '50';
      process.env.CONTEXT_WINDOW_SIZE = '8000';
      
      ConfigManager.initialize();
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should fail validation for invalid loop iterations', () => {
      process.env.MAX_LOOP_ITERATIONS = '0';
      
      ConfigManager.initialize();
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('MAX_LOOP_ITERATIONS must be greater than 0');
    });

    it('should fail validation for invalid context window size', () => {
      process.env.CONTEXT_WINDOW_SIZE = '-1';
      
      ConfigManager.initialize();
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('CONTEXT_WINDOW_SIZE must be greater than 0');
    });

    it('should fail validation when no LLM providers are enabled', () => {
      // No provider environment variables set
      ConfigManager.initialize();
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('At least one LLM provider must be configured and enabled');
    });

    it('should fail validation when no channel providers are enabled', () => {
      process.env.OPENAI_API_KEY = 'test-key'; // Enable LLM but no channels
      
      ConfigManager.initialize();
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('At least one channel provider must be configured and enabled');
    });

    it('should validate OpenAI provider configuration', () => {
      process.env.OPENAI_API_KEY = ''; // Empty key should fail validation
      process.env.SLACK_BOT_TOKEN = 'test-bot-token';
      process.env.SLACK_SIGNING_SECRET = 'test-secret';
      process.env.SLACK_APP_TOKEN = 'test-app-token';
      
      // Manually create invalid OpenAI config
      (ConfigManager as any).config = null;
      ConfigManager.initialize();
      ConfigManager.updateProviderConfig('llm', 'openai', { enabled: true, apiKey: '', model: '' });
      
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('OpenAI API key is required');
      expect(validation.errors).toContain('OpenAI model is required');
    });

    it('should validate Slack provider configuration', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      // Manually create invalid Slack config
      ConfigManager.initialize();
      ConfigManager.updateProviderConfig('channels', 'slack', { 
        enabled: true, 
        botToken: '', 
        signingSecret: '', 
        appToken: '' 
      });
      
      const validation = ConfigManager.validateConfig();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Slack bot token is required');
      expect(validation.errors).toContain('Slack signing secret is required');
      expect(validation.errors).toContain('Slack app token is required');
    });
  });

  describe('getEnvironmentConfig', () => {
    it('should return development environment by default', () => {
      delete process.env.NODE_ENV;
      
      const envConfig = ConfigManager.getEnvironmentConfig();

      expect(envConfig.environment).toBe('development');
      expect(envConfig.isDevelopment).toBe(true);
      expect(envConfig.isProduction).toBe(false);
    });

    it('should return production environment when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      
      const envConfig = ConfigManager.getEnvironmentConfig();

      expect(envConfig.environment).toBe('production');
      expect(envConfig.isDevelopment).toBe(false);
      expect(envConfig.isProduction).toBe(true);
    });

    it('should return test environment when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      
      const envConfig = ConfigManager.getEnvironmentConfig();

      expect(envConfig.environment).toBe('test');
      expect(envConfig.isDevelopment).toBe(false);
      expect(envConfig.isProduction).toBe(false);
    });
  });

  describe('defaultConfig export', () => {
    it('should export a default configuration', () => {
      // Import to trigger the export
      const { defaultConfig } = require('../src/core/config/ConfigManager');
      
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.logging).toBeDefined();
      expect(defaultConfig.agent).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty string environment variables gracefully', () => {
      process.env.ALLOWED_USERS = '';
      process.env.JWT_SECRET = '';
      
      const config = ConfigManager.initialize();

      expect(config.security.allowedUsers).toEqual([]);
      expect(config.security.jwtSecret).toBe('');
    });

    it('should handle invalid numeric environment variables', () => {
      process.env.MAX_LOOP_ITERATIONS = 'not-a-number';
      process.env.CONTEXT_WINDOW_SIZE = 'invalid';
      process.env.RATE_LIMIT_WINDOW_MS = 'bad-value';
      process.env.RATE_LIMIT_MAX_REQUESTS = 'also-bad';
      process.env.OPENAI_MAX_TOKENS = 'non-numeric';
      process.env.OPENAI_TEMPERATURE = 'not-float';
      
      const config = ConfigManager.initialize();

      // Should fall back to defaults or NaN (which evaluates as falsy in validation)
      expect(isNaN(config.agent.maxLoopIterations)).toBe(true);
      expect(isNaN(config.agent.contextWindowSize)).toBe(true);
      expect(isNaN(config.security.rateLimitWindow)).toBe(true);
      expect(isNaN(config.security.rateLimitMaxRequests)).toBe(true);
    });

    it('should handle provider config with disabled flag', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      
      ConfigManager.initialize();
      
      // Disable the provider
      ConfigManager.updateProviderConfig('llm', 'openai', { enabled: false });
      
      const validation = ConfigManager.validateConfig();
      
      // Should fail because no enabled LLM providers
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('At least one LLM provider must be configured and enabled');
    });
  });
});
