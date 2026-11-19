# Bàn giao: MRX worst-case plan — kết quả cuối, blocker vận hành và cleanup sau hủy

## Đọc trước
- Handoff ID: `2026-11-12-1215-mrx-worst-case-final`
- Thời điểm (múi giờ): 2026-11-12 12:15 +07:00
- Phiên/agent giao: Pi parent, native execution; session ID `UNKNOWN`
- Mục tiêu: bàn giao trạng thái thật của kế hoạch MRX worst-case M01–M30/C01–C07/T0–T11 sau khi dừng campaign, gồm bug đã sửa, bằng chứng PASS và blocker còn lại.
- Chế độ làm việc: `HANDOFF ONLY`; phiên nhận bắt đầu `READ & VERIFY`, không tự chạy campaign hoặc sửa sản phẩm.
- Điểm dừng: `.planning/WORK.md` đã về `IDLE / USER_INTERRUPTED / PARTIAL_EVIDENCE_RETAINED`; user yêu cầu dừng và báo cáo. Run cuối bị user hủy trong endurance, residual disposable resources đã cleanup và có receipt thủ công.
- Việc đầu tiên tiếp theo: đối chiếu WORK, git snapshot và cleanup receipt của run `20261112t035659z_5b23bc`; không chạy lại endurance nếu user chưa yêu cầu rõ.
- Blocker chính: 60 phút endurance chưa đạt, native zoom bị foreground block, off-host recovery thiếu provider packet, outbox thiếu delivery consumer, strict architecture gate FAIL7, T11 còn matrix gaps.
- `.planning/WORK.md` là sole task-state owner; handoff này chỉ là snapshot và prompt tiếp nhận.

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu: user duyệt kế hoạch MRX worst-case trước đó; ở lượt cuối user yêu cầu “xong phần này là dừng và báo cáo lại toàn bộ plan những bug, lỗi đã tìm ra và fix”, sau đó hủy run vì không thấy điểm kết thúc, rồi yêu cầu `context-handoff giao`.
- Tiêu chí hoàn thành đã chốt: báo cáo PASS/FAIL/NOT_RUN/NOT_REACHED/NEEDS_EVIDENCE/BLOCKED trung thực; owner tests, selected runtime, repository gates và full qualification tách biệt; không gọi full PASS khi T11 chưa đủ.
- Được làm trong phiên đã kết thúc: isolated disposable MRX evidence qua `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`; sửa owner/product/support tối thiểu đã được user duyệt; cleanup chính xác tài nguyên run-owned.
- Không được làm khi tiếp nhận nếu chưa có yêu cầu mới: source DB mutation, main FE/BE restart, deploy/install, git reset/restore/clean/stash/commit/push, tự gọi subagent/external CLI, hạ RBAC/assertion/threshold, allowlist/baseline padding, tạo master/stock fixture, suy đoán provider credentials/restore target/fault mechanism.
- DOM-MODE-1 vẫn bắt buộc: `DEFAULT != MATERIAL_RECONCILIATION`; MRX không được gộp physical stock/master-data workflow.
- Người có quyền đổi phạm vi: user/operator hiện tại. Handoff không tự cấp quyền.

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch / commit | `main...origin/main`; HEAD `bbd55009a77a6e83f79027a7784deb4b7f323928`; `git log -5` lưu tại `.artifacts/context-handoff-git-log.log` |
| Staged / unstaged / untracked | Index rỗng. Trước khi archive/write handoff: 167 modified, 50 untracked, tổng 217 entries. Full status: `.artifacts/context-handoff-git-status.log`; diff stat: `.artifacts/context-handoff-diff-stat.log`; cached stat rỗng: `.artifacts/context-handoff-cached-stat.log`. Handoff/archive vừa viết làm snapshot thay đổi thêm. |
| Thay đổi agent nhận chưa thấy được | Toàn bộ dirty/untracked chỉ ở working tree local, chưa commit/push. Phần lớn là inherited work từ nhiều phiên; attribution từng dòng ngoài scope là `UNKNOWN`. Không được xóa/rollback. |
| Build / bản đã kiểm thử | Candidate dirty tree được runner build Release theo từng evidence run. Latest completed HTTP evidence thuộc run `20261112t035659z_5b23bc`; endurance của chính run này bị hủy. HEAD một mình không định danh candidate. |
| Môi trường, runtime | Windows; Pi native; local MySQL 9.5.0 port 3306. Tại snapshot: chỉ listener 3306, Chrome count 0; không có FE/BE isolated listener 5174/5263 hoặc main 5173/5262. Observation UTC `2026-11-12T05:15:54.6641652Z`. |
| Dữ liệu thử, migration | Source `ipcmanagement`, historical 92 migrations, head `20261107183023_FreezeMrxBomConversionRates`, InnoDB. Run cuối clone/subordinate/principal/temp đã xóa và absence-query PASS. Không migration/source mutation trong cleanup. |
| Tiến trình đang chạy hoặc bị ngắt | Final Quantitative run bị user hủy trong endurance tại last persisted sample 1093s. Không còn Chrome/app process/listener. Không có command cần resume. |
| MCP / skill / cấu hình | Không dùng MCP/subagent. Skills đã dùng: systematic-debugging, executing-plans, test-audit, ipc-test-audit, ipc-code-review, ipc-ui-review, verification-before-completion, ponytail, context-handoff. Browser evidence dùng Playwright runner. |

### Cảnh báo workspace
- Có untracked file `NUL` xuất hiện do lệnh snapshot `where.exe mysql 2>NUL` chạy trong Git Bash ở lượt cleanup/handoff. Đây là artifact ngoài ý muốn của phiên này; **không xóa** vì project cấm tự xóa untracked. Cần user cho phép trước khi remove.
- Existing dirty tree rất lớn; không gán toàn bộ diff cho MRX worst-case plan.

## 3. Tiến độ

| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| P1 | Design/plan M01–M30, C01–C07, T0–T11 | DONE_VERIFIED | `docs/superpowers/specs/2026-11-11-mrx-worst-case-testing-design.md`; `docs/superpowers/plans/2026-11-11-mrx-worst-case-testing.md` | Không |
| P2 | Weekly import/scope/menu-code/completion product repairs | DONE_VERIFIED | owner tests và selected runtime được ghi trong WORK; files liệt kê mục 7 | Broad full BE vẫn có historical failures |
| P3 | Session unknown-outcome UUID repair | DONE_VERIFIED | runs `20261112t011715z_5fa723`, `20261112t012416z_850f17`, `20261112t012737z_0dad47` | Broader M29/M30 matrix |
| P4 | T7 ExportConsistency | DONE_VERIFIED | `.artifacts/mrx-evidence/20261111t173118z_393014/`; 4 schedules PASS | Approved writer-latency budget chưa có |
| P5 | T8 Admission selected matrix | DONE_VERIFIED | `.artifacts/mrx-evidence/20261111t174833z_4cd144/`; 5/5 PASS | Không phải full security matrix |
| P6 | Golden + five-actor 120s smoke | DONE_VERIFIED | runs `20261112t020150z_0ae620`, `20261112t035659z_5b23bc`; Golden/Smoke PASS | Không thay thế endurance |
| P7 | HTTP 5 VU/10m | DONE_VERIFIED | final run k6 summary: 875 requests, 860 checks/iterations, failure rate 0, checks rate 1, p95 13.981ms; all declared thresholds PASS | Không |
| P8 | Desktop viewports + axe | DONE_VERIFIED | `.artifacts/mrx-evidence/20261112t020150z_0ae620/runtime/desktop-axe.json`; four viewports PASS, axe `[]` | Native zoom |
| P9 | 60-minute endurance | BLOCKED | Earlier actual renderer crash at ~28.9m in `20261112t021343z_b54fca`; final run user-interrupted at 1093s with health200/no observed crash | 60m clean run plus renderer dump/metrics if crash recurs |
| P10 | Native zoom | BLOCKED | `Set-MrxChromeZoom.ps1` refused keys because Chrome lacked foreground ownership | Stable dedicated foreground environment |
| P11 | Off-host recovery M28b | BLOCKED | `.artifacts/mrx-fullplan-recovery-preflight/recovery-preflight.json` | Provider adapter/receipt/object version/key/DCR/restore target/teardown approval |
| P12 | Outbox external delivery M28a | BLOCKED | worker/options/source review and owner tests; relay disabled, only validation consumer | Enabled delivery/ack consumer and isolated runtime schedule |
| P13 | Strict architecture gate | BLOCKED | `.artifacts/mrx-fullplan-final-verify.log`; FAIL7 | Separately approved split campaign; no baseline padding |
| P14 | Final T11 acceptance | BLOCKED | WORK final verdict `OPERATIONAL_QUALIFICATION_BLOCKED` | Identity, atomicity, concurrency, quantity, role/mode, recovery, UI/session and cleanup gaps listed in mục 8 |
| P15 | Interrupted final-run cleanup | DONE_VERIFIED | `.artifacts/mrx-evidence/20261112t035659z_5b23bc/manual-interrupt-cleanup.json`; schemas0/principal0/temp absent; `.artifacts/mrx-crash-resume-final.log` | Automatic after-receipts missing because parent shell was killed |

## 4. Quyết định và giả thuyết

| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| D1 | Owner tests, selected runtime PASS, architecture gate và full qualification không cộng gộp thay thế nhau | đã chốt | Plan + WORK + final report | User/agent execution contract |
| D2 | Unknown Session outcome phải reuse canonical command UUID; malformed/legacy/foreign drafts fail closed | đã chốt | Exact RED then three PASS runs | User explicitly authorized product fix |
| D3 | Cache chỉ là display, mutation cần fresh scope/version authority | đã chốt | `useMrxSourceEdit.ts` owner repair | Approved scope |
| D4 | Outbox payload validation không phải external delivery | đã chốt | Source owner review | Plan acceptance boundary |
| D5 | Local disposable recovery không thay off-host DR | đã chốt | Recovery preflight missing external packet | Plan acceptance boundary |
| D6 | Browser crash là failure evidence, không tự kết luận product memory leak khi thiếu dump/renderer metrics | đã chốt | First endurance crash lacks dump; later partial runs | Systematic debugging |
| D7 | Final user-interrupted endurance là `NOT_REACHED`, không PASS và không product FAIL | đã chốt | Last sample1093s, user cancellation | User action + artifacts |
| D8 | Không pad architecture baseline hoặc refactor unrelated owners chỉ để tạo qualification PASS | đã chốt | FAIL7 retained | Governance rules |
| D9 | Hard-cancel runner cleanup gap cần xử lý riêng nếu muốn safe automatic cancellation | đề xuất | Parent kill left schemas/principal/private credentials; manual cleanup required | Chưa được user duyệt sửa |

## 5. Đã thử nhưng không thành công

| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| 60m endurance run đầu | Manager `page.goto: Page crashed` khoảng 1646s/~28.9m | `.artifacts/mrx-evidence/20261112t021343z_b54fca/` | Capture Chrome renderer metrics/crash dump in governed environment |
| Fresh run sau crash | Browser/context closed trước first business navigation | `.artifacts/mrx-evidence/20261112t025226z_c6b30a/` | Stable host/browser admission |
| HTTP run trước fix | K6 setup timeout60s trong khi 5 login ×13s cần >=65s | `.artifacts/mrx-evidence/20261112t030420z_800d1f/runtime/k6.log` | Đã sửa `setupTimeout:'90s'`; HTTP sau đó PASS |
| Instrumented endurance | Observer race: Chrome PID biến mất giữa CDP enumeration và `Get-Process -Id`, dừng test ở ~18m | `.artifacts/mrx-evidence/20261112t031407z_cd3d6d/` | Đã sửa current-process snapshot/filter; không được chứng nhận đủ60m |
| Final corrected endurance | User hủy tại ~18m13s vì không thấy điểm kết thúc | `.artifacts/mrx-evidence/20261112t035659z_5b23bc/` | Chỉ chạy lại nếu user yêu cầu rõ và chấp nhận 60m + setup phases |
| Native zoom | Fail-closed vì dedicated Chrome không sở hữu foreground | run `20261112t020150z_0ae620` | Stable foreground ownership; không gửi key mù |
| Full `npm run verify` | Fail-fast tại strict architecture growth | `.artifacts/mrx-fullplan-final-verify.log` | Approved architecture split; không sửa baseline |

## 6. Kiểm thử
- Tầng / vòng hiện tại: plan đã dừng ở final qualification assessment; không có quy tắc 7 tầng/3 lượt được user chốt cho campaign này. Không bịa số lượt.
- Test plan: `docs/superpowers/plans/2026-11-11-mrx-worst-case-testing.md`.
- Kết quả thuộc candidate dirty tree tại từng run; không thể chỉ định danh bằng HEAD.
- Kết quả có thể đã cũ vì working tree rộng và inherited changes có thể tiếp tục thay đổi sau handoff. Phiên nhận phải đối chiếu candidate receipts trước claim mới.

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---:|---|---|
| Full FE owner suite | Standalone frontend suite | 1 final recorded milestone | PASS 605/605, 52 files | `.artifacts/mrx-fullplan-final-fe.log` |
| Focused FE auth/API/scope | Auth + ApiContracts + MrxBatchScopeAuthority | 1 corrected invocation | PASS 49/49 | WORK ledger |
| Focused backend mode/outbox/fence | Selected dotnet filters | 1 | PASS 26/26 | WORK ledger |
| Runner contracts | `MrxDisposableEvidenceContractTests` | Multiple after support changes | PASS 33/33 latest before final run | `.artifacts/mrx-crash-resume-contracts.log` |
| T7 | ExportConsistency four schedules | Several setup failures then one full result | PASS latest | `20261111t173118z_393014` |
| T8 | Admission | One qualifying result after selector repair | PASS 5/5 | `20261111t174833z_4cd144` |
| Session | Unknown draft + response loss/replay | RED reproduction + 3 PASS runs | PASS after fix | run IDs in P3 |
| Golden | Full lifecycle | Multiple support corrections; latest runs PASS | PASS | `20261112t020150z_0ae620`, `20261112t035659z_5b23bc` |
| HTTP 5VU/10m | K6 exact clone/scope | Timeout pre-load, then 2 PASS runs | PASS latest | `20261112t031407z_cd3d6d`, `20261112t035659z_5b23bc` |
| Endurance60m | Five active actors | Crash, startup fail, observer fail, user interrupt | FAIL/FAIL/FAIL/NOT_REACHED; no PASS | run IDs in mục5 |
| Desktop/axe | Four desktop sizes + axe | 1 selected qualifying result | PASS | `20261112t020150z_0ae620` |
| Native zoom | Windows foreground-gated probe | 1 selected attempt | BLOCKED | same run |
| Recovery/outbox | Read-only preflight + local owners | 1 assessed slice | BLOCKED externally/capability; local owners PASS | recovery preflight + WORK |
| Full repository verify | `npm run verify` | 1 final recorded | FAIL architecture gate | `.artifacts/mrx-fullplan-final-verify.log` |

Other final gates already recorded PASS: `lint:fe`, `build:fe`, strict browser TypeScript, `depcruise:fe` (168 modules/936 deps, zero violation), `git diff --check`. Historical broad backend five failures remain unresolved/re-uncertified; see WORK and section 9.

## 7. Nguồn cần đọc

| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| 1 | `AGENTS.md` và `.planning/WORK.md` | Governance + sole live state; top section has final crash-continuation verdict | đã kiểm tra |
| 2 | `docs/superpowers/plans/2026-11-11-mrx-worst-case-testing.md` và matching design spec | Approved matrix/acceptance boundaries | đã kiểm tra |
| 3 | `.artifacts/mrx-evidence/20261112t035659z_5b23bc/manual-interrupt-cleanup.json` | Exact post-cancel cleanup proof | đã kiểm tra |
| 4 | `.artifacts/mrx-evidence/20261112t035659z_5b23bc/{qualification-phases.json,runtime/k6-summary.json,runtime/endurance-resources.json}` | Golden/smoke/HTTP PASS and partial endurance truth | đã kiểm tra |
| 5 | `.artifacts/mrx-evidence/20261112t021343z_b54fca/` | Actual earlier renderer crash | đã kiểm tra trong prior phase |
| 6 | `.artifacts/mrx-fullplan-final-{fe,lint,build,depcruise,diff-check,verify}.log` | Final repository verification split | đã kiểm tra |
| 7 | `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts` và `frontend/tests/e2e-mrx/specs/g5-async-timeout.spec.ts` | Approved Session UUID product repair/keeper | đã kiểm tra |
| 8 | `frontend/tests/e2e-mrx/specs/g8-five-user-endurance.spec.ts`; `tools/perf/k6/mrx-five-user.js` | Crash metrics, observer fix, setup timeout | đã kiểm tra |
| 9 | `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`; `MrxEvidenceSafety.ps1`; `docs/OPERATIONS.md` | Sole disposable lifecycle; read fully before any new run/change | đã kiểm tra |
| 10 | `.artifacts/context-handoff-{git-status,git-log,diff-stat,cached-stat}.log` | Current git snapshot | đã kiểm tra |

## 8. Bước tiếp theo

| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| 1 | READ & VERIFY handoff/WORK/git/receipts, trả A–E cho user | Không cần mutation | Sai lệch được nêu rõ; không sửa code/run test |
| 2 | Hỏi user có muốn chỉ lưu trạng thái hay mở scope mới | Sau bước1 | Có yêu cầu rõ, không suy diễn từ handoff |
| 3 | Nếu endurance được yêu cầu lại: công bố trước thời lượng Golden+smoke+HTTP+60m, dùng stable host, renderer dump/metrics và exact cleanup | Explicit authorization; đủ RAM/disk/foreground; fresh Preflight | 60m reached hoặc exact failure with dump/metrics; all receipts clean |
| 4 | Nếu cần full qualification: nhận provider recovery packet và enabled delivery consumer | Owner cung cấp adapter/receipt/key/DCR/target + outbox capability | M28a/M28b runtime evidence PASS/FAIL trung thực |
| 5 | Nếu cần repository gate sạch: architecture split campaign riêng | Explicit scope approval | Seven strict findings resolved without baseline padding; fresh verify |
| 6 | Chạy chỉ missing T11 owners/J1/J2 | Các prerequisites trên đủ và exact safe M26/M27 mechanism được duyệt | Mỗi AC có owner evidence; không rerun selected PASS chỉ để tăng count |
| 7 | Xử lý accidental `NUL` | User cho phép xóa đúng file | `NUL` absent, không tác động untracked khác |

## 9. Chưa biết và xung đột
- UNKNOWN: attribution chính xác của toàn bộ 167 modified/50 untracked entries; phần lớn inherited. Không rollback.
- UNKNOWN: root cause renderer crash ở ~28.9m; không có dump/renderer metrics của run đó.
- UNKNOWN: source/candidate after-manifest của run bị user hủy; parent shell chết trước automatic receipt. Cleanup thủ công chỉ xóa exact run-owned resources, không tạo synthetic source proof.
- Historical broad backend failures chưa tái chứng nhận: `FrontendPermissionVocabularyTests...`, `DishBomImportServiceTests...ProjectOnlyContributorLinked...`, `WeeklyMenuLifecyclePa2RegistrySourceTests...`, `Phase30DiscoveredConsumerBijectionTests...`, `WorkflowGenerationTests.MenuVersionRollback...`.
- Strict architecture FAIL7: `Reconciliation.test.tsx` 2407; `Warehouse.test.tsx` 1932; `WeeklyMenu.test.tsx` 1852; `ReconciliationWarehouseIssueApplicationPathTests.cs` 1526; `useReconciliationWorkspace.ts` 703 new debt; `ReconciliationBatchService` 826 vs696; `MenuScheduleService` 605 new debt.
- T11 gaps: M17/M23 identity variants; rollback/reactivation/full M02; first-use identical MySQL/M26 faults; full quantity legacy/no-stock variants; full M16/live M19; approved latency budget/full M23; native zoom/M29/M30; recovery/outbox; clean architecture gate.
- Xung đột cần tránh: final run Golden/smoke/HTTP PASS nhưng endurance `NOT_REACHED`; không được gọi toàn run PASS. Earlier renderer crash remains valid failure evidence and không bị partial healthy runs xóa.
- Rủi ro nếu làm tiếp khi chưa giải quyết: hard-cancel có thể để lại clone/principal/private credentials; recovery/outbox evidence có thể bị giả lập sai; architecture baseline có thể bị pad; source/main runtime có thể bị tác động ngoài scope.

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:/ki7/PRN222 Doanh Nghiệp/IPCManagement/docs/handoff/HANDOFF.md.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md, .planning/WORK.md (sole state owner), rồi file bàn giao; sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: giữ nguyên kết luận MRX worst-case `OPERATIONAL_QUALIFICATION_BLOCKED`, xác minh evidence/cleanup và chỉ mở scope mới khi user yêu cầu rõ.
Điều cấm: không tự chạy lại endurance/campaign, không source DB mutation/main restart/install/deploy/subagent/external CLI/commit/reset/clean/stash, không pad gate hoặc hạ assertion.
Việc đầu tiên: xác minh WORK, git snapshot, run 20261112t035659z_5b23bc và manual-interrupt-cleanup receipt; báo mọi sai lệch. Final run có Golden/smoke/HTTP PASS nhưng endurance bị user hủy ở ~18m13s, không phải endurance PASS hay product FAIL.
```
