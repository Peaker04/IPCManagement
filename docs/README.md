# Documentation router

Load the owner for the task, then its source/tests. [AGENTS](../AGENTS.md) owns safety/task routing; [ENGINEERING](ENGINEERING.md#delivery-workflow) owns delivery/intake/verification gates; [ROADMAP](../ROADMAP.md) owns future outcomes; [WORK](../.planning/WORK.md) owns the current task only; [CHANGELOG](../CHANGELOG.md) owns released history; Git owns detailed history.

| Owner | Read when | Owns | Does not own |
|---|---|---|---|
| [DOMAIN](DOMAIN.md) | Business/data/lifecycle changes | Shared language, roles, status, identity/grain and lifecycle invariants | UI mechanics, deployment, bounded-mode detail |
| [Weekly menu](domain/weekly-menu.md) | Menus, servings, BOM/planning | Planning arithmetic, source readiness and bounded preview contracts | Warehouse stock authority or MRX transactions |
| [Warehouse](domain/warehouse-contract.md) | Stock/kitchen logistics | Operational shortcuts, source-document matching and queue semantics | MRX frozen-line lifecycle |
| [MRX](domain/material-reconciliation.md) | MATERIAL_RECONCILIATION | Frozen daily lineage, issue/disposition/completion and mode roles | DEFAULT purchasing/demand |
| [FLOWS](FLOWS.md) | Actor/screen/API/data handoffs across modules | Source-backed cross-system paths, flow acceptance boundaries and missing connectors | DOMAIN rules, presentation or network/deployment authority |
| [ARCHITECTURE](ARCHITECTURE.md) | Module/transport/trust/compatibility changes | As-built boundaries, transport/persistence owners and compatibility | Business-flow rule ownership, setup or deployment recipes |
| [ENGINEERING](ENGINEERING.md) | Delivery/intake/setup/config/build/test/API generation | Scoped delivery gates, risk-based verification, conventions, configuration and fixture privacy | Business transitions or operational authorization |
| [DESIGN](DESIGN.md) | UI/accessibility changes | Presentation grammar, stable rule IDs and unresolved design policy | Inventing business actions, source facts or cutover permission |
| [OPERATIONS](OPERATIONS.md) | Deploy/health/DB/recovery/performance | Current/target release, runtime signals, rollback and recovery safety | Current task state or implicit mutation authority |
| [ROADMAP](../ROADMAP.md) | Desired outcomes/acceptance boundaries | Owner-approved future or evidenced achieved outcomes | Bug/refactor/validator/task progress |
| [CHANGELOG](../CHANGELOG.md) | Released user/operational/security changes | Human-readable release history under ENGINEERING policy | Audits, documentation cleanup, task logs or guessed releases |

Machine owners remain [table metadata](table-contracts.json), generated API, manifests/CI and immutable migration lineage. Supporting-only exceptions: [diagram guide](diagrams/README.md) for export/font provenance; [performance tools](../tools/perf/RUNBOOK.md) for the executable-reader runbook contract. Private inputs/fixture disposition: [ENGINEERING](ENGINEERING.md#private-inputs-and-fixtures). Extra files are not competing canonical owners.
