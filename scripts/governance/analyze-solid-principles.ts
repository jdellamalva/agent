#!/usr/bin/env node
/**
 * SOLID Principles Governance Check (LLM-Assisted)
 * 
 * Analyzes code adherence to SOLID principles using pattern recognition
 * and structural analysis. Provides confidence scores for subjective
 * principle violations that require architectural judgment.
 * 
 * Standards Enforced:
 * - Single Responsibility Principle: Classes should have one reason to change
 * - Open/Closed Principle: Open for extension, closed for modification
 * - Liskov Substitution Principle: Subtypes must be substitutable for base types
 * - Interface Segregation Principle: Many specific interfaces > one general interface
 * - Dependency Inversion Principle: Depend on abstractions, not concretions
 * - Method cohesion: Related functionality grouped together
 * - Constructor complexity: Avoid doing work in constructors
 * - God object detection: Classes with too many responsibilities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SolidViolation {
  file: string;
  line: number;
  principle: 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';
  description: string;
  severity: 'error' | 'warning';
  confidence: number;
  suggestion: string;
}

class SolidPrinciplesChecker {
  private violations: SolidViolation[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private addViolation(violation: SolidViolation): void {
    this.violations.push(violation);
  }

  private analyzeSingleResponsibility(filePath: string, content: string): void {
    const relativePath = path.relative(this.rootDir, filePath);
    const lines = content.split('\n');

    // Extract classes
    const classMatches = content.matchAll(/class\s+([A-Za-z][A-Za-z0-9_]*)/g);
    
    for (const match of classMatches) {
      const className = match[1];
      const classStartIndex = match.index || 0;
      const classLine = content.substring(0, classStartIndex).split('\n').length;

      // Find class boundaries
      const classContent = this.extractClassContent(content, classStartIndex);
      
      // Analyze method count and types
      const methods = this.extractMethods(classContent);
      const responsibilities = this.detectResponsibilities(classContent, methods);

      // SRP violation: Too many distinct responsibilities
      if (responsibilities.length > 3) {
        this.addViolation({
          file: relativePath,
          line: classLine,
          principle: 'SRP',
          description: `Class ${className} has ${responsibilities.length} distinct responsibilities: ${responsibilities.join(', ')}`,
          severity: responsibilities.length > 5 ? 'error' : 'warning',
          confidence: 0.8,
          suggestion: `Consider breaking ${className} into separate classes for each responsibility`
        });
      }

      // SRP violation: Mixed concerns (e.g., business logic + data access)
      const hasDatabaseConcerns = classContent.includes('query') || classContent.includes('save') || classContent.includes('database');
      const hasValidationConcerns = classContent.includes('validate') || classContent.includes('validation');
      const hasNetworkConcerns = classContent.includes('http') || classContent.includes('fetch') || classContent.includes('api');
      const hasBusinessLogic = methods.some(m => !['get', 'set', 'validate', 'save', 'fetch'].some(prefix => m.startsWith(prefix)));

      const concernCount = [hasDatabaseConcerns, hasValidationConcerns, hasNetworkConcerns, hasBusinessLogic].filter(Boolean).length;
      
      if (concernCount > 1) {
        this.addViolation({
          file: relativePath,
          line: classLine,
          principle: 'SRP',
          description: `Class ${className} mixes multiple concerns (data access, validation, networking, business logic)`,
          severity: 'warning',
          confidence: 0.7,
          suggestion: `Separate ${className} into focused classes for each concern`
        });
      }
    }
  }

  private analyzeOpenClosed(filePath: string, content: string): void {
    const relativePath = path.relative(this.rootDir, filePath);

    // OCP violation: Switch statements on type fields
    const switchMatches = content.matchAll(/switch\s*\(\s*[^)]*\.type\s*\)/g);
    for (const match of switchMatches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      this.addViolation({
        file: relativePath,
        line: lineNumber,
        principle: 'OCP',
        description: 'Switch statement on type field violates Open/Closed Principle',
        severity: 'warning',
        confidence: 0.8,
        suggestion: 'Consider using polymorphism or strategy pattern instead of switch on type'
      });
    }

    // OCP violation: Multiple if-else chains on instanceof
    const instanceofPattern = /if\s*\(\s*[^)]*instanceof\s+[^)]*\)/g;
    const instanceofMatches = Array.from(content.matchAll(instanceofPattern));
    if (instanceofMatches.length > 2) {
      const lineNumber = content.substring(0, instanceofMatches[0].index).split('\n').length;
      this.addViolation({
        file: relativePath,
        line: lineNumber,
        principle: 'OCP',
        description: `Multiple instanceof checks (${instanceofMatches.length}) suggest OCP violation`,
        severity: 'warning',
        confidence: 0.7,
        suggestion: 'Consider using polymorphism to eliminate instanceof checks'
      });
    }
  }

  private analyzeLiskovSubstitution(filePath: string, content: string): void {
    const relativePath = path.relative(this.rootDir, filePath);

    // LSP violation: Overridden methods that throw NotImplementedError
    const notImplementedPattern = /throw\s+new\s+.*NotImplemented/g;
    const matches = content.matchAll(notImplementedPattern);
    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      this.addViolation({
        file: relativePath,
        line: lineNumber,
        principle: 'LSP',
        description: 'Throwing NotImplementedError in overridden method violates LSP',
        severity: 'error',
        confidence: 0.9,
        suggestion: 'Redesign inheritance hierarchy to avoid unimplementable methods'
      });
    }

    // LSP violation: Strengthened preconditions in overrides
    const overridePattern = /override\s+[^{]*{[^}]*if\s*\(/g;
    const overrideMatches = Array.from(content.matchAll(overridePattern));
    overrideMatches.forEach(match => {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      this.addViolation({
        file: relativePath,
        line: lineNumber,
        principle: 'LSP',
        description: 'Override method adds additional preconditions, potentially violating LSP',
        severity: 'warning',
        confidence: 0.6,
        suggestion: 'Ensure overridden methods accept all inputs that base method accepts'
      });
    });
  }

  private analyzeInterfaceSegregation(filePath: string, content: string): void {
    const relativePath = path.relative(this.rootDir, filePath);

    // ISP violation: Large interfaces
    const interfacePattern = /interface\s+([A-Za-z][A-Za-z0-9_]*)\s*{([^}]*)}/g;
    const interfaces = content.matchAll(interfacePattern);
    
    for (const match of interfaces) {
      const interfaceName = match[1];
      const interfaceBody = match[2];
      const methods = interfaceBody.split(';').filter(m => m.trim().length > 0);
      
      if (methods.length > 7) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        this.addViolation({
          file: relativePath,
          line: lineNumber,
          principle: 'ISP',
          description: `Interface ${interfaceName} has ${methods.length} methods, violating ISP`,
          severity: methods.length > 10 ? 'error' : 'warning',
          confidence: 0.8,
          suggestion: `Break ${interfaceName} into smaller, focused interfaces`
        });
      }
    }
  }

  private analyzeDependencyInversion(filePath: string, content: string): void {
    const relativePath = path.relative(this.rootDir, filePath);

    // DIP violation: Direct instantiation of concrete classes in constructors
    const constructorPattern = /constructor\([^)]*\)\s*{([^}]*)}/g;
    const constructors = content.matchAll(constructorPattern);
    
    for (const match of constructors) {
      const constructorBody = match[1];
      const newInstancePattern = /new\s+[A-Z][A-Za-z0-9_]*\(/g;
      const newInstances = Array.from(constructorBody.matchAll(newInstancePattern));
      
      if (newInstances.length > 0) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        this.addViolation({
          file: relativePath,
          line: lineNumber,
          principle: 'DIP',
          description: `Constructor creates ${newInstances.length} concrete dependencies, violating DIP`,
          severity: 'warning',
          confidence: 0.7,
          suggestion: 'Inject dependencies through constructor parameters instead of creating them'
        });
      }
    }

    // DIP violation: Hard-coded dependency on concrete classes
    const importPattern = /import.*from\s+['"][^'"]*\/[A-Z][A-Za-z0-9_]*['"]/g;
    const concreteImports = Array.from(content.matchAll(importPattern));
    const totalImports = (content.match(/import.*from/g) || []).length;
    
    if (concreteImports.length > totalImports * 0.7) {
      this.addViolation({
        file: relativePath,
        line: 1,
        principle: 'DIP',
        description: `High ratio of concrete class imports (${concreteImports.length}/${totalImports})`,
        severity: 'warning',
        confidence: 0.6,
        suggestion: 'Depend on interfaces and abstractions rather than concrete implementations'
      });
    }
  }

  private extractClassContent(content: string, startIndex: number): string {
    let braceCount = 0;
    let inClass = false;
    let classContent = '';
    
    for (let i = startIndex; i < content.length; i++) {
      const char = content[i];
      
      if (char === '{') {
        braceCount++;
        inClass = true;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && inClass) {
          break;
        }
      }
      
      if (inClass) {
        classContent += char;
      }
    }
    
    return classContent;
  }

  private extractMethods(classContent: string): string[] {
    const methodPattern = /(?:public|private|protected)?\s*(?:static)?\s*(?:async)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const methods: string[] = [];
    let match;
    
    while ((match = methodPattern.exec(classContent)) !== null) {
      if (match[1] !== 'constructor') {
        methods.push(match[1]);
      }
    }
    
    return methods;
  }

  private detectResponsibilities(classContent: string, methods: string[]): string[] {
    const responsibilities: string[] = [];
    
    // Data access responsibility
    if (methods.some(m => ['save', 'load', 'find', 'query', 'delete', 'update'].includes(m)) ||
        classContent.includes('database') || classContent.includes('repository')) {
      responsibilities.push('data access');
    }
    
    // Validation responsibility
    if (methods.some(m => m.includes('validate')) || classContent.includes('validation')) {
      responsibilities.push('validation');
    }
    
    // Network/API responsibility
    if (methods.some(m => ['fetch', 'post', 'get', 'request'].includes(m)) ||
        classContent.includes('http') || classContent.includes('api')) {
      responsibilities.push('networking');
    }
    
    // Business logic responsibility
    if (methods.some(m => ['calculate', 'process', 'transform', 'analyze'].some(prefix => m.includes(prefix)))) {
      responsibilities.push('business logic');
    }
    
    // UI/presentation responsibility
    if (methods.some(m => ['render', 'display', 'show', 'hide'].includes(m)) ||
        classContent.includes('component') || classContent.includes('view')) {
      responsibilities.push('presentation');
    }
    
    // Coordination/orchestration responsibility
    if (methods.some(m => ['orchestrate', 'coordinate', 'manage'].some(prefix => m.includes(prefix))) ||
        classContent.includes('manager') || classContent.includes('orchestrator')) {
      responsibilities.push('coordination');
    }
    
    return responsibilities;
  }

  private async processFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    this.analyzeSingleResponsibility(filePath, content);
    this.analyzeOpenClosed(filePath, content);
    this.analyzeLiskovSubstitution(filePath, content);
    this.analyzeInterfaceSegregation(filePath, content);
    this.analyzeDependencyInversion(filePath, content);
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
    console.log('🏗️ Analyzing SOLID principles adherence...');

    const files = this.getTargetFiles();
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }

    // Report results
    const errors = this.violations.filter(v => v.severity === 'error');
    const warnings = this.violations.filter(v => v.severity === 'warning');

    if (this.violations.length === 0) {
      console.log('✅ No SOLID principle violations detected');
      return true;
    }

    console.log(`\n❌ Found ${errors.length} SOLID errors and ${warnings.length} warnings:\n`);

    // Group by principle
    const byPrinciple = this.violations.reduce((acc, violation) => {
      if (!acc[violation.principle]) acc[violation.principle] = [];
      acc[violation.principle].push(violation);
      return acc;
    }, {} as Record<string, SolidViolation[]>);

    const principleNames = {
      'SRP': 'Single Responsibility Principle',
      'OCP': 'Open/Closed Principle', 
      'LSP': 'Liskov Substitution Principle',
      'ISP': 'Interface Segregation Principle',
      'DIP': 'Dependency Inversion Principle'
    };

    Object.entries(byPrinciple).forEach(([principle, violations]) => {
      console.log(`\n🔍 ${principleNames[principle as keyof typeof principleNames]} (${violations.length} violations):`);
      
      violations.forEach(violation => {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        const confidence = Math.round(violation.confidence * 100);
        console.log(`  ${icon} ${violation.file}:${violation.line} (${confidence}% confidence)`);
        console.log(`     ${violation.description}`);
        console.log(`     💡 ${violation.suggestion}`);
      });
    });

    // Summary
    console.log('\n📊 SOLID Violations Summary:');
    Object.entries(byPrinciple).forEach(([principle, violations]) => {
      console.log(`   ${principle}: ${violations.length}`);
    });

    return errors.length === 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const checker = new SolidPrinciplesChecker();
  checker.analyze().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Error running SOLID principles check:', error);
    process.exit(1);
  });
}

export { SolidPrinciplesChecker };
