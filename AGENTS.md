# IPCManagement — agent entry

Read this file and [current task](.planning/WORK.md) at intake. Load only the owner relevant to the task; the [documentation router](docs/README.md) is optional navigation, not a full-doc preload requirement.

Candidate development techniques live in [.pi/skills](.pi/skills/) through Pi's native discovery. Metadata discovery is not approval or body activation; apply the provisional gates below.

## Provisional skill gates

All five candidates are **PROVISIONAL / NEEDS_MORE_EVIDENCE / NOT DEFAULT CONTEXT**; none is approved or mandatory. Default: **ZERO candidate skill bodies**. Baseline is `AGENTS → relevant canonical doc → source/tests`; complete initial baseline analysis before considering a skill. A keyword match or advice repeating authorization, git intake, scope/lifecycle, canonical ownership, generic verification or commit/push restrictions is not an activation reason; require an applicable specialized technique.

| Candidate | Root objective required for a shadow review |
|---|---|
| `ipc-debugging` | Bug/root-cause investigation, only when baseline investigation is insufficient |
| `ipc-code-review` | Review/audit a diff, commit, PR or change set |
| `ipc-codebase-design` | Architecture, module boundaries, abstraction or refactor design |
| `ipc-ui-review` | UI/design/accessibility/interaction review |
| `ipc-architecture-visualization` | User requests a diagram, or visualization materially helps explain architecture/data flow |

After initial analysis, when a candidate is clearly applicable, parent requests exactly one read-only shadow reviewer; this gate authorizes only that bounded delegation, not implementation or further delegation. Give the reviewer the baseline analysis/evidence and one candidate body. No other candidate loads, scope expansion, repository/WORK writes or new execution authority. Parent validates and chooses whether to integrate any finding; the baseline remains the product workflow.

Reviewer returns only a source/ground-truth-backed delta: `MATERIAL_FINDING`, `MATERIAL_CORRECTION`, `MATERIAL_VERIFICATION_GAIN`, `NO_MATERIAL_DELTA` or `NOISE`; do not repeat baseline advice. In session output record only `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`. No task-history/counters in WORK and no new report/history framework; aggregation may stay outside the repository if needed.

Never automatically combine candidates. Choose the one nearest the root objective. A second sequential review requires the first to leave an independent unresolved question and the parent to explain why a distinct second capability is necessary; do not load two together by default.

Reevaluate a candidate only after at least **5 applicable real tasks**, at least **3 with evaluable ground truth**, and both positive and negative activation opportunities; nonapplicable opportunities do not count toward the five. No additional synthetic benchmarks or skill rewrite/delete/merge without new evidence.

- **KEEP:** repeated correct material delta, no increased scope/safety errors, and capability not trivially obtainable from AGENTS/docs. **SHRINK:** useful specialized core but substantial generic/repeated instructions.
- **MERGE:** two candidates repeatedly deliver the same specialized delta. **DELETE:** sufficient evidence still shows no material improvement, or repeated noise/wrong scope. Otherwise **NEEDS_MORE_EVIDENCE**.

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
| Actor/screen/API/data handoffs across modules | [FLOWS](docs/FLOWS.md) | Current routes, permissions, source IDs and bounded business owners |
| Modules, transport/trust boundaries, compatibility | [ARCHITECTURE](docs/ARCHITECTURE.md) | Source, generated API and machine contracts |
| Delivery/intake/setup/config/risk-based verification | [ENGINEERING](docs/ENGINEERING.md) | Manifests, CI and relevant scripts/tests |
| UI/interaction/accessibility | [DESIGN](docs/DESIGN.md) | Domain rules, actual primitives and rendered behavior |
| Deploy/health/DB/recovery/performance operations | [OPERATIONS](docs/OPERATIONS.md) | Exact script guards, target and operator approval |
| Desired outcomes | [ROADMAP](ROADMAP.md) | Not execution history or task authorization |
| Human-readable released history | [CHANGELOG](CHANGELOG.md) | Confirmed releases; policy in ENGINEERING, not audit/task logs |
| Current goal/checklist/status/next action | [WORK](.planning/WORK.md) | Only the current task |

## Lifecycle

`IDLE → INTAKE → PLAN → EXECUTE → VERIFY → CLOSE → IDLE`

This is task state; the product delivery loop and its scoped gates live in [ENGINEERING](docs/ENGINEERING.md#delivery-workflow). Technical truth is source/tests/contracts; stable truth canonical docs; future outcomes ROADMAP; current task WORK; released history CHANGELOG; detailed history Git.

1. **INTAKE:** capture request, HEAD/index/inherited changes and missing authority.
2. **PLAN:** name source/contract owners, allowed files, exclusions, acceptance commands and remaining owner decisions in WORK. One concept has one owner.
3. **EXECUTE:** surgical changes at existing owners; update relevant docs. Parent integrates authorized ephemeral read-only/writer work; one writer per cwd/worktree. Subagents do not create persistent state owners.
4. **VERIFY:** focused behavior checks first, then necessary builds/lint/contracts. Inspect diff, references and added secrets. Persisted outcomes require control → request → state transition → reload. Performance needs measured metrics and declared environment. Tool completion, screenshots or scoped tests do not certify the entire product.
5. **CLOSE:** report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per scoped claim. Update roadmap only if an outcome changed. Return WORK to IDLE, remove completed checklist/logs/consumed authorizations; at most a brief last-closed result. New work needs fresh intake.

WORK is the only task state owner. Git history is the archive; do not create MEMORY/STATE/HANDOVER/CHECKPOINT systems, audit-report trees or vendor-specific duplicate instructions. Separate authorization is still required for publication, commit/push, deployment and DB operations.

## Pi workflow reference (read-only mirror)

The agent entry in this repository is set up to follow the same workflow chain
that Pi CLI users see when `using-superpowers` is active. This is an instruction
mirror, not a runtime bridge. Cursor does not call Pi; Cursor applies the same
intent ordering against the same canonical owners.

### Intent ordering (mirror of superpowers)

When the user request is open-ended or workflow-shaped, follow this sequence
instead of improvising:

1. **Intake** — read [WORK](.planning/WORK.md) and the relevant canonical doc
   per the [task routing](#task-routing) table. Do not preload full docs.
2. **Plan** — name source/contract owners, allowed files, exclusions,
   acceptance commands, and remaining owner decisions in WORK. One concept,
   one owner.
3. **Execute** — surgical changes at the named owner. Update the relevant doc.
4. **Verify** — focused behavior checks first, then necessary builds, lint,
   and contract regeneration. Inspect diff, references, and added secrets.
5. **Close** — report PASS/FAIL/NEEDS_EVIDENCE/BLOCKED per scoped claim.
   Return WORK to IDLE.

This is the same ordering encoded in
`~/.pi/agent/git/github.com/obra/superpowers/skills/` (brainstorming →
writing-plans → executing-plans → verification-before-completion) that Pi
users get through `using-superpowers`. The skill bodies are NOT loaded by
default. They are reference only; opening them without parent authorization
is the same gate violation as loading an `ipc-*` candidate.

### Reference paths (read-only, optional)

- `~/.pi/agent/git/github.com/obra/superpowers/skills/<name>/SKILL.md` —
  intent shape for brainstorming, writing-plans, executing-plans,
  verification-before-completion, systematic-debugging, test-driven-development,
  receiving-code-review, requesting-code-review, subagent-driven-development,
  dispatching-parallel-agents, using-git-worktrees,
  finishing-a-development-branch, diagnosing-superpowers, writing-skills,
  using-superpowers.
- `.pi/skills/ipc-*` — five PROVISIONAL repository-local candidates. Default =
  0 body loaded. Provisional gate in Provisional skill gates applies unchanged.

### Hard rules (unchanged)

- Cursor does not spawn Pi. Cursor does not register a Pi bridge. Cursor does
  not write `~/.pi/agent/mcp.json`, `.mcp.json`, `.pi/mcp.json`, or any
  cross-runtime adapter file. Any of these is a hard-safety breach and
  requires explicit current scope and authorization.
- Pi user-level state (settings, agents, models, auth) is read-only reference.
  Editing Pi user-level config is out of scope and requires parent ack.
- The five `ipc-*` candidates remain PROVISIONAL. They do not activate by
  file presence, name match, or `~/.pi/skills/` location.
