---
title: IPCManagement UI/UX Measurement Protocol
status: canonical-oracle
scope: frontend-and-browser-evidence
owner: GSD
last_reviewed: 2026-09-02
---

# UI/UX measurement protocol

[`UI-PHILOSOPHY.md`](UI-PHILOSOPHY.md), [`DESIGN.md`](DESIGN.md) và
[`DASHBOARD-UI-RULES.md`](DASHBOARD-UI-RULES.md) là contract nguyên tắc/kiến trúc đã áp dụng;
`docs/ui-audit-kit/` là nguồn tham khảo đã được chuẩn hóa vào IPCManagement. Từ nay agent không kết luận
UI đúng/sai bằng cách đọc screenshot. Kết luận phải xuất phát từ test, DOM metrics, API evidence, focus
state hoặc performance record có thể lặp lại.

Quy trình đầy đủ từ phân loại task, sửa đúng owner, browser evidence đến handoff session nằm ở
[`UI-UX-EXECUTION-HARNESS.md`](UI-UX-EXECUTION-HARNESS.md). Authority map tài liệu nằm ở
[`README.md`](README.md). File này chỉ giữ oracle/gate đo lường, không trở thành một workflow cạnh tranh.

## Cleanup quy trình cũ

- Không chạy trực tiếp script, URL, mock profile, viewport hoặc Playwright config mẫu trong
  `docs/ui-audit-kit/`; chúng là material tham khảo, không phải cấu hình IPCManagement.
- Không dùng `test:ui-audit` như một gate khác: nó là compatibility alias của `test:ui-measurements`.
- `test:visual` và screenshot headed vẫn giữ để reviewer đánh giá thay đổi có chủ đích và lưu E2E evidence;
  chúng không được dùng làm oracle hoặc được cập nhật chỉ để làm test xanh.
- Các ảnh và báo cáo lịch sử dưới `docs/` hoặc `.artifacts/` được giữ làm evidence lịch sử, không rewrite
  hay xóa khi dọn quy trình.

## Gate chuẩn

Chạy từ `frontend/`:

```bash
npm run test:ui-measurements
```

Gate dùng fixture read-only và route thật từ `src/lib/routeConfig.ts`; không dùng hard-code generic
`/dashboard`, `/orders`, `?mock=long` hay port của kit. Coverage thực tế phải đọc từ runner/result hiện hành và
đối chiếu declared scope; không coi default runner hoặc năm viewport lịch sử là acceptance matrix của task mới.
Exact matrix phải được resolve từ MEMORY/checkpoint theo execution harness trước browser run. Thiếu matrix là
`BLOCKED` cho browser gate; không tự điền mobile/tablet hoặc lấy cấu hình cũ để chứng nhận.

Report compatibility ghi `test-results/ui-audit-*.json`; ví dụ schema legacy (route/viewport chỉ minh họa,
`rule` ở đây là detector ID cũ, không phải normative rule ID):

```json
{
  "schemaVersion": 1,
  "verdict": "PASS | FAIL",
  "issueCount": 0,
  "issues": [{ "rule": "C1", "route": "dashboard", "viewport": "1365x900", "selector": "document", "reason": "PAGE_H_SCROLL" }]
}
```

### Traceability của detector legacy

`frontend/tests/ui-audit.spec.ts` còn phát ID cũ trùng tên nhưng khác nghĩa với normative rules. Khi đưa finding
vào ledger, MUST giữ source/selector/reason và ghi riêng detector ID + rule project; không relabel evidence cũ
hoặc đổi schema/emitter chỉ bằng sửa docs.

| Detector legacy / reason | Nghĩa đã đối chiếu source | Rule/contract dùng khi disposition |
|---|---|---|
| `C1 / PAGE_H_SCROLL` | Overflow ngang cấp document | UI-PHILOSOPHY §2.5; V10 nếu liên quan responsive composition; không phải normative C1 |
| `C4 / CONTROL_CLIPPED`, `TABLE_ACTION_UNREADABLE`, `CONTROL_VERTICAL_WRAP`, `UNSAFE_WORD_BREAK` | Nhãn/action clip hoặc wrap không đọc được | UI-PHILOSOPHY §2.5, A2 khi action không dùng được; không phải normative C4 |
| `A1 / DIALOG_MISSING_NAME` | Detector kiểm sự có mặt của attribute label | M2.5; cần semantic accessible-name assertion để chứng minh tên thực sự resolve, không phải table rule A1 |
| `C2 / tablist ...` | Kiểm tra geometry/style seam tab | DESIGN/V10 hoặc conformance PB-18 tùy reason; không phải skeleton rule C2 |

Một detector không chứng minh mọi yêu cầu của rule đích. Đặc biệt tab nowrap/inset chỉ là detector compatibility,
không tự tạo pixel/geometry canon nếu nguồn chưa chốt. Phân loại `UNRESOLVED` khi reason chưa có normative oracle.
Route có table scroll cục bộ hợp lệ không bị coi là overflow toàn trang.

Gate này **chưa đủ** để kết luận visual composition PASS. Mọi route được sửa về layout phải bổ sung scoped
browser assertion theo `V1`–`V10`; thiếu assertion đó là `NEEDS_EVIDENCE`, không được suy từ `issueCount: 0`.

## Interaction fluidity oracle

Dùng oracle này khi claim navigation/click/tab/search/form/overlay/table/sidebar/scroll hoặc continuous interaction
“mượt”, “nhanh”, “đơ” hay “jank”. Audit hiện hành ghi finding bền vững tại
[`perf/INTERACTION_FLUIDITY_RUNTIME_AUDIT.md`](perf/INTERACTION_FLUIDITY_RUNTIME_AUDIT.md); checklist thực thi
thuộc GSD plan, không thuộc file oracle này.

1. **DEV versus preview trước:** cùng browser/machine/actor/lane/viewport/data/route/state/action. Tách cold
   module/chunk compile, warm navigation và application work. Phân loại `DEVELOPMENT_ONLY`,
   `DEVELOPMENT_DOMINANT` hoặc `PERSISTS_IN_PRODUCTION`; không sửa production architecture từ DEV-only trace.
2. **Đo theo phase:** khi hỗ trợ, lưu input delay, processing duration, presentation delay và total interaction.
   Network-bound action thêm request/server/response; hover/scroll đã load không được quy cho backend nếu thiếu
   causal evidence.
3. **Frame distribution:** báo median/p95 frame time, số frame >8.33/16.67/33.3ms, LoAF count và longest frame.
   8.33/16.67ms chỉ là reference 120/60Hz, không tự thành NFR. API không hỗ trợ là `NEEDS_EVIDENCE`, không ghi 0.
4. **Control versus heavy:** luôn có ít nhất một route đối chứng và một route data/interaction-heavy. Mọi route
   cùng xấu mới mở candidate shell/global CSS/runtime; một route xấu ưu tiên owner cục bộ.
5. **Attribution trước optimization:** React commit cao mới dùng Profiler/state-owner analysis; React yên nhưng
   layout/paint cao thì dùng browser pipeline trace. Source scan listener/layout read chỉ là inventory cho tới khi
   gắn được với interaction tái hiện.
6. **Retained/hidden UI:** phân loại `cheap`, `expensive but justified`, `owner candidate` hoặc
   `NEEDS_PROFILER_EVIDENCE`; cấm global KeepAlive removal. Memoization, virtualization, debounce, layer promotion,
   motion removal hoặc skeleton/min-height chỉ hợp lệ khi before evidence chỉ đúng owner và after đo cùng điều kiện.
7. **Manifest:** content-sensitive source identity, DEV/preview mode, browser/version, viewport/throttle,
   route/view/state/action, preload state, repeats, probe flags, errors và bounded verdict. Runner success không là
   interaction PASS; screenshot không chứng minh frame/commit/paint cost.

Mỗi optimization package phải có red-capable interaction oracle, before/after distribution, control-route check,
focused correctness/accessibility regression và rollback nếu improvement không material hoặc làm metric khác xấu đi.

## Visual composition oracle

Screenshot được dùng để phát hiện candidate defect, sau đó phải chuyển thành DOM measurement. Với route/layout
được claim, manifest nên ghi thêm:

```json
{
  "composition": {
    "stateSurfaceCount": 1,
    "largeBlankSurfaces": [],
    "regions": {
      "heading": { "top": 0, "bottom": 0 },
      "scopeControl": { "top": 0, "bottom": 0 },
      "state": { "top": 0, "bottom": 0 },
      "content": { "top": 0, "bottom": 0 }
    },
    "boundaries": [
      { "selector": "...", "role": "compact", "minHeight": 0, "height": 0 }
    ],
    "ordering": ["heading", "scopeControl", "state", "content"],
    "focusTargetValid": true
  }
}
```

Oracle bắt buộc:

1. `stateSurfaceCount <= 1` cho một prerequisite/empty/error state của cùng work object.
2. Boundary `compact` không có computed min-height của `section/table/workspace`.
3. Heading/control/content cùng work object không bị tách bởi một blank surface không có semantic role.
4. Không có visible surface chiếm diện tích lớn mà không chứa heading, data, skeleton đúng contract, state copy
   hoặc action hữu ích.
5. DOM order và visual order không mâu thuẫn; action prerequisite focus đúng control.
6. Accessory nằm trong control (password toggle, calendar, clear/search icon) phải được đo bằng bounding box:
   không vượt biên control, cùng tâm theo trục dự kiến và `elementFromPoint()` tại tâm phải trả về accessory
   hoặc descendant của nó. Assertion click phải chạy sau khi control chuyển sang error/focus/pressed state vì
   ring, stacking context và active transform có thể làm hỏng hit target dù trạng thái ban đầu nhìn đúng.
7. Với form, đo cả nhóm label → control → guidance/error: DOM và visual order phải khớp; không overlap, không tách thành orphan message, và lỗi của field này không được tạo khoảng trắng giả cho field khác. Đo effective separation bằng bounding box và token tại owner; `gap` cộng với margin con là FAIL. Với hai field cùng density và label một dòng trong cùng grid, mép control trên/dưới lệch quá 1px là FAIL; khi label/helper wrap chỉ yêu cầu containment, adjacency và hàng kế tiếp bắt đầu sau content cao nhất.
8. Các assertion được chạy lại trên toàn viewport matrix thuộc claim. Nếu người dùng cung cấp screenshot ở
   viewport ngoài matrix, thêm đúng viewport/zoom đó vào scoped reproduction; matrix chuẩn không được dùng để
   bỏ qua lỗi đã báo cáo.
9. Phân trang phải chạy transition oracle hai chiều: full page → short page → full page. Không yêu cầu
   `pagination.top` bất biến bằng cách thêm khoảng trắng. PASS khi active pagination control giữ focus, viewport
   page không bị scroll về đầu hoặc đổi scroll owner, content thật không có synthetic row/capacity/min-height,
   và phần dịch chuyển quan sát được chỉ bằng đúng chênh lệch content hợp lệ.
10. Refetch oracle capture trước/trong/sau request. Header, search, actions và table không được dịch vị trí vì
    mount/unmount refresh notice; visible refresh chỉ hợp lệ trong slot đã có sẵn. Live region visually-hidden
    không được có box geometry hoặc tham gia tab order.
11. CSS ownership oracle lưu matched rules và computed values cho table viewport, header, cells, pagination và
    ancestor. `height`, `min-height`, `max-height`, `overflow`, `position`, `top`, `z-index` phải có một semantic
    owner; selector dựa vào literal utility class hoặc hai rule ngang specificity ghi đè cùng property là FAIL.
12. Data-presentation oracle fail khi visible text chứa raw enum/code thuộc vocabulary đã biết, số vượt precision
    formatter, identifier kỹ thuật wrap phá cột, action bị clipping, hoặc cùng một fact xuất hiện ở nhiều primary
    surfaces. Giá trị raw cần audit được giữ trong tooltip/detail, không hiển thị thay cho business label.
13. Với modal theo `M2.12`, oracle phải đo bounding box giữa các direct region và từ content cuối của region tới action đầu tiên; `rowGap` hoặc class name riêng lẻ không đủ vì margin/padding bù có thể cộng đôi nhưng outer-box vẫn xanh. Fixture ngắn phải chứng minh không overflow; fixture dài phải có `scrollHeight > clientHeight`, focus cuối vẫn nằm trong viewport dialog và không bị sticky header/footer che. Modal tự quản **inter-region spacing** phải chứng minh `gap-0`; modal chỉ tự quản body scroll vẫn có thể giữ shared gap. Cả hai loại phải chứng minh body `min-h-0` là scroll owner và document không overflow. Fixture generic không chứng nhận một editor production cụ thể nếu editor đó chưa được mount/đo trong cùng evidence run.

Ngưỡng khoảng cách/diện tích cụ thể phải xuất phát từ token và baseline của primitive. Không hardcode một tỷ lệ
chung rồi áp cho chart, editor hoặc matrix workspace vốn có geometry hợp lệ.

## Quy trình xử lý lỗi

1. Chạy gate và đọc JSON report. Nếu có ảnh, lập inventory candidate theo composition, hierarchy, adjacency,
   geometry, hit target và visual state; không chỉ kiểm overflow/semantics. Mọi orphan control/heading, accessory
   vượt biên, blank surface, duplicate state hoặc lệch hàng rõ ràng đều là candidate bắt buộc triage.
2. Phân loại từng rule thành `PASS`, `FAIL`, `NOT_APPLICABLE` hoặc `NEEDS_EVIDENCE`. Ảnh đơn lẻ luôn là
   `NEEDS_EVIDENCE`, nhưng candidate rõ phải được chuyển thành DOM/source assertion trước khi kết thúc triage.
   `issueCount: 0` từ gate generic không được nâng thành visual-composition PASS.
3. Sửa ở shared token/component trước; chỉ sửa page-local khi report chứng minh phạm vi cục bộ.
4. Chạy lại đúng gate, đọc số đo mới và thêm regression test tại seam gây lỗi.
5. Khi thay đổi có mutation hay dữ liệu nghiệp vụ, browser evidence vẫn phải nối FE control → API → DB →
   rendered reload theo `MEMORY.md`; measurement fixture không thay thế E2E đó.
6. Khi cần trace nguyên nhân của CLS, INP, long task, modal timing hoặc network/console live, dùng Chrome
   DevTools MCP theo đúng runtime/credential policy. Đây là công cụ chẩn đoán on-demand; không thay
   Playwright JSON gate và không tự bật trong mọi run. Nếu phải chụp, cấu hình MCP dùng WebP để giảm
   payload; vẫn phải đọc metric/trace thay vì phán quyết từ ảnh.

Visual snapshot vẫn được giữ cho reviewer phát hiện regression có chủ đích. Nó không là proof độc lập cho
agent và không được update chỉ để biến một gate thành xanh.

## Ánh xạ kit vào IPCManagement

| Kit | IPCManagement chuẩn hóa |
| --- | --- |
| `scripts/overflow-audit.mjs` | `frontend/tests/ui-audit.spec.ts`: fixture-aware DOM measurement + JSON report |
| Mock `dashboard/orders` | `ROUTES` canon và read-only API fixture của ứng dụng |
| Width generic | Exact viewport matrix khóa tại MEMORY/checkpoint; thiếu thì browser preflight BLOCKED |
| Screenshot/pixel diff | Reviewer-only regression artifact, không dùng làm oracle agent |
