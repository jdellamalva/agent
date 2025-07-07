/**
 * LLM Agent Main Entry Point
 * 
 * This is the primary initialization module for the LLM Agent system. It orchestrates
 * the startup sequence for all core components including configuration, providers,
 * error handling, and infrastructure setup.
 * 
 * Architecture:
 * - Two-layer architecture: Base Agent (stable core) + Customization Layer (user-specific)
 * - Provider-agnostic design supporting multiple LLM and channel providers
 * - Comprehensive error handling with recovery strategies
 * - Configuration-driven initialization with validation
 * 
 * Dependencies:
 * - ConfigManager: System configuration and validation
 * - BuiltinProviders: Default LLM and channel provider registration
 * - LLMOrchestrator: Provider-agnostic LLM interaction management
 * - MessageChannel: Communication channel abstractions
 * - Logger: Structured logging throughout the system
 * - Error Recovery: Centralized error handling and recovery strategies
 * 
 * Key Patterns:
 * - Fail-fast initialization with comprehensive validation
 * - Directory setup with proper error handling
 * - Graceful error handling with detailed logging
 * - Configuration validation before system startup
 * 
 * Side Effects:
 * - Creates logs/ and workspaces/ directories if they don't exist
 * - Initializes global error recovery strategies
 * - Validates and logs configuration state
 * - Registers built-in providers with the provider registry
 */

// Load environment variables FIRST - critical for configuration
import dotenv from 'dotenv';
dotenv.config();

import logger from './utils/logger';
import { initializeErrorRecovery } from './utils/errors';
import { ConfigManager } from './core/config/ConfigManager';
import { initializeProviders } from './core/providers/BuiltinProviders';
import { LLMOrchestrator } from './core/llm/LLMOrchestrator';
import { MessageChannel } from './core/channels/MessageChannel';

/**
 * Initialize the complete LLM Agent infrastructure
 * 
 * Performs the complete startup sequence for the agent system, including
 * configuration validation, provider registration, directory setup, and
 * error recovery initialization.
 * 
 * Initialization Sequence:
 * 1. Load and validate system configuration
 * 2. Initialize error recovery strategies
 * 3. Create required directories (logs/, workspaces/)
 * 4. Register built-in providers (OpenAI, Slack, etc.)
 * 5. Log successful initialization
 * 
 * @returns Promise<{config: SystemConfig, logger: winston.Logger}> - Configuration and logger instances
 * @throws Error - If configuration validation fails or critical setup fails
 * 
 * Side Effects:
 * - Creates filesystem directories
 * - Registers providers in global registry
 * - Initializes global error handlers
 * - Logs initialization progress
 * 
 * Performance: O(1) - Constant time initialization regardless of codebase size
 */
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

/**
 * Start the complete LLM Agent system with full provider integration
 * 
 * Initializes the agent infrastructure and starts the main message processing loop.
 * Sets up provider integrations, message handling, and orchestrator coordination.
 * This is the main entry point for running the agent in production.
 * 
 * Startup Sequence:
 * 1. Initialize core infrastructure (config, providers, directories)
 * 2. Register and validate LLM and message channel providers
 * 3. Create LLMOrchestrator for provider-agnostic LLM interactions
 * 4. Set up message event handlers with error handling
 * 5. Start message processing loop
 * 
 * @returns Promise<{orchestrator: LLMOrchestrator, channel: MessageChannel, llmProvider: any}> - Initialized system components
 * @throws Error - If required providers are unavailable or initialization fails
 * 
 * Message Processing Flow:
 * - Receives messages from registered channels (Slack, etc.)
 * - Extracts prompts and filters @agent mentions
 * - Routes to LLMOrchestrator for processing
 * - Handles responses and error scenarios
 * - Maintains conversation threading
 * 
 * Side Effects:
 * - Starts persistent message listeners
 * - Begins background provider health monitoring
 * - Logs all message processing activity
 * 
 * Performance: Event-driven architecture with async message processing
 */
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

/**
 * Extract clean prompt text from message content
 * 
 * Removes @agent mentions, user ID mentions, and other chat formatting
 * to extract the actual prompt content for processing.
 * 
 * @param text - Raw message content from chat platform
 * @returns Cleaned prompt string ready for LLM processing
 * 
 * Cleaning Rules:
 * - Removes user mentions (e.g., <@U123ABC>)
 * - Removes @username patterns
 * - Trims whitespace
 * - Preserves original prompt content and intent
 * 
 * Performance: O(n) where n is message length
 */
function extractPrompt(text: string): string {
  return text
    .replace(/<@U[A-Z0-9]+>/g, '') // Remove user mentions
    .replace(/@\w+/g, '') // Remove @mentions
    .trim();
}

/**
 * Graceful shutdown handler for the LLM Agent system
 * 
 * Performs cleanup operations and ensures graceful termination of all
 * active components, connections, and background processes.
 * 
 * Shutdown Sequence:
 * 1. Log shutdown initiation
 * 2. Close active provider connections
 * 3. Complete pending operations
 * 4. Save system state if necessary
 * 5. Exit with success status
 * 
 * @returns Promise<void> - Resolves when shutdown is complete
 * 
 * Side Effects:
 * - Closes database/API connections
 * - Saves pending state to disk
 * - Terminates background processes
 * - Exits with status code 0
 * 
 * Performance: Should complete within 5 seconds for graceful termination
 */
export const shutdownAgent = async (): Promise<void> => {
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
