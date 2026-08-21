# Table inventory — Wave 0

Ngày chụp: 2026-08-21  
Phạm vi: `frontend/src/**/*.tsx`; bảng được nhận diện bằng phần tử `<table>` trong production source.

## Quy ước

- **Grain** là một dòng đại diện cho cái gì; không suy ra grain từ tên file.
- **Owner** là query/page model chịu trách nhiệm loading, refresh, error, empty và pagination.
- **Type** quyết định rule của bảng ở các wave tiếp theo.
- `detail` nghĩa là trường phụ phải đi vào drawer/row expansion khi bảng được chuẩn hóa; không được tự động xoá dữ liệu nghiệp vụ.

## Inventory theo route

| Route / surface | File | Table(s) | Grain | Type | Owner / trạng thái Wave 0 |
|---|---|---:|---|---|---|
| Thực đơn tuần / Nhu cầu | `features/projects/weekly-menu/demand/MaterialDemandSection.tsx` | 1 | ngày–nguyên liệu | action queue | query boundary đã có; cần kiểm tra 5–7 cột |
| Thực đơn tuần / Tổng hợp mua | `features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx` | 1 | dòng nguyên liệu theo ngày | action/aggregate | hai schema theo mode; không tính nhầm thành 15 cột |
| Thực đơn tuần / Giá vốn | `features/projects/weekly-menu/cost/MenuCostSection.tsx` | 2 | món/nguyên liệu và tổng giá | aggregate | cần đối chiếu metric lặp |
| Thực đơn tuần / Nguyên liệu món | `features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx` | 1 | nguyên liệu của món | master/detail | cần kiểm tra tên trước mã |
| Thực đơn tuần / Import matrix | `features/projects/components/ImportedLayoutMatrix.tsx` | 1 | ô workbook đã map | import/preview | giữ read-only khi preview |
| Thực đơn tuần / Import jobs | `features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx` | 1 | job import | ledger/import | kiểm tra pagination và trạng thái job |
| Thực đơn tuần / Import history | `features/projects/weekly-menu/import/WeeklyMenuImportHistory.tsx` | 1 | lần import | ledger | kiểm tra date/actor/detail |
| Thu mua / Quy trình | `features/purchasing/PurchaseServiceDateWorkbench.tsx` | 2 | đơn mua theo ngày/dòng | action/document | kiểm tra master–detail |
| Thu mua / Dòng nhóm | `features/purchasing/PurchaseLineGroups.tsx` | 1 | nhóm dòng mua | aggregate | kiểm tra duplicate total |
| Thu mua / Mua bổ sung | `features/purchasing/SupplementalPurchasingWorkbench.tsx` | 1 | yêu cầu bổ sung | action queue | server pagination cần xác nhận |
| Thu mua / Báo giá | `features/purchasing/quotation/SupplierQuotationSection.tsx` | 1 | báo giá NCC | master/document | effective date + approval state |
| Kho / Trang chính | `features/warehouse/pages/WarehousePage.tsx` | 2 | phiếu nhập/issue | document | sticky/overflow + row key |
| Kho / Ngoại lệ | `features/warehouse/WarehouseExceptionsWorkbench.tsx` | 3 | exception theo nguồn | action queue | ưu tiên và action một status owner |
| Kho / Receipt lifecycle | `features/warehouse/WarehouseReceiptLifecyclePanel.tsx` | 1 | dòng phiếu nhập | document | detail và pagination |
| Kho / PO lines | `features/warehouse/PurchaseOrderLineGroups.tsx` | 1 | dòng đơn mua | document/detail | kiểm tra duplicate với purchasing |
| Bếp / Ca sản xuất | `features/chef/production/ChefProductionSection.tsx` | 1 | món theo ca | checklist/action | 8 cột, xem xét gộp |
| Bếp / Checklist | `features/chef/components/material-checklist.tsx` | không có table HTML | nguyên liệu checklist | checklist | không đưa vào table contract |
| Duyệt / Hàng chờ | `features/approvals/components/MenuAmendmentReconciliation.tsx` | 1 | amendment/source line | action queue | kiểm tra duplicate với ApprovalQueue |
| Điều phối / Đơn suất | `features/coordination/components/order-table.tsx` | 1 | customer/week order | document/action | kiểm tra stable row key |
| Báo cáo / Tổng hợp | `features/reports/pages/ReportsPage.tsx` | 7 | report-specific aggregate/document | aggregate/ledger | tách theo report view; không chung một grain |
| Báo cáo / Giá | `features/reports/pages/ReportsPricePanel.tsx` | 4 | receipt line, supplier, month, dish group | aggregate | góc nhìn dùng combobox; bảng 6 cột sau refactor |
| Báo cáo / Chất lượng | `features/reports/pages/ReportsDataQualityPanel.tsx` | 1 | data-quality issue | action queue | đối chiếu với AdminCleanup |
| Báo cáo / Ca | `features/reports/pages/ServiceRunReportPanel.tsx` | 1 | service run | aggregate/checklist | kiểm tra status dimension |
| Quản trị / BOM | `app/pages/admin-data/AdminBomPanel.tsx` | 2 | BOM line / import row | master/import | preview state, không phải tab |
| Quản trị / Dữ liệu lỗi | `app/pages/admin-data/AdminCleanupPanel.tsx` | 1 | quality issue | action queue | đã rút 9→6 cột; đối chiếu với report quality |
| Quản trị / Hợp đồng | `app/pages/admin-data/AdminContractsPanel.tsx` | 1 | customer contract | master/reference | effective range |
| Quản trị / Tồn kho | `app/pages/admin-data/AdminInventoryPanel.tsx` | 1 | inventory snapshot | aggregate/master | kiểm tra dài hạn và unit |
| Quản trị / Thống kê | `app/pages/admin-data/AdminStatisticsPanel.tsx` | 3 | KPI/report aggregate | aggregate | không để KPI trùng bảng |
| Quản trị / Nhân viên | `app/pages/admin-data/AdminEmployeesPanel.tsx` | 1 | employee | master/reference | quyền và active state |
| Quản trị / Nhật ký | `app/pages/admin-data/AdminAuditPanel.tsx` | 1 | audit event | ledger | date/actor/source/detail |
| Common / Summary | `components/common/DemandSummary.tsx` | 1 | material demand summary | aggregate | owner cần xác nhận khi tái sử dụng |
| Common / Role inbox | `components/common/RoleInbox.tsx` | 1 | role action item | action queue | tìm consumer và duplicate |
| Common / Movement | `components/common/StockMovementTable.tsx` | 1 | inventory movement | ledger | source of truth dùng chung |

## Đối chiếu registry và orphan

| Kiểm tra | Cách kiểm | Kết quả Wave 0 | Hành động |
|---|---|---|---|
| Route → table | Route/page source + inventory | Đủ các route operational chính; login/forbidden/dashboard không có table contract tương ứng | Giữ ngoài table migration |
| Table → owner | file + page model/query boundary | Có owner rõ ở page/feature; common components cần truy ngược consumer | Wave 0B tìm consumer |
| Nested technical views | `admin-bom`, `reports-price`, `approval-role` | Đã loại bỏ khỏi navigation; `approval-role` đã hợp nhất | Xoá registry/fixture stale trong Wave 0B |
| Table → test/contract | `uiFloorplanScope*`, table tests, route tests | Có coverage không đồng đều; nhiều bảng chưa có grain/column contract | Wave 0B bổ sung contract tối thiểu |
| Component/import orphan | TypeScript build + source search | Build không bắt được component export không dùng nếu file vẫn compile độc lập | Chạy source-aware unused scan, không xoá đoán mò |
| Fixture orphan | test discovery + reference search | Có fixture cũ liên quan nested views trong lịch sử thay đổi | Xác minh consumer rồi xoá hoặc ghi disposition |

## Gate Wave 0

- [x] Inventory source đã commit cùng plan wave.
- [x] Tạo `docs/table-contracts.json` machine-readable cho 32 production/shared table surface.
- [x] Mỗi table contract có grain, row key, owner query, pagination disposition và primary status.
- [x] Common table surface đã được đánh dấu `consumer-dependent`; chưa xoá khi chưa có source-aware consumer proof.
- [x] Registry stale của các surface đã loại bỏ (`approval-role`, `admin-bom` navigation, `reports-price` preference group) đã được xử lý ở các commit trước.
- [x] `npm run build` pass sau mọi thay đổi Wave 0.
- [ ] Unit/contract tests và `git diff --check` pass cho artifact contract mới.

Wave 0 **chưa đóng** cho tới khi test contract kiểm tra path, id uniqueness, row key và owner của `docs/table-contracts.json` được thêm và pass; chưa được bắt đầu Wave 1.
