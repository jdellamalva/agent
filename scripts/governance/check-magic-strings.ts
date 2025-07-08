#!/usr/bin/env node
/**
 * Magic Strings Detection (Deterministic)
 * 
 * Identifies hardcoded string values that should be configurable constants
 * to improve maintainability and prevent future-proofing issues.
 * 
 * Standards Enforced:
 * - String literals should not contain configuration values
 * - File paths should use path.join() or constants, not hardcoded strings
 * - Error messages should be centralized in constants or error classes
 * - URL endpoints should be configurable, not hardcoded
 * - API keys and secrets should never be hardcoded strings
 * - Database table/column names should be constants
 * - Regex patterns should be named constants with documentation
 * - CSS class names should use constants when used in multiple files
 * - Event names and message types should be constants
 * - Magic numbers in string format should be constants
 * - Log message templates should be reusable constants
 * - Validation error messages should be standardized
 * - Test data strings should be in fixtures or constants
 * - Environment variable names should be constants
 * - File extensions should use constants for consistency
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface MagicStringViolation {
  file: string;
  line: number;
  column: number;
  value: string;
  context: string;
  type: 'config' | 'path' | 'error-message' | 'url' | 'secret' | 'database' | 'regex' | 'css' | 'event' | 'other';
  severity: 'error' | 'warning';
  suggestion: string;
}

class MagicStringsChecker {
  private violations: MagicStringViolation[] = [];
  private rootDir: string;
  private fileExtensions = ['.ts', '.js', '.tsx', '.jsx', '.json'];
  
  // Patterns that indicate magic strings
  private patterns = {
    // URLs and endpoints
    url: /['"`](https?:\/\/[^'"`\s]+)['"`]/g,
    // File paths (common patterns)
    filePath: /['"`]([\/\\][\w\/\\.-]+\.(js|ts|json|md|txt|log))['"`]/g,
    // Error messages (repeated patterns)
    errorMessage: /['"`](Error:|Failed to|Cannot|Unable to)[^'"`]*['"`]/g,
    // Database-like strings
    database: /['"`](SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)[^'"`]*['"`]/gi,
    // Environment-like configs
    envConfig: /['"`](dev|prod|production|development|staging|test)['"`]/g,
    // Common magic values
    magicValues: /['"`](true|false|null|undefined|0|1|-1)['"`]/g,
    // CSS/HTML-like
    cssHtml: /['"`]([.#][\w-]+|<\/?[\w-]+>?)['"`]/g,
    // Event names
    events: /['"`](on[A-Z]\w+|[a-z]+:[a-z]+)['"`]/g
  };

  // Whitelist patterns (things that are OK to be hardcoded)
  private whitelistPatterns = [
    /console\.(log|error|warn|info|debug)/,  // Console messages
    /throw new \w*Error\(/,                   // Error constructors
    /import.*from/,                          // Import statements
    /require\(/,                             // Require statements
    /\.test\.|\.spec\./,                     // Test files get more leeway
    /'use strict'/,                          // Directive
    /process\.env\./,                        // Environment access
    /typeof.*===/                            // Type checks
  ];

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  public checkAllFiles(): MagicStringViolation[] {
    console.log('🔍 Scanning for magic strings...');
    
    const target = getGovernanceTarget('codeQuality');
    const files = this.getTargetFiles(target);
    
    for (const file of files) {
      this.checkFile(file);
    }

    return this.violations;
  }

  private getTargetFiles(target: any): string[] {
    const allFiles: string[] = [];
    
    // Use glob patterns to find files
    for (const pattern of target.includePatterns) {
      const matches = glob.sync(pattern, { 
        cwd: this.rootDir,
        absolute: true,
        ignore: target.excludePatterns 
      });
      allFiles.push(...matches);
    }
    
    // Filter by file extensions
    return allFiles.filter(file => {
      const ext = path.extname(file);
      return target.fileTypes.includes(ext);
    });
  }

  private checkFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, lineIndex) => {
      // Skip if line is whitelisted
      if (this.isWhitelisted(line)) {
        return;
      }

      // Check each pattern type
      for (const [type, pattern] of Object.entries(this.patterns)) {
        let match;
        const globalPattern = new RegExp(pattern.source, pattern.flags);
        
        while ((match = globalPattern.exec(line)) !== null) {
          const value = match[1] || match[0];
          
          // Skip very short strings (likely not magic)
          if (value.length < 3) continue;
          
          // Skip common false positives
          if (this.isFalsePositive(value, type)) continue;
          
          this.violations.push({
            file: filePath,
            line: lineIndex + 1,
            column: match.index + 1,
            value,
            context: line.trim(),
            type: type as any,
            severity: this.getSeverity(type, value),
            suggestion: this.getSuggestion(type, value)
          });
        }
      }
    });
  }

  private isWhitelisted(line: string): boolean {
    return this.whitelistPatterns.some(pattern => pattern.test(line));
  }

  private isFalsePositive(value: string, type: string): boolean {
    // Common false positives
    const falsePositives = [
      'true', 'false', 'null', 'undefined',
      'GET', 'POST', 'PUT', 'DELETE',
      'UTF-8', 'utf-8',
      'application/json',
      'text/plain',
      '.',
      '..',
      '/',
      ''
    ];

    if (falsePositives.includes(value)) return true;

    // Very generic words
    if (type === 'errorMessage' && value.split(' ').length < 3) return true;

    // Single character strings
    if (value.length === 1) return true;

    return false;
  }

  private getSeverity(type: string, value: string): 'error' | 'warning' {
    // High severity for security/config issues
    if (type === 'secret' || type === 'url') return 'error';
    if (type === 'config' || type === 'database') return 'error';
    
    // Medium severity for maintainability
    if (type === 'path' || type === 'error-message') return 'warning';
    
    return 'warning';
  }

  private getSuggestion(type: string, value: string): string {
    const suggestions = {
      config: 'Move to configuration file or environment variable',
      path: 'Use path.join() and constants for file paths',
      'error-message': 'Centralize error messages in constants or error classes',
      url: 'Move to configuration or environment variables',
      secret: 'NEVER hardcode secrets - use environment variables',
      database: 'Use constants for table/column names',
      regex: 'Define as named constant with documentation',
      css: 'Consider using CSS-in-JS or constants for repeated classes',
      event: 'Define event names as constants',
      other: 'Consider extracting to constants for maintainability'
    };

    return suggestions[type as keyof typeof suggestions] || suggestions.other;
  }

  public generateReport(): string {
    if (this.violations.length === 0) {
      return '✅ No magic strings found';
    }

    const errorCount = this.violations.filter(v => v.severity === 'error').length;
    const warningCount = this.violations.filter(v => v.severity === 'warning').length;

    let report = `\n🔮 Magic Strings Found: ${this.violations.length}\n`;
    report += `   Errors: ${errorCount}, Warnings: ${warningCount}\n\n`;

    // Summary by type
    const byType = this.violations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += '📊 By Type:\n';
    for (const [type, count] of Object.entries(byType)) {
      report += `   ${type}: ${count}\n`;
    }
    report += '\n';

    // Group by file
    const byFile = this.violations.reduce((acc, violation) => {
      if (!acc[violation.file]) acc[violation.file] = [];
      acc[violation.file].push(violation);
      return acc;
    }, {} as Record<string, MagicStringViolation[]>);

    for (const [file, violations] of Object.entries(byFile)) {
      const relativePath = path.relative(this.rootDir, file);
      report += `📁 ${relativePath}\n`;
      
      for (const violation of violations) {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        report += `   ${icon} Line ${violation.line}:${violation.column} [${violation.type}] "${violation.value}"\n`;
        report += `      Context: ${violation.context}\n`;
        report += `      💡 ${violation.suggestion}\n\n`;
      }
    }

    return report;
  }

  /**
   * Get unique magic strings for analysis
   */
  public getUniqueStrings(): Array<{value: string, count: number, type: string}> {
    const stringCounts = new Map<string, {count: number, type: string}>();
    
    for (const violation of this.violations) {
      const existing = stringCounts.get(violation.value);
      if (existing) {
        existing.count++;
      } else {
        stringCounts.set(violation.value, {count: 1, type: violation.type});
      }
    }

    return Array.from(stringCounts.entries())
      .map(([value, {count, type}]) => ({value, count, type}))
      .sort((a, b) => b.count - a.count);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const checker = new MagicStringsChecker();
  
  const violations = checker.checkAllFiles();
  const report = checker.generateReport();
  console.log(report);
  
  // Show most common magic strings
  const unique = checker.getUniqueStrings();
  if (unique.length > 0) {
    console.log('\n🔍 Most Common Magic Strings:');
    unique.slice(0, 10).forEach(({value, count, type}) => {
      console.log(`   "${value}" (${count}x, ${type})`);
    });
  }
  
  const errorCount = violations.filter(v => v.severity === 'error').length;
  process.exit(errorCount > 0 ? 1 : 0);
}

export { MagicStringsChecker };
