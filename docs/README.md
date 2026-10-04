# Documentation

Project instructions: [AGENTS](../AGENTS.md). Outcome priorities: [ROADMAP](../ROADMAP.md). Current task only: [WORK](../.planning/WORK.md).

Read the owner matching the change; source, generated API contracts and behavior tests must support implementation claims.

| Concept | Owner |
|---|---|
| Business roles and modes | [DOMAIN](DOMAIN.md) |
| UI vocabulary and entity status labels | [GLOSSARY](GLOSSARY.md) |
| Quantity/identity/data grain | [DATA-GRAIN-MATRIX](DATA-GRAIN-MATRIX.md) |
| Document transitions and service-run lifecycle | [LIFECYCLE-CONTRACT](LIFECYCLE-CONTRACT.md) |
| Weekly menu, servings, BOM and planning | [Weekly menu](domain/weekly-menu-contract.md) |
| MRX batch/daily issue/reconciliation | [Material reconciliation](domain/material-reconciliation.md) |
| Operational warehouse and stock identity | [Warehouse](domain/warehouse-contract.md) |
| As-built architecture and API owners | [ARCHITECTURE](ARCHITECTURE.md) |
| Setup, commands and contribution | [DEVELOPMENT](DEVELOPMENT.md) |
| Runtime settings, auth and secrets | [CONFIGURATION](CONFIGURATION.md) |
| Test boundaries and measurement | [TESTING](TESTING.md) |
| Presentation grammar | [DESIGN](DESIGN.md) |
| UI rule IDs and accessibility | [DASHBOARD-UI-RULES](DASHBOARD-UI-RULES.md) |
| Test-readable table contracts | [table-contracts.json](table-contracts.json) |
| Build/deployment/health/rollback | [DEPLOYMENT](DEPLOYMENT.md) |
| Operator-facing workflow walkthrough | [User workflows](operations/user-workflows.md) |
| Derived customer workflow diagram | [Diagrams](diagrams/README.md) |
| Migration, lineage, backup and restore safety | [Database recovery](operations/database-recovery.md) |

Private business inputs under `.docs/` are not published documentation or execution authority. Generated output is disposable except business recovery data, which needs an explicit safe disposition. Git history is the archive; historical task/process reports are not canonical owners.
