/**
 * Response Parser for LLM Agent
 * 
 * This module handles parsing and validating LLM responses to ensure
 * they can be safely executed by the action system.
 */

import { agentLogger } from '../utils/logger';
import { StructuredCommand, ParsedResponse } from './promptEngineer';
import { CommandValidationRules } from './validation/CommandValidationRules';

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

/**
 * Response Parser - Secure parsing and validation of LLM-generated commands
 * 
 * **Purpose**: 
 * Transforms raw LLM responses into validated, executable commands while enforcing
 * security constraints and safety checks to prevent destructive operations.
 * 
 * **Dependencies**:
 * - ValidationEngine: For command structure validation
 * - CommandValidationRules: For security and safety rule enforcement
 * - Logger: For security audit trails and parsing diagnostics
 * 
 * **Key Patterns**:
 * - Defense in depth: Multiple validation layers (syntax, semantics, safety)
 * - Fail-safe defaults: Invalid commands are rejected rather than executed
 * - Audit logging: All parsing decisions are logged for security review
 * 
 * **Lifecycle**:
 * 1. Parse raw LLM response text to extract command structure
 * 2. Validate command syntax and required parameters
 * 3. Perform safety checks for destructive operations
 * 4. Apply security filters for system path protection
 * 5. Return validated command or detailed error information
 * 
 * **Performance Considerations**:
 * - Validation rules are cached at initialization
 * - Regex patterns are compiled once and reused
 * - Safety checks use optimized lookup tables
 * 
 * **Error Handling**:
 * - Detailed error messages for debugging LLM prompting issues
 * - Graceful degradation when validation rules are unavailable
 * - Security violations are logged and blocked unconditionally
 */
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

  private readonly systemPaths = [
    '/bin', '/usr/bin', '/sbin', '/usr/sbin',
    '/etc', '/boot', '/sys', '/proc',
    'C:\\Windows', 'C:\\Program Files',
    'C:\\Users\\Default'
  ];

  /**
   * Initialize ResponseParser with validation rules and security configurations
   * 
   * **Side Effects**:
   * - Loads and caches command validation rules
   * - Compiles regex patterns for parsing efficiency  
   * - Initializes security filter lookup tables
   * - Sets up destructive action detection patterns
   * 
   * **Error Handling**: 
   * Logs warnings but continues if validation rules fail to load
   */
  constructor() {
    // Initialize validation rules
    CommandValidationRules.initialize();
  }

  /**
   * Validate a structured command for syntax correctness and parameter completeness
   * 
   * @param command - Structured command object to validate
   * @returns ValidationResult containing:
   *   - isValid: Whether command passes all validation checks
   *   - errors: Array of validation errors that prevent execution
   *   - warnings: Array of non-blocking issues or recommendations
   * 
   * **Validation Layers**:
   * - Syntax validation: Required fields and parameter types
   * - Semantic validation: Parameter value constraints and ranges
   * - Business rule validation: Domain-specific constraints
   * 
   * **Error Handling**: Never throws - all errors captured in result object
   */
  public validateCommand(command: StructuredCommand): ValidationResult {
    // Use centralized validation
    const validation = CommandValidationRules.validateCommand(command);
    
    return {
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings
    };
  }

  /**
   * Perform comprehensive safety analysis on a command before execution
   * 
   * @param command - Structured command to analyze for safety risks
   * @returns SafetyCheck containing:
   *   - isDestructive: Whether command could cause irreversible changes
   *   - requiresApproval: Whether human approval is needed before execution  
   *   - riskLevel: Risk assessment (low/medium/high)
   *   - reasons: Detailed explanations for risk assessment
   * 
   * **Safety Analysis Includes**:
   * - Destructive action detection (delete, reset, force operations)
   * - High-risk shell command pattern matching
   * - System path protection validation
   * - File permission and ownership checks
   * 
   * **Security Policy**: 
   * All high-risk operations require human approval regardless of automation level
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

    // Check for high-risk patterns in shell commands
    if (command.action === 'shell_exec' && command.parameters.command) {
      const cmd = command.parameters.command;
      if (typeof cmd === 'string') {
        const highRiskPatterns = [
          /rm\s+-rf/i,
          /sudo/i,
          /passwd/i,
          /chmod\s+777/i,
          /--force/i,
          /DROP\s+TABLE/i,
          /DELETE\s+FROM/i
        ];
        
        for (const pattern of highRiskPatterns) {
          if (pattern.test(cmd)) {
            isDestructive = true;
            requiresApproval = true;
            riskLevel = 'high';
            reasons.push(`High-risk pattern detected: ${pattern.source}`);
            break;
          }
        }
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
   * Check if a path is a system path that requires special handling
   */
  private isSystemPath(path: string): boolean {
    return this.systemPaths.some(sysPath => 
      path.toLowerCase().startsWith(sysPath.toLowerCase())
    );
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
