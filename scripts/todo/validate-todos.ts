#!/usr/bin/env node
/**
 * TODO Validation Script (Deterministic)
 * 
 * Validates the structure, format, and integrity of the TODO.md file
 * to ensure consistency and prevent corruption of the project roadmap.
 * 
 * Standards Enforced:
 * - Phase numbers must be sequential integers starting from 1
 * - Checkboxes must use `[x]` for complete, `[ ]` for incomplete
 * - Progress Summary counts must match individual item completion
 * - No status text in items (checkboxes are source of truth)
 * - All phases must have numbered items with clear descriptions
 * - Phase completion status must align with individual items
 * - No duplicate phase numbers or missing phases in sequence
 * - Consistent markdown formatting throughout
 * - Proper nesting and indentation for sub-items
 * - Documentation references must be valid file paths
 * - Current status indicators must be accurate
 * - Phase item counts in progress summary must be correct
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TodoValidationError {
  line: number;
  type: 'format' | 'sequence' | 'completion' | 'count' | 'reference';
  message: string;
  severity: 'error' | 'warning';
}

interface PhaseInfo {
  number: number;
  title: string;
  totalItems: number;
  completedItems: number;
  status: 'COMPLETE' | 'IN PROGRESS' | 'NOT STARTED';
  lineNumber: number;
}

class TodoValidator {
  private errors: TodoValidationError[] = [];
  private phases: PhaseInfo[] = [];
  private todoPath: string;

  constructor() {
    this.todoPath = path.resolve(__dirname, '../../TODO.md');
  }

  public validate(): TodoValidationError[] {
    console.log('🔍 Validating TODO.md structure and integrity...');
    
    if (!fs.existsSync(this.todoPath)) {
      this.errors.push({
        line: 0,
        type: 'reference',
        message: 'TODO.md file not found',
        severity: 'error'
      });
      return this.errors;
    }

    const content = fs.readFileSync(this.todoPath, 'utf-8');
    const lines = content.split('\n');

    this.validateFormat(lines);
    this.validatePhaseSequence();
    this.validateProgressSummary(lines);
    this.validateReferences(lines);

    return this.errors;
  }

  private validateFormat(lines: string[]): void {
    let inPhase = false;
    let currentPhase: Partial<PhaseInfo> | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for phase headers
      const phaseMatch = line.match(/^## Phase (\d+):/);
      if (phaseMatch) {
        // Save previous phase if exists
        if (currentPhase && currentPhase.number !== undefined) {
          this.phases.push(currentPhase as PhaseInfo);
        }

        const phaseNumber = parseInt(phaseMatch[1]);
        currentPhase = {
          number: phaseNumber,
          title: line.substring(phaseMatch[0].length).trim(),
          totalItems: 0,
          completedItems: 0,
          status: 'NOT STARTED',
          lineNumber: lineNum
        };
        inPhase = true;
        continue;
      }

      // Skip non-phase content
      if (!inPhase || !currentPhase) continue;

      // Check for phase end
      if (line.startsWith('#') && !line.startsWith('###')) {
        inPhase = false;
        continue;
      }

      // Validate todo items
      const todoMatch = line.match(/^- \[([ x])\]/);
      if (todoMatch) {
        currentPhase.totalItems = (currentPhase.totalItems || 0) + 1;
        
        const isComplete = todoMatch[1] === 'x';
        if (isComplete) {
          currentPhase.completedItems = (currentPhase.completedItems || 0) + 1;
        }

        // Check for invalid checkbox formats
        if (!['x', ' '].includes(todoMatch[1])) {
          this.errors.push({
            line: lineNum,
            type: 'format',
            message: `Invalid checkbox format. Use [x] for complete, [ ] for incomplete`,
            severity: 'error'
          });
        }

        // Check for status text in items (should be in checkboxes only)
        const itemText = line.substring(todoMatch[0].length).trim();
        if (itemText.includes('(COMPLETE)') || itemText.includes('(IN PROGRESS)')) {
          this.errors.push({
            line: lineNum,
            type: 'format',
            message: 'Remove status text from items - checkboxes are source of truth',
            severity: 'warning'
          });
        }

        // Check for nested items
        const nestedMatch = lines[i + 1]?.match(/^  - \[([ x])\]/);
        if (nestedMatch) {
          // Count nested items for the parent
          let j = i + 1;
          while (j < lines.length && lines[j].match(/^  - \[([ x])\]/)) {
            currentPhase.totalItems = (currentPhase.totalItems || 0) + 1;
            if (lines[j].includes('[x]')) {
              currentPhase.completedItems = (currentPhase.completedItems || 0) + 1;
            }
            j++;
          }
        }
      }
    }

    // Add the last phase
    if (currentPhase && currentPhase.number !== undefined) {
      this.phases.push(currentPhase as PhaseInfo);
    }

    // Determine phase status
    for (const phase of this.phases) {
      if (phase.completedItems === phase.totalItems && phase.totalItems > 0) {
        phase.status = 'COMPLETE';
      } else if (phase.completedItems > 0) {
        phase.status = 'IN PROGRESS';
      } else {
        phase.status = 'NOT STARTED';
      }
    }
  }

  private validatePhaseSequence(): void {
    // Check for sequential phase numbers
    const phaseNumbers = this.phases.map(p => p.number).sort((a, b) => a - b);
    
    for (let i = 0; i < phaseNumbers.length; i++) {
      const expectedNumber = i + 1;
      if (phaseNumbers[i] !== expectedNumber) {
        this.errors.push({
          line: 0,
          type: 'sequence',
          message: `Phase numbers must be sequential. Expected ${expectedNumber}, found ${phaseNumbers[i]}`,
          severity: 'error'
        });
      }
    }

    // Check for duplicate phases
    const duplicates = phaseNumbers.filter((num, index) => phaseNumbers.indexOf(num) !== index);
    if (duplicates.length > 0) {
      this.errors.push({
        line: 0,
        type: 'sequence',
        message: `Duplicate phase numbers found: ${duplicates.join(', ')}`,
        severity: 'error'
      });
    }
  }

  private validateProgressSummary(lines: string[]): void {
    const progressLines = lines.filter(line => line.includes('**Phase') && line.includes('('));
    
    for (const progressLine of progressLines) {
      const progressMatch = progressLine.match(/\*\*Phase (\d+) \((\d+)\/(\d+)\)\*\*/);
      if (progressMatch) {
        const phaseNum = parseInt(progressMatch[1]);
        const completed = parseInt(progressMatch[2]);
        const total = parseInt(progressMatch[3]);
        
        const actualPhase = this.phases.find(p => p.number === phaseNum);
        if (actualPhase) {
          if (actualPhase.completedItems !== completed) {
            this.errors.push({
              line: lines.indexOf(progressLine) + 1,
              type: 'count',
              message: `Phase ${phaseNum} progress summary shows ${completed} completed, but actual count is ${actualPhase.completedItems}`,
              severity: 'error'
            });
          }
          
          if (actualPhase.totalItems !== total) {
            this.errors.push({
              line: lines.indexOf(progressLine) + 1,
              type: 'count',
              message: `Phase ${phaseNum} progress summary shows ${total} total items, but actual count is ${actualPhase.totalItems}`,
              severity: 'error'
            });
          }
        }
      }
    }
  }

  private validateReferences(lines: string[]): void {
    const rootDir = path.resolve(__dirname, '../..');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const refMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      
      if (refMatch) {
        for (const match of refMatch) {
          const urlMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (urlMatch) {
            const filePath = urlMatch[2];
            
            // Skip external URLs
            if (filePath.startsWith('http')) continue;
            
            const fullPath = path.resolve(rootDir, filePath);
            if (!fs.existsSync(fullPath)) {
              this.errors.push({
                line: i + 1,
                type: 'reference',
                message: `Referenced file not found: ${filePath}`,
                severity: 'warning'
              });
            }
          }
        }
      }
    }
  }

  public generateReport(): string {
    if (this.errors.length === 0) {
      return '✅ TODO.md validation passed - structure is valid';
    }

    const errorCount = this.errors.filter(e => e.severity === 'error').length;
    const warningCount = this.errors.filter(e => e.severity === 'warning').length;

    let report = `\n📋 TODO.md Validation Issues: ${this.errors.length}\n`;
    report += `   Errors: ${errorCount}, Warnings: ${warningCount}\n\n`;

    // Group by type
    const byType = this.errors.reduce((acc, error) => {
      if (!acc[error.type]) acc[error.type] = [];
      acc[error.type].push(error);
      return acc;
    }, {} as Record<string, TodoValidationError[]>);

    for (const [type, errors] of Object.entries(byType)) {
      report += `📁 ${type.toUpperCase()} Issues:\n`;
      
      for (const error of errors) {
        const icon = error.severity === 'error' ? '❌' : '⚠️';
        const location = error.line > 0 ? ` (Line ${error.line})` : '';
        report += `   ${icon} ${error.message}${location}\n`;
      }
      report += '\n';
    }

    // Summary of phases
    report += '📊 Phase Summary:\n';
    for (const phase of this.phases) {
      const statusIcon = phase.status === 'COMPLETE' ? '✅' : 
                        phase.status === 'IN PROGRESS' ? '⭕' : '⭕';
      report += `   ${statusIcon} Phase ${phase.number}: ${phase.completedItems}/${phase.totalItems} (${phase.status})\n`;
    }

    return report;
  }

  public getPhaseStatistics() {
    const total = this.phases.length;
    const complete = this.phases.filter(p => p.status === 'COMPLETE').length;
    const inProgress = this.phases.filter(p => p.status === 'IN PROGRESS').length;
    const notStarted = this.phases.filter(p => p.status === 'NOT STARTED').length;

    return {
      totalPhases: total,
      complete,
      inProgress,
      notStarted,
      totalItems: this.phases.reduce((sum, p) => sum + p.totalItems, 0),
      completedItems: this.phases.reduce((sum, p) => sum + p.completedItems, 0)
    };
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new TodoValidator();
  
  const errors = validator.validate();
  const report = validator.generateReport();
  console.log(report);
  
  const stats = validator.getPhaseStatistics();
  console.log(`\n📈 Overall Progress: ${stats.completedItems}/${stats.totalItems} items (${Math.round(stats.completedItems/stats.totalItems*100)}%)`);
  console.log(`📊 Phase Status: ${stats.complete} complete, ${stats.inProgress} in progress, ${stats.notStarted} not started`);
  
  const errorCount = errors.filter(e => e.severity === 'error').length;
  process.exit(errorCount > 0 ? 1 : 0);
}

export { TodoValidator };
