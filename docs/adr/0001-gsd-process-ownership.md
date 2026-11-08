# ADR-0001: GSD sở hữu process

- Status: Accepted
- Date: 2026-07-30
- Clarified: 2026-08-28

## Bối cảnh

GSD đã có evidence cho planning, verification, milestone closeout và quality gate. Nhóm
mattpocock có các orchestrator song song như `to-spec`, `to-tickets`, `implement` và
`wayfinder`; cho phép cả hai cùng sở hữu process sẽ tạo hai nguồn kế hoạch và hai
định nghĩa Done.

## Quyết định

GSD là process owner duy nhất, không ngoại lệ:

- GSD sở hữu `.planning/phases/**`, `VERIFICATION.md`, closeout, gate và `MEMORY.md`.
- Việc nhỏ/hotfix dùng lean L0/L1 hoặc `gsd-quick`; GSD giữ state ownership nhưng không bắt buộc tạo
  phase/plan/reviewer orchestration khi acceptance và public seam đã rõ.
- Skill ngoài chỉ là discipline bên trong một plan GSD đã mở và không được ghi
  artifact trạng thái.
- `handoff` chỉ sinh draft trong thư mục tạm. Workflow docs của GSD fact-check và
  promote nội dung; orchestrator quyết định commit.
- Vô hiệu hóa `to-spec`, `to-tickets`, `implement`, `triage`, `wayfinder` và `ask-matt`
  trong workspace này. `ask-matt` bị vô hiệu hóa vì nó là router trực tiếp tới các
  orchestrator bị cấm.

## Hệ quả

Không còn đường thứ hai cho spec/ticket/implementation. Tuy nhiên, process ownership không được hiểu là
“full GSD cho mọi task”. Execution phải chọn L0/L1/L2 theo
[`harness/DELIVERY.md`](../harness/DELIVERY.md):

- L0/L1 ưu tiên inline, một red-capable loop, một owner, một regression và một gate; mặc định không fan-out.
- L2 mới dùng phase/checkpoint/subagent đầy đủ cho protected data, migration, trust boundary hoặc nhiều
  workstream thực sự độc lập.
- Skill TDD, diagnosing-bugs, UI checklist và styling cung cấp discipline kỹ thuật nhưng không ghi nguồn
  trạng thái cạnh tranh.

Handoff không phải nguồn trạng thái và không được override `MEMORY.md`.

## Pi-first adapter clarification (2026-09-06)

Pi CLI là runtime duy nhất; dùng API/model Codex trong Pi vẫn là Pi và không kích hoạt Codex app/CLI. Codex app, Codex CLI và Claude Code nằm ngoài execution path trừ khi Kỳ mở task riêng. Giữ nguyên junction/shared core/worktree cũ, không xóa chúng như một bước chuyển runtime. Mapping cụ thể: [`harness/RUNTIMES.md`](../harness/RUNTIMES.md).

GSD giữ process/state ownership, không đòi port toàn bộ agent upstream. Bản agent mang Codex tool/auto-commit
assumption chưa được kiểm chứng thì bị tắt ở project Pi; L0/L1 chạy inline theo Lean. Full workflow có yêu cầu
typed agent/isolation chưa được hỗ trợ phải dừng ở capability boundary, không giả danh native GSD execution.
Shipyard chỉ cung cấp tooling đã duyệt dưới task GSD; không chạy feature/plan/PR orchestration song song.
Chỉ commit/ship khi Kỳ cho phép; upstream skill không cấp quyền đó.
