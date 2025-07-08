import { VALIDATION, TIMEOUTS, ACTION_COMPLEXITY } from '../../config/constants';

/**
 * Command Schema - Comprehensive structured format for LLM-generated commands
 * 
 * **Purpose**: 
 * Defines the complete schema for all commands that the LLM can generate,
 * providing type safety, validation rules, and execution context for the
 * action system foundation. Supports 72 comprehensive action types across
 * all major operational categories.
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
 * **Action Categories** (72 total):
 * - File System Operations (8): create, read, update, delete, copy, move, permissions, search
 * - Directory Operations (6): create, read, delete, copy, move, permissions
 * - Git Operations (12): clone, status, add, commit, push, pull, branch, checkout, merge, log, diff, tag
 * - Network/API Operations (8): HTTP methods, API calls, webhooks, FTP operations
 * - Data Operations (6): fetch, transform, validate, export, merge, filter
 * - Database Operations (6): query, insert, update, delete, backup, restore
 * - Code Analysis & Quality (8): parse, lint, test, format, analyze, review, security scan, coverage
 * - Project Management (6): scaffold, init, build, deploy, clean, archive
 * - Package Management (8): npm/pip install/uninstall/update/run/list operations
 * - Container Operations (4): Docker build, run, stop, deploy
 * - Monitoring & Observability (4): metrics collection, log analysis, performance profiling, health checks
 * - Shell Operations (4): execute commands, scripts, process control, service management
 * - Utility Operations (2): wait, notify
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
 * 
 * **Security**:
 * - Destructive actions require approval by default
 * - Configurable timeouts prevent runaway operations
 * - Parameter validation prevents injection attacks
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

// All available action types in the system (72 comprehensive actions)
export type ActionType = 
  // File System Operations (8 actions)
  | 'file_create' | 'file_read' | 'file_update' | 'file_delete'
  | 'file_copy' | 'file_move' | 'file_permissions' | 'file_search'
  
  // Directory Operations (6 actions)  
  | 'dir_create' | 'dir_read' | 'dir_delete' | 'dir_copy'
  | 'dir_move' | 'dir_permissions'
  
  // Git Operations (12 actions)
  | 'git_clone' | 'git_status' | 'git_add' | 'git_commit' | 'git_push' | 'git_pull'
  | 'git_branch' | 'git_checkout' | 'git_merge' | 'git_log' | 'git_diff' | 'git_tag'
  
  // Network/API Operations (8 actions)
  | 'http_get' | 'http_post' | 'http_put' | 'http_delete'
  | 'api_call' | 'webhook_send' | 'ftp_upload' | 'ftp_download'
  
  // Data Operations (6 actions)
  | 'data_fetch' | 'data_transform' | 'data_validate' | 'data_export'
  | 'data_merge' | 'data_filter'
  
  // Database Operations (6 actions)
  | 'db_query' | 'db_insert' | 'db_update' | 'db_delete'
  | 'db_backup' | 'db_restore'
  
  // Code Analysis & Quality (8 actions)
  | 'code_parse' | 'code_lint' | 'code_test' | 'code_format'
  | 'code_analyze' | 'code_review' | 'code_security_scan' | 'code_coverage'
  
  // Project Management (6 actions)
  | 'project_scaffold' | 'project_init' | 'project_build' | 'project_deploy'
  | 'project_clean' | 'project_archive'
  
  // Package Management (8 actions)
  | 'npm_install' | 'npm_uninstall' | 'npm_update' | 'npm_run'
  | 'pip_install' | 'pip_uninstall' | 'pip_upgrade' | 'pip_list'
  
  // Container Operations (4 actions)
  | 'docker_build' | 'docker_run' | 'docker_stop' | 'docker_deploy'
  
  // Monitoring & Observability (4 actions)
  | 'metrics_collect' | 'logs_analyze' | 'performance_profile' | 'health_check'
  
  // Shell Operations (4 actions)
  | 'shell_exec' | 'shell_script' | 'process_kill' | 'service_control'
  
  // Utility Operations (2 actions)
  | 'wait' | 'notify';

// Type-safe parameter definitions for each action type
export type ActionParameters = 
  // File System Operations
  | FileCreateParams | FileReadParams | FileUpdateParams | FileDeleteParams
  | FileCopyParams | FileMoveParams | FilePermissionsParams | FileSearchParams
  
  // Directory Operations
  | DirCreateParams | DirReadParams | DirDeleteParams | DirCopyParams
  | DirMoveParams | DirPermissionsParams
  
  // Git Operations
  | GitCloneParams | GitStatusParams | GitAddParams | GitCommitParams 
  | GitPushParams | GitPullParams | GitBranchParams | GitCheckoutParams
  | GitMergeParams | GitLogParams | GitDiffParams | GitTagParams
  
  // Network/API Operations
  | HttpGetParams | HttpPostParams | HttpPutParams | HttpDeleteParams
  | ApiCallParams | WebhookSendParams | FtpUploadParams | FtpDownloadParams
  
  // Data Operations
  | DataFetchParams | DataTransformParams | DataValidateParams | DataExportParams
  | DataMergeParams | DataFilterParams
  
  // Database Operations
  | DbQueryParams | DbInsertParams | DbUpdateParams | DbDeleteParams
  | DbBackupParams | DbRestoreParams
  
  // Code Analysis & Quality
  | CodeParseParams | CodeLintParams | CodeTestParams | CodeFormatParams
  | CodeAnalyzeParams | CodeReviewParams | CodeSecurityScanParams | CodeCoverageParams
  
  // Project Management
  | ProjectScaffoldParams | ProjectInitParams | ProjectBuildParams | ProjectDeployParams
  | ProjectCleanParams | ProjectArchiveParams
  
  // Package Management
  | NpmInstallParams | NpmUninstallParams | NpmUpdateParams | NpmRunParams
  | PipInstallParams | PipUninstallParams | PipUpgradeParams | PipListParams
  
  // Container Operations
  | DockerBuildParams | DockerRunParams | DockerStopParams | DockerDeployParams
  
  // Monitoring & Observability
  | MetricsCollectParams | LogsAnalyzeParams | PerformanceProfileParams | HealthCheckParams
  
  // Shell Operations
  | ShellExecParams | ShellScriptParams | ProcessKillParams | ServiceControlParams
  
  // Utility Operations
  | WaitParams | NotifyParams;

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

export interface FileCopyParams {
  source: string;
  destination: string;
  overwrite?: boolean;
  preservePermissions?: boolean;
  preserveTimestamps?: boolean;
}

export interface FileMoveParams {
  source: string;
  destination: string;
  overwrite?: boolean;
  createDirectories?: boolean;
}

export interface FilePermissionsParams {
  path: string;
  mode: string; // e.g., '755', '644'
  recursive?: boolean;
  owner?: string;
  group?: string;
}

export interface FileSearchParams {
  path: string;
  pattern: string;
  recursive?: boolean;
  caseSensitive?: boolean;
  includeHidden?: boolean;
  maxResults?: number;
  fileType?: 'file' | 'directory' | 'both';
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

export interface DirCopyParams {
  source: string;
  destination: string;
  recursive?: boolean;
  overwrite?: boolean;
  preservePermissions?: boolean;
  preserveTimestamps?: boolean;
  excludePatterns?: string[];
}

export interface DirMoveParams {
  source: string;
  destination: string;
  overwrite?: boolean;
  createDirectories?: boolean;
}

export interface DirPermissionsParams {
  path: string;
  mode: string; // e.g., '755', '644'
  recursive?: boolean;
  owner?: string;
  group?: string;
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

export interface GitTagParams {
  repository?: string;
  name?: string;
  message?: string;
  list?: boolean;
  delete?: string;
  annotated?: boolean;
  force?: boolean;
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

export interface WebhookSendParams {
  url: string;
  payload: any;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
  timeout?: number;
  retries?: number;
  secret?: string; // for HMAC signing
}

export interface FtpUploadParams {
  localPath: string;
  remotePath: string;
  host: string;
  username: string;
  password?: string;
  port?: number;
  secure?: boolean; // SFTP/FTPS
  passive?: boolean;
}

export interface FtpDownloadParams {
  remotePath: string;
  localPath: string;
  host: string;
  username: string;
  password?: string;
  port?: number;
  secure?: boolean; // SFTP/FTPS
  passive?: boolean;
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

export interface DataMergeParams {
  datasets: any[];
  mergeKey?: string;
  strategy: 'inner' | 'outer' | 'left' | 'right';
  conflictResolution?: 'first' | 'last' | 'merge' | 'error';
  outputFormat?: string;
}

export interface DataFilterParams {
  data: any;
  filters: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex';
    value: any;
  }>;
  logic?: 'and' | 'or';
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

export interface CodeReviewParams {
  files: string | string[];
  focus?: 'security' | 'performance' | 'style' | 'bugs' | 'all';
  standards?: string[]; // coding standards to check against
  outputFormat?: 'json' | 'text' | 'html' | 'markdown';
  severity?: 'info' | 'warning' | 'error' | 'all';
}

export interface CodeSecurityScanParams {
  files: string | string[];
  scanType: 'sast' | 'dependency' | 'secrets' | 'all';
  rules?: string[];
  outputFormat?: 'json' | 'sarif' | 'text';
  failOnFindings?: boolean;
}

export interface CodeCoverageParams {
  testCommand?: string;
  files?: string | string[];
  threshold?: number; // minimum coverage percentage
  outputFormat?: 'json' | 'html' | 'text' | 'lcov';
  includeUncovered?: boolean;
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

export interface ProjectCleanParams {
  directory?: string;
  targets?: string[]; // e.g., ['node_modules', 'dist', '.cache']
  dryRun?: boolean;
  preserveConfig?: boolean;
}

export interface ProjectArchiveParams {
  source: string;
  destination: string;
  format: 'zip' | 'tar' | 'tar.gz' | 'tar.bz2';
  exclude?: string[];
  compress?: boolean;
  includeHidden?: boolean;
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

export interface PipListParams {
  environment?: string;
  format?: 'columns' | 'freeze' | 'json';
  outdated?: boolean;
  uptodate?: boolean;
  user?: boolean;
}

// Container Operation Parameters
export interface DockerBuildParams {
  context: string;
  dockerfile?: string;
  tag?: string;
  buildArgs?: Record<string, string>;
  target?: string;
  platform?: string;
  noCache?: boolean;
}

export interface DockerRunParams {
  image: string;
  name?: string;
  ports?: Record<string, string>; // host:container
  volumes?: Record<string, string>; // host:container
  environment?: Record<string, string>;
  detached?: boolean;
  remove?: boolean;
  interactive?: boolean;
  command?: string[];
}

export interface DockerStopParams {
  container: string;
  timeout?: number;
  remove?: boolean;
}

export interface DockerDeployParams {
  image: string;
  registry?: string;
  tag?: string;
  platform?: string;
  push?: boolean;
  credentials?: {
    username: string;
    password: string;
  };
}

// Monitoring & Observability Parameters
export interface MetricsCollectParams {
  source: string; // system, application, custom
  metrics?: string[]; // specific metrics to collect
  interval?: number; // collection interval in seconds
  duration?: number; // how long to collect for
  outputFormat?: 'json' | 'prometheus' | 'csv';
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface LogsAnalyzeParams {
  source: string | string[]; // log files or sources
  timeRange?: {
    start: string;
    end: string;
  };
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  pattern?: string; // regex pattern to search for
  aggregation?: 'count' | 'group' | 'timeline';
  outputFormat?: 'json' | 'text' | 'html';
}

export interface PerformanceProfileParams {
  target: string; // application, function, or process
  duration?: number; // profiling duration in seconds
  type: 'cpu' | 'memory' | 'io' | 'network' | 'all';
  samplingRate?: number;
  outputFormat?: 'json' | 'flamegraph' | 'text';
}

export interface HealthCheckParams {
  targets: string[]; // services, endpoints, or components to check
  timeout?: number;
  retries?: number;
  checks?: Array<{
    type: 'http' | 'tcp' | 'process' | 'disk' | 'memory' | 'custom';
    config: Record<string, any>;
  }>;
  outputFormat?: 'json' | 'text' | 'prometheus';
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

export interface ProcessKillParams {
  pid?: number;
  name?: string;
  signal?: 'TERM' | 'KILL' | 'INT' | 'QUIT' | 'USR1' | 'USR2';
  force?: boolean;
  recursive?: boolean; // kill child processes too
}

export interface ServiceControlParams {
  service: string;
  action: 'start' | 'stop' | 'restart' | 'reload' | 'enable' | 'disable' | 'status';
  timeout?: number;
  force?: boolean;
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
  confidence: number = VALIDATION.DEFAULT_CONFIDENCE,
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
    maxRetries: options?.maxRetries || VALIDATION.MAX_RETRY_ATTEMPTS,
    timeout: options?.timeout || getDefaultTimeout(action),
    tags: options?.tags || [],
    metadata: options?.metadata || {},
    ...options
  };
}

function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(VALIDATION.COMMAND_ID_BASE).substr(2, VALIDATION.COMMAND_ID_RANDOM_LENGTH)}`;
}

function shouldRequireApproval(action: ActionType): boolean {
  const destructiveActions = [
    // File/Directory operations that delete or modify permissions
    'file_delete', 'file_move', 'file_permissions',
    'dir_delete', 'dir_move', 'dir_permissions',
    
    // Git operations that modify remote state
    'git_push', 'git_tag',
    
    // Database operations that modify data
    'db_insert', 'db_update', 'db_delete', 'db_backup', 'db_restore',
    
    // System operations
    'shell_exec', 'shell_script', 'process_kill', 'service_control',
    
    // Package management operations that modify environment
    'npm_uninstall', 'pip_uninstall',
    
    // Container operations
    'docker_deploy', 'docker_stop',
    
    // Project operations that can affect production
    'project_deploy', 'project_clean'
  ];
  return destructiveActions.includes(action);
}

function getDefaultTimeout(action: ActionType): number {
  const timeouts: Record<string, number> = {
    // Git operations
    'git_clone': TIMEOUTS.GIT_CLONE,
    
    // Package management operations  
    'npm_install': TIMEOUTS.NPM_INSTALL,
    'npm_update': TIMEOUTS.NPM_UPDATE,
    'pip_install': TIMEOUTS.PIP_INSTALL,
    'pip_upgrade': TIMEOUTS.PIP_UPGRADE,
    
    // Project operations
    'project_build': TIMEOUTS.PROJECT_BUILD,
    'project_deploy': TIMEOUTS.PROJECT_DEPLOY,
    'project_scaffold': TIMEOUTS.PROJECT_SCAFFOLD,
    
    // Code operations
    'code_test': TIMEOUTS.CODE_TEST,
    'code_security_scan': TIMEOUTS.CODE_SECURITY_SCAN,
    'code_coverage': TIMEOUTS.CODE_COVERAGE,
    
    // Container operations
    'docker_build': TIMEOUTS.DOCKER_BUILD,
    'docker_deploy': TIMEOUTS.DOCKER_DEPLOY,
    
    // Database operations
    'db_backup': TIMEOUTS.DB_BACKUP,
    'db_restore': TIMEOUTS.DB_RESTORE,
    'db_query': TIMEOUTS.DB_QUERY,
    
    // Network operations
    'ftp_upload': TIMEOUTS.FTP_UPLOAD,
    'ftp_download': TIMEOUTS.FTP_DOWNLOAD,
    
    // Monitoring operations
    'performance_profile': TIMEOUTS.PERFORMANCE_PROFILE,
    'logs_analyze': TIMEOUTS.LOGS_ANALYZE,
    
    // Shell operations
    'shell_exec': TIMEOUTS.SHELL_EXEC,
    'shell_script': TIMEOUTS.SHELL_SCRIPT,
  };
  return timeouts[action] || TIMEOUTS.DEFAULT_OPERATION;
}

// Database Operation Parameters
export interface DbQueryParams {
  connection: string;
  query: string;
  parameters?: Record<string, any>;
  timeout?: number;
  fetchSize?: number;
  returnFormat?: 'array' | 'object' | 'stream';
}

export interface DbInsertParams {
  connection: string;
  table: string;
  data: Record<string, any> | Record<string, any>[];
  onConflict?: 'ignore' | 'update' | 'error';
  batchSize?: number;
}

export interface DbUpdateParams {
  connection: string;
  table: string;
  data: Record<string, any>;
  where: Record<string, any>;
  limit?: number;
}

export interface DbDeleteParams {
  connection: string;
  table: string;
  where: Record<string, any>;
  limit?: number;
  cascade?: boolean;
}

export interface DbBackupParams {
  connection: string;
  destination: string;
  format?: 'sql' | 'binary';
  compress?: boolean;
  tables?: string[];
  exclude?: string[];
}

export interface DbRestoreParams {
  connection: string;
  source: string;
  overwrite?: boolean;
  tables?: string[];
  skipErrors?: boolean;
}

// Additional helper functions for working with the comprehensive action set

/**
 * Get all actions in a specific category
 */
export function getActionsByCategory(category: ActionCategory): ActionType[] {
  const categories: Record<ActionCategory, ActionType[]> = {
    'file_system': [
      'file_create', 'file_read', 'file_update', 'file_delete',
      'file_copy', 'file_move', 'file_permissions', 'file_search'
    ],
    'directory': [
      'dir_create', 'dir_read', 'dir_delete', 'dir_copy', 'dir_move', 'dir_permissions'
    ],
    'git': [
      'git_clone', 'git_status', 'git_add', 'git_commit', 'git_push', 'git_pull',
      'git_branch', 'git_checkout', 'git_merge', 'git_log', 'git_diff', 'git_tag'
    ],
    'network': [
      'http_get', 'http_post', 'http_put', 'http_delete',
      'api_call', 'webhook_send', 'ftp_upload', 'ftp_download'
    ],
    'data': [
      'data_fetch', 'data_transform', 'data_validate', 'data_export',
      'data_merge', 'data_filter'
    ],
    'database': [
      'db_query', 'db_insert', 'db_update', 'db_delete', 'db_backup', 'db_restore'
    ],
    'code_quality': [
      'code_parse', 'code_lint', 'code_test', 'code_format',
      'code_analyze', 'code_review', 'code_security_scan', 'code_coverage'
    ],
    'project': [
      'project_scaffold', 'project_init', 'project_build', 'project_deploy',
      'project_clean', 'project_archive'
    ],
    'package': [
      'npm_install', 'npm_uninstall', 'npm_update', 'npm_run',
      'pip_install', 'pip_uninstall', 'pip_upgrade', 'pip_list'
    ],
    'container': [
      'docker_build', 'docker_run', 'docker_stop', 'docker_deploy'
    ],
    'monitoring': [
      'metrics_collect', 'logs_analyze', 'performance_profile', 'health_check'
    ],
    'shell': [
      'shell_exec', 'shell_script', 'process_kill', 'service_control'
    ],
    'utility': [
      'wait', 'notify'
    ]
  };
  
  return categories[category] || [];
}

/**
 * Action category enumeration
 */
export type ActionCategory = 
  | 'file_system' | 'directory' | 'git' | 'network' | 'data' | 'database'
  | 'code_quality' | 'project' | 'package' | 'container' | 'monitoring'
  | 'shell' | 'utility';

/**
 * Get the category for a specific action
 */
export function getActionCategory(action: ActionType): ActionCategory {
  const actionToCategory: Record<ActionType, ActionCategory> = {
    // File System Operations
    'file_create': 'file_system', 'file_read': 'file_system', 'file_update': 'file_system', 
    'file_delete': 'file_system', 'file_copy': 'file_system', 'file_move': 'file_system',
    'file_permissions': 'file_system', 'file_search': 'file_system',
    
    // Directory Operations
    'dir_create': 'directory', 'dir_read': 'directory', 'dir_delete': 'directory',
    'dir_copy': 'directory', 'dir_move': 'directory', 'dir_permissions': 'directory',
    
    // Git Operations
    'git_clone': 'git', 'git_status': 'git', 'git_add': 'git', 'git_commit': 'git',
    'git_push': 'git', 'git_pull': 'git', 'git_branch': 'git', 'git_checkout': 'git',
    'git_merge': 'git', 'git_log': 'git', 'git_diff': 'git', 'git_tag': 'git',
    
    // Network/API Operations
    'http_get': 'network', 'http_post': 'network', 'http_put': 'network', 'http_delete': 'network',
    'api_call': 'network', 'webhook_send': 'network', 'ftp_upload': 'network', 'ftp_download': 'network',
    
    // Data Operations
    'data_fetch': 'data', 'data_transform': 'data', 'data_validate': 'data', 'data_export': 'data',
    'data_merge': 'data', 'data_filter': 'data',
    
    // Database Operations
    'db_query': 'database', 'db_insert': 'database', 'db_update': 'database', 'db_delete': 'database',
    'db_backup': 'database', 'db_restore': 'database',
    
    // Code Analysis & Quality
    'code_parse': 'code_quality', 'code_lint': 'code_quality', 'code_test': 'code_quality',
    'code_format': 'code_quality', 'code_analyze': 'code_quality', 'code_review': 'code_quality',
    'code_security_scan': 'code_quality', 'code_coverage': 'code_quality',
    
    // Project Management
    'project_scaffold': 'project', 'project_init': 'project', 'project_build': 'project',
    'project_deploy': 'project', 'project_clean': 'project', 'project_archive': 'project',
    
    // Package Management
    'npm_install': 'package', 'npm_uninstall': 'package', 'npm_update': 'package', 'npm_run': 'package',
    'pip_install': 'package', 'pip_uninstall': 'package', 'pip_upgrade': 'package', 'pip_list': 'package',
    
    // Container Operations
    'docker_build': 'container', 'docker_run': 'container', 'docker_stop': 'container', 'docker_deploy': 'container',
    
    // Monitoring & Observability
    'metrics_collect': 'monitoring', 'logs_analyze': 'monitoring', 'performance_profile': 'monitoring', 'health_check': 'monitoring',
    
    // Shell Operations
    'shell_exec': 'shell', 'shell_script': 'shell', 'process_kill': 'shell', 'service_control': 'shell',
    
    // Utility Operations
    'wait': 'utility', 'notify': 'utility'
  };
  
  return actionToCategory[action];
}

/**
 * Check if an action is read-only (safe to execute without approval)
 */
export function isReadOnlyAction(action: ActionType): boolean {
  const readOnlyActions: ActionType[] = [
    // Read operations
    'file_read', 'dir_read', 'git_status', 'git_log', 'git_diff',
    'http_get', 'data_fetch', 'data_validate', 'db_query',
    'code_parse', 'code_lint', 'code_test', 'code_analyze', 'code_review',
    'code_security_scan', 'code_coverage', 'npm_run', 'pip_list',
    'metrics_collect', 'logs_analyze', 'performance_profile', 'health_check',
    'wait', 'notify'
  ];
  
  return readOnlyActions.includes(action);
}

/**
 * Get estimated complexity score for an action (1-10 scale)
 */
export function getActionComplexity(action: ActionType): number {
  const complexityScores: Record<ActionType, number> = {
    // File System Operations (1-3)
    'file_create': ACTION_COMPLEXITY.FILE_CREATE,
    'file_read': ACTION_COMPLEXITY.FILE_READ,
    'file_update': ACTION_COMPLEXITY.FILE_UPDATE,
    'file_delete': ACTION_COMPLEXITY.FILE_DELETE,
    'file_copy': ACTION_COMPLEXITY.FILE_COPY,
    'file_move': ACTION_COMPLEXITY.FILE_MOVE,
    'file_permissions': ACTION_COMPLEXITY.FILE_PERMISSIONS,
    'file_search': ACTION_COMPLEXITY.FILE_SEARCH,
    
    // Directory Operations (1-3)
    'dir_create': ACTION_COMPLEXITY.DIR_CREATE,
    'dir_read': ACTION_COMPLEXITY.DIR_READ,
    'dir_delete': ACTION_COMPLEXITY.DIR_DELETE,
    'dir_copy': ACTION_COMPLEXITY.DIR_COPY,
    'dir_move': ACTION_COMPLEXITY.DIR_MOVE,
    'dir_permissions': ACTION_COMPLEXITY.DIR_PERMISSIONS,
    
    // Git Operations (2-5)
    'git_clone': ACTION_COMPLEXITY.GIT_CLONE,
    'git_status': ACTION_COMPLEXITY.GIT_STATUS,
    'git_add': ACTION_COMPLEXITY.GIT_ADD,
    'git_commit': ACTION_COMPLEXITY.GIT_COMMIT,
    'git_push': ACTION_COMPLEXITY.GIT_PUSH,
    'git_pull': ACTION_COMPLEXITY.GIT_PULL,
    'git_branch': ACTION_COMPLEXITY.GIT_BRANCH,
    'git_checkout': ACTION_COMPLEXITY.GIT_CHECKOUT,
    'git_merge': ACTION_COMPLEXITY.GIT_MERGE,
    'git_log': ACTION_COMPLEXITY.GIT_LOG,
    'git_diff': ACTION_COMPLEXITY.GIT_DIFF,
    'git_tag': ACTION_COMPLEXITY.GIT_TAG,
    
    // Network/API Operations (2-6) - Using estimated values since not all are in constants
    'http_get': 2, 'http_post': 3, 'http_put': 3, 'http_delete': 3,
    'api_call': 4, 'webhook_send': 4, 'ftp_upload': 5, 'ftp_download': 5,
    
    // Data Operations (3-6)
    'data_fetch': 3, 'data_transform': 5, 'data_validate': 3, 'data_export': 4,
    'data_merge': 6, 'data_filter': 4,
    
    // Database Operations (3-8)
    'db_query': 3, 'db_insert': 4, 'db_update': 5, 'db_delete': 5,
    'db_backup': 7, 'db_restore': 8,
    
    // Code Analysis & Quality (2-6)
    'code_parse': 3, 'code_lint': 2, 'code_test': 5, 'code_format': 2,
    'code_analyze': 4, 'code_review': 6, 'code_security_scan': 5, 'code_coverage': 4,
    
    // Project Management (4-9)
    'project_scaffold': 6, 'project_init': 4, 'project_build': 7, 'project_deploy': 9,
    'project_clean': 3, 'project_archive': 4,
    
    // Package Management (2-6)
    'npm_install': 4, 'npm_uninstall': 3, 'npm_update': 5, 'npm_run': 3,
    'pip_install': 4, 'pip_uninstall': 3, 'pip_upgrade': 5, 'pip_list': 2,
    
    // Container Operations (5-8)
    'docker_build': 6, 'docker_run': 5, 'docker_stop': 3, 'docker_deploy': 8,
    
    // Monitoring & Observability (3-5)
    'metrics_collect': 4, 'logs_analyze': 5, 'performance_profile': 5, 'health_check': 3,
    
    // Shell Operations (3-7)
    'shell_exec': 5, 'shell_script': 6, 'process_kill': 7, 'service_control': 6,
    
    // Utility Operations (1-2)
    'wait': 1, 'notify': 2
  };
  
  return complexityScores[action] || ACTION_COMPLEXITY.DEFAULT_COMPLEXITY;
}
