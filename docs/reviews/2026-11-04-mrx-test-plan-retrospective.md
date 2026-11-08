# MRX — Rà soát kế hoạch kiểm thử và các lifecycle đã chạy

**Ngày chụp audit:** 2026-11-04. **Phạm vi:** bốn kế hoạch MRX gần đây, packet R6, ba lượt Task8 mới nhất, các chẩn đoán memory/endurance liên quan và dung lượng `.artifacts`.

> Đây là báo cáo hồi cứu từ bằng chứng đã có, không phải nơi quản lý trạng thái tác vụ. [`.planning/WORK.md`](../../.planning/WORK.md) vẫn là chủ sở hữu trạng thái duy nhất. Owner yêu cầu **tạm dừng; không test/build/campaign thêm**. Việc kiểm tra SHA/ZIP phục vụ bảo toàn dữ liệu khi dọn file, không phải lượt qualification mới.

## 1. Kết luận dễ hiểu

1. **Đã có một lượt lifecycle đầy đủ 15/15 PASS**, không phải các luồng chưa bao giờ được chạy. Đó là R6 `20261103t152953z_7b5e89`, kéo dài 17,6 phút, trên candidate lịch sử `7D0AC5C8…`.
2. Sau thay đổi **Excel nghiệp vụ + UI**, ba lượt xác nhận mới đều qua sáu case đầu, rồi dừng ở G3 do ba giả định/đọc dữ liệu sai trong harness. Vì fail-fast, **tám case cuối chưa được chạy lại trên candidate mới**. Không được lấy PASS cũ gộp với kết quả mới thành một lượt 15/15.
3. Lifecycle nghiệp vụ, xác nhận file Excel mới và qualification tải/hiệu năng là ba câu hỏi khác nhau. **Chưa đủ bằng chứng production/release**; điều này không xóa kết quả R6 lịch sử.
4. Không có lượt test, build, lint, preflight, browser, DB hay campaign nào được chạy để tạo báo cáo này. Không sửa thêm source/test; giữ nguyên bản sửa một assertion từ phiên trước.

## 2. Bốn kế hoạch liên hệ thế nào?

| Kế hoạch | Trách nhiệm | Đánh giá theo bằng chứng tại thời điểm audit |
|---|---|---|
| [Five-User Production Qualification](../superpowers/plans/2026-11-02-mrx-five-user-production-qualification.md) | Plan cha: runtime an toàn, lifecycle, 5 danh tính, desktop/memory, endurance và HTTP, cuối cùng release handback | Các nền tảng/lifecycle đã có bằng chứng; không phải toàn bộ qualification hoàn thành |
| [Lifecycle Scope Lock](../superpowers/plans/2026-11-03-mrx-lifecycle-scope-lock.md) | Khóa hữu hạn LC-01…LC-12, không thay nghiệp vụ bằng zoom/load | **R6 lịch sử đã đóng 12/12 tiêu chí trên đúng candidate của nó** |
| [Single-Clone Audit/Repair](../superpowers/plans/2026-11-03-mrx-single-clone-audit-repair.md) | Một clone xuyên campaign; inventory → sửa → R6; giữ history và quyền actor | Cơ chế một clone và R6 đã vận hành; không cho phép Finish/Abort hoặc release tự động |
| [Excel and Station UI/UX](../superpowers/plans/2026-11-03-mrx-excel-and-station-ui-ux.md) | Tasks1–7: CSV security, login pacing, XLSX inputs/exports, workstation; Task8: candidate mới và bằng chứng thực | Tasks1–7 có triển khai/kiểm chứng local; **Task8 chưa accepted**. Native200% riêng Task8 được Owner miễn, không ghi PASS |

Các checkbox cũ trong plan hoặc đoạn lịch sử không có nghĩa phải thực hiện lại từ đầu. Phải đọc trạng thái mới nhất ở WORK và giữ ranh giới candidate. Bốn tài liệu là một cây công việc, không phải bốn chiến dịch kiểm thử độc lập cần chạy lại toàn bộ.

## 3. Các case lifecycle thực tế đã đi qua

**Cột R6:** lượt duy nhất `20261103t152953z_7b5e89`, 15/15 PASS, trên candidate lịch sử.

**Cột mới nhất:** `20261104t070545z_3ecb21`, 6 PASS / 1 FAIL / 8 chưa chạy, trên candidate `7D58F2C8…`. “Chưa chạy lại” ở đây **không có nghĩa chưa từng chạy**.

| # | Owner/case | Thao tác và điều được chứng minh | R6 | Mới nhất |
|---:|---|---|---|---|
|1|G1 Golden|Nhập Excel thực đơn → số suất → xem ảnh hưởng → gửi/duyệt nguồn → đóng băng → bàn giao Kho → xuất các ngày → Chef xem → Manager khóa tuần → reload|PASS|PASS|
|2|G2 Admission|Năm danh tính thật, quyền/mode từ server; Manager không bị thay bằng Admin|PASS|PASS|
|3|G2 Chef denial|Chef bị chặn khi vào trạm Kho|PASS|PASS|
|4|G2 Warehouse denial|Thủ kho bị chặn khi vào trạm Thực đơn MRX|PASS|PASS|
|5|G2 Coordinator scope|Điều phối được đọc lô nhưng không có quyền trạm quyết định/danh mục giải trình|PASS|PASS|
|6|G2 Admin routes|Admin vào đúng các trạm Đối soát, Thực đơn, Kho|PASS|PASS|
|7|G3 Submitted|Xuất thiếu không được miễn bằng quyết định; bổ sung1 → xuất thừa2 → sửa quyết định có history → Chef → Manager hoàn tất → lịch sử/chứng từ/báo cáo|PASS|**FAIL assertion Excel** sau khi đã hoàn tất/reload và tải completed + variance XLSX|
|8|G4 Supplemental race|Hai client Kho hợp lệ cùng version, hai command khác nhau; một winner, một conflict; stock/lineage không nhân đôi, draft/reload an toàn|PASS|Chưa chạy lại|
|9|G4 Stock oracle negative|Ingredient không tồn tại phải bị từ chối, không được biến thành “tồn bằng0 hợp lệ”|PASS|Chưa chạy lại|
|10|G5 Initial response loss|Server đã commit xuất đầu, chỉ response bị mất; replay đúng command không xuất kho lần hai; reload khôi phục|PASS|Chưa chạy lại|
|11|G5 Supplemental response loss|Tương tự cho xuất bổ sung; đúng một hiệu ứng stock/movement/command|PASS|Chưa chạy lại|
|12|G5 Session recovery|Submit thật khi mất session bị từ chối; cùng actor login lại và phục hồi draft đúng scope; stale/cross-user không được phục hồi sai|PASS|Chưa chạy lại|
|13|G5 Coordinated|Hai khách hàng thật dùng chung nguyên liệu; member cuối stale làm rollback toàn nhóm; command nhóm commit rồi mất response → replay đúng một lần; cả hai lô đi đến terminal|PASS|Chưa chạy lại; preparation XLSX mới chưa được xác nhận live|
|14|G6 Direct source edit|Từ chối/sửa/gửi lại/duyệt nguồn; ngày đã xuất không bị viết lại; source-apply đua với first-issue; tiếp tục xuất → Chef/file → Manager complete → history riêng|PASS|Chưa chạy lại|
|15|G6 Merged customer|Khách hàng dùng chung, bốn slot, distinct dish-ID, BOM tính một lần/số suất đúng; thiếu BOM được xử lý ở prerequisite hợp lệ; xuống Kho/Chef/export/completion/history|PASS|Chưa chạy lại trên bộ file/UI mới|

**15 là số case, không phải 15 luồng nghiệp vụ độc lập.** Chúng gồm các chuỗi nghiệp vụ dài, các kiểm tra RBAC và một negative control của oracle. Có thể nhìn thành năm chuỗi chính:

- Tuần đơn khách thông thường đến khóa sổ.
- Thiếu → bổ sung → thừa → quyết định → hoàn tất.
- Hai khách phối hợp, rollback/replay, hoàn tất riêng từng lô.
- Sửa nguồn trong khi giữ nguyên ngày/phiếu đã xuất, rồi hoàn tất.
- Khách dùng chung + bốn slot + BOM-once, xuyên suốt đến báo cáo.

Race, mất response và mất session là các nhánh lỗi bảo vệ những chuỗi này, không phải chỉ mở dialog rồi coi là thành công.

## 4. LC-01…LC-12 đã bao phủ gì?

Tất cả hàng dưới có **PASS trong packet R6 lịch sử**, không được đổi nhãn thành PASS của candidate Excel/UI mới.

| LC | Phạm vi thực tế | Owner chính |
|---|---|---|
|LC-01|Readiness; import lỗi không ghi; thiếu BOM và phục hồi hợp lệ|G6/import + bằng chứng invalid-import-no-write|
|LC-02|Bốn slot; distinct-ID; BOM-once; quantity chính xác|G6 merged + quantity-grain prerequisites|
|LC-03|Actor tách biệt; reject/correct/resubmit; Manager decisions; customer shared|G2 + G6 direct/merged|
|LC-04|Bàn giao nguồn đã nhận; xuất thật; stock/lot/movement lineage; reload|G1 + G6|
|LC-05|Không miễn xuất thiếu; bổ sung1; thừa2; correction append-only|G3|
|LC-06|Hai khách; stale-member atomic rollback; replay; hai terminal|G5 coordinated|
|LC-07|Ngày đã xuất/terminal guards; source/issue và supplemental races|G4 + G6 direct|
|LC-08|Chef đọc nguồn đã sửa và tải/parse CSV/XLSX thật, không mutation nghiệp vụ|G5/G6 Chef boundary|
|LC-09|Các ngày áp dụng; Manager riêng hoàn tất; history/register và exports tách scope|G3/G5/G6|
|LC-10|Mất response sau commit initial/supplemental/coordinated; precommit không có hiệu ứng|G5 + precommit transport evidence|
|LC-11|Mất token; cùng actor reauth; draft đúng scope; stale/cross-user denial|G5 Session|
|LC-12|Giữ dòng zero; conversion đã khai báo; conversion lỗi trả400|G6/prerequisite/retained-zero evidence|

Nguồn chuẩn: [packet R6](../../.artifacts/mrx-evidence/20261103t101725z_407a6d/acceptance/lifecycle.json), SHA256 `885E719898053ADE3D2C2325182DD3613D82BE2640339B3A80C30B7D180540B0`, 43 tham chiếu hash. Packet và các tham chiếu được giữ nguyên sau cleanup.

## 5. Ba lượt Task8 gần đây thực sự dừng ở đâu?

| Attempt | Kết quả toàn lượt | Điểm dừng | Phân loại và điều không được kết luận |
|---|---|---|---|
|`20261104t051512z_f1527c`|6 PASS /1 FAIL /8 chưa chạy;6,1 phút|Test đòi `+2 kg` trên tổng chứa nhiều đơn vị|Giả định harness cũ sai; UI đúng khi yêu cầu xem chi tiết theo đơn vị. Đồng thời ảnh thực lộ câu “tổng dòng” lấy scope ngày thay vì tuần, đã bỏ câu gây hiểu nhầm|
|`20261104t062236z_0da55f`|6 PASS /1 FAIL /8 chưa chạy;5,8 phút|Đọc `<t xml:space="preserve">` ra `System.Xml.XmlElement`|Lỗi decoder PowerShell của harness; sửa shared parser bằng InnerText, không sửa workbook đúng thành dữ liệu giả|
|`20261104t070545z_3ecb21`|6 PASS /1 FAIL /8 chưa chạy;5,7 phút|So chuỗi `"2"` với numeric XML `"2.000000"`|Lỗi assertion lexical; sửa đúng một assertion sang so số chính xác2. Parser cũ đã đi qua trong lượt này. Bản sửa assertion chỉ có RED→GREEN trên file thật đã tải, chưa có browser rerun|

Trong **riêng ba lượt này**, có 21 case executions (mỗi lượt7) nhưng chỉ chạm cùng bảy tên case; không phải45 case đã chạy vì mỗi lượt chỉ *select*15. Sáu case đầu bị lặp ba lần; 24 lượt-case được chọn nhưng không thực hiện do fail-fast. R6 là một mốc riêng, không cộng các con số này thành acceptance mới. Log lượt cuối còn một dòng tổng kết lỗi runner ngoài test, không có chẩn đoán tách biệt để gán thành một lỗi sản phẩm khác; log được giữ nguyên.

### Đánh giá chất lượng kế hoạch/thực thi

**Điểm tốt cần giữ**

- Oracle kiểm tra stock/lot/movement/command độc lập, không suy ngược opening từ ending để tự chứng minh.
- Cùng clone, scope tuần mới, history append-only; actor thật, không Admin hóa Manager; main chỉ đọc.
- Race hai client hợp lệ và commit-then-response-loss chứng minh được durable effect, không phải mock200 hoặc cố tình gửi version99999.
- Phân biệt local test, bytes file thật, browser step, toàn case và whole qualification; fail-fast không che lỗi bằng retry.

**Điểm kém/chi phí đã phát sinh**

- Harness chuyển từ CSV/số hiển thị sang XLSX nhưng chưa kiểm tra đầy đủ *attributed inline strings*, numeric scale và mixed-unit semantics trước lượt dài. Ba lần dừng ở cùng G3 là vấn đề readiness của harness, không phải ba bằng chứng sản phẩm tính sai.
- Lặp setup năm actor + sáu case đã qua làm phát sinh thời gian, tuần/lô lịch sử và hàng trăm MB trace mỗi lần. Giữ mọi raw representation song song final trace tạo duplicate thật.
- Full local gate gần nhất có Application49/API1480/FE340, safety46, harness44 PASS nhưng không bắt được assertion browser mới ở G3. **Không cộng các test local này thành số lifecycle case**, và không dùng chúng thay file/browser acceptance.
- Nhiều đoạn checklist cũ mang tính lịch sử làm khó đọc tiến độ; cần xem WORK mới nhất và packet theo candidate, không diễn giải checkbox cũ như “chưa từng chạy”.

**Khuyến nghị nếu Owner tự quyết định mở lại sau này — không phải lệnh chạy tiếp**

- Kiểm tra hết các assertion XLSX liên quan trên file thật đã giữ trước khi duyệt một lượt live tiếp theo; dùng owner hiện có, không mở thêm framework hoặc test chỉ soi source.
- Một phép thử chỉ chịu trách nhiệm một contract; không mở rộng lại memory/load/zoom để giải quyết lỗi parser/number.
- Chỉ final acceptance mới cần một selection candidate-bound hợp lệ; không nối các partial run. Lập ngân sách trace/retention trước admission, dùng bản đã hoàn tất làm keeper và loại duplicate theo byte ngay trong handback có quyền.
- Hiện tại **dừng hoàn toàn** theo Owner, không sửa thêm test để “đuổi xanh”.

## 6. Các phần chưa phải PASS sản xuất

| Phần | Đã làm thực tế | Chưa đủ gì |
|---|---|---|
|Memory|`20261102t183840z_e6f228`:30 vòng SPA/filter/modal/Escape, checkpoints0/10/20/30; documents1/nodes2387/listeners216 ổn định; heap khoảng7,44→8,23MiB|Chỉ workload/candidate cũ đó; không chứng nhận toàn app không leak, chưa đủ export-cancel/idle-control/managed retention|
|Năm user|G2 xác nhận năm danh tính; smoke `20261102t185750z_2c316f` được chạy|Smoke FAIL navigation30s; có GET dish khoảng28s và403 không phù hợp ở customer queries; chưa có PASS endurance60phút|
|HTTP/k6|Có consumer/runbook|Chưa có qualification riêng5VU và bộ percentile đạt yêu cầu; không đánh đồng với browser lifecycle|
|Session/JWT|Mất token, reauth, draft được R6 kiểm chứng|Không có nghĩa đã kiểm chứng expiry/revocation JWT thực|
|UI|Các scene bình thường và keyboard/focus có bằng chứng; lượt mới nhất9scene|Không phải mọi route/state/viewport; native200% Task8 được miễn chứ không PASS; không có chứng nhận performance từ screenshot|
|Excel/UI mới|Local owner tests và completed/variance XLSX thật đã đọc độc lập|Task8 chưa hoàn tất; audit/preparation/Chef export remainder của candidate mới chưa tới|
|Release|Main preservation/ownership và byte manifests có bằng chứng|Không có toàn bộ final qualification, off-host recovery, release/deploy approval|

**Không có claim mới** về Chef ghi nhận/ack/trả hàng, nhập trả vật lý, tự động đóng lô theo thời gian hoặc scheduler. Scope hiện tại Chef chỉ xem/export; không lấy test sửa timestamp giả làm auto-close.

## 7. Cleanup thực tế: giải phóng dung lượng, không vứt bằng chứng

Đơn vị GB dưới đây là decimal. Các số được đo trên file thực, không phải ước lượng và không phải chuyển sang folder khác.

| Mục | Dung lượng thu hồi trước metadata |
|---|---:|
|3 raw ZIP ở attempts `120544z_19b0cd`, `121726z_6c8bad`, `125743z_49286c`; toàn bộ10197 members trùng byte final trace đang giữ|448831616bytes|
|4685 loose raw files của `070545z_3ecb21`, mỗi file có bản byte-identical trong final trace|213228721bytes|
|Cache `.artifacts/dotnet/{bin,obj}/*/debug` và binaries build phụ `.artifacts/contract-build/{api,system-operation-capability/bin}`|336372689bytes|
|**Tổng gộp**|998433026bytes|
|**Thu hồi ròng sau khi thêm SHA/lookup receipts**|**990386633bytes ≈0,990GB**|

- `.artifacts`: **8229756333 →7239369700bytes** (8,230→7,239GB); **17147 →11050files**.
- Giữ nguyên byte của **11044 artifact files không phải target**, ngoài file lock đang được giữ độc quyền; giữ các thư mục Release bin/obj chính trong `.artifacts/dotnet`, metadata NuGet/restore và OpenAPI JSON.
- Giữ R6 và43refs, mọi final failure trace, ảnh/error context, source/build/outcome manifests, Excel, log, DB/DPAPI/credentials, backups và các bằng chứng độc nhất. Với raw mới nhất, **3209 file độc nhất vẫn còn**, không xóa cả cây.
- Mỗi raw path đã thu hồi có mapping đến **ZIP cuối + member + size/SHA256**. Original index/receipt vẫn giữ nguyên như bằng chứng lịch sử; đọc sidecar mới để tra vị trí hiện tại.
- Archive ff31c7 **895110174bytes ở `D:/IPCArchives/...` không bị đụng tới**, không được ghi là dung lượng vừa giải phóng.
- Không dùng `git clean/reset/restore`, không package install, không dừng process không liên quan, không DB cleanup. Cache Debug khi cần sẽ phải được tạo lại bởi một lần build được Owner cho phép sau này; audit này không build lại.
- Phần lớn dung lượng còn lại là **trace/bằng chứng độc nhất**. Không xóa chúng chỉ để đạt một con số đẹp hoặc làm mất first-RED/history.

Receipt: `.artifacts/mrx-evidence/20261103t101725z_407a6d/retention/20261104-owner-pause-dedup.json`.

Bốn sidecar `attempts/<id>/playwright-functional/raw-duplicate-location.json` mô tả lookup sau dedup. Đây là metadata vị trí dữ liệu, không ghi đè verdict/candidate hay lập task state thứ hai.

## 8. Bàn giao khi đang dừng

- **Historical business lifecycle:** đã có R6 15/15 và LC12/12, đúng candidate lịch sử.
- **Bản Excel/UI mới:** chưa accepted, có local fixes và output proof từng phần; tám case cuối chưa được xác nhận lại.
- **Production qualification:** chưa đủ memory/load/JWT/off-host/release evidence như nêu trên.
- **Hiện tại:** dừng test/build/runtime hoàn toàn theo Owner. Cleanup không tự cấp lại quyền admission; không có lịch tự chạy lại.
