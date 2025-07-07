/**
 * Provider Registry System
 * 
 * Central registry for managing LLM providers and message channels.
 * Enables dynamic discovery and instantiation of providers.
 */

import { agentLogger } from '../../utils/logger';
import { LLMProvider, LLMProviderFactory, LLMProviderConfig } from '../llm/LLMProvider';
import { MessageChannel, MessageChannelFactory, MessageChannelConfig } from '../channels/MessageChannel';

const logger = agentLogger.child({ component: 'provider-registry' });

export interface ProviderInfo {
  name: string;
  type: 'llm' | 'channel';
  description: string;
  version: string;
  author?: string;
  capabilities?: any;
}

export interface RegistryStatus {
  llmProviders: {
    registered: string[];
    active: string[];
  };
  messageChannels: {
    registered: string[];
    active: string[];
  };
  totalProviders: number;
}

/**
 * Central provider registry for the agent system
 */
export class ProviderRegistry {
  private static llmFactories: Map<string, LLMProviderFactory> = new Map();
  private static channelFactories: Map<string, MessageChannelFactory> = new Map();
  private static providerInfo: Map<string, ProviderInfo> = new Map();
  private static activeLLMProviders: Map<string, LLMProvider> = new Map();
  private static activeChannels: Map<string, MessageChannel> = new Map();

  /**
   * Register an LLM provider factory
   */
  static registerLLMProvider(
    name: string, 
    factory: LLMProviderFactory, 
    info: Omit<ProviderInfo, 'name' | 'type'>
  ): void {
    this.llmFactories.set(name, factory);
    this.providerInfo.set(name, {
      name,
      type: 'llm',
      ...info
    });
    
    logger.info('LLM provider registered', { name, version: info.version });
  }

  /**
   * Register a message channel factory
   */
  static registerMessageChannel(
    name: string, 
    factory: MessageChannelFactory, 
    info: Omit<ProviderInfo, 'name' | 'type'>
  ): void {
    this.channelFactories.set(name, factory);
    this.providerInfo.set(name, {
      name,
      type: 'channel',
      ...info
    });
    
    logger.info('Message channel registered', { name, version: info.version });
  }

  /**
   * Create and activate an LLM provider
   */
  static async createLLMProvider(
    name: string, 
    config: LLMProviderConfig
  ): Promise<LLMProvider> {
    const factory = this.llmFactories.get(name);
    if (!factory) {
      throw new Error(`Unknown LLM provider: ${name}`);
    }

    try {
      const provider = factory(config, logger);
      
      // Perform health check
      const isHealthy = await provider.healthCheck();
      if (!isHealthy) {
        throw new Error(`Health check failed for LLM provider: ${name}`);
      }

      this.activeLLMProviders.set(name, provider);
      logger.info('LLM provider created and activated', { 
        name, 
        capabilities: provider.getCapabilities() 
      });
      
      return provider;
    } catch (error) {
      logger.error('Failed to create LLM provider', { name, error });
      throw error;
    }
  }

  /**
   * Create and activate a message channel
   */
  static async createMessageChannel(
    name: string, 
    config: MessageChannelConfig
  ): Promise<MessageChannel> {
    const factory = this.channelFactories.get(name);
    if (!factory) {
      throw new Error(`Unknown message channel: ${name}`);
    }

    try {
      const channel = factory(config, logger);
      
      // Start the channel
      await channel.start();
      
      // Perform health check
      const isHealthy = await channel.healthCheck();
      if (!isHealthy) {
        throw new Error(`Health check failed for message channel: ${name}`);
      }

      this.activeChannels.set(name, channel);
      logger.info('Message channel created and activated', { 
        name, 
        capabilities: channel.getCapabilities() 
      });
      
      return channel;
    } catch (error) {
      logger.error('Failed to create message channel', { name, error });
      throw error;
    }
  }

  /**
   * Get an active LLM provider
   */
  static getLLMProvider(name: string): LLMProvider | undefined {
    return this.activeLLMProviders.get(name);
  }

  /**
   * Get an active message channel
   */
  static getMessageChannel(name: string): MessageChannel | undefined {
    return this.activeChannels.get(name);
  }

  /**
   * Get all available LLM provider names
   */
  static getAvailableLLMProviders(): string[] {
    return Array.from(this.llmFactories.keys());
  }

  /**
   * Get all available message channel names
   */
  static getAvailableMessageChannels(): string[] {
    return Array.from(this.channelFactories.keys());
  }

  /**
   * Get provider information
   */
  static getProviderInfo(name: string): ProviderInfo | undefined {
    return this.providerInfo.get(name);
  }

  /**
   * Check if an LLM provider is registered
   */
  static hasLLMProvider(name: string): boolean {
    return this.llmFactories.has(name);
  }

  /**
   * Check if a message channel is registered
   */
  static hasMessageChannel(name: string): boolean {
    return this.channelFactories.has(name);
  }

  /**
   * Get registry status
   */
  static getStatus(): RegistryStatus {
    return {
      llmProviders: {
        registered: Array.from(this.llmFactories.keys()),
        active: Array.from(this.activeLLMProviders.keys())
      },
      messageChannels: {
        registered: Array.from(this.channelFactories.keys()),
        active: Array.from(this.activeChannels.keys())
      },
      totalProviders: this.llmFactories.size + this.channelFactories.size
    };
  }

  /**
   * Deactivate and cleanup an LLM provider
   */
  static async deactivateLLMProvider(name: string): Promise<void> {
    const provider = this.activeLLMProviders.get(name);
    if (provider) {
      provider.destroy();
      this.activeLLMProviders.delete(name);
      logger.info('LLM provider deactivated', { name });
    }
  }

  /**
   * Deactivate and cleanup a message channel
   */
  static async deactivateMessageChannel(name: string): Promise<void> {
    const channel = this.activeChannels.get(name);
    if (channel) {
      await channel.stop();
      this.activeChannels.delete(name);
      logger.info('Message channel deactivated', { name });
    }
  }

  /**
   * Cleanup all active providers and channels
   */
  static async cleanup(): Promise<void> {
    logger.info('Cleaning up provider registry');

    // Cleanup LLM providers
    for (const [name, provider] of this.activeLLMProviders) {
      try {
        provider.destroy();
      } catch (error) {
        logger.error('Error cleaning up LLM provider', { name, error });
      }
    }
    this.activeLLMProviders.clear();

    // Cleanup message channels
    for (const [name, channel] of this.activeChannels) {
      try {
        await channel.stop();
      } catch (error) {
        logger.error('Error cleaning up message channel', { name, error });
      }
    }
    this.activeChannels.clear();

    logger.info('Provider registry cleanup complete');
  }

  /**
   * Health check all active providers
   */
  static async healthCheckAll(): Promise<{ [name: string]: boolean }> {
    const results: { [name: string]: boolean } = {};

    // Check LLM providers
    for (const [name, provider] of this.activeLLMProviders) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        logger.error('Health check failed for LLM provider', { name, error });
        results[name] = false;
      }
    }

    // Check message channels
    for (const [name, channel] of this.activeChannels) {
      try {
        results[name] = await channel.healthCheck();
      } catch (error) {
        logger.error('Health check failed for message channel', { name, error });
        results[name] = false;
      }
    }

    return results;
  }
}
