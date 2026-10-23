# IPCManagement — AI Agent Instruction & Governance Router

This repository is governed by the mandatory rules defined in [AGENTS.md](AGENTS.md) and [.planning/WORK.md](.planning/WORK.md). All AI agents (Pi, Claude Code, Cursor, Gemini) MUST strictly comply with these rules.

## 1. Hard Safety Invariants

- **No Destructive Operations**: No `git reset`, `git restore`, `git clean`, forced push, unauthorized deploy, package installation, or DB schema/data mutation without explicit scope and user authorization.
- **Operational Mode Isolation (`DOM-MODE-1`)**: `DEFAULT != MATERIAL_RECONCILIATION`. Shared master data and physical stock never merge workflows, commands, queries, lineages, or audit logs.
- **No Synthetic Evidence**: No fabricated business evidence, mock seeds in production paths, lowered permissions, or weakened tests to manufacture PASS. Rule TA-1 through TA-5 strictly enforced.
- **Single Styling Authority**: Zero ad-hoc colors, inline styles, or external CSS tokens outside `frontend/src/styles/index.css`.
- **UI Kit Authority**: Use only the 3-Zone Flat Workbench (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `SplitView`, `StateBoundary`) and 10 UI Primitives in `frontend/src/components/ui/`. Zero AI-slop (no box-in-box, no 120px KPI cards).

## 2. Mandatory Lifecycle & Phase Gates

Lifecycle loop: `INTAKE → PLAN → EXECUTE → VERIFY → CLOSE → IDLE`.

1. **INTAKE**:
   - Check workspace: `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`.
   - Read `.planning/WORK.md`. Identify exact `FR-*`, `BR-*`, `NFR-*` codes.
2. **PLAN**:
   - Architecture/Module Refactor: Load `.pi/skills/ipc-codebase-design/SKILL.md`.
   - Bug/Root-cause: Load `.pi/skills/ipc-debugging/SKILL.md`.
   - UI/Frontend Work: MUST output **Scoped Pre-Code UI Gate Block** before modifying `.tsx`/`.css`:
     ```markdown
     ### Scoped Pre-Code UI Gate Block
     - Route: [/route-path]
     - Single Primary Work Object: [OperationalFrame | SplitWorkbench]
     - Server Mode: [DEFAULT | MATERIAL_RECONCILIATION] (DOM-MODE-1)
     - RBAC Guards: [RoleGuard | ActionGuard | ActionAvailability with token permission]
     - 6 UI States: [loading | empty | error | permission-denied | partial | write-reconciliation]
     - Primitives & Composites: [components/ui/*, components/workbench/*]
     - Compliance Pledges: D6 (>=12px), D7 (1 primary), T7 (frozen header/col), T8 (compact density 36-40px), M1.2 (1 blocking modal), N6 (nested sidebar v2)
     ```
3. **EXECUTE**:
   - Surgical changes at existing owners. 1 writer per cwd/worktree.
   - Zero token creation outside `index.css`. Zero duplicate primitives.
4. **VERIFY**:
   - Test Audit: Follow `.pi/skills/ipc-test-audit/SKILL.md` (Rules TA-1 to TA-5).
   - UI Review: Follow `.pi/skills/ipc-ui-review/SKILL.md`.
   - Code Review: Follow `.pi/skills/ipc-code-review/SKILL.md`.
   - Run verification commands: `npm run verify` or focused tests.
5. **CLOSE**:
   - Report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per scope item.
   - Update `.planning/WORK.md` and `docs/handoff/HANDOFF.md`, return to `IDLE`.

## 3. 12 Backend Features <-> 14 Frontend Routes Routing

Refer to [AGENTS.md](AGENTS.md) Section 4 for the complete mapping table (`FR-AUTH` through `FR-SYS`).
NFRs and BRs are canonical in [docs/DOMAIN.md](docs/DOMAIN.md).
Presentation grammar and rule IDs are canonical in [docs/DESIGN.md](docs/DESIGN.md).
Component catalog is canonical in [docs/UI-KIT.md](docs/UI-KIT.md).
