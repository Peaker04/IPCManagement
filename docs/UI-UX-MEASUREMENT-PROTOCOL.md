# UI/UX measurement protocol

[`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md) và [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) là contract
nguyên tắc đã áp dụng; `docs/ui-audit-kit/` là nguồn tham khảo đã được chuẩn hóa vào IPCManagement. Từ nay agent không kết luận
UI đúng/sai bằng cách đọc screenshot. Kết luận phải xuất phát từ test, DOM metrics, API evidence, focus
state hoặc performance record có thể lặp lại.

Quy trình đầy đủ từ phân loại task, sửa đúng owner, browser evidence đến handoff session nằm ở
[`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md). File này chỉ giữ oracle/gate đo lường,
không trở thành một workflow cạnh tranh.

## Cleanup quy trình cũ

- Không chạy trực tiếp script, URL, mock profile, viewport hoặc Playwright config mẫu trong
  `docs/ui-audit-kit/`; chúng là material tham khảo, không phải cấu hình IPCManagement.
- Không dùng `test:ui-audit` như một gate khác: nó là compatibility alias của `test:ui-measurements`.
- `test:visual` và screenshot headed vẫn giữ để reviewer đánh giá thay đổi có chủ đích và lưu E2E evidence;
  chúng không được dùng làm oracle hoặc được cập nhật chỉ để làm test xanh.
- Các ảnh và báo cáo lịch sử dưới `docs/` hoặc `.artifacts/` được giữ làm evidence lịch sử, không rewrite
  hay xóa khi dọn quy trình.

## Gate chuẩn

Chạy từ `frontend/`:

```bash
npm run test:ui-measurements
```

Gate dùng fixture read-only và route thật từ `src/lib/routeConfig.ts`; không dùng hard-code generic
`/dashboard`, `/orders`, `?mock=long` hay port của kit. Nó đo toàn bộ protected route IPCManagement ở đúng
năm desktop viewport hiện hành: `1920x1080`, `1440x900`, `1366x768`, `1365x900`, `1280x900`.

Mỗi test ghi `test-results/ui-audit-*.json` với schema:

```json
{
  "schemaVersion": 1,
  "verdict": "PASS | FAIL",
  "issueCount": 0,
  "issues": [{ "rule": "C1", "route": "dashboard", "viewport": "1365x900", "selector": "document", "reason": "PAGE_H_SCROLL" }]
}
```

Các finding hiện có oracle máy kiểm tra được gồm: overflow toàn trang (C1), control bị clip/wrap hoặc
word-break không an toàn (C4), dialog thiếu accessible name (A1), và seam tab (C2). Route có table sử dụng
vùng scroll cục bộ hợp lệ không bị coi là overflow toàn trang.

## Quy trình xử lý lỗi

1. Chạy gate và đọc JSON report; không gửi ảnh cho agent để tìm lỗi.
2. Phân loại từng rule thành `PASS`, `FAIL`, `NOT_APPLICABLE` hoặc `NEEDS_EVIDENCE`. Ảnh đơn lẻ luôn là
   `NEEDS_EVIDENCE`.
3. Sửa ở shared token/component trước; chỉ sửa page-local khi report chứng minh phạm vi cục bộ.
4. Chạy lại đúng gate, đọc số đo mới và thêm regression test tại seam gây lỗi.
5. Khi thay đổi có mutation hay dữ liệu nghiệp vụ, browser evidence vẫn phải nối FE control → API → DB →
   rendered reload theo `MEMORY.md`; measurement fixture không thay thế E2E đó.
6. Khi cần trace nguyên nhân của CLS, INP, long task, modal timing hoặc network/console live, dùng Chrome
   DevTools MCP theo đúng runtime/credential policy. Đây là công cụ chẩn đoán on-demand; không thay
   Playwright JSON gate và không tự bật trong mọi run. Nếu phải chụp, cấu hình MCP dùng WebP để giảm
   payload; vẫn phải đọc metric/trace thay vì phán quyết từ ảnh.

Visual snapshot vẫn được giữ cho reviewer phát hiện regression có chủ đích. Nó không là proof độc lập cho
agent và không được update chỉ để biến một gate thành xanh.

## Ánh xạ kit vào IPCManagement

| Kit | IPCManagement chuẩn hóa |
| --- | --- |
| `scripts/overflow-audit.mjs` | `frontend/tests/ui-audit.spec.ts`: fixture-aware DOM measurement + JSON report |
| Mock `dashboard/orders` | `ROUTES` canon và read-only API fixture của ứng dụng |
| Width generic | Năm viewport desktop khai trong `MEMORY.md` |
| Screenshot/pixel diff | Reviewer-only regression artifact, không dùng làm oracle agent |
