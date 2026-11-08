# IPCManagement — System-Wide Information Prioritization, Content Redundancy, Spatial Efficiency & Layout Composition Audit

**Document Status:** Adopted UI Architecture & Layout Audit
**Scope:** Entire Frontend Application (`src/routes`, `src/app`, `src/features`, `src/components`, `src/styles`)
**Authority References:** `docs/DESIGN.md`, `docs/DASHBOARD-UI-RULES.md`, `docs/UI-PHILOSOPHY.md`, `docs/GLOSSARY.md`, `docs/LIFECYCLE-CONTRACT.md`

---

## A. Project Constraints & Existing Rules

### 1. Authority Hierarchy
Per `docs/DESIGN.md` §1 and `docs/DASHBOARD-UI-RULES.md` §0.3:
1. **Business Authority:** Work object, grain, lifecycle state, permission, mutation owner.
2. **Page Composition & Floorplan:** Primary task, scope control, work surface, prerequisite/empty/error state.
3. **Shared Primitives:** `OperationalFrame`, `CommandBar`, `SectionPanel`, `QueryViewBoundary`, `EmptyState`, canonical table/dialog primitives.
4. **Design Tokens:** Spacing, typography, semantic colors, border radius, control heights, visual density.
5. **Page-Local Overrides:** Permitted only when the four higher tiers do not own the concern.

### 2. Normative Invariants & Specific Rules
- **Floorplan Contract (`DESIGN.md` §2):**
  ```text
  Route identity
  → Scope / command controls
  → Context or prerequisite state
  → Primary work surface
  → Secondary detail / rail
  ```
- **Visual Coherence Invariants (`DESIGN.md` §4):**
  - **Adjacency (V2):** Heading, description, control, and content for the same work object must be in the same visual group.
  - **No Orphan Control / Heading (V2):** Controls cannot sit alone in the corner of a large blank surface; headings cannot be isolated from content.
  - **One-State / One-Surface (V3):** Exactly one explanatory surface per state cell. Never render an empty panel plus an alert below explaining why it is empty.
  - **Bounded Whitespace (V5, C10):** Whitespace must express hierarchy, never generic `min-height` defaults. No synthetic padding or placeholder rows.
  - **Action Proximity (V7):** Next action must be inside the state surface or within one section gap of the affected work object.
  - **State Honesty (V3, E1):** Loading, ready-empty, prerequisite, forbidden, and error states have distinct geometry and semantics.
- **Action Prioritization (`DASHBOARD-UI-RULES.md` D7):** Only **one** primary button (`ipc-button-primary`) per context area. Secondary/tertiary controls use outline or ghost styling.
- **Data Representation (`DASHBOARD-UI-RULES.md` L1–L3):** "Tên trước, mã sau" — primary human-readable name in standard weight; technical code secondary in `<IdentifierText>`. Decode structured codes into human context.
- **Empty State Policy (`DASHBOARD-UI-RULES.md` E1–E4):** 4 distinct empty types:
  1. *First use / uncreated:* Explain purpose with primary creation CTA.
  2. *Filtered / search empty:* State active filters with "Xóa bộ lọc" action.
  3. *No pending work / completed:* Positive, reassuring message without alarm.
  4. *Error:* Actionable retry mechanism.
- **Progressive Disclosure (`DASHBOARD-UI-RULES.md` P4, T12):** Table surfaces maintain 5–7 decision columns; deep lineage, technical IDs, and extended descriptions belong in drawers, dialogs, or popover helpers (`InfoNote`).

---

## B. Existing Non-Functional Requirements (NFRs) Affecting UI

| NFR Domain | Requirement & Threshold | Verification Seam |
|---|---|---|
| **Usability** | Situational awareness < 2s; clear visual hierarchy; scanability over decoration | Floorplan ordering; visual weight of signals |
| **Accessibility** | WCAG 2.2 Level AA; semantic hierarchy (`h1` shell → `h2` section → `h3`/`h4` detail); tap targets ≥ 24×24px; contrast ≥ 4.5:1 text, ≥ 3:1 non-text | `sectionPanelHeadingContract.test.ts`, axe CI gates |
| **Responsiveness** | Responsive continuity; table horizontal scroll with sticky header & frozen ID column; no clipped actions or text overflow | Table contracts, responsive visual audits |
| **Performance** | CLS ≤ 0.1, LCP ≤ 2.5s, INP ≤ 200ms; lazy-loading heavy dialogs; debounced search (250–300ms) | Route budget checks, bundle split verification |
| **Maintainability** | Shared primitives first; no ad-hoc page styling hacks; no parallel component variations | Primitive convergence tests |
| **Security / RBAC** | UI respects permissions (`useHasPermission`, `ActionGuard`); no action or sensitive data exposure on unauthorized surfaces | RoleGuard, ModeGuard, permission tests |
| **Observability** | Technical metadata, event logs, and mutation tracing remain accessible via progressive disclosure | Admin Audit Panel, Source Change Logs |

---

## C. Content Hierarchy Findings

### 1. Shell Header vs Page Body
- **Finding:** The shell (`MainLayout.tsx`) already renders a top header containing:
  - Workflow breadcrumb (`Tổng quan / {workflow}`)
  - Route title `<h1>` (`pageContext.title`)
  - Operating date chip
  - System mode badge (DEFAULT vs MATERIAL_RECONCILIATION)
  - Lifecycle status pill
- **Defect:** Multiple pages (e.g. `PurchasingPage.tsx`, `ReconciliationWarehousePage.tsx`) introduced an additional prominent `<h2>` banner directly below the shell, repeating the page name or active tab name with redundant icons.
- **Remediation:** Remove redundant outer page title banners; ensure the first heading inside the page content cleanly functions as an `h2` section title for the primary work surface.

### 2. Information Weighting: Primary vs Decision-Support vs Context vs Secondary
- **Primary Information:** The core work object (e.g., purchase order lines, weekly menu schedule, reconciliation comparison rows, delivery receipts). Must be prominently visible and scan-friendly.
- **Decision-Support Information:** Summaries, badges, totals, warning alerts, and progress steppers that guide the next action. Must stay adjacent to the primary surface.
- **Context Information:** Customer scope, active date, active warehouse, active shift. Best housed compactly in `CommandBar` metadata or filter bars.
- **Secondary / Technical Information:** Concurrency versions, batch GUIDs, raw audit timestamps, detailed calculation formulas. Must be progressively disclosed via `InfoNote`, drawers, or modals.

---

## D. Redundancy Findings

1. **Title & Heading Redundancy:**
   - `PurchasingPage.tsx`: Top `h2` "Thu mua theo nhu cầu đã duyệt" duplicated the active `ViewSwitcher` tab "Xử lý thu mua".
   - `ReconciliationWarehousePage.tsx`: Ad-hoc card `h2` "Xuất kho theo định lượng đã chốt" followed immediately by `h3` "Phạm vi lô xuất kho" and tab views.
   - `ApprovalPage.tsx`: Shell `<h1>` "Duyệt vận hành" followed by tab "Duyệt chứng từ", followed by `SectionPanel` "Danh sách cần duyệt".
2. **Explanatory Copy Bloat:**
   - `WarehouseReceiptLifecyclePanel.tsx` (L243): Long multi-sentence paragraph explaining the entire 4-stage lifecycle ("Tạo phiếu → kiểm tra chất lượng từng dòng nguyên liệu → Quản lý duyệt → Quản trị viên ghi sổ kho..."). The stepper and action buttons already communicate this.
   - `WeeklyMenuPage` sections (`ProductionPlanSection.tsx`, `PurchaseSummarySection.tsx`, `DishMaterialsSection.tsx`, `MenuCostSection.tsx`): Long inline descriptions repeating the tab's self-evident purpose.
   - `ReportsPricePanel.tsx`: Multiple panels with identical icon and descriptive copy ("Biến động giá theo nhà cung cấp", "Biến động giá theo thời gian", etc.).
3. **Contextual Scope Repetition:**
   - `ReconciliationPage.tsx`: SectionPanel description dynamically concatenated `Khách hàng: ${batch.customerName}` when the customer dropdown directly above already displayed this context.

---

## E. Dead-Space & Structural Waste Findings

1. **Nested Cards and Double Padding:**
   - `ApprovalRulesPage.tsx`: Outer `<div className="p-4 space-y-6">` wrapping `<SectionPanel padded={true}>`, compounding padding.
   - `AdminBomPanel.tsx`: `SectionPanel` wrapping an outer card with border/padding, which wrapped another inner card.
   - `WarehouseExceptionsWorkbench.tsx`: Multiple stacked `SectionPanel`s with redundant spacing.
2. **Fixed-Height Dead Space:**
   - `WarehouseReceiptLifecyclePanel.tsx`: Contained `min-h-[20rem]`, forcing empty height even when zero receipts exist.
   - Replaced with content-driven intrinsic sizing (`min-h-0`).

---

## F. Empty-State Strategy Findings

1. **Ad-hoc Empty State Containers:**
   - In `ReconciliationPage.tsx`, when filtered batches returned zero results, an ad-hoc `<section className="rounded-lg border ... p-6 text-center">` was used instead of canonical `<EmptyState variant="filtered">`.
   - In `WarehouseMovementPanel.tsx`, error states were mounted inside alert cards rather than standard empty state boundaries.
2. **Standardizing the 4 Empty Variants:**
   - Standardized usage across all domains:
     - `variant="uncreated"`: For clean first-use states with primary creation action.
     - `variant="filtered"`: For zero results after filter/search with "Đặt lại bộ lọc" CTA.
     - `variant="empty"`: For zero pending work / complete state.
     - `variant="error"`: With explicit retry trigger.

---

## G. Progressive Disclosure Opportunities

1. **Technical Identifiers & Hashes:**
   - Keep UUIDs, batch IDs, and database keys hidden from primary scanning view; render through `<IdentifierText>` with copy-to-clipboard on demand.
2. **Extended Instructional Guidance:**
   - Leverage `SectionPanel`'s built-in `descriptionPlacement="popover"` (`InfoNote`) to move lengthy instructions into an unobtrusive `(i)` popover button, keeping the primary work surface clean and uncluttered.

---

## H. Table Information Architecture Findings

1. **Scanability & Column Alignment (Rule T1–T3):**
   - Text left-aligned; quantities, prices, and percentages right-aligned with `tabular-nums`.
   - Frozen identifier columns on wide tables.
2. **Progressive Disclosure in Tables (Rule T12):**
   - Tables limited to 5–7 critical decision columns on primary surface; detailed breakdown opened in right-side drawer or modal.

---

## I. Action Priority Findings

1. **Single Primary Action Rule (Rule D7):**
   - `CommandBar` enforces at most one primary button. Secondary actions styled as `outline` or `ghost`.
   - In `CoordinationPage` (`action-toolbar.tsx`), stage-dependent actions (`Chốt đơn cả ngày` vs `Gửi kế hoạch cho Bếp`) are mutually exclusive, preventing competing primary actions.
   - In `WarehousePageHeader`, "Tạo phiếu xuất kho" is the sole primary action; navigation links ("Xem tồn kho", "Bàn giao cho bếp", "Quay lại thu mua") use secondary/ghost styles.

---

## J. Shared Root Causes

1. **Copy Duplication Instinct:** Developers frequently added explanatory paragraphs below headings to describe obvious UI elements.
2. **Container-First Thinking:** Adding cards and wrapper divs around every component, resulting in nested borders and double padding.
3. **Ad-Hoc State Banners:** Implementing custom boxes for empty/error states instead of using canonical `EmptyState`.

---

## K. Refactor Decisions

1. **Shared Primitives:**
   - Streamline `SectionPanel` default header spacing and keep `descriptionPlacement="popover"` as default for non-critical descriptions.
   - Ensure `EmptyState` handles all 4 canonical variants cleanly with intrinsic sizing.
2. **Domain Cleanup:**
   - Prune redundant titles and long explanatory blurbs in `WarehouseReceiptLifecyclePanel`, `WeeklyMenuPage` sections, `ReportsPricePanel`, `PurchasingPage`, and `ReconciliationPage`.
   - Flatten nested card wrappers in `AdminBomPanel`, `ApprovalRulesPage`, and `ReconciliationWarehousePage`.
3. **Contract Preservation:**
   - Retain all 64 `SectionPanel` heading callsites classified in `sectionPanelHeadingClassification.json`.
   - Retain all 32 table contracts in `tableContracts.test.ts`.

---

## L. Justified Local Exceptions Retained

1. **`ReconciliationLifecycleStrip` Step Indicators:** Kept explicitly visible on `ReconciliationPage` because tracking the 5-step closed-loop lifecycle is a regulatory/compliance requirement for Material Reconciliation.
2. **`ServiceRunBlockerPanel`:** Kept as an inline contextual blocker banner because missing shift close-outs represent an operational blocker that must prevent downstream transactions.
3. **Inline Description in `MenuAmendmentInbox`:** Kept as `descriptionPlacement="inline"` because the authorization split (Manager approves vs Admin executes) is a critical compliance invariant.

---

## M. Decision Log

| Current Problem | Semantic Purpose | Decision | UX / Business / NFR Rationale | Scope |
|---|---|---|---|---|
| Redundant `h2` page titles below shell `h1` in `PurchasingPage` | Distinguish active purchasing view | **Reduce / Merge** | Shell `h1` and `ViewSwitcher` already identify the view; remove redundant `h2` header to eliminate visual noise | Domain (`PurchasingPage.tsx`) |
| Multi-sentence lifecycle paragraph in `WarehouseReceiptLifecyclePanel` | Explain receipt processing stages | **Reduce** | Action buttons and status stepper already convey the lifecycle; prune to concise 1-sentence prompt | Domain (`WarehouseReceiptLifecyclePanel.tsx`) |
| Redundant explanatory descriptions in Weekly Menu view sections | Describe tab purpose | **Reduce / Popover** | Tab names are self-explanatory; convert extended guidance to `InfoNote` popovers | Domain (`weekly-menu/*.tsx`) |
| Ad-hoc empty box in `ReconciliationPage` when batch filters yield 0 results | Indicate filtered empty state | **Recompose** | Use canonical `<EmptyState variant="filtered">` with "Đặt lại bộ lọc" button | Domain (`ReconciliationPage.tsx`) |
| Compounded padding in `ApprovalRulesPage` (`p-4` around `SectionPanel`) | Group approval rules | **Simplify** | Remove unnecessary outer padding `div`; let `OperationalFrame` and `SectionPanel` handle rhythm | Domain (`ApprovalRulesPage.tsx`) |
| Stacked ad-hoc cards in `ReconciliationWarehousePage` | Scope batch selection and issue actions | **Recompose** | Integrate scope controls cleanly into `CommandBar` / section header; remove duplicate cards | Domain (`ReconciliationWarehousePage.tsx`) |

---

## N. Risks & Remaining Out-of-Scope Issues

- **Risk:** Modifying `SectionPanel` props or headings could break `tests/sectionPanelHeadingContract.test.ts`.
  *Mitigation:* Keep title strings and heading levels identical to `sectionPanelHeadingClassification.json` manifest.
- **Risk:** Altering table columns could break table contract tests.
  *Mitigation:* All 32 table contracts remain untouched in column count and structure.
- **Out-of-Scope:** Backend API modifications, authorization logic changes, or database migrations. All work strictly contained in the frontend presentation layer.
