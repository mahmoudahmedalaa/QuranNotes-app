---
name: Handover
description: Generate a comprehensive handover document for AI-to-AI session transitions
---

# Handover Skill

Generate a handover document at the end of a session to help the next AI agent pick up where you left off.

## When to Use
- End of a long session with multiple changes
- When switching between AI agents
- When context window is getting large

## Template

Create a handover document with these sections:

### 1. Session Summary
- What was the user's goal?
- What was accomplished?
- What's left to do?

### 2. Files Changed
List every file modified, created, or deleted with a one-line description of what changed.

### 3. Current State
- What works?
- What's broken?
- What's in progress?

### 4. Critical Context
Things the next agent MUST know:
- Architectural decisions made
- Tricky bugs encountered and how they were solved
- User preferences expressed during the session

### 5. Recommended Next Steps
Ordered list of what to do next, with file paths and context.

### 6. Commands to Run
```bash
# Verify everything is okay
npx tsc --noEmit
npm test -- --passWithNoTests
```

## Output Location
Save to `docs/handover_YYYY-MM-DD.md`
