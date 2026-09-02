---
title: IPCManagement UI/UX Measurement Protocol
status: canonical-oracle
scope: frontend-and-browser-evidence
owner: GSD
last_reviewed: 2026-09-02
---

# UI/UX measurement protocol

[`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md), [`DESIGN.md`](DESIGN.md) và
[`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) là contract nguyên tắc/kiến trúc đã áp dụng;
`docs/ui-audit-kit/` là nguồn tham khảo đã được chuẩn hóa vào IPCManagement. Từ nay agent không kết luận
UI đúng/sai bằng cách đọc screenshot. Kết luận phải xuất phát từ test, DOM metrics, API evidence, focus
state hoặc performance record có thể lặp lại.

Quy trình đầy đủ từ phân loại task, sửa đúng owner, browser evidence đến handoff session nằm ở
[`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md). Authority map tài liệu nằm ở
[`README.md`](README.md). File này chỉ giữ oracle/gate đo lường, không trở thành một workflow cạnh tranh.

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

Gate này **chưa đủ** để kết luận visual composition PASS. Mọi route được sửa về layout phải bổ sung scoped
browser assertion theo `V1`–`V10`; thiếu assertion đó là `NEEDS_EVIDENCE`, không được suy từ `issueCount: 0`.

## Visual composition oracle

Screenshot được dùng để phát hiện candidate defect, sau đó phải chuyển thành DOM measurement. Với route/layout
được claim, manifest nên ghi thêm:

```json
{
  "composition": {
    "stateSurfaceCount": 1,
    "largeBlankSurfaces": [],
    "regions": {
      "heading": { "top": 0, "bottom": 0 },
      "scopeControl": { "top": 0, "bottom": 0 },
      "state": { "top": 0, "bottom": 0 },
      "content": { "top": 0, "bottom": 0 }
    },
    "boundaries": [
      { "selector": "...", "role": "compact", "minHeight": 0, "height": 0 }
    ],
    "ordering": ["heading", "scopeControl", "state", "content"],
    "focusTargetValid": true
  }
}
```

Oracle bắt buộc:

1. `stateSurfaceCount <= 1` cho một prerequisite/empty/error state của cùng work object.
2. Boundary `compact` không có computed min-height của `section/table/workspace`.
3. Heading/control/content cùng work object không bị tách bởi một blank surface không có semantic role.
4. Không có visible surface chiếm diện tích lớn mà không chứa heading, data, skeleton đúng contract, state copy
   hoặc action hữu ích.
5. DOM order và visual order không mâu thuẫn; action prerequisite focus đúng control.
6. Accessory nằm trong control (password toggle, calendar, clear/search icon) phải được đo bằng bounding box:
   không vượt biên control, cùng tâm theo trục dự kiến và `elementFromPoint()` tại tâm phải trả về accessory
   hoặc descendant của nó. Assertion click phải chạy sau khi control chuyển sang error/focus/pressed state vì
   ring, stacking context và active transform có thể làm hỏng hit target dù trạng thái ban đầu nhìn đúng.
7. Với form, đo cả nhóm label → control → guidance/error: không overlap, không tách thành orphan message,
   và lỗi của field này không được tạo khoảng trắng giả cho field khác.
8. Các assertion được chạy lại trên toàn viewport matrix thuộc claim. Nếu người dùng cung cấp screenshot ở
   viewport ngoài matrix, thêm đúng viewport/zoom đó vào scoped reproduction; matrix chuẩn không được dùng để
   bỏ qua lỗi đã báo cáo.

Ngưỡng khoảng cách/diện tích cụ thể phải xuất phát từ token và baseline của primitive. Không hardcode một tỷ lệ
chung rồi áp cho chart, editor hoặc matrix workspace vốn có geometry hợp lệ.

## Quy trình xử lý lỗi

1. Chạy gate và đọc JSON report. Nếu có ảnh, lập inventory candidate theo composition, hierarchy, adjacency,
   geometry, hit target và visual state; không chỉ kiểm overflow/semantics. Mọi orphan control/heading, accessory
   vượt biên, blank surface, duplicate state hoặc lệch hàng rõ ràng đều là candidate bắt buộc triage.
2. Phân loại từng rule thành `PASS`, `FAIL`, `NOT_APPLICABLE` hoặc `NEEDS_EVIDENCE`. Ảnh đơn lẻ luôn là
   `NEEDS_EVIDENCE`, nhưng candidate rõ phải được chuyển thành DOM/source assertion trước khi kết thúc triage.
   `issueCount: 0` từ gate generic không được nâng thành visual-composition PASS.
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
