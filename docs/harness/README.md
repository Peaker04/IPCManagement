---
title: AI Agent workflow entry
status: canonical-index
owner: GSD
scope: task-intake-and-authority-routing
---
# Workflow entry — nhận việc rồi mới thực thi

Đây là **bảng điều hướng**, không phải process thứ hai. [AGENTS](../../AGENTS.md) giữ startup/safety;
[DELIVERY](DELIVERY.md) sở hữu lane, acceptance và checkpoint. Không cần đọc mọi file được link ở đây.

## 1. Năm bước cho mọi yêu cầu

| Bước | Agent phải làm | Đầu ra tối thiểu |
|---|---|---|
| Nhận việc | Theo startup AGENTS; so HEAD/index/dirt; xác định task mới hay resume | Goal và current checkpoint; campaign khác giữ paused |
| Truy xuất | Chọn lane DELIVERY §2 và đúng row bên dưới; đọc owner/source + callers liên quan | Allowed files, contract, invariants, unknowns |
| Khóa cách làm | Chọn skill DELIVERY §3; xác định check bắt được lỗi/contract và quyền thực thi | Packet trước edit; thiếu prerequisite thì BLOCKED/NO_EDIT |
| Thực thi | Sửa nhỏ nhất tại root owner; giữ dirty files và cập nhật docs liên quan | Một bounded diff, một feedback loop; không tự mở scope |
| Kiểm chứng/bàn giao | Chạy gate phù hợp DELIVERY §9–10, xem diff, checkpoint | Verdict từng claim, evidence/limits, đúng next action |

Packet ghi trong **cùng GSD checklist hiện hành** (L0 đơn giản có thể commentary; không tạo plan mới):

```text
Goal / success       : observable outcome
Scope / exclusions   : allowed files, actor/mode/state nếu liên quan
Authority / owner    : canonical contract + live source/callers
Check / baseline     : exact command/oracle; red-capable cho bug
Permissions / gaps   : quyền có, việc không được làm, BLOCKED/NEEDS_EVIDENCE
Next                 : đúng một bước tiếp theo
```

Packet này không thay SOURCE LOCK / DESIGN LOCK / FR-NFR packet của UI ở DELIVERY §4.
L0/L1 mặc định inline; task lớn không tự cấp quyền gọi subagents. Task mới khác objective được cấp một
checkpoint riêng, không sửa status campaign cũ thành DONE. Cùng objective thì dùng lại checklist/ledger.

## 2. Chỉ mở nhánh khớp task

| Task | Đọc tiếp | Không tự nạp/chạy |
|---|---|---|
| Docs/harness/rules | [Governance](GOVERNANCE.md), [Maintenance](MAINTENANCE.md), owner đang sửa; `harness-maintenance` khi bảo trì harness | Full docs generation, installer, skill sync |
| Code/bug/backend | [Product map](../README.md) → đúng architecture/domain/API contract, source + callers; skill DELIVERY §3 | Tất cả UI docs hoặc full suite trước focused loop |
| Frontend/UI | [UI harness](../UI-UX-EXECUTION-HARNESS.md) → DESIGN/rules/domain + workflow owners | Copy specimen business facts, lấy route load làm acceptance |
| Test | Owner behavior/contract và `test-audit`; [Testing](../TESTING.md) để chọn command | Test-only seams hoặc duplicate/source-mirroring coverage |
| DB/migration/restore | LESSONS, matching domain/lineage, đúng runbook và authorization | Seed/reset/mode switch để vượt gate |
| Browser/performance | LESSONS, UI harness, [Measurement protocol](../UI-UX-MEASUREMENT-PROTOCOL.md), runtime pointer từ MEMORY | Stale credentials/build, API-only UI PASS |
| Pi/tool/skill/subagent | [Runtime adapter](RUNTIMES.md); docs Pi chính thức khi sửa integration | Tool của Codex/Claude, disabled/imported agents |
| Cleanup | Maintenance retirement map; [Artifact policy](ARTIFACTS.md) nếu đụng evidence | `git clean`, xóa history/evidence/vendor chỉ vì nhiều file |
| GitNexus | Chỉ khi được yêu cầu rõ: [policy](../GITNEXUS-POLICY.md) | Auto-index/graph scan |

## 3. Một nơi cho mỗi loại thông tin

| Thông tin | Owner |
|---|---|
| Startup, safety, permissions | `AGENTS.md` |
| Current task pointer + runtime observations cần verify lại | `MEMORY.md` |
| Task/checklist/ledger và next action | Một GSD checkpoint trong `.planning/` |
| Lane, skill selection, gate, verdict, handover schema | `docs/harness/DELIVERY.md` |
| Product/domain/UI contracts | Owner được `docs/README.md` định tuyến |
| Tool/runtime mapping | `docs/harness/RUNTIMES.md` |
| Completed work / historical rationale | `HISTORY.md`, `docs/archive/`, checkpoint lịch sử |
| Evidence output / accepted hashes | `.artifacts/` / `docs/EVIDENCE-INDEX.md` |

Đọc chat/checkpoint cũ để tìm rationale, không coi mọi `Next`/checkbox cũ là lệnh hiện hành. Checkpoint nên
đặt **Current: status + next action + blockers** ở đầu; phần completed/superseded bên dưới không có execution
authority. Prompt/audit dài phải được fact-check và promote vào cùng checklist/ledger trước production edit.
Nếu không có raw transcript, nói rõ chỉ đọc saved handover; không claim đã đọc toàn session.

`manifest.json` là checker input, không phải task database: `activePointers` theo objective hiện hành trong
MEMORY; `requiredPointers` có thể giữ paused/history để bảo vệ link, không cấp quyền resume.

## Compatibility

Giữ hai alias cho consumers cũ, không copy rule:

- [AGENT-HARNESS](../AGENT-HARNESS.md) → RUNTIMES.
- [LEAN-DELIVERY-AND-DEBUGGING-STANDARD](../LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md) → DELIVERY.

Không xóa alias khi chưa disposition consumers và Pi cold-start. Link/checker PASS chỉ là structural check,
không chứng minh agent mới đã tuân thủ workflow hay app đã đạt acceptance.
