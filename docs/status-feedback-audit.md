# System-Wide Status & Feedback Pattern Audit

Tài liệu kiểm kê và phân loại hiện trạng hiển thị trạng thái, phản hồi, cảnh báo, lỗi và blocker trên toàn hệ thống IPCManagement.

---

## I. Nguyên tắc phân loại chuẩn

1. **Business Status (`StatusLozenge`)**: Trạng thái của business object hoặc workflow (Bản nháp, Đã duyệt, Đã đặt hàng, Nhận một phần, Hoàn tất, Đã hủy). Sử dụng `StatusLozenge` (hoặc `StatusBadge` kết nối registry), không dùng generic badge hay CSS ad-hoc.
2. **Notification Badge (`NotificationBadge`)**: Chỉ dùng cho số lượng, đếm dòng, chấm thông báo (ví dụ: `3`, `12+`, unread dot, sequence step `1`).
3. **Inline Alert (`InlineAlert`)**: Thông báo trong phạm vi một khu vực/section/panel về điều kiện cần lưu ý.
4. **Page/System Banner (`PageBanner`)**: Thông báo ảnh hưởng toàn trang hoặc toàn ca vận hành.
5. **Toast / Feedback (`ToastProvider`)**: Phản hồi tạm thời sau thao tác (Lưu thành công, Thất bại).
6. **KPI / Metric (`MetricCard`)**: Số liệu tổng hợp (Tổng suất ăn, Tồn kho, Số nhà cung cấp).
7. **Empty State (`EmptyState`)**: 4 trạng thái chuẩn (`empty`/`uncreated`, `filtered`, `error`, `forbidden`).
8. **Action Availability (`ActionAvailability` / `DisabledReason`)**: Lý do chức năng bị vô hiệu hóa vì điều kiện nghiệp vụ bình thường. Không dùng error alert thay thế.
9. **Technical Diagnostic (`DiagnosticPanel`)**: Lỗi kỹ thuật, stack trace, exception, mã lỗi backend. Bắt buộc tách khỏi UI người dùng thông thường.

---

## II. Bảng kiểm kê trạng thái hệ thống (Status Inventory)

| Location / Route | Component / File | Current label | Business object | Current type | Correct pattern | Current color | Current behavior | Severity | User action required? | Business or Technical? | Duplicate? | Problem | Proposed solution |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/warehouse` | `WarehousePurchaseOrdersPanel.tsx` | "Nhận một phần" / "Đã đặt hàng" / "Hoàn tất" | `PurchaseOrder` | `StatusBadge` với inline ternary | `StatusLozenge` | `warning` / `info` / `success` | Hiển thị trạng thái đơn mua hàng trong bảng | `warning` / `info` / `success` | Có (khi nhận một phần cần tiếp tục nhận) | Business | Có (lặp lại ở nhiều file) | Ternary `order.status === 'COMPLETED' ? ...` tự định nghĩa màu tại component | Chuyển sang resolve từ `purchaseStatusRegistry` |
| `/warehouse` | `WarehousePage.tsx` | "Không thể tạo phiếu xuất kho mới" | Hành động tạo phiếu xuất | `InlineAlert` (h2 level) | `ActionAvailability` | `info` (`border-blue-200 bg-blue-50`) | Render một InlineAlert h2 lớn toàn trang khi chưa đủ điều kiện tạo phiếu xuất | `neutral` | Không (đây là điều kiện bình thường) | Business | Không | Dùng Banner/Alert toàn màn hình để giải thích nút disabled, gây nhiễu thị giác và sai lệch heading level | Chuyển lý do vào `ActionAvailability` (tooltip/helper text gắn liền với nút) |
| `/warehouse` | `WarehousePurchaseReceiptDialog.tsx` | "Lỗi lưu phiếu" | Form nhập kho | Custom div `role="alert"` | `InlineAlert` | `border-red-200 bg-red-50 text-red-900` | Render thông báo lỗi bằng div thủ công | `danger` | Có (sửa form/thử lại) | Business | Có (lặp lại ở nhiều dialog) | Hardcode màu và cấu trúc div thay vì dùng shared component | Thay bằng `<InlineAlert variant="danger">` |
| `/warehouse` | `WarehouseBatchPurchaseReceiptDialog.tsx` | Lỗi tạo phiếu hàng loạt | Batch Receipt | Custom `p role="alert"` | `InlineAlert` | `border-red-200 bg-red-50 text-red-800` | Render thông báo lỗi bằng thẻ p thủ công | `danger` | Có | Business | Có | Hardcoded alert box | Thay bằng `<InlineAlert variant="danger">` |
| `/warehouse` | `WarehouseReceiptLifecyclePanel.tsx` | "Lý do: ..." | Dòng phiếu nhập | Thẻ span inline | `StatusLozenge` / Helper text | `text-amber-800` | Hiển thị lý do kiểm tra chất lượng | `warning` | Có (cần xử lý chất lượng) | Business | Không | Hardcoded text color `text-amber-800` | Dùng semantic token `--status-warning-fg` |
| `/warehouse` | `WarehouseExceptionsWorkbench.tsx` | `fulfillError`, `rejectError`, `returnError` | Phiếu ngoại lệ kho | 3 div bọc `InlineAlert` | `InlineAlert` | `danger` | Render nhiều alert riêng biệt khi có lỗi | `danger` | Có | Business | Có | Trình bày alert phân tán | Giữ `InlineAlert variant="danger"` nhưng chuẩn hóa semantic token |
| `/warehouse` | `ReconciliationWarehousePage.tsx` | Trạng thái chênh lệch xuất kho (`over`/`under`/`valid`) | Lô xuất kho đối chiếu | `StatusBadge` | `StatusLozenge` | Inline ternary `warning`/`danger`/`neutral`/`success` | Hiển thị trạng thái so khớp số lượng xuất | `warning`/`danger` | Có (khi lệch cần điều chỉnh) | Business | Không | Logic ternary dài trực tiếp tại cell | Đưa vào `reconciliationStatusRegistry` |
| `/warehouse` | `ReconciliationWarehousePage.tsx` | "Không tải được kho vận hành..." / "Không tải được lô..." | Query kho & batch | Thẻ p/section custom | `QueryErrorAlert` | `text-red-700`, `border-red-200 bg-red-50` | Render lỗi query bằng thẻ tùy tiện | `danger` | Có (nút Thử lại) | Business | Có | Thiếu nhất quán với `QueryErrorAlert` | Thay bằng `<QueryErrorAlert>` |
| `/chef-dashboard` | `ChefDashboardPage.tsx` | "KHSX có nhu cầu mua ban đầu; blocker cấp vật tư hiện tại xem tại Ca phục vụ." | Kế hoạch sản xuất ca | Chuỗi warning raw từ backend | `TechnicalDiagnosticSeparation` | `warning` | Chuỗi thô từ backend hiển thị trong danh sách cảnh báo bếp | `warning` | Có (xem nhu cầu mua) | Technical leak | Không | Ngôn ngữ kỹ thuật ("KHSX", "blocker cấp vật tư") gây khó hiểu cho bếp trưởng | Chuyển thành: "Chưa thể cấp nguyên liệu. Kế hoạch mua nguyên liệu cho ca này chưa hoàn tất." kèm action "Xem nhu cầu nguyên liệu" |
| `/chef-dashboard` | `ChefDashboardPage.tsx` (`ShiftAlert`) | "Kế hoạch điều phối chưa chốt" | Trạng thái ca sản xuất | `InlineAlert` | `InlineAlert` + Action | `warning` | Hiển thị cảnh báo ca chưa chốt | `warning` | Có | Business | Không | Thiếu action điều hướng trực tiếp đến Điều phối | Thêm action button "Xem kế hoạch điều phối" |
| `/chef-dashboard` | `chef-header.tsx` | `productionPlan.shift` (Ca sáng / Ca chiều) | Ca làm việc | `Badge` (shadcn generic) | Read-only Metadata Field | `secondary` + hardcoded white/slate | Bọc ca làm việc trong component Badge | `neutral` | Không | Business | Không | Dùng Badge sai mục đích (thông tin định danh bị coi là badge trạng thái) | Dùng text/chip metadata rõ ràng |
| `/chef-dashboard` | `chef-header.tsx` | `totalMeals` (Tổng suất ăn) | Tổng suất ăn | Text `text-4xl font-black text-amber-600` | `MetricCard` | `text-amber-600` hardcoded | Hiển thị số lượng suất ăn với màu cam hardcode | `neutral` | Không | Business | Không | KPI bị hardcode màu cảnh báo | Dùng `MetricCard` với typography chuẩn |
| `/chef-dashboard` | `material-checklist.tsx` | "Đã nhận" / "Chờ nhận" / "Đã nhận đủ" | Dòng xuất kho bàn giao | `StatusBadge` | `StatusLozenge` | Inline ternary `material.signed ? 'success' : 'warning'` | Hiển thị trạng thái ký nhận nguyên liệu | `success`/`warning` | Có (khi chờ nhận cần ký) | Business | Có (lặp lại 3 lần trong file) | Logic ternary lặp lại ở cả dòng chi tiết và dòng tổng hợp | Chuyển sang `chefStatusRegistry` |
| `/chef-dashboard` | `ChefProductionSection.tsx` | "Kế hoạch đã đồng bộ" / "Chờ Điều phối gửi" | Trạng thái đồng bộ kế hoạch | `StatusBadge` | `StatusLozenge` | `success`/`neutral`/`danger`/`warning` | Hiển thị trạng thái đồng bộ kế hoạch ca | `success`/`warning` | Có | Business | Không | Hardcode các giá trị badge phân tán | Đưa vào `chefStatusRegistry` |
| `/chef-dashboard` | `ServiceRunSection.tsx` | Trạng thái ca phục vụ (`PLANNED`, `IN_SERVICE`, `CLOSED`) | `ServiceRun` | `StatusBadge` | `StatusLozenge` | `variant={tone(run.status)}` | Hiển thị vòng đời ca phục vụ | `neutral`/`info`/`success` | Có | Business | Không | Phân tán logic tone | Sử dụng `serviceRunStatusRegistry` |
| `/meal-orders` | `order-status-banner.tsx` | "Ca này đã khóa" / "Dữ liệu đang ở trạng thái nháp" | Trạng thái điều phối ca | Component banner custom | `PageBanner` | Local `toneClasses` (`border-blue-200...`, `border-amber-200...`) | Hiển thị banner trạng thái khóa/nháp của ca | `info`/`warning`/`success` | Có (khi nháp cần chốt đơn) | Business | Không | Tự định nghĩa bảng màu CSS nội bộ không liên kết token hệ thống | Chuyển sang dùng `PageBanner` và semantic tokens |
| `/meal-orders` | `dish-detail-dialog.tsx` | Số lượng món trong nhóm (ví dụ: `4`) | Nhóm món ăn | Custom span `rounded-full` | `NotificationBadge` | `dishRoleStyles` (`bg-pink-100 text-pink-700`, `bg-slate-200`) | Hiển thị số đếm số món | `neutral` | Không | Business | Không | Hardcode màu sắc và tự tạo counter tròn thủ công | Dùng `<NotificationBadge count={group.dishes.length} />` |
| `/meal-orders` | `action-toolbar.tsx` | `confirmationError` | Thao tác chốt/gửi ca | Custom div bọc `InlineAlert` | `InlineAlert` | `danger` | Hiển thị lỗi xác nhận thao tác | `danger` | Có | Business | Có | Bọc thừa div role alert bên ngoài InlineAlert | Dùng trực tiếp `<InlineAlert variant="danger">` |
| `/purchasing` | `PurchaseDecisionPanel.tsx` | "Đang chọn" | Ứng viên nhà cung cấp | `StatusBadge` | `StatusLozenge` | `warning` | Đánh dấu nhà cung cấp đang được chọn trong drawer | `info`/`neutral` | Có (xác nhận lựa chọn) | Business | Không | Dùng tone warning cho trạng thái đang chọn thông thường | Dùng tone `info` hoặc `neutral` có chủ đích |
| `/purchasing` | `PurchaseDecisionPanel.tsx` | "Cần xử lý" | Ngoại lệ giá | `StatusBadge` | `StatusLozenge` | `warning` | Đánh dấu ngoại lệ giá đang chặn đề xuất mua | `warning` | Có (cần giải quyết ngoại lệ) | Business | Không | Hardcode nhãn và tone | Đưa vào `purchaseStatusRegistry` |
| `/purchasing` | `PurchaseDecisionPanel.tsx` | "Đã nhận đủ" / "Nhận một phần" / "Chưa nhận" | Tiến độ nhập kho | `StatusBadge` | `StatusLozenge` | Inline ternary `complete ? 'success' : partial ? 'warning' : 'neutral'` | Hiển thị tiến độ nhập kho trên thẻ handoff | `success`/`warning`/`neutral` | Có | Business | Có | Ternary lặp lại | Đưa vào `purchaseStatusRegistry` |
| `/purchasing` | `SupplierQuotationSection.tsx` | "Tốt nhất" | Báo giá nhà cung cấp | Custom span `bg-emerald-100 text-emerald-800` | `StatusLozenge` | `bg-emerald-100` hardcoded | Đánh dấu báo giá có đơn giá tốt nhất | `success` | Không | Business | Không | Viết span inline hardcoded CSS thay vì dùng primitive | Dùng `<StatusLozenge tone="success">Tốt nhất</StatusLozenge>` |
| `/purchasing` | `PurchaseWorkflowGuide.tsx` | Sáu bước thu mua (Nhu cầu, Đề xuất, Duyệt, v.v.) | Vòng đời quy trình thu mua | Custom buttons với inline styles | `WorkflowStepper` / Guide Primitive | `bg-blue-50 text-blue-900`, `border-slate-300` | Hiển thị tiến trình 6 giai đoạn thu mua | `info`/`neutral` | Có (chuyển bước) | Business | Không | Hardcode mã màu class trực tiếp | Token hóa trạng thái hoàn tất/hiện tại/chặn |
| `/purchasing` | `SupplementalPurchasingWorkbench.tsx` | Trạng thái đơn mua bổ sung | Yêu cầu mua bổ sung | `StatusBadge` | `StatusLozenge` | Inline ternary `purchase?.status === 'DRAFT' ? 'warning' : 'neutral'` | Hiển thị trạng thái đơn mua bổ sung | `warning`/`neutral` | Có | Business | Có | Ternary lặp lại | Sử dụng `purchaseStatusRegistry` |
| `/reports` | `ReportsPricePanel.tsx` | "Vượt ngưỡng" / "Theo dõi" | Biến động giá dòng/NCC/kỳ | `StatusBadge` | `PriceVarianceLozenge` | `danger` / `warning` hardcoded | Hiển thị cảnh báo biến động đơn giá >15% hoặc >0% | `danger` / `warning` | Có (xem đề xuất) | Business | Có (lặp lại 6 lần qua 3 subviews) | Cùng một cụm logic render bị lặp lại ở tab lines, supplier, period | Gom thành một component/helper dùng chung |
| `/reports` | `ReportsDataQualityPanel.tsx` | Severity lỗi dữ liệu (`error`/`warning`) & Trạng thái xử lý (`resolved`/`reopened`/`open`) | Sự cố chất lượng dữ liệu | `StatusBadge` | `StatusLozenge` | Inline ternary `severity === 'error' ? 'danger' : 'warning'` | Hiển thị mức độ nghiêm trọng và trạng thái khắc phục | `danger`/`warning`/`success`/`neutral` | Có | Business | Có (lặp lại ở AdminCleanupPanel) | Ternary trùng lặp giữa Reports và Admin | Dùng chung `adminDataQualityStatusRegistry` |
| `/reports` | `ServiceRunReportPanel.tsx` | "Không tải được điều chỉnh hậu kiểm..." | Query điều chỉnh hậu kiểm | Thẻ span `role="alert" text-red-700` | `InlineAlert` | `text-red-700` | Thông báo lỗi query inline | `danger` | Có (thử lại) | Business | Không | Thẻ span thô sơ thiếu cấu trúc chuẩn | Dùng `InlineAlert variant="danger"` |
| `/reconciliation` | `ReconciliationComparisonTable.tsx` | "Khớp" / "Khớp trong ngưỡng" / "Cần kiểm tra" / "Chưa xuất đủ" / "Đã xử lý" | Dòng đối chiếu nguyên liệu | `StatusBadge` | `StatusLozenge` | Nested ternary 4 cấp (`line.status === 'MATCHED' ? ...`) | Hiển thị kết quả so khớp số lượng yêu cầu vs xuất | `success`/`info`/`warning`/`danger` | Có (khi cần kiểm tra/chưa xuất đủ) | Business | Không | Ternary 4 tầng lồng nhau cực kỳ khó bảo trì | Đưa vào `reconciliationComparisonRegistry` |
| `/reconciliation` | `ReconciliationComparisonTable.tsx` | Highlight dòng bảng (`bg-amber-50/25`, `bg-rose-50/25`, `bg-blue-50/20`) | Dòng bảng đối chiếu | Inline CSS class string | Semantic Table Row Class | `bg-amber-50/25`, `bg-rose-50/25` | Đổi màu nền dòng theo mức độ chênh lệch | `warning`/`danger`/`info` | Không | Business | Không | Hardcode các mã màu alpha trong TSX | Dùng class semantic `.is-warning-subtle`, `.is-danger-subtle` |
| `/reconciliation` | `ReconciliationDashboardPage.tsx` | Trạng thái lô đối chiếu | Lô đối chiếu | `StatusBadge` | `StatusLozenge` | Inline ternary `status === 'COMPLETED' ? 'success' : ...` | Hiển thị trạng thái lô trên dashboard | `success`/`warning`/`neutral` | Có | Business | Có | Trùng logic với ReconciliationLifecycleStrip | Dùng chung `reconciliationStatusRegistry` |
| `/admin-data` | `AdminBomPanel.tsx` | Lỗi dòng import BOM (`row.errors[0]`, `row.warnings[0]`) | Dòng preview BOM | `StatusBadge` | Cell Diagnostic Indicator | `danger` / `warning` | Bọc toàn bộ câu lỗi/cảnh báo dài trong StatusBadge | `danger`/`warning` | Có (sửa file import) | Technical / Business | Không | Dùng StatusBadge sai mục đích (hiển thị câu mô tả lỗi dài thay vì mã trạng thái) | Dùng text thông báo lỗi bảng thông thường |
| `/admin-data` | `AdminContractsPanel.tsx` | "Đang hiệu lực" / "Hết hiệu lực" | Hợp đồng khách hàng | `StatusBadge` | `StatusLozenge` | `contract.isActive ? 'success' : 'warning'` | Hiển thị trạng thái hiệu lực hợp đồng | `success`/`neutral` | Có (khi hết hạn) | Business | Có | Gán màu warning cho trạng thái không hoạt động bình thường | Đưa vào `adminStatusRegistry` với tone `neutral` cho inactive |
| `/admin-data` | `AdminEmployeesPanel.tsx` | "Hoạt động" / "Tạm ngưng" | Nhân viên | `StatusBadge` | `StatusLozenge` | `employee.isActive ? 'success' : 'neutral'` | Hiển thị trạng thái nhân viên | `success`/`neutral` | Không | Business | Có | Trùng lặp với hợp đồng và quy tắc duyệt | Dùng chung boolean status registry |
| `/admin-data` | `AdminCleanupPanel.tsx` | Trạng thái xử lý dữ liệu (`resolved`, `reopened`) | Dòng dữ liệu cần dọn dẹp | `StatusBadge` | `StatusLozenge` | `remediationStatus === 'resolved' ? 'success' : ...` | Hiển thị tiến độ xử lý dữ liệu lỗi | `success`/`danger`/`neutral` | Có | Business | Có (trùng với ReportsDataQualityPanel) | Lặp lại mapping trạng thái | Dùng chung `adminDataQualityStatusRegistry` |
| `/approval-rules` | `ApprovalRulesPage.tsx` | Số thứ tự duyệt (sequence `1`, `2`) | Bước duyệt quy tắc | Span `rounded-full bg-blue-50 text-blue-600` | `NotificationBadge` | `bg-blue-50 text-blue-600` | Hiển thị số thứ tự trong luồng phê duyệt | `neutral` | Không | Business | Không | Tự viết span tròn thủ công | Dùng `<NotificationBadge count={a.sequence} />` |
| `/approval-rules` | `ApprovalRulesPage.tsx` | "Bắt buộc" | Phê duyệt viên bắt buộc | Span `bg-red-50 text-red-700` | `StatusLozenge` | `bg-red-50 text-red-700` | Đánh dấu người duyệt là bắt buộc | `danger` | Không | Business | Không | Viết span inline hardcoded màu đỏ | Dùng `<StatusLozenge tone="danger">Bắt buộc</StatusLozenge>` |
| `/weekly-menu` | `QuickServingCell.tsx` | "Đã hoàn tất" / "Đang lưu" / "Chưa lưu" / "Tạm từ tệp" / "Chưa có kế hoạch" | Ô nhập số suất ăn | `StatusBadge` | `StatusLozenge` | Nested ternary 5 cấp | Hiển thị trạng thái số suất của ô trong ma trận tuần | `success`/`warning`/`neutral` | Có (khi chưa lưu/chưa có kế hoạch) | Business | Không | Logic lồng nhau 5 cấp cực kỳ rối | Đưa vào `quickServingStatusRegistry` |
| `/weekly-menu` | `WeeklyMenuReadiness.tsx` | Các checkpoint sẵn sàng tuần | Trạng thái kế hoạch tuần | Custom span + rounded-full | `StatusLozenge` | `bg-emerald-50`, `bg-amber-50`, `bg-rose-50` | Hiển thị tiến độ hoàn thành các bước kế hoạch | `success`/`warning`/`danger` | Có | Business | Không | Hardcode các class màu trực tiếp | Chuẩn hóa dùng semantic tokens |

---

## III. Các trường hợp Technical Diagnostic Leakage cần tách biệt

1. **`ProductionPlanService.cs` → `ChefDashboardPage.tsx`**:
   - *Hiện tại*: Cảnh báo thô `"KHSX có nhu cầu mua ban đầu; blocker cấp vật tư hiện tại xem tại Ca phục vụ."` được render trực tiếp vào danh sách cảnh báo của Bếp trưởng.
   - *Chuẩn hóa*: Chuyển thành ngôn ngữ nghiệp vụ: *"Chưa thể cấp nguyên liệu. Kế hoạch mua nguyên liệu cho ca này chưa hoàn tất."* kèm nút hành động *"Xem nhu cầu nguyên liệu"*.
2. **`AdminBomPanel.tsx`**:
   - *Hiện tại*: StatusBadge bọc toàn bộ chuỗi lỗi validation raw từ backend (ví dụ: `row.errors?.[0]`).
   - *Chuẩn hóa*: Tách riêng cột trạng thái (Hợp lệ / Có lỗi) và khu vực hiển thị chi tiết lỗi kỹ thuật có thể mở rộng (`DiagnosticPanel` hoặc cell diagnostic note).
3. **`WarehouseIssueDialog.tsx` & `WarehousePurchaseReceiptDialog.tsx`**:
   - *Hiện tại*: Hiển thị raw backend message trực tiếp khi throw exception.
   - *Chuẩn hóa*: Sử dụng adapter chuẩn hóa thông điệp thân thiện với thủ kho, lưu chi tiết exception vào developer console/diagnostic log.

---

## IV. Bảng đối chiếu Semantic Design Tokens

| Semantic Token | Mục đích | Token giá trị màu hiện có | Giá trị Hex/HSL |
|---|---|---|---|
| `--status-neutral-fg` | Chữ trạng thái trung tính/bình thường | `var(--ipc-slate-700)` | `#334155` |
| `--status-neutral-bg` | Nền trạng thái trung tính | `var(--ipc-slate-100)` | `#f1f5f9` |
| `--status-neutral-border` | Viền trạng thái trung tính | `var(--ipc-slate-300)` | `#cbd5e1` |
| `--status-info-fg` | Chữ trạng thái thông tin/tiến trình | `var(--ipc-primary)` | `#1a56a8` |
| `--status-info-bg` | Nền trạng thái thông tin | `var(--ipc-primary-soft)` | `#e8f1ff` |
| `--status-info-border` | Viền trạng thái thông tin | `#b8c8e8` | `#b8c8e8` |
| `--status-success-fg` | Chữ trạng thái hoàn tất/thành công | `var(--ipc-success)` | `#0f766e` |
| `--status-success-bg` | Nền trạng thái hoàn tất/thành công | `var(--ipc-success-soft)` | `#e6f7f3` |
| `--status-success-border`| Viền trạng thái thành công | `var(--ipc-color-status-success-border)` | `#99ddd2` |
| `--status-warning-fg` | Chữ trạng thái cảnh báo/chờ xử lý | `var(--ipc-warning)` | `#c05621` |
| `--status-warning-bg` | Nền trạng thái cảnh báo | `var(--ipc-warning-soft)` | `#fff7e6` |
| `--status-warning-border`| Viền trạng thái cảnh báo | `var(--ipc-color-status-warning-border)` | `#c05621` |
| `--status-danger-fg` | Chữ trạng thái lỗi/bị chặn/từ chối | `var(--ipc-danger)` | `#c53030` |
| `--status-danger-bg` | Nền trạng thái lỗi/bị chặn | `var(--ipc-danger-soft)` | `#fff1f1` |
| `--status-danger-border`| Viền trạng thái lỗi | `#fecaca` | `#fecaca` |
