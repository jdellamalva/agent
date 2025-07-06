/**
 * Response Parser for LLM Agent
 * 
 * This module handles parsing and validating LLM responses to ensure
 * they can be safely executed by the action system.
 */

import { agentLogger } from '../utils/logger';
import { StructuredCommand, ParsedResponse } from './promptEngineer';

const logger = agentLogger.child({ component: 'responseParser' });

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SafetyCheck {
  isDestructive: boolean;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  reasons: string[];
}

export class ResponseParser {
  
  private readonly destructiveActions = [
    'file_delete',
    'dir_delete', 
    'git_reset',
    'git_force_push',
    'shell_exec',
    'npm_uninstall',
    'project_delete'
  ];

  private readonly highRiskPatterns = [
    /rm\s+-rf/i,
    /sudo/i,
    /passwd/i,
    /chmod\s+777/i,
    /--force/i,
    /DROP\s+TABLE/i,
    /DELETE\s+FROM/i
  ];

  /**
   * Validate a structured command for safety and correctness
   */
  public validateCommand(command: StructuredCommand): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic structure
    if (!command.action || typeof command.action !== 'string') {
      errors.push('Command must have a valid action string');
    }

    if (!command.parameters || typeof command.parameters !== 'object') {
      errors.push('Command must have parameters object');
    }

    if (!command.reasoning || typeof command.reasoning !== 'string') {
      errors.push('Command must include reasoning');
    }

    if (typeof command.confidence !== 'number' || command.confidence < 0 || command.confidence > 1) {
      errors.push('Command confidence must be a number between 0 and 1');
    }

    // Validate action-specific parameters
    this.validateActionParameters(command, errors, warnings);

    // Check for security issues
    this.validateSecurity(command, errors, warnings);

    // Low confidence warning
    if (command.confidence < 0.7) {
      warnings.push(`Low confidence score (${command.confidence}). Consider requesting clarification.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Perform safety analysis on a command
   */
  public performSafetyCheck(command: StructuredCommand): SafetyCheck {
    const reasons: string[] = [];
    let isDestructive = false;
    let requiresApproval = false;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check if action is inherently destructive
    if (this.destructiveActions.includes(command.action)) {
      isDestructive = true;
      requiresApproval = true;
      riskLevel = 'high';
      reasons.push(`Action '${command.action}' is potentially destructive`);
    }

    // Check parameters for high-risk patterns
    const paramString = JSON.stringify(command.parameters);
    for (const pattern of this.highRiskPatterns) {
      if (pattern.test(paramString)) {
        isDestructive = true;
        requiresApproval = true;
        riskLevel = 'high';
        reasons.push(`High-risk pattern detected in parameters: ${pattern.source}`);
      }
    }

    // File operations on important system files
    if (command.parameters.path || command.parameters.file) {
      const path = command.parameters.path || command.parameters.file;
      if (typeof path === 'string') {
        if (this.isSystemPath(path)) {
          requiresApproval = true;
          riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
          reasons.push(`Operation on system path: ${path}`);
        }
      }
    }

    // Shell execution always requires approval
    if (command.action === 'shell_exec') {
      requiresApproval = true;
      riskLevel = 'high';
      reasons.push('Shell execution requires approval');
    }

    // Override if command explicitly requests approval
    if (command.requiresApproval) {
      requiresApproval = true;
      reasons.push('Command explicitly requests approval');
    }

    return {
      isDestructive,
      requiresApproval,
      riskLevel,
      reasons
    };
  }

  /**
   * Validate action-specific parameters
   */
  private validateActionParameters(command: StructuredCommand, errors: string[], warnings: string[]): void {
    const { action, parameters } = command;

    switch (action) {
      case 'file_read':
      case 'file_write':
      case 'file_delete':
        if (!parameters.path || typeof parameters.path !== 'string') {
          errors.push(`${action} requires a valid 'path' parameter`);
        }
        break;

      case 'dir_create':
      case 'dir_list':
        if (!parameters.path || typeof parameters.path !== 'string') {
          errors.push(`${action} requires a valid 'path' parameter`);
        }
        break;

      case 'git_clone':
        if (!parameters.url || typeof parameters.url !== 'string') {
          errors.push('git_clone requires a valid repository URL');
        }
        if (!parameters.destination || typeof parameters.destination !== 'string') {
          errors.push('git_clone requires a destination path');
        }
        break;

      case 'npm_install':
        if (parameters.packages && !Array.isArray(parameters.packages)) {
          errors.push('npm_install packages parameter must be an array');
        }
        break;

      case 'shell_exec':
        if (!parameters.command || typeof parameters.command !== 'string') {
          errors.push('shell_exec requires a command string');
        }
        warnings.push('Shell execution can be dangerous - ensure command is safe');
        break;

      default:
        warnings.push(`Unknown action: ${action}. Ensure it's supported by the action system.`);
    }
  }

  /**
   * Validate security aspects of the command
   */
  private validateSecurity(command: StructuredCommand, errors: string[], warnings: string[]): void {
    // Check for obvious security issues
    const paramString = JSON.stringify(command.parameters).toLowerCase();
    
    if (paramString.includes('password') || paramString.includes('secret') || paramString.includes('token')) {
      warnings.push('Parameters may contain sensitive information');
    }

    if (paramString.includes('http://') && !paramString.includes('localhost')) {
      warnings.push('Non-HTTPS URLs detected - prefer HTTPS for security');
    }

    // Path traversal check
    if (paramString.includes('../') || paramString.includes('..\\')) {
      errors.push('Path traversal detected in parameters');
    }
  }

  /**
   * Check if a path is a system path that requires special handling
   */
  private isSystemPath(path: string): boolean {
    const systemPaths = [
      '/etc',
      '/usr/bin',
      '/usr/sbin', 
      '/bin',
      '/sbin',
      '/root',
      '/var',
      '/sys',
      '/proc',
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\System32'
    ];

    return systemPaths.some(systemPath => path.startsWith(systemPath));
  }

  /**
   * Parse and validate a complete LLM response
   */
  public parseAndValidateResponse(response: ParsedResponse): {
    validCommands: StructuredCommand[];
    invalidCommands: { command: StructuredCommand; validation: ValidationResult }[];
    safetyChecks: { command: StructuredCommand; safety: SafetyCheck }[];
  } {
    const validCommands: StructuredCommand[] = [];
    const invalidCommands: { command: StructuredCommand; validation: ValidationResult }[] = [];
    const safetyChecks: { command: StructuredCommand; safety: SafetyCheck }[] = [];

    for (const command of response.commands) {
      const validation = this.validateCommand(command);
      const safety = this.performSafetyCheck(command);

      if (validation.isValid) {
        validCommands.push(command);
      } else {
        invalidCommands.push({ command, validation });
      }

      safetyChecks.push({ command, safety });

      // Log validation results
      if (!validation.isValid) {
        logger.error('Command validation failed', {
          action: command.action,
          errors: validation.errors,
          warnings: validation.warnings
        });
      } else if (validation.warnings.length > 0) {
        logger.warn('Command validation warnings', {
          action: command.action,
          warnings: validation.warnings
        });
      }

      // Log safety analysis
      if (safety.requiresApproval) {
        logger.warn('Command requires approval', {
          action: command.action,
          riskLevel: safety.riskLevel,
          reasons: safety.reasons
        });
      }
    }

    return {
      validCommands,
      invalidCommands,
      safetyChecks
    };
  }
}
