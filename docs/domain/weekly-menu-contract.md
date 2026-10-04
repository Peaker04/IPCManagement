# Weekly Menu Feature Business & UI Contract

**Status:** Adopted Domain Contract
**Owner:** Weekly Menu & Central Kitchen Domain
**Target Routes:** `/weekly-menu` (DEFAULT & MATERIAL_RECONCILIATION)
**Last Updated:** 2026-09-30

---

## 1. Domain Calculations & Arithmetic Truth

1. **BOM 6-Decimal Place Precision ("Định mức theo món"):**
   Raw ingredient BOM normatives must be calculated and preserved up to **6 decimal places** in kilograms/portion (e.g. `0.064777 kg`).
   - Financial calculation rule: Unit prices are multiplied by the exact unrounded BOM quantity before rounding total currency amounts to whole Vietnamese Đồng (VND).
   - *Example:* $0.064777\text{ kg} \times 12,000\text{ đ} = 777.324\text{ đ} \implies \mathbf{777\text{ đ}}$ (never round quantity to $0.065\text{ kg} \times 12,000\text{ đ} = 780\text{ đ}$).
   - BOM display precision: Quantity columns display up to 6 decimal places when source data warrants it; currency amounts round to whole VND.

2. **Dietary Variant Split Ratio (Chay vs. Mặn):**
   When importing menu plans with savory (Mặn) and vegetarian (Chay) variants:
   - For planned shifts with locked headcounts (e.g. 120 portions/shift), headcounts split strictly by contract ratio: **85% Savory (102 portions)** and **15% Vegetarian (18 portions)**.
   - For ad-hoc or uncommitted imported menus without locked shift plans, imported variant counts apply directly (e.g., Savory 840/870, Vegetarian 150).
   - Food costs are calculated separately per variant group before aggregating into daily menu totals. Estimated BOM cost does not constitute proof of warehouse issue or purchase receipt.

---

## 2. Shell & Workspace Navigation Architecture

1. **Persistent Scope & Shared Coordinates:**
   Customer selector (`CustomerSelect`), Week picker (`WeekPicker`), and pricing tier context represent shared business coordinates. In the target reconstructed architecture, these coordinates persist across workspace routes via URL Search Parameters (`?customerId=...&weekStartDate=...&pricingTier=...`) and global workspace context, eliminating reliance on client `localStorage` for business truth.
2. **Migration from In-Page Tabs to Sidebar Workspaces (PO Authoritative Decision):**
   The 6 functional views of Weekly Menu migrate from the legacy monolithic route with in-page tab navigation to independent workspace routes under the `Kế hoạch & Điều phối` module group in the application sidebar:
   1. `Kế hoạch tuần` (Weekly Schedule Matrix)
   2. `Định mức theo món` (Dish BOM Formulation & Tray Cost)
   3. `Kế hoạch sản xuất` (Kitchen Production Orders)
   4. `Nhu cầu nguyên liệu` (Material Demand Workbench)
   5. `Giá vốn tuần` (Food Cost & Margin Audit)
   6. `Bàn giao tuần` (Kitchen Handover & Warehouse Dispatch Summary)
   *Bất biến loại trừ nhân bản:* Khi chuyển lên Sidebar, các trang con **tuyệt đối không giữ lại thanh tab ngang 6 mục cũ**. Cấm mô hình lặp lại thanh tab ngang gồm đúng các workspace đã có trên sidebar.
3. **Scope Guard & Prerequisite State:**
   Workspace routes remain navigable even when no customer is selected. When unselected, the active workspace owns its explanatory prerequisite state card, preventing un-scoped data leakage. The Demand prerequisite helper focuses the first missing coordinate: customer first when absent (including both absent), otherwise the actual week input; its action label names that missing coordinate.
4. **Authorized Commands ("Thao tác tuần") & Conditions ("Điều kiện"):**
   Authorized weekly commands (Import, Matrix Editor, Publish, Export) and 4 named prerequisite checkpoints (Customer, Week, Menu Items, Plan) are displayed directly with their respective permission guards within their relevant workspaces. Do not collapse weekly commands under a single ambiguous dropdown.

---

## 3. "Nhu Cầu" (Material Demand) Workspace Composition Contract

1. **Single Operational Surface:**
   The `/weekly-menu` "Nhu cầu" tab is the sole authorized demand workbench. (The historical experimental `/demand-preview` route was retired on 2026-09-29).
2. **Daily Workbench Grain:**
   The workspace operates on **one selected service day**. Day selector, approval code, handover counters, warnings, and document rails derive strictly from the active service date and do not leak across days.
3. **State-Aware Workspace Ordering (2026-09-29 Canon):**
   Universal ordering is prohibited. The layout dynamically adapts to data readiness:
   - **Case A: Day with Generated Material Rows:**
     Lead with the generated Material Demand Worklist table immediately below the operational header. The underlying KHSX (Production Plan) source disclosure defaults to **collapsed/closed**, but remains openable for audit or adjustments.
   - **Case B: Day without Material Rows & Incomplete Shifts:**
     Lead with the open, interactive KHSX shift serving editor, followed by an explanatory material empty state. Guarded shift completion controls sit above KHSX rows to avoid bottom scrolling.
   - **Case C: Day without Material Rows but Completed Shifts:**
     Lead with a compact explanatory material state and a prominent "Tính nhu cầu" action, followed by collapsed KHSX disclosure.
   **Weekly calculation command, daily reading (owner-approved):**
   The user-facing `Tính nhu cầu tuần` / `Tính lại nhu cầu tuần` command targets the selected customer/week. The current BE endpoint processes one `ServiceDate + CustomerId + FULLDAY` per request; the FE orchestrates the week's source service dates. This is not an atomic weekly transaction. Day navigation changes only the read surface, not command scope.
   - Command eligibility/preflight uses weekly inputs and per-date staleness, not only the viewed day's completed shifts. BE mutation guards remain final.
   - Confirmation identifies the week, updateable dates, read-only dates/reasons and any pending shift servings the existing workflow will save/complete before generation.
   - Results distinguish each date's success, failure and unchanged/locked disposition; do not announce full-week success after a partial outcome or promise selective retry/rollback not supplied by the owner.
   - Daily quantities/documents retain their original grain. Do not sum stock across dates or infer procurement entitlement from remaining-to-issue quantities.
4. **Shift-Level Headcount Editing:**
   KHSX editing operates at the **shift grain** (one input per shift for Savory, one for Vegetarian). Do not duplicate inputs per dish row.
5. **No Cross-Role CTAs:**
   Material rows in the demand view display read-only requirements. Generic cross-role action columns (e.g. "Hướng xử lý") are omitted in this multi-actor view; procurement and warehouse actions are performed in their respective workbenches.
6. **Unified Document Rail:**
   The daily document rail provides a single scope switch between Day and Week. A draft KHSX document remains day-only; weekly scope lists finalized backend documents.

---

### Scoped visual bindings in the sandbox preview

Demand preview uses the Kit targets from `DESIGN.md` §§5.4–5.6 and §13 through the scoped token owner `frontend/src/styles/planning-demand-preview-tokens.css`, imported by its feature stylesheet. This does not replace the global application theme or style portaled calendar/confirmation interiors. Compact controls and single-line ledger rows preserve the existing daily grain and quantity precision; long labels wrap and grow naturally rather than being clipped to a fixed row height. Global/shared-consumer and full accessibility acceptance remain separate gates.

### Semantic status hierarchy in the sandbox preview

The existing `StatusBadge` primitive renders the demand approval owner's label/tone beside the selected day identity: pending uses the Kit amber surface, approved/terminal uses a restrained teal surface, rejected uses the danger surface, and neutral states remain quiet. Icons and text accompany emphasis; query activity stays separate and never replaces the approval status. The preview locally binds DESIGN §5 semantic foreground/background tokens without changing the shared theme. Scoped CSS explicitly overrides the shared stylesheet's `!important` bare-badge/primary-text rules only where this preview needs the approved Kit treatment.

Handoff is a plain-text column, not a badge: it keeps the mapper's exact label, warning/success foreground and actor hint (native title), without redundant row icons, fill, border or status hover treatment. The previous blanket warning-to-muted override is removed, including for cancellation/recalculation; no new urgency or status mapping is inferred (D8/S1.13). This visual prominence does not infer shortage, purchase eligibility, or a new business state. Required quantities are semibold; physical progress quantities remain uncolored and retain exact precision. Rail routine/unknown/readonly states use labeled glyphs; stale preflight gets amber emphasis. Completed serving facts use a small success/check marker, incomplete inputs keep the QuickServingCell status owner, and missing BOM has an explicit amber warning icon/label rather than color alone. Locked context is neutral with a lock; stale source remains a separate warning. Read errors/denial have a danger heading/icon and retain their existing recovery/permission behavior. Disabled weekly commands retain readable muted text; pending navigation preserves the command palette and all guards.

The six-column ledger uses feature-local fixed table layout and a colgroup independent of mounted page/filter/detail content. Columns budget the scroller's content width after its stable vertical gutter: unit `clamp(64px, 7cqw, 96px)`, each quantity `176px`, handoff `clamp(96px, 12cqw, 160px)`, and identity takes the remainder. The scroller is the inline-size query container: container units resolve to lengths before fixed-table column allocation, unlike percentage expressions inside `clamp()` on a col. The table fills that content width without a forced 1024px desktop minimum. All six columns must fit the supported 1366/1440/1920 desktop workbench for realistic rows and supported handoff labels; long material/unit/handoff/detail text grows rows naturally. Required values remain right-aligned/tabular and are not truncated or rounded beyond the existing six-decimal formatter. Meaningful two-dimensional tables may scroll locally at genuinely insufficient narrow/native-zoom widths or for nonwrappable numerical extremes, keeping sticky identity and header; this exception is not blanket permission for arbitrary minimum widths, clipped values or page-level overflow. Native zoom requires separate measurement, not inference from a screenshot crop. JavaScript number precision at the upper decimal-storage bound remains a formatter/data-contract limitation, not an exact-decimal guarantee from this layout. No placeholder rows or minimum page height are introduced. The no-match explanation stays anchored to the local viewport even when the table is horizontally scrolled.

### Page-local filtering in the sandbox preview

Search and physical-handoff filters apply only to the currently fetched daily aggregate page, not the entire server result. Input values update immediately; search and non-default handoff selections settle after 250 ms using the existing shared debounce hook. Clear and day/page changes reset the local filters immediately and must not later reapply a queued old value. Local filtering does not issue requests, so request-abort and out-of-order response clauses do not apply to this path; server paging and query-key isolation remain with the existing query owner.

### Pending navigation in the sandbox preview

During an uncached day/page read, the preview keeps the last committed presentation mounted under its unchanged day heading, selected-day marker and page number, and names the requested target in a pending status. This in-memory presentation is read-only, not target-key query data. The latest workflow outcome replaces it; source failure, query error/denial or customer/week change clears it. Initial loading still uses its separate state surface. Neither previous-key `.data` nor fabricated rows/heights may substitute for target data. Same-key refetch also locks weekly calculation and serving writes, cancels confirmation and does not reopen it on completion. The Demand preview uses the user-approved viewport workbench: the daily ledger occupies the remaining screen space, with heading/filter and pagination outside the vertical rows/detail scroller. A separate "Số suất và món nguồn" item sits below the day list in the left navigation. Selecting it replaces the right-hand ledger with the current committed day's shifts/dishes/serving controls (date explicitly titled); it never expands underneath the rail or ledger. Exactly one navigation item is current. Clicking a day returns to the ledger. Source mode has no ingredient filter/pagination/approval status; local view switches issue no query or save. Serving drafts remain owned by scheduleWorkflow.quickServingInputs and existing save/complete/permission/readiness guards are unchanged. Source mode has a native "Ngày xem nguồn" selector that calls the existing day owner without leaving source mode; it uses the committed day value and is disabled while pending/busy. Completed shifts display the confirmed `currentServings` count and completion label beside the shift heading instead of redundant disabled input/button/status controls. Incomplete shifts keep the existing QuickServingCell/save/complete/permission guards. Dish rows retain their source identity and use a bounded two-column dish/BOM layout; missing BOM retains an explicit warning label. No new rail groups or tabs are introduced.

Empty ledger links to this source view rather than embedding it. Short pages contain only real rows; remaining canvas belongs to the workspace, not a twelve-row placeholder. Committing a new day/page resets local vertical scroll to the beginning; pending and same-key refetch preserve it, focus and document position. The preview shell has no top app header; this geometry is feature-local and must not be copied into other shells without their sizing contract. At viewport heights below 600px or widths at most 900px, document-flow fallback keeps controls/content reachable rather than squeezing or clipping them; this is not proof of native zoom compatibility.

Approval remains a business status during pending/refetch. No visible changing refresh prose or redundant viewed-page line is rendered. One small activity indicator accompanies the daily work object, with a screen-reader announcement naming the requested target and the committed content's read-only state. Reduced motion uses a static activity glyph. All pending write/confirmation guards remain enforced. Weekly conditions have a summary near the command and open as a separate full-width disclosure below scope, without pushing customer/week down; the disclosure has a bounded scroller on desktop and natural flow in the low-height fallback. Chrome's `::details-content` is used for the disclosure grid placement; other browser/version conformance remains unproven.

Demand-local pending styling retains the command/directional-button palette without changing native/aria-disabled activation guards; actual unavailable/error states retain their disabled treatment. Browser evidence is scoped to measured transitions/disclosure/detail/reflow, not whole-product acceptance.

The preview opts into `PaginationBar.preserveFocusWhilePending`: available previous/next buttons stay focusable with `aria-disabled` while pending, and pointer/keyboard activation cannot request another page. Boundary-disabled directions, page-size/jump controls and all consumers without the opt-in retain their existing native-disabled behavior. Focus restores to an available direction on completion. Scroll follows the pagination anchor within the real document scroll range; a short page with zero maximum scroll necessarily clamps to zero, not a fabricated height reservation.

## 4. Query Recovery & Permission Integrity

The sandbox Demand preview may retain read-only demand content after a recoverable refetch failure (`FETCH_ERROR`, timeout, HTTP 5xx) only when all three active-key query `currentData` values still exist. It must disclose stale data and offer retry, keep generation/serving writes and confirmation unavailable, and suppress retained content for any source 401/403 or missing current-key data. It must not reuse previous-key `.data` across day/page/customer/week changes. This preview opt-in does not change the legacy WeeklyMenuPage error contract. An open weekly confirmation is cancelled when read readiness is lost and must not reopen automatically after retry succeeds.

1. **Serving Query Error Recovery:**
   If the meal-plan query returns an HTTP error (500/503), an inline retry banner mounts in normal flow above the readiness checkpoint. Readiness marks serving counts as unverified (`danger`), preventing false "ready" badges. Upon successful retry, cached warnings clear.
2. **Kế hoạch sản xuất 403 Forbidden State:**
   When an actor lacks `production.read` permission and the API returns 403, the UI must render an explicit permission denial notice. It must **never** render a false "Chưa có kế hoạch" (No plan found) empty state or display active day filters.
3. **KHSX Empty State Copy:**
   When an authorized actor accesses a valid customer/week that has zero plans, the empty state must state clearly: *"Chưa có kế hoạch sản xuất trong tuần đã chọn"*. It must **not** instruct the user to re-select the already-selected customer or week.

### Scoped confirmation and serving-save recovery in the sandbox preview

Weekly confirmation keeps all per-date reasons in the shared DialogBody primary scroller; title/scope and confirm/cancel remain outside that scroller. Busy confirmation vetoes Escape/backdrop/cancel, while the shared modal lifecycle retargets focus from a disabled control to an enabled child or the dialog root. Closing restores the exact opener; when refetch temporarily disables it, restoration waits only while focus remains on the body/modal fallback and is cancelled by deliberate focus/navigation, another modal, opener removal or disposal. The five-second observer cap is resource cleanup, not a readiness SLA. Short confirmations remain content-sized; existing labels/variants and nested-modal semantics are preserved.

The Demand preview controller renders quick-serving feedback using the existing InlineAlert (danger uses role=alert, non-error uses role=status), replaces it with subsequent workflow feedback and clears it on customer/week change. Failed saves retain the existing date/shift-key draft; source refetch readiness and retry through existing blur/Enter/completion controls remain owned by the unchanged schedule workflow. Unsaved status alone is not failure feedback. This scoped repair is not durable-save, actor, performance or whole-page acceptance.


## Template Studio contract

Default template fallback is immutable. A customer override identifies source and version explicitly; preview/parsing/diagnostic navigation never persists menu data. Save is explicit. Blocking errors prevent save; acknowledged warnings remain distinguishable. Diagnostics retain sheet/cell/range identity. Drag-selected and A1 ranges normalize to the same range and retain keyboard parity. Numeric sketch widths/themes are not business authority.

## Planning preview composition — production cutover pending

The existing `/__kit/planning/*` owners implement the approved five-destination hybrid (Cost/BOM remain independently capability-gated local views), not a new application. These entries still obey their DEV/exact-preview-flag and auth/mode gates. Production `/weekly-menu` and navigation are unchanged until mounted visual/FR/NFR acceptance passes; approval of drawings alone is not cutover evidence.

This revision supersedes the older sandbox presentation paragraphs above where they prescribe a six-column physical Demand table, bounded vertical workbench scrolling or Handoff BOM export:
- Schedule renders four distinct shift×variant matrices using the existing import merge primitive; source cells and ordering remain unchanged.
- Demand uses page-flow projected quantities, historical allocation and server-supplied suggested purchase quantity. `DemandLine.projectedPurchaseQty` preserves `SuggestedPurchaseQty` additively; it does not redefine physical `available`/`issuedQty`. Neither allocation nor suggestion is current stock/purchase entitlement. Sources attach to their ingredient; the week command and incomplete-shift serving controls retain existing workflow handlers/guards.
- Production presents persisted plans as master/detail. A persisted `sentToKitchenAt` is shown as a sending fact, without changing the generic status mapper or moving the Coordination send action.
- Cost keeps existing model rounding; per-dish explanation uses its effective scoped BOM and quantity factor, directly after the selected row. Missing BOM is not zero; nonpositive reference prices are marked for checking, not asserted to be free.
- BOM shows one dish/per-serving gross quantity to six decimals; the API does not supply an independent net quantity. CSV exports only that selected dish. No invented net/loss calculation.
- Handoff reads only its physical report family (no analytical BOM/catalog query). CSV is explicitly **current page**, not full-week report or BOM. Aggregate metadata cannot invent issue/receipt source-line identities; document-level detail remains an API/evidence limitation.
- Shared CommandBar scope, ContextStrip inline and TableViewport quiet-operational own the relevant surfaces/density. No global theme/token/portal Phase B changes.

Implementation/check status and bounded residuals belong to `.planning/WORK.md`; authenticated browser, persistence, compatibility and performance are not certified by unit/build checks.

## DEFAULT read-oriented planning sandbox candidates

Four sandbox entries `/__kit/planning/dish-materials`, `/cost`, `/production-plan` and `/purchase-summary` under the same planning prefix are DEV/exact preview-flag only, ProtectedRoute + coordination.read + SystemOperationProvider. They do not replace `/weekly-menu`, production navigation, capability lists or the Schedule/Demand candidates. DEFAULT and the matching weekly-menu capability must be present before business queries mount; MRX material-demand and meal-orders are separate.

`planning/cost/ReadPlanningPreviewPage.tsx` composes the existing committed-menu customer/week, schedule/contract tier and serving/BOM model inputs without mounting import, editor, mutation or hidden Demand queries. Only the active workspace mounts its read family. Source reads use active-key `currentData`, deny/error surfaces precede content, and customer/week changes replace local selections. Tier remains schedule → contract → existing default with invalid/multiple schedule tiers blocked. BOM analysis date remains the existing active service day or first displayed day, not a new selector.

- `planning/dish-materials/DishMaterialsScreen.tsx`: one dish/serving/effective BOM; gross quantity is not actual consumption; prices are reference prices.
- `planning/cost/CostScreen.tsx`: unchanged costModel arithmetic (unrounded gross × reference price, existing unit-cost rounding), day/shift/slot/dish/servings; partial missing BOM is explicitly excluded from the displayed total, not a zero-cost claim.
- `planning/production-plan/ProductionPlanScreen.tsx`: persisted PlanId/MenuVersion/lifecycle and date/shift/dish lines; ProductionAccess remains the BE permission boundary. No send-to-kitchen command.
- `planning/handoff/HandoffScreen.tsx`: physical aggregate rows retain date/customer/tier/ingredient/unit and whole-filter server counters/search/page. Successful physical empty does not become a BOM table. Plain actor hints never create purchasing/issue/receipt commands.

`Xuất BOM dự kiến` reuses unchanged `buildWarehouseCsv` projection bytes from committed scoped weekly rows/servings/effective BOM with a real customer code and week. The candidate never calls the legacy exporter with UNKNOWN/hardcoded-date fallbacks. CSV legacy LT/TT columns are projected quantities from the model, not consumption or physical issue/receipt; on-screen provenance states this. Export is blocked while sources are unavailable/denied/invalid or no BOM material exists, and does not create a durable handoff.

`usePurchaseSummary` now rejects previous-key `.data` on uncached search/page/scope transitions, while retaining ready same-key `currentData` during refresh and failing closed on denial. Legacy WeeklyMenuPage also receives this safer pending behavior; no whole-legacy acceptance is inferred. These are sandbox implementation candidates, not PAGE_READY or production cutover.

Read-only sandbox handoff pager retains same-scope/search navigation metadata only while pending, not rows/counters. Requested page differs from committed results. Search/scope/denial/error resets metadata; existing focus preservation prevents repeat activation. No production acceptance implied.

Schedule menuPrice is required and non-null in MenuScheduleDto. Every present schedule price must pass finite/supported-tier validation before resolving a unique tier. Only no schedule rows permits contract/default fallback; zero, negative, nonfinite or mixed invalid prices block analytical BOM/cost and projected CSV, not otherwise valid physical handoff reads.
