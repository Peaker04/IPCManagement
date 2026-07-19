---
review: mvp-web-flow
date: 2026-07-19
scope: weekly-menu, purchasing, warehouse, chef-dashboard
overall_score: 20/24
status: conditional-pass
---

# UI review luồng MVP — lần chạy lại

| Trụ cột | Điểm | Bằng chứng |
|---|---:|---|
| Copywriting | 4/4 | Cột mô tả dùng `Hướng xử lý`; button dùng động từ nghiệp vụ; dialog supplemental nói rõ chưa tự xuất kho. |
| Visuals | 3/4 | Shadcn dialog/select/button và operational frame nhất quán; page Weekly Menu vẫn quá dày. |
| Color | 3/4 | Warning/danger/success theo semantic token hiện có, không thêm palette riêng. |
| Typography | 3/4 | Label, mô tả và trạng thái có hierarchy ổn định; một số bảng lớn vẫn dày thông tin. |
| Spacing | 3/4 | Dialog và command bar theo spacing chung; cần visual UAT desktop/mobile để xác nhận phần matrix dài. |
| Experience design | 4/4 | Không còn auto-select chứng từ/kho, không còn pager kép, success chỉ xuất hiện sau API thật. |

## Findings đã đóng

- Dialog Thu mua và Kho lấy candidate bằng server paging, đổi page sẽ xóa selection cũ để tránh submit nhầm.
- `Yêu cầu cấp bổ sung` là control thật, có loading, validation, error feedback và chỉ đóng dialog khi mutation persist thành công.
- Trường bắt buộc có dấu `*`, label và accessible name; copy tránh thuật ngữ code thô.
- `ImportedLayoutMatrix` và `SupplierLineItem` đã tách khỏi page container mà không đổi surface người dùng.
- Swagger runtime blocker được xử lý, giúp tài liệu API và UAT contract hoạt động trở lại.

## Finding còn mở

- `UI-INFO-01`: chưa có browser session để kiểm tra keyboard/focus, responsive và screenshot thực tế. Cần chạy lại visual UAT khi in-app browser hoặc Chrome được kết nối.
- `UI-INFO-02`: tiếp tục decomposition Weekly Menu để giảm tải nhận thức khi bảo trì; đây là cấu trúc code, không phải blocker thao tác hiện tại.

## Gate

`20/24 — conditional-pass`. Không còn warning UI chức năng trong scope. Chưa nâng lên full pass cho tới khi click UAT trên browser thật hoàn tất.
