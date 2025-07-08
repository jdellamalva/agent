#!/usr/bin/env node
/**
 * TODO/FIXME Standards Governance Check
 * 
 * Deterministically enforces TODO and FIXME standards:
 * - All TODOs must have format: TODO(owner): description [deadline]
 * - All FIXMEs must have format: FIXME(owner): description [severity]
 * - No orphaned TODOs/FIXMEs without context
 * - Deadline tracking for overdue items
 * - Proper owner attribution and accountability
 * 
 * Standards Enforced:
 * - TODO format: TODO(owner): description [deadline]
 * - FIXME format: FIXME(owner): description [severity]
 * - Owner must be valid username or email
 * - Description must be at least 10 characters
 * - Deadline formats: YYYY-MM-DD, Q1 YYYY, v1.2, Phase N
 * - Severity levels: critical, high, medium, low
 * - No orphaned or legacy format TODO/FIXME comments
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TodoViolation {
  file: string;
  line: number;
  rule: string;
  actual: string;
  expected: string;
  severity: 'error' | 'warning';
}

class TodoStandardsChecker {
  private violations: TodoViolation[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private addViolation(violation: TodoViolation): void {
    this.violations.push(violation);
  }

  private isValidTodoFormat(todo: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Expected format: TODO(owner): description [deadline]
    const todoRegex = /^TODO\(([^)]+)\):\s*(.+?)(?:\s*\[([^\]]+)\])?$/;
    const match = todo.match(todoRegex);

    if (!match) {
      issues.push('Invalid format. Expected: TODO(owner): description [deadline]');
      return { valid: false, issues };
    }

    const [, owner, description, deadline] = match;

    // Check owner
    if (!owner || owner.trim().length === 0) {
      issues.push('Owner cannot be empty');
    } else if (owner.includes(' ') && !owner.includes('@')) {
      issues.push('Owner should be a username or email');
    }

    // Check description
    if (!description || description.trim().length < 10) {
      issues.push('Description should be at least 10 characters');
    }

    // Check deadline format if present
    if (deadline) {
      const deadlineFormats = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^Q[1-4]\s+\d{4}$/, // Q1 2024
        /^v\d+\.\d+$/, // v1.2
        /^Phase\s+\d+$/ // Phase 3
      ];

      const isValidDeadline = deadlineFormats.some(format => format.test(deadline.trim()));
      if (!isValidDeadline) {
        issues.push('Deadline format should be YYYY-MM-DD, Q1 YYYY, v1.2, or Phase N');
      }

      // Check if deadline is overdue (for date format)
      const dateMatch = deadline.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateMatch) {
        const deadlineDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (deadlineDate < today) {
          issues.push(`Deadline ${deadline} is overdue`);
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }

  private isValidFixmeFormat(fixme: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Expected format: FIXME(owner): description [severity]
    const fixmeRegex = /^FIXME\(([^)]+)\):\s*(.+?)(?:\s*\[(critical|high|medium|low)\])?$/;
    const match = fixme.match(fixmeRegex);

    if (!match) {
      issues.push('Invalid format. Expected: FIXME(owner): description [severity]');
      return { valid: false, issues };
    }

    const [, owner, description, severity] = match;

    // Check owner
    if (!owner || owner.trim().length === 0) {
      issues.push('Owner cannot be empty');
    } else if (owner.includes(' ') && !owner.includes('@')) {
      issues.push('Owner should be a username or email');
    }

    // Check description
    if (!description || description.trim().length < 10) {
      issues.push('Description should be at least 10 characters');
    }

    // Check severity
    if (severity && !['critical', 'high', 'medium', 'low'].includes(severity.toLowerCase())) {
      issues.push('Severity must be: critical, high, medium, or low');
    }

    return { valid: issues.length === 0, issues };
  }

  private checkFileContent(filePath: string, content: string): void {
    const lines = content.split('\n');
    const relativePath = path.relative(this.rootDir, filePath);

    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      const trimmedLine = line.trim();

      // Check for TODOs
      const todoMatch = line.match(/\b(TODO.*?)(?:$|\*\/)/);
      if (todoMatch) {
        const todoText = todoMatch[1].trim().replace(/^\*\s*/, ''); // Remove comment markers
        const validation = this.isValidTodoFormat(todoText);
        
        if (!validation.valid) {
          validation.issues.forEach(issue => {
            this.addViolation({
              file: relativePath,
              line: lineNumber,
              rule: 'todo-format',
              actual: todoText,
              expected: issue,
              severity: issue.includes('overdue') ? 'error' : 'warning'
            });
          });
        }
      }

      // Check for FIXMEs
      const fixmeMatch = line.match(/\b(FIXME.*?)(?:$|\*\/)/);
      if (fixmeMatch) {
        const fixmeText = fixmeMatch[1].trim().replace(/^\*\s*/, ''); // Remove comment markers
        const validation = this.isValidFixmeFormat(fixmeText);
        
        if (!validation.valid) {
          validation.issues.forEach(issue => {
            this.addViolation({
              file: relativePath,
              line: lineNumber,
              rule: 'fixme-format',
              actual: fixmeText,
              expected: issue,
              severity: 'warning'
            });
          });
        }
      }

      // Check for orphaned TODO/FIXME (common antipatterns)
      if (trimmedLine.match(/^\/\/\s*(TODO|FIXME)\s*$/)) {
        this.addViolation({
          file: relativePath,
          line: lineNumber,
          rule: 'orphaned-todo',
          actual: trimmedLine,
          expected: 'TODO/FIXME must include owner and description',
          severity: 'error'
        });
      }

      // Check for old-style TODOs
      if (trimmedLine.match(/^\/\/\s*TODO\s*[^(]/)) {
        this.addViolation({
          file: relativePath,
          line: lineNumber,
          rule: 'legacy-todo-format',
          actual: trimmedLine,
          expected: 'Use new format: TODO(owner): description [deadline]',
          severity: 'warning'
        });
      }

      // Check for XXX, HACK, TEMP etc. (should be converted to TODO/FIXME)
      const deprecatedMarkers = ['XXX', 'HACK', 'TEMP', 'KLUDGE', 'WORKAROUND'];
      deprecatedMarkers.forEach(marker => {
        if (trimmedLine.includes(marker) && !trimmedLine.includes('TODO') && !trimmedLine.includes('FIXME')) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            rule: 'deprecated-marker',
            actual: marker,
            expected: 'Use TODO or FIXME instead of deprecated markers',
            severity: 'warning'
          });
        }
      });
    });
  }

  private getTargetFiles(): string[] {
    const target = getGovernanceTarget('projectManagement');
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

  public async check(): Promise<boolean> {
    console.log('📝 Checking TODO/FIXME standards...');

    const files = this.getTargetFiles();
    
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.checkFileContent(filePath, content);
    }

    // Report results
    const errors = this.violations.filter(v => v.severity === 'error');
    const warnings = this.violations.filter(v => v.severity === 'warning');

    if (this.violations.length === 0) {
      console.log('✅ All TODO/FIXME standards are properly followed');
      return true;
    }

    console.log(`\n❌ Found ${errors.length} TODO/FIXME errors and ${warnings.length} warnings:\n`);

    // Group by file
    const byFile = this.violations.reduce((acc, violation) => {
      if (!acc[violation.file]) acc[violation.file] = [];
      acc[violation.file].push(violation);
      return acc;
    }, {} as Record<string, TodoViolation[]>);

    Object.entries(byFile).forEach(([file, violations]) => {
      console.log(`📁 ${file}:`);
      violations.forEach(violation => {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} Line ${violation.line}: ${violation.rule}`);
        console.log(`     Found: "${violation.actual}"`);
        console.log(`     Issue: ${violation.expected}`);
      });
      console.log();
    });

    // Summary of overdue TODOs
    const overdue = this.violations.filter(v => v.expected.includes('overdue'));
    if (overdue.length > 0) {
      console.log(`⚠️  ${overdue.length} overdue TODO(s) found!`);
    }

    return errors.length === 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const checker = new TodoStandardsChecker();
  checker.check().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Error running TODO/FIXME check:', error);
    process.exit(1);
  });
}

export { TodoStandardsChecker };
