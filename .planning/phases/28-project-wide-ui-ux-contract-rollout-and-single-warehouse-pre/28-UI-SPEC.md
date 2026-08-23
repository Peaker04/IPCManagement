---
phase: 28
slug: project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
status: approved
shadcn_initialized: false
preset: existing-local-stack-no-components-json
created: 2026-08-23
---

# Phase 28 — Project-wide UI/UX Design Contract

> Canonical visual, semantic, interaction, and evidence contract for the whole-web rollout. This contract preserves IPCManagement’s existing identity and local shadcn/Base UI implementation. It authorizes no production edit by itself: the sealed read-only baseline must first produce an exact finding, expected value, route/state/viewport identity, and lowest owner.

## Contract authority and boundaries

- Applies to `/login` and every protected route registered by `frontend/src/routes/AppRouter.tsx`, including `/`, `/weekly-menu`, `/reports`, `/meal-orders`, `/chef-dashboard`, `/approvals`, `/purchasing`, `/warehouse`, `/admin-data`, `/admin/rules`, `/admin/advanced-settings`, and `/403`.
- Required sources: `.planning/REQUIREMENTS.md` (`PUX-01..06`, `SWH-01..03`), `28-SPEC.md`, `28-CONTEXT.md`, `28-STANDARDS-RESEARCH.md`, `28-SOURCE-INVENTORY.md`, `docs/DASHBOARD-UI-RULES.md`, `docs/UI-PHILOSOPHY.md`, `docs/UI-UX-EXECUTION-HARNESS.md`, `docs/UI-UX-MEASUREMENT-PROTOCOL.md`, and `frontend/docs/ipc-design-tokens.md`.
- Conflict order: data safety → accessibility → layout stability → performance → visual consistency → aesthetics.
- Production changes follow token → primitive → formatter/hook → layout → page. A page-local exception requires route, state, viewport, selector/owner, measured actual, expected value, rationale, and regression oracle.
- Screenshots are reviewer evidence only. DOM, native semantics, ARIA, focus, geometry, computed styles, request records, and performance records decide deterministic verdicts.
- Allowed baseline verdicts are `PASS`, `FAIL`, `NOT_APPLICABLE`, `NEEDS_EVIDENCE`, and `UNRESOLVED`. Only an exact `FAIL` with a lowest owner can authorize implementation.
- Preserve route, permission, API, RTK Query cache identity, database grain, workflow transition, and historical warehouse identity. No historical warehouse row/ID rewrite, stock merge, or old-migration edit belongs to this phase.

## Design System

| Property | Locked value |
|---|---|
| Tool | Existing local shadcn source components; no CLI preset metadata (`components.json` is absent) |
| Preset | Existing IPCManagement identity; do not initialize or replace during Phase 28 |
| Component library | `@base-ui/react` plus local shadcn components |
| Styling | Tailwind CSS 4 plus existing IPC CSS tokens and component layers |
| Icon library | `lucide-react` only |
| Font | Inter Variable with the existing system fallback chain |
| Canonical shell | `MainLayout` → `OperationalFrame` |
| Canonical semantic container | `SectionPanel` |
| Canonical table boundary | `TableViewport` / `PaginatedTableFrame`; table state remains owned by the route/query seam |
| Query-state primitives | `QueryViewBoundary`, `EmptyState`, `QueryErrorAlert`, skeleton primitives |
| Registry | Existing checked-in components only; no third-party registry blocks |

Fiori, Carbon, Atlassian, and Polaris are pattern references only. Do not add their packages, copy their visual identity, or create a parallel component stack.

## Whole-web information hierarchy

### Closed route/state inventory

This table is the only Phase 28 route inventory. `D5` means exactly `1920×1080|1440×900|1366×768|1365×900|1280×900`; `R2` means exactly `320×900|320×900@200%-text`. The validator expands each row over its declared state set × viewport set and computes identity as `route|state|actor|viewport|lowest-owner`; every expanded identity must occur exactly once (`count === 1`). A state not listed here is outside deterministic baseline coverage and is `NEEDS_EVIDENCE`, never an inferred PASS. Shared owners for every protected row are exactly `frontend/src/app/layout/MainLayout.tsx` → `frontend/src/components/common/OperationalFrame.tsx`; `/login` has neither.

| Route | Selected states (exact fixture keys) | Actor / permission | Work object; data grain | Viewports | Lowest page owner | Heading outline; named regions | Primary action | Containers / tables | Responsive behavior |
|---|---|---|---|---|---|---|---|---|---|
| `/login` | `ready`, `submitting`, `invalid-credentials` | anonymous | user session; one credential submission | D5+R2 | `frontend/src/features/auth/pages/LoginPage.tsx` | H1 `IPC Management System`; main `Đăng nhập IPC`, form `Thông tin đăng nhập`, alert `Lỗi đăng nhập` | `Đăng nhập` | auth panel; no table | Single column; fields/actions full-width at 320; zero document overflow |
| `/` | `ready`, `empty`, `error`, `refreshing` | authenticated | current operational shift; one exception/workflow item | D5+R2 | `frontend/src/features/dashboard/pages/DashboardPage.tsx` | H1 `Bàn điều hành hôm nay`; main; regions `Tổng quan ca hôm nay`, `Việc cần xử lý trước`, `Tiến độ 4 công đoạn` | `Mở điều phối` | OperationalFrame; shift-status and workflow panels; no primary table | Desktop summary grid becomes one column at 320; exception precedes metrics |
| `/weekly-menu` | `plan-ready`, `plan-empty`, `plan-error`, `plan-refreshing`, `import-dialog-open`, `editor-dialog-open` | coordinator / `coordination.read` | weekly production menu; one dish × service date/shift | D5+R2 | `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` | H1 `KHSX và định lượng`; main; tablist `Chế độ thực đơn tuần`; named active tabpanel; dialogs named `Nhập thực đơn từ Excel`/`Chỉnh sửa thực đơn tuần` | `Nhập Excel` | OperationalFrame; view switcher; schedule/import panels and menu tables | Tabs remain operable; secondary columns disclose locally; dialogs fit 320 with internal vertical scroll only |
| `/reports` | `ready`, `empty`, `error`, `refreshing`, `price-variance-warning-detail` | reporter / `report.read` | operational report; one KPI/ingredient/variance record | D5+R2 | `frontend/src/features/reports/pages/ReportsPage.tsx` | H1 `Báo cáo vận hành`; main; regions `Tổng hợp nhu cầu theo từng ngày trong khoảng đã chọn`, `Kế hoạch thu mua dự kiến`, `Tồn kho hiện tại theo kho`, detail `Chi tiết cảnh báo giá` | `Làm mới báo cáo` | SectionPanels; tables `Bảng nhu cầu nguyên liệu`, `Bảng kế hoạch thu mua dự kiến`, stock/variance tables | Panels stack at 320; every wide table scrolls only in its named TableViewport |
| `/meal-orders` | `ready`, `empty`, `error`, `refreshing`, `active-tab` | coordinator / `coordination.read` | meal coordination; one customer order × service date/shift | D5+R2 | `frontend/src/features/coordination/pages/CoordinationPage.tsx` | H1 `Điều phối suất ăn`; main; region `Danh sách đơn suất ăn`; named view/tabpanel when present | `Tạo đơn suất ăn` | OperationalFrame; SectionPanel; OrderTable | Filters/actions wrap; essential order/status/action persist; table gets local scroll |
| `/chef-dashboard` | `production-ready`, `production-empty`, `production-error`, `production-refreshing`, `documents-tab` | chef / `production.read` | kitchen production shift; one production dish/document | D5+R2 | `frontend/src/features/chef/pages/ChefDashboardPage.tsx` | H1 `Bếp sản xuất`; main; tablist `Không gian bếp`; tabpanels `Ca sản xuất`, `Chứng từ bếp`; named status alerts | `Xác nhận nhận nguyên liệu` | OperationalFrame; chef header/cards; production and material tables | Cards become one column; essential checklist actions remain visible; tables use local scroll |
| `/approvals` | `queue-ready`, `queue-empty`, `queue-error`, `queue-refreshing`, `history-tab`, `approval-dialog-open` | approver / `purchase.request.approve` | approval inbox; one approval target/document | D5+R2 | `frontend/src/features/approvals/pages/ApprovalPage.tsx` | H1 `Duyệt vận hành`; main; tablist `Chế độ duyệt`; regions `Danh sách cần duyệt`, `Lịch sử phê duyệt`, `Danh sách đề xuất mua hàng`; dialog `Duyệt đề xuất mua?` | `Duyệt chứng từ` | OperationalFrame; SectionPanels; approval/history/request tables | Queue/detail stack; actions remain labeled; tables scroll locally; modal fits 320 |
| `/purchasing` | `workflow-ready`, `workflow-empty`, `workflow-error`, `workflow-refreshing`, `supplemental-tab`, `quotes-tab` | purchaser / `purchase.read` | purchase workflow; one approved demand/request/quote | D5+R2 | `frontend/src/features/purchasing/pages/PurchasingPage.tsx` | H1 `Thu mua`; main; tablist `Không gian thu mua`; tabpanels `Xử lý thu mua`, `Mua bổ sung`, `Báo giá`; region `Hành động tiếp theo` | `Tạo đơn mua` | OperationalFrame; workflow/supplemental/quote panels and tables | Workbench stacks; essential request/status/action persist; tables scroll locally |
| `/warehouse` | `ready`, `mixed-empty`, `initial-loading`, `refreshing`, `receipt-error`, `receipt-empty`, `zero-active`, `multiple-active`, `tampered-id` | keeper / `warehouse.read` | warehouse operations; one stock/document row keyed by warehouse ID + item/document ID | D5+R2 | `frontend/src/features/warehouse/pages/WarehousePage.tsx` | H1 `Kho nguyên liệu`; passive region `Phạm vi kho vận hành`; main; tablist `Không gian kho`; regions `Tồn kho hiện tại`, `Phiếu kho`, `Đơn mua chờ nhập kho` | `Tạo phiếu xuất` (blocked states: no primary mutation) | OperationalFrame; SectionPanels; `Bảng tồn kho hiện tại trong kho`, purchase-order/receipt/movement tables in TableViewport | ≥1366 split primary/rail side-by-side; ≤1365 stacked in same DOM order; at 320 only named table regions scroll |
| `/warehouse` | `route-forbidden` | purchaser / missing `warehouse.read` | denied warehouse route; one denied route | D5+R2 | `frontend/src/routes/RoleGuard.tsx` | shell H1 `Kho nguyên liệu`; main; region/H2 `Không đủ quyền truy cập` | none | one forbidden SectionPanel; no table | Full-width denial panel; no warehouse content or mutation control |
| `/admin-data` | `ready`, `empty`, `error`, `refreshing`, `cleanup-tab`, `data-quality-stress` | administrator / `*` | master/admin data; one entity or quality issue | D5+R2 | `frontend/src/app/pages/AdminDataPage.tsx` | H1 `Quản trị dữ liệu`; main; tablist `Chế độ quản trị dữ liệu`; named tabpanels including `Dữ liệu lỗi` | `Nhập định mức` | OperationalFrame; admin tab panels; entity/import/quality tables | Tabs and command bar wrap; table actions remain readable; local scroll only |
| `/admin/rules` | `ready`, `empty`, `error`, `refreshing`, `editor-dialog-open` | administrator / `*` | approval policy; one rule and ordered approval step | D5+R2 | `frontend/src/features/admin/pages/ApprovalRulesPage.tsx` | H1 `Thiết lập quy trình duyệt`; main; region `Danh sách các quy tắc phê duyệt`; dialog `Cấu hình quy tắc phê duyệt` | `Thêm quy tắc` | OperationalFrame; SectionPanel; rule list; ordered-step editor | Rule controls wrap; editor single-column at 320; dialog internal vertical scroll only |
| `/admin/advanced-settings` | `ready`, `saved`, `validation-error` | administrator / `*` | display/navigation preference; one preference key | D5+R2 | `frontend/src/features/admin/pages/AdvancedDisplaySettingsPage.tsx` | H1 `Thiết lập nâng cao`; main; region `Cấu hình hiển thị` | `Lưu thiết lập` | OperationalFrame; one settings SectionPanel; no table | One-column form at 320; labels wrap; no hidden controls |
| `/403` | `ready` | authenticated but forbidden | access denial for requested route; one denied route | D5+R2 | `frontend/src/features/auth/pages/ForbiddenPage.tsx` | shell H1 `Hệ thống Quản lý Bếp ăn`; main; region `Không đủ quyền truy cập` with H2 of same name | `Về tổng quan` | one SectionPanel; no table | Centered panel becomes full-width; action remains visible at 320 |

The wildcard is a redirect, not a page owner, and therefore is intentionally excluded. Inventory closure compares this route set exactly with `ROUTES` and `AppRouter`: 13 page routes, 12 protected and one public; additions/removals fail before capture.

### Required visible and semantic order

1. Global shell navigation and route context from `MainLayout`.
2. Exactly one visible page `h1`, naming the work object rather than a backend module/table.
3. One passive scope/context line, including warehouse context when applicable.
4. Critical blocking status and operational exceptions.
5. One primary action for the current context; secondary actions follow or move to overflow.
6. Key metrics needed to decide the next action.
7. Labeled filters and active-filter summary.
8. Primary operational collection/table.
9. Supporting details, history, or secondary panels.

Rules:

- Exactly one visible `h1` per routed page; nonempty accessible name; heading levels never skip for styling. A missing or duplicate H1 is `FAIL` (medium).
- Each major semantic region (`navigation`, `main`, filter region, primary data region, supporting region) has a unique programmatic name. Duplicate names are allowed only when the accessible name distinguishes purpose.
- Global route context and local work-object heading must not repeat the same visible title verbatim. If both are necessary, the shell names the route and the H1 names the current work object/state.
- Critical exceptions precede routine metrics. Decorative summaries must not push the primary work collection below supporting content.
- One primary action per context. Multiple visually primary actions in the same region are `FAIL` (medium); destructive action is never the default primary when a safe action exists.
- Progressive disclosure keeps 5–7 decision fields at list level. Supporting attributes belong in row detail, drawer, expansion, or deep-linked detail.
- Navigation labels and work-object terminology use `docs/GLOSSARY.md`; technical IDs, raw enums, table names, and stack traces are not primary copy.

Deterministic evidence: H1 count/name, heading-level sequence, landmark/region names, primary-action count, DOM order, route inventory closure. Fresh AI review may evaluate only whether the declared order communicates work object, exception, responsibility, and next action clearly.

## Spacing scale

The Phase 28 admissible product spacing scale is finite: **4, 8, 16, 24, 32, 48, and 64px only**. These are the complete permitted values for every new or remediated margin, padding, gap, and positional-spacing recipe:

| Token | Value | Usage |
|---|---:|---|
| `--ipc-space-1` | 4px | Icon/text micro-gap; never a standalone touch target |
| `--ipc-space-2` | 8px | Inline controls, badges, compact cell content, default within-group gap |
| `--ipc-space-4` | 16px | Default component padding and relaxed within-group gap |
| `--ipc-space-7` | 24px | Default between-group gap and section padding |
| `layout-xl` | 32px | Major layout separation; introduce as a semantic token before use |
| `layout-2xl` | 48px | Page-level break only; introduce as a semantic token before use |
| `layout-3xl` | 64px | Exceptional top-level separation only; introduce as a semantic token before use |

Measured legacy findings are not remediation permissions: existing 12px (`--ipc-space-3`), 20px (`--ipc-space-5` and the current `--ipc-space-6` alias), and 28px (`--ipc-space-8`) may be recorded only as baseline actual values with route/owner evidence. A remediation must map each finding to one of the seven permitted values above at the lowest shared owner; it must not preserve, introduce, or recommend 12, 20, or 28px as product spacing.

Contracts:

- Raw `margin`, `padding`, `gap`, positional spacing, or Tailwind arbitrary spacing outside the seven-value scale is `FAIL` unless it is non-spacing geometry dispositioned with owner and rationale. Legacy occurrence alone is not an exception.
- Within-group gap is always smaller than between-group gap. Use 8px within and 16px between by default; use 16px within and 24px between for relaxed groups. Reserve 4px for tightly coupled icon/text content, and 32/48/64px for major or page-level separation rather than component internals.
- Negative margins are prohibited for density correction.
- Control heights use existing 32/36/40/44px tokens. WCAG target size is at least 24×24 CSS px or a documented spacing/equivalent exception; 44px is the preferred touch target, not misreported as the AA minimum.
- Table row density remains the existing 40px compact, 48px default, 56px comfortable contract. Density changes occur at the shared component/system seam and retain keyboard/target compliance.
- Source-aware checks inspect literals; computed-style evidence verifies rendered gaps and padding. An unsupported literal is medium severity; clipping, overlap, hidden focus, or unusable target escalates to high.

## Typography

Use exactly four sizes and two weights for remediated product UI. Existing semantic role names remain the public interface; unsupported current recipes become baseline findings rather than justification for route-local variants.

| Role | Size | Weight | Line height | Contract |
|---|---:|---:|---:|---|
| Caption / label / table header | 12px | 600 | 1.333 | Metadata, persistent labels, compact headers; never essential explanatory prose |
| Table / code | 13px | 400 | 1.35 | Dense rows and technical secondary values only |
| Body / control / section title | 14px | 400 or 600 | 1.5 body; 1.25 title/control | Default operational reading and actions |
| Page title / critical explanatory text | 16px | 600 | 1.25 title; 1.5 prose | H1 and explanation needed to act safely |

- Allowed weights are regular 400 and semibold 600. Do not add route-local 500/700/800/900 recipes; consolidation must be handled at `frontend/src/styles/index.css` and `frontend/src/lib/typography.ts` after baseline evidence.
- Inter Variable is the only UI font; monospace fallback is reserved for code/technical identifiers in detail views.
- Comparable numeric values use `tabular-nums`; units appear in the header when constant for the column, otherwise beside each value.
- Names precede codes. A technical code is secondary, smaller/muted, copyable, and never the only primary identifier.
- Text must remain available and unclipped at 200% text zoom. Vietnamese labels wrap inside their surface; status pills may ellipsize only with an accessible full name and tooltip.
- Typography hierarchy must not rely on size/weight alone: semantic headings, spacing, labels, and region structure carry meaning.
- The 12px caption and 13px dense-table roles are retained from measured local semantic recipes, not asserted as a universal accessibility minimum. They remain limited to non-prose metadata or dense secondary/technical values; essential explanatory prose and action labels use the 14px or 16px roles. Acceptance is determined by the declared contrast, 200% text-zoom, wrapping, clipping, and task-availability oracles rather than an invented WCAG font-size threshold.

## Color and visual identity

Use existing semantic IPC variables; percentages describe visual area, not new literal colors.

| Role | Value | Usage |
|---|---|---|
| Dominant (60%) | `--ipc-color-surface` / `--background` | Main canvas, data reading surfaces |
| Secondary (30%) | `--ipc-color-surface-subtle`, `--ipc-color-surface-accent`, neutral slate/border tokens | Sidebar, navigation, panels, table headers, grouped context |
| Accent (10%) | `--ipc-primary` / `--primary` | One primary action, active route/tab, selected state, keyboard focus where the focus token applies |
| Destructive | `--ipc-danger` / `--destructive` | Destructive actions and blocking/error states only |
| Warning | semantic warning tokens | Action-needed state only; never decoration |
| Success | semantic success tokens | Completed/safe/accepted state only; use sparingly |

Accent is reserved for: the single primary action in a context, active navigation, active view/tab, selected control state, and the existing focus affordance. It is not applied to every link, card edge, metric, or icon.

- Normal operating state is neutral. Color is scarce and reserved for meaning; red is never decorative.
- Text contrast is at least 4.5:1, large text at least 3:1, and non-text UI/focus contrast at least 3:1.
- State is never communicated by color alone: pair tone with text and, where useful, shape/icon.
- Components consume semantic tokens, not raw hex/rgb/hsl. Existing primitives are preserved; route-local hardcoded colors are baseline violations.

## Cards and data-container contract

- `SectionPanel` is the canonical route-level semantic data container. Low-level `Card` remains allowed only for a specialized component whose owner and purpose cannot be expressed by `SectionPanel`.
- Every container has exactly one coherent purpose, one visible title or unique accessible name, and a declared owner.
- Semantic nesting depth is at most one: a data container may contain controls, table regions, detail groups, or visually uncontained metric groups, but not another bordered/shadowed card for decoration.
- Nested cards, repeated borders/shadows, card-per-table-row on desktop, and adjacent single label/value cards are review findings unless a declared interaction requires containment.
- A metric group uses one shared surface and semantic list/group structure; each datum does not receive its own raised card by default.
- Container title, query state, actions, and content retain the same accessible region identity across loading, populated, empty, refreshing, stale, partial-error, and forbidden states.
- A `section`, `article`, `aside`, or region-like container without an accessible name is medium `FAIL`; accidental nested semantic containers are low/medium depending on scan and focus impact.
- Visual depth uses existing radius/shadow tokens only. Hover/focus must not change dimensions or move neighbors.

## Operational table contract

Every registered operational table owner must satisfy all rows below in populated, loading, empty, no-results, error/partial, refreshing, and stale states.

### Semantics and labeling

- Prefer native `<table>`, `<caption>`, `<thead>`, `<tbody>`, and `<th scope="col|row">`. The caption may be visually hidden but must uniquely name the table.
- Generic `div` grids fail unless a complete ARIA grid keyboard model is declared and tested. Native table semantics must not be duplicated with unnecessary ARIA roles.
- Sortable active header exposes `aria-sort`; sort affordance never changes header alignment.
- Filters have persistent visible labels; placeholder-only labeling fails. Result-count updates and filter/sort outcomes are announced without moving focus.

### Content and alignment

- Text is left-aligned. Comparable quantities, money, percentage, counts, and deltas are right-aligned with tabular numerals. Headers align with their column. Operational values are never centered.
- Each column is registered as `essential`, `secondary`, or `detail`, with type, alignment, minimum width, responsive behavior, and owner.
- The primary list exposes 5–7 decision columns. Long detail moves to disclosure, expansion, drawer, or detail route.
- Default sort is newest or most action-needed according to the work object; never raw primary key.
- Status uses the shared status primitive and closed vocabulary. At list level show at most two badges/tags; multiple simultaneous states collapse to the highest-priority operational state.

### Geometry and responsive behavior

- Document-level horizontal overflow is zero. Wide essential tabular comparison may scroll only inside a labeled, keyboard-focusable `TableViewport`/`DataTableShell` region.
- A horizontally scrolling table has a sticky header and frozen identity column where the table owner documents that comparison requires it.
- At narrow widths keep essential identifier/status/action, disclose secondary columns, and move detail fields to row detail. Do not crush values, silently remove required actions, or turn every desktop row into an unlabeled card.
- Each table documents whether WCAG’s essential two-dimensional-layout exception applies; the exception never permits page-level overflow.
- Lists above 100 rows use server pagination or virtualization. Pagination states range, total, page size, and direct page navigation when many pages exist.

High-severity deterministic failures: missing table semantics/name, inaccessible scroll region, missing keyboard action, page-level overflow, absent required state, or hidden essential action. Medium: alignment, priority, sort, density, or unsupported local recipe.

## Query and data-freshness states

Every data region declares the following mutually distinguishable states while retaining its accessible name and stable geometry:

| State | Required presentation and interaction |
|---|---|
| Uninitialized / initial loading | Structure-matched skeleton; never empty copy; no zero-height container |
| Populated | Current data, result count where applicable, normal operations |
| Refreshing | Keep existing data, scroll, selection, and geometry; show `Đang cập nhật…`; no full skeleton |
| Truly empty | Heading `Chưa có dữ liệu`; body names the region’s purpose and offers the route-specific create/start action when permitted |
| No filter results | Heading `Không tìm thấy kết quả`; identify active conditions and offer `Xóa bộ lọc` |
| Forbidden | State that required access is unavailable and provide the project’s access/help path; never render a fake empty list |
| Error with no usable data | Explain the user-facing problem and offer `Thử lại`; never expose stack trace/raw server code |
| Partial error / stale data | Keep last usable data; label `Dữ liệu có thể đã cũ`; show last-updated time and `Thử lại`/`Làm mới` |
| Mutation in flight | Action-specific pending label, stable layout, prevent duplicate submit without hiding context |
| Mutation failure | Roll back optimistic state, explain what failed and the next action; focus remains predictable |

- Loading never flashes empty. Skeletons match final row/count/padding geometry.
- Refetch never reloads the document or clears usable data. Old responses cannot overwrite a successful mutation.
- Status messages use an appropriate live region and never steal focus.
- A shell-level freshness cluster owns synchronization state, last-updated time, and `Làm mới`; route-local competing refresh buttons are prohibited unless the baseline proves a separate data owner.
- Auto-refresh pauses while the tab is hidden, editing/modal is active, focus is in an input, or selection/drag is active. UI states `Đang tạm dừng`; resume performs one refetch before returning to policy.
- Offline/refetch failure preserves last data, marks it stale, and uses bounded shared backoff.

## Copywriting contract

Whole-web copy is a pattern contract because the work object differs by route. Each inventory row substitutes the concrete Vietnamese noun while preserving the exact action pattern.

| Element | Locked pattern |
|---|---|
| Primary CTA | Specific verb + work object, e.g. `Tạo phiếu nhập`, `Duyệt yêu cầu`; never `OK`, `Xác nhận`, or `Tiếp tục` without an object |
| Truly empty heading | `Chưa có {tên dữ liệu}` |
| Truly empty body | `Khu vực này dùng để {mục đích}. {Bước tiếp theo khả dụng}.` |
| No-results heading | `Không tìm thấy kết quả` |
| No-results body/action | `Không có kết quả phù hợp với bộ lọc hiện tại.` / `Xóa bộ lọc` |
| Error | `Không thể tải {tên dữ liệu}. Hãy thử lại.` / `Thử lại` |
| Stale | `Dữ liệu có thể đã cũ` plus `Cập nhật lần cuối {thời gian}` / `Làm mới` |
| Forbidden | `Bạn không có quyền xem {tên khu vực}. Liên hệ quản trị viên để được cấp quyền.` |
| Destructive confirmation | `{Động từ} {đối tượng}?` then name the consequence; actions are `Hủy` and the same specific destructive verb |
| Warehouse passive scope | `Kho vận hành: {warehouseName} ({warehouseCode})` where code is available and useful |
| Zero warehouse | `Chưa cấu hình kho vận hành. Liên hệ quản trị viên để tiếp tục.` |
| Multiple active warehouses | `Cấu hình kho vận hành chưa hợp lệ. Liên hệ quản trị viên để tiếp tục.` |

Destructive actions require confirmation only when irreversible/high consequence; prefer undo for reversible removal. The safe action receives initial focus, never the destructive action.

## Responsive and accessibility contract

### Required matrices

- Desktop measurement matrix remains `1920×1080`, `1440×900`, `1366×768`, `1365×900`, and `1280×900`.
- Reflow backstop: 320 CSS px viewport with no page-level horizontal overflow; only a documented essential table region may scroll in two dimensions.
- Text zoom backstop: 200% browser text zoom, with content and actions available and unclipped.
- Visual reviewer coverage may include 390×844 but cannot replace the 320px reflow oracle or five desktop measurements.

### Release gates

- WCAG 2.2 AA; axe serious/critical violations equal zero.
- Every pointer action has keyboard parity; no keyboard trap outside a modal.
- Focus indicator is visible, at least 3:1 against adjacent colors, and not fully obscured by sticky/fixed content.
- DOM/tab order matches visual task order. Hover-revealed row actions have an equivalent keyboard path.
- Controls have accessible names; icon-only controls have `aria-label` or an equivalent visible label. Accessible names include the visible label text.
- Dialogs have a programmatic title, `aria-modal`, focus containment, inert background, Escape/close behavior as allowed by unsaved state, and focus return to the trigger.
- Status is not color-only. Text contrast is ≥4.5:1 (≥3:1 for large text); non-text components and states are ≥3:1.
- Targets are ≥24×24 CSS px or meet the WCAG spacing/equivalent exception; 44×44 is preferred for touch-critical controls.
- Motion uses transform/opacity for 150–250ms feedback and respects `prefers-reduced-motion`; no decorative pulse, bounce, ping, or continuous workflow animation.
- CLS ≤0.1, INP ≤200ms, and LCP ≤2.5s at p75 remain performance release targets. Missing reproducible measurement is `NEEDS_EVIDENCE`, not PASS.

## Passive single-warehouse presentation

This is a presentation contract contingent on server/runtime truth; it does not authorize client-side inference or identity deletion.

| Authorized active warehouse count | Routine UI contract | Security/data contract |
|---:|---|---|
| 0 | Block operational work with the zero-warehouse state; render no editable/hidden guessed warehouse value | Server fails closed |
| 1 | Remove interactive warehouse picker and warehouse-selection step; show one passive scope line in the page context | Server resolves and enforces the active warehouse; payload/FK/audit identity remains intact |
| >1 | Fail closed for the intended singleton business mode; expose a selector only under an explicitly approved compatibility path | Never select `First`, lowest ID, sort order, recent activity, or merge data silently |

- Passive scope appears once per work context, immediately below/within the route/work-object context. Do not repeat the warehouse name in every card, filter, metric, or routine table column.
- Remove a warehouse column/filter only when all visible rows are provably in the same server-resolved scope and the value has no decision utility. Preserve warehouse identity in exports, print views, deep links, confirmations for irreversible/audit-sensitive operations, and detail/audit history where required.
- Destructive or irreversible confirmation includes warehouse name/code once so the user can verify scope.
- Never derive a singular label from `currentStockRows[0]`, a selected client option, or an editable hidden field.
- Warehouse ID remains in API payloads/query identity, authorization, foreign keys, stock grain, audit events, receiving decisions, source lineage, and compatibility paths.
- Runtime tests must prove zero/one/multiple and tampered-ID behavior. Unit/visual fixtures containing one warehouse are not proof of the singleton invariant.

## Fresh AI review boundary

Fresh independent AI review runs only after deterministic rules and receives evidence for one exact route/state/actor/viewport identity at a time.

Allowed review dimensions:

- clarity of work object and next action;
- information hierarchy and information order;
- semantic grouping and whether a container has one purpose;
- visual balance/density and anomaly salience;
- whether progressive disclosure preserves decision information;
- qualitative information architecture not reducible to a stable DOM/geometry oracle.

AI must not:

- declare WCAG, contrast, focus, overflow, target size, heading count, table semantics, query-state behavior, API behavior, performance, or warehouse authorization PASS when deterministic evidence can decide it;
- authorize a production edit from screenshot appearance or taste;
- prescribe exact pixels, component libraries, workflow changes, permissions, API/cache changes, or data-grain changes;
- compare against stale evidence or inherit prior review conclusions as fresh findings.

Every accepted AI finding must include `rule`, route, state, actor, viewport, evidence reference, expected, actual, severity, lowest owner, confidence, and non-PASS verdict. Missing fields reject the finding. Conflicts are resolved in favor of deterministic evidence. Fresh review closes only at zero unresolved finding.

## UI considerations

Applicable state considerations resolved: 8 covered, 4 explicit backstops, 0 unresolved.

| Category | Element(s) | Status | Resolution / reason |
|---|---|---|---|
| Empty | Every data container/table/form | ✅ covered | Truly empty, filtered-no-results, forbidden, and zero-warehouse states are distinct and reference the copy contract |
| Loading | Every query-backed container/control | ✅ covered | Initial load uses geometry-matched skeleton; refreshing retains data and never renders empty copy |
| Error | Query regions and mutations | ✅ covered | No-data error, partial/stale error, retry, rollback, live announcement, and focus behavior are explicit |
| Populated | Routes, panels, tables | ✅ covered | Typical state follows declared hierarchy, one-purpose containers, and registered table contracts |
| Partial | Tables, forms, stale collections | ✅ covered | Last usable data remains visible and labeled stale; incomplete values retain semantic placeholders and grain |
| Overflow | Navigation, labels, tables, static content | ✅ covered | Document overflow is zero; essential tables scroll in labeled local regions; labels wrap or expose full accessible names |
| Zero-one-many | Collections and warehouse scope | ✅ covered | Collections cover empty/singular/many; warehouse zero/one/multiple presentation fails closed as specified |
| Long text | Vietnamese labels, buttons, status, navigation | ✅ covered | Required copy wraps; bounded status truncation retains full accessible name and tooltip |
| 320px reflow | Whole route matrix | 🧪 backstop | Headed browser evidence must prove no page-level horizontal overflow and preserved essential actions |
| 200% text zoom | Whole route matrix | 🧪 backstop | Headed evidence must prove no clipped or unavailable content/control |
| Keyboard/focus | All interactions | 🧪 backstop | Keyboard-only flows and focus geometry must be captured per selected state |
| Fresh qualitative review | All declared route/state identities | 🧪 backstop | Independent review is required for hierarchy/grouping/balance/IA after deterministic gates |

## Executable rule-to-oracle matrix

All PASS oracles below execute in `frontend/tests/ui-audit.spec.ts`, use the inventory identity above, and write fields into the existing `test-results/ui-audit-*.json` issue/report path. Fixture names are stable keys implemented in that file (inline DOM fixture pages are permitted); each known-bad must yield exactly one finding with its rule ID and each known-clean must yield zero. `coverage=ALL` means every expanded inventory identity; narrower coverage is stated exactly. Pixel comparisons use CSS px. No adjective such as “stable”, “matched”, “logical”, “bounded”, or “readable” is a PASS condition unless reduced to the value shown here.

| Stable ID | Rule and exact PASS oracle | Known-bad fixture | Known-clean fixture | Required report field(s) | Route / state / viewport coverage |
|---|---|---|---|---|---|
| `INV-01` | Expanded inventory route set equals AppRouter page-route set; route count `13`; protected count `12`; every identity count `1`; missing/extra/duplicate count `0` | `bad-inventory-duplicate-login-ready` | `clean-inventory-closed-v1` | `ruleId,identity,actualCount,expectedCount,routeSetDiff` | all inventory rows before browser capture |
| `HIER-01` | Visible H1 count `1`; trimmed accessible-name length `>=1`; heading sequence never increases by more than `1` level | `bad-hierarchy-two-h1-skip` | `clean-hierarchy-one-h1` | `ruleId,h1Count,h1Name,headingLevels,selector` | ALL |
| `HIER-02` | Named required-region count equals row declaration; blank names `0`; duplicate `(role,name)` count `0`; primary actions visible in main context `<=1` and exactly `1` except warehouse blocked states and error/forbidden states where `0..1` | `bad-hierarchy-duplicate-region-two-primary` | `clean-hierarchy-regions-one-primary` | `ruleId,requiredRegions,actualRegions,duplicateRegions,primaryActionCount` | ALL |
| `TOK-SP-01` | New/remediated computed margin/padding/gap values belong to `{0,4,8,16,24,32,48,64}`; tolerance `±0.25`; negative spacing count `0` | `bad-token-spacing-12px` | `clean-token-spacing-16px` | `ruleId,property,actualPx,allowedPx,selector,owner` | ALL, production nodes carrying `data-ui-owner` |
| `TOK-TY-01` | Computed font-size belongs to `{12,13,14,16}` px `±0.1`; weight belongs to `{400,600}` exactly; line-height ratio belongs to declared role value `±0.02` | `bad-token-type-15px-500` | `clean-token-type-body14-400` | `ruleId,fontSizePx,fontWeight,lineHeightRatio,role,selector` | ALL |
| `TOK-CO-01` | Computed product colors resolve through an approved semantic CSS variable; raw new hex/rgb/hsl source occurrences `0`; text contrast `>=4.5`, large-text contrast `>=3.0`, non-text/focus contrast `>=3.0` (ratio tolerance `-0.01`) | `bad-token-raw-color-low-contrast` | `clean-token-semantic-aa` | `ruleId,sourceToken,computedColor,contrastRatio,minimum,selector` | ALL |
| `CONT-01` | Every visible `section/article/aside/[role=region]` has accessible-name length `>=1`; duplicate `(role,name)` count `0`; semantic container nesting depth `<=1` | `bad-container-unnamed-nested-depth2` | `clean-container-named-depth1` | `ruleId,role,name,nestingDepth,selector,owner` | ALL |
| `CONT-02` | Hover and focus change container border-box width and height by `<=0.5px` each and move every sibling by `<=0.5px` on x/y | `bad-container-hover-shift-4px` | `clean-container-hover-no-shift` | `ruleId,beforeRect,afterRect,maxSiblingDeltaPx,selector` | ALL ready/populated states, D5+R2 |
| `TABLE-01` | Every registered table uses native `table`; accessible-name length `>=1`; `thead` count `1`; each data column header has `scope=col`; native table descendants with explicit duplicate table roles count `0` | `bad-table-divgrid-unnamed` | `clean-table-native-captioned` | `ruleId,tableName,elementName,theadCount,missingScopeCount,duplicateRoleCount,owner` | every inventory state containing a table, D5+R2 |
| `TABLE-02` | Text cells/header alignment `left`; numeric cells/header alignment `right`; numeric `font-variant-numeric` contains `tabular-nums`; centered operational-value count `0` | `bad-table-centered-numeric` | `clean-table-right-tabular` | `ruleId,columnId,columnType,cellAlign,headerAlign,fontVariant,selector` | every populated table state, D5+R2 |
| `TABLE-03` | Document overflow `scrollWidth-clientWidth <=2px`; overflowing table ancestor is named focusable TableViewport with `tabIndex>=0`; essential identifier/status/action visible count equals registered count; row height equals one of `{40,48,56}` px `±0.5` | `bad-table-page-overflow-hidden-action` | `clean-table-local-scroll-essential` | `ruleId,documentOverflowPx,viewportName,focusable,essentialExpected,essentialVisible,rowHeightPx` | every table state, D5+R2 |
| `QUERY-01` | Exactly one state marker from declared set; initial loading has skeleton count `>=1` and empty-copy count `0`; refreshing retains row IDs exactly and scroll delta `<=1px`; empty and no-results headings equal locked copy; forbidden does not contain fake-empty heading | `bad-query-loading-empty-flash` | `clean-query-exclusive-states` | `ruleId,queryState,stateMarkerCount,skeletonCount,emptyCopyCount,rowIdsBefore,rowIdsAfter,scrollDeltaPx,heading` | every listed query state, D5+R2 |
| `QUERY-02` | State-region accessible name is byte-equal before/after transition; region height delta loading→ready `<=8px`; refreshing→ready `<=2px`; partial/stale retains previous row IDs and contains exact label `Dữ liệu có thể đã cũ` plus a last-updated time element | `bad-query-region-renamed-collapsed` | `clean-query-stable-region-stale` | `ruleId,nameBefore,nameAfter,heightBeforePx,heightAfterPx,heightDeltaPx,rowIds,label,lastUpdatedPresent` | query transitions on all query-backed routes, D5 |
| `A11Y-01` | axe serious count `0`, critical count `0`; visible controls without accessible name `0`; visible-label substring absent from accessible name count `0` | `bad-a11y-unnamed-button` | `clean-a11y-named-button` | `ruleId,seriousCount,criticalCount,unnamedCount,labelMismatchCount,selector` | ALL |
| `A11Y-02` | Keyboard activates every registered pointer action; keyboard traps `0` outside modal; focus rect visible area `>=99%`; focus contrast `>=3.0`; target width/height each `>=24px` unless fixture records WCAG exception boolean `true` | `bad-a11y-pointer-only-obscured-focus` | `clean-a11y-keyboard-visible-focus` | `ruleId,actionId,keyboardActivated,trap,focusVisiblePercent,focusContrast,targetWidthPx,targetHeightPx,targetException` | all interactive selected states, D5+R2 |
| `A11Y-03` | Open dialog has name length `>=1`, `aria-modal=true`, active element contained after one Tab, background inert boolean `true`, Escape closes when `data-unsaved=false`, and focus returns to exact trigger | `bad-a11y-dialog-no-return` | `clean-a11y-modal-contract` | `ruleId,dialogName,ariaModal,focusContained,backgroundInert,escapeClosed,triggerId,returnFocusId` | all `*-dialog-open`, D5+R2 |
| `RESP-01` | At each viewport document overflow `<=2px`; overlap area between visible sibling task regions `0px²`; required primary action and essential fields visible boolean `true` | `bad-responsive-page-overflow-24px` | `clean-responsive-reflow-zero-overlap` | `ruleId,viewport,documentOverflowPx,overlapAreaPx2,primaryVisible,essentialVisible` | ALL, D5+R2 |
| `RESP-02` | At `320×900@200%-text`, clipped visible text/control count `0`; unavailable registered actions `0`; only declared table viewport may have horizontal overflow | `bad-responsive-zoom-clipped-action` | `clean-responsive-zoom-wrap` | `ruleId,textZoomPercent,clippedCount,unavailableActionCount,overflowOwners` | ALL, R2 zoom identity |
| `RESP-WH-01` | Warehouse primary/rail DOM order exactly `[ipc-split-primary,ipc-split-detail-strip]`; relation at width `1366` is `side-by-side`; at `1365` is `stacked`; overlap `0px²` | `bad-warehouse-breakpoint-reversed` | `clean-warehouse-breakpoint-1366-1365` | `ruleId,viewport,domOrder,relation,overlapAreaPx2` | `/warehouse` ready/mixed-empty at `1366×768`,`1365×900` |
| `WH-01` | Active warehouse count `0` or `>1`: operational mutation-control count `0`, selector count `0`, fail-closed message count `1`; count `1`: selector count `0`, passive scope count `1` | `bad-warehouse-first-row-selector` | `clean-warehouse-zero-one-many` | `ruleId,activeWarehouseCount,mutationControlCount,selectorCount,passiveScopeCount,failClosedMessageCount` | `/warehouse` `zero-active`,`ready`,`multiple-active`, D5+R2 |
| `WH-02` | One-active scope text equals `Kho vận hành: {warehouseName} ({warehouseCode})`; warehouse ID remains byte-equal in query key, mutation payload, row key, and audit fixture; tampered ID response status exactly `403`; guessed-first-row count `0` | `bad-warehouse-tampered-id-accepted` | `clean-warehouse-id-preserved-403` | `ruleId,scopeText,queryWarehouseId,payloadWarehouseId,rowWarehouseId,auditWarehouseId,responseStatus,firstRowInferenceCount` | `/warehouse` `ready`,`tampered-id`, D5+R2 |
| `WH-03` | Routine warehouse-name occurrence count `1`; irreversible confirmation occurrence count `1`; exports/detail/audit identity-preserved boolean `true`; historical rewrite/delete request count `0` | `bad-warehouse-scope-repeated-and-id-dropped` | `clean-warehouse-passive-once-history-kept` | `ruleId,routineScopeOccurrenceCount,confirmationScopeOccurrenceCount,identityPreserved,historicalRewriteRequestCount` | warehouse and purchasing warehouse-sensitive selected states, D5+R2 |
| `ORDER-01` | Required visible region order equals the exact ordinal array declared by the inventory row; inversion count `0`; shell route title and work-object H1 byte equality is `false` | `bad-order-metrics-before-blocker-duplicate-title` | `clean-order-context-blocker-action-table` | `ruleId,expectedRegionOrder,actualRegionOrder,inversionCount,shellTitle,h1Text` | ALL |
| `FILTER-01` | Every filter input has a persistent visible label; active filter count equals rendered removable-chip count; clear/reset control count exactly `1` when active count `>0`, otherwise `0`; result announcement live-region count `1`; focus after apply/clear remains on triggering control | `bad-filter-placeholder-no-reset-focus-loss` | `clean-filter-labeled-reset-announced` | `ruleId,filterId,labelVisible,activeFilterCount,chipCount,clearCount,liveRegionCount,triggerId,focusAfterId` | table/query regions declaring filters, D5+R2 |
| `SORT-01` | Exactly one active sortable header has `aria-sort=ascending|descending`; inactive sortable headers have `aria-sort=none`; rendered default sort key/direction equals region registry and is never a raw primary-key field | `bad-sort-missing-aria-primary-key-default` | `clean-sort-aria-action-needed` | `ruleId,tableId,activeSortCount,ariaSortValues,defaultSortKey,defaultSortDirection,rawPrimaryKeyDefault` | populated registered sortable tables, D5+R2 |
| `COL-01` | Every rendered column ID exists once in the region registry with priority `essential|secondary|detail`; at narrow viewport all essential columns/actions visible, unregistered columns `0`, and hidden secondary/detail columns have one labeled disclosure path | `bad-column-unregistered-hidden-essential` | `clean-column-priority-disclosure` | `ruleId,tableId,columnId,priority,registryCount,essentialVisible,disclosureCount` | populated tables, R2 |
| `BADGE-01` | List-row visible badge/tag count `<=2`; status vocabulary key exists in shared registry; if multiple states exist, rendered status equals the declared highest-priority state | `bad-badge-three-raw-enum` | `clean-badge-highest-priority-two-max` | `ruleId,rowId,badgeCount,statusKey,registryHit,expectedPriorityStatus,renderedStatus` | populated tables/lists, D5+R2 |
| `PAGE-01` | Dataset total `>100` implies server-pagination or virtualization boolean `true`; pagination exposes range, total, page-size control, and direct-page control when page count `>7`; loading a page never fetches all records | `bad-page-101-all-loaded-no-controls` | `clean-page-server-controls` | `ruleId,regionId,totalCount,serverPaged,virtualized,rangePresent,totalPresent,pageSizePresent,directPagePresent,requestedPageSize` | registered collection regions, D5+R2 |
| `MUT-01` | During mutation, duplicate-submit request count `0`, pending label equals registered action-specific string, layout shift `<=0.01`; failure restores pre-mutation row/state IDs exactly, shows one actionable error live region, and focus target equals trigger or invalid field | `bad-mutation-double-submit-no-rollback` | `clean-mutation-pending-rollback-focus` | `ruleId,actionId,requestCount,pendingLabel,clsDelta,beforeIds,afterFailureIds,errorLiveCount,expectedFocusId,actualFocusId` | inventory mutation/dialog states and region-state registry mutation rows, D5+R2 |
| `REFRESH-01` | Auto-refresh request count while hidden/editing/input-focused/selection-active is `0`; resume request count exactly `1`; paused label count `1`; retry delay sequence equals shared bounded-backoff policy and attempt count never exceeds configured maximum | `bad-refresh-hidden-poll-unbounded-retry` | `clean-refresh-paused-single-resume-bounded` | `ruleId,condition,requestCount,resumeRequestCount,pausedLabelCount,retryDelaysMs,maxAttempts` | query-backed regions with refresh policy, D5 |
| `MOTION-01` | Nonzero transition/animation durations are within `150..250ms`; animated properties subset is `{transform,opacity}`; under `prefers-reduced-motion: reduce`, effective duration `<=10ms`; continuous decorative animation count `0` | `bad-motion-height-500ms-infinite` | `clean-motion-transform-200ms-reduced` | `ruleId,selector,durationMs,properties,reducedDurationMs,continuousCount` | ALL interactive states, D5+R2 |
| `PERF-01` | Production-build evidence records CLS `<=0.1`, INP `<=200ms`, LCP `<=2500ms`; absent metric sets verdict `NEEDS_EVIDENCE`, never PASS | `bad-perf-over-budget` | `clean-perf-within-budget` | `ruleId,route,state,viewport,cls,inpMs,lcpMs,evidencePresent,verdict` | each route ready/populated identity, D5; separate `perf-probe` artifact referenced by ui-audit report |

### Table/query-region state registry

This registry is independent of the representative route rows above. Every listed region must emit one exact fixture identity for every applicable state. `N/A(reason)` is an explicit disposition, not an omitted state. Canonical state set is `initial-loading|populated|refreshing|truly-empty|no-results|error-no-data|partial-error-stale|mutation-in-flight|mutation-failure`.

| Route | Exact region IDs | Required states / explicit N/A |
|---|---|---|
| `/` | `dashboard-shift-status`, `dashboard-workflow-exceptions` | all canonical states; mutation states `N/A(read-only regions)` |
| `/weekly-menu` | `weekly-schedule`, `weekly-demand`, `weekly-purchase-summary`, `weekly-cost`, `weekly-dish-materials` | all canonical states; mutation states apply to schedule/import/editor owners |
| `/reports` | `report-demand`, `report-purchase-plan`, `report-current-stock`, `report-movements`, `report-price-variance` | all canonical states; mutation states `N/A(report regions are read-only)` |
| `/meal-orders` | `coordination-orders` | all canonical states; mutation states apply to create/update order actions |
| `/chef-dashboard` | `chef-production`, `chef-material-checklist`, `chef-documents` | all canonical states; mutation states apply to receipt/signoff actions |
| `/approvals` | `approval-queue`, `approval-history`, `approval-purchase-requests` | all canonical states; mutation states apply to decision dialog/queue |
| `/purchasing` | `purchase-workflow`, `purchase-supplemental`, `purchase-quotes` | all canonical states; mutation states apply to supplier/order actions |
| `/warehouse` | `warehouse-current-stock`, `warehouse-purchase-receipts`, `warehouse-issues`, `warehouse-movements` | all canonical states; mutation states apply to receipt/issue/adjustment actions |
| `/admin-data` | `admin-entities`, `admin-imports`, `admin-data-quality`, `admin-cleanup` | all canonical states; mutation states apply to import/cleanup/entity actions |
| `/admin/rules` | `approval-rules` | all canonical states; mutation states apply to rule editor |
| `/admin/advanced-settings` | `advanced-settings-form` | `populated|mutation-in-flight|mutation-failure`; query collection states `N/A(local settings form has no collection query)` |
| `/login` | `login-form` | `populated|mutation-in-flight|mutation-failure`; query collection states `N/A(authentication form has no collection query)` |
| `/403` | `forbidden-panel` | `populated`; all other canonical states `N/A(static denial region)` |

The harness expands `route|regionId|state|actor|viewport|lowest-owner`; missing, duplicate, undeclared, or silently omitted state identities fail `INV-01`. `QUERY-01/02` consume this registry rather than only the representative route-state column. Route fixtures may share deterministic payload builders, but each expanded identity has an independent report row.

### Separate executable gate dispositions

- `PERF-01` executes through the existing production-build `scripts/perf-probe.mjs` path and must be referenced by the corresponding ui-audit identity; it is not inferred from screenshots.
- Source-level spacing/color literals use existing source-aware Vitest/checker paths, while rendered token values remain in `TOK-*`; both artifacts must agree before PASS.
- Warehouse server zero/one/multiple/tampered enforcement remains a later backend relational/API gate. Until implemented, `WH-01/02` are `NEEDS_EVIDENCE`; the UI harness may prove presentation only and cannot claim server enforcement.

### Fresh-review-only classifications

The following cannot be made deterministic without converting taste into a false oracle and therefore can never produce PASS: clarity of work object/next action, exception salience, semantic grouping purpose, visual balance/density, progressive-disclosure usefulness, and qualitative information architecture. They receive only `AI_REVIEW_REQUIRED`, `FAIL`, or `UNRESOLVED` from a fresh reviewer using the schema in **Fresh AI review boundary**. Screenshots, adjectives, pixel similarity, and prior AI conclusions cannot upgrade them to deterministic PASS.

Every machine-decidable rule is represented above; any newly introduced hierarchy, token, container, table, query-state, accessibility, responsive, or warehouse rule must add a row with the same fields before implementation. Do not create a second runner or report path.

## Ownership and implementation waves

1. **Foundation/tokens:** `frontend/src/styles/index.css`, `frontend/src/lib/typography.ts`, existing vocabulary/formatter registries, and source-aware checker rules.
2. **Shared seams:** `frontend/src/app/layout/MainLayout.tsx`, `frontend/src/components/common/OperationalFrame.tsx`, `SectionPanel.tsx`, `TableViewport.tsx`, `PaginatedTableFrame.tsx`, and shared query-state primitives.
3. **Route rollout/verification:** exact lowest route/feature owners from `28-SOURCE-INVENTORY.md`; warehouse presentation remains owned by `frontend/src/features/warehouse/pages/WarehousePage.tsx` unless baseline proves a lower shared seam.

The overlapping CSS imports in `frontend/src/main.tsx` are a measured consolidation risk, not permission to flatten styles globally. Specialized chef Card/Table usage is reviewed as a bounded feature family before any primitive change.

## Registry safety

| Registry | Blocks used | Safety gate |
|---|---|---|
| Existing checked-in local shadcn components | Existing source only | Source is already in repository; review normal diff |
| shadcn official | None added in this phase | Not applicable |
| Third-party registries | None | Prohibited unless separately declared, viewed, scanned, and developer-approved |

## Review findings and residual risks

### Review findings

- **CRITICAL boundary — `frontend/src/shared/api/contracts/schema.ts`:** warehouse IDs/names and `receivingWarehouseId` are API/entity/mutation contracts. Presentation simplification must not remove, infer, merge, or default them.
- **HIGH coverage gap — `frontend/tests/ui-audit.spec.ts` and `frontend/tests/visual-routes.spec.ts`:** current evidence does not yet prove all declared protected routes, states, 320px reflow, and 200% text zoom. The Phase 28 baseline must close this before production edits.
- **MEDIUM presentation risk — `frontend/src/features/warehouse/pages/WarehousePage.tsx`:** a singular warehouse label derived from the first stock row can misstate mixed scope. The contract forbids row-based singleton inference.
- **MEDIUM cascade risk — `frontend/src/main.tsx` and imported stylesheet layers:** overlapping component/redesign layers require selector/computed-style evidence before consolidation; no global flattening by assumption.
- **MEDIUM token mismatch — `frontend/src/styles/index.css` and `frontend/src/lib/typography.ts`:** current roles include extra weights/recipes beyond the Phase 28 finite contract. Treat these as baseline inventory items and remediate only at the lowest shared owner with regression evidence.
- **LOW ownership variance — specialized chef components:** direct low-level Card/Table use may be valid feature ownership; do not force migration without one-purpose/container/table evidence.

### Residual risks

- External canonical standards links and current publisher wording were not live-validated in the upstream research runner; WCAG 2.2 remains normative, while Fiori/Carbon/Atlassian/Polaris pixel patterns remain non-normative references.
- The static source inventory is not an exhaustive AST census of every local JSX container, table, or typography/spacing literal.
- Existing screenshot coverage omits some protected routes/states and is not an implementation oracle.
- Generated API schema proves multi-warehouse contracts, but the backend singleton implementation and live database cardinality were intentionally not inspected for this UI contract.

## Checker sign-off

- [x] Dimension 1 Copywriting: FLAG — non-blocking; `Đăng nhập` retained as established Vietnamese action label
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** VERIFIED — checker run `035296b1-571e-454d-b4ba-b3673f1bbfb8`, 2026-08-23
