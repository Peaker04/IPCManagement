# Chỉ mục evidence

File này là nơi duy nhất khai báo hash output artifact. Digest của workbook input là ngoại lệ bắt buộc trong front matter `MEMORY.md`. `Authoritative` được dùng để kết luận cho đúng phạm vi ghi trong cột Mục đích; `Historical` chỉ dùng điều tra; `Attempt` không được dùng làm gate.

## Authoritative

| Artifact | SHA-256 | Mục đích |
|---|---|---|
| `.artifacts/shipyard-live/shipyard-current-e2e-20260802/shipyard-current-e2e.json` | `51BE927EDD625AE889C25EF85EF97088D13EB1D1C07B9AD0D5DB4AC68AD76C65` | Baseline trước remediation: 50 canonical state × năm viewport trên current-source Shipyard có dữ liệu thật; gồm screenshot, API, tab timing, table geometry, CLS/long-task và browser error. |
| `.artifacts/shipyard-live/shipyard-current-e2e-20260802/shipyard-live-navigation.json` | `F74CB09E06D5597A53F580FADECF5706151955144E3D1360B84A5F38AE375DDD` | Baseline cold/warm sidebar navigation cho mười route; dùng để disposition việc không sửa router/cache/tab behavior. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/runtime-preflight.json` | `FA73DEF45214969B645F79AA5E01720B77381F7A5AF2CD2CD17BD39697B16008` | Preflight Phase 25 xác nhận current source, runtime guarded và database `ipc_lane1`; không seed/import/reset/restore. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/phase25-headed-current-source.json` | `5DCED855EF91AF3C62ED4B5099FCCC91099AC0A3BDD381CAFCBBBFF74CB1EDE4` | Run Chrome headed current-source cuối cho P8/PF; metrics gate hiện hành chỉ khai trong `MEMORY.md`. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/1920x1080-admin-statistics-final.png` | `5D8A3845E9915A8218F31E0C5651A99474435A8BE3FC9795426561E9DF46035C` | Screenshot cuối viewport `1920×1080` của run Phase 25 authoritative. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/1440x900-admin-statistics-final.png` | `D0FA46DA5CEBD69FB93620B370E6A8B0D609A9B0C2CD459C2C50D778EA704B1F` | Screenshot cuối viewport `1440×900` của run Phase 25 authoritative. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/1366x768-admin-statistics-final.png` | `688BF587448DC8B4E5038D5193DEBB6F869BE1391E4E4A195BB6DDE64EEFFDF8` | Screenshot cuối viewport `1366×768` của run Phase 25 authoritative. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/1365x900-admin-statistics-final.png` | `E6FEF174595D19A8617901637D5FCC4E9B1264B6B6DB5EF72C6445655968011B` | Screenshot cuối viewport `1365×900` của run Phase 25 authoritative. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/1280x900-admin-statistics-final.png` | `3F9DFBEA4F2EDEB777EE76459697931A3EF5321951A576151E4FF85014D8C5CA` | Screenshot cuối viewport `1280×900` của run Phase 25 authoritative. |
| `.planning/phases/20-pc-pd-action-completeness/20-PC-AGGREGATE.json` | `C07A2D7C0695A3A3C2BF6E8F689C5779CFAB4BEE24D72117EDE0E11CA8712A28` | Phase 20 aggregate `FE-fixture-read-only` cuối trên sáu executable family và năm desktop viewport; canonical operations có control đã được exercise, gồm intercepted read/mutation, post-action, screenshot và performance evidence; không phải backend/DB E2E. |
| `.artifacts/shipyard-live/pa2b-operational-weekly-menu-20260730/operational-weekly-menu-e2e.json` | `F2AE20CCF34C7FD3D1A36E6D67495C17A89142318EA9DA6C47F4BFBAF9A83493` | Chrome headed operational E2E trên source hiện tại: import → publish ở Admin Contracts → hoàn tất 12 ca → sinh/duyệt 6 demand → handoff Thu mua; 28 mutation đều 2xx và không chứa credential/token. |
| `.artifacts/shipyard-live/pa2b-operational-weekly-menu-20260730/database-after-e2e.json` | `B2C6DE7E813512FE063673EA7D4B0E61E17E1E979E00D0A8A325D2FCDB0FD55D` | DB transition trên `ipc_e2e_template`: version/schedule ACTIVE, 12 plan COMPLETED, 6 demand MANAGERAPPROVED, 350 line và 6 approval history; `ipc_lane1` count nguồn không đổi. |
| `.artifacts/shipyard-live/pa2b-operational-weekly-menu-20260730/database-rollback.json` | `DAD543A9411E3EF518E144DDB46701B54E7E4350AD6000993D8F5C38B74C9743` | Rollback evidence: clone lại 61 bảng từ `ipc_lane1` sang disposable template và kiểm các row count nguồn/đích khớp. |
| `.artifacts/shipyard-live/pa2b-operational-weekly-menu-20260730.zip` | `693AA2BDB237A0007A0B4ABE5C4045147FEA40963044DB031DABC4B5DE02157E` | Archive preflight/sanitize/E2E/DB/rollback cùng sáu screenshot trạng thái chính; không gồm screenshot attempt lỗi. |
| `.artifacts/shipyard-live/pa2b-pc-weekly-menu-20260730/pa2b-pc-weekly-menu-fixture.json` | `06FC2F9B9710422AB1962F2AB7AE4CB92641959DF5B42EB235C65EFCBFB9396A` | PA-2B registry + PC fixture read-only cho 11 `WeeklyMenuLifecycle` scenario, 3 actor và năm viewport; chỉ chứng minh FE rendering/interception, không phải backend/DB E2E. |
| `.artifacts/shipyard-live/pa2b-pc-weekly-menu-20260730.zip` | `9247246BFA3E8A62010CD0AA3E80C9F0619865BD3963AF97FFC2FA706331577C` | Archive JSON + 115 screenshot của PA-2B/PC rerun sau khi gỡ panel và chỉnh hai gate. |
| `.artifacts/shipyard-live/p3-p4-pc-weekly-menu-20260730/p4-weekly-menu-capture.json` | `B7E8BE033EBAA70E2010AEBA0E32B13063426DE53AAB1C5D1D26333EE97970E2` | P4 interaction/API/performance capture cho `WeeklyMenuLifecycle` trên năm viewport hiện hành. |
| `.artifacts/shipyard-live/p3-p4-pc-weekly-menu-20260730.zip` | `77BEB3738A3D980C13E65B1581F0228BBD725C124CA7849D4A3BD963156ECBCC` | Archive JSON + 15 screenshot của P3→P4→PC; chỉ dùng cho đúng scope một object và actor admin. |
| `docs/AGENT-BRIEF-ASSESSMENT-2026-07-30.md` | `D91535134D31A42852F979DE5CE12C76293AC29D7B8ABB9C8B9696DD28A80F7F` | Phản chứng brief, baseline UI oracle và audit skill trên source/lane hiện hành. |
| `.artifacts/shipyard-live/goal-runtime-20260729-round2/browser-grain-audit/headed-grain-audit.json` | `7852D18CD38474CED42BAA85F994D89D4D11ECF50F029975FCFB25F4A7D077E6` | Grain ngày/tuần, stock snapshot, movement và checklist Bếp. |
| `.artifacts/shipyard-live/phase-18-guardrails-20260729/browser/phase18-headed-audit.json` | `E4032FCF00B2F9DE087007DBEA70680FC2113C8E9414007DE04E710F4025817B` | Weekly E2E, reload render và visual gate. |
| `.artifacts/shipyard-live/phase-17-frontend-ownership-20260729/phase17-headed-audit.json` | `B5CB0AB87821BD32F173FFB1E87364BCDC9B694D1AB0E18F228927A80930AA13` | Frontend ownership, route/tab interaction và warm revisit. |
| `.artifacts/shipyard-live/goal-runtime-20260729/all-tabs/headed-all-tabs-audit.json` | `D748D0AD84EA146720F9B73919B9379D420E8C17D3476A0C7612F1412B37DE0E` | SAP Fiori tab/layout/accessibility sweep. |
| `.artifacts/shipyard-live/goal-runtime-20260729/import-e2e-summary.json` | `FAF0BDE7A21E796FFD5832F1843D65BF001EA025555143A1A23C54F08A85857F` | Import cùng tuần cho nhiều customer/tier. |
| `.artifacts/shipyard-live/goal-runtime-20260729/menu-lifecycle-finalization.json` | `656B50B01726054720CD9235D86FA34B82659982B42E5CCCAE7A60D905E126C6` | Finalization version/schedule và audit transition. |
| `.artifacts/shipyard-live/goal-runtime-20260729/browser/headed-weekly-customer-lifecycle-audit.json` | `890C5CDC95709CC48A6205A53A7FCCF13145EAA7BC67ABA7562E4FE3495DF935` | FE reload của lifecycle theo customer/week. |
| `.artifacts/shipyard-live/goal-runtime-20260729/import-isolation.json` | `AD7FD5C67F6A94270FF6F947E59375FF77E2B40FB0814AD44C77BDF8A4AAED34` | Isolation customer/tier của import đã commit. |
| `.artifacts/shipyard-live/goal-runtime-20260729/tier-preview-matrix-repeat.json` | `9FB52478D7F7C8817A3E6236809E7D65922AC8FE549921DD8E7537B86A007255` | Preview lặp theo tier và sheet selection. |
| `.artifacts/shipyard-live/goal-runtime-20260729/workbook-case-manifest.json` | `EF61E46B9665C14C2F79ECC7DB9B8892DA0C19A88A80CD42A76A7612BE2A9F27` | Manifest cho workbook-authoring còn mở; không tự nó chứng minh E2E pass. |
| `.artifacts/shipyard-live/phase-18-guardrails-20260729/preflight.json` | `27A0BD5428F8D1E0D5200508C1F3D8D4D5BB4B5A87474453DB5D0CFDAD49EE1B` | Preflight lane, migration và guard trước mutation. |
| `.artifacts/shipyard-live/phase-18-guardrails-20260729/import-transition.json` | `5C7538E78A961F285B6CB3559CCB2954CA02D29C0BB56199388F975D7AF34F6D` | DB transition của weekly import. |
| `.artifacts/shipyard-live/phase-18-guardrails-20260729/supplemental-kitchen-confirm.json` | `B94054EEBDA1038706C9936CB445671AEB544D99F2AD5DFD7D5303FB6B133957` | Terminal confirmation của supplemental lifecycle. |

## Historical

| Artifact | SHA-256 | Mục đích |
|---|---|---|
| `.artifacts/shipyard-live/production-report-debug.json` | `3813B9CADD4BA76759A3D5FECDEBDD9454FE2A157C07E6677A97C2B6B0B5D323` | Điều tra production report sau restore. |
| `.artifacts/shipyard-live/current-runtime-desktop-2026-07-27/current-runtime-desktop-audit.json` | `975EEAC84626AA7B9CDEC559621728BEE83FD3BC5954021B7766004D8425C9EA` | Desktop audit trước ma trận viewport hiện hành. |
| `.artifacts/shipyard-live/current-runtime-desktop-2026-07-27/warehouse-desktop-cls-probe.json` | `5B7AD31365FC31B4BBA13AA977392220D555BC58696899A7E684BD8681027A97` | Probe CLS cold/warm cũ. |
| `.artifacts/shipyard-live/sidebar-navigation-performance-2026-07-25.json` | `4A3B0892066CCD51DF5FEA006C0E1348AA6F1E7D3CA95D3A1C8463DFD6A89096` | Baseline điều hướng sidebar. |
| `.artifacts/shipyard-live/live-visual-performance.json` | `C525292F627593105648E93944D48593B110A8D10708825B7543B99C2D056B22` | Performance visual lịch sử. |
| `.artifacts/shipyard-live/live-visual-performance-before-admin-dialog-fix.json` | `8A7FC57FADA9BB0277A75C8C6D0E55D3710543A87F81D8A2418852E137904383` | Baseline trước khi sửa dialog Admin. |
| `.artifacts/shipyard-live/production-bom-debug.json` | `1770D555A92B43DDC39A97F5E13AA7ADC762FD9C5B4887399980E0D03DDB8A4C` | Điều tra BOM trên production snapshot. |
| `.artifacts/p19-error-matrix/p19-matrix-results.json` | `6BF2E19B9CCD3DC9B660402CD02BFCBA804C3F16108307DAD796A45EF4B4C797` | Ma trận error/permission P1.9. |
| `.artifacts/shipyard-live/query-view-pilot-performance.json` | `E92D4FD594C0DDAFE3FECB12552C876E3A2B63E3E084C1B459F04B5C63E1F3C7` | Pilot QueryView Material Demand/Warehouse. |
| `.artifacts/shipyard-live/query-view-purchasing-performance.json` | `58919E39B18DF643385DB7AA1C7CA306064F20C31851F469E012D2DD5E85B742` | QueryView rollout Thu mua. |
| `.artifacts/shipyard-live/query-view-approvals-performance.json` | `7C603BAB4F8407430A62A2892535AFFB8F3C91EF322C36EE69AFD8F7FEAC9CC2` | QueryView rollout Duyệt. |
| `.artifacts/shipyard-live/query-view-reports-performance.json` | `C8B122DFD9ACCF1E38EEC062A8E90F4FCAD386C1E03F707E3CE0ADD00D78F3CD` | QueryView rollout Báo cáo. |
| `.artifacts/shipyard-live/query-view-admin-performance.json` | `976B1B561CEBA53703756271B81FE6DFC8DE340C61CFC274114FB0825A5C8C5E` | QueryView rollout Admin. |
| `.artifacts/shipyard-live/query-view-chef-performance.json` | `915306C9ECDC5C58A77BBE98BE0AFB207B7914A1B689D49DF0109785247BDBD2` | QueryView rollout Bếp. |
| `.artifacts/shipyard-live/query-view-coordination-performance.json` | `26CFF37F7DBB6450477E296C26EBACD5ABF0902C3B6350D3C838D30D525664D4` | QueryView rollout Điều phối. |
| `.artifacts/shipyard-live/tab-performance-controlled-lazy-2026-07-25.json` | `6908D1E62B0871281235FDD32C30D3E5A245AE34B1F946FECC6835F4BF8783A9` | Lazy tab/navigation baseline. |
| Phase 18 tracked OpenAPI | `DF09371F71C7CF9A524CD58C6C89A4443870DA6743ACC3E5F85C95E9FB7BB9E5` | Digest contract tại closeout Phase 18; không phải digest current tree. |
| Phase 18 generated schema | `E1FF2980B16D62EA3375AE30C3C8DF682C2DC18BE26A09778036B48EAD74EFA1` | Digest generated contract tại closeout Phase 18. |
| `D:\Backups\ipc-phase18-20260729\ipc_lane1-20260729-173035.zip` và mirror | `027985D01119E8CCB6D64EB156D4200756CCED3B0C8070EC2FE054A32E04FF13` | Rollback checkpoint lịch sử; off-site vật lý chưa được chứng minh. |
| Phase 18 protected dataset fingerprint | `EA62337AE966B980D19746E1741C4A223010F65E42F5E748D24BBCDAF03CF17B` | Fingerprint trước mutation cho lineage guard. |

## Attempt cũ, không authoritative

| Artifact | SHA-256 | Lý do loại |
|---|---|---|
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/phase25-headed-current-source-error.json` | `5DD7189E1C844A1275616417338002E746E9913F9056ED6C3FB8AE4F1BB1C144` | Attempt locator timeout lúc 04:07; run final cùng thư mục lúc 04:10 mới authoritative. |
| `.artifacts/shipyard-live/phase25-p8-pf-20260802/phase25-headed-current-source-error.png` | `A51DFB76E74A069BB68984A68CD7C9A9BBB0E746D9AC34CF6905620339CDC9EE` | Screenshot của attempt locator timeout, không dùng làm gate. |
| `.artifacts/shipyard-live/goal-runtime-20260729-round2/browser-grain-audit/headed-grain-audit-error.png` | `34D9C360D8B17B20FDF78437D0A6BF9F78FF02259F9027E07971EE0C95ADA92A` | Ảnh lỗi của attempt trước final run. |
| `.artifacts/shipyard-live/phase-17-frontend-ownership-20260729/phase17-headed-audit-error.json` | `7E15E9833E905AFF34DCAF19742CE53F55C16797A8E5A7D53B9FDE18B32F81E2` | Locator attempt cũ; file final cùng thư mục mới authoritative. |

## Quy tắc cập nhật

- Tính SHA-256 từ file trên disk sau khi run đã kết thúc; không copy hash từ log trung gian.
- Mỗi artifact chỉ có một trạng thái. Khi thay thế gate, hạ dòng cũ xuống `Historical`; không sửa hash cũ.
- File tên `error` hoặc `fatal` mặc định là `Attempt` trừ khi có ghi chú điều tra rõ ràng.
- Kết luận gate hiện hành nằm trong `MEMORY.md`; file này chỉ định danh evidence, không lặp lại số đo.
