---
status: conditional-pass
date: 2026-07-19
---

# Summary — MVP web flow gaps

- Reverted riêng ba commit Phase 3 ngoài scope.
- Thêm endpoint material-request candidate có server paging và nối vào Thu mua/Kho.
- Thêm mutation supplemental request lưu `PENDING` và nối dialog Bếp trưởng.
- Tách các component/helper đầu tiên khỏi ba page lớn; debt decomposition sâu hơn được ghi trong code review.
- Không xóa UI có caller chưa được loại bỏ ở baseline commit.
- Migration database thật, backend/frontend tests, build, lint, Swagger JSON và live API integration đều pass.
- Browser click/visual UAT chưa chạy được vì runtime không có browser; phase giữ conditional-pass.
