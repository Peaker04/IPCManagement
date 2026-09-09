---
updated: 2026-09-08
branch: feature/menu-amendment-reconciliation
observed_head: 8ff0dd15
runtime_ports:
  frontend: 3001
  api: 8001
  shipyard: 8090
  mysql: 3306
  audit_frontend: 3010
  audit_api: 8010
  warehouse_dev_frontend: 3020
  warehouse_dev_api: 8020
  e2e_frontend: 3036
  e2e_api: 8036
db_lane: ipc_lane9
warehouse_cleanup_lane: ipc_dev_warehouse_20260812
e2e_lane: ipc_lane7
credentials_via: IPC_LANE7_<ROLE>_PASSWORD
---
# Working memory hiện hành

Đây là working set được auto-load sau `AGENTS.md`; không phải history hoặc domain store. Luôn revalidate source/runtime, branch/HEAD/status và checkpoint trước khi hành động.

## Current status — Phase 33 closeout awaiting commit

- Kỳ đã chấp nhận đóng Phase 31 `PASS_WITH_DECLARED_RESIDUAL`. Authority: [31-CHECKLIST](.planning/phases/31-full-system-ui-ux-audit-and-remediation-using-measurable-com/31-CHECKLIST.md), [31-VERIFICATION](.planning/phases/31-full-system-ui-ux-audit-and-remediation-using-measurable-com/31-VERIFICATION.md), handover: [.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md](.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md).
- Source/tests/final review PASS; reviewer `702ba5f4-69b0-4b5e-837a-7861cd7cecf9` tìm thấy zero issue trên `31c7d0a0`, `05b4acea`, `8ff0dd15`.
- Residual được giữ trung thực: protected completion mutation, mixed linked-issue runtime render và exact browser cells là `NEEDS_EVIDENCE` / `WAITING_FOR_BUSINESS_EVENT`. Đây không phải full protected MRX lifecycle certification; không tự reopen, đổi mode hoặc tạo dữ liệu.
- Phase 33 technically `PASS_WITH_RESIDUAL`: S1 `1fd019b9`, S2 `f629fe5d`, S3 `245924c3`; service/owner line counts lần lượt 475/164, 513/267, 544/250. Strict architecture-growth PASS, baseline SHA-256 `8d5e9c06...e0b4f8` giữ nguyên; aggregate focused backend 51/51, architecture unit 6/6, isolated API build 0 warning/error. Final reviewer `f49c5b8e-e861-4f6f-a157-b7939776757e` zero finding. Debug output build bị PID 2156 lock nhưng isolated output PASS; process không bị dừng. Authority: `.planning/phases/33-refactor-three-unbaselined-backend-services-to-restore-stric/33-CHECKLIST.md`; closeout report `.artifacts/phase33/closeout/independent-review.md`. Chờ commit closeout docs; không có product goal kế tiếp tự động.
- Controlled cleanup A–E và boundary/null remediation đã checkpoint qua `b6179012`, `2ca654d3`, `5a297cf7`, `1fd9c017`, `6d53cdf7`; main worktree normalized content/index/untracked sạch tại goal entry. Hai script REMOVE-CANDIDATE vẫn chưa được xóa; không tự resume cleanup/MRX.

## Completed harness checkpoint

- Phase 32 AH-00..AH-10 và acceptance audit P32-A01..A07 PASS cho Pi CLI-only: [checklist](.planning/phases/32-chu-n-h-a-ki-n-tr-c-ai-agent-harness-d-ng-chung-cho-pi-cli-v/32-CHECKLIST.md), [handover](.planning/phases/32-chu-n-h-a-ki-n-tr-c-ai-agent-harness-d-ng-chung-cho-pi-cli-v/32-HANDOVER.md). Fresh probes đã khóa docs/MRX/UI/resume/capability routing; same-size concurrent edit nay dùng SHA-256 pre-write gate. Independent final review không có finding; chưa cần plan nâng cấp harness mới. Codex app/CLI đã bị Kỳ loại khỏi workflow.
- Phase 32 không sửa FE/BE, database/schema/data/mode, không GitNexus, package/user-global config, hooks/extensions, commit hoặc push. Scoped backup: `D:/Temp/IPCManagement-agent-harness-20260908T041310Z`.

## Current application checkpoint

- MRX screenshot remediation source đã thực hiện qua các local commits `15de7a18`, `903a0fc5`, `218ece32`, `b0b13dba`, `0ac18d3d`, `31c7d0a0`, `05b4acea`, `8ff0dd15`; focused/full frontend, lint/build/route budgets và backend completion tests đã PASS. `05b4acea` cô lập settlement cũ bằng dialog-session token; `8ff0dd15` chuyển presentation/disablement khỏi hook-wide mutation loading sang pending state do chính session dialog sở hữu, nên close/reopen được bật ngay và settlement cũ không đổi session mới. Browser exact drawer/all-exact cells còn `NEEDS_EVIDENCE` do protected lane không có actionable state.
- Durable handover: [.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md](.artifacts/subagents/mrx-screenshot-uiux-remediation-HANDOVER.md).
- GSD authority vẫn ở [Phase 31 checklist](.planning/phases/31-full-system-ui-ux-audit-and-remediation-using-measurable-com/31-CHECKLIST.md). Không tạo dữ liệu, đổi operation mode hoặc chạy lại campaign trong Phase 32.

## Business contract và authority map

- `MATERIAL_RECONCILIATION`: [canonical domain contract](docs/domain/material-reconciliation.md). Phải đọc trước mọi task MRX; archive/narrative cũ không override.
- Tài liệu theo task: [docs/README.md](docs/README.md).
- AI Agent Harness: [docs/harness/README.md](docs/harness/README.md).
- Runtime/skills/subagents: [docs/harness/RUNTIMES.md](docs/harness/RUNTIMES.md).
- Delivery/debug lanes: [docs/harness/DELIVERY.md](docs/harness/DELIVERY.md).
- Evidence hash chỉ ở [docs/EVIDENCE-INDEX.md](docs/EVIDENCE-INDEX.md); completed history ở `HISTORY.md`; migration/restore/browser measurement phải đọc `LESSONS.md`.

## Runtime và dữ liệu

- Các port/lane ở front matter là pointer, không phải readiness proof. Trước browser/database action phải xác minh listener/build identity, authenticated operation mode/version/capabilities, readiness và exact target lane.
- Không thử credential mặc định, không dump auth/config secrets, không assume lane rỗng, không seed/reset/restore/direct-write để làm gate xanh.
- `DEFAULT` và `MATERIAL_RECONCILIATION` giữ authority/lineage tách biệt theo canonical contract.

## Fresh-session handover tối thiểu

Đọc `AGENTS.md` → file này → active checklist; compare cwd/branch/HEAD/status/index. Một bước active tại một thời điểm. Sau mỗi verified wave ghi changed paths, command/exit/result, evidence limits, blocker, owned process state và exact next step vào checklist; không dựa vào transcript chưa persist.
