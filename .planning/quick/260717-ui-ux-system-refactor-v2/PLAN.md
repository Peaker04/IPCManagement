---
name: 260717-ui-ux-system-refactor-v2
date: 2026-07-17
status: wave-3-helper-delegate-complete-ownership-gate-open
type: refactor-plan
parent: 260717-ui-ux-system-redesign
---

# UI/UX Refactor v2 — Canonical Surface Synchronization

## 1. Decision

Tạm dừng Wave 4 của plan cũ. Không tiếp tục thêm pagination adapter hoặc chỉnh CSS cục bộ cho từng route cho tới khi có một kiến trúc UI canonical.

Mục tiêu của plan v2 là refactor có kiểm soát: xác định một nguồn sự thật cho layout, table, pagination, trạng thái, copy và responsive behavior; sau đó migrate từng route bằng compatibility layer có thời hạn. UI hiện có phải được tái cấu trúc theo contract mới, không bị ghi đè mù hoặc ghép nhiều pattern song song.

## 2. Design read

Đây là công cụ vận hành B2B cho điều phối, bếp, kho, thu mua và admin; người dùng cần quét nhanh trạng thái và hoàn tất thao tác có hậu quả dữ liệu. Ngôn ngữ thiết kế là operational clarity: nền trắng/slate, một accent IPC blue, density trung bình, motion thấp, trạng thái có chữ, table có boundary rõ và focus dễ nhận biết.

Dials cố định cho v2:

- `DESIGN_VARIANCE`: 3/10 — ưu tiên nhất quán hơn trang trí.
- `MOTION_INTENSITY`: 2/10 — chỉ dùng transition cho focus, open/close và feedback ngắn.
- `VISUAL_DENSITY`: 5/10 — đủ dữ liệu cho vận hành nhưng không dồn card/table thành cockpit.

## 3. Current-state problems to solve

1. Có nhiều lớp table song song: `DataTableShell`, `PaginatedTableFrame`, native table wrapper và local slice/pagination; cùng mục tiêu nhưng khác geometry, copy và state handling.
2. Pagination đang trộn ba contract: local collection page, server cursor page và server page-number; một số route có thể hiển thị pager nhưng payload/query không đổi.
3. Route đã migrate và route chưa migrate không cùng page anatomy, spacing, heading, loading/error/empty geometry.
4. Copy tiếng Việt chưa được quản trị tập trung; một số từ kỹ thuật (`Audit`, `Pending`, `Owner`, `Contract`, `Action`, `Error`, `Warning`) xuất hiện không đồng nhất ngữ cảnh.
5. `AdminDataPage.tsx` và global style đang có dirty worktree lớn; không thể xem chúng là baseline sạch để refactor trực tiếp.
6. `DataTableShell` và `PaginationBar` có blast radius CRITICAL; sửa trực tiếp trước khi có replacement contract sẽ làm tăng rủi ro toàn hệ thống.
7. Playwright UI audit đã pass phần overflow/action ở môi trường hiện tại, nhưng controls/smoke protected-route thất bại do login/API fallback; chưa được xem là bằng chứng visual hoàn chỉnh.

## 4. Scope fences

### In scope

- Canonical page anatomy, table viewport, pagination state, copy/semantic labels, loading/error/empty states, focus and responsive behavior.
- Route migration sau khi canonical primitives được chốt.
- Contract tests, static audit, Playwright controls/smoke/ui-audit/visual.
- Documentation và ownership manifest cho từng migration slice.

### Out of scope until separately approved

- Thay đổi backend API shape, cursor semantics hoặc database schema chỉ để phục vụ UI.
- Đổi icon family, font, brand palette hoặc thêm UI kit thứ hai.
- Refactor business mutation handlers chỉ vì layout.
- Sửa các dirty backend/frontend files không thuộc allowlist.
- Cập nhật visual snapshots khi chưa có root-cause và evidence của thay đổi.

## 5. Execution waves

### Wave 0 — Baseline, ownership and failure reproduction

Status: completed for the current execution slice. GitNexus was refreshed; `RoleInbox` was classified HIGH and excluded from the pilot; `DemandSummary` was classified LOW and selected as the pilot.

Deliverables:

- `BASELINE.md`: inventory route → shell → table → data contract → pagination contract → test coverage.
- `OWNERSHIP.md`: file allowlist, protected files, dirty-file map và commit boundary.
- Reproduce controls/smoke failures with exact cause classification: auth, backend availability, fixture, selector or UI regression.
- GitNexus context/impact report for `MainLayout`, `DataTableShell`, `PaginationBar`, `PaginatedTableFrame`, `usePaginatedRows`, `AdminDataPage` and `ReportsPage`.

Exit criteria:

- Không còn unknown dirty-file ownership cho slice chuẩn bị sửa.
- Mỗi route được gán một data/pagination contract duy nhất.
- Test failures có owner và repro command; không còn dùng “bỏ qua cảnh báo” làm trạng thái.

### Wave 1 — Canonical design tokens and semantic language

Status: initial contract established; full token/copy audit remains.

Deliverables:

- Three-layer tokens: primitive → semantic → component; không hardcode color/spacing mới trong route.
- `uiCopy`/`uiSemantics` contract gồm labels, status, required, reason, pagination, technical identifier và action vocabulary.
- Canonical page anatomy: route header, command/action row, context strip, content region, feedback region.
- State vocabulary: `loading`, `ready`, `empty`, `no-result`, `error`, `mutating`, `stale`.

Exit criteria:

- Token validator/static scan không phát hiện token mới bị hardcode ngoài allowlist.
- Copy map có test cho label/status/pagination và không làm thay đổi API payload.
- Một route pilot và một dialog pilot render đúng anatomy.

### Wave 2 — Canonical table and pagination architecture

Status: route-family pilot slice complete for local/shared consumers that passed risk gates. `TableViewport`, typed `PaginationContract` and `useLocalPagination` now exist; all migrated route tables plus `DocumentRail`, `StockMovementTable` and `RoleInbox` use the canonical controller/viewport. `PaginatedTableFrame` is now a thin adapter over `TableViewport`; `AdminDataPage` remains explicitly gated by dirty ownership before its consumer code is migrated/removed.

Deliverables:

- `TableViewport`: một boundary native table, sticky opaque header, local scroll, stable scrollbar gutter, caption/aria label, mobile behavior.
- `PaginationController`: adapter cho local collection, server page-number và server cursor; API phải biểu đạt rõ loại contract.
- `TableState` slots: loading/error/empty/no-result giữ cùng geometry với bảng thật.
- `TableActionCell`/cell wrapping rule để tránh action wrap và page overflow.
- Deprecation map cho `DataTableShell`, `PaginationBar`, `PaginatedTableFrame`; không xóa ngay, nhưng không cho thêm consumer mới.

Pilot migration note — Coordination `OrderTable`:

- Current pattern: `PaginatedTableFrame` + `usePaginatedRows` + `PaginationBar`.
- Target contract: `TableViewport` + `useLocalPagination` + existing `PaginationBar` compatibility boundary.
- Impact: GitNexus upstream impact LOW before edit; one direct caller (`CoordinationPage`), one affected execution flow.
- Preserved behavior: page size 12, local slicing, page navigation, optimistic quantity/forecast mutations and rollback handling.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass; staged GitNexus detect scope was one file, three symbols, two expected Coordination flows, MEDIUM aggregate risk.
- Rollback: revert commit `0a64f5b` without touching the dirty user-owned worktree.

Pilot migration note — Reports:

- Current pattern: ten local report tables used `PaginatedTableFrame` plus `usePaginatedRows`; cursor movement and audit pagination were separate contracts.
- Target contract: local tables use `TableViewport` plus `useLocalPagination`; cursor movement keeps its existing cursor boundary and `StockMovementTable` remains protected.
- Impact: GitNexus returned two parser candidates for `ReportsPage`, both LOW with no upstream callers; staged detection covered one Reports execution flow at MEDIUM aggregate scope.
- Preserved behavior: all page sizes, local row slicing, pagination callbacks, report query payloads, cursor navigation and export/mutation behavior.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass.
- Rollback: revert commit `c4aaf92` if visual or route-level regression appears.

Pilot migration note — Warehouse inventory:

- Current pattern: `WarehousePage` used `PaginatedTableFrame` and `usePaginatedRows` for the local current-stock collection.
- Target contract: `TableViewport` + `useLocalPagination`, with an accessible table caption and the existing `PaginationBar` compatibility boundary.
- Impact: GitNexus upstream impact LOW before edit; staged detection covered one Warehouse flow at MEDIUM aggregate scope.
- Preserved behavior: query limit 12, local page size 8, empty-state row, pagination callbacks, inventory issue mutation, document rail and cursor stock movement table.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass.
- Rollback: revert commit `7f988a1` if route-level regression appears.

Pilot migration note — Purchasing:

- Current pattern: supplier lines, quotations and purchase orders used `PaginatedTableFrame` plus `usePaginatedRows` in three local component sections.
- Target contract: all four local table surfaces use `TableViewport` plus `useLocalPagination`; cursor-based movement and shared rails stay outside the slice.
- Impact: GitNexus page-level impact was LOW before edit; nested component symbols were not indexed separately; staged detection covered one Purchasing flow at MEDIUM aggregate scope.
- Preserved behavior: supplier/quotation/order page sizes, local row slicing, pagination callbacks, purchase mutations, approval actions and stock-movement cursor behavior.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass.
- Rollback: revert commit `7a8e963` if route-level regression appears.

Exit criteria:

- Unit tests cho page clamp, filter reset, cursor previous/next, disabled state, total count và payload invariants.
- Contract test chứng minh local page không thay đổi request/query payload.
- Pilot route pass lint/build/unit/controls.

### Wave 3 — Route migration by family

Thứ tự bắt buộc:

1. Shell/login/dashboard/work queue.
2. Coordination/weekly menu.
3. Approval/purchasing/warehouse.
4. Chef.
5. Reports.
6. Admin.

Mỗi route phải có một migration note gồm: current pattern, target contract, changed symbols, impact, preserved behavior, test evidence và rollback path.

Exit criteria mỗi family:

- Không còn trộn hai table/pagination pattern trong cùng một page.
- Loading/error/empty/no-result có cùng geometry.
- Technical copy có label giải thích.
- Visual snapshot chỉ cập nhật sau khi controls và overflow pass.

Current Wave 3 evidence:

- Coordination, Reports, Warehouse and Purchasing safe local table consumers now use the canonical local controller and viewport.
- `npm run test:ui-audit --workspace frontend`: 2/2 passed after the migrations.
- Remaining route-family work is not silently skipped: shared `RoleInbox`, `DocumentRail`, `StockMovementTable` are HIGH-impact; `AdminDataPage` is dirty user-owned work. They require a separate impact/ownership gate before editing.
- Shared HIGH migrations completed with compatibility-preserving changes: `DocumentRail` (`2ecb972`), `StockMovementTable` (`a198124`) and `RoleInbox` (`32688c3`). Each changed only local pagination/viewport implementation and retained public props, row actions and mutation boundaries.
- Remaining legacy consumer is `AdminDataPage.tsx`, which has an existing 613-line user-owned dirty diff and must be reconciled separately before its six table instances can migrate.
- Compatibility cleanup: `PaginatedTableFrame` now delegates to `TableViewport` (`fd1af9e`), preserving its public props and legacy class while removing duplicate viewport DOM behavior. GitNexus does not index this symbol, so direct repository inventory plus regression gates are the evidence boundary.
- Semantic copy slice: `uiCopy.reports` now owns report tab, status and technical labels; `ReportsPage` consumes those labels for UI and CSV headers (`dc989ef`). Backend enums, query payloads and exported values remain unchanged.
- Workflow copy slice: `uiCopy.workflow` now owns owner, deadline, action, SLA and document-code labels; `DocumentRail`, `RoleInbox` and `ApprovalQueue` consume the shared vocabulary (`00da341`).
- Pagination contract slice: pure `paginationMeta.ts` now owns local page math; `usePaginatedRows` re-exports it for compatibility, `useLocalPagination` imports it directly, and `PaginationContract` is a discriminated union for local/page-number/cursor (`1200311`).
- Legacy helper convergence: `usePaginatedRows` now delegates to `useLocalPagination` (`a82286f`), so legacy consumers share the canonical local controller without changing their public API or server-query behavior. The dirty `AdminDataPage` consumer remains protected for ownership reconciliation.
- Table semantics slice: `TableViewport` now associates its optional caption with the scroll region via `aria-describedby` (`4d02c59`); `TableViewport.test.tsx` covers both captioned and uncaptioned regions without changing layout classes or table content.
- Pagination bar convergence: `PaginationBar` now consumes canonical pagination metadata and Vietnamese range/action copy (`6f47c33`), preserving the public callback/class contract while clamping invalid page input. Upstream impact was recorded as CRITICAL; staged detection covered exactly 2 symbols with LOW aggregate scope.
- Cursor contract convergence: Reports now consumes shared `CursorPaginationBar` (`fd6def4`), while cursor endpoints retain `hasNext`/cursor-token semantics and never receive local numeric pagination fields. The three pagination modes remain explicit: local, page-number and cursor.
- Weekly-menu local pagination convergence: the purchase-summary footer now consumes shared `PaginationBar` (`2854243`); data aggregation and page-index state remain unchanged, while the route-local range/button markup is removed. Ownership was enforced hunk-by-hunk because the route remains dirty.
- Chef slice: `MaterialChecklist` now uses `TableViewport` with an accessible caption instead of the critical `DataTableShell`; checkbox/signoff behavior remains unchanged (`f8aaae4`).
- Chef BOM slice: `ActiveDishesGrid` now uses `TableViewport` for expanded dish ingredient tables, retaining expand/collapse, row keys and existing data (`c1d62b4`).
- Chef production slice: `ChefDashboardPage` daily production-plan table now uses `TableViewport` with a caption; send-to-kitchen action and row readiness rendering are unchanged (`288ac13`).
- Dashboard slice: `SwimlaneProgress` now uses `TableViewport` and shared semantic workflow copy for lane/status/waiting/blocked/next-action columns (`80b52d8`).
- Weekly-menu slice: the clean production-detail table inside `WeeklyMenuPage` now uses `TableViewport` with an accessible caption (`347253e`). The feature-owned import and production-plan hunks were not staged.
- Weekly-menu slice 2: the weekly production-plan table now uses `TableViewport`, preserving its `560px` geometry through an explicit max-height and adding an accessible caption (`10d1916`).
- Weekly-menu slice 3: pending import jobs and import history now use canonical viewports with explicit captions and preserved `260px` max-height (`6dd531d`, `6787897`).
- Weekly-menu slice 4: the linked cost table and daily ingredient cost table now use canonical viewports while preserving their legacy cost-table class and explicit `560px`/`360px` heights (`e755b56`, `0034875`).
- Weekly-menu slice 5: purchase-summary and tray-cost tables now use the same canonical viewport contract, preserving `560px` geometry and cost-table styling (`9a5c0af`, `85ba461`).
- Weekly-menu slice 6: `ImportedLayoutMatrix` now uses `TableViewport`; `DataTableShell` has no remaining consumer in `WeeklyMenuPage` (`d420da6`). The legacy class and dynamic max-height remain intact.
- Imported-layout A/B evidence: canonical vs legacy changed the weekly-menu visual diff from `33280` to `33316` desktop pixels and `64371` to `64740` mobile pixels. This is an explained canonical viewport geometry change; snapshots remain frozen until the dirty route feature work is reconciled.
- Admin slice: the clean statistics table between dirty BOM/contract hunks now uses `TableViewport` with an accessible caption (`d105f55`). BOM tables and legacy pagination consumers remain untouched.
- Admin statistics A/B evidence: canonical and legacy wrappers produced identical visual results (`40384` desktop pixels; `390×2080`, `109378` mobile pixels). The current admin visual failure is therefore attributable to the pre-existing dirty route feature diff, not this isolated migration.
- Admin contracts slice: the contract listing table now uses `TableViewport` with a semantic caption (`ae91b02`); adjacent dirty contract-form hunks were not staged.
- Current legacy inventory: `WeeklyMenuPage` has zero legacy shell references. `AdminDataPage` retains `DataTableShell` only for the user-owned BOM-current table; all remaining `PaginatedTableFrame` surfaces are already canonical-backed adapters and remain until pagination ownership is reconciled.
- Weekly-menu visual evidence: legacy wrapper and canonical wrapper produced the same baseline mismatch (`33280` desktop pixels; mobile `390×1997` vs baseline `390×1958`). The mismatch is therefore pre-existing to this isolated wrapper migration and remains tracked as an ownership/baseline blocker; no snapshot was changed.

Critical shell gate result — `DataTableShell`:

- GitNexus upstream impact: CRITICAL; 16 impacted symbols, 10 direct callers and 12 affected execution flows.
- A compatibility bridge to `TableViewport` was prototyped with the public props and `ipc-table-shell` class preserved. Unit `62/62`, lint, build and UI audit `2/2` passed.
- Visual verification remained `8/20` passed and `12/20` failed, including route-height and mobile geometry drift. The bridge was reverted and no snapshots were updated.
- Decision: keep `DataTableShell` protected. The next plan slice must first create a route-scoped visual fixture/geometry contract, then migrate one legacy consumer at a time; deletion or direct global replacement is prohibited.
- Contract tests: `DataTableShell.test.tsx` locks the public accessible-name, region, tabindex and legacy-class contract without changing runtime geometry (`a3a2c2c`); `usePaginatedRows.test.ts` locks the legacy API plus canonical local contract (`421c904`). Full unit suite is now 65/65.
- Direct inventory boundary: GitNexus does not index `usePaginatedRows`; its impact/detect scope is therefore recorded as `UNKNOWN`/`No changes detected`, with source diff, compatibility API review and full frontend gates used as the verification evidence.
- Ownership manifest: `OWNERSHIP.md` defines the dirty route boundaries and the exact reconciliation gate required before touching `WeeklyMenuPage` or `AdminDataPage`.

### Wave 4 — Accessibility and visual verification

Chỉ bắt đầu lại sau khi Wave 0–3 đạt exit criteria.

- Viewports: 1365×900, 1280×900, 768×1024, 390×844.
- Keyboard tab order, focus visible, dialog naming, table region naming, aria-current/selected, reduced motion.
- Body overflow, nested scroll, sticky header, action reachability, long-cell wrapping.
- Playwright controls, route smoke, ui-audit, visual routes; nếu auth/backend fail thì phân loại và sửa root cause trước khi rerun.

Wave 4 is intentionally paused. Its gates cannot be used to authorize more visual changes while the critical shell and dirty ownership boundaries remain unresolved.

### Next execution slice — Refactor legacy shell safely

1. Freeze the current visual baseline and separate failures caused by the dirty dashboard snapshots, the dirty `WeeklyMenuPage`/`AdminDataPage`, and the uncommitted shell prototype.
2. Add a small contract test for `DataTableShell` public props, region semantics and legacy class preservation; do not change geometry in this step.
3. Select one clean, low-impact legacy consumer and migrate its caller to `TableViewport`; do not make `DataTableShell` delegate globally.
4. Run the complete gate set for that consumer. A visual failure must produce an actual-vs-baseline diff and root-cause note; snapshot updates are forbidden until the diff is explained.
5. Re-run GitNexus impact for every edited symbol. If the shared shell remains CRITICAL, keep it as a compatibility boundary and move the migration to callers.
6. Reconcile ownership for `WeeklyMenuPage` and `AdminDataPage` before touching either file. Their existing user changes are not implementation debt that can be overwritten.
7. Only after all consumers are migrated, remove `DataTableShell`/legacy CSS in a separate cleanup commit with a full visual and accessibility gate.

### Wave 5 — Cleanup and release gate

- Migrate/remove deprecated consumers.
- Remove duplicate CSS and route-local pagination copies.
- Run `git diff --check`, token validation, ownership check, unit/lint/build, backend compatibility checks and GitNexus `detect_changes --scope all`.
- Produce `UI-REVIEW.md`, `VERIFICATION.md` and final migration matrix.

## 6. Per-task implementation template

Mỗi plan nhỏ phải chứa:

1. Objective and user-visible outcome.
2. Files allowed to change.
3. Symbols to edit and GitNexus upstream impact.
4. Existing behavior to preserve.
5. Risk classification and mitigation.
6. Exact implementation steps.
7. Tests and commands.
8. Rollback/undo condition.
9. Commit boundary.

Không bắt đầu task nếu chưa có mục 2–5.

## 7. Verification matrix

| Gate | Command/evidence | Required |
|---|---|---|
| Type safety | `npm run build --workspace frontend` | pass |
| Lint | `npm run lint --workspace frontend` | pass |
| Unit | `npm run test:unit --workspace frontend` | pass |
| Controls | `npm run test:controls --workspace frontend` | pass or classified blocker |
| Smoke | `npm run test:smoke --workspace frontend` | pass or classified blocker |
| UI audit | `npm run test:ui-audit --workspace frontend` | pass |
| Visual | `npm run test:visual --workspace frontend` | pass or intentional snapshot diff |
| Static | `git diff --check`, token/ownership scan | pass |
| Dependency | GitNexus impact + detect_changes | expected scope |

## 8. Stop conditions

Dừng task và quay lại plan nếu:

- impact là HIGH/CRITICAL mà chưa có mitigation được ghi rõ.
- một file dirty ngoài allowlist cần sửa để tiếp tục.
- test fail không phân loại được sau một lần reproduction.
- pagination UI không chứng minh được contract với request/query.
- visual fix làm thay đổi business behavior hoặc API payload.

## 9. Definition of done

Plan v2 chỉ hoàn tất khi:

- Một canonical table/pagination contract được áp dụng nhất quán toàn route.
- Không còn duplicate table viewport/pagination implementation ngoài compatibility allowlist.
- Các route operational không kéo dài page vì table hoặc nested scroll.
- Copy, status, required/reason và technical identifiers nhất quán.
- Visual/accessibility/regression evidence pass ở đủ viewport hoặc blocker được ghi rõ và được chấp thuận.
- Dirty worktree của user không bị commit hoặc mất dữ liệu.
