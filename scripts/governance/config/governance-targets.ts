/**
 * Governance Target Configuration
 * 
 * Defines which directories and file patterns should be included/excluded
 * for different types of governance checks.
 * 
 * NOTE: This configuration is specific to the base agent development.
 * In production deployments, this should be replaced with project-specific
 * governance configurations tailored to individual codebases.
 */

export interface GovernanceTarget {
  name: string;
  description: string;
  includePatterns: string[];
  excludePatterns: string[];
  fileTypes: string[];
}

export interface GovernanceConfig {
  // Code quality governance - focuses on source code only
  codeQuality: GovernanceTarget;
  
  // Documentation governance - broader scope including docs and comments
  documentation: GovernanceTarget;
  
  // Project management governance - TODO/FIXME tracking, etc.
  projectManagement: GovernanceTarget;
}

/**
 * Base Agent Governance Configuration
 * 
 * WARNING: This configuration is designed for the base agent development
 * environment. In production deployments:
 * 1. Replace with project-specific configurations
 * 2. Remove agent-specific paths and patterns
 * 3. Customize for target codebase structure
 */
export const BASE_AGENT_GOVERNANCE_CONFIG: GovernanceConfig = {
  codeQuality: {
    name: 'Code Quality',
    description: 'Source code governance - magic numbers, naming, imports, etc.',
    includePatterns: [
      'src/**/*.ts',
      'src/**/*.js',
      // Include test files for some checks but not others
      'tests/**/*.ts',
      'tests/**/*.js'
    ],
    excludePatterns: [
      // Exclude generated and external files
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      // Exclude configuration files from code quality checks
      '**/*.json',
      '**/*.md',
      '**/*.yml',
      '**/*.yaml',
      // Exclude governance scripts from checking themselves (recursion)
      'scripts/governance/**',
      // Exclude specific files that are allowed to have different standards
      'src/config/constants.ts', // Constants file is allowed magic numbers
      '**/*.d.ts', // Type definition files
      '**/*.test.ts', // Test files may have different standards
      '**/*.spec.ts'
    ],
    fileTypes: ['.ts', '.js']
  },

  documentation: {
    name: 'Documentation',
    description: 'Documentation coverage and quality',
    includePatterns: [
      'src/**/*.ts',
      'src/**/*.js',
      '*.md',
      'docs/**/*.md',
      // Include key configuration files for documentation checks
      'package.json',
      'tsconfig.json'
    ],
    excludePatterns: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'scripts/governance/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.d.ts'
    ],
    fileTypes: ['.ts', '.js', '.json']
  },

  projectManagement: {
    name: 'Project Management',
    description: 'TODO/FIXME tracking, technical debt, etc.',
    includePatterns: [
      'src/**/*',
      'tests/**/*',
      'scripts/**/*',
      'docs/**/*',
      '*.md',
      '*.ts',
      '*.js'
    ],
    excludePatterns: [
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      // Don't track TODOs in package files
      'package*.json',
      'yarn.lock',
      'pnpm-lock.yaml'
    ],
    fileTypes: ['.ts', '.js', '.md', '.txt', '.json']
  }
};

/**
 * Get governance targets for a specific check type
 */
export function getGovernanceTarget(type: keyof GovernanceConfig): GovernanceTarget {
  return BASE_AGENT_GOVERNANCE_CONFIG[type];
}

/**
 * Production Deployment Notes:
 * 
 * When deploying governance to production projects:
 * 
 * 1. Create project-specific governance-targets.ts files
 * 2. Customize includePatterns for the target project structure
 * 3. Adjust excludePatterns for project-specific needs
 * 4. Remove references to 'src/', 'scripts/', etc. if not applicable
 * 5. Consider framework-specific patterns (React, Vue, etc.)
 * 
 * Example for a React project:
 * includePatterns: ['src/components/**\/*.tsx', 'src/hooks/**\/*.ts']
 * 
 * Example for a Node.js API:
 * includePatterns: ['lib/**\/*.js', 'routes/**\/*.js', 'middleware/**\/*.js']
 */
