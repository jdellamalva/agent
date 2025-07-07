/**
 * Command Validation Rules
 * 
 * Specific validation rules for structured commands to be used by
 * ResponseParser and other command-handling components.
 */

import { globalValidationEngine, ValidationEngine } from './ValidationEngine';
import { StructuredCommand } from '../promptEngineer';
import { 
  BaseCommand, 
  ActionType, 
  ActionParameters,
  CommandValidationResult,
  ValidationError,
  ValidationWarning 
} from '../commands/CommandSchema';

export class CommandValidationRules {
  /**
   * Initialize command validation rules
   */
  static initialize(): void {
    const rules = ValidationEngine.createCommonRules();
    
    // Register rules for StructuredCommand
    globalValidationEngine.registerRules<StructuredCommand>('StructuredCommand', [
      rules.required<StructuredCommand>('action'),
      rules.stringType('action'),
      rules.required<StructuredCommand>('parameters'),
      rules.objectType('parameters'),
      rules.required<StructuredCommand>('reasoning'),
      rules.stringType('reasoning'),
      rules.required<StructuredCommand>('confidence'),
      {
        name: 'confidence-type-and-range',
        severity: 'error',
        validate: (command: StructuredCommand) => {
          if (typeof command.confidence !== 'number') {
            return { isValid: false, message: 'confidence must be a number' };
          }
          if (command.confidence < 0 || command.confidence > 1) {
            return { isValid: false, message: 'confidence must be between 0 and 1' };
          }
          return { isValid: true };
        }
      },
      rules.lowConfidenceWarning(0.7)
    ]);

    // Register rules for new BaseCommand schema
    this.registerBaseCommandRules();
    
    // Register rules for specific action types
    this.registerActionSpecificRules();
  }

  /**
   * Register validation rules for the new BaseCommand schema
   */
  private static registerBaseCommandRules(): void {
    const rules = ValidationEngine.createCommonRules();
    
    globalValidationEngine.registerRules<BaseCommand>('BaseCommand', [
      // Required fields
      rules.required<BaseCommand>('action'),
      rules.required<BaseCommand>('parameters'),
      rules.required<BaseCommand>('reasoning'),
      rules.required<BaseCommand>('confidence'),
      
      // Type validations
      {
        name: 'action-type-validation',
        severity: 'error',
        validate: (command: BaseCommand) => {
          const validActions: ActionType[] = [
            'file_create', 'file_read', 'file_update', 'file_delete',
            'dir_create', 'dir_read', 'dir_delete',
            'git_clone', 'git_status', 'git_add', 'git_commit', 'git_push', 'git_pull',
            'git_branch', 'git_checkout', 'git_merge', 'git_log', 'git_diff',
            'api_call', 'http_get', 'http_post', 'http_put', 'http_delete',
            'data_fetch', 'data_transform', 'data_validate', 'data_export',
            'code_parse', 'code_lint', 'code_test', 'code_format', 'code_analyze',
            'project_scaffold', 'project_init', 'project_build', 'project_deploy',
            'npm_install', 'npm_uninstall', 'npm_update', 'npm_run',
            'pip_install', 'pip_uninstall', 'pip_upgrade',
            'shell_exec', 'shell_script',
            'wait', 'delay', 'notify', 'log'
          ];
          
          if (!validActions.includes(command.action)) {
            return { 
              isValid: false, 
              message: `Invalid action '${command.action}'. Valid actions: ${validActions.join(', ')}` 
            };
          }
          return { isValid: true };
        }
      },
      
      rules.objectType('parameters'),
      rules.stringType('reasoning'),
      
      {
        name: 'confidence-validation',
        severity: 'error', 
        validate: (command: BaseCommand) => {
          if (typeof command.confidence !== 'number') {
            return { isValid: false, message: 'confidence must be a number' };
          }
          if (command.confidence < 0 || command.confidence > 1) {
            return { isValid: false, message: 'confidence must be between 0 and 1' };
          }
          return { isValid: true };
        }
      },
      
      {
        name: 'priority-validation',
        severity: 'warning',
        validate: (command: BaseCommand) => {
          if (command.priority && !['low', 'normal', 'high', 'urgent'].includes(command.priority)) {
            return { 
              isValid: false, 
              message: 'priority must be one of: low, normal, high, urgent' 
            };
          }
          return { isValid: true };
        }
      },
      
      rules.lowConfidenceWarning(0.7)
    ]);
  }

  /**
   * Validate a BaseCommand using the comprehensive schema
   */
  static validateBaseCommand(command: BaseCommand): CommandValidationResult {
    const result = globalValidationEngine.validate('BaseCommand', command);
    
    // Perform action-specific parameter validation
    const paramValidation = this.validateActionParameters(command.action, command.parameters);
    
    return {
      isValid: result.isValid && paramValidation.isValid,
      errors: [
        ...result.errors.map(errorMsg => ({ 
          field: 'unknown', 
          message: errorMsg, 
          code: 'VALIDATION_ERROR',
          severity: 'error' as const 
        })),
        ...paramValidation.errors
      ],
      warnings: [
        ...result.warnings.map(warningMsg => ({ 
          field: 'unknown', 
          message: warningMsg, 
          code: 'VALIDATION_WARNING',
          severity: 'warning' as const 
        })),
        ...paramValidation.warnings
      ],
      suggestions: paramValidation.suggestions || []
    };
  }

  /**
   * Validate action-specific parameters
   */
  private static validateActionParameters(action: ActionType, parameters: ActionParameters): CommandValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    try {
      switch (action) {
        case 'file_create':
          this.validateFileCreateParams(parameters, errors, warnings, suggestions);
          break;
        case 'file_read':
          this.validateFileReadParams(parameters, errors, warnings, suggestions);
          break;
        case 'git_clone':
          this.validateGitCloneParams(parameters, errors, warnings, suggestions);
          break;
        case 'shell_exec':
          this.validateShellExecParams(parameters, errors, warnings, suggestions);
          break;
        default:
          // Generic parameter validation for actions without specific rules
          if (!parameters || typeof parameters !== 'object') {
            errors.push({
              field: 'parameters',
              message: 'parameters must be an object',
              code: 'INVALID_PARAMETERS_TYPE',
              severity: 'error'
            });
          }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      errors.push({
        field: 'parameters',
        message: `Parameter validation failed: ${errorMessage}`,
        code: 'PARAMETER_VALIDATION_ERROR',
        severity: 'error'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Validate file creation parameters
   */
  private static validateFileCreateParams(
    params: any, 
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    suggestions: string[]
  ): void {
    if (!params.path || typeof params.path !== 'string') {
      errors.push({
        field: 'parameters.path',
        message: 'path is required and must be a string',
        code: 'MISSING_PATH',
        severity: 'error'
      });
    } else if (params.path.includes('..') || params.path.includes('~')) {
      errors.push({
        field: 'parameters.path',
        message: 'path cannot contain path traversal sequences (.. or ~)',
        code: 'PATH_TRAVERSAL_DETECTED',
        severity: 'error'
      });
    }

    if (!params.content || typeof params.content !== 'string') {
      errors.push({
        field: 'parameters.content',
        message: 'content is required and must be a string',
        code: 'MISSING_CONTENT',
        severity: 'error'
      });
    }
  }

  /**
   * Validate file read parameters
   */
  private static validateFileReadParams(
    params: any, 
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    suggestions: string[]
  ): void {
    if (!params.path || typeof params.path !== 'string') {
      errors.push({
        field: 'parameters.path',
        message: 'path is required and must be a string',
        code: 'MISSING_PATH',
        severity: 'error'
      });
    }
  }

  /**
   * Validate git clone parameters
   */
  private static validateGitCloneParams(
    params: any, 
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    suggestions: string[]
  ): void {
    if (!params.url || typeof params.url !== 'string') {
      errors.push({
        field: 'parameters.url',
        message: 'url is required and must be a string',
        code: 'MISSING_URL',
        severity: 'error'
      });
    } else {
      try {
        new URL(params.url);
      } catch {
        errors.push({
          field: 'parameters.url',
          message: 'url must be a valid URL',
          code: 'INVALID_URL_FORMAT',
          severity: 'error'
        });
      }
    }
  }

  /**
   * Validate shell execution parameters
   */
  private static validateShellExecParams(
    params: any, 
    errors: ValidationError[], 
    warnings: ValidationWarning[], 
    suggestions: string[]
  ): void {
    if (!params.command || typeof params.command !== 'string') {
      errors.push({
        field: 'parameters.command',
        message: 'command is required and must be a string',
        code: 'MISSING_COMMAND',
        severity: 'error'
      });
    } else {
      // Check for dangerous command patterns
      const dangerousPatterns = [
        /rm\s+-rf\s*\//, 
        /sudo\s+rm/, 
        /format\s+c:/, 
        /del\s+\/q\s+\*/,
        /DROP\s+DATABASE/i,
        /DROP\s+TABLE/i
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(params.command)) {
          errors.push({
            field: 'parameters.command',
            message: 'command contains potentially dangerous operations',
            code: 'DANGEROUS_COMMAND_DETECTED',
            severity: 'error'
          });
          suggestions.push('Consider using safer alternatives or break down the operation into smaller steps');
          break;
        }
      }
    }
  }

  /**
   * Register validation rules for specific action types
   */
  private static registerActionSpecificRules(): void {
    const rules = ValidationEngine.createCommonRules();

    // File operations
    globalValidationEngine.registerRules('file_read', [
      rules.required('path'),
      rules.stringType('path'),
      {
        name: 'path-traversal-detection',
        severity: 'error',
        validate: (params: any) => {
          const path = params.path;
          if (typeof path === 'string' && path.includes('../')) {
            return { 
              isValid: false, 
              message: 'Path traversal detected - relative paths with ".." are not allowed' 
            };
          }
          return { isValid: true };
        }
      }
    ]);

    globalValidationEngine.registerRules('file_write', [
      rules.required('path'),
      rules.stringType('path'),
      rules.required('content'),
      rules.stringType('content'),
      {
        name: 'sensitive-information-warning',
        severity: 'warning',
        validate: (params: any) => {
          const content = params.content;
          if (typeof content === 'string') {
            const sensitivePatterns = [
              /password/i,
              /secret/i,
              /token/i,
              /api[_-]?key/i,
              /private[_-]?key/i,
              /auth[_-]?key/i
            ];
            for (const pattern of sensitivePatterns) {
              if (pattern.test(content)) {
                return {
                  isValid: true,
                  message: 'Content may contain sensitive information - review carefully'
                };
              }
            }
          }
          return { isValid: true };
        }
      }
    ]);

    globalValidationEngine.registerRules('file_delete', [
      rules.required('path'),
      rules.stringType('path'),
      {
        name: 'destructive-action-warning',
        severity: 'warning',
        validate: () => ({ 
          isValid: true, 
          message: 'File deletion is destructive and requires approval' 
        })
      }
    ]);

    // Directory operations
    globalValidationEngine.registerRules('dir_create', [
      rules.required('path'),
      rules.stringType('path')
    ]);

    globalValidationEngine.registerRules('dir_list', [
      rules.required('path'),
      rules.stringType('path')
    ]);

    // Git operations
    globalValidationEngine.registerRules('git_clone', [
      rules.required('url'),
      rules.stringType('url'),
      rules.required('destination'),
      rules.stringType('destination'),
      {
        name: 'valid-git-url',
        severity: 'error',
        validate: (params: any) => {
          const url = params.url;
          const isValid = typeof url === 'string' && 
            (url.startsWith('https://') || url.startsWith('git@'));
          return isValid 
            ? { isValid: true }
            : { isValid: false, message: 'Git URL must be a valid HTTPS or SSH URL' };
        }
      },
      {
        name: 'https-url-warning',
        severity: 'warning',
        validate: (params: any) => {
          const url = params.url;
          if (typeof url === 'string' && url.startsWith('http://')) {
            return {
              isValid: true,
              message: 'Consider using HTTPS for better security'
            };
          }
          return { isValid: true };
        }
      }
    ]);

    // Shell execution
    globalValidationEngine.registerRules('shell_exec', [
      rules.required('command'),
      rules.stringType('command'),
      {
        name: 'shell-security-warning',
        severity: 'warning',
        validate: () => ({
          isValid: true,
          message: 'Shell execution can be dangerous - ensure command is safe'
        })
      },
      {
        name: 'dangerous-patterns',
        severity: 'error',
        validate: (params: any) => {
          const command = params.command;
          if (typeof command !== 'string') {
            return { isValid: true };
          }
          
          const dangerousPatterns = [
            /rm\s+-rf/i,
            /sudo/i,
            /passwd/i,
            /chmod\s+777/i,
            /--force/i,
            /DROP\s+TABLE/i,
            /DELETE\s+FROM/i
          ];
          
          for (const pattern of dangerousPatterns) {
            if (pattern.test(command)) {
              return { 
                isValid: false, 
                message: `Dangerous pattern detected: ${pattern.source}` 
              };
            }
          }
          return { isValid: true };
        }
      }
    ]);

    // NPM operations
    globalValidationEngine.registerRules('npm_install', [
      {
        name: 'packages-array',
        severity: 'error',
        validate: (params: any) => {
          if (params.packages && !Array.isArray(params.packages)) {
            return { isValid: false, message: 'packages parameter must be an array' };
          }
          return { isValid: true };
        }
      }
    ]);
  }

  /**
   * Validate a structured command
   */
  static validateCommand(command: StructuredCommand) {
    // Ensure rules are initialized
    if (!globalValidationEngine.hasRules('StructuredCommand')) {
      this.initialize();
    }
    
    const commandValidation = globalValidationEngine.validate('StructuredCommand', command);
    
    // Also validate action-specific parameters if rules exist
    const actionValidation = globalValidationEngine.validate(command.action, command.parameters);
    
    return {
      isValid: commandValidation.isValid && actionValidation.isValid,
      errors: [...commandValidation.errors, ...actionValidation.errors],
      warnings: [...commandValidation.warnings, ...actionValidation.warnings],
      passedRules: [...commandValidation.passedRules, ...actionValidation.passedRules]
    };
  }
}
