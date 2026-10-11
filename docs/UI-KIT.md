# UI KIT — IPC Management

> Tổng hợp design system hiện tại của dự án. Tài liệu này **đọc từ source** (`frontend/src/components/`, `frontend/src/styles/`) — KHÔNG phải spec riêng. Nếu source đổi, cần update doc.
>
> Authority chain: `docs/DESIGN.md` (presentation contract) → file này (current implementation) → source/tests.

## Tổng quan

| Layer | Path | Số file | Mục đích |
|---|---|---|---|
| Design tokens | `frontend/src/styles/index.css` | 1 (1030+ dòng) | CSS variables: color, spacing, typography, radius, shadow |
| Component CSS | `frontend/src/styles/components/` | 7 files | Layout/visual rules per component family (dashboard, tables, operations, ...) |
| Redesign CSS | `frontend/src/styles/redesign/` | 4 files | Opt-in redesign tokens (fiori, demand, dashboard) — feature flag |
| UI primitives | `frontend/src/components/ui/` | 13 components | shadcn-style base (button, dialog, select, ...) |
| Shared composites | `frontend/src/components/common/` | 45 components | Canonical pattern: CommandBar, TableViewport, EmptyState, ... |
| Preview tokens | `frontend/src/styles/planning-demand-preview-tokens.css` | 1 | Sandbox-only preview tokens (SANDBOX_ONLY theo AGENTS.md) |

## 1. Design tokens (từ `index.css`)

### Color — Slate ramp (neutrals)

| Token | Value | Use |
|---|---|---|
| `--ipc-slate-50` | `#f8fafc` | Subtle background |
| `--ipc-slate-100` | `#f1f5f9` | Muted surface |
| `--ipc-slate-200` | `#e2e8f0` | Hairline border |
| `--ipc-slate-300` | `#cbd5e1` | Border |
| `--ipc-slate-400` | `#94a3b8` | Muted icon |
| `--ipc-slate-500` | `#64748b` | Secondary text |
| `--ipc-slate-600` | `#475569` | Tertiary text |
| `--ipc-slate-700` | `#334155` | Body text |
| `--ipc-slate-800` | `#1e293b` | Primary text |
| `--ipc-slate-900` | `#0f172a` | Heading |

### Color — Brand (primary navy)

| Token | Value | Use |
|---|---|---|
| `--ipc-primary` | `#1a56a8` | Primary action, link, focus |
| `--ipc-primary-hover` | `#134080` | Primary hover |
| `--ipc-primary-soft` | `#e8f1ff` | Primary tint background (info alert, accent) |
| `--ipc-primary-600` | `#0e3a6e` | Strong primary |

### Color — Semantic (status)

| Token | Value | Use |
|---|---|---|
| `--ipc-success` | `#0f766e` | Success action, status |
| `--ipc-success-soft` | `#e6f7f3` | Success tint |
| `--ipc-warning` | `#c05621` | Warning action, status |
| `--ipc-warning-soft` | `#fff7e6` | Warning tint |
| `--ipc-danger` | `#c53030` | Destructive action, error |
| `--ipc-danger-soft` | `#fff1f1` | Error tint |

### Color — Surface

| Token | Value | Use |
|---|---|---|
| `--ipc-color-surface` | `#ffffff` | Card, panel background |
| `--ipc-color-surface-subtle` | `#eef3f8` | Wash, page background |
| `--ipc-color-surface-accent` | `#f7fbff` | Soft accent surface |
| `--ipc-color-surface-selected` | `#f0f6ff` | Selected row/cell |

### Color — Border

| Token | Value | Use |
|---|---|---|
| `--ipc-color-border-subtle` | `#e2eaf4` | Section border |
| `--ipc-color-border-muted` | `#d8e2ef` | Table border |
| `--ipc-color-border-strong` | `#c9d6e6` | Strong border |
| `--ipc-color-border-table-header` | `#cbd8e8` | Table header |
| `--ipc-color-border-focus` | `#b8c8e8` | Focus border (legacy) |

### Color — Status semantic (per StatusBadge)

| Tone | Foreground | Background | Border |
|---|---|---|---|
| `success` | `#047857` | `#e6f7f3` | `#99ddd2` |
| `warning` | `#b45309` | `#fff7e6` | `#c05621` |
| `danger` | `#b91c1c` | `#fff1f1` | `#fecaca` |
| `info` | `#1d4ed8` | `#e8f1ff` | `#bfdbfe` |
| `neutral` | `#475569` | `#f1f5f9` | `#cbd5e1` |

### Color — Status badge (legacy, used in `is-*` class)

`StatusBadge` CSS class `.ipc-status-badge.is-{success|warning|danger|info|neutral}` — semantic mapping theo tone ở trên. `data-default="command"` selectors dùng cho visual regression.

### Spacing (4px base)

| Token | Value | Use |
|---|---|---|
| `--ipc-space-1` | `4px` | Tight gap |
| `--ipc-space-2` | `8px` | Inline gap |
| `--ipc-space-3` | `12px` | Component gap |
| `--ipc-space-4` | `16px` | Section gap (default) |
| `--ipc-space-5` | `20px` | Larger gap |
| `--ipc-space-6` | `24px` | Page gap |
| `--ipc-space-7` | `28px` | Page padding |
| `--ipc-space-8` | `32px` | Major gap |

### Typography — Inter Variable

| Role | Token | Size / Weight / Line-height |
|---|---|---|
| Page title | `--text-page-title` | `1rem / 700 / 1.25` |
| Section title | `--text-section-title` | `0.9rem / 700 / 1.25` |
| Body | `--text-body` | `0.875rem / 400 / 1.5` |
| Label | `--text-label` | `0.75rem / 600 / 1.333` |
| Caption | `--text-caption` | `0.75rem / 400 / 1.333` |
| Code | `--text-code` | `0.8125rem / 500 / 1.35` |
| Button | `--text-button` | `0.875rem / 600 / 1` |
| Button compact | `--text-button-compact` | `0.75rem / 600 / 1` |
| Input | `--text-input` | `1rem / 400 / 1.5` |
| Input compact | `--text-input-compact` | `0.875rem / 400 / 1.428571` |
| Badge | `--text-badge` | `0.75rem / 500 / 1.333` |
| Card | `--text-card` | `0.875rem / 400 / 1.428571` |
| Card title | `--text-card-title` | `1rem / 500 / 1.375` |
| Card title compact | `--text-card-title-compact` | `0.875rem / 500 / 1.375` |
| Table | `--text-table` | `0.8125rem / 400 / 1.35` |
| Table header | `--text-table-header` | `0.75rem / 700 / 1.25` |

**Font**: `Inter Variable` (SIL OFL 1.1 via `@fontsource-variable/inter`, woff2-variations, weight 100-900). Loaded qua `@font-face` với `font-display: swap`. Hỗ trợ 3 unicode-range subsets: Vietnamese, Latin Ext, Latin. Tabular numerals: `font-variant-numeric: tabular-nums` + `font-feature-settings: "tnum"` qua `.num` / `.tabular-nums` utility.

### Radius (small, hairline-friendly)

| Token | Value | Use |
|---|---|---|
| `--ipc-radius-sm` | `2px` | Hairline rounding |
| `--ipc-radius-md` | `3px` | Default (button, input) |
| `--ipc-radius-lg` | `4px` | Card, panel |
| `--ipc-radius` (root) | `0.1875rem` (= 3px) | Base radius |
| `--radius-sm` (theme) | `0.75 * radius` | Theme small |
| `--radius-md` (theme) | `radius` | Theme medium |
| `--radius-lg` (theme) | `1.25 * radius` | Theme large |
| `--radius-xl` (theme) | `1.5 * radius` | Theme extra-large |

### Shadow (restrained, low-elevation)

| Token | Value | Use |
|---|---|---|
| `--ipc-shadow-xs` | `0 1px 2px rgb(15 23 42 / 0.04)` | Subtle elevation |
| `--ipc-shadow-sm` | `0 1px 3px rgb(15 23 42 / 0.06), 0 1px 2px rgb(15 23 42 / 0.04)` | Card default |
| `--ipc-shadow-md` | `0 4px 12px rgb(15 23 42 / 0.07), 0 1px 3px rgb(15 23 42 / 0.04)` | Popover, dropdown |
| `--ipc-shadow-lg` | `0 10px 32px rgb(15 23 42 / 0.10), 0 2px 6px rgb(15 23 42 / 0.04)` | Modal, dialog |

### Motion

| Token | Value | Use |
|---|---|---|
| `--ipc-transition-fast` | `120ms ease` | Color, border hover |
| `--ipc-transition-normal` | `200ms ease` | Background, opacity |
| `--ipc-transition-smooth` | `300ms cubic-bezier(0.4, 0, 0.2, 1)` | Dialog open/close |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` | Override all animations to 0.01ms |

### Motion grammar (signature pattern)

**Triết lý** (theo `docs/DESIGN.md` C7, F23): "Motion must not encode required information alone, must respect prefers-reduced-motion, and leave state/focus understandable without animation. Transform/opacity are safest defaults."

**Tokens** (đã liệt kê ở trên): 3 durations (120/200/300ms) + 2 easings (`ease`, `cubic-bezier(0.4, 0, 0.2, 1)`).

**Application rules** (tổng hợp từ `index.css` + `components/*.css`):

| Pattern | Duration | Easing | Properties | Used by |
|---|---|---|---|---|
| Hover color/border | 120ms | `ease` | `background-color`, `border-color`, `color` | buttons, links, nav items, table rows, sidebar (dùng `--ipc-transition-fast`) |
| Focus/active feedback | 120ms | `ease` | `box-shadow`, `border-color` (focus ring) | inputs, table cells (operations.css) |
| Modal/dialog open | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | `transform`, `opacity` (via `@keyframes ipc-fade-in`) | M3.7 modal opening, dialog.tsx wrapper |
| Pulse/loading | custom | `ease-in-out` | `opacity` (via `@keyframes ipc-pulse-dot`) | loading indicator dots, skeleton |
| Slide entrance | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | `transform: translateX` (via `@keyframes ipc-slide-in-left`) | responsive layout entrance |
| Status badge loading | 120ms | `ease` | `opacity` pulse + bg fade | `StatusBadge loading` state |

**Reduced-motion override** (tự động apply khi user có `prefers-reduced-motion: reduce`):
- Tất cả animations → `0.01ms`
- Tất cả transitions → `0.01ms`
- `scroll-behavior: auto`
- `.ipc-main`, `.ipc-empty-state`, `.ipc-inline-alert-enter` → `animation: none !important`
- Override location: `index.css` lines 372-390 (root override) + `responsive.css` line 137-147 (responsive override)

**Bans** (per `docs/DESIGN.md` C7 + craft-floor.md):
- Layout-affecting animation không có justification
- Positional movement/skeleton pulsing quá nhiều (giảm)
- Animated scrolling (giảm)
- Nonessential accessible focus/color/shadow transitions: chỉ allow khi small + reduced-motion respect

**Example — focus ring** (`inputs.css` derived):
```css
.ipc-input:focus {
  border-color: var(--ipc-focus-ring);
  box-shadow: 0 0 0 3px rgb(47 111 237 / 0.18);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
}
```

**Example — modal entrance** (`@keyframes ipc-fade-in`):
```css
@keyframes ipc-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```
Duration: 300ms (smooth). Property: transform + opacity (safe defaults per C7).

### Control height (4 tiers)

| Token | Value | Use |
|---|---|---|
| `--ipc-control-height-xs` | `32px` | Compact |
| `--ipc-control-height-sm` | `36px` | Button default |
| `--ipc-control-height-default` | `40px` | Input default |
| `--ipc-control-height-lg` | `44px` | Large control |

### Table row height (3 density tiers, Rule T8 OWNER_DECISION_REQUIRED)

| Token | Value | Use |
|---|---|---|
| `--table-row-height-compact` | `40px` | Compact |
| `--table-row-height-standard` | `48px` | **Default** (`--table-row-h`) |
| `--table-row-height-relaxed` | `56px` | Relaxed |
| `--rows-hint` | `6` | Default 6 rows = 288px ≤ 324px (45% of 720p) |

### Button min-width

| Token | Value | Use |
|---|---|---|
| `--button-min-w-sm` | `4rem` | Small button |
| `--button-min-w-default` | `5rem` | Default |
| `--button-min-w-lg` | `6rem` | Large |

## 2. UI Primitives (`components/ui/`)

shadcn-style base. **KHÔNG có barrel `index.ts`** — import trực tiếp từ path.

| Component | File | Purpose |
|---|---|---|
| `Button` | `button.tsx` (4934 B) | Action button. Variants: `default`, `outline`, `secondary`, `success`, `warning`, `warningSoft`, `info`, `ghost`, `destructive`, `link`. Sizes: `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`. `textWrap`: `nowrap`, `wrap`. Props: `loading?`, `disabled?`. Base = Base UI Button. |
| `Badge` | `badge.tsx` (1223 B) | Inline tag. Use cho numeric badge / lifecycle lozenge. |
| `Card` | `card.tsx` (2742 B) | Container với header/body/footer slot. |
| `Checkbox` | `checkbox.tsx` (1386 B) | Boolean input. |
| `Dialog` | `dialog.tsx` (17.6 KB) | Blocking modal. ARIA: focus trap, inert, role/aria-modal, labelled title. M-series rules. |
| `Drawer` | `drawer.tsx` (5119 B) | Non-blocking side panel. |
| `Input` | `input.tsx` (1270 B) | Text input. |
| `Select` | `select.tsx` (7721 B) | Dropdown. |
| `Separator` | `separator.tsx` (570 B) | Hairline divider. |
| `Table` | `table.tsx` (2935 B) | Semantic table primitives. |
| `Textarea` | `textarea.tsx` (860 B) | Multiline text. |
| `Toggle` | `toggle.tsx` (1850 B) | Boolean toggle. |
| `ToggleGroup` | `toggle-group.tsx` (3246 B) | Group of toggles. |
| `VietnameseDateInput` | `VietnameseDateInput.tsx` (7754 B) | Date input với Vietnamese locale. |

## 3. Shared Composites (`components/common/`)

50+ canonical patterns. **Có barrel `index.ts`** — import qua `@/components/common`.

### Action & status (canonical patterns)

| Component | Purpose | Notable props |
|---|---|---|
| `CommandBar` | Action + status bar (Rule C1, C7, X1) | `children`, `actions?`, `className?`, `leadingClassName?`, `actionsClassName?`, `variant?: 'default' \| 'scope'`. Auto-classify primary/secondary từ `className` của action children (`ipc-button-primary/success/warning`). Nếu `actions.length > 3` thì split primary/secondary. |
| `ContextStrip` | Inline metadata strip (label/value/optional tone/emphasis) | `items: ContextStripItem[]`, `className?`, `variant?: 'badge' \| 'inline'`. Mỗi item: `label`, `value`, `tone?: StatusTone`, `icon?`, `emphasis?: 'quiet' \| 'strong'`. Tone icons auto-resolve (CircleDashed neutral/info, CheckCircle2 success, AlertTriangle warning/danger). |
| `OperationalFrame` | Wraps route content với identity/scope/state | — |
| `PageBanner` | Page-level info/warning banner | `variant?` |
| `SectionPanel` | Card-like section container với header/footer slot | `title?`, `icon?`, `badge?`, `actions?`, `description?`, `descriptionPlacement?: 'popover' \| 'inline'`, `footer?`, `children`, `tone?: 'default' \| 'danger' \| 'dark'`, `padded?: boolean`, `headingLevel?: 2 \| 3 \| 4`, `className?`. Lazy-load `InfoNote` cho popover description. |
| `PageStepper` | Multi-step grouped page navigation (per day/week, not rows) | `page: number`, `totalPages: number`, `onPageChange: (page: number) => void`, `ariaLabel?`, `label?`, `className?`. Returns `null` nếu `totalPages <= 1`. Focus preservation khi navigate. |
| `ActionAvailability` | Per-action permission gate | — |
| `ActionGuard` | Disable action + explain reason | `reason` |
| `RoleInbox` | Role-specific task list | — |
| `ApprovalQueue` | Approval workflow list | — |

### Table & data (canonical patterns)

| Component | Purpose | Notable props |
|---|---|---|
| `TableViewport` | Canonical boundary for operational tables | `ariaLabel`, `caption?`, `className?`, `size?: 'default' \| 'weekly'`, `appearance?: 'default' \| 'quiet-operational'`, `density?: TableDensity`, `stickyHeader?: boolean` (default true), `frozenFirstIdentifier?: boolean` (default true), `loading?`, `skeleton?: ReactNode`, `preferences?: { accountId?, config: TablePreferenceConfig }`. Render-as-function: `children` có thể là `({ columns, density }) => ReactNode` cho preference-driven render. |
| `TablePreferencesControl` | Column/density picker | — |
| `TableSkeleton` | Loading skeleton for tables | — |
| `TableEmptyState` | Empty state for tables | — |
| `SkeletonTableRow` | Row skeleton | `columns: ColumnSkeletonDef[]` |
| `TabContentSkeleton` | Tab content skeleton | `geometry?: TabContentSkeletonGeometry` |
| `PaginationBar` | Page navigation | — |
| `CursorPaginationBar` | Cursor-based pagination | — |
| `PaginatedTableFrame` | Wrapper for paginated table | — |
| `StockMovementTable` | Specialized stock table | — |
| `operationalTables` (util) | Helpers for operational table patterns | — |
| `tablePreferences` (util) | Persist column/density preferences | `TablePreferenceConfig`, `TablePreferenceState` |

### Form & field (canonical patterns)

| Component | Purpose | Notable props |
|---|---|---|
| `FieldRow` | Vertical/horizontal form row | `label`, `hint?`, `description?`, `error?`, `errorId?`, `required?`, `optional?`, `layout?: 'vertical' \| 'horizontal' \| 'compact'`, `htmlFor?`, `children`, `className?`, `labelClassName?`. Auto-add `*` cho required, `(Tùy chọn)` cho optional. |
| `FieldError` | Inline field error message | — |
| `IdentifierText` | Human-readable ID/code với copy | — |
| `SearchField` | Search input với debounce + width control | `label`, `description?`, `width?: 'compact' \| 'standard' \| 'wide' \| 'full'`, `hideLabel?: boolean`, `inputClassName?`, plus Input props. Width classes: `w-56` / `w-72` / `w-[28rem]` / `w-full`. Icon Search tự động prepend. |
| `Num` | Numeric formatting (currency, quantity) | `value`, `format?` |

### Status & feedback (canonical patterns)

| Component | Purpose | Notable props |
|---|---|---|
| `StatusBadge` | Inline status pill (lifecycle, single source via Domain Status Registry) | `children?`, `status?: string \| null`, `domain?: StatusDomain`, `variant?: StatusTone`, `tone?: StatusTone`, `label?`, `size?: 'sm' \| 'default' \| 'lg'`, `fullLabel?`, `tooltip?`, `loading?`, `className?`. Tones: `neutral` / `info` / `success` / `warning` / `danger`. Auto-resolve từ `status` + `domain` registry. Có abbreviations glossary. |
| `StatusLozenge` | Alias của `StatusBadge` | (same as `StatusBadge`) |
| `NotificationBadge` | Numeric badge (count) | `count`, `tone?` |
| `EmptyState` | Empty state surface — 4 domain variants | `icon?`, `title`, `description?`, `action?`, `className?`, `variant?: 'empty' \| 'uncreated' \| 'filtered' \| 'error' \| 'forbidden'`. Variant `error` bắt buộc có `onRetry: () => unknown` + optional `isRetrying?`. Default icons: Inbox (empty/uncreated), SearchX (filtered), ShieldAlert (forbidden). |
| `InlineAlert` | Inline alert message | `variant?` |
| `PageBanner` | Page-level banner | `variant?` |
| `InfoNote` | Info note (with icon) | — |
| `ExceptionLane` | Exception/warning list | — |
| `ConfirmDialog` | Confirm action dialog (wraps `Dialog`) | `open`, `title`, `ariaLabel?`, `description`, `confirmLabel`, `variant?: 'destructive' \| 'default'`, `busy?`, `busyLabel?: string`, `children?`, `onConfirm: () => void`, `onOpenChange: (open: boolean) => void`. Có icon AlertCircle (destructive) / AlertTriangle (default). |
| `ToastProvider` | Toast container | — |
| `useToast` | Toast hook | — |
| `QueryViewBoundary` | Loading/error/empty/refresh for queries | `queries: QueryViewEntry[]`, `children`, `preserveFallback?`, `refreshLabel?`, `geometry?: 'compact' \| 'section' \| 'table' \| 'workspace'`, `minHeight?`, `noticePlacement?: 'inline' \| 'overlay'`. Handles 4 phases: `forbidden`, `error`, `uninitialized`, `loading`. Inline truncation warning. |
| `QueryErrorAlert` | Query error alert | — |
| `RefreshStatus` | Refresh/last-updated indicator | — |
| `MetricCard` | Numeric metric card | — |
| `DemandSummary` | Demand summary card | — |
| `DiagnosticPanel` | Diagnostic/dev panel | — |
| `DocumentRail` | Side rail for documents | — |
| `SideRail` | Generic side rail | — |
| `SplitWorkbench` | Master-detail split layout | — |
| `ViewSwitcher` | Tab-like view switcher (replaces 6+ copy-pasted `ipc-view-switcher`) | `tabs: ViewTab[]`, `activeTab`, `onTabChange`, `compact?`, `ariaLabel`, `isPending?`. Keyboard: ArrowLeft/Right + Home/End. Roving tabindex. Data-attributes: `data-ui-owner`, `data-ui-floorplan`, `data-ui-region` (UI ownership markers). |
| `KeepAliveTabPanel` | Tab panel với state retention | — |
| `ServiceRunBlockerPanel` | Block UI khi service run chưa hoàn tất | — |

## 4. Pattern guides (cách dùng components cho use case phổ biến)

### A. Page với scope/commands + work object + detail

```tsx
<main className="ipc-page-stack">
  <PageBanner variant="info">...</PageBanner>
  <SectionPanel title="Kế hoạch tuần" description="Toàn bộ thực đơn trong một mặt phẳng đọc.">
    <CommandBar variant="scope">
      <Controls />
      <label>Tuần bắt đầu<input type="date" /></label>
    </CommandBar>
    <ContextStrip items={[
      { label: 'Số lượng', value: '30,123456' },
      { label: 'Cảnh báo', value: 'Thiếu nguồn', tone: 'warning' },
    ]} />
    <TableViewport ariaLabel="Lịch tuần" density="compact">
      <table className="ipc-data-table">...</table>
    </TableViewport>
  </SectionPanel>
</main>
```

### B. Form với field row + error

```tsx
<FieldRow>
  <label className="ipc-field-label">Khách hàng
    <Select>...</Select>
  </label>
  <FieldError message="Vui lòng chọn khách hàng" />
</FieldRow>
```

### C. Confirmation dialog

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Xuất bản tuần?"
  description="Sau khi xuất bản, lịch tuần sẽ được gửi tới bếp."
  confirmLabel="Xuất bản"
  tone="primary"
  onConfirm={handlePublish}
/>
```

### D. Query-driven view với boundary

```tsx
<QueryViewBoundary query={{ data, isLoading, error, refetch }}>
  {(data) => <TableViewport ariaLabel="Lịch">...</TableViewport>}
</QueryViewBoundary>
```

### Pattern notes

- **Component CSS files (`components/*.css`)** chỉ consume IPC tokens từ `index.css`, không tạo custom property mới. Single source of truth = `index.css` (245 custom properties). Tổng references: dashboard.css (33), documents.css (97), domain-pages.css (44), operations.css (48), responsive.css (12), shell.css (115), tables.css (90).
- **Redesign CSS files (`redesign/*.css`)** là opt-in feature flag — chỉ apply khi ancestor có class `.ipc-redesign-shell` (xem `shared-owner-compatibility.tsx` fixture để verify). 4 files: fiori (4814 B), demand (11069 B), dashboard (8862 B), responsive (4172 B).

## 5. Stable rule IDs từ `docs/DESIGN.md`

Tổng cộng **70+ rule IDs** theo 12 families. File `docs/DESIGN.md` là canonical source. Tóm tắt nhanh:

| Family | Count | Domain |
|---|---|---|
| **P** (P1-P9) | 9 | Presentation/UX |
| **D** (D1-D9) | 9 | Design system (1 system, tokens, variants, icons) |
| **L** (L1-L12) | 12 | Labels, codes, lifecycle, abbreviations |
| **S** (S0-S2) | ~13 | States, badges, lozenges, tags |
| **T** (T1-T16) | 16 | Tables (alignment, sticky, sort, filters, pagination) |
| **M** (M1-M3, M2.1-M2.16) | ~30 | Modals, dialogs, drawers, focus trap, portals |
| **I** (I1-I10) | 10 | Inputs, validation, error, density |
| **C** (C1-C12) | 12 | Layout (initial placeholders, scrollbar, motion) |
| **F** (F1-F30) | 30 | Performance, caching, query, lifecycle |
| **E** (E1-E8) | 8 | Empty/error states, response thresholds |
| **A** (A1-A4) | 4 | Accessibility (WCAG 2.2 AA) |
| **N** (N1-N5) | 5 | Navigation (work-based, breadcrumb, URL) |
| **V** (V1-V10) | 10 | Visual (floorplan, hierarchy, headings) |
| **Q** (Q1-Q3) | 3 | Quality (rules, evidence, authorized findings) |

**Density T8** (3 row heights) là `OWNER_DECISION_REQUIRED` — chưa chọn policy. Default hiện tại = `standard` (48px).

## 6. Anti-patterns (bans từ `craft-floor.md`)

Đây là những pattern KHÔNG dùng. Một số đã có trong `ui-redesign.css` (opt-in feature flag):

| Ban | Source | Note |
|---|---|---|
| Kicker/eyebrow above heading | craft-floor | "The heading carries its own weight" |
| Border-left > 1px on cards/list | craft-floor | (3px transparent nav-border vi phạm — chỉ dùng 1px) |
| Glass/blur as decoration | craft-floor | (trừ khi pinned brief explicitly cho phép) |
| Hard offset shadow | craft-floor | (trừ neobrutalist world, không phải default) |
| Hero-metric template | craft-floor | ("big number, small label, supporting stats, accent") |
| Same-size icon+heading+text cards | craft-floor | ("cards are the lazy container") |
| Modal cho non-blocking task | M1.1 | ("modal only for real blocking work") |
| Pill-rounded status/button | DESIGN.md | ("square tables, small input corners") |

## 7. Testing & fixture conventions

| Convention | File | Purpose |
|---|---|---|
| UI primitive contract test | `*.contract.test.tsx` | Verify accessibility/state contract |
| Component integration test | `*.test.tsx` (sibling) | Verify render + behavior |
| Shared owner fixture | `frontend/tests/fixtures/shared-owner-compatibility.tsx` | Verify shared owners (CommandBar, ContextStrip, TableViewport) render đúng trong Plain + Redesign ancestor |
| Specimen | `frontend/tests/fixtures/specimens/*.tsx` | Visual specimens (10 files, 19-37KB mỗi cái) |

## 8. Open decisions (cần owner pick)

- **T8 Density**: 3 row heights (compact/standard/relaxed) đã có token nhưng chưa chọn policy default. Currently default = `standard` (48px).
- **D7 One-primary-per-context**: "do not authorize two same-primary actions" — bounded product/design decision per decision pair.
- **M1.2 Overlapping confirmation**: legacy planning có nested confirmation; applicability chưa quyết.
- **C9 Font preload strategy**: Inter Variable đã declare `@font-face` với `font-display: swap`, nhưng chưa có explicit preload `<link>` in `<head>`.

## 11. Accessibility glossary (WCAG 2.2 AA baseline)

**Compliance level**: WCAG 2.2 AA (per `docs/DESIGN.md` A1-A4 rules). Tất cả component mới phải pass AA trước khi merge.

| Term | Definition | Project usage |
|---|---|---|
| **WCAG 2.2 AA** | Web Content Accessibility Guidelines level AA. Industry standard baseline. Requires: normal text contrast ≥4.5:1, essential controls/focus ≥3:1, touch targets ≥24×24 CSS px, focus not obscured, no color-only signaling, dynamic status accessible. | `docs/DESIGN.md` A1-A4 (MUST). Baseline compliance level. |
| **Focus ring** | Visual indicator khi keyboard focus di chuyển vào control. Có token `--ipc-focus-ring: #2f6fed` + `:focus-visible` outline 2px solid offset 2px. Base UI controls draw their own focus ring qua `[data-slot="button"]:focus-visible { outline: none }`. | `index.css` line 420 (focus-visible override), components/ui/button.tsx, dialog.tsx |
| **Focus trap** | Logic giữ keyboard focus bên trong modal/dialog khi đang mở, return focus về trigger khi đóng. Bắt buộc cho modal (M2.4 MUST). | `components/ui/dialog.tsx` (Base UI handles), `components/common/ConfirmDialog.tsx` wraps `Dialog` |
| **Live region** | ARIA `aria-live` attribute announces content changes to screen readers. `role="status"` + `aria-live="polite"` cho non-urgent updates (toast success, refresh). `role="alert"` + `aria-live="assertive"` cho urgent (error). | `PageBanner.tsx` line 49: `role={tone === 'danger' ? 'alert' : 'status'}`, `StatusBadge.tsx` line 90: `aria-live="polite"`, `ToastProvider.tsx` |
| **Skip link** | Hidden link cho phép keyboard user skip to main content. Standard pattern: `<a href="#main" class="sr-only focus:not-sr-only">Skip to main content</a>` placed đầu `<body>`. | **THIẾU** trong dự án. Cần add ở root layout. |
| **Landmark** | ARIA semantic role giúp screen reader user navigate: `role="banner"` (header), `role="navigation"` (nav), `role="main"` (main), `role="complementary"` (aside), `role="contentinfo"` (footer), `role="region"` + `aria-label` (named section). | `ApprovalQueue.tsx` line 263: `role="region" aria-label="Hàng đợi duyệt vận hành"`, `TableViewport.tsx` line 81: `role="region" aria-label={ariaLabel}` |
| **alt text** | `alt` attribute trên `<img>` mô tả nội dung. Required nếu image carries information. Empty `alt=""` nếu decorative. | **CHƯA audit** trong dự án (no explicit rule). Lucide icons dùng `aria-hidden="true"` cho decorative. |
| **Screen reader** | Assistive technology (NVDA, JAWS, VoiceOver) đọc nội dung qua synthesized speech. Components phải dùng semantic HTML + ARIA để SR hiểu structure. | Test: Vitest + `@testing-library/jest-dom` cho ARIA assertions. Manual: NVDA/VoiceOver (out of scope tự động). |
| **Keyboard navigation** | All interactive elements phải reachable bằng Tab/Shift+Tab, activatable bằng Enter/Space. Arrow keys cho tab groups (roving tabindex pattern ở `ViewSwitcher.tsx`: ArrowLeft/Right + Home/End). | `ViewSwitcher.tsx` (handleKeyDown cho arrow keys), `PageStepper.tsx` (Enter triggers via button), M1.x modal keyboard handling |
| **aria-label vs aria-labelledby** | `aria-label="..."` (string trực tiếp). `aria-labelledby="id-of-element"` (reference tới visible label element). Prefer `aria-labelledby` khi có visible label. | Mix trong dự án. Components có visible label dùng `aria-labelledby`. Standalone controls dùng `aria-label` (vd `TableViewport` aria-label). |

**Visual contrast check** (per WCAG 2.2 AA):

| Pair | Foreground | Background | Ratio | AA? |
|---|---|---|---|---|
| Body text | `--ipc-color-text` (`--ipc-slate-800` = #1e293b) | `--ipc-color-surface` (#ffffff) | ~14.5:1 | ✓ AAA |
| Muted text | `--ipc-slate-500` (#64748b) | #ffffff | ~4.6:1 | ✓ AA |
| Primary on white | `--ipc-primary` (#1a56a8) | #ffffff | ~8.6:1 | ✓ AAA |
| Focus ring | `--ipc-focus-ring` (#2f6fed) | white/dark surface | depends | ≥3:1 needed |
| Status success | `#047857` | `#e6f7f3` | ~5.4:1 | ✓ AA |

**Touch target check** (≥24×24 CSS px):

| Control | Height | Width | AA? |
|---|---|---|---|
| Button (default) | 36px (control-sm) | auto, min-width fit-content | ✓ |
| Input | 36px (input min-height) | 100% | ✓ |
| Checkbox | 16-20px (small) | 16-20px | ✗ (cần ≥24×24 wrapper) |
| Icon-only button | 32px (icon-sm) | 32px | ✓ |

→ Checkbox touch target là **known gap** cần wrapper clickable area.

**Audit checklist khi add component mới**:
- [ ] Có semantic HTML element đúng (`<button>`, `<nav>`, `<main>`, `<table>`, v.v.)
- [ ] Interactive elements có `aria-label` hoặc visible label
- [ ] Focus visible (không bị hidden)
- [ ] Keyboard accessible (Tab/Enter/Space/Arrow)
- [ ] Color không phải signal duy nhất (status badge có text + tone)
- [ ] Touch target ≥24×24 CSS px
- [ ] ARIA live region cho status updates
- [ ] Modal có focus trap + return focus
- [ ] Image có `alt` (nếu informative) hoặc `aria-hidden` (nếu decorative)

## 12. Layout glossary (responsive + positioning)

| Term | Definition | Project usage |
|---|---|---|
| **Breakpoint** | Width threshold trong `@media` query để switch layout. Industry standard: 480 (mobile), 768 (tablet), 1024 (desktop), 1280 (large desktop). | Dự án hiện tại dùng **inconsistent** breakpoints: 480, 599, 640, 767, 900, 980, 1023, 1024, 1200, 1280, 1366, 1399 px (xem 13 file CSS dùng media queries). **Cần chuẩn hóa về 4 tiers**: xs (≤480), sm (≤767), md (≤1023), lg (≥1024). |
| **Media query** | CSS feature query cho responsive. `@media (max-width: 599px)` = "apply khi viewport ≤ 599px". `@media (min-width: 1024px)` = "apply khi ≥ 1024px". `prefers-reduced-motion: reduce` cho motion override. | `index.css` line 371 (reduced-motion), line 394 (≥768px); `responsive.css` (599, 480); `dashboard.css` (1280, 980, 640); `documents.css` (1024); `domain-pages.css` (1024, 640); `operations.css` (1366, 768, 767); `redesign/dashboard.css` (1200, 1200-1399); `redesign/demand.css` (1200, 900); `redesign/responsive.css` (1023, 768, 767). |
| **Mobile-first** | Strategy: style cho mobile trước (base), thêm breakpoint cho larger screens (`@media (min-width: ...)`). Pros: simpler cascade, faster mobile. | Dự án dùng **mixed**: mobile (max-width) cho collapse, desktop (min-width) cho expand. Recommendation: chuẩn hóa về mobile-first. |
| **Fluid layout** | Width thay đổi theo viewport (dùng `width: %`, `vw`, `clamp()`, etc.) thay vì fixed pixel. Container-fluid vs container-fixed. | Dự án dùng fluid cho panels (`max-width: 100%`), fixed cho tables (`min-width: 720px`, `min-width: 940px` — anti-fluid nhưng justified cho table readability). |
| **Sticky position** | `position: sticky` giữ element ở vị trí khi scroll, kết hợp `top`/`left` anchor. Khác với `fixed` (luôn ở viewport) hay `absolute` (so với nearest positioned ancestor). | TableViewport có `stickyHeader?: boolean` (default true) → CSS `position: sticky; top: 0;` cho table header. Sidebar shell có `position: sticky` cho persistent nav. |
| **Z-index layers** | Stacking order. Convention dự án: 0 (base), 10 (sticky/fixed), 20 (dropdown/popover), 30 (modal backdrop), 40 (modal content), 50 (toast). | Cần verify trong `index.css` + component CSS. Z-index conflicts là 1 common source of bug. |
| **Container width** | `min-width` / `max-width` constraints. Dự án dùng `min-width: 320px` cho body (mobile), `min-width: 720-940px` cho tables, `max-width: 92ch` cho description text. | `index.css` line 365 (body min-width 320), line 505 (max-width 92ch), table min-width 720-940 trong nhiều CSS. |

**Known gap**: Inconsistent breakpoint values. Cần owner decision để chuẩn hóa về 4 tiers. Trước khi fix, **MỖI component CSS tự pick breakpoint** dẫn đến:
- Layout shift giữa 980px → 1023px (operations vs documents dùng khác nhau)
- Confusion khi add component mới
- Test phải cover 12 breakpoints thay vì 4

**Recommendation**: chuẩn hóa về Tailwind-style scale (xs/sm/md/lg/xl) → owner pick.

## 14. Feedback decision tree (Toast / InlineAlert / PageBanner / StatusBadge)

Dự án có 4 cách hiển thị feedback. Chọn đúng:

| Component | When to use | Lifetime | Position | Severity | Source |
|---|---|---|---|---|---|
| **Toast** (`useToast`) | One-shot confirmation sau async action. "Đã lưu", "Đã gửi yêu cầu". KHÔNG dùng cho error blocking task (M1.1 modal-only). | Auto-dismiss 5s, hoặc manual close. | Fixed bottom-right (z-index 100) via portal. | success / info / warning / danger. | `ToastProvider.tsx` |
| **InlineAlert** | Inline message trong content flow. Query error, action required, info note ngắn. | Persistent cho tới khi query retry hoặc action dismiss. | Inline (within content). | neutral / info / success / warning / danger. Default icon AlertTriangle/CheckCircle2/Info. | `InlineAlert.tsx` |
| **PageBanner** | Page-level status, work-object state, system-level info. "Đang chạy ca sản xuất", "Cảnh báo hết hàng tồn kho". | Persistent cho tới khi state đổi. | Full-width top of page (border-bottom). | neutral / info / success / warning / danger. Spin option cho loading state. | `PageBanner.tsx` |
| **StatusBadge** | Inline status pill trong table cell, list item, hoặc detail. Single value, không phải message. | Until status changes. | Inline within cell. | neutral / info / success / warning / danger. Auto-resolve từ domain registry. | `StatusBadge.tsx` |

**Decision tree**:

```
Feedback needed?
│
├─ Async action just completed (one-shot) → Toast
│  (sau click "Lưu" → "Đã lưu thành công")
│
├─ Inline trong content flow (form error, query error, info note) → InlineAlert
│  (form submit fails, network error, helper text)
│
├─ Full-width top of page (work-object state, system status) → PageBanner
│  (ca sản xuất đang chạy, lỗi hệ thống tổng)
│
└─ Inline status indicator (table cell, list item, detail label) → StatusBadge
   (mỗi dòng lịch tuần có status pill)
```

**Bans** (per `docs/DESIGN.md` + craft-floor):
- KHÔNG dùng Toast cho error blocking task (M1.1 — use Modal/Dialog)
- KHÔNG dùng StatusBadge cho message dài (dùng InlineAlert)
- KHÔNG dùng PageBanner cho non-page-wide info (dùng InlineAlert)
- KHÔNG stack 2+ PageBanner cùng trang (chỉ 1 work-object state)

## 15. Loading strategy (skeleton / spinner / progress / pulse)

3 patterns loading trong dự án:

| Pattern | When to use | Component | Notes |
|---|---|---|---|
| **Skeleton** (placeholder UI) | Loading mà biết structure UI. Table loading, tab content loading. | `TableSkeleton`, `TabContentSkeleton`, `SkeletonTableRow` (`columns: ColumnSkeletonDef[]`) | Perceived faster than spinner. Better for content > 1 second. |
| **Spinner** (rotating icon) | Loading mà không biết structure. Inline action, button loading, indeterminate progress. | Lucide `Loader2` + `animate-spin`. `PageBanner spin` option. | Sub-1s hoặc inline loading. |
| **Pulse** (opacity animation) | Loading status indicator. | `StatusBadge loading` (animate-pulse + opacity 0.7), `@keyframes ipc-pulse-dot` | Subtle, for status only. |
| **Progress** (determinate bar) | Multi-step operation với known progress. Long-running export, batch import. | NOT explicitly implemented in `components/common/`. Có thể custom cho từng use case. | Owner decision required (not in P3 this doc). |

**Decision tree**:

```
Loading needed?
│
├─ Know UI structure + content > 1s → Skeleton
│  (table với N rows, tab content với 3-4 sections)
│
├─ Know UI structure + content < 1s → Skeleton (nhanh) hoặc nothing
│
├─ Don't know UI structure + content < 1s → Spinner (inline)
│  (button "Lưu" → loading)
│
├─ Don't know UI structure + content > 1s → Spinner (centered) + context
│  (export to Excel, "Đang tải dữ liệu...")
│
└─ Status indicator only (status = "loading") → Pulse
   (StatusBadge loading state)
```

**Bans**:
- KHÔNG dùng spinner full-page khi có skeleton pattern available
- KHÔNG dùng skeleton cho sub-second load (visual noise)
- KHÔNG dùng pulse cho non-status content

## 16. Iconography (Lucide)

Dự án dùng **Lucide React** (`lucide-react`) làm icon library. Single source, không custom icon.

**Sizes** (convention từ code):

| Size | Use |
|---|---|
| `size={12}` | Inline trong text, dense cells |
| `size={14}` | Compact (table cell) |
| `size={16}` | Default (most cases) |
| `size={18}` | Form label, list item |
| `size={20}` | Alert icon, page banner |
| `size={24}` (`h-6 w-6`) | Empty state |
| `size={28}`-`size={32}` | Large empty state, hero |

**Semantic mapping** (từ `StatusTone`):

| Tone | Icon | Use |
|---|---|---|
| success | `CheckCircle2` | Confirmed, completed |
| info | `Info` (or `Lock` for system info) | Informational |
| warning | `AlertTriangle` (or `TriangleAlert` in toast) | Caution |
| danger | `AlertTriangle` (or `TriangleAlert` in toast) | Destructive |
| neutral | `Info` (default) or `CircleDashed` (ContextStrip) | Generic |
| loading | `Loader2` (with `animate-spin`) | In progress |
| empty | `Inbox` (EmptyState) | No data |
| search empty | `SearchX` (EmptyState) | Filtered no match |
| forbidden | `ShieldAlert` (EmptyState) | Permission denied |

**Color rules**:
- Decorative icons: `aria-hidden="true"`, no color override
- Semantic icons: dùng `text-[var(--status-{tone}-fg,...)]` để match tone
- Active/hover icons: dùng color token từ design system
- KHÔNG dùng multi-color icons cho status (single-color via `currentColor`)

**Conventions**:
- Icon button (no text): luôn có `aria-label`
- Icon-only inline (no button): wrap trong component có accessible name
- Stroke width: default Lucide (2px), KHÔNG override nếu không có justification

## 17. Component extraction criteria (3+ rule)

Khi nào **extract** component mới vào shared library (`components/common/` hoặc `components/ui/`)?

**Rule** (từ `extract.md` step 2-3 + impeccable polish):

1. **3+ uses** với same intent. KHÔNG extract chỉ vì "looks similar" — phải có 3+ use case thật.
2. **Same intent, different context**. Nếu 2 button chỉ "trông giống" nhưng serve different purposes → keep separate.
3. **Stable API**. Props phải ổn định qua các use case. Nếu mỗi use case cần prop khác nhau → giữ inline.
4. **No premature abstraction**. Tốt hơn duplicate 1 lần hơn abstract sai.
5. **Has accessibility contract**. Component mới phải có ARIA contract rõ ràng, không rely on parent.

**Decision flow**:

```
New UI pattern needed?
│
├─ Already exists in `components/ui/` or `components/common/` → use existing
│
├─ Used 1-2 times + same intent → keep inline (yet)
│  (re-evaluate sau khi có use case thứ 3)
│
├─ Used 3+ times + same intent + stable API → extract to `components/common/`
│
└─ UI primitive (Button, Input, Dialog) → consider `components/ui/`
   (chỉ khi really low-level, không phải domain composite)
```

**Bans** (per `extract.md`):
- KHÔNG extract one-off, context-specific implementations without generalization
- KHÔNG create components so generic they are useless (vd `<Box>` không có purpose)
- KHÔNG extract without considering existing design system conventions
- KHÔNG skip proper TypeScript types or prop documentation
- KHÔNG create tokens for every single value (semantic meaning required)
- KHÔNG extract things that differ in intent (2 buttons giống nhau nhưng serve different purposes)

**Process** khi extract:
1. Identify 3+ actual uses (search codebase)
2. Define prop API (stable, documented với JSDoc)
3. Build với accessibility (ARIA, keyboard, focus)
4. Add to `index.ts` barrel export
5. Add contract test (`*.contract.test.tsx`)
6. Migrate existing uses
7. Document in this file (UI-KIT.md)

## 19. Performance budget (NFR, link tới ENGINEERING.md)

**Authority**: `docs/ENGINEERING.md` line 114 (delivery workflow performance gate).

**Categories cần measure** (per `docs/ENGINEERING.md`):

| Metric | What it measures | Target (industrial baseline) | Tool |
|---|---|---|---|
| **Requests/latency** | Network round-trip + payload size | p75 < 200ms same-origin, < 500ms cross-origin | `scripts/perf-probe.mjs` (Playwright) |
| **Long tasks** | JS blocking main thread > 50ms | p95 < 200ms long-task time | PerformanceObserver + `longtask` entry type |
| **Frame rate** | Render smoothness | 60fps (16.6ms/frame) target, 30fps minimum | PerformanceObserver + `frame` entry type (Chrome) |
| **LoAF** (Long Animation Frames) | Animation blocking | < 100ms p75 | PerformanceObserver + `animation-frame` |
| **INP** (Interaction to Next Paint) | User-perceived responsiveness | < 200ms p75 (Google Core Web Vital) | Real User Monitoring hoặc lab |
| **CLS** (Cumulative Layout Shift) | Visual stability | < 0.1 p75 | PerformanceObserver + `layout-shift` |
| **TTI** (Time to Interactive) | When page becomes interactive | < 3.8s on slow 4G | Lighthouse / WebPageTest |

**Bans** (per `docs/ENGINEERING.md`):
- **KHÔNG** FPS-only metric (phải attribute to FE/network/BE/DB)
- **KHÔNG** screenshot-only verification
- **KHÔNG** parser-based pass (regex test cho 1 element không phải proof)
- **KHÔNG** DEV-to-production PASS (lab ≠ real)
- **KHÔNG** weaken auth/rate limits to pass metric

**Attribution requirement** (per `docs/ENGINEERING.md`): "attribute FE/network/BE/DB costs". Mỗi regression cần xác định:
- FE: long task, render cost, framework re-render, layout thrash
- Network: payload size, compression, CDN, cache
- BE: API latency, DB query, serialization
- DB: query plan, index, lock contention

**Measurement protocol** (per `docs/ENGINEERING.md`):
1. Declare environment: DEV vs production preview, build/source, actor/mode/data, route/action, viewport
2. Compare identical cold compilation / warm navigation / interaction conditions
3. Measure: requests/latency, long tasks/frame/LoAF/INP/CLS where supported
4. No unique output paths conflict với Playwright cleanup (separate folders)

**Owner pick required**:
- Production p75 budgets (chưa set, cần owner pick per route family)
- CI gate thresholds (pass/warn/fail per metric)
- Lab vs real-user monitoring (RUM) split

## 20. UI ownership markers (UIO/UIF/UIR)

Dự án có 1 unique pattern cho traceability: **UI ownership markers** giúp trace UI region tới owner/floorplan/region.

**Type** (`OperationalFrame.tsx` line 7-12):

```ts
export type UiOwnershipMarker = {
  ownerId?: `uio-${string}`;     // Unique owner ID (vd: uio-1, uio-f, uio-1d)
  floorplanId?: `uif-${string}`; // Floorplan ID (vd: uif-1, uif-f, uif-1d)
  regionId: `uir-${string}`;     // Region ID (vd: uir-1, uir-f, uir-1d)
};
```

**Pattern** (from `OperationalFrame.tsx` line 44-66):
- Wrap route content trong `<OperationalFrame uiOwnership={...}>`
- Marker propagate qua React Context (`UiOwnershipContext`)
- Default `regionId` = `'uir-i'` nếu không có
- Children render với `data-ui-owner`, `data-ui-floorplan`, `data-ui-region` attributes

**Bindings** (from `ViewSwitcher.tsx` line 102-160): 50+ mappings từ `(ariaLabel, tabId)` → `UiOwnershipMarker`. Ví dụ:
- `('Chọn góc nhìn quản trị dữ liệu', 'admin-audit')` → `uio-1, uif-1, uir-1`
- `('Chọn góc nhìn kho', 'warehouse-movement')` → `uio-16, uif-16, uir-16`
- `('Chọn góc nhìn kế hoạch tuần', 'schedule')` → `uio-1d, uif-1d, uir-1d`

**Purpose**:
- Traceability: biết 1 region thuộc owner/floorplan nào
- Testing: visual regression có thể scope per owner
- Debug: khi UI broken ở 1 region, biết owner contact
- Documentation: auto-generate UI inventory per owner

**Usage**:

```tsx
<OperationalFrame
  uiOwnership={{ ownerId: 'uio-1d', floorplanId: 'uif-1d', regionId: 'uir-1d' }}
  title="Lịch tuần"
  command={<CommandBar>...</CommandBar>}
>
  <TableViewport ariaLabel="Lịch">...</TableViewport>
</OperationalFrame>
```

**Convention** (suy từ bindings):
- `uio-NN` cho owner cố định (NN = hex hoặc số, vd 1, a, 1d)
- `uif-NN` cho floorplan tương ứng (cùng NN)
- `uir-NN` cho region cụ thể (cùng NN)
- Lowercase hex digits ở cuối cho sub-regions (vd `uio-4a`, `uif-4a`, `uir-4a`)

## 21. Migration guide (redesign CSS opt-in)

Dự án có 2 design system surfaces:
1. **Default** (`components/*.css`, `index.css`) — production surface, stable
2. **Redesign** (`redesign/*.css`) — opt-in feature flag, experimental

**Opt-in mechanism**:
- Thêm class `.ipc-redesign-shell` lên ancestor element (root hoặc route container)
- CSS rules trong `redesign/*.css` scope vào `.ipc-redesign-shell .ipc-*`
- KHÔNG apply global — chỉ apply trong scope

**Files** (`redesign/`):
- `fiori.css` (4814 B) — Fiori-inspired layout, sidebar, tiles
- `demand.css` (11069 B) — Demand page redesign (filters, summary)
- `dashboard.css` (8862 B) — Dashboard redesign (metric cards, charts)
- `responsive.css` (4172 B) — Responsive overrides for redesign

**Use cases**:
- A/B test redesign vs default
- Stakeholder preview trong isolated scope
- Design exploration mà không touch production

**Verification pattern** (`shared-owner-compatibility.tsx`): render shared components trong cả `Plain ancestor` và `Redesign ancestor` (.ipc-redesign-shell), verify cả 2 render đúng với shared owners (`CommandBar`, `ContextStrip`, `TableViewport`).

**Bans** (per `docs/DESIGN.md`):
- KHÔNG apply redesign CSS toàn project
- KHÔNG merge redesign tokens vào default trước khi owner approve
- KHÔNG dùng redesign CSS làm production authority (chỉ preview/exploration)

## 22. Domain-specific patterns (reference implementations)

Các surface lặp lại nhiều trong dự án. Pattern tổng quát (không phải copy nguyên xi):

### 22.1 Warehouse page (movement + exceptions + receiving)

```tsx
<OperationalFrame
  uiOwnership={{ ownerId: 'uio-16', floorplanId: 'uif-16', regionId: 'uir-16' }}
  title="Kho"
  command={<CommandBar variant="scope"><Filters /></CommandBar>}
>
  <ViewSwitcher tabs={[
    { id: 'warehouse-movement', label: 'Luân chuyển' },
    { id: 'warehouse-exceptions', label: 'Ngoại lệ' },
    { id: 'warehouse-receiving', label: 'Tiếp nhận' },
    { id: 'warehouse-demand', label: 'Nhu cầu' },
  ]} activeTab={activeTab} onTabChange={setActiveTab} ariaLabel="Chọn góc nhìn kho" />
  
  <QueryViewBoundary queries={queries}>
    <TableViewport ariaLabel="Luân chuyển" preferences={...}>
      <table className="ipc-data-table">...</table>
    </TableViewport>
  </QueryViewBoundary>
</OperationalFrame>
```

### 22.2 Reconciliation page (comparison + disposition)

```tsx
<OperationalFrame
  uiOwnership={{ ownerId: 'uio-1d', floorplanId: 'uif-1d', regionId: 'uir-1d' }}
  title="Đối chiếu"
>
  <ContextStrip items={[
    { label: 'Mã đối chiếu', value: batch.code, emphasis: 'strong' },
    { label: 'Trạng thái', value: <StatusBadge status="..." domain="reconciliation" /> },
    { label: 'Số dòng lệch', value: discrepancyCount, tone: 'warning' },
  ]} />
  
  <ReconciliationComparisonTable items={items} />
  
  <ReconciliationDispositionDrawer
    item={selectedItem}
    onClose={...}
    onSubmit={...}
  />
</OperationalFrame>
```

### 22.3 Chef dashboard (task list + material)

```tsx
<OperationalFrame
  uiOwnership={{ ownerId: 'uio-f', floorplanId: 'uif-f', regionId: 'uir-f' }}
  title="Bếp trưởng"
>
  <ViewSwitcher tabs={[
    { id: 'chef-production', label: 'Sản xuất' },
    { id: 'chef-documents', label: 'Tài liệu' },
  ]} activeTab={activeTab} onTabChange={setActiveTab} ariaLabel="Chọn góc nhìn bếp trưởng" />
  
  <ApprovalQueue items={approvals} />
  <DocumentRail items={documents} />
</OperationalFrame>
```

**Common pattern (3 surfaces trên)**:
- `OperationalFrame` wrap toàn bộ route content
- `ViewSwitcher` cho multi-tab pages
- `QueryViewBoundary` cho loading/error/empty
- `TableViewport` cho data tables
- `ContextStrip` cho metadata (work-object, status, count)
- `CommandBar` cho filters/actions

## 23. Form validation pattern

Dự án dùng `FieldRow` + `FieldError` + native form validation.

**Pattern**:

```tsx
<form onSubmit={handleSubmit}>
  <FieldRow
    label="Tên khách hàng"
    required
    htmlFor="customer-name"
    description="Tên đầy đủ hoặc tên viết tắt"
    error={errors.name?.message}
    errorId="name-error"
  >
    <Input
      id="customer-name"
      aria-describedby="name-error"
      aria-invalid={!!errors.name}
      {...register('name')}
    />
  </FieldRow>
  
  {errors.root && (
    <InlineAlert variant="danger" title="Lỗi form">
      {errors.root.message}
    </InlineAlert>
  )}
  
  <Button type="submit" loading={isSubmitting}>Lưu</Button>
</form>
```

**Components involved**:
- `FieldRow` (label + hint + description + error + layout)
- `FieldError` (standalone error message, use khi FieldRow không phù hợp)
- `Input` (Base UI Input, có `aria-invalid`, `aria-describedby`)
- `InlineAlert` (form-level error, server error)
- `Button loading` (loading state during async submit)

**Validation strategy** (recommend):
1. **Client-side validation** (React Hook Form / Zod): instant feedback
2. **Server-side validation**: authoritative, return 400 + field errors
3. **Optimistic update** (nếu phù hợp): show success ngay, rollback on error

**Async validation** (e.g. unique email):
- `onBlur` check, show InlineAlert variant="info" "Đang kiểm tra..."
- On result: clear hoặc show FieldError

**Bans**:
- KHÔNG dùng native `alert()` cho error
- KHÔNG clear form khi validation fail (giữ state)
- KHÔNG rely on `required` HTML attribute only (browser validation UX kém)

## 24. Cập nhật doc này khi

- Thêm/xóa component trong `components/ui/` hoặc `components/common/`
- Thêm/xóa design token trong `styles/index.css`
- Đổi rule ID trong `docs/DESIGN.md`
- Owner pick decision ở section 8

## 10. Không tự ý

- KHÔNG tạo visual world mới (per `docs/DESIGN.md` "Do not clone external Fiori/Carbon/ISA visual branding")
- KHÔNG tạo density policy mới (T8 = OWNER_DECISION_REQUIRED)
- KHÔNG dùng modal cho non-blocking task (M1.1)
- KHÔNG clone specimen làm production authority
- KHÔNG modify working code mà chưa có current scope + authorization
