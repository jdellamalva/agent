#!/usr/bin/env node
/**
 * Documentation Coverage Script
 * 
 * Checks that all major components have proper inline documentation
 * according to the development guide standards.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { fileURLToPath } from 'url';
import { getGovernanceTarget } from './config/governance-targets.js';
import { detectGovernanceOverride, validateGovernanceOverride, formatOverrideMessage } from './utils/override-detector.js';

interface DocumentationViolation {
  file: string;
  line: number;
  type: 'missing' | 'incomplete' | 'outdated';
  component: string;
  severity: 'error' | 'warning';
  message: string;
}

interface ComponentInfo {
  name: string;
  type: 'class' | 'interface' | 'function' | 'enum';
  line: number;
  hasDocumentation: boolean;
  documentation?: string;
  methods?: string[];
  exports?: boolean;
}

class DocumentationChecker {
  private violations: DocumentationViolation[] = [];

  async check(): Promise<DocumentationViolation[]> {
    const target = getGovernanceTarget('documentation');
    const allFiles: string[] = [];
    
    // Use governance target patterns to find files
    for (const pattern of target.includePatterns) {
      const matches = await glob(pattern, { 
        ignore: target.excludePatterns 
      });
      allFiles.push(...matches);
    }
    
    // Filter by file extensions
    const files = allFiles.filter(file => {
      const ext = path.extname(file);
      return target.fileTypes.includes(ext);
    });
    
    for (const file of files) {
      await this.checkFile(file);
    }
    
    return this.violations;
  }

  private async checkFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const components = this.extractComponents(lines);
    
    // Check file-level documentation for non-trivial files
    if (components.some(c => c.exports && c.type === 'class')) {
      this.checkFileDocumentation(filePath, lines);
    }
    
    // Check each component
    for (const component of components) {
      this.checkComponentDocumentation(filePath, component, lines);
    }
  }

  private extractComponents(lines: string[]): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for exported classes
      const classMatch = line.match(/export\s+(abstract\s+)?class\s+(\w+)/);
      if (classMatch) {
        const hasDoc = this.hasDocumentationAbove(lines, i);
        components.push({
          name: classMatch[2],
          type: 'class',
          line: i + 1,
          hasDocumentation: hasDoc,
          documentation: hasDoc ? this.getDocumentationAbove(lines, i) : undefined,
          methods: this.extractClassMethods(lines, i),
          exports: true,
        });
      }
      
      // Check for exported interfaces
      const interfaceMatch = line.match(/export\s+interface\s+(\w+)/);
      if (interfaceMatch) {
        const hasDoc = this.hasDocumentationAbove(lines, i);
        components.push({
          name: interfaceMatch[1],
          type: 'interface',
          line: i + 1,
          hasDocumentation: hasDoc,
          documentation: hasDoc ? this.getDocumentationAbove(lines, i) : undefined,
          exports: true,
        });
      }
      
      // Check for exported functions
      const functionMatch = line.match(/export\s+(async\s+)?function\s+(\w+)/);
      if (functionMatch) {
        const hasDoc = this.hasDocumentationAbove(lines, i);
        components.push({
          name: functionMatch[2],
          type: 'function',
          line: i + 1,
          hasDocumentation: hasDoc,
          documentation: hasDoc ? this.getDocumentationAbove(lines, i) : undefined,
          exports: true,
        });
      }
      
      // Check for exported enums
      const enumMatch = line.match(/export\s+enum\s+(\w+)/);
      if (enumMatch) {
        const hasDoc = this.hasDocumentationAbove(lines, i);
        components.push({
          name: enumMatch[1],
          type: 'enum',
          line: i + 1,
          hasDocumentation: hasDoc,
          documentation: hasDoc ? this.getDocumentationAbove(lines, i) : undefined,
          exports: true,
        });
      }
    }
    
    return components;
  }

  private hasDocumentationAbove(lines: string[], lineIndex: number): boolean {
    // Look for JSDoc comment block above the component
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 10); i--) {
      const line = lines[i].trim();
      if (line === '' || line.startsWith('//')) continue;
      if (line.includes('*/')) {
        // Find the start of the JSDoc block
        for (let j = i; j >= 0; j--) {
          if (lines[j].trim().startsWith('/**')) {
            return true;
          }
        }
      }
      break;
    }
    return false;
  }

  private getDocumentationAbove(lines: string[], lineIndex: number): string {
    const docLines: string[] = [];
    let inDoc = false;
    
    for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 20); i--) {
      const line = lines[i].trim();
      if (line.includes('*/')) {
        inDoc = true;
        continue;
      }
      if (line.startsWith('/**')) {
        break;
      }
      if (inDoc && line.startsWith('*')) {
        docLines.unshift(line.replace(/^\*\s?/, ''));
      }
    }
    
    return docLines.join('\n');
  }

  private extractClassMethods(lines: string[], classLine: number): string[] {
    const methods: string[] = [];
    let braceCount = 0;
    let foundOpenBrace = false;
    
    for (let i = classLine; i < lines.length; i++) {
      const line = lines[i];
      
      // Count braces to know when we're inside the class
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceCount += openBraces - closeBraces;
      
      if (openBraces > 0) foundOpenBrace = true;
      if (foundOpenBrace && braceCount === 0) break;
      
      // Look for method definitions
      const methodMatch = line.match(/^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\(/);
      if (methodMatch && methodMatch[3] !== 'constructor') {
        methods.push(methodMatch[3]);
      }
    }
    
    return methods;
  }

  private checkFileDocumentation(filePath: string, lines: string[]): void {
    // File should have documentation at the top
    const hasFileDoc = this.hasFileDocumentation(lines);
    
    if (!hasFileDoc) {
      // Check for governance override
      const override = detectGovernanceOverride(lines, 1, 'documentation');
      const severity = override.hasOverride ? 'warning' : 'warning';
      const message = override.hasOverride
        ? `File is missing documentation header describing its purpose (${formatOverrideMessage(override)})`
        : 'File is missing documentation header describing its purpose';
      
      this.violations.push({
        file: filePath,
        line: 1,
        type: 'missing',
        component: 'file',
        severity,
        message,
      });
    }
  }

  private hasFileDocumentation(lines: string[]): boolean {
    // Look for file-level documentation in first 20 lines
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      if (lines[i].trim().startsWith('/**')) {
        return true;
      }
    }
    return false;
  }

  private checkComponentDocumentation(filePath: string, component: ComponentInfo, lines: string[]): void {
    if (!component.exports) return; // Only check exported components
    
    if (!component.hasDocumentation) {
      // Check for governance override
      const override = detectGovernanceOverride(lines, component.line, 'documentation');
      const severity = override.hasOverride ? 'warning' : (component.type === 'class' ? 'error' : 'warning');
      const message = override.hasOverride 
        ? `Exported ${component.type} '${component.name}' is missing documentation (${formatOverrideMessage(override)})`
        : `Exported ${component.type} '${component.name}' is missing documentation`;
      
      this.violations.push({
        file: filePath,
        line: component.line,
        type: 'missing',
        component: `${component.type} ${component.name}`,
        severity,
        message,
      });
      return;
    }
    
    // Check documentation quality
    if (component.documentation) {
      this.checkDocumentationQuality(filePath, component, lines);
    }
  }

  private checkDocumentationQuality(filePath: string, component: ComponentInfo, lines: string[]): void {
    const doc = component.documentation!;
    
    // Check for minimum documentation standards
    if (doc.length < 20) {
      this.violations.push({
        file: filePath,
        line: component.line,
        type: 'incomplete',
        component: `${component.type} ${component.name}`,
        severity: 'warning',
        message: `Documentation for '${component.name}' is too brief (less than 20 characters)`,
      });
    }
    
    // For classes, check for additional required sections
    if (component.type === 'class') {
      const requiredSections = ['Purpose', 'Dependencies', 'Key Patterns'];
      const missingSections = requiredSections.filter(section => 
        !doc.toLowerCase().includes(section.toLowerCase())
      );
      
      if (missingSections.length > 0) {
        // Check for governance override
        const override = detectGovernanceOverride(lines, component.line, 'documentation');
        const severity = override.hasOverride ? 'warning' : 'warning';
        const message = override.hasOverride
          ? `Class documentation missing sections: ${missingSections.join(', ')} (${formatOverrideMessage(override)})`
          : `Class documentation missing sections: ${missingSections.join(', ')}`;
        
        this.violations.push({
          file: filePath,
          line: component.line,
          type: 'incomplete',
          component: `class ${component.name}`,
          severity,
          message,
        });
      }
    }
    
    // Check for @param and @returns for functions
    if (component.type === 'function') {
      // This is a simplified check - in practice, you'd parse the function signature
      if (doc.includes('(') && !doc.includes('@param')) {
        this.violations.push({
          file: filePath,
          line: component.line,
          type: 'incomplete',
          component: `function ${component.name}`,
          severity: 'warning',
          message: `Function '${component.name}' appears to have parameters but is missing @param documentation`,
        });
      }
    }
  }
}

async function main() {
  console.log('📚 Checking documentation coverage...\n');
  
  const checker = new DocumentationChecker();
  const violations = await checker.check();
  
  if (violations.length === 0) {
    console.log('✅ All components have proper documentation!');
    process.exit(0);
  }
  
  // Group violations by file
  const violationsByFile = violations.reduce((acc, violation) => {
    if (!acc[violation.file]) {
      acc[violation.file] = [];
    }
    acc[violation.file].push(violation);
    return acc;
  }, {} as Record<string, DocumentationViolation[]>);
  
  console.log(`❌ Found ${violations.length} documentation issues:\n`);
  
  for (const [file, fileViolations] of Object.entries(violationsByFile)) {
    console.log(`📁 ${file}`);
    
    fileViolations.forEach(violation => {
      const icon = violation.severity === 'error' ? '🚨' : '⚠️';
      console.log(`  ${icon} Line ${violation.line} - ${violation.component}`);
      console.log(`     ${violation.message}`);
    });
    
    console.log();
  }
  
  const errors = violations.filter(v => v.severity === 'error').length;
  const warnings = violations.filter(v => v.severity === 'warning').length;
  
  console.log(`📊 Summary: ${errors} errors, ${warnings} warnings`);
  console.log('\n💡 Tip: Add JSDoc comments above exported components');
  
  // Exit with error if there are any errors
  process.exit(errors > 0 ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  main().catch(console.error);
}

export { DocumentationChecker };
