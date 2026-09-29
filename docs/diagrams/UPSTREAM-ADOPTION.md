# Diagram Design — Upstream Adoption

## Nguồn

- Upstream: <https://github.com/cathrynlavery/diagram-design> — MIT.
- IPCManagement tham chiếu bản cài đặt đã Việt hóa tại `D:/ki7/EXE/tree/.agents/skills/diagram-design`.
- Skill được cài project-local tại [`.agents/skills/diagram-design/`](../../.agents/skills/diagram-design/).

## Điều chỉnh IPCManagement

1. Quy chuẩn tiếng Việt tại [`references/localization-vi.md`](../../.agents/skills/diagram-design/references/localization-vi.md).
2. Font offline tại [`assets/fonts/`](assets/fonts/).
3. Validator/export tại [`scripts/diagram_tool.py`](../../scripts/diagram_tool.py).
4. Workflow khách hàng lấy `docs/domain/material-reconciliation.md` và UI runtime làm nguồn, không mang nội dung NOVYX sang IPC.
5. Connector vuông góc, rail quay về tách biệt và zero-collision gate bắt buộc.

## Phạm vi hiện tại

Chỉ tạo một artifact E2E cho chế độ “Đối chiếu nguyên liệu”. Không tạo thêm diagram kiến trúc hoặc workflow phụ cho đến khi có yêu cầu cụ thể.
