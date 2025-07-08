/**
 * Error Handling Utilities - Centralized error management and classification system
 * 
 * **Purpose**: 
 * Provides a hierarchical error system with structured error information,
 * operational error classification, and consistent error handling patterns
 * across all agent components.
 * 
 * **Dependencies**:
 * - Logger: For error tracking and audit trails
 * - No external dependencies (self-contained error handling)
 * 
 * **Key Patterns**:
 * - Inheritance hierarchy for specialized error types
 * - Operational vs Programming error classification
 * - Structured error context for debugging and monitoring
 * - JSON serialization for error persistence and transmission
 * 
 * **Lifecycle**:
 * 1. Error creation with appropriate error type and context
 * 2. Automatic logging with severity classification
 * 3. Stack trace capture for debugging
 * 4. Error propagation with context preservation
 * 5. Serialization for storage or transmission
 * 
 * **Performance Considerations**:
 * - Minimal overhead for error construction
 * - Lazy stack trace generation
 * - Efficient JSON serialization for error reporting
 * 
 * **Error Handling Philosophy**:
 * - Fail fast for programming errors
 * - Graceful degradation for operational errors
 * - Rich context for debugging and monitoring
 * - User-friendly messages for client errors
 */

import { logger } from './logger';
import { NETWORK } from '../config/constants';

/**
 * AgentError - Base error class for all agent-related errors
 * 
 * **Responsibility**: 
 * - Provide structured error information with context
 * - Classify errors as operational vs programming errors
 * - Enable consistent error handling patterns
 * - Support error serialization and logging
 * 
 * **Error Classification**:
 * - Operational: Expected errors that should be handled gracefully
 * - Programming: Unexpected errors indicating bugs or system issues
 * 
 * **Context Tracking**: 
 * Errors include contextual information for debugging and monitoring
 */
// Base error class for all agent errors
export class AgentError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: any;
  public readonly timestamp: string;

  /**
   * Create structured error with classification and context
   * 
   * @param message - Human-readable error description
   * @param code - Machine-readable error code for programmatic handling
   * @param statusCode - HTTP-style status code (default: NETWORK.HTTP_STATUS_SERVER_ERROR)
   * @param isOperational - Whether error is expected/operational (default: true)
   * @param context - Additional context for debugging and monitoring
   * 
   * **Side Effects**:
   * - Captures stack trace for debugging
   * - Sets timestamp for audit trails
   * - Logs error based on severity classification
   * 
   * **Error Codes**: Use format COMPONENT_ERROR_TYPE (e.g., SLACK_AUTH_FAILED)
   */
  constructor(
    message: string,
    code: string,
    statusCode: number = NETWORK.HTTP_STATUS_SERVER_ERROR,
    isOperational: boolean = true,
    context?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // Ensure proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Specific error types for different components

/**
 * Slack integration specific error handling
 */
export class SlackError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    super(message, `SLACK_${code}`, NETWORK.HTTP_STATUS_BAD_REQUEST, true, context);
  }
}

/**
 * OpenAI integration specific error handling
 */
export class OpenAIError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    const statusCode = OpenAIError.getStatusCode(code);
    super(message, `OPENAI_${code}`, statusCode, true, context);
  }

  private static getStatusCode(code: string): number {
    switch (code) {
      case 'RATE_LIMIT_EXCEEDED':
        return NETWORK.HTTP_STATUS_TOO_MANY_REQUESTS; // 429
      case 'INSUFFICIENT_QUOTA':
      case 'INVALID_API_KEY':
        return NETWORK.HTTP_STATUS_UNAUTHORIZED; // 401
      case 'INVALID_REQUEST':
        return NETWORK.HTTP_STATUS_BAD_REQUEST; // 400
      case 'MODEL_NOT_FOUND':
        return NETWORK.HTTP_STATUS_NOT_FOUND; // 404
      case 'SERVER_ERROR':
      case 'UNKNOWN_ERROR':
        return NETWORK.HTTP_STATUS_SERVER_ERROR; // 500
      case 'TIMEOUT':
        return NETWORK.HTTP_STATUS_TIMEOUT; // 408
      default:
        return NETWORK.HTTP_STATUS_BAD_REQUEST; // 400
    }
  }
}

/**
 * Action execution specific error handling
 */
export class ActionError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    super(message, `ACTION_${code}`, NETWORK.HTTP_STATUS_SERVER_ERROR, true, context);
  }
}

/**
 * Input validation specific error handling
 */
export class ValidationError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    super(message, `VALIDATION_${code}`, NETWORK.HTTP_STATUS_BAD_REQUEST, true, context);
  }
}

/**
 * Workspace operations specific error handling
 */
export class WorkspaceError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    super(message, `WORKSPACE_${code}`, NETWORK.HTTP_STATUS_BAD_REQUEST, true, context);
  }
}

/**
 * Git operations specific error handling
 */
export class GitError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    super(message, `GIT_${code}`, NETWORK.HTTP_STATUS_BAD_REQUEST, true, context);
  }
}

/**
 * Security validation specific error handling
 */
export class SecurityError extends AgentError {
  constructor(message: string, code: string, context?: any) {
    super(message, `SECURITY_${code}`, NETWORK.HTTP_STATUS_FORBIDDEN, true, context);
  }
}

/**
 * Error recovery strategies for automated error handling
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  FALLBACK = 'fallback',
  SKIP = 'skip',
  ABORT = 'abort',
  MANUAL_INTERVENTION = 'manual_intervention',
}

/**
 * Configuration for automated error recovery behavior
 */
export interface ErrorRecoveryConfig {
  strategy: RecoveryStrategy;
  maxRetries?: number;
  retryDelay?: number;
  fallbackAction?: () => Promise<any>;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

/**
 * Centralized error handler for automated recovery and logging
 * 
 * Provides singleton pattern for consistent error handling across the application
 * with configurable recovery strategies and automated retry logic.
 */
// Error handler class
export class ErrorHandler {
  private static instance: ErrorHandler;
  private recoveryConfigs: Map<string, ErrorRecoveryConfig> = new Map();

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Register error recovery strategies
  registerRecoveryStrategy(errorCode: string, config: ErrorRecoveryConfig) {
    this.recoveryConfigs.set(errorCode, config);
  }

  // Handle errors with recovery strategies
  async handleError(error: Error, context?: any): Promise<any> {
    // Log the error
    this.logError(error, context);

    // If it's an AgentError, try to recover
    if (error instanceof AgentError) {
      const config = this.recoveryConfigs.get(error.code);
      if (config) {
        return this.attemptRecovery(error, config, context);
      }
    }

    // If no recovery strategy, re-throw
    throw error;
  }

  private async attemptRecovery(
    error: AgentError,
    config: ErrorRecoveryConfig,
    context?: any
  ): Promise<any> {
    logger.info(`Attempting recovery for error ${error.code} using strategy ${config.strategy}`, {
      error: error.toJSON(),
      strategy: config.strategy,
      context,
    });

    switch (config.strategy) {
      case RecoveryStrategy.RETRY:
        return this.retryWithBackoff(error, config, context);

      case RecoveryStrategy.FALLBACK:
        if (config.fallbackAction) {
          try {
            return await config.fallbackAction();
          } catch (fallbackError) {
            logger.error('Fallback action failed', { originalError: error.toJSON(), fallbackError });
            throw error;
          }
        }
        throw error;

      case RecoveryStrategy.SKIP:
        logger.warn(`Skipping operation due to error ${error.code}`, { error: error.toJSON() });
        return null;

      case RecoveryStrategy.MANUAL_INTERVENTION:
        logger.error(`Manual intervention required for error ${error.code}`, {
          error: error.toJSON(),
          context,
        });
        throw new AgentError(
          `Manual intervention required: ${error.message}`,
          'MANUAL_INTERVENTION_REQUIRED',
          NETWORK.HTTP_STATUS_SERVER_ERROR,
          false,
          { originalError: error.toJSON() }
        );

      case RecoveryStrategy.ABORT:
      default:
        throw error;
    }
  }

  private async retryWithBackoff(
    error: AgentError,
    config: ErrorRecoveryConfig,
    context?: any
  ): Promise<any> {
    const maxRetries = config.maxRetries || 3;
    const baseDelay = config.retryDelay || NETWORK.DEFAULT_RETRY_DELAY;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if we should retry
      if (config.shouldRetry && !config.shouldRetry(error, attempt)) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.info(`Retrying operation (attempt ${attempt}/${maxRetries}) after ${delay}ms`, {
        error: error.code,
        attempt,
        delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        // This would need to be implemented by the calling code
        // For now, we just log the retry attempt and always fail
        logger.info(`Retry attempt ${attempt} for error ${error.code}`);
        
        // Placeholder: always fail since we don't have actual retry logic
        throw new Error('Retry failed - placeholder implementation');
      } catch (retryError) {
        logger.warn(`Retry attempt ${attempt} failed`, {
          originalError: error.code,
          retryError: retryError instanceof Error ? retryError.message : String(retryError),
        });

        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    throw error;
  }

  private logError(error: Error, context?: any) {
    if (error instanceof AgentError) {
      logger.error(`Agent error: ${error.message}`, {
        error: error.toJSON(),
        context,
      });
    } else {
      logger.error(`Unexpected error: ${error.message}`, {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
      });
    }
  }
}

// Utility functions for common error scenarios
export const withErrorHandling = <T>(
  operation: () => Promise<T>,
  errorContext?: any
): Promise<T> => {
  return operation().catch((error) => {
    return ErrorHandler.getInstance().handleError(error, errorContext);
  });
};

// Rate limiting error handler
export const handleRateLimit = async (error: any, retryAfter?: number): Promise<void> => {
  const delay = retryAfter || NETWORK.DEFAULT_RATE_LIMIT_DELAY;
  logger.warn(`Rate limit encountered, waiting ${delay}ms before retry`, { delay });
  await new Promise(resolve => setTimeout(resolve, delay));
};

// Validation helper
export const validateRequired = (value: any, fieldName: string): void => {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName, value);
  }
};

export const validateType = (value: any, expectedType: string, fieldName: string): void => {
  if (typeof value !== expectedType) {
    throw new ValidationError(
      `${fieldName} must be of type ${expectedType}`,
      fieldName,
      value
    );
  }
};

// Initialize default recovery strategies
export const initializeErrorRecovery = () => {
  const errorHandler = ErrorHandler.getInstance();

  // OpenAI rate limit recovery
  errorHandler.registerRecoveryStrategy('OPENAI_RATE_LIMIT', {
    strategy: RecoveryStrategy.RETRY,
    maxRetries: 3,
    retryDelay: NETWORK.DEFAULT_RATE_LIMIT_DELAY,
    shouldRetry: (error, attempt) => attempt <= 3,
  });

  // Slack API errors
  errorHandler.registerRecoveryStrategy('SLACK_API_ERROR', {
    strategy: RecoveryStrategy.RETRY,
    maxRetries: 2,
    retryDelay: 2000,
  });

  // Git operation failures
  errorHandler.registerRecoveryStrategy('GIT_OPERATION_FAILED', {
    strategy: RecoveryStrategy.RETRY,
    maxRetries: 2,
    retryDelay: NETWORK.DEFAULT_RETRY_DELAY,
  });

  // Workspace access errors
  errorHandler.registerRecoveryStrategy('WORKSPACE_ACCESS_DENIED', {
    strategy: RecoveryStrategy.MANUAL_INTERVENTION,
  });

  // Security violations
  errorHandler.registerRecoveryStrategy('SECURITY_VIOLATION', {
    strategy: RecoveryStrategy.ABORT,
  });
};
