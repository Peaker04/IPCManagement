---
title: Route Budget and Project-wide UI/UX Completion Checklist
status: in-progress
owner: GSD
scope: frontend route performance, UI/UX evidence and acceptance
last_updated: 2026-08-22
---

# Route Budget và UI/UX — Checklist hoàn thành

> **HISTORICAL / NO EXECUTION AUTHORITY.** Trạng thái trong file phản ánh thời điểm tạo. Dùng `MEMORY.md`, `docs/README.md` và phase hiện hành để quyết định công việc.


## Quy tắc dừng

- Không đánh dấu `[x]` từ source review hoặc screenshot đơn lẻ.
- Mỗi mục phải có test, metric, DOM/runtime JSON hoặc artifact tái lập được.
- `NEEDS_EVIDENCE`, `UNRESOLVED`, `FAIL` và `GAP` không được coi là hoàn thành.
- Không đổi route-budget threshold, không dùng `manualChunks`, không tạo RTK Query API slice thứ hai.
- Giữ một `apiSlice`, reducer, middleware, endpoint names, cache identity và invalidation contract.
- Không ghi credential, token, connection string hoặc dữ liệu cá nhân vào artifact/log/docs.
- Chỉ kết thúc checklist khi toàn bộ mục bắt buộc đều `[x]`, full verification pass và worktree được kiểm tra.

## Evidence contract

Mỗi finding phải ghi đủ:

- Rule ID;
- route/tab/component owner thấp nhất;
- viewport và actor/permission;
- action source-line hoặc thao tác cụ thể;
- DOM geometry trước/sau;
- `scrollWidth/clientWidth`, wrapping, clipping và overflow;
- focus trước/sau, accessible name và keyboard path;
- request/response sau action nếu có query hoặc mutation;
- console/page/failed-request record;
- CLS/long-task/INP record khi liên quan;
- verdict: `PASS`, `FAIL`, `GAP`, `NEEDS_EVIDENCE`, `UNRESOLVED` hoặc `NOT_APPLICABLE`;
- artifact path và hash được đăng ký trong `docs/EVIDENCE-INDEX.md`.

## Gate 0 — Scope và baseline

- [x] Xác nhận branch, `git status --short --branch` và giữ nguyên thay đổi ngoài scope.
- [x] Đọc `AGENTS.md`, `MEMORY.md`, `docs/UI-UX-EXECUTION-HARNESS.md`, `docs/DASHBOARD-UI-RULES.md`.
- [x] Ghi clean-build route-budget baseline từ manifest mới; baseline nằm trong `.artifacts/route-budget-gate0-baseline.log`.
- [x] Xuất manifest closure từng route, phân loại entry/shared/route-only/API/CSS; baseline manifest được tạo bởi clean build hiện tại.
- [x] Source-owner inventory project-wide được count-lock từ production source, không đếm runtime instance: `14` route, `54` presentation owner, `50` table, `34` dialog, `7` switcher, `0` drawer, `64` action owner / `224` button action.
- [x] Chốt viewport matrix hiện hành: `1920×1080`, `1440×900`, `1366×768`, `1365×900`, `1280×900`.
- [x] Chốt actor/permission và runtime/DB lane từ `MEMORY.md`; không ghi password vào artifact.

## Gate 1 — Route-owned capability islands

### Boundary contract

- [x] Route shell/capability boundary được materialize bằng source hiện hành tại từng route owner; không tạo shell/API slice thứ hai.
- [x] Mỗi accepted capability có dynamic `load`, fallback ổn định và route/feature owner rõ ràng; error/data boundary vẫn ở owner hiện hành.
- [x] Capability chỉ lazy-load phần thực sự route-owned; shared `TableViewport` chỉ lazy-load control tùy chỉnh khi bảng opt-in preferences, không lazy hóa primitive bảng/query.
- [x] Preload chỉ chạy sau intent hoặc route policy đã đo; main shell không idle-preload toàn bộ route.
- [x] Endpoint được inject trước prefetch/query hook sử dụng endpoint đó; workflow API boundary giữ `0` runtime/type-only consumer ngoài contract.
- [x] Không có import vòng hoặc duplicate runtime/API trong manifest; dependency-cruiser `425 modules / 1601 dependencies / 0 violations`.

### Pilot: Coordination

- [x] Đo baseline route closure và asset closure của Coordination: `232.59 KiB`.
- [x] Tách capability route-owned: `ActionToolbar` và `OrderTable` lazy-load dưới Suspense; detail dialog vẫn do OrderTable ownership quản lý.
- [x] Giữ nguyên query args, endpoint names, cache tags và action eligibility; workflow API boundary vẫn `0` runtime consumer.
- [x] Regression Coordination: `6 files / 50 tests PASS`; build và lint PASS.
- [x] Headed browser test đủ 5 viewport cho protected-route overflow/action contract: `5/5 PASS`.
- [x] Route closure giảm thật: `232.59 → 227.28 KiB` (`-5.31 KiB`); không route nào khác tăng quá mức baseline đo được.
- [x] Clean route-budget verification PASS: Coordination `174.11 / 196.00 KiB` sau lazy `HeaderInfo` và direct leaf imports.

### Pilot: Approval

- [x] Đo baseline route closure và asset closure của Approval: `236.88 KiB`.
- [x] Tách capability route-owned có kiểm soát: `MenuAmendmentReconciliation` lazy-load dưới Suspense; queue/detail/history query panels vẫn synchronous để giữ state contract.
- [x] Giữ nguyên approval state, permission, mutation và invalidation behavior.
- [x] Regression Approval: `18/18 PASS`; full frontend sau pilot `157 files / 888 tests PASS`.
- [x] Headed browser protected-route/action matrix: `5/5 viewport PASS`; không overflow/action regression.
- [x] Route closure giảm thật: `236.88 → 235.68 KiB` (`-1.20 KiB`); shared common floor không tăng.
- [x] Clean route-budget verification PASS: Approval `193.34 / 202.00 KiB` sau lazy search field và controlled decision dialog.

### Rollout còn lại

- [x] Warehouse capability island PASS — demand/exceptions/receipt lifecycle/receipt dialogs/blocker lazy-load; route `255.71 / 257.00 KiB`, headed matrix `35/35`.
- [x] Admin Data capability island PASS — panel imports are gated by first activation and visited panels remain mounted; route `199.00 / 259.00 KiB`, state regression `6/6`, headed matrix `35/35`.
- [x] Dashboard capability island pass — shared TablePreferences seam đưa route về `190.50 / 199.00 KiB`.
- [x] Reports capability island PASS — filters, price, data-quality, service-run và legacy-lineage capabilities lazy-load; route `239.36 / 252.00 KiB`, permission/state regressions `19/19`.
- [x] Chef capability island PASS — shift/production/service-run/receipt/documents capabilities lazy-load; route `200.23 / 263.00 KiB`, focused `10/10`, headed `5/5`, full `157/888`.
- [x] Weekly Menu capability island PASS — readiness, import/editor dialogs and route-owned sections lazy-load; route `274.55 / 275.00 KiB`, focused weekly/report regressions `140/140`.
- [x] Purchasing capability island PASS — supplemental, quotation và workflow guide lazy-load; route `254.91 / 255.00 KiB`, focused/page regressions pass.
- [x] Approval Rules/Advanced Settings capability island pass — Approval Rules `238.83 / 241.00 KiB`; Advanced Settings vẫn route lazy riêng ngoài budget matrix.
- [x] Tất cả route đạt threshold hiện hành trong cùng một clean build; route-budget `10/10 PASS`, thresholds/accounting không đổi.

## Gate 2 — Controlled lazy confirmation seam

- [x] Xác định toàn bộ consumer của confirmation surface từ source inventory; project inventory hiện `54 owners / 34 dialogs`.
- [x] Tạo controlled lazy `ApprovalDecisionDialog` với overlay fallback và route-owned state.
- [x] Wrapper không thay đổi public mutation contract; Approval mutation regression `10/10 PASS`.
- [x] Dialog giữ production primitive với `role=dialog`, `aria-modal`, labelled content và portal.
- [x] Headed safe-dialog matrix xác nhận focus containment/return tại đủ 5 viewport.
- [x] Dedicated dialog regression khóa `Esc`, backdrop, nút giữ, `Enter` trên submit, loading veto, mutation error và retry.
- [x] Dirty rejection reason được giữ nguyên khi render mutation error; submit không chạy trước explicit confirmation.
- [x] Headed safe-dialog matrix `35/35` xác nhận focus containment/return, zero overflow và nền không đổi chiều rộng.
- [x] Lazy fallback là overlay đồng bộ trong render đầu; production headed matrix không ghi nhận blank document/escaped action.
- [x] `NOT_APPLICABLE` — decision detail nằm trong route-owned state, không có request chi tiết riêng cần fetch/cancel khi mở/đóng.
- [x] Consumer disposition: seam chỉ áp dụng Approval decision owner; confirmation consumer còn lại giữ primitive/contract cũ và source inventory, không migration máy móc.
- [x] Clean manifest tách `ApprovalDecisionDialog` thành dynamic asset route-owned; route không sử dụng không có static import tới owner này.

## Gate 3 — Project-wide UI/UX inventory

### Route/state matrix

- [x] Dashboard: first-load/loading/ready/empty/error/refresh/action.
- [x] Weekly Menu: toàn bộ tab, import, demand, production, purchasing, schedule.
- [x] Coordination: order list, filter, detail, action, error, empty.
- [x] Approval: queue, detail, decision dialog, mutation states.
- [x] Purchasing: workflow, supplemental, quotation, service date, error/empty.
- [x] Warehouse: stock, demand, receipt, exception, permission, long content.
- [x] Chef: production, receipt, documents, excess material, action states.
- [x] Reports: tất cả report tabs, filters, tables, detail/warning actions.
- [x] Admin Data: BOM, contracts, cleanup, inventory, statistics, audit, employees.
- [x] Approval Rules và Advanced Settings: list, form, confirmation, permission.
- [x] Canonical `50 state × 5 viewport` artifact, current headed `35/35` state gate và focused state regressions cùng chứng minh closure; không còn disposition `NEEDS_EVIDENCE` trong scope.

### Layout và interaction

- [x] Headed protected-route matrix không ghi nhận overlap khi idle trên đủ 5 desktop viewport.
- [x] Canonical 190 tab interaction, pagination/control gate và current modal/refetch regressions không ghi nhận overlap sau filter, pagination, tab switch, refetch hoặc modal lifecycle.
- [x] Headed `35/35` và control-surface `25/25` xác nhận không có horizontal overflow ngoài table viewport được phép cuộn.
- [x] Headed tab/dialog/table-action focus geometry và pagination focus recovery xác nhận focus không bị sticky header/footer/table/action column che.
- [x] Reports warning action và tab/dialog controls có keyboard path, focus/return regression trong control-surface gate.
- [x] Headed control-surface gate đo toàn bộ control nhìn thấy trên protected-route defaults: accessible name đầy đủ và bounding box tối thiểu `24×24` CSS px.
- [x] Approval document rail giữ stable reserved geometry giữa loading và settled; Weekly grouped table giữ chiều cao qua pagination.
- [x] UI measurement fixture khóa riêng Warehouse loading/empty/error/permission và không đánh đồng state.
- [x] Shared query boundaries và route regressions giữ dữ liệu cũ khi refresh; source inventory khóa zero `location.reload`/`navigate(0)`.
- [x] RTK Query cache/request-deduplication và mutation regressions khóa late response không ghi đè state mới.
- [x] `NOT_APPLICABLE` cho polling pause: production source không có polling interval nền; tab/modal/input/multi-select chỉ refetch theo query invalidation hoặc explicit action, và visited hidden panels không phát write.
- [x] Purchasing sau sửa đạt max CLS `0.093447`; current SPA cold/warm navigation `20/20` có CLS `0`, zero long task. Cold document-navigation task Vite `50–71ms` được trace/disposition trong closeout manifest, không phải post-action INP.

## Gate 4 — Copy, vocabulary và semantic display

- [x] Headed hidden-copy scan quét 9 application route và toàn bộ visible tab hai lượt; current accessible-name gate pass.
- [x] Technical-copy scan sau fix có zero enum/backend value/jargon trên user surface; import field key chỉ còn trong file-contract schema.
- [x] Label/action đã đối chiếu glossary và formatter/status vocabulary contracts.
- [x] Copy regression khóa câu rút gọn tại đúng owner mà không đổi nghĩa nghiệp vụ.
- [x] Empty/error owners và explicit Purchasing supplemental empty state nêu đối tượng, nguyên nhân và bước tiếp theo/retry khi có.
- [x] Source/copy contracts khóa tên hiển thị trước mã tại các work-object table; mã không đứng một mình làm primary label.
- [x] Formatter convergence khóa số lượng, tiền và ngày qua formatter tập trung; focused source contracts PASS.
- [x] Status token contract khóa vocabulary/tone tập trung và text label; không dựa riêng vào màu.
- [x] Headed control-surface scan xác nhận mọi visible button/action có accessible name không rỗng; dialog/tab names có focused regression.
- [x] Copy/source regression khóa nhãn approval, report export, approval rules và Weekly Menu import đã reconcile.
- [x] Modal/table/action/error copy được kiểm tra bằng hidden-copy scan, safe-dialog/data-quality five-viewport gate và mobile control suite.

## Gate 5 — Table và cột xử lý

- [x] Source inventory count-lock `50` table trên `54` presentation owner, không đếm lặp runtime instance.
- [x] Shared table CSS và headed table geometry giữ header cùng alignment role với dữ liệu.
- [x] Shared contract căn text trái, numeric role phải; centered cells chỉ dành cho explicit status/action owner.
- [x] Typography/table contracts khóa `tabular-nums` cho numeric presentation owners.
- [x] StatusBadge/table contracts giữ stable min-height/tone/text và không wrap sai trong stress fixtures.
- [x] Identifier-column source contracts giữ tên trước mã và frozen identifier owner khi opt-in.
- [x] Shared action-cell contract dùng fit-content/min-width; Data Quality long-label stress pass đủ 5 viewport.
- [x] Hidden-copy và control gates xác nhận action dùng động từ cụ thể, accessible name đầy đủ và không clip.
- [x] Wide-table owners cuộn cục bộ; action giữ nowrap/keyboard path và không đè cột khác.
- [x] Primitive/action fixture và headed controls cover hover/focus/disabled/loading/success states.
- [x] Control-surface gate xác nhận Reports/Purchasing/Warehouse/Weekly Menu wide table cuộn trong owner viewport, không thoát ra document.
- [x] Pagination contracts phân biệt local/page-number/cursor; stock/movement/report/chef long lists lọc server-side trước pagination.
- [x] Pagination visual/control gate khóa result range, tools, pending state và focus recovery không làm layout xê dịch bất ngờ.
- [x] Canonical state matrix cùng Data Quality/receipt long-content DOM evidence chứng minh zero overlap cho nội dung ngắn và dài.

## Gate 6 — Browser evidence thật

- [x] Current closeout dùng Google Chrome headed với persistent profile riêng dưới run directory.
- [x] Browser đi trực tiếp vào runtime thật `3040/8040` trên exact `ipc_lane7`; readiness/database/migrations được kiểm tra trước run.
- [x] Mỗi probe dùng run-id/profile/manifest riêng; failed navigation attempt được giữ riêng và không dùng làm gate.
- [x] Measurement/control harness lấy locator mới sau từng navigation, tab activation và DOM transition.
- [x] Current closeout lưu screenshot final theo viewport và 20 screenshot cold/warm navigation cho reviewer.
- [x] Mỗi viewport ghi DOM/geometry interaction JSON authoritative.
- [x] Current live manifest lưu `645` API response sau action; navigation final lưu request status theo từng cold/warm action; mutation lifecycle artifact lưu response riêng.
- [x] Interaction record lưu console/page error, failed/non-read request; expected 503 fixture được assert riêng trước khi bắt đầu zero-error record.
- [x] Interaction record và control gate lưu focus/keyboard evidence cho modal, warning action và tabs.
- [x] Performance records lưu CLS, long task, action interval và CDP attribution; final current SPA navigation có CLS `0`, zero long task.
- [x] Harness fail-closed khi interaction record có `GAP`/`NEEDS_EVIDENCE`; purchasing supplemental blank-tab đã được phát hiện từ JSON và sửa bằng explicit empty state.
- [x] Verdict lấy từ DOM/geometry/request/focus records; screenshot không được dùng riêng làm oracle.
- [x] Teardown record chỉ dừng listeners `3040/8040` do closeout run tạo; remaining listener count `0` và không chạm runtime khác.
- [x] Closeout manifest/hash được đăng ký trong `docs/EVIDENCE-INDEX.md`; manifest tự hash toàn bộ evidence dependency.

## Gate 7 — Regression và closeout

- [x] Focused tests của từng changed seam pass; shared TableViewport/table contracts `15/15`, full frontend `157/888`.
- [x] Full frontend unit suite pass với worker phù hợp: `157 files / 888 tests PASS` với `--maxWorkers=4` sau Coordination pilot.
- [x] Frontend build pass sau Coordination pilot.
- [x] Frontend lint pass sau Coordination pilot.
- [x] Dependency-cruiser pass: `425 modules / 1601 dependencies / 0 violations`.
- [x] Backend Release solution test pass: Application `49/49`; API `947 pass + 1 intentional skip`. Full gate đã bắt và sửa predicate KPI không dịch được sang SQL.
- [x] Route-budget checker PASS `10/10` trên clean production build; thresholds và accounting không đổi.
- [x] UI measurement suite pass: headed matrix `35/35 PASS` sau shared TablePreferences seam.
- [x] `git diff --check` pass.
- [x] Secret/stub scan tracked source/docs và current evidence text PASS; generated binaries/profile bị loại khỏi oracle có chủ đích.
- [x] Declared-scope inspection xác nhận không staged/untracked artifact ngoài scope trước commit.
- [x] `MEMORY.md` chỉ giữ gate/state hiện hành sau closeout.
- [x] Việc route-budget/UI completion đã được append sang `HISTORY.md`.
- [x] `docs/EVIDENCE-INDEX.md` đăng ký closeout manifest authoritative và hash.
- [x] Final diff được review theo atomic production/harness/docs scope trước commit.
- [ ] Xác nhận branch/remote/CI sau push.

## Definition of Done

Checklist chỉ được đóng khi:

- tất cả mục bắt buộc ở trên là `[x]`;
- không còn `FAIL`, `GAP`, `NEEDS_EVIDENCE` hoặc `UNRESOLVED` trong phạm vi đã tuyên bố;
- route-budget đạt threshold hiện hành;
- UI evidence đã được đọc từ DOM/runtime JSON, request, focus và performance record;
- full regression/build/lint/hygiene pass;
- evidence index, `MEMORY.md` và `HISTORY.md` đã đồng bộ;
- worktree clean và commit/remote status đã xác nhận.

## Trạng thái hiện tại

- [x] Quyết định kiến trúc: Route-owned capability islands + controlled lazy confirmation seam.
- [x] Quyết định UI/UX: evidence-first audit bằng DOM/runtime/interaction, không dùng screenshot đơn lẻ.
- [x] Gate 0 — baseline, clean manifest, viewport matrix và project-wide source-owner inventory hoàn tất.
- [x] Gate 1 — capability island implementation; clean build route-budget `10/10 PASS`.
- [x] Gate 2 — controlled lazy confirmation seam; keyboard/loading/error/dirty-state regressions và consumer disposition hoàn tất.
- [x] Gate 3 — project-wide UI/UX inventory.
- [x] Gate 4 — copy/vocabulary audit.
- [x] Gate 5 — table/action-column audit.
- [x] Gate 6 — headed browser evidence.
- [ ] Gate 7 — regression và closeout; chỉ còn remote/CI confirmation sau push.
