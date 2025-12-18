# AI Session Startup Algorithm

## Purpose
This document defines the **exact step-by-step algorithm** that AI assistants MUST follow when starting a new session.

---

## 🚀 Startup Sequence (Execute in Order)

### Phase 1: Load Context Files

**Step 1.1: Read Performance Optimization Workflow**
```
File: c:\_PL-tests\.agent\workflows\performance-optimization.md
Action: Read entire file to understand current AI rules
```

**Step 1.2: Read Project Context**
```
File: c:\_PL-tests\Tasks\APPLICATION_CONTEXT.md
Action: Load main project context, architecture, tech stack, rules
Status: REQUIRED (fail if missing)
```

**Step 1.3: Read Implementation Plan**
```
File: c:\_PL-tests\Tasks\implementation_plan.md
Action: Load current plan, phases, progress status
Status: OPTIONAL (note if missing)
```

**Step 1.4: Read Current Task**
```
File: c:\_PL-tests\Tasks\task.md
Action: Load active task checklist and main objective
Status: OPTIONAL (note if missing)
```

---

### Phase 2: Parse and Understand

**Step 2.1: Extract Current State**
- Current phase/step from `implementation_plan.md`
- Main objective from `task.md`
- Last completed tasks (marked with `[x]`)
- In-progress tasks (marked with `[/]`)

**Step 2.2: Identify Next Actions**
- Uncompleted tasks from `task.md` (marked with `[ ]`)
- Current phase requirements from `implementation_plan.md`
- Blockers or dependencies

**Step 2.3: Check for Inconsistencies**
- Does CODE match CONTEXT?
- Are completed tasks actually done?
- Is plan outdated (completed steps not marked)?

---

### Phase 3: Report to User

**Step 3.1: Context Load Confirmation**
```markdown
✅ Контекст загружен:
- APPLICATION_CONTEXT.md прочитан
- implementation_plan.md прочитан [or: не найден]
- task.md прочитан [or: не найден]
```

**Step 3.2: Current State Summary**
```markdown
📋 Текущая задача: [Main Objective from task.md]

✅ Выполнено:
- [list of [x] items from task.md]

🔄 В процессе:
- [list of [/] items from task.md]
```

**Step 3.3: Proposed Next Steps**
```markdown
🎯 Предлагаю следующие шаги:
1. [First uncompleted task from plan/task.md]
2. [Second uncompleted task]
3. [Third uncompleted task]

[or if user gave specific command:]
Ваш запрос: [user command]
Согласуется с планом: [yes/no, explanation]
```

**Step 3.4: Flag Inconsistencies (if any)**
```markdown
⚠️ Обнаружены расхождения:
- [description of inconsistency]
- Предлагаю обновить [file] для синхронизации
```

---

### Phase 4: User Command Handling

**Step 4.1: If User Gives Specific Command**
- Map command to existing plan/task
- Identify if it aligns with current phase
- Suggest plan/task updates if needed

**Step 4.2: If User Asks "What's next?"**
- Provide next steps from plan/task
- Explain current status and progress

**Step 4.3: If User Requests New Feature**
- Check against current plan
- Propose creating/updating `implementation_plan.md`
- Get approval before major divergence

---

## 🔧 Context7 Auto-Trigger Rules

Use Context7 MCP tools automatically when:

### Trigger 1: Code Generation Request
```
User says: "create component", "add feature", "implement X"
AND involves: React, Express, TypeORM, PostgreSQL, or other libraries
→ Call mcp0_resolve-library-id → mcp0_get-library-docs
```

### Trigger 2: Setup/Configuration
```
User says: "setup", "configure", "install", "initialize"
AND mentions: library name, framework, tool
→ Call mcp0_resolve-library-id → mcp0_get-library-docs
```

### Trigger 3: Unfamiliar Import
```
AI encounters: import statement from library not in recent context
AND needs to: generate/modify code using that library
→ Call mcp0_resolve-library-id → mcp0_get-library-docs
```

### Trigger 4: API/Documentation Question
```
User asks: "how to use X", "X API", "X documentation"
→ Call mcp0_resolve-library-id → mcp0_get-library-docs
```

---

## 📝 Documentation Update Rules

### When to Update APPLICATION_CONTEXT.md

**Trigger:** Significant change to:
- Tech stack (add/remove library, framework, ORM)
- Architecture (new layer, pattern, service)
- Database schema (new tables, major migrations)
- Auth/RBAC system
- Central/Driver mode behavior
- Project roadmap/priorities

**Action:**
1. Update relevant section (NOT full rewrite)
2. Add entry to "История важных изменений" with date (YYYY-MM-DD)
3. Keep concise and structured

### When to Update implementation_plan.md

**Trigger:**
- Phase/step completed (mark with ✅)
- New issue discovered during implementation
- Approach changed (update "Proposed Changes")
- Verification results added

**Action:**
1. Mark completed items: `- [x]` or prefix with ✅
2. Add new steps if needed
3. Update status/notes for in-progress items
4. Keep structure (Phase 1/2/3, Problems, Solutions)

### When to Update task.md

**Trigger:**
- Starting work on task: `[ ]` → `[/]`
- Completing task: `[/]` → `[x]`
- Main objective changes
- New blockers/dependencies discovered

**Action:**
1. Update task status symbols
2. Keep "Main Objective" current
3. Add new tasks if scope expands
4. Archive/remove completed items when appropriate

---

## ⚠️ Common Pitfalls to Avoid

1. ❌ **Skipping context load** — Always read files first
2. ❌ **Not reporting status** — User must know what was loaded
3. ❌ **Forgetting Context7** — Use proactively for code generation
4. ❌ **Full file rewrites** — Update incrementally
5. ❌ **Ignoring inconsistencies** — Flag and propose fixes
6. ❌ **Diverging from plan** — Discuss updates before major changes

---

## ✅ Success Criteria

A successful session startup includes:

- ✅ All context files read and parsed
- ✅ Status reported to user clearly
- ✅ Current state and next steps identified
- ✅ Inconsistencies flagged (if any)
- ✅ User command mapped to plan/task
- ✅ Context7 ready for auto-use when needed

---

**Version:** 1.0  
**Last Updated:** 2025-11-30
