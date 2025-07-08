#!/usr/bin/env node
/**
 * Naming Conventions Governance Check
 * 
 * Deterministically enforces naming conventions across the codebase:
 * - PascalCase for classes, interfaces, types, enums
 * - camelCase for functions, variables, properties
 * - SCREAMING_SNAKE_CASE for constants
 * - kebab-case for file names
 * - No single letter variables (except loop counters i, j, k)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';
import { detectGovernanceOverride, validateGovernanceOverride, formatOverrideMessage } from './utils/override-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface NamingViolation {
  file: string;
  line: number;
  column: number;
  rule: string;
  actual: string;
  expected: string;
  severity: 'error' | 'warning';
}

class NamingConventionsChecker {
  private violations: NamingViolation[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private addViolation(violation: NamingViolation): void {
    this.violations.push(violation);
  }

  private isPascalCase(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  private isCamelCase(name: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }

  private isScreamingSnakeCase(name: string): boolean {
    return /^[A-Z][A-Z0-9_]*$/.test(name);
  }

  private isKebabCase(name: string): boolean {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);
  }

  private isValidLoopCounter(name: string): boolean {
    return ['i', 'j', 'k', 'x', 'y', 'z'].includes(name);
  }

  private isBuiltinOrAllowed(name: string): boolean {
    const allowed = [
      // Common abbreviations
      'id', 'url', 'uri', 'api', 'sdk', 'llm', 'ai', 'ui', 'db', 'io',
      // Common short names
      'req', 'res', 'err', 'msg', 'evt', 'ctx', 'env', 'cfg', 'src', 'dst',
      // Node.js globals
      '__dirname', '__filename', 'process', 'console', 'Buffer', 'global',
      // Test variables
      'mock', 'spy', 'stub'
    ];
    return allowed.includes(name) || name.length > 2;
  }

  private checkFileContent(filePath: string, content: string): void {
    const lines = content.split('\n');
    const relativePath = path.relative(this.rootDir, filePath);

    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;

      // Check class declarations
      const classMatch = line.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (classMatch) {
        const className = classMatch[1];
        if (!this.isPascalCase(className)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(className),
            rule: 'class-naming',
            actual: className,
            expected: 'PascalCase',
            severity: 'error'
          });
        }
      }

      // Check interface declarations
      const interfaceMatch = line.match(/interface\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (interfaceMatch) {
        const interfaceName = interfaceMatch[1];
        if (!this.isPascalCase(interfaceName)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(interfaceName),
            rule: 'interface-naming',
            actual: interfaceName,
            expected: 'PascalCase',
            severity: 'error'
          });
        }
      }

      // Check type declarations
      const typeMatch = line.match(/type\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (typeMatch) {
        const typeName = typeMatch[1];
        if (!this.isPascalCase(typeName)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(typeName),
            rule: 'type-naming',
            actual: typeName,
            expected: 'PascalCase',
            severity: 'error'
          });
        }
      }

      // Check enum declarations
      const enumMatch = line.match(/enum\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (enumMatch) {
        const enumName = enumMatch[1];
        if (!this.isPascalCase(enumName)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(enumName),
            rule: 'enum-naming',
            actual: enumName,
            expected: 'PascalCase',
            severity: 'error'
          });
        }
      }

      // Check function declarations
      const functionMatch = line.match(/(?:function|async\s+function)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (functionMatch) {
        const functionName = functionMatch[1];
        if (!this.isCamelCase(functionName)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(functionName),
            rule: 'function-naming',
            actual: functionName,
            expected: 'camelCase',
            severity: 'error'
          });
        }
      }

      // Check const declarations for constants (SCREAMING_SNAKE_CASE)
      const constMatch = line.match(/const\s+([A-Z_][A-Z0-9_]*)\s*=/);
      if (constMatch) {
        const constName = constMatch[1];
        if (!this.isScreamingSnakeCase(constName)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(constName),
            rule: 'constant-naming',
            actual: constName,
            expected: 'SCREAMING_SNAKE_CASE',
            severity: 'error'
          });
        }
      }

      // Check variable declarations (camelCase)
      const varMatches = line.matchAll(/(?:let|var|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
      for (const match of varMatches) {
        const varName = match[1];
        // Skip constants (already checked above)
        if (!/^[A-Z_]/.test(varName)) {
          if (!this.isCamelCase(varName) && !this.isValidLoopCounter(varName) && !this.isBuiltinOrAllowed(varName)) {
            this.addViolation({
              file: relativePath,
              line: lineNumber,
              column: line.indexOf(varName),
              rule: 'variable-naming',
              actual: varName,
              expected: 'camelCase',
              severity: varName.length === 1 ? 'error' : 'warning'
            });
          }
        }
      }

      // Check method declarations
      const methodMatch = line.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
      if (methodMatch && !line.includes('function')) {
        const methodName = methodMatch[1];
        if (!this.isCamelCase(methodName) && !['constructor'].includes(methodName)) {
          this.addViolation({
            file: relativePath,
            line: lineNumber,
            column: line.indexOf(methodName),
            rule: 'method-naming',
            actual: methodName,
            expected: 'camelCase',
            severity: 'error'
          });
        }
      }
    });
  }

  private checkFileName(filePath: string): void {
    const fileName = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(this.rootDir, filePath);

    // Skip special files
    if (['index', 'README', 'CHANGELOG', 'LICENSE'].includes(fileName) || 
        fileName.startsWith('.') || 
        fileName.includes('.config') ||
        fileName.includes('.test') ||
        fileName.includes('.spec')) {
      return;
    }

    // Check TypeScript files use PascalCase or kebab-case
    if (filePath.endsWith('.ts') && !filePath.includes('.d.ts')) {
      if (!this.isPascalCase(fileName) && !this.isKebabCase(fileName)) {
        this.addViolation({
          file: relativePath,
          line: 0,
          column: 0,
          rule: 'file-naming',
          actual: fileName,
          expected: 'PascalCase or kebab-case',
          severity: 'warning'
        });
      }
    }
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

  public async check(): Promise<boolean> {
    console.log('🔤 Checking naming conventions...');

    const files = this.getTargetFiles();
    
    for (const filePath of files) {
      this.checkFileName(filePath);
      const content = fs.readFileSync(filePath, 'utf-8');
      this.checkFileContent(filePath, content);
    }

    // Report results
    const errors = this.violations.filter(v => v.severity === 'error');
    const warnings = this.violations.filter(v => v.severity === 'warning');

    if (this.violations.length === 0) {
      console.log('✅ All naming conventions are properly followed');
      return true;
    }

    console.log(`\n❌ Found ${errors.length} naming errors and ${warnings.length} warnings:\n`);

    // Group by file
    const byFile = this.violations.reduce((acc, violation) => {
      if (!acc[violation.file]) acc[violation.file] = [];
      acc[violation.file].push(violation);
      return acc;
    }, {} as Record<string, NamingViolation[]>);

    Object.entries(byFile).forEach(([file, violations]) => {
      console.log(`📁 ${file}:`);
      violations.forEach(violation => {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} Line ${violation.line}: ${violation.rule}`);
        console.log(`     Found: "${violation.actual}"`);
        console.log(`     Expected: ${violation.expected}`);
      });
      console.log();
    });

    return errors.length === 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const checker = new NamingConventionsChecker();
  checker.check().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Error running naming conventions check:', error);
    process.exit(1);
  });
}

export { NamingConventionsChecker };
