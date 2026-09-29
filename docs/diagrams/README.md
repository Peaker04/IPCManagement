# IPCManagement Diagram Suite

Thư mục này chỉ có **một workflow bàn giao khách hàng** cho chế độ `MATERIAL_RECONCILIATION`:

| Tệp | Nội dung | Nguồn |
|---|---|---|
| [`material-reconciliation-e2e-customer-workflow.html`](material-reconciliation-e2e-customer-workflow.html) | Vòng đời E2E từ thực đơn tuần → khóa lô → chuyển Kho → xuất theo ngày → đối chiếu → hoàn tất, kèm ba case phục hồi | [`docs/domain/material-reconciliation.md`](../domain/material-reconciliation.md), UI runtime |

## Mở và xuất bản

Mở file HTML trực tiếp trong Chrome/Edge. Giữ nguyên thư mục [`assets/fonts/`](assets/fonts/) để tiếng Việt hiển thị đúng.

```bash
python .agents/skills/diagram-design/scripts/self_check.py docs/diagrams/material-reconciliation-e2e-customer-workflow.html
python scripts/diagram_tool.py validate docs/diagrams/material-reconciliation-e2e-customer-workflow.html
python scripts/diagram_tool.py export docs/diagrams/material-reconciliation-e2e-customer-workflow.html \
  --format svg,png,pdf --mode full-page --scale 2 --out-dir docs/diagrams/exports
```

Diagram là tài liệu hướng dẫn dẫn xuất. Khi xung đột, code/runtime và [`docs/domain/material-reconciliation.md`](../domain/material-reconciliation.md) luôn thắng.
