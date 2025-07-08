/**
 * Governance Override Detection Utility
 * 
 * Provides a general mechanism for detecting and validating governance overrides
 * in code. Overrides must reference specific tests and provide clear justification.
 */

export interface GovernanceOverride {
  hasOverride: boolean;
  testName?: string;
  reason?: string;
  ruleType?: string;
}

/**
 * Detects governance override annotations in code lines
 * 
 * Expected format: @governance-override: <rule-type>: test=<test-name>: <reason>
 * 
 * Examples:
 * - @governance-override: magic-numbers: test=timeout.config: Jest globalSetup CommonJS limitation
 * - @governance-override: naming-conventions: test=legacy.compatibility: Third-party API requires snake_case
 * - @governance-override: import-export: test=dynamic.loading: Runtime module loading required
 * 
 * @param lines - All lines of the file
 * @param lineNumber - 1-based line number to check (checks current and previous line)
 * @param ruleType - The specific governance rule type (e.g., 'magic-numbers', 'naming-conventions')
 * @returns GovernanceOverride object with detection results
 */
export function detectGovernanceOverride(
  lines: string[], 
  lineNumber: number, 
  ruleType: string
): GovernanceOverride {
  const currentLine = lines[lineNumber - 1] || '';
  const previousLine = lineNumber > 1 ? lines[lineNumber - 2] || '' : '';
  
  // Pattern: @governance-override: <rule-type>: test=<test-name>: <reason>
  const overridePattern = new RegExp(`@governance-override:\\s*${ruleType}:\\s*test=([^:]+):\\s*(.+)`);
  
  const currentLineMatch = currentLine.match(overridePattern);
  const previousLineMatch = previousLine.match(overridePattern);
  
  if (currentLineMatch || previousLineMatch) {
    const testName = (currentLineMatch?.[1] || previousLineMatch?.[1] || '').trim();
    const reason = (currentLineMatch?.[2] || previousLineMatch?.[2] || '').trim();
    
    // Validate that both test name and reason are provided
    if (!testName || !reason) {
      return {
        hasOverride: false,
        reason: `Invalid override format: missing ${!testName ? 'test name' : 'reason'}`
      };
    }
    
    return {
      hasOverride: true,
      testName,
      reason,
      ruleType
    };
  }
  
  return { hasOverride: false };
}

/**
 * Validates that a governance override is properly formatted and complete
 * 
 * @param override - The detected override
 * @returns Validation result with any error messages
 */
export function validateGovernanceOverride(override: GovernanceOverride): {
  isValid: boolean;
  error?: string;
} {
  if (!override.hasOverride) {
    return { isValid: true }; // No override is valid
  }
  
  if (!override.testName) {
    return { 
      isValid: false, 
      error: 'Override missing test name. Format: test=<test-name>' 
    };
  }
  
  if (!override.reason) {
    return { 
      isValid: false, 
      error: 'Override missing justification reason' 
    };
  }
  
  // Test name should be descriptive (at least 3 characters)
  if (override.testName.length < 3) {
    return { 
      isValid: false, 
      error: 'Test name too short. Use descriptive test names.' 
    };
  }
  
  // Reason should be meaningful (at least 10 characters)
  if (override.reason.length < 10) {
    return { 
      isValid: false, 
      error: 'Override reason too short. Provide clear justification.' 
    };
  }
  
  return { isValid: true };
}

/**
 * Formats an override message for reporting
 * 
 * @param override - The detected override
 * @returns Formatted message string
 */
export function formatOverrideMessage(override: GovernanceOverride): string {
  if (!override.hasOverride) {
    return '';
  }
  
  return `Override: test=${override.testName}: ${override.reason}`;
}
