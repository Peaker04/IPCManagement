---
title: IPCManagement Lean Delivery and Debugging Standard
status: canonical-process
scope: all-engineering-tasks
owner: GSD
last_reviewed: 2026-08-28
---

# Lean delivery và debugging standard

Tài liệu này chuẩn hóa cách thực thi để GSD vẫn là process owner nhưng không biến mọi việc thành một
workflow nhiều agent, nhiều plan và nhiều vòng review tốn token. Mục tiêu là tạo **một feedback loop sắc,
một owner sửa lỗi, một gate đóng việc**. Artifact trạng thái vẫn thuộc GSD; discipline kỹ thuật có thể đến
từ skill chuyên biệt.

## 1. Bài học từ các session gần đây

Các lỗi lặp lại không đến từ thiếu agent mà từ feedback loop và scope chưa khóa:

1. Audit một viewport rồi sửa; lần chạy đủ viewport mới phát hiện coverage thiếu.
2. Audit chỉ mở route nhưng không kích hoạt mọi retained tab/state; lỗi Admin Audit `409` bị phát hiện muộn.
3. Sửa FE trước khi xác nhận runtime FE/BE cùng HEAD; source mới chạy với API binary cũ tạo kết luận sai.
4. Finding không có một ledger duy nhất nên cùng vùng bị audit/sửa nhiều lượt.
5. Broad aggregate và reviewer fan-out chạy trước khi focused loop xanh, gây timeout hoặc vượt token budget.
6. Failure bị gọi là “pre-existing” mà không có baseline trước thay đổi; test stale chỉ được sửa ở vòng sau.
7. Browser runner ghi đè artifact hoặc thiếu mode/capability/focus/request fields, nên không thể dùng để close.
8. GSD planner/executor/reviewer được gọi cho hotfix có seam rõ, làm tăng coordination cost nhưng không tăng
   độ chắc chắn.

Từ đây, **không thêm agent để bù cho harness yếu**. Trước tiên phải làm harness red-capable và đủ state matrix.

## 2. Ba execution lane

| Lane | Khi dùng | GSD artifact | Subagent mặc định | Gate |
|---|---|---|---|---|
| **L0 Direct** | Docs/rules, test expectation, copy hoặc fix ≤3 file, một seam, không mutation | Cập nhật `MEMORY.md` nếu trạng thái thay đổi; không tạo phase/plan mới | Không | Focused check + `git diff --check` |
| **L1 Focused** | Bug/UI fix một feature hoặc một contract, có thể chạm FE/BE nhưng feedback loop rõ | `gsd-quick` hoặc plan hiện hành; một finding ledger | Không; tối đa một reviewer sau khi loop xanh | Red-capable regression → fix → focused suite → browser/DB gate phù hợp |
| **L2 Controlled** | Migration/protected data, auth, public contract, multi-feature phase, E2E mutation | GSD phase/checkpoint/verification đầy đủ | Chỉ vai trò khác nhau và có output tiêu thụ rõ | Backup/preflight + source/test + API/DB/browser chain + closeout |

Quy tắc nâng lane: chỉ nâng khi xuất hiện trust boundary, migration/data mutation, nhiều owner độc lập hoặc
không thể tạo feedback loop tại seam hiện tại. Không nâng lane chỉ vì task “quan trọng” hoặc codebase lớn.

## 3. Skill routing tối thiểu

| Nhu cầu | Skill | Không dùng khi |
|---|---|---|
| Sửa/review code | `karpathy-guidelines` | Không bỏ qua; đây là guard scope |
| Bug khó, runtime sai, lỗi lặp | `diagnosing-bugs` | Không cần cho typo/copy rõ ràng |
| Regression tại public seam | `tdd` | Không viết source-string test nếu có thể test behavior |
| UI audit/fix | project UI contracts → `frontend-checklist-global` | Không dump 385 rule; chỉ finding có bằng chứng |
| React/shadcn/Tailwind implementation | `ui-styling` | Không dùng để redesign khi task chỉ sửa logic/query |
| Pattern UX chưa có quyết định project | `ui-ux-pro-max` | Không dùng để ghi đè SAP Fiori/project rules |
| Template Studio/range/diagnostics | `sketch-findings-ipcmanagement` | Không áp cho Warehouse/Reconciliation chung |
| Docs canonical | `gsd-docs-update` discipline | Không cần chạy full multi-agent docs generation cho một edit nhỏ |
| GSD full phase | `gsd-plan/execution/verification` | Không dùng cho L0/L1 đã có seam và acceptance rõ |

`qa` chỉ dùng khi mục tiêu là thu thập/file issue; không dùng để implement fix. GitNexus vẫn opt-in theo
`AGENTS.md` và không được gọi để thay feedback loop source/test.

## 4. Contract trước khi sửa

Trước production edit, ghi ngắn gọn trong commentary hoặc finding ledger:

```text
Symptom      : điều người dùng thấy sai
Exact scope  : route + operation mode + actor + state + grain
Red loop     : một command/script đã chạy và có thể bắt đúng symptom
Owner        : token | primitive | formatter/hook/API seam | feature page
Success      : assertion/metric cụ thể sau sửa
Out of scope : phần không được thay đổi
```

Nếu chưa có `Red loop`, không được nhảy sang giả thuyết/fix, trừ lỗi compile hoặc literal hiển nhiên. Với UI,
screenshot là đầu vào triage hợp lệ: candidate defect rõ không được bỏ qua. Tuy nhiên red loop vẫn phải là
Playwright DOM/network/geometry assertion hoặc behavior test có thể lặp lại; screenshot không tự thay red loop.

## 5. Finding ledger và systemic scan

Một task dùng một ledger duy nhất:

```text
ID | Severity | Rule | State cell | Evidence | Root owner | Same-pattern count | Regression | Verdict
```

Quy trình:

1. Gom finding trùng nguyên nhân trước khi sửa.
2. Quét toàn declared scope cho cùng anti-pattern (`rg`, AST/source-aware test hoặc query ownership map).
3. Sửa một lần ở owner thấp nhất.
4. Thêm regression tại owner; page-level test chỉ khi lỗi thực sự page-local.
5. Recheck mọi cell bị ảnh hưởng; không mở audit breadth mới sau khi code đã sửa, trừ khi gate phát hiện lỗi mới.

Không dùng số lượng finding làm thước đo chất lượng. Một blocker có evidence quan trọng hơn 20 recommendation.

## 6. UI state matrix bắt buộc

Trước browser run, lập matrix cho phạm vi được claim:

```text
route × tab/view × state × actor × viewport × action
```

State tối thiểu cần disposition: `uninitialized`, `loading`, `ready`, `refreshing`, `empty`, `forbidden`,
`error`; thêm `prerequisite`, `conflict`, `success` khi có workflow. Không phải mọi cell đều phải chạy trong
một task, nhưng cell không chạy phải là `NOT_APPLICABLE` hoặc `NEEDS_EVIDENCE`, không được suy thành PASS.

Mỗi retained tab phải được kích hoạt ít nhất một lần trong browser gate nếu report claim tab đó hoạt động.
Route navigation đơn thuần không chứng minh lazy tab/query owner.

## 7. Runtime identity gate

Trước mọi kết luận browser:

1. Xác nhận branch/HEAD và `git status`.
2. Xác nhận listener PID thuộc run.
3. Xác nhận FE source/build và BE DLL đều từ HEAD hiện tại; rebuild/restart nếu production symbol đổi.
4. Capture `GET /api/system-operation-mode`: exact mode, version và capabilities.
5. Capture readiness: database target và migration health; `Degraded` phải được phân tích theo check.
6. Chỉ sau đó mới login/navigate/measure.

Nếu FE/BE profile mismatch, verdict là runtime invalid; không audit layout trên runtime đó.

## 8. Browser evidence contract

Mỗi run có thư mục immutable theo timestamp/run-id; không ghi đè failed attempt. Manifest tối thiểu:

- commit SHA, branch, runtime PID/ports, operation mode/capabilities;
- viewport matrix lấy từ `MEMORY.md`;
- route/tab/state cells đã chạy;
- DOM geometry/overflow và selected tabpanel semantics;
- request/response, prohibited request list, console/page/request failure;
- focus initial/trap/return/Escape khi dialog/drawer thuộc scope;
- control → request → DB transition → reload render khi mutation;
- CLS/long task/INP chỉ khi performance thuộc claim;
- screenshot cuối chỉ để reviewer xem.

Runner phải fail exit code khi assertion fail. JSON có `verdict`, `failures[]`, `needsEvidence[]`; không chỉ in
counter rồi để agent tự diễn giải.

## 9. Recheck và định nghĩa Done

Thứ tự cố định:

1. Regression tại seam từng đỏ nay xanh.
2. Same-pattern scan không còn undispositioned occurrence.
3. Focused feature suite xanh.
4. Lint/build/API parity/checklist khi diff liên quan.
5. Browser/DB chain đúng matrix và claim.
6. Baseline comparison: lỗi mới không được gọi “pre-existing” nếu không có evidence trước edit.
7. `git diff --check`, secret/stub scan, declared-scope diff.

Verdict cuối theo từng claim, không theo cảm giác chung:

- `PASS`: oracle phù hợp đã chạy và sạch.
- `FAIL/OPEN`: defect còn tồn tại.
- `NEEDS_EVIDENCE`: implementation có thể đúng nhưng chưa chạy oracle cần thiết.
- `BLOCKED`: thiếu authorization/data/runtime prerequisite.

Task chỉ đóng khi không còn blocker trong **declared scope**. `NEEDS_EVIDENCE` ngoài scope phải ghi rõ, không
kéo task vào vòng audit vô hạn.

## 10. Ngân sách và subagent

- L0/L1: làm inline; không parallel audit trùng scope.
- Chỉ dùng subagent khi có workstream độc lập hoặc cần review độc lập sau khi implementation đã xanh.
- Reviewer read-only không được chạy full repo nếu diff/finding ledger đã chỉ scope.
- Một workflow chỉ có một writer cho một cwd.
- Hard timeout phải ngắn hơn session budget; broad command từng treo không được chạy lại không giới hạn.
- Khi reviewer/subagent hết token sau khi writer hoàn tất, parent đọc diff + ledger và chạy gate còn thiếu;
  không khởi động lại toàn bộ workflow.
- Không dùng reviewer output thay test/browser oracle.

## 11. Anti-pattern bị cấm

- Fix từ screenshot trước khi có selector/metric/state reproduction, **hoặc bỏ qua candidate defect rõ trên
  screenshot chỉ vì ảnh không phải oracle**. Đúng quy trình là ảnh → candidate rule → DOM/source red loop → fix.
- Chạy route nhưng không mở retained tab rồi claim query isolation.
- Sửa page-local khi cùng lỗi tồn tại ở shared primitive/formatter/query seam.
- Tạo formatter/status/dialog/table shell song song.
- Dismiss failure là “pre-existing” mà không có baseline.
- Rebuild frontend nhưng giữ backend binary cũ hoặc ngược lại.
- Ghi đè evidence failed run.
- Chạy full GSD phase, council hoặc nhiều reviewer cho hotfix một seam.
- Claim UI PASS khi populated/mutation/focus/performance cell chưa được chạy.
