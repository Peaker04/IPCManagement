# System-Wide Form Field Spacing, Vertical Rhythm & Internal Alignment Audit

## 1. Project Constraints & Existing Rules

This audit and standardization specification is governed by the normative engineering rules of `IPCManagement`:
- **Design System Baseline (`docs/DESIGN.md`)**: Reuses the canonical design tokens for spacing, typography, colors, radii, and control heights.
- **Agent Entry Contract (`AGENTS.md`)**:
  - Preserves dirty files and zero unsolicited Git mutation.
  - Zero regression in locked UI contracts (`typographyContract`, `tableContracts`, `presentationSurfaceInventory`, `dashboardUiRulesContracts`, `sectionPanelHeadingContract`, `buttonPrimitiveConvergence`, `formPrimitiveConvergence`, `operationalStateActionRegistry`).
  - Strict preservation of RBAC permissions, API contracts, and business workflows.
- **Accessibility Invariants (WCAG 2.1 AA)**:
  - Form controls must have accessible label associations (`htmlFor`, `id`, `aria-label`, or `aria-labelledby`).
  - Error and helper messages must be accessible via `aria-describedby` and `role="alert"` for errors.
  - Focus rings (`focus-visible:ring-ring`) must not be clipped by tight container overflows.
  - Controls must remain usable under text reflow and responsive mobile viewports.

---

## 2. Canonical Spacing Tokens & Semantic Scale

The project defines an explicit spacing scale in `frontend/src/styles/index.css`:

```css
--ipc-space-1: 4px;   /* Micro-gap: Label -> Control; Control -> Inline Error */
--ipc-space-2: 8px;   /* Small-gap: Control -> Helper text; Horizontal field gap */
--ipc-space-3: 12px;  /* Compact-gap: Compact form field -> field; Toolbar gap */
--ipc-space-4: 16px;  /* Standard-gap: Standard field -> field; Card internal padding */
--ipc-space-5: 20px;  /* Medium-gap: Field group -> field group; Section panel padding */
--ipc-space-6: 24px;  /* Large-gap: Section header -> body; Major section division */
--ipc-space-7: 28px;  /* Relaxed-gap: Modal content separation */
--ipc-space-8: 32px;  /* Macro-gap: Page level section rhythm */
```

### Semantic Spacing Mapping Table

| Spacing Relationship | Semantic Token | Pixel Value | Application Rule |
|---|---|---|---|
| **Label $\rightarrow$ Control** | `--ipc-space-1` | `4px` (`gap-1` or `.ipc-field-row`) | Keeps label visually bonded to its control. Never exceed 6px. |
| **Control $\rightarrow$ Helper / Error** | `--ipc-space-1` | `4px` (`mt-1` or `gap-1`) | Subordinate guidance sits tight underneath the input. |
| **Field $\rightarrow$ Field (Compact Form)** | `--ipc-space-3` | `12px` (`space-y-3` / `gap-3`) | Used in high-density dialogs and multi-field data entry. |
| **Field $\rightarrow$ Field (Standard Form)** | `--ipc-space-4` | `16px` (`space-y-4` / `gap-4`) | Standard vertical rhythm for single-column and workflow forms. |
| **Field Group $\rightarrow$ Field Group** | `--ipc-space-5` | `20px` (`space-y-5` / `gap-5`) | Clear optical separation between distinct fieldsets or sub-topics. |
| **Form $\rightarrow$ Primary Action Strip** | `--ipc-space-4` to `--ipc-space-5` | `16px–20px` (`pt-4` / `mt-4`) | Distinct separation between inputs and submission controls. |
| **Section Container Padding** | `--ipc-space-4` to `--ipc-space-5` | `16px` (`p-4`), sm: `20px` (`p-5`) | Uniform horizontal and vertical padding for card/panel bodies. |
| **Table Toolbar Internal Padding** | `--ipc-space-2` to `--ipc-space-3` | `8px` (`py-2`), `12px` (`px-3`) | Compact horizontal strip for search and view filter controls. |

---

## 3. Root Cause Classification (Audit Findings)

Our scan revealed 5 primary root causes behind the spacing and alignment symptoms:

### Root Cause A: Nested Container Duplication (Double Padding / Clipped Borders)
- **Symptom**: In `SupplierQuotationSection.tsx`, `<SectionPanel>` already applied `p-4 sm:p-5`. An inner wrapper applied `<div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">`, doubling side padding to 32px while top padding remained 16px.
- **Symptom 2**: In `PurchaseServiceDateWorkbench.tsx` and `WarehousePurchaseOrdersPanel.tsx`, child components (`PurchaseLineGroups`, `PurchaseOrderLineGroups`) were wrapped inside an outer `<TableViewport>`. Because the children themselves render a search toolbar and an inner `<TableViewport>`, the search bar was trapped inside the outer scroll container, glued to the outer border with zero breathing room.
- **Fix**: Flatten redundant wrappers. Ensure only the actual table is enclosed by `TableViewport`, leaving toolbars cleanly outside the scroll boundary.

### Root Cause B: Flat `space-y-X` Destroying Vertical Rhythm
- **Symptom**: In `PurchaseDecisionPanel.tsx:320`, an ad-hoc `<div className="space-y-3">` placed identical 12px gaps between `Label`, `Select`, `Helper Guidance`, and `Submit Button`. This broke Gestalt proximity: the label did not bond to the select (12px instead of 4px), and the button was uncomfortably close to the helper text (12px instead of a clear action separation).
- **Fix**: Adopt the canonical field anatomy:
  - Label $\rightarrow$ Select: 4px (`gap-1`).
  - Select $\rightarrow$ Guidance: 4px (`mt-1`).
  - Field $\rightarrow$ Submit Button: 16px (`pt-2` / `mt-4`).

### Root Cause C: Inconsistent Label-to-Control Gap between Primitives
- **Symptom**: In `tables.css:353`, `.ipc-search-field` defined `gap: 0.5rem;` (8px), whereas `.ipc-field-row` in `index.css:832` defined `gap: var(--ipc-space-1);` (4px). When placed side-by-side in a 2-column grid (`SupplierQuotationSection.tsx`), the search input and the select input were vertically offset by 4px!
- **Fix**: Calibrate `.ipc-search-field` gap to `var(--ipc-space-1, 4px)`, ensuring horizontal alignment when paired with `FieldRow` or standard field inputs.

### Root Cause D: Table Toolbar Search Fields Missing `hideLabel`
- **Symptom**: In `PurchaseLineGroups.tsx` and `PurchaseOrderLineGroups.tsx`, `SearchField` rendered a visible label above the input within a table toolbar. Across the rest of the application (`WarehouseDemandPanel`, `PurchaseSummarySection`, `ReconciliationComparisonTable`, `ApprovalSearchField`), table toolbars specify `hideLabel`, allowing the input to sit flush and compact on a single horizontal axis with its search icon and placeholder.
- **Fix**: Apply `hideLabel` on table toolbar search fields while preserving full accessibility via `sr-only` and `aria-label`.

### Root Cause E: Manual `div + label` Implementations Bypassing Shared Primitives
- **Symptom**: Multiple dialogs (`WarehouseExceptionsWorkbench.tsx`, `WarehouseBatchPurchaseReceiptDialog.tsx`, `WarehouseReceiptLifecycleDialogs.tsx`) manually wrapped inputs in `<label className="grid gap-1">` or `<div className="grid gap-2">` without consistent classes or token references.
- **Fix**: Standardize on `FieldRow` or standard semantic field classes with locked token gaps (`gap-1` label-to-control, `text-xs font-bold text-slate-700`).

---

## 4. Field Anatomy & Semantic Order

Every field in the application follows the strict unidirectional semantic hierarchy:

$$\text{FieldLabel} \xrightarrow{\text{4px}} \text{Required/Optional Indicator} \xrightarrow{} \text{Control} \xrightarrow{\text{4px}} \text{Helper / Description} \xrightarrow{\text{4px}} \text{Validation Error} \xrightarrow{\text{16px}} \text{Contextual Action}$$

1. **FieldLabel**: Concise, descriptive, `text-xs font-bold leading-4 text-slate-700` (`0.75rem` or `0.8125rem`).
2. **Indicator**: Red asterisk (`text-red-600 font-semibold`, `aria-hidden="true"`) for required; `text-caption text-slate-400` for optional.
3. **Control**: Interactive element (`Input`, `Select`, `Textarea`, `SearchField`) with standard height (`h-8` 32px compact, `h-9` 36px standard), `border-input`, `rounded-sm`.
4. **Helper / Description**: Subordinate hint (`text-caption text-slate-500` or `text-xs text-slate-600`), 4px below control.
5. **Validation Error**: Accessible message (`FieldError`, `role="alert"`, `text-xs font-medium text-red-700`).
6. **Field Actions**: If present (e.g. submit, add step), separated by `16px` (`pt-2` or `mt-4`).

---

## 5. Form Section Anatomy & Container Padding

Every form container follows a clear structural hierarchy:

```
SectionPanel (p-4 sm:p-5)
  ├── SectionHeader (mb-4)
  │     ├── Title + Icon + InfoNote
  │     └── Actions / Badge (ml-auto)
  ├── InlineDescription (mb-4 text-sm text-slate-500)
  └── SectionBody (Children - zero redundant inner horizontal padding)
        ├── FieldGroup 1 (space-y-4)
        ├── FieldGroup 2 (space-y-4)
        └── FormActions (mt-5 pt-4 border-t border-slate-200)
```

- **Rule 1**: Never add `px-4 sm:px-5` to an immediate child of a padded `SectionPanel` or `DrawerBody`.
- **Rule 2**: Table toolbars placed immediately above a table have `border-b border-slate-200 bg-slate-50 px-3 py-2 sm:px-4` and sit OUTSIDE the `TableViewport` scroll container.
- **Rule 3**: Dialog bodies in `DialogContent` have default padding `p-4 sm:p-6` with `gap-4`. Form rows inside dialogs use `space-y-3` (compact) or `space-y-4` (standard).

---

## 6. Sizing, Density & Visual Rhythm Matrix

| Context | Container Padding | Field-to-Field Gap | Label-to-Control Gap | Control Height | Action Separation |
|---|---|---|---|---|---|
| **Data-Dense Operational** (Warehouse, Weekly Menu, Chef) | `p-3 sm:p-4` | `10px–12px` (`space-y-2.5` to `3`) | `4px` (`gap-1`) | `32px` (`h-8`) | `12px` (`mt-3`) |
| **Standard Workflow** (Purchasing, Approvals, Coordination) | `p-4 sm:p-5` | `16px` (`space-y-4`) | `4px` (`gap-1` or `gap-1.5`) | `36px` (`h-9`) | `16px` (`mt-4` / `pt-2`) |
| **Modal / Dialog Forms** | `p-4 sm:p-6` | `12px–16px` (`space-y-3.5`) | `4px` (`gap-1`) | `36px` (`h-9`) or `32px` | `DialogFooter` (`mt-4 pt-3 border-t`) |
| **Table Toolbar Search** | `px-3 py-2` | N/A (Inline flex) | N/A (`hideLabel`) | `36px` (`h-9`) | Flush in toolbar |

---

## 7. Migration Ledger & Resolved Inconsistencies

| Component / File | Root Cause | Remediation Applied |
|---|---|---|
| `frontend/src/styles/components/tables.css` | Label gap & color mismatch | Standardized `.ipc-search-field` gap to `var(--ipc-space-1, 4px)` and label color to `var(--ipc-slate-700)`. |
| `frontend/src/features/purchasing/PurchaseDecisionPanel.tsx` | Flat `space-y-3` destroying vertical rhythm | Replaced flat `space-y-3` with canonical anatomy: label $\rightarrow$ select (`gap-1`), select $\rightarrow$ helper (`mt-1`), helper $\rightarrow$ action (`pt-2 mt-4`). |
| `frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx` | Nested `TableViewport` trapping search toolbar | Extracted `PurchaseLineGroups` out of the outer `TableViewport`, preventing toolbar scroll-trapping and border clipping. |
| `frontend/src/features/purchasing/PurchaseLineGroups.tsx` | Visible stacked label in table toolbar | Added `hideLabel` and contextual placeholder, enabling clean single-line toolbar layout. |
| `frontend/src/features/warehouse/pages/WarehousePurchaseOrdersPanel.tsx` | Nested `TableViewport` trapping detail search | Removed redundant outer `TableViewport` around `PurchaseOrderLineGroups`. |
| `frontend/src/features/warehouse/PurchaseOrderLineGroups.tsx` | Visible stacked label in table toolbar | Added `hideLabel` and contextual placeholder. |
| `frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx` | Double nested padding & control height mismatch | Removed redundant inner `px-4 pb-4`, aligned `SelectTrigger` to 36px via `size="lg"`, and refined precondition notice. |

---

## 8. Verification & Quality Gates

1. **8 Core UI Contracts**: All 8 suites passed (56/56 tests).
2. **Feature Regression Suites**: All purchasing, warehouse, and chef feature tests passed (31/31 tests).
3. **Linter**: 0 errors on `npm run lint`.
4. **Production Build**: Clean Vite build in 1.70s with 0 errors.
