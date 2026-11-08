---
phase: 22
block: P5
requirements: [CONF-01, CONF-02]
normative_rows: 20
sources:
  pb: 18
  pf_o3: 2
---

# UI conformance matrix

Ma trận này chỉ chuẩn hóa các quyết định đã được duyệt trong
`docs/PB-UI-VARIANT-AUDIT.md:59-76` và hai phép kiểm PF/O3 tại
`.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md:311-322`. Nó không phải bản thiết kế mới.

Quy ước:

- `PASS` là điều kiện nhị phân; không đạt toàn bộ mệnh đề trong ô là `FAIL`.
- `UNRESOLVED` nghĩa là nguồn được duyệt không cung cấp giá trị. P5 không tự điền giá trị đó.
- `docs/UI-CONFORMANCE-CANDIDATES.md` không phải nguồn normative của ma trận này.
- Bất biến nguồn: đúng 20 hàng — `PB-01..PB-18` và `PF-01..PF-02`; không có hàng thứ 21.

| ID | Khái niệm / quy tắc canon | Nguồn | Tầng đo | Điều kiện PASS nhị phân | Chiều chưa có nguồn |
|---|---|---|---|---|---|
| PB-01 | Trạng thái compact/row dùng `StatusBadge`; page summary dùng `ContextStrip`; giữ shell/scope banner theo ngữ cảnh. | `docs/PB-UI-VARIANT-AUDIT.md:59` | Source AST + render theo ngữ cảnh | PASS khi mọi trạng thái compact/row dùng `StatusBadge`, mọi page summary dùng `ContextStrip`, và chỉ shell/scope banner nằm ngoài hai nhóm đó. | UNRESOLVED: spacing, min-height, contrast ratio, pixel/golden, quota. |
| PB-02 | Initial loading dùng nhánh `QueryView`; refreshing giữ stale content và notice; table placeholder chỉ trong table; skeleton/spinner chỉ khi cần giữ geometry/focus. | `docs/PB-UI-VARIANT-AUDIT.md:60` | Render state + DOM context | PASS khi initial loading, refreshing và placeholder được phân biệt đúng bốn ngữ cảnh; không render refreshing như initial empty/loading. | UNRESOLVED: notice duration, skeleton geometry values, spacing, contrast ratio, pixel/golden, quota. |
| PB-03 | Server search dùng deferred query value; client filter immediate; URL chỉ giữ shareable scope; collection phân trang reset page/cursor thuộc owner. | `docs/PB-UI-VARIANT-AUDIT.md:61` | Hook/source ownership + query observation | PASS khi server query nhận deferred value, client filter không bị defer, URL chỉ chứa shareable scope và owner reset page/cursor khi input tương ứng đổi. | UNRESOLVED: debounce duration ngoài compatibility đã ghi, input width, spacing, pixel/golden, quota. |
| PB-04 | Quantity/count/percent dùng `formatNumber`, `formatQuantity*`, `formatPercent` với unit/precision tường minh; file size giữ formatter riêng. | `docs/PB-UI-VARIANT-AUDIT.md:62` | Source AST + formatted output | PASS khi presentation không còn local `toFixed`/bare locale helper ngoài exact model/file-size exceptions và output có unit/precision theo caller. | UNRESOLVED: typography geometry, spacing, contrast ratio, pixel/golden, quota. |
| PB-05 | Date-only và timestamp là hai contract riêng: date-only không dịch timezone; timestamp dùng guarded formatter. | `docs/PB-UI-VARIANT-AUDIT.md:63` | Source AST + formatter BVA | PASS khi date-only qua `formatDateOnly`, timestamp qua `formatDateTime`, invalid fallback được giữ và transport/arithmetic/native input không bị coi là presentation. | UNRESOLVED: display width, spacing, contrast ratio, pixel/golden, quota. |
| PB-06 | Retryable query error dùng `QueryErrorAlert`/error `EmptyState` hoặc retry tương đương; forbidden dùng danger feedback; cả hai không được mã hóa thành empty. | `docs/PB-UI-VARIANT-AUDIT.md:64` | Render branch + retry interaction | PASS khi retryable error có action retry hoạt động, forbidden có fixed danger feedback, và không nhánh nào dùng empty-result representation. | UNRESOLVED: alert min-height, contrast ratio, spacing, pixel/golden, quota. |
| PB-07 | Empty ngoài table dùng `EmptyState`; trong table dùng semantic empty row; thiếu prerequisite dùng `InlineAlert`; detail/dialog hẹp dùng compact text. | `docs/PB-UI-VARIANT-AUDIT.md:65` | DOM context + render branch | PASS khi mỗi empty case dùng đúng một trong bốn representation theo legal DOM/recovery context. | UNRESOLVED: illustration/icon, min-height, spacing, contrast ratio, pixel/golden, quota. |
| PB-08 | Table base là `TableViewport`; pagination adapter là `PaginatedTableFrame`; shadcn `Table` được nằm trong viewport; `DataTableShell` retired. | `docs/PB-UI-VARIANT-AUDIT.md:66` | Source composition + DOM semantics | PASS khi table boundary dùng canon adapter, caption/native table semantics còn nguyên, pagination ở đúng adapter boundary và production không gọi `DataTableShell`. | UNRESOLVED: row height, column width, spacing, contrast ratio, pixel/golden, quota. |
| PB-09 | Query-state canon là đại số `QueryView<T>` cộng domain boundary renderer, không ép một universal renderer. | `docs/PB-UI-VARIANT-AUDIT.md:67` | Source ownership + state render | PASS khi mọi boundary ánh xạ loading/error/forbidden/empty/ready theo cùng đại số và domain renderer giữ aggregation riêng. | UNRESOLVED: boundary geometry, spacing, contrast ratio, pixel/golden, quota. |
| PB-10 | Query feedback thuộc query boundary; success ngắn dùng Toast; actionable mutation error persistent trong màn; validation field-adjacent. | `docs/PB-UI-VARIANT-AUDIT.md:68` | Mutation/query interaction + accessibility | PASS khi mỗi feedback case thuộc đúng một trong bốn ngữ cảnh và actionable error/validation không biến mất trước khi người dùng xử lý. | UNRESOLVED: toast duration, placement pixel, spacing, contrast ratio, golden, quota. |
| PB-11 | Giữ riêng page/offset, cursor, finite grouped page và calendar-week navigation. | `docs/PB-UI-VARIANT-AUDIT.md:69` | Source contract + navigation behavior | PASS khi mỗi owner dùng đúng contract của mình và không chuyển opaque cursor/calendar step thành page-offset giả. | UNRESOLVED: control dimensions, spacing, contrast ratio, pixel/golden, quota. |
| PB-12 | Domain/form/dialog action dùng shadcn `Button`; giữ router `Link`, `CommandBar` và compact-control adapters. | `docs/PB-UI-VARIANT-AUDIT.md:70` | Source AST + interaction | PASS khi native domain/form/dialog button residual bằng 0 và chỉ exact Link/CommandBar/adapter exceptions còn lại. | UNRESOLVED: button min-width/min-height, spacing, contrast ratio, pixel/golden, quota. |
| PB-13 | Form dùng shadcn `Input`/`Select`/`Textarea`; giữ checkbox, file và pagination internals theo semantic contract. | `docs/PB-UI-VARIANT-AUDIT.md:71` | Source AST + form validity/accessibility | PASS khi native text/select/textarea residual bằng 0, exact semantic exceptions được count-lock và value/name/required/ARIA/submit payload không đổi. | UNRESOLVED: control width/min-height, spacing, contrast ratio, pixel/golden, quota. |
| PB-14 | Page action ở `CommandBar`; row action ở row; selected-object/form/dialog action cạnh đối tượng đó. | `docs/PB-UI-VARIANT-AUDIT.md:72` | Render placement + scope identity | PASS khi action xuất hiện đúng scope site và cùng action/scope không bị đặt ở lớp khác làm mơ hồ đối tượng tác động. | UNRESOLVED: exact offset, spacing, alignment pixel, contrast ratio, golden, quota. |
| PB-15 | Field error nằm cạnh control với `aria-invalid`/`aria-describedby`; form alert chỉ cho cross-field/server; native `required` là bổ sung. | `docs/PB-UI-VARIANT-AUDIT.md:73` | Form submit + accessibility tree | PASS khi invalid field có adjacent message được liên kết ARIA, cross-field/server error ở form level và native required không thay thế domain validation. | UNRESOLVED: error spacing, min-height, contrast ratio, pixel/golden, quota. |
| PB-16 | Currency dùng shared `formatCurrency`; range ghép hai endpoint đã format; không local helper/bare locale-money. | `docs/PB-UI-VARIANT-AUDIT.md:74` | Source AST + formatted output | PASS khi mọi currency display qua shared formatter, cả hai endpoint range được format độc lập và unit suffix vẫn đúng. | UNRESOLVED: decimal precision khi caller không khai, typography geometry, spacing, contrast ratio, pixel/golden, quota. |
| PB-17 | `ConfirmDialog` cho mutation yes/no đơn giản; rich `Dialog` khi quyết định cần reason, validation, evidence hoặc recoverable error. | `docs/PB-UI-VARIANT-AUDIT.md:75` | Source composition + decision interaction | PASS khi simple confirmation không chứa business form và rich decision không bị rút xuống yes/no làm mất reason/validation/evidence/error recovery. | UNRESOLVED: dialog dimensions, spacing, contrast ratio, pixel/golden, quota. |
| PB-18 | Work-object switching dùng `OperationalFrame` + `ViewSwitcher`; trang không có tab thì bỏ switcher. | `docs/PB-UI-VARIANT-AUDIT.md:76` | Route shell + render | PASS khi operational route dùng frame canon, chỉ trang có work-object alternatives render switcher và shell không tạo variant thứ hai. | UNRESOLVED: tab width/min-height, spacing, contrast ratio, pixel/golden, quota. |
| PF-01 | Cùng logical state ở hai vị trí cùng loại phải cho UI tương đương về action set, status label và mandatory information. | `.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md:311-315` | Paired state fixture + rendered UI diff | PASS khi cả ba projection — action set, status label, mandatory information — tương đương; bất kỳ khác biệt nào là FAIL và phải chỉ ra branch gây lệch. | UNRESOLVED: pixel identity, spacing, min-height, contrast ratio, golden threshold, pair quota. |
| PF-02 | Không có hidden state: presentation dependency phải nằm trong state đã khai báo; ad-hoc local/global/order/time/stale-cache dependency phải được inventory và disposition. | `.docs/UI-UX-ADDENDUM-KHONG-CO-FIGMA.md:317-322` | Static dependency inventory + disposition | PASS khi inventory không còn dependency ngoài declared state chưa disposition; mỗi finding có file:line và kết luận debt hoặc justified exception. | UNRESOLVED: scan quota, severity threshold, pixel/golden, viewport expansion, remediation deadline. |

## Phạm vi chưa được giải quyết ở P5

Các giá trị spacing, min-height, contrast ratio, pixel/golden tolerance, số lượng màn/cặp bắt buộc và quota finding
không có trong hai nguồn normative. Chúng tiếp tục là `UNRESOLVED`; P6 không được tạo assertion đỏ dựa trên các
giá trị này nếu chưa có quyết định bổ sung của người dùng.
