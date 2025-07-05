// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import logger from './utils/logger';
import { initializeErrorRecovery } from './utils/errors';
import { validateConfig, defaultConfig } from './utils/config';
import { SlackClient } from './integrations/slack';

// Initialize the agent infrastructure
export const initializeAgent = async () => {
  try {
    logger.info('🚀 Initializing LLM Agent...');

    // Validate configuration
    validateConfig(defaultConfig);
    logger.info('✅ Configuration validated');

    // Initialize error recovery strategies
    initializeErrorRecovery();
    logger.info('✅ Error recovery strategies initialized');

    // Create logs directory if it doesn't exist
    const fs = await import('fs-extra');
    await fs.ensureDir('./logs');
    logger.info('✅ Logs directory ensured');

    // Create workspaces directory if it doesn't exist
    await fs.ensureDir('./workspaces');
    logger.info('✅ Workspaces directory ensured');

    logger.info('🎉 Agent infrastructure initialized successfully');
    
    return {
      config: defaultConfig,
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

// Start the agent with Slack integration
export const startAgent = async () => {
  try {
    // Initialize core infrastructure
    const { config } = await initializeAgent();
    
    // Initialize Slack integration
    logger.info('🔗 Initializing Slack integration...');
    const slackClient = new SlackClient();
    await slackClient.start();
    
    logger.info('🎯 Agent started successfully and listening for Slack events!');
    logger.info('Try mentioning @agent in a Slack channel to test the integration.');
    
    return slackClient;
  } catch (error) {
    logger.error('❌ Failed to start agent', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined 
    });
    throw error;
  }
};

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
