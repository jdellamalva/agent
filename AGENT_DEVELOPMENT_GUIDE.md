# LLM Agent Development Guide

## 🎯 CORE ARCHITECTURAL PRINCIPLES

### **The Three Pillars of Maintainable Code**

#### **1. DRY (Don't Repeat Yourself) - ENFORCED** 🚫🔄
**Principle**: Every piece of knowledge must have a single, unambiguous, authoritative representation.

**Implementation Patterns**:
```typescript
// ✅ GOOD: Centralized validation
export class ValidationEngine {
  static createCommonRules() {
    return {
      required: <T>(field: string) => ({ /* reusable logic */ }),
      stringType: (field: string) => ({ /* reusable logic */ })
    };
  }
}

// ❌ BAD: Duplicate validation in multiple files
class ComponentA { validateRequired(val) { /* duplicate logic */ } }
class ComponentB { validateRequired(val) { /* duplicate logic */ } }
```

**Review Checklist**:
- [ ] No duplicate validation logic
- [ ] Configuration accessed through single source
- [ ] Error handling follows consistent patterns
- [ ] Utility functions are reusable across components

#### **2. Separation of Concerns - ENFORCED** 🎯
**Principle**: Each module should have one reason to change.

**Layer Architecture**:
```typescript
// ✅ GOOD: Clear layer separation
src/core/          // Business logic (no external dependencies)
src/integrations/  // External API handling 
src/providers/     // Implementation details
src/utils/         // Cross-cutting concerns (logging, errors)

// ❌ BAD: Mixed concerns
class UserService {
  saveUser() { /* business logic */ }
  sendEmail() { /* external service */ }
  logActivity() { /* cross-cutting */ }
}
```

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

### **LLM-Digestible Hierarchical Structure** 🤖📚

The codebase is organized for optimal LLM understanding and context management:

#### **Information Architecture for AI Agents**

**Top-Level Structure (Context Priority)**:
```
1. Interface Definitions (contracts and types)
2. Core Business Logic (domain models and services) 
3. Provider Implementations (external integrations)
4. Utility Functions (cross-cutting concerns)
5. Configuration and Setup (environment and deployment)
```

**File Organization Patterns**:
```typescript
// ✅ GOOD: Clear hierarchical naming for LLM context
src/
├── core/                    // HIGH PRIORITY: Core business logic
│   ├── llm/                // LLM orchestration and providers
│   │   ├── LLMOrchestrator.ts    // Main coordination logic
│   │   └── LLMProvider.ts        // Provider interface definition
│   ├── channels/           // Communication channels
│   │   └── MessageChannel.ts     // Channel interface definition
│   └── validation/         // Input validation and safety
│       ├── ValidationEngine.ts   // Core validation framework
│       └── CommandValidationRules.ts // Specific validation rules
├── providers/              // MEDIUM PRIORITY: External integrations
│   ├── llm/               // LLM provider implementations
│   │   └── OpenAIProvider.ts     // OpenAI-specific implementation
│   └── channels/          // Channel provider implementations
│       └── SlackChannel.ts       // Slack-specific implementation
├── utils/                  // LOW PRIORITY: Cross-cutting utilities
│   ├── logger.ts          // Logging infrastructure
│   ├── errors.ts          // Error handling utilities
│   └── config.ts          // Configuration management
└── integrations/          // LOWEST PRIORITY: Legacy/specialized
    ├── openai.ts          // Direct OpenAI integration
    └── slack.ts           // Direct Slack integration
```

**Documentation Hierarchy for LLM Context**:
```typescript
/**
 * Level 1: File Purpose (What this module does)
 * Level 2: Dependencies (What it needs to work)
 * Level 3: Key Patterns (How it's structured)
 * Level 4: Lifecycle (When/how it's used)
 * Level 5: Performance (Optimization details)
 * Level 6: Error Handling (Failure scenarios)
 */

/**
 * Class-Level Documentation:
 * - Responsibility (Single clear purpose)
 * - Collaborators (What it works with)
 * - Lifecycle (Creation to destruction)
 * - Threading/Concurrency (If applicable)
 */

/**
 * Method-Level Documentation:
 * - Purpose (What it accomplishes)
 * - Parameters (Inputs and validation)
 * - Return Values (Outputs and types)
 * - Side Effects (State changes)
 * - Error Conditions (Exception scenarios)
 * - Performance Notes (Complexity/caching)
 */
```

**LLM Context Management Strategy**:
```typescript
// Interface definitions first (highest context value)
export interface LLMProvider {
  generateResponse(request: LLMRequest): Promise<LLMResponse>;
  getCapabilities(): LLMCapabilities;
}

// Implementation follows interface (maintains context)
export class OpenAIProvider implements LLMProvider {
  // Implementation details...
}

// Usage patterns documented for LLM understanding
/**
 * Usage Example for LLM Agents:
 * 
 * const provider = new OpenAIProvider(config);
 * const request = { prompt: "Generate code", options: {} };
 * const response = await provider.generateResponse(request);
 * 
 * Common Patterns:
 * - Always validate inputs before processing
 * - Use structured responses for parsing
 * - Implement proper error handling
 * - Cache expensive operations
 */
```

**Naming Conventions for LLM Clarity**:
```typescript
// ✅ GOOD: Self-documenting names for LLM understanding
export class TokenUsageTracker {        // Clear responsibility
  estimateTokenCost(): number          // Clear action
  recordActualUsage(): void           // Clear side effect
  generateUsageReport(): Report       // Clear output
}

// ✅ GOOD: Interface names indicate contracts
export interface MessageChannelProvider {  // Clear abstraction
  sendMessage(): Promise<MessageResult>    // Clear async operation
  receiveMessage(): Promise<Message>       // Clear async operation
}

// ❌ BAD: Ambiguous names that confuse LLMs
export class Manager {                // What does it manage?
  process(): any                     // What does it process?
  handle(): void                    // What does it handle?
}
```

**Cross-Reference Structure for Context Building**:
```typescript
/**
 * Related Files (for LLM context building):
 * - Interface: src/core/llm/LLMProvider.ts
 * - Implementation: src/providers/llm/OpenAIProvider.ts  
 * - Usage: src/core/llm/LLMOrchestrator.ts
 * - Tests: tests/openaiProvider.test.ts
 * - Config: src/utils/config.ts (LLM_PROVIDER_CONFIG)
 */
```

## Testing Framework & Best Practices Guide

### Core Technology Stack
- **Use TypeScript** for better type safety and development experience
- **Implement comprehensive logging from day one** - debugging distributed systems is hard
- **Multi-project isolation is critical** - one project's issues shouldn't affect others
- **Version control everything** - all agent modifications should be tracked
- **Sandbox dangerous operations** - especially when working with unknown codebases

## Recent Improvements & Architectural Changes

### ✅ DRY (Don't Repeat Yourself) Improvements
**Centralized Validation System** - Eliminated duplicate validation logic across components:
- `src/core/validation/ValidationEngine.ts` - Generic validation framework
- `src/core/validation/CommandValidationRules.ts` - Reusable validation rules
- Replaced 200+ lines of scattered validation with centralized approach
- Added warning system for security-sensitive operations

### ✅ Separation of Concerns
**Dependency Injection Container** - Improved testability and decoupling:
- `src/core/di/DIContainer.ts` - Centralized dependency management
- Removed tight coupling between components
- Improved configuration management and testability

### ✅ Performance Optimizations
**Caching & Memoization System** - Improved performance for repetitive operations:
- `src/core/performance/CacheManager.ts` - LRU cache with TTL support
- Memoized token estimation in `TokenManager.ts`
- Batch processing capabilities for bulk operations
- Memory-aware cache eviction

### ✅ Enhanced Testing Infrastructure
**Type-Safe Mock Factories** - Eliminated TypeScript strict mode issues:
- `tests/helpers/mockFactories.ts` - Comprehensive mock utilities
- Fixed all Jest/TypeScript compatibility issues
- Added proper async/error mock handling
- Integration tests now pass without TypeScript errors

## Testing Framework & Best Practices Guide

### Jest Configuration & TypeScript Gotchas

**🔴 CRITICAL GOTCHA**: Jest doesn't support TypeScript path aliases (@utils, @integrations) out of the box. The `moduleNameMapping` property doesn't exist in Jest. 

**✅ SOLUTION**: Use relative imports in ALL test files and source files when having Jest issues:
```typescript
// ❌ DON'T USE (causes Jest errors)
import { logger } from '@utils/logger';

// ✅ USE THIS INSTEAD
import { logger } from '../src/utils/logger';
import { logger } from '../../src/utils/logger'; // from nested test dirs
```

### Testing Strategy & Coverage Analysis

#### The 80/20 Rule of Test Coverage

After achieving ~80% test coverage, the remaining 20% typically consists of:

1. **Integration entry points** (`src/index.ts` - main startup logic)
2. **External service integrations** (`src/integrations/slack.ts`, `src/integrations/openai.ts`)
3. **Error handling edge cases** (network failures, malformed responses)
4. **Configuration validation** (environment variable validation)
5. **Process lifecycle management** (graceful shutdown, signal handlers)

**📊 Coverage Priority Strategy**:
- **Phase 1**: Get all core components to 100% coverage (transformers, parsers, managers)
- **Phase 2**: Mock-based integration tests for external services (80-90% coverage)
- **Phase 3**: End-to-end integration tests (remaining edge cases)

#### Comprehensive Testing Checklist

**Before starting any new component:**
1. ✅ Create the test file first (TDD approach)
2. ✅ Set up proper mocks for external dependencies
3. ✅ Test the happy path with valid inputs
4. ✅ Test error conditions and edge cases
5. ✅ Validate TypeScript interfaces match implementations
6. ✅ Test resource cleanup (destroy methods, memory management)

**Mock Strategy Guidelines:**
```typescript
// ✅ GOOD: Comprehensive mock with all methods
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger), // Important for nested loggers
};

// ✅ GOOD: Mock reset in beforeEach
beforeEach(() => {
  jest.clearAllMocks();
  // Reset any module-level state
});
```

#### Testing Anti-Patterns to Avoid

**❌ DON'T DO THESE:**

1. **Over-mocking**: Don't mock everything - test real logic where possible
2. **Under-mocking**: Don't make real API calls in unit tests
3. **Incomplete mocks**: Missing methods cause runtime errors in tests
4. **Path alias usage**: Causes Jest module resolution failures
5. **Integration tests without proper isolation**: Tests affect each other
6. **Testing implementation details**: Test behavior, not internal structure

### Component-Specific Testing Patterns

#### Core Components (`src/core/`)
```typescript
// Pattern: Test pure functions and business logic
describe('TokenManager', () => {
  it('should calculate token usage correctly', () => {
    const manager = new TokenManager(config);
    const result = manager.calculateUsage(inputTokens, outputTokens);
    expect(result.total).toBe(expectedTotal);
  });
});
```

#### Integration Components (`src/integrations/`)
```typescript
// Pattern: Mock external APIs completely
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  })),
}));
```

#### Provider Abstractions (`src/providers/`)
```typescript
// Pattern: Test interface compliance
describe('OpenAIProvider', () => {
  it('should implement LLMProvider interface correctly', () => {
    const provider = new OpenAIProvider(config);
    
    // Test all interface methods exist
    expect(typeof provider.generateResponse).toBe('function');
    expect(typeof provider.getProviderName).toBe('function');
    expect(typeof provider.destroy).toBe('function');
  });
});
```

### Test File Organization & Naming

**📁 File Structure:**
```
tests/
├── core/                    # Mirror src/ structure
│   ├── promptEngineer.test.ts
│   ├── tokenManager.test.ts
│   └── ...
├── integrations/
│   ├── openai.test.ts
│   ├── slack.test.ts
│   └── ...
├── providers/
│   ├── llm/
│   └── channels/
├── utils/
│   ├── logger.test.ts
│   ├── config.test.ts
│   └── ...
├── infrastructure.test.ts   # System-level tests
└── setup.ts                # Jest setup and globals
```

### Running & Monitoring Tests

**🔄 Test Commands:**
```bash
npm test                    # Run all tests
npm test -- --coverage     # Run with coverage report
npm test -- --watch        # Watch mode for development
npm test filename          # Run specific test file
```

**📊 Coverage Analysis:**
- Use `npm test -- --coverage` to generate detailed coverage reports
- Check `coverage/index.html` for line-by-line coverage visualization
- Focus on files with <80% coverage first
- Prioritize high-impact, low-coverage files (entry points, core logic)

### Error Resolution Patterns

**Common Test Failures & Solutions:**

1. **Module Resolution Errors**
   ```
   Cannot find module '@utils/logger'
   ```
   **Solution**: Use relative imports: `../src/utils/logger`

2. **Mock Function Errors**
   ```
   TypeError: mockFn.child is not a function
   ```
   **Solution**: Add missing methods to mock objects

3. **Type Errors in Tests**
   ```
   Property 'destroy' does not exist on type
   ```
   **Solution**: Ensure test mocks match actual interface definitions

4. **Test Isolation Issues**
   ```
   Tests pass individually but fail when run together
   ```
   **Solution**: Add proper `beforeEach` cleanup and mock resets

### Advanced Testing Techniques

#### Testing Async/Promise-based Code
```typescript
// ✅ GOOD: Proper async testing
it('should handle async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});

// ✅ GOOD: Testing rejections
it('should handle errors properly', async () => {
  await expect(functionThatThrows()).rejects.toThrow('Expected error');
});
```

#### Testing Event-Driven Code
```typescript
// ✅ GOOD: Testing event handlers
it('should handle message events', (done) => {
  const handler = new MessageHandler();
  handler.onMessage((message) => {
    expect(message.content).toBe('test');
    done();
  });
  handler.processMessage({ content: 'test' });
});
```

#### Performance & Memory Testing
```typescript
// ✅ GOOD: Testing resource cleanup
it('should clean up resources on destroy', () => {
  const manager = new ResourceManager();
  const spy = jest.spyOn(manager, 'cleanup');
  
  manager.destroy();
  
  expect(spy).toHaveBeenCalled();
});
```

### Testing & Jest Configuration
- **JEST TESTING GOTCHA**: Jest doesn't support TypeScript path aliases (@utils, @integrations) out of the box. The `moduleNameMapping` property doesn't exist in Jest. Use relative imports (../src/utils/logger) in source files when having Jest test issues, or create a working Jest module mapping configuration. Don't get stuck iterating on this - the working pattern is relative imports like the infrastructure.test.ts file.

## Definition of Done

### Code Quality Standards
✅ **ALL tests must pass** - No exceptions for any commits to main branch
✅ **TypeScript strict mode compliance** - No `any` types, proper interfaces
✅ **ESLint clean** - Zero linting errors or warnings
✅ **Test coverage ≥ 90%** for all new core components (excluding integrations)
✅ **Documentation updated** - README, development guide, inline comments
✅ **Error handling** - Proper error boundaries and graceful degradation
✅ **Logging implemented** - Appropriate log levels for debugging and monitoring
✅ **Security validated** - No hardcoded secrets, input validation present

### Testing Requirements
✅ **Unit tests** - All functions and classes have comprehensive test coverage
✅ **Integration tests** - Component interactions tested with proper mocks
✅ **Error scenarios** - Edge cases and failure modes covered
✅ **Mock utilities** - Reusable test helpers in `tests/helpers/mockFactories.ts`
✅ **Type safety** - Tests use proper TypeScript types, no test-time type errors

### Architecture & Design Standards
✅ **DRY compliance** - No duplicate logic; use centralized utilities
✅ **Separation of concerns** - Single responsibility principle followed
✅ **Dependency injection** - Components loosely coupled via DI container
✅ **Performance optimization** - Caching implemented where appropriate
✅ **Validation centralized** - Use `ValidationEngine` for all validation logic

### Performance Standards
✅ **Response time** - API responses under 2 seconds for typical requests
✅ **Memory usage** - Proper cleanup, no memory leaks in long-running processes
✅ **Caching strategy** - Appropriate use of `CacheManager` for expensive operations
✅ **Token efficiency** - Optimized prompt engineering to minimize API costs

### Security & Safety Standards
✅ **Input validation** - All user inputs validated through `ValidationEngine`
✅ **Path traversal protection** - File operations properly sandboxed
✅ **Sensitive data handling** - No secrets logged or exposed
✅ **Rate limiting** - Proper backoff and throttling implemented
✅ **Error information** - Error messages don't leak sensitive information

### Documentation Standards
✅ **Code comments** - Complex logic explained with inline documentation
✅ **Type definitions** - All interfaces and types properly documented
✅ **API documentation** - All public methods have JSDoc comments
✅ **Architecture decisions** - Major changes documented in this guide
✅ **Usage examples** - Examples provided for complex components

### Deployment Readiness
✅ **Environment variables** - All config externalized, no hardcoded values
✅ **Graceful shutdown** - Proper cleanup of resources on process termination
✅ **Health checks** - Components report their status for monitoring
✅ **Error recovery** - System continues operating despite partial failures
✅ **Monitoring hooks** - Proper logging and metrics collection points

## Current System Status
- **Test Suite**: 23 test suites, 480+ tests passing
- **Coverage**: Core components at 90%+, integrations appropriately mocked
- **Architecture**: DRY principles implemented, separation of concerns enforced
- **Performance**: Caching and memoization optimizations in place
- **Quality**: TypeScript strict mode, comprehensive validation system

---

*This document captures practical development notes, gotchas, and patterns. For high-level architecture and project vision, see the TODO.md file.*
