# UI Audit Kit

> Trạng thái trong IPCManagement: **reference-only**. Không chạy trực tiếp URL, mock profile, viewport,
> Playwright config hoặc package scripts mẫu trong thư mục này. Quy trình chạy thật nằm tại
> [`../UI-UX-MEASUREMENT-PROTOCOL.md`](../UI-UX-MEASUREMENT-PROTOCOL.md).

Bộ công cụ biến việc đánh giá UI từ **nhìn ảnh rồi đoán** thành **đo rồi kết luận**.

## Vấn đề nó giải quyết

Khi bạn đưa ảnh chụp màn hình cho agent và bảo "tìm lỗi UI", agent thường trả lời rằng mọi thứ ổn. Lý do không phải nó lười, mà vì **ảnh chỉ nói được cái gì đang hiển thị, không nói được cái gì đáng lẽ phải hiển thị**. Thiếu chuẩn để so sánh thì không có gì để kết luận là sai, nên mặc định hợp lý nhất là coi hiện trạng đúng.

Riêng lỗi tràn chữ còn khó hơn: cắt chữ có chủ đích bằng `text-overflow: ellipsis` và cắt chữ do lỗi **nhìn giống hệt nhau** trên ảnh. Không một mô hình nào phân biệt được bằng thị giác.

Bộ kit này cấp cho agent thứ nó đang thiếu: **số đo và chuẩn đúng sai**.

## Nội dung

| File | Đưa vào repo tại | Vai trò |
| --- | --- | --- |
| `scripts/overflow-audit.mjs` | `scripts/` | Đo tràn chữ, cắt chữ, cuộn ngang. Thoát mã 1 khi có lỗi |
| `docs/assertion-checklist.md` | `docs/` | Checklist buộc agent trả lời PASS / FAIL / UNVERIFIABLE |
| `AGENTS-block.md` | dán vào `AGENTS.md` gốc | Luật: cấm kết luận từ ảnh, bắt đo trước khi sửa |
| `src/mocks/worstCase.ts` | `frontend/src/mocks/` | Dữ liệu xấu nhất để ép lỗi lộ ra |
| `tests/visual/dashboard.visual.spec.ts` | `frontend/tests/visual/` | Pixel diff và ba phép kiểm modal |
| `playwright.config.ts` | gốc `frontend/` | Cấu hình baseline ảnh |

## Cài đặt

```bash
# 1. Chép file vào repo theo bảng trên

# 2. Cài Playwright nếu chưa có
cd frontend
npm i -D @playwright/test playwright
npx playwright install chromium

# 3. Dán nội dung AGENTS-block.md vào cuối AGENTS.md ở thư mục gốc

# 4. Chuyển dashboard-ui-rules.md thành docs/UI-RULES.md
```

Thêm vào `frontend/package.json`:

```json
{
  "scripts": {
    "audit:overflow": "node scripts/overflow-audit.mjs http://localhost:5173/dashboard?mock=long http://localhost:5173/orders?mock=long",
    "test:visual": "playwright test",
    "test:visual:update": "playwright test --update-snapshots",
    "verify": "npm run lint:fe && npm run test && npm run audit:overflow && npm run test:visual"
  }
}
```

Dòng `verify` là phần quan trọng nhất. Không có cổng chặn thì lỗi tràn chữ sẽ quay lại sau vài commit.

## Vòng lặp đúng

```
seed dữ liệu xấu nhất (?mock=long)
        |
   chạy npm run audit:overflow
        |
   đưa agent artifacts/overflow-report.json  <-- KHÔNG đưa ảnh
        |
   agent sửa ở tầng token hoặc component
        |
   chạy lại script, đối chiếu số đo
        |
   npm run test:visual xác nhận không vỡ chỗ khác
        |
   CI chặn nếu tái phát
```

## Hai chi tiết dễ bị bỏ qua

**Ngưỡng 1px.** `scrollWidth` và `clientWidth` đều là số nguyên, trong khi layout thực tế dùng số thực. Việc làm tròn khiến hai giá trị bằng nhau dù vẫn tràn thật. Đây là issue mở của CSSWG từ năm 2019. Script dùng ngưỡng `> 1` để bỏ vùng nhiễu này.

**Mã `TRUNCATED_NO_TOOLTIP`.** Không có API nào của trình duyệt cho biết phần chữ nào đã bị cắt, nên không thể phân biệt cắt có chủ đích với cắt do lỗi. Script né tranh cãi bằng một quy tắc máy kiểm tra được: **cắt chữ mà không có tooltip thì luôn là lỗi**, bất kể có chủ đích hay không.

## Về công cụ trình duyệt

Giữ cả hai, đừng thay thế:

- **Playwright** chạy script đo và cổng CI. Luôn bật.
- **Chrome DevTools MCP** chẩn đoán CLS và hiệu năng modal. **Cài sẵn nhưng để tắt**, chỉ bật khi cần, vì nó phơi 29 tool và ngốn khoảng 17.000 token chỉ để nạp danh sách tool.

Với Codex:

```bash
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --screenshotFormat=webp
```

Cấu hình Codex nằm ở `~/.codex/config.toml`, định dạng TOML chứ không phải JSON.

## Chế độ headed

Vấn đề chưa bao giờ nằm ở headed hay headless. Thứ cần bỏ là **lấy ảnh làm bằng chứng**.

- Giữ headed khi bạn tự nhìn, khi cần đăng nhập tay, khi DevTools MCP gắn vào Chrome đang chạy.
- Dùng headless cho script đo và CI.
- Ảnh chụp màn hình chỉ dành cho người xem, không đưa cho agent làm căn cứ kết luận.
