<!--
Dán nguyên khối dưới đây vào AGENTS.md ở THƯ MỤC GỐC của repo.
Codex đọc file này mỗi phiên làm việc.
Giữ nguyên giọng điệu mệnh lệnh — đây là ràng buộc, không phải gợi ý.
-->

## UI/UX — Đo trước khi sửa

Bộ quy tắc đầy đủ: `docs/UI-RULES.md`. Checklist kiểm chứng: `docs/assertion-checklist.md`.

### Cấm tuyệt đối

- **KHÔNG được kết luận UI đúng hay sai từ ảnh chụp màn hình.** Ảnh chỉ cho biết cái gì đang hiển thị, không cho biết cái gì đang sai. Nếu bằng chứng duy nhất là ảnh, verdict bắt buộc phải là `UNVERIFIABLE`.
- **KHÔNG được suy diễn "phần tử này hiển thị ở đây nghĩa là đúng".** Vị trí hiện tại không phải bằng chứng về tính đúng đắn. Chỉ số đo so với quy tắc mới là bằng chứng.
- **KHÔNG được báo "đã sửa" khi chưa chạy lại script đo.** Báo cáo không kèm số đo sau khi sửa bị coi là chưa hoàn thành.
- **KHÔNG được sửa riêng lẻ từng ô, từng dòng, từng trang.** Xem mục "Sửa ở đâu" bên dưới.

### Bắt buộc

1. **Trước khi sửa bất kỳ lỗi layout hay tràn chữ nào**, chạy:

   ```bash
   npm run audit:overflow
   ```

   Đọc `artifacts/overflow-report.json`. Chỉ sửa những gì có trong file đó.

2. **Seed dữ liệu xấu nhất trước khi đo.** Dữ liệu đẹp không làm lỗi xuất hiện. Thêm `?mock=long` vào URL, hoặc đặt biến môi trường `VITE_MOCK_PROFILE=long`. Xem `src/mocks/worstCase.ts`.

3. **Mọi phát biểu về UI phải có dạng:**

   ```json
   {
     "rule": "S1",
     "verdict": "FAIL",
     "measured": "scrollWidth=214 clientWidth=152 (tràn 62px)",
     "selector": "td.cell-status > span.badge"
   }
   ```

   Trường `verdict` chỉ được nhận một trong ba giá trị: `PASS`, `FAIL`, `UNVERIFIABLE`. Cấm trả lời định tính kiểu "trông ổn", "có vẻ hơi chật", "đã đẹp hơn".

4. **Sau khi sửa, chạy lại `npm run audit:overflow` và dán số đo mới vào báo cáo.** Số phát hiện phải về 0, hoặc phải giải thích được từng mục còn lại.

5. **Chạy `npm run test:visual`** để xác nhận không làm vỡ chỗ khác.

### Sửa ở đâu

Sửa theo thứ tự ưu tiên này, dừng lại ở cấp cao nhất giải quyết được vấn đề:

1. **Design token** — `src/design/tokens.*`. Ví dụ `--badge-min-width`, `--row-height`.
2. **Component dùng chung** — ví dụ `<StatusBadge>`, `<DataTable>`, `<Modal>`.
3. **Layout của trang** — chỉ khi lỗi thật sự cục bộ ở trang đó.
4. **CSS của một phần tử đơn lẻ** — chỉ khi ba cách trên đều không hợp lý, và phải ghi rõ lý do trong pull request.

Sửa ở cấp 4 trong khi lẽ ra phải sửa ở cấp 1 là lỗi. Nó vá một chỗ và để lại lỗi y hệt ở hai mươi chỗ khác.

### Thứ tự ưu tiên khi các quy tắc mâu thuẫn nhau

An toàn dữ liệu > Accessibility > Ổn định layout > Hiệu năng > Nhất quán thị giác > Thẩm mỹ

### Công cụ

- Đo đạc và CI: Playwright (`scripts/overflow-audit.mjs`, `tests/visual/`).
- Chẩn đoán CLS và hiệu năng modal: Chrome DevTools MCP, chỉ bật khi cần, không để mặc định.
- Ảnh chụp màn hình: chỉ dùng cho NGƯỜI xem, không dùng làm bằng chứng cho agent.
