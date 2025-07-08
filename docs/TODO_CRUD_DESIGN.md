# TODO CRUD System Design

## Problem Statement

Currently, TODOs are maintained as a simple markdown file which can lead to:
- Scope creep: New items added to in-progress phases
- Inconsistent formatting
- No validation of changes
- No audit trail of modifications
- Difficulty tracking who added what and when

## Proposed Solution: Deterministic TODO Management

### Core Principles
1. **Single Source of Truth**: TODO.md remains authoritative
2. **Controlled Modifications**: All changes go through validation scripts
3. **Scope Protection**: New items during active phases are flagged as scope creep
4. **Audit Trail**: All changes tracked with attribution and timestamps
5. **Validation**: Ensure consistent formatting and proper phase structure

### Script Architecture

#### 1. `scripts/todo/validate-todo.ts`
- Validates TODO.md structure and formatting
- Checks phase numbering and completion status
- Ensures progress summary matches actual completion
- Validates TODO/FIXME format within content

#### 2. `scripts/todo/add-todo-item.ts`
- Adds new TODO items to appropriate phase
- Detects scope creep (adding to in-progress phases)
- Validates item format and requirements
- Updates progress summary automatically

#### 3. `scripts/todo/mark-complete.ts`
- Marks items as complete with validation
- Updates progress summaries
- Checks for downstream completion opportunities
- Validates completion prerequisites

#### 4. `scripts/todo/audit-todo.ts`
- Tracks changes and modifications
- Generates audit reports
- Identifies scope creep patterns
- Reports on velocity and completion rates

#### 5. `scripts/todo/sync-phases.ts`
- Cross-references completed work with TODO items
- Identifies items that should be marked complete
- Suggests phase transitions
- Validates phase dependencies

### Integration Points

#### Pre-commit Hook
```bash
# Validate TODO.md before commits
npm run todo:validate
```

#### Governance Integration
```bash
# Include TODO validation in governance checks
npm run governance:check  # includes todo validation
```

#### Development Workflow
```bash
# Add new item (with scope creep detection)
npm run todo:add "New feature item" --phase=7

# Mark item complete
npm run todo:complete "Command Schema" --phase=6

# Sync completed work
npm run todo:sync

# Generate audit report
npm run todo:audit
```

### Scope Creep Detection

When adding items to phases marked as "IN PROGRESS":
1. **Warning**: Alert about potential scope creep
2. **Classification**: Categorize as enhancement vs. bug fix vs. scope change
3. **Justification**: Require reason for mid-phase addition
4. **Approval**: Flag for explicit approval before adding

### Data Structure

#### TODO Item Metadata
```typescript
interface TodoItem {
  id: string;
  phase: number;
  title: string;
  description: string;
  completed: boolean;
  addedDate: string;
  completedDate?: string;
  addedBy: string;
  scopeCreep?: {
    flag: boolean;
    justification: string;
    approvedBy?: string;
  };
}
```

#### Phase Status
```typescript
interface PhaseStatus {
  number: number;
  title: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  totalItems: number;
  completedItems: number;
  startDate?: string;
  completedDate?: string;
}
```

### Implementation Plan

#### Phase 1: Core Validation
- [ ] Create TODO validation script
- [ ] Integrate with governance system
- [ ] Add to pre-commit hooks

#### Phase 2: CRUD Operations
- [ ] Implement add/complete scripts
- [ ] Add scope creep detection
- [ ] Create sync functionality

#### Phase 3: Audit System
- [ ] Build audit trail system
- [ ] Create reporting dashboard
- [ ] Add analytics and insights

#### Phase 4: Integration
- [ ] Integrate with workflow platforms (Jira, Asana)
- [ ] Add IDE extensions for TODO management
- [ ] Create web interface for non-CLI users

This system would transform TODO management from ad-hoc editing to a controlled, auditable process that maintains project integrity while enabling necessary flexibility.
