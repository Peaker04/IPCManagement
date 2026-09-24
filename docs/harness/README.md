---
title: AI Agent Harness authority map
status: canonical-index
owner: GSD
scope: pi-codex-agent-harness
---
# AI Agent Harness

Đây là điểm vào cho cách AI Agent làm việc trong IPCManagement. Harness định tuyến tới tài liệu sản phẩm; nó không sở hữu nghiệp vụ, UI contract, task state hoặc evidence.

## Kiến trúc năm tầng

| Tầng | Nguồn dùng chung | Adapter/runtime |
|---|---|---|
| Instructions và working memory | `AGENTS.md`, `MEMORY.md`, `docs/README.md` | Pi dùng native instruction discovery |
| Knowledge và skills | Tài liệu canonical trong `docs/`, shared skill trong `.agents/skills/` | Full skill chỉ đọc khi task khớp |
| Guardrails/checks | [Maintenance](MAINTENANCE.md) và checker deterministic | Không coi prompt/hook là sandbox |
| Delegation | [Runtime adapter](RUNTIMES.md) | GSD parent giữ state; child nhận packet tối thiểu |
| Distribution | Project files; Pi package chỉ khi có yêu cầu chia sẻ | Không auto-install/update package |

GSD `.planning/` là process/state owner duy nhất. `.artifacts/` giữ output kiểm chứng; hash accepted evidence chỉ thuộc `docs/EVIDENCE-INDEX.md`.

## Startup tối thiểu

1. Đọc root `AGENTS.md`, rồi `MEMORY.md`.
2. So sánh cwd, branch, HEAD, index và worktree với checkpoint.
3. Chọn lane ở [DELIVERY.md](DELIVERY.md).
4. Dùng `docs/README.md` để mở đúng product/domain contract.
5. Đọc skill đầy đủ khi task khớp. Không auto-load HISTORY, LESSONS, planning tree hoặc evidence.
6. Nếu đầu vào là audit/review/prompt dài hoặc chỉ thị từ chat yêu cầu chiến dịch nhiều bước, GSD parent phải đọc đầy đủ, fact-check và chuẩn hóa thành **một checklist + một ledger bền vững** trước production edit. Chat/subagent output không phải task state; kết luận chưa persist không được coi là đã giao hoặc được session sau tự nhớ.
7. Nếu resume, theo đúng GSD checkpoint; nếu task mới, không tự chạy campaign cũ.

## Authority

| Loại thông tin | Owner |
|---|---|
| Quyền và startup boundary | `AGENTS.md` |
| Working set/runtime/pointer hiện hành | `MEMORY.md` |
| Process, gate và verdict | [DELIVERY.md](DELIVERY.md) + GSD checklist |
| Pi runtime/skills/subagents/tooling | [RUNTIMES.md](RUNTIMES.md) |
| Thêm/sửa/archive harness knowledge | [GOVERNANCE.md](GOVERNANCE.md), [MAINTENANCE.md](MAINTENANCE.md) |
| Domain/UI/system behavior | Các file canonical được `docs/README.md` định tuyến |
| Historical work | `HISTORY.md`, `docs/archive/` |
| Evidence | [Artifact retention](ARTIFACTS.md), `.artifacts/`, `docs/EVIDENCE-INDEX.md` |

Source/runtime mô tả điều đang xảy ra nhưng không tự hợp pháp hóa behavior trái expected contract. Khi mâu thuẫn, ghi discrepancy và xác minh owner; không sửa tài liệu theo bug để lấy PASS.

## Runtime boundary

Pi CLI là runtime duy nhất của harness. Dùng OpenAI/Codex provider trong Pi vẫn là **Pi runtime**; không mang Codex app/CLI tools, MCP, permissions hoặc session vào workflow. Xem [RUNTIMES.md](RUNTIMES.md).

## Compatibility

Hai entry cũ được giữ làm pointer:

- `docs/AGENT-HARNESS.md` → `docs/harness/RUNTIMES.md`
- `docs/LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md` → `docs/harness/DELIVERY.md`

Không xóa pointer đến khi active consumers và Pi cold-start smoke đều được disposition.
