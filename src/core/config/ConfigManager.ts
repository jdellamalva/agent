/**
 * Provider-Agnostic Configuration System
 * 
 * Handles dynamic configuration loading for different providers
 * while maintaining a unified interface.
 */

import dotenv from 'dotenv';
import { agentLogger } from '../../utils/logger';

dotenv.config();

const logger = agentLogger.child({ component: 'config-manager' });

export interface BaseConfig {
  logging: LoggingConfig;
  errorHandling: ErrorHandlingConfig;
  agent: AgentConfig;
  security: SecurityConfig;
}

export interface LoggingConfig {
  level: string;
  maxFileSize: number;
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
  logDirectory: string;
}

export interface ErrorHandlingConfig {
  enableRecovery: boolean;
  defaultRetries: number;
  defaultRetryDelay: number;
  enableSecurityLogging: boolean;
  enablePerformanceLogging: boolean;
}

export interface AgentConfig {
  maxLoopIterations: number;
  contextWindowSize: number;
  autoCommitChanges: boolean;
  requireApprovalForDestructive: boolean;
}

export interface SecurityConfig {
  allowedUsers: string[];
  jwtSecret: string;
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
}

export interface ProviderConfig {
  [key: string]: any;
}

export interface SystemConfig extends BaseConfig {
  providers: {
    llm: { [name: string]: ProviderConfig };
    channels: { [name: string]: ProviderConfig };
  };
}

/**
 * Configuration manager for the agent system
 */
export class ConfigManager {
  private static config: SystemConfig | null = null;
  private static customConfigs: Map<string, any> = new Map();

  /**
   * Initialize the configuration system
   */
  static initialize(): SystemConfig {
    if (this.config) {
      return this.config;
    }

    this.config = {
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        maxFileSize: 5242880, // 5MB
        maxFiles: 5,
        enableConsole: process.env.NODE_ENV !== 'production',
        enableFile: true,
        logDirectory: './logs',
      },
      errorHandling: {
        enableRecovery: true,
        defaultRetries: 3,
        defaultRetryDelay: 1000,
        enableSecurityLogging: true,
        enablePerformanceLogging: true,
      },
      agent: {
        maxLoopIterations: parseInt(process.env.MAX_LOOP_ITERATIONS || '50'),
        contextWindowSize: parseInt(process.env.CONTEXT_WINDOW_SIZE || '8000'),
        autoCommitChanges: process.env.AUTO_COMMIT_CHANGES === 'true',
        requireApprovalForDestructive: process.env.REQUIRE_APPROVAL_FOR_DESTRUCTIVE_ACTIONS !== 'false',
      },
      security: {
        allowedUsers: (process.env.ALLOWED_USERS || '').split(',').filter(Boolean),
        jwtSecret: process.env.JWT_SECRET || '',
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      },
      providers: {
        llm: this.loadLLMProviderConfigs(),
        channels: this.loadChannelProviderConfigs()
      }
    };

    logger.info('Configuration system initialized', {
      llmProviders: Object.keys(this.config.providers.llm),
      channelProviders: Object.keys(this.config.providers.channels)
    });

    return this.config;
  }

  /**
   * Get the current configuration
   */
  static getConfig(): SystemConfig {
    if (!this.config) {
      return this.initialize();
    }
    return this.config;
  }

  /**
   * Get configuration for a specific LLM provider
   */
  static getLLMProviderConfig(providerName: string): ProviderConfig | undefined {
    const config = this.getConfig();
    return config.providers.llm[providerName];
  }

  /**
   * Get configuration for a specific channel provider
   */
  static getChannelProviderConfig(providerName: string): ProviderConfig | undefined {
    const config = this.getConfig();
    return config.providers.channels[providerName];
  }

  /**
   * Register a custom configuration loader
   */
  static registerConfigLoader(name: string, loader: () => any): void {
    try {
      const customConfig = loader();
      this.customConfigs.set(name, customConfig);
      logger.info('Custom configuration registered', { name });
    } catch (error) {
      logger.error('Failed to register custom configuration', { name, error });
      throw error;
    }
  }

  /**
   * Get custom configuration
   */
  static getCustomConfig(name: string): any {
    return this.customConfigs.get(name);
  }

  /**
   * Update provider configuration at runtime
   */
  static updateProviderConfig(
    type: 'llm' | 'channels',
    providerName: string,
    newConfig: Partial<ProviderConfig>
  ): void {
    const config = this.getConfig();
    
    if (!config.providers[type][providerName]) {
      config.providers[type][providerName] = {};
    }
    
    config.providers[type][providerName] = {
      ...config.providers[type][providerName],
      ...newConfig
    };

    logger.info('Provider configuration updated', { type, providerName });
  }

  /**
   * Validate configuration completeness
   */
  static validateConfig(): { isValid: boolean; errors: string[] } {
    const config = this.getConfig();
    const errors: string[] = [];

    // Validate base configuration
    if (config.agent.maxLoopIterations <= 0) {
      errors.push('MAX_LOOP_ITERATIONS must be greater than 0');
    }

    if (config.agent.contextWindowSize <= 0) {
      errors.push('CONTEXT_WINDOW_SIZE must be greater than 0');
    }

    // Validate provider configurations
    const enabledLLMProviders = Object.keys(config.providers.llm).filter(
      name => config.providers.llm[name]?.enabled !== false
    );

    const enabledChannelProviders = Object.keys(config.providers.channels).filter(
      name => config.providers.channels[name]?.enabled !== false
    );

    if (enabledLLMProviders.length === 0) {
      errors.push('At least one LLM provider must be configured and enabled');
    }

    if (enabledChannelProviders.length === 0) {
      errors.push('At least one channel provider must be configured and enabled');
    }

    // Validate each enabled provider
    for (const providerName of enabledLLMProviders) {
      const providerConfig = config.providers.llm[providerName];
      if (providerConfig) {
        const validationErrors = this.validateLLMProviderConfig(providerName, providerConfig);
        errors.push(...validationErrors);
      }
    }

    for (const providerName of enabledChannelProviders) {
      const providerConfig = config.providers.channels[providerName];
      if (providerConfig) {
        const validationErrors = this.validateChannelProviderConfig(providerName, providerConfig);
        errors.push(...validationErrors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Load LLM provider configurations from environment
   */
  private static loadLLMProviderConfigs(): { [name: string]: ProviderConfig } {
    const configs: { [name: string]: ProviderConfig } = {};

    // OpenAI configuration
    if (process.env.OPENAI_API_KEY) {
      configs.openai = {
        enabled: true,
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      };
    }

    // Add other LLM providers as needed
    // Anthropic, Azure, etc.

    return configs;
  }

  /**
   * Load channel provider configurations from environment
   */
  private static loadChannelProviderConfigs(): { [name: string]: ProviderConfig } {
    const configs: { [name: string]: ProviderConfig } = {};

    // Slack configuration
    if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET && process.env.SLACK_APP_TOKEN) {
      configs.slack = {
        enabled: true,
        botToken: process.env.SLACK_BOT_TOKEN,
        signingSecret: process.env.SLACK_SIGNING_SECRET,
        appToken: process.env.SLACK_APP_TOKEN,
      };
    }

    // Add other channel providers as needed
    // Discord, CLI, etc.

    return configs;
  }

  /**
   * Validate LLM provider configuration
   */
  private static validateLLMProviderConfig(name: string, config: ProviderConfig): string[] {
    const errors: string[] = [];

    switch (name) {
      case 'openai':
        if (!config.apiKey) {
          errors.push('OpenAI API key is required');
        }
        if (!config.model) {
          errors.push('OpenAI model is required');
        }
        break;
      // Add validation for other providers
    }

    return errors;
  }

  /**
   * Validate channel provider configuration
   */
  private static validateChannelProviderConfig(name: string, config: ProviderConfig): string[] {
    const errors: string[] = [];

    switch (name) {
      case 'slack':
        if (!config.botToken) {
          errors.push('Slack bot token is required');
        }
        if (!config.signingSecret) {
          errors.push('Slack signing secret is required');
        }
        if (!config.appToken) {
          errors.push('Slack app token is required');
        }
        break;
      // Add validation for other providers
    }

    return errors;
  }

  /**
   * Get environment-specific configuration
   */
  static getEnvironmentConfig(): { environment: string; isDevelopment: boolean; isProduction: boolean } {
    const environment = process.env.NODE_ENV || 'development';
    return {
      environment,
      isDevelopment: environment === 'development',
      isProduction: environment === 'production'
    };
  }
}

// Export the default configuration for backward compatibility
export const defaultConfig = ConfigManager.getConfig();
