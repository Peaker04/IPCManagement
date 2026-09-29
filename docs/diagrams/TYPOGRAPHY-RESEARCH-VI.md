# Vietnamese Typography Research — IPCManagement Diagrams

## Quyết định

- `Noto Serif 700`: tiêu đề tài liệu.
- `Noto Sans 400/500/600/700`: toàn bộ câu tiếng Việt, node và hướng dẫn thao tác.
- `Geist Mono 500/600`: enum trạng thái, mode và nhãn kỹ thuật ngắn.
- Font được bundle trong [`assets/fonts/`](assets/fonts/), không phụ thuộc mạng.

## Lý do

Dấu tiếng Việt làm chiều cao glyph lớn hơn Latin không dấu. SVG dùng line-height tiếng Anh hoặc font fallback dễ gây chạm dấu, sai kerning và tràn node. Vì vậy diagram dùng `<tspan dy="1.4em">`, padding tối thiểu 14px và chờ `document.fonts.ready` trước khi đo/xuất.

## Acceptance

- Nội dung và nhãn thao tác: tối thiểu 12px.
- Nhãn connector/technical ID: tối thiểu 11px.
- Không dùng monospace cho câu tiếng Việt.
- Không giảm cỡ chữ để chữa overflow; phải wrap hoặc tăng node.
