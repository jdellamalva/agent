# LLM Agent Development Guide

<!-- @governance-override: documentation: test=development-guide-examples: TypeScript code examples in this file are for documentation purposes only, not actual exports requiring JSDoc -->

## 🎯 AUTOMATED CODE GOVERNANCE

This project uses an **automated governance system** instead of manual code reviews. Rather than maintaining an ever-growing essay-style guide that would eventually hit context window limits, we use deterministic and semi-deterministic scripts to enforce standards consistently and scalably.

### 📋 Quick Start - Governance Commands

```bash
# Check all standards before committing
npm run governance:check

# Run only fast, deterministic checks
npm run governance:deterministic

# Run only AI-assisted checks (requires OpenAI API key)
npm run governance:llm

# Check specific standards
npm run governance:magic-numbers
npm run governance:docs
npm run governance:naming
npm run governance:imports
npm run governance:todos
npm run governance:complexity
```

### 🎮 Governance Dashboard

**Primary Documentation**: [`scripts/governance/README.md`](scripts/governance/README.md)

The governance system replaces manual review with automated enforcement:

| Standard | Script | Type | Description |
|----------|--------|------|-------------|
| **No Magic Numbers** | `check-magic-numbers.ts` | Deterministic | All hardcoded values centralized in constants |
| **Documentation Coverage** | `check-documentation.ts` | Deterministic | All major components have JSDoc |
| **Naming Conventions** | `check-naming-conventions.ts` | Deterministic | PascalCase, camelCase, SCREAMING_SNAKE_CASE |
| **Import/Export Standards** | `check-import-export.ts` | Deterministic | Named exports, import grouping, no cycles |
| **TODO/FIXME Standards** | `check-todo-standards.ts` | Deterministic | Proper format with owner and deadline |
| **DRY Principle** | `analyze-dry.ts` | LLM-Assisted | Code duplication detection |
| **Code Complexity** | `analyze-complexity.ts` | LLM-Assisted | Function complexity analysis |

**Status**: ✅ All governance checks currently pass

## 🚀 CORE ARCHITECTURAL PRINCIPLES (Enforced Automatically)

**Interface Design**:
```typescript
// ✅ GOOD: Single responsibility interfaces
interface LLMProvider {
  generateResponse(prompt: string): Promise<string>;
}

interface MessageChannel {
  sendMessage(message: string): Promise<void>;
}

// ❌ BAD: Mixed responsibilities
interface Service {
  generateResponse(): Promise<string>;
  sendMessage(): Promise<void>;
  saveToDatabase(): Promise<void>;
}
```

#### **3. SOLID Principles - ENFORCED** 🏗️

**Single Responsibility**: One class, one job
**Open/Closed**: Open for extension, closed for modification
**Liskov Substitution**: Subtypes must be substitutable for base types
**Interface Segregation**: Many specific interfaces > one general interface
**Dependency Inversion**: Depend on abstractions, not concretions

##### **Single Responsibility Principle (SRP)**
Each class should have only one reason to change.

```typescript
// ✅ GOOD: Single responsibility - only handles token management
export class TokenManager {
  private usage: TokenUsage;
  
  estimateTokens(text: string): number { /* ... */ }
  recordUsage(usage: TokenUsage): void { /* ... */ }
  checkBudget(tokens: number): BudgetCheck { /* ... */ }
}

// ✅ GOOD: Single responsibility - only handles response parsing
export class ResponseParser {
  validateCommand(cmd: StructuredCommand): ValidationResult { /* ... */ }
  performSafetyCheck(cmd: StructuredCommand): SafetyCheck { /* ... */ }
}

// ❌ BAD: Multiple responsibilities - mixing concerns
export class LLMManager {
  estimateTokens(): number { /* token logic */ }
  validateCommand(): boolean { /* validation logic */ }
  sendSlackMessage(): void { /* channel logic */ }
  saveToDatabase(): void { /* persistence logic */ }
}
```

##### **Open/Closed Principle (OCP)**
Classes should be open for extension but closed for modification.

```typescript
// ✅ GOOD: Extensible through interface implementation
export abstract class LLMProvider {
  abstract generateResponse(request: LLMRequest): Promise<LLMResponse>;
  abstract getCapabilities(): LLMCapabilities;
}

export class OpenAIProvider extends LLMProvider { /* implementation */ }
export class AnthropicProvider extends LLMProvider { /* implementation */ }

// ✅ GOOD: Plugin architecture for new actions
export interface ActionHandler {
  handle(command: StructuredCommand): Promise<ActionResult>;
  supports(action: string): boolean;
}

export class FileActionHandler implements ActionHandler { /* ... */ }
export class GitActionHandler implements ActionHandler { /* ... */ }

// ❌ BAD: Requires modification for new providers
export class LLMManager {
  process(request: string) {
    if (this.provider === 'openai') { /* ... */ }
    else if (this.provider === 'anthropic') { /* ... */ }
    // Adding new provider requires modifying this class
  }
}
```

##### **Liskov Substitution Principle (LSP)**
Derived classes must be substitutable for their base classes.

```typescript
// ✅ GOOD: All implementations honor the base contract
export abstract class MessageChannel {
  abstract sendMessage(message: ChannelMessage): Promise<ChannelResponse>;
  
  // Base behavior that all subclasses must honor
  protected validateMessage(msg: ChannelMessage): void {
    if (!msg.content) throw new Error('Message content required');
  }
}

export class SlackChannel extends MessageChannel {
  async sendMessage(message: ChannelMessage): Promise<ChannelResponse> {
    this.validateMessage(message); // Honors base contract
    return this.slackClient.postMessage(message);
  }
}

export class DiscordChannel extends MessageChannel {
  async sendMessage(message: ChannelMessage): Promise<ChannelResponse> {
    this.validateMessage(message); // Honors base contract
    return this.discordClient.send(message);
  }
}

// ❌ BAD: Violates base class contract
export class EmailChannel extends MessageChannel {
  async sendMessage(message: ChannelMessage): Promise<ChannelResponse> {
    // Violates LSP - doesn't validate message like base class expects
    if (message.content.length > 1000) {
      throw new Error('Email too long'); // Different validation rules
    }
  }
}
```

##### **Interface Segregation Principle (ISP)**
Clients should not be forced to depend on interfaces they don't use.

```typescript
// ✅ GOOD: Specific, focused interfaces
export interface TokenEstimator {
  estimateTokens(text: string): number;
}

export interface BudgetTracker {
  checkBudget(tokens: number): BudgetCheck;
  recordUsage(usage: TokenUsage): void;
}

export interface TokenOptimizer {
  analyzeForOptimization(text: string): OptimizationResult;
}

// Classes implement only what they need
export class SimpleTokenManager implements TokenEstimator {
  estimateTokens(text: string): number { /* ... */ }
}

export class AdvancedTokenManager implements TokenEstimator, BudgetTracker, TokenOptimizer {
  // Implements all interfaces
}

// ❌ BAD: Fat interface forces unnecessary dependencies
export interface TokenManager {
  estimateTokens(text: string): number;
  checkBudget(tokens: number): BudgetCheck;
  recordUsage(usage: TokenUsage): void;
  analyzeForOptimization(text: string): OptimizationResult;
  generateReport(): Report; // Not all clients need this
  configureBudget(budget: Budget): void; // Not all clients need this
}
```

##### **Dependency Inversion Principle (DIP)**
High-level modules should not depend on low-level modules. Both should depend on abstractions.

```typescript
// ✅ GOOD: Depends on abstraction, not concrete implementation
export class LLMOrchestrator {
  constructor(
    private provider: LLMProvider,        // Abstract interface
    private tokenManager: TokenEstimator, // Abstract interface
    private parser: ResponseParser        // Abstract interface
  ) {}
  
  async processRequest(request: string): Promise<ParsedResponse> {
    const tokens = this.tokenManager.estimateTokens(request);
    const response = await this.provider.generateResponse({ prompt: request });
    return this.parser.parseResponse(response.content);
  }
}

// ✅ GOOD: Configuration through dependency injection
const orchestrator = new LLMOrchestrator(
  new OpenAIProvider(config),
  new TokenManager(),
  new ResponseParser()
);

// ❌ BAD: Directly depends on concrete implementations
export class LLMOrchestrator {
  private openai = new OpenAI(process.env.OPENAI_API_KEY); // Tight coupling
  private tokenManager = new TokenManager();               // Hard to test
  
  async processRequest(request: string): Promise<string> {
    // Directly using concrete OpenAI client - can't substitute
    return await this.openai.chat.completions.create({ /* ... */ });
  }
}
```

#### **4. Configuration Management - ENFORCED** ⚙️
**Principle**: All configuration values must be centralized and environment-configurable to eliminate magic numbers and improve maintainability.

**Implementation Patterns**:
```typescript
// ✅ GOOD: Centralized configuration constants
import { VALIDATION, TIMEOUTS, NETWORK, OPENAI_PRICING } from '../config/constants';

export class OpenAIProvider {
  calculateCost(tokensUsed: TokenUsage): number {
    const modelPricing = this.getPricing(this.config.model);
    const inputCost = (tokensUsed.promptTokens / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * modelPricing.input;
    const outputCost = (tokensUsed.completionTokens / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * modelPricing.output;
    return inputCost + outputCost;
  }

  private handleAPIError(error: any): OpenAIError {
    switch (error.status) {
      case NETWORK.HTTP_STATUS_TOO_MANY_REQUESTS:
        return new OpenAIError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
      case NETWORK.HTTP_STATUS_UNAUTHORIZED:
        return new OpenAIError('Invalid API key', 'INVALID_API_KEY');
      default:
        return new OpenAIError('API error', 'API_ERROR');
    }
  }
}

// ✅ GOOD: Environment-configurable constants
export const VALIDATION = {
  DEFAULT_CONFIDENCE: getEnvOverride('AGENT_VALIDATION_DEFAULT_CONFIDENCE', 0.8),
  MAX_RETRY_ATTEMPTS: getEnvOverride('AGENT_VALIDATION_MAX_RETRIES', 3),
} as const;

// ❌ BAD: Magic numbers scattered throughout code
export class BadProvider {
  calculateCost(tokensUsed: TokenUsage): number {
    const inputCost = (tokensUsed.promptTokens / 1000) * 0.03;  // Magic numbers!
    const outputCost = (tokensUsed.completionTokens / 1000) * 0.06;
    return inputCost + outputCost;
  }

  private handleRetry(): void {
    if (this.retryCount < 3) {  // Magic number!
      setTimeout(() => this.retry(), 5000);  // Magic number!
    }
  }
}
```

**Configuration Architecture**:
```typescript
// src/config/constants.ts - Single source of truth for all configuration
export const VALIDATION = {
  DEFAULT_CONFIDENCE: getEnvOverride('AGENT_VALIDATION_DEFAULT_CONFIDENCE', 0.8),
  MAX_RETRY_ATTEMPTS: getEnvOverride('AGENT_VALIDATION_MAX_RETRIES', 3),
} as const;

export const TIMEOUTS = {
  DEFAULT_OPERATION: getEnvOverride('AGENT_TIMEOUT_DEFAULT', 30000),
  GIT_CLONE: getEnvOverride('AGENT_TIMEOUT_GIT_CLONE', 300000),
  NPM_INSTALL: getEnvOverride('AGENT_TIMEOUT_NPM_INSTALL', 600000),
} as const;

export const NETWORK = {
  HTTP_STATUS_TOO_MANY_REQUESTS: getEnvOverride('AGENT_NETWORK_STATUS_TOO_MANY_REQUESTS', 429),
  DEFAULT_RETRY_DELAY: getEnvOverride('AGENT_NETWORK_RETRY_DELAY', 1000),
  DEFAULT_RATE_LIMIT_DELAY: getEnvOverride('AGENT_NETWORK_RATE_LIMIT_DELAY', 5000),
} as const;
```

**Review Checklist**:
- [ ] No hardcoded numbers in business logic
- [ ] All timeouts use TIMEOUTS constants
- [ ] All HTTP status codes use NETWORK constants
- [ ] All pricing calculations use OPENAI_PRICING constants
- [ ] Environment variables documented with defaults
- [ ] Constants grouped by logical domain (VALIDATION, TIMEOUTS, etc.)
- [ ] Tests updated to use constants instead of hardcoded values

### **Documentation Standards - REQUIRED** 📚

#### **File-Level Documentation**
```typescript
/**
 * Response Parser for LLM Agent
 * 
 * Handles parsing and validating LLM responses to ensure they can be 
 * safely executed by the action system.
 * 
 * Dependencies: ValidationEngine, CommandValidationRules
 * Exports: ResponseParser, ValidationResult, SafetyCheck
 * 
 * Key Patterns:
 * - Centralized validation through ValidationEngine
 * - Security-first approach to command validation
 * - Structured error reporting with context
 */
```

#### **Class-Level Documentation**
```typescript
/**
 * Manages token usage tracking and optimization for LLM interactions
 * 
 * Responsibilities:
 * - Track token consumption across all LLM providers
 * - Estimate costs before API calls
 * - Provide optimization recommendations
 * - Cache expensive token estimations
 * 
 * Collaborates with: LLMProvider, ConfigManager, CacheManager
 * Lifecycle: Singleton instance, initialized on first use
 */
export class TokenManager {
```

#### **Method-Level Documentation**
```typescript
/**
 * Analyzes prompt for potential optimizations
 * 
 * @param prompt - The input text to analyze
 * @param options - Analysis configuration options
 * @returns Analysis result with recommendations and estimated savings
 * 
 * Side effects: Updates internal optimization metrics
 * Performance: O(n) where n is prompt length, cached for 5 minutes
 */
public analyzeForOptimization(
  prompt: string, 
  options: AnalysisOptions = {}
): OptimizationAnalysis {
```

### **Governor Agent Architecture** 🤖👨‍⚖️

#### **Automated Code Review System**
```typescript
interface GovernorAgent {
  reviewCode(changes: CodeChange[]): Promise<ReviewResult>;
  enforceArchitecture(codebase: Codebase): Promise<ComplianceReport>;
  detectTechnicalDebt(files: SourceFile[]): Promise<DebtAnalysis>;
  suggestRefactoring(component: Component): Promise<RefactoringSuggestion[]>;
}
```

#### **Review Criteria**
- **DRY Violations**: Duplicate logic detection
- **SOLID Compliance**: Architecture pattern verification  
- **Security Issues**: Vulnerability and safety scanning
- **Performance Regressions**: Benchmark comparison
- **Documentation Coverage**: Inline docs completeness

### **Context Window Management Strategy** 🧠

#### **Hierarchical Context Loading**
```typescript
// Load context in priority order
1. Current file being edited
2. Direct dependencies (imports)
3. Interface definitions  
4. Related test files
5. Configuration files
6. Documentation
```

#### **Smart Summarization**
```typescript
interface ContextManager {
  summarizeFile(file: SourceFile): FileSummary;
  extractInterfaces(files: SourceFile[]): InterfaceDefinition[];
  identifyKeyPatterns(codebase: Codebase): ArchitecturalPattern[];
  compressContext(context: Context, targetSize: number): CompressedContext;
}
```

### **Safety Guardrails - MANDATORY** 🛡️

#### **Prohibited Patterns**
- Direct database manipulation without validation
- File system operations outside project sandbox
- Network requests to untrusted domains
- Execution of user-provided code without sanitization
- Logging of sensitive information (API keys, passwords)

#### **Required Approvals**
- Destructive operations (file deletion, database drops)
- External API integrations
- Security-sensitive code changes
- Dependency additions/updates

### **Code Review Checklist - MANDATORY** ✅

#### **Pre-Review - Developer Self-Check**
Before submitting code for review, verify:

- [ ] **Builds without errors**: `npm run build` passes
- [ ] **Tests pass**: `npm test` runs successfully with >80% coverage
- [ ] **Linting clean**: `npm run lint` reports no violations
- [ ] **Documentation updated**: All new/changed functionality is documented
- [ ] **No TODO/FIXME**: All temporary markers addressed or tickets created

#### **Architecture & Design Review**

**DRY Principle Compliance**:
- [ ] No duplicate logic across files
- [ ] Common patterns extracted to utilities
- [ ] Configuration centralized in ConfigManager
- [ ] Error handling follows consistent patterns
- [ ] Validation logic reuses ValidationEngine rules

**Configuration Management Compliance**:
- [ ] No magic numbers or hardcoded values in business logic
- [ ] All constants imported from `src/config/constants.ts`
- [ ] Timeouts use TIMEOUTS constants
- [ ] HTTP status codes use NETWORK constants
- [ ] Pricing calculations use OPENAI_PRICING constants
- [ ] Environment variables have documented defaults
- [ ] Tests use constants instead of hardcoded values

**SOLID Principles Compliance**:
- [ ] Single Responsibility: Each class has one clear purpose
- [ ] Open/Closed: New functionality added via extension, not modification
- [ ] Liskov Substitution: Derived classes honor base class contracts
- [ ] Interface Segregation: Interfaces are focused and specific
- [ ] Dependency Inversion: Dependencies injected, not hard-coded

**Separation of Concerns**:
- [ ] Business logic separated from external integrations
- [ ] Provider implementations isolated from core logic
- [ ] Utilities are cross-cutting and reusable
- [ ] No mixed responsibilities in single modules

#### **Code Quality Review**

**TypeScript Best Practices**:
- [ ] Strict type checking enabled and satisfied
- [ ] No `any` types without justification
- [ ] Interfaces defined for all public contracts
- [ ] Enums used for fixed value sets
- [ ] Generic types used appropriately for reusability
- [ ] **No unused imports** - All imports must be actively used in the file
- [ ] **Import organization** - External packages first, then internal modules
- [ ] **Dependency hygiene** - Only necessary packages in production dependencies

**Error Handling**:
- [ ] All errors extend AgentError base class
- [ ] Error codes follow COMPONENT_ERROR_TYPE pattern
- [ ] Contextual information included for debugging
- [ ] Operational vs programming errors properly classified
- [ ] Error boundaries prevent cascading failures

**Performance Considerations**:
- [ ] Expensive operations are cached/memoized
- [ ] Large objects passed by reference, not copied
- [ ] Async operations properly await/handle
- [ ] Memory leaks prevented (event listeners cleaned up)
- [ ] Database queries optimized and bounded

#### **Security Review**

**Input Validation**:
- [ ] All external inputs validated before processing
- [ ] Command parameters sanitized for shell execution
- [ ] File paths validated to prevent directory traversal
- [ ] API tokens never logged or exposed in responses

**Safe Execution**:
- [ ] Destructive operations require explicit approval
- [ ] Shell commands sanitized and sandboxed
- [ ] File operations restricted to project boundaries
- [ ] Network requests limited to allowed domains

#### **Documentation Review**

**Inline Documentation**:
- [ ] File-level docs explain purpose and dependencies
- [ ] Class-level docs describe responsibility and lifecycle
- [ ] Method-level docs specify parameters, return values, side effects
- [ ] Complex algorithms have explanatory comments
- [ ] Public APIs fully documented with examples

**External Documentation**:
- [ ] README updated for new features/dependencies
- [ ] TODO.md reflects current project state
- [ ] Development guide updated for new patterns
- [ ] Architecture diagrams updated if structure changed

#### **Testing Review**

**Test Coverage**:
- [ ] Unit tests for all new/modified functions
- [ ] Integration tests for component interactions
- [ ] Error path testing for exception scenarios
- [ ] Mock factories used for external dependencies
- [ ] Test coverage >80% for new code

**Test Quality**:
- [ ] Tests are deterministic and isolated
- [ ] Test names clearly describe what's being tested
- [ ] Assertions are specific and meaningful
- [ ] Setup/teardown properly manages test state
- [ ] Performance tests for critical paths

#### **Integration Review**

**Backward Compatibility**:
- [ ] Public APIs maintain compatibility
- [ ] Database schema changes are additive
- [ ] Configuration changes have defaults
- [ ] Breaking changes documented and versioned

**Deployment Readiness**:
- [ ] Environment variables documented
- [ ] Database migrations included if needed
- [ ] Logging levels appropriate for production
- [ ] Error monitoring integration functional
- [ ] Health check endpoints working

## 🔄 GOVERNANCE-BASED DEVELOPMENT WORKFLOW

### Pre-Development
1. **Check governance status**: `npm run governance:check`
2. **Review failing checks**: Address any existing violations
3. **Understand standards**: Reference `scripts/governance/README.md` for specific patterns

### During Development
1. **Write code** following patterns shown in governance scripts
2. **Run relevant checks**: `npm run governance:naming`, `npm run governance:docs`, etc.
3. **Fix violations immediately**: Don't accumulate technical debt

### Pre-Commit
1. **Run all deterministic checks**: `npm run governance:deterministic`
2. **All checks must pass**: Commit only after ✅ status
3. **Optional LLM checks**: `npm run governance:llm` (if OpenAI key available)

### Code Review
1. **Governance pre-verified**: Manual review focuses on business logic
2. **No style discussions**: Standards are enforced automatically
3. **Focus on architecture**: Review design decisions, not formatting

This workflow **eliminates** the need to manually check the long development guide during reviews!

## Current System Status
- **Test Suite**: 23 test suites, 480+ tests passing
- **Coverage**: Core components at 90%+, integrations appropriately mocked
- **Architecture**: DRY principles implemented, separation of concerns enforced
- **Performance**: Caching and memoization optimizations in place
- **Quality**: TypeScript strict mode, comprehensive validation system

---

*This document captures practical development notes, gotchas, and patterns. For high-level architecture and project vision, see the TODO.md file.*
