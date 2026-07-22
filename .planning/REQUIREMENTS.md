# Requirements: IPC Management v1.1

**Defined:** 2026-07-16
**Core Value:** Staff có thể scan trạng thái vận hành nhanh chóng và hoàn thành các tác vụ quản lý bếp mà không bị nhầm lẫn workflow hoặc friction giao diện.

## v1.1 Requirements

### Canonical BOM contract

- [ ] **CAN-01**: Admin chỉ có một bulk BOM contract canonical gồm ba sheet 25k, 30k và 34k; sheet/header/tier không hợp lệ bị từ chối kèm vị trí lỗi.
- [ ] **CAN-02**: Hệ thống parse và normalize workbook theo cách deterministic, lưu source sheet, source row và source trace cho mỗi dòng.
- [ ] **CAN-03**: Hệ thống chỉ gộp dòng trùng khi đủ căn cứ tính bình quân gia quyền; dish, ingredient hoặc unit collision mơ hồ phải block apply.
- [ ] **CAN-04**: Hệ thống quản lý mapping đơn vị kỹ thuật `CAI`, `HOP`, `QUA`, `O`, `MIENG`, `CAY`, `LAT`, `KG` theo version và không fallback `KG` âm thầm cho nguyên liệu unknown/ambiguous.

### Preview, provenance and rollback safety

- [ ] **SAFE-01**: Admin có thể preview workbook và cleanup mà không làm thay đổi bất kỳ dữ liệu database nào.
- [ ] **SAFE-02**: Preview manifest lưu file hash, contract/policy version, effective date và DB fingerprint; file, parameter hoặc database drift buộc preview lại trước apply.
- [ ] **SAFE-03**: Apply chạy atomic trong transaction, rollback toàn bộ khi lỗi và idempotent khi chạy lại cùng source/policy/effective date.
- [ ] **SAFE-04**: Mỗi reconciliation/cleanup run lưu actor, reason, source hash, backup ID, before/after/action counts và audit status.
- [ ] **SAFE-05**: Operator có backup được định danh và restore rehearsal thành công trên clone trước destructive cleanup.

### Retention and cleanup

- [ ] **DATA-01**: Hệ thống phân loại candidate theo `keep`, `archive`, `deactivate`, `regenerate`, `delete` hoặc `block` bằng cùng policy cho preview và apply.
- [ ] **DATA-02**: Cleanup giữ bit-for-bit chứng từ approved/locked/completed, approval history, audit log và stock ledger.
- [ ] **DATA-03**: Cleanup chỉ hard-delete true orphan không reference và không tồn kho; catalog có history được archive/deactivate thay vì xóa.
- [ ] **DATA-04**: Cleanup idempotent; preview sau apply không cò eligible mutation và không phát sinh version/audit rỗng.
- [ ] **DATA-05**: Cả empty-to-latest và legacy-to-latest database đều không cò active `TMP-BOM-*`, unsupported active tier hoặc eligible legacy orphan.

### Downstream consistency

- [ ] **DOWN-01**: BOM change đánh dấu stale chính xác các material demand/production draft bị ảnh hưởng và không đánh stale scope không liên quan.
- [ ] **DOWN-02**: Hệ thống chỉ regenerate/cancel draft hoặc open document; completed/locked document và snapshot giữ nguyên.
- [ ] **DOWN-03**: Material demand tính đúng `servings × grossQtyPerServing` theo conversion, tier và scope; customer override overlay theo nguyên liệu và fallback global cho dòng còn lại.
- [ ] **DOWN-04**: Ordered/received/issued/returned dependency chặn xóa hoặc regenerate; chỉ draft leaf đủ điều kiện được rebuild đúng một lần.
- [ ] **DOWN-05**: Catalog, cache và báo cáo hiện hành cập nhật sau apply trong khi báo cáo lịch sử vẫn render từ snapshot cũ.

### Manual BOM CRUD

- [ ] **CRUD-01**: Admin tiếp tục thêm dòng, sửa theo version và ngừng áp dụng từng dòng BOM mà không hard-delete published history.
- [ ] **CRUD-02**: Bulk import và manual CRUD dùng chung overlap, effective interval, tier và global/customer scope invariants.
- [ ] **CRUD-03**: Thay đổi published BOM thủ công bắt buộc actor/reason và tạo adjustment/audit có thể truy vết.

### Admin shadcn surface

- [ ] **UI-01**: Admin xem preview counts, actions và blockers cho toàn dataset; filter/search chỉ ảnh hưởng hiển thị chứ không đổi apply scope.
- [ ] **UI-02**: Dialog destructive apply hiển thị hash, effective date, destructive/draft/history-kept counts và disable CTA khi còn blocker, preview stale hoặc thiếu backup marker.
- [ ] **UI-03**: Bảng BOM giữ table-fixed, colgroup/min-width, chiều cao và scroll riêng ổn định giữa full/search/loading/empty state.
- [ ] **UI-04**: Search icon không chồng text; nút `Sửa` và `Ngừng` luôn cùng một hàng ở desktop target.
- [ ] **UI-05**: Admin flow có keyboard navigation, focus return, accessible dialog title/description và loading/error/empty/success feedback không phụ thuộc màu.

### Authorization and upload hardening

- [ ] **SEC-01**: Chỉ Admin được preview/apply; actor audit lấy từ server-side identity.
- [ ] **SEC-02**: Upload bị giới hạn bytes, sheets, rows, cells, shared strings, XML, uncompressed ZIP và external links; input corrupt/abusive trả 4xx an toàn.
- [ ] **SEC-03**: Production API chỉ nhận bounded upload hoặc object reference và không nhận/leak server filesystem path như `D:\...`.

### Legacy retirement

- [ ] **RETIRE-01**: Old template/API/UI chỉ bị xóa sau khi canonical flow và manual CRUD vượt compatibility gate.
- [ ] **RETIRE-02**: Sau cutover không cò old endpoint, DTO, workbook builder, parser, RTK hook, UI copy hoặc consumer/reference format cũ.
- [ ] **RETIRE-03**: Tất cả migration đã apply giữ nguyên; schema/provenance/cleanup chỉ đi qua forward migration và cả fresh/upgrade path đều pass.

### Frontend feature decomposition

- [x] **REFA-01**: Các route page vận hành giữ nguyên URL, permission, API payload và hành vi người dùng trong khi được tách theo vertical workflow; page shell không quá 400 dòng, component workflow không quá 500 dòng, custom hook không quá 300 dòng, trừ ngoại lệ có lý do và review chấp thuận.

### Supplier purchase-history reconciliation

- [x] **SUP-01**: Hệ thống suy ra tập nhà cung cấp canonical từ chính sách `SUMMARY` đã audit và các sheet có dữ liệu được duyệt; loại header, pseudo-supplier và placeholder không có tham chiếu.
- [x] **SUP-02**: Hệ thống parse và normalize nguyên liệu, nhà cung cấp, đơn vị, quy cách đóng gói và ngày giao deterministic; giữ bằng chứng sheet/dòng/raw và block mọi trường hợp mơ hồ.
- [x] **SUP-03**: Preview read-only xuất manifest gồm SHA-256 nguồn, policy version, ngày as-of, DB fingerprint, exact action counts, diagnostics và yêu cầu bằng chứng backup/restore.
- [ ] **SUP-04**: Apply manifest đã chấp nhận chạy atomic, giữ/version dữ liệu theo dependency và lần apply thứ hai cùng preview sau apply đều no-op.

### Purchasing and receiving workflow

- [x] **PUR-01**: Material demand là approval target đầy đủ tại `/approvals`, Weekly Menu hiển thị status/link và demand chưa duyệt không thể tạo PR.
- [ ] **PUR-02**: Thu mua có workbench server-backed theo tuần, lồng ngày phục vụ, giữ PR scope `FULLDAY` và hiển thị shortage, stage, blocker cùng counts.
- [ ] **PUR-03**: Chỉ gợi ý nhà cung cấp từ báo giá còn hiệu lực hoặc receipt hợp lệ gần nhất; lựa chọn phải được người dùng xác nhận và lưu evidence snapshot.
- [ ] **PUR-04**: Giá tăng lớn hơn đúng 15% phải qua ngoại lệ có reference/proposed/variance/evidence/reason và quyết định quản lý trước khi submit PR.
- [ ] **PUR-05**: PR đã duyệt tạo tối đa một bộ PO tách theo nhà cung cấp; retry trả lại tiến độ hiện có và không sinh PO trùng.
- [ ] **WHR-01**: Warehouse là nơi duy nhất ghi nhận nhận hàng từng phần với kho, số lượng, lot, ngày sản xuất/hết hạn; receipt, stock và PO progress cập nhật atomic, còn Thu mua chỉ đọc trạng thái.
- [ ] **PUI-01**: UI triển khai luồng sáu giai đoạn trên route/primitives hiện có, restore tuần/ngày/stage từ URL, bảng bounded, dialog accessible và có E2E tập trung.

## Future Requirements

### Governance

- **GOV-01**: Admin có giao diện quản trị unit alias/version thay vì thay đổi configuration bằng code.
- **GOV-02**: Hệ thống lưu trữ hoặc object storage bản workbook gốc theo retention policy dài hạn.
- **GOV-03**: Cleanup/reconciliation chạy theo background job cho dataset lớn sau khi có nhu cầu vận hành thực tế.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Xóa chứng từ locked/completed, audit, approval history hoặc stock ledger | Vi phạm retention boundary đã được user chọn |
| Broad delete toàn bộ BOM/adjustment rồi import lại | Không dependency-aware và có thể phá hủy lịch sử |
| Sửa hoặc xóa migration đã apply | Làm sai lệch `__EFMigrationsHistory` và fresh/upgrade path |
| Thêm ORM, Excel parser, job runner, state manager hoặc UI kit thứ hai | Stack hiện có đủ khả năng và shadcn-style primitives đã được chọn |
| Cho production API nhận local server path | Không an toàn, không portable và làm leak hạ tầng |
| Tự động fallback unknown technical unit sang KG | Có thể làm sai material demand và purchasing |

## Traceability

| Requirement | Phase | Delivery boundary |
|---|---:|---|
| CAN-01 | 7 | Single canonical three-sheet bulk surface after compatibility-gated retirement |
| CAN-02 | 4 | Deterministic parser normalization and row/cell source trace pipeline |
| CAN-03 | 3 | Weighted dedupe and collision blocker contract |
| CAN-04 | 3 | Versioned technical-unit mapping |
| SAFE-01 | 4 | Read-only preview purity |
| SAFE-02 | 4 | Hash/manifest/fingerprint drift protection |
| SAFE-03 | 5 | Atomic, rollback-safe and idempotent apply |
| SAFE-04 | 3 | Reconciliation run provenance/audit contract |
| SAFE-05 | 3 | Identified backup and restore rehearsal baseline |
| DATA-01 | 4 | Shared dependency classifier policy |
| DATA-02 | 5 | Immutable locked/completed and ledger history |
| DATA-03 | 5 | True-orphan-only hard delete |
| DATA-04 | 5 | Idempotent cleanup and no-op second preview |
| DATA-05 | 7 | Fresh/upgrade active-legacy invariant |
| DOWN-01 | 5 | Scoped BOM staleness propagation |
| DOWN-02 | 5 | Draft/open-only regeneration |
| DOWN-03 | 5 | Tier/unit/customer-overlay demand calculation |
| DOWN-04 | 5 | Purchase/inventory blockers and leaf rebuild |
| DOWN-05 | 5 | Current cache/report refresh with historical snapshot reads |
| CRUD-01 | 6 | Retained manual add/version/stop workflow |
| CRUD-02 | 3 | Shared overlap/effective/tier/scope invariants |
| CRUD-03 | 5 | Actor/reason adjustment audit |
| UI-01 | 6 | Dataset-wide preview scope and counts |
| UI-02 | 6 | Safe destructive confirmation dialog |
| UI-03 | 6 | Fixed table viewport and independent scroll |
| UI-04 | 6 | Search/action no-overlap layout |
| UI-05 | 6 | Accessible interaction and feedback states |
| SEC-01 | 4 | Admin-only preview/apply |
| SEC-02 | 4 | Bounded workbook upload |
| SEC-03 | 4 | No production filesystem-path contract/leak |
| RETIRE-01 | 7 | Compatibility-gated old-surface removal |
| RETIRE-02 | 7 | Zero old consumers/references after cutover |
| RETIRE-03 | 3 | Forward-migration-only policy |
| REFA-01 | 8 | Route-preserving vertical decomposition, file-size gates and regression verification |
| SUP-01 | 9 | Canonical supplier derivation and exclusion policy |
| SUP-02 | 9 | Deterministic workbook normalization with raw blockers |
| SUP-03 | 9 | Read-only purchase-history preview manifest and drift gate |
| SUP-04 | 9 | Atomic dependency-aware reconciliation and no-op rerun |
| PUR-01 | 9 | Material-demand approval target and PR eligibility gate |
| PUR-02 | 9 | Week/date purchasing workbench and FULLDAY scope |
| PUR-03 | 9 | Evidence-backed supplier suggestion and confirmation snapshot |
| PUR-04 | 9 | Strictly-above-15-percent auditable price exception |
| PUR-05 | 9 | Idempotent supplier-split purchase-order creation |
| WHR-01 | 9 | Warehouse-owned atomic partial receiving |
| PUI-01 | 9 | Approved six-stage accessible purchasing UI and E2E |

**Coverage:**

- v1.1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0
- Duplicate mappings: 0

---
*Requirements defined: 2026-07-16*
*Last updated: 2026-07-21 after adding supplier reconciliation and purchasing workflow alignment; coverage 45/45 with each requirement assigned to exactly one phase*
