# MRX workbook acceptance implementation plan

> Execute inline with superpowers:executing-plans after approval. No subagents or automatic installation.

**Goal:** Satisfy every AC in the workbook acceptance spec with an actual API-downloaded file opened in Excel.
**Architecture:** existing preparation controller/service/exporter own scope and snapshot; existing workbook builder owns XLSX package; catalog/purchasing own groups/supplier identity. No parallel formatter or export-only classification rules.
**Tech stack:** C#/.NET, EF, existing XLSX ZIP writer, frontend download owner, existing clone runner, native Excel and an independent package validator.
**Spec:** `../specs/2026-11-15-mrx-workbook-acceptance.md`.

Execution evidence and per-criterion verdicts: `../specs/2026-11-15-mrx-workbook-verification.md`. Native export/recovery gates passed; full normalization acceptance remains pending reviewed mappings and documented remaining cases. WORK owns current status.

## Global constraints

DOM-MODE-1; exports remain read-only; source database unchanged during investigation. No runtime takeover of user Excel. Two sheets and source-backed mapping approach A approved; concrete source-data migration remains subject to reviewed mapping and clone evidence. Native mapping implementation is detailed in `2026-11-15-preparation-source-mapping.md`; do not reuse the prior name-only proposal as apply input. Existing branch is dirty: preserve inherited changes. Use ipc-debugging, ipc-test-audit, ipc-code-review; if FE changes, load impeccable/ipc-ui-review and emit scoped UI gate. No lowered tests or suppressed Excel alerts.

## Task 1 — Establish artifact/runtime root cause (AC-08)

- [x] Preserve hashes/metadata of both failing Downloads files; do not overwrite.
- [ ] Trace `frontend/src/api/mrxApi.ts`, `utils/fileDownload.ts`, Vite proxy/env and preparation controller to actual responding process; inspect only non-secret settings.
- [ ] Record build/process provenance and actual export response; compare old three-sheet markers with current two-sheet source. Distinguish response caching from wrong/stale runtime using response/hash evidence.
- [ ] If restart is required, identify owned process/path/port and use authorized dev workflow; respect any tool rejection. Export again from actual UI, hash and inspect bytes.
- [ ] Gate: fresh download has new two-sheet contract; otherwise stop writer changes and report the proven runtime blocker.

## Task 2 — Independent package validation and Excel repro (AC-07/09)

- [ ] Inspect available OOXML validator dependencies/tools; select independent schema validation without unapproved install. Capture unavailable gate explicitly.
- [x] Run validator on failing original and fresh artifact, retain diagnostics identifying exact part/element. Normal Excel open/reopen of fresh bytes passed; original schema diagnostics retained without requiring repair/resave.
- [ ] Add failing regressions at `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs` for demonstrated package defects. Repair `PreparationWorkbookBuilder.cs` at the owner; validate every part and full/legacy output.
- [x] Open fresh API artifact normally in dedicated Excel; capture clean open/reopen or failure. Do not mark fixed based only on ZIP parsing.

## Task 3 — Complete two-sheet operating document (AC-01–06)

- [ ] Review builder/exporter/DTO and `docs/domain/material-reconciliation.md`; reconcile inherited partial edits with spec rather than resetting them.
- [ ] Cover empty full export, same-name customers, repeated batches, unit separation, fractional quantities, frozen menus and six-day scope. Add tests only where observable behavior is missing.
- [ ] Implement scope metadata in both sheets, exact batch traceability, numeric formats, text safety, printing/repeated headers and explicit Excel-size bounds. Inspect wide/customer-heavy and long-text specimens in Excel.
- [ ] Preserve retained includeMenus=false tests. Update DTO/OpenAPI/schema only if the contract actually changes using existing approved tooling.
- [ ] Gate: selected scope and totals independently reconcile; no cross-unit grand totals or menu serving multiplication.

## Task 4 — Authoritative grouping and supplier normalization (AC-03)

Execute the six tasks in `2026-11-15-preparation-source-mapping.md` for this outstanding data scope. Its MAP-01…15 requirements are mandatory additions, not a replacement for package/runtime/Excel gates. Preserve existing verified outcomes; rerun affected behavior after new changes.

- [x] Read-only DB inventory against the confirmed database; identify current suppliers and references, 29 duplicate-name candidate groups and 773 ingredient review rows; no secret output or source mutation.
- [x] Research raw workbook sources and obtain approval of source-backed approach A, frozen-priority rule and compact policy/exception review. The raw source review and approved design are linked from the mapping plan.
- [ ] Produce a validated full-ID crosswalk and concrete mapping including unit/preservation conflicts, source rule decisions and frozen seafood. Complete confirmed mapping and clone receipts before source writes; discovery name matches do not close this step.
- [x] Choose minimal catalog/purchasing entity/DTO/migration owners; one controlled scalar preparation group per ingredient, UNCLASSIFIED default for imports; create/edit validation and UI. Source data migration remains pending reviewed mapping.
- [ ] Exporter ID-aware projection and distinct missing/ambiguous/inactive/expired/future states implemented and tested. Explicit within-week supplier-transition acceptance and global import identity remediation remain to close this step fully.
- [ ] Rehearse approved data/schema changes on disposable clone, compare affected counts and references, test rollback/cleanup. No direct production bulk rename or heuristic mapping.
- [ ] Render group → actual supplier sections; label unmapped separately. Group totals must reconcile to selected allocations by unit.

## Task 5 — Cross-layer acceptance and closure

- [ ] Run focused Release tests: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore -c Release -p:UseAppHost=false --filter FullyQualifiedName~ReconciliationPreparationWorkbookTests` plus relevant preparation/supplier tests touched by Task 4.
- [ ] Run FE download/RBAC/scope tests and lint/build if changed. Run required UI contracts where present; disclose missing named suites instead of substituting an unrelated pass.
- [ ] Run established authorized clone E2E: day/week + selected customers/batches + actual browser XLSX download; hash, validate package and open identical artifact in Excel. Verify source counts and clone cleanup.
- [ ] Produce acceptance table for every spec AC/matrix row, including runtime binary/hash, artifact hash, validator output, Excel screenshots/logs and mapping review/rollback receipts.
- [ ] Perform ipc-code-review and test-audit of changed owners; no self-mocked writer or assertions mirroring malformed XML as the only oracle.
- [ ] Update WORK with actual verdicts. Mark complete only after mandatory gates pass; any blocked restart, validator, Excel or mapping remains explicit.

## Review focus

Independent oracles over producer assertions; running binary versus workspace; frozen snapshot versus live data; supplier ID versus display name; exact batches versus customer labels; category overlap; retained client path; actual Excel behavior versus generic XML parse success.
