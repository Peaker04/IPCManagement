# MRX workbook — verification and remaining acceptance

2026-11-15, local workspace. This is an evidence report, not a second task-state owner. WORK remains authoritative. The two-sheet/export implementation is verified below; the entire acceptance plan is NOT complete while production classification mapping and migration review remain outstanding.

## Root causes and observed repair

1. The API formerly on 5262 was process 10012, started 16:37 from a 16:36 debug build, before the writer repair. Actual downloaded `(1).xlsx` still had three old sheets. The verified workspace API was stopped and rebuilt during investigation; no deployment occurred.
2. The old file independently fails Open XML SDK validation for `autoFilter` after `mergeCells` in sheet3 and incorrect font-child ordering in `styles.xml`. Both owner defects are repaired. Original-byte failure diagnostics: `.artifacts/workbook-acceptance/old-file-schema-failure.log`.
3. The original tests checked ZIP/XML strings, not independent schema or actual serving runtime. A test-only DocumentFormat.OpenXml 3.5.1 dependency was explicitly authorized and added. Generated full/legacy packages and real downloaded bytes now pass schema validation.

## Actual artifact evidence

- Browser download from real disposable-clone API: `.artifacts/workbook-acceptance/fresh-api-preparation.xlsx`; HTTP 200, correct XLSX MIME/disposition, 10,231 bytes. Download receipt records scope and SHA256.
- SHA256: `012ae41edf56b0480a989a1349ed0ac06eadc0a7c1913787c610f8bda95c8706`.
- Native Microsoft Excel 16.0 normal open and normal reopen of those same unchanged bytes, read-only, DisplayAlerts=true, no repair option. Receipt: `excel-receipt.json`; screenshots: `excel-normal-open.png`, `excel-menu-open.png` in the same directory. No conversion/resave was used to produce the accepted file.
- Independent validation of the latest file: `fresh-file-schema-pass.log` (3/3). A separate actual clone export after group assignment passes schema: `grouped-file-schema-pass.log`.
- Excel readback confirms both sheets landscape, fit width 1, repeated rows `$1:$4` and `$1:$3`; `excel-print-settings.json`. This proves settings, not a physical printer or worst-case multipage layout.

## Runs and gates

Successful bounded clone run: `.artifacts/mrx-evidence/20261115t115657z_d90206/`.

- Status `DIAGNOSTIC_PASS`, not full qualification.
- Real UI source setup PASS; real MySQL exporter/source concurrency PASS at writer-before-read, writer-during-read, other-customer-during-read and writer-during-render. Stock checksums unchanged. Runtime `export-consistency.json` contains independent expected inputs and observed outcomes.
- Repository gate PASS: API 1559/1559, Application 49/49, frontend 698/698; lint, dependency checks, builds, quick/conformance gates; evidence/recovery contracts 51/51.
- `cleanup.json`: completed true, no errors, owned clone/subordinate/principal/listeners/private temporary resources removed. Source before/after manifests reconcile.
- Earlier runs are retained as FAIL evidence: `20261115t111415z_ea26d6` exposed obsolete single-sheet test assumptions; `20261115t114539z_88ef6e` exposed a forbidden feature dependency; `20261115t115302z_0490c2` exposed asynchronous empty input enumeration in setup. Each has completed cleanup. Corrections preserve business assertions and do not add exemptions.
- After the successful campaign, supplier availability labels were refined to distinguish missing, multiple valid, inactive and out-of-date quotations. Focused API/catalog/schema regression rerun: 28/28 PASS. The captured real workbook belongs to the preceding campaign; these subsequent availability cases are relational-test evidence, not an additional live-download claim.
- Catalog dialog isolated browser audit PASS at desktop and narrow/short heights. Scope options use the existing Select primitive. Group update request is asserted at transport boundary; unchanged code/unit are preserved.

## Data classification and identity

Authoritative `Ingredient.PreparationGroupCode` with migration `20261115112042_AddIngredientPreparationGroup`; controlled application codes PRODUCE/FRESH_MEAT/FRESH_SEAFOOD/FROZEN/SEASONING/OTHER/UNCLASSIFIED. Catalog create/update validate codes, DTO/mapper/OpenAPI/frontend carry them. BOM/import-created ingredients default to UNCLASSIFIED, never a guessed group. UI create/edit exposes the field. Shared group labels live in Helpers to avoid a Reconciliation→Catalog feature dependency.

User decision: frozen storage takes priority; fresh fish/shrimp belong to seafood. Lack of evidence about storage remains unresolved.

Read-only inventory: 773 ingredients; 64 suppliers, 29 same-name review groups. Actual supplier references are inventoried; identical names are not proof of the same counterparty. Exporter now resolves/group-identifies suppliers by SupplierId, with code displayed in sections; same-name distinct IDs remain distinct or ambiguous as appropriate.

Proposal workbook: `.artifacts/workbook-acceptance/de-xuat-nhom-cung-ung-773.xlsx` (also CSV/TSV source). Contains all 773 unique ingredient codes, reasoning, confidence, review state and an editable approved-code column. 254 suggestions, 519 unresolved; every row still requires user review. Proposal matching is an offline draft technique, not production classification logic. Source DB receives no inferred mapping.

Real clone UI proof: `group-ui-mutation-receipt.json` records Bí đao UNCLASSIFIED→PRODUCE, real workbook export with produce section, then restoration to UNCLASSIFIED. This is a deliberate test on clone, not approval to classify production data.

## Acceptance matrix

| Criterion | Verdict | Evidence / remaining limit |
|---|---|---|
| AC-01 full two-sheet/empty + legacy | PASS | Workbook and independent schema tests; actual normal Excel open |
| AC-02 date/week/customer/batch scope | PASS within covered cases | Existing day/week relational tests; same-name and same-customer multi-batch tests; actual selected batch URL/metadata |
| AC-03 authoritative groups/real supplier IDs | PARTIAL | Code, migration on clone, real group save/export/restore and relational supplier tests PASS; production mapping/identity cleanup not approved/applied |
| AC-04 frozen menu/servings/snapshot | PASS within diagnostic scope | Relational frozen-lineage regressions and real concurrent source/export oracle |
| AC-05 readability/format/limits/printing | PARTIAL | Native screenshots, numeric cell checks, safe literal XML text, invalid-control rejection and Excel print settings PASS; extreme customer-width/multipage physical output not certified |
| AC-06 legacy + FE selection/search/error | PASS within tests | Legacy output, scope/export regression and MIME/HTTP error tests; current full frontend suite PASS |
| AC-07 independent package | PASS for tested specimens | Old file FAIL with exact diagnostics; full/legacy/new actual/grouped files PASS SDK schema |
| AC-08 runtime provenance | PASS for clone download | Build/candidate manifests, real response headers, hash reconciliation; source deployment not performed |
| AC-09 Excel open/reopen | PASS for actual fresh download | Own Excel instance, normal load, alerts enabled, same hash, no resave/repair |
| AC-10 clone/E2E/source/cleanup | PASS bounded ExportConsistency | Successful run receipts above; not full multi-role/endurance qualification |

| Matrix cases | Coverage |
|---|---|
| day/week/Saturday/Sunday and reload scope | Existing preparation API/FE tests; real week download; not every variant repeated in native Excel |
| zero data/no menus/positive data | Generated contract/schema tests plus positive actual download |
| one/many/equal-name customers and repeated batches | Relational tests and real multi-customer source setup |
| separate units/fractional/zero/large quantities | Relational parity/numeric tests; real file; extreme precision/Excel-size boundaries still need dedicated specimens |
| missing/conflicting frozen lineage and concurrent source updates | Existing lineage checks and four real concurrency schedules |
| supplier missing/ambiguous/same name/inactive/expired/future | Relational tests including four new availability cases; resolved IDs preserved |
| groups assigned/unmapped/overlap | Explicit FROZEN test; user storage-priority decision; actual UI clone assignment; full map remains pending |
| long text/XML controls/formula-like text | Literal-text/control rejection tests; native screenshots; very wide print layout remains pending |
| many customers/materials | Existing 10,500-row report gate and explicit writer guards; not a certification of maximum-customer preparation workbook performance |
| full/legacy | Both paths tested and schema-validated |
| search/selection/loading/error/RBAC | Existing FE/API suites and MIME guard; real Admin clone flow; not a fresh all-role download campaign |
| stale runtime/wrong artifact | Old process/build recorded, old/new hashes and actual workbook layouts compared |
| fresh download/normal Excel reopen/print | Normal open/reopen and settings verified; physical printing not tested |

## Remaining actions before whole-plan completion

1. User reviews the 773-row proposal, including storage ambiguity; review 29 same-name supplier groups against actual counterparty identity and all references. No automatic merge/rename.
2. Prepare exact approved data migration with before/after row/reference counts and rollback; rehearse on clone. Only then apply to an explicitly authorized database. Current source `ipcmanagement` has not received the new schema/data migration in this scope.
3. Trace duplicate-name import callers before any supplier merge: SampleBomImportService currently selects the first normalized name match; purchase-history apply expects a unique name. Review accepted identity mappings and replace ambiguity with explicit resolution as part of that data-normalization scope. Do not claim exporter ID-awareness alone completes global supplier normalization.
4. Close the documented print/extreme-input and mapping-rollback evidence gaps. Do not convert PARTIAL to PASS because the broad suite is green.

Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact: Superpowers executing-plans/systematic-debugging, impeccable, ipc-test-audit/ui-review/code-review; FR-WH workbook/native acceptance; stale runtime and producer-only XML checks; test-only independent validator, actual browser bytes + normal Excel load, clone/UI/concurrency receipts; yes for bounded repaired export; inherited nullable/EF-tool/obsolete warnings; recovery repair verified, whole classification plan remains pending reviewed data and stated acceptance gaps.
