# Requirements: FE–BE–Database Standardization Closure

**Defined:** 2026-08-03
**Source contract:** `docs/UI-UX-FE-BE-DATABASE-STANDARDIZATION.md`
**Core value:** Equivalent authoritative state is represented consistently from database through API to UI, without false empty/zero states or partial writes.

## Active requirements

### Frontend query-state closure

- [x] **FEQS-01**: Every production query boundary is inventoried with its owner, authoritative data and state handling.
- [x] **FEQS-02**: Legacy boundaries use `QueryView`/`QueryViewBoundary`, or have a documented source-tested exception.
- [x] **FEQS-03**: Loading, refreshing, error, forbidden, ready and empty remain distinct; stale data stays visible while refreshing.
- [x] **FEQS-04**: Rendered regressions cover false-empty/false-zero, owner retry and permission behavior.

### Import diagnostics and provenance

- [x] **IMPD-01**: Malformed BOM workbooks return stable, friendly domain errors rather than generic HTTP failures (`OPEN-02`).
- [x] **IMPD-02**: Preview diagnostics identify workbook scope and the relevant sheet/row/field without exposing internals.
- [x] **IMPD-03**: Commit accepts only the preview token/checksum for the exact uploaded content and scope.
- [x] **IMPD-04**: Dishes created by import retain queryable import provenance (`OPEN-07`).
- [x] **IMPD-05**: API regressions cover malformed input, stale/mismatched commit and provenance success paths.

### Import atomicity and recovery

- [x] **IMPA-01**: A two-customer import either commits as one transaction or follows an explicit, observable recovery protocol (`OPEN-08`).
- [x] **IMPA-02**: A forced failure proves no silent partial success and preserves actionable diagnostics.
- [x] **IMPA-03**: Retry/idempotency behavior is regression-tested.

### Effective-range audit

- [x] **AUDT-01**: Contract effective-range changes emit before/after audit facts with actor and correlation context (`OPEN-05`).
- [x] **AUDT-02**: Menu-schedule effective-range changes emit equivalent audit coverage.
- [x] **AUDT-03**: End-to-end API tests prove persisted transition and audit record together.

### Customer/week tier invariant

- [x] **TIER-01**: One customer/week cannot persist conflicting tier assignments outside the UI (`OPEN-06`).
- [x] **TIER-02**: A forward migration enforces the invariant without resetting or reseeding protected data.
- [x] **TIER-03**: Service/API conflict responses are domain-friendly and covered by regression tests.
- [x] **TIER-04**: Migration validation and rollback guidance preserve existing lineage.

### Workbook author verification

- [x] **WBQA-01**: The authored workbook has a deterministic case matrix for valid and invalid authoring scenarios (`OPEN-09`).
- [x] **WBQA-02**: Verification uses a copy/hash guard and proves the original template is unchanged.
- [x] **WBQA-03**: Headed Chrome exercises the import flow at all five approved desktop viewports with request, response, console/page error, CLS and long-task evidence.
- [x] **WBQA-04**: Browser evidence joins FE control, API result, database transition and rendered reload state.

### Closure

- [ ] **CLOSE-01**: Targeted and root application/API/frontend/lint/dependency/build gates pass without test-count reduction.
- [ ] **CLOSE-02**: Secret/stub scan and `git diff --check` pass; protected database lineage is unchanged except explicitly tested scoped mutations with rollback.
- [ ] **CLOSE-03**: The standardization contract, `MEMORY.md`, `HISTORY.md`, evidence index and GSD closeout agree and no active scoped `OPEN` item remains.

## Out of scope

- `OPEN-04` off-site immutable backup infrastructure and `DEC-02/04/05` user decisions.
- SAP Fiori milestone Phases 27–30.
- Database reset, seed, restore or mutation of the original workbook template.
- GitNexus analysis unless explicitly requested by Kỳ.

## Traceability

| Requirement family | Phase | Source item |
|---|---:|---|
| FEQS-01..04 | 1 | FE migration follow-up |
| IMPD-01..05 | 2 | OPEN-02, OPEN-07 |
| IMPA-01..03 | 3 | OPEN-08 |
| AUDT-01..03 | 4 | OPEN-05 |
| TIER-01..04 | 5 | OPEN-06 |
| WBQA-01..04 | 6 | OPEN-09 |
| CLOSE-01..03 | 7 | Standardization Definition of Done |

**Coverage:** 26 active requirements, all mapped, none deferred within this workstream.
