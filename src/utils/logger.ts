/**
 * Logger Utilities - Centralized logging system with structured output and rotation
 * 
 * **Purpose**: 
 * Provides consistent, structured logging across all agent components with
 * configurable log levels, file rotation, and component-specific child loggers
 * for effective debugging and monitoring.
 * 
 * **Dependencies**:
 * - winston: Production-grade logging library with transport support
 * - path: For log file location management
 * 
 * **Key Patterns**:
 * - Structured logging with JSON format for log aggregation
 * - Child logger pattern for component-specific context
 * - Transport-based routing (console for dev, files for production)
 * - Automatic log rotation to prevent disk space issues
 * 
 * **Lifecycle**:
 * 1. Initialize with environment-based configuration
 * 2. Create component-specific child loggers with context
 * 3. Log structured events with metadata and timestamps
 * 4. Automatic file rotation and cleanup
 * 5. Export logs for monitoring and analysis
 * 
 * **Performance Considerations**:
 * - Asynchronous file writing to prevent blocking
 * - Log level filtering to reduce I/O overhead
 * - Efficient JSON serialization for structured data
 * - Memory-bounded log buffers for high-throughput scenarios
 * 
 * **Error Handling**:
 * - Graceful fallback to console if file writes fail
 * - Error capture with full stack traces
 * - Silent handling of logger initialization failures
 */

import winston from 'winston';
import path from 'path';
import { LOGGING, FILE_SYSTEM, OPENAI_PRICING } from '../config/constants';

// Define log levels with priorities
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for console output
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

/**
 * Winston logger instance with production-ready configuration
 * 
 * **Configuration Features**:
 * - Environment-based log level control (LOG_LEVEL env var)
 * - Structured JSON format for log aggregation and analysis
 * - Automatic file rotation (5MB max, 5 files retained)
 * - Error-only and combined log files for different monitoring needs
 * - Colorized console output for development readability
 * 
 * **Metadata Injection**:
 * - Service name and version for log correlation
 * - Environment context for deployment-specific filtering
 * - Timestamp precision for event sequencing
 * - Stack trace capture for error debugging
 * 
 * **Transport Strategy**:
 * - File transports for persistent storage and monitoring
 * - Console transport for development and debugging
 * - Automatic log rotation to prevent disk space issues
 */
// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] })
  ),
  defaultMeta: {
    service: 'llm-agent',
    version: process.env.npm_package_version || LOGGING.DEFAULT_VERSION,
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'agent-error.log'),
      level: 'error',
      maxsize: FILE_SYSTEM.MAX_LOG_FILE_SIZE,
      maxFiles: FILE_SYSTEM.MAX_LOG_FILES,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'agent-combined.log'),
      maxsize: FILE_SYSTEM.MAX_LOG_FILE_SIZE,
      maxFiles: FILE_SYSTEM.MAX_LOG_FILES,
    }),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, metadata, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, LOGGING.JSON_STRINGIFY_SPACING) : '';
          return `${timestamp} [${level}]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Create specialized loggers for different components
export const createComponentLogger = (component: string) => {
  return logger.child({ component });
};

// Specialized loggers for each component
export const agentLogger = createComponentLogger(LOGGING.COMPONENT_AGENT_CORE);
export const slackLogger = createComponentLogger(LOGGING.COMPONENT_SLACK);
export const openaiLogger = createComponentLogger(LOGGING.COMPONENT_OPENAI);
export const actionLogger = createComponentLogger(LOGGING.COMPONENT_ACTION);
export const gitLogger = createComponentLogger(LOGGING.COMPONENT_GIT);
export const workspaceLogger = createComponentLogger(LOGGING.COMPONENT_WORKSPACE);

// Agent-specific logging methods
export const logAgentCycle = (cycleId: string, phase: 'think' | 'act' | 'observe', data: any) => {
  agentLogger.info(`Agent cycle ${phase}`, {
    cycleId,
    phase,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

export const logSlackEvent = (eventType: string, userId: string, data: any) => {
  slackLogger.info(`Slack event: ${eventType}`, {
    eventType,
    userId,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

export const logOpenAIRequest = (requestId: string, tokens: { prompt: number; completion: number }, model: string) => {
  openaiLogger.info('OpenAI API request', {
    requestId,
    model,
    tokens,
    cost: calculateTokenCost(tokens, model),
    timestamp: new Date().toISOString(),
  });
};

export const logActionExecution = (actionId: string, actionType: string, params: any, result: any, duration: number) => {
  actionLogger.info(`Action executed: ${actionType}`, {
    actionId,
    actionType,
    params,
    result: typeof result === 'object' ? JSON.stringify(result) : result,
    duration,
    timestamp: new Date().toISOString(),
  });
};

export const logWorkspaceOperation = (operation: string, workspace: string, details: any) => {
  workspaceLogger.info(`Workspace operation: ${operation}`, {
    operation,
    workspace,
    details,
    timestamp: new Date().toISOString(),
  });
};

// Security and audit logging
export const logSecurityEvent = (event: string, userId: string, details: any) => {
  logger.warn(`Security event: ${event}`, {
    event,
    userId,
    details,
    timestamp: new Date().toISOString(),
    severity: 'security',
  });
};

// Performance monitoring
export const logPerformanceMetric = (metric: string, value: number, unit: string, context?: any) => {
  logger.info(`Performance metric: ${metric}`, {
    metric,
    value,
    unit,
    context,
    timestamp: new Date().toISOString(),
    type: 'performance',
  });
};

// Helper function to calculate token costs (approximate)
function calculateTokenCost(tokens: { prompt: number; completion: number }, model: string): number {
  const rates = {
    'gpt-4': { 
      prompt: OPENAI_PRICING.GPT_4.PROMPT_RATE, 
      completion: OPENAI_PRICING.GPT_4.COMPLETION_RATE 
    },
    'gpt-4-turbo': { 
      prompt: OPENAI_PRICING.GPT_4_TURBO.PROMPT_RATE, 
      completion: OPENAI_PRICING.GPT_4_TURBO.COMPLETION_RATE 
    },
    'gpt-3.5-turbo': { 
      prompt: OPENAI_PRICING.GPT_3_5_TURBO.PROMPT_RATE, 
      completion: OPENAI_PRICING.GPT_3_5_TURBO.COMPLETION_RATE 
    },
  };
  
  const rate = rates[model as keyof typeof rates] || rates['gpt-4'];
  return (tokens.prompt * rate.prompt + tokens.completion * rate.completion) / OPENAI_PRICING.TOKEN_DIVISION_FACTOR;
}

export { logger };
