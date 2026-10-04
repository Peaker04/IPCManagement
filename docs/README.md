# Documentation router

Load the owner for the task, then its source/tests. [AGENTS](../AGENTS.md) owns safety/workflow; [ROADMAP](../ROADMAP.md) owns outcomes; [WORK](../.planning/WORK.md) owns the current task only.

| Owner | Read when | Owns | Does not own |
|---|---|---|---|
| [DOMAIN](DOMAIN.md) | Business/data/lifecycle changes | Shared language, roles, status, identity/grain and lifecycle invariants | UI mechanics, deployment, bounded-mode detail |
| [Weekly menu](domain/weekly-menu.md) | Menus, servings, BOM/planning | Planning arithmetic, source readiness and bounded preview contracts | Warehouse stock authority or MRX transactions |
| [Warehouse](domain/warehouse-contract.md) | Stock/kitchen logistics | Operational shortcuts, source-document matching and queue semantics | MRX frozen-line lifecycle |
| [MRX](domain/material-reconciliation.md) | MATERIAL_RECONCILIATION | Frozen daily lineage, issue/disposition/completion and mode roles | DEFAULT purchasing/demand |
| [ARCHITECTURE](ARCHITECTURE.md) | Module/data-flow/compatibility changes | As-built boundaries, transport/persistence owners and compatibility | Setup, desired design or deployment recipes |
| [ENGINEERING](ENGINEERING.md) | Setup/config/build/test/API generation | Development conventions, configuration, verification and fixture privacy | Business transitions or operational authorization |
| [DESIGN](DESIGN.md) | UI/accessibility changes | Presentation grammar, stable rule IDs and unresolved design policy | Inventing business actions, source facts or cutover permission |
| [OPERATIONS](OPERATIONS.md) | Deploy/health/DB/recovery/performance | Target checks, release/rollback and recovery safety | Current task state or implicit mutation authority |

Machine owners remain [table metadata](table-contracts.json), generated API, manifests/CI and immutable migration lineage. Supporting-only exceptions: [diagram guide](diagrams/README.md) for export/font provenance; [performance tools](../tools/perf/RUNBOOK.md) for the executable-reader runbook contract. Private inputs/fixture disposition: [ENGINEERING](ENGINEERING.md#private-inputs-and-fixtures). Extra files are not competing canonical owners.
