# Bàn giao MRX production và các worktree local

## Đọc trước

- **Handoff ID** `2026-11-18-2244-mrx-production-and-local`, 22:44 ngày 18/11/2026, giờ Việt Nam. Phiên giao Codex `/root`.
- **Điểm dừng** PR #61 đã phát hành. Các worktree local còn thay đổi riêng, gồm xuất Excel cho Bếp và đợt sửa theo audit. `.planning/WORK.md` là nguồn trạng thái của từng worktree.
- **Việc đầu tiên** Đối chiếu đúng branch, HEAD và WORK của phạm vi được giao. Nếu tiếp tục Excel cho Bếp, xem report `20261118t153609z_d82a32` và hai lỗi architecture trước khi quyết định sửa hoặc chạy lại.
- **Blocker** Đợt ExportConsistency local chưa qua architecture gate. G7/G8 chưa có bằng chứng hoàn tất trong đợt phát hành này.

## 1. Yêu cầu, quyền hạn và phạm vi

Phiên này chỉ bàn giao. Quyền production trước đây áp dụng cho merge PR #61 và migration của bản đó. Mọi tác động production mới cần yêu cầu có phạm vi tương ứng. Giữ cách ly MRX và DEFAULT theo DOM-MODE-1, giữ các thay đổi đang dở và dùng clone thuộc runner cho kiểm thử đột biến khi được giao. Tuân thủ gate UI và test của AGENTS.md khi làm tiếp.

## 2. Snapshot

| Worktree | Branch và HEAD | Staged / modified / untracked trước khi viết handoff | Trạng thái cần giữ |
|---|---|---|---|
| Root | `codex/mrx-fluid-header-20261114` · `05b920c0` | 0 / 84 / 28 | Có thay đổi Excel/BOM/FE và các phần kế thừa. Attribution từng tệp chưa xác minh. |
| `.worktrees/approval-center` | `codex/mrx-recovery-acceptance-20261117` · `5a1d0d02` | 0 / 2 / 3 | WORK cũ ghi PR còn mở. Có bản local của việc di chuyển test tốc độ và hai artifact untracked. |
| `.worktrees/legacy-purpose-recovery` | `codex/mrx-legacy-purpose-recovery-20261118` · `e7c91267` | 0 / 1 / 0 | Thay đổi WORK local ghi nhận phát hành. Mã phát hành đã squash vào main. |
| `.worktrees/mrx-audit-remediation` | `codex/mrx-audit-remediation-20261118` · `e7c91267` | 0 / 77 / 3 | Thay đổi audit/UI/Excel local, kèm thay đổi lớn ở lockfile. Cần kiểm tra phạm vi và nguồn gốc trước khi tích hợp. |

Snapshot đầy đủ gồm status, log 5 commit, diff stat và staged stat nằm trong [.artifacts/context-handoff/2026-11-18-2244-mrx-production-and-local](../../.artifacts/context-handoff/2026-11-18-2244-mrx-production-and-local). Remote `main` xác minh tại `6a35dec8929f121e1db45ffeec76591104ee7820`. Môi trường Windows, .NET SDK 10.0.401, Node v24.13.0. Lúc kiểm tra, không có listener trên 5173, 5174, 5262 và 5263. Chưa xác minh tiến trình ngoài các cổng này. Phiên nhận dùng `context-handoff` ở chế độ NHẬN.

## 3. Tiến độ

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| RELEASE | Phục hồi phân bổ phiếu xuất lịch sử MRX | DONE_VERIFIED | [PR #61](https://github.com/Peaker04/IPCManagement/pull/61), [Verify main](https://github.com/Peaker04/IPCManagement/actions/runs/44266745453), [CodeQL main](https://github.com/Peaker04/IPCManagement/actions/runs/44266745308), [Vercel](https://vercel.com/kyttde180211-2157s-projects/ipc-managament-frontend-demo/C9Xheh4HAepWt1agMLzHGKgKaqjA) | Kiểm tra production trong phiên phát hành giới hạn ở readiness và route yêu cầu đăng nhập. |
| DB | Migration `20261118055436_AddMrxHistoricalPurposeProposals` trên IPC | DONE_VERIFIED | [Biên nhận migration](../../.worktrees/legacy-purpose-recovery/.artifacts/ipc-prod-pr61-migration.json), [metadata bản sao lưu](../../.worktrees/legacy-purpose-recovery/.artifacts/ipc-prod-pr61-backup.json), [kiểm tra runtime](../../.worktrees/legacy-purpose-recovery/.artifacts/ipc-prod-pr61-runtime.json) | Lifecycle outbox relay tắt từ trước, trạng thái Degraded khi readiness vẫn HTTP 200. |
| XLS-03/04 | Xuất phiếu nấu ba khách hàng ở root | BLOCKED | [WORK root](../../.planning/WORK.md), [status](../../.artifacts/mrx-evidence/20261118t153609z_d82a32/status.json), [cleanup](../../.artifacts/mrx-evidence/20261118t153609z_d82a32/cleanup.json), [PDF Excel](../../.artifacts/mrx-bep-print-20261118/phieu-nau-ca-tuan.pdf) | Chức năng và in đã được kiểm tra, còn hai lỗi strict architecture. |
| AUDIT | Đợt sửa audit/UI/Excel trong worktree khác | DONE_UNVERIFIED | [WORK audit](../../.worktrees/mrx-audit-remediation/.planning/WORK.md) ghi các đợt đã đóng | Chưa đối chiếu toàn bộ test với diff hiện tại và chưa tích hợp. |
| G7/G8 | Đo hiệu năng và endurance đầy đủ | TODO | [WORK release](../../.worktrees/legacy-purpose-recovery/.planning/WORK.md) và bản bàn giao trước | Cần xác nhận phạm vi trước khi chạy lượt đo riêng. |

## 4. Quyết định đã chốt

Thủ kho đề xuất, Quản lý duyệt và áp dụng, Admin xác nhận trực tiếp với lịch sử `ADMIN_DIRECT`. Áp dụng trên đúng dòng phiếu, lô và ngày. Giữ chứng từ gốc và tồn kho vật lý. Hai phiên native dùng chung commit sản phẩm, mỗi phiên ba khách hàng và clone riêng. Người dùng đã xác nhận quy trình và cho phép merge cùng migration của PR #61.

## 5. Các lượt thất bại cần giữ bằng chứng

| Lượt | Kết quả | Bằng chứng và cách đọc |
|---|---|---|
| ExportConsistency root | FAIL ở gate repo | `CustomerContractService` 611 dòng và `WorkflowGenerationTests.ContractsAndProduction.cs` 1523 dòng. `status.json` ghi lúc lỗi, còn `cleanup.json` xác nhận dọn clone xong. |
| Phát hành PR #61 trước sửa CodeQL | Hai thảo luận CodeQL được đóng sau sửa | Dùng các run của commit main trong mục 3 làm bằng chứng phát hành. |
| Cleanup một run cũ bị ngắt | BLOCKED tại thời điểm ghi nhận | WORK audit ghi run `20261116t112352z_332a9c` bị từ chối cleanup tự động. Hiện trạng tài nguyên của run này là UNKNOWN. |

## 6. Kiểm thử

| Case | Lượt và kết quả | Bằng chứng |
|---|---|---|
| ThreeCustomerActors | Sau lần sửa CodeQL, 1 lượt PASS, 3 lô chốt | [status](../../.worktrees/legacy-purpose-recovery/.artifacts/mrx-evidence/20261118t072257z_a11e26/status.json) |
| ThreeCustomerAdmin | Sau lần sửa CodeQL, 1 lượt PASS, 3 lô chốt và 0 yêu cầu duyệt riêng | [status](../../.worktrees/legacy-purpose-recovery/.artifacts/mrx-evidence/20261118t074018z_434693/status.json) |
| Excel tại root | 73 test Release PASS, browser 2/2 PASS, MySQL 4/4 PASS, Excel PDF 11 trang A4. Repo gate FAIL. | [WORK root](../../.planning/WORK.md), [tiêu đề theo trang in](../../.artifacts/mrx-bep-print-20261118/print-page-headers.txt) |
| G7/G8 trên candidate phát hành | NOT_RUN trong đợt này | WORK release |

Hai lượt native phát hành dùng `6c44bff6`, cùng mã sản phẩm với `e7c91267` sau khi cập nhật WORK. Kết quả trên root và audit thuộc các working tree khác.

## 7. Nguồn cần đọc

1. [AGENTS.md](../../AGENTS.md) và WORK của đúng worktree.
2. [Plan phục hồi phiếu xuất lịch sử](../../.worktrees/legacy-purpose-recovery/docs/superpowers/plans/2026-11-18-mrx-historical-purpose-recovery.md) nếu làm lại luồng duyệt.
3. [Kế hoạch xuất ba khách hàng](../superpowers/plans/2026-11-15-mrx-three-customer-export.md) nếu tiếp tục Excel.
4. [Bản bàn giao MRX trước](archive/2026-11-12-1215-mrx-worst-case-final.md) nếu tiếp tục đo tải, recovery hoặc cleanup lịch sử.

## 8. Bước tiếp theo

| Ưu tiên | Việc | Điều kiện bắt đầu và tiêu chí hoàn thành |
|---|---|---|
| 1 | Đối chiếu phạm vi được giao với từng worktree và remote main | Xác định diff liên quan, tránh lẫn thay đổi kế thừa. |
| 2 | Nếu tiếp tục XLS-03/04, điều tra hai lỗi architecture | Khi được giao, chạy lại ExportConsistency theo đúng candidate và đọc kết quả chức năng, gate, cleanup. |
| 3 | Nếu tiếp tục G7/G8, chốt phạm vi lượt đo | Báo riêng kết quả từng lane và giới hạn bằng chứng. |

## 9. Chưa biết và xung đột

UNKNOWN về chủ sở hữu từng sửa đổi local, mức độ cùng nội dung giữa hai worktree phát triển, và tài nguyên còn sót của run cũ bị ngắt. Không dùng WORK cũ ở approval-center để suy ra tình trạng PR. Bản phát hành, kết quả clone test và trạng thái code chưa commit có bằng chứng riêng.

## 10. Prompt tiếp nhận

```text
Tiếp nhận bàn giao tại D:/ki7/PRN222 Doanh Nghiệp/IPCManagement/docs/handoff/HANDOFF.md.
Bắt đầu ở READ & VERIFY. Đọc AGENTS.md và WORK của đúng worktree. Đối chiếu git và các biên nhận.
Trả lời A. mục tiêu, B. quyền hạn, C. đã và chưa kiểm chứng, D. thiếu hoặc mâu thuẫn, E. việc đầu tiên và tiêu chí hoàn thành.
PR #61 đã phát hành. Chỉ tiếp tục tác vụ người dùng giao sau khi xác minh phạm vi.
```
