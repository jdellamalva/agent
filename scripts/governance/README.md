# Code Governance System

This directory contains deterministic and semi-deterministic scripts that enforce code quality standards across the project. These scripts replace manual LLM reviews and provide consistent, scalable governance.

## 🎯 Governance Philosophy

Instead of relying on an ever-growing development guide that would eventually hit context window limits, we use automated scripts to enforce standards. The Development Guide has been transformed into a governance directory where each standard is paired with its enforcement script.

## 📋 Deterministic Checks (Fast, Always Run)

These checks provide binary pass/fail results and run quickly:

### 1. Magic Numbers Detection
**Script**: `check-magic-numbers.ts`  
**Purpose**: Ensures all hardcoded values are centralized in `src/config/constants.ts`  
**Run**: `npm run governance:magic-numbers`

**Standards Enforced**:
- No numeric literals outside of constants (except 0, 1, -1)
- No hardcoded strings outside of constants
- All configuration values use environment variable overrides

### 2. Documentation Coverage
**Script**: `check-documentation.ts`  
**Purpose**: Ensures all major components have inline documentation  
**Run**: `npm run governance:docs`

**Standards Enforced**:
- All classes must have JSDoc comments
- All public methods must have JSDoc comments
- All interfaces must have descriptions
- Complex logic must have inline comments

### 3. Naming Conventions
**Script**: `check-naming-conventions.ts`  
**Purpose**: Enforces consistent naming across the codebase  
**Run**: `npm run governance:naming`

**Standards Enforced**:
- PascalCase for classes, interfaces, types, enums
- camelCase for functions, variables, properties
- SCREAMING_SNAKE_CASE for constants
- kebab-case for file names
- No single letter variables (except loop counters)

### 4. Import/Export Standards
**Script**: `check-import-export.ts`  
**Purpose**: Maintains clean module structure  
**Run**: `npm run governance:imports`

**Standards Enforced**:
- No default exports (use named exports)
- Consistent import grouping (external → internal → relative)
- No circular dependencies
- Proper barrel exports in index.ts files
- No unused imports

### 5. TODO/FIXME Standards
**Script**: `check-todo-standards.ts`  
**Purpose**: Ensures actionable and trackable todos  
**Run**: `npm run governance:todos`

**Standards Enforced**:
- Format: `TODO(owner): description [deadline]`
- Format: `FIXME(owner): description [severity]`
- No orphaned TODOs without context
- Deadline tracking for overdue items

## 🤖 LLM-Assisted Checks (Slower, Optional)

These checks use AI to evaluate subjective code quality:

### 1. DRY Principle Analysis
**Script**: `analyze-dry.ts`  
**Purpose**: Detects code duplication and DRY violations  
**Run**: `npm run governance:dry`

**Standards Evaluated**:
- Duplicate logic detection
- Reusable component identification
- Configuration centralization
- Pattern consistency

### 2. Code Complexity Analysis
**Script**: `analyze-complexity.ts`  
**Purpose**: Identifies overly complex functions  
**Run**: `npm run governance:complexity`

**Standards Evaluated**:
- Cyclomatic complexity
- Function length and parameter count
- Nesting depth
- Single Responsibility Principle adherence

## 🎮 Running Governance Checks

### Individual Checks
```bash
npm run governance:magic-numbers    # Check for hardcoded values
npm run governance:docs            # Check documentation coverage
npm run governance:naming          # Check naming conventions
npm run governance:imports         # Check import/export standards
npm run governance:todos           # Check TODO/FIXME standards
npm run governance:dry             # Analyze DRY violations (requires OpenAI API key)
npm run governance:complexity      # Analyze code complexity (optional)
```

### Comprehensive Runs
```bash
npm run governance:check           # Run all checks
npm run governance:deterministic   # Run only deterministic checks
npm run governance:llm            # Run only LLM-assisted checks
npm run governance:report         # Generate detailed report
```

## 📊 Governance Dashboard

Run `npm run governance:check` to get a comprehensive dashboard showing:
- ✅ All passing checks
- ❌ Failed checks with specific violations
- ⚠️ Warnings that should be addressed
- 📈 Trend analysis over time
- 🎯 Overall code health score

## 🔧 Integration Points

### Pre-commit Hooks
Add to `.husky/pre-commit`:
```bash
npm run governance:deterministic
```

### CI/CD Pipeline
Add to your workflow:
```yaml
- name: Code Governance
  run: |
    npm run governance:deterministic
    if [ -n "$OPENAI_API_KEY" ]; then
      npm run governance:llm
    fi
```

### VS Code Integration
Add to `.vscode/tasks.json`:
```json
{
  "label": "Governance Check",
  "type": "shell",
  "command": "npm run governance:check",
  "group": "test"
}
```

## 🚀 Extending the System

### Adding New Deterministic Checks
1. Create script in `scripts/governance/check-<name>.ts`
2. Export a class with a `check(): Promise<boolean>` method
3. Add to `governance-runner.ts` deterministic checks array
4. Add npm script in `package.json`
5. Document in this README

### Adding New LLM-Assisted Checks
1. Create script in `scripts/governance/analyze-<name>.ts`
2. Export a class with an `analyze(): Promise<boolean>` method
3. Add to `governance-runner.ts` LLM checks array
4. Add npm script in `package.json`
5. Document in this README

### Future Enhancements
- **Performance tracking**: Benchmark governance check execution times
- **Historical analysis**: Track governance metrics over git history
- **Custom rules**: Allow project-specific governance rules via config
- **IDE integration**: Real-time governance feedback in editors
- **Team metrics**: Aggregate governance scores across team members

## 📈 Governance Metrics

The system tracks these key metrics:
- **Standards Compliance**: % of code following each standard
- **Technical Debt**: Number and severity of violations
- **Code Health**: Overall maintainability score
- **Trend Analysis**: Improvement/regression over time
- **Team Performance**: Individual and team governance scores

## 🎯 Benefits

1. **Scalability**: Handles growing codebases without manual review bottlenecks
2. **Consistency**: Enforces standards uniformly across all code
3. **Speed**: Fast feedback during development
4. **Objectivity**: Removes subjective bias from code reviews
5. **Education**: Teaches team members best practices through automated feedback
6. **Integration**: Works with existing tools and workflows

This governance system transforms code quality from a manual, subjective process into an automated, objective, and scalable practice.

## Integration Points

- Pre-commit hooks prevent non-compliant commits
- CI/CD pipeline fails on governance violations
- VS Code extensions provide real-time feedback
- Development Guide becomes index of governance rules
