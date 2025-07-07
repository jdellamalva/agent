/**
 * Command Schema - Comprehensive structured format for LLM-generated commands
 * 
 * **Purpose**: 
 * Defines the complete schema for all commands that the LLM can generate,
 * providing type safety, validation rules, and execution context for the
 * action system foundation.
 * 
 * **Dependencies**:
 * - No external dependencies (foundational schema definitions)
 * - Used by: ResponseParser, ActionRegistry, Command validation
 * 
 * **Key Patterns**:
 * - Discriminated unions for type-safe action parameters
 * - Hierarchical command categorization for organization
 * - Extensible schema design for future action additions
 * - Rich metadata for execution context and safety
 * 
 * **Lifecycle**:
 * 1. LLM generates commands using this schema format
 * 2. ResponseParser validates commands against schema
 * 3. ActionRegistry routes commands to appropriate handlers
 * 4. Commands executed with full type safety and context
 * 
 * **Performance Considerations**:
 * - Minimal runtime overhead with compile-time type checking
 * - Efficient serialization/deserialization for persistence
 * - Optimized validation with early termination patterns
 * 
 * **Error Handling**:
 * - Comprehensive validation with detailed error messages
 * - Schema versioning for backward compatibility
 * - Graceful handling of unknown or malformed commands
 */

// Base command structure that all commands must follow
export interface BaseCommand {
  /** Unique identifier for this command instance */
  id?: string;
  
  /** The specific action to be performed */
  action: ActionType;
  
  /** Action-specific parameters (type-safe based on action) */
  parameters: ActionParameters;
  
  /** Human-readable explanation of why this action is needed */
  reasoning: string;
  
  /** Confidence level in this command (0.0 to 1.0) */
  confidence: number;
  
  /** Whether this command requires human approval before execution */
  requiresApproval?: boolean;
  
  /** Priority level for command execution ordering */
  priority?: CommandPriority;
  
  /** Dependencies - commands that must complete before this one */
  dependsOn?: string[];
  
  /** Maximum time allowed for command execution (milliseconds) */
  timeout?: number;
  
  /** Whether this command can be retried on failure */
  retryable?: boolean;
  
  /** Number of retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Tags for command categorization and filtering */
  tags?: string[];
  
  /** Additional metadata for command context */
  metadata?: Record<string, any>;
}

// Command priority levels for execution ordering
export type CommandPriority = 'low' | 'normal' | 'high' | 'urgent';

// All available action types in the system
export type ActionType = 
  // File System Operations
  | 'file_create' | 'file_read' | 'file_update' | 'file_delete'
  | 'dir_create' | 'dir_read' | 'dir_delete'
  
  // Git Operations  
  | 'git_clone' | 'git_status' | 'git_add' | 'git_commit' | 'git_push' | 'git_pull'
  | 'git_branch' | 'git_checkout' | 'git_merge' | 'git_log' | 'git_diff'
  
  // API Operations
  | 'api_call' | 'http_get' | 'http_post' | 'http_put' | 'http_delete'
  
  // Data Operations
  | 'data_fetch' | 'data_transform' | 'data_validate' | 'data_export'
  
  // Code Analysis
  | 'code_parse' | 'code_lint' | 'code_test' | 'code_format' | 'code_analyze'
  
  // Project Management
  | 'project_scaffold' | 'project_init' | 'project_build' | 'project_deploy'
  
  // Package Management
  | 'npm_install' | 'npm_uninstall' | 'npm_update' | 'npm_run'
  | 'pip_install' | 'pip_uninstall' | 'pip_upgrade'
  
  // Shell Operations
  | 'shell_exec' | 'shell_script'
  
  // Utility Operations
  | 'wait' | 'delay' | 'notify' | 'log';

// Type-safe parameter definitions for each action type
export type ActionParameters = 
  // File System Operations
  | FileCreateParams | FileReadParams | FileUpdateParams | FileDeleteParams
  | DirCreateParams | DirReadParams | DirDeleteParams
  
  // Git Operations
  | GitCloneParams | GitStatusParams | GitAddParams | GitCommitParams 
  | GitPushParams | GitPullParams | GitBranchParams | GitCheckoutParams
  | GitMergeParams | GitLogParams | GitDiffParams
  
  // API Operations
  | ApiCallParams | HttpGetParams | HttpPostParams | HttpPutParams | HttpDeleteParams
  
  // Data Operations
  | DataFetchParams | DataTransformParams | DataValidateParams | DataExportParams
  
  // Code Analysis
  | CodeParseParams | CodeLintParams | CodeTestParams | CodeFormatParams | CodeAnalyzeParams
  
  // Project Management
  | ProjectScaffoldParams | ProjectInitParams | ProjectBuildParams | ProjectDeployParams
  
  // Package Management
  | NpmInstallParams | NpmUninstallParams | NpmUpdateParams | NpmRunParams
  | PipInstallParams | PipUninstallParams | PipUpgradeParams
  
  // Shell Operations
  | ShellExecParams | ShellScriptParams
  
  // Utility Operations
  | WaitParams | DelayParams | NotifyParams | LogParams;

// File System Operation Parameters
export interface FileCreateParams {
  path: string;
  content: string;
  encoding?: string;
  mode?: string;
  overwrite?: boolean;
}

export interface FileReadParams {
  path: string;
  encoding?: string;
  startLine?: number;
  endLine?: number;
}

export interface FileUpdateParams {
  path: string;
  content?: string;
  insertAt?: number;
  replaceRange?: { start: number; end: number };
  append?: boolean;
  backup?: boolean;
}

export interface FileDeleteParams {
  path: string;
  force?: boolean;
  backup?: boolean;
}

export interface DirCreateParams {
  path: string;
  recursive?: boolean;
  mode?: string;
}

export interface DirReadParams {
  path: string;
  recursive?: boolean;
  filter?: string;
  includeHidden?: boolean;
}

export interface DirDeleteParams {
  path: string;
  recursive?: boolean;
  force?: boolean;
}

// Git Operation Parameters
export interface GitCloneParams {
  url: string;
  destination?: string;
  branch?: string;
  depth?: number;
  recursive?: boolean;
}

export interface GitStatusParams {
  repository?: string;
  porcelain?: boolean;
}

export interface GitAddParams {
  repository?: string;
  files: string | string[];
  all?: boolean;
}

export interface GitCommitParams {
  repository?: string;
  message: string;
  files?: string[];
  amend?: boolean;
  author?: { name: string; email: string };
}

export interface GitPushParams {
  repository?: string;
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
}

export interface GitPullParams {
  repository?: string;
  remote?: string;
  branch?: string;
  rebase?: boolean;
}

export interface GitBranchParams {
  repository?: string;
  name?: string;
  list?: boolean;
  delete?: string;
  force?: boolean;
}

export interface GitCheckoutParams {
  repository?: string;
  branch?: string;
  createBranch?: boolean;
  files?: string[];
}

export interface GitMergeParams {
  repository?: string;
  branch: string;
  noCommit?: boolean;
  strategy?: string;
}

export interface GitLogParams {
  repository?: string;
  count?: number;
  oneline?: boolean;
  since?: string;
  until?: string;
  author?: string;
}

export interface GitDiffParams {
  repository?: string;
  files?: string[];
  cached?: boolean;
  commit1?: string;
  commit2?: string;
}

// API Operation Parameters
export interface ApiCallParams {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
}

export interface HttpGetParams {
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  timeout?: number;
}

export interface HttpPostParams {
  url: string;
  body: any;
  headers?: Record<string, string>;
  contentType?: string;
  timeout?: number;
}

export interface HttpPutParams {
  url: string;
  body: any;
  headers?: Record<string, string>;
  contentType?: string;
  timeout?: number;
}

export interface HttpDeleteParams {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

// Data Operation Parameters
export interface DataFetchParams {
  source: string;
  format?: 'json' | 'csv' | 'xml' | 'yaml';
  query?: Record<string, any>;
  cache?: boolean;
  ttl?: number;
}

export interface DataTransformParams {
  input: any;
  transformation: string;
  outputFormat?: string;
  validation?: boolean;
}

export interface DataValidateParams {
  data: any;
  schema: any;
  strict?: boolean;
  errorFormat?: 'simple' | 'detailed';
}

export interface DataExportParams {
  data: any;
  destination: string;
  format: 'json' | 'csv' | 'xml' | 'yaml';
  overwrite?: boolean;
}

// Code Analysis Parameters
export interface CodeParseParams {
  files: string | string[];
  language?: string;
  includeComments?: boolean;
  includeDocstrings?: boolean;
}

export interface CodeLintParams {
  files: string | string[];
  linter?: string;
  config?: string;
  fix?: boolean;
}

export interface CodeTestParams {
  files?: string | string[];
  framework?: string;
  coverage?: boolean;
  watch?: boolean;
}

export interface CodeFormatParams {
  files: string | string[];
  formatter?: string;
  config?: string;
  check?: boolean;
}

export interface CodeAnalyzeParams {
  files: string | string[];
  analysis: 'complexity' | 'dependencies' | 'security' | 'performance' | 'all';
  outputFormat?: 'json' | 'text' | 'html';
}

// Project Management Parameters
export interface ProjectScaffoldParams {
  template: string;
  destination: string;
  variables?: Record<string, string>;
  overwrite?: boolean;
}

export interface ProjectInitParams {
  type: 'npm' | 'python' | 'git' | 'docker';
  directory?: string;
  config?: Record<string, any>;
}

export interface ProjectBuildParams {
  command?: string;
  environment?: string;
  outputDir?: string;
  minify?: boolean;
}

export interface ProjectDeployParams {
  target: string;
  environment: string;
  config?: Record<string, any>;
  dryRun?: boolean;
}

// Package Management Parameters
export interface NpmInstallParams {
  packages?: string | string[];
  dev?: boolean;
  global?: boolean;
  save?: boolean;
  directory?: string;
}

export interface NpmUninstallParams {
  packages: string | string[];
  dev?: boolean;
  global?: boolean;
  directory?: string;
}

export interface NpmUpdateParams {
  packages?: string | string[];
  directory?: string;
}

export interface NpmRunParams {
  script: string;
  directory?: string;
  arguments?: string[];
}

export interface PipInstallParams {
  packages: string | string[];
  requirements?: string;
  upgrade?: boolean;
  user?: boolean;
  environment?: string;
}

export interface PipUninstallParams {
  packages: string | string[];
  yes?: boolean;
  environment?: string;
}

export interface PipUpgradeParams {
  packages?: string | string[];
  all?: boolean;
  environment?: string;
}

// Shell Operation Parameters
export interface ShellExecParams {
  command: string;
  arguments?: string[];
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  shell?: string;
}

export interface ShellScriptParams {
  script: string;
  interpreter?: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
}

// Utility Operation Parameters
export interface WaitParams {
  duration: number; // milliseconds
  reason?: string;
}

export interface DelayParams {
  duration: number; // milliseconds
  message?: string;
}

export interface NotifyParams {
  message: string;
  channel?: string;
  urgency?: 'low' | 'normal' | 'high';
  recipients?: string[];
}

export interface LogParams {
  message: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  component?: string;
  metadata?: Record<string, any>;
}

// Command execution result structure
export interface CommandResult {
  /** Unique identifier matching the command */
  id: string;
  
  /** Whether the command executed successfully */
  success: boolean;
  
  /** Exit code or status indicator */
  exitCode?: number;
  
  /** Command output data */
  output?: any;
  
  /** Error message if command failed */
  error?: string;
  
  /** Detailed error information */
  errorDetails?: any;
  
  /** Execution duration in milliseconds */
  duration: number;
  
  /** Timestamp when command started */
  startTime: Date;
  
  /** Timestamp when command completed */
  endTime: Date;
  
  /** Resources consumed during execution */
  resources?: {
    memory?: number;
    cpu?: number;
    disk?: number;
    network?: number;
  };
  
  /** Additional metadata about execution */
  metadata?: Record<string, any>;
}

// Command validation result
export interface CommandValidationResult {
  /** Whether the command passed all validations */
  isValid: boolean;
  
  /** List of validation errors */
  errors: ValidationError[];
  
  /** List of validation warnings */
  warnings: ValidationWarning[];
  
  /** Suggested corrections for invalid commands */
  suggestions?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

// Command batch for executing multiple commands
export interface CommandBatch {
  /** Unique identifier for this batch */
  id: string;
  
  /** List of commands to execute */
  commands: BaseCommand[];
  
  /** Execution strategy */
  strategy: 'sequential' | 'parallel' | 'conditional';
  
  /** Whether to stop on first failure */
  stopOnFailure?: boolean;
  
  /** Maximum total execution time for the batch */
  timeout?: number;
  
  /** Batch-level metadata */
  metadata?: Record<string, any>;
}

// Type guards for action parameters
export function isFileCreateParams(params: ActionParameters): params is FileCreateParams {
  return typeof params === 'object' && 'path' in params && 'content' in params;
}

export function isGitCloneParams(params: ActionParameters): params is GitCloneParams {
  return typeof params === 'object' && 'url' in params;
}

export function isShellExecParams(params: ActionParameters): params is ShellExecParams {
  return typeof params === 'object' && 'command' in params;
}

// Helper functions for command creation
export function createCommand<T extends ActionParameters>(
  action: ActionType,
  parameters: T,
  reasoning: string,
  confidence: number = 0.8,
  options?: Partial<BaseCommand>
): BaseCommand {
  return {
    id: options?.id || generateCommandId(),
    action,
    parameters,
    reasoning,
    confidence,
    priority: options?.priority || 'normal',
    requiresApproval: options?.requiresApproval || shouldRequireApproval(action),
    retryable: options?.retryable !== false,
    maxRetries: options?.maxRetries || 3,
    timeout: options?.timeout || getDefaultTimeout(action),
    tags: options?.tags || [],
    metadata: options?.metadata || {},
    ...options
  };
}

function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function shouldRequireApproval(action: ActionType): boolean {
  const destructiveActions = [
    'file_delete', 'dir_delete', 'git_push', 'shell_exec', 
    'npm_uninstall', 'pip_uninstall', 'project_deploy'
  ];
  return destructiveActions.includes(action);
}

function getDefaultTimeout(action: ActionType): number {
  const timeouts: Record<string, number> = {
    'git_clone': 300000,      // 5 minutes
    'npm_install': 600000,    // 10 minutes  
    'pip_install': 300000,    // 5 minutes
    'project_build': 900000,  // 15 minutes
    'project_deploy': 1800000, // 30 minutes
    'code_test': 600000,      // 10 minutes
    'shell_exec': 60000,      // 1 minute
  };
  return timeouts[action] || 30000; // 30 seconds default
}
