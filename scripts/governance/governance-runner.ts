#!/usr/bin/env tsx
/**
 * Governance Runner
 * 
 * Separates governance into distinct categories:
 * - Code Quality: Magic numbers, naming, imports, etc.
 * - Documentation: Coverage and quality
 * - Project Management: TODO/FIXME tracking
 * 
 * NOTE: This is configured for base agent development.
 * In production, replace governance targets with project-specific configurations.
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getGovernanceTarget } from './config/governance-targets.js';
import { getRunConfig, createCustomConfig, type CheckSelection } from './config/governance-run-config.js';

interface CheckResult {
  name: string;
  category: 'code-quality' | 'documentation' | 'project-management';
  type: 'deterministic' | 'llm-assisted';
  status: 'pass' | 'fail' | 'warning';
  errors: number;
  warnings: number;
  filesScanned: number;
  output: string;
  duration: number;
}

interface GovernanceReport {
  timestamp: string;
  overall: 'pass' | 'fail' | 'warning';
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: CheckResult[];
}

class GovernanceRunner {
  private results: CheckResult[] = [];
  private scriptsDir: string;
  private config: CheckSelection;

  constructor(profile: 'quick' | 'full' | 'ci' | 'preCommit' = 'full', customConfig?: Partial<CheckSelection>) {
    this.scriptsDir = path.dirname(fileURLToPath(import.meta.url));
    this.config = customConfig ? createCustomConfig(profile, customConfig) : getRunConfig(profile);
  }

  public async runAll(): Promise<GovernanceReport> {
    console.log('🔍 Code Governance Checks (Base Agent Development)');
    console.log('⚠️  NOTE: Replace with project-specific governance in production');
    console.log();

    // Code Quality Checks
    if (this.config.codeQuality.enabled) {
      await this.runCodeQualityChecks();
    }

    // Documentation Checks
    if (this.config.documentation.enabled) {
      await this.runDocumentationChecks();
    }

    // Project Management Checks  
    if (this.config.projectManagement.enabled) {
      await this.runProjectManagementChecks();
    }

    return this.generateReport();
  }

  public async runCodeQualityChecks(): Promise<void> {
    console.log('🔧 CODE QUALITY CHECKS');
    
    const availableChecks = [
      { name: 'Magic Numbers Detection', script: 'check-magic-numbers.ts', type: 'deterministic' as const, configKey: 'magicNumbers' },
      { name: 'Magic Strings Detection', script: 'check-magic-strings.ts', type: 'deterministic' as const, configKey: 'magicStrings' },
      { name: 'Naming Conventions', script: 'check-naming-conventions.ts', type: 'deterministic' as const, configKey: 'namingConventions' },
      { name: 'Import/Export Standards', script: 'check-import-export.ts', type: 'deterministic' as const, configKey: 'importExport' },
      { name: 'Code Complexity Analysis', script: 'analyze-complexity.ts', type: 'llm-assisted' as const, configKey: 'complexity' },
      { name: 'SOLID Principles Analysis', script: 'analyze-solid-principles.ts', type: 'llm-assisted' as const, configKey: 'solidPrinciples' },
      { name: 'DRY Principles Analysis', script: 'analyze-dry.ts', type: 'llm-assisted' as const, configKey: 'dryPrinciples' },
    ];

    const enabledChecks = availableChecks.filter(check => 
      this.config.codeQuality.checks[check.configKey as keyof typeof this.config.codeQuality.checks]
    );

    for (let i = 0; i < enabledChecks.length; i++) {
      const check = enabledChecks[i];
      await this.runCheck(check.name, check.script, 'code-quality', check.type, i + 1, enabledChecks.length);
    }
    
    if (enabledChecks.length > 0) {
      console.log();
    }
  }

  public async runDocumentationChecks(): Promise<void> {
    console.log('📚 DOCUMENTATION CHECKS');
    
    const availableChecks = [
      { name: 'Documentation Coverage', script: 'check-documentation.ts', type: 'deterministic' as const, configKey: 'documentation' },
      { name: 'Title-Content Alignment', script: 'check-title-content-alignment.ts', type: 'llm-assisted' as const, configKey: 'titleContentAlignment' },
    ];

    const enabledChecks = availableChecks.filter(check => 
      this.config.documentation.checks[check.configKey as keyof typeof this.config.documentation.checks]
    );

    for (let i = 0; i < enabledChecks.length; i++) {
      const check = enabledChecks[i];
      await this.runCheck(check.name, check.script, 'documentation', check.type, i + 1, enabledChecks.length);
    }
    
    if (enabledChecks.length > 0) {
      console.log();
    }
  }

  public async runProjectManagementChecks(): Promise<void> {
    console.log('📋 PROJECT MANAGEMENT CHECKS');
    
    const availableChecks = [
      { name: 'TODO/FIXME Standards', script: 'check-todo-standards.ts', type: 'deterministic' as const, configKey: 'todoStandards' },
    ];

    const enabledChecks = availableChecks.filter(check => 
      this.config.projectManagement.checks[check.configKey as keyof typeof this.config.projectManagement.checks]
    );

    for (let i = 0; i < enabledChecks.length; i++) {
      const check = enabledChecks[i];
      await this.runCheck(check.name, check.script, 'project-management', check.type, i + 1, enabledChecks.length);
    }
    
    if (enabledChecks.length > 0) {
      console.log();
    }
  }

  private async runCheck(
    name: string, 
    script: string, 
    category: 'code-quality' | 'documentation' | 'project-management',
    type: 'deterministic' | 'llm-assisted', 
    current: number, 
    total: number
  ): Promise<void> {
    const startTime = Date.now();
    const scriptPath = path.join(this.scriptsDir, script);

    // Show clean one-line progress
    const counter = `[${current.toString().padStart(2)}/${total}]`;
    process.stdout.write(`${counter} ${name.padEnd(30)}... `);

    try {
      // Use spawn for execution
      const child = spawn('npx', ['tsx', scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      let outputBuffer = '';
      let errorBuffer = '';

      child.stdout.on('data', (data: Buffer) => {
        outputBuffer += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        errorBuffer += data.toString();
      });

      // Wait for completion with timeout
      const timeout = type === 'llm-assisted' ? 300000 : 30000;
      const result = await new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error(`Timeout after ${timeout}ms`));
        }, timeout);

        child.on('close', (code) => {
          clearTimeout(timer);
          resolve(code || 0);
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const duration = Date.now() - startTime;
      const output = outputBuffer + errorBuffer;

      // Parse the actual output for issues and files
      const { errors, warnings, filesScanned } = this.parseScriptOutput(output);

      // Determine status based on errors and warnings, not just exit code
      const finalStatus = errors > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass';
      const icon = finalStatus === 'pass' ? '✅' : finalStatus === 'warning' ? '⚠️' : '❌';
      
      // Format with 4-character padding for each count to prevent misalignment
      const errorText = errors.toString().padStart(4);
      const warningText = warnings.toString().padStart(4);
      const filesText = filesScanned.toString().padStart(4);
      const timeText = `${duration}ms`.padStart(7);
      
      // Format: "XXXX errors  XXXX warnings  XXXX files  XXXXms"
      const statusText = `${errorText} errors  ${warningText} warnings  ${filesText} files  ${timeText}`;
      
      console.log(`${icon} ${statusText}`);

      this.results.push({
        name,
        category,
        type,
        status: finalStatus,
        errors,
        warnings,
        filesScanned,
        output,
        duration,
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const output = error.message + (error.stdout || '') + (error.stderr || '');
      
      const errors = Math.max(1, (output.match(/🚨|❌|ERROR/gi) || []).length);
      const warnings = (output.match(/⚠️|WARNING/gi) || []).length;
      const filesScanned = this.extractFileCount(output);
      
      // Complete the line with error result
      const timeText = `${duration}ms`;
      const filesText = `${filesScanned} files`;
      const issueText = `${errors} errors ${warnings} warnings`;
      
      console.log(`❌ ${issueText.padEnd(15)} ${filesText.padEnd(8)} ${timeText.padStart(6)}`);

      this.results.push({
        name,
        category,
        type,
        status: 'fail',
        errors,
        warnings,
        filesScanned,
        output,
        duration,
      });
    }
  }

  private parseScriptOutput(output: string): { errors: number; warnings: number; filesScanned: number } {
    let errors = 0;
    let warnings = 0;

    // Look for summary lines that show error and warning counts
    const summaryMatch = output.match(/📊 Summary: (\d+) errors?, (\d+) warnings?/i);
    if (summaryMatch) {
      errors = parseInt(summaryMatch[1]);
      warnings = parseInt(summaryMatch[2]);
    } else {
      // Fallback: look for "Found X potential" pattern
      const foundMatch = output.match(/❌ Found (\d+) potential/i);
      if (foundMatch) {
        // If we found potential issues, count individual error/warning indicators
        const errorIndicators = (output.match(/🚨/g) || []).length;
        const warningIndicators = (output.match(/⚠️/g) || []).length;
        
        // Total should match the "Found X" number
        const totalFound = parseInt(foundMatch[1]);
        if (errorIndicators + warningIndicators === totalFound) {
          errors = errorIndicators;
          warnings = warningIndicators;
        } else {
          // If indicators don't match, use the total as errors for safety
          errors = totalFound;
          warnings = 0;
        }
      }
    }

    const filesScanned = this.extractFileCount(output);
    return { errors, warnings, filesScanned };
  }

  private extractFileCount(output: string): number {
    // Look for file count patterns in output
    const filePatterns = [
      /Scanning (\d+) files/i,
      /Analyzed (\d+) files/i,
      /Checked (\d+) files/i,
      /Processing (\d+) files/i,
      /Found (\d+) files/i
    ];

    for (const pattern of filePatterns) {
      const match = output.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }

    // Fallback: count file references
    const fileRefs = (output.match(/\.ts|\.js/g) || []).length;
    return Math.max(1, Math.floor(fileRefs / 3));
  }

  public generateReport(): GovernanceReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    const overall = failed > 0 ? 'fail' : warnings > 0 ? 'warning' : 'pass';

    return {
      timestamp: new Date().toISOString(),
      overall,
      summary: {
        totalChecks: this.results.length,
        passed,
        failed,
        warnings,
      },
      results: this.results,
    };
  }

  public async checkLLMAvailability(): Promise<{ available: boolean; provider?: string }> {
    // Check for LLM providers for documentation checks
    if (process.env.OPENAI_API_KEY) {
      return { available: true, provider: 'OpenAI' };
    }

    if (process.env.ANTHROPIC_API_KEY) {
      return { available: true, provider: 'Anthropic' };
    }

    try {
      const { ProviderRegistry } = await import('../../src/core/registry/ProviderRegistry.js');
      const llmProviders = ProviderRegistry.getAvailableLLMProviders();
      
      if (llmProviders.length > 0) {
        const providerName = llmProviders[0];
        const providerInfo = ProviderRegistry.getProviderInfo(providerName);
        return { 
          available: true, 
          provider: providerInfo?.description || providerName 
        };
      }
    } catch (error) {
      // Provider registry not available
    }

    return { available: false };
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const profileArg = args.find(arg => arg.startsWith('--profile='));
  const profile = profileArg ? profileArg.split('=')[1] as 'quick' | 'full' | 'ci' | 'preCommit' : 'full';
  
  // Legacy category-only flags (deprecated but supported)
  const codeQualityOnly = args.includes('--code-quality-only');
  const documentationOnly = args.includes('--documentation-only');
  const projectMgmtOnly = args.includes('--project-management-only');
  
  // Help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔍 Governance Runner

Usage: npx tsx governance-runner.ts [options]

Options:
  --profile=<name>              Run with predefined profile (quick|full|ci|preCommit)
                               Default: full
  
  --code-quality-only          Run only code quality checks (deprecated, use profiles)
  --documentation-only         Run only documentation checks (deprecated, use profiles)  
  --project-management-only    Run only project management checks (deprecated, use profiles)
  
  -h, --help                   Show this help message

Profiles:
  quick      - Fast deterministic checks only (no LLM)
  full       - All checks including LLM-assisted analysis
  ci         - CI-friendly checks (deterministic only)
  preCommit  - Essential checks for commit hooks

Examples:
  npx tsx governance-runner.ts --profile=quick
  npx tsx governance-runner.ts --profile=ci
  npx tsx governance-runner.ts --code-quality-only
`);
    process.exit(0);
  }

  // Create runner with appropriate configuration
  let runner: GovernanceRunner;
  
  if (codeQualityOnly) {
    // Legacy support: create custom config with only code quality enabled
    runner = new GovernanceRunner('quick', {
      documentation: { enabled: false, checks: { documentation: false, titleContentAlignment: false } },
      projectManagement: { enabled: false, checks: { todoStandards: false } }
    });
  } else if (documentationOnly) {
    // Legacy support: create custom config with only documentation enabled
    runner = new GovernanceRunner('full', {
      codeQuality: { enabled: false, checks: { magicNumbers: false, magicStrings: false, namingConventions: false, importExport: false, complexity: false, solidPrinciples: false, dryPrinciples: false } },
      projectManagement: { enabled: false, checks: { todoStandards: false } }
    });
  } else if (projectMgmtOnly) {
    // Legacy support: create custom config with only project management enabled
    runner = new GovernanceRunner('quick', {
      codeQuality: { enabled: false, checks: { magicNumbers: false, magicStrings: false, namingConventions: false, importExport: false, complexity: false, solidPrinciples: false, dryPrinciples: false } },
      documentation: { enabled: false, checks: { documentation: false, titleContentAlignment: false } }
    });
  } else {
    // Use profile-based configuration
    runner = new GovernanceRunner(profile);
  }

  console.log(`\n🚀 Running governance with profile: ${profile.toUpperCase()}\n`);
  
  const report = await runner.runAll();

  // Exit with appropriate code
  process.exit(report.overall === 'fail' ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('governance-runner.ts')) {
  main().catch(error => {
    console.error('💥 Governance runner failed:', error.message);
    process.exit(1);
  });
}

export { GovernanceRunner };
