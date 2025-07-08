#!/usr/bin/env node
/**
 * Import/Export Standards Governance Check
 * 
 * Deterministically enforces import/export standards:
 * - No default exports (prefer named exports for better IDE support)
 * - Consistent import grouping (external -> internal -> relative)
 * - No circular dependencies
 * - Proper barrel exports (index.ts files)
 * - No unused imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { getGovernanceTarget } from './config/governance-targets.js';
import { detectGovernanceOverride, validateGovernanceOverride, formatOverrideMessage } from './utils/override-detector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ImportExportViolation {
  file: string;
  line: number;
  rule: string;
  description: string;
  severity: 'error' | 'warning';
}

class ImportExportChecker {
  private violations: ImportExportViolation[] = [];
  private rootDir: string;
  private fileImports: Map<string, Set<string>> = new Map();

  constructor() {
    this.rootDir = path.resolve(__dirname, '../..');
  }

  private addViolation(violation: ImportExportViolation): void {
    this.violations.push(violation);
  }

  private checkFileContent(filePath: string, content: string): void {
    const lines = content.split('\n');
    const relativePath = path.relative(this.rootDir, filePath);
    
    let importLines: number[] = [];
    let externalImports: number[] = [];
    let internalImports: number[] = [];
    let relativeImports: number[] = [];
    let hasDefaultExport = false;

    lines.forEach((line, lineIndex) => {
      const lineNumber = lineIndex + 1;
      const trimmedLine = line.trim();

      // Check for default exports
      if (trimmedLine.startsWith('export default')) {
        hasDefaultExport = true;
        this.addViolation({
          file: relativePath,
          line: lineNumber,
          rule: 'no-default-exports',
          description: 'Use named exports instead of default exports for better IDE support',
          severity: 'error'
        });
      }

      // Check imports
      if (trimmedLine.startsWith('import ') && !trimmedLine.includes('//')) {
        importLines.push(lineNumber);

        // Categorize import
        if (trimmedLine.includes("from '") || trimmedLine.includes('from "')) {
          const fromMatch = trimmedLine.match(/from\s+['"]([^'"]+)['"]/);
          if (fromMatch) {
            const importPath = fromMatch[1];
            
            // Track for circular dependency check
            if (!this.fileImports.has(relativePath)) {
              this.fileImports.set(relativePath, new Set());
            }
            this.fileImports.get(relativePath)!.add(importPath);

            if (importPath.startsWith('.')) {
              relativeImports.push(lineNumber);
            } else if (importPath.startsWith('@/') || importPath.startsWith('src/')) {
              internalImports.push(lineNumber);
            } else {
              externalImports.push(lineNumber);
            }
          }
        }

        // Check for unused imports (simplified check)
        const importMatch = trimmedLine.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))/);
        if (importMatch) {
          const importedNames = importMatch[1] ? 
            importMatch[1].split(',').map(name => name.trim().split(' as ')[0].trim()) :
            [importMatch[2] || importMatch[3]];

          importedNames.forEach(name => {
            if (name && !content.includes(name) && content.split('\n').filter(l => l.includes(name)).length <= 1) {
              this.addViolation({
                file: relativePath,
                line: lineNumber,
                rule: 'unused-import',
                description: `Import '${name}' appears to be unused`,
                severity: 'warning'
              });
            }
          });
        }
      }
    });

    // Check import grouping
    this.checkImportGrouping(relativePath, externalImports, internalImports, relativeImports);

    // Check for missing barrel exports in index files
    if (path.basename(filePath) === 'index.ts') {
      this.checkBarrelExports(filePath, content, relativePath);
    }
  }

  private checkImportGrouping(
    filePath: string, 
    external: number[], 
    internal: number[], 
    relative: number[]
  ): void {
    const allImports = [...external, ...internal, ...relative].sort((a, b) => a - b);
    
    // Check if imports are properly grouped
    let lastExternal = Math.max(...external, 0);
    let lastInternal = Math.max(...internal, 0);
    let lastRelative = Math.max(...relative, 0);

    // External should come first
    if (internal.length > 0 && external.length > 0) {
      const firstInternal = Math.min(...internal);
      if (firstInternal < lastExternal) {
        this.addViolation({
          file: filePath,
          line: firstInternal,
          rule: 'import-grouping',
          description: 'Internal imports should come after external imports',
          severity: 'warning'
        });
      }
    }

    // Relative should come last
    if (relative.length > 0 && (external.length > 0 || internal.length > 0)) {
      const firstRelative = Math.min(...relative);
      const lastNonRelative = Math.max(lastExternal, lastInternal);
      if (firstRelative < lastNonRelative) {
        this.addViolation({
          file: filePath,
          line: firstRelative,
          rule: 'import-grouping',
          description: 'Relative imports should come after external and internal imports',
          severity: 'warning'
        });
      }
    }
  }

  private checkBarrelExports(filePath: string, content: string, relativePath: string): void {
    const dir = path.dirname(filePath);
    
    try {
      const files = fs.readdirSync(dir);
      const tsFiles = files.filter(f => 
        f.endsWith('.ts') && 
        f !== 'index.ts' && 
        !f.endsWith('.test.ts') && 
        !f.endsWith('.spec.ts')
      );

      // Check if all TypeScript files are exported
      tsFiles.forEach(file => {
        const baseName = path.basename(file, '.ts');
        const exportPattern = new RegExp(`export.*from\\s+['"]\\.\/${baseName}['"]`);
        const namedExportPattern = new RegExp(`export\\s*\\{[^}]*\\}\\s*from\\s+['"]\\.\/${baseName}['"]`);
        
        if (!exportPattern.test(content) && !namedExportPattern.test(content)) {
          this.addViolation({
            file: relativePath,
            line: 0,
            rule: 'incomplete-barrel-export',
            description: `Missing export for ${file} in barrel file`,
            severity: 'warning'
          });
        }
      });
    } catch (error) {
      // Directory might not exist or be readable
    }
  }

  private checkCircularDependencies(): void {
    // Simple circular dependency detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (file: string, cyclePath: string[] = []): boolean => {
      if (recursionStack.has(file)) {
        this.addViolation({
          file: file,
          line: 0,
          rule: 'circular-dependency',
          description: `Circular dependency detected: ${cyclePath.join(' -> ')} -> ${file}`,
          severity: 'error'
        });
        return true;
      }

      if (visited.has(file)) {
        return false;
      }

      visited.add(file);
      recursionStack.add(file);

      const imports = this.fileImports.get(file) || new Set();
      for (const importPath of imports) {
        // Resolve relative imports to absolute paths
        let resolvedPath = importPath;
        if (importPath.startsWith('.')) {
          const dir = path.dirname(file);
          resolvedPath = path.normalize(path.join(dir, importPath));
          if (!resolvedPath.endsWith('.ts')) {
            resolvedPath += '.ts';
          }
        }

        if (hasCycle(resolvedPath, [...cyclePath, file])) {
          return true;
        }
      }

      recursionStack.delete(file);
      return false;
    };

    for (const file of this.fileImports.keys()) {
      if (!visited.has(file)) {
        hasCycle(file);
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
    console.log('📦 Checking import/export standards...');

    const files = this.getTargetFiles();
    
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.checkFileContent(filePath, content);
    }

    // Check for circular dependencies
    this.checkCircularDependencies();

    // Report results
    const errors = this.violations.filter(v => v.severity === 'error');
    const warnings = this.violations.filter(v => v.severity === 'warning');

    if (this.violations.length === 0) {
      console.log('✅ All import/export standards are properly followed');
      return true;
    }

    console.log(`\n❌ Found ${errors.length} import/export errors and ${warnings.length} warnings:\n`);

    // Group by file
    const byFile = this.violations.reduce((acc, violation) => {
      if (!acc[violation.file]) acc[violation.file] = [];
      acc[violation.file].push(violation);
      return acc;
    }, {} as Record<string, ImportExportViolation[]>);

    Object.entries(byFile).forEach(([file, violations]) => {
      console.log(`📁 ${file}:`);
      violations.forEach(violation => {
        const icon = violation.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} Line ${violation.line}: ${violation.rule}`);
        console.log(`     ${violation.description}`);
      });
      console.log();
    });

    return errors.length === 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}` || 
    (process.argv[1] && process.argv[1].endsWith(path.basename(new URL(import.meta.url).pathname)))) {
  const checker = new ImportExportChecker();
  checker.check().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Error running import/export check:', error);
    process.exit(1);
  });
}

export { ImportExportChecker };
