# Research Summary — v1.1 Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy

**Milestone:** v1.1  
**Ngày tổng hợp:** 2026-07-16  
**Nguồn:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`, `PROJECT.md`  
**Ranh giới đã chốt:** giữ nguyên chứng từ đã khóa/hoàn tất và audit; chỉ dọn hoặc tái tạo dữ liệu nháp/đang mở và hard-delete catalog khi chứng minh là orphan.

## 1. Executive summary

Milestone này phải được triển khai như một **cutover có kiểm soát**, không phải một migration hoặc script “xóa sạch rồi import lại”. Hệ thống hiện có hai contract bulk BOM khác nhau: importer ba sheet 25k/30k/34k trong `SampleDataImportService` và template phẳng cũ trong `DishService`/Admin UI. Đích đến là một bulk contract canonical duy nhất từ workbook định lượng mới, trong khi vẫn giữ nguyên CRUD thủ công có version, hiệu lực, scope global/customer, overlap validation và audit.

Giải pháp an toàn gồm ba boundary độc lập nhưng nối tiếp:

1. Parser thuần nhận workbook canonical, validate cấu trúc, normalize và tạo desired state có source trace.
2. Reconciliation preview/apply so sánh desired state với catalog hiện tại bằng manifest có fingerprint, provenance, versioning và transaction.
3. Cleanup classifier áp retention policy theo dependency; giữ lịch sử, tái tạo draft có kiểm soát, archive/deactivate entity có history, chỉ hard-delete orphan chắc chắn.

Không dùng `ReplaceBomCatalog` hoặc `Clean_Legacy_Imported_Bom.sql` làm runner production vì cả hai có hành vi xóa quá rộng. Không sửa/xóa migration đã applied; thay vào đó dùng forward schema/provenance migration và application service có dry-run/audit. Old template/API/UI chỉ được retire sau khi canonical flow, manual CRUD và downstream verification đã pass.

Blast radius thực tế được xem là **HIGH** dù một số kết quả GitNexus chỉ là lower-bound do interface/DI: BOM tác động trực tiếp tới material demand/production và gián tiếp tới purchase, inventory, reports và audit. Vì vậy mỗi phase destructive phải có baseline, backup đã restore thử, blocker bằng 0 và checksum history bất biến.

## 2. Canonical data contract

### 2.1 Workbook contract v1

- Bulk source canonical duy nhất là workbook có đủ ba sheet, nhận diện không phân biệt hoa thường:
  - `định lượng suất 25k` → tier `25000`
  - `định lượng suất 30k` → tier `30000`
  - `định lượng suất 34k` → tier `34000`
- Nhận diện bằng cấu trúc nội dung, không phụ thuộc tên file hay đường dẫn local.
- Required source headers v1:
  - `Supplier`
  - `Sub-column`
  - `Loại món`
  - `Menu`
  - `Món`
  - `Nguyên liệu chính`
  - `Khối lượng ( kg)`
  - `Giá nhập (kg)`
  - `Số lượng suất ăn`
  - `Định lượng (gram) / khay`
  - `Cost/khay`
  - `Tổng cost 1 suất`
- Header/sheet/cell lỗi phải trả lỗi có vị trí; thiếu sheet, tier lạ, quantity không hợp lệ, collision identity hoặc unit ambiguous là blocker.
- File upload phải có SHA-256, contract version, giới hạn bytes/sheets/rows/cells/shared strings/XML/uncompressed ZIP, cancellation và authorization Admin.

### 2.2 Normalized model

Parser trả model nội bộ, không trả EF entity:

```text
CanonicalBomRow
  SourceSheet, SourceRow, SourceTraceId
  PriceTier: 25000 | 30000 | 34000
  DishName, DishNormalizedKey, DishGroup, DishType
  IngredientName, IngredientNormalizedKey
  TechnicalUnitCode, GrossQtyPerServing
  ReferencePrice?, SupplierName?, ServingWeight?
```

Canonical reconciliation key tối thiểu:

```text
tier + customer scope + dish identity + ingredient identity + technical unit + effective interval
```

- Dòng trùng trong cùng tier/món/nguyên liệu chỉ được gộp bình quân gia quyền theo `Số lượng suất ăn` khi dữ liệu đủ căn cứ; nếu không thì block.
- `effectiveFrom` là input được xác nhận ở preview/apply, không hardcode trong parser.
- Workbook canonical là global desired state; customer override thủ công không bị workbook xóa hoặc gộp lẫn.
- Technical unit không được suy luận chỉ từ ngưỡng `0.5–5`. Mapping `CAI`, `HOP`, `QUA`, `O`, `MIENG`, `CAY`, `LAT`, `KG` phải versioned, có alias/fixture; tên unknown hoặc ambiguous vào review queue thay vì fallback KG im lặng.
- Quantity phải `> 0`; unit phải tồn tại và có semantics/conversion rõ ràng. Không rewrite unit của chứng từ lịch sử nếu không có conversion/proof.

### 2.3 Preview/apply contract

- Preview read-only, dùng `AsNoTracking`, không mutate tracked entity.
- Preview trả `previewId`/manifest gồm file hash, actor, contract/policy version, effective date, DB fingerprint, TTL, source trace và counts/action/blocker.
- Apply reparse và reclassify server-side trong transaction; không tin candidate IDs từ client.
- File/parameter/DB drift sau preview trả conflict và bắt preview lại.
- Batch status tối thiểu: `PREVIEWED`, `APPLYING`, `COMPLETED`, `FAILED`, `ROLLED_BACK` hoặc tương đương.
- Apply cùng source/policy/effective date lần hai tạo `0` mutation hoặc được nhận diện là run đã hoàn tất.

## 3. Keep/remove matrix

| Bề mặt | Keep | Remove/replace sau compatibility gate |
|---|---|---|
| Stack | .NET 9, EF Core/Pomelo/MySQL, React/Vite, RTK Query, Tailwind, shadcn/common primitives | Không thêm ORM, parser Excel, job runner, state manager hoặc UI kit thứ hai |
| Excel low-level | Logic OpenXML bounded trong `XlsxWorkbookReader`, sau khi chuyển ownership phù hợp | Parser temp-file/CSV/template phẳng chỉ hiểu sheet `BOM`; normalization trùng lặp |
| Bulk BOM | Workbook canonical 3 sheet, typed parser, preview/apply manifest, provenance | `BOM thiếu`, `Mẫu trống`, `BomTemplateWorkbookBuilder`, old preview/commit contract |
| Manual BOM | Add/edit version/close, tier 25k/30k/34k, global/customer, effective dates, overlap, adjustment/audit | Không xóa CRUD cùng lúc với old bulk importer; không hard-delete published history |
| `DishService` | Catalog, validation/coverage, manual CRUD và shared invariant engine | Template builder/parser/commit cũ sau khi consumer bằng 0 |
| `SampleDataImportService` | Coordination/menu/quantity/purchase orchestration còn consumer; dev flow gọi canonical service | Ownership và logic BOM production riêng; `ReplaceBomCatalog` broad-delete |
| Material demand | Canonical BOM, scope precedence, snapshot history, draft staleness/regenerate | Runtime portion-rule factor cho calculation mới; prune lên locked/completed |
| Reports/audit | Historical snapshots, `Auditlog`, approval history, data-quality mới | Business cleanup nhét trong reporting service; copy hướng dẫn template cũ |
| Migration history | Tất cả migration đã applied, model history, forward migration mới | Không rewrite/xóa seed migration cũ; không coi `Down()` là data rollback |
| SQL/bootstrap | Fresh-install baseline không seed legacy; guarded diagnostic/verification SQL | `Clean_Legacy_Imported_Bom.sql` broad-delete như production runner; `TMP-BOM-*` seed mới |
| Admin UI | `/admin-data`, manual CRUD, fixed table/scroll/search, RTK invalidation | Old download/preview/commit controls, old hooks/DTO/copy sau cutover |

## 4. Retention matrix

| Candidate/dependency | Default action | Hard-delete condition | Blocker/guard |
|---|---|---|---|
| Canonical row unchanged | Keep + attach provenance if safe | Never | Không tạo version/audit rỗng |
| Canonical row changed | Close old version, create new version, audit | Never | Overlap/collision/unit invalid |
| Customer override | Preserve | Never trong global cutover | Chưa chốt full-set vs overlay |
| Legacy BOM có historical reference/adjustment | Archive/close, retain explainability | Không | Locked/completed reference |
| Legacy BOM không reference | Archive hoặc delete theo policy | Backup + proven orphan | Candidate phải từ provenance/classifier, không chỉ tên |
| `TMP-BOM-*` | Leaf-first cleanup | Chỉ khi không retained reference | Có history thì deactivate/archive |
| Dish ngoài canonical | Deactivate/legacy | Không menu/production/document/audit ref | History là blocker hard-delete |
| Ingredient ngoài canonical | Deactivate/legacy | Không BOM/stock/lot/movement/purchase/inventory/doc ref và stock = 0 | Stock khác 0 hoặc history là blocker |
| Supplier/warehouse/unit legacy | Retain mặc định | Chỉ true orphan, không stock/history/reference | Không cleanup “kéo theo” theo pattern |
| Draft/open production/material demand | Invalidate/cancel/regenerate trong scope | Xóa draft leaf khi không downstream locked | Approved purchase/order/receipt/issue là blocker |
| Draft purchase/inventory | Cancel/rebuild theo dependency order | Chỉ trạng thái cho phép và không downstream | Ordered/received/issued/returned là blocker |
| Approved/locked/completed | Keep bit-for-bit; read snapshot | Never | Checksum/count phải bất biến |
| Audit/approval/stock ledger | Keep | Never | Không cascade hoặc cleanup toàn cục |
| Portion-rule live path | Fixed 100% cho calculation mới, deprecate/remove runtime | Schema row/table chỉ sau consumer proof | Historical snapshot fields vẫn giữ |

Thứ tự cleanup: chốt fingerprint/baseline → xử lý draft purchase/inventory leaf → material demand/production draft → menu draft → archive/delete BOM → deactivate/delete catalog orphan → reconcile stock/lot → audit và commit. Không xóa stock khác 0.

## 5. Target architecture

```text
AdminData / workbook upload
        |
        v
PresetBomWorkbookParser                 [pure, no EF]
        |
        v
BomCatalogReconciliationService         [preview/apply/version/provenance]
        |                    \
        v                     v
Dish/BOM catalog       LegacyDataCleanupService
        |              [classifier/retention/dry-run]
        v                     |
MaterialDemand/Production <---+
        |
        v
Draft purchase/inventory reconciliation
        |
        v
Historical reports read immutable snapshots
```

### Recommended ownership

- `IPresetBomWorkbookParser`: parse/validate/normalize/dedupe/source trace; no database.
- `IBomCatalogReconciliationService`: desired-vs-current diff, preview manifest, apply idempotent, versioning, provenance, cache invalidation.
- `IBomLegacyCleanupService`: shared pure policy/classifier for preview/apply, dependency blockers, audit.
- `BomReconciliationRun` (hoặc equivalent): file hash, contract/policy version, effective date, actor, status, counts, backup ID, timestamps; unique idempotency guard.
- `Dishbom.SourceRunId`/`SourceKind` (hoặc equivalent provenance): distinguish canonical/manual/unknown legacy.
- Admin-only controller: multipart preview, apply token, run status; controller mỏng.
- `DishService`: manual CRUD/catalog only after old bulk removal.
- `MaterialDemandService`: BOM version/change token participates in staleness; regenerate draft only; completed reads snapshots.
- `WorkflowReportService`: reports/quality; delegate cleanup business policy to cleanup service.
- Frontend `bomMigrationApi.ts`: typed preview/apply/run endpoints, separate from manual catalog API.

Transaction strategy: application service recomputes candidates inside transaction, writes domain changes and audit together, rolls back all DML on failure, keeps transaction bounded/batched, and does not mix MySQL DDL with cleanup DML. Schema/provenance arrives by forward migration; workbook parsing never runs inside EF migration.

## 6. Shadcn UI contract

- Giữ route `/admin-data`, navigation và visual language operational hiện tại.
- `BomMigrationPanel`: full workbook upload + effective date + preview/apply; không dùng tier selector cho upload vì tier nằm trong sheet. Tier vẫn là filter catalog/manual CRUD.
- `CleanupPreviewDialog`: shadcn-style `Dialog`, `Alert`, `Badge`, `Checkbox`, `Button`; nhóm rõ `Giữ lịch sử`, `Tạo/version`, `Tái tạo nháp`, `Ngừng áp dụng`, `Xóa mồ côi`, `Bị chặn`.
- CTA cuối phải cụ thể, ví dụ `Áp dụng cleanup N bản ghi`, hiển thị hash, effective date, count destructive/draft/history kept, yêu cầu reason; cancel là lựa chọn an toàn mặc định.
- Apply disabled khi blocker > 0, preview stale, thiếu backup marker hoặc chưa xác nhận. Filter/search chỉ lọc hiển thị, không thay đổi total scope apply.
- `BomCatalogTable` giữ `table-fixed`, `colgroup`/min-width, container chiều cao cố định và `overflow-y-auto`; full/search/empty có cùng viewport/header/cột.
- Search icon có padding riêng, không đè text. Cell action `whitespace-nowrap`, button `shrink-0`; `Sửa` và `Ngừng` luôn một hàng ở desktop target.
- Loading/error/empty/success có text, không phụ thuộc màu; dialog có accessible title/description, keyboard navigation, focus return và screen-reader announcement.
- Dùng primitives sẵn có (`DataTableShell`, `InlineAlert`, `SectionPanel`, `ViewSwitcher`, `Dialog`, `Button`, `Input`, `Select`, `Checkbox`, `Alert`, `Table`, `Card`, `Badge`); không dựng raw modal/table framework mới.
- Sau apply invalidate `DishCatalog`, `WorkflowReports`, `MaterialDemandStaleness`, `Ingredients`; không reload toàn trang.

## 7. Proposed phase/build order

### Phase 1 — Contract, provenance, safety baseline

- Khóa workbook v1, canonical key, unit mapping/version, effective-date rule, customer override semantics và domain status retention map.
- Characterization tests cho importer/manual CRUD/material demand hiện tại.
- Capture baseline counts, overlaps, unknown unit, orphan/reference, draft/completed checksum và representative demand totals.
- Thêm forward provenance/run schema nếu được xác nhận; không chỉnh migration applied.
- Viết backup/restore rehearsal và dirty-worktree manifest.

### Phase 2 — Parser, preview và dependency classifier

- Tách pure parser, bounded upload security, shared normalization/invariant engine.
- Xây read-only reconciliation preview, manifest/fingerprint/TTL và action/blocker matrix.
- Xây cleanup classifier dùng cùng policy cho preview/apply; không mutation trong phase preview.
- API integration tests cho auth, invalid workbook, unit ambiguity, collision, drift và preview purity.

### Phase 3 — Transactional apply và downstream reconciliation

- Apply idempotent bằng versioning/provenance, revalidation server-side, audit cùng transaction và cache invalidation.
- BOM change token/staleness cho đúng scope; regenerate/cancel draft theo dependency order.
- Giữ completed/locked snapshot bit-for-bit; block stock-bearing/history cases.
- Fixed canonical factor 100% cho calculation mới; giữ historical portion/yield snapshot.

### Phase 4 — Admin shadcn cutover

- Tách `BomMigrationPanel`, `BomCatalogTable`, `CleanupPreviewDialog` và typed RTK API.
- Thay old template controls bằng canonical preview/apply/cleanup; giữ manual add/edit/stop.
- Khóa fixed table/search/action layout, accessibility, stale-preview state và scope clarity bằng unit/Playwright tests.

### Phase 5 — Legacy retirement, migration and rollout verification

- Rehearse trên production-like clone: backup → preview → apply → draft reconcile → invariant report → restore drill.
- Chạy forward cleanup guarded cho TMP/orphans/drafts; update fresh DB baseline để không tái seed legacy.
- Sau compatibility gate, xóa old endpoint/interface/DTO/builder/RTK hooks/UI copy/tests/docs và deprecate broad SQL.
- Chạy full backend/frontend/E2E/security/data verification, GitNexus `detect_changes`, cutover dashboard và stop/rollback gates.

Dependency cứng: không destructive apply trước Phase 1–2 pass; không retire old surface trước canonical UI/API + manual CRUD pass; không ship nếu history checksum, backup restore hoặc downstream invariants fail.

## 8. Requirement candidates và acceptance testable

### CAN — Canonical contract

- **CAN-01:** Hệ thống chỉ công khai một bulk contract ba sheet 25k/30k/34k. **Accept:** thiếu/đổi sheet/header trả lỗi sheet/cell; unsupported tier không apply.
- **CAN-02:** Parser tạo source trace và normalize deterministic. **Accept:** tổng normalized + skipped + blocked khớp source; cùng fixture cho cùng kết quả.
- **CAN-03:** Dedupe/collision an toàn. **Accept:** weighted duplicate đúng fixture; ambiguous identity/unit bị block, không lấy dòng đầu.
- **CAN-04:** Unit mapping versioned, không silent KG. **Accept:** fixture `CAI/HOP/QUA/O/MIENG/CAY/LAT/KG` pass; unknown/suspicious active = 0 sau apply.

### SAFE — Preview, provenance, audit và rollback

- **SAFE-01:** Preview không mutation. **Accept:** DB checksum/count trước/sau preview giống nhau.
- **SAFE-02:** Apply gắn manifest/hash/policy/effective date và chống TOCTOU. **Accept:** đổi file/DB/parameter sau preview trả conflict, 0 mutation.
- **SAFE-03:** Apply atomic và idempotent. **Accept:** injected failure rollback cả data/audit; lần apply thứ hai 0 mutation.
- **SAFE-04:** Mỗi run có actor, reason, source hash, backup ID, before/after/action counts/status. **Accept:** audit counts bằng transaction result.
- **SAFE-05:** Backup restore hoạt động. **Accept:** restore rehearsal trên clone tái lập pre-cutover counts/checksum.

### DATA — Retention và cleanup

- **DATA-01:** Classifier gán đúng `keep/archive/deactivate/regenerate/delete/block`. **Accept:** fixture mixed states cho action/reason/blocker đúng từng entity.
- **DATA-02:** Không broad-delete history. **Accept:** locked/completed/audit/ledger checksum và count bất biến.
- **DATA-03:** Chỉ hard-delete true orphan. **Accept:** deleted IDs bằng đúng preview eligible set; 0 FK orphan; stock khác 0 không bị xóa.
- **DATA-04:** Cleanup idempotent. **Accept:** preview sau apply có 0 eligible mutation; không phát sinh version/audit rỗng.
- **DATA-05:** Fresh và upgraded DB cùng invariant. **Accept:** cả hai đường không còn seed TMP active, unsupported active tier hoặc eligible legacy orphan.

### DOWN — Downstream consistency

- **DOWN-01:** BOM change đánh stale đúng draft scope. **Accept:** demand bị ảnh hưởng `IsStale=true`; scope khác false.
- **DOWN-02:** Chỉ draft/open được regenerate. **Accept:** draft totals/BOM IDs theo canonical; completed fixture bit-for-bit không đổi.
- **DOWN-03:** Demand dùng đúng quantity/unit/tier/scope. **Accept:** `servings × grossQtyPerServing` sau conversion hợp lệ khớp fixture mỗi tier/unit family.
- **DOWN-04:** Purchase/inventory history được giữ. **Accept:** ordered/received/issued/returned là blocker; draft leaf được rebuild đúng một lần.
- **DOWN-05:** Cache/report cập nhật ngay nhưng history đọc snapshot. **Accept:** request kế tiếp thấy catalog mới; báo cáo lịch sử vẫn render quantity/unit/tier/scope/reason.

### CRUD — Manual BOM

- **CRUD-01:** Add/edit/stop tiếp tục hoạt động. **Accept:** create pass; edit published đóng version cũ/tạo version mới; stop archive/close không hard-delete.
- **CRUD-02:** Overlap/scope invariant dùng chung. **Accept:** overlapping published blocked; non-overlap pass; global/customer không trộn.
- **CRUD-03:** Adjustment có actor/reason. **Accept:** manual published change thiếu reason bị reject; đủ reason tạo audit/adjustment.

### UI — Admin shadcn surface

- **UI-01:** Preview hiển thị counts/action/blocker toàn dataset. **Accept:** filter được ghi rõ chỉ lọc display; apply count không đổi theo search.
- **UI-02:** Destructive apply rõ scope và an toàn. **Accept:** blocker/stale/no-backup disable CTA; dialog nêu hash/count/history kept và focus/cancel đúng.
- **UI-03:** Bảng ổn định. **Accept:** bounding box table/header/cột không đổi giữa full/search/empty; scroll riêng còn hoạt động.
- **UI-04:** Search/action layout đúng. **Accept:** icon không chồng text; `Sửa`/`Ngừng` cùng y-coordinate và không wrap ở desktop target.
- **UI-05:** Accessibility/state đầy đủ. **Accept:** keyboard, focus return, accessible title/description và loading/error/empty/success tests pass.

### SEC — Authorization và upload hardening

- **SEC-01:** Preview/apply admin-only. **Accept:** unauthenticated/unauthorized bị từ chối; audit actor lấy server-side.
- **SEC-02:** Upload bounded. **Accept:** empty/oversize/corrupt/renamed/too-many-sheet-row/external-link/ZIP abuse fixtures trả 4xx an toàn, không leak path/temp.
- **SEC-03:** Production không nhận server filesystem path. **Accept:** API chỉ nhận bounded upload/object reference; không có `D:\\...` contract runtime.

### RETIRE — Legacy surface removal

- **RETIRE-01:** Old template/API/UI chỉ xóa sau compatibility gate. **Accept:** canonical flow + manual CRUD tests pass trước removal.
- **RETIRE-02:** Không còn consumer/reference cũ. **Accept:** compile/OpenAPI/RTK/`rg`/GitNexus không còn old route, DTO, builder, hook, copy; route operational vẫn smoke pass.
- **RETIRE-03:** Applied migration history nguyên vẹn. **Accept:** không file applied bị rewrite/delete; `__EFMigrationsHistory` upgrade/fresh pass.

## 9. Unresolved decisions

Các điểm sau phải được khóa trong Phase 1; trước đó chọn hành vi bảo thủ và block destructive action:

1. **Customer override semantics:** full-set replacement hay overlay per ingredient/unit. Tạm thời preserve toàn bộ override và không để global import xóa/chỉnh override.
2. **Domain status map:** status nào chính xác là draft/open/approved/locked/completed cho menu, production, demand, purchase và inventory.
3. **Draft regeneration scope:** theo date window, service date, batch/run, customer hay toàn bộ open documents.
4. **Effective date:** ngày user chọn, ngày workbook, hay cutover date; parser không được hardcode.
5. **Rollback window:** đến khi có locked/completed document mới phụ thuộc run hay theo time window bổ sung.
6. **Old customer override hết canonical coverage:** giữ đến hết hiệu lực, close tại cutover hay yêu cầu Admin review từng set.
7. **Technical-unit governance:** mapping nằm ở versioned config/table nào, ai duyệt alias mới, và contract tháng sau thay đổi ra sao.
8. **Provenance schema shape:** entity/run fields tối thiểu, retention của manifest/file metadata và unique idempotency key.
9. **Portion-rule schema removal:** xóa table/fields trong v1.1 hay chỉ deprecate/read-only 100%, trong khi historical snapshot vẫn giữ.

## 10. Risk gates

### Gate A — Trước edit đầu tiên

- Snapshot dirty worktree và ownership các hotspot; không reset/checkout/stash tự động.
- GitNexus impact cho từng symbol sẽ sửa; cảnh báo HIGH/CRITICAL trước khi tiếp tục.
- Characterization tests và baseline data report tồn tại.

### Gate B — Trước bật apply

- Contract/unit/customer override/status map đã khóa.
- Preview pure, classifier fixtures, upload security và stale-token tests pass.
- Backup có ID và restore rehearsal thành công.
- Không còn blocker unknown unit/collision/stock/history ambiguity.

### Gate C — Trước destructive cleanup

- Candidate source là provenance + dependency policy, không chỉ code/name/absence.
- Server revalidate trong transaction; dry-run/apply cùng policy version.
- Locked/completed checksum baseline đã lưu; hard-delete set bằng true orphan set.
- Không có đường broad `DELETE FROM dishbom`/`RemoveRange(all)` production.

### Gate D — Trước retire old contract

- Canonical API/UI production path, manual CRUD, cache invalidation và downstream draft reconcile đều pass.
- Old endpoint không còn writer song song; consumer inventory bằng 0.
- Fresh install baseline không tái seed TMP/old contract.

### Gate E — Release/cutover

- Rehearsal production-like pass; restore time chấp nhận được.
- `0` unknown unit, published overlap, invalid quantity, orphan FK, eligible active legacy và stale draft ngoài policy.
- Completed/locked/audit/ledger checksum không đổi.
- Backend/frontend/unit/integration/E2E/security/visual tests pass.
- GitNexus `detect_changes` chỉ ra đúng flow dự kiến; có stop/rollback criteria ở từng checkpoint.

## 11. Verification matrix

| Concern | Automated evidence | Data/runtime evidence | Release threshold |
|---|---|---|---|
| Workbook/parser | xUnit parser/header/Unicode/dedupe/unit/security fixtures | Preview counts theo sheet/tier/source trace | 3 sheet đúng; 0 blocking parse/unit issue |
| Reconciliation | Service/integration tests manifest, drift, idempotency, rollback | Apply lần 2 = 0; audit counts = action counts | Không partial state, không stale apply |
| Retention/FK | SQLite relational + MySQL fixture tests | Before/after checksum; orphan/stock/reference queries | 100% history giữ; 0 orphan; delete = true orphan |
| Migrations | Empty→latest và legacy fixture→latest | Schema/history/model snapshot comparison | Không rewrite applied migration; hai path cùng invariant |
| Material demand | Unit/service tests tier/scope/customer/staleness | Representative totals trước/sau; draft trace run mới | Draft đúng canonical; completed bit-for-bit |
| Purchase/inventory | Integration mixed-status fixtures | Ledger/stock/receipt/issue checksum | Không xóa stock khác 0; history không đổi |
| Manual CRUD | API contract tests create/version/overlap/close/audit | Smoke từng tier/global/customer | Không regression CRUD/version/audit |
| Admin UI | Vitest/Testing Library state/a11y; Playwright layout/visual | `/admin-data` desktop/mobile UAT | Table fixed; action nowrap; scope/destructive rõ |
| API security | Authorization + malformed/oversize/ZIP/XML tests | Temp/log/path inspection | 4xx an toàn, bounded resource, no path leak |
| Legacy retirement | Build/OpenAPI/RTK/`rg`/GitNexus consumer scan | Old routes 404/410; new route/manual CRUD smoke | 0 old consumer/reference, operational routes pass |
| Rollout | Scripted pre/post invariant suite | Backup restore rehearsal + cutover dashboard | Tất cả Gate E xanh hoặc dừng/restore |

## 12. Planner handoff

Roadmap nên dùng 5 phase ở trên và chia implementation theo vertical safety boundary. Plan đầu tiên tạo contract, characterization tests, provenance và baseline; plan destructive không được bắt đầu trước khi preview/classifier/backup gates pass. UI cutover diễn ra sau backend apply/downstream behavior ổn định. Xóa old code/API/template là bước cuối, sau proof không còn consumer. Mọi plan phải ghi rõ pre-existing dirty files cần preserve, symbol cần GitNexus impact, migration policy, test commands và stop conditions.

---

*SUMMARY này chỉ tổng hợp research và định hướng requirements/roadmap; không thay đổi source code, dữ liệu runtime hoặc migration hiện có.*
