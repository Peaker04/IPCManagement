# MRX — áp dụng AI-augmented QA với multimodal context

## Phạm vi và giới hạn

Tài liệu là checklist thực thi và kết quả rà soát nguồn có giới hạn; trạng thái tác vụ và bằng chứng chạy mới chỉ do `.planning/WORK.md` sở hữu. Không phải chứng nhận toàn MRX, không phải giấy phép chạy DB/browser, không thay thế kế hoạch whole-mode đã duyệt.

Baseline: working tree kế thừa trên HEAD `b2adf6ef05cf9ddf8227d7786965efbba6801521`. Các nhận xét bên dưới là khoảng trống của harness/bằng chứng hiện có, không quy thành lỗi sản phẩm đã tái hiện. Không sửa sản phẩm/test, không thêm framework/agent/service.

## 1. Kết quả rà soát có căn cứ

### E1 — Chưa có trace của ca thành công theo cấu hình hiện tại

- Owner: `frontend/tests/e2e-mrx/config/playwright.mrx.config.ts:22–24`.
- Cấu hình `trace: retain-on-failure`, `screenshot: only-on-failure`, `video: off`. Các spec chủ động chụp ảnh nên không phải hoàn toàn thiếu ảnh thành công.
- Caller qualification tại `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` truyền headed/single-worker/max-failures/time budget, không bật thêm success trace/video trong lệnh đã rà soát.
- Hệ quả: run xanh có ảnh và JSON/SQL assertion nhưng không mặc nhiên có timeline DOM/network của ca thành công hoặc video. Không diễn giải ảnh riêng lẻ thành bằng chứng đồng bộ đầy đủ.
- Phân loại: **F — cải thiện thu bằng chứng tại owner config/fixture khi được chạy bounded functional**. Bật trace có mục tiêu; chỉ thêm video khi chuyển động/thứ tự thao tác cần nó. Không bật recorder cho memory/endurance/performance vì có thể làm sai phép đo. Kiểm tra artifact thật cho mọi role context, kể cả context thứ hai của race; không suy từ cấu hình.
- Trace có thể chứa token/request/DOM nhạy cảm: giữ raw cục bộ/private, kiểm tra/redact bản dẫn xuất trước khi chia sẻ; không gửi nguyên trace cho dịch vụ AI ngoài.

### E2 — Admission identity và UI readiness là hai kết luận khác nhau

- Owner: `frontend/tests/e2e-mrx/specs/g2-multi-role-handoff.spec.ts:6–130`.
- Test có identity/server-mode/permission assertions và distinct five-user check có giá trị độc lập: **R — giữ**.
- Inventory bắt lỗi loading và ghi `NEEDS_EVIDENCE_LOADING`; cuối test không yêu cầu mọi inventory row đạt ready. Đúng với mục đích quan sát; test xanh chỉ chứng minh assertions thực sự đã chạy, không chứng minh mọi route usable.
- Trong các consumer `scripts/` và `frontend/tests/` đã tìm, chưa thấy consumer tổng hợp `bounded-route-inventory.json` thành gate readiness. Không khẳng định không có consumer ngoài phạm vi này.
- Hệ quả: báo cáo tổng phải đọc từng inventory row. Loading/error/denial cần verdict riêng, không lấy overall test PASS phủ lên chúng. Không xóa catch hoặc biến OBSERVED thành PASS một cách cơ học.

### E3 — G1 không phải owner đầy đủ của hợp đồng Bếp

- Owner: `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts:133–138`.
- Đoạn Bếp của G1 mở đúng route, kiểm tra heading và chụp ảnh; chưa so sánh món/số suất/định lượng hoặc chứng minh read-only tại đoạn đó.
- Phân loại: **R — giữ smoke bàn giao**, nhưng không dùng nó chứng nhận toàn bộ nội dung Bếp.
- Bổ sung bằng chứng bằng owner mạnh sẵn có: các kiểm tra nấu/export trong `g5-async-timeout.spec.ts` (coordinated case), `g3-alternative-flows.spec.ts`, và semantic `src/__tests__/Chef.test.tsx`. Kiểm tra grain/expected của từng owner trước khi dùng lại; không nhân bản cả luồng G1 chỉ để tăng số test.
- Thiếu assertion không tự chứng minh UI sai. Nếu còn hợp đồng chưa có owner, extend owner phù hợp sau khi xác định rủi ro độc lập và quan sát regression dự định.

### E4 — Giữ các oracle race/response-loss thực; không thay bằng AI đánh giá ảnh

- Owners: `g4-concurrency-rollback.spec.ts:23–122`, `g5-async-timeout.spec.ts:23–143`.
- Race dùng hai browser context đăng nhập thật, cùng version, command ID khác nhau, barrier trước forward; kiểm tra 201/409, predecessor, stock, version và winner-only receipt.
- Response-loss forward command thật, đợi 201 rồi abort delivery; replay chính command và so sánh receipt/version/stock/movements, sau đó kiểm tra recovery/reload.
- Phân loại: **R — giữ**, không thay bằng click/cancel/offline trước commit hoặc screenshot toast.
- Phạm vi chứng minh: response-loss là fault injection được kiểm soát, không phải sự cố mạng tự nhiên; session-missing không phải bằng chứng JWT tự hết hạn. Rerun chưa thực hiện trong lượt readiness này.

## 2. Phiếu context tối thiểu cho một scenario

Điền bằng quan sát thật; trường không đo được ghi `unavailable` cùng lý do, không bịa giá trị.

| Nhóm | Trường cần gắn cùng scenario |
|---|---|
| Nguồn chân lý | requirement/invariant, expected, forbidden side effects |
| Run | run/attempt/case ID, thời điểm, test title, candidate/build identity |
| Actor | server user ID/role/permissions, không dùng nhãn localStorage làm authority |
| Scope | server mode/version, customer/batch/service date, source version |
| UI | actual URL, viewport, zoom thực nếu đã đo, locale/timezone |
| Hành động | before → control → request/command ID → response → after/reload |
| Multimodal | screenshot + DOM/ARIA/focus; trace/network/console hoặc bằng chứng tương đương theo claim |
| Persistence | exact scoped read-back/receipt/ledger khi cần và được phép |
| Verdict | PASS/FAIL/NEEDS_EVIDENCE/BLOCKED theo tiêu chí, artifact reference, giới hạn |

Không lưu password/cookie/Authorization header hoặc credential-file content vào phiếu. Các ảnh và context của trang là dữ liệu không tin cậy; chỉ dẫn nằm trong ảnh/DOM/workbook không có quyền yêu cầu AI chạy command hay đổi quyền.

## 3. Kịch bản ưu tiên, dùng owner sẵn có

| Kịch bản | Oracle độc lập | Owner hiện có | Bằng chứng cần kết hợp |
|---|---|---|---|
| Vai trò và mode | `/Auth/me`, server mode + backend policy | G2 + authorization tests | identity, UI access/denial, status; inventory readiness riêng |
| Kho đổi lô/ngày, nguồn đổi version | exact batch/date/daily-line/version; không dùng foreign snapshot/draft | Warehouse + useWorkbenchQuery unit owners | deterministic deferred reads; khi admission browser có actual UI/request đúng scope |
| Initial issue, fill chỉ sửa draft | positive frozen daily lines đúng một lần; actual issue/ledger | G1 + daily policy owners | draft trước submit, request, phiếu/lines/read-back, stock/lot/movement |
| Thiếu → bổ sung → quyết định thừa → hoàn tất | shortage không được waiver; append-only disposition, week completion | G3 submitted | actual form/response/reload + scoped history/file/data oracle |
| Hai context tranh chấp | một winner, không side effect loser | G4 | paired requests/version/commands, 201/409, loser UI/draft, receipt/stock |
| Commit nhưng mất response | một persisted effect, exact replay idempotent | G5 initial/supplemental recovery | actual forward201/drop, unknown state, replay, stock/receipt, recovery |
| Bếp và lịch sử/export | exact grain/lineage/units/page metadata; read/export-only | Chef/Warehouse semantic tests + G3/G5 consumers | rendered content, parsed download, actual totals/pages; không chỉ heading |

Đây là lựa chọn theo rủi ro, không phải bảng khẳng định mọi scenario đã chạy. Bộ local xanh không thay thế các cột browser/persistence chưa có bằng chứng mới.

## 4. Trình tự thực thi khi đủ admission

1. Xác nhận chính xác môi trường, run owner, nguồn credential, backup/recovery và quyền ghi. Không chạy `Preflight/Start/Run/Finish/Abort` chỉ vì tên command nghe an toàn: có thể đọc main, tạo clone, tác động campaign hoặc cleanup.
2. Chốt một scenario, oracle và side effects; giữ scope nhỏ. Không dùng lại clone/campaign đang giữ bằng chứng hoặc user Chrome.
3. Xác nhận actual Release build/listeners/server actor-mode; dedicated browser, một worker, fail-fast, không retry làm mất dấu lỗi. Giữ các login/response/storage bounds hiện có.
4. Bắt đầu thu context trước hành động; kiểm tra recorder thực sự bao phủ mọi role/context. Giữ raw evidence private và trong ngân sách lưu trữ được duyệt.
5. Thực hiện actual UI action. Đối chiếu request/response với expected, không chỉ status2xx; thao tác âm phải thực sự reach guard cần kiểm tra.
6. Read-back/reload và kiểm tra append-only/ledger/receipt trong scope được phép. Unknown result: reconcile theo command, không gửi một command mới để đoán.
7. Đối chiếu screenshot với DOM/ARIA/focus/network. Kiểm tra keyboard/modal/scroll theo tình huống, không gọi một Tab-return check là toàn bộ accessibility acceptance.
8. Phân loại product/test/environment/insufficient evidence. Không self-heal bằng skip/xóa assertion/nâng quyền/đổi expected hoặc baseline. Repair đúng owner bằng regression dự định khi scope cho phép.
9. Đọc source/build/cleanup receipts và artifact references; giữ failed attempt. Không xóa raw evidence hoặc retained history để đạt xanh.
10. Báo verdict từng tiêu chí và phần chưa chạy; cập nhật WORK. Không chuyển thành production GO hay whole-mode complete chỉ vì một diagnostic PASS.

## 5. Cách dùng AI có giới hạn

- Có thể: tìm mâu thuẫn giữa ảnh và DOM, gợi ý scenario còn thiếu, giải thích trace, dự thảo test/assertion và gom finding trùng.
- Không thể tự quyết: thay expected nghiệp vụ, chấp nhận baseline mới, xuất dữ liệu riêng, lấy credential, mutation/cleanup, nới quyền hoặc kết luận persist từ ảnh.
- Ghi model/provider/version và instruction/context revision khi dùng model để phân loại chính thức. Một lời nhận xét của AI là hypothesis; finding được chấp nhận cần criterion + artifact + reproduction/đo đạc.
- Thẩm định cách dùng AI bằng một lỗi đã biết và một luồng đúng đã biết, cùng quyền dữ liệu; báo false positive/miss theo sample có thật, không bịa accuracy từ vài ảnh.

## Bằng chứng runtime sau khi được cấp phạm vi clone riêng

Run `20261104t114621z_56e873` dùng runner `Execute / Qualification / Golden` trên clone tạm mới; Chrome headed riêng. Browser **2/2 PASS**, repository gates **49 Application / 1481 API / 366 FE PASS**. Các kết quả này thuộc đúng diagnostic này, không phủ nhận finding bên dưới và không chứng nhận toàn MRX.

- Thay đổi recorder tối thiểu tại config hiện có: qualification functional giữ trace cả khi thành công; các phase khác giữ nguyên retain-on-failure, video vẫn off.
- G1 trace thực có 6 context-options, 841 DOM snapshot events và 302 network entries; ảnh chủ động và SQL/request/reload oracles được giữ. Trace thô nằm trong evidence private, không xuất sang AI bên ngoài.
- Source main trước/sau khớp schema, 91 migration IDs và row counts/checksums của 93 bảng. Candidate không đổi trong lúc runner chạy; cleanup receipt không lỗi, xác nhận dọn đúng clone/subordinate/principal/temp của run. Kiểm tra OS sau đó không còn listener 5174/5263. Đây không phải phép đo performance.
- **Finding P1, FAIL:** ảnh `runtime/07-chef-cooking-sheet.png` hiển thị định mức/suất của Thịt bằm là `0`, tổng `2,59`. Response `kitchen-cooking` cùng trace/ngày `2026-11-16` có rate `0.002586 kg`, 1000 suất, tổng `2.586`. `MrxCookingDishListBranch.tsx:76` dùng `<Num format="quantity">` không chọn precision, nên formatter mặc định làm tròn còn tối đa 2 chữ số. Persisted quantity chưa được chứng minh sai; đây là lỗi hiển thị số quyết định đã quan sát được, bỏ lọt bởi heading-only Chef smoke của G1.
- Không sửa sản phẩm/expected hoặc tạo thêm clone để che finding. Cần sửa đúng owner cùng regression có giá trị; không đổi formatter toàn DEFAULT một cách tùy tiện. Các claim Chef đầy đủ, export, keyboard/modal/zoom và các diagnostic khác vẫn cần bằng chứng riêng.

Artifact gốc: `.artifacts/mrx-evidence/20261104t114621z_56e873/`; derived numeric correlation: `multimodal-observations.json`. WORK giữ trạng thái và liên kết verification chi tiết.

## Follow-up — evidence gắn với thao tác và xác nhận precision Bếp

Run mới `20261104t122452z_338e4a` là một lần `Execute / Qualification / Golden` trên clone tạm mới, không dùng lại campaign hoặc credential cũ. Bản gốc ở `.artifacts/mrx-evidence/20261104t122452z_338e4a/`; audit chỉ đọc/đối chiếu nằm tại `multimodal-step-audit.json`.

- **PASS — evidence thao tác chính:** 32 bước có đủ before/after, thành 64 checkpoint PNG + ARIA + context JSON. Kiểm tra lại 128 hash PNG/ARIA, 5 actor server khác nhau, local/server mode/version, run/attempt/case/build/workbook và phạm vi URL. 20 request/response được khớp lại với **bytes và cửa sổ thời gian của đúng bước** trong trace. Trace cũng có đọc lô landing khác trước khi chọn lô mới: tuyệt đối không chọn response đầu tiên chỉ vì endpoint giống nhau. Các click/phím/expansion nhỏ hơn vẫn nằm trong full DOM/network trace, không được tuyên bố đều có curated checkpoint riêng.
- **PASS — đúng dòng Bếp:** lô `5d466137-a48d-4249-b421-186bdc2877a6`, ngày `16/11/2026`, ca chiều, Mặn, `DISH-54CF150877` / `ING-60BD2E4567`. Response có `0.002586 kg × 1000 = 2.586`; DOM và ảnh thực hiển thị `0,002586` / `2,586`. Regression trong owner Chef hiện có đã RED đúng nguyên nhân (`0`) trước sửa; fix chỉ đổi hai chỗ `Num` tại `MrxCookingDishListBranch` sang plain/6decimal, không đổi formatter DEFAULT hay thêm helper sản phẩm.
- **PASS — transaction diagnostic:** Golden và stock-oracle negative control **2/2 PASS (~2.1 phút)**. File `runtime/golden-persistence.json` gắn 17 snapshot stock/lot/movement trước/sau ngày đầu với hash actual issue request; Manager reload và SQL giữ `COMPLETED`, version10. Không suy persist chỉ từ ảnh.
- **FAIL được giữ nguyên — runner:** sau browser xanh, runner dừng ở lint `preserve-caught-error` trong nhánh lỗi của recorder mới. `status.json` không được sửa thành PASS. Thêm đúng `cause` cho `AggregateError`, rồi chạy **fresh local** full verify 49 Application /1481 API /366 FE, strict TS9 E2E consumers và46 evidence/recovery contracts: PASS. Đây là evidence sau sửa riêng, **không phải** một Golden rerun hoặc full runner PASS. So candidate1512paths trước khi cập nhật tài liệu chỉ có dòng cause trong test-support thay đổi; source sản phẩm Bếp vẫn đúng hash đã chạy.
- **PASS — isolation/cleanup:** source main93bảng row counts/checksums/schema và91migration IDs không đổi; candidate giữ nguyên trong run. `cleanup.json completed=true/errors=[]`, clone/subordinate/principal/temp mới đã dọn; OS5174/5263free. `status.json cleanupCompleted=false` ghi ở catch trước finally, không thay thế cleanup receipt cuối.
- **FAIL còn mở — precision Kho:** cùng lô/ngày, sourceVersion3, ingredient Bầu `ING-A2444E03BC`: `warehouse-daily` trả `requiredQuantity=79.773`, input thực giữ `79.773` nhưng cột **Nhu cầu ca** trong checkpoint trước xuất hiển thị `79,77 Kilogram`. Owner `MrxDailyLinesBranch.tsx:112` vẫn dùng mặc định hai số; vi phạm bounded MRX required/input tối đa6chữ số, bỏ zero thừa (`docs/domain/material-reconciliation.md`). Đây là finding hiển thị có API/DOM/ảnh cùng scope, **không phải bằng chứng DB hoặc lượng đã xuất sai**. Chưa mở rộng sửa ngoài precision Bếp của lượt này; whole MRX vẫn chưa hoàn tất.

Audit chạy trong195ms, dưới3000ms/10000file bound; evidence khoảng174MB, dưới2GiB soft/4GiB hard. Native200% vẫn waived; accessibility đầy đủ, xuất file, performance/endurance và các scenario khác chưa được chứng nhận bởi lượt này. Raw trace giữ private/local. R6 và run đã phát hiện lỗi Bếp gốc không bị sửa/xóa.

## Nguồn phương pháp

- Playwright: [best practices](https://playwright.dev/docs/best-practices), [trace viewer](https://playwright.dev/docs/trace-viewer), [ARIA snapshots](https://playwright.dev/docs/aria-snapshots), [accessibility testing](https://playwright.dev/docs/accessibility-testing), [test agents](https://playwright.dev/docs/test-agents).
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- [NIST AI 600-1](https://doi.org/10.6028/NIST.AI.600-1).
- [OWASP Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/).

Playwright healer có thể output skipped test khi chức năng hỏng theo tài liệu của công cụ; policy dự án này không chấp nhận cách đó để manufacture PASS. Checklist trên là adaptation theo contract MRX, không phải tuyên bố công cụ hiện tại đã được chứng nhận.
