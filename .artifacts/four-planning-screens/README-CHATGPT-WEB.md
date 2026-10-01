# ChatGPT Web evidence pack — 2026-10-01

Bộ này là tập con có chọn lọc từ `.artifacts/` để đọc cùng
[FE-CONTRACT-KIT-NORMALIZATION.md](../../../.planning/notes/FE-CONTRACT-KIT-NORMALIZATION.md).
Nó không phải toàn bộ raw artifact và không thay thế `docs/EVIDENCE-INDEX.md`.

## Nên đọc theo thứ tự

1. `independent-acceptance-1790859648025/review.md` — kết luận independent review và giới hạn acceptance.
2. `browser-1790858058193/report.json` — kết quả browser cuối cho bốn read-oriented planning screens.
3. `interactions-1790857974007/report.json` — các interaction/state bổ sung.
4. `p1-checks/prior-receipt.md` và `p1-checks/fixed-owner.txt` — finding P1, root owner và cách sửa.
5. `p1-browser-1790859307321/report.json` — browser evidence cho ba invalid-tier states sau sửa.
6. `final-checks/image-review.json` — inventory ảnh cuối đã review.

Các file PNG cạnh mỗi report là ảnh được report/reviewer tham chiếu. Tổng cộng 19 ảnh distinct:
11 ảnh browser chính, 5 ảnh interaction và 3 ảnh invalid-tier follow-up.

## File kiểm tra P1 giữ lại

- `commands.json`: các command kiểm tra đã chạy.
- `ownership.json`: phạm vi và owner của thay đổi.
- `red.log`, `red-valid.log`, `green.log`: red/green receipts tối thiểu.
- `p1-step.diff`: diff riêng của bước sửa P1.

## Cố ý không publish

- Browser/Chrome profiles và runtime scratch.
- `preview-build/`, bundled JS/CSS/font và output có thể tái tạo.
- Các lần chạy raw/superseded hoặc duplicate screenshots.
- Backup `.before`, full build logs và artifact của campaign cũ trong cùng ngày.
- Credentials, cookies, authorization headers hoặc database dumps.

## Giới hạn kết luận

Evidence này chỉ hỗ trợ `PASS_SCOPED_FOUR_DEFAULT_READ_CANDIDATES` và P1 invalid-tier follow-up.
Nó không chứng minh `PAGE_READY`, production cutover, durable/business writes, full actor enforcement,
full CSV quantity/content oracle, native zoom hoặc production performance.
