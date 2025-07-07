/**
 * Command Validation Rules
 * 
 * Specific validation rules for structured commands to be used by
 * ResponseParser and other command-handling components.
 */

import { ValidationRule, globalValidationEngine, ValidationEngine } from './ValidationEngine';
import { StructuredCommand } from '../promptEngineer';

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

    // Register rules for specific action types
    this.registerActionSpecificRules();
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
