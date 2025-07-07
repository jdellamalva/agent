/**
 * Centralized Validation Engine
 * 
 * Provides reusable validation logic to eliminate duplication across
 * ResponseParser, PromptEngineer, and other components.
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
