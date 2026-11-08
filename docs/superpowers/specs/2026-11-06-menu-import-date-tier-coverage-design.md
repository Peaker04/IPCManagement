# Contextual dates, multi-customer menu import and canonical BOM price tiers

Date: 2026-11-06. Direction approved by owner; implementation details below await plan review. Task progress lives only in `.planning/WORK.md`.

## Goal and scope

Repair the existing weekly-menu import and customer-price flow end to end. Current supported amounts are exactly **25000, 30000, 34000 VND**. Make that list extensible from one backend policy, not unrestricted user-entered prices or a new pricing administration subsystem.

Scope: FR-MENU, FR-ADMIN, FR-CAT, FR-RECON; contextual date controls also reach existing FR-WH/FR-COORD/FR-CHEF consumers without changing their business lifecycle. Preserve DOM-MODE-1, BR-MRX-EDIT-1..9, BR-MRX-SERV-1/2, dirty drafts, six UI states and existing API permissions. The prior new-menu entry remains the entry owner; its passing tests did not establish multi-file or pricing completeness.

## Evidence and current owners

- `VietnameseDateInput` parses real dates but silently restores invalid drafts; its calendar has no contextual admission rule. Import's Monday label is not enforced. Screenshot 13/10/2026 is Tuesday, not Monday.
- `WeeklyMenuImportModal` owns one customer/file and summarizes preview counts rather than rendering normalized menu rows. API preview rows and history snapshot rows already exist.
- `WeeklyMenuBatchImportsController` supports 2..10 files with aligned customer/week/tier/token arrays. `CommitPreparedBatchAsync` uses one transaction, verifies tickets, rejects duplicate customer/week scopes, and consumes tokens after commit.
- Batch commit does not use the same existing-MRX source-change branch as single commit. Enabling it in the UI without a boundary repair is unsafe.
- Import/customer-create/BOM controls duplicate tier arrays; customer list uses `defaultMenuPrice || 25000`. Server contract code also supplies 25000 for an empty schedule set and averages historical prices.
- Initial import persists selected tier to `MenuSchedule.MenuPrice`; projection resolves published BOM by customer, tier and effective date. Existing MRX reimport compares dishes/slots, not price changes.

## 1. Canonical tier authority

Keep `DishBomPolicy` as the existing canonical backend owner. Its supported list remains 25000/30000/34000; live validators, template-sheet generation, catalog filtering and `BomSelectionResolver` consume it instead of maintaining separate allowed lists. Preserve established money rounding and exception/HTTP semantics; do not reinterpret quantities, change legacy seed interpretation or alter migrations/defaults in this scope.

Add a small read-only `GET /api/Dishes/bom-price-tiers` action on the existing `DishesController`, with `CatalogReadAccess`, returning `ApiResponse<IReadOnlyList<decimal>>`. No existing response changes shape. Verify current menu-import actors can already use that read policy; do not expand permissions to make the endpoint work. If an intended actor lacks access, stop for a policy decision.

FE uses `bomApi.getSupportedPriceTiers(): Promise<number[]>` and one shared `useSupportedPriceTiers` query hook, backed by the existing query/cache owner. Import, customer create, BOM editor and BOM import are real production consumers. No alternate cache/store or fallback list in the browser. Loading/error/empty tier data is explicit and blocks writes needing a tier. Persisted valid scope can remain readable when refresh fails; never invent a selectable tier from a failed response.

Future extension means adding a supported amount through this backend owner and corresponding sheet/BOM data. It does not mean adding CRUD, arbitrary amounts, nearest-price mapping, or changing historical schedules.

## 2. Customer contract price semantics

- Customer list shows the actual persisted default price. Missing price is `Chưa cấu hình`; zero or unsupported legacy values are not relabeled as 25k or as a usable BOM tier.
- Create-customer retains the existing required contract-price choice, populated by the server list with no preselected amount. Backend rejects a missing/unsupported price before tracking/saving a customer; no fallback 25k or partial customer creation.
- Update with no price field preserves an existing contract price. An explicitly supplied price must be supported. When creating a contract for an existing customer, an absent default may derive only from one distinct supported persisted schedule price; no average and no empty-set 25k. Otherwise require an explicit supported price.
- Read mapping without a contract returns a derived price only for one distinct supported schedule tier; missing/mixed/invalid schedules return null. This is not permission to rewrite existing contracts.
- Existing valid saved contract price may be offered as a clearly visible suggestion for import; it cannot overwrite an explicitly chosen customer/week tier. Initial implementation may require an explicit import choice rather than fetching another contract family merely to prefill it.
- Preserve existing customer-week invariants and locked-schedule fences. This task must not cause contract edits or new tier metadata to reprice existing imported/frozen weeks. No migration or bulk repair of legacy prices.

## 3. Contextual date admission

Extend the existing primitive, not a replacement date picker:

- Real calendar validity, Vietnamese display and literal ISO date-only transport remain shared concerns.
- Honor optional min/max and an optional `isDateAllowed(isoDate)` predicate consistently for typed input, calendar days and Today. A disallowed draft remains visible with an accessible error, does not emit a valid date, and reports invalidity to the owning form so an old accepted value cannot authorize submit.
- No global minimum of today. Valid historical dates remain selectable by default.
- Import/template week starts require Monday in FE and server validation. `13/10/2026` is rejected with a useful message, never silently shifted to 12/10. `12/10/2026` is valid regardless of being historical, subject to actual workflow locks.
- Nonempty malformed request dates must fail instead of silently becoming an absent fallback. An omitted optional API week may still be inferred from a workbook, but the resulting week must satisfy the import boundary and match the requested week when supplied.
- Weekly viewing selectors use Monday for newly selected week keys; existing legacy URL/history scopes remain readable and are not rewritten. Service-day filters (orders, chef, reports/history) do not inherit the Monday or future-date restriction.
- Daily MRX actions use the selected batch's authoritative date bounds/available dates. Read-only history stays accessible; issue/source writes still obey existing server locks and permissions, not the client's clock. Do not infer missing bounds as today.

## 4. One import surface, multiple independently scoped items

Retain `WeeklyMenuImportModal`, its history/rollback tab and both MRX/DEFAULT callers. Within it, represent 1..10 file items with stable local identity and per-item customer, Monday week, supported tier, file, preview status and server result. This is form state, not a global store or parallel importer.

The user adds/removes file items and chooses each scope. Do not assume one workbook applies to every customer. Selecting the same workbook for several scopes is explicit and still validated by the parser; do not infer customer identity from filenames. A workbook with multiple customer sheets is not a new automatic bulk-discovery feature in this scope.

Layout: file/scope rows -> selected item's normalized menu preview -> common footer. One blocking modal, one body scroller, existing primitives and semantic tokens. Header/footer remain reachable at supported viewports.

Preview shows actual server rows grouped by service date, shift and variant/slot, including duplicate occurrences and source-location diagnostics; no deduplication by dish name and no fabricated servings. Display chosen/validated tier and sheet so the user knows which BOM family applies. Missing BOM/reference-price information, when supplied by the existing authorities, is explicit; menu import is not a claim that quantity preparation is complete. Existing quantity-preview gate remains authoritative for missing BOM/split servings.

Changing file/customer/week/tier invalidates only that item's preview/token immediately. Ignore stale responses after edit/remove/close; stale results may never enable commit. Failed previews retain other input for correction. Dirty exit, pending close lock and request single-flight use existing owners.

## 5. Commit boundaries and honest results

- One item uses the current single commit endpoint. Several items use existing atomic commit-batch, never a loop of single commits. All items must have a current, valid, unexpired preview and unique customer/week scope; server repeats validation.
- Multi-file MRX import initially supports scopes with **no existing reconciliation batch**. If any item already has an MRX batch, reject the entire group before writes with customer/week and guidance to the existing single reimport path. This deliberate boundary avoids inventing mixed approval/atomic-apply semantics. Repeat the boundary inside the protected transaction/retry path; a batch created after preview cannot open a bypass.
- Single existing-batch reimport keeps source-change roles, approval and locked-date checks. If selected tier differs from the authoritative persisted week tier, reject explicitly before `UNCHANGED` classification. Changing the tier of an existing MRX batch is not supported by the current source-change DTO; do not fake success or introduce a second reprice path.
- New weeks can use any currently supported tier. Existing completed/frozen quantities remain unchanged.
- Multi-file commit saves drafts atomically; disable automatic publishing for that mode with a visible explanation. Publication is a separate transition, not part of the database import transaction.
- Retain single-file optional publication, but a publication failure after a successful commit must be reported as `Đã nhập, chưa công bố`, not swallowed or presented as a failed import that invites duplicate commit. Retain the committed result with an open-week action; do not permit another import commit for that accepted result.
- Multi success displays committed customer/week/tier results and lets the user choose which week to open. The existing optional scope callback remains for the selected week; closing without selecting preserves the inspected scope and refreshes it when needed. Invalidate affected caches through the existing API/cache owner, not a new store. DEFAULT may keep refresh-only handling; history rollback sends no scope.

## Acceptance and proof ownership

| Contract | Strongest intended owner |
|---|---|
| Calendar invalidity and contextual admission, no global future cutoff | Existing FE `Primitives.test.tsx`, plus real importer submit test for invalid drafts |
| Week validity/file mismatch, supported tier and selected sheet/token binding | Existing backend parser/controller/ticket tests |
| Missing/mixed contract price is not fake 25k; explicit customer-create price | Existing workflow contracts test and FE AdminCustomers test |
| Correct normalized preview and per-item token invalidation | Existing real importer tests at network/DOM boundary |
| Atomic group rollback and duplicate/replayed token rejection | Existing backend batch tests, not a mocked persistence claim |
| Existing-batch group rejection and single reimport tier rejection | Existing backend reimport/batch harness |
| Different tier -> different effective ingredient quantity | Existing BOM selection/projection tests with independent quantities |
| Old completed/frozen facts, route-scope/cache and DEFAULT compatibility | Existing MRX application-path/FE owner tests |
| Real file/actor/mode -> request -> persisted scope -> reload | Owner-authorized isolated runtime; not proved by unit tests |

No source-text assertion matrices, component-under-test mocks, generated expected values, test-only seams, skip/allowlist padding or synthetic production evidence.

## Exclusions and execution prerequisites

No package installation, subagents, commits, schema/data migration, seed, mode switch or real authenticated business write is authorized by this design. Preserve inherited dirty files and existing server processes. Check disk/memory before heavy work: last measured C: free was 0.39GB. Do not solve that by unauthorized cleanup.

New endpoint metadata/types must be generated using available installed tooling. Root `gen:api` invokes restore/npx and cannot be run blindly under the no-install constraint; unavailable tools are a disclosed blocker, not permission to hand-edit generated schema. Local build/tests do not refresh the running backend artifact automatically; runtime restart/rebuild and live writes remain separate approval/evidence boundaries.
