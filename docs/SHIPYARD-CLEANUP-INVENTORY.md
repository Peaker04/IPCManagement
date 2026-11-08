# Shipyard cleanup inventory (dry-run)

Ngày kiểm kê: 2026-08-09. Đây là phân loại, chưa xoá hoặc di chuyển dữ liệu.

| Location | Classification | Action | Gate |
|---|---|---|---|
| `IPCManagement/shipyard/profiles/IPCManagement/` | Tracked project profile | Giữ; chuẩn hóa theo manifest | Review repo diff |
| `IPCManagement/shipyard/shipyard.manifest.json` | Canonical contract | Tạo mới và dùng làm entrypoint | No secret |
| `D:/Kì 7/PRN222 Doanh Nghiệp/shipyard/` | Standalone harness Git repo | Giữ ngoài project; không copy vào source | Harness owner + clean working tree |
| `D:/Kì 7/PRN222 Doanh Nghiệp/shipyard-lanes/lane1/` | Generated protected lane clone | Giữ; không reset/xoá | `ipc_lane1` protected |
| `IPCManagement/.artifacts/shipyard-live/` | Mixed scripts + legacy evidence | Tách dần: tooling → `scripts/shipyard`, run evidence → `<run-id>` | Evidence index |
| `IPCManagement/.artifacts/browser-use-*`, `e2e*`, `*-debug` | Legacy run evidence/cache | Không dùng cho run mới; archive sau hash audit | No pointer/lock/process |
| `IPCManagement/.artifacts/runtime/` | Runtime logs/PIDs | Giữ logs authoritative; xoá log rỗng/orphan sau teardown audit | Process ownership |
| `D:/IPC-browser-use-profile/` | Chrome persistent profile cũ | Không cần cho source/runtime hiện hành; chỉ giữ nếu cần điều tra browser run 2026-07-24 | Chrome/process check |
| `D:/IPC-browser-use-visible/` | Chrome headed profile cũ | Tương tự profile trên; canonical profile hiện nay nằm dưới `.artifacts/browser-use-visual-audit` | Chrome/process check |
| `D:/IPCManagement-backups/` | SQL backup lịch sử, chưa mã hóa | Giữ làm rollback/recovery history có kiểm soát; không dùng làm DB hiện hành, cần retention/encryption review | Backup owner |
| `D:/IPCManagement-build/` | Compiled API/test output snapshot | Không phải source; current runtime build từ checkout. Có thể archive/xóa sau process/rollback check | Build/process check |
| `D:/IPCManagementCurrent` | Junction tới checkout hiện tại | Không xóa target; chỉ xóa junction khi mọi launcher/reference đã chuyển canonical path | Junction reference check |
| `C:/ipc-workspace` | Junction tới checkout hiện tại | Không xóa target; chỉ xóa junction khi mọi launcher/reference đã chuyển canonical path | Junction reference check |
| `C:/IPCManagement-offsite-rehearsal/` | Backup/restore rehearsal evidence | Giữ `ipcmanagement-20260728-180557.zip`; các file `.non-authoritative`/`.invalid-manifest` chỉ xóa sau hash/evidence reconciliation | Recovery evidence owner |
| `D:/Kì 7/.artifacts/production/` | External production/debug artifacts | Không tự xoá; xác định owner và retention riêng | User confirmation |
| `IPCManagement/D/` | Accidental path artifact | Điều tra pointer trước; chưa xoá | Verify no source/evidence reference |
| `IPCManagement/.claude/worktrees/*` | Stale generated worktrees | Không force-remove trong cleanup này; đối chiếu `git worktree list` rồi owner đóng | Git worktree owner |
| `D:/Temp/sv-20-reviewfix-831f7ff0` | Orphan worktree registry entry | Chỉ prune sau khi xác nhận path không cần phục hồi | Git owner confirmation |

## Cleanup order

1. Freeze new output to the canonical artifact contract.
2. Generate a hash/pointer inventory and reconcile `docs/EVIDENCE-INDEX.md`.
3. Remove only empty logs, stale PID/lock files and build/cache directories with no
   reference; never remove a lane clone or standalone harness recursively.
4. Archive completed GSD phase directories only through the GSD cleanup workflow.
5. Re-run health, `git diff --check`, secret/stub scan and a declared-scope inspection.

## Current blockers

- External harness has a dirty working tree and is ahead of its remote; it must not be
  modified as part of this project cleanup.
- GSD health hiện báo thiếu root `PROJECT.md`, phase directories chưa được ROADMAP nhận
  diện và các stale/orphan worktree; đây là hygiene backlog riêng, không tự động repair vì
  có thể làm mất state hoặc worktree của phiên khác.
- The project artifact root contains both scripts and evidence at the same level, so a
  mechanical delete is unsafe.
- `ipc_lane9` currently has unresolved legacy lineage rows; any cleanup involving DB evidence
  must preserve the Phase 4 disposition/preflight records.
