# MRX Performance Qualification Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task after approval. Use the repository gates and keep one writer per workspace. Follow the checkboxes and record outcomes in `.planning/WORK.md`.

**Goal** Lập baseline có số đo và bằng chứng nghiệp vụ cho MRX với Release build, MySQL clone, 5 vai trò và 3 khách.

**Architecture** Runner hiện có quản lý vòng đời clone và danh tính. Playwright thu bằng chứng trên UI và kiểm lỗi mạng, k6 đo tải HTTP độc lập, MySQL và tệp tải thực xác nhận kết quả.

**Tech stack** PowerShell, .NET Release, MySQL, React/Vite, Playwright/Chrome, UniKey Windows, k6.

**Spec** [Đặc tả kiểm thử hiệu năng và phục hồi MRX](../specs/2026-11-27-mrx-performance-qualification-design.md).

## Ràng buộc

- Chạy đợt đầu sau khi phạm vi thực thi được duyệt. Mọi phép ghi dùng clone thuộc phiên. Thực hiện preflight trước Execute, giữ RBAC, rate limit, mode và chính sách DB. Kết quả phân theo cùng bản chạy, bộ dữ liệu và điều kiện đo.
- Chỉ xếp `PASS` khi có số đo và bằng chứng dữ liệu đúng. Kết quả cache, 429, ca đối chứng 409 và sai thao tác nghiệp vụ có mẫu số riêng.
- Đầu ra đợt đầu là baseline. T7 là thiết kế đợt mở rộng và cần quyết định mới trước khi chạy. Chưa chạy lại migration, kiểm tải hay thay đổi nghiệp vụ trong lượt soạn plan.

## File và hợp đồng bàn giao

| Chủ sở hữu | Trách nhiệm |
| --- | --- |
| `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`, `scripts/mrx-evidence/MrxEvidenceSafety.ps1` | Admission, hash candidate, Release build, clone và tài khoản thuộc phiên, phase, teardown. Dùng selector hợp lệ của runner. |
| `tools/perf/k6/mrx-five-user.js`, `tools/perf/k6/lib.js`, `tools/perf/RUNBOOK.md` | Tải HTTP theo vai trò, cảnh báo an toàn, hợp đồng tham số bắt buộc và báo cáo. |
| `frontend/tests/e2e-mrx/specs/g4-concurrency-rollback.spec.ts`, `g5-async-timeout.spec.ts`, `mrx-export-consistency.spec.ts` cùng thư mục | Kiểm tranh ghi, mất phản hồi và xuất Excel đúng dữ liệu. |
| `frontend/tests/e2e-mrx/specs/g7-data-path-performance.spec.ts`, `g7-desktop-memory.spec.ts`, `g8-five-user-endurance.spec.ts`, `frontend/tests/e2e-mrx/core/qualificationMetrics.ts` | Owner hiện có cho định lượng luồng, desktop, bộ nhớ và tải phối hợp. |
| `frontend/src/routes/routeRegistry.ts`, `frontend/tests/browser/mrx-interactions-responsive.spec.ts`, `mrx-audit-journal.spec.ts` cùng thư mục | Danh mục màn MRX, kiểm tương tác và điều hướng. Dùng helper đang có. Chỉ mở rộng kiểm thử tại chủ sở hữu phù hợp. |
| `frontend/scripts/perf-probe-metrics.test.mjs`, `frontend/scripts/check-route-budgets.mjs` | Kiểm phép tính số đo và ngân sách gzip Vite theo route. |
| `.artifacts/mrx-evidence/<runId>/`, `.planning/WORK.md` | Đầu ra bằng chứng theo phiên và trạng thái công việc chính thức. |

Hồ sơ đầu vào cho một lượt chạy ghi `runId`, `sourceHead`, `workingTreeSha256`, `buildHashes`, `baseUrl`, `database`, `mode`, cấu hình và đích hiệu lực. Manifest dữ liệu ghi danh tính đã che thông tin, customer/batch/week/date, lượng dòng theo bảng, loại hồ sơ, checksum trước kiểm và các chỉnh sửa thử. Dòng số đo cần `caseId`, vai trò, thao tác, lớp request, điều kiện máy/cache/mạng, số mẫu, thời gian, trạng thái HTTP, khóa phạm vi đã ẩn hoặc mã hóa, và đường dẫn đối chiếu. Manifest ghi rõ lớp dữ liệu nghiệp vụ 3 khách và lớp dữ liệu lịch sử lớn nếu có.

## Trọng tâm review

- T1 kiểm thông số đích và danh tính để tránh lấy bản chạy nhầm làm bằng chứng 5 người.
- T2/T4 kiểm phản hồi sai phạm vi, lô rỗng, lỗi sau commit, thao tác lặp và lệch tổng Excel.
- T3 kiểm đúng đường gõ qua UniKey và thời điểm màn hình sẵn sàng. Mục tiêu thiếu marker ghi rõ giới hạn.
- T5 phân loại 429 và lượt không gửi được, báo p95/p99 kèm số mẫu.
- T6 kiểm nguồn và tài nguyên sau thử. Thiếu bằng chứng dọn dẹp chặn chốt phiên.

## T0 · Khóa phạm vi và preflight

**Phụ thuộc** Phê duyệt phạm vi baseline. **Đầu ra** Hồ sơ sẵn sàng đo.

- [ ] Đối chiếu `DOMAIN`, `DESIGN`, `ENGINEERING`, `OPERATIONS`, hồ sơ tình huống xấu và `.planning/WORK.md`. Ghi commit/working tree, phần chỉnh sửa kế thừa, công cụ có sẵn và điều kiện 5 vai trò, 3 khách. Chốt thứ tự, thời lượng tải đọc 10 phút, các ca ghi riêng và trường hợp dừng.
- [ ] Chọn snapshot trước đo đủ ANV, DAV, FU cùng tuần, lô hoạt động, lô hoàn tất và khách/tháng trống. Nếu nhập lại file trong clone, tách thời gian setup khỏi số đo, lưu biên nhận thay đổi thử và đối chiếu hai cửa sổ dữ liệu.
- [ ] Đối chiếu helper an toàn, xác nhận runner và selector từng lượt. Các selector `MenuIntegrityPerformance`, `SourceAtomicity`, `ExportConsistency` yêu cầu Qualification mới với Preflight/Execute. `Run` theo `CampaignId` chỉ nhận selector chức năng được phép. Tuyệt đối không gắn selector đo tải vào campaign giữ lại khi chưa được runner hỗ trợ.
- [ ] Sau duyệt thực thi, chạy preflight cho selector đầu tiên. Mẫu chạy từ repo root:

```powershell
pwsh -NoProfile -File scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1 -Mode Preflight -Profile Qualification -Diagnostic Admission
```

- [ ] Kiểm preflight và manifest xác định đích riêng, Release/API dist, mode, danh tính, độ sẵn sàng và tài nguyên. Nếu thiếu dữ liệu, công cụ hoặc quyền, ghi đúng `BLOCKED`/ `NEEDS_EVIDENCE` của phép kiểm và tiếp tục phần độc lập.

## T1 · Chuẩn bị bộ đo và ngăn kết quả sai phạm vi

**Phụ thuộc** T0. **Đầu ra** Bộ đo kiểm được cấu hình, phạm vi, sample và loại kết quả.

- [ ] Kiểm đường chạy k6 cũ. `mrx-concurrency.js` dùng chung một token, nên chỉ phân loại như tải một danh tính. Soạn kiểm tra tĩnh cho biến thông tin xác thực bắt buộc, mode và đích khai báo. Kiểm ca thiếu biến, sai DB/URL, trùng danh tính và response có HTTP 200 sai mode trước khi gọi tải.
- [ ] Nếu còn fallback mật khẩu trong `tools/perf/k6/lib.js`, bỏ giá trị và yêu cầu tham số riêng theo runbook. Giữ `mrx-five-user.js` với đích và chế độ đã xác thực. Tách báo cáo 429/409/timeout và số request thực. Mức tải nặng có hồ sơ duyệt riêng.
- [ ] Chạy test của bộ số đo và an toàn runner. Nếu cần sửa test/harness, chứng minh RED cho ca sai, GREEN với thay đổi nhỏ nhất. Đặt thông tin đăng nhập ở cơ chế bí mật của runner, soát log và bản ghi trước chia sẻ. Giữ bằng chứng đọc nguồn trước kiểm.

```powershell
npm run test:perf-contract --workspace frontend
```

## T2 · Baseline chức năng và so dữ liệu ba khách

**Phụ thuộc** T0–T1. **Đầu ra** Ma trận quyền, dữ liệu và bộ đối chiếu dùng trong T3–T5.

- [ ] Kiểm danh tính, mode, quyền và các route/leaf MRX theo `routeRegistry.ts`. Xác minh deep link, quay lại, trạng thái trống, lỗi/thử lại, thiếu quyền, dữ liệu một phần và xác nhận ghi ở các màn có các trạng thái này. Liên kết ca hoặc nêu điều kiện không áp dụng.
- [ ] Chạy luồng Kiểm tra định lượng → bàn giao → xác nhận xuất → xem phiếu → đọc sau tải lại. Ghi mã lô, số dòng, phiên bản và danh tính. Đối chiếu phần dữ liệu không được thay đổi và so quyền đọc/ghi thật.
- [ ] Dùng `ExportConsistency` khi hồ sơ dữ liệu phù hợp. So từng khách và gộp cả ba với MySQL độc lập theo mã nguyên liệu/ĐVT/NCC, phạm vi ngày/tuần và tổng, gồm mục Chưa phân nhóm. Kiểm file tải thực và thứ tự khách. Cùng bước kiểm chi tiết phiếu và đối chiếu lịch sử trước/sau.
- [ ] Đánh dấu `FAIL` khi sai phạm vi, sai dữ liệu, xuất trùng hoặc lỗi quyền. Giữ đường tái hiện đúng hành vi và tiếp tục nhóm đủ điều kiện độc lập.

## T3 · Đo frontend và kiểm thao tác thật

**Phụ thuộc** T2 cho mỗi luồng. **Đầu ra** Số đo lab theo route, thiết bị và điều kiện cache.

- [ ] Kiểm nhanh toàn bộ route MRX trên Release. Đo sâu Rà soát, audit hai tab, Định lượng, Xuất kho ngày, Chuẩn bị & xuất Excel, Phiếu nấu và Catalog/BOM. Lặp trên desktop 1440 và mobile 390. Ghi profile, lần mở mới và quay lại với cache.
- [ ] Dùng G7 Data Path với selector `MenuIntegrityPerformance` khi thỏa dữ liệu và phạm vi, hoặc đọc lại chủ sở hữu phép đo để bổ sung nhóm ca vào đúng lane. Giữ mốc bắt đầu, khóa route/scope, paint khung đúng, dữ liệu đúng và thời gian đến trạng thái cuối. Nếu phép đo chỉ có response + network idle, giữ `NEEDS_EVIDENCE` cho các marker. Tránh slowMo ở phần định lượng. Ghi số mẫu thô; G7 hiện có lấy 20 mẫu warm và 5 fresh-context mỗi route.
- [ ] Kiểm native Windows UniKey theo FE-04 và composition riêng. Đo ký tự thật, caret, tìm chậm/nhanh, xóa, khớp kết quả, URL/API đã ổn định và focus. Dùng scope trống/đang tải để kiểm trạng thái giữa hai lần đổi khách. Kiểm mở/đóng modal và khóa nút khi pending.
- [ ] Dùng Chrome Performance/Memory cho bảng trên 50 dòng, thao tác cuộn và motion. Chạy kiểm ngân sách route sau build. Ghi khác biệt nếu baseline của ngân sách vượt chuẩn. Chỉ đề xuất tách bundle khi xác định được chunk và luồng bị tác động.

```powershell
npm run build:fe
npm run check:route-budgets --workspace frontend
```

## T4 · Mạng, cạnh tranh và phục hồi

**Phụ thuộc** T2. **Đầu ra** Trace lỗi có chủ đích và đối chiếu trạng thái trước/sau.

- [ ] Dùng profile mạng chuẩn và chậm với độ trễ, tải lên/xuống đã ghi trong manifest. Trì hoãn GET A cho đến khi B thành công. Xác nhận chỉ B hiển thị, thời điểm trạng thái trống và khóa các thao tác cũ. Kiểm chuyển nhanh khách/lô kế tiếp và nhấn Refresh trong khi GET đang chạy.
- [ ] Kiểm offline/trước gửi, lỗi 409 và mất phản hồi sau commit. Dùng lại ca `Race`, `Recovery`, `SupplementalRecovery` của runner và G5 hiện có. Đo thời gian từ lỗi đến lúc có kết quả đúng, số lần gửi và số bản ghi sau tải lại. Lỗi 401 theo hợp đồng phiên hiện hành và có kiểm phân quyền riêng.
- [ ] Đối chiếu receipt, số phiếu, audit, phiên bản, số lượng, nguồn lô và tồn kho vật lý. Ghi chính xác lỗi ở trước gửi, sau gửi nhưng chưa xác minh commit, hoặc xác nhận đã commit trước khi cắt phản hồi. Ngăn lặp request từ thao tác click nhiều lần.

## T5 · Tải 5 danh tính, profiling và quan sát

**Phụ thuộc** T1–T2. **Đầu ra** Baseline HTTP Release và danh sách truy vấn có bằng chứng.

- [ ] So đường chạy `Quantitative` và `@G8-HTTP`. `Quantitative` hiện lên lịch cả endurance mặc định 3.600 giây. Baseline được đề xuất chỉ chạy HTTP 5 vai trò/10 phút. Nếu runner chưa có đường chọn riêng, thêm selector giới hạn sau khi duyệt, kiểm dispatcher/admission trước, hoặc dùng cách chạy do owner duyệt trong runner. Tuyệt đối không chạy cả `Quantitative` chỉ để lấy bài 10 phút.
- [ ] Smoke rồi chạy lane HTTP. Tách cửa sổ k6, browser thao tác và profiler để quy trách nhiệm tài nguyên. Thu p50/p75/p95/p99, RPS, số mẫu, timeout, 429, 5xx, DB connections/wait nếu có và CPU/RAM của cả trình phát tải lẫn host. Ghi thêm kích thước phản hồi đối với API dữ liệu lớn.
- [ ] Chọn hotspot theo số đo. Đối chiếu log correlation và quan sát DB bằng quyền đã duyệt. Đọc SQL diagnostics trước khi chọn lệnh vì script bật chẩn đoán hiện có tác động toàn instance và xóa bộ đếm. Ưu tiên số đo đọc trên đích đã duyệt. Dùng kế hoạch truy vấn cùng thời gian thực thi có dữ liệu trước khi đề xuất chỉ mục.
- [ ] Xác minh tín hiệu synthetic bằng một lượt đọc thử `/health/live`, JSON `/health/ready` và một hành trình MRX đã xác thực. Ghi status/checks, thời gian và mã lỗi. Lập lịch hoặc thêm collector là bước vận hành riêng.

## T6 · Kiểm chéo, xử lý phát hiện và chốt baseline

**Phụ thuộc** T2–T5. **Đầu ra** Báo cáo baseline theo ca, với kết luận chức năng và hiệu năng.

- [ ] Phân loại lỗi sản phẩm, môi trường, dữ liệu và harness. Với lỗi sản phẩm, tái hiện ở luồng thật, sửa tại owner, thêm test cho đúng triệu chứng, chạy lại ca lỗi và ca lân cận trên candidate có hash mới. Đo lại trên điều kiện tương đương.
- [ ] Chạy build/lint/kiểm thử liên quan nếu có thay đổi. Chạy `npm run verify` theo gate chất lượng dự án cho candidate cần chốt. Chỉ mang bằng chứng của cùng candidate vào báo cáo kết quả mới.
- [ ] Xác minh nguồn trước/sau, đúng đích dọn dẹp và tài nguyên phiên. Ghi kết quả cho từng mã trong spec, rủi ro còn mở, tài liệu/checksums và mức nào đủ điều kiện so sánh lại. Cập nhật `.planning/WORK.md`, đưa trạng thái về IDLE khi đã hoàn tất phần phạm vi được duyệt.

## T7 · Phương án mở rộng sau baseline

**Phụ thuộc** T6 và phê duyệt vận hành mới. **Đầu ra trước khi chạy** Hồ sơ tải được phê duyệt.

- [ ] Từ baseline và số liệu sử dụng, chốt số phiên, người hoạt động, số khách/tuần/dòng lịch sử, tỷ lệ đọc/ghi/xuất, phần tranh cùng lô, trần RPS/kết nối, thời lượng/nấc và ngưỡng dừng hoặc phục hồi. Liệt kê stop ngay với dữ liệu sai hoặc readiness mất. Mức 20 người hoạt động và 50 tài khoản là ứng viên cần đối chiếu, không phải giả định tải đợt đầu.
- [ ] Duyệt và chạy lần lượt spike đầu ca, stress theo nấc và soak có cửa sổ nghỉ. Ghi tải đề nghị/gửi được/thành công, `dropped_iterations`, p95/p99 theo nhóm, sự cố và thời gian phục hồi. Đối chiếu phiếu, audit, Excel và DB sau mỗi bài có ghi.
- [ ] Sau xác nhận môi trường và quyền, mới chốt lịch synthetic, cảnh báo, chính sách RUM, sampling, thời hạn lưu và quyền truy cập. SLO theo tháng dùng bằng chứng môi trường vận hành theo `OPERATIONS`.

## Ma trận truy vết

| Tiêu chí spec | Task | Bằng chứng tối thiểu |
| --- | --- | --- |
| API-01/02 | T0, T1, T5 | Manifest đã xác nhận đích, 5 actor, smoke và báo cáo k6. |
| API-03/04/05 | T7 | Hồ sơ đã duyệt, trace từng bài, số đo phục hồi và đối chiếu ghi. |
| API-06 | T5 | Liên kết request/log/SQL, phụ lục file xuất. |
| FE-01/02/03/04/05 | T2, T3, T4 | Danh mục route, trace, số đo, file tải, kết quả native UniKey, budget. |
| NET-01/02/03/04 | T2, T4 | Trace lỗi và bằng chứng trước/sau, phiếu/receipt/audit/Excel. |
| OBS-01 | T5, T7 | Health và hành trình đọc thử, hồ sơ lịch/RUM riêng khi có. |
| Chốt baseline | T6 | Báo cáo theo ca, xác minh nguồn, dọn dẹp và trạng thái WORK. |
