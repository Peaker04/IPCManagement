# Preparation source mapping implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Execute native in the current session, one writer, no subagents. Preserve inherited changes. No automatic installation, commit, push or deploy.

**Goal:** Replace name-only group proposals with a complete, source-backed ingredient crosswalk, a compact rule/exception review, and a verified clone mapping that preserves all downstream business quantities and references.

**Architecture:** Private offline evidence analysis produces candidates and lineage, never authoritative identity or database writes. Existing catalog/group owners remain production authorities. The existing DatabaseTool owns read-only inventory and bounded clone-only mapping rehearsal; it consumes explicit per-ID confirmed assignments, not a second production ingredient-normalization engine. Existing import/export owners receive only demonstrated contract fixes.

**Tech Stack:** Existing .NET/C#, MySqlConnector, Python standard library ZIP/XML/CSV/JSON/unittest, existing XLSX reader/security and purchase-history normalization tests, established MRX clone runner, installed Open XML SDK and native Excel. No new dependency.

**Spec:** `../specs/2026-11-15-preparation-source-mapping.md`; source evidence `../specs/2026-11-15-preparation-raw-source-review.md`; workbook acceptance spec/plan remain applicable.

## Global constraints

- Source `ipcmanagement` read-only until exact mapping and source-apply scope are reviewed. Existing user authorization covers clone mutation/cleanup; use current runner safety checks.
- DOM-MODE-1. Shared master group is not permission to merge workflows, histories, stock, frozen demands or approval states.
- Only PreparationGroupCode may change during mapping. No supplier merges/renames, package/unit edits, quotation creation, evidence fabrication or deletion of test-marked catalog rows.
- Source labels and names are candidates. Exact IngredientId + canonical UnitId + confirmed rule/evidence determine a proposed apply row.
- Frozen priority already approved; freshness/preservation unknown stays unresolved. Do not equate ĐL with frozen without confirmation.
- During native execution the user requested eight separate groups instead of OTHER: RICE, NOODLES, EGGS, DAIRY, BAKERY, BEVERAGES, PACKAGING, ICE. Keep codes/labels consistent in the canonical helper, maintenance validation and existing FE Select; no schema size/type change. Research individual cold-vendor items; a supplier blanket FROZEN rule is not approved.
- All full evidence/receipts under ignored `.artifacts/workbook-acceptance/source-mapping/`; raw workbooks stay private. Commit-safe tests use minimal fabricated parser fixtures only as tests, not business evidence; creation of test fixtures is within the authorized testing scope.
- No FE edit expected. If a demonstrated defect requires FE, load impeccable/ipc-ui-review, emit the complete scoped pre-code gate and validate relevant UI contracts before changing .tsx/.css.

## Review focus

1. A recognized sheet can still contain invalid rows, duplicate dates, side tables or absent item names: report each source disposition rather than certifying every named cell as an imported transaction. Task 1 tests pin this.
2. The same normalized name can belong to different IngredientIds/units: preserve all candidates and block identity resolution. Task 2 tests pin this.
3. A supplier can carry multiple commodity/storage types: group rules cannot inherit arbitrary Supplier labels; frozen takes priority only with evidence. Task 3 tests pin this.
4. A valid manifest can become stale between preview and write: lock and compare before-image inside the transaction; fail without partial changes. Task 4 tests pin this.
5. A group change can reorder or split an export without changing its correct total: compare by IngredientId/unit/day/batch and frozen menu lineage, not row order or grand totals across unlike units. Tasks 5–6 tests pin this.

## Interfaces and file ownership

- Create `tools/preparation_source_review.py`: offline source inventory, lineage, candidate crosswalk and exception reports. Its candidate matching is diagnostic NFC/case/whitespace matching, not a replacement for `PurchaseHistoryNormalizationPolicy`. Do not embed guessed production aliases.
- Create `tools/tests/test_preparation_source_review.py`: independent small ZIP/XML specimens and crosswalk behavior cases; use only standard library.
- Create `backend/tools/IPCManagement.DatabaseTool/PreparationGroupReviewCommand.cs`; modify its `Program.cs` only for scoped command dispatch. The tool already has MySqlConnector; do not add an API project reference just to reuse a constant.
- Create `backend/tests/IPCManagement.Api.Tests/PreparationGroupReviewCommandTests.cs`: command policy, manifest validation and transaction behavior. Existing test project already references DatabaseTool. Relational mutation evidence belongs to the established clone campaign; mocks alone cannot prove rollback/locking.
- Existing authorities: `Helpers/PreparationSupplyGroups.cs`, Catalog `IngredientService`/validators, `SampleBomImportService`, `PurchaseHistoryNormalizationPolicy`, `XlsxWorkbookReader`, Reconciliation exporter/builder and relevant tests.
- A versioned private `source-policy.json` contains reviewed mappings/rule status, not runtime heuristics or new persistent configuration tables. Manifest group codes must match the canonical helper; a contract test detects divergence in the maintenance tool's allowed set.

Stable interchange (JSON schemaVersion=1):

- Snapshot: database identity, collectedAtUtc, schemaHasPreparationGroup, ingredients[{ingredientIdHex,ingredientCode,name,unitIdHex,unitCode,isActive,currentGroup}], supplier identities and quotation references/effective dates, semantic fingerprint. Absent group column is explicit, never silently modeled as already migrated.
- Evidence: sourceHash, sourceKind, sheet, row, column/header, rawIngredient, rawUnit, rawSupplierLabel, mergeOrigin, disposition, reasonCodes. No price/contact/credentials.
- Review row: ingredientIdHex/code, canonical unit, candidate evidence refs, recommendationState, proposedGroupCode|null, reviewState, blockerCodes[], ruleIds[]. One row per snapshot IngredientId.
- Manifest: sourceHashes, database identity/fingerprint, ruleVersion/hash, mappingHash, decisions[{ingredientIdHex,unitIdHex,beforeGroup,afterGroup,evidenceRefs,decisionRef}], invariantFingerprint, schemaVersion. No CONFIRMED decision without an explicit source policy or item decision reference.

### Task 1 — Reproducible inventory and complete evidence extraction (MAP-01/02/06)

**Files:** `tools/preparation_source_review.py`, `tools/tests/test_preparation_source_review.py`; private inventory/lineage outputs.

**Interfaces:** `read_sources(workbook_paths: list[Path]) -> dict` produces sources/sheets/evidence/dispositions. `write_reports(result: dict, output_dir: Path) -> None` emits deterministic semantic JSON and CSV with spreadsheet-safe literal text; timestamps are excluded from semantic hashes.

- [ ] Write failing tests for SUMMARY sheet aliases with whitespace/case, NGUỒN column membership, physical row preservation, BOM merged origin versus ordinary blank, special no-Tên-hàng layout, duplicate headers, empty/unknown sheet, side table/header repetition and invalid XML/relationship path. Unknown layout must be explicit and not treated as a transaction.
- [ ] Run `python -m unittest discover -s tools/tests -p test_preparation_source_review.py -v`; record RED due missing functions/behavior.
- [ ] Implement bounded stdlib ZIP/XML reading; preserve each evidence kind without coalescing by date/name. Reject unsafe ZIP sizes/XML/paths and invalid required headers; report unsupported business layouts rather than silently omitting them. Do not copy the whole application's import parser.
- [ ] Add CLI `python tools/preparation_source_review.py inventory --source-dir .docs --output .artifacts/workbook-acceptance/source-mapping`. Source arguments resolve exact reviewed files; no automatic Downloads selection or dependency installation.
- [ ] Re-run tests; run real inventory. Verify workbook hashes match approved baseline, 34/6-sheet coverage and all 28 NGUỒN columns have dispositions. Read source hashes again afterward; unchanged originals required. Counts differing from diagnostic baseline require explanation, not forced matching.

### Task 2 — Canonical snapshot and crosswalk with independent blockers (MAP-03/04/05/08)

**Files:** `PreparationGroupReviewCommand.cs`, scoped dispatch in `Program.cs`, both new test files; existing normalization/reader tests only for missing behavior.

**Interfaces:** `PreparationGroupReviewCommand.SnapshotAsync(MySqlConnection, string outputPath, CancellationToken) -> Task<int>` issues a read-only transaction and writes private schemaVersion=1 snapshot. Offline `build_crosswalk(snapshot: dict, sources: dict) -> dict` attaches candidates/blockers with no database writes.

- [ ] Write failing tests: uppercase/NFC/NFD and repeated spaces yield candidate; accents/size differences do not auto merge; same name/different IDs or units stays ambiguous; unrelated groups never remove a record; source aliases cannot replace SupplierId.
- [ ] Add independently asserted cases Gạo in order Gạo versus BOM NL Rau, Sả under NL tươi sống, Ngũ vị hương HOP versus GOI, known kg/g conversion versus missing package conversion, inactive/multiple suppliers and multiple dates. Candidate finding and resolution are separate assertions.
- [ ] Implement `preparation-groups snapshot --settings <existing-settings-path> --output <private-path>` in existing DatabaseTool. Read group-column presence before constructing SELECT; no migration or credential output. Snapshot all ingredient identities/units/active state and relevant quotation/supplier references, retaining IDs and dates. SQL is parameterized where values are supplied.
- [ ] Implement crosswalk CLI consuming that snapshot and Task 1 outputs. Use conservative exact candidate normalization only; confirmed aliases are explicit reviewed rules, checked against existing `PurchaseHistoryNormalizationPolicy` behavior before use. Preserve separate identity/unit/supplier/preservation blockers.
- [ ] Run focused command tests with `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore -c Release -p:UseAppHost=false --filter FullyQualifiedName~PreparationGroupReviewCommandTests`, Python suite, and existing PurchaseHistoryReconciliationTests. Record skipped private-workbook evidence as missing evidence; do not add skips.
- [ ] Run snapshot/crosswalk against source read-only; validate exactly one result per current IngredientId and list all differences from the 773-name diagnostic inventory.

### Task 3 — Compact policy and exception review, without 773 manual decisions (MAP-07/09/10)

**Files:** offline report tool/tests; private `source-policy.json`, `policy-review.csv`, `exception-review.csv`, `ingredient-crosswalk.csv`, `manifest-preview.json`.

**Interfaces:** `evaluate_policy(crosswalk: dict, policy: dict) -> dict` assigns recommendationState/proposedGroup/blockers; `build_manifest(snapshot: dict, evaluated: dict, policy: dict) -> dict` includes CONFIRMED per-ID decisions only and excludes timestamp from mapping hash.

- [ ] Write failing tests for meat supplier with Sả, seafood with known frozen state, seafood with unknown state, ambiguous ĐL label, vegetarian/general-goods suppliers, OTHER explicitly confirmed versus unknown, contradictory rules, inactive ingredient, unmatched/test-marked names, repeated policy replay and source/rule hash changes.
- [ ] Implement policy evaluation with explicit scope/exceptions and no name regex fallbacks. Each of all 28 NGUỒN columns + all supplier/BOM source kinds receives a visible disposition. Display candidate confidence separately from confirmed review state.
- [ ] Produce a short rule summary with affected count and representative evidence per decision, then exception groups by root cause and affected IDs. Preserve full evidence without asking the user to inspect every row.
- [ ] Before asking for unresolved business decisions, finish all source/identity/unit checks that can be resolved locally. Ask only for missing preservation, package, ambiguous source meanings or OTHER policy with concrete examples and downstream impact; no blanket request to review 773 rows.
- [ ] Apply confirmed rule decisions to the private policy, regenerate all reports and verify 100% result coverage, stable hashes, zero duplicate IDs and no silent blocker removal. No source DB writes.

### Task 4 — Bounded clone mapping, concurrency, idempotence and rollback (MAP-10/11/12/13)

**Files:** DatabaseTool command/tests; existing clone runner only if needed for dispatch, never weaken safety policy.

**Interfaces:** `ValidateManifest(manifest, snapshot, allowedGroups) -> validation result`; `ApplyCloneAsync(MySqlConnection, manifestPath, receiptPath, CancellationToken) -> Task<int>`; `RollbackCloneAsync(MySqlConnection, receiptPath, outputReceiptPath, CancellationToken) -> Task<int>`. Apply/rollback commands accept only run-owned clone identities verified by existing runner ownership. No source apply command in this phase.

- [ ] Write failing tests for unknown group, duplicate IDs, malformed hash/ID, mismatched canonical unit, unconfirmed/missing evidence, changed source/rule/snapshot, unrelated target DB, replay and changed rows before rollback. Reject before mutation.
- [ ] Run canonical preflight using `pwsh -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Preflight -Profile Qualification -Diagnostic ExportConsistency`; inspect its output before starting a clone.
- [ ] Use run-owned clone setup; apply the existing group-column schema migration only to the clone. Verify schema migration changes no historical quantities/references, then take a new clone snapshot/manifest. Never bypass fingerprint mismatch caused by schema migration by disabling checks.
- [ ] Implement transaction: verify target/run identity, lock/re-read required rows, compare canonical IDs/unit/before-group plus relevant snapshot invariants, update only exact confirmed group rows, compare expected affected IDs/counts, commit and write before/after/hash receipt. Error after any row rolls back everything. Allowed group values stay contract-tested against `PreparationSupplyGroups.Labels`.
- [ ] On clone, test concurrent catalog change, injected mid-transaction failure, success, second identical apply (no additional changes), rollback and rollback refusal after a later user edit. Parameterize values and never log connection strings.
- [ ] Compare invariant fingerprints/counts across ingredients excluding group, units, BOM, quotations, PO/receipt references, stock/movements, batches/frozen demands/menus/approvals. All business fields unchanged. Receipt is private, not fabricated product audit history.

### Task 5 — Import/catalog/export dependencies (MAP-13/14/15)

**Files:** existing `IngredientService.cs`, validators/mapper, `SampleBomImportService.cs` and every discovered ingredient-creating importer; existing relevant tests. Exporter/builder only for reproduced failures; no planned broad refactor.

- [ ] Inventory every Ingredient creation/update path using `rg -n 'new Ingredient|PreparationGroupCode|Ingredients.Add|Ingredients.Update' backend/src`. Record exact owners and contracts in review output before editing. Inspect every result.
- [ ] Add missing regression tests for confirmed group preserved on omitted update and reimport; new ingredient defaults UNCLASSIFIED; invalid group rejected; BOM Supplier does not create a quotation; source edit does not mutate frozen demand; repeated import does not create a second same identity. Run RED before any corrective implementation.
- [ ] Implement only failures at existing owners. If import identity remediation requires changing merge semantics or historical references, isolate as a separately reviewed mapping; do not bury supplier merges in group migration.
- [ ] Expand real exporter tests for changed group with identical per-ID/unit/date/batch allocations, same-name different SupplierIds, multiple valid suppliers, supplier transition inside one week, inactive/expired/future/missing quotation, unchanged frozen menu/servings and legacy export path. Do not assert order-independent totals by summing unlike units.
- [ ] Run focused suites: IngredientIdentityTests, PurchaseHistoryReconciliationTests, DataQualityDispositionServiceTests, ReconciliationPreparationWorkbookTests, PreparationWorkbookSchemaTests and SampleBom/import tests discovered above, plus dependency/architecture checks prescribed by ENGINEERING. Fresh FAIL remains FAIL even if the earlier campaign passed.

### Task 6 — Native evidence, complete acceptance and source-apply decision

**Files:** existing verification report, WORK; private clone/download/schema/Excel/rollback/cleanup receipts. No new state file.

- [ ] Use established clone ExportConsistency workflow for day/week, exact selected customers/batches, grouped/unmapped/multiple supplier cases; download from the actual browser/API build. Capture run/build/mode/actor/scope/artifact hash without secrets.
- [ ] Validate that exact downloaded workbook with installed Open XML SDK; normally open/reopen unchanged bytes in dedicated Excel with alerts on; inspect both sheets, group sections, long labels/print and per-unit allocations. Capture own Excel window only. Do not reuse the earlier artifact as new mapping evidence.
- [ ] Verify role boundaries: warehouse export is read-only; catalog changes require existing permissions; MRX and DEFAULT remain isolated. If FE was touched, run impeccable/ipc-ui-review, operationalPageContracts and relevant *.contract.test.tsx plus lint/build; record a missing suite rather than substitute an unrelated pass.
- [ ] Run final required code/test review over the actual incremental owners and all inherited connected behavior. Retain independent schema, concurrency, rollback and RBAC oracles; no self-mocked pass or allowlist padding.
- [ ] Finish run through existing owner cleanup; verify exact clone/user/process removal and source read-only invariant fingerprint unchanged. Keep failed evidence and reasons, not only a green screenshot.
- [ ] Add MAP-01…15 and existing AC/matrix verdicts with commands/artifact paths to the existing verification report. Source apply remains a concrete reviewed migration decision after successful clone evidence; unresolved rows remain UNCLASSIFIED with reasons. Never call complete while blockers are hidden.
- [ ] Update WORK to IDLE with precise completed scope, remaining exceptions and source mutation status. No automatic commit/push/deploy.

## Self-review coverage

MAP-01/02/06 → Task 1; MAP-03/04/05/08 → Task 2; MAP-07/09/10 → Task 3; MAP-10/11/12/13 → Task 4; MAP-13/14/15 → Task 5; full operational/recovery acceptance → Task 6. All five review-focus cases have named negative tests. Decision point is the compact policy/exception set and exact source mapping, not another general authorization request.
