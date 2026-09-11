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
loop, skill và ngân sách nằm ở [`harness/DELIVERY.md`](harness/DELIVERY.md).
Front-End Checklist mở rộng coverage nhưng không được ghi đè authority hoặc evidence contract của project.

## 1. Phân loại trước khi làm

| Loại việc | Bằng chứng tối thiểu | Không được thay thế bằng |
|---|---|---|
| Tạo/sửa/loại bỏ UI — design readiness | brief + actor/action matrix + walkthrough theo DESIGN §7; delta/link cho phần không đổi | chọn component/màu trước khi hiểu tác vụ |
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

1. Chọn `L0/L1/L2` theo [`harness/DELIVERY.md`](harness/DELIVERY.md).
   UI fix thông thường là L1 và làm inline; không tự gọi planner + executor + hai reviewer.
2. Đọc `AGENTS.md`, `MEMORY.md`, [đầu mối rule](UI-PHILOSOPHY.md) và `DESIGN.md`, sau đó chỉ mở contract
   liên quan. **Khóa design brief, actor/action matrix và walkthrough ở DESIGN §7 trước implementation**;
   lưu trong cùng GSD plan/ledger, không tạo design workflow khác. Contract debug bổ sung:
   `symptom | route/mode/actor/state/grain | floorplan | geometry role | red loop | owner | success | out-of-scope`.
   UI mới dùng acceptance scenario red-capable; không giả tạo một reproduction trên route chưa tồn tại.
   Thiếu quyết định outcome/quyền/data safety thì dừng phần phụ thuộc và hỏi owner, không vẽ/coding để lấp chỗ trống.
3. Nếu input có screenshot, chạy **visual triage bắt buộc** trước khi narrow scope: đánh dấu candidate
   `orphan-control`, `orphan-heading`, `excessive-blank-surface`, `duplicate-state-surface`, `broken-adjacency`,
   `unbounded-placeholder`, `hidden-next-action`, `accessory-outside-control`, `misaligned-control-group`,
   `overlapping-hit-target`, `mobile-composition-drift`. Map candidate sang `V`/`E`/`C` rule và selector cần đo.
   Nếu ảnh cho biết viewport/zoom khác matrix hiện hành, thêm đúng kích thước đó vào reproduction scoped thay vì
   dùng matrix desktop để loại finding.
4. Lập finding ledger duy nhất và state matrix cho phần sẽ claim:
   `route × tab/view × state × actor × viewport × action`. Trước audit phải khai báo **claim envelope và mẫu số**:
   `claimId | product scope | mounted routes | retained views | required states/actors/viewports/actions |
   applicable rule groups | requiredCells | allowed NOT_APPLICABLE rationale`. Mọi retained lazy tab trong claim
   phải được kích hoạt; route navigation không chứng minh tab/query đó hoạt động. Mỗi cell bắt buộc phải xuất hiện
   đúng một lần trong `PASS | FAIL/OPEN | NEEDS_EVIDENCE | NOT_APPLICABLE | BLOCKED`; thiếu cell là lỗi report/gate,
   không được ngầm coi là PASS. Route/view ngoài envelope là `NOT_CLAIMED`, không phải PASS.
5. Tạo feedback loop red-capable trước khi sửa. Với layout/read-only ưu tiên
   `npm run test:ui-measurements -w frontend` hoặc Playwright assertion DOM/network scoped. Composition loop
   phải đo bounding boxes, computed min-height/flex growth, số explanatory surfaces và adjacency của
   heading/control/content. Control có accessory tuyệt đối phải đo containment/centering và hit-test bằng
   `elementFromPoint()`; sau đó click thật ở normal, error/focus và pressed/active transition để bắt stacking
   context hoặc transform làm target không bấm được. Với focus, query ownership hoặc mutation, loop phải bắt đúng
   symptom tương ứng; screenshot khởi tạo finding nhưng không thay red loop.
6. Đối chiếu rule ID, discovery cùng anti-pattern và callsite của owner trên codebase; ghi các occurrence ngoài
   declared scope vào cùng ledger, không tự mở implementation/acceptance breadth. Thay đổi shared owner phải
   bao gồm các consumer bị ảnh hưởng trong regression scope hoặc chặn phần chưa đủ authority/evidence.
   Sau đó chọn owner thấp nhất:
   token → shared primitive → formatter/query/action seam → feature layout. Dùng `frontend-checklist-global`
   để bổ sung coverage, không dump recommendation hoặc tạo scope mới thiếu evidence.
7. Sửa một lần tại owner, thêm regression tại seam. Khi finding thiếu rule, rule mơ hồ hoặc lỗi tái diễn,
   kích hoạt vòng phản hồi ở §4.1 trong cùng task; không chờ người dùng yêu cầu cập nhật rule lần nữa.
   Với async layout phải gán geometry role rõ; cấm truyền
   `min-h-0` page-local hàng loạt để né default sai của shared primitive. **Không được ổn định bảng phân trang
   bằng row giả, `rowCapacity`, `min-height` theo page size hoặc khoảng trắng dự trữ**: các cách đó chỉ đổi page
   jump thành blank surface. Giữ content height thật, focus pagination và scroll anchor sau request; đo cả
   full-page → short-page và short-page → full-page. Refresh feedback không được mount thêm một block làm dịch
   toolbar/table, không absolute đè content; dùng slot đã tồn tại trong header/toolbar, `aria-busy`, spinner trong
   control hiện hữu hoặc live region visually-hidden. Không gọi lỗi là “pre-existing” nếu không có baseline
   trước edit. Failure cùng owner phải được disposition ngay, không để sang vòng audit sau.
8. Chạy focused test trước, rồi lint/build/parity/checklist phù hợp. Không chạy broad aggregate từng treo
   nếu focused acceptance đã đủ; nếu broad gate là bắt buộc thì dùng bounded worker/time strategy.
9. Trước browser recheck, xác nhận exact HEAD, FE source/build, BE binary, PID/ports, operation mode,
   capabilities, database target và migration health. Runtime lệch source/binary là `INVALID_RUNTIME`, không
   phải finding UI.
10. Chạy Chrome headed đúng state matrix và viewport matrix, cộng viewport/zoom của lỗi người dùng đã báo nếu
    nằm ngoài matrix. Ngoài overflow, mỗi composition claim phải đo ordering/adjacency, surface count, geometry
    role, useful-content bounds, control/accessory containment và hit target sau state transition. Với table,
    capture computed `height|min-height|max-height|overflow|position|top|z-index` của viewport, `thead`, `th`,
    pagination và mọi ancestor scroll owner; fail nếu nhiều stylesheet cùng sở hữu một geometry fact hoặc nếu
    selector CSS dựa vào chuỗi utility (`[class~="max-h-[...]"]`). Với mỗi mounted select/combobox, capture
    option value cùng visible localized label; sau initial/default, user selection và restored/reopened state,
    closed trigger visible/accessibility label phải khớp selected option label và không được lộ raw enum/technical
    ID, trừ khi literal đó chính là business label đã duyệt. Dynamic option thiếu business records có thể dùng
    source projection invariant cộng mounted representative evidence; không fabricate data để enumerate. Với dữ
    liệu hiển thị, scan raw enum/code, decimal vượt precision nghiệp vụ, technical identifier wrap phá cột,
    duplicate fact giữa summary/header/table và action bị truncate; raw identity vẫn giữ trong `title`/detail khi cần truy vết. Với dữ liệu nghiệp vụ chứng
    minh đủ control → API → DB → reload. Dùng source-line ID, không gộp action theo tên hiển thị.
11. Đối chiếu lại outcome/brief và walkthrough sau thay đổi, gồm role bị từ chối và handoff được claim; mọi
    thay đổi scope/authority phải được cập nhật và chốt trước khi mở tiếp implementation. Reconcile claim envelope:
    `requiredCells = PASS + FAIL/OPEN + NEEDS_EVIDENCE + NOT_APPLICABLE + BLOCKED`; report thiếu hoặc trùng cell
    phải fail closeout. Recheck ledger theo `FIXED | OPEN | NEEDS_EVIDENCE | NOT_APPLICABLE | BLOCKED`; chỉ claim
    PASS cho cell có oracle đã chạy. Tách verdict contract readiness, implementation correctness, browser health,
    composition/accessibility, lifecycle E2E, usability và performance. Verdict tổng chỉ là PASS khi mọi claim con
    được yêu cầu đều PASS; một lifecycle xanh hoặc `zero errors/overflow` không nâng composition/usability chưa đo
    thành PASS. Kết thúc bằng `git diff --check`, secret/stub scan, evidence index và cập nhật
    `MEMORY.md`; việc đã đóng chuyển sang `HISTORY.md`.

## D06 supported browser envelope

- Supported target: Windows 10/11, Chrome current+previous stable and Edge current+previous stable.
- Canonical desktop viewports: `1366×768`, `1440×900`, `1920×1080`.
- Motion cells: normal and `prefers-reduced-motion`; reflow cells: 100% and 200%.
- Full critical-workflow denominator has 672 cells: Windows 10/11 × 2 browser families × current/previous version band × 3 viewports × 2 motion preferences × 2 zoom levels × 7 workflows (login/session, weekly menu, import, approval, warehouse, reports, MRX). NVDA is a separate Chrome-current critical-workflow subset, not multiplied across every cell.
- `frontend/playwright.browser-support.config.ts` is preflight-only. It requires operator-supplied `BROWSER_SUPPORT_BASE_URL`, source ref, run ID, OS and version band, and does not start a server. Target runtime/build identity and whether the URL is Release rather than stale/dev must be independently verified before evidence. Browser projects avoid versioned device descriptors so each installed channel supplies its native UA. Its 200% root-font-size check is a text-reflow proxy, not proof of real browser zoom or assistive technology.
- A support PASS additionally requires runtime identity comparison, captured installed browser/OS version proving each current/previous slice, real 200% browser zoom, keyboard/focus checks, console/network evidence and NVDA current+Chrome current on critical workflows. Unmeasured cells remain `NEEDS_EVIDENCE`; Firefox/Safari/mobile/tablet are not claimed.

## 3. Browser và evidence

- Resolve lane, port, credential source và viewport matrix từ `MEMORY.md` hoặc checkpoint hiện hành mà nó
  trỏ tới; revalidate runtime trước action. Nếu thiếu matrix, ghi `BLOCKED` cho browser gate và chốt exact
  desktop matrix vào checkpoint trước khi chạy; không âm thầm dùng kích thước trong report cũ hoặc default runner.
  Chỉ bổ sung mobile/tablet khi Kỳ yêu cầu; viewport/zoom của lỗi được báo vẫn phải được reproduction scoped.
  Không hardcode target lane trong contract; mutation cần authorization trên đúng lane, không reset/seed/restore
  để làm gate xanh.
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
anti-pattern, regression, bằng chứng đo được và hành động tiếp theo. Mỗi closeout thêm bảng claim:
`claimId | envelope | required | pass | open | needsEvidence | notApplicable | blocked | notClaimed | verdict |
evidence`. Cấm dùng một từ `PASS` không namespace cho cả phase khi phase có nhiều loại claim. Không dùng các kết
luận định tính như “trông ổn”, “có vẻ đẹp hơn” hay “đã hết lỗi” nếu thiếu gate sau sửa.

### 4.1. Vòng phản hồi chống tái diễn — defect → rule → regression

Kỳ cho phép và yêu cầu agent **tự cập nhật rule kỹ thuật UI/UX có bằng chứng trong cùng task sửa lỗi**.
Không chỉ ghi bài học trong chat, MEMORY, report hoặc skill riêng. Gate này áp dụng cả khi agent tự phát hiện
lỗi trong lúc tạo/sửa/xóa UI, không chỉ lỗi người dùng đã chỉ ra. GSD vẫn giữ một finding ledger.

1. **Xác minh defect:** ghi scenario/mode/actor/state, tác hại với tác vụ, expected behavior và nguồn authority;
   chuyển screenshot thành source/behavior/DOM oracle. Chưa tái hiện hoặc chưa có authority thì ghi candidate
   `NEEDS_EVIDENCE`, không biến cảm giác thẩm mỹ thành MUST.
2. **Phân loại rule coverage trước khi thêm:**
   - `EXISTING_RULE`: rule đã đủ, implementation vi phạm → giữ ID, bổ sung regression/enforcement thiếu;
     không tạo rule mới cho từng instance.
   - `RULE_AMBIGUITY`: thiếu scope/exception hoặc mâu thuẫn → làm rõ owner hiện có, giữ nghĩa đã duyệt và ID
     khi vẫn cùng invariant; không viết rule đối nghịch để né rule cũ.
   - `RULE_GAP`: invariant kỹ thuật có evidence chưa được bao phủ → thêm rule tại owner canonical thích hợp.
   - `ENFORCEMENT_GAP`: rule/test đã có nhưng lỗi lọt qua → xác minh test có chạy, đúng seam/state/actor và
     có red-capable oracle; sửa coverage hoặc gate thay vì tăng số rule. Không tự sửa CI/hooks ngoài quyền task.
3. **Chắt lọc thành rule tái sử dụng:** mô tả root cause/invariant, phạm vi và ngoại lệ hợp lệ; ưu tiên mở rộng
   rule sẵn có. Chỉ tạo ID mới khi invariant thực sự mới, dùng nhóm `P/D/L/S/T/M/C/F/E/I/A/N/V/Q` phù hợp và ID
   chưa dùng; không đánh lại số hoặc tái sử dụng ID đã retired. Thiếu dữ liệu không được tự chế pixel/time quota.
4. **Ghi đúng owner:** rule UI chung và mức MUST/SHOULD/MAY ở DASHBOARD-UI-RULES; composition ở DESIGN;
   oracle ở MEASUREMENT-PROTOCOL; execution ở file này; vocabulary/data/domain ở owner chuyên biệt. Link từ
   rule/index tới owner, không copy thành nhiều bộ. Update đầu mối UI-PHILOSOPHY khi thêm concern/owner mới,
   không buộc sửa mọi docs cho một rule nhỏ. Evidence run giữ ở artifact; hash chỉ thuộc EVIDENCE-INDEX.
5. **Khóa chống tái diễn:** thêm hoặc mở rộng kiểm tra nhỏ nhất tại root owner — ưu tiên behavior/DOM/API test,
   không chỉ source-string assertion. Chứng minh test bắt trạng thái hỏng (red/negative control), rồi chạy lại
   sau fix (green). Nối rule ID ↔ test path/scenario ↔ exact command ↔ kết quả trong ledger; quét cùng pattern
   và kiểm consumer bị ảnh hưởng theo declared scope. Rule mới chưa có regression không phải prevention PASS.
6. **Chốt cùng task:** ghi disposition dưới đây trước closeout. Với defect đã xác nhận, thiếu rule update hoặc
   regression cần thiết thì không claim đã chống tái diễn. Thiếu runtime/data/authorization giữ `BLOCKED` hoặc
   `NEEDS_EVIDENCE` cho đúng phần; không hạ oracle, seed hoặc mở scope trái phép để làm xanh.

```text
Finding ID | Coverage class | Root cause/invariant | Canonical owner + rule ID |
Applicability/exception | Regression path/scenario + command | Red/green evidence |
Same-pattern disposition | Remaining decision/blocker | Prevention verdict
```

**Giới hạn quyền tự cập nhật:** áp dụng cho guard kỹ thuật bảo toàn expected contract, ví dụ containment/focus,
query-state honesty, session isolation, feedback hoặc geometry đã có căn cứ. Không tự đổi business lifecycle,
permission/data visibility, operation-mode, immutable history, design direction hay threshold chưa được duyệt.
Nếu cần quyết định như vậy, ghi đề xuất trong GSD ledger, hỏi Kỳ và chặn phần phụ thuộc; không tự promote thành
contract. Không được xóa/hạ rule hoặc sửa test expectation theo bug để lấy PASS.

Khi lỗi tái diễn, bắt đầu từ rule/test đã nối trong ledger, điều tra vì sao gate không bắt; không lại thêm một
bản sao rule. Đây là cơ chế học có evidence và regression, **không phải bảo đảm rằng prompt/docs tự ngăn mọi lỗi**.

## 5. Handoff sang session mới

Session mới tự đọc `AGENTS.md` và `MEMORY.md`. Khi task đụng UI/UX, mở thêm file này cùng các contract
được link ở đầu file; chỉ mở evidence/artifact/runner lịch sử liên quan đúng scope hiện hành. `MEMORY.md`
phải nêu rõ lane, runtime, open blocker và bước kế tiếp; không lưu credential, token hay connection string.
