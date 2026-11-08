# MRX — Một clone cho plan, kiểm kê lỗi trước, sửa sản phẩm và nghiệm thu có bằng chứng

**Ngày:** 2026-11-03  
**Trạng thái tài liệu:** Owner đã duyệt thiết kế và yêu cầu gói này nằm trong plan tổng ban đầu, không rẽ sang hướng kiểm thử khác. Implementation plan và quyền thực thi theo gate hiện tại trong WORK.  
**Chủ sở hữu trạng thái công việc duy nhất:** [`.planning/WORK.md`](../../../.planning/WORK.md). Không dùng tài liệu này làm nhật ký tiến độ.

## 1. Mục đích và quyết định đã có

Owner yêu cầu giảm việc clone/build/chạy lại cả chuỗi cho từng lỗi nhỏ; sử dụng **một database clone xuyên suốt toàn plan, cleanup khi kết thúc plan**; đưa lỗi nghiệp vụ và FE vào sửa thực tế, với bằng chứng dễ tìm. Phạm vi gồm bốn trạm MRX và quản trị dữ liệu liên quan MRX.

Phương án đã chọn:
- **A — Kiểm kê hữu hạn trước, sửa theo danh sách:** rà các màn và luồng thuộc scope, phân loại và chốt danh sách, sửa theo owner, xác nhận liên quan, nghiệm thu tổng. Owner: “Duyệt A”.
- Không chọn **B — Gặp đâu sửa đó trong hành trình:** có kết quả nhanh nhưng dễ bỏ sót nhánh khác và lặp lại vòng test/setup.
- Không quay lại clone mới cho mỗi lần thử; không tạo một test khổng lồ; không tạo framework điều phối hay hệ thống quản lý trạng thái mới.

Những chi tiết CLI, ngân sách lưu trữ, cách giữ credentials và trình tự gate dưới đây do assistant đề xuất và được Owner duyệt cùng thiết kế. Chúng không tạo một chương trình kiểm thử độc lập.

**Vị trí trong plan tổng:** [MRX Five-User Production Qualification](../plans/2026-11-02-mrx-five-user-production-qualification.md) → [Lifecycle Scope Lock LC-01..12](../plans/2026-11-03-mrx-lifecycle-scope-lock.md) → gói điều chỉnh workflow/BE-FE-admin này. Gói này hỗ trợ các Task1–4/7 của plan tổng và Task1–6 của scope lock, không thay bộ LC hoặc hủy nghĩa vụ qualification sau đó. Hoàn tất gói con thì quay về plan cha; không chuyển sang test framework, benchmark hay nghiệp vụ khác. Clone giữ đến Task8/đóng plan tổng, không drop ngay khi gói con hoặc LC kết thúc; bước quantitative vẫn cần admission riêng.

## 2. Hiện trạng đã đối chiếu source

| Owner hiện có | Quan sát và hệ quả |
|---|---|
| `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`: khai báo tài nguyên, khối Execute và finally | Mỗi invocation tạo runId/DB/tempRoot mới; dump main, restore clone, chuẩn bị runtime, chạy gate rồi drop DB/xóa temp. Artifact evidence vẫn được giữ. Không có cơ chế tiếp tục một plan-owned clone. |
| `Invoke-MigrationAndRelationalEvidence` trong cùng runner | Tạo thêm `${targetDatabase}_integration`, thêm dump/restore và chạy `WorkflowLifecycleE2ETests`. Không đáp ứng một DB cho plan. |
| `backend/tests/IPCManagement.Api.Tests/Integration/WorkflowLifecycleE2ETests.cs` | Seed/tạo tài khoản; có setup DEFAULT khi chưa có mode; gọi `/api/production-plans`. Không đưa nguyên trạng lên clone MRX chung hoặc xem đây là chứng nhận MRX. |
| `frontend/tests/e2e-mrx/config/playwright.mrx.config.ts` và `fixtures/mrxTest.ts` | Cấu hình functional bật video; fixture còn tự tạo `recordVideo` cho từng role context. Chỉ sửa config không loại được phần ghi video của fixture. |
| `core/globalSetup.ts`, `core/globalTeardown.ts` | Qualification xác minh Release/build/mode/ownership, khởi động rồi dừng API/FE. Prepared DB không bị teardown phía Playwright drop, nhưng runner cha hiện vẫn drop trong finally. |
| `fixtures/mrxWorkflow.ts::scenarioScope` | Đã có chọn tuần chưa tồn tại và workbook riêng. Đây là điểm mở rộng nhỏ cho attempt/case scopes, không cần factory mới. |
| `frontend/src/api/bomApi.ts`, `components/workbench/DishBomBatchImportModal.tsx` so với C# `Catalog/Contracts/DishDto.cs` | FE dùng `totalCommittedRows`, nhưng DTO C# trả `createdRows`, `updatedRows`, `archivedRows`. Đây là ứng viên sửa sản phẩm, không chỉ sửa expectation của test. |

Các lượt gần đây cũng có lỗi harness (trường DTO không tồn tại, tìm dialog trong khi thực tế là panel) gây chạy lại chuỗi không cần thiết. Thiết kế mới đưa kiểm tra source/DTO và kiểm tra rẻ lên trước browser chain.

Không có số đo tổng dung lượng đáng tin cậy: lần quét đệ quy đã hết thời gian. Không quy toàn bộ dung lượng cho “copy repo” khi chưa đo; runner được đọc cho thấy dump/runtime/artifact/video và DB phụ là các nguồn cần kiểm kê cụ thể.

## 3. Scope, bất biến và loại trừ

### 3.1 Trong scope

| Bề mặt | Kết quả cần kiểm kê và sửa khi có lỗi |
|---|---|
| `/weekly-menu` — chuẩn bị MRX | Chọn khách/tuần, nhập file, số suất, món/BOM, chỉnh sửa nguồn, submit/review/reject/apply, phản hồi và bảo toàn draft. |
| `/warehouse` — các workbench MRX | Xuất đầu/bổ sung/phối hợp, phiên bản nguồn, định lượng, conflict/unknown outcome/recovery, quyền và hiển thị kết quả thật. |
| `/chef` — MRX cooking | Đúng lô/phạm vi, đọc phiếu và tải menu CSV/XLSX đúng lineage/context; không nghiệp vụ ghi. |
| `/reconciliation` | Chênh lệch, giải trình/sửa quyết định, Manager hoàn tất, lịch sử, danh bạ hoàn tất và export. |
| `/admin-data` — nguyên liệu, món, BOM, khách hàng | Hợp đồng DTO, thao tác thực sự được hỗ trợ/được phép trong MRX, nhập/sửa/xem, validation, phản hồi, dữ liệu áp dụng về luồng MRX. Đơn vị đo kiểm tra theo bề mặt hiện có; không tự tạo tính năng CRUD đơn vị. |
| Thành phần dùng chung tác động các màn trên | Navigation, guards, query/cache, bảng, form, modal/panel, file download, error/retry và keyboard/focus. Sửa tại owner, không mở đợt redesign toàn app. |

Truy vết FR-MENU/FR-WH/FR-CHEF/FR-RECON/FR-REP/FR-CAT/FR-ADMIN và FR-AUTH khi liên quan; giữ các BR-MRX về edit, servings, truth, history và DOM-MODE-1. `DOMAIN`, domain MRX, `DESIGN`, `ENGINEERING`, source và machine contracts vẫn là chủ sở hữu kỹ thuật.

### 3.2 Không thay đổi

- Main `ipcmanagement` chỉ đọc; không lặp migration/cutover đã hoàn tất. Không deploy/install/commit/push/worktree/delegation.
- MRX không nhập nghiệp vụ DEFAULT. Chef chỉ đọc/export; Manager không bị thay bởi Admin; không nới quyền để loại lỗi403.
- Giữ six-decimal, distinct-dish BOM, lineage/audit append-only và customer master dùng chung. Không bịa stock/receipt, không mock thành công, không gọi API ghi thay FE cho workflow claim.
- Fixture được duyệt trước đây chỉ giữ đúng scope đã khai báo. Clone không tự động cho phép tạo mọi dữ liệu mẫu. Prerequisite mới phải nêu loại/bản chất/ảnh hưởng và được duyệt trước khi tạo.
- Chưa mở endurance/k6/HTTP load, chứng nhận memory, natural JWT expiry, native zoom campaign hay off-host/deploy. Điều tra ngắn có giới hạn để sửa lag/đơ FE trong scope được tách khỏi chứng nhận định lượng dài hạn.
- Chưa có quyền xóa artifact cũ. Thiết kế retention này áp dụng tài nguyên mới của campaign; dữ liệu cũ cần danh sách và duyệt riêng.

## 4. Vòng đời một clone — tách plan khỏi attempt

Mở rộng **runner hiện có**, không thêm service/daemon hay framework:

| Thao tác đề xuất | Hợp đồng |
|---|---|
| `Preflight` với campaignId | Chỉ đọc: kiểm tra scope, ownership/path/ports, dung lượng theo kiểm tra có giới hạn và prerequisite. Không tạo DB. |
| `Start` với campaignId | Một lần duy nhất: xác minh main/host, snapshot source, tạo đúng một clone và đối chiếu restore; tạo năm actor/principal clone-only và prerequisite đã duyệt; ghi receipt quyền sở hữu. ID tồn tại thì từ chối, không drop/recreate. |
| `Run` với campaignId và case/gate selection | Xác minh clone/receipt/build trước khi kết nối; chạy kiểm kê hoặc ca được chọn. Không dump/restore/create thêm DB, không seed actor/unit lại. Mỗi attempt ghi bằng chứng mới nhưng không copy repo/build/database. |
| Tạm dừng hoặc attempt kết thúc/lỗi | Dừng browser/API/FE do mình sở hữu, kiểm tra listener; bảo toàn clone và bằng chứng. Không drop DB vì test FAIL, timeout hay process exit. Ghi điểm tiếp tục trong WORK. |
| `Finish` với campaignId | Chỉ tại Task8/đóng **plan tổng**, sau required parent gates và gói bằng chứng: main readback, đóng tiến trình, drop đúng clone, thu hồi principal, xóa private working files và xác minh cleanup. Hoàn tất gói con/LC không cho phép Finish. Cleanup lỗi thì không báo toàn plan hoàn tất. |
| `Abort` với campaignId | Chỉ theo lệnh hủy rõ của Owner: cleanup đúng tài nguyên được sở hữu; ghi ABORTED/INCOMPLETE, không PASS. |

`Preflight/Execute` legacy không bị âm thầm đổi nghĩa. Entry mới có campaignId được ràng buộc riêng; không fallback từ campaign lỗi sang legacy tự tạo clone khác. CLI chính xác và migration callers sẽ được ghi trong implementation plan sau khi duyệt thiết kế.

### 4.1 Điều kiện tiếp tục an toàn

CampaignId sinh một lần theo định dạng runId và prefix DB mà safety helpers hiện có chấp nhận; không nới regex/exact-name guard để nhận DB tùy ý. **CampaignId là resource identity; attemptId/caseId là identity của lần thử.** Giữ `MRX_EVIDENCE_RUN_ID` trỏ về campaign resource identity khi guard/principal/tag hiện có yêu cầu; truyền attempt identity riêng cho fixture và evidence. Không đổi runId mỗi Run rồi nới guard để chấp nhận DB không khớp.

Trước mỗi Run: đối chiếu campaignId, exact DB name/server identity, receipt riêng của plan, mode MRX, schema/migration fingerprint, actor/principal tag và quyền chỉ trên clone. Kiểm tra tiến trình bằng PID **và creation identity**, port/build/origin; không kill theo PID/port đơn lẻ. Có khóa một writer trên campaign; nhận diện lock chết có bằng chứng, không cướp lock đang sống.

Nếu receipt thiếu/sai, DB bị đổi schema/mode, tài nguyên không đúng owner, build không khớp hoặc private credentials không giải mã được: **BLOCKED và dừng**, không tự tạo tài nguyên thay thế và không drop một DB chưa chứng minh ownership. Không giữ API/browser chạy khi pause. Main/operator credentials không được đưa vào manifest hay giữ thành plaintext trong evidence.

Chỉ giữ clone credential đã bảo vệ bằng Windows DPAPI theo account/machine và ACL riêng; giải mã vào runtime private khi cần, bỏ plaintext khi dừng. Receipt machine-readable chứa ID/resource/hash cần để xác minh, không chứa mật khẩu và không thành chủ sở hữu tiến độ thứ hai. Cấu hình/schema build đổi đòi hỏi xác minh lại, không tự migrate clone trong mọi Run.

### 4.2 Không còn DB integration phụ

Entry campaign MRX không gọi nhánh tạo `_integration` hoặc export `IPC_TEST_CONNECTION_STRING` tới cả suite. Giữ nguyên kiểm thử DEFAULT ở luồng riêng; không xóa test, nới guard hay đổi thành PASS/skip để che thiếu bằng chứng.

Unit/contract tests không cần MySQL chạy theo owner hiện có. Ca MRX thực sự cần MySQL dùng chính clone, tuần/khách/batch riêng và guard scope; không EnsureDeleted/TRUNCATE/reset toàn DB. SQLite/InMemory không được quảng bá là bằng chứng relational MySQL. Nếu một required gate chỉ chạy được bằng DB thứ hai hoặc reset phá dữ liệu, ghi BLOCKED và trình thay đổi rõ ràng, không tạo DB phụ ngầm.

Việc bỏ DEFAULT-only gate khỏi acceptance MRX phải thể hiện trong gate manifest với lý do và trạng thái chưa chạy; không làm yếu kỳ vọng của test hoặc gán rằng đã kiểm thử toàn DEFAULT.

## 5. Quy trình A — kiểm kê trước rồi sửa hữu hạn

### Bước 1 — Kiểm kê một lượt có giới hạn

Đi theo các route tại §3 với actor đúng quyền. Tái sử dụng luồng/batch vừa tạo để khảo sát, nhưng không dùng dữ liệu đã hoàn tất cho case cần trạng thái đầu. Mỗi finding có:

`ID; route/action; actor/mode; expected/current; loại PRODUCT_BE/PRODUCT_FE/HARNESS/PREREQUISITE/EXPECTED_DENIAL; mức ảnh hưởng; owner; reproduction; bằng chứng; tiêu chí chấp nhận; gate liên quan.`

Ghi trong WORK và chốt danh sách hữu hạn sau lượt kiểm kê. Không tạo issue file/report/state khác. Với màn nhiều trạng thái, kiểm tra trạng thái thực sự có rủi ro (loading/empty/error/permission-denied/partial/write-reconciliation), không làm ma trận mọi role×route×viewport.

Ứng viên cần xác minh lại, không phải kết luận mới: BOM feedback/DTO thiếu trường; tải referenced-dish/customer chậm; request khách hàng403 phát sinh trên màn hợp lệ của role; draft/cache khi quay lại; feedback/export/context và các vấn đề layout/focus trong scope. Phân biệt403 dự kiến của negative test với request sai quyền do FE tự gửi.

### Bước 2 — Chốt danh sách sửa sản phẩm

- Lỗi sai dữ liệu/quyền/lineage, mất draft, sai kết quả ghi, không thể hoàn tất hoặc không có lối phục hồi: sửa trước.
- Lỗi FE trong scope về phản hồi, form, loading/error, clipping/focus, thao tác khó dùng và độ trễ quan sát được: đưa vào nhóm sửa có tiêu chí cụ thể, **không tự đẩy sang EX vì không chặn LC cũ**.
- Cải tiến thẩm mỹ thuần túy hoặc feature mới không tự trở thành bắt buộc; nêu rõ để Owner quyết định. Không thay theme/primitive/token riêng.
- Finding mới phát sinh sau khi chốt phải được phân loại: regression từ sửa hiện tại thì sửa cùng; lỗi có sẵn nghiêm trọng cùng scope thì cập nhật nhóm ảnh hưởng trước khi làm; feature mới/ngoài scope xin ruling. Không để danh sách mở vô hạn.

### Bước 3 — Sửa đúng owner, kiểm tra rẻ trước

Một vòng: **tái hiện đúng lỗi → regression nhỏ nhất có giá trị → sửa production owner → GREEN liên quan → xác minh FE thật nếu lỗi có UI**.

Đọc C# DTO/callers/owner trước khi sửa fixture; dùng test-audit. Không thêm production seam chỉ cho test, không mock component/hook dưới test. Nếu lỗi thật ở harness, ghi nguyên nhân và sửa harness, không tạo một patch nghiệp vụ giả. Một test PASS không chứng minh đã sửa UX.

Nhóm sửa nhỏ theo owner/dependency; không ép mỗi finding một spec/test file. Hai repair thất bại cùng root cause thì checkpoint, không patch thứ ba. Thiếu dữ liệu/quyền hoặc không tái hiện được thì NEEDS_EVIDENCE/BLOCKED, không kết luận đã sửa.

Với `.tsx/.css`: scoped pre-code gate, `ipc-ui-review`, primitives và tokens hiện có. Giữ D6/D7/T7/T8/M1.2/N6 theo DESIGN. Chọn viewport theo lỗi thực tế; ảnh trước–sau không thay keyboard/state/persistence assertions.

## 6. Dữ liệu ca và build/runtime dùng lại

- Một baseline clone từ main ở thời điểm Start. Không restore/truncate để quay về baseline trong mỗi attempt; trạng thái đã ghi/audit được giữ đến Finish.
- Mỗi lần chạy lại **ca có mutation** cấp attempt/case scope mới (tuần/batch/ID thực), dùng cơ chế `scenarioScope` và lookup hiện có. Phải sửa các tên/mã/command scope hiện đang dẫn xuất chỉ từ runId (ví dụ mã khách tạo trong G6), nếu không lần thử thứ hai trên cùng campaign sẽ trùng mã dù tuần mới. Giữ nghĩa `scope.runId` là resource identity; bổ sung attempt/case identity ở fixture contract, không tráo nghĩa runId. Case cần xem lịch sử có thể mở lại scope cũ ở chế độ đọc. Một case nhiều bước cố ý chia sẻ batch/revision phải giữ nguyên liên kết.
- Không dùng customer shared vừa sửa để làm oracle của scope khác mà không ghi nhận ảnh hưởng. Fixture BOM customer/day và alternate unit đã duyệt có receipt và phạm vi rõ; không normalize masters có sẵn để làm test xanh.
- Dùng build outputs chuẩn hiện có, không tạo bản copy repo/dist/Release cho từng attempt. Build lại theo **input hash** của FE/BE/config/dependency liên quan; sửa riêng test/doc không bắt build lại sản phẩm không đổi. Input graph phải bao gồm config/assets/generated contracts, không chỉ đuôi `.tsx`/`.cs`.
- Cache build không cache verdict: mỗi Run vẫn kiểm tra binary/static hashes và served runtime đúng build. Cần build lại thì dừng process trước khi thay output; không chỉnh file trong khi browser đang kiểm tra.
- Runtime private directory dùng lại theo campaign; mặc định process dừng cuối attempt. Không cần giữ daemon sống để đạt tối ưu. Restart an toàn rẻ hơn debug process cũ/sai build.
- Giữ pacing/rate limits/login và security nguyên trạng; chỉ tạo role context mà case thực sự dùng. Không dùng chung auth state qua role hoặc coi token cũ luôn hợp lệ.

## 7. Gate theo rủi ro, không chạy cả thế giới mỗi lần

| Thời điểm | Gate |
|---|---|
| Trước browser | Parse script, typecheck harness/FE, đối chiếu DTO, test owner nhỏ nhất; xác minh prerequisite bằng đọc metadata có giới hạn. Không cần clone mới. |
| Sau sửa BE/FE | Build/lint/dependency/API parity/test liên quan theo ENGINEERING và `ipc-code-review`. Đối với UI/state/write bug, ca FE thật bị ảnh hưởng là bắt buộc. |
| Khi sửa runner/lifecycle/guards | Owner tests chứng minh Start một lần, Run lặp không Create/Drop, lỗi/pause giữ DB, ownership mismatch từ chối, Finish/Abort đúng target; không chỉ grep literal trong source. Chạy trên tài nguyên local giả lập có guard khi đủ, rồi một smoke thật trên chính campaign clone. |
| Nghiệm thu cuối | Freeze candidate; toàn bộ required LC-01..12 và danh sách lỗi BE/FE/admin đã chốt phải được xác minh trên candidate cuối; chạy `npm run verify`, evidence/recovery contracts và các gate bổ sung thực sự liên quan. Không sửa code giữa các nhóm nghiệm thu. |

Final package có thể gồm các nhóm case nối tiếp trên **cùng clone, cùng candidate/build**, không bắt thành một test/browser session khổng lồ. Mỗi nhóm có manifest ca, thời hạn và kết quả; nhóm trước FAIL không chạy nhóm dài phía sau.

Giữ giới hạn action/case hiện có; không tăng timeout để che treo. Global functional hiện có900000ms là ràng buộc đầu vào, không mặc nhiên nhân lên qua vô số nhóm. Sau inventory, implementation plan phải công bố selection, số nhóm và **tổng ngân sách cuối** trước khi thực thi; nếu scope không vừa budget, xin chốt phân nhóm/ngân sách rõ. Điều tra lag FE chỉ là số lần cold/warm hữu hạn để sửa/recheck; không gọi vài mẫu là p95/p75 hoặc chứng nhận tải.

Full verify/acceptance không chạy lại cho mọi lỗi assertion. Khi acceptance FAIL: quay về owner và kiểm tra liên quan trước; không gán kết quả của candidate cũ thành kết quả candidate mới. Historical PASS vẫn giữ đúng phạm vi/chỉ dẫn, không ghép thành chứng nhận cuối.

## 8. Bằng chứng dễ tìm và dung lượng có trần

### 8.1 Một thư mục evidence cho campaign

Dùng `.artifacts/mrx-evidence/<campaignId>/` của owner hiện có. Có receipt tài nguyên, build/attempt manifests gọn, bằng chứng theo finding/case và acceptance cuối; không tạo root campaign mới theo mỗi lần thử. Subfolder/file attempt chỉ chứa dữ liệu riêng, **không copy source, runtime tree, source SQL dump hoặc Release outputs**.

WORK có một active summary ngắn và bảng liên kết:

`Finding/case → expected vs actual → production files đổi (hoặc lý do harness-only) → RED → GREEN → candidate/build → actor/batch/revision → ảnh/file/log → giới hạn → verdict.`

Chỉ liên kết đến file thật. Với UI, chọn ảnh trước–sau đúng actor/phạm vi và các hành vi như retry/focus/validation; với ghi dữ liệu, giữ control→request→durable result→reload và SQL/HTTP readback độc lập. CSV/XLSX phải parse bytes thật. Console/network capture phải lọc thông tin nhạy cảm và phân biệt lỗi dự kiến.

Gói mới phải có bảng tra tới bằng chứng gần đây được chọn từ lịch sử, kể cả `20261103t082843z_f2970c`; không copy cả folder cũ và không đổi tên historical result thành final-candidate acceptance. Latest diagnostic đó không chứng minh toàn plan.

### 8.2 Chính sách lưu đã duyệt

- Giữ manifests/kết quả nhỏ của mọi attempt; payload đầy đủ của **RED đầu tiên, FAIL chưa giải quyết mới nhất và GREEN được nghiệm thu** cho mỗi lỗi/case. Không xóa payload đang được viện dẫn cho acceptance hoặc unresolved finding.
- Mặc định không video mọi ca thành công. Sửa cả Playwright config **và** role fixture; video chỉ cho vấn đề tương tác cần ghi nhận, có giới hạn rõ. Trace cho failure có giá trị; ảnh chỉ tại checkpoint/finding, không chụp mọi click.
- Xóa source dump tạm sau khi restore clone đã đối chiếu thành công, không lưu dump mới cho mỗi Run. Không giữ nhiều bộ bin/dist giống nhau. Manifest ghi hash không đòi copy lại binary.
- **Soft cap2GiB, hard cap4GiB** cho evidence/private working files mới của campaign (không coi đây là số đo hiện tại). Cảnh báo khi chạm soft cap; trước case mới nếu không đủ headroom thì dừng để xử lý, không chạy đến đầy đĩa. Trừ DB clone và cache build chung khỏi con số này nhưng báo riêng để không che chi phí đĩa.
- Theo dõi tăng trưởng bằng byte/count theo owner ở lúc tạo/đóng file và kiểm tra bounded tại ranh giới Run; không quét đệ quy cả `.artifacts` ở mọi lần thử. Byte counter không thay kiểm tra có giới hạn nếu process bị ngắt.
- Chỉ prune payload lặp mới trong campaign khi chứng minh đường dẫn/ownership, không symlink escape, không còn được tham chiếu làm bằng chứng bắt buộc và có retention policy đã duyệt. Không sửa raw bằng chứng được giữ để làm lịch sử đẹp hơn. Ghi file nào đã retire; không để link treo được báo là còn bằng chứng.
- Artifact cũ, `.artifacts/dotnet`, cache người dùng và backup mã hóa không thuộc quyền xóa của policy này. Muốn dọn phải đưa danh sách/ước lượng có giới hạn và xin duyệt riêng.

## 9. Điều kiện nghiệm thu thiết kế khi được triển khai

1. Start tạo đúng một DB clone; Run lặp, lỗi và pause tạo/drop0 DB; không có `_integration` trong entry mới. Tiếp tục vẫn đúng campaign/DB/mode/actor/build.
2. Không có write vào main; kiểm tra source identity/readback đầu và cuối, không tự restore main khi thấy thay đổi. Nếu main có concurrent legitimate changes, công bố chênh lệch và xin ruling về source-unchanged criterion, không nói rằng main vẫn nguyên.
3. Các lỗi BE/FE/admin đã chốt đều có verdict và proof đúng boundary. Normal denial không bị “sửa” thành nới quyền. Không còn required row NEEDS_EVIDENCE/BLOCKED mà vẫn báo PASS.
4. Bộ LC cũ vẫn được bảo vệ, gồm quantity/zero/recovery/same-name identity; thiếu prerequisite không thành N/A/PASS. Scope mới bổ sung admin/UX, không xóa các nghĩa vụ nghiệp vụ cũ.
5. Một candidate cuối có build/lint/test và FE/MySQL/export evidence tương ứng. Bảng trong WORK phân biệt product repair, harness repair, historical proof và final acceptance.
6. Build không đổi được dùng lại; attempt không dump/restore/copy build tree. Evidence retention thực sự áp dụng cả role fixture; trần dung lượng và free-space guard không bị vô hiệu hóa.
7. Finish tại Task8 của plan tổng xác minh đúng tài nguyên rồi cleanup clone/principal/private files/process/listeners; evidence đã duyệt được giữ và link được kiểm tra. Ở cuối gói con/LC ghi `RETAINED_AUTHORIZED`, không báo đã xóa DB hay qualification hoàn tất. Abort ghi hủy/chưa hoàn tất. Cleanup FAIL không được thành completed/PASS.

## 10. Owner triển khai và rủi ro còn lại

Sửa tại runner/safety helpers hiện có; globalSetup/globalTeardown, process/db guards, role fixtures/config, scenarioScope và các evidence-contract tests là các caller cần rà. Product fixes thuộc feature/admin/api/service/component owner đã có; không chỉnh toàn bộ các file này theo danh sách cho sẵn.

Rủi ro chính: dữ liệu mutation tích lũy/cross-case master changes; credentials tồn tại lâu hơn; pause mất máy/account làm DPAPI không dùng được; build cache thiếu input; định danh process sai sau crash; storage vượt trần; gate DEFAULT vô tình chạm clone MRX; final suite vượt budget. Các guard ở trên phải được kiểm chứng, không chỉ ghi trong tài liệu. DB mất/hỏng thì dừng và xin khôi phục/thay scope; không tự tạo clone thứ hai để che sự cố.

Thiết kế được tự rà theo góc nhìn implementer tại parent, không dùng subagent theo hạn chế hiện hành. Chưa triển khai hay chứng minh lifecycle mới hoạt động. Thiết kế đã được duyệt; bước tiếp theo là implementation plan bằng `writing-plans`, được gắn vào plan cha thay vì mở nhánh kiểm thử khác. Giữ native sequential và các gate review/admission hiện hành.
