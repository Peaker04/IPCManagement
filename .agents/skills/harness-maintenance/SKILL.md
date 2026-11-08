---
name: harness-maintenance
description: Maintain IPCManagement AI Agent harness docs, memory, shared skills, and the Pi CLI adapter. Use only for harness tasks.
license: MIT
---
# Harness maintenance

1. Read `AGENTS.md`, `MEMORY.md`, `docs/harness/README.md`, `docs/harness/GOVERNANCE.md` and the active GSD checklist.
2. Compare cwd, branch, HEAD, index and dirty scope. Preserve inherited changes; create a scoped backup before modifying a dirty owner.
3. Identify the single canonical owner. Read the full source and all live consumers before move, archive or deletion.
4. Keep GSD as the only task-state owner. Do not create a second task database, auto-commit, install/update packages, change user-global config or expand permissions.
5. Make the smallest approved change. Shared knowledge belongs in canonical docs; `MEMORY.md` keeps current pointers only; compatibility files contain links, not copied rules.
6. Run from repository root:

```bash
python tools/check_agent_harness.py
python tools/check_agent_harness.py --self-test
git diff --check -- <task-owned paths from the active checklist and migration map>
```

7. Record command/exit/result, evidence limits, blockers and exact next step in the active GSD checklist. Missing runtime capability is `BLOCKED`/`NEEDS_EVIDENCE`, never permission to switch tools or fabricate evidence.

Relative file references above are repository paths. The skill grants no authority beyond the user-approved task scope.
