---
title: P3-P4-PC WeeklyMenuLifecycle UI action audit
audited_at: 2026-07-30
scope: WeeklyMenuLifecycle only
behavior_change: remove unintended lifecycle panel and align two verified frontend permission gates
status: pc-rerun-corrected-operational-e2e-pass
baseline_pc_approved_at: 2026-07-30
option_a_approved_at: 2026-07-31
---

# P3 → P4 → PC — `WeeklyMenuLifecycle`

Các mục P3/P4 đầu tiên bên dưới là baseline chỉ-đọc trước khi Kỳ làm rõ “E2E lifecycle” là luồng
nghiệp vụ, không phải một panel lifecycle mới. Closeout hiện hành đã gỡ panel ngoài ý muốn, giữ model và
registry làm contract/test, sửa đúng hai gate PC đã xác minh và chạy E2E thật trên database disposable.
Không mở đối tượng thứ hai và không sửa backend policy.

Quyết định D-01 / DEC-08 ngày `2026-07-31` khóa **Option A**: control `Publish` tiếp tục là
**Admin-only** tại Admin Data → Contract. Hai context DRAFT × Manager/Coordinator được giữ nguyên như
phép đo FE chặt hơn BE có chủ đích; không cần thay đổi alignment FE/BE hoặc hành vi production.

## Contract và giới hạn đầu vào

- Tập kỳ vọng là mười scenario trong
  `frontend/src/features/projects/weekly-menu/lifecycle/weeklyMenuLifecyclePa2Registry.test.ts`.
- Contract PC là `.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md:213-250`.
- Vai Capturer chỉ thu screenshot, DOM interaction, API status, console/page error, CLS và long task theo
  `.docs/AGENT-BRIEF-2026-07-30.md:218-227`.
- File được addendum nhắc tới là `.docs/UI-UX-AGENT-PROMPTS.md` không tồn tại trong checkout hoặc lịch sử
  Git. Vì vậy P3 được giới hạn thành mapping DOM/control hiện có về source; audit không tự thêm
  `data-component` hay instrumentation vào production.
- Cả mười role cell của PA đều là `KHÔNG-XÁC-ĐỊNH-ĐƯỢC`. Browser run chỉ xác minh actor thực tế là
  `admin`, role `admin`, permission `*`; không dùng actor này để suy ra kết quả cho Manager/Coordinator.

## P3 — đường DOM/control → source

Route `/weekly-menu` được gate bằng `coordination.read` tại `AppRouter.tsx:55`, dựng
`WeeklyMenuPage`, rồi nối CommandBar, sáu tab, readiness/alerts và view đang active. Production không còn
import hoặc render `WeeklyMenuLifecyclePanel`.

| Scenario PA | Next action kỳ vọng | Surface/selector đã tìm thấy | Source |
|---|---|---|---|
| `emptyModel` | Import và lưu thực đơn tuần | CommandBar `button "Nhập Excel"`; dialog `button "Lưu file hợp lệ"` sau khi có file hợp lệ | `WeeklyMenuCommandBar.tsx:31-39`; `WeeklyMenuPage.tsx:420-421,505`; `WeeklyMenuImportJobs.tsx:35-40,73-76`; `useWeeklyMenuImport.ts:157-169` |
| `draftModel` | Phát hành thực đơn | Admin Data → Contract → `button "Publish"`; UI thật chỉ có ở route wildcard admin | `AdminContractsPanel.tsx:240-304`; `useAdminContractsPanelModel.ts:47-58,199-216` |
| `activeIncompleteModel` | Nhập và hoàn tất số suất theo ca | tab `#demand-tab` → `#demand-panel` → các button `Hoàn tất {ca}` | `WeeklyMenuPage.tsx:441-452`; `WeeklyMenuViewContent.tsx:64-65`; `MaterialDemandSection.tsx:245-258` |
| `activeNotGeneratedModel` | Tạo nhu cầu vật tư | tab Nhu cầu → button `Tạo nhu cầu từ KHSX` khi `showGenerate` | `MaterialDemandSection.tsx:45-67,116-128`; `demandModel.ts:17-32` |
| `activeLoadingModel` | Đang đối chiếu nhu cầu vật tư | Không phải mutation action; lifecycle text và loading status | `weeklyMenuLifecycleModel.ts:117-120`; `MaterialDemandSection.tsx:272-277` |
| `activeErrorModel` | Tải lại nhu cầu vật tư | EmptyState error có retry callback | `weeklyMenuLifecycleModel.ts:119-120`; `MaterialDemandSection.tsx:282-289` |
| `activeShortageModel` | Chuyển các dòng thiếu sang Thu mua | Link contextual `Mở thu mua` chỉ render khi approval status là `approved`; href mang `week` + `date`. Sidebar còn có link generic `Thu mua` | `MaterialDemandSection.tsx:33,107-115`; `demandModel.ts:22-31,53-60`; `MainLayout.tsx:60`; `AppRouter.tsx:60` |
| `activeNoShortageModel` | Theo dõi cấp phát kho và bếp | Registry không có operation; source hiện có sidebar `Kho nguyên liệu` và `Bếp trưởng`, không có action contextual được model khai báo | `weeklyMenuLifecycleModel.ts:123-124`; `MainLayout.tsx:61-62` |
| `inconsistentModel` | Kiểm tra lại dữ liệu lịch thực đơn | Không có operation/control production suy ra được; chỉ giữ model presentation trong contract/test | `weeklyMenuLifecycleModel.ts:69-90`; `weeklyMenuLifecyclePa2Registry.test.ts` |
| `supersededModel` | Kiểm tra trạng thái version trên server | Không có operation/control production suy ra được; chỉ giữ model presentation trong contract/test | `weeklyMenuLifecycleModel.ts:94-130`; `weeklyMenuLifecyclePa2Registry.test.ts` |

Mapping này chứng minh nơi một control *có thể* render. Nó không chứng minh control đã render cho mọi
state/role; việc đó thuộc P4.

## P4 baseline lịch sử — phép đo Chrome headed trước khi gỡ panel

### Runtime và bối cảnh quan sát được

- Source chạy từ checkout hiện tại trên FE `3001`, API `8001`; bootstrap ép connection string sang
  `ipc_lane1`. `/health/ready` trả HTTP 200, database và migrations đều Healthy.
- Actor: `admin` / role `admin` / permission `*`.
- Customer/week: `ANV - AMANN`, tuần `2026-07-27`.
- Lifecycle render: `ACTIVE`, 12/12 lịch/ca đã chốt, 161 dòng ngày–nguyên liệu, 42 dòng thiếu.
- Ngày đang xem: `2026-07-30`, 2/2 ca hoàn tất, 10/30 nguyên liệu thiếu.
- Demand approval/downstream state: terminal `Đã xuất kho`; màn nêu rõ nhu cầu đã khóa, chỉ có thể xem.

### Kết quả theo viewport

| Viewport | Schedule interactions | Import-dialog interactions | Demand interactions | CLS | Overflow | Long task |
|---|---:|---:|---:|---:|---|---|
| `1920×1080` | 25 | 40 | 44 | 0 ở cả ba surface | Không | 1 task 58 ms khi mở Demand |
| `1440×900` | 25 | 40 | 44 | 0 ở cả ba surface | Không | 0 |
| `1366×768` | 25 | 40 | 44 | 0 ở cả ba surface | Không | 0 |
| `1365×900` | 25 | 40 | 44 | 0 ở cả ba surface | Không | 0 |
| `1280×900` | 25 | 40 | 44 | 0 ở cả ba surface | Không | 0 |

Capture có đủ 15/15 probe và 15 screenshot. 101 API response đều 2xx; ngoài login chỉ có GET.
Không có business mutation, console error, page error hoặc actionable request failure. Năm GET report bị
`net::ERR_ABORTED` trong navigation đầu tiên được giữ trong evidence nhưng không coi là lỗi theo
`LESSONS.md`; chúng không phải response của action sau khi màn đã settle.

Các control liên quan được quan sát nhất quán ở cả năm viewport:

- `Nhập Excel` visible/enabled. Trong dialog, `Lưu file hợp lệ` disabled và cùng màn có giải thích
  “Chưa có file nào…”, nên không phải disabled im lặng.
- Lifecycle button là `Đã phát hành`, disabled; label tự nêu trạng thái.
- Hai button số suất là `Đã hoàn tất Ca Sáng` và `Đã hoàn tất Ca Chiều`, disabled; phần KHSX nêu 2/2 ca
  hoàn tất.
- Không có link contextual `Mở thu mua` trong terminal state hiện tại. Sidebar `Thu mua` vẫn visible và
  dẫn tới `/purchasing`, nhưng không mang `week`/`date` như contextual href ở source.
- Không có Generate/Retry vì demand hiện đã sinh, không lỗi và đã đi tới terminal downstream state.

Evidence authoritative:
`.artifacts/shipyard-live/p3-p4-pc-weekly-menu-20260730/p4-weekly-menu-capture.json` và archive
`.artifacts/shipyard-live/p3-p4-pc-weekly-menu-20260730.zip`.

Artifact này là baseline lịch sử trước correction. Các dòng mô tả LifecyclePanel trong mục P4 không còn
đại diện UI production hiện tại; kết quả hiện hành nằm ở PA-2B rerun và Operational E2E phía dưới.

## PC — diff kỳ vọng với UI thực tế

### Kết luận

Không có lệch nào đủ chứng cứ để xếp vào bốn nhóm. Đây không phải kết luận “UI đủ”; chín state không
được phép dựng bằng mutation, còn state gần khớp duy nhất thiếu một chiều trạng thái mà PA chưa mô hình hóa.

| Nhóm PC | Số lệch đã xác nhận | Kết luận |
|---|---:|---|
| `THIẾU` | 0 | Không action nào vượt qua đủ bốn phép loại trừ bắt buộc. |
| `MỒ CÔI` | 0 | PA chỉ chiếu `nextAction`, không phải tập đầy đủ mọi operation hợp lệ; không được gọi các control ngoài registry là mồ côi. |
| `IM LẶNG` | 0 | Các disabled control quan sát được đều có label hoặc explanatory copy ngay cùng surface. Mutation không được bấm trong audit chỉ-đọc. |
| `LỆCH VỊ TRÍ` | 0 | Chỉ đo một page/object; generic sidebar không được coi là contextual action tương đương. |

`chưa kết luận được` là trạng thái không-classify bắt buộc của PC, không phải nhóm lệch thứ năm.

| Scenario PA | Kết quả PC | Lý do không được kết luận lệch |
|---|---|---|
| `emptyModel` | `chưa kết luận được` | Runtime có 12 schedule ACTIVE; không dựng empty state, và role PA chưa xác định. |
| `draftModel` | `chưa kết luận được` | Runtime không có version DRAFT cho scope đo; role PA chưa xác định. |
| `activeIncompleteModel` | `chưa kết luận được` | Runtime đã 12/12 ca; không dựng incomplete state. |
| `activeNotGeneratedModel` | `chưa kết luận được` | Runtime đã có 161 demand lines; không dựng not-generated state. |
| `activeLoadingModel` | `chưa kết luận được` | Không bắt được loading state sau khi UI settle; không dùng network throttling/mock để giả state. |
| `activeErrorModel` | `chưa kết luận được` | Mọi API đều 2xx; không phá request để giả error state. |
| `activeShortageModel` | `chưa kết luận được` | Lifecycle match active/generated/shortage, nhưng demand đã terminal `EXPORTED`; PA không có chiều approval/downstream state này. |
| `activeNoShortageModel` | `chưa kết luận được` | Runtime có shortage; không mutate tồn kho/demand để tạo zero-shortage. |
| `inconsistentModel` | `chưa kết luận được` | Runtime schedule/version/price đồng nhất; không sửa dữ liệu để tạo inconsistency. |
| `supersededModel` | `chưa kết luận được` | Runtime là ACTIVE; không đổi version sang SUPERSEDED. |

### Bốn phép loại trừ cho ca gần khớp `activeShortageModel`

1. **Sau lớp điều hướng khác:** đã mở tab Nhu cầu và kiểm cả sidebar. Sidebar có generic `/purchasing`,
   nhưng link contextual `?week=…&date=…` không render.
2. **Viewport khác:** cùng kết quả ở cả năm viewport bắt buộc.
3. **Dữ liệu mẫu chưa đủ:** dữ liệu có shortage thật, nhưng demand đã `EXPORTED`; đây là dữ liệu *đi xa
   hơn* state PA chứ không phải thiếu shortage data.
4. **Sai vai/sai trạng thái:** actor admin hợp lệ và lifecycle là active/generated/shortage, nhưng PA
   không khai approval/downstream state nên không chứng minh được bối cảnh là cùng một bối cảnh đầy đủ.

Không loại trừ được mục 4 ⇒ cấm ghi `THIẾU`.

## Điểm sẽ vỡ khi mở rộng registry

`REGISTRY-GAP-01`: `buildWeeklyMenuLifecycleModel` chỉ nhận schedule, quantity plan và demand count. Nó
không nhận material-request approval/downstream state. Vì vậy ở runtime đã `EXPORTED`, model vẫn phát
`nextAction = Chuyển các dòng thiếu sang Thu mua`, còn `getDemandActionPresentation` đúng theo code lại
chọn `primaryAction = none` cho terminal. Nếu dùng O1 hiện tại để tự thêm nút, PC có thể sinh false
positive và tạo đường tác động trùng sau khi chứng từ đã đi qua Thu mua/Kho.

Ngoài ra, PA registry là một next-action projection chứ chưa phải vocabulary đầy đủ của operation hợp lệ.
Nó không đủ căn cứ để nhận diện `MỒ CÔI` cho các control như chỉnh sửa, export, filter, tab hay document
navigation.

## Quyết định sau PC đầu

Kỳ đã duyệt PC đầu ngày `2026-07-30`, chọn mở rộng registry bằng actor + downstream state và cấp fixture
read-only trước khi chạy lại. PA-2 gốc được giữ nguyên như snapshot đã duyệt; PD, object thứ hai và PE mới
không được mở trong lượt này.

## PA-2B — companion registry cho `WeeklyMenuLifecycle`

Registry thực thi nằm ở `frontend/tests/weekly-menu-lifecycle-pa2b-fixture.ts`. Nó import trực tiếp
`buildWeeklyMenuLifecycleModel` và `getDemandActionPresentation`; riêng terminal được khóa bằng
`getDemandActionPresentation('terminal').primaryAction === 'none'`. Production source không import
registry; contract test quét toàn bộ `frontend/src/**/*.{ts,tsx}` để chứng minh boundary này.

| Scenario ID | Lifecycle projection | Downstream | Action kind / control kỳ vọng | Actor fixture | Oracle BE ↔ FE |
|---|---|---|---|---|---|
| `empty` | `EMPTY / empty / not-generated / 0/0` | không áp dụng | mutation · `Nhập Excel` | Admin, Manager, Coordinator | cả ba phía đều có đường vào |
| `draft` | `DRAFT / draft / not-generated / 0/2` | không áp dụng | mutation · Admin Contracts `Publish` | Admin, Manager, Coordinator | BE cho cả ba; FE chỉ có route/control với Admin |
| `active-incomplete` | `ACTIVE / active / not-generated / 1/2` | không áp dụng | mutation · `Hoàn tất Ca Sáng` | Admin, Manager, Coordinator | khớp cả ba sau khi dùng `coordination.order.lock` |
| `active-not-generated` | `ACTIVE / active / not-generated / 1/1` | `not-created → generate` | mutation · `Tạo nhu cầu từ KHSX` | Admin, Manager, Coordinator | khớp cả ba |
| `active-loading` | `ACTIVE / active / loading / 1/1` | không áp dụng | presentation · không business action | Coordinator | không đối chiếu permission |
| `active-error` | `ACTIVE / active / error / 1/1` | không áp dụng | presentation · không business action | Coordinator | không đối chiếu permission |
| `active-shortage-approved` | `ACTIVE / active / generated / 1/1` | `approved → purchasing` | navigation · `Mở thu mua` | Admin, Manager, Coordinator | khớp: Admin/Manager hiện, Coordinator bị `purchase.read` chặn |
| `active-shortage-terminal` | `ACTIVE / active / generated / 1/1` | `terminal → none` | none · không business action | Admin, Manager, Coordinator | terminal không có action nghiệp vụ |
| `active-no-shortage` | `ACTIVE / active / generated / 1/1` | `terminal → none` | none · không business action | Coordinator | terminal không có action nghiệp vụ |
| `inconsistent` | `INCONSISTENT / blocked / not-generated / 0/2` | không áp dụng | presentation · blocked reason | Coordinator | không đối chiếu permission |
| `superseded` | `SUPERSEDED / blocked / not-generated / 0/1` | không áp dụng | presentation · blocked reason | Coordinator | không đối chiếu permission |

Nguồn role/permission không export được được giữ kèm `file:dòng` trong từng registry row và có exact
source-drift assertion cho `LoginPage.tsx:20-24`, `MaterialDemandSection.tsx:107-128,245-258`,
`AppRouter.tsx:60`, `AuthorizationPolicies.cs:42-47,150-187` và `Program.cs:165-177`. Vì vậy PA-2B
không tạo vocabulary/policy thứ hai im lặng.

## Fixture read-only và P4 rerun

Fixture chạy production route `/weekly-menu`, production store, route guard và components; chỉ response API
được intercept trong Playwright. Mọi non-auth request khác `GET/HEAD/OPTIONS` bị chặn 405 và làm test đỏ;
mọi GET chưa khai báo bị chặn 501 và làm test đỏ. Fixture không kết nối backend/DB, không dùng hoặc mutate
`ipc_lane1`, và không được gọi là backend/DB E2E.

Lệnh final: `npx playwright test tests/weekly-menu-lifecycle-pa2b.spec.ts --headed --workers=1` — **6/6
pass trong 2,4 phút**.

| Viewport | Actor-scenario case | Interaction point | CLS max | Long task | Overflow |
|---|---:|---:|---:|---:|---|
| `1920×1080` | 23 | 535 | `0,04500` | 4 | 0 |
| `1440×900` | 23 | 535 | `0,05394` | 2 | 0 |
| `1366×768` | 23 | 535 | `0,05053` | 5 | 0 |
| `1365×900` | 23 | 535 | `0,05685` | 2 | 0 |
| `1280×900` | 23 | 535 | `0,05889` | 3 | 0 |

Tổng cộng: 11 scenario, 115 case, 2.675 interaction point, 115 screenshot và 1.235 API record.
Business mutation = 0; unhandled API = 0; overflow = 0; page error = 0; unexpected browser issue = 0.
Các console/request issue được giữ trong JSON nhưng đều được gắn nhãn expected: login/readiness fixture,
asset/font bị hủy khi fixture điều hướng và request loading bị hủy khi sang scenario kế.

Visual review trực tiếp đã kiểm tra tối thiểu ba ca biên: Manager có direct-complete ở `1920×1080`,
Coordinator không có link `Mở thu mua` ở `1280×900`, và Coordinator terminal không có contextual
business action ở `1366×768`.

Evidence authoritative:
`.artifacts/shipyard-live/pa2b-pc-weekly-menu-20260730/pa2b-pc-weekly-menu-fixture.json` và archive
`.artifacts/shipyard-live/pa2b-pc-weekly-menu-20260730.zip`.

## PC rerun — kết quả đo và disposition đã duyệt

| Nhóm PC | Context lệch duy nhất | Phép đo | Kết luận |
|---|---:|---:|---|
| `THIẾU` | 2 | 10/10 (hai context × năm viewport) | `draft × Manager`; `draft × Coordinator`; được duyệt là FE chặt hơn BE có chủ đích theo Option A. |
| `MỒ CÔI` | 0 | 0 | Không còn control FE lỏng hơn BE trong companion registry. |
| `IM LẶNG` | 0 | 0 | Không có ca đã đo đủ điều kiện nhóm này. |
| `LỆCH VỊ TRÍ` | 0 | 0 | Một page/object; không có cùng action ở vị trí thay thế. |

### FE chặt hơn BE — `THIẾU` được chấp nhận có chủ đích

1. `WeeklyMenuLifecycle × DRAFT × Manager`.
2. `WeeklyMenuLifecycle × DRAFT × Coordinator`.

Backend `CoordinationAccess → CoordinationRoles` cho phép cả Manager và Coordinator gọi version update.
Control thật `Publish` nằm trong Admin Data → Contract, trong khi route Admin Data yêu cầu wildcard admin.
Vì vậy Admin có control, Manager/Coordinator bị route guard chặn ở cả năm viewport. Audit chỉ ghi nhận
FE chặt hơn BE; không tự mở route hoặc chuyển control sang Weekly Menu vì đó là quyết định sản phẩm/policy.
Theo Option A đã duyệt, đây là disposition chủ đích: `Publish` vẫn **Admin-only** và không cần thay đổi
alignment FE/BE. Kết luận này không cấp quyền Publish cho Manager hoặc Coordinator.

### FE lỏng hơn BE — `MỒ CÔI`

Không còn ca này. `Mở thu mua` hiện được bọc `ActionGuard purchase.read`; Admin/Manager thấy link và
Coordinator không thấy. Route đích vẫn giữ `purchase.read`, nên control và navigation gate cùng vocabulary.

### Completion gate đã khớp

`Hoàn tất Ca Sáng/Chiều` dùng `coordination.order.lock`; Manager fixture nhận cùng canonical string như
backend. `active-incomplete` khớp cho Admin, Manager và Coordinator trên đủ năm viewport.

### Terminal đã khóa là không có action nghiệp vụ

`active-shortage-terminal` chạy đủ ba actor × năm viewport; `active-no-shortage` chạy Coordinator × năm
viewport. Cả 20 phép đo đều không có enabled contextual `Mở thu mua`, generate hoặc complete control.
`WeeklyMenuLifecyclePanel` đã bị gỡ; advisory `nextAction` chỉ còn trong model/registry contract và không
được render thành UI hoặc dùng để tự thêm nút.

### Bốn phép loại trừ cho hai context `THIẾU` còn lại

1. **Sau lớp điều hướng khác:** fixture đi thẳng tới Admin Data → Contract; hai actor bị chuyển sang
   `/forbidden`, không có surface publish thay thế trên Weekly Menu.
2. **Viewport khác:** cùng kết quả ở đủ năm viewport bắt buộc.
3. **Dữ liệu mẫu chưa đủ:** fixture có version DRAFT và schedule hợp lệ; Admin nhìn thấy `Publish` enabled.
4. **Sai vai/sai trạng thái:** login + `/auth/profile` trả đúng Manager/Coordinator; backend availability
   được chiếu từ `CoordinationAccess`, còn FE route guard được đo trực tiếp.

Loại trừ đủ bốn ⇒ hai context draft được ghi `THIẾU` trong phép đo; không còn lệch
completion/purchasing cũ. D-01 / DEC-08 chấp nhận hai context này là FE chặt hơn BE có chủ đích theo
Option A, không phải defect còn chờ xử lý.

## Operational E2E sau khi gỡ panel

Run authoritative dùng Chrome headed `1365×900`, source hiện tại và database disposable
`ipc_e2e_template`; `ipc_lane1` chỉ được clone/read và count nguồn được kiểm trước/sau. Chuỗi control thật:

1. Weekly Menu import wizard preview/commit workbook ANV canonical thành DRAFT.
2. Admin Data → Contract → `Publish` chuyển version thành ACTIVE.
3. Weekly Menu → Nhu cầu hoàn tất 12 ca bằng `Hoàn tất Ca Sáng/Chiều`.
4. `Tạo nhu cầu từ KHSX` sinh 6 material request.
5. Approval page duyệt đủ 6 demand.
6. Reload Weekly Menu và `Mở thu mua` điều hướng đúng `week` + `date`.

Kết quả: 28 mutation response, tất cả 2xx; 0 failed mutation, 0 console/page error, 0 unexpected request
failure. DB sau action có 1 version ACTIVE đã publish, 12 schedule ACTIVE, 12 quantity plan COMPLETED,
6 material request MANAGERAPPROVED, 350 line và 6 approval history. Sau capture, clone ngược từ
`ipc_lane1` khôi phục `ipc_e2e_template`; 61 bảng và các count kiểm chứng khớp nguồn.

Evidence authoritative:
`.artifacts/shipyard-live/pa2b-operational-weekly-menu-20260730/operational-weekly-menu-e2e.json`,
`database-after-e2e.json`, `database-rollback.json` và archive
`.artifacts/shipyard-live/pa2b-operational-weekly-menu-20260730.zip`.

## Ô chưa xác định và giới hạn mở rộng

- PA-2 gốc giữ nguyên mười role cell `KHÔNG-XÁC-ĐỊNH-ĐƯỢC`; PA-2B là companion, không sửa lịch sử đã
  duyệt. Trong 11 scenario PA-2B không còn ô actor/downstream/action-oracle
  `KHÔNG-XÁC-ĐỊNH-ĐƯỢC`.
- Backend availability của PA-2B là phép chiếu source policy có drift test, không phải runtime authorization
  E2E. Fixture chỉ chứng minh FE render và request interception.
- `WeeklyMenuLifecycleModel` vẫn thiếu approval/downstream state, nên nếu mở object khác hoặc sinh action
  chỉ từ `nextAction`, terminal có thể tiếp tục tạo false positive.
- Registry hiện là test fixture một object. Mở rộng được về schema, nhưng số case tăng theo
  `state × downstream × actor × viewport`; cần chọn scenario pairwise có căn cứ thay vì tích Descartes mù.
- Action vocabulary vẫn nằm rải giữa lifecycle model, demand model, route guard, dev login fixture và
  backend role policy. Object có nhiều workflow con sẽ vỡ trước ở khâu chứng minh source drift và mapping
  operation → control, không phải ở định dạng hàng.

## Quyết định được duyệt — 2026-07-31

1. D-01 / DEC-08 khóa **Option A**: control `Publish` thật tiếp tục nằm tại Admin Data → Contract sau
   wildcard-admin route và vẫn **Admin-only**.
2. DRAFT × Manager và DRAFT × Coordinator được chấp nhận là hai context FE chặt hơn BE có chủ đích.
   Backend `CoordinationAccess` có thể tiếp tục cho Manager/Coordinator update version; không cần đổi
   backend policy, frontend route/control placement, permission hoặc alignment FE/BE.
3. `OPEN-11` và `DEC-08` đóng ngày `2026-07-31`. Quyết định này không cấp Publish cho Manager hoặc
   Coordinator, không mở PD và không mở object thứ hai.

**ĐÃ ĐÓNG:** panel ngoài ý muốn đã gỡ, hai gate cũ đã khớp, operational E2E đã pass và disposition
Option A đã được duyệt. Không có thay đổi hành vi production, test, evidence, database hoặc runtime.
