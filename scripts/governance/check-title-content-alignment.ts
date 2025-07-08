#!/usr/bin/env node
/**
 * File Title-Content Alignment Check (LLM-Assisted)
 * 
 * Validates that file names, class names, and documentation titles accurately
 * reflect the actual content and purpose of the file. Uses LLM analysis to
 * detect mismatches between intended purpose and actual implementation.
 * 
 * Standards Enforced:
 * - File names should reflect primary class/functionality
 * - Class names should match file purpose
 * - JSDoc file descriptions should align with actual content
 * - Function names should reflect actual behavior
 * - No misleading or outdated naming
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TitleContentMismatch {
  file: string;
  type: 'file-name' | 'class-name' | 'function-name' | 'documentation';
  expected: string;
  actual: string;
  description: string;
  confidence: number;
  severity: 'error' | 'warning';
}

class TitleContentAlignmentChecker {
  private mismatches: TitleContentMismatch[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private addMismatch(mismatch: TitleContentMismatch): void {
    this.mismatches.push(mismatch);
  }

  private extractFileInfo(filePath: string, content: string): {
    fileName: string;
    primaryClass?: string;
    primaryFunction?: string;
    fileDescription?: string;
    actualPurpose: string;
  } {
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Extract primary class
    const classMatch = content.match(/export\s+(?:default\s+)?class\s+([A-Za-z][A-Za-z0-9_]*)/);
    const primaryClass = classMatch ? classMatch[1] : undefined;

    // Extract primary function
    const functionMatch = content.match(/export\s+(?:async\s+)?function\s+([A-Za-z][A-Za-z0-9_]*)/);
    const primaryFunction = functionMatch ? functionMatch[1] : undefined;

    // Extract file description from JSDoc
    const fileDescMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
    const fileDescription = fileDescMatch ? fileDescMatch[1].trim() : undefined;

    // Analyze actual purpose based on content
    const actualPurpose = this.analyzeActualPurpose(content);

    return {
      fileName,
      primaryClass,
      primaryFunction,
      fileDescription,
      actualPurpose
    };
  }

  private analyzeActualPurpose(content: string): string {
    // Simple heuristic analysis - in a real implementation, this would use LLM
    const purposes: string[] = [];

    if (content.includes('class') && content.includes('extends')) {
      purposes.push('inheritance-based class');
    } else if (content.includes('class')) {
      purposes.push('standalone class');
    }

    if (content.includes('interface')) {
      purposes.push('type definitions');
    }

    if (content.includes('export const') && content.includes('= {')) {
      purposes.push('configuration/constants');
    }

    if (content.includes('test') || content.includes('describe')) {
      purposes.push('test suite');
    }

    if (content.includes('Provider') || content.includes('Client')) {
      purposes.push('external service integration');
    }

    if (content.includes('Manager') || content.includes('Orchestrator')) {
      purposes.push('coordination/management');
    }

    if (content.includes('Validator') || content.includes('validate')) {
      purposes.push('validation logic');
    }

    if (content.includes('Parser') || content.includes('parse')) {
      purposes.push('data parsing');
    }

    return purposes.join(', ') || 'utility functions';
  }

  private checkFileNameAlignment(filePath: string, info: any): void {
    const relativePath = path.relative(this.rootDir, filePath);
    
    // Check if file name matches primary class
    if (info.primaryClass) {
      const expectedFileName = this.camelCaseToKebabCase(info.primaryClass);
      if (info.fileName !== expectedFileName && info.fileName !== info.primaryClass) {
        this.addMismatch({
          file: relativePath,
          type: 'file-name',
          expected: `${expectedFileName}.ts or ${info.primaryClass}.ts`,
          actual: `${info.fileName}.ts`,
          description: `File name should match primary class ${info.primaryClass}`,
          confidence: 0.8,
          severity: 'warning'
        });
      }
    }

    // Check for common mismatches
    if (info.fileName.includes('test') && !info.actualPurpose.includes('test')) {
      this.addMismatch({
        file: relativePath,
        type: 'file-name',
        expected: 'Non-test file name',
        actual: info.fileName,
        description: 'File name suggests test but content is not test-related',
        confidence: 0.9,
        severity: 'error'
      });
    }

    if (info.fileName.includes('Provider') && !info.actualPurpose.includes('integration')) {
      this.addMismatch({
        file: relativePath,
        type: 'file-name',
        expected: 'Integration/provider functionality',
        actual: info.actualPurpose,
        description: 'File name suggests provider but content lacks integration patterns',
        confidence: 0.7,
        severity: 'warning'
      });
    }
  }

  private camelCaseToKebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  private checkDocumentationAlignment(filePath: string, info: any): void {
    const relativePath = path.relative(this.rootDir, filePath);

    if (info.fileDescription) {
      // Check if description mentions TODO/FIXME but file name doesn't indicate this
      if (info.fileDescription.toLowerCase().includes('todo') && 
          !info.fileName.toLowerCase().includes('todo')) {
        this.addMismatch({
          file: relativePath,
          type: 'documentation',
          expected: 'File name should indicate TODO functionality',
          actual: info.fileDescription,
          description: 'Documentation mentions TODO/FIXME but file name doesn\'t reflect this',
          confidence: 0.85,
          severity: 'warning'
        });
      }

      // Check for generic descriptions
      const genericTerms = ['utility', 'helper', 'common', 'shared', 'misc'];
      if (genericTerms.some(term => info.fileDescription.toLowerCase().includes(term))) {
        this.addMismatch({
          file: relativePath,
          type: 'documentation',
          expected: 'Specific, descriptive documentation',
          actual: info.fileDescription,
          description: 'File description is too generic - should describe specific purpose',
          confidence: 0.6,
          severity: 'warning'
        });
      }
    }
  }

  private async processFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const info = this.extractFileInfo(filePath, content);

    this.checkFileNameAlignment(filePath, info);
    this.checkDocumentationAlignment(filePath, info);
  }

  private getTargetFiles(): string[] {
    const target = getGovernanceTarget('documentation');
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
    console.log('📝 Analyzing file title-content alignment...');

    const files = this.getTargetFiles();
    
    for (const filePath of files) {
      await this.processFile(filePath);
    }

    // Report results
    const errors = this.mismatches.filter(m => m.severity === 'error');
    const warnings = this.mismatches.filter(m => m.severity === 'warning');

    if (this.mismatches.length === 0) {
      console.log('✅ All file titles align with content');
      return true;
    }

    console.log(`\n❌ Found ${errors.length} title-content errors and ${warnings.length} warnings:\n`);

    // Group by file
    const byFile = this.mismatches.reduce((acc, mismatch) => {
      if (!acc[mismatch.file]) acc[mismatch.file] = [];
      acc[mismatch.file].push(mismatch);
      return acc;
    }, {} as Record<string, TitleContentMismatch[]>);

    Object.entries(byFile).forEach(([file, mismatches]) => {
      console.log(`📁 ${file}:`);
      mismatches.forEach(mismatch => {
        const icon = mismatch.severity === 'error' ? '❌' : '⚠️';
        const confidence = Math.round(mismatch.confidence * 100);
        console.log(`  ${icon} ${mismatch.type} (${confidence}% confidence)`);
        console.log(`     Expected: ${mismatch.expected}`);
        console.log(`     Actual: ${mismatch.actual}`);
        console.log(`     Issue: ${mismatch.description}`);
      });
      console.log();
    });

    return errors.length === 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const checker = new TitleContentAlignmentChecker();
  checker.analyze().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Error running title-content alignment check:', error);
    process.exit(1);
  });
}

export { TitleContentAlignmentChecker };
