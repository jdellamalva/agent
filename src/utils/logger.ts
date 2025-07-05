import winston from 'winston';
import path from 'path';

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
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'agent-error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'agent-combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.simple(),
        winston.format.printf(({ timestamp, level, message, metadata, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
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
export const agentLogger = createComponentLogger('agent-core');
export const slackLogger = createComponentLogger('slack-integration');
export const openaiLogger = createComponentLogger('openai-integration');
export const actionLogger = createComponentLogger('action-system');
export const gitLogger = createComponentLogger('git-operations');
export const workspaceLogger = createComponentLogger('workspace-management');

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
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'gpt-3.5-turbo': { prompt: 0.0015, completion: 0.002 },
  };
  
  const rate = rates[model as keyof typeof rates] || rates['gpt-4'];
  return (tokens.prompt * rate.prompt + tokens.completion * rate.completion) / 1000;
}

export default logger;
