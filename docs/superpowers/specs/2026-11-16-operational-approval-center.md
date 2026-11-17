# Trung tâm Duyệt vận hành — DEFAULT và MRX

> Native execution approved on 2026-11-16. Current progress and remaining acceptance are owned only by `.planning/WORK.md`; historical proposal wording below is superseded by that approval.

## Yêu cầu đã xác nhận

Người dùng yêu cầu nghiên cứu toàn codebase ERP, tập trung việc duyệt của Quản lý/Admin và kết hợp với phương án B xuất bổ sung. Ngày 16/11/2026 người dùng chọn một mục Duyệt vận hành cho cả DEFAULT và MRX, tách dữ liệu theo chế độ. Đối với suất phát sinh, Quản lý/Admin duyệt nhu cầu và Thủ kho xác nhận thực xuất.

Tài liệu là đề xuất thiết kế dựa trên source tại `05b920c06136e42516557cc044135d549a3c8a92`. Worktree `codex/operational-approval-center-20261116` được tạo từ HEAD của workspace gốc; hai tài liệu supplemental đã được chuyển sang để cập nhật. Các thay đổi code chưa commit ở workspace gốc không thuộc baseline source của worktree nghiên cứu này.

## Kết quả nghiên cứu

### Trang đã có nhưng phạm vi chưa đủ

`frontend/src/routes/routeRegistry.ts` đăng ký `/approvals` là Duyệt vận hành, chỉ DEFAULT, role Admin/Manager. `Features/SystemOperation/Services/SystemOperationEligibility.cs` không cung cấp navigation approvals cho MRX và đưa Approvals/ApprovalHistory/ApprovalRules vào nhóm excluded. MRX thay đổi nguồn dùng inbox/decision của `WeeklyMenuImportsController.Amendments.cs`.

`ApprovalInboxService` tập hợp sáu loại `material-demand`, `purchase-request`, `purchase-price-exception`, `inventory-issue`, `inventory-receipt`, `order-adjustment`. `ApprovalWorkflowService` có handler tương ứng và bước routing nhiều cấp cho material-demand/purchase-request. Kiểm kê và các review kỹ thuật vẫn đi endpoint riêng.

### Các khe hở cần xử lý trước khi mở rộng

| Finding | Bằng chứng source | Hệ quả và yêu cầu thiết kế |
|---|---|---|
| F01 — MRX không có trung tâm | routeRegistry và SystemOperationEligibility | Mở cùng route theo mode với query/commands phân loại đúng DOM-MODE-1 |
| F02 — FE chỉ đọc trang đầu | `api/approvalsApi.ts` bỏ cursor/hasNext, `ApprovalPage.tsx` lọc type tại client | Đưa filter và phân trang tới server, giữ nextCursor, không báo tổng bằng số dòng trang |
| F03 — Mã loại không khớp | FE chọn `purchase-order`, `warehouse-receipt`; BE phát `purchase-request`, `inventory-receipt` | Registry loại từ contract server, giữ alias cũ theo endpoint thực sự hỗ trợ; không tạo loại duyệt PO chỉ vì tên FE |
| F04 — Lịch sử sai DTO và nuốt lỗi | FE dùng actorName/createdAt/action nhưng BE trả ActionByName/ActionAt/Decision; transport `.catch(() => [])` | Map đúng hợp đồng và phân biệt loading/empty/error/403, không tạo lịch sử rỗng giả |
| F05 — Quét ứng viên có giới hạn | `ApprovalInboxService.GetPendingPageAsync` lấy candidateLimit tới 200 rồi mới áp filter chung | Push filter xuống từng query; chứng minh hồ sơ ngoài 200 vẫn tìm được và thứ tự keyset ổn định |
| F06 — Quyền không đồng nhất giữa loại | receipt handler chặn tự duyệt; workflow receipt kiểm tra Manager; variance waiver dùng AdminAccess | Authority phải theo loại/action/step, không suy rằng Admin và Manager có mọi nút giống nhau |
| F07 — History endpoint chỉ có Authorize ở controller | `ApprovalHistoryController` đọc targetType/id; query không nhận actor | Detail/history/attachments/counts đều cần target scope và mode; không chỉ bảo vệ nút quyết định |
| F08 — Nhiều bước cần kết quả riêng | workflow có `PENDING_NEXT_APPROVAL` | Bước duyệt thành công phải hiện Chờ bước tiếp theo nếu chưa đủ, không báo hồ sơ đã áp dụng |
| F09 — Snapshot FE thiếu scope | ApprovalPage cache `snapshot:approvals`, inbox key chỉ type | Key phải có actor/access scope/mode/modeVersion/filter/target; clear khi đổi mode/logout |

Các findings là source-backed. Không dùng chúng để kết luận trạng thái production hoặc số lượng pending thực tế.

## Các phương án và lựa chọn đề xuất

1. Chỉ mở rộng inbox MRX tại trang đối soát. Cách này không đạt mục tiêu một trung tâm cho toàn ERP.
2. Mở rộng `/approvals` làm điểm xử lý tập trung, giữ domain owner thực thi quyết định và audit. Đây là phương án khuyến nghị, phù hợp lựa chọn một mục cho cả hai mode.
3. Dựng workflow engine mới và chuyển mọi quyết định sang một bảng/state machine chung. Cách này yêu cầu thay đổi sâu nhiều hợp đồng đang vận hành và chưa có nhu cầu chứng minh cho việc thay toàn bộ engine.

Phương án 2 dùng registry hữu hạn các target có thật, inbox projection và dispatch tới use case hiện có. Authority nghiệp vụ, giá trị trạng thái, số bước duyệt và giao dịch thuộc module nguồn. Pending không lưu thành một trạng thái cạnh tranh ở trung tâm.

## Kiểm kê coverage toàn ERP

| Module | Phạm vi quản lý tại trung tâm | Cách tham gia |
|---|---|---|
| FR-AUTH | Xác thực, role/capability, scope và session đổi giữa lúc duyệt | Bảo vệ danh sách/detail/history/command, không tạo approval đăng nhập |
| FR-DASH | Điểm chờ duyệt theo actor/mode, link đúng hồ sơ | Đọc summary từ cùng inbox authority |
| FR-CAT | BOM/ingredient/import hiện là thao tác catalog có quyền | Giữ owner hiện có, chỉ đăng ký target nếu source có workflow pending/decision thực; không tự thêm duyệt mọi CRUD |
| FR-ADMIN | Quy tắc duyệt, chỉ định người/bước và cấu hình | Giữ trang cấu hình riêng, trung tâm đọc step đủ điều kiện |
| FR-MENU | Menu amendment và hậu kiểm/execution từng mode | Kết nối source owner, giữ khóa ngày và version |
| FR-COORD | Điều chỉnh số suất/đơn ăn và fan quyết định liên quan | Tái dùng inventory-adjustment owner/decision-item owner, không nhân bản một hồ sơ ở hai loại |
| FR-CHEF | Khai báo sai lệch/waiver thuộc Quản lý hoặc Admin | Chỉ quyết định đủ quyền đi trung tâm; nhận hàng, nhập sản lượng và thao tác Bếp vẫn ở trạm |
| FR-APPR | Sáu target hiện hữu, multi-step, SLA và history | Nâng cấp inbox/registry/dispatch và UX |
| FR-PUR | Đề nghị mua, price exception và chứng từ mua liên quan | Tái dùng target thật; supplier selection/quyết định áp giá giữ đúng owner và privilege |
| FR-WH | Phiếu nhập/xuất DEFAULT, kiểm kê, quyết định legacy linkage | Duyệt/review vào queue đúng type; kiểm hàng và ghi thực xuất giữ đúng vai trò |
| FR-RECON | MRX thay đổi nguồn, suất phát sinh, lệch và điều kiện chốt | Nhu cầu/decision vào trung tâm; hồ sơ phức tạp mở workbench chuyên môn từ cùng queue |
| FR-REP/FR-SYS | Data-quality disposition, unit-normalization review; mode transition | Review vào queue khi đúng mode/role; chuyển mode và apply Admin giữ action đặc thù |

## Ma trận target và action bắt buộc

Mode của một target phải được xác định từ operation owner trước khi query. Loại không được hoạt động trong mode hiện tại phải vắng ở list/counts và bị chặn khi deep-link/API.

| Loại/nhóm | Owner hiện tại | Đưa vào trung tâm và giữ giới hạn |
|---|---|---|
| Material demand | ApprovalInboxDemandSource, MaterialDemandController/handler | DEFAULT; approve/reject, routing và snapshot evidence |
| Purchase request | ApprovalInboxService, ApprovalWorkflowService/handler | DEFAULT; approve/reject, amount/rule/step đúng |
| Purchase price exception | PurchasePriceException approval handler | DEFAULT; proposal/version/evidence đúng đối tượng |
| Inventory issue DEFAULT | Approval handler | Duyệt phiếu theo workflow DEFAULT; không gộp với MRX actual issue |
| Inventory receipt | Approval handler, WarehousePurchaseReceiptsController | DEFAULT; giữ quality gate, self-approval guard và giới hạn Manager của owner |
| Order/inventory adjustment | InventoryAdjustmentApprovalHandler | DEFAULT; alias chuẩn, giữ source ảnh hưởng số suất |
| Stocktake | StocktakesController/StocktakeService | Theo phân loại mode của source; submit pending được liệt kê, approve/reject đúng quyền; review phân loại trước khi mở MRX |
| Menu amendment DEFAULT | MenuAmendmentService và WeeklyMenuImportsController.Amendments | Review của Manager, execute của Admin và break-glass tách quyền/trạng thái |
| Service-run decision items/fan | MenuAmendmentDecisionFanRemediator | DEFAULT theo owner; mỗi sub-decision định danh riêng, không báo cả yêu cầu hoàn tất khi một phần còn mở |
| Service confirmation/variance waiver | ServiceRunsController, ServiceRunVarianceDeclarationsController | Giữ quyền cụ thể; action Admin-only không mở cho Manager vì cùng trang |
| Legacy lineage disposition | LegacyLineageDispositionsController | Review và apply tách bước/quyền, mode phải theo source; evidence trước apply |
| Data quality disposition | DataQualityDispositionsController | DEFAULT hiện bị excluded trong MRX; review/apply tách quyền |
| Unit normalization review | UnitNormalizationReviewsController | DEFAULT hiện bị excluded trong MRX; correct reviewId/version/evidence |
| Receipt ghi sổ, hủy, sửa chứng từ | WarehousePurchaseReceiptsController | DEFAULT; Admin-only post/void/correction đi task trung tâm khi trạng thái cần quyết định; quality inspection vẫn do Kho ghi, giữ effect stock transaction riêng |
| Return allocation disposition | InventoryReturnsController | Quyết định Admin-only theo owner/mode thật; giữ lineage, chứng từ trả và stock effect hiện có |
| Order signoff | CoordinationOrdersController | Xác nhận vận hành theo role của endpoint hiện có, không tự gán thành Manager approval; hiện blocker/link nguồn khi cần phối hợp |
| Supplier decision và supplemental DEFAULT | PurchaseWorkflowController, SupplementalMaterialRequestsController | Thu mua chọn NCC, Kho fulfill/route/reject theo quyền trạm; price exception/purchase approval liên quan đưa vào queue Manager/Admin |
| MRX source change | MrxMenuAmendmentCoordinator, mrx-inbox/mrx-decision | MRX; Quản lý/Admin quyết định, ngày đã xuất vẫn khóa |
| MRX supplemental demand mới | Spec supplemental SD-01…07 | MRX; Quản lý/Admin duyệt suất tăng, Kho ghi actual issue sau duyệt |
| MRX discrepancy/completion | daily disposition, ReconciliationCompletionService | Review task cho người quyết định; mở đầy đủ context chuyên môn; không chuyển thành nút approve chung bỏ điều kiện chốt |

Với một action thiếu read/list owner, bước triển khai phải bổ sung read query có quyền và trạng thái thật trước khi khai báo coverage. Không báo target đã tích hợp chỉ vì có link điều hướng. Các thao tác như tạo PO, nhập kho thực tế, xác nhận nhận hàng, đóng băng, bàn giao và nạp dữ liệu là phần việc vận hành ở trạm chuyên môn; trung tâm có thể hiển thị blocker/link, chỉ mở quyết định đúng thẩm quyền.

## Hợp đồng trung tâm

### OC-01 — Mode, actor và scope

Route `/approvals` mở cho Admin/Manager ở DEFAULT/MATERIAL_RECONCILIATION, phụ thuộc capability server. Operation keys phân biệt read/detail/history/decision theo mode. Không bỏ cả nhóm excluded controller rồi tái sử dụng query DEFAULT cho MRX. Dùng facade đọc có mode guard và source adapters kiểm tra mode, dispatch domain command giữ disposition của owner.

Identity hồ sơ gồm mode, targetType, targetId và sub-decision/step nếu có. Không gộp theo display code. Cursor gắn actor/access-scope/mode/modeVersion/filter/sort; request đổi scope phải reset hoặc reject cursor cũ. Counts, history và detail áp cùng access policy. Áp customer assignment nếu domain có, giữ intentional-global scope đang được xác lập ở domain liên quan.

### OC-02 — Đọc đủ, phân trang và partial

Server nhận type, customer, week/date, search, task state và cursor. Filter áp trước take/merge của từng source. Keyset dùng sort thống nhất có tie-breaker duy nhất. Không lấy N dòng rồi mới lọc search/customer dẫn đến mất hồ sơ. Phải chứng minh tìm được target nằm sau 200 candidates.

Các bộ đếm dùng summary toàn scope đã phân quyền và định nghĩa rõ thời điểm đọc; số dòng trang có nhãn riêng. Chỉ báo còn trang khi có bằng chứng. Một source lỗi hiển thị partial và source bị thiếu, không báo tổng đầy đủ; 403 không làm lộ tên/count hồ sơ. Pending tiếp tục thay đổi khi nhiều người duyệt, nên reload lấy trạng thái hiện hành; outcome và history phục vụ xác minh hồ sơ vừa rời queue.

### OC-03 — Quyết định và bằng chứng

Detail trả current business state, version/fingerprint, decision stage, allowedActions/blockedReasons đã phân quyền, evidence và timeline từ owner. Payload action có commandId/expectedVersion hoặc expected fingerprint theo hợp đồng owner. Action đặc thù như approve/reject/review/execute/apply/waive/dispose/complete giữ nguyên ý nghĩa và nhãn.

Reuse protected transaction của owner. Nếu endpoint cũ thiếu kiểm soát version/replay thì bổ sung tại use case đó và kiểm tra tương thích caller cũ; không chỉ khóa nút FE. Hai người duyệt/hủy/apply cùng target chỉ một trạng thái hợp lệ, audit không trùng. Multi-step không để một người chiếm hai bước khi rule cấm. Tách requester/approver và quality gate theo quy tắc từng loại. Không tự mở Admin override cho mọi action.

API response phải phân biệt decision accepted, pending next approval, approved-awaiting-execution và applied. Sau quyết định acknowledged nhưng reload lỗi, khóa resend và hiện kiểm tra kết quả đã lưu. Lỗi mạng chưa rõ outcome phải replay/read receipt trước command mới. Từ chối bắt buộc lý do; lý do duyệt tuân theo owner. Evidence thay đổi sau mở detail làm mất hiệu lực xác nhận cũ.

### OC-04 — Lịch sử có authority

Timeline hợp nhất theo identity và domain events/audit đang có. Bao gồm submit, step approval, reject, correction, apply, cancel và effect receipt nếu domain phát ra. Map đúng ActionByName/ActionAt/Decision sang UI; nhận diện source family. Không suy approved/applied từ một audit message tự do. History endpoint phải có quyền đọc target và kiểm tra mode. Empty, unavailable và permission denied được phân biệt.

Hồ sơ hoàn tất hiển thị người quyết định, thời điểm, lý do, bước trước/sau và liên kết nguồn đúng quyền. Giao dịch Kho/giá/duyệt không được hiển thị cho actor chỉ được xem phần Bếp. Client-side filter không phải biên bảo mật.

### OC-05 — UI tập trung theo design system

Một mục sidebar Duyệt vận hành. Leaves dự kiến `Chờ xử lý`, `Đã xử lý` và `Lịch sử`; nếu `Đã xử lý` và history không có nhu cầu dữ liệu riêng, hợp nhất thành `Lịch sử` trong bước UI để tránh lặp. Filter loại, khách hàng, ngày/tuần và mức ưu tiên ở header. Dùng server state phù hợp, không thêm tab kiểu chứng từ song song sidebar.

Bảng ngoài gồm mã/tên hồ sơ, nghiệp vụ/khách hàng, phạm vi ngày/ca, người gửi, thời điểm/hạn, trạng thái/bước hiện tại và thao tác `Xem xét`. Chỉ hiện amount hoặc quantity khi hữu ích cho loại đó. Không cộng kg/quả hay tiền/số suất thành một KPI. Modal detail chuẩn shared Modal ở viewport nhỏ; desktop có thể reuse SplitView với một primary action và cặp quyết định theo D7. Số lượng trước/sau và badge căn đúng cột, không ép dữ liệu chi tiết thành bảng ngang dài.

Impeccable mode Operate; authority là docs/DESIGN.md, UI-KIT, index.css và primitives hiện có. Trước TSX/CSS, xuất Scoped Pre-Code UI Gate cho route/work object/mode/guards/6 states, đọc craft-floor, kiểm D6/D7/T7/T8/M1.2/N6. Screenshot cần nguồn fixture hay live rõ ràng. Loading, empty, error, denied, partial và write-reconciliation có hành vi riêng.

### OC-06 — Chuyển lối vào từ các trang nhỏ

Trang nghiệp vụ giữ nơi lập/gửi, trạng thái, kết quả và link tới trung tâm đúng target. Các entry duyệt Quản lý/Admin trỏ về cùng detail/command owner tại trung tâm. Chuyển từng loại sau khi parity đủ; không xóa endpoint tương thích đang có caller. Trong giai đoạn chuyển, cả hai entry gọi cùng service, version và replay fence.

Nghiệp vụ cần bảng so sánh sâu như đối soát chênh lệch vẫn mở workbench chuyên môn có breadcrumb quay lại queue và cùng identity/version. Không xây bản sao thiếu context để ép mọi quyết định thành một modal chung. Quyền/khóa/count/history phải thống nhất giữa hai lối vào.

### OC-07 — Kết hợp xuất bổ sung

Nhu cầu suất phát sinh dùng target `mrx-supplemental-demand` ở `/approvals`. Kho lập/gửi request và theo dõi kết quả tại modal của mình. Quản lý/Admin xem ngày/ca/mặn-chay/món/suất tăng/BOM cùng version rồi duyệt. Approved demand xuất hiện ở phiếu bếp và trạm Kho; Thủ kho tạo phiếu theo lượng thực xuất.

Trung tâm không xác nhận actual issue thay Kho. Khóa nguồn gốc, allocation baseline/extra, cancellation, completion, snapshot và history vẫn theo spec supplemental. Pending demand phải hiện đồng thời ở blocker chốt lô và queue, cùng một identity và trạng thái. Cùng kiểu target có thể nhiều khách/ngày/ca nên không ghép theo tên món.

## Coverage và nghiệm thu

| AC | Bằng chứng bắt buộc |
|---|---|
| OC-AC01 | Mọi target trong matrix có nguồn query, owner command, policy/mode, history, tests và trạng thái triển khai; gap không được giấu bằng allowlist |
| OC-AC02 | Manager/Admin có trang chung đúng mode; Coordinator/Warehouse/Chef bị chặn read/command trái quyền |
| OC-AC03 | Đổi mode/logout/đổi actor không giữ rows/detail/count/history/cursor của scope cũ |
| OC-AC04 | Sáu target DEFAULT hiện hữu giữ behavior, alias thật và multi-step; FE lọc type khớp wire |
| OC-AC05 | MRX source change vào queue; locked-day request không được trung tâm duyệt vượt luật |
| OC-AC06 | Supplemental request pending → approved → partial actual → đủ, ba role đúng việc, nguồn gốc không đổi |
| OC-AC07 | Mỗi loại read/list/detail/history/command kiểm permission và assignment, kể cả đoán UUID/cross-customer |
| OC-AC08 | Với >200 hồ sơ và >50 mỗi loại, mọi filter/search/cursor tìm được hồ sơ cuối, ties không trùng hoặc mất |
| OC-AC09 | Three customers/week, pending giống tên/mã nhưng khác mode/type/step không bị gộp nhầm |
| OC-AC10 | Approve/reject/cancel đồng thời, replay, partial transaction và lost response có zero duplicate effects |
| OC-AC11 | Step-approved, approved-pending-execution và applied hiển thị đúng; update history không bị rỗng do lỗi |
| OC-AC12 | Source outage hiện partial đúng, không báo full total, retry không gửi lại quyết định đã lưu |
| OC-AC13 | Receipt quality/self-approval, Admin-only apply/waiver, assignment và SoD giữ đúng theo từng owner |
| OC-AC14 | Queue, dashboard summary, source pages, detail/history/export cùng scope và trạng thái |
| OC-AC15 | Chuyển entry khỏi trang nhỏ theo parity, link cũ vẫn tới đúng target, stale update được từ chối |
| OC-AC16 | Impeccable/contract tests và hình tại 1440×900, 960×720, 600×480, zoom 200%; keyboard/focus/one-modal đúng |
| OC-AC17 | Các MRX writes giữ stock/lot/movement bất biến; DEFAULT stock effects vẫn theo owner |
| OC-AC18 | Clone regression có nguồn/cleanup verified; production release là bước riêng có bằng chứng |

## Rủi ro và lựa chọn đề xuất cần duyệt

Phạm vi trải nhiều module nên triển khai theo wave, registry chỉ công bố loại đã được nối đủ list/detail/action/history. Chọn đầu tiên là sửa nền route/mode/contract/paging, giữ sáu target DEFAULT rồi tích hợp các quyết định đang rải rác và MRX. Sau đó bổ sung nhu cầu suất tăng theo spec riêng.

Bản thiết kế đề xuất không có duyệt hàng loạt ở đợt đầu, vì các loại có side effects, step và dữ liệu bắt buộc khác nhau. Có thể chọn nhiều dòng để theo dõi; action quyết định cần kiểm đúng từng hồ sơ. Đây là lựa chọn giới hạn triển khai, không phải luật cấm nghiệp vụ vĩnh viễn.

Ma trận trên là inventory tĩnh, chưa chứng minh production đang phát sinh đủ từng loại. Baseline docs/tooling 29 tests PASS; không suy từ đó thành PASS runtime. Quyết định mở thêm quyền Admin cho các luồng hiện chỉ Manager hoặc ngược lại phải được duyệt như thay đổi policy riêng.
