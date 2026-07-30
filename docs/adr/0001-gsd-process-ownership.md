# ADR-0001: GSD sở hữu process

- Status: Accepted
- Date: 2026-07-30

## Bối cảnh

GSD đã có evidence cho planning, verification, milestone closeout và quality gate. Nhóm
mattpocock có các orchestrator song song như `to-spec`, `to-tickets`, `implement` và
`wayfinder`; cho phép cả hai cùng sở hữu process sẽ tạo hai nguồn kế hoạch và hai
định nghĩa Done.

## Quyết định

GSD là process owner duy nhất, không ngoại lệ:

- GSD sở hữu `.planning/phases/**`, `VERIFICATION.md`, closeout, gate và `MEMORY.md`.
- Việc nhỏ/hotfix dùng `gsd-quick` hoặc hotfix lane của GSD.
- Skill ngoài chỉ là discipline bên trong một plan GSD đã mở và không được ghi
  artifact trạng thái.
- `handoff` chỉ sinh draft trong thư mục tạm. Workflow docs của GSD fact-check và
  promote nội dung; orchestrator quyết định commit.
- Vô hiệu hóa `to-spec`, `to-tickets`, `implement`, `triage`, `wayfinder` và `ask-matt`
  trong workspace này. `ask-matt` bị vô hiệu hóa vì nó là router trực tiếp tới các
  orchestrator bị cấm.

## Hệ quả

Không còn đường thứ hai cho spec/ticket/implementation. Các skill TDD, debug, research,
domain modeling và review vẫn được dùng khi GSD plan giao việc. Handoff không phải
nguồn trạng thái và không được override `MEMORY.md`.
