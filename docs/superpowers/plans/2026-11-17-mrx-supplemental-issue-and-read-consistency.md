# Kế hoạch triển khai MRX — Xuất bổ sung và đồng bộ số liệu

> Thực hiện theo từng task bằng `superpowers:executing-plans` sau khi duyệt phạm vi. Duy trì trạng thái công việc trong `.planning/WORK.md`.

**Mục tiêu** — Kho xuất được từng nguyên liệu, người dùng đề nghị tăng suất nhanh và các màn hình phản ánh cùng kết quả thực xuất và còn thiếu.

**Kiến trúc** — Tái dùng phép chiếu xuất ròng và phân bổ hiện có để thống nhất các lượt đọc. FE làm mới theo phạm vi và giữ khung giao diện trong lúc chuyển hồ sơ. Luồng ghi và phiên bản tiếp tục do backend hiện tại kiểm tra.

**Công nghệ** — C#, EF Core, React, TypeScript, Vitest, Playwright, MySQL clone và Open XML.

**Spec** — [Xuất bổ sung và đồng bộ số liệu](../specs/2026-11-17-mrx-supplemental-issue-and-read-consistency.md)

## Ràng buộc chung

- Mọi task A1–A6 triển khai riêng cho MATERIAL_RECONCILIATION. Các owner dùng chung phải kiểm tra mode trước khi áp dụng hành vi mới. Chạy regression DEFAULT tại ranh giới dùng chung. Sổ xuất MRX và tồn kho vật lý là hai phạm vi nghiệp vụ riêng.
- Giữ nguyên số suất và BOM gốc đã đóng băng, các khóa ngày/lô, quyền theo vai trò và lịch sử Admin ghi trực tiếp.
- Dùng thành phần UI, token và mẫu trạng thái hiện có. Impeccable là bước kiểm duyệt FE trước chỉnh sửa và khi đối chiếu ảnh thực tế. Không thêm dependency hoặc migration cho thiết kế này.
- Ưu tiên xác minh phần thiếu theo mục đích trước khi sửa UI. Dùng RED → GREEN, lưu bằng chứng của lần thất bại và lần chạy lại. Phiên mutation dùng clone riêng và kiểm tra cleanup.
- A4 đã được xác nhận: mỗi menu tăng suất cho cả nhóm món đóng băng. Triển khai native theo yêu cầu.

## Trọng tâm review

1. Tổng thực xuất khớp tổng nhu cầu nhưng phân bổ nhầm mục đích hoặc thiếu một đề nghị đã duyệt.
2. Phiếu trả liên kết mơ hồ và phiếu cũ thiếu phân bổ. Không hiển thị 0 thiếu hoặc cho chốt nhầm.
3. Ba khách hàng cùng tuần có nguyên liệu trùng mã nhưng thuộc lô/ngày khác. Không bù qua khách hàng hoặc ngày.
4. Dữ liệu đến muộn sau mutation hoặc đổi hồ sơ. Không ghi đè dữ liệu mới hoặc mở thao tác sai hồ sơ.
5. Menu có BOM chưa đủ, món trùng qua hai cách chọn, nháp cũ và phiên bản lô đổi trước khi gửi.

## 1. Thống nhất phép tính và lượt đọc

**Owner:** `ReconciliationSupplementalFulfillmentQuery.cs`, `ReconciliationWarehouseDailyQuery.cs`, `ReconciliationPreparationService.cs`, `ReconciliationPreparationWorkbookExporter.cs`, `ReconciliationReportsService.cs`, `ReconciliationCompletionEligibility.cs` trong các thư mục Services tương ứng của Inventory và Reconciliation. Đối chiếu `ReconciliationKitchenExportService.cs` để giữ đúng ngữ nghĩa số suất.

- [ ] Trong `ReconciliationPreparationTests.cs`, `ReconciliationPreparationWorkbookTests.cs` và `ReconciliationDashboardAndReportsTests.cs`, thêm dữ liệu phân bổ A1 (10 gốc + 2 đã duyệt, thực xuất 10 gốc + 2 cấp ngoài) và ca cùng nguyên liệu ở nhiều ngày/khách hàng. So sánh dòng theo ID và đơn vị, gồm cả xuất riêng so với gộp. Chạy để ghi nhận lệch trước sửa.
- [ ] Tái dùng phép chiếu net và fulfillment theo daily-line. Nếu cần truy vấn nhiều lô/ngày, thêm đường đọc theo tập ID và gom theo scope tại owner hiện có, tránh gọi một truy vấn cho mỗi dòng. Chia sẻ cách diễn giải trạng thái giữa màn hình và workbook. Giữ chênh lệch số học, thêm ngữ nghĩa phần thiếu và cấp ngoài ở những read DTO cần hiển thị. Nếu DTO đổi, cập nhật contract sinh từ API và parser/renderer liên quan.
- [ ] Kiểm tra thiếu theo một trong nhiều đề nghị, xuất thiếu rồi bù từng phần, hoàn trả đã xác nhận, phân bổ cũ không xác định, chênh lệch cần giải trình và chốt tuần. Thêm ca A1 vào sổ chênh lệch để bắt lỗi bỏ dòng có chênh lệch số học 0. Giữ compatibility theo route và trạng thái thất bại khi thiếu căn cứ.
- [ ] Chạy `dotnet test backend/tests/IPCManagement.Api.Tests --no-restore --filter 'FullyQualifiedName~ReconciliationPreparation|FullyQualifiedName~ReconciliationDashboardAndReports|FullyQualifiedName~ReconciliationSupplementalFulfillment|FullyQualifiedName~OperationalMrxBatchReview'`. Kỳ vọng các fixture đọc cùng giá trị, đúng chứng từ, trạng thái và quyền chốt. Ghi rõ phần workbook cần file/môi trường riêng nếu có.

## 2. Làm mới màn hình sau lệnh ghi

**Owner:** `frontend/src/api/mrxCacheInvalidation.ts`, `mrxApi.ts`, `approvalsApi.ts`, `frontend/src/hooks/useWorkbenchQuery.ts`, `useOperationalRecovery.ts` và các hook đọc tại Kho, Bếp, Chuẩn bị, Đối soát, Dashboard. Trace thêm lượt xác nhận trả hàng để dùng đúng API ghi hiện có.

- [ ] Liệt kê write → dữ liệu tác động → khóa đọc và snapshot. Làm rõ các lượt đọc dùng query cache, session snapshot và state còn sống trong trang. Thêm test cho ACK cập nhật đúng phạm vi, response cũ về sau ACK, tab khác quay lại, và retry chưa biết kết quả.
- [ ] Dùng cơ chế refetch/visibility hiện có cho các trang MRX liên quan. Bổ sung liên kết invalidation cho các owner chưa được phủ, bao gồm tổng hợp ngày/tuần và Dashboard khi đọc cùng số liệu. Chặn lượt đọc cũ bằng cơ chế identity/generation hiện có. Khôi phục lệnh và đọc lại phiên bản trước khi gửi tiếp.
- [ ] Chạy `npm run test:unit --workspace frontend -- useWorkbenchQuery useOperationalRecovery MrxSupplementalCommandRecovery ApiContracts`. Kiểm tra tab kỹ thuật bằng hai browser context có quyền khác nhau, giữ đúng khách hàng, lô, ngày và mode.

## 3. Tối ưu nhập phiếu bổ sung

**Owner:** `frontend/src/features/warehouse/MrxSupplementalFulfillmentForm.tsx`, `MrxSupplementalIssueModal.tsx`, `hooks/useMrxDailyWorkspace.ts`. Test tại `frontend/src/__tests__/MrxSupplementalFulfillmentForm.test.tsx`.

- [ ] Nạp Impeccable và kiểm tra design system. Ghi Scoped Pre-Code UI Gate theo AGENTS trước khi sửa TSX. Phạm vi `/warehouse`, MRX, modal hiện có. Kiểm tra cảnh báo, bàn phím và vùng thao tác ở chiều cao ngắn.
- [ ] Thêm test chọn một dòng, tìm/chọn nhiều dòng, không mất lựa chọn khi đổi tìm kiếm, thiếu lý do, số vượt giới hạn và nháp cũ sau đổi phiên bản. Đối chiếu payload chỉ có dòng hợp lệ đã chọn và đúng mã nhu cầu khi áp dụng.
- [ ] Dùng picker/bảng dùng chung. Đưa lý do lên gần thao tác. Thể hiện rõ lý do đang chặn gửi. Giữ khôi phục bản nháp, lệnh gửi lại bằng cùng định danh khi chưa rõ kết quả và cách xử lý xung đột phiên bản.
- [ ] Chạy `npm run test:unit --workspace frontend -- MrxSupplementalFulfillmentForm MrxDraftRetention MrxSupplementalCommandRecovery WarehouseMrxTransitions`. Test trình duyệt xuất một dòng, nhiều đợt và đổi mục đích trước khi gửi.

## 4. Bốn menu và Tùy chọn

**Owner:** `frontend/src/features/warehouse/MrxSupplementalDemandForm.tsx`, `frontend/src/__tests__/MrxSupplementalDemandForm.test.tsx`. Backend `ReconciliationSupplementalDemandService.cs` và `ReconciliationSupplementalSnapshotBuilder.cs` sở hữu xác thực khóa món/ca/loại suất, tính BOM và ghi nháp.

- [ ] Làm UI gate như task 3. Test bốn nhóm, Tùy chọn, trùng tuple, cùng món ở hai ca, menu rỗng và menu có dòng bị chặn.
- [ ] Ánh xạ lựa chọn bằng tuple hiện có. Mở rộng trên bộ món đóng băng đã tải và gửi danh sách món cùng phiên bản lô qua API hiện có. Kiểm tra trùng cùng tuple trước lưu. Dùng snapshot server cho phần nguyên liệu xem trước. Đổi phiên bản hoặc mục đích không làm gửi lại âm thầm.
- [ ] Chạy `npm run test:unit --workspace frontend -- MrxSupplementalDemandForm MrxSupplementalDemandApi MrxSupplementalCommandRecovery`. Kiểm tra Thủ kho gửi duyệt, Admin ghi trực tiếp, lịch sử đúng actor, Bếp chỉ cộng suất đã xác nhận.

## 5. Chuyển hồ sơ duyệt không nháy

**Owner:** `frontend/src/features/approvals/ApprovalPage.tsx` và `frontend/src/__tests__/OperationalApprovals.test.tsx`. Dùng `SplitView`, badge, trạng thái và nút hiện có.

- [ ] Làm UI gate theo AGENTS cho `/approvals`, gồm desktop split, màn hẹp và trạng thái tải/lỗi/khôi phục. Thêm test đổi A → B → C với phản hồi ngược thứ tự, lỗi rồi thử lại C, thay tab Chờ xử lý/Lịch sử trong lúc tải.
- [ ] Tách hồ sơ đang chọn khỏi dữ liệu đã tải. Khóa thao tác khi dữ liệu chưa khớp khóa gồm mode, hàng đợi, loại và ID. Giữ khung và focus. Chỉ thay dữ liệu chi tiết/lịch sử phù hợp với lựa chọn mới.
- [ ] Chạy `npm run test:unit --workspace frontend -- OperationalApprovals`. Chụp và kiểm tra ở 600, 960, 1440 px. Kiểm tra nút bấm, bàn phím, báo trạng thái, danh tính hồ sơ và sự ổn định của khung.

## 6. Nghiệm thu tích hợp

- [ ] Chạy `npm run verify`, contract theo AGENTS, build/lint và `git diff --check`. Đối chiếu UI qua Impeccable và review code bằng Ponytail. Phân biệt kết quả chạy test hẹp, test toàn bộ và ảnh trình duyệt.
- [ ] Tái dùng `frontend/tests/e2e-mrx/specs/mrx-three-customer-approvals.spec.ts` và `frontend/tests/e2e-mrx/fixtures/mrxApprovalLifecycle.ts`. Chạy hai phiên clone riêng, một nhiều vai trò, một chỉ Admin. Ghi request có chồng lấn, quyền xử lý, số bản ghi, lịch sử và trạng thái từng lô sau từng bước.
- [ ] Tại ít nhất một lô, chạy ca A1 có phiếu cấp ngoài vào ngày đã xuất, đọc lại ở hai phiên, đối chiếu Kho → Chuẩn bị/Excel → Đối soát → hàng đợi chốt. Kiểm tra Bếp lấy đúng suất đã duyệt. Sau khi xuất bù đúng mục đích và hoàn tất điều kiện khác, xác nhận lô có thể chốt, chuyển lịch sử và không sinh thêm phiếu duyệt.
- [ ] Đọc file tải thật và kiểm tra nội dung so với API theo ngày/tuần, từng khách hàng và tổng hợp. Kiểm tra file bằng công cụ Open XML có sẵn và mở Excel khi môi trường cho phép. Kiểm tra khóa lô, khóa ngày, snapshot gốc, chứng từ và đối chiếu tồn kho vật lý.
- [ ] Ghi biên nhận chạy, bằng chứng quan sát và cleanup của từng phiên. Nếu runner bị gián đoạn, báo riêng kết quả nghiệp vụ và tình trạng cleanup. Không dùng kết quả lịch sử làm bằng chứng cho bản sửa mới.

## Biên nhận nghiệm thu ngày 17/11/2026

Bốn mục tiêu chính đã triển khai. Bằng chứng và phạm vi kiểm chứng thực tế được ghi ở WORK.md. Actors20261117t003429z_da467d đối chiếu thiếu theo mục đích xuyên Kho, Chuẩn bị, Excel, Đối soát và chốt đủ ba lô. ExportConsistency20261117t005139z_56645a kiểm tra sáu file tải thật và ghi nguồn đồng thời trên MySQL. Sáu file qua Open XML và mở bằng Excel16. Full gates1690API/49Application/740FE/56evidence pass. Review cuối sửa tương thích client cũ, sau đó1691API/49Application pass. Các checkbox chi tiết phía trên giữ làm danh mục yêu cầu, không đại diện cho kết quả từng biến thể chưa có biên nhận riêng.
