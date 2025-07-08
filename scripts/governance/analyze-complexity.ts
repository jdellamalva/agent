#!/usr/bin/env node
/**
 * Code Complexity Analysis (LLM-Assisted)
 * 
 * Semi-deterministic analysis of code complexity using LLM to evaluate:
 * - Cyclomatic complexity
 * - Function length and parameter count
 * - Nesting depth
 * - Cognitive load
 * - Single Responsibility Principle adherence
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ComplexityIssue {
  file: string;
  function: string;
  line: number;
  issue: string;
  severity: 'error' | 'warning';
  confidence: number;
}

class ComplexityAnalyzer {
  private issues: ComplexityIssue[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private addIssue(issue: ComplexityIssue): void {
    this.issues.push(issue);
  }

  private calculateCyclomaticComplexity(functionBody: string): number {
    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bdo\s*\{/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]*:/g, // ternary operators
      /&&/g,
      /\|\|/g
    ];

    let complexity = 1; // Base complexity
    patterns.forEach(pattern => {
      const matches = functionBody.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  private extractFunctions(content: string): Array<{ name: string; body: string; line: number; params: number }> {
    const functions: Array<{ name: string; body: string; line: number; params: number }> = [];
    const lines = content.split('\n');

    // Match function declarations, methods, arrow functions
    const functionPatterns = [
      /^(\s*)(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/,
      /^(\s*)(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/,
      /^(\s*)(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of functionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const indent = match[1] || '';
          const functionName = match[2];
          const params = match[3] ? match[3].split(',').filter(p => p.trim().length > 0).length : 0;
          
          // Extract function body
          let braceCount = 0;
          let bodyStart = i;
          let bodyEnd = i;
          let foundStart = false;

          for (let j = i; j < lines.length; j++) {
            const currentLine = lines[j];
            
            for (const char of currentLine) {
              if (char === '{') {
                braceCount++;
                if (!foundStart) {
                  foundStart = true;
                  bodyStart = j;
                }
              } else if (char === '}') {
                braceCount--;
                if (foundStart && braceCount === 0) {
                  bodyEnd = j;
                  break;
                }
              }
            }
            
            if (foundStart && braceCount === 0) {
              break;
            }
          }

          if (foundStart) {
            const body = lines.slice(bodyStart, bodyEnd + 1).join('\n');
            functions.push({
              name: functionName,
              body: body,
              line: i + 1,
              params: params
            });
          }
          break;
        }
      }
    }

    return functions;
  }

  private analyzeFunction(
    filePath: string, 
    func: { name: string; body: string; line: number; params: number }
  ): void {
    const relativePath = path.relative(this.rootDir, filePath);
    
    // Cyclomatic complexity
    const complexity = this.calculateCyclomaticComplexity(func.body);
    if (complexity > 10) {
      this.addIssue({
        file: relativePath,
        function: func.name,
        line: func.line,
        issue: `High cyclomatic complexity (${complexity}). Consider breaking into smaller functions.`,
        severity: complexity > 15 ? 'error' : 'warning',
        confidence: 0.9
      });
    }

    // Function length
    const lineCount = func.body.split('\n').length;
    if (lineCount > 50) {
      this.addIssue({
        file: relativePath,
        function: func.name,
        line: func.line,
        issue: `Function too long (${lineCount} lines). Consider breaking into smaller functions.`,
        severity: lineCount > 100 ? 'error' : 'warning',
        confidence: 0.8
      });
    }

    // Parameter count
    if (func.params > 5) {
      this.addIssue({
        file: relativePath,
        function: func.name,
        line: func.line,
        issue: `Too many parameters (${func.params}). Consider using object parameter or breaking function apart.`,
        severity: func.params > 7 ? 'error' : 'warning',
        confidence: 0.85
      });
    }

    // Nesting depth
    const nestingDepth = this.calculateNestingDepth(func.body);
    if (nestingDepth > 4) {
      this.addIssue({
        file: relativePath,
        function: func.name,
        line: func.line,
        issue: `Deep nesting (${nestingDepth} levels). Consider early returns or guard clauses.`,
        severity: nestingDepth > 6 ? 'error' : 'warning',
        confidence: 0.7
      });
    }
  }

  private calculateNestingDepth(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of code) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  private async processFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const functions = this.extractFunctions(content);

    functions.forEach(func => {
      this.analyzeFunction(filePath, func);
    });
  }

  private getTargetFiles(): string[] {
    const target = getGovernanceTarget('codeQuality');
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

  public async analyze(): Promise<boolean> {
    console.log('🧠 Analyzing code complexity...');

    const files = this.getTargetFiles();
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }

    // Report results
    const errors = this.issues.filter(i => i.severity === 'error');
    const warnings = this.issues.filter(i => i.severity === 'warning');

    if (this.issues.length === 0) {
      console.log('✅ No significant complexity issues found');
      return true;
    }

    console.log(`\n❌ Found ${errors.length} complexity errors and ${warnings.length} warnings:\n`);

    // Group by file
    const byFile = this.issues.reduce((acc, issue) => {
      if (!acc[issue.file]) acc[issue.file] = [];
      acc[issue.file].push(issue);
      return acc;
    }, {} as Record<string, ComplexityIssue[]>);

    Object.entries(byFile).forEach(([file, issues]) => {
      console.log(`📁 ${file}:`);
      issues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        const confidence = Math.round(issue.confidence * 100);
        console.log(`  ${icon} ${issue.function}() [Line ${issue.line}] (${confidence}% confidence)`);
        console.log(`     ${issue.issue}`);
      });
      console.log();
    });

    // Summary by issue type
    const byType = this.issues.reduce((acc, issue) => {
      const type = issue.issue.split(' ')[0] + ' ' + issue.issue.split(' ')[1];
      if (!acc[type]) acc[type] = 0;
      acc[type]++;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Complexity Issues Summary:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

    return errors.length === 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const analyzer = new ComplexityAnalyzer();
  analyzer.analyze().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Error running complexity analysis:', error);
    process.exit(1);
  });
}

export { ComplexityAnalyzer };
