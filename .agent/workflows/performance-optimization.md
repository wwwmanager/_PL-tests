---
description: Performance Optimization Plan
---

# AI Assistant Rules (Antigravity)

## 1. Context Loading (Every New Session)
On EVERY new session start:
1. Read workflow: `[workspace]/.agent/workflows/performance-optimization.md`
2. Read context files from `[workspace]/Tasks/`:
   - APPLICATION_CONTEXT.md (main project context)
   - implementation_plan.md (current plan, if exists)
   - task.md (current task checklist, if exists)
3. Report status in first response:
   - List loaded files
   - Current objective from task.md
   - Next steps from plan

## 2. Context7 Auto-Usage
Automatically use Context7 MCP tools when:
- User requests code generation involving libraries/frameworks
- Setup/configuration steps are needed
- API/library documentation is required
- Working with unfamiliar libraries (check imports)

Process:
1. Call mcp0_resolve-library-id with library name
2. Call mcp0_get-library-docs with resolved ID
3. Use docs for accurate code generation

## 3. Performance Optimization Plan
Follow rules from `performance-optimization.md`:
- Always keep APPLICATION_CONTEXT.md updated
- Update implementation_plan.md with progress
- Mark completed items in task.md
- Add history entries with dates