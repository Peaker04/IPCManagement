---
review: mvp-web-flow
date: 2026-07-19
scope: dashboard, weekly-menu, meal-orders, approvals, purchasing, warehouse, chef-dashboard
overall_score: 16/24
status: conditional-pass
---

# UI review luồng MVP

Review theo 6 trụ cột GSD, kiểm tra code, component contract và control-surface tests. Taste skill chỉ được dùng cho audit/preservation vì dashboard và data table nằm ngoài phạm vi trực tiếp của skill này.

| Trụ cột | Điểm | Nhận xét |
|---|---:|---|
| Visual hierarchy | 3/4 | Command bar và tab phân tầng rõ; một số page còn quá nhiều primary action cùng cấp |
| Composition | 3/4 | Operational frame nhất quán; file/page lớn làm section khó tách và kiểm thử |
| Consistency | 2/4 | Có Shadcn/Base UI nhưng vẫn xen nhiều button/select CSS cũ; action label trước đây không thống nhất ngữ nghĩa |
| Responsive | 3/4 | Có mobile control tests và table viewport; cần UAT dialog mới ở 320/390px |
| Accessibility | 3/4 | Control có accessible name, dialog có title/description, label gắn với select; cần tiếp tục kiểm tra keyboard E2E |
| Interaction/polish | 2/4 | Loading/error phần lớn có; supplemental request vẫn báo thành công khi mới lưu local state và warehouse tự chọn candidate |

## Findings đã sửa

- `UI-WARN-01`: `DemandSummary` có local pager bên trong ba page đã server-page, gây hai pager và che bớt item trong page. Đã bỏ local pager.
- `UI-WARN-02`: cột `Tiếp theo` chỉ chứa text nên tạo kỳ vọng có thể bấm. Đã đổi thành `Hướng xử lý`.
- `UI-WARN-03`: hàng đợi duyệt hiển thị nhãn next-action cạnh các nút Duyệt/Từ chối thật. Đã ẩn nhãn khi action renderer tồn tại.
- `UI-WARN-04`: Thu mua thiếu control gọi endpoint `from-demand`. Đã thêm dialog Shadcn/Base UI và mutation thật.
- `UI-INFO-01`: hai shortcut command bar trùng với tab/sidebar đã được loại bỏ.

## Findings còn mở

- `UI-WARN-05`: `WarehousePage` tự lấy demand candidate và warehouse đầu tiên. Người dùng không nhìn thấy lựa chọn sẽ được gửi lên API.
- `UI-WARN-06`: `ChefDashboardPage.handleSupplementalRequest` chỉ gọi `setRequests` nhưng copy nói “đã ghi nhận”, dễ hiểu nhầm dữ liệu đã được lưu.
- `UI-INFO-02`: `SwimlaneProgress` không còn caller trong working tree nhưng chưa thể xóa độc lập vì dashboard refactor chưa được commit cùng thay đổi dependency.

## Gate

Conditional pass. Phần vừa sửa đạt build/lint/unit; MVP chỉ đạt full pass sau khi xử lý hai warning còn mở và chạy UAT với backend/database seed thật.
