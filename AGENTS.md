# IPCManagement — agent entry

Read this file and [current task](.planning/WORK.md) at intake. Load only the owner relevant to the task; the [documentation router](docs/README.md) is optional navigation, not a full-doc preload requirement.

## Authority

User authorization and security/data safety → current source, behavior tests and machine contracts → canonical documentation → outcome roadmap → current WORK → supporting/generated material. A stale plan, specimen or previous permission never authorizes execution. Surface contradictory rules; do not silently choose business policy.

## Hard safety

- No reset/restore of working code, commit/push/deploy, package installation, auth/mode switch or schema/data mutation without explicit current scope and authorization.
- Never assume a database is disposable. Before DB work load [OPERATIONS](docs/OPERATIONS.md), immutable lineage and the matching mode contract.
- `DEFAULT != MATERIAL_RECONCILIATION`: shared master data/physical stock do not make their records, lineage or commands interchangeable.
- Do not publish credentials, private `.docs/` inputs, workbook rows, authenticated profiles, business/recovery bundles or keys. Fixture use is not publication consent.
- No seeds, fabricated business evidence, lowered permissions or weakened tests to manufacture PASS. Synthetic fixture creation requires its own authorized scope.
- Pi is the runtime. Other CLI runtimes, auto-installation/indexing and subagents require explicit user/project authorization. Skills do not own permissions or task state.
- Protect user-owned processes, browser tabs and profiles. Browser checks use separate headed Chrome, actual URL/build/mode/actor and confirmed credential source.

## Intake and inherited work

Run `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`. Distinguish new work from an explicit resume. Preserve inherited dirt and untracked files; back up dirty owners outside the repository, check for intervening edits before replacement, and never reset them to simplify a task. For local documentation audits inventory ignored/hidden files too; exclude `.git` and do not traverse junctions/symlinks blindly.

## Task routing

| Read when | Load | Then inspect |
|---|---|---|
| Business/data/status/lifecycle | [DOMAIN](docs/DOMAIN.md) | Relevant bounded contract and feature/model/behavior tests |
| Weekly menus, servings, BOM/planning | [Weekly menu](docs/domain/weekly-menu.md) | Planning/Coordination/Catalog owners |
| Stock, warehouse or kitchen logistics | [Warehouse](docs/domain/warehouse-contract.md) | Inventory/warehouse/chef owners |
| Material reconciliation | [MRX](docs/domain/material-reconciliation.md) | MRX daily lineage, commands and mode guards |
| Modules, data flow, compatibility | [ARCHITECTURE](docs/ARCHITECTURE.md) | Source, generated API and machine contracts |
| Setup/config/build/test/generated API | [ENGINEERING](docs/ENGINEERING.md) | Manifests, CI and relevant scripts/tests |
| UI/interaction/accessibility | [DESIGN](docs/DESIGN.md) | Domain rules, actual primitives and rendered behavior |
| Deploy/health/DB/recovery/performance operations | [OPERATIONS](docs/OPERATIONS.md) | Exact script guards, target and operator approval |
| Desired outcomes | [ROADMAP](ROADMAP.md) | Not execution history or task authorization |
| Current goal/checklist/status/next action | [WORK](.planning/WORK.md) | Only the current task |

## Lifecycle

`IDLE → INTAKE → PLAN → EXECUTE → VERIFY → CLOSE → IDLE`

1. **INTAKE:** capture request, HEAD/index/inherited changes and missing authority.
2. **PLAN:** name source/contract owners, allowed files, exclusions, acceptance commands and remaining owner decisions in WORK. One concept has one owner.
3. **EXECUTE:** surgical changes at existing owners; update relevant docs. Parent integrates authorized ephemeral read-only/writer work; one writer per cwd/worktree. Subagents do not create persistent state owners.
4. **VERIFY:** focused behavior checks first, then necessary builds/lint/contracts. Inspect diff, references and added secrets. Persisted outcomes require control → request → state transition → reload. Performance needs measured metrics and declared environment. Tool completion, screenshots or scoped tests do not certify the entire product.
5. **CLOSE:** report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per scoped claim. Update roadmap only if an outcome changed. Return WORK to IDLE, remove completed checklist/logs/consumed authorizations; at most a brief last-closed result. New work needs fresh intake.

WORK is the only task state owner. Git history is the archive; do not create MEMORY/STATE/HANDOVER/CHECKPOINT systems, audit-report trees or vendor-specific duplicate instructions. Separate authorization is still required for publication, commit/push, deployment and DB operations.
