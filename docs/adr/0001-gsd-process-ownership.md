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
[`LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md`](../LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md):

- L0/L1 ưu tiên inline, một red-capable loop, một owner, một regression và một gate; mặc định không fan-out.
- L2 mới dùng phase/checkpoint/subagent đầy đủ cho protected data, migration, trust boundary hoặc nhiều
  workstream thực sự độc lập.
- Skill TDD, diagnosing-bugs, UI checklist và styling cung cấp discipline kỹ thuật nhưng không ghi nguồn
  trạng thái cạnh tranh.

Handoff không phải nguồn trạng thái và không được override `MEMORY.md`.
