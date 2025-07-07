// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import logger from './utils/logger';
import { initializeErrorRecovery } from './utils/errors';
import { ConfigManager } from './core/config/ConfigManager';
import { initializeProviders } from './core/providers/BuiltinProviders';
import { LLMOrchestrator } from './core/llm/LLMOrchestrator';
import { MessageChannel } from './core/channels/MessageChannel';

// Initialize the agent infrastructure
export const initializeAgent = async () => {
  try {
    logger.info('🚀 Initializing LLM Agent...');

    // Initialize configuration system
    ConfigManager.initialize();
    const validation = ConfigManager.validateConfig();
    
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }
    logger.info('✅ Configuration validated');

    // Initialize error recovery strategies
    initializeErrorRecovery();
    logger.info('✅ Error recovery strategies initialized');

    // Create logs directory if it doesn't exist
    const fs = await import('fs-extra');
    await fs.default.ensureDir('./logs');
    logger.info('✅ Logs directory ensured');

    // Create workspaces directory if it doesn't exist
    await fs.default.ensureDir('./workspaces');
    logger.info('✅ Workspaces directory ensured');

    logger.info('🎉 Agent infrastructure initialized successfully');
    
    return {
      config: ConfigManager.getConfig(),
      logger,
    };
  } catch (error) {
    console.error('❌ Failed to initialize agent infrastructure:', error);
    logger.error('❌ Failed to initialize agent infrastructure', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    throw error;
  }
};

// Start the agent with provider abstraction
export const startAgent = async () => {
  try {
    // Initialize core infrastructure
    const { config } = await initializeAgent();
    
    // Initialize providers
    logger.info('🔗 Initializing providers...');
    const { llmProvider, messageChannel } = await initializeProviders();
    
    if (!llmProvider) {
      throw new Error('No LLM provider available');
    }
    
    if (!messageChannel) {
      throw new Error('No message channel available');
    }

    // Create LLM orchestrator
    const orchestrator = new LLMOrchestrator(llmProvider);
    
    // Set up message handling
    const channel = messageChannel as MessageChannel;
    channel.onMessage(async (message) => {
      try {
        // Extract the prompt (remove @agent mention)
        const prompt = extractPrompt(message.content);
        
        if (!prompt.trim()) {
          await channel.sendMessage({
            channel: message.channel,
            content: "Hi! I'm your LLM agent. Mention me with a task and I'll help you manage your codebases!",
            threadId: message.id,
          });
          return;
        }

        // Process with orchestrator
        logger.info('Processing request via LLM orchestrator', { prompt, user: message.user });
        
        const result = await orchestrator.processStructuredRequest({
          userRequest: prompt,
          context: {
            projectContext: 'Agent system for codebase management'
          }
        });

        // Format response
        let responseText = result.response.userMessage || result.response.reasoning;
        
        if (result.validation.validCommands.length > 0) {
          responseText += `\n\n🔧 **Commands identified:** ${result.validation.validCommands.length}`;
          
          const previewCommands = result.validation.validCommands.slice(0, 3);
          if (previewCommands.length > 0) {
            responseText += '\n```\n';
            previewCommands.forEach((cmd, i) => {
              responseText += `${i + 1}. ${cmd.action}`;
              if (cmd.parameters && Object.keys(cmd.parameters).length > 0) {
                responseText += ` (${Object.keys(cmd.parameters).join(', ')})`;
              }
              responseText += '\n';
            });
            if (result.validation.validCommands.length > 3) {
              responseText += `... and ${result.validation.validCommands.length - 3} more\n`;
            }
            responseText += '```';
          }
        }

        if (result.validation.invalidCommands.length > 0) {
          responseText += `\n\n⚠️ **${result.validation.invalidCommands.length} command(s) need attention**`;
        }

        if (result.budgetStatus.isNearLimit) {
          responseText += `\n\n📊 Token usage: ${result.budgetStatus.daily.percentUsed.toFixed(1)}% daily, ${result.budgetStatus.monthly.percentUsed.toFixed(1)}% monthly`;
        }

        await channel.sendMessage({
          channel: message.channel,
          content: responseText,
          threadId: message.id,
        });

      } catch (error) {
        logger.error('Error processing message', { error, message });
        await channel.sendMessage({
          channel: message.channel,
          content: "Sorry, I encountered an error processing your request.",
          threadId: message.id,
        });
      }
    });
    
    logger.info('🎯 Agent started successfully and listening for messages!');
    logger.info(`🔌 Using LLM provider: ${llmProvider.getProviderName()}`);
    logger.info(`📡 Using message channel: ${channel.getChannelName()}`);
    
    return { orchestrator, channel, llmProvider };
  } catch (error) {
    logger.error('❌ Failed to start agent', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    throw error;
  }
};

// Helper function to extract prompt from message
function extractPrompt(text: string): string {
  return text
    .replace(/<@U[A-Z0-9]+>/g, '') // Remove user mentions
    .replace(/@\w+/g, '') // Remove @mentions
    .trim();
}

// Graceful shutdown handler
export const shutdownAgent = async () => {
  logger.info('🛑 Shutting down agent...');
  
  // Add cleanup logic here
  // - Close database connections
  // - Finish pending operations
  // - Save state
  
  logger.info('✅ Agent shutdown complete');
  process.exit(0);
};

// Handle process signals
process.on('SIGINT', shutdownAgent);
process.on('SIGTERM', shutdownAgent);
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Don't exit in production, but log the error
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  // Exit in case of uncaught exception
  process.exit(1);
});

export default { initializeAgent, startAgent, shutdownAgent };

// Start the agent if this file is run directly
if (require.main === module) {
  startAgent().catch((error) => {
    logger.error('Failed to start agent:', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    process.exit(1);
  });
}
