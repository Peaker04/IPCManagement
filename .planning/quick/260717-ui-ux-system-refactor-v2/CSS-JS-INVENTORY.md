# CSS/JavaScript Debt Inventory — Task 4.5.1

Ngày kiểm tra: 2026-07-18

## Kết quả feedback JavaScript

- `window.alert`, `window.confirm`, `window.prompt`: không còn kết quả trong `frontend/src`.
- `console.log`, `console.warn`, `console.error` dùng cho feedback người dùng: không còn kết quả trong `frontend/src`.
- `setTimeout` còn lại ở hai nơi có trách nhiệm rõ:
  - `SessionTimeoutModal`: đếm ngược trước khi phiên hết hạn.
  - `ToastProvider`: tự đóng toast theo thời lượng của surface.
- Không thay hai timer này bằng CSS hoặc xóa bỏ vì sẽ làm mất hành vi phiên/toast. Cả hai phải giữ cleanup khi unmount.

## Kết quả CSS

- `ui-redesign.css` hiện có 22 selector cấp component được inventory.
- Chưa có selector mới đủ bằng chứng `zero source reference` để xóa trong lượt này.
- `styles/index.css` vẫn là stylesheet dirty có ownership trộn với feature work; không dùng làm vùng cleanup toàn cục.
- Các selector đã xóa trước đó chỉ là rule isolated đã được kiểm tra source reference và có commit riêng.

## Visual evidence

- Visual suite hiện tại: 6/20 pass, 14/20 fail.
- Các failure gồm hai nhóm:
  - Baseline/data/copy drift: Reports, Purchasing và các route có dữ liệu fixture khác snapshot cũ.
  - Height/content drift do route dirty hoặc nội dung được giữ lại: Weekly Menu, Admin Data, Chef và một số mobile route.
- Không update snapshot trong audit này. Mỗi snapshot chỉ được cập nhật sau khi có actual-vs-baseline note và ownership reconciliation.

## Quyết định tiếp theo

1. Giữ nguyên hai timer hợp lệ và feedback React đã chuẩn hóa.
2. Không xóa thêm CSS trong `index.css` hoặc sửa shared shell chỉ dựa trên snapshot mismatch.
3. Chọn từng route sạch có lỗi hình học thật, chạy GitNexus impact trước khi sửa, thêm control/overflow assertion và commit độc lập.
4. Handoff `WeeklyMenuPage`, `AdminDataPage`, `DashboardPage` và `index.css` trước khi sửa layout hoặc cập nhật snapshot của chúng.

## Empty-state follow-up

- Source inventory xác nhận `EmptyState` có 3 consumer route thực tế: Chef, Coordination và route table điều phối.
- Chef và Coordination đã có override route-local để không giữ khoảng trống desktop trên empty state; không cần đổi `EmptyState` global.
- `index.css` vẫn giữ rule compatibility `min-height: 220px` vì stylesheet đang dirty và là boundary ownership; không xóa rule chỉ vì đã có hai override.
- Warehouse empty document rail là surface riêng (`DocumentRail`), không dùng `EmptyState`; không trộn hai contract để ép cùng một chiều cao.

## Route evidence follow-up

- Approvals mobile tái hiện ở `390px`: không có horizontal overflow, action Duyệt/Từ chối/Kiểm tra kho/Sang thu mua vẫn nhìn thấy và modal contract không bị ảnh hưởng.
- Snapshot cũ ngắn hơn 39px (`1401px` expected, `1440px` actual) trong khi nội dung fixture hiện tại có thêm vùng chứng từ; đây là baseline/data drift, chưa phải bằng chứng để sửa CSS hoặc update snapshot.

- Coordination mobile re-audit found a real layout defect separate from snapshot drift: the generic `.ipc-empty-state` reserved 220px inside the locked-shift panel, leaving a visible gap before the action toolbar. A route-scoped `.ipc-coordination-empty-state` override reduced the actual page height from 1652px to 1596px at 390px while preserving the lock banner and actions. Control, smoke and UI-audit gates remain green; the 1613px snapshot was intentionally not updated.
- Approval mobile re-audit found no actionable geometry defect: the action grid, queue card, cursor controls and document region are reachable without horizontal overflow. The 1518px actual versus 1401px snapshot is content/fixture drift from the additional approval/document surface, not evidence for CSS deletion or compensating fixed heights.
- Weekly Menu mobile re-audit found a real table geometry defect: the customer-layout matrix had seven day columns but no effective table minimum width, producing vertically wrapped headers at 390px. A scoped 980px minimum now leaves horizontal scrolling to `TableViewport`; actual height dropped from 2011px to 1809px and the control assertion proves document width remains bounded.
- Admin Data command-surface audit removed one inactive no-handler button and translated `Preview`/`Commit` into `Kiểm tra file`/`Nhập dữ liệu`. The change is presentation-only; the dirty import/BOM feature code, API values and handlers remain untouched. The control assertion covers semantic labels and mobile document width.
- Reports audit confirmed the remaining long-lived report request is bounded at `limit: 20`; page/cursor endpoints still use their explicit page contracts. The inventory KPI now uses server `totalCount`, and raw `issue`/`SLA gấp` copy is replaced with user-facing Vietnamese labels. Smoke evidence caught and prevented an unbounded/contract-breaking removal of `limit`.
- UI audit coverage now runs the protected-route matrix at both `1365×900` and `390×844`; desktop and mobile suites pass `4/4`. This strengthens the evidence for retaining responsive rules and avoids deleting CSS based only on desktop geometry.
- Reports token cleanup replaced five repeated neutral `#475569` icon literals with the existing `--ipc-slate-600` semantic token. The warning icon remains on `--ipc-danger`; no route layout or behavior changed. Evidence: `73ea59b`, lint/build, Reports controls `2/2`, UI audit `4/4`.
- Coordination `OrderTable` token cleanup replaced the repeated zebra-row `#f8fafc` literal with `--ipc-slate-50`; hover and status layers remain route-owned. Evidence: `0bf1bda`, targeted control `1/1`, lint, UI audit `4/4`.
- Fresh selector reference scan for `ui-redesign.css` found all 25 `ipc-*` selectors referenced by at least two source files (`tsx`/`ts`/`css`). No rule meets the zero-reference deletion threshold; responsive, shell, table and action rules are retained. Dirty `index.css` remains excluded from destructive cleanup.
- Weekly Menu token cleanup replaced six neutral `#475569` icon literals with `--ipc-slate-600`; import/BOM/production-plan logic remains outside the staged scope. Evidence: `e998feb`, targeted controls `2/2`, lint/build.
- Semantic copy audit replaced standalone `SLA` labels with explanatory Vietnamese labels in Approval Rules and Reports. Technical status/CSV values remain unchanged; focused controls verify the rendered Approval Rules label. Evidence: `ea71fb6`, controls `3/3`, lint/build.
- Shared approval queue deadline badges now render `Thời hạn xử lý` while retaining the same computed overdue/countdown values. Evidence: `5b8457b`, focused unit `8/8`, lint/build.
- `DocumentRail` no longer uses a generic `div` for owner `dt/dd` metadata; the wrapper is now a semantic `dl` without changing its existing CSS contract or feedback behavior. Evidence: `d5e8db1`, unit `87/87`, controls `19/19`, smoke `15/15`, UI audit `4/4`, lint/build.
- Removed one duplicate `--ipc-shell-width` declaration from `ui-redesign.css`; the canonical definition remains in `index.css`, which `main.tsx` imports first. No layout selector or dirty global CSS was changed. Evidence: `deaa5cf`, token scan, build/lint/UI audit `4/4`.
