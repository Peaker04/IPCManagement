# MRX data-flow integrity — five Ponytail findings: design spec

Date: 2026-11-08

**Document scope:** requested spec and plan only. The five reported problems are in scope; proposed implementation choices below are not yet owner-approved. No product implementation, migration execution, historical backfill, runtime restart or business acceptance is authorized by this document. `.planning/WORK.md` remains the sole execution/acceptance ledger.

## 1. Intent and evidence

Protect the affected chain: persisted BOM/servings → frozen contributors → supplemental issue calculation → customer preparation workbook → operational summary → refreshed dashboard. Repair the five findings without changing DEFAULT inventory behavior, MRX permissions, source-day locks, tier selection or historical quantities.

Review baseline: working tree against HEAD `b2adf6ef05cf9ddf8227d7786965efbba6801521`, including inherited unstaged/untracked work, empty index. Findings are source-backed reachable cases, not a claim that all five were reproduced against live business data.

Prior review evidence, not results of implementing this spec:
- `D:/Temp/ipc-whole-review-be.log`: 1522 API + 49 Application tests passed under existing core exclusions.
- `D:/Temp/ipc-whole-review-focused.log`: Warehouse/Dashboard 45 tests passed.
- `D:/Temp/ipc-whole-review-flow-tests.log`: six FE owner files / 114 tests passed.
- `D:/Temp/ipc-whole-review-{build,lint}.log`: passed; inherited bundle advisory remains.
- Full FE attempts timed out at 270s/240s. Neither is a full-suite PASS or proof of a product defect.

### Requirements mapping

| Finding | Priority | Canonical rules | Acceptance owner |
|---|---|---|---|
| P1: raw BOM rate labeled as canonical quantity | Must fix | FR-RECON, FR-WH, FR-CHEF; DOM-GRAIN-1; BR-GLOBAL-02/03; BR-MRX-HIST-1 | Production creation/recompute → persisted contributor → dish/kitchen projection; supplemental UI |
| P2: uncertain supplemental write only recognizes TypeError | Must fix | FR-WH; BR-GLOBAL-03/04; command/replay/version boundary | Real `apiClient` → daily workspace → modal recovery |
| P3: workbook customer identity merged by name | Must fix | FR-WH/FR-REP; DOM-GRAIN-1; BR-GLOBAL-02 | Export service DTO and actual XLSX cells |
| P4: dashboard accepts expired cache as final | Should fix | FR-DASH; BR-GLOBAL-04; scoped query freshness | Dashboard mount/re-entry/network/error behavior |
| P5: summary invokes detailed reads once per batch | Should fix | FR-DASH/FR-RECON; NFR-PERF-01; BR-MRX-TRUTH-1/2 | Relational query count plus exact operational summary results |

## 2. Approaches

**Selected proposal: surgical owner-level repairs, five independently verifiable tasks.** Reuse existing projection policies, API endpoints, cache, modal, workbook builder and lifecycle receipts. P1 needs additive frozen conversion evidence; P5 shares bulk read/projection logic with the existing single-batch reader.

Rejected alternatives:
- FE-only unit conversion, live BOM/unit lookup for historical rates, or `SourceQuantity / FrozenServings`: these cannot recover the exact historical conversion reliably; total source quantity is already rounded to six decimals.
- Retry every failed write with a new command ID: an HTTP failure is not proof of transaction rollback.
- Make customer names unique to simplify export: changes business policy and still uses a display label as identity.
- Raise cache TTL, add polling/realtime/framework, truncate KPI to 20 rows, or parallelize N detailed batch calls: hides or amplifies the problems rather than repairing them.

## 3. Global constraints

- `DEFAULT != MATERIAL_RECONCILIATION` (DOM-MODE-1). MRX issues never check, provision or post physical stock.
- Supported price tiers remain 25000/30000/34000 VND; no price-based quantity scaling.
- Persisted operational quantities round once at the final quantity boundary to 6 decimals, using the existing DecimalPolicy/normalizeQuantity rules. Do not round a per-serving rate to 6 decimals before multiplying servings.
- New operational weeks remain Monday–Saturday; historical Sunday facts remain readable and unchanged.
- Preserve exact batch/daily line/ingredient/canonical unit identity, source revision, reason, actor, mode/version protection and command receipts.
- No automatic rewrite/delete of frozen contributors, issued quantities, movements, dispositions or audit history.
- No packages, new UI family, parallel cache authority, arbitrary TTL increase, permission relaxation, fixture fallbacks, test skips or exemption padding.
- Product UI reuses `frontend/src/styles/index.css`, existing primitives and one blocking modal. Keep D6 >=12px, D7 one primary, T7 sticky headers/identifiers, T8 compact density, M1.2 one blocking modal and N6 sidebar.
- Generated OpenAPI/schema must come from the backend toolchain, never hand edits. Current generation scripts restore tools/use npx; inspect and obtain the required authorization before invoking them.
- Plan generation grants no implementation, migration application, historical backfill, DB access, login, business write, restart, commit, delegation or install authority.

## 4. P1 — explicit frozen conversion evidence

### Current defect and owners

`MrxBatchRecomputer.ContributionFrom` copies raw `material.Bom.GrossQtyPerServing`; `CreateContributor` persists it as `FrozenBomQuantityPerServing`. `ReconciliationBatchQueryProjector.ListDishesAsync` returns that number beside the weekly line's canonical unit. `MrxSupplementalIssueModal` multiplies it directly. The kitchen projection also presents a per-serving rate beside a canonical unit and must not retain the same mismatch.

Example oracle: 100 g/suất, source unit-to-base rate 0.001, canonical kg rate 1. Ten extra servings require **1 kg**, never 1000 kg. Small-rate oracle: 0.0004 g/suất → 0.0000004 kg/suất; 1000 servings require **0.0004 kg**, not zero.

### Proposed persistence and contracts

1. Keep `FrozenBomQuantityPerServing` as the original raw BOM rate. Do not reinterpret old rows or increase its meaning silently.
2. Add nullable decimal(18,6) fields `FrozenBomUnitToBaseRate` and `FrozenCanonicalUnitToBaseRate` to `ReconciliationBatchContributor` and its EF configuration. They snapshot the existing validated Unit.ConvertRateToBase values. Nullable means historical evidence was not captured, not ratio 1.
3. Carry the same two nullable trailing fields on `ReconciliationRevisionContributionFact`; populate both in every production creation/recompute path. Include them in contributor identity comparison so a changed conversion is not mistaken for identical evidence.
4. One internal `FrozenBomQuantityPolicy.TryGetCanonicalPerServing(ReconciliationBatchContributor, out decimal)` is consumed by both dish and kitchen read projections. Compute `raw * frozenBomRate / frozenCanonicalRate` with decimal arithmetic; both rates and raw quantity must be positive. No live BOM/unit lookup or division by rounded source totals. Invalid/overflow evidence is unavailable, not zero or 1.
5. Add `decimal? CanonicalQtyPerServing` and `string? QuantityUnavailableReasonCode` to `ReconciliationBatchDishMaterialDto`. Keep existing `GrossQtyPerServing` raw for compatibility but migrate every in-repo canonical display/calculation to the explicit canonical field.
6. For kitchen rows, `BomQuantityPerServing` becomes nullable and explicitly canonical; add optional `QuantityUnavailableReasonCode`. Preserve `TotalRequiredQuantity` from frozen SourceQuantity. JSON, table, CSV and XLSX render an unavailable per-serving rate as `—`/empty numeric cell, not a raw rate with a kg label. Preserve existing missing/ambiguous lineage checks.
7. Missing/invalid conversion returns reason `FROZEN_UNIT_CONVERSION_MISSING`. A dish package containing unavailable rates cannot submit; known frozen totals/history remain readable. Direct supplemental entry by exact daily line remains available with existing role/reason/version guards.

**Legacy policy proposed for approval:** all old contributors without the conversion pair remain unchanged. They are not certified for automatic by-dish calculation, even if current master data happens to use the same unit. No fabricated backfill. Historical per-serving displays state unavailable; frozen totals remain available. Re-enabling historical automatic calculation requires separately authorized evidence reconciliation, not a migration default.

### Scope reach and acceptance

- Owners: contributor entity/configuration; revision contribution record; recomputer creation and identity; dish and kitchen projections; DTOs; generated API; supplemental modal; `MrxBatchDishesModal`; Chef cooking table and CSV/XLSX builders.
- A newly created and reloaded contributor must retain correct rates after live BOM/unit metadata changes. Source-change recomputation captures new evidence only on open dates; old/locked contributors remain immutable.
- If a dish appears in multiple shifts or contributors, group by existing exact daily identity and require consistent frozen canonical facts; do not silently select a first rate.
- **AC-P1:** production service creation → save/reload → dish and kitchen reads yield 0.1 kg/suất for 100 g/suất; 10 supplemental servings submit 1 kg. The sub-micro example survives multiplication. Missing legacy evidence disables package submission without disabling exact direct entry. DEFAULT stock/movements and historical totals do not change.

Migration design is additive nullable columns only; no UPDATE/backfill/default 1, no automatic startup application. Migration artifact creation and exact-target application/backup/rollback compatibility are separate execution gates. This proposal requires schema deployment before the updated backend can run against that target.

## 5. P2 — sticky unknown-write reconciliation

### State contract

Use the same local state for both initial and supplemental issue submission at the existing daily workspace owner:

`editable → submitting → confirmed | definite-rejection | outcome-unknown`

- A successful HTTP response without a valid `issueId`/`issueCode` receipt is also outcome-unknown; validate before declaring success or closing the modal.
- `outcome-unknown`: transport/unclassified error, API 5xx, `SESSION_CHANGED`, malformed/missing success receipt. It is not merely `TypeError`.
- A definite business/version rejection (e.g. 400/409 with no uncertain prior write) retains the existing correction/reload behavior. Authentication/permission failures remain fail-closed, not automatic retry permission.
- Unknown state is sticky across a background GET, visibility refresh and newer source version. Preserve the entered quantities/reasons and attempted command ID; disable issue submission and scope changes. Closing/reopening an overlay cannot clear it or mint a new command.
- Use existing copy: `Chưa xác nhận được kết quả xuất kho` and `Phiếu có thể đã được ghi. Hãy tải lại để kiểm tra lịch sử trước khi xuất thêm.`
- Recovery uses the existing explicit full reload action, which initiates authoritative daily/history reads; no write is sent during recovery. Do not auto-restore an attempted unknown initial draft as an editable submission after reload. New work requires fresh source/history inspection and explicit user action, not background unblocking.
- Do not add a command-status endpoint or automatically replay the POST. Keep backend command receipt/version checks unchanged.

**AC-P2:** simulate accepted-but-502/503 and network loss at the network boundary, then newer daily version on visibility refresh: no second POST, same draft remains protected, unknown notice remains. Empty 2xx receipt also fences. Existing definite 400/409 correction remains usable. Exact initial and supplemental payload identities/reasons remain unchanged.

## 6. P3 — workbook columns owned by CustomerId

Use stable customer identity throughout preparation export, including the preview DTO and both workbook layouts:

- Add `ReconciliationPreparationCustomerColumnDto(string CustomerId, string CustomerCode, string CustomerName)` and ordered `CustomerColumnDefinitions` to `ReconciliationPreparationWorkbookDto`.
- `CustomerQuantities` dictionary keys become CustomerId. Keep existing `CustomerColumns` as ordered display labels for compatibility; labels are `CustomerCode · CustomerName`. Workbook builders consume definitions for identity lookup, never labels as keys.
- New builders must not silently fall back to name lookup when definitions are missing or inconsistent. Reject an invalid workbook DTO before writing bytes. Generated/handwritten consumers migrate in the same task; document the dictionary-key change as a coordinated wire-contract change, not full backward compatibility.
- Two customer IDs with identical names remain two columns. Multiple selected batches for the same customer add within that customer's column, matching the workbook's customer grain; no change to ingredient/unit/supplier grouping or selected date/week scope.
- Order by customer code then ID using an explicit comparer. Labels distinguish same-name customers. Do not add a customer-name uniqueness rule.
- Preserve numeric XLSX cells and six-decimal values in `Chuẩn bị nguyên liệu`, `Tổng hợp chuẩn bị` and `Chi tiết phân bổ`; preserve menus, source identity and all existing supplier/unit separation.

**AC-P3:** two customer IDs/codes, same name, same ingredient/unit, quantities 2 and 3 → two columns with 2 and 3, total 5. A second batch for the first customer with 0.5 → 2.5 and 3, total 5.5. Inspect actual XLSX headers/cells, not just service DTO. The single-sheet and legacy two-sheet layouts both honor identity. No DB schema change for P3.

## 7. P4 — hydrate, then revalidate dashboard

Keep the current actor/mode/filter/page cache keys and first-render hydration. On every dashboard mount/re-entry and each key transition, start one authoritative read of summary + batch page; do not return a cached payload as the final network result.

- Retain current-key cached data under the existing refreshing treatment; do not reset the header, filters, table selection or focus. A different key cannot show the old key's KPI as current.
- Retain request-generation fencing; a late result/error from an abandoned key must not replace the selected key.
- A failed refresh is visible with retry. Cached facts may remain only with an explicit stale/error treatment and must not drive a current `Mở việc tiếp theo` action until reconciled. No zero-count/empty success fallback.
- Keep the explicit `Làm mới` action and same-session API invalidation. No polling interval, realtime channel, cross-tab cache redesign or TTL increase.

**AC-P4:** mount with cached awaiting count 4, server count 1 → cached first render then network count 1 without manual refresh. Repeat with expired cache and on remount after another actor's write. Failed revalidation exposes error/retry; late customer/filter response cannot overwrite the current view. Existing role-based null metrics remain absent, not zero.

## 8. P5 — bulk data load, one status authority

`ReconciliationReportsService.GetOperationalSummaryAsync` must not call detailed single-batch reads inside its IN_PROGRESS loop.

Proposed shared interface on the existing batch service:

`Task<IReadOnlyDictionary<string, ReconciliationWarehouseDailyDto>> GetWarehouseDailyManyAsync(IReadOnlyCollection<string> ids, CancellationToken token = default)`

- Existing `GetWarehouseDailyAsync(string id, CancellationToken token = default)` delegates to the bulk owner with one ID and preserves null/not-found behavior.
- Bulk-load selected batches, positive daily lines, ingredient/unit metadata, linked issues, confirmed returns, active dispositions, weeks and required revision labels by batch/daily/issue IDs; compose each batch locally. Reuse `ReconciliationNetIssueProjection` and `ReconciliationDailyIssuePolicy` for net issuance and daily/weekly states. No second KPI arithmetic/policy.
- Reports call bulk once for the full filtered IN_PROGRESS set and derive all-scope counts from its results. Queue display remains capped at 10 per type; page size 20 never limits KPI counts. Preserve existing roles, null-versus-zero metrics, filters and links.
- No speculative index/migration, parallel DbContext commands, caching of authoritative results or materialized summary table.
- For the regression workload up to 100 batches, query count must be bounded by the data families, not batch count. A counting EF interceptor is test infrastructure only. Compare 1 and 100 nonempty batches with the same data families; count after fixture setup, not during seeding. No wall-clock SLA assertion in a unit test.
- If exact provider parameter limits require chunking at larger scale, preserve complete counts and cancellation; document a measured need before adding a general chunk/config framework.

**AC-P5:** complete filtered counts and statuses match independent expected facts for untouched, under-issued, over-issued pending/resolved, confirmed-return invalidation, complete and legacy cases. The 100-batch read executes no more SELECTs than the same-family 1-batch read. No per-batch detailed call, no physical-stock access, no changed daily read semantics.

## 9. Verification and acceptance boundaries

Each P1–P5 needs an intended RED on the pre-fix owner and GREEN after repair. Extend the existing strongest owner rather than duplicating the same formula at multiple layers. Do not pre-seed the contributor/receipt/order behavior that the test must prove. FE tests mock only HTTP/apiClient, never the workspace hook/modal under test.

| Lane | Required proof | Explicit limitation |
|---|---|---|
| P1 relational + FE | actual create/recompute/reload and canonical package payload; legacy unavailable branch | SQLite does not certify MySQL migration/concurrency |
| P2 network/DOM | 5xx/network/malformed success + refresh/retry fencing | simulated response loss is not a production incident reproduction |
| P3 DTO + XLSX | duplicate names, distinct identity, actual numeric cells in both layouts | workbook fixtures are not owner workbook acceptance |
| P4 DOM + network | cached hydration, authoritative reload, stale/error/race handling | no realtime guarantee while page stays open |
| P5 relational queries | exact facts + bounded SELECT count | no actual latency/SLA claim without authorized load run |

Relevant frontend/backend suites, build/lint/dependencies, generated API parity and current conformance checks run after implementation with current target authority. Full FE timeouts remain NEEDS_EVIDENCE until a bounded diagnostic and successful real run; do not raise limits/skip tests to manufacture PASS. Named UI contract owners that are absent remain NOT_PRESENT, not substituted by an invented test.

Real actor/mode → control → request → persisted result → reload and actual workbook acceptance remain separately authorized. Matching artifact/schema/readiness checks are required before any approved runtime promotion. No unapproved live test writes, seeding, migration, credentials or restart.

## 10. Approval items and non-goals

Owner review must explicitly acknowledge P1's additive schema and truthful legacy limitation, P3's coordinated dictionary-key contract change, and P2's sticky recovery behavior before implementation. Approval of this text does not apply a migration or authorize historical reconciliation.

Non-goals: repairing the separately unresolved forced-logout incident; recalculating historical issues/BOM quantities; creating tier data; customer rename policy; changing operational days; redesigning pages; DEFAULT procurement/stock changes; deploying; solving all historical U00–U12 acceptance obligations.

Self-review is parent-context only, not independent certification. Five findings map to five plan tasks; operational authority and historical evidence remain explicit gates rather than guessed defaults. `NFR-PERF-01` retains its canonical P75 API <=300ms / first-frame <100ms / screen-data <1s thresholds; query-count regression is structural evidence only, not proof those runtime thresholds pass.
