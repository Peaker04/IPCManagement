# Open research questions

## Multi-customer E2E lifecycle (2026-08-12)

- Which existing demand/issue records in the legacy E2E template have unambiguous customer,
  date/shift, tier and source-line lineage suitable for controlled proof? The known `173/187`
  duplicate demand match cannot be promoted as happy-path evidence.
- Can the local headed Chrome driver reliably dispatch physical pointer/key input to application
  controls? Until then, document the limitation and preserve FE → API → DB → reload proof from
  the controlled runner; do not label the workaround as a generic UI interaction pass.

## Purchasing Data Workspace versus Workflow boundary (2026-08-22)

**Status:** OPEN — RESEARCH LOCKED
**May be resolved only after:** Warehouse Phase 27 is verified and Admin Data validation is complete.

- Which Purchasing regions are stable Data Workspace concerns (toolbar, filters, dataset, selection,
  pagination and detail context), and which regions encode Workflow concerns (decision eligibility,
  lifecycle transitions, evidence/history and mutation confirmation)?
- Can Purchasing adopt the validated Data Workspace contract region-by-region without forcing its
  Workflow surfaces into a table/list archetype?
- What evidence demonstrates that a shared Warehouse/Admin Data owner remains valid for Purchasing,
  rather than becoming a generic framework or route-specific exception?

Until the prerequisite is satisfied, this question must not authorize Purchasing production changes,
a shared Workflow abstraction, a component-library change or a new page renderer.
