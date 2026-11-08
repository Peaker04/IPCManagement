# MRX Single-Clone Audit/Repair — Implementation Work Package trong plan tổng

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, native sequential execution trong workspace hiện tại. Steps use checkbox syntax. Không subagent/worktree/install/stage/commit/push/deploy; project/Owner restrictions override generic skill recipes. WORK là chủ sở hữu tiến độ duy nhất.

**Goal:** Hoàn tất các nghĩa vụ MRX LC-01..LC-12 và sửa lỗi BE/FE/admin liên quan của plan tổng, giảm setup/chạy lặp bằng một clone xuyên suốt; không mở một hướng kiểm thử khác.

**Architecture:** Mở rộng runner/safety helpers và các G1–G6 owners hiện có, tách resource identity của campaign khỏi attempt/case identity. Kiểm kê hữu hạn → sửa production owner → kiểm tra liên quan → nghiệm thu candidate cuối. Giữ clone khi bàn giao về plan cha, cleanup chỉ tại Task8/đóng plan tổng hoặc Owner hủy.

**Tech Stack:** PowerShell/.NET9/EF/MySQL, React/TypeScript, Vitest, headed Playwright và thư viện/tool đã cài. Không dependency/framework mới.

**Spec:** [Thiết kế đã duyệt](../specs/2026-11-03-mrx-single-clone-audit-repair-design.md).

**Parent:** [MRX Five-User Production Qualification](2026-11-02-mrx-five-user-production-qualification.md) → [Lifecycle Scope Lock](2026-11-03-mrx-lifecycle-scope-lock.md) → work package này. Owner đã duyệt thiết kế và yêu cầu không rẽ khỏi plan tổng. Plan triển khai chờ review trước thực thi; phương thức native đã chốt, không hỏi lại về delegation.

## 1. Ràng buộc và vị trí trong plan tổng

- Không reset/restart các task đã có bằng chứng; nhập bằng chứng lịch sử vào bảng tra, không đổi chúng thành final-candidate PASS. Main/cutover89→91 đã hoàn tất, **không thực hiện lại**.
- R1–R2 dưới đây điều chỉnh cơ chế thực thi của parent Task1–2/scope-lock Task6; R3–R4 thực hiện phần sửa sản phẩm của parent Task3/7; R5 hoàn tất scope-lock Task2–5/parent Task4; R6 quay về scope-lock GateC. Không thay mục tiêu hay bộ LC.
- Parent Task5/6 về desktop/memory/endurance/HTTP vẫn còn nguyên nghĩa vụ nhưng chưa được admitted. Không chạy G7/G8/k6/nativezoom dài hạn để thay việc đóng lỗi MRX; điều tra lag ngắn phục vụ sửa FE không phải chứng nhận percentile/tải.
- Một DB `ipc_mrx_evidence_<campaignId>` cho plan tổng; Start cần absent, Run cần exact existing owned target. Không DB `_integration`, không restore/reset per attempt. Main `ipcmanagement` chỉ đọc; không DEFAULT mode switch, không SQL business mutation thay FE.
- Giữ actor/quyền/DOM-MODE-1, Chef read/export only, six-decimal, BOM-once và append-only lineage/history. Prerequisite fixture chỉ trong scope đã duyệt, không stock/receipt seed hay factory mới.
- Giữ limits/login pacing/security hiện có. Functional global900000ms không tự tăng/nhân lên nhiều nhóm để che fail. Inventory sẽ chốt selection và tổng ngân sách trước final run.
- Một root evidence cho campaign; soft2GiB/hard4GiB cho artifact/private working files mới, DB/cache build báo riêng. Không xóa artifact cũ/backups/cache chung theo plan này.
- No test-only production seam, success mocks, exemption padding, lowered assertions hoặc tạo export chỉ cho test. Sửa tests theo test-audit; `.tsx/.css` có scoped UI gate, primitives/tokens chuẩn và review thực tế.
- `Finish` chỉ ở parent Task8 sau required parent gates; cuối R6 giữ DB với `RETAINED_AUTHORIZED`. Không báo cleanupCompleted=true cho DB còn được giữ. Abort cần lệnh Owner rõ; test FAIL không thành lệnh hủy.

## 2. Review Focus — giao cho đúng task

1. RunId được dùng vừa cho DB guard vừa cho mã khách: Run lần2 có thể409 dù tuần mới; R2 kiểm tra hai attempt cùng campaign, không nới database guard.
2. Crash/timeout/receipt sai có thể làm finally drop DB hoặc khởi tạo lại: R1 chứng minh retained-on-failure và từ chối ownership mismatch trước SQL/process mutation.
3. Build cache bỏ sót config/assets/generated inputs có thể phục vụ build cũ: R2 kiểm tra input graph + served hashes, không chỉ timestamp hoặc HEAD.
4. Tắt video ở config nhưng fixture vẫn ghi năm role videos; hoặc storage prune xóa RED đang viện dẫn: R2 kiểm tra cả browser context options và retention references.
5. GateC bị nhầm là đóng plan tổng, hoặc DEFAULT integration được trỏ vào clone MRX: R1/R6 từ chối Finish thiếu parent final packet và không chạy DEFAULT suite trên campaign.

## 3. File/contract map và CLI được chọn

Không tạo framework/helper module mới: `MrxEvidenceSafety.ps1` hiện189 dòng chứa validation/persistence/lock/DPAPI/storage helpers; orchestration nằm trong runner hiện có. Nếu owner vượt architecture budget, checkpoint một split trách nhiệm thật, không tăng baseline/exemption để qua gate.

| Owner | Thay đổi dự kiến |
|---|---|
| `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` | Campaign modes; resource/attempt lifecycle; build reuse; source/gate receipts; legacy giữ nguyên. |
| `scripts/mrx-evidence/MrxEvidenceSafety.ps1` | Campaign path/receipt/lock/DPAPI/storage contracts; giữ exact target guards và lifecycle selector. |
| `backend/tests/IPCManagement.Api.Tests/MrxDisposableEvidenceContractTests.cs` | Behavioral lifecycle/ownership/retention proof bằng actual PS functions và I/O boundary stubs; giữ pipe-drain regression. |
| `frontend/tests/e2e-mrx/core/{globalSetup.ts,globalTeardown.ts,dbGuardrail.ts,ownedProcesses.ts}` + existing `core/__tests__/*` | Prepared campaign/attempt admission; owned process shutdown không drop retained DB; Release identity. |
| `frontend/tests/e2e-mrx/fixtures/{mrxWorkflow.ts,mrxTest.ts}`; config; existing fixture/helper tests | Identity/scopes, context capture, evidence paths; không đổi business helper thành simulator. |
| `frontend/tests/e2e-mrx/specs/g1..g6` hiện có | Consumers của identity, existing LC owners và UI proof liên quan. Chỉ chỉnh case thực sự bị ảnh hưởng. |
| `frontend/src/api/bomApi.ts`, `components/workbench/DishBomBatchImportModal.tsx`; existing BomApi/DishBomBatchImportModal tests | Known DTO/feedback finding sau tái hiện; production sửa ở FE owner, không tạo API giả. |
| Feature/admin/shared production owners được inventory xác định | Conditional BE/FE repairs; không blanket edit toàn repo. |
| `.planning/WORK.md` | Một active summary, inventory, LC mapping, evidence links và handback về parent. |

CLI mở rộng Mode thành `Preflight|Execute|Start|Run|Finish|Abort`, thêm `[string]$CampaignId`. Start/Run/Finish/Abort yêu cầu `Profile=Qualification` và CampaignId đúng format runId hiện có; Preflight có CampaignId thì kiểm tra read-only; `Execute` legacy không nhận CampaignId. Diagnostic chỉ dùng cho Execute/Run và giữ các giá trị hiện có, không thêm diagnostic family.

- `$campaignId` sinh **một lần** theo generator runId hiện có; không dùng một slug tùy ý hay ID mới theo attempt.
- Run sinh attemptId riêng, đặt `MRX_EVIDENCE_RUN_ID=campaignId`, `MRX_EVIDENCE_ATTEMPT_ID=attemptId`, `MRX_E2E_ARTIFACT_DIRECTORY=<campaignRoot>/attempts/<attemptId>/runtime`; parent resource receipt nằm ở campaign root.
- Receipt schema1: `campaignId,database,ownerSid,serverIdentity,createdAtUtc,schemaHash,migrationIds,principalName,sourceManifestPath,encryptedCredentialsPath,prerequisiteReceiptPaths`. Không secret hay next-task/plan-progress trong JSON; WORK vẫn là state owner.
- Safety helper signatures: `Get-MrxCampaignPaths -RepoRoot -CampaignId` trả validated paths/database; `Read-MrxCampaignReceipt -Path -CampaignId -Database` trả verified receipt; `Enter-MrxCampaignLock -Path` trả FileStream/FileShare.None; `Protect-MrxCampaignCredentials -Path -Credentials` và `Unprotect-MrxCampaignCredentials -Path` dùng DPAPI CurrentUser + private ACL.
- Runner orchestration: `Initialize-MrxCampaign -CampaignId -SourceBuilder`; `Invoke-MrxCampaignAttempt -CampaignId -Diagnostic`; `Complete-MrxCampaign -CampaignId -Disposition Finish|Abort -SourceBuilder`. Theo style scoped globals hiện có, không thêm DI/config framework.
- Root Task8 cung cấp `acceptance/final-package.json` với required parent gate evidence/candidate đã xác minh; GateC chỉ có `acceptance/lifecycle.json` và không đủ để Finish. Đây là execution evidence, không một bản trạng thái plan khác.

## R1. Một clone: Start/Run/pause/Finish đúng quyền sở hữu

**Files:** runner, safety helper, MrxDisposableEvidenceContractTests; globalSetup/globalTeardown/dbGuardrail và các test owner tương ứng khi admission bị ảnh hưởng.

**Interfaces:** triển khai CLI/receipt/helper signatures tại §3. Start trả receipt đã bootstrap/readback; Run trả attempt outcome với `resourceDisposition=RETAINED_AUTHORIZED`; Finish cần parent final packet; Abort không bao giờ PASS.

- [ ] Intake git/WORK/skills; tạo bảng liên kết LC và parent tasks hiện có, không đánh dấu task cũ mất tiến độ. Đối chiếu mọi SQL/teardown caller trước thay finally.
- [ ] Extend existing safety owner với case `Campaign_start_run_failure_resume_retains_one_database`: gọi actual orchestration functions qua PS AST, stub chỉ I/O SQL/process boundary; sau Start→Run FAIL→Run kế tiếp assert create=1,dump=1,restore=1,drop=0, actor/prerequisite bootstrap=1. Không mock chính lifecycle function đang test.
- [ ] Cùng owner/table kiểm tra receipt database/server/SID/path/schema mismatch, active lock và hỏng DPAPI: SQL ghi/process start=0, không fallback Execute. Partial Start/crash không đủ ownership proof phải BLOCKED, không drop theo tên/prefix.
- [ ] Quan sát RED đúng hành vi trên code cũ; implement smallest orchestration tại owner hiện có. Run/finally dừng owned processes và xóa plaintext working credentials, giữ clone/encrypted credentials/evidence. Start collision từ chối; process ownership vẫn PID+creation identity.
- [ ] Tách nhánh MRX khỏi `Invoke-MigrationAndRelationalEvidence` phần tạo subordinate/DEFAULT test: source migration identity chỉ kiểm tra, không redo cutover; giữ legacy DEFAULT integration tests nguyên trạng. Không set `IPC_TEST_CONNECTION_STRING` globally hoặc đưa DEFAULT test vào shared MRX clone.
- [ ] Test `Finish_requires_parent_packet_and_exact_ownership`: lifecycle-only packet không Drop; parent packet hợp lệ mới cleanup đúng target/principal; lỗi cleanup không completed/PASS. Test Abort disposition tách biệt, không tự gọi từ exception path. Mọi cleanup độc lập vẫn được thử khi target đã chứng minh owned.
- [ ] Run PowerShell parse không execute script; `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter FullyQualifiedName~MrxDisposableEvidenceContractTests`; targeted globalSetup/Teardown/dbGuardrail helper tests bằng root Vitest command ở R6. Chỉ GREEN ở owner boundary mới sang R2; chưa tạo DB thật ở R1.

**Deliverable:** legacy vẫn có contract cũ; campaign không recreate/drop do một attempt hỏng, không có second DB, Finish không thể đóng gói con thay parent.

## R2. Attempt scopes, cache build và evidence gọn

**Files:** safety/runner; mrxWorkflow/mrxTest/config; g1–g6 consumers; existing helper/fixture tests và C# evidence owner.

**Interfaces:** `MrxScenarioScope` giữ `runId,weekStartDate,reason,workbook,customer?`, thêm `attemptId:string,caseId:string`; `scenarioScope(verifier,ordinal)` giữ signature; `createTransferredBatch(pages,scope):Promise<{batchId:string;menuVersionId:string}>` giữ nguyên. Legacy không có attempt env thì dùng runId như trước; campaign bắt buộc attempt identity hợp lệ. Không đổi runId resource thành attemptId.

- [ ] Existing scope/helper test: hai attempt cùng campaign tạo caseId/mã khách/output/key khác nhau; ordinal bất hợp lệ và hết bounded week search phải throw, không chọn scope đã dùng. Extend smallest existing helper case thay vì test lại toàn bộ import.
- [ ] Grep tất cả consumer `scope.runId`/run-derived customer code, filenames, command reasons; sửa các identity của case sang caseId/attemptId, giữ SQL/principal guard theo campaignId. Quan sát RED→GREEN cho G6 mã khách trùng; không relax uniqueness để chạy lại.
- [ ] Test build input manifest: thay test/doc giữ FE/BE key; thay FE config/assets/shared contract đổi FE key; thay BE code/build props/config đổi BE key. Dùng tracked/untracked inputs liên quan và content hash, không chỉ mtime. Build ở standard outputs hiện có; xác minh artifact hash và actual served output trước UI. Không copy outputs thành nhiều cây per attempt.
- [ ] Extend context-owner test để `recordVideo` vắng mặc định ở role fixture và config, nhưng dedicated interaction-evidence case được chọn rõ có giới hạn. Retain-on-failure trace phải thực sự áp dụng cho custom role contexts; xác minh một failure artifact có trace/ảnh đúng role, không chỉ nhìn config string.
- [ ] Implement storage accounting trong existing evidence write/close boundaries: soft=2147483648 bytes, hard=4294967296 bytes; actual-volume free-space/headroom guard trước Start/Run/capture; counter không xác minh được sau crash thì bounded reconcile, không coi0. Hard cap là ngưỡng dừng tác vụ, không claim OS filesystem quota; native capture flush có thể vượt ngưỡng thì ghi actual overrun/stop, không PASS hay tăng trần ngầm.
- [ ] Test retention table: giữ first RED/latest unresolved FAIL/accepted GREEN và referenced artifacts; chỉ retire redundant payload mới đúng campaign/path, từ chối symlink escape/old-campaign/unresolved references. Giữ metadata/hash/retirement reason, không link file đã mất. Source dump xóa sau verified restore; build cache và DB cost báo riêng. Không quét đệ quy cả artifact tree.
- [ ] Run cheap owner tests/typecheck trước; chưa chạy lại SourceCustomer để kiểm một literal/assertion. R3 là lần Start thật duy nhất, dùng cùng DB để smoke các contract này, không tạo một DB rehearsal phụ.

**Deliverable:** các attempt thật sự độc lập nhưng dùng chung resource; capture/cost giảm ở cả hai layer; bằng chứng còn đúng nguồn/candidate và không mất RED.

## R3. Start một lần và kiểm kê hữu hạn BE/FE/admin MRX

**Files:** WORK; existing G1–G6/UI owners để điều khiển quan sát; runner chỉ sửa nếu smoke chứng minh defect an toàn. Không viết production UI mới trong task kiểm kê.

**Interfaces:** sinh `$campaignId` một lần theo run generator; bảng WORK `ID,route/action,actor,expected/current,type,severity,owner,repro,evidence,acceptance,LC/parentTask,verdict`. Máy chỉ giữ factual evidence, không nhật ký plan thứ hai.

- [ ] Thực hiện `-Mode Preflight -Profile Qualification -CampaignId $campaignId`, rồi **một** `-Mode Start` tương ứng. Xác minh một DB, restore/schema/MRX/server/main baseline, declared actors/prerequisites, encrypted secret/ACL và zero subordinate. Nếu Start lỗi, checkpoint và ownership review, không tự Run legacy hoặc clone lần2.
- [ ] Một short Run trên chính DB đó chứng minh failed command/pause giữ tài nguyên và lần Run sau dùng đúng identity; không tạo lỗi nghiệp vụ giả hay stock. Đối chiếu create/dump/restore counters và actual DB identity; safety FAIL thì dừng inventory.
- [ ] Bounded inventory lần lượt `/admin-data?view=ingredients|dishes|bom|customers`, `/weekly-menu?view=mrx-batch`, MRX warehouse branches, Chef cooking và reconciliation/history/completed. Đúng vai trò/viewport1440×900; chọn thêm viewport/focus/keyboard/state chỉ khi thao tác/defect yêu cầu. Không all-route×all-role×all-state matrix.
- [ ] Lập dòng riêng cho DTO/BOM feedback; referenced-dish/customer latency; role-inappropriate requests403; draft/cache; pending/unknown-outcome/error/retry; clipping/focus và exports thật. Với lag, tối đa3 cold/warm repeats cho representative action để repro và so sau sửa, không claim percentile. Phân biệt expected denial và frontend tự gọi sai quyền.
- [ ] Bảng tra bằng chứng gần đây trong WORK liên kết tới existing selected artifacts (gồm latest conversion run082843z_f2970c), không copy folder. Đọc status/build/cleanup và contents trước gán ý nghĩa; artifact scope lỗi ở run cũ được ghi correction, không sửa raw lịch sử.
- [ ] Freeze danh sách hữu hạn tại cuối lượt: mỗi required finding có owner/expected result/proof; ghi số case selection và dự kiến tổng budget final. Không tự hoãn lỗi FE trong scope chỉ vì không chặn LC cũ. New feature/policy conflict cần Owner ruling; không biến thành backlog vô hạn.

**Deliverable:** đúng một clone đang được giữ; inventory và evidence index có thể xem; danh sách sửa cụ thể BE/FE/admin gắn lại parent, không chỉ danh sách test.

## R4. Sửa production BE/FE/admin theo inventory đã chốt

**Files:** known BOM owners tại §3; source/admin/warehouse/Chef/reconciliation/shared owner chính xác của từng finding trong R3; strongest existing owner tests. Không pre-authorize blanket edit.

**Interfaces:** consumes frozen inventory; mỗi dòng xuất `production diff hoặc HARNESS-only reason, intended RED, GREEN, UI before/after, durable readback khi có write, candidate/build, acceptance verdict` trong WORK.

- [ ] Known BOM finding: đọc C# BomImportCommitResultDto + service; extend `frontend/src/__tests__/DishBomBatchImportModal.test.tsx` với actual DTO `createdRows=2,updatedRows=1,archivedRows=2` và preview metadata hợp lệ. Sau commit UI phải báo3 dòng đã nhập, không `undefined`, không cộng2 dòng archive thành5. Mock chỉ HTTP boundary, không modal/business hook; quan sát RED hiện tại.
- [ ] Sửa `BomImportCommitResult` trong `frontend/src/api/bomApi.ts` đúng wire fields C# và modal tính imported count từ created+updated; không thêm total giả vào API/server hoặc wrapper chỉ cho test. Cập nhật existing BomApi/modal fixtures theo DTO. Run `npm run test:unit -w frontend -- src/__tests__/DishBomBatchImportModal.test.tsx src/__tests__/BomApi.test.ts --maxWorkers=1`, lint/build liên quan, rồi actual BOM UI commit/reload trên campaign case mới xác minh count thật và persisted lines. Scoped UI gate trước `.tsx` edit.
- [ ] Với từng finding còn lại trong freeze: đọc callers, root-cause probe tối thiểu; ghi đúng production owner/test/command trong dòng WORK trước sửa. Intended RED phải phát hiện đúng lỗi, không setup/harness fail. Sửa nhỏ nhất theo kiến trúc hiện có rồi chạy owner GREEN; UI issue bắt buộc có real rendered before/after và recovery/keyboard/state chịu rủi ro, không chỉ unit assertion.
- [ ] Các lỗi request403: sửa query eligibility ở đúng owner nếu request không hợp lệ cho actor; giữ genuine denied route/API assertions. Không mở permission hoặc giấu lỗi bằng empty/fallback data. Lag/caching fixes giữ đúng customer/week/mode/version và draft; không chỉ tăng timeout/cache dữ liệu sai scope.
- [ ] Phân loại HARNESS/PREREQUISITE thật thì sửa đúng loại, không ép tạo production patch cho đủ số lượng; nêu vì sao. Hai repair cùng root thất bại thì checkpoint. Shared production owner thay đổi phải kiểm tra consumers liên quan, không mở redesign toàn app.
- [ ] Sau mỗi nhóm, chạy `Run -Diagnostic <existing affected selector>` chỉ khi cần browser boundary; lưu before/after cùng viewport/actor/scope tương đương, exact stock/history independent oracle cho mutations. Giữ DB, không full verify/source chain cho mọi assertion sai. Review UI/code/test skills và actual gate results tại WORK.

**Deliverable:** lỗi sản phẩm trong scope được sửa hoặc còn BLOCKED rõ lý do, có diff và proof; không lấy số lượng test PASS làm đầu ra thay thế.

## R5. Quay về và đóng các owner LC còn thiếu

**Files:** existing G1–G6 owners, WORK; production owners chỉ khi reproduced LC defect. Không viết bộ lifecycle thay thế.

**Interfaces:** LC mapping giữ spec scope-lock; consumes corrected product và shared campaign scopes. `LifecycleAcceptance` vẫn functional-only, không G7/G8/k6.

- [ ] Đối chiếu LC-01..12 với bằng chứng đúng candidate; giữ role/source/group/race/recovery/export owners cũ, không chạy lại sửa đã xong chỉ để điền checkbox. Current scoped proof dùng để hướng dẫn, không chứng nhận toàn candidate cuối.
- [ ] Xử lý exact same-name/different-ID prerequisite còn thiếu theo Owner ruling cụ thể trước mutation master data; case/label collation-equivalent không thành exact-name PASS. BLOCKED vẫn chặn GateC, không N/A hoặc tạo dish/BOM mới ngầm.
- [ ] Rerun affected existing G6 edited-source→Warehouse→Chef files→Manager terminal/history chain khi owner sửa ảnh hưởng lineage; giữ positive conversion/negative400 và retained-zero oracle. G3 giữ shortage/supplement/overage/correction, G5 giữ atomic rollback/loss/session, G4/G6 giữ valid races/locks; không nhân bản end-to-end setup.
- [ ] Gắn admin/UI fixes vào owner component tests và actual existing G6 scope khi phù hợp. Chỉ nếu inventory có distinct admin action chưa có browser owner, thêm **một bounded case** tại existing G6 spec phù hợp và bổ sung vào existing lifecycle selector; không nhét mọi admin CRUD vào merged-chain360s hoặc thêm diagnostic family. Ghi exact selected title/owner/expected proof vào WORK trước authoring.
- [ ] Typecheck affected specs từ frontend: `node ../node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --strict --skipLibCheck --types node tests/e2e-mrx/specs/g6-merged-customer.spec.ts` (thêm actual changed spec paths). Helper/selector contracts phải xác nhận không chọn G7/G8/k6.

**Deliverable:** mọi required business/admin finding có proof hoặc blocker hiển thị; đủ điều kiện mới freeze final candidate, không dùng việc hoàn tất workflow tooling để tuyên bố business PASS.

### R5 approved continuation — both coordinated members to terminal

Design: scope-lock spec §8, approved by Owner. Native parent execution; no new plan branch.

- [ ] Read existing coordinated G5 case, actual warehouse/kitchen DTOs and G6 terminal/file patterns. Preserve rollback/replay assertions and exact original two member IDs. Review existing420000ms budget: prior coordinated body~120s, adding10remaining-date UI issues+two exports/terminal tails expected<240s; attempt uses unchanged420000ms case/900000ms phase, stop if not enough rather than increasing.
- [ ] Move existing parseCookingFile unchanged from G6 into test-support `fixtures/mrxWorkflow.ts`, export for both actual spec consumers; do not add production exports or duplicate parsers. Strict typecheck both callers.
- [ ] Extend same G5 case using Chef actor: for each batch read actual applicable dates; prove coordinated date already satisfied and skip it, manually issue remaining positive dates via real Warehouse controls, exact frozen IDs/quantities and stock delta. Keep complete per-member issue-ID baseline including original group child.
- [ ] Chef actual CSV+XLSX through controls, parse bytes, customer/week and all cooking-row fields; no mutation before/after. Manager completes each same batch, reloads COMPLETED, UI transaction pagination+download agree with exact persisted issue codes and exclude other member. Retain per-member evidence immediately so a second-tail failure does not hide first-tail progress.
- [ ] Use existing `RepairCheck` selector for coordinated-only functional Run on campaign; remove its desktop follow-through, admit that existing name in guard. Extend existing invocation boundary test (positive RepairCheck, still rejects Quantitative); observe intended RED then GREEN. No new diagnostic family or full acceptance attempt.
- [ ] Run safety owner/typecheck before actual Run; read storage/ownership first. Keep all prior raw/archived evidence, no extra fixture/main writes. Run existing RepairCheck headed1worker/fail-fast on campaign20261103t101725z_407a6d. Any real operation failure: inspect exact response/DOM/durable state; production fix only at reproduced owner with scoped UI/test review. Harness fixes require intended reason, never weaker expected outcome or timeout raise.
- [ ] Report separately each customer's days issued, Chef outputs, Manager completion and history isolation; source/candidate/process cleanup and DB retained. Tests alone are not the deliverable. Update WORK and stop before quantitative/final selection.

## R6. GateC trên candidate cuối và bàn giao về plan tổng — KHÔNG Finish

**Files:** WORK, existing runner/gates, factual acceptance artifacts; parent Task6/Task8 integration notes. Không sửa product giữa final groups.

**Interfaces:** `acceptance/lifecycle.json` liên kết exact final candidate/build/required cases/observed verdicts/source readback; resourceDisposition `RETAINED_AUTHORIZED`. Không tạo parent `acceptance/final-package.json` khi parent required gates chưa hoàn tất.

- [ ] Chốt case manifest từ existing LifecycleAcceptance + actual added admin case, số nhóm và tổng budget trước chạy. Mặc định một functional selection max900000ms; nếu inventory chứng minh không vừa thì xin quyết định partition/total budget trước, không tự tăng cap hoặc chạy nhiều900000ms để né ràng buộc.
- [ ] Freeze source/candidate; chạy `npm run verify` một lần và các gates liên quan. Verify builds có thể cập nhật outputs: xác minh/rebuild Release và served hash sau đó trước final browser run; không tái dùng hash stale. Không gọi auto-install `npx --yes`/tool restore; nếu cần generated contract thì dùng installed tool sau xác minh hoặc BLOCKED xin quyền riêng.
- [ ] Run focused evidence/recovery: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter 'FullyQualifiedName~RecoveryScriptContractTests|FullyQualifiedName~MrxDisposableEvidenceContractTests'`; helper tests từ root: `node node_modules/vitest/vitest.mjs run frontend/tests/e2e-mrx/core/__tests__ frontend/tests/e2e-mrx/fixtures/__tests__ --environment node`; strict changed-spec typecheck; `git diff --check`. Không chạy DEFAULT integration trên shared clone. Named operational contract files thiếu thì công bố actual semantic owners, không tạo placeholder.
- [ ] Thực hiện `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Run -Profile Qualification -CampaignId $campaignId -Diagnostic LifecycleAcceptance`. Entry này không chạy lại full verify đã xác minh trước khi cases; bind evidence vào candidate/build vừa kiểm. Functional FAIL dừng nhóm sau và quay owner, không tự clone/drop/retry toàn bộ.
- [ ] Đối chiếu từng LC và inventory finding; real controls→request→durable result→reload, exact source/stock/history and parsed exports, role/state/UI proof, link tồn tại, no secret. Main source readback tại GateC; process/listener cleanup độc lập; DB/principal vẫn owned và retained. Không fake cleanupCompleted cho DB.
- [ ] Chỉ LC+required inventory rows đều PASS và gates/source attribution hợp lệ mới báo scoped BUSINESS_ACCEPTANCE_PASS với retained-resource note; overall QUALIFICATION vẫn INCOMPLETE nếu parent tasks còn mở. Nếu còn bất kỳ BLOCKED/NEEDS_EVIDENCE thì chỉ báo đúng hàng đó và dừng.
- [ ] WORK handback: parent task nào hoàn tất ở scope nào, việc còn lại, candidate/campaign identity, private credential location (không giá trị), evidence index, quyền tiếp tục. Giữ clone đến parent Task8; không tự vào G7/G8/endurance/k6. Khi parent được admitted và hoàn tất mới dùng cùng campaign rồi Finish; Owner hủy thì Abort rõ ràng.

**Deliverable:** package hỗ trợ đóng scope-lock và quay về đúng plan tổng; không có nhánh thử nghiệm khác, không mất clone vì gói con xong, không production GO/deploy.

## Self-review và handoff

- Spec coverage: §4/lifecycle→R1; §6/scopes/build→R2; §5/inventory→R3; §3/5 product repairs→R4; LC continuity→R5; §7/9 gates+parent handback→R6; §8/evidence storage→R2/R3/R6. Cả năm Review Focus có case/step owner.
- Type/identity consistency: campaignId=resource runId, attemptId/caseId riêng; helper business signature giữ nguyên; legacy Execute không được fallback từ campaign. Final lifecycle evidence không đủ cho parent Finish.
- Plan này không một project độc lập: không mở engine/benchmark/test taxonomy; không hủy nghĩa vụ parent và không lặp main cutover. Future quantitative admission/cleanup boundaries được giữ rõ.
- Parent self-review, không delegation. Tài liệu không phải runtime evidence. Giữ native method đã chốt; chờ Owner review plan trước thực thi, không hỏi lại chọn agent/worktree.
