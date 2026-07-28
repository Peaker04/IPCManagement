# Phase 9: Supplier canonical refresh and purchasing workflow alignment - Research

**Researched:** 2026-07-21  
**Domain:** XLSX provenance reconciliation, supplier master data, purchasing approvals, purchase orders, and warehouse receiving  
**Confidence:** HIGH for repository/workbook findings; MEDIUM for implementation decomposition until the proposed Phase 9 requirement IDs are accepted

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Canonical supplier and Excel normalization
- **D-09-01:** The canonical supplier set is SUMMARY suppliers plus data-bearing sheets such as `Vịt a Việt`; a SUMMARY header row, pseudo-suppliers and unreferenced placeholders are not canonical suppliers.
- **D-09-02:** In the purchase workbook, `Tên hàng` is an ingredient name, not a dish or supplier. Normalize whitespace and sentence-style casing while keeping supplier identity in a separate field sourced from deterministic SUMMARY/sheet mapping.
- **D-09-03:** Embedded supplier text may be split from an ingredient only when an approved mapping produces an unambiguous result. Ambiguous rows retain raw source evidence and block apply instead of being guessed.
- **D-09-04:** Units use a controlled alias table. Known spelling variants normalize deterministically; unknown or ambiguous values such as `kh` or `canh` block with sheet/row/raw-value evidence. There is no silent `KG` fallback.
- **D-09-05:** `BICH` remains a canonical packaging unit, but package size is scoped by ingredient, supplier and effective period. The transaction snapshots its conversion. A plain `BICH` row without package size is allowed only when no cross-unit conversion is required.
- **D-09-06:** Delivery dates may be historical and may extend at most seven days past the workbook as-of date. Outliers such as 2035 block; they are not clamped, deleted or silently skipped.

### Historical reconciliation and cleanup
- **D-09-07:** The 20.7 workbook supersedes the 19.5 workbook for purchase-history sample import. Reconciliation uses deterministic source/business keys and a source hash/manifest rather than filename-only identity.
- **D-09-08:** Existing linked, approved, received or otherwise immutable operational history keeps its snapshot. A changed source row becomes an explicit correction/version where necessary; it is not overwritten destructively.
- **D-09-09:** Hard deletion is limited to true sample-generated orphans absent from the new source and proven to have no operational dependency. Referenced legacy catalog data is remapped or deactivated.
- **D-09-10:** Apply requires backup/restore evidence, a fresh database fingerprint and exact preview counts. The second apply and the post-apply preview must be no-op.

### Purchasing workflow and approval gates
- **D-09-11:** The operational sequence is: finalize shift servings → generate date-specific demand → manager approves demand in `/approvals` → approved shortage becomes actionable in `/purchasing` → purchasing confirms supplier/price/delivery → price exception approval when required → submit purchase request → manager approves purchase request → create supplier-split purchase orders → warehouse receives.
- **D-09-12:** Material demand must appear in the approval inbox and be approved before it can be selected to create a purchase request. Weekly Menu shows approval status and links to the relevant approval work.
- **D-09-13:** Purchasing uses week as its primary scope and presents nested service dates with shortage and workflow status. Each purchase request remains tied to one service date with `FULLDAY` scope.
- **D-09-14:** Supplier suggestion uses only an effective quotation or the latest valid matching receipt. The user explicitly confirms every supplier selection. The current arbitrary first-active-supplier fallback must be removed.
- **D-09-15:** A price increase above 15 percent creates an auditable exception containing reference price, proposed price, variance, evidence, reason and manager decision. It must have a resolvable action instead of a dead-end warning.
- **D-09-16:** The Purchasing page becomes a guided sequence rather than five disconnected tabs, while preserving route, authorization and server-backed state.

### Import exposure and operational ownership
- **D-09-17:** This phase updates the Development/sample importer and adds a guarded preview/dry-run/apply reconciliation path. It does not expose a production local-filesystem path or build the final Admin upload surface.
- **D-09-18:** Purchasing owns supplier choice, pricing and purchase-order handoff. Warehouse owns actual receiving, including destination warehouse, quantity, lot, manufacture date and expiry date. Purchasing sees read-only ordered/partially-received/received progress.

### the agent's Discretion
- Exact component names and the compact visual representation of the guided workflow, provided it uses existing IPC/shadcn-style primitives and preserves Vietnamese operational clarity.
- Internal representation of source-row identity, normalization diagnostics and price-exception records, provided preview/apply share one policy and all decisions remain auditable.
- The bounded alias vocabulary, after tests prove every accepted alias and every blocked ambiguous value.

### Deferred Ideas (OUT OF SCOPE)
- Production Admin workbook upload remains owned by the canonical upload/cutover phases.
- Repository-wide dish-name normalization outside the purchase workbook remains owned by BOM/menu canonicalization.
- The weakly matched todo `weekly-menu-browser-uat.md` is not folded into Phase 9; Phase 9 will define its own focused E2E evidence.
</user_constraints>

## Summary

Phase 9 should be planned as two coordinated backend-first slices: a pure, preview-first purchase-history reconciliation pipeline, followed by an operational purchasing state machine that makes demand approval, supplier evidence, price exceptions, purchase-order creation, and warehouse receiving explicit. The current importer directly mutates suppliers, receipts, receipt lines, stock movements, and current stock while silently skipping or inventing values; the current purchasing generator also assigns the first active supplier when evidence is absent. Those paths cannot satisfy the locked provenance, immutability, and explicit-confirmation rules without introducing durable reconciliation and decision records. [VERIFIED: codebase inspection] (Confidence: HIGH)

The canonical 20.7 workbook has 34 sheets, including `SUMMARY`, `NGUỒN`, 31 named supplier sheets, and the data-bearing `Vịt a Việt` sheet. The `SUMMARY` range includes a header-like `Nhà Cung Cấp` row that the current importer accepts as a supplier. The workbook also contains ambiguous unit values and large padded worksheet dimensions, so the parser must retain source row evidence, identify real business rows, and block unresolved data rather than treating worksheet XML row counts as valid records. [VERIFIED: direct XLSX ZIP/XML audit] (Confidence: HIGH)

The implementation order must be: characterize and test current behavior; add forward-only persistence for source manifests, normalization evidence, package snapshots, supplier confirmation, and price exceptions; implement pure preview and guarded transactional apply; add approval targets and purchase workflow contracts; converge receiving into a Warehouse-authorized transaction; then update RTK Query and the four existing routes. This keeps the UI from encoding temporary contracts and makes every stage independently verifiable. [VERIFIED: codebase inspection; 09-CONTEXT.md; 09-UI-SPEC.md] (Confidence: HIGH)

**Primary recommendation:** Build one deterministic policy engine used by both preview and apply, and one server-authoritative purchasing workflow read model used by Weekly Menu, Approvals, Purchasing, and Warehouse. [VERIFIED: locked decisions D-09-07 through D-09-18] (Confidence: HIGH)

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Workbook parsing and normalization | API / Backend | Static source file | The server owns trusted parsing, aliases, row evidence, and block diagnostics; the workbook is an immutable input. [VERIFIED: current sample importer and D-09-17] |
| Preview manifest, database fingerprint, and apply | API / Backend | Database / Storage | Classification must be shared by preview/apply, while the database stores runs, evidence, versions, and audit state. [VERIFIED: D-09-07 through D-09-10] |
| Supplier master reconciliation | Database / Storage | API / Backend | Canonical identity and dependencies are persistent; the API classifies remap/deactivate/delete safely. [VERIFIED: current EF model and D-09-01/D-09-09] |
| Material-demand and price-exception approval | API / Backend | Database / Storage | Authorization, state transitions, reasons, and decisions must be server authoritative and auditable. [VERIFIED: current approval handlers and D-09-11/D-09-15] |
| Week/date purchasing workbench | Browser / Client | API / Backend | The browser presents guided navigation; the API computes authoritative stage, shortage, blockers, and totals. [VERIFIED: 09-UI-SPEC.md and current RTK Query pattern] |
| Supplier suggestion and confirmation | API / Backend | Browser / Client | The API returns evidence-backed candidates; the user confirms in the browser and the server snapshots the decision. [VERIFIED: D-09-14] |
| PR approval and supplier-split PO creation | API / Backend | Database / Storage | These are transactional business-state transitions with uniqueness and audit requirements. [VERIFIED: PurchaseRequestWorkflowService and PurchaseOrderService] |
| Physical receipt and lot traceability | API / Backend | Browser / Client | Warehouse submits destination, quantity, lot, manufacture, and expiry; the server updates receipt, PO progress, and stock atomically. [VERIFIED: D-09-18 and current receipt services] |
| Cache refresh after mutations | Browser / Client | API / Backend | RTK Query tags should invalidate affected week/date/detail queries after authoritative writes. [CITED: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching] |

<phase_requirements>
## Phase Requirements

The roadmap currently leaves Phase 9 requirement IDs as TBD, so the planner should first add/accept the following phase-specific IDs in `REQUIREMENTS.md` and map them in `ROADMAP.md`; the descriptions below operationalize the locked decisions without expanding scope. [VERIFIED: `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, and 09-CONTEXT.md] (Confidence: HIGH)

| ID | Description | Research Support |
|---|---|---|
| SUP-01 | Derive the canonical supplier set from audited `SUMMARY` policies plus approved data-bearing sheets, excluding headers, pseudo-suppliers, and unreferenced placeholders. | Workbook audit, canonical-set policy, dependency classification. |
| SUP-02 | Parse and normalize ingredient, supplier, unit, package size, and delivery date deterministically, preserving raw sheet/row evidence and blocking ambiguity. | Pure parser boundary, controlled aliases, package/date rules. |
| SUP-03 | Produce a read-only preview manifest with source SHA-256, policy version, as-of date, database fingerprint, exact action counts, diagnostics, and backup/restore evidence requirement. | Preview/apply contract and drift controls. |
| SUP-04 | Apply the accepted manifest atomically with dependency-aware retention/versioning and prove second apply plus post-apply preview are no-op. | Transaction, immutable-history, and idempotency patterns. |
| PUR-01 | Make material demand a first-class approve/reject target in `/approvals`, expose status/link in Weekly Menu, and forbid unapproved demand from PR creation. | Approval registry gap and sequence D-09-11/D-09-12. |
| PUR-02 | Expose a server-backed week workbench with nested service dates, `FULLDAY` PR scope, shortage, stage, blocker, and count data. | UI contract and current date-specific demand behavior. |
| PUR-03 | Suggest suppliers only from an effective quotation or latest valid matching receipt and persist explicit user confirmation with evidence snapshot. | Current first-active fallback and non-null supplier gap. |
| PUR-04 | Persist and resolve price increases strictly above 15% through an auditable manager-approved exception before PR submission. | Current `>= 15` dead-end warning gap. |
| PUR-05 | Create at most one supplier-split PO set from an approved PR and return existing progress safely on retries. | Existing grouping/unique constraints and retry risk. |
| WHR-01 | Make Warehouse the sole owner of partial receiving with warehouse, quantity, lot, manufacture date, and expiry; update PO progress and stock atomically while Purchasing remains read-only. | Two conflicting current receipt paths and D-09-18. |
| PUI-01 | Implement the approved six-stage guided UI on existing routes/primitives with URL-restorable week/date/stage state, bounded tables, accessible dialogs, and focused E2E evidence. | 09-UI-SPEC.md and existing frontend architecture. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Before editing any function, class, or method, run GitNexus upstream impact analysis for that symbol; report direct callers, affected processes, and risk. Warn and pause for user awareness on HIGH or CRITICAL results. [VERIFIED: AGENTS.md]
- Use GitNexus concept queries for unfamiliar flows and symbol context for caller/callee detail. The index was stale relative to the current commit during research, so re-run `node .gitnexus/run.cjs analyze` before plan execution and treat existing semantic results as approximate. [VERIFIED: AGENTS.md and GitNexus status]
- Run GitNexus `detect_changes()` before every commit, using comparison against `main` for regression scope. Never rename symbols by text replacement; use graph-aware rename. [VERIFIED: AGENTS.md]
- Follow the always-on Karpathy, Git workflow, GitNexus, C#/.NET, TypeScript/React, and controller API rules in `.cursor/rules/`; changes must be minimal, explicit, conventional-commit scoped, and tested against a stated success signal. [VERIFIED: AGENTS.md and `.cursor/rules/` inspection]
- Preserve the pre-existing dirty files `README.md`, `frontend/README.md`, `.cursor/`, and `backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql`; do not stage, overwrite, or treat them as Phase 9 work. [VERIFIED: git status at research start and canonical references]

## Standard Stack

### Core

| Library / facility | Version | Purpose | Why Standard |
|---|---:|---|---|
| ASP.NET Core | .NET 9 target; SDK 10.0.300 available | Development-only APIs, authorization, validation, orchestration | Existing backend host and controller conventions; no new host is needed. [VERIFIED: API csproj and environment probe] |
| Entity Framework Core | 9.0.16 | Forward migration, transactional reconciliation, persistent workflow state | Existing ORM and transaction boundary. [VERIFIED: API csproj] |
| Pomelo.EntityFrameworkCore.MySql | 9.0.0 | MySQL provider and migrations | Existing provider; schema work must stay compatible with the current database. [VERIFIED: API csproj] |
| `XlsxWorkbookReader` | repository implementation | Package-free XLSX ZIP/XML reading with row metadata | Already preserves sheet/row mechanics; extend policy around it instead of replacing it. [VERIFIED: codebase inspection] |
| SHA-256 from .NET BCL | platform | Source hash, manifest identity, deterministic evidence fingerprints | Standard cryptographic hash implementation; do not hand-roll hashing. [CITED: https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.sha256] |
| React / React Router | installed 19.2.7 / 7.17.0 | Existing route surfaces and URL-restorable workflow navigation | Existing frontend stack; `useSearchParams` writes state into navigable URLs. [VERIFIED: `npm ls`; CITED: https://reactrouter.com/api/hooks/useSearchParams] |
| Redux Toolkit RTK Query | installed 2.12.0 | Server state, mutations, tag invalidation | Existing workflow API pattern; tag invalidation refetches active subscribers. [VERIFIED: `npm ls` and codebase; CITED: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching] |

### Supporting

| Library / facility | Version | Purpose | When to Use |
|---|---:|---|---|
| Existing IPC local UI primitives / `@base-ui/react` | local / 1.5.0 | Dense guided workbench, dialogs, alerts, tables | Reuse on all Phase 9 screens; do not initialize another component system. [VERIFIED: 09-UI-SPEC.md and `npm ls`] |
| Tailwind CSS | installed 4.3.0 | Existing semantic styling | Use existing tokens, spacing, typography, and responsive rules only. [VERIFIED: `npm ls` and 09-UI-SPEC.md] |
| FluentValidation.AspNetCore | 11.3.0 | Request-boundary validation where repository patterns already use validators | Validate apply tokens, reason/evidence input, quantities, dates, and IDs at the API boundary. [VERIFIED: API csproj and codebase conventions] |
| Vitest | installed 4.1.10 | Frontend model/hook tests | Pure stage mapping, threshold, URL state, and mutation/cache behavior. [VERIFIED: `npm ls` and frontend scripts] |
| Playwright | installed 1.60.0 | Focused cross-route workflow/E2E evidence | Verify Weekly Menu → Approvals → Purchasing → Warehouse ownership and recovery. [VERIFIED: `npm ls` and frontend scripts] |
| xUnit test project | net9.0 project | Backend characterization, policy, service, authorization, transaction tests | Add dedicated Phase 9 test files before implementation. [VERIFIED: backend test project inspection] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Existing XLSX reader | Add a spreadsheet parsing package | Rejected: no missing parser capability justifies package/supply-chain/schema churn; the real gap is policy, evidence, and reconciliation. [VERIFIED: XlsxWorkbookReader and D-09-17] |
| RTK Query invalidation | Mirror server state in a new client store | Rejected: duplicates authoritative workflow state and conflicts with the approved UI contract. [VERIFIED: 09-UI-SPEC.md; CITED: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching] |
| Forward migration | Rewrite existing migrations or cleanup SQL | Rejected: unsafe for already-applied databases and conflicts with preserving user-owned cleanup work. [VERIFIED: migration history and AGENTS.md dirty-worktree constraint] |
| One canonical Warehouse receipt transaction | Keep both PO receipt and PR receipt mutations | Rejected: two writers can diverge PO progress, inventory receipt, and stock state. [VERIFIED: PurchaseOrderService and InventoryReceiptService inspection] |

**Installation:** No new packages. Use the existing solution/workspace dependencies. [VERIFIED: repository manifests and phase scope]

## Package Legitimacy Audit

Not applicable: the prescribed Phase 9 plan installs no external package. Existing dependencies are already declared in repository manifests, and the XLSX path remains package-free. [VERIFIED: API/frontend manifests and D-09-17]

**Packages removed due to [SLOP] verdict:** none.  
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
20.7 XLSX (server-known Development source)
       |
       v
Xlsx row metadata -> Pure normalization/policy engine
       |                     |
       | valid               | ambiguous/invalid
       v                     v
Source/business keys      Blocking diagnostics
+ raw evidence           (sheet/row/raw value)
       |
       v
Preview classifier <--- AsNoTracking database dependency snapshot
       |
       v
Manifest {source hash, policy version, as-of, DB fingerprint,
          exact actions/counts, blockers, backup evidence requirement}
       |
       +-- blockers/drift/no backup --> reject apply
       |
       v
Transactional apply -> reconciliation run/evidence -> suppliers/history/stock
       |
       v
No-op re-preview + no-op second apply proof

Final servings -> date demand -> material-demand approval
       |
       v
Approved shortage -> week/date purchasing read model
       |
       v
Evidence candidates -> explicit supplier confirmation
       |
       v
Proposed price -- >15%? -- yes --> durable price exception -> manager decision
       |                  no/approved |
       +------------------------------+
                       |
                       v
Submit PR -> manager approval -> supplier-split POs
                       |
                       v
Warehouse receipt transaction {warehouse, qty, lot, mfg, expiry}
                       |
                       v
Inventory receipt + stock ledger + PO received progress
                       |
                       v
Purchasing read-only progress via RTK Query invalidation
```

The diagram assigns parsing and decisions to the API, persistence and uniqueness to the database, and presentation/navigation to the browser. No client state is allowed to become the workflow source of truth. [VERIFIED: repository architecture and 09-UI-SPEC.md] (Confidence: HIGH)

### Recommended Project Structure

```text
backend/src/IPCManagement.Api/
├── Services/SampleData/
│   ├── PurchaseHistorySourceParser.cs          # pure row parsing/evidence
│   ├── PurchaseHistoryNormalizationPolicy.cs   # aliases, date/package rules
│   └── PurchaseHistoryReconciliationService.cs # preview/apply orchestration
├── Services/Approvals/
│   ├── ApprovalHandlers.cs                     # material demand + price exception
│   └── ApprovalInboxService.cs                 # actionable targets/history
├── Services/Workflow/
│   ├── PurchaseRequestWorkflowService.cs       # evidence/confirmation/submit
│   ├── PurchaseOrderService.cs                 # idempotent supplier split
│   └── PurchaseReceivingService.cs             # one warehouse-owned writer
├── Controllers/
│   ├── SampleDataController.cs                 # Development preview/apply
│   ├── PurchaseWorkflowController.cs           # week/date read model/actions
│   └── WarehousePurchaseReceiptsController.cs  # Warehouse authorization
├── Models/                                     # forward-only entities/configuration
└── Migrations/                                 # Phase 9 forward migration

frontend/src/features/
├── projects/weekly-menu/demand/                # approval status/link
└── workflow/
    ├── api/workflowApi.ts                      # types/endpoints/tags
    ├── approvals/                              # demand + exception decisions
    ├── purchasing/                             # six-stage guided workbench
    └── warehouse/                              # PO receiving form/progress

backend/tests/IPCManagement.Api.Tests/
├── PurchaseHistoryReconciliationTests.cs
├── MaterialDemandAndPriceExceptionApprovalTests.cs
├── SupplierDecisionWorkflowTests.cs
└── WarehousePurchaseReceivingTests.cs
```

Names are recommended boundaries, not permission to create parallel abstractions when an existing file can own the behavior cleanly; the executor must run GitNexus impact before choosing the exact edit site. [VERIFIED: AGENTS.md and repository structure] (Confidence: HIGH)

### Pattern 1: One Pure Policy for Preview and Apply

**What:** Parse each real business row into an immutable candidate containing workbook hash, sheet name, row number, raw cells, normalized values, source key, business key, and diagnostics. Preview classifies candidates against a read-only database snapshot; apply rebuilds the same classification and refuses drift. [VERIFIED: D-09-02 through D-09-10]  
**When to use:** Every supplier/purchase-history reconciliation action.  
**Example:**

```csharp
// Source: repository pattern + locked Phase 9 policy; illustrative signature.
var preview = await reconciler.PreviewAsync(source, asOf, cancellationToken);
if (preview.Blockers.Count != 0) return Blocked(preview);

await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
var current = await reconciler.RebuildPreviewAsync(source, asOf, cancellationToken);
RequireSameSourcePolicyFingerprintAndCounts(preview.Manifest, current.Manifest);
RequireVerifiedBackup(preview.Manifest.BackupEvidence);
await reconciler.ApplyActionsAsync(current.Actions, cancellationToken);
await tx.CommitAsync(cancellationToken);
```

EF Core supports explicit transactions and savepoints around `SaveChanges`; optimistic concurrency tokens provide an additional stale-write signal, but they do not replace the required domain fingerprint/count comparison. [CITED: https://learn.microsoft.com/en-us/ef/core/saving/transactions; CITED: https://learn.microsoft.com/en-us/ef/core/saving/concurrency] (Confidence: MEDIUM)

### Pattern 2: Version Immutable History; Mutate Only Safe Catalog State

**What:** Treat linked/approved/received receipts, lines, movements, PRs, and POs as historical snapshots. A corrected workbook row creates a correction/version relationship or leaves history unchanged while updating future-facing canonical catalog mappings. Only proven sample-generated, source-absent, dependency-free orphans may be deleted. [VERIFIED: D-09-08/D-09-09 and current dependency graph]  
**When to use:** Reconciliation actions involving an existing supplier, receipt line, stock movement, or current stock.  
**Planner consequence:** Define the exact dependency query and action matrix before writing an `UPDATE` or `DELETE`; unit tests must cover every action class. [VERIFIED: locked policy]

### Pattern 3: Persist Supplier Evidence and Explicit Confirmation

**What:** Return zero or more supplier candidates with evidence type (`quotation` or `receipt`), evidence ID/date/price/unit, effective date, and explanation. Keep a draft line unconfirmed until the user chooses; persist who confirmed, when, and the evidence snapshot. [VERIFIED: D-09-14 and current fallback behavior]  
**When to use:** Each shortage line before PR submission.  
**Schema recommendation:** Make draft supplier optional and add durable confirmation/evidence fields or a single `PurchaseLineSupplierDecision` owned by the PR line. Backfill existing non-null historical PR lines as legacy snapshots, never as newly user-confirmed decisions. [VERIFIED: current non-null `Purchaserequestline.SupplierId`; ASSUMED] (Confidence: MEDIUM)

### Pattern 4: Durable Price Exception State Machine

**What:** Store reference price/unit/evidence, proposed price, rounded variance, reason, requester, status, manager decision/reason/time, and proposal version. A changed supplier/price invalidates the prior pending decision and creates a new version; an approved matching exception unblocks submission. [VERIFIED: D-09-15 and current transient price-alert gap]  
**When to use:** Only when `variance > 15m`; exactly 15% is not an exception under the locked decision. [VERIFIED: D-09-15]  
**Required correction:** The current helper returns true for `variancePercent >= 15`; do not globally change it without impact analysis because reports and approval handlers also call it. Add a purchase-policy predicate or deliberately migrate every affected caller with tests. [VERIFIED: WorkflowReportCalculator callers] (Confidence: HIGH)

### Pattern 5: One Warehouse-Owned Receiving Transaction

**What:** A dedicated Warehouse-authorized endpoint accepts PO line quantities plus warehouse, lot, manufacture date, and expiry. One transaction creates inventory receipt/lines, updates PO received quantities/status, and writes stock ledger/current stock; retries use an idempotency key or persisted receipt identity. [VERIFIED: D-09-18 and current split service behavior]  
**When to use:** Partial or final receiving against supplier-split purchase orders.  
**Authorization consequence:** Do not add a Warehouse policy to an action under a controller already carrying Purchasing policy, because both attributes would be required. Split the receipt controller or decorate actions from a neutral authenticated controller boundary. [VERIFIED: current controller authorization shape; CITED: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies] (Confidence: HIGH)

### Pattern 6: Server-Authoritative Week Read Model, URL-Authoritative Navigation

**What:** One paged endpoint returns week summary, nested service dates, stage/status counts, approved shortages, blockers, and receipt progress. The browser stores only navigation/form state; `week`, `date`, and `stage` use URL search parameters. Mutations invalidate scoped RTK Query tags. [VERIFIED: 09-UI-SPEC.md and current frontend architecture; CITED: https://reactrouter.com/api/hooks/useSearchParams; CITED: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching]  
**When to use:** `/weekly-menu`, `/approvals`, `/purchasing`, and Warehouse cross-links.

### Anti-Patterns to Avoid

- **Silent normalization or skip:** Never create an arbitrary unit, clamp a date, trim an ingredient into a guessed supplier, or increment only `RowsSkipped`; emit a row-level blocker with raw evidence. [VERIFIED: current importer gaps and D-09-03/D-09-04/D-09-06]
- **Filename-only or row-number-only identity:** Row numbers can shift between workbooks; identity must include source hash/manifest and deterministic business/source keys. [VERIFIED: D-09-07]
- **Preview code path separate from apply:** Two policies allow a preview/apply mismatch. Rebuild the same plan at apply and compare exact identity/counts. [VERIFIED: D-09-10]
- **Destructive overwrite of linked history:** The current receipt-line/movement update path changes snapshots and stock deltas; Phase 9 must version or retain them. [VERIFIED: SampleDataImportService inspection]
- **Arbitrary active-supplier fallback:** Remove `activeSuppliers.FirstOrDefault()` behavior; an empty evidence set is a visible unresolved decision. [VERIFIED: PurchaseRequestWorkflowService inspection]
- **Transient price warning:** A disabled `price-alert` row without a handler/reason/decision cannot be a gate. [VERIFIED: ApprovalInboxService and ApprovalPage inspection]
- **Five-tab client workflow:** Do not retain disconnected local tabs as the operational model; implement the approved six stages and server-derived status. [VERIFIED: current PurchasingPage and 09-UI-SPEC.md]
- **Receiving from Purchasing:** Do not leave editable receipt quantity/warehouse controls in `usePurchaseOrders`; Purchasing gets read-only progress. [VERIFIED: current frontend hook and D-09-18]
- **Production path/upload exposure:** Do not add local path input, Admin upload, or remove the current Development and production-hide guards. [VERIFIED: SampleDataController, middleware, and D-09-17]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| XLSX package replacement | A second workbook parser or a new dependency | Existing `XlsxWorkbookReader` plus a pure domain policy layer | Reader already exposes sheet/row metadata; policy is the missing capability. [VERIFIED: codebase] |
| Cryptographic source hash | Custom checksum | .NET `SHA256` | Correct, standard platform primitive. [CITED: https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.sha256] |
| Transaction management | Manual compensating writes across services | EF Core explicit transaction, existing DbContext, unique indexes | Prevents partial receipt/reconciliation state and uses existing infrastructure. [CITED: https://learn.microsoft.com/en-us/ef/core/saving/transactions] |
| Concurrency/drift | Trust a preview token string | Fresh domain fingerprint plus exact manifest comparison; optionally EF concurrency token | Domain drift spans multiple tables and counts. [CITED: https://learn.microsoft.com/en-us/ef/core/saving/concurrency; VERIFIED: D-09-10] |
| Approval engine | One-off booleans in each page | Existing approval registry/handlers/history extended with typed targets | Centralizes permissions, decisions, history, and inbox behavior. [VERIFIED: codebase] |
| Client cache/state | Parallel Redux slices or local copies of server rows | Existing RTK Query endpoints/tags | Avoids stale duplicated server state. [CITED: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching] |
| UI kit/table primitives | New shadcn init, grid framework, or ad hoc modal | Existing IPC primitives and bounded pagination | Approved visual/interaction contract forbids a second system. [VERIFIED: 09-UI-SPEC.md] |
| Stock/PO receipt writer | A third inventory mutation path | One canonical Warehouse receiving service reusing existing ledger invariants | Avoids divergent stock and PO progress. [VERIFIED: current two receipt paths] |

**Key insight:** The difficult part is not reading cells or drawing stages; it is preserving identity, evidence, authorization, and state-transition invariants across retries and historical dependencies. [VERIFIED: locked decisions and codebase gap analysis] (Confidence: HIGH)

## Runtime State Inventory

This phase changes persisted identities and migrates behavior, so repository grep alone is insufficient. The planner must repeat the live inventory immediately before preview/apply. [VERIFIED: phase scope and verification protocol]

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | The recorded `ipc_lane1` baseline contains 64 suppliers, 35 active, 29 inactive `-2` duplicates, and accidental active `Nhà Cung Cấp`; receipts, receipt lines, stock movements/current stocks, quotations, PR lines, POs, and approval/audit rows can reference supplier/history IDs. [VERIFIED: 09-CONTEXT.md and EF model inspection] | Data migration: classify each dependency, retain/version immutable history, remap/deactivate referenced catalog rows, delete only proven sample orphans. Code edit: stop producing invalid identities. Recount against the actual target immediately before planning/apply. |
| Live service config | Sample import is exposed at `/api/sample-data/import`, requires `CatalogAccess`, returns 403 outside Development, and is hidden as 404 outside Development by middleware. No production Admin upload surface is in scope. [VERIFIED: SampleDataController and SampleDataProductionGuardMiddleware] | Preserve both guards. Add preview/apply beneath the same Development-only boundary and require server-known source identity; verify deployed environment before apply. No external UI/database-only service configuration was found in repository research. [VERIFIED: codebase inspection] |
| OS-registered state | A local API process was running and locked the Debug apphost during research; no supplier/workbook phase string was found in an OS registration. [VERIFIED: failed Debug build lock and process diagnostic] | Do not stop it automatically. Build/test Phase 9 in Release or with a non-conflicting output, then explicitly restart/redeploy the API when implementation is ready so runtime code is not stale. |
| Secrets/env vars | Connection/JWT configuration selects the live database and actor context, but no secret or environment-variable rename is required by Phase 9. [VERIFIED: project configuration pattern; ASSUMED for untracked deployment stores] | No key rename. At apply, record non-secret target/environment identity and authenticated actor; verify external CI/deployment variables separately without logging secrets. |
| Build artifacts / installed packages | Existing Debug/Release `bin`/`obj`, EF migration artifacts, and the running Debug executable do not update simply because source changes. No external package installation is required. [VERIFIED: build output and manifests] | Create a forward migration, test against a disposable clone, rebuild/redeploy, and invalidate/refetch frontend server-state caches after mutations. Do not edit applied migrations. |

**Canonical residual-state question:** After every repository file is updated, the database still contains legacy supplier/history snapshots until the accepted migration runs, the running API still executes old assemblies until restart/redeploy, and subscribed clients can show stale queries until RTK Query invalidation/refetch. [VERIFIED: runtime inventory and architecture] (Confidence: HIGH)

## Common Pitfalls

### Pitfall 1: Treating Padded Worksheet Rows as Business Rows
**What goes wrong:** Preview counts explode or empty/formatted rows become diagnostics/import candidates. [VERIFIED: workbook ZIP/XML audit]  
**Why it happens:** Some sheets declare/materialize very large row dimensions, and `ReadTable` currently materializes worksheet rows before applying its mapped-row limit. [VERIFIED: XlsxWorkbookReader and workbook audit]  
**How to avoid:** Define the row shape/header and “real business row” predicate first; stream or bound candidates after inspecting meaningful cells, while still preserving original row numbers. [VERIFIED: codebase gap analysis]  
**Warning signs:** Counts near worksheet maximums, thousands of blank blockers, memory spikes, or preview totals that differ by read limit.

### Pitfall 2: Importing the SUMMARY Header as a Supplier
**What goes wrong:** `Nhà Cung Cấp` becomes active and appears in selectors. [VERIFIED: live baseline and current importer]  
**Why it happens:** Current policy import accepts any nonblank C/D cells and does not recognize the header row. [VERIFIED: SampleDataImportService]  
**How to avoid:** Use explicit header/schema detection and audited canonical-set classification; test header, pseudo, placeholder, and `Vịt a Việt` cases. [VERIFIED: D-09-01]  
**Warning signs:** Supplier count includes the header or a choice has no valid source sheet/policy.

### Pitfall 3: Making Preview Idempotent but Apply Non-Deterministic
**What goes wrong:** Apply sees a different database/source or recomputes different actions, so the second run updates rows again. [VERIFIED: D-09-10 risk]  
**Why it happens:** Filename identity, mutable timestamps, “find latest” queries, or separate preview/apply policies.  
**How to avoid:** Hash bytes, version policy/as-of, sort deterministic keys, fingerprint relevant database state, compare exact action identity/counts inside the transaction, and persist the run. [VERIFIED: D-09-07/D-09-10]  
**Warning signs:** Preview/apply count mismatch, changing hashes for unchanged input, or `Updated > 0` on a second apply.

### Pitfall 4: Corrupting Immutable Receipt and Stock History
**What goes wrong:** Existing receipt lines/movements are overwritten and current stock is adjusted by a delta that no longer matches approved/received history. [VERIFIED: current SampleDataImportService behavior]  
**Why it happens:** Existing entities are treated as seed rows rather than operational snapshots.  
**How to avoid:** Classify dependency and mutability before action; retain or version linked rows and recalculate only under an explicit, tested correction policy. [VERIFIED: D-09-08/D-09-09]  
**Warning signs:** Existing operational IDs change values, audit history points to modified facts, or ledger/current-stock invariants diverge.

### Pitfall 5: Keeping SupplierId Non-Null During Draft Generation
**What goes wrong:** The system must invent a supplier before explicit confirmation, recreating the forbidden fallback in a different form. [VERIFIED: current entity and D-09-14]  
**Why it happens:** The current PR-line schema assumes assignment is complete at generation.  
**How to avoid:** Represent “unselected” explicitly and migrate historical lines carefully; submission requires a confirmed evidence snapshot, not merely a non-null FK. [ASSUMED] (Confidence: MEDIUM)  
**Warning signs:** A newly generated draft already contains supplier IDs or a save path cannot represent no evidence.

### Pitfall 6: Implementing “Above 15%” with the Existing Helper
**What goes wrong:** Exactly 15% is blocked although D-09-15 says only above 15%. [VERIFIED: helper uses `>=` and locked decision uses `>`]  
**Why it happens:** A report-oriented helper is reused as a purchase authorization policy.  
**How to avoid:** Add policy tests at 14.99, 15.00, and 15.01 (using repository decimal rounding), then change only the intended caller or deliberately migrate all callers after impact analysis. [VERIFIED: codebase]  
**Warning signs:** Exactly-15 fixture creates an exception or report/approval results unexpectedly shift.

### Pitfall 7: Adding a Decision Record Without a Recovery Path
**What goes wrong:** The exception is approved but submission still recalculates and blocks, or a price change reuses stale approval. [VERIFIED: current transient alert risk]  
**Why it happens:** Exception identity is not tied to line/proposal/evidence version.  
**How to avoid:** Submission queries an approved exception matching the current normalized decision fingerprint; price/supplier/evidence changes supersede it and return the workflow to exception review. [ASSUMED] (Confidence: MEDIUM)  
**Warning signs:** Approve action does not change the workbench blocker, or approval survives a changed proposed price.

### Pitfall 8: Leaving Two Receiving Paths Active
**What goes wrong:** One path updates PO progress without lot/date evidence; the other creates inventory receipts without PO progress. [VERIFIED: PurchaseOrderService and InventoryReceiptService]  
**Why it happens:** Receipt behavior evolved in two services/controllers.  
**How to avoid:** Choose one canonical Warehouse endpoint/transaction and delegate or reject the legacy ordered-flow mutation. Add cross-service invariant tests. [VERIFIED: D-09-18]  
**Warning signs:** PO remains ordered after inventory increased, or received quantity changes without a traceable receipt line.

### Pitfall 9: Controller-Level Authorization Accidentally Requires Two Roles
**What goes wrong:** Adding Warehouse authorization to a receiving action under a Purchasing-authorized controller requires both policies. [VERIFIED: current controller shape; CITED: https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies]  
**Why it happens:** Multiple authorization requirements combine rather than override.  
**How to avoid:** Split the Warehouse mutation into its own controller or move to action-level policies under a neutral authenticated boundary.  
**Warning signs:** Correct Warehouse users receive 403 while Purchasing users retain receipt access.

### Pitfall 10: Building UI Before the Read Model Stabilizes
**What goes wrong:** Each panel independently derives stage/status and creates contradictory labels, counts, or actions. [VERIFIED: current disconnected tabs and UI contract]  
**Why it happens:** Existing endpoints expose entities, not the six-stage workbench.  
**How to avoid:** Lock API DTO/state transition tests first, then implement RTK Query types and screens in contract order.  
**Warning signs:** Client code compares many raw status strings or duplicates shortage/exception calculations.

## Code Examples

Verified patterns and prescribed extensions:

### URL-Restorable Workbench Scope

```tsx
// Source: https://reactrouter.com/api/hooks/useSearchParams
const [params, setParams] = useSearchParams()
const week = params.get('week') ?? currentMonday
const date = params.get('date')
const stage = params.get('stage') ?? 'approved-demand'

function selectStage(nextStage: string) {
  setParams(previous => {
    previous.set('week', week)
    previous.set('stage', nextStage)
    if (date) previous.set('date', date)
    return previous
  })
}
```

The exact component must preserve other unrelated query parameters and use repository date helpers; this snippet demonstrates that navigation state belongs in the URL rather than one-time local initialization. [CITED: https://reactrouter.com/api/hooks/useSearchParams] (Confidence: MEDIUM)

### Scoped RTK Query Invalidation

```ts
// Source: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching
confirmSupplier: build.mutation<DecisionDto, ConfirmSupplierInput>({
  query: body => ({ url: '/purchase-workflow/supplier-decisions', method: 'POST', body }),
  invalidatesTags: (_result, _error, input) => [
    { type: 'PurchaseWeek', id: input.weekStart },
    { type: 'PurchaseRequest', id: input.purchaseRequestId },
  ],
})
```

Use existing tag names if already present; add only the minimum scoped tags needed to refresh active views. Prefer invalidation to hand-maintained optimistic patches for these multi-entity transitions. [CITED: https://redux-toolkit.js.org/rtk-query/usage/automated-refetching; CITED: https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates] (Confidence: MEDIUM)

### Strict Purchase Exception Boundary

```csharp
// Source: locked D-09-15; repository DecimalPolicy remains authoritative.
private static bool RequiresPriceException(decimal variancePercent)
    => variancePercent > 15m;
```

Before introducing or changing this symbol, run GitNexus impact on `IsPriceIncreaseWarning` and test all current report/approval callers because the existing shared helper uses `>= 15`. [VERIFIED: codebase and AGENTS.md] (Confidence: HIGH)

### Warehouse Receipt Transaction Boundary

```csharp
// Source: https://learn.microsoft.com/en-us/ef/core/saving/transactions
await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
var order = await LoadOrderForWarehouseReceiptAsync(request, cancellationToken);
ValidateRemainingQuantityAndDates(order, request);
var receipt = CreateReceiptWithLotSnapshot(order, request, actor);
UpdatePurchaseOrderProgress(order, request);
await stockLedger.RecordReceiptAsync(receipt, cancellationToken);
await db.SaveChangesAsync(cancellationToken);
await transaction.CommitAsync(cancellationToken);
```

The concrete service must follow existing stock-ledger conventions and enforce a retry identity; do not literally duplicate existing ledger writes. [VERIFIED: current stock service pattern; CITED: https://learn.microsoft.com/en-us/ef/core/saving/transactions] (Confidence: HIGH)

## State of the Art

| Old Approach | Current Phase 9 Approach | When Changed | Impact |
|---|---|---|---|
| Hard-coded 19.5 filename and direct import | 20.7 source hash/manifest, pure preview, drift-checked transactional apply | Phase 9 decision D-09-07/D-09-10 | Makes source identity and second-run no-op testable. [VERIFIED: context/codebase] |
| Nonblank SUMMARY cells become suppliers | Audited canonical-set classifier including approved data-bearing sheets | Phase 9 D-09-01 | Removes accidental headers/pseudo choices without deleting referenced history. [VERIFIED: context/workbook] |
| Unknown units dynamically created | Bounded aliases; ambiguous values block with raw evidence | Phase 9 D-09-04 | Prevents semantic data corruption. [VERIFIED: context/codebase] |
| Global unit conversion | Ingredient + supplier + effective-period package rule and transaction snapshot | Phase 9 D-09-05 | Preserves historical meaning of `BICH`. [VERIFIED: context/model gap] |
| First active supplier fallback | Evidence candidates plus explicit confirmation | Phase 9 D-09-14 | Makes absence of evidence actionable instead of hidden. [VERIFIED: context/codebase] |
| Disabled/transient price alert at `>=15%` | Durable, resolvable exception strictly at `>15%` | Phase 9 D-09-15 | Adds audit/recovery and correct boundary behavior. [VERIFIED: context/codebase] |
| Receiving mutation in Purchasing and a second PR receipt path | One Warehouse-owned PO receipt transaction; Purchasing read-only | Phase 9 D-09-18 | Aligns authorization, lot evidence, PO progress, and stock. [VERIFIED: context/codebase] |
| Five local Purchasing tabs | Six server-derived stages with URL scope | Approved 09-UI-SPEC | Creates one operational sequence while preserving routes. [VERIFIED: UI contract/codebase] |

**Deprecated/outdated:**
- Hard-coded `IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx` purchase-history import is superseded by the 20.7 manifest path. [VERIFIED: D-09-07]
- Arbitrary `activeSuppliers.FirstOrDefault()` fallback is forbidden. [VERIFIED: D-09-14]
- Purchasing-owned receipt input is forbidden for new ordered flow. [VERIFIED: D-09-18]
- A non-actionable `price-alert` row is insufficient and must be replaced by a typed exception target. [VERIFIED: D-09-15]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | [ASSUMED] A dedicated supplier-decision entity is preferable to only nullable PR-line fields; exact persistence shape remains at planner/executor discretion. | Pattern 3 | Medium: schema/tasks differ, but required behavior is unchanged. |
| A2 | [ASSUMED] A changed price/supplier/evidence should supersede an earlier exception decision using a proposal fingerprint/version. | Pattern 4 / Pitfall 7 | Medium: stale approvals could authorize a materially different purchase if not confirmed. |
| A3 | [ASSUMED] Untracked deployment secret/config stores contain no Phase 9-specific key rename. | Runtime State Inventory | Low for code, high operationally if a hidden import/source setting exists; verify deployment before apply. |
| A4 | [ASSUMED] Lot/manufacture/expiry requirement detail can continue using current validation plus the locked Warehouse fields; ingredient-specific mandatory-field rules were not found. | Warehouse receiving | Medium: business owners may require stricter per-category rules. |

## Open Questions (RESOLVED)

1. **RESOLVED — Accept the Phase 9 requirement IDs.**
   - Decision: The canonical requirement IDs are `SUP-01..SUP-04`, `PUR-01..PUR-05`, `WHR-01`, and `PUI-01`; ROADMAP and every plan use these IDs.
   - Evidence: Phase 09 CONTEXT, ROADMAP, and the completed multi-source coverage audit.

2. **RESOLVED — Use the smallest forward-only durable supplier-decision and price-exception persistence after mandatory impact analysis.**
   - Decision: Add one versioned supplier-decision record and one versioned price-exception record, plus only the nullable/current-snapshot and unique-key changes needed to connect them. Before editing `Purchaserequestline`, `Purchaseorder`, or `IpcManagementContext`, run upstream GitNexus impact analysis; HIGH/CRITICAL scope must be reported before proceeding.
   - Evidence: D-09-08, D-09-14, D-09-15 and Plans 09-08 through 09-10.

3. **RESOLVED — Require operator-owned named backup evidence plus a successful disposable clone restore/fingerprint proof.**
   - Decision: D-09-10 apply eligibility requires the operator-owned backup identifier, exact target fingerprint, successful `ipc_e2e_template` to `ipc_laneN` restore evidence, accepted preview counts/action IDs, and exact post-restore fingerprint equality. Automated apply remains disposable-only; any real target requires a separate blocking operator authorization.
   - Evidence: Wave 0 evidence contract and Plans 09-01, 09-05, and 09-14.

4. **RESOLVED — Server policy owns receipt lot/manufacture/expiry requirements; UI never guesses.**
   - Decision: For each ingredient, the server returns which of lot number, manufacture date, and expiry date are required and validates the submitted raw evidence. The Warehouse UI renders those requirements, preserves raw values, and blocks submission when required evidence is absent; it never infers or fabricates dates/lot values. The approved UI-SPEC frontmatter is canonical.
   - Evidence: D-09-18, WHR-01, approved 09-UI-SPEC, and Plans 09-11 through 09-14.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | Frontend build/test | ✓ | 24.13.0 | — |
| npm | Frontend workspace scripts | ✓ | 11.6.2 | — |
| .NET SDK | Backend build/test/migrations | ✓ | 10.0.300 (targets net9.0) | — |
| GitNexus CLI | Mandatory impact/change analysis | ✓ | 1.6.7 | Re-index with repository runner before edits. |
| MySQL client CLI | Direct live inspection | ✗ | — | Use the existing API/database tool or approved server tooling; do not block unit planning. |
| Docker CLI | Disposable service orchestration | ✗ | — | Existing database clone/tooling and Release tests; a verified external clone is still required before apply. |
| Canonical 20.7 workbook | Reconciliation | ✓ | SHA-256 `4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88` at research time | Block on hash change and re-preview. |

All availability/version claims above were probed on the target workstation during this research. [VERIFIED: environment probes] (Confidence: HIGH)

**Missing dependencies with no fallback:** none for planning/unit implementation; a verified database backup/restore artifact remains an operational apply checkpoint, not a package dependency. [VERIFIED: environment audit and D-09-10]

**Missing dependencies with fallback:** MySQL CLI and Docker CLI; use existing repository tooling/approved infrastructure, and never infer that a local unit test substitutes for restore evidence. [VERIFIED: environment audit]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Backend framework | xUnit through `dotnet test`, net9.0 test project [VERIFIED: test csproj] |
| Backend config | `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`, `backend/coverage.runsettings` [VERIFIED: codebase] |
| Frontend framework | Vitest 4.1.10, Playwright 1.60.0 [VERIFIED: `npm ls`] |
| Frontend config | Vitest uses the frontend package defaults; Playwright uses `frontend/playwright.config.ts`; root/frontend scripts select focused specs. [VERIFIED: codebase] |
| Quick backend run | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --no-restore --filter "FullyQualifiedName~PurchaseHistoryReconciliationTests|FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests|FullyQualifiedName~SupplierDecisionWorkflowTests|FullyQualifiedName~WarehousePurchaseReceivingTests"` |
| Existing characterization run | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --no-restore --filter "FullyQualifiedName~SampleDataImportServiceTests|FullyQualifiedName~WorkflowGenerationTests"` — 122 passed in 6 seconds during research. [VERIFIED: test run] |
| Quick frontend run | `npm run test:unit --workspace frontend -- --run src/features/workflow/purchasing/purchasingModel.test.ts src/features/workflow/purchasing/purchasingHooksBehavior.test.tsx src/features/projects/weekly-menu/demand/demandModel.test.ts` — 13 passed during research. [VERIFIED: test run] |
| Full suite | `npm run test:be && npm run lint --workspace frontend && npm run build --workspace frontend && npm run test:unit --workspace frontend && npm run test:smoke --workspace frontend && npm run test:ui-audit --workspace frontend && npm run test:visual --workspace frontend` [VERIFIED: repository/UI contract scripts] |

Use Release for backend validation while the local Debug API remains running; do not stop the user's process merely to unlock the Debug apphost. [VERIFIED: research test lock diagnostic]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SUP-01 | Canonical supplier set excludes header/pseudo/placeholder and includes approved data-bearing sheet | unit + workbook fixture | Quick backend filter, `PurchaseHistoryReconciliationTests` | ❌ Wave 0 |
| SUP-02 | Deterministic ingredient/unit/package/date normalization and raw blockers | table-driven unit | Quick backend filter | ❌ Wave 0 |
| SUP-03 | Preview manifest/hash/fingerprint/counts and zero writes | service/integration | Quick backend filter | ❌ Wave 0 |
| SUP-04 | Dependency actions, immutable history, atomic apply, second-run no-op | service + disposable DB integration | Quick backend filter plus approved clone run | ❌ Wave 0 |
| PUR-01 | Demand appears in inbox; approve/reject permission/history; PR selection gated | service/controller integration | Quick backend filter, approval tests | ❌ Wave 0 |
| PUR-02 | Week/date read model and FULLDAY scoping | service/controller + frontend model | Backend quick filter + frontend unit | ❌ Wave 0 for new contracts |
| PUR-03 | No fallback; evidence eligibility; explicit confirmation snapshot | unit/service/controller | Quick backend filter, supplier tests | ❌ Wave 0 |
| PUR-04 | 15.00 allowed, 15.01 exception, decision/recovery/versioning | boundary + approval integration | Quick backend filter, exception tests | ❌ Wave 0 |
| PUR-05 | Approved PR creates supplier-split POs once and retries do not duplicate | service integration | Quick backend filter | Partial existing coverage; ❌ retry contract |
| WHR-01 | Warehouse-only partial receipt with lot/dates, stock and PO progress atomic | authorization + service integration | Quick backend filter, receipt tests | Partial existing coverage; ❌ canonical path |
| PUI-01 | Six stages, URL restore, bounded tables, accessible dialogs, cross-route handoff | Vitest + Playwright + visual | Frontend gates and focused Phase 9 spec | ❌ Wave 0 focused E2E |

### Sampling Rate

- **Per task commit:** impacted backend Phase 9 filter and/or impacted frontend focused Vitest; run GitNexus `detect_changes()` before commit. [VERIFIED: AGENTS.md]
- **Per wave merge:** all Phase 9 backend files plus frontend lint/build/unit/smoke relevant to the wave. [VERIFIED: repository scripts]
- **Phase gate:** full suite green, disposable-clone preview/apply/no-op/restore evidence recorded, Playwright cross-role flow green, and GitNexus compare against `main` contains only expected symbols/flows. [VERIFIED: D-09-10, AGENTS.md, UI contract]

### Wave 0 Gaps

- [ ] `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs` — real-row detection, canonical suppliers, aliases, package/date policy, preview purity, drift, dependency matrix, no-op.
- [ ] `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs` — target registry, permissions, history, 15.00/15.01, recovery and stale proposal.
- [ ] `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs` — quotation/receipt eligibility, zero-evidence state, explicit confirmation, submit gate.
- [ ] `backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs` — warehouse authorization, partial/final quantities, lot/date snapshot, idempotency, ledger/PO atomicity.
- [ ] Frontend model/hook tests for six stages, URL week/date/stage restoration, explicit confirmation, exception action, and read-only Purchasing progress.
- [ ] Focused Playwright Phase 9 E2E fixture covering Weekly Menu → demand approval → Purchasing → exception approval when needed → PR approval → PO → Warehouse partial/final receipt.
- [ ] Disposable database clone fixture plus operator-owned backup/restore evidence checkpoint; never aim reconciliation integration tests at the live lane. [VERIFIED: D-09-10]

## Security Domain

Security enforcement and Nyquist validation are enabled in `.planning/config.json`; the following ASVS categories therefore remain plan gates. [VERIFIED: planning config]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Yes | Existing JWT identity/current-user service; derive actor server-side and never accept actor IDs from import/decision payloads. [VERIFIED: current auth architecture] |
| V3 Session Management | No new mechanism | Preserve existing bearer-session behavior; Phase 9 introduces no new session store. [VERIFIED: phase scope] |
| V4 Access Control | Yes | Keep Catalog + Development guards for reconciliation; manager policies for demand/exception/PR decisions; Purchasing for supplier/price/PO; Warehouse-only receive mutation. [VERIFIED: D-09-11/D-09-17/D-09-18] |
| V5 Input Validation | Yes | Server validates source hash/manifest, row schema, aliases, dates, IDs, quantities, price/evidence/reason, remaining quantity, and date relationships. [VERIFIED: locked policies] |
| V6 Cryptography | Yes, integrity only | .NET SHA-256 for source/manifest evidence; existing platform crypto/JWT stack, never custom crypto. [CITED: https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.sha256] |

ASVS is an application-security verification standard and should be used as a verification checklist, not as proof that the implementation is secure. [CITED: https://owasp.org/www-project-application-security-verification-standard/] (Confidence: MEDIUM)

### Known Threat Patterns for ASP.NET Core / EF / XLSX Workflow

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Preview manifest or workbook swapped before apply | Tampering | SHA-256 bytes, policy/as-of identity, database fingerprint, exact action/count comparison inside transaction, single-use accepted manifest. [VERIFIED: D-09-07/D-09-10] |
| Crafted/padded XLSX consumes memory or creates mass actions | Denial of Service | Existing request rate limit, size/row/cell bounds, meaningful-row predicate, cancellation, blocker count cap, no production upload. [VERIFIED: current middleware/workbook audit/D-09-17] |
| Client supplies actor/approval status | Spoofing / Elevation | Resolve actor from authenticated principal; handler-owned transitions; ignore client status fields. [VERIFIED: existing approval pattern] |
| Purchasing calls Warehouse receive mutation | Elevation of Privilege | Separate Warehouse-authorized endpoint and negative authorization integration tests. [VERIFIED: D-09-18] |
| Destructive reconciliation without attributable evidence | Repudiation | Persist run, source hash, preview/apply actor/time, action evidence, blockers, backup identifier, and approval/audit history. [VERIFIED: D-09-07 through D-09-10] |
| Server path/raw workbook contents leaked | Information Disclosure | Server-known Development source only, no browser path input, sanitized diagnostics, no secret/path echo, production 404 guard. [VERIFIED: D-09-17 and middleware] |
| Concurrent approval/apply/receipt produces duplicate or stale state | Tampering | Unique indexes, transaction, current-state/concurrency checks, proposal/receipt idempotency key, retry tests. [CITED: https://learn.microsoft.com/en-us/ef/core/saving/transactions; CITED: https://learn.microsoft.com/en-us/ef/core/saving/concurrency] |

## Recommended Plan Decomposition

1. **Wave 0 — Contracts and characterization:** accept requirement IDs, re-index GitNexus, capture symbol impacts, add dedicated tests/fixtures, document the backup/clone checkpoint, and freeze workbook hash/as-of policy. [VERIFIED: project constraints and phase decisions]
2. **Wave 1 — Persistence foundation:** forward migration/configuration for reconciliation runs/evidence, package conversion snapshots, optional/unconfirmed supplier decision, and versioned price exception; backfill historical snapshots without claiming new confirmation. [ASSUMED] (Confidence: MEDIUM)
3. **Wave 2 — Pure reconciliation preview:** parser/policy, canonical supplier classifier, deterministic keys, dependency/action classifier, manifest/fingerprint, Development-only preview endpoint, zero-write proof. [VERIFIED: locked decisions]
4. **Wave 3 — Guarded apply:** backup evidence contract, fresh rebuild/compare, explicit EF transaction, ordered action matrix, audit/run persistence, disposable-clone first/second/post-preview proof. [VERIFIED: locked decisions; CITED: https://learn.microsoft.com/en-us/ef/core/saving/transactions]
5. **Wave 4 — Approval foundations:** material-demand target/handler/inbox/history/permissions and durable price-exception target/recovery; correct strict threshold with blast-radius tests. [VERIFIED: codebase gaps]
6. **Wave 5 — Purchasing contracts:** week/date read model, approved-shortage gating, evidence candidates, explicit supplier confirmation, submit validation, supplier-split PO safe retry. [VERIFIED: D-09-11 through D-09-15]
7. **Wave 6 — Receiving convergence:** canonical Warehouse endpoint/service with lot/date/partial receipt and atomic PO/stock progress; deprecate/delegate conflicting ordered-flow mutation; Purchasing read-only DTO. [VERIFIED: D-09-18 and codebase gaps]
8. **Wave 7 — Frontend vertical integration:** extend `workflowApi` contracts/tags, then Weekly Menu, Approvals, six-stage Purchasing, and Warehouse in that order using approved primitives and URL scope. [VERIFIED: UI contract]
9. **Wave 8 — Phase gate:** full automated suite, focused cross-role E2E, accessibility/visual gates, disposable-clone reconciliation/no-op/restore evidence, live-target preflight only, and GitNexus compare-scope verification. [VERIFIED: project/phase constraints]

Waves 2–3 must serialize around the same reconciliation policy and database entities; Waves 4–6 must lock backend contracts before Wave 7. Parallel frontend work is safe only after the corresponding DTO/state transition tests are stable. [VERIFIED: dependency analysis] (Confidence: HIGH)

## Sources

### Primary (HIGH confidence)

- `09-CONTEXT.md` — locked normalization, reconciliation, workflow, exposure, and ownership decisions. [VERIFIED: repository]
- `09-UI-SPEC.md` — approved six-stage UI, existing primitives, route/state/accessibility constraints. [VERIFIED: repository]
- `.docs/IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx` — direct ZIP/XML workbook structure and raw diagnostic audit. [VERIFIED: workbook audit]
- `SampleDataImportService.cs`, `XlsxWorkbookReader.cs` — current 19.5 import, direct mutations, dynamic unit creation, and row mechanics. [VERIFIED: codebase]
- `PurchaseRequestWorkflowService.cs`, `PurchaseOrderService.cs`, `InventoryReceiptService.cs` — supplier fallback, submit gate, PO split, and duplicate receiving paths. [VERIFIED: codebase]
- `ApprovalInboxService.cs`, `ApprovalHandlers.cs`, `ApprovalPage.tsx` — missing demand target and non-actionable price alert. [VERIFIED: codebase]
- `PurchasingPage.tsx`, `useMaterialDemand.ts`, purchasing hooks, and `WarehousePage.tsx` — current five-view/local-state and ownership boundaries. [VERIFIED: codebase]
- `AGENTS.md`, `.cursor/rules/`, package manifests, test projects, and `.planning/config.json` — project/tooling/security/test constraints. [VERIFIED: repository]

### Secondary (MEDIUM confidence)

- https://learn.microsoft.com/en-us/ef/core/saving/transactions — EF Core transactions/savepoints.
- https://learn.microsoft.com/en-us/ef/core/saving/concurrency — optimistic concurrency patterns.
- https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies — policy authorization composition.
- https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.sha256 — platform SHA-256 API.
- https://redux-toolkit.js.org/rtk-query/usage/automated-refetching — tag invalidation/refetch behavior.
- https://redux-toolkit.js.org/rtk-query/usage/manual-cache-updates — manual cache update tradeoffs.
- https://reactrouter.com/api/hooks/useSearchParams — URL search parameter state.
- https://owasp.org/www-project-application-security-verification-standard/ — ASVS project scope.

### Tertiary (LOW confidence)

- None. Assumptions are isolated in the Assumptions Log rather than cited as external facts.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and facilities verified from manifests and installed environment; no new dependency is proposed.
- Architecture: HIGH — derived from locked decisions and inspected service/controller/entity/frontend boundaries.
- Workbook/import policy: HIGH — inspected canonical workbook and current parser/importer directly.
- Operational workflow gaps: HIGH — traced services, authorization, approval inbox, UI hooks, and current tests.
- Exact new persistence shape: MEDIUM — behavior is locked, but the smallest safe schema depends on symbol impact and migration review.
- Official framework patterns: MEDIUM — cited from current official documentation and cached through the research seam; Context7 was unavailable in this environment.
- Pitfalls: HIGH — most are demonstrated by current code or locked invariants; schema-specific recovery mechanics are explicitly assumed.

**Research date:** 2026-07-21  
**Valid until:** 2026-08-20 for stable repository findings; re-check package/runtime versions, GitNexus index, workbook hash, live counts, and official framework docs before execution.
