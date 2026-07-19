---
review: mvp-web-flow
date: 2026-07-19
scope: dashboard, weekly-menu, meal-orders, approvals, purchasing, warehouse, chef-dashboard
overall_score: 19/24
status: conditional-pass
---

# UI review luồng MVP

Review theo 6 trụ cột GSD, kiểm tra code, component contract và control-surface tests. Taste skill chỉ được dùng cho audit/preservation vì dashboard và data table nằm ngoài phạm vi trực tiếp của skill này.

| Trụ cột | Điểm | Nhận xét |
|---|---:|---|
| Visual hierarchy | 3/4 | Command bar và tab phân tầng rõ; một số page còn quá nhiều primary action cùng cấp |
| Composition | 3/4 | Operational frame nhất quán; file/page lớn làm section khó tách và kiểm thử |
| Consistency | 3/4 | Action label đã thống nhất; dialog nghiệp vụ mới dùng primitive Shadcn/Base UI chung |
| Responsive | 3/4 | Có mobile control tests, table viewport và smoke dialog kho ở tablet/mobile |
| Accessibility | 3/4 | Control có accessible name, dialog có title/description, label gắn với select; cần tiếp tục kiểm tra keyboard E2E |
| Interaction/polish | 4/4 | Kho bắt buộc chọn chứng từ/kho; local-only supplemental UI đã gỡ; select portal trong dialog đã sửa z-index |

## Findings đã sửa

- `UI-WARN-01`: `DemandSummary` có local pager bên trong ba page đã server-page, gây hai pager và che bớt item trong page. Đã bỏ local pager.
- `UI-WARN-02`: cột `Tiếp theo` chỉ chứa text nên tạo kỳ vọng có thể bấm. Đã đổi thành `Hướng xử lý`.
- `UI-WARN-03`: hàng đợi duyệt hiển thị nhãn next-action cạnh các nút Duyệt/Từ chối thật. Đã ẩn nhãn khi action renderer tồn tại.
- `UI-WARN-04`: Thu mua thiếu control gọi endpoint `from-demand`. Đã thêm dialog Shadcn/Base UI và mutation thật.
- `UI-INFO-01`: hai shortcut command bar trùng với tab/sidebar đã được loại bỏ.
- `UI-WARN-05`: `WarehousePage` không còn tự lấy demand/kho đầu tiên; dialog bắt buộc chọn hai giá trị trước khi submit.
- `UI-WARN-06`: đã gỡ state, prop, dialog, test và copy yêu cầu bổ sung local-only.
- `UI-WARN-07`: popup Select trước đây nằm dưới Dialog overlay; primitive chung đã được nâng layer và smoke test click thật đã pass.

## Findings còn mở

- `UI-INFO-02`: `SwimlaneProgress` không còn caller trong working tree nhưng chưa thể xóa độc lập vì dashboard refactor chưa được commit cùng thay đổi dependency.

## Gate

Conditional pass. Không còn warning UI chặn thao tác trong scope review; build/lint/unit/control/UI-audit/smoke đều pass. Cần UAT với backend/database seed thật để chuyển sang full pass.
