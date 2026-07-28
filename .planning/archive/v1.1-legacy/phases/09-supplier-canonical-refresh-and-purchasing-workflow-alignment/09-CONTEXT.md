# Phase 9: Supplier canonical refresh and purchasing workflow alignment - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 replaces the hard-coded 19.5 purchase-history sample source with the audited 20.7 workbook through a preview-first, dependency-aware and idempotent reconciliation path. It also closes the operational gap from finalized servings through approved material demand, date-scoped purchasing, supplier/price decisions, purchase-order creation and warehouse-owned receiving. It does not add a production filesystem-path import or replace the BOM canonicalization work owned by Phases 3–7.

</domain>

<decisions>
## Implementation Decisions

### Canonical supplier and Excel normalization
- **D-09-01:** The canonical supplier set is SUMMARY suppliers plus data-bearing sheets such as `Vịt a Việt`; a SUMMARY header row, pseudo-suppliers and unreferenced placeholders are not canonical suppliers.
- **D-09-02:** In the purchase workbook, `Tên hàng` is an ingredient name, not a dish or supplier. Normalize whitespace and sentence-style casing while keeping supplier identity in a separate field sourced from deterministic SUMMARY/sheet mapping.
- **D-09-03:** Embedded supplier text may be split from an ingredient only when an approved mapping produces an unambiguous result. Ambiguous rows retain raw source evidence and block apply instead of being guessed.
- **D-09-04:** Units use a controlled alias table. Known spelling variants normalize deterministically; unknown or ambiguous values such as `kh` or `canh` block with sheet/row/raw-value evidence. There is no silent `KG` fallback.
- **D-09-05:** `BICH` remains a canonical packaging unit, but package size is scoped by ingredient, supplier and effective period. The transaction snapshots its conversion. A plain `BICH` row without package size is allowed only when no cross-unit conversion is required.
- **D-09-06:** Delivery dates may be historical and may extend at most seven days past the workbook as-of date. Outliers such as 2035 block; they are not clamped, deleted or silently skipped.

### Historical reconciliation and cleanup
- **D-09-07:** The 20.7 workbook supersedes the 19.5 workbook for purchase-history sample import. Reconciliation uses deterministic source/business keys and a source hash/manifest rather than filename-only identity.
  - **Execution correction (2026-07-22):** The unsupported `3,209` note is replaced by the reproduced delta of `3,207` unique normalized `delivery date + ingredient` keys, compared case-insensitively. Wave 0 evidence owns the exact XML audit algorithm and counts.
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source and project contracts
- `.docs/IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx` — canonical candidate purchase-history and supplier source for this phase.
- `.planning/PROJECT.md` — retention boundary, live-backend rule and current milestone constraints.
- `.planning/REQUIREMENTS.md` — preview, provenance, idempotency, retention and downstream safety requirements.
- `.planning/ROADMAP.md` — phase dependencies and cross-phase preservation gates.
- `AGENTS.md` — mandatory GitNexus impact and change-scope checks.

### Import and reconciliation
- `backend/src/IPCManagement.Api/Services/SampleData/SampleDataImportService.cs` — current hard-coded 19.5 source, supplier mapping, receipt/stock generation and first-active-supplier-related source data.
- `backend/src/IPCManagement.Api/Services/SampleData/XlsxWorkbookReader.cs` — existing package-free XLSX reader and source-row mechanics.
- `backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql` — existing untracked user cleanup work; inspect ownership and do not stage or overwrite it.

### Operational workflow
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseRequestWorkflowService.cs` — demand-to-PR, supplier suggestion, validation and submit gates.
- `backend/src/IPCManagement.Api/Services/Workflow/PurchaseOrderService.cs` — approved PR to supplier-split PO and current receiving behavior.
- `backend/src/IPCManagement.Api/Services/Approvals/ApprovalInboxService.cs` — current approval queue, including the missing material-demand target and price-alert dead end.
- `frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts` — date-specific FULLDAY demand generation after serving completion.
- `frontend/src/features/workflow/pages/ApprovalPage.tsx` — current approval queue and decision surface.
- `frontend/src/features/workflow/pages/PurchasingPage.tsx` — current five-view purchasing shell.
- `frontend/src/features/workflow/purchasing/` — extracted server-backed demand, supplier, quotation, order and handoff modules.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OperationalFrame`, `CommandBar`, `ContextStrip`, `ViewSwitcher`, `SectionPanel`, `TableViewport` and pagination primitives can implement a compact guided workbench without a second UI system.
- RTK Query hooks in `workflowApi.ts` already cover purchase candidates, purchase requests, supplier quotations, purchase orders, warehouses and stock movements.
- `ApprovalQueue` and the existing decision dialog can be extended for material-demand and price-exception targets.
- `XlsxWorkbookReader` already preserves workbook structure without adding another parser dependency.

### Established Patterns
- Server state stays in RTK Query; local hooks own only navigation/form state.
- Multi-entity writes use explicit EF transactions and audit rows; immutable operational history is preserved.
- Operational tables are bounded and server-paginated; route and primary navigation labels remain stable.
- Destructive changes are previewed, fingerprinted and blocked on drift or unresolved dependencies.

### Integration Points
- `SampleDataImportService.ImportPurchaseHistoryAsync` currently hard-codes `IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx`.
- `PurchaseRequestWorkflowService.GenerateFromDemandAsync` currently assigns the first active supplier when evidence is absent.
- `PurchaseRequestWorkflowService.ValidateSubmitAsync` requires approved material demand, but the frontend does not expose a demand-approval path.
- `ApprovalInboxService` queues purchase requests, issues and adjustments but not material demand; price alerts are visible but not resolvable.
- `usePurchaseOrders` currently records receipt quantities inside Purchasing; responsibility moves to the Warehouse surface.

</code_context>

<specifics>
## Specific Ideas

- Audit baseline: both workbooks contain 31 SUMMARY supplier policies, while the 20.7 source adds 3,207 unique normalized `delivery date + ingredient` keys over 19.5 (case-insensitive).
- Live `ipc_lane1` baseline: 64 suppliers, 35 active, 29 `-2` duplicates inactive; the accidental active supplier `Nhà Cung Cấp` comes from the SUMMARY header.
- Unit diagnostics include spelling/semantic anomalies such as `Bành`, `hủ`, `loốc`, `cay`, `lất`, `vit`, `kh`, `canh` and package text such as `Bịch (10 cái)`.
- The purchasing workbench should answer: which week, which service date, what is short, whether demand is approved, which supplier evidence exists, which exceptions block, and whether Warehouse has received the order.

</specifics>

<deferred>
## Deferred Ideas

- Production Admin workbook upload remains owned by the canonical upload/cutover phases.
- Repository-wide dish-name normalization outside the purchase workbook remains owned by BOM/menu canonicalization.
- The weakly matched todo `weekly-menu-browser-uat.md` is not folded into Phase 9; Phase 9 will define its own focused E2E evidence.

</deferred>

---

*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Context gathered: 2026-07-21*
