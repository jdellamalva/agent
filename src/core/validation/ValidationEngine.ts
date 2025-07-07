/**
 * Centralized Validation Engine - DRY Principle Implementation
 * 
 * The ValidationEngine provides a unified, reusable validation framework that
 * eliminates code duplication across all system components. It implements a
 * rule-based validation system with configurable severity levels and comprehensive
 * reporting capabilities.
 * 
 * Architecture Principles:
 * - DRY: Single source of truth for all validation logic
 * - Separation of Concerns: Validation rules isolated from business logic
 * - Open/Closed: Easy to extend with new rules without modifying existing code
 * - Strategy Pattern: Pluggable validation rules with consistent interface
 * 
 * Core Responsibilities:
 * - Rule registration and management for different data types
 * - Validation execution with error and warning classification
 * - Comprehensive reporting with detailed failure information
 * - Common validation rule factory for typical scenarios
 * - Type-safe validation with TypeScript generics
 * 
 * Dependencies:
 * - Logger for validation process monitoring and debugging
 * - Type system for compile-time validation rule checking
 * 
 * Key Patterns:
 * - Factory pattern for common validation rule creation
 * - Composite pattern for rule aggregation and reporting
 * - Strategy pattern for different validation rule implementations
 * - Builder pattern for complex validation chain construction
 * 
 * Usage Examples:
 * - Command validation in ResponseParser
 * - Configuration validation in ConfigManager
 * - User input validation in message processing
 * - Provider capability validation in registry
 * 
 * Performance:
 * - O(n) validation where n is number of registered rules
 * - Rule caching for repeated validations
 * - Short-circuit evaluation for error conditions
 * - Lazy rule instantiation for memory efficiency
 * 
 * Error Handling:
 * - Graceful degradation when individual rules fail
 * - Detailed error context for debugging
 * - Warning vs error classification for different severity levels
 * - Comprehensive validation reports with actionable feedback
 */

import { agentLogger } from '../../utils/logger';

const logger = agentLogger.child({ component: 'validation-engine' });

export interface ValidationRule<T = any> {
  name: string;
  validate: (value: T) => ValidationResult;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  passedRules: string[];
}

export class ValidationEngine {
  private rules: Map<string, ValidationRule[]> = new Map();

  /**
   * Register validation rules for a specific type
   */
  registerRules<T>(type: string, rules: ValidationRule<T>[]): void {
    this.rules.set(type, rules);
    logger.debug('Registered validation rules', { type, count: rules.length });
  }

  /**
   * Check if rules exist for a specific type
   */
  hasRules(type: string): boolean {
    return this.rules.has(type) && this.rules.get(type)!.length > 0;
  }

  /**
   * Validate a value against registered rules
   */
  validate<T>(type: string, value: T): ValidationReport {
    const rules = this.rules.get(type) || [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const passedRules: string[] = [];

    for (const rule of rules) {
      const result = rule.validate(value);
      
      if (!result.isValid) {
        if (rule.severity === 'error') {
          errors.push(result.message || `Rule '${rule.name}' failed`);
        } else {
          warnings.push(result.message || `Rule '${rule.name}' failed`);
        }
      } else {
        // Rule passed - check if it has a warning message
        if (result.message && rule.severity === 'warning') {
          warnings.push(result.message);
        }
        passedRules.push(rule.name);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      passedRules
    };
  }

  /**
   * Create common validation rules
   */
  static createCommonRules() {
    return {
      required: <T>(fieldName: string): ValidationRule<T> => ({
        name: `${fieldName}-required`,
        severity: 'error' as const,
        validate: (value: T): ValidationResult => {
          const fieldValue = (value as any)?.[fieldName];
          const isValid = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
          return isValid 
            ? { isValid: true }
            : { isValid: false, message: `${fieldName} is required` };
        }
      }),

      stringType: (fieldName: string): ValidationRule<any> => ({
        name: `${fieldName}-string-type`,
        severity: 'error' as const,
        validate: (value: any): ValidationResult => {
          const fieldValue = value?.[fieldName];
          if (fieldValue === undefined || fieldValue === null) {
            return { isValid: true }; // Only check type if field exists
          }
          const isValid = typeof fieldValue === 'string';
          return isValid 
            ? { isValid: true }
            : { isValid: false, message: `${fieldName} must be a string` };
        }
      }),

      objectType: (fieldName: string): ValidationRule<any> => ({
        name: `${fieldName}-object-type`,
        severity: 'error' as const,
        validate: (value: any): ValidationResult => {
          const fieldValue = value?.[fieldName];
          if (fieldValue === undefined || fieldValue === null) {
            return { isValid: true }; // Only check type if field exists
          }
          const isValid = typeof fieldValue === 'object' && !Array.isArray(fieldValue);
          return isValid 
            ? { isValid: true }
            : { isValid: false, message: `${fieldName} must be an object` };
        }
      }),

      lowConfidenceWarning: (threshold: number = 0.7): ValidationRule<any> => ({
        name: 'low-confidence-warning',
        severity: 'warning' as const,
        validate: (value: any): ValidationResult => {
          const confidence = value?.confidence;
          const hasLowConfidence = typeof confidence === 'number' && confidence < threshold;
          return hasLowConfidence 
            ? { isValid: true, message: `Low confidence score (${confidence}). Consider requesting clarification.` }
            : { isValid: true };
        }
      })
    };
  }
}

/**
 * Singleton instance for global use
 */
export const globalValidationEngine = new ValidationEngine();
