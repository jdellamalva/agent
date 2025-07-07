/**
 * Built-in Provider Registration
 * 
 * Automatically registers the core providers that come with the agent system.
 */

import { ProviderRegistry } from '../registry/ProviderRegistry';
import { createOpenAIProvider } from '../../providers/llm/OpenAIProvider';
import { createSlackChannel } from '../../providers/channels/SlackChannel';

/**
 * Register all built-in providers
 */
export function registerBuiltinProviders(): void {
  // Register OpenAI LLM Provider
  ProviderRegistry.registerLLMProvider(
    'openai',
    createOpenAIProvider,
    {
      description: 'OpenAI GPT models integration',
      version: '1.0.0',
      author: 'Agent System',
      capabilities: {
        streaming: true,
        vision: true,
        tools: true,
        maxTokens: 128000
      }
    }
  );

  // Register Slack Message Channel
  ProviderRegistry.registerMessageChannel(
    'slack',
    createSlackChannel,
    {
      description: 'Slack integration for messaging',
      version: '1.0.0',
      author: 'Agent System',
      capabilities: {
        threads: true,
        files: true,
        blocks: true,
        reactions: true
      }
    }
  );
}

/**
 * Initialize the provider system
 */
export async function initializeProviders(): Promise<{
  llmProvider?: any;
  messageChannel?: any;
}> {
  // Register built-in providers
  registerBuiltinProviders();

  const ConfigManager = await import('../config/ConfigManager').then(m => m.ConfigManager);
  
  // Get configuration
  const config = ConfigManager.getConfig();
  const validation = ConfigManager.validateConfig();
  
  if (!validation.isValid) {
    throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
  }

  const results: { llmProvider?: any; messageChannel?: any } = {};

  // Initialize enabled LLM providers
  const enabledLLMProviders = Object.keys(config.providers.llm).filter(
    name => config.providers.llm[name]?.enabled !== false
  );

  if (enabledLLMProviders.length > 0) {
    const primaryLLMProvider = enabledLLMProviders[0]!;
    const llmConfig = config.providers.llm[primaryLLMProvider];
    
    if (llmConfig) {
      results.llmProvider = await ProviderRegistry.createLLMProvider(primaryLLMProvider, llmConfig as any);
    }
  }

  // Initialize enabled message channels
  const enabledChannelProviders = Object.keys(config.providers.channels).filter(
    name => config.providers.channels[name]?.enabled !== false
  );

  if (enabledChannelProviders.length > 0) {
    const primaryChannelProvider = enabledChannelProviders[0]!;
    const channelConfig = config.providers.channels[primaryChannelProvider];
    
    if (channelConfig) {
      results.messageChannel = await ProviderRegistry.createMessageChannel(primaryChannelProvider, channelConfig as any);
    }
  }

  return results;
}
