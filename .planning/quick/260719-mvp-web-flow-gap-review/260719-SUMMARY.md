---
status: complete
date: 2026-07-19
outcome: superseded
---

# Summary — MVP web flow gaps

- Reverted riêng ba commit Phase 3 ngoài scope.
- Thêm endpoint material-request candidate có server paging và nối vào Thu mua/Kho.
- Thêm mutation supplemental request lưu `PENDING` và nối dialog Bếp trưởng.
- Tách các component/helper đầu tiên khỏi ba page lớn; debt decomposition sâu hơn được ghi trong code review.
- Không xóa UI có caller chưa được loại bỏ ở baseline commit.
- Migration database thật, backend/frontend tests, build, lint, Swagger JSON và live API integration đều pass.
- Browser click/visual UAT chưa chạy được vì runtime không có browser; phase giữ conditional-pass.

## Closeout 2026-08-02

Giữ nguyên verdict lịch sử `conditional-pass`. Task được đóng với outcome `superseded` vì
browser/evidence work tiếp tục ở các phase sau; phần UAT chưa được chứng minh đầy đủ được
carry-forward bằng todo `weekly-menu-browser-uat.md`, không bị đổi thành PASS hồi tố.
