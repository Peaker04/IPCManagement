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
