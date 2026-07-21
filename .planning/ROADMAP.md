# Roadmap: IPC Management v1.1

**Milestone:** v1.1 — Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy
**Goal:** Chuyển vòng đời BOM sang workbook canonical 25k/30k/34k, dọn legacy theo dependency mà vẫn giữ nguyên chứng từ locked/completed, audit và stock ledger.
**Phases:** 6 phase mới, tiếp nối lịch sử v1.0 từ Phase 3 đến Phase 8.
**Coverage:** 34/34 requirements được map đúng một phase.

## Phase overview

| Phase | Name | Goal | Requirements | Dependency | Status |
|---|---|---|---|---|---|
| 3 | Contract, provenance & safety baseline | Khóa collision/unit/shared-CRUD invariant, provenance, baseline và khả năng restore trước mọi mutation | CAN-03..04, SAFE-04..05, CRUD-02, RETIRE-03 | Milestone v1.0 complete | Planned |
| 4 | Canonical parser, preview & dependency classifier | Cung cấp upload bounded, preview read-only và classifier dùng chung mà chưa thay đổi dữ liệu | SAFE-01..02, DATA-01, SEC-01..03 | Phase 3 | Planned |
| 5 | Transactional apply & downstream reconciliation | Apply atomic/idempotent, giữ lịch sử và tái tạo đúng draft bị ảnh hưởng | SAFE-03, DATA-02..04, DOWN-01..05, CRUD-03 | Phase 4 + Gate B | Planned |
| 6 | Admin shadcn cutover & manual CRUD | Đưa canonical preview/apply vào `/admin-data`, giữ CRUD thủ công và layout bảng ổn định | CRUD-01, UI-01..05 | Phase 5 | Planned |
| 7 | Legacy retirement & rollout verification | Cleanup guarded fresh/upgrade path và xóa consumer format cũ sau compatibility gate | DATA-05, RETIRE-01..02 | Phase 6 + Gate D | Planned |
| 8 | Operational page feature decomposition | Tách Weekly Menu, Purchasing và Chef theo vertical workflow, giữ nguyên route/API/UI contract | REFA-01 | MVP flow baseline; isolated frontend workstream | Complete |

## Phase Details

### Phase 3: Contract, provenance & safety baseline

**Goal**: Tạo safety boundary có thể kiểm chứng trước khi viết hoặc xóa dữ liệu BOM.
**Depends on**: Milestone v1.0 complete
**Requirements**: [CAN-03, CAN-04, SAFE-04, SAFE-05, CRUD-02, RETIRE-03]
**Plans**: 3 plans across 3 waves
Plans:
**Wave 1**

- [ ] 03-01: Complete pre-edit Gate A evidence and recovery proof (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-02: Lock versioned collision, unit and shared CRUD invariants (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03: Add forward provenance schema, prove migration paths and close Gate A (Wave 3)

**Scope:**

- Khóa weighted-dedupe/collision policy, technical-unit mapping version, effective-date ownership và shared scope key; actual parser/source-trace pipeline thuộc Phase 4.
- Khóa unit mapping version cho `CAI/HOP/QUA/O/MIENG/CAY/LAT/KG`; unknown/ambiguous là blocker, không fallback KG.
- Khóa customer override overlay theo nguyên liệu với fallback global, cùng overlap/effective/tier/scope invariants cho bulk và manual CRUD.
- Thiết kế provenance/reconciliation run và forward migration; tuyệt đối không sửa/xóa migration đã apply.
- Chụp dirty-worktree manifest, baseline count/checksum/dependency và thực hiện backup/restore rehearsal trên clone.

**Success Criteria** (what must be TRUE):

1. Weighted duplicate hợp lệ tạo kết quả deterministic; thiếu serving basis, collision và unknown unit bị block, không fallback KG.
2. Bulk và manual validation dùng cùng contract cho overlap, effective interval, tier và global/customer overlay.
3. Mỗi run contract có actor, reason, source hash, backup ID, before/after/action counts và status; không chứa local server path trong production contract.
4. Baseline legacy-schema chạy lặp lại được; backup định danh restore thành công trên clone và tái lập checksums locked/completed, audit và stock ledger trước mọi source/schema edit.
5. Fresh/upgrade migration proof xác nhận không file migration đã apply bị rewrite/delete và dirty worktree ngoài phạm vi được giữ nguyên.

**Gate A — before implementation edits:**

- Ghi nhận dirty worktree và ownership hotspot; không reset, checkout hay stash tự động.
- Chạy GitNexus impact trước từng symbol sẽ sửa; HIGH/CRITICAL phải được cảnh báo.
- Characterization tests và baseline data report tồn tại trước schema/application change.

### Phase 4: Canonical parser, preview & dependency classifier

**Goal**: Cho Admin xem toàn bộ thay đổi và blocker bằng một preview thuần đọc, không có đường mutation.
**Depends on**: Phase 3
**Requirements**: [CAN-02, SAFE-01, SAFE-02, DATA-01, SEC-01, SEC-02, SEC-03]
**Plans**: 3 plans across 3 waves
Plans:
**Wave 1**

- [ ] 04-01: Versioned exact XLSX security limits, Phase 4 ownership gate and pure deterministic parser with source trace

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-02: Separate canonical Unchanged/Create/Version diff plus full dependency evidence and conservative legacy classifier

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-03: Admin-only read-only preview with separate counts, exact pre-model-binding limit, manifest drift protection and Gate B

**Scope:**

- Tách pure canonical parser khỏi EF và khỏi sample-data broad replacement; parser tạo deterministic normalized row/cell source trace.
- Xây bounded multipart/object-reference upload, Admin authorization và safe 4xx cho workbook corrupt/abusive.
- Xây reconciliation manifest có hash, contract/policy version, effective date, DB fingerprint, TTL và source trace.
- Xây dependency classifier dùng một policy cho `keep/archive/deactivate/regenerate/delete/block`; preview dùng `AsNoTracking` và không mutate.

**Success Criteria** (what must be TRUE):

1. DB counts/checksums trước và sau mọi preview hoàn toàn giống nhau.
2. Thay file, parameter hoặc DB sau preview làm manifest stale và apply bị conflict với 0 mutation.
3. Mixed-state fixtures nhận đúng action/reason/blocker; filter/search không tham gia tính candidate scope.
4. Unauthenticated/non-Admin bị từ chối; actor lấy từ server identity và API không nhận/leak đường dẫn như `D:\\...`.
5. Oversize/corrupt/ZIP/XML/external-link/too-many-sheet-row-cell fixtures trả 4xx bounded, không leak temp path.

**Gate B — before enabling apply:**

- Contract, unit mapping, customer overlay, effective-date rule và domain status map đã khóa.
- Preview purity, classifier, authorization, upload security và stale-manifest tests pass.
- Backup restore rehearsal pass; blocker unknown unit/collision/stock/history ambiguity bằng 0.
- Không expose destructive apply khi Gate B chưa xanh.

### Phase 5: Transactional apply & downstream reconciliation

**Goal**: Apply desired state atomic/idempotent và reconcile đúng draft/open dependency mà không thay đổi lịch sử bất biến.
**Depends on**: Phase 4 + Gate B
**Requirements**: [SAFE-03, DATA-02, DATA-03, DATA-04, DOWN-01, DOWN-02, DOWN-03, DOWN-04, DOWN-05, CRUD-03]
**Plans**: 9 plans across 9 serialized waves

Plans:

**Wave 1** *(blocked on Phase 3/4 execution, Gate A/B, backup and fresh blocker-zero preview)*

- [ ] 05-01: Prove prerequisites/ownership, keep apply disabled and create Wave-0 fixtures (Wave 1)

**Wave 2** *(blocked on Wave 1)*

- [ ] 05-02: Add forward scope-token and reconciliation-lineage schema (Wave 2)

**Wave 3** *(blocked on Wave 2)*

- [ ] 05-03: Implement canonical-only Unchanged/Create/Version transaction and idempotency (Wave 3)

**Wave 4** *(blocked on Wave 3)*

- [ ] 05-04: Implement legacy-only keep/archive/deactivate/delete/block retention (Wave 4)

**Wave 5** *(blocked on Wave 4)*

- [ ] 05-05: Implement customer overlay, unit math and scope-aware staleness (Wave 5)

**Wave 6** *(blocked on Wave 5)*

- [ ] 05-06: Reconcile regenerate-only draft leaves before catalog retention (Wave 6)

**Wave 7** *(blocked on Wave 6)*

- [ ] 05-07: Finalize post-commit cache/report consistency and historical snapshots (Wave 7)

**Wave 8** *(blocked on Wave 7)*

- [ ] 05-08: Harden actual manual BOM CRUD actor/reason and atomic audit (Wave 8)

**Wave 9** *(blocked on Wave 8)*

- [ ] 05-09: Run isolated restorable Gate C and gate production apply by PASS evidence (Wave 9)

**Scope:**

- Reparse/reclassify server-side trong transaction, version BOM thay vì hard-delete published history, ghi audit cùng DML và rollback toàn bộ khi lỗi.
- Chỉ hard-delete true orphan không reference và stock = 0; catalog có history được archive/deactivate.
- Đánh stale đúng material demand/production draft; regenerate/cancel leaf theo thứ tự dependency, mỗi draft đúng một lần.
- Giữ bit-for-bit completed/locked snapshots, approval/audit/ledger; ordered/received/issued/returned là blocker.
- Tính demand theo tier, conversion và ingredient-level customer overlay; invalidation cache/report xảy ra sau commit.
- Giữ ba vocabulary tách biệt: canonical `Unchanged/Create/Version`, legacy `keep/archive/deactivate/delete/block`, downstream chỉ `regenerate`; leaf downstream hoàn tất trước archive/delete catalog.
- Production apply endpoint mặc định disabled; chỉ cấu hình enable sau Gate C PASS trên clone có ID, backup và restore-on-failure được xác minh.

**Success Criteria** (what must be TRUE):

1. Injected failure rollback cả domain data lẫn audit; apply lại cùng source/policy/effective date tạo 0 mutation.
2. Deleted IDs bằng đúng preview true-orphan set, 0 FK orphan và không entity stock khác 0 bị xóa.
3. Chỉ draft/open đúng scope bị stale/rebuild một lần; completed/locked, audit, approval và stock ledger giữ nguyên checksum/count.
4. Representative fixtures cho 25k/30k/34k và mọi unit family khớp `servings × grossQtyPerServing`, customer rows overlay đúng nguyên liệu và fallback global cho phần còn lại.
5. Published manual edit thiếu reason bị reject; đủ actor/reason tạo version/adjustment/audit và request kế tiếp thấy catalog/report mới trong khi history vẫn đọc snapshot cũ.

**Gate C — before destructive cleanup:**

- Candidate được chứng minh bằng provenance + dependency policy, không suy từ code/name/absence đơn thuần.
- Server revalidate trong transaction và dry-run/apply dùng cùng policy version.
- Locked/completed baseline được lưu; hard-delete set bằng true-orphan set; không có broad delete production.
- Bất kỳ checksum drift, blocker mới hoặc apply-count khác preview đều dừng và rollback.

### Phase 6: Admin shadcn cutover & manual CRUD

**Goal**: Cung cấp canonical migration workbench dễ kiểm tra trên `/admin-data` mà không làm mất khả năng chỉnh nhanh từng BOM.
**Depends on**: Phase 5
**Requirements**: [CRUD-01, UI-01, UI-02, UI-03, UI-04, UI-05]
**Plans**: 7 plans across 7 serialized waves

Plans:

- [ ] 06-01: Prove Gate C/ownership readiness and implement canonical API/state authority (Wave 1)
- [ ] 06-02: Create compile-clean Wave-0 workbench/table/dialog/apply contracts (Wave 2)
- [ ] 06-03: Extract the BOM workbench and immutable dataset summary from AdminDataPage (Wave 3)
- [ ] 06-04: Implement fixed table viewport, safe search and same-row actions (Wave 4)
- [ ] 06-05: Implement accessible manual add/version/stop dialogs (Wave 5)
- [ ] 06-06: Implement fail-closed canonical apply dialog and post-commit refresh (Wave 6)
- [ ] 06-07: Run browser, visual, accessibility and compatibility Gate D (Wave 7)

**Scope:**

- Dùng shadcn-style primitives sẵn có cho `BomMigrationPanel`, `CleanupPreviewDialog` và feedback states; không thêm UI kit/modal/table framework thứ hai.
- Hiển thị counts/action/blocker của toàn dataset, hash/effective date/destructive/draft/history-kept counts và backup marker.
- Giữ manual add, edit-by-version và stop/close; không hard-delete published history.
- Giữ bảng `table-fixed`, `colgroup`/min-width, viewport cố định và scroll riêng giữa full/search/loading/error/empty state.
- Sửa search padding/icon và action nowrap để `Sửa`/`Ngừng` luôn cùng hàng ở desktop; đảm bảo keyboard/focus/a11y.

**Success Criteria** (what must be TRUE):

1. Admin có thể add, sửa tạo version và ngừng từng dòng BOM ở cả global/customer scope sau canonical cutover.
2. Search/filter chỉ đổi phần hiển thị; total apply scope/count không đổi và CTA disabled khi blocker, stale preview hoặc thiếu backup marker.
3. Table/header/column geometry không co giãn giữa full/search/loading/empty; scroll riêng hoạt động và trang không phát sinh horizontal overflow ngoài table container.
4. Search icon không đè chữ; `Sửa` và `Ngừng` không wrap, cùng một hàng ở desktop target.
5. Dialog có title/description truy cập được, keyboard navigation, focus return, cancel an toàn mặc định và loading/error/empty/success feedback không phụ thuộc màu.

**Compatibility gate for Phase 7:**

- Canonical API/UI preview→apply, manual CRUD, cache invalidation và downstream draft reconciliation pass integration/E2E.
- Old writer bị đóng hoặc read-only; consumer inventory cho old contract được xác nhận bằng 0 trước removal.
- Route `/admin-data` và các operational handoff vẫn pass smoke/visual/accessibility checks.

### Phase 7: Legacy retirement & rollout verification

**Goal**: Xóa bề mặt format cũ và dữ liệu active legacy chỉ sau khi canonical path đã chứng minh tương thích và có rollback.
**Depends on**: Phase 6 + Gate D
**Requirements**: [CAN-01, DATA-05, RETIRE-01, RETIRE-02]
**Plans**: TBD

Plans:

- [ ] 07-01: TBD by plan-phase

**Scope:**

- Rehearse production-like clone: backup → preview → apply → draft reconcile → invariant report → restore drill.
- Forward cleanup guarded cho active `TMP-BOM-*`, unsupported tier và eligible orphan; giữ nguyên applied migrations và locked/completed history.
- Sau compatibility gate, retire old template endpoint/DTO/builder/parser, RTK hook, UI controls/copy, test/docs và deprecate broad SQL runner để chỉ còn một Admin bulk contract ba sheet canonical.
- Verify empty-to-latest và legacy-to-latest không tái seed legacy; kiểm tra consumer bằng compile/OpenAPI/RTK/`rg`/GitNexus.

**Success Criteria** (what must be TRUE):

1. Fresh và upgraded DB đều có 0 active `TMP-BOM-*`, 0 unsupported active tier, 0 eligible legacy orphan và 0 broken FK.
2. Chỉ còn một Admin bulk contract canonical ba sheet; old endpoint/DTO/workbook builder/parser/RTK hook/UI copy không còn consumer/reference, canonical route và manual CRUD vẫn pass smoke.
3. Clone rehearsal và restore drill pass trong rollback window; completed/locked/audit/approval/ledger checksum không đổi.
4. Backend/frontend/unit/integration/E2E/security/visual suites pass và GitNexus `detect_changes` chỉ ra đúng flow dự kiến.
5. Cutover dashboard đạt 0 unknown unit, published overlap, invalid quantity và stale draft ngoài policy; nếu không đạt thì dừng/restore, không tiếp tục cleanup.

**Gate D — before retiring old contract:** compatibility gate của Phase 6 pass, old consumer = 0 và fresh install không tái seed format cũ.
**Gate E — release:** rehearsal/restore pass, mọi invariant xanh, history checksum bất biến và có stop/rollback criteria tại từng checkpoint.

### Phase 8: Operational page feature decomposition

**Goal**: Biến ba route page lớn thành shell mỏng và feature module kiểm thử độc lập mà không thay đổi URL, permission, API payload, label hoặc workflow người dùng.
**Depends on**: MVP flow gap baseline; thực hiện như frontend workstream cô lập và không sở hữu các hunk BOM Phase 3–7.
**Requirements**: [REFA-01]
**Plan**: `08-PLAN.md` — 7 wave tuần tự, Weekly Menu trước rồi Purchasing/Chef.

**Scope:**

- Giữ `/weekly-menu` là một route; page chỉ sở hữu customer, tuần, price tier và active tab.
- Server state tiếp tục thuộc RTK Query; UI state thuộc custom hook theo workflow, không thêm state manager.
- Tách pure model, import wizard, schedule editor, production plan, demand và các tab chỉ đọc; sau đó áp cùng pattern cho Purchasing/Chef.
- Dùng component Shadcn/Base UI và IPC token hiện tại; refactor commit không redesign hoặc đổi copy.
- Xóa file cũ chỉ sau `rg` và GitNexus xác nhận không còn caller.

**Success Criteria:**

1. `WeeklyMenuPage`, `PurchasingPage` và `ChefDashboardPage` không quá 400 dòng; component workflow không quá 500 dòng và hook không quá 300 dòng, hoặc có ngoại lệ được review ghi rõ.
2. Route, permission, tab, label, API request/response mapping và mutation feedback giữ nguyên qua characterization tests.
3. Không có duplicate server state giữa local hook và RTK Query; không có prop chain quá hai tầng nếu chưa có boundary justification.
4. Mỗi wave là commit độc lập, có upstream impact, focused tests, `detect_changes`, build và lint pass.
5. Browser UAT xác nhận keyboard/focus, responsive và toàn bộ control chính với backend/database thật trước full pass.

## Dependency graph

```text
Phase 3: contract + provenance + baseline
   ↓ Gate A
Phase 4: parser + read-only preview + classifier
   ↓ Gate B (no mutation before this point)
Phase 5: transactional apply + downstream reconciliation
   ↓ Gate C
Phase 6: shadcn Admin cutover + manual CRUD compatibility
   ↓ Gate D (no legacy retirement before this point)
Phase 7: guarded cleanup + old-surface retirement + release Gate E

Phase 8 (isolated frontend workstream):
route-preserving feature decomposition + regression/UAT gates
```

## Preservation rules across all phases

- Không reset, checkout, stash hoặc overwrite dirty worktree; mỗi plan phải ghi manifest file sở hữu và tránh stage thay đổi có sẵn ngoài scope.
- Không sửa/xóa migration đã apply; mọi schema/provenance/cleanup dùng forward migration.
- Không hard-delete published BOM có history, chứng từ approved/locked/completed, approval history, audit log hoặc stock ledger.
- Không dùng `ReplaceBomCatalog` hoặc broad SQL delete làm production cleanup runner.
- Mỗi symbol code trước khi sửa phải có GitNexus upstream impact; trước commit phải chạy `detect_changes()` theo AGENTS.md.

### Phase 9: Supplier canonical refresh and purchasing workflow alignment

**Goal:** Reconcile the audited 20.7 supplier purchase history without damaging immutable operations, then deliver the approved-demand-to-Warehouse purchasing flow with explicit supplier and price decisions.
**Requirements**: SUP-01, SUP-02, SUP-03, SUP-04, PUR-01, PUR-02, PUR-03, PUR-04, PUR-05, WHR-01, PUI-01
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 9 to break down)

---
*Roadmap created: 2026-07-16 — research-first build order, customer override overlay theo nguyên liệu, retention option 2A.*
