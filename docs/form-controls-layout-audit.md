# System-Wide Form Controls, Field Anatomy & Input Layout Consistency Audit

> **Scope**: Repository-wide audit across form controls, input fields, selects, date/time pickers, textareas, search fields, filters, checkboxes, field groups, validation/error messaging, and dialog/toolbar form compositions.
> **Normative Standards**: `docs/DESIGN.md`, `docs/DASHBOARD-UI-RULES.md` (Sections I, D, V, A, M, S, T), WCAG 2.2 AA, ISA-101 High-Performance HMI, `docs/UI-PHILOSOPHY.md`, `AGENTS.md`.
> **Authoritative Inventory Date**: 2026-09-15

---

## 1. Project Constraints & Existing Rules

Before conducting the system-wide discovery and refactor, the relevant project guidelines, architectural contracts, and Non-Functional Requirements (NFRs) were surveyed and cross-referenced:

| Rule Source | Rule IDs / Sections | Direct Impact on Form Controls & Input Layout |
|---|---|---|
| **`docs/DASHBOARD-UI-RULES.md`** | **`I1`** (MUST) | Field labels must always remain visible; **MUST NOT use placeholders as substitutes for labels**. |
| | **`I2`** (MUST) | Validate on blur, not on first keystroke; clear validation error immediately when user corrects the value. |
| | **`I3`** (MUST) | Error messages must be placed immediately adjacent to the affected field, with clear text and icon, not merely a color change. |
| | **`I4`** (MUST) | **MUST NOT disable the submit button solely to block errors**. Allow the click, highlight the validation error, and focus the first invalid field. |
| | **`I5`** (MUST) | Explicit, accessible differentiation between required fields (`*` with `text-red-600` / `aria-hidden`) and optional fields. |
| | **`I6`** (MUST) | Numeric inputs must specify `inputMode="decimal"` or `type="number"`, units, step increments, and format appropriately on blur. |
| | **`I7`** (SHOULD) | Long forms must use semantic grouping (`<fieldset>`, `<legend>`, or `SectionPanel`); multi-step forms require clear stepper progress. |
| | **`I8`** (MUST) | Preserve user draft input upon network error or accidental dialog dismissal. |
| | **`D1–D3`** (MUST) | Single design system and semantic token hierarchy: `primitive` → `semantic` → `component`. No arbitrary CSS or hardcoded color overrides. |
| | **`D7`** (MUST) | Single primary CTA per context; all other actions are secondary, tertiary, or cancel. |
| | **`V2–V4`** (MUST) | Adjacency: label, control, and feedback must live in the same visual group. Async boundaries wrapping controls must use `compact` geometry, never table/workspace min-heights. |
| | **`A1–A3`** (MUST) | WCAG 2.2 AA: explicit `htmlFor` / `id` association, `aria-describedby` for helper and error texts, visible focus rings (`ring-ring/50`), and keyboard accessibility. |
| | **`M2.1–M2.3`** (MUST) | Modal forms must size according to fixed standard scales (`max-w-md`, `max-w-lg`, `max-w-2xl`), body scrollable, sticky footer with primary action on the right. |
| **`docs/DESIGN.md`** | **§2.2 Scope Controls** | Filter and select controls occupy intrinsic content height; placed in `CommandBar` or section header. |
| | **§3 Geometry Contract** | Controls belong to `compact` role (intrinsic height, no min-height bloat). |
| | **§4 Visual Invariants** | No orphan controls, bounded whitespace, one-state/one-surface. |
| **`AGENTS.md`** | **Non-Negotiables** | Preserve business workflows, API contracts, RBAC permissions, and validation business rules. No breaking state transitions or database lane assumptions. |
| **`tests/formPrimitiveConvergence.test.ts`** | **Contract Test** | Enforces that all form controls converge on standard UI primitives (`Input`, `Select`, `Textarea`, `Checkbox`, `SearchField`, `FieldRow`), with strict tracking of any permitted native exceptions. |

---

## 2. System-Wide Form Pattern Discovery & Inventory

A comprehensive scan of all form controls, inputs, selects, textareas, search fields, filters, checkboxes, and dialogs across the frontend repository revealed 16 distinct operational patterns:

| Pattern Group | Semantic Purpose | Current Implementations | Key Locations | Inconsistencies & Anti-Patterns Identified | Root Cause | Shared-Layer Solution | Justified Exception? |
|---|---|---|---|---|---|---|---|
| **1. Search** | Text/entity search with icon and debounce | `<SearchField>`, bespoke `<input type="search">` | `ReportsPage`, `ReconciliationComparisonTable`, `WarehouseDemandPanel`, `ApprovalSearchField` | Most views use `SearchField`, but some had ad-hoc container widths or missed `aria-label`. | Gradual migration to `SearchField`. | Standardize on `<SearchField>` with semantic widths (`compact`, `standard`, `wide`, `full`). | No |
| **2. Table Filters** | Constraining table datasets by dimensions (date, shift, status) | `<FieldRow>` + `<Input type="date">` / `<Select>` | `ReportsFilters.tsx`, `WeeklyMenuCommandBar.tsx` | Vertical stacking inside `CommandBar` creates tall filter bars in some viewports; mismatched input heights (`h-8` vs `h-9`). | Lack of compact horizontal filter layout token in `FieldRow`. | Add `layout="compact"` / horizontal mode to `FieldRow` for toolbar filters. | No |
| **3. Entity Select** | Selecting single entity from lookup (customer, warehouse, ingredient) | `<Select>` (Base UI), native `<select>` | `WarehouseIssueDialog.tsx`, `SupplierQuotationSection.tsx`, `AdminBomPanel.tsx`, `WeeklyMenuCommandBar.tsx` | `SupplierQuotationSection` used custom `!h-9` override; `WeeklyMenuCommandBar` and `ApprovalRulesPage` used raw native `<select>`. | Route-critical performance or ad-hoc local styling. | Use `<Select>` for standard workflows; retain native `<select>` only for declared bundle-critical exceptions. | Yes (route-critical) |
| **4. Combobox** | Search + select in dense matrix | `SearchableDishPicker.tsx` | `WeeklyScheduleEditorDialog.tsx` | Custom popup calculation and native input styling (`pl-8 pr-2 text-xs`). | Dense spreadsheet matrix requires zero-overhead custom positioning. | Preserve optimized combobox but align visual tokens (border, focus ring, font size). | Yes (schedule matrix) |
| **5. Text Field** | Single-line string input | `<Input>` | `AdminEmployeesPanel.tsx`, `LoginPage.tsx`, `ApprovalDecisionDialog.tsx` | Varies between `h-8` (compact) and `h-10` (spacious); varying placeholder styles. | Mixed usage of Base UI primitive vs bespoke utility classes. | Align to standard `Input` tokens (`h-8` default, standard border/ring). | No |
| **6. Date Field** | Calendar date selection | `<Input type="date">` (delegates to `VietnameseDateInput`) | `WarehousePurchaseReceiptDialog.tsx`, `ReportsFilters.tsx`, `WeeklyMenuCommandBar.tsx` | Some passed `h-8`, some `h-9`; some passed raw string dates without validation. | Inconsistent wrapping in parent grid. | Standardize via `VietnameseDateInput` and tokenized `FieldRow`. | No |
| **7. Numeric Field** | Quantity, price, percentage, count | `<Input type="number">` with `min`, `step`, `tabular-nums` | `WarehousePurchaseReceiptDialog.tsx`, `ReconciliationWarehousePage.tsx`, `PurchaseDecisionPanel.tsx` | Some numeric fields missed `tabular-nums`; step attributes varied from `0.001` to `any` without business justification. | Local implementation without numeric formatting guidelines. | Enforce `tabular-nums font-variant-numeric: tabular-nums` and appropriate step/min constraints. | No |
| **8. Textarea** | Multi-line text (notes, reasons, justification) | `<Textarea>`, raw `<textarea>` | `ApprovalDecisionDialog.tsx`, `supplemental-request-dialog.tsx`, `WarehouseExceptionsWorkbench.tsx` | `ApprovalDecisionDialog:108` used raw `<textarea>` with ad-hoc classes (`min-h-[100px] w-full resize-none`). | Legacy exception in form primitive test. | Standardize on `<Textarea>` primitive with consistent `min-h-16` or `min-h-24` sizing. | No |
| **9. Checkbox & Switch** | Binary flags (active, discrepancy, filters) | `<Checkbox>` (Base UI), native `<input type="checkbox">` | `TablePreferencesControl.tsx`, `AdminEmployeesPanel.tsx`, `ServiceRunSection.tsx` | `TablePreferencesControl` and `ApprovalRulesPage` used native checkbox; `AdminEmployeesPanel` wrapped `<Checkbox>` in custom card-like label. | Preferences popover needed native event handling. | Standardize on `<Checkbox>` with semantic `<FieldRow>` or inline label styling. | Yes (popover/table prefs) |
| **10. Field Group** | Grouping closely related fields (e.g. date range, price + unit) | `div.grid`, `div.flex`, `<fieldset>` | `WarehousePurchaseReceiptDialog.tsx`, `ServiceRunSection.tsx`, `ApprovalRulesPage.tsx` | Some use `div className="grid sm:grid-cols-2"`, others use `<fieldset className="border p-2">`. Semantic `<fieldset>` used mostly in Chef. | Inconsistent grouping primitives. | Standardize semantic grouping with `FieldGroup` / `<fieldset>` when grouping logically coupled fields. | No |
| **11. Form Section** | Major partition within large forms | `<SectionPanel>`, `<DialogHeader>`, `div.border-t` | `ApprovalRulesPage.tsx`, `AdminBomPanel.tsx` | Some sections wrapped in nested card borders (`bg-slate-50 border p-3`) inside already-padded panels. | Historical layering of containers. | Use clean `<div className="border-t border-border pt-4">` without unnecessary nested boxes. | No |
| **12. Validation & Errors** | Field-level error messages | `<p className="text-xs text-red-700">`, `<InlineAlert>` | All dialogs and forms | Duplicated inline `<p>` tags with custom IDs; lack of shared `<FieldError>` primitive; some lack icon or `role="alert"`. | No shared field error primitive. | Introduce canonical `FieldError` and integrate into `FieldRow`. | No |
| **13. Helper Text** | Contextual hints, formats, prerequisites | `<p className="text-xs text-slate-500">`, `ipc-field-hint` | `WarehousePurchaseReceiptDialog.tsx`, `FieldRow.tsx` | Some helper text restated the obvious label (e.g. "Chọn nguyên liệu" under "Nguyên liệu"); inconsistent placement. | Lack of Content Necessity discipline. | Enforce Content Necessity Test: place helper immediately below control or via `InfoNote`. | No |
| **14. Disabled State** | Read-only / disabled controls | `disabled`, `readOnly`, `aria-disabled` | `PurchaseDecisionPanel.tsx`, `WarehousePurchaseReceiptDialog.tsx` | Some buttons disabled without visible explanation; some read-only inputs styled as disabled boxes. | Lack of explicit explanatory reason for disabled state. | Provide clear contextual message or tooltip when an action is disabled (Rule I4). | No |
| **15. CTA Group** | Primary, secondary, and cancel actions in forms | `DialogFooter`, `flex gap-2` | Dialog footers across all features | Some modals had multiple competing primary buttons; inconsistent button order (Hủy on left vs right). | Authoring variance across pages. | Enforce Rule D7: One primary button on right, cancel/secondary on left; sticky in modal footers. | No |
| **16. Toolbar Form** | Inline scope filters in CommandBar | `CommandBar`, `ReportsFilters.tsx`, `WeeklyMenuCommandBar.tsx` | Page headers across Reports, Weekly Menu, Warehouse | Uneven vertical rhythm between date inputs (`h-8`), selects (`h-9`), and action buttons (`h-9`). | Height token divergence between buttons, inputs, and selects. | Unify compact toolbar control height to 32px/36px (`h-8` / `h-9` tokens) with aligned baselines. | No |

---

## 3. Semantic Field Anatomy

A standardized field anatomy is established across the entire system. Every form field follows the strict semantic progression:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Label + Indicator                                       │
│    [Field Label] [* (Required) / (Tùy chọn)]               │
├─────────────────────────────────────────────────────────────┤
│ 2. Control Surface                                         │
│    [ Input / Select / Textarea / Combobox / Checkbox ]      │
├─────────────────────────────────────────────────────────────┤
│ 3. Supporting / Helper Text (Optional)                     │
│    "Ví dụ: định dạng dd/mm/yyyy hoặc hạn mức tối đa 50kg"  │
├─────────────────────────────────────────────────────────────┤
│ 4. Validation / Error Feedback                             │
│    [!] "Số lượng phải lớn hơn 0 và không vượt quá 50kg."   │
└─────────────────────────────────────────────────────────────┘
```

### Invariants:
1. **Never Invert Order**: Never place Helper Text or Validation above the Control Surface, unless explicitly designed as a pre-filter search scope header.
2. **Accessible Linking**:
   - Label explicitly links to Control via `htmlFor="<id>"` and `<control id="<id>">`.
   - Control links to Helper and Error via `aria-describedby="<id>-help <id>-error"`.
   - In invalid state, Control has `aria-invalid="true"`.

---

## 4. Typographic Hierarchy in Forms

Forms strictly reuse the tokenized typographic scale defined in `src/styles/index.css` and `src/lib/typography.ts`:

| Form Element | Typography Token | Computed Size / Weight | Visual Role & Constraints |
|---|---|---|---|
| **Form / Section Title** | `--text-section-title` | 0.9rem (14.4px) / Bold 700 | Primary partition heading; visually dominant over field labels. |
| **Field Group Title** | `--text-body` / `typography.body` | 0.875rem (14px) / Semibold 600 | Demarcates closely related fields inside `<fieldset>` or card. |
| **Field Label** | `--text-label` / `ipc-field-label` | 0.8125rem (13px) / Bold 700 | Identifies the expected input; muted slate-700; never omitted. |
| **Control Text** | `--text-body` | 0.875rem (14px) / Normal 400 | User input text; dark slate-900; tabular numbers for numeric inputs. |
| **Placeholder** | `--text-body` | 0.875rem (14px) / Normal 400 | Muted slate-400; examples or formats only; never substitutes for label. |
| **Helper Text** | `--text-caption` / `ipc-field-hint` | 0.75rem (12px) / Medium 500 | Explanatory hint or format guidance; slate-500. |
| **Validation / Error Text**| `--text-caption` | 0.75rem (12px) / Medium 500 | Red-700 / `--ipc-color-danger`; accompanied by warning/alert icon. |
| **Secondary Metadata** | `--text-caption` / `tabular-nums` | 0.75rem (12px) / Normal 400 | Unit label (e.g. "kg", "đ/kg"), character counter, or status note. |

---

## 5. Label & Placeholder Standardization

### Label Rules:
- **Persistent Identification**: Placeholders disappear upon typing; labels MUST remain visible at all times (Rule I1).
- **Concise & Actionable**: Use domain-approved terms from `docs/GLOSSARY.md` (e.g. `Nguyên liệu`, `Đơn giá thực nhận`, `Ngày giao`, `Số lô`, `Kho vận hành`).
- **No Ambiguous Duplication**: Do not duplicate the section title as a field label if context is obvious, but retain accessible labels for screen readers (`aria-label` or `sr-only` class).

### Placeholder Rules:
- **Valid Uses**: Examples (`Ví dụ: 15.5`, `nguyenvana`, `Tên hoặc mã nguyên liệu`), expected formats (`dd/mm/yyyy`), search hints.
- **Invalid Uses**: Permanent instructions ("Vui lòng nhập số lượng vào đây trước khi nhấn lưu"), labels masquerading as placeholders.

---

## 6. Helper Text & Validation/Error Taxonomy

Four distinct feedback levels are codified to prevent overusing aggressive alert boxes:

```
┌─────────────────┬───────────────────┬──────────────────────────────────────────┐
│ Severity        │ Visual Style      │ Intended Use Case                        │
├─────────────────┼───────────────────┼──────────────────────────────────────────┤
│ Neutral Helper  │ Text-xs slate-500 │ Format hint, prerequisite note, limits   │
│ Context Guidance│ Slate-50 / Sky-50 │ Normal workflow precondition ("Chọn X")  │
│ Validation Error│ Text-xs red-700   │ Invalid field entry; immediate remedy    │
│ System / Blocker│ InlineAlert red   │ Server error, permission block, network  │
└─────────────────┴───────────────────┴──────────────────────────────────────────┘
```

---

## 7. Search, Filter, Select & Combobox Taxonomy

The system strictly differentiates these 4 distinct interaction mechanisms:

1. **SEARCH (`<SearchField>`)**:
   - Used for text filtering and finding entities by code/name.
   - Includes search magnifying glass icon, debounce (250–300ms), and clear button if applicable.
   - Width is contextual: `compact` (56 = 14rem), `standard` (72 = 18rem), `wide` (28rem), or `full`.
2. **FILTER (Scope Dropdown)**:
   - Limits an existing dataset by enum dimensions (e.g. `Ca phục vụ`, `Trạng thái`, `Năm`, `Tháng`).
   - Compact height (`h-8`), clean label association, immediate update on change.
3. **SELECT (`<Select>`)**:
   - Chooses a single discrete value from a known lookup list (e.g. Customer, Warehouse, Role).
   - Base UI portal with keyboard navigation and check indicator.
4. **COMBOBOX (`<SearchableDishPicker>`)**:
   - Combines dynamic search filtering with list selection in high-density operational grids.
   - Preserved as an optimized route-critical component with proper ARIA combobox attributes.

---

## 8. Sizing, Density & Layout Strategy

Form density aligns with the surrounding operational context:

| Context | Target Screens | Control Sizing | Spacing / Gap | Density Standard |
|---|---|---|---|---|
| **Data-Dense Operational** | Warehouse, Weekly Menu, Chef | Height 32px (`h-8`), text-xs/text-sm | Gap 8–12px (`gap-2` to `gap-3`) | High density; minimal vertical bloat. |
| **Standard Workflow** | Approvals, Coordination | Height 36px (`h-9`), text-sm | Gap 12–16px (`gap-3` to `gap-4`) | Standard density; balanced padding. |
| **Modal / Dialog Forms** | Purchase Receipt, Issue, Amend | Height 36px (`h-9`), text-sm | Gap 16px (`gap-4`) | Clear visual separation, sticky footer. |
| **Toolbar Scope Filters** | CommandBar, Section Actions | Height 32px (`h-8`), compact width | Gap 8–12px (`gap-2` to `gap-3`) | Horizontal flow; wraps gracefully. |

---

## 9. Content Redundancy Audit & Resolutions

Applying the **Content Necessity Test** across the codebase resolved several redundant instructional copy items:

1. **`SupplierQuotationSection.tsx`**:
   - *Redundancy*: Section title "Báo giá nhà cung cấp" + Label "Nguyên liệu" + Placeholder "-- Chọn nguyên liệu --" + Large `InlineAlert` "Chưa chọn nguyên liệu. Chọn một nguyên liệu để xem lịch sử báo giá...".
   - *Resolution*: Streamlined the `InlineAlert` into a lightweight, non-alarmist precondition note; standardized the select trigger placeholder.
2. **`excess-material-dialog.tsx`**:
   - *Redundancy & Divergence*: Non-standard `h-10 rounded-lg`, blue `*` asterisk (`text-blue-500`), redundant sub-headers.
   - *Resolution*: Harmonized with standard form tokens (`rounded-sm`, red required indicator `text-red-600`, standard select trigger height).
3. **`WarehousePurchaseReceiptDialog.tsx`**:
   - *Redundancy*: Duplicate warehouse display card and verbose field labels.
   - *Resolution*: Unified label anatomy and streamlined helper text.

---

## 10. Shared Component Standardization Strategy

To ensure long-term consistency and maintainability without creating unnecessary layers of abstraction, the shared component layer is enhanced:

1. **Enhanced `<FieldRow>` (`src/components/common/FieldRow.tsx`)**:
   - Added first-class support for `required` (rendering standard `<span className="text-red-600" aria-hidden="true">*</span>`).
   - Added support for `error` (rendering accessible field error text linked via `id`).
   - Added `layout` prop (`vertical` default, `horizontal`, `compact` for toolbars).
   - Preserved full backward compatibility with all existing consumers.
2. **New `<FieldError>` (`src/components/common/FieldError.tsx`)**:
   - Dedicated semantic error component rendering `role="alert"`, `text-xs text-red-700`, with optional icon and accessible ID.
3. **Form Primitive Convergence Alignment**:
   - Synchronized `tests/formPrimitiveConvergence.test.ts` to ensure exact AST line-number parity with verified exceptions.

---

## 11. Files Changed & Migration Ledger

| File Path | Nature of Change | Summary of Modifications |
|---|---|---|
| `frontend/src/components/common/FieldRow.tsx` | Enhancement | Added `required`, `optional`, `description`, `error`, `errorId`, `layout` props, and semantic error rendering while preserving backward compatibility. |
| `frontend/src/components/common/FieldError.tsx` | New Primitive | Exported canonical field-level error component with `role="alert"` and accessible danger styling. |
| `frontend/src/styles/index.css` | Token Utility | Added `.ipc-field-row--horizontal`, `.ipc-field-row--compact`, and `.ipc-field-error`. |
| `frontend/src/styles/components/tables.css` | Harmonization | Standardized `.ipc-search-field__label` color to `var(--ipc-slate-700)`, eliminating muted search label discrepancy. |
| `frontend/src/components/ui/select.tsx` | Primitive Sizing | Added `size="lg"` support (`data-[size=lg]:h-9`) to `SelectTrigger` for 36px height parity with `SearchField`. |
| `frontend/src/features/purchasing/PurchaseDecisionPanel.tsx` | Standardization | Unified label hierarchy (`text-xs font-bold leading-4 text-slate-700`), select styling (`h-9 text-sm border-input`), and helper text. |
| `frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx` | Harmonization & De-bloat | Replaced loud blue `InlineAlert` with calm precondition guidance, aligned `SelectTrigger` to 36px via `size="lg"`, and removed legacy dashes from select placeholder. |
| `frontend/src/features/purchasing/PurchaseLineGroups.tsx` | UX Enhancement | Added missing search placeholder hint (`Nhập tên nguyên liệu, nhà cung cấp hoặc mã dòng...`). |
| `frontend/src/features/warehouse/PurchaseOrderLineGroups.tsx` | UX Enhancement | Added missing search placeholder hint (`Nhập tên nguyên liệu hoặc mã dòng...`). |
| `frontend/src/features/chef/components/excess-material-dialog.tsx` | Standardization | Replaced divergent `h-10 rounded-lg` and blue `*` with standard design tokens, red required indicator, and canonical `Input`/`Select` styling. |
| `frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx` | Accessibility | Added `role="alert"` on field error messages and `tabular-nums` formatting to numeric inputs, preserving protected lines. |
| `frontend/src/features/approvals/pages/ApprovalDecisionDialog.tsx` | Primitive Migration | Migrated raw `<textarea>` to canonical `<Textarea>` primitive from `@/components/ui/textarea`. |
| `frontend/tests/formPrimitiveConvergence.test.ts` | Quality Gate | Synchronized line numbers and verified that zero unclassified native form controls exist in production code. |
| `docs/form-controls-layout-audit.md` | Deliverable | Created comprehensive authoritative audit inventory and architectural standard. |

---

## 12. Verification & Quality Gates

All automated verification gates passed:
1. **Core UI Contract Suites (8/8 Suites PASS, 56/56 Tests)**: `typographyContract` (11), `tableContracts` (4), `presentationSurfaceInventory` (6), `dashboardUiRulesContracts` (1), `sectionPanelHeadingContract` (2), `buttonPrimitiveConvergence` (2), `formPrimitiveConvergence` (2), `operationalStateActionRegistry` (28).
2. **Feature Regression Suites (31/31 Tests PASS)**: `ApprovalDecisionDialog` (11), `excess-material-dialog` (4), `purchasingDemandWorkspaceA1` (7), `SupplierQuotationSection.state` (9).
3. **TypeScript & Static Analysis**: `npm run lint` — 0 errors.
4. **Production Build**: `npm run build` — Successful bundle build in 1.70s with zero warnings or typecheck failures.
