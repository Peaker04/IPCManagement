---
title: IPCManagement UI/UX Execution Harness
status: canonical-process
scope: frontend-and-browser-evidence
owner: GSD
last_reviewed: 2026-09-02
---

# UI/UX Execution Harness

Đây là quy trình thực thi cho một audit, sửa lỗi hoặc thay đổi UI/UX. Nó không phải một bộ rule
thứ hai: nguyên tắc normative ở [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md), cách áp dụng theo
ngữ cảnh project ở [`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md), kiến trúc floorplan/surface/geometry ở
[`DESIGN.md`](DESIGN.md), số đo/gate ở [`UI-UX-MEASUREMENT-PROTOCOL.md`](UI-UX-MEASUREMENT-PROTOCOL.md),
và corpus kiểm tra bổ sung ở
[`FRONT-END-CHECKLIST-INTEGRATION.md`](FRONT-END-CHECKLIST-INTEGRATION.md). Authority map tài liệu nằm ở
[`README.md`](README.md). Quy tắc chọn lane, feedback
loop, skill và ngân sách nằm ở [`LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md`](LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md).
Front-End Checklist mở rộng coverage nhưng không được ghi đè authority hoặc evidence contract của project.

## 1. Phân loại trước khi làm

| Loại việc | Bằng chứng tối thiểu | Không được thay thế bằng |
|---|---|---|
| Audit/read-only UI | source + test/DOM JSON + focus/query state khi phù hợp | screenshot đơn lẻ |
| Sửa layout, text, table, modal, tab | finding có selector/metric + regression gần seam | vá CSS theo một ảnh |
| Sửa query state, permission hoặc action | source/test state + control render/eligibility | empty table hay hidden button được coi là đúng |
| Mutation/lifecycle qua UI | control → request/response → DB transition → reload render | API call riêng lẻ hoặc UI snapshot |
| CLS, INP, long task, modal timing | trace/PerformanceObserver có action và owner | elapsed wait hoặc ảnh |

Nếu chưa đủ số liệu, verdict là `NEEDS_EVIDENCE` (hoặc `UNRESOLVED` với rule chưa có oracle),
không đoán `PASS`. Tuy nhiên screenshot có orphan control/heading, panel trắng vô nghĩa, duplicate state hoặc
broken adjacency là **candidate finding bắt buộc triage**, không được bỏ qua. Agent phải chuyển tín hiệu ảnh
thành selector/DOM geometry/source assertion trước production edit.

## 2. Vòng lặp thực thi — reproduce once, fix once, prove once

1. Chọn `L0/L1/L2` theo [`LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md`](LEAN-DELIVERY-AND-DEBUGGING-STANDARD.md).
   UI fix thông thường là L1 và làm inline; không tự gọi planner + executor + hai reviewer.
2. Đọc `AGENTS.md`, `MEMORY.md`, `DESIGN.md`, sau đó chỉ mở contract cần thiết. Ghi contract ngắn:
   `symptom | route/mode/actor/state/grain | floorplan | geometry role | red loop | owner | success | out-of-scope`.
3. Nếu input có screenshot, chạy **visual triage bắt buộc** trước khi narrow scope: đánh dấu candidate
   `orphan-control`, `orphan-heading`, `excessive-blank-surface`, `duplicate-state-surface`, `broken-adjacency`,
   `unbounded-placeholder`, `hidden-next-action`, `accessory-outside-control`, `misaligned-control-group`,
   `overlapping-hit-target`, `mobile-composition-drift`. Map candidate sang `V`/`E`/`C` rule và selector cần đo.
   Nếu ảnh cho biết viewport/zoom khác matrix hiện hành, thêm đúng kích thước đó vào reproduction scoped thay vì
   dùng matrix desktop để loại finding.
4. Lập finding ledger duy nhất và state matrix cho phần sẽ claim:
   `route × tab/view × state × actor × viewport × action`. Mọi retained lazy tab trong claim phải được
   kích hoạt; route navigation không chứng minh tab/query đó hoạt động.
5. Tạo feedback loop red-capable trước khi sửa. Với layout/read-only ưu tiên
   `npm run test:ui-measurements -w frontend` hoặc Playwright assertion DOM/network scoped. Composition loop
   phải đo bounding boxes, computed min-height/flex growth, số explanatory surfaces và adjacency của
   heading/control/content. Control có accessory tuyệt đối phải đo containment/centering và hit-test bằng
   `elementFromPoint()`; sau đó click thật ở normal, error/focus và pressed/active transition để bắt stacking
   context hoặc transform làm target không bấm được. Với focus, query ownership hoặc mutation, loop phải bắt đúng
   symptom tương ứng; screenshot khởi tạo finding nhưng không thay red loop.
6. Đối chiếu rule ID, quét toàn declared scope cho cùng anti-pattern, rồi chọn owner thấp nhất:
   token → shared primitive → formatter/query/action seam → feature layout. Dùng `frontend-checklist-global`
   để bổ sung coverage, không dump recommendation hoặc tạo scope mới thiếu evidence.
7. Sửa một lần tại owner, thêm regression tại seam. Với async layout phải gán geometry role rõ; cấm truyền
   `min-h-0` page-local hàng loạt để né default sai của shared primitive. Không gọi lỗi là “pre-existing” nếu
   không có baseline trước edit. Failure cùng owner phải được disposition ngay, không để sang vòng audit sau.
8. Chạy focused test trước, rồi lint/build/parity/checklist phù hợp. Không chạy broad aggregate từng treo
   nếu focused acceptance đã đủ; nếu broad gate là bắt buộc thì dùng bounded worker/time strategy.
9. Trước browser recheck, xác nhận exact HEAD, FE source/build, BE binary, PID/ports, operation mode,
   capabilities, database target và migration health. Runtime lệch source/binary là `INVALID_RUNTIME`, không
   phải finding UI.
10. Chạy Chrome headed đúng state matrix và viewport matrix, cộng viewport/zoom của lỗi người dùng đã báo nếu
    nằm ngoài matrix. Ngoài overflow, mỗi composition claim phải đo ordering/adjacency, surface count, geometry
    role, useful-content bounds, control/accessory containment và hit target sau state transition; với dữ liệu
    nghiệp vụ chứng minh đủ control → API → DB → reload. Dùng source-line ID, không gộp action theo tên hiển thị.
11. Recheck ledger theo `FIXED | OPEN | NEEDS_EVIDENCE | NOT_APPLICABLE | BLOCKED`; chỉ claim PASS cho cell
    có oracle đã chạy. Kết thúc bằng `git diff --check`, secret/stub scan, evidence index và cập nhật
    `MEMORY.md`; việc đã đóng chuyển sang `HISTORY.md`.

## 3. Browser và evidence

- Lấy lane, port, credential source và viewport matrix từ front matter `MEMORY.md`; không hardcode hay
  copy chúng vào rule file/runner. Chỉ mutate `ipc_lane9` khi đã được phép; không reset/seed/restore để
  làm gate xanh.
- Browser phải là Google Chrome headed, vào URL ứng dụng thật. Helper Playwright mở persistent profile
  riêng không phải tab Chrome người dùng đang có. Sau navigation/DOM change phải lấy locator mới.
- Mỗi browser run lưu screenshot trạng thái cuối cho reviewer, request API sau action, console/page error,
  failed request, và (khi có performance) CLS/long-task. Verdict đọc JSON/DOM/request/focus/trace, không
  đọc pixel ảnh để suy luận.
- Chrome DevTools MCP chỉ bật để chẩn đoán CLS, INP, long task, network/console live hoặc modal timing khi
  gate/source chưa chỉ được nguyên nhân. Nó không thay thế Playwright JSON gate và không tự bật cho mọi UI
  task.
- Mỗi run dùng run-id/timestamp mới và một manifest/result immutable. Không ghi đè failed attempt. Runner cũ
  chỉ dùng làm pattern; phải thay scope, ID, date, lane và actor bằng state hiện hành, đồng thời capture exact
  commit SHA, mode/capabilities, tab/state cells, assertion failures và `needsEvidence[]`.
- Chỉ teardown process/browser do run tạo. Artifact authoritative/hash chỉ khai ở
  [`EVIDENCE-INDEX.md`](EVIDENCE-INDEX.md); failed attempt phải giữ failure + teardown và không dùng làm gate.

## 4. Quy ước báo cáo

Mỗi finding cần ghi: `ID`, `severity`, `rule`, state cell, verdict (`PASS`, `GAP`/`FAIL`,
`NOT_APPLICABLE`, `NEEDS_EVIDENCE`, `UNRESOLVED` hoặc `BLOCKED`), scope/selector, root owner, số nơi cùng
anti-pattern, regression, bằng chứng đo được và hành động tiếp theo. Không dùng các kết luận định tính như
“trông ổn”, “có vẻ đẹp hơn” hay “đã hết lỗi” nếu thiếu gate sau sửa.

## 5. Handoff sang session mới

Session mới tự đọc `AGENTS.md` và `MEMORY.md`. Khi task đụng UI/UX, mở thêm file này cùng các contract
được link ở đầu file; chỉ mở evidence/artifact/runner lịch sử liên quan đúng scope hiện hành. `MEMORY.md`
phải nêu rõ lane, runtime, open blocker và bước kế tiếp; không lưu credential, token hay connection string.
