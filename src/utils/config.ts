// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

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
  logging: LoggingConfig;
  errorHandling: ErrorHandlingConfig;
  openai: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  slack: {
    botToken: string;
    signingSecret: string;
    appToken: string;
  };
  agent: {
    maxLoopIterations: number;
    contextWindowSize: number;
    autoCommitChanges: boolean;
    requireApprovalForDestructive: boolean;
  };
  security: {
    allowedUsers: string[];
    jwtSecret: string;
    enableRateLimit: boolean;
    rateLimitWindow: number;
    rateLimitMaxRequests: number;
  };
}

// Default configuration
export const defaultConfig: AgentConfig = {
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
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
  },
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.SLACK_SIGNING_SECRET || '',
    appToken: process.env.SLACK_APP_TOKEN || '',
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
};

// Configuration validation
export const validateConfig = (config: AgentConfig): void => {
  // Phase 2: Slack requirements
  if (!config.slack.botToken) {
    throw new Error('SLACK_BOT_TOKEN is required');
  }
  
  if (!config.slack.signingSecret) {
    throw new Error('SLACK_SIGNING_SECRET is required');
  }
  
  if (!config.slack.appToken) {
    throw new Error('SLACK_APP_TOKEN is required');
  }
  
  // Phase 3: OpenAI requirements (now that we have the key)
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  
  // Basic validation for agent settings
  if (config.agent.maxLoopIterations <= 0) {
    throw new Error('MAX_LOOP_ITERATIONS must be greater than 0');
  }
  
  if (config.agent.contextWindowSize <= 0) {
    throw new Error('CONTEXT_WINDOW_SIZE must be greater than 0');
  }
  
  // Phase 4+: Will validate security and other requirements later
};

export default defaultConfig;
