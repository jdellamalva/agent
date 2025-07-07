# LLM Agent Development Notes

## Development Guidelines & Gotchas

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
