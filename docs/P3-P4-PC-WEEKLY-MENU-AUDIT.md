---
title: P3-P4-PC WeeklyMenuLifecycle UI action audit
audited_at: 2026-07-30
scope: WeeklyMenuLifecycle only
behavior_change: none
status: needs-user-decision
---

# P3 → P4 → PC — `WeeklyMenuLifecycle`

Audit này chỉ đo và báo cáo. Không source/policy/UI nào bị sửa, không mutation nghiệp vụ nào được gọi,
và không mở đối tượng thứ hai.

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
`WeeklyMenuPage`, rồi nối CommandBar, sáu tab, LifecyclePanel và view đang active tại
`WeeklyMenuPage.tsx:412-507`.

| Scenario PA | Next action kỳ vọng | Surface/selector đã tìm thấy | Source |
|---|---|---|---|
| `emptyModel` | Import và lưu thực đơn tuần | CommandBar `button "Nhập Excel"`; dialog `button "Lưu file hợp lệ"` sau khi có file hợp lệ | `WeeklyMenuCommandBar.tsx:31-39`; `WeeklyMenuPage.tsx:420-421,505`; `WeeklyMenuImportJobs.tsx:35-40,73-76`; `useWeeklyMenuImport.ts:157-169` |
| `draftModel` | Phát hành thực đơn | LifecyclePanel `button "Phát hành thực đơn"`; disabled phụ thuộc `canPublish` | `WeeklyMenuLifecyclePanel.tsx:47-65,117-128` |
| `activeIncompleteModel` | Nhập và hoàn tất số suất theo ca | tab `#demand-tab` → `#demand-panel` → các button `Hoàn tất {ca}` | `WeeklyMenuPage.tsx:441-452`; `WeeklyMenuViewContent.tsx:64-65`; `MaterialDemandSection.tsx:245-258` |
| `activeNotGeneratedModel` | Tạo nhu cầu vật tư | tab Nhu cầu → button `Tạo nhu cầu từ KHSX` khi `showGenerate` | `MaterialDemandSection.tsx:45-67,116-128`; `demandModel.ts:17-32` |
| `activeLoadingModel` | Đang đối chiếu nhu cầu vật tư | Không phải mutation action; lifecycle text và loading status | `weeklyMenuLifecycleModel.ts:117-120`; `MaterialDemandSection.tsx:272-277` |
| `activeErrorModel` | Tải lại nhu cầu vật tư | EmptyState error có retry callback | `weeklyMenuLifecycleModel.ts:119-120`; `MaterialDemandSection.tsx:282-289` |
| `activeShortageModel` | Chuyển các dòng thiếu sang Thu mua | Link contextual `Mở thu mua` chỉ render khi approval status là `approved`; href mang `week` + `date`. Sidebar còn có link generic `Thu mua` | `MaterialDemandSection.tsx:33,107-115`; `demandModel.ts:22-31,53-60`; `MainLayout.tsx:60`; `AppRouter.tsx:60` |
| `activeNoShortageModel` | Theo dõi cấp phát kho và bếp | Registry không có operation; source hiện có sidebar `Kho nguyên liệu` và `Bếp trưởng`, không có action contextual được model khai báo | `weeklyMenuLifecycleModel.ts:123-124`; `MainLayout.tsx:61-62` |
| `inconsistentModel` | Kiểm tra lại dữ liệu lịch thực đơn | Không có operation; LifecyclePanel giữ publish button disabled và đưa `blockedReason` vào `title` + InlineAlert | `weeklyMenuLifecycleModel.ts:69-90`; `WeeklyMenuLifecyclePanel.tsx:119-135` |
| `supersededModel` | Kiểm tra trạng thái version trên server | Không có operation; cùng blocked presentation như trên | `weeklyMenuLifecycleModel.ts:94-130`; `WeeklyMenuLifecyclePanel.tsx:119-135` |

Mapping này chứng minh nơi một control *có thể* render. Nó không chứng minh control đã render cho mọi
state/role; việc đó thuộc P4.

## P4 — phép đo Chrome headed

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

## CẦN QUYẾT

1. Duyệt kết quả PC hiện tại là **0 lệch đã xác nhận, 10 bối cảnh chưa kết luận được**; không mở PD từ
   audit này.
2. Chọn có mở rộng scenario key bằng approval/downstream state và actor/role trước khi chạy lại PC hay
   cung cấp một browser harness fixture read-only, deterministic cho mười state. Cả hai đều phải tránh
   mutate `ipc_lane1`.
3. Quyết định nghiệp vụ riêng: khi demand đã terminal `Đã xuất kho`, có cần giữ contextual deep-link
   `Mở thu mua` để tra cứu hay generic sidebar là đủ. Audit không tự chọn.

**DỪNG:** chờ duyệt trước PD, đối tượng thứ hai hoặc PE mới.
