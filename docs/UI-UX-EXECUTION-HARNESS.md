---
title: IPCManagement UI/UX Execution Harness
status: canonical-process
scope: frontend-and-browser-evidence
owner: GSD
last_reviewed: 2026-08-12
---

# UI/UX Execution Harness

Đây là quy trình thực thi cho một audit, sửa lỗi hoặc thay đổi UI/UX. Nó không phải một bộ rule
thứ hai: nguyên tắc normative ở [`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md), cách áp dụng theo
ngữ cảnh project ở [`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md), và số đo/gate ở
[`UI-UX-MEASUREMENT-PROTOCOL.md`](UI-UX-MEASUREMENT-PROTOCOL.md).

## 1. Phân loại trước khi làm

| Loại việc | Bằng chứng tối thiểu | Không được thay thế bằng |
|---|---|---|
| Audit/read-only UI | source + test/DOM JSON + focus/query state khi phù hợp | screenshot đơn lẻ |
| Sửa layout, text, table, modal, tab | finding có selector/metric + regression gần seam | vá CSS theo một ảnh |
| Sửa query state, permission hoặc action | source/test state + control render/eligibility | empty table hay hidden button được coi là đúng |
| Mutation/lifecycle qua UI | control → request/response → DB transition → reload render | API call riêng lẻ hoặc UI snapshot |
| CLS, INP, long task, modal timing | trace/PerformanceObserver có action và owner | elapsed wait hoặc ảnh |

Nếu chưa đủ số liệu, verdict là `NEEDS_EVIDENCE` (hoặc `UNRESOLVED` với rule chưa có oracle),
không đoán `PASS` và không sửa production chỉ vì “trông không hợp lý”.

## 2. Vòng lặp thực thi

1. Đọc `AGENTS.md`, `MEMORY.md`, sau đó chỉ mở contract cần thiết. Xác định work object, grain,
   route, actor/permission, state và mutation boundary.
2. Đối chiếu rule ID và tìm owner thấp nhất: token → shared primitive → formatter/query/action seam →
   feature layout. Không tạo shell, badge, state algebra hay formatter song song.
3. Đo hoặc kiểm tra trước khi sửa. Với layout/read-only dùng `npm run test:ui-measurements -w frontend`
   (thêm `NODE_OPTIONS=--max-old-space-size=4096` khi cần); đọc JSON report. Test/DOM/focus/query
   phải là oracle, screenshot chỉ dành cho reviewer.
4. Sửa tối thiểu đúng owner. Nếu issue có thể ảnh hưởng nhiều route, ưu tiên shared seam; page-local chỉ
   hợp lệ khi metric/source chứng minh scope cục bộ. Thêm regression tại seam gây lỗi.
   Với query-state/refresh audit, báo đúng bảng `Rule | Phán quyết | Số đo | Vị trí | Số nơi cùng lỗi`;
   `Không đo được` là verdict hợp lệ khi thiếu browser oracle hoặc project parameter.
5. Chạy focused test trước, rồi lint/build/gate phù hợp. So sánh metric trước/sau; không cập nhật visual
   snapshot chỉ để biến test xanh.
6. Với thay đổi có dữ liệu nghiệp vụ, chạy browser headed trên runtime do phiên tạo và chứng minh đủ
   control → API → DB → reload. Dùng source-line ID, không gộp action theo tên hiển thị.
7. Kết thúc bằng `git diff --check`, secret/stub scan, evidence index và cập nhật `MEMORY.md`; việc đã
   đóng chuyển sang `HISTORY.md`.

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
- Mỗi run dùng run-id mới và một manifest/result. Runner cũ phải được đọc để lấy pattern, nhưng phải thay
  scope, ID, date, lane và actor bằng state hiện hành; không chạy lại runner mang document ID hoặc credential
  cũ.
- Chỉ teardown process/browser do run tạo. Artifact authoritative/hash chỉ khai ở
  [`EVIDENCE-INDEX.md`](EVIDENCE-INDEX.md); failed attempt phải giữ failure + teardown và không dùng làm gate.

## 4. Quy ước báo cáo

Mỗi finding cần ghi: `rule`, verdict (`PASS`, `GAP`/`FAIL`, `NOT_APPLICABLE`, `NEEDS_EVIDENCE` hoặc
`UNRESOLVED`), scope/selector hoặc owner, bằng chứng đo được và hành động tiếp theo. Không dùng các kết
luận định tính như “trông ổn”, “có vẻ đẹp hơn” hay “đã hết lỗi” nếu thiếu gate sau sửa.

## 5. Handoff sang session mới

Session mới tự đọc `AGENTS.md` và `MEMORY.md`. Khi task đụng UI/UX, mở thêm file này cùng các contract
được link ở đầu file; chỉ mở evidence/artifact/runner lịch sử liên quan đúng scope hiện hành. `MEMORY.md`
phải nêu rõ lane, runtime, open blocker và bước kế tiếp; không lưu credential, token hay connection string.
