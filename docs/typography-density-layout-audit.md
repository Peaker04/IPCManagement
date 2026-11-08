# System-Wide Typography, Visual Density & Layout Rhythm Audit

> **Scope**: Repository-wide audit across frontend tokens, shared primitives, layout shells, operational tables, dashboards, forms, and secondary metadata.
> **Normative Standards**: `docs/DESIGN.md`, `docs/DASHBOARD-UI-RULES.md` (Sections D, L, S, T, M, C, F), WCAG 2.2 AA, ISA-101 HMI, Core Web Vitals.
> **Authoritative Inventory Date**: 2026-09-15

---

## 1. Executive Summary & Architectural Foundations

The IPCManagement system is a hybrid industrial ERP/MES operations platform serving warehouse managers, head chefs, procurement coordinators, and administrators. The frontend architecture is built on:

1. **Design Token Layer**: Defined in `frontend/src/styles/index.css` via Tailwind CSS v4 `@theme inline` and CSS custom properties (`:root`).
   - Font Families: `Inter Variable` (`--ipc-font-sans`) and monospace (`--ipc-font-mono`).
   - Semantic Type Scale: `--text-page-title` (1rem / 16px, 700), `--text-section-title` (0.9rem / ~14.4px, 700), `--text-body` (0.875rem / 14px, 400), `--text-label` (0.75rem / 12px, 600), `--text-caption` (0.75rem / 12px, 400), `--text-code` (0.8125rem / 13px, 500).
   - Component Tokens: Button (14px/12px), Input (16px/14px), Badge (12px), Card Title (16px/14px), Table Body (13px), Table Header (12px).
   - Spacing Scale: 4/8px base scale (`--ipc-space-1: 4px` to `--ipc-space-8: 28px`).
   - Control Heights: 32px (`xs`), 36px (`sm`), 40px (`default`), 44px (`lg`).
   - Table Density Tokens: `--table-row-height-compact: 40px`, `--table-row-height-standard: 48px`, `--table-row-height-relaxed: 56px`.

2. **Shared Component & Helper Layer**:
   - `src/lib/typography.ts`: Canonical helper mapping static semantic roles (`pageTitle`, `sectionTitle`, `body`, `label`, `caption`, `code`, `numeric`).
   - `src/components/common/TableViewport.tsx`: Canonical scrollable table container with `data-density` attribute (`compact` | `standard` | `comfortable`), sticky headers, and frozen first columns.
   - `src/components/common/SectionPanel.tsx`: Primary content partition wrapper with semantic `headingLevel` (h2 route-primary, h3/h4 nested-detail).
   - `src/components/common/CommandBar.tsx`: Scope and filter toolbar.
   - `src/components/common/ViewSwitcher.tsx`: Horizontal tab / view navigation.

3. **Core Problem Identified During Audit**:
   While the design token foundations and contract tests (`typographyContract.test.ts`, `tableContracts.test.ts`) are robust at the root, **multiple historical CSS style layers** (`src/styles/components/*.css` and `src/styles/redesign/*.css`) have accumulated competing, duplicate, or rigid declarations that override or bypass tokens:
   - Contradictory table font-size and padding rules between `index.css` and `tables.css`.
   - Rigid `height: 40px/48px/56px` in `tables.css` rather than intrinsic content-driven sizing.
   - Hardcoded pixel heights (`min-h-[420px]`, `min-h-[580px]`, `h-[220px]`, `h-[145px]`) causing artificial whitespace or viewport stretching.
   - Non-token spacing (10px, 14px, 18px, 6px) scattered in legacy CSS rules instead of the 4/8px scale.
   - Ad-hoc utility typography classes (`text-xs`, `text-sm`) mixed with semantic roles.

---

## 2. System-Wide Pattern Audit Inventory

### Group 1: Typography System & Typographic Hierarchy

| Pattern / Component | Locations Affected | Current Behavior | Inconsistency | Root Cause | Shared-Layer Solution | Local Exception? | Refactor Decision |
|---|---|---|---|---|---|---|---|
| **Table Cell & Header Font Size** | `src/styles/index.css` vs `src/styles/components/tables.css` | `index.css` declares `th` 0.75rem (uppercase) & `td` 0.875rem (14px). `tables.css` overrides with `th` 0.8125rem & `td` 0.8125rem (13px). | Header and body font sizes conflict depending on CSS load order; body text is 13px while token `--text-body` is 14px. | Fragmented CSS authoring across multiple files instead of single token source. | Unify `.ipc-data-table` to reference `--text-table` (0.8125rem) for body and `--text-table-header` (0.75rem / font-weight: 700) for headers. Clean up duplicate block in `index.css`. | No | Standardize in `tables.css` and `index.css`. |
| **Page Heading Sizing** | `src/styles/index.css:521` (`.ipc-page-heading`) vs `@theme inline` | `.ipc-page-heading` has `font-size: 1.05rem`, while `--text-page-title` is `1rem` (16px). | 1.05rem is arbitrary literal outside the 6-level typographic scale. | Legacy bespoke styling before semantic tokens were locked. | Set `.ipc-page-heading` font size to `var(--text-page-title)` with line-height `var(--text-page-title--line-height)`. | No | Replace literal with token reference. |
| **Section Title Sizing** | `src/styles/index.css:484` (`.ipc-section-title`) | Inherits or sets local color without explicitly referencing `--text-section-title`. | Potential drift from 0.9rem / 700 font weight defined in token scale. | Omission of semantic token class. | Ensure `.ipc-section-title` declares `font-size: var(--text-section-title); font-weight: var(--text-section-title--font-weight);`. | No | Wire `.ipc-section-title` directly to token. |
| **Monospace / Identifier Typography** | Domain tables across Warehouse, Purchasing, Approvals | Raw `<code>` tags have `font-size: 0.875rem` in `index.css:440`, but `--text-code` is `0.8125rem` (13px). | Inline `<code>` is larger than table body (13px), creating visual distortion in table cells. | CSS base rule for `code` predates the 13px `--text-code` token. | Update base `code` style in `index.css` to `font-size: var(--text-code); line-height: var(--text-code--line-height);`. | No | Align `code` element styling with `--text-code`. |
| **Secondary Metadata Typography** | Domain cards, table subtext, filter labels | Inconsistently styled using `text-xs text-slate-500`, `text-xs text-slate-600`, `text-[11px]`, or `text-sm text-slate-500`. | Lack of uniform hierarchy between primary labels and secondary annotations. | No shared semantic helper for metadata caption. | Route secondary subtext through `text-caption` / `typography.caption` and `--color-text-muted` (`var(--ipc-color-text-muted)`). | No | Normalize secondary metadata to caption token. |

---

### Group 2: Table Density & Row Sizing

| Pattern / Component | Locations Affected | Current Behavior | Inconsistency | Root Cause | Shared-Layer Solution | Local Exception? | Refactor Decision |
|---|---|---|---|---|---|---|---|
| **Rigid Row Heights in Table Viewport** | `src/styles/components/tables.css:464-477` | Hardcoded `td { height: 40px; }` for compact, `height: 48px;` for standard, `height: 56px;` for comfortable. | Rigid `height` breaks layout when table cells have multiline content (e.g. dish name + ingredients, customer name + date/shift, batch notes), clipping text or breaking vertical alignment. | Sizing enforced as rigid pixel height instead of content-driven min-height with vertical padding. | Change `height: 40px/48px/56px` to token-driven `min-height: var(--table-row-height-*)` and calibrate cell padding (`py-1.5` for compact, `py-2` for standard, `py-3` for comfortable) with `vertical-align: middle`. | No | Refactor row height rules to content-driven sizing in `tables.css`. |
| **Zebra Striping vs Hover Conflict** | `src/styles/components/tables.css:402` vs `index.css:731` | `tables.css` has `tbody tr:nth-child(even)` background, while Rule T5 states: "Zebra striping should be avoided when tables have many interaction states (hover, selected, disabled)". | Multi-state operational tables (Warehouse, Approvals) look busy and stripe interferes with selection color. | Legacy table style lingering in `tables.css`. | Eliminate alternating zebra background in favor of clean 1px horizontal dividers (`border-b border-slate-200`) and subtle hover (`var(--ipc-color-surface-selected)`). | No | Remove zebra striping in `tables.css`. |
| **Numeric Cell Alignment & Tabular Nums** | 32 canonical tables in `docs/table-contracts.json` | Most numeric cells use `text-right tabular-nums`, but several custom report columns omit `tabular-nums` or align left. | Numerical values shift horizontally during polling/refetching, violating Rule C4 and T3. | Ad-hoc table cell formatting in feature components. | Enforce `tabular-nums font-variant-numeric: tabular-nums` via `.ipc-data-table td[data-cell-role="numeric"]` and `typography.numeric`. | No | Standardize numeric class in `tables.css`. |
| **Status Cell Sizing Stability** | `src/styles/index.css:355` (`.cell-status`) | `--cell-status-min-w: 7.75rem`, `height: 1.5rem`, `white-space: nowrap`. | Some domain tables use unconstrained status containers, causing column jitter when status changes. | Incomplete migration to canonical `StatusLozenge` / `.cell-status`. | Reuse `.cell-status` token and `StatusLozenge` across all 32 canonical tables. | No | Consolidate status containers. |

---

### Group 3: Spacing System & Vertical Rhythm

| Pattern / Component | Locations Affected | Current Behavior | Inconsistency | Root Cause | Shared-Layer Solution | Local Exception? | Refactor Decision |
|---|---|---|---|---|---|---|---|
| **Page Stack Rhythm** | `src/styles/index.css:446` (`.ipc-page-stack`) | `gap: 18px;` | 18px is an off-grid arbitrary value (base scale is 4/8/16/20/24/28px). | Historical typo or eyeball tuning. | Change to `gap: var(--ipc-space-4);` (16px) or `gap: var(--ipc-space-5);` (20px). | No | Align `.ipc-page-stack` gap to 16px (`--ipc-space-4`). |
| **Section Header & Footer Padding** | `src/styles/index.css:465, 481` (`.ipc-section-header`, `.ipc-section-footer`) | `padding: 10px 14px;` | 10px and 14px are off-grid literal pixel values. | Written before 4/8px spacing tokens were standardized. | Change padding to `padding: var(--ipc-space-2) var(--ipc-space-4);` (8px 16px) or `10px 16px`. | No | Normalize to tokenized padding. |
| **Field Row & Input Gap** | `src/styles/index.css:820` (`.ipc-field-row`) | `gap: 6px;` | 6px is off-grid (should be 4px or 8px). | Local micro-adjustment. | Change to `gap: var(--ipc-space-1);` (4px) or `gap: var(--ipc-space-2);` (8px). | No | Align to `--ipc-space-1` (4px). |
| **Duplicate Spacing Token** | `src/styles/index.css:191-192` | `--ipc-space-5: 20px;` and `--ipc-space-6: 20px;` | Both space-5 and space-6 are defined as 20px. | Mistake in root tokens. | Define `--ipc-space-5: 20px; --ipc-space-6: 24px; --ipc-space-7: 28px; --ipc-space-8: 32px;` to follow standard 4/8px progression. | No | Fix token progression. |

---

### Group 4: Visual Density Contexts

| Density Context | Target Domains | Intended Information Density | Geometry & Sizing Characteristics | Architectural Standard |
|---|---|---|---|---|
| **Data-Dense Operational** | Warehouse, Weekly Menu, Demand, Reconciliation, Chef | **High (Compact / Standard)** | Table row min-height 40–48px, compact control height 32–36px, cell padding 8px 12px, fixed table layout, frozen identification columns, minimal whitespace. | Uses `TableViewport` with `density="compact"` or `"standard"`. |
| **Standard Workflow** | Approvals, Coordination, Role Inbox | **Medium (Standard)** | Table row min-height 48px, control height 36px, balanced card padding (16px), 2-level master-detail without modal stacking. | Uses `TableViewport` with `density="standard"`. |
| **Dashboard & Summary** | Dashboard (/), Executive KPI cards | **Comfortable / Overview** | Metric cards with min-height 66–88px, distinct alert banners, card padding 16–20px, clear visual separation between KPI widgets and actionable queues. | Uses `MetricCard`, `SectionPanel`, and comfortable grid gaps. |
| **Form-Heavy & Dialogs** | Import dialogs, Batch receipt modals, Settings | **Structured Standard** | Form field gap 12–16px, control height 36–40px, clear label-input adjacency, validation messages directly below fields. | Uses `DialogContent` with max-height 85vh and sticky footer. |
| **Admin Data Management** | Admin Data (/admin-data) | **Standard Grid** | 48px standard rows, top search bar with 36px inputs, compact bottom pagination bar. | Uses `PaginatedTableFrame` with standard table grid. |

---

### Group 5: Whitespace Audit & Dead Space Elimination

| Whitespace Class | Pattern Observed | Locations Affected | Root Cause | Disposition & Remedy |
|---|---|---|---|---|
| **Class A: Intentional Whitespace** | 16–20px gap between distinct work sections (`SectionPanel`). | All operational pages | Intentional grouping hierarchy (Rule D6, DESIGN §4). | **PRESERVE**: Whitespace correctly demarcates independent work objects. |
| **Class B: Natural Viewport Space** | Blank area below short tables (e.g. 1–3 items in Approval queue). | `/approvals`, `/reports` | Natural unused space when dataset is small. | **PRESERVE**: DO NOT stretch rows or artificially expand container height to fill the screen (Prompt Principle §9). |
| **Class C: Excessive Nested Padding** | Double padding: outer container `p-4` + inner card `p-4` + table shell margin. | `AdminBomPanel.tsx`, `WarehousePurchaseReceiptDialog.tsx` | Redundant nested wrappers. | **REFACTOR**: Remove redundant inner padding wrappers; let the parent grid or section panel manage the boundary gap. |
| **Class D: Dead Space from Fixed Heights** | Hardcoded heights: `h-[560px]`, `min-h-[580px]`, `min-h-[420px]`, `h-[220px]`, `h-[145px]`. | `AppRouter.tsx:33`, `WarehousePage.tsx:467`, `TableViewport.tsx:26`, `WarehouseReceiptLifecyclePanel.tsx:250`, `ReportsPricePanel.tsx:123` | Hardcoded pixel heights forced on containers regardless of content. | **REFACTOR**: Convert rigid `h-[...]` into content-driven `max-h-[...]` or remove arbitrary `min-h-[...]` on non-canvas views so container sizes naturally to its content. |
| **Class E: Empty State Whitespace** | Huge empty white box when query returns 0 records. | Various domain panels | Rendering full-height placeholder shell without purposeful state content. | **REFACTOR**: Use canonical `EmptyState` with purposeful message and action, sizing intrinsically to content (Rule C10). |

---

### Group 6: Content Hierarchy & Secondary Metadata

| Pattern / Component | Locations Affected | Current Behavior | Target Coherent Model |
|---|---|---|---|
| **Entity Identification (`L1` Rule)** | Tables across Warehouse, Demand, Coordination | Some tables place raw UUIDs or technical codes in bold as the primary text, with human names secondary or missing. | **Tên trước, mã sau**: Primary record name in `font-medium text-slate-900` / `body`; technical code as secondary line in `text-caption text-slate-500 font-mono` using `<IdentifierText>`. |
| **Metric & KPI Numbers** | Dashboard and Admin Statistics | Various font sizes (`text-2xl`, `text-3xl`, `text-lg`) without uniform weight. | Use `MetricCard` with `tabular-nums font-semibold tracking-tight text-slate-900` at consistent scale (1.5rem / 24px for standard KPI). |
| **Helper & Validation Text** | Forms and dialog inputs | Some use red-600, some red-700, some `text-[11px]`, some `text-xs`. | Standardize helper text to `text-caption text-slate-500`; validation text to `text-caption text-status-danger font-medium`. |

---

### Group 7: Responsive & Adaptive Behavior

| Breakpoint / Device | Behavior Contract | Current Status | Remediation Plan |
|---|---|---|---|
| **Desktop Wide (≥1366px)** | Multi-column side-by-side work surfaces (e.g. Warehouse 1366px breakpoint). | Supported via `RESP-WH-01` contract test. | Maintain side-by-side layout; ensure horizontal scroll remains inside `TableViewport`. |
| **Standard Desktop (1024px–1365px)** | Stacked work surfaces, full-width data tables with horizontal scroll. | Functional, but some toolbars overflow without wrapping. | Ensure all toolbars use `flex-wrap: wrap` and `gap: var(--ipc-space-2)`. |
| **Tablet / Narrow (768px–1023px)** | Collapsed navigation, tables maintain min-width with sticky header and frozen identifier. | Handled via `TableViewport` sticky/frozen properties. | Ensure modal dialogs cap at `max-w-[90vw]` and `max-h-[85vh]` with internal scroll. |

---

## 3. Justified Local Exceptions

In accordance with Section 21 of the audit guidelines, the following local exceptions are verified and justified:

1. **`src/components/ui/toggle.tsx`**: Contains `text-[...]` for shadcn toggle size geometry (`sm: 'h-8 px-1.5 min-w-8 text-[0.8rem]'`). Justified as a component-library internal control primitive.
2. **`src/features/purchasing/pages/PurchasingPage.tsx`**: Contains local workbench display heading (`text-[20px]`). Justified as a specialized top-level workbench stage indicator covered by `arbitrarySizeAllowlist` in `typographyContract.test.ts`.
3. **Weekly Menu Schedule Matrix (`TableViewport` size="weekly")**: Uses bounded vertical scroll (`max-h-[560px] overflow-auto`) because the weekly schedule matrix (7 days x multiple meal services) is a 2D grid that requires synchronous two-axis scrolling.

---

## 4. Refactoring Action Plan

1. **Wave 1 — Design Tokens & CSS Foundation**:
   - Fix duplicate and off-grid spacing tokens in `frontend/src/styles/index.css`.
   - Resolve contradictory table typography rules between `index.css` and `tables.css`.
   - Update `.ipc-data-table td` and `.ipc-table-viewport` density classes to use content-driven `min-height` with calibrated padding instead of rigid `height`.
   - Align `.ipc-page-heading` and `.ipc-section-title` with semantic tokens (`--text-page-title`, `--text-section-title`).

2. **Wave 2 — Shared Component Layer**:
   - Standardize `SectionPanel` spacing and header padding.
   - Refactor `TableViewport` to ensure intrinsic row sizing when cells have multiline content.
   - Clean up arbitrary off-grid gap/padding values in shared navigation and layout shells.

3. **Wave 3 — Elimination of Dead Space & Arbitrary Fixed Heights**:
   - Audit and remove arbitrary `min-h-[...]` and rigid `h-[...]` containers in `AppRouter.tsx`, `WarehousePage.tsx`, and `WarehouseReceiptLifecyclePanel.tsx`.
   - Ensure all contract tests pass (`typographyContract.test.ts`, `tableContracts.test.ts`, `presentationSurfaceInventory.test.ts`, `sectionPanelHeadingContract.test.ts`, `buttonPrimitiveConvergence.test.ts`).
   - Run typecheck and linting.
