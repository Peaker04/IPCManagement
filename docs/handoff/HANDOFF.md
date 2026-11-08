# Bàn giao: MRX — bố cục chuẩn bị phối hợp và căn phải cụm nút

## Đọc trước
- Handoff ID: `2026-11-05-2009-mrx-preparation-layout`.
- Thời điểm snapshot: `2026-11-05 20:09 +07:00`.
- Phiên giao: Pi native; không có định danh session đã kiểm tra.
- Mục tiêu: bảo toàn hai thay đổi UI nhỏ đã được duyệt, không biến thành redesign toàn MRX.
- Chế độ hiện tại: **HANDOFF ONLY / READ & VERIFY**. Không còn implementation đang chờ trong scope đã duyệt.
- Điểm dừng: code đã lưu; kiểm tra Kho/lint/build hoàn tất; `.planning/WORK.md` đang IDLE. Không commit/stage/push.
- Việc đầu tiên: đọc AGENTS + WORK, đối chiếu git snapshot, xác nhận lại giới hạn bằng chứng trước khi nhận yêu cầu mới. **Không tự chạy harness/mutation theo bàn giao cũ.**
- Blocker: chưa có nghiệm thu trên luồng đăng nhập thật/dữ liệu thật. Không có blocker cho việc đọc/tiếp nhận.
- **Đã chốt:** (1) chỉ căn phải nhóm nút đối soát/BOM; (2) chỉnh riêng `/warehouse?view=mrx-preparation` theo phác thảo gọn được user “Duyệt”.
- **Chưa duyệt:** phương án B tái tổ chức toàn MRX và các màn Kho ngày/Bếp/nguồn tuần. User đã nói phạm vi đó quá lớn.
- **Giới hạn quan trọng:** browser8case kiểm tra bundle `index-CO4lC9It.js`; final code thêm guard ẩn vùng chọn khi lỗi, build `index-BcEjC1Ww.js`, đã chạy lại40tests/lint/build nhưng **chưa chụp lại final bundle này**. Không gọi8ảnh là nghiệm thu exact-final-bundle.
- Bàn giao cũ được lưu nguyên byte tại `docs/handoff/archive/2026-11-05-2009-preparation-layout-previous.md`. Nó mô tả trạng thái2026-10-29, chứa khẳng định rộng đã cũ; không dùng để suy ra quyền commit/mutation hay release readiness hiện tại.

## 1. Yêu cầu, quyền hạn và phạm vi
- User yêu cầu `/impeccable` đánh giá cụm nút toàn MRX, sau đó thu hẹp: “chỉ chuyển các cụm như này sang phải trước”. Ảnh: `D:/Temp/pi-clipboard-a56ddbad-57a3-40e5-98b3-82f8ca0c2478.png`.
- Sau đó user chỉ rõ `/warehouse?view=mrx-preparation` có giao diện xấu. Phương án chỉ màn này được duyệt: header giữ xác nhận; chọn khách/lô gọn và có giới hạn chiều cao; supplier cạnh Excel; tìm kiếm sát bảng; giữ bảng/số liệu/logic.
- Tiêu chí scope: không đổi màu/nhãn/thứ tự/logic khi căn phải; với preparation không đổi API, batch selection authority, precision, issue payload, export scope, điều kiện pending/unknown-result và DEFAULT/MRX isolation.
- Được làm lúc triển khai: sửa tại các owner FE hiện hữu, kiểm tra cục bộ. Hiện user chỉ yêu cầu giao: chỉ đọc và tài liệu.
- Cấm: reset/restore/clean/stash, stage/commit/push, deploy, install, tự dùng subagent, DB/schema/data mutation, thay tiến trình đang chiếm cổng, dùng browser profile/token/credentials của user. Không xóa draft/localStorage để chữa lỗi UI.
- Chỉ user được mở rộng scope. “Duyệt” trước đây cho điều tra lineage là read-only, không cho backfill/unlock/reimport.
- `.planning/WORK.md` vẫn là **owner duy nhất của live task-state**; HANDOFF là snapshot bàn giao, không thay thế WORK.

## 2. Snapshot

| Trường | Giá trị đã xác minh |
|---|---|
| Repo | `D:/ki7/PRN222 Doanh Nghiệp/IPCManagement` |
| Branch | `feature/ui-interaction-data-states`, ahead3 so với origin tracking |
| HEAD | `b2adf6ef05cf9ddf8227d7786965efbba6801521` |
| Trước khi ghi bàn giao | 0 staged,176 unstaged modified,58 untracked entries; tổng234. Đây là toàn dirtytree kế thừa + phiên này, KHÔNG phải234file do scope mới sửa |
| Sau tài liệu bàn giao | Đã đếm lại:0 staged,177 unstaged modified,59 untracked entries. HANDOFF cũ thành modified, thêm archive; agent nhận vẫn phải đối chiếu lại |
| Chi tiết git | `D:/Temp/ipc-handoff-preparation-git-status.log`, `ipc-handoff-preparation-git-log.log`, `ipc-handoff-preparation-diff-stat.log`, `ipc-handoff-preparation-cached-stat.log` |
| Commit gần nhất | b2adf6ef fix MRX recovery/report gaps; aed0bdd3 harden integrity/evidence; fdb84c2c actual Chrome zoom;537d610b source workflow;f86d146b per-day source edit locks |
| Final build trên disk | `frontend/dist/assets/index-BcEjC1Ww.js`,875.35kB/gzip247.38; CSS `index-DCrb-Q3s.css`,66.11kB. Vite8.0.16; warning JSchunk>500kB còn |
| Browser evidence build | `assets/index-CO4lC9It.js` trước guard lỗi cuối; API fixture, không live business acceptance |
| Runtime kiểm tra lúc giao | Node `v24.13.0`; listener5173 `127.0.0.1` PID23104; listener5262 `127.0.0.1`/`::1` PID26300. Không có listener8400. HTTP health/build đang được serve: NOT_RUN/UNKNOWN |
| Tiến trình phiên này | Chrome riêng của probes đã đóng trong finally; server overlay thử trước đó đã stop. Không dừng FE/BE đang chạy; không còn lệnh build/test đang chờ |
| Dữ liệu/migration | Scope mới không truy cập hay mutate DB, không migration. Fixture HTTP nội bộ, test-only actor không có authority thật |
| Công cụ/skill | Pi native; read/edit/write/bash; installed Playwright qua node_modules, dedicated headed Chrome; Impeccable bundled Windows exe. Không dùng MCP hay subagent trong scope này |

### Attribution thay đổi
**Cụ thể do các yêu cầu mới trong phiên:**
1. `frontend/src/features/reconciliation/ReconciliationLinesFilterToolbar.tsx`: `ml-auto` + `justify-end` cho cụm filter/bulk.
2. `frontend/src/features/admin/branches/AdminBomBranch.tsx`: wrapper căn phải cho cụm filter + import/refresh hiện hữu.
3. `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`: bỏ telemetry lặp; chuyển callback Excel nguyên logic xuống branch; truyền state-boundary props và count.
4. `frontend/src/features/warehouse/branches/MrxPrepHeaderBranch.tsx`: header chỉ date + primary confirm, bỏ export-only props/button.
5. `frontend/src/features/warehouse/branches/MrxPrepAllocationsBranch.tsx`: vùng chọn grid1/2/3cột,max128px cuộn; count; supplier+Excel; StateBoundary cho dataarea; không hiện selection metadata nếu boundary.error.
6. `.planning/WORK.md`, plan `docs/superpowers/plans/2026-11-05-mrx-preparation-layout.md`, tài liệu bàn giao này và probe/log ngoài repo.

Các file trên đã có inherited edits trước scope; **không lấy toàn git diff của chúng làm task-only diff**. Toàn bộ phần khác trong dirtytree là inherited/UNKNOWN attribution, giữ nguyên.

## 3. Tiến độ
| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| UI-ALIGN | Căn phải nhóm đối soát/BOM, giữ tìm kiếm trái | DONE_VERIFIED | `D:/Temp/ipc-mrx-align-browser.json`;4captures1366/1024, lint/build tại WORK | Live authenticated acceptance |
| PREP-CODE | Recompose3owner preparation | DONE_VERIFIED | Source hiện tại;40Warehouse tests, lint/build/diffcheck | Không có code còn dở |
| PREP-RENDER | Ít/nhiều khách hàng,rỗng,lỗi×1366/1024 | DONE_VERIFIED | `D:/Temp/ipc-preparation-layout-browser-confirm.json`,8case PASS,writes0/unknown0/pageerror0 | Bundle trước guard cuối; chỉ fixtures |
| PREP-FINAL-BROWSER | Browser exact-final-bundle sau errorguard | TODO | Final asset BcEjC1Ww tồn tại, chưa có screenshot matching | Chỉ làm nếu scope kế tiếp cần; không rerun cho handoff |
| GLOBAL-REDESIGN | Đề xuất tái tổ chức toàn MRX | TODO | Proposal trong WORK, chưa được duyệt | User đã yêu cầu thu hẹp; không tự bắt đầu |
| LIVE-QUAL | Luồng thật, role×state, scale/performance | BLOCKED | Các giới hạn trong WORK | Cần scope/credential source/target rõ trước thao tác thật |
| LEGACY-CHEF | Lô hoàn tất thiếu frozen daily/cooking | BLOCKED | `D:/Temp/ipc-chef-lineage-confirm.log`; WORK | Không có quyền/tài liệu lịch sử để khôi phục |

## 4. Quyết định và giả thuyết
| ID | Nội dung | Loại | Bằng chứng | Người xác nhận |
|---|---|---|---|---|
| D1 | Không redesign toàn MRX | đã chốt | User nói phạm vi quá lớn | User |
| D2 | Chỉ sửa preparation sau bước căn phải | đã chốt | Phác thảo route-only + “Duyệt” | User |
| D3 | Giữ export visible-disabled khi empty/error | đã chốt | Existing date/Back regression bắt lỗi khi nút bị mất; test giữ nguyên | Existing contract + implementation |
| D4 | Supplier chỉ đổi Excel; local find chỉ đổi bảng | đã chốt | Existing export-scope regression vẫn PASS | Existing contract |
| D5 | Browser fixtures không chứng nhận auth/DB/NFR | đã chốt | Probe intercept toàn API, writes0 | Evidence boundary |
| D6 | Table allocationcell có nhiều tên dài vẫn cao | đã chốt | Many-client screenshots; bảng được giữ nguyên theo scope | Source/render evidence, không coi là đã sửa density toàn bảng |
| D7 | Guard cuối không làm thay đổi screenshot trong8fixture đã chụp | giả thuyết | Fixture error không có retaineddata; chưa chụp lại finalbundle | Chưa browser-confirm exactfinal |

## 5. Đã thử nhưng không thành công
| Thử | Kết quả | Bằng chứng | Trước thử lại |
|---|---|---|---|
| Đưa Excel vào branch còn nằm trong StateBoundary cũ | FAIL: mất disabled export button khi ngày rỗng/Back | `D:/Temp/ipc-preparation-layout-unit.log` (39PASS/1FAIL) | Đã chuyển data boundary, giữ nguyên test;40PASS sau sửa |
| Uncheck danh sách locator.all theo nth trong probe | FAIL: timeout khi checked set co lại | `D:/Temp/ipc-preparation-layout-browser.json` và `.log` | Đã sửa uncheck currentfirstchecked; không phải lỗi ứng dụng |
| Overlay trong critique toàn MRX trước đó | FAIL: tool deadline80s, không usable overlay | WORK section action-cluster review | Server đã stop; không dùng overlay để chứng minh PASS |
| Runtime Vite empty named export trước đây | Source đúng nhưng served transform rỗng; targeted byte-identical invalidation phục hồi | WORK section Vite missing daily-header export | Nguyên nhân writer/watcher race UNKNOWN; không đổi import đúng hoặc restart mù |

## 6. Kiểm thử
- Không ở workflow7tầng TEST FIRST/3lượt. Đây là scope layout FE; dùng existing behavior-owner tests và bounded browser checks.
- Plan: `docs/superpowers/plans/2026-11-05-mrx-preparation-layout.md`.
- Không thêm/sửa test trong scope mới; không mock component dưới test; không hạ assertions.
- Log files dưới `D:/Temp/` chỉ có ở máy này, không đảm bảo đi theo clone repo.

| Case | Lệnh / bước | Lượt | Kết quả | Bằng chứng |
|---|---|---:|---|---|
| Baseline7prep/coordinated | `cd frontend; npx --no-install vitest run src/__tests__/Warehouse.test.tsx -t 'preparation\|coordinated'` |1|PASS;33case bị CLI lọc, không skip annotation|`ipc-preparation-layout-baseline.log`|
| Warehouse toàn file | `cd frontend; npx --no-install vitest run src/__tests__/Warehouse.test.tsx` |4|FAIL(39/40),PASS40,PASS40,PASS40|`ipc-preparation-layout-unit.log`, `-unit-confirm.log`, `-unit-final.log`, `-unit-close.log`|
| Lint3owners | installed ESLint3file preparation |3successful pipeline runs|PASS|`ipc-preparation-layout-lint.log`, `-lint-final.log`, `-lint-close.log`|
| Build | `cd frontend; npm run build` |3successful pipeline runs|PASS;existing chunk warning|`ipc-preparation-layout-build.log`, `-build-final.log`, `-build-close.log`|
| Browser8cases | `node D:/Temp/ipc-preparation-layout-browser.cjs` |2attempts|FAIL harness;PASS8cases|initial `.json/.log` và `ipc-preparation-layout-browser-confirm.json/.log`|
| Detector layout | nativeexe `detect --json --scope layout frontend/src/features/warehouse` |3|PASS findings[]|`ipc-preparation-layout-detect-before.json`, `-detect-final.json`, `-detect-close.json`|
| Scoped whitespace | `git diff --check -- <3owners> .planning/WORK.md` |close1|PASS;CRLF warnings không phải lỗi|`ipc-preparation-layout-diffcheck-close.log`|
| Browser/SQL/end-to-end thật | Không chạy |0|NOT_RUN|Không có quyền suy ra từ fixture |
| Missing named contract files | `operationalPageContracts.test.ts` / `*.contract.test.tsx` |0|NOT_RUN|Các tên gate này không tồn tại theo kiểm tra trước, không tạo fakePASS |

**Các ảnh đã kiểm tra tồn tại:**
- `D:/Temp/ipc-preparation-layout-browser-confirm-preparation-1366.png`
- `D:/Temp/ipc-preparation-layout-browser-confirm-preparation-1024.png`
- `D:/Temp/ipc-preparation-layout-browser-confirm-preparation-many-1024.png`
- `D:/Temp/ipc-preparation-layout-browser-confirm-preparation-empty-1024.png`
- `D:/Temp/ipc-preparation-layout-browser-confirm-preparation-error-1024.png`
- Mẫu ít khách hàng: table top272→236px ở1366 và339→303px ở1024,36px gain. Đây là so sánh fixture, không NFR toàn sản phẩm.

## 7. Nguồn cần đọc
| Thứ tự | Nguồn | Lý do | Truy cập |
|---|---|---|---|
|1|`AGENTS.md`, `.planning/WORK.md`|Governance và live-state; sections preparation-layout, right-alignment, globalproposal|đã kiểm tra|
|2|Plan tại mục6|Thiết kế user đã duyệt; checkbox trong plan không thay live-state WORK|đã kiểm tra|
|3|3owner preparation tại mục2|Hiện trạng code và request/guard ownership|đã kiểm tra|
|4|`frontend/src/__tests__/Warehouse.test.tsx`|40tests incl selectedexport/supplier/date/pending/unknown|đã kiểm tra|
|5|Log unit-close/build-close và browser-confirm|Phân biệt finalcode vs evidencebuild|đã kiểm tra|
|6|`docs/DESIGN.md`, `docs/UI-KIT.md`|Token authority,compactdensity,1primary,frozenheader/sidebar|đã kiểm tra|
|7|`.pi/skills/ipc-ui-review/SKILL.md`, `.pi/skills/ipc-code-review/SKILL.md`, `.pi/skills/ipc-test-audit/SKILL.md`|Applicable gates; test-audit trước mọi test edits|đã kiểm tra trong phiên|
|8|`C:/Users/Administrator/.pi/agent/skills/impeccable/SKILL.md` và `reference/layout.md`|Operate/layout, bounded scans, không redesign tự phát|đã kiểm tra trong phiên|
|9|Archive bàn giao cũ|Lịch sử, không quyền hiện tại|đã kiểm tra SHA256 bằng bản cũ trước overwrite|

## 8. Bước tiếp theo
| Ưu tiên | Việc | Điều kiện | Tiêu chí hoàn thành |
|---|---|---|---|
|1|READ & VERIFY git/WORK/HANDOFF|Nhận phiên|Báo5ý A–E, nêu sai lệch nếu có; không reset/đổi branch|
|2|Chờ nhận xét user về preparation mới|User mở lại màn/đưa ảnh|Bám đúng vấn đề mới, không tự mở broadproposal|
|3|Nếu cần exactfinalbrowser/live acceptance|Có scope và credential source rõ; riêng Chrome profile|Nêu build/actor/mode/dataset, kiểm tra đúng trạng thái; không ghi dữ liệu nếu chưa cho phép|
|4|Nếu user muốn sửa allocationcell nhiều khách|Phải duyệt riêng hướng compact/detail mà không mất số liệu|Đủ names/quantities/units, giữ authority; không tự thêm popover/cacheengine|

## 9. Chưa biết và xung đột
- UNKNOWN: FE/BE listener có healthy, build nào thực sự được user xem, authactor/token của user. PID listener không chứng minh sức khỏe.
- UNKNOWN: toàn bộ176modified/58untracked thuộc tác vụ/agent nào; chỉ attribution5owner mới được mô tả ở mục2.
- Finalerrorguard chưa exact-final-bundle browser capture; không suy ra liveacceptance từ40tests.
- Mobile/actualzoom/keyboardcontrast toàn diện, role×sixstate và productionperformance chưa qualified; tên dài/nhiều allocation vẫn có bảng cao/scrollngang.
- Bản HANDOFF cũ nói release-ready/DBclean là lịch sử chưa tái xác minh và không phải quyền vận hành hiện tại.
- Lineage lịch sử giữ nguyên: batch `555303fa-f909-464a-b81d-636af969d405` trước đây read-only xác nhận COMPLETEDv5/67weekly/0daily/350legacycontributors; Chef409 `LEGACY_DAILY_LINEAGE_MISSING` expected. Không reconstruct bằng BOM hiện tại; không mutation/backfill đã được duyệt. Bằng chứng này không được refresh trong lượt giao.
- ALL date leak đã được xử lý trước đó tại calendar/session owners; local ALL là readonly view, không truyền thành serviceDate/weekStartDate. Không nới backend validation.
- Auth401 thật/lineage409 thật không phải vấn đề toolbar. Giữ token/session guards, drafts và frozen facts.
- Các qualification gaps cũ R6/43refs, Golden browserPASS/runnerFAIL, Task8 NOT_ACCEPTED, native200% WAIVED_BY_OWNER vẫn nằm trong WORK; không nâng thành toàn-MRX PASS.

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại D:\ki7\PRN222 Doanh Nghiệp\IPCManagement\docs\handoff\HANDOFF.md.
Bắt đầu READ & VERIFY: chưa sửa sản phẩm, chưa chạy tác vụ có tác động.
Đọc AGENTS.md và project instructions, .planning/WORK.md, rồi HANDOFF.md;
đối chiếu git status/log/diffstat/cachedstat và môi trường theo mục2.
Trả lời A.mục tiêu B.quyền hạn/điều cấm C.đã/chưa kiểm chứng
D.thiếu/mâu thuẫn E.việc đầu tiên/tiêu chí hoàn thành.
Scope trước đã đóng: căn phải nhóm đối soát/BOM, compact riêng warehouse?view=mrx-preparation.
Không có approval redesign toàn MRX, không có code tiếp theo đang chờ tự thực thi.
Final40Warehousetests/lint/build PASS; browser8fixtures thuộc bundle trước errorguard cuối,
không gọi là exact-final-bundle/liveauthenticated acceptance.
Giữ dirtytree, không reset/clean/stash/stage/commit/push/install/delegation/DBmutation,
không thay FE/BE đang chạy; không làm theo quyền/harness từ archive bàn giao cũ.
Việc đầu tiên là xác nhận trạng thái thật rồi chờ chỉ đạo tiếp theo của user.
```
