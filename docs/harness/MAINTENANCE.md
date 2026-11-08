---
title: AI Agent Harness maintenance protocol
status: canonical-runbook
owner: GSD
scope: harness-retrieval-update-retirement
---
# Harness maintenance

## Bootstrap

1. Đọc root `AGENTS.md`, rồi `MEMORY.md`.
2. So sánh cwd, branch, HEAD, index và dirty scope.
3. Nếu resume, theo đúng GSD checkpoint; nếu task mới, không tự chạy campaign đang pause.
4. Dùng [`docs/README.md`](../README.md) authority map và [harness index](README.md) để chọn nguồn theo task.
5. Chỉ đọc domain/skill/runbook liên quan. Không auto-load HISTORY, toàn planning tree hoặc evidence.
6. Trước mutation, xác nhận scope/authority/prerequisite; sau mỗi wave verified, cập nhật checklist và handover.
7. Với cleanup evidence, tuân theo [artifact retention policy](ARTIFACTS.md): dry-run trước, bảo vệ tracked/reference paths và chỉ apply khi owner đã cấp quyền xóa.

## Cập nhật tài liệu

1. Xác định canonical owner; không tạo file mới nếu owner hiện hữu chứa được thay đổi.
2. Fact-check với source/test/runtime phù hợp. Summary hoặc subagent prose chỉ là đầu mối.
3. Trước write, snapshot SHA-256 của file dirty; ngay trước apply chạy `python tools/check_agent_harness.py --expect-sha256 PATH=HASH` (`--expect-size` chỉ là check phụ). Mismatch là conflict: dừng và reconcile, không overwrite.
4. Sửa file nhỏ nhất và mọi link bắt buộc trong cùng task.
5. Chạy `python tools/check_agent_harness.py` và focused consumer checks.
6. Ghi command/exit/result, giới hạn evidence và exact next step vào GSD checklist.
7. Khi việc đóng, chuyển kết quả bền vững sang HISTORY; MEMORY chỉ giữ pointer hiện hành.

## Di chuyển hoặc retire

- Đọc đầy đủ nguồn và kiểm mọi consumer trước move/delete.
- Lập map `old → target → disposition → gate`.
- Tạo destination hoàn chỉnh trước; old path trở thành pointer không copy rule.
- Không rewrite immutable evidence chỉ để link check xanh.
- Xóa pointer không phải điều kiện thành công; chỉ xóa sau Pi cold-start/consumer evidence và authorization.

## Skills

- Project-owned skill có thể được author tại `.agents/skills/<name>/SKILL.md` và phải được Pi discovery smoke xác minh trước khi gọi active.
- Skill không cấp quyền ngoài task. Tài sản nằm dưới `.codex/` chỉ là provenance/storage nếu Pi settings trỏ tới; không kích hoạt Codex app/CLI.
- Mỗi runtime chỉ có một active registration cho cùng skill name.
- Resolve relative assets từ thư mục skill; không sửa third-party package clone để thích ứng project.

## Checkpoint và recovery

Checkpoint ghi goal/task, branch/HEAD/status/index, task-owned paths, command/result, evidence limits, owned process state, blockers và bước kế tiếp. Khi write conflict hoặc gate fail: dừng wave, giữ diff/evidence và rollback chỉ task-owned bytes sau khi so intervening edits; không restore file vốn dirty về HEAD.
