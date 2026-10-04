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

## Supporting references

These local guides describe adjacent owners, not additional workflow/acceptance authority:
- [Frontend navigation](../frontend/README.md) and [test locations](../frontend/tests/README.md).
- [Generated API maintenance](../frontend/src/shared/api/contracts/README.md).
- [Database utilities](../tools/db/README.md), [provider recovery mechanics](../scripts/database-recovery/README.md) and [performance tools](../tools/perf/RUNBOOK.md).

Private business inputs under `.docs/` are not published documentation or execution authority. Generated output is disposable except business recovery data, which needs an explicit safe disposition. Git history is the archive; historical task/process reports are not canonical owners.

### Retained private-input disposition

The six `.docs/` inputs (database document, order workbook, BOM workbook, image and two weekly-menu workbooks) remain `PRIVATE_INPUT`: keep locally; no publication or migration of their rows into documentation is authorized. Active workbook fixtures/templates remain protected; technical use does not establish distribution rights.

The tracked `backend/tests/IPCManagement.Api.Tests/Fixtures/IPC. Định lượng 07.2026.xlsx` is `TECHNICALLY_NEEDED_BUT_PUBLICATION_UNPROVEN`, with `PRIVATE_DATA_LEAK_RISK` and disposition `REPLACE_WITH_SYNTHETIC_FIXTURE_REQUIRED`. It is byte-identical to the private populated BOM input, not a blank or demonstrated sanitized/synthetic fixture. Introduction/output-copy history establishes intentional test use, not consent or licensing. No explicit workbook distribution permission was found in the bounded owner/history review; absence of evidence is not proof that consent never existed.

`CanonicalBomWorkbookTests` checks the supplied dataset's 1,999 rows, independent tiers and technical-count totals; `SampleDataImportServiceTests` copies the workbook for import integration cases. Exact ZIP bytes are not asserted. Reader/catalog/import tests also demonstrate synthetic workbook construction, so synthetic behavioral coverage is feasible, but cannot certify the real supplied dataset or be assumed equivalent without a separately authorized replacement and regression verification. Preserve the fixture and consumers unchanged until a separately authorized replacement task verifies equivalence. Required follow-up: construct a populated realistic workbook using fabricated data only, retaining the workbook schema/import contract, tier independence, technical-unit/count cases and cached-formula/parsing cases needed by current consumers. Do not copy real recipes, prices or customer values. Migrate canonical tests to the synthetic contract, verify equivalent regression coverage before deleting the original, and do not reduce coverage. This requirement does not authorize replacement now, establish publication consent, or classify the original as safe/public. No private rows are reproduced here.
