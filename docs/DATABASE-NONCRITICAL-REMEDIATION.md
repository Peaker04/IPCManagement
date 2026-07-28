# Kế hoạch xử lý database — High và Medium

Tài liệu này theo dõi các vấn đề database không thuộc mức Critical. Mọi thao tác trên dữ liệu thật
phải có preview read-only, backup/restore point phù hợp và bằng chứng nghiệp vụ trước khi apply.

## Phạm vi xử lý

| Nhóm | Hướng giải quyết | Phạm vi độc lập |
|---|---|---|
| High — báo giá | Bổ sung/điều chỉnh quotation theo ngày hiệu lực; kiểm tra coverage trước khi tạo PR; giữ fallback lịch sử làm evidence, không tự biến thành báo giá mới | `supplierquotations`, Purchasing |
| High — BOM | Lập danh sách món thiếu BOM theo menu/KHSX thực sự; bổ sung BOM từ nguồn chuẩn; không tự suy luận định lượng | `dishbom`, `dishes`, Planning/Catalog |
| High — demand thiếu `bomId` | Phân biệt dữ liệu legacy và demand mới; demand mới phải bắt buộc lưu BOM identity; legacy chỉ cảnh báo hoặc cần quy trình tái tạo | `materialrequestlines`, Planning |
| High — duplicate nguyên liệu | Chỉ tạo preview mapping: canonical ID, duplicate ID, BOM/stock/receipt references; chưa merge/deactivate trực tiếp | `ingredients`, Catalog/Admin |
| Medium — menu chưa publish | Xác minh đây là trạng thái test hay lỗi nghiệp vụ; nếu cần, thiết kế flow publish riêng, không sửa status hàng loạt | `menuversions`, `menuschedules`, Coordination |
| Medium — cancelled demand/PR | Giữ lịch sử; chỉ cho regenerate các record bị hủy bởi menu re-import và chưa có PO/history độc lập | Planning/Coordination |
| Medium — migration lineage | Đối chiếu 2 migration ID thiếu source file; tạo báo cáo/đề xuất khôi phục lineage, không tự xóa record migration | `Migrations`, CI/docs |
| Medium — bảng backup trong DB | Đưa ra kế hoạch tách backup khỏi schema ứng dụng; không drop bảng trong session song song | DB operations/docs |

## Checklist thực hiện

- [ ] Báo giá: xác nhận nguồn giá, ngày hiệu lực và coverage cho nguyên liệu sắp mua.
- [ ] BOM: xác nhận nguồn định lượng cho từng món/tier trước khi import hoặc chỉnh catalog.
- [x] Demand: tách dữ liệu legacy thiếu `bomId` khỏi demand mới; không sửa chứng từ lịch sử trực tiếp.
- [x] Duplicate: xuất mapping ID và toàn bộ FK tham chiếu trước khi đề xuất canonical ID.
- [ ] Menu: xác nhận trạng thái DRAFT là chủ đích test hay cần publish nghiệp vụ.
- [ ] Cancelled lineage: xác nhận audit reason, trạng thái trước khi hủy và không có PO/history bất biến.
- [x] Migration: đối chiếu `__EFMigrationsHistory`, source migration và fresh-install/upgrade gate.
- [ ] Backup tables: consumer bằng 0 đã được xác minh; retention và nơi lưu thay thế vẫn cần chốt trước khi lập kế hoạch dọn.

## Evidence read-only ngày 28/07/2026

Chạy `tools/db/Audit-NonCriticalDataQuality.sql` trong `START TRANSACTION READ ONLY` trên
`ipcmanagement`; không chạy trên `ipc_lane1`, không seed/migrate/import/cleanup. Script hoàn tất
386 dòng output, không có lỗi SQL. Static gate xác nhận mọi statement trong file chỉ bắt
đầu bằng `SELECT` hoặc `WITH`.

| Nhóm | Evidence đã xác minh | Kết luận an toàn |
|---|---|---|
| Báo giá | 756 nguyên liệu active, 0 nguyên liệu có báo giá hiệu lực hiện tại; 4 nguyên liệu thuộc PR đang mở và chưa thành PO đều thiếu báo giá hiệu lực lẫn evidence lịch sử | Chưa tạo báo giá; bị block bởi nguồn giá, NCC và ngày hiệu lực |
| BOM | 32 món active không có BOM published; audit theo đúng effective date/tier/customer fallback trả 34 nhóm món đã lên lịch và 221 dòng KHSX cần review | Chưa suy luận định lượng; danh sách là candidate để đối chiếu workbook/nguồn chuẩn |
| Demand `bomId` | 4 demand không cancelled, tổng 176 line thiếu trace; cả 4 có service date trước migration thêm `bomId`. Audit kèm timestamp Generate/Recalculate để không đánh đồng service date với creation time | Giữ nguyên lịch sử. Code hiện tại gán `BomId` cho cả line mới và line regenerate; regression BOM effective/tier/customer đã có |
| Duplicate ingredient | 16 nhóm tên active, 32 ID. Preview xuất ID hex, unit/kho và count riêng cho đủ 15 FK consumer đang có trong schema | `review_order` chỉ là thứ tự xem theo số tham chiếu; chưa đề xuất canonical, merge hay deactivate |
| Menu DRAFT | 210 schedule DRAFT; 7 version DRAFT và 23 SUPERSEDED. Một số DRAFT có KHSX/material request tham chiếu, nên không thể coi tất cả là test rác | Cần nghiệp vụ xác nhận theo customer/week; không update status hàng loạt |
| Cancelled demand/PR | 6 demand ghi rõ reason do menu re-import, PR liên kết đều cancelled, 0 PO và 0 receipt; tuy nhiên mỗi demand có 4–10 supplier-decision row. Một demand cũ không có cancellation audit và PR vẫn không cancelled | Chưa record nào đủ điều kiện regenerate tự động cho tới khi chốt supplier-decision có phải history bất biến hay không |
| Migration lineage | `Compare-MigrationLineage.ps1`: 41 ID trong DB, 39 file source, 2 `CANONICAL_DATABASE_ONLY`, 0 unexplained/`SOURCE_ONLY`; `-FailOnDrift` exit 0 | Seed BOM tạm được retirement bằng blob gốc; ID completed-status được map sang migration successor đang track. Không xóa history row, không tạo migration no-op giả |
| Backup tables | 7 bảng `backup_*`, ước tính 6.686 row; 0 FK/view/trigger/routine/event consumer và 0 reference trong application source | Vẫn giữ nguyên trong DB cho tới khi chốt retention và backup off-schema |

### Đề xuất khôi phục migration lineage

1. `20260626043000_SeedTemporaryBomData` có source gốc tại commit `bb57c4a`, blob
   `8e1ce7d9...`; nó chỉ ghi dữ liệu `TMP-BOM-*`, không đổi schema và đã bị xóa có chủ
   đích. Canonical policy là retirement trong manifest, không khôi phục executable seed.
2. `20260705121500_AddCompletedMealQuantityPlanStatuses` không có source trong reachable Git
   history. Semantic theo tên (enum `COMPLETED`) được migration track
   `20260706033326_AddMealQuantityPlanCompletedAndConcurrency` bao phủ cùng completion/concurrency
   columns. Manifest ghi successor này và gate xác nhận successor còn trong source.
3. Chỉ xóa row `__EFMigrationsHistory` khi có rehearsal trên clone và kế hoạch rollback được
   duyệt; hiện tại không có lý do kỹ thuật để xóa.

## Quy tắc chạy song song

- Không seed, reset, migrate hoặc cleanup trực tiếp trên `ipcmanagement`/`ipc_lane1` trong lúc session khác đang chạy.
- Không merge/deactivate theo tên; mọi quyết định dùng ID và reference thực tế.
- Không sửa `docs/CURRENT-STATE.md` từ nhiều session cùng lúc; hợp nhất evidence sau khi từng workstream hoàn tất.
- Nếu cần rehearsal, dùng database clone riêng cho từng workstream và không dùng chung port/artifact.
- Trước khi sửa code phải chạy GitNexus upstream impact; trước commit phải chạy `detect_changes`.

## Audit read-only

Chạy `tools/db/Audit-NonCriticalDataQuality.sql` để lấy baseline và candidate list. Script chỉ chứa
`SELECT`/`WITH`, không thay đổi dữ liệu hoặc schema.
