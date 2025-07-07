# LLM Agent Development Notes

## Development Guidelines & Gotchas

### Core Technology Stack
- **Use TypeScript** for better type safety and development experience
- **Implement comprehensive logging from day one** - debugging distributed systems is hard
- **Multi-project isolation is critical** - one project's issues shouldn't affect others
- **Version control everything** - all agent modifications should be tracked
- **Sandbox dangerous operations** - especially when working with unknown codebases

### Testing & Jest Configuration
- **JEST TESTING GOTCHA**: Jest doesn't support TypeScript path aliases (@utils, @integrations) out of the box. The `moduleNameMapping` property doesn't exist in Jest. Use relative imports (../src/utils/logger) in source files when having Jest test issues, or create a working Jest module mapping configuration. Don't get stuck iterating on this - the working pattern is relative imports like the infrastructure.test.ts file.

### Development Patterns
- **Provider Abstraction**: Always code against interfaces, not concrete implementations
- **Error Handling**: Wrap all external API calls with proper error handling and retry logic
- **Configuration Management**: Use environment variables for all sensitive data
- **Resource Management**: Always clean up resources (timers, connections, etc.) in destroy methods

### Security Considerations
- **API Key Management**: Never commit API keys to version control
- **Input Validation**: Validate all user inputs and LLM outputs before execution
- **Sandboxing**: Isolate dangerous operations in separate processes when possible
- **Audit Trail**: Log all significant operations for debugging and security analysis

### Performance Notes
- **Rate Limiting**: Implement rate limiting for all external API calls
- **Token Management**: Track token usage to avoid unexpected costs
- **Memory Management**: Monitor memory usage in long-running processes
- **Caching**: Cache expensive operations where appropriate

### Common Pitfalls
- **Path Aliases**: Use relative imports for Jest compatibility
- **Async/Await**: Always handle promise rejections properly
- **Environment Variables**: Check for missing environment variables at startup
- **Provider Switching**: Test with multiple providers to ensure abstraction works

### Architecture Patterns
- **Dependency Injection**: Use constructor injection for better testability
- **Factory Pattern**: Use factories for creating provider instances
- **Observer Pattern**: Use events for loose coupling between components
- **Strategy Pattern**: Use strategy pattern for pluggable algorithms

---

*This document captures practical development notes, gotchas, and patterns. For high-level architecture and project vision, see the TODO.md file.*
