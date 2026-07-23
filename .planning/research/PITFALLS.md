# PITFALLS Research — v1.1 Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy

**Dimension:** PITFALLS  
**Ngày nghiên cứu:** 2026-07-16  
**Retention đã chốt:** giữ chứng từ đã khóa/hoàn tất và audit; chỉ dọn hoặc tái tạo dữ liệu nháp, dữ liệu đang hoạt động và catalog mồ côi đủ điều kiện.  
**Nguồn đối chiếu:** importer ba sheet trong `SampleDataImportService`, luồng template/import cũ và CRUD trong `DishService`, material demand, ba migration/SQL cleanup liên quan, cùng bề mặt `/admin-data`.

## Phase map đề xuất để gắn kiểm soát rủi ro

| Phase | Trọng tâm |
|---|---|
| **P1 — Contract, provenance và baseline** | Chốt workbook canonical, khóa semantics tier/scope/unit/effective date, lập retention matrix và snapshot số liệu trước thay đổi. |
| **P2 — Import/cleanup engine an toàn** | Một parser/validator dùng chung cho preview/apply, cleanup classifier, transaction, audit và idempotency. |
| **P3 — Downstream reconciliation** | Vô hiệu hóa/tái tạo demand và chứng từ nháp; bảo toàn chứng từ đã khóa/hoàn tất và lịch sử kho. |
| **P4 — Admin UI shadcn và cutover contract** | Thay UI import cũ, hiển thị blocker/impact rõ ràng, xác nhận destructive và giữ CRUD thủ công. |
| **P5 — Migration, verification và rollout** | Fresh/legacy DB tests, invariants, backup/rollback, xóa dead code sau khi chứng minh không còn consumer. |

## 1. Xóa nhầm lịch sử hoặc bị khóa bởi chuỗi FK

**Vì sao dễ xảy ra**

- `Dishbom` được tham chiếu bởi `Bomadjustment` và `Materialrequestline`; món/nguyên liệu còn đi qua menu, production plan, purchase, receipt/issue/return, stock movement, snapshot và stocktake.
- `DeleteBehavior.ClientSetNull` không có nghĩa database luôn tự đặt null; với cột bắt buộc, xóa parent vẫn lỗi FK. Một số quan hệ như `Materialrequestline.BomId` dùng `SetNull`, nhưng phần lớn catalog FK không được phép cascade tùy ý.
- Migration `20260716090000_CleanLegacyPortionData` đã chủ động đặt `bomId = NULL` cho dòng demand TMP và giữ dấu `bomScope = 'legacy-removed'`; đây là pattern bảo toàn lịch sử, không phải lý do để xóa luôn dòng demand.

**Warning signs**

- Cleanup query chỉ lọc theo `dishCode`, `ingredientCode`, tên hoặc “không thuộc workbook” mà không phân loại trạng thái chứng từ.
- Preview chỉ đưa count BOM/catalog, không có count tham chiếu theo `menuitems`, `productionplanlines`, `materialrequestlines`, purchase và inventory.
- Dùng `RemoveRange` hoặc raw `DELETE` trên parent trước khi unlink/archive child.
- Apply pass trên database trống nhưng lỗi FK hoặc mất số liệu khi chạy trên bản sao production.

**Prevention**

- P1 lập retention matrix theo **entity + trạng thái + quan hệ**: `keep-history`, `regenerate-draft`, `archive/deactivate`, `hard-delete-orphan`, `blocked`.
- Candidate phải dựa trên provenance/canonical identity và dependency classifier, không chỉ dựa tên. Chứng từ locked/completed/audit luôn là blocker cho hard delete.
- Với history, giữ snapshot fields (`GrossQtyPerServing`, `UnitId`, `PriceTierAmount`, `BomScope`) và chỉ null `BomId` khi cần; ghi reason/source legacy rõ ràng.
- Xóa theo thứ tự leaf-to-root trong một transaction; catalog có history thì deactivate/archive thay vì hard delete.

**Verification**

- Trước/sau apply so sánh checksum/count của locked/completed documents, `auditlogs`, stock movements, receipts/issues/returns và tổng giá trị lịch sử: không đổi.
- Invariant SQL: 0 orphan FK; 0 hard-deleted entity có historical references; mọi candidate `blocked` vẫn tồn tại.
- Fixture phải có cả draft và completed cùng trỏ một dish/ingredient để chứng minh policy không xóa quá tay.

**Phase:** P1 policy; P2 classifier/apply; P3 reconciliation; P5 production-like verification.

## 2. Xóa hoặc sửa migration đã apply

**Vì sao dễ xảy ra**

- `20260626043000_SeedTemporaryBomData` dù tạo dữ liệu tạm vẫn là một phần migration history và cần cho đường migrate của database đã tồn tại.
- `20260716090000_CleanLegacyPortionData` là compensating migration, còn `20260716113000_CorrectPresetBomTechnicalUnits` là semantic correction có `Down` cố ý không hoàn nguyên.
- Xóa file migration “cho sạch code cũ” làm fresh DB và database có `__EFMigrationsHistory` đi theo hai lịch sử khác nhau.

**Warning signs**

- PR xóa/đổi nội dung migration cũ thay vì thêm migration mới.
- Fresh migrate thành công nhưng upgrade từ snapshot trước v1.1 thất bại, hoặc ngược lại.
- Model snapshot không khớp migration chain; developer phải sửa tay `__EFMigrationsHistory`.
- Rollback được mô tả là `Down`, dù `Down` của hai migration cleanup/correction không tái tạo dữ liệu.

**Prevention**

- Giữ nguyên migration đã phát hành/applied; vô hiệu hậu quả seed cũ bằng compensating migration hoặc cleanup service mới.
- Không đọc workbook từ migration. Migration chỉ dùng deterministic DB predicates; import canonical là application operation riêng.
- Rollback operational dựa trên backup/restore hoặc forward-fix, không hứa hẹn `database update <old>` sẽ khôi phục semantic data.

**Verification**

- Test hai đường: `database empty -> latest` và `legacy fixture tại migration cũ -> latest`.
- So sánh `__EFMigrationsHistory`, model snapshot, schema và post-migration invariants.
- Chạy migration/apply lần hai trên database clone: không tạo thêm unit/BOM hoặc phát sinh lỗi duplicate.

**Phase:** P1 inventory migration; P5 migration gate và runbook.

## 3. Cleanup quá rộng, không idempotent hoặc transaction tạo cảm giác an toàn giả

**Vì sao dễ xảy ra**

- `backend/database/Clean_Legacy_Imported_Bom.sql` đặt `bomId = NULL` cho **toàn bộ** material request lines rồi `DELETE FROM bomadjustments`, `portionrules`, `dishbom` không giới hạn provenance/tier/status. Nó trái retention 2A nếu chạy lại trên dữ liệu hiện tại.
- `ReplaceBomCatalog` trong `SampleDataImportService` cũng xóa toàn bộ adjustment/BOM trước khi nạp ba tier.
- `START TRANSACTION` không sửa được predicate quá rộng; và nếu sau này trộn DDL MySQL vào script, DDL có thể implicit commit.

**Warning signs**

- Dry-run và apply dùng hai query/policy khác nhau hoặc client gửi danh sách ID để server tin tuyệt đối.
- Apply lần hai vẫn báo deleted/updated rows; count giảm ngoài nhóm preview.
- SQL chứa `DELETE FROM dishbom`/`bomadjustments` không có join tới candidate set và blocker.
- Audit chỉ có một dòng count tổng, không có policy version, actor, reason, run id hoặc action breakdown.

**Prevention**

- Tạo một pure classifier/policy engine dùng chung: preview `AsNoTracking`; apply **re-query và revalidate** candidate trong transaction.
- Dùng operation key/policy version/source hash; predicate dựa provenance + status + dependency. Apply lần hai trả 0 action.
- Không dùng script broad-delete làm production runner. Nếu giữ file, gắn cảnh báo deprecate/not-for-production hoặc thay bằng wrapper guarded có preflight.
- Ghi audit trong cùng transaction, gồm count `keep/archive/delete/regenerate/block`, source hash và retention policy.

**Verification**

- Snapshot IDs/actions từ preview; ngay trước apply tạo thay đổi cạnh tranh để chứng minh server phát hiện drift và không xóa record mới bị block.
- Chạy `preview -> apply -> preview -> apply`: preview/apply cuối phải 0 mutations.
- Inject lỗi giữa batch để xác nhận toàn bộ DML + audit rollback; không có trạng thái nửa cũ nửa mới.
- So sánh tổng count theo từng entity với action breakdown, không chỉ HTTP 200.

**Phase:** P2 chính; P5 rollout rehearsal.

## 4. Preview và apply không phải cùng một quyết định

**Vì sao dễ xảy ra**

- Luồng cũ `CommitBomImportAsync` build preview rồi parse stream lần nữa; database có thể đổi giữa hai bước, và UI preview/commit là hai request độc lập không có preview token/hash.
- Trong importer mẫu, dry-run vẫn gọi các `Ensure*` có thể cập nhật entity đang track; dù không save, các bước sau cùng request có thể nhìn thấy trạng thái mô phỏng khác baseline.
- Parser canonical và parser template cũ hiện là hai contract độc lập, nên “preview hợp lệ” ở UI không đảm bảo khớp logic nạp ba sheet.

**Warning signs**

- Commit không yêu cầu workbook hash/policy version/preview token.
- UI vẫn cho commit sau khi user đổi tier, customer, effective date hoặc file nhưng preview không bị invalidate.
- Count/action commit khác preview mà response không báo drift.
- Có hai bộ normalize/dedupe/unit mapping ở hai service.

**Prevention**

- Preview và apply gọi cùng parser + normalized import plan immutable. Trả source SHA-256, contract version, policy version và preview token có TTL.
- Apply reparse/reclassify trong transaction và so hash/token; nếu DB/source drift thì trả conflict, yêu cầu preview lại.
- UI xóa preview ngay khi đổi file, tier, customer, effective date hoặc cleanup category; commit disabled đến khi token hợp lệ.
- Dry-run query `AsNoTracking`, không mutate entity trong context.

**Verification**

- Contract test assert cùng fixture cho cùng normalized rows/actions ở preview và apply.
- Test đổi file bytes, scope, tier và DB dependency sau preview: apply phải 409/conflict hoặc trả blocker, không silent commit.
- Audit batch và response commit phải khớp source hash + action counts đã xác nhận.

**Phase:** P2 backend; P4 state UI; P5 concurrency tests.

## 5. Trộn ba tier hoặc tạo BOM duplicate/overlap

**Vì sao dễ xảy ra**

- Canonical workbook dedupe theo `tier + normalized dish name + normalized ingredient name`; database identity lại dùng binary IDs, unit, customer scope và effective range.
- `EnsureBomLine` chỉ tìm dòng `EffectiveTo is null`, global và cùng tier; một dòng archived/dated hoặc cùng ingredient khác unit có thể dẫn tới version/duplicate không mong muốn.
- Luồng CRUD/template có overlap validation riêng, trong khi importer mẫu cập nhật trực tiếp dòng mở và không kiểm tra toàn bộ khoảng hiệu lực.

**Warning signs**

- Cùng dish/ingredient/scope/tier có hơn một `PUBLISHED` interval overlap.
- Số dòng 25k/30k/34k lệch kỳ vọng sau mỗi lần import hoặc tăng sau re-import cùng file.
- Dòng 25k bị update khi chọn 30k; global/customer counts trộn nhau.
- Dedupe theo tên gộp hai catalog identity khác nhau hoặc không gộp alias tương đương.

**Prevention**

- Chốt canonical key: dish identity, ingredient identity, technical unit, tier, scope và effective interval; normalize alias trước khi dedupe nhưng không tự gộp ambiguous names.
- Một overlap validator dùng cho import và manual CRUD; DB constraint/index bổ sung nếu schema cho phép biểu diễn invariant.
- Re-import cùng source phải upsert/version deterministically, không tạo dòng mới vô hạn.
- Preview summary tách rõ từng sheet/tier/scope và báo collision/ambiguous mapping.

**Verification**

- SQL interval-overlap check theo dish/ingredient/unit/tier/customer/status trả 0.
- Fixture có cùng món/nguyên liệu ở cả 3 tier, global và customer; mỗi dòng chỉ tác động đúng bucket.
- Import cùng workbook hai lần: tổng active/version count không tăng ngoài hành vi version đã định nghĩa.

**Phase:** P1 contract; P2 invariant engine; P5 data invariants.

## 6. Customer override một phần làm mất các dòng global

**Vì sao dễ xảy ra**

- `MaterialDemandService.ResolveBomLines` hiện lấy **toàn bộ customer lines nếu có ít nhất một dòng**, nếu không mới dùng toàn bộ global lines. Nếu customer override chỉ chứa một nguyên liệu, các nguyên liệu global còn lại của món bị bỏ khỏi demand.
- UI/manual CRUD cho phép chỉnh riêng lẻ từng dòng, nên partial override là tình huống thực tế chứ không chỉ dữ liệu lỗi.

**Warning signs**

- Sau khi thêm một override customer, demand của món giảm số ingredient lines bất thường.
- Preview chỉ báo “Customer override” nhưng không nói scope là full replacement hay overlay per ingredient.
- Customer BOM có ít dòng hơn global BOM nhưng vẫn `PUBLISHED` và không bị cảnh báo.

**Prevention**

- P1 phải chốt semantics rõ ràng: **full-set replacement** hoặc **overlay per ingredient**.
- Nếu full replacement: validate completeness trước publish/import và block partial set. Nếu overlay: resolve theo ingredient/unit key, customer thắng global chỉ cho key trùng.
- UI hiển thị inherited/global vs overridden rows và cảnh báo khi set chưa đầy đủ.

**Verification**

- Test món global 5 nguyên liệu + customer override 1 nguyên liệu: kết quả phải đúng semantics đã chốt (5 dòng overlay hoặc bị block full replacement), không bao giờ âm thầm còn 1.
- Demand totals và ingredient list được so sánh giữa global/customer fixture.

**Phase:** P1 quyết định bắt buộc; P2 resolver/validation; P4 copy/visual; P3 demand regression.

## 7. Sai đơn vị kỹ thuật và diễn giải sai quantity

**Vì sao dễ xảy ra**

- Header workbook ghi “Định lượng (gram) / khay”, nhưng `ParseGrossQtyPerServing` dùng heuristic `> 5 => /1000`, còn `0.5–5` giữ nguyên. Với trứng, sữa chua, chuối... giá trị là cái/hộp/quả chứ không phải kilogram.
- `PresetBomUnitByIngredient` dựa exact normalized ingredient name; migration unit correction cũng join bằng `LOWER(TRIM(ingredientName))`. Alias/chính tả mới dễ rơi về KG.
- Migration `20260716113000_CorrectPresetBomTechnicalUnits` đổi unit trên cả current stock và toàn bộ historical stock/purchase/inventory lines theo ingredient name; đổi nhãn đơn vị mà không có conversion có thể làm sai nghĩa số lượng lịch sử.

**Warning signs**

- Quantity 1–3 với unit KG cho trứng/sữa chua/chuối hoặc ingredient mới ngoài dictionary.
- `ingredient.UnitId`, `dishbom.UnitId`, stock/purchase/inventory line unit không nhất quán.
- Sau migration, số lượng lịch sử giữ nguyên nhưng unit đổi từ KG sang cái/hộp/quả mà không có provenance/conversion.
- Tên gần giống (`trung`, `lọt/lột`, dấu/khoảng trắng) map khác nhau.

**Prevention**

- Contract canonical phải có explicit technical unit hoặc một mapping table/versioned alias được review; không suy luận chỉ từ ngưỡng số.
- Validate unit–quantity plausibility theo category và đưa unknown/ambiguous vào blocker, không fallback KG im lặng.
- Tách “đơn vị BOM kỹ thuật từ nay” khỏi “đơn vị chứng từ lịch sử”; chỉ rewrite history khi có conversion/proof, nếu không giữ snapshot cũ.
- Một normalization/mapping dùng chung importer, cleanup và tests; lưu source row/sheet để audit.

**Verification**

- Regression fixture cho toàn bộ alias đã chấp nhận: `CAI`, `HOP`, `QUA`, `O`, `MIENG`, `CAY`, `LAT` và KG.
- Query 0 unknown/fallback suspicious rows; kiểm tra sample 112 source rows/97 stored lines đã được phân loại đúng.
- Reconcile quantity/cost/demand trước–sau theo các món đại diện và theo từng unit family.
- Historical stock/purchase totals không đổi semantics ngoài danh sách correction được duyệt.

**Phase:** P1 unit contract; P2 parser/validator; P3 reconciliation; P5 migration fixtures.

## 8. Demand, purchase và cache vẫn dùng BOM cũ sau cutover

**Vì sao dễ xảy ra**

- `GetStalenessAsync` hiện kiểm tra quantity line, menu version và stock update sau `plan.UpdatedAt`, nhưng không kiểm tra BOM/adjustment/effective-version thay đổi.
- `Materialrequestline` giữ snapshot BOM fields; cleanup/import không tự làm draft demand stale nếu không cập nhật status/version marker.
- `DishService` có memory cache catalog và chỉ `ClearCatalogCache` khi mutation đi qua service này. Import trực tiếp bằng `SampleDataImportService` không cùng cache owner, nên UI có thể thấy catalog cũ cho đến khi cache hết hạn.
- Recalculate `PruneStaleLines` xóa purchase request lines gắn stale demand; nếu áp dụng lên document không còn draft có thể phá history.

**Warning signs**

- BOM đã đổi nhưng staleness trả `IsStale=false`.
- Admin import thành công nhưng bảng BOM vẫn hiển thị dữ liệu cũ.
- Material request draft còn `bomId` legacy hoặc totals cũ; purchase draft không khớp demand mới.
- Recalculate xóa lines của request đã approved/ordered/received.

**Prevention**

- Có BOM catalog/import version hoặc `UpdatedAt`/change token; staleness so với version/hash BOM đã dùng khi generate.
- Sau apply, invalidate distributed/in-memory tags và đánh stale đúng các draft/open documents theo date/tier/customer/dish impact.
- Chỉ auto-regenerate trạng thái cho phép; approved/locked/completed giữ snapshot và được report `kept-history`.
- Reconciliation theo thứ tự production plan → material request → purchase request/order draft; không sửa kho/history ngoài policy.

**Verification**

- Thay một BOM line và assert staleness=true cho đúng demand scope, false cho scope không liên quan.
- Recalculate draft cho totals/unit/BOM IDs mới; completed fixture bit-for-bit không đổi.
- Sau import/apply, API catalog request kế tiếp trả ngay dữ liệu mới, không cần đợi TTL/restart.
- End-to-end từ BOM mới → material demand → purchase draft không còn legacy references.

**Phase:** P2 invalidation hooks; P3 chính; P5 E2E.

## 9. Upload workbook tạo bề mặt DoS/path/parser abuse

**Vì sao dễ xảy ra**

- Endpoint `bom-import/preview` và `commit` hiện chỉ kiểm tra `file.Length == 0`; chưa thấy limit riêng, extension/signature/content-type allowlist hoặc giới hạn sheet/row/shared-string/uncompressed XML.
- Reader copy toàn bộ upload vào `MemoryStream`, sau đó xlsx được ghi temp file. ZIP/XML có thể rất lớn sau giải nén dù file upload nhỏ.
- File name không nên dùng làm path; temp hiện dùng GUID là tốt và phải giữ.

**Warning signs**

- Upload file rất lớn hoặc ZIP bomb làm memory/CPU tăng, request timeout hay API restart.
- File `.xlsx` giả chỉ cần magic `PK` đi sâu vào parser.
- Preview và commit có limit khác nhau; temp file còn lại sau exception/cancel.
- Error trả stack trace hoặc filesystem path cho user.

**Prevention**

- Admin authorization bắt buộc; limit request/file bytes, sheet count, rows, cells, shared strings, XML entry size và tổng uncompressed bytes.
- Validate extension + MIME như tín hiệu phụ, nhưng quyết định bằng cấu trúc ZIP/OpenXML allowlist; reject macro/external relationship/unexpected archive entries.
- Streaming/bounded copy, cancellation, timeout; temp GUID trong controlled directory và `finally` cleanup.
- Log sanitized metadata + hash, không log workbook content/PII hay path nội bộ.

**Verification**

- Security tests: empty, oversize, corrupt ZIP, ZIP bomb fixture an toàn, quá nhiều rows/sheets, renamed non-xlsx, external links, cancellation.
- Đáp ứng 4xx có message an toàn; không tăng temp-file count hay memory không giới hạn.
- Preview/commit áp cùng limits và authorization.

**Phase:** P2 API/parser hardening; P5 security tests.

## 10. UI destructive mơ hồ hoặc cho apply sai scope

**Vì sao dễ xảy ra**

- Màn hiện tại dùng các nhãn `BOM thiếu`, `Mẫu trống`, `Preview`, `Commit`; sau cutover, “Commit” không diễn đạt rõ sẽ import, archive, delete hay regenerate gì.
- Tier và customer nằm bên trái, preview bên phải; user có thể hiểu summary global là action chỉ cho kết quả search hiện tại.
- Bảng preview chỉ render 100 rows, nên blocker ngoài 100 dòng dễ bị bỏ qua bằng mắt.

**Warning signs**

- Nút destructive chỉ ghi “Commit/Xác nhận”, dùng cùng style primary với Preview.
- Dialog không nêu tier, scope, source hash, count delete/archive/block và retention history.
- Search/filter làm summary/count thay đổi mà không nói apply vẫn tác động toàn bộ candidate.
- Có thể apply khi blocker > 0 hoặc khi preview đã stale; focus/keyboard không được quản lý.

**Prevention**

- Dùng shadcn-style `Alert`, `Badge`, `Checkbox`, `Dialog`, `Button`, `DataTableShell`: phân tách `Giữ lịch sử / Tái tạo nháp / Ngừng áp dụng / Xóa mồ côi / Bị chặn`.
- CTA cụ thể: “Áp dụng cleanup N bản ghi”; destructive variant chỉ ở bước cuối. Dialog lặp lại source, tier/scope, action counts và bắt nhập lý do/xác nhận.
- Summary luôn là total dataset; filter label “chỉ lọc hiển thị”. Có pagination/virtualized full list hoặc export report, không cắt im lặng 100 dòng.
- Preview token stale thì disable apply; table fixed height/scroll riêng, không co giãn theo search.

**Verification**

- Testing Library: đổi file/tier/scope invalidates preview; blocker disables apply; dialog có accessible title/description và focus return.
- Playwright: search không đổi panel/table bounding box; action buttons không wrap; mobile/keyboard flow usable.
- UAT với case mixed actions xác nhận user phân biệt archive/delete/block và hiểu history được giữ.

**Phase:** P4 chính; P5 accessibility/visual/UAT.

## 11. Xóa old contract quá sớm làm mất CRUD/manual recovery path

**Vì sao dễ xảy ra**

- Old template endpoints, DTO, builder, RTK hooks và UI là legacy cần bỏ, nhưng `DishService` cũng chứa CRUD versioning/overlap/audit hiện vẫn cần.
- Tên/chức năng nằm chung file khiến cleanup bằng grep/delete block lớn dễ kéo theo `CreateBomLineAsync`, `UpdateBomLineAsync`, `CloseBomLineAsync`, catalog mapping hoặc shared normalization.
- API `sample-import-status` và `SampleDataImportService` còn phục vụ nhiều domain ngoài BOM; xóa toàn service/controller có thể làm hỏng menu/quantity/purchase flows.

**Warning signs**

- PR xóa cả `DishService` sections hoặc `SampleDataController` chỉ vì có chữ sample/import.
- Manual add/edit/stop biến mất hoặc không còn version/audit/overlap validation.
- Frontend build pass nhưng route từ data-quality “món thiếu BOM” tới admin không còn hoạt động.
- Swagger/RTK vẫn có hook dead hoặc ngược lại UI gọi endpoint đã xóa.

**Prevention**

- P1 lập consumer inventory theo symbol/route, phân loại `remove`, `move`, `keep` trước khi xóa.
- Tách canonical BOM domain trước; giữ CRUD và operational route ổn định. Xóa old template/import theo vertical slice controller → interface/service → DTO/builder → RTK/UI → tests/docs.
- Feature/cutover gate: endpoint mới + UI mới pass trước khi xóa endpoint cũ; nếu cần, một release deprecation rõ ràng.

**Verification**

- API/contract tests cho manual create, published edit tạo version, overlap blocked, close và audit.
- `rg`/compile/OpenAPI client check: không còn old route/string/hook consumer sau removal, nhưng CRUD routes vẫn tồn tại.
- Route smoke từ data-quality issue đến `/admin-data` vẫn đúng.

**Phase:** P1 inventory; P2 extraction; P4 cutover; P5 dead-code proof.

## 12. Dirty worktree làm mất hoặc trộn thay đổi đang phát triển

**Vì sao dễ xảy ra**

- Worktree hiện đã sửa đúng các hotspot của milestone: `DishesController`, DTOs, `DishService`, `SampleDataImportService`, `MaterialDemandService`, `WorkflowReportService`, `AdminDataPage`, RTK API, tests/styles; đồng thời migration, SQL và `BomTemplateWorkbookBuilder` còn untracked.
- Những file này có thể là công việc user chưa commit. Cleanup bằng reset/checkout, formatter rộng hoặc generate migration/snapshot có thể overwrite ngoài ý muốn.

**Warning signs**

- Diff phase chứa visual snapshots, dashboard, coordination hoặc style thay đổi không liên quan task.
- File untracked biến mất sau cleanup; migration timestamp trùng/đổi thứ tự.
- Một commit gồm cả baseline user work và implementation milestone, khó rollback/audit.
- Test pass do dùng thay đổi chưa thuộc phase nhưng plan không ghi dependency.

**Prevention**

- Trước execution: lưu `git status`, `git diff --stat`, diff/patch evidence và xác định ownership từng file; không reset/checkout/stash tự động.
- Edit hẹp bằng patch; không chạy formatter toàn repo. Mỗi plan ghi rõ files expected và pre-existing modifications cần preserve.
- Re-read file ngay trước patch; nếu cùng hunk đã đổi, dừng và reconcile thay vì overwrite.
- Tách commits theo vertical slice, nhưng chỉ commit khi được phép; chạy GitNexus impact trước symbol edit và `detect_changes` trước commit theo AGENTS.md.

**Verification**

- Sau mỗi phase so `git diff --name-status` với manifest expected; unrelated files giữ nguyên checksum/diff.
- `detect_changes` chỉ ra đúng symbol/process dự kiến; review staged diff không gồm untracked/user-owned artifacts ngoài scope.
- Re-run tests trên clean integration branch/workspace trước rollout để tránh phụ thuộc vô thức vào dirty state.

**Phase:** Gate xuyên suốt P1–P5; bắt buộc ngay trước lần edit đầu tiên.

## 13. Rollout không có baseline, backup và tiêu chí dừng

**Vì sao dễ xảy ra**

- Cleanup/delete và semantic unit correction không có rollback đáng tin cậy từ EF `Down`.
- Count “BOM hiện tại” đơn thuần không chứng minh demand/cost/history đúng; lỗi có thể chỉ lộ khi chạy workflow ngày/ca/customer cụ thể.

**Warning signs**

- Không lưu preflight report/source hash/database backup ID.
- Runbook chỉ nói migrate/import/apply mà không có stop conditions hoặc verification queries.
- Apply trực tiếp production lần đầu; không rehearsal trên clone.
- Thành công được định nghĩa bằng HTTP 200 hoặc số BOM > 0.

**Prevention**

- P1 capture baseline: count theo entity/status/tier/scope, overlap, unknown unit, orphan FK, legacy candidate/blocker, draft/completed document và representative demand totals.
- Rehearsal trên production clone; backup đã test restore; maintenance window và actor/authorization rõ.
- Cutover theo checkpoint: deploy compatible code → preview → approval → backup → apply → invalidate/reconcile draft → verify → mở UI. Có stop/rollback criteria ở từng checkpoint.
- Giữ evidence report trước/sau và source/policy hashes trong audit/run record.

**Verification**

- Restore rehearsal đo được thời gian và chứng minh backup dùng được.
- Post-cutover: 0 eligible active legacy, 0 orphan/overlap/unknown technical unit; canonical counts theo tier đúng; completed history checksum không đổi; draft demand E2E đúng.
- Smoke `/admin-data`, material demand, purchasing, warehouse, reports và audit; nếu bất kỳ critical invariant fail thì dừng, không tiếp tục cleanup bổ sung thủ công.

**Phase:** P1 baseline; P5 rollout gate.

## Checklist “không được ship nếu”

- Chưa chốt semantics customer override full-set hay per-ingredient overlay.
- Preview/apply không cùng source hash + policy/version, hoặc apply tin candidate IDs từ client mà không revalidate.
- Cleanup vẫn có đường gọi `DELETE FROM dishbom`/`Bomadjustments.RemoveRange(all)` trên dữ liệu production.
- Staleness không phản ứng với BOM change, hoặc draft regeneration có thể chạm approved/locked/completed documents.
- Unit mapping còn fallback KG im lặng cho ingredient ambiguous/suspicious.
- Chưa test fresh migration và legacy upgrade; đã xóa/sửa migration applied.
- Upload không có bound về bytes/rows/XML/ZIP hoặc không có authorization/security fixtures.
- UI không hiển thị rõ keep/archive/delete/block, hoặc bảng/search làm scope apply mơ hồ.
- Không có baseline, backup restore rehearsal, post-apply invariant report và dirty-worktree manifest.

## Kết luận PITFALLS

Rủi ro lớn nhất không nằm ở việc đọc được ba sheet Excel mà ở **provenance, retention và propagation**: xác định đúng bản ghi nào là legacy, giữ nguyên lịch sử nào, và làm cho mọi consumer biết BOM đã đổi. Roadmap nên khóa contract/scope/unit và baseline trước; sau đó xây một engine preview/apply idempotent; tiếp theo reconcile downstream; cuối cùng mới cutover UI và xóa code cũ. Bất kỳ kế hoạch nào đảo thứ tự này đều dễ tạo trạng thái “BOM mới đã vào nhưng demand/history/UI vẫn nửa cũ nửa mới”.
