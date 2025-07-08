/**
 * Constants Configuration - Centralized hardcoded values and magic numbers
 * 
 * **Purpose**:
 * Provides a single source of truth for all hardcoded values, magic numbers,
 * and configuration constants used throughout the application. Values are
 * organized by category and can be overridden via environment variables.
 * 
 * **Categories**:
 * - Validation & Quality: Confidence thresholds, ranges, limits
 * - Timeouts & Delays: Operation timeouts, retry delays, intervals
 * - File & System: File sizes, permissions, paths
 * - Network & API: Rate limits, endpoints, retry counts
 * - Logging & Monitoring: Log levels, file sizes, retention
 * - Security: Permission modes, validation patterns
 * 
 * **Environment Override Pattern**:
 * Each constant can be overridden via environment variables using the
 * pattern: AGENT_[CATEGORY]_[CONSTANT_NAME]
 * 
 * **Usage**:
 * ```typescript
 * import { VALIDATION, TIMEOUTS, NETWORK } from '../config/constants';
 * 
 * if (confidence < VALIDATION.MIN_CONFIDENCE) { ... }
 * await operation({ timeout: TIMEOUTS.GIT_CLONE });
 * ```
 */

// Helper function to get environment override with type conversion
function getEnvOverride<T>(envKey: string, defaultValue: T, parser?: (value: string) => T): T {
  const envValue = process.env[envKey];
  if (envValue === undefined) return defaultValue;
  
  if (parser) return parser(envValue);
  
  // Auto-detect type and convert
  if (typeof defaultValue === 'number') {
    const parsed = Number(envValue);
    return isNaN(parsed) ? defaultValue : parsed as T;
  }
  if (typeof defaultValue === 'boolean') {
    return (envValue.toLowerCase() === 'true') as T;
  }
  
  return envValue as T;
}

/**
 * Validation and Quality Constants
 */
export const VALIDATION = {
  // Confidence scoring
  MIN_CONFIDENCE: getEnvOverride('AGENT_VALIDATION_MIN_CONFIDENCE', 0),
  MAX_CONFIDENCE: getEnvOverride('AGENT_VALIDATION_MAX_CONFIDENCE', 1),
  LOW_CONFIDENCE_WARNING_THRESHOLD: getEnvOverride('AGENT_VALIDATION_LOW_CONFIDENCE_THRESHOLD', 0.7),
  DEFAULT_CONFIDENCE: getEnvOverride('AGENT_VALIDATION_DEFAULT_CONFIDENCE', 0.8),
  HIGH_CONFIDENCE_THRESHOLD: getEnvOverride('AGENT_VALIDATION_HIGH_CONFIDENCE_THRESHOLD', 0.9),
  
  // Token optimization thresholds
  OPTIMIZATION_SAVINGS_THRESHOLD: getEnvOverride('AGENT_VALIDATION_OPTIMIZATION_THRESHOLD', 0.05), // 5%
  MILD_OPTIMIZATION_MULTIPLIER: getEnvOverride('AGENT_VALIDATION_MILD_OPTIMIZATION', 0.1), // 10%
  AGGRESSIVE_OPTIMIZATION_MULTIPLIER: getEnvOverride('AGENT_VALIDATION_AGGRESSIVE_OPTIMIZATION', 0.15), // 15%
  
  // Command validation
  MAX_RETRY_ATTEMPTS: getEnvOverride('AGENT_VALIDATION_MAX_RETRIES', 3),
  
  // Command ID generation
  COMMAND_ID_RANDOM_LENGTH: getEnvOverride('AGENT_VALIDATION_COMMAND_ID_LENGTH', 9),
  COMMAND_ID_BASE: getEnvOverride('AGENT_VALIDATION_COMMAND_ID_BASE', 36),
  
  // File permission validation
  DANGEROUS_PERMISSION_MODE: getEnvOverride('AGENT_VALIDATION_DANGEROUS_PERMISSION', '777'),
} as const;

/**
 * Timeout and Delay Constants (all in milliseconds)
 */
export const TIMEOUTS = {
  // Time units
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  
  // Default operation timeout
  DEFAULT_OPERATION: getEnvOverride('AGENT_TIMEOUT_DEFAULT', 30000), // 30 seconds
  
  // Git operations
  GIT_CLONE: getEnvOverride('AGENT_TIMEOUT_GIT_CLONE', 300000), // 5 minutes
  
  // Package management
  NPM_INSTALL: getEnvOverride('AGENT_TIMEOUT_NPM_INSTALL', 600000), // 10 minutes
  NPM_UPDATE: getEnvOverride('AGENT_TIMEOUT_NPM_UPDATE', 300000),   // 5 minutes
  PIP_INSTALL: getEnvOverride('AGENT_TIMEOUT_PIP_INSTALL', 300000), // 5 minutes
  PIP_UPGRADE: getEnvOverride('AGENT_TIMEOUT_PIP_UPGRADE', 300000), // 5 minutes
  
  // Project operations
  PROJECT_BUILD: getEnvOverride('AGENT_TIMEOUT_PROJECT_BUILD', 900000),    // 15 minutes
  PROJECT_DEPLOY: getEnvOverride('AGENT_TIMEOUT_PROJECT_DEPLOY', 1800000), // 30 minutes
  PROJECT_SCAFFOLD: getEnvOverride('AGENT_TIMEOUT_PROJECT_SCAFFOLD', 120000), // 2 minutes
  
  // Code analysis
  CODE_TEST: getEnvOverride('AGENT_TIMEOUT_CODE_TEST', 600000),           // 10 minutes
  CODE_SECURITY_SCAN: getEnvOverride('AGENT_TIMEOUT_CODE_SECURITY', 300000), // 5 minutes
  CODE_COVERAGE: getEnvOverride('AGENT_TIMEOUT_CODE_COVERAGE', 600000),   // 10 minutes
  
  // Container operations
  DOCKER_BUILD: getEnvOverride('AGENT_TIMEOUT_DOCKER_BUILD', 900000),   // 15 minutes
  DOCKER_DEPLOY: getEnvOverride('AGENT_TIMEOUT_DOCKER_DEPLOY', 600000), // 10 minutes
  
  // Database operations
  DB_BACKUP: getEnvOverride('AGENT_TIMEOUT_DB_BACKUP', 1800000),  // 30 minutes
  DB_RESTORE: getEnvOverride('AGENT_TIMEOUT_DB_RESTORE', 1800000), // 30 minutes
  DB_QUERY: getEnvOverride('AGENT_TIMEOUT_DB_QUERY', 300000),     // 5 minutes
  
  // Network operations
  FTP_UPLOAD: getEnvOverride('AGENT_TIMEOUT_FTP_UPLOAD', 600000),     // 10 minutes
  FTP_DOWNLOAD: getEnvOverride('AGENT_TIMEOUT_FTP_DOWNLOAD', 600000), // 10 minutes
  
  // Monitoring operations
  PERFORMANCE_PROFILE: getEnvOverride('AGENT_TIMEOUT_PERFORMANCE_PROFILE', 300000), // 5 minutes
  LOGS_ANALYZE: getEnvOverride('AGENT_TIMEOUT_LOGS_ANALYZE', 300000),   // 5 minutes
  
  // Shell operations
  SHELL_EXEC: getEnvOverride('AGENT_TIMEOUT_SHELL_EXEC', 60000),      // 1 minute
  SHELL_SCRIPT: getEnvOverride('AGENT_TIMEOUT_SHELL_SCRIPT', 300000), // 5 minutes
} as const;

/**
 * File and System Constants
 */
export const FILE_SYSTEM = {
  // File size limits
  MAX_LOG_FILE_SIZE: getEnvOverride('AGENT_FS_MAX_LOG_SIZE', 5242880), // 5MB
  MAX_LOG_FILES: getEnvOverride('AGENT_FS_MAX_LOG_FILES', 5),
  
  // Default file permissions
  DEFAULT_FILE_MODE: getEnvOverride('AGENT_FS_DEFAULT_FILE_MODE', '644'),
  DEFAULT_DIR_MODE: getEnvOverride('AGENT_FS_DEFAULT_DIR_MODE', '755'),
  
  // Path configurations
  DEFAULT_LOG_DIR: getEnvOverride('AGENT_FS_LOG_DIR', './logs'),
} as const;

/**
 * Network and API Constants
 */
export const NETWORK = {
  // Rate limiting
  RATE_LIMIT_CLEANUP_INTERVAL: getEnvOverride('AGENT_NETWORK_CLEANUP_INTERVAL', 60000), // 1 minute
  RATE_LIMIT_WINDOW: getEnvOverride('AGENT_NETWORK_RATE_WINDOW', 60000), // 1 minute
  
  // Retry configuration
  DEFAULT_MAX_RETRIES: getEnvOverride('AGENT_NETWORK_MAX_RETRIES', 3),
  DEFAULT_RETRY_DELAY: getEnvOverride('AGENT_NETWORK_RETRY_DELAY', 1000), // 1 second
  RETRY_BACKOFF_MULTIPLIER: getEnvOverride('AGENT_NETWORK_BACKOFF_MULTIPLIER', 2),
  DEFAULT_RATE_LIMIT_DELAY: getEnvOverride('AGENT_NETWORK_RATE_LIMIT_DELAY', 5000), // 5 seconds
  
  // HTTP status codes
  HTTP_STATUS_TOO_MANY_REQUESTS: getEnvOverride('AGENT_NETWORK_STATUS_TOO_MANY_REQUESTS', 429),
  HTTP_STATUS_UNAUTHORIZED: getEnvOverride('AGENT_NETWORK_STATUS_UNAUTHORIZED', 401),
  HTTP_STATUS_BAD_REQUEST: getEnvOverride('AGENT_NETWORK_STATUS_BAD_REQUEST', 400),
  HTTP_STATUS_FORBIDDEN: getEnvOverride('AGENT_NETWORK_STATUS_FORBIDDEN', 403),
  HTTP_STATUS_NOT_FOUND: getEnvOverride('AGENT_NETWORK_STATUS_NOT_FOUND', 404),
  HTTP_STATUS_SERVER_ERROR: getEnvOverride('AGENT_NETWORK_STATUS_SERVER_ERROR', 500),
  HTTP_STATUS_BAD_GATEWAY: getEnvOverride('AGENT_NETWORK_STATUS_BAD_GATEWAY', 502),
  HTTP_STATUS_SERVICE_UNAVAILABLE: getEnvOverride('AGENT_NETWORK_STATUS_SERVICE_UNAVAILABLE', 503),
  HTTP_STATUS_TIMEOUT: getEnvOverride('AGENT_NETWORK_STATUS_TIMEOUT', 408),
  
  // API pricing (per 1K tokens)
  OPENAI_PRICING: {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
  },
  FALLBACK_API_PRICING: { input: 0.03, output: 0.06 },
  TOKENS_PER_PRICING_UNIT: getEnvOverride('AGENT_NETWORK_TOKENS_PER_UNIT', 1000),
  
  // Rate limiting defaults
  DEFAULT_REQUESTS_PER_DAY: getEnvOverride('AGENT_NETWORK_REQUESTS_PER_DAY', 10000),
  INITIAL_RETRY_DELAY: getEnvOverride('AGENT_NETWORK_INITIAL_RETRY_DELAY', 1000),
  MAX_RETRY_DELAY: getEnvOverride('AGENT_NETWORK_MAX_RETRY_DELAY', 60000),
  
  // Slack-specific
  SLACK_THREAD_HISTORY_LIMIT: getEnvOverride('AGENT_NETWORK_SLACK_THREAD_LIMIT', 10),
} as const;

/**
 * Logging and Monitoring Constants
 */
export const LOGGING = {
  // Log levels (Winston numeric levels)
  LOG_LEVEL_ERROR: getEnvOverride('AGENT_LOGGING_LEVEL_ERROR', 0),
  LOG_LEVEL_WARN: getEnvOverride('AGENT_LOGGING_LEVEL_WARN', 1),
  LOG_LEVEL_INFO: getEnvOverride('AGENT_LOGGING_LEVEL_INFO', 2),
  LOG_LEVEL_HTTP: getEnvOverride('AGENT_LOGGING_LEVEL_HTTP', 3),
  LOG_LEVEL_DEBUG: getEnvOverride('AGENT_LOGGING_LEVEL_DEBUG', 4),
  
  // JSON formatting
  JSON_STRINGIFY_SPACING: getEnvOverride('AGENT_LOGGING_JSON_SPACING', 2),
  
  // Default version
  DEFAULT_VERSION: getEnvOverride('AGENT_LOGGING_DEFAULT_VERSION', '1.0.0'),
  
  // Component names
  COMPONENT_AGENT_CORE: getEnvOverride('AGENT_LOGGING_COMPONENT_AGENT', 'agent-core'),
  COMPONENT_SLACK: getEnvOverride('AGENT_LOGGING_COMPONENT_SLACK', 'slack-integration'),
  COMPONENT_OPENAI: getEnvOverride('AGENT_LOGGING_COMPONENT_OPENAI', 'openai-integration'),
  COMPONENT_ACTION: getEnvOverride('AGENT_LOGGING_COMPONENT_ACTION', 'action-system'),
  COMPONENT_GIT: getEnvOverride('AGENT_LOGGING_COMPONENT_GIT', 'git-operations'),
  COMPONENT_WORKSPACE: getEnvOverride('AGENT_LOGGING_COMPONENT_WORKSPACE', 'workspace-management'),
} as const;

/**
 * OpenAI Pricing Constants (per 1K tokens)
 */
export const OPENAI_PRICING = {
  GPT_4: {
    PROMPT_RATE: getEnvOverride('AGENT_OPENAI_GPT4_PROMPT_RATE', 0.03),
    COMPLETION_RATE: getEnvOverride('AGENT_OPENAI_GPT4_COMPLETION_RATE', 0.06),
  },
  GPT_4_TURBO: {
    PROMPT_RATE: getEnvOverride('AGENT_OPENAI_GPT4_TURBO_PROMPT_RATE', 0.01),
    COMPLETION_RATE: getEnvOverride('AGENT_OPENAI_GPT4_TURBO_COMPLETION_RATE', 0.03),
  },
  GPT_3_5_TURBO: {
    PROMPT_RATE: getEnvOverride('AGENT_OPENAI_GPT35_PROMPT_RATE', 0.0015),
    COMPLETION_RATE: getEnvOverride('AGENT_OPENAI_GPT35_COMPLETION_RATE', 0.002),
  },
  
  // Rate calculation
  TOKEN_DIVISION_FACTOR: getEnvOverride('AGENT_OPENAI_TOKEN_DIVISION_FACTOR', 1000),
} as const;

/**
 * Security Constants
 */
export const SECURITY = {
  // File permissions that require validation
  SAFE_FILE_PERMISSIONS: ['644', '640', '600'] as const,
  SAFE_DIR_PERMISSIONS: ['755', '750', '700'] as const,
  
  // URL validation patterns
  HTTPS_PROTOCOL: 'https://',
  HTTP_PROTOCOL: 'http://',
  GIT_SSH_PREFIX: 'git@',
  
  // Dangerous patterns (regex patterns as strings for environment override)
  DANGEROUS_CHMOD_PATTERN: getEnvOverride('AGENT_SECURITY_DANGEROUS_CHMOD_PATTERN', 'chmod\\s+777'),
} as const;

/**
 * Action Complexity Scoring (1-10 scale)
 */
export const ACTION_COMPLEXITY = {
  // File system operations (1-3)
  FILE_CREATE: getEnvOverride('AGENT_COMPLEXITY_FILE_CREATE', 2),
  FILE_READ: getEnvOverride('AGENT_COMPLEXITY_FILE_READ', 1),
  FILE_UPDATE: getEnvOverride('AGENT_COMPLEXITY_FILE_UPDATE', 2),
  FILE_DELETE: getEnvOverride('AGENT_COMPLEXITY_FILE_DELETE', 2),
  FILE_COPY: getEnvOverride('AGENT_COMPLEXITY_FILE_COPY', 2),
  FILE_MOVE: getEnvOverride('AGENT_COMPLEXITY_FILE_MOVE', 3),
  FILE_PERMISSIONS: getEnvOverride('AGENT_COMPLEXITY_FILE_PERMISSIONS', 3),
  FILE_SEARCH: getEnvOverride('AGENT_COMPLEXITY_FILE_SEARCH', 2),
  
  // Directory operations (1-3)
  DIR_CREATE: getEnvOverride('AGENT_COMPLEXITY_DIR_CREATE', 2),
  DIR_READ: getEnvOverride('AGENT_COMPLEXITY_DIR_READ', 1),
  DIR_DELETE: getEnvOverride('AGENT_COMPLEXITY_DIR_DELETE', 3),
  DIR_COPY: getEnvOverride('AGENT_COMPLEXITY_DIR_COPY', 3),
  DIR_MOVE: getEnvOverride('AGENT_COMPLEXITY_DIR_MOVE', 3),
  DIR_PERMISSIONS: getEnvOverride('AGENT_COMPLEXITY_DIR_PERMISSIONS', 3),
  
  // Git operations (2-5)
  GIT_CLONE: getEnvOverride('AGENT_COMPLEXITY_GIT_CLONE', 4),
  GIT_STATUS: getEnvOverride('AGENT_COMPLEXITY_GIT_STATUS', 1),
  GIT_ADD: getEnvOverride('AGENT_COMPLEXITY_GIT_ADD', 2),
  GIT_COMMIT: getEnvOverride('AGENT_COMPLEXITY_GIT_COMMIT', 3),
  GIT_PUSH: getEnvOverride('AGENT_COMPLEXITY_GIT_PUSH', 4),
  GIT_PULL: getEnvOverride('AGENT_COMPLEXITY_GIT_PULL', 4),
  GIT_BRANCH: getEnvOverride('AGENT_COMPLEXITY_GIT_BRANCH', 3),
  GIT_CHECKOUT: getEnvOverride('AGENT_COMPLEXITY_GIT_CHECKOUT', 3),
  GIT_MERGE: getEnvOverride('AGENT_COMPLEXITY_GIT_MERGE', 5),
  GIT_LOG: getEnvOverride('AGENT_COMPLEXITY_GIT_LOG', 2),
  GIT_DIFF: getEnvOverride('AGENT_COMPLEXITY_GIT_DIFF', 2),
  GIT_TAG: getEnvOverride('AGENT_COMPLEXITY_GIT_TAG', 3),
  
  // Default complexity for unknown actions
  DEFAULT_COMPLEXITY: getEnvOverride('AGENT_COMPLEXITY_DEFAULT', 5),
} as const;

/**
 * Cache Configuration Constants
 */
export const CACHE = {
  // Default cache settings
  DEFAULT_MAX_SIZE: getEnvOverride('AGENT_CACHE_DEFAULT_MAX_SIZE', 1000),
  DEFAULT_TTL: getEnvOverride('AGENT_CACHE_DEFAULT_TTL', 300000), // 5 minutes
  
  // Specific cache TTLs
  TOKEN_ESTIMATION_TTL: getEnvOverride('AGENT_CACHE_TOKEN_ESTIMATION_TTL', 3600000), // 1 hour
  CONFIG_VALIDATION_TTL: getEnvOverride('AGENT_CACHE_CONFIG_VALIDATION_TTL', 600000), // 10 minutes
  PROMPT_TEMPLATES_TTL: getEnvOverride('AGENT_CACHE_PROMPT_TEMPLATES_TTL', 1800000), // 30 minutes
} as const;

/**
 * Test Configuration Constants
 */
export const TEST = {
  // Test timeouts
  DEFAULT_TIMEOUT: getEnvOverride('AGENT_TEST_DEFAULT_TIMEOUT', 60000), // 1 minute
  LONG_TIMEOUT: getEnvOverride('AGENT_TEST_LONG_TIMEOUT', 300000), // 5 minutes
  SHORT_TIMEOUT: getEnvOverride('AGENT_TEST_SHORT_TIMEOUT', 10000), // 10 seconds
} as const;

/**
 * Environment Variable Documentation
 * 
 * This object provides documentation for all environment variables
 * that can override constants in this file.
 */
export const ENV_VAR_DOCS = {
  'AGENT_VALIDATION_MIN_CONFIDENCE': 'Minimum allowed confidence score (0-1)',
  'AGENT_VALIDATION_MAX_CONFIDENCE': 'Maximum allowed confidence score (0-1)',
  'AGENT_VALIDATION_LOW_CONFIDENCE_THRESHOLD': 'Threshold for low confidence warnings',
  'AGENT_VALIDATION_DEFAULT_CONFIDENCE': 'Default confidence score for commands',
  'AGENT_VALIDATION_MAX_RETRIES': 'Maximum number of retry attempts',
  'AGENT_TIMEOUT_DEFAULT': 'Default operation timeout in milliseconds',
  'AGENT_TIMEOUT_GIT_CLONE': 'Git clone operation timeout in milliseconds',
  'AGENT_FS_MAX_LOG_SIZE': 'Maximum log file size in bytes',
  'AGENT_FS_MAX_LOG_FILES': 'Maximum number of log files to retain',
  'AGENT_NETWORK_MAX_RETRIES': 'Default maximum number of network retries',
  'AGENT_NETWORK_RETRY_DELAY': 'Base delay between retries in milliseconds',
  // ... Add more documentation as needed
} as const;

/**
 * Validation helper to ensure constants are within expected ranges
 */
export function validateConstants(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate confidence ranges
  if (VALIDATION.MIN_CONFIDENCE < 0 || VALIDATION.MIN_CONFIDENCE > 1) {
    errors.push('MIN_CONFIDENCE must be between 0 and 1');
  }
  if (VALIDATION.MAX_CONFIDENCE < 0 || VALIDATION.MAX_CONFIDENCE > 1) {
    errors.push('MAX_CONFIDENCE must be between 0 and 1');
  }
  if (VALIDATION.LOW_CONFIDENCE_WARNING_THRESHOLD < 0 || VALIDATION.LOW_CONFIDENCE_WARNING_THRESHOLD > 1) {
    errors.push('LOW_CONFIDENCE_WARNING_THRESHOLD must be between 0 and 1');
  }
  
  // Validate timeouts are positive
  const timeoutKeys = Object.keys(TIMEOUTS) as Array<keyof typeof TIMEOUTS>;
  for (const key of timeoutKeys) {
    if (TIMEOUTS[key] <= 0) {
      errors.push(`${key} timeout must be positive`);
    }
  }
  
  // Validate file system values
  if (FILE_SYSTEM.MAX_LOG_FILE_SIZE <= 0) {
    errors.push('MAX_LOG_FILE_SIZE must be positive');
  }
  if (FILE_SYSTEM.MAX_LOG_FILES <= 0) {
    errors.push('MAX_LOG_FILES must be positive');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export a convenience object with all constants for easy importing
export const CONSTANTS = {
  VALIDATION,
  TIMEOUTS,
  FILE_SYSTEM,
  NETWORK,
  LOGGING,
  OPENAI_PRICING,
  SECURITY,
  ACTION_COMPLEXITY,
  CACHE,
  TEST,
} as const;

export default CONSTANTS;
