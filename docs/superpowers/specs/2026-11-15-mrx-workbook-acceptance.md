# MRX preparation workbook — specification and acceptance contract

Status: approved execution baseline with partial implementation/evidence, 2026-11-15. Two-sheet choice is approved. This document supersedes the limited verification scope in `../plans/2026-11-15-preparation-two-sheet.md`; it does not authorize deployment or an unreviewed source-data migration. Current recovery/runtime evidence is recorded in `2026-11-15-mrx-workbook-verification.md`; section 2 below retains the original intake observations, not the current verdict. The user approved source-backed mapping approach A; the normative mapping contract is `2026-11-15-preparation-source-mapping.md` with its native execution plan.

## 1. Purpose and users

FR-WH/FR-RECON, `/warehouse?view=mrx-preparation`, MATERIAL_RECONCILIATION only. Warehouse staff prepare quantities and allocate to customers; coordinators compare the frozen menu; purchasing/admin manage supplier identities and supply-group assignments. Export is read-only: no issue, stock movement, source update or approval transition. DEFAULT remains isolated (DOM-MODE-1).

## 2. Verified failure and unknowns

Actual downloaded files were inspected read-only, not inferred from screenshots:

| File | SHA-256 | Observed content |
|---|---|---|
| `C:/Users/Administrator/Downloads/chuan-bi-tuan-2026-11-16.xlsx` | `6eb72d8729d917af2cddc4eb376c2a44e6bf53c189dcd270e2d781f0ba861b6d` | Three old sheets, menu mergeCells before autoFilter |
| `C:/Users/Administrator/Downloads/chuan-bi-tuan-2026-11-16 (1).xlsx` | `26631265aaa52e7d3eda8a245419d2ec37a61149bf9145c827dc1e99a1194f08` | Same old three-sheet layout and invalid ordering |

Working tree contains a two-sheet writer and 16 passing focused tests; running/downloaded artifact has not been linked to that build. Do not claim the latest download proves the new writer is corrupt, or that fixing one XML sequence proves Excel compatibility. Recovery log, runtime build provenance and fresh-download Excel-open proof remain missing.

## 3. Locked workbook behavior

AC-01: full `includeMenus=true` export contains exactly two sheets in this order: `Chuẩn bị nguyên liệu`, `Thực đơn đối chiếu`. Empty full export still contains both. Open the material sheet first.

AC-02: both sheets identify the same date/week, selected customers and exact batch scope. Week is Monday–Saturday. No silently included Sunday or unselected batch. Customer ID is the aggregation key; equal names do not merge customers. Multiple batches for one customer sum once and remain traceable in scope metadata.

AC-03: materials sheet groups by authoritative supply group, then real supplier identity where uniquely resolved. Columns include ingredient code/name, canonical unit, selected-customer allocations and total required. Total equals allocations at source precision; round only final display to six decimals. Different canonical units stay separate; no cross-unit grand total. It shows required preparation, not actual issued or remaining procurement.

AC-04: menu comparison contains frozen customer/date/shift/menu variant/dish code/name/servings. A dish's servings are not multiplied by ingredient count. Missing/conflicting frozen lineage produces an actionable error, never substitution from current BOM/menu. Exact batch context must be recoverable when multiple selected batches coexist.

AC-05: readable Vietnamese, wrapped long names, numeric Excel cells, six-decimal display, consistent widths, frozen identifiers/header, landscape print width and repeatable printed table headings. No price/contact/secrets unless separately required. Customer growth must not silently omit columns or exceed Excel limits; establish an explicit maximum and clear rejection if needed. Text starting `=`, `+`, `-`, `@` remains text; invalid XML characters have an explicit safe handling policy.

AC-06: `includeMenus=false` compatibility is explicitly retained with legacy summary/detail layout. It gets the same structural validation. Local ingredient search does not limit exported data; selected exact batches and day/week do. Loading, prior-scope data or export-in-progress must not create a misleading download.

## 4. Supply-group and supplier integrity

Proposed controlled groups: Rau củ quả, Thịt tươi, Thủy hải sản, Đông lạnh, Gia vị, Khác, Chưa phân nhóm. These are preparation-routing groups, not substitute supplier names. Overlapping cases (e.g. frozen fish) require an explicit reviewed assignment per ingredient; do not classify production data with name heuristics. A single active primary preparation group per ingredient avoids duplicate totals.

Supplier identity remains SupplierId/SupplierCode; SupplierName is a display label. Different IDs with identical names stay distinct. Resolve active quotations by ingredient and service date using IDs. Missing quotation, multiple valid suppliers and inactive/expired suppliers must be distinguished. No automatic winner based on alphabet, price or first row. Supplier changes within a week must not duplicate material quantity or conceal date applicability.

Before DB mutation: read-only inventory of groups, supplier IDs/names and references; prepare mapping proposed/confirmed/unresolved, affected-row counts and conflict cases. Keep historical PO/receipt/quotation references. Any merge requires verified identity and a reviewed migration with clone rehearsal, rollback and counts. Import/create/edit paths must use the same group/identity rules. No blanket renaming of counterparties to NCC rau củ/thịt/etc.

The scalar group model is implemented and source-backed approach A is approved; a concrete production data migration is not yet accepted. Before such a migration, satisfy MAP-01…15 in `2026-11-15-preparation-source-mapping.md`: complete raw lineage, ID/unit/supplier/preservation checks, compact policy and exception review, deterministic mapping manifest, clone apply/concurrency/rollback and downstream invariant comparison. The earlier name-only 773-row proposal is discovery history, not authoritative mapping. Until confirmed, explicitly show Chưa phân nhóm; existing supplier sections alone do not satisfy AC-03.

## 5. Evidence and release gates

AC-07 (package): validate every emitted XML part, content types, relationship targets, style indices, numeric values, worksheet child order, merge coordinates/overlap, filters, row/cell addresses and Excel limits. ZIP readability/string assertions alone are insufficient. Use an independent OOXML schema validator already available, or document dependency approval needed; do not manufacture PASS if unavailable.

AC-08 (runtime): record working-tree/build identity, process executable and start time, actual FE API base URL/proxy, server mode/actor and sanitized export URL. Capture API response status, MIME, disposition, length and downloaded SHA-256. Inspect that exact downloaded file for two sheets/new markers. Diagnose old runtime/cached response/wrong endpoint before further writer edits. A dev restart is separate from deploy; record a blocked restart honestly.

AC-09 (Excel): on a dedicated Excel instance open a copy of the fresh downloaded artifact in normal mode; no automatic repair option, suppressed warning, re-save cleanup or LibreOffice conversion may serve as proof. Record Excel version, file hash, screenshots, sheet/print view and any repair log. Close only the test-owned workbook/process. Reopen the unchanged downloaded artifact and confirm no recovery prompt. Native Excel absence means NEEDS_EVIDENCE, not PASS.

AC-10 (end-to-end): use the established disposable-clone runner for authorized mutations, real GET export through browser download, then AC-07–09 on that artifact. Include cleanup receipts; leave source database unchanged. Fixture-only rendering must be labeled separately. No weakening RBAC or inventing business fixtures in production paths.

## 6. Coverage matrix (mandatory)

| Cases | Required observable result | Verification owner |
|---|---|---|
| Day/week, Saturday, invalid Sunday, reload URL | Exact scope, Monday–Saturday, invalid new scope rejected | API + FE export integration |
| Zero data/no menus; positive data | Two sheets for full export; actionable empty content | Writer + Excel |
| One/many customers; equal names; one customer/multiple batches | Identity preserved, sums once, batch provenance | Exporter relational test |
| Same ingredient/different units; fractional, zero, large quantities | Separate units, correct decimal cells/totals | Exporter + package |
| Frozen lineage missing/conflicting; source update during export | Error or coherent snapshot; no mixed revisions | Relational service test |
| Supplier absent/ambiguous/same name IDs/expired/inactive/date change | Explicit resolution; no collapsed identity or duplicate quantity | Supplier projection test |
| Group assigned/unmapped/conflicting; frozen seafood | Reviewed single mapping, no guessed assignment | Mapping validation + clone |
| Long names, XML reserved/control characters, formula-like text | Valid package, literal safe text, readable cells | Independent validator + Excel |
| Many customers/materials | Defined limit, bounded response, no truncation | Representative load/package test |
| Full vs legacy export | Contract-specific sheet layout and equivalent totals | API/writer regression |
| Local search/selection change/loading/error/401/403/retry | Correct scope; no HTML/error saved as successful XLSX | FE boundary + real browser |
| Stale running binary/wrong API host/old download | Artifact fingerprint identifies mismatch | Runtime receipt |
| Fresh download + normal Excel open/reopen/print | No recovery, readable two-sheet workbook | Native Excel evidence |

## 7. Definition of done

Every AC and matrix row has PASS/FAIL/NEEDS_EVIDENCE/BLOCKED with paths and commands. No whole-task completion while runtime/Excel proof or approved group migration is outstanding. Review actual source, tests and downloaded bytes; preserve inherited dirty work. No implicit commit/push/deploy. `.planning/WORK.md` remains the only task-state owner.
