#!/usr/bin/env node
/**
 * Magic Numbers Detection Script
 * 
 * Scans codebase for hardcoded values that should be in constants.ts
 * Part of the automated code governance system.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';
import { detectGovernanceOverride, validateGovernanceOverride, formatOverrideMessage } from './utils/override-detector.js';

// Patterns that indicate magic numbers/hardcoded values
const MAGIC_NUMBER_PATTERNS = [
  // HTTP status codes
  /\b(200|201|400|401|403|404|429|500|502|503)\b/g,
  // Common timeouts/delays
  /\b(1000|5000|10000|30000|60000)\b/g,
  // Confidence/percentage values
  /\b(0\.\d+)\b/g,
  // File size limits
  /\b(\d+)\s*\*\s*1024/g,
  // Common multipliers
  /\/\s*(1000|100)\b/g,
];

// Whitelist patterns - these are acceptable hardcoded values
const WHITELIST_PATTERNS = [
  // Array indices and basic math
  /\[\s*[01]\s*\]/,
  /\b[01]\s*[\+\-\*\/]/,
  // Function parameter defaults in interfaces
  /\?\s*:\s*\d+/,
  // Test assertions
  /expect.*\.toBe\(/,
  // Version numbers
  /['"`]\d+\.\d+\.\d+['"`]/,
  // Base conversions
  /toString\(\d+\)/,
];

interface MagicNumberViolation {
  file: string;
  line: number;
  column: number;
  value: string;
  context: string;
  severity: 'error' | 'warning';
}

class MagicNumberDetector {
  private violations: MagicNumberViolation[] = [];

  async scan(): Promise<MagicNumberViolation[]> {
    const target = getGovernanceTarget('codeQuality');
    const files = await glob(target.includePatterns, { ignore: target.excludePatterns });
    
    // Filter to only include supported file types
    const filteredFiles = files.filter(file => 
      target.fileTypes.some(ext => file.endsWith(ext))
    );
    
    console.log(`Scanning ${filteredFiles.length} files for magic numbers...`);
    
    for (const file of filteredFiles) {
      await this.scanFile(file);
    }
    
    return this.violations;
  }

  private async scanFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      this.scanLine(filePath, line, index + 1, lines);
    });
  }

  private scanLine(filePath: string, line: string, lineNumber: number, lines: string[]): void {
    // Skip comments and strings to avoid false positives
    const cleanLine = this.removeCommentsAndStrings(line);
    
    for (const pattern of MAGIC_NUMBER_PATTERNS) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      
      while ((match = pattern.exec(cleanLine)) !== null) {
        const value = match[0];
        const column = match.index + 1;
        
        // Check if this value is whitelisted
        if (this.isWhitelisted(line, value)) {
          continue;
        }
        
        // Check if already using constants
        if (this.isUsingConstants(line)) {
          continue;
        }
        
        // Check for governance override annotation
        const override = detectGovernanceOverride(lines, lineNumber, 'magic-numbers');
        const validation = validateGovernanceOverride(override);
        
        if (!validation.isValid) {
          // Invalid override format - report as error
          this.violations.push({
            file: filePath,
            line: lineNumber,
            column,
            value,
            context: `${line.trim()} [Invalid override: ${validation.error}]`,
            severity: 'error',
          });
          continue;
        }
        
        if (override.hasOverride) {
          // Valid override - downgrade to warning
          this.violations.push({
            file: filePath,
            line: lineNumber,
            column,
            value,
            context: `${line.trim()} [${formatOverrideMessage(override)}]`,
            severity: 'warning',
          });
          continue;
        }
        
        this.violations.push({
          file: filePath,
          line: lineNumber,
          column,
          value,
          context: line.trim(),
          severity: this.getSeverity(value),
        });
      }
    }
  }

  private removeCommentsAndStrings(line: string): string {
    // Remove single-line comments
    line = line.replace(/\/\/.*$/, '');
    
    // Remove string literals (basic approach)
    line = line.replace(/'[^']*'/g, '""');
    line = line.replace(/"[^"]*"/g, '""');
    line = line.replace(/`[^`]*`/g, '""');
    
    return line;
  }

  private isWhitelisted(line: string, value: string): boolean {
    return WHITELIST_PATTERNS.some(pattern => pattern.test(line));
  }

  private isUsingConstants(line: string): boolean {
    // Check if line imports or uses constants
    return /import.*constants|VALIDATION\.|TIMEOUTS\.|NETWORK\.|OPENAI_PRICING\.|FILE_SYSTEM\.|TEST\.|CACHE\./.test(line) ||
           // Also check for comments referencing constants (e.g., "// TEST.DEFAULT_TIMEOUT from constants")
           /\/\/.*(?:TEST\.|VALIDATION\.|TIMEOUTS\.|NETWORK\.|CACHE\.).*(?:constants|from)/.test(line);
  }

  private getSeverity(value: string): 'error' | 'warning' {
    // HTTP status codes and timeouts are errors (unless overridden)
    if (/^(200|201|400|401|403|404|429|500|502|503|1000|5000|10000|30000|60000)$/.test(value)) {
      return 'error';
    }
    
    // Other patterns are warnings
    return 'warning';
  }
}

async function main() {
  console.log('🔍 Scanning for magic numbers and hardcoded values...');
  
  const detector = new MagicNumberDetector();
  const violations = await detector.scan();
  
  if (violations.length === 0) {
    console.log('✅ No magic numbers detected!');
    process.exit(0);
  }
  
  // Group violations by file
  const violationsByFile = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {} as Record<string, MagicNumberViolation[]>);
  
  console.log(`❌ Found ${violations.length} potential magic numbers:`);
  
  for (const [file, fileViolations] of Object.entries(violationsByFile)) {
    console.log(`📁 ${file}`);
    
    fileViolations.forEach(violation => {
      const icon = violation.severity === 'error' ? '🚨' : '⚠️';
      console.log(`  ${icon} Line ${violation.line}:${violation.column} - "${violation.value}"`);
      console.log(`     Context: ${violation.context}`);
    });
  }
  
  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;
  
  console.log(`📊 Summary: ${errors} errors, ${warnings} warnings`);
  console.log('\n💡 Tip: Move hardcoded values to src/config/constants.ts');
  
  // Exit with error if there are any errors
  process.exit(errors > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-magic-numbers.ts')) {
  main().catch(console.error);
}

export { MagicNumberDetector };
