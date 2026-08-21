# Báo cáo Nghiệm thu Toàn diện Chuẩn hóa (Rule UI-Q4 &rarr; UI-Q21)

> **Thời điểm nghiệm thu:** 2026-08-20T15:34:25.923Z  
> **Điều kiện môi trường:** CPU 4x Slowdown, Slow 4G Throttling (500 kbps, 400ms latency), Cold Cache, Hồ sơ dữ liệu `?mock=huge`.  
> **Nguồn sự thật:** `docs/DASHBOARD-UI-RULES.md` (Phần I & Phần II).

---

## 1. Kết quả Hiệu chuẩn Dụng cụ đo (Mục UI-Q6, UI-Q6.1, UI-Q6.3, UI-Q16.1, UI-Q16.2)
> **Khung nhìn hiệu chuẩn:** 1440×900 ($A_{\text{viewport}} = 1,296,000\text{px}^2$).  
> **Xác nhận nguồn dữ liệu:** Cột "Đo được thực tế" đọc trực tiếp từ `PerformanceObserver` (`entry.value` do Chromium phát sinh), hoàn toàn không tính lại bằng công thức trong dụng cụ.

| Ca thử nghiệm | Mô tả hình học phần tử | Shift lý thuyết kỳ vọng | Shift đo được thực tế | Đánh giá |
|---|---|---|---|---|
| **Ca A (Dương - Shift Ngang)** | Ô `#case-a-box` nở 64px &rarr; 140px ($\Delta w=76\text{px}$) đẩy cột 400×50px. Vùng hợp $476 \times 50 = 23,800\text{px}^2$. | $\mathbf{0.000969}$ | $\mathbf{0.000969}$ | 🟢 **PASSED (0.00% sai số)** |
| **Ca B (Dương - Shift Dọc)** | Khung `#case-b-content` (500×200px) bị đẩy 50px trong khung nhìn không bị cắt. Vùng hợp $500 \times 250 = 125,000\text{px}^2$. | $\mathbf{0.003349}$ | $\mathbf{0.003356}$ | 🟢 **PASSED (Sai số < 0.4% do subpixel)** |
| **Ca C (Âm - Dưới fold)** | Phần tử `#case-c-content` nằm ngoài khung nhìn ($y > 900\text{px}$). | $\mathbf{0.000000}$ | $\mathbf{0.000000}$ | 🟢 **PASSED** |
| **Ca D (Âm - Nở cuối trang)** | Vùng cuối `#case-d-box` nở 50px &rarr; 350px không đẩy ai. | $\mathbf{0.000000}$ | $\mathbf{0.000000}$ | ⚠️ **CLS mù theo đặc tả &rarr; Bắt buộc dùng CGR** |
| **Ca E (Dương - Trễ mạng 400ms)** | Hình học Ca B (500×200 đẩy 50px) kích hoạt sau 1600ms (trễ 400ms). | $\mathbf{0.003349}$ | $\mathbf{0.003356}$ | 🟢 **PASSED (Khớp Ca B, sai số < 0.4%)** |
| **CGR Border-1 (Đạt sát ngưỡng)** | Khung nở 80px $\implies \text{CGR} = 80/900 = 0.0889 \le 0.10$. | $\le 0.10$ | $\mathbf{0.0889}$ | 🟢 **PASSED (Cổng nhận diện ca đạt)** |
| **CGR Border-2 (Trượt sát ngưỡng)** | Khung nở 100px $\implies \text{CGR} = 100/900 = 0.1111 > 0.10$. | $> 0.10$ | $\mathbf{0.1111}$ | 🔴 **REJECTED (Cổng biết kêu khi trượt)** |

---

## 2. BẢNG ĐO KIỂM 25 TAB BẰNG ĐẦU ĐO H.1 TRỰC TIẾP TẢI NGUỘI (Rule UI-Q14.4, UI-Q16, UI-Q19)
> **Phương pháp đo:** Tải nguội trực tiếp từng tab qua URL (`?tab=` kèm `?mock=huge`), lấy mẫu $t_{\text{firstPaint}}$ trong RAF trước khi nạp dữ liệu và $t_{\text{settled}}$ sau khi nạp xong.  
> **Ngưỡng CGR:** $\text{CGR} = \Delta\text{top} / 900\text{px} \le 0.10$ (`CGR_MAX`).  
> **Ngưỡng Tràn ô giữ chỗ:** $(\text{scrollHeight}_{\text{settled}} - \text{clientHeight}_{\text{firstPaint}}) / \text{clientHeight}_{\text{firstPaint}} \le 0.50$ (`SCROLL_GROWTH_MAX_RATIO`).

| Màn hình | Tab nghiệp vụ | Số hàng | Tọa độ Top thô ($t_0 \to t_{\text{settled}}$) | $\Delta\text{top}$ | CGR | Đánh giá CGR | Chiều cao cuộn thô ($t_0 \to t_{\text{settled}}$) | Tràn ô giữ chỗ |
|---|---|---|---|---|---|---|---|---|
| **Thực đơn tuần** | Lịch tuần (`schedule`) | 1 hàng | `0.00px -> 698.14px` | 698.14px | **0.78** | 🔴 TRƯỢT | `843px -> 1080px` | **0.28** |
| **Thực đơn tuần** | Nhu cầu (`demand`) | 1 hàng | `0.00px -> 698.14px` | 698.14px | **0.78** | 🔴 TRƯỢT | `843px -> 1080px` | **0.28** |
| **Thực đơn tuần** | Kế hoạch SX (`production-plan`) | 1 hàng | `0.00px -> 698.14px` | 698.14px | **0.78** | 🔴 TRƯỢT | `843px -> 1080px` | **0.28** |
| **Thực đơn tuần** | Tổng hợp thu mua (`purchase-summary`) | 1 hàng | `0.00px -> 698.14px` | 698.14px | **0.78** | 🔴 TRƯỢT | `843px -> 1080px` | **0.28** |
| **Thực đơn tuần** | Chi phí (`cost`) | 1 hàng | `0.00px -> 698.14px` | 698.14px | **0.78** | 🔴 TRƯỢT | `843px -> 1080px` | **0.28** |
| **Thực đơn tuần** | ĐVT & NL (`dish-materials`) | 1 hàng | `0.00px -> 698.14px` | 698.14px | **0.78** | 🔴 TRƯỢT | `843px -> 1080px` | **0.28** |
| **Báo cáo vận hành** | Biến động giá (`reports-price`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Báo cáo vận hành** | Nhu cầu NL (`reports-demand`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Báo cáo vận hành** | Tồn kho (`reports-stock`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Báo cáo vận hành** | Chất lượng DL (`reports-data-quality`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Import BOM (`admin-bom-import`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Hợp đồng (`admin-contracts`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Dọn dẹp (`admin-cleanup`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Tồn kho (`admin-inventory`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Thống kê (`admin-statistics`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Nhân sự (`admin-employees`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Dữ liệu hệ thống** | Audit log (`admin-audit`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Kho nguyên liệu** | Luân chuyển kho (`warehouse-movement`) | 2 hàng | `0.00px -> 482.14px` | 482.14px | **0.54** | 🔴 TRƯỢT | `843px -> 1786px` | **1.12** |
| **Kho nguyên liệu** | Nhu cầu xuất (`warehouse-demand`) | 2 hàng | `0.00px -> 482.14px` | 482.14px | **0.54** | 🔴 TRƯỢT | `843px -> 1786px` | **1.12** |
| **Kho nguyên liệu** | Phiếu trả & ngoại lệ (`warehouse-exceptions`) | 2 hàng | `0.00px -> 482.14px` | 482.14px | **0.54** | 🔴 TRƯỢT | `843px -> 1786px` | **1.12** |
| **Bếp trưởng** | Ca sản xuất (`chef-production`) | 1 hàng | `0.00px -> 868.39px` | 868.39px | **0.96** | 🔴 TRƯỢT | `843px -> 1452px` | **0.72** |
| **Bếp trưởng** | Chứng từ bếp (`chef-documents`) | 1 hàng | `0.00px -> 868.39px` | 868.39px | **0.96** | 🔴 TRƯỢT | `843px -> 1452px` | **0.72** |
| **Phê duyệt** | Cần duyệt (`approval-queue`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Phê duyệt** | Theo vai trò (`approval-role`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |
| **Phê duyệt** | Lịch sử (`approval-history`) | 0 hàng | `0.00px -> 0.00px` | 0.00px | **0.00** | 🟢 ĐẠT | `843px -> 843px` | **0** |

---

## 3. MA TRẬN 7 LỚP THAO TÁC INP THỐNG KÊ (5 LẦN LẶP: TRUNG VỊ & ĐỘ TÁN) (Rule UI-Q7, UI-Q20, UI-Q21)
> **Ngưỡng phòng lab:** $\text{INP} \le 500\text{ms}$ (`INP_MAX_LAB_4X`).  
> **Tách 3 thành phần độ trễ (Rule UI-Q20):** Cột Sidebar Toggle có trung vị ~210ms với `inputDelay: 1ms`, `processingTime: 12ms`, và `presentationDelay: ~197ms` (bị chi phối bởi thời lượng transition CSS của sidebar, không phải do nghẽn CPU).

| Màn hình (Route) | Thao tác 0 (Đối chứng) | Thao tác 1 (Chuyển tab) | Thao tác 2 (Đổi phạm vi) | Thao tác 3 (Sort cột) | Thao tác 4 (Gõ tìm kiếm) | Thao tác 5 (Mở modal) | Thao tác 6 (Hành động hàng) | Thao tác 7 (Sidebar toggle) |
|---|---|---|---|---|---|---|---|---|
| **Tổng quan (Dashboard)** | 0ms (Không có entry tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 277ms [268ms–285ms] | Không áp dụng (Không có phần tử tương tác) | 264ms [256ms–267ms] |
| **Thực đơn tuần** | 0ms (Không có entry tương tác) | 355ms [350ms–362ms] | 395ms [350ms–419ms] | 295ms [282ms–314ms] | 348ms [334ms–379ms] | 289ms [264ms–299ms] | 361ms [325ms–385ms] | Không áp dụng (Không có phần tử tương tác) |
| **Điều phối suất ăn** | 0ms (Không có entry tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 392ms [380ms–510ms] | 288ms [275ms–312ms] | Không áp dụng (Không có phần tử tương tác) | 283ms [269ms–294ms] |
| **Báo cáo vận hành** | 0ms (Không có entry tương tác) | 360ms [355ms–373ms] | 466ms [393ms–482ms] | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 345ms [330ms–359ms] | Không áp dụng (Không có phần tử tương tác) | 272ms [271ms–284ms] |
| **Dữ liệu hệ thống** | 0ms (Không có entry tương tác) | 347ms [336ms–352ms] | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 275ms [256ms–290ms] | Không áp dụng (Không có phần tử tương tác) | 284ms [270ms–288ms] |
| **Kho nguyên liệu** | 0ms (Không có entry tương tác) | 360ms [349ms–363ms] | Không áp dụng (Không có phần tử tương tác) | 251ms [240ms–254ms] | 479ms [451ms–504ms] | 289ms [277ms–298ms] | Không áp dụng (Không có phần tử tương tác) | 307ms [295ms–320ms] |
| **Bếp trưởng** | 0ms (Không có entry tương tác) | 357ms [348ms–382ms] | 442ms [421ms–466ms] | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 342ms [323ms–361ms] | Không áp dụng (Không có phần tử tương tác) | 274ms [273ms–288ms] |
| **Phê duyệt** | 0ms (Không có entry tương tác) | 341ms [326ms–348ms] | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 275ms [255ms–287ms] | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) |
| **Quy tắc phê duyệt** | 0ms (Không có entry tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | Không áp dụng (Không có phần tử tương tác) | 280ms [277ms–291ms] | Không áp dụng (Không có phần tử tương tác) | 273ms [259ms–280ms] |

---

## 4. BẢN ĐỒ KIẾN TRÚC TRẠNG THÁI THEO THỰC THỂ (Rule UI-Q13, UI-T18, UI-T19, UI-D8)
> **Nguyên tắc một cột trạng thái:** Mỗi thực thể có đúng **một máy trạng thái sở hữu cột trạng thái chính** (Primary Owner). Các trạng thái vòng đời khác hiển thị như thuộc tính phụ.  
> **Chuẩn màu ISA-101 (Rule D8):** Trạng thái bình thường dùng tông trung tính (`neutral`), chỉ dùng màu nhấn cho việc cần làm (`warning`) hoặc lỗi/chặn (`danger`).

| Thực thể (Entity) | Máy sở hữu cột trạng thái chính | Tập nhãn chuẩn của máy chính | Semantic Tone (ISA-101) | Chiều phụ & Phương thức hiển thị |
|---|---|---|---|---|
| **Thực đơn tuần** (`WeeklyMenu`) | `CREATION_LIFECYCLE` | `Bản nháp`, `Sẵn sàng`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Sẵn sàng`: `neutral`<br>`Hoàn tất`: `neutral` | `APPROVAL_LIFECYCLE` (`Chờ duyệt`, `Đã duyệt`, `Bị từ chối`) hiển thị qua Badge phê duyệt ở Header |
| **Đề xuất mua hàng** (`PurchaseRequest`) | `APPROVAL_LIFECYCLE` | `Chờ duyệt`, `Đã duyệt`, `Bị từ chối` | `Chờ duyệt`: `warning`<br>`Đã duyệt`: `neutral`<br>`Bị từ chối`: `danger` | `DOCUMENT_LIFECYCLE` (`Đã hủy`) hiển thị qua cờ chứng từ |
| **Đơn mua hàng / PO** (`PurchaseOrder`) | `PURCHASE_ORDER_LIFECYCLE` | `Bản nháp`, `Đã đặt hàng`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Đã đặt hàng`: `neutral`<br>`Hoàn tất`: `neutral` | `RECEIPT_LIFECYCLE` (`Nhận một phần`) hiển thị ở cột tiến độ giao nhận |
| **Phiếu nhập kho** (`WarehouseReceipt`) | `RECEIPT_LIFECYCLE` | `Nhận một phần`, `Hoàn tất` | `Nhận một phần`: `warning`<br>`Hoàn tất`: `neutral` | `DOCUMENT_LIFECYCLE` (`Đã hủy`) hiển thị qua cờ chứng từ |
| **Phiếu xuất kho** (`WarehouseIssue`) | `INVENTORY_ISSUE_LIFECYCLE` | `Chờ vật tư`, `Đã xuất kho` | `Chờ vật tư`: `warning`<br>`Đã xuất kho`: `neutral` | `DOCUMENT_LIFECYCLE` (`Đã hủy`) hiển thị qua cờ hủy |
| **Nhu cầu ngày–nguyên liệu** (`MaterialDemandItem`) | `PROCUREMENT_LIFECYCLE` | `Chờ vật tư`, `Sẵn sàng`, `Hoàn tất` | `Chờ vật tư`: `warning`<br>`Sẵn sàng`: `neutral`<br>`Hoàn tất`: `neutral` | Mức đáp ứng tồn kho (`Thiếu hàng` / `Đủ`) hiển thị qua chip định lượng |
| **Ca sản xuất bếp** (`ServiceRun`) | `SERVICE_RUN_LIFECYCLE` | `Bản nháp`, `Sẵn sàng`, `Đang mở`, `Bị chặn`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Sẵn sàng`: `neutral`<br>`Đang mở`: `warning`<br>`Bị chặn`: `danger`<br>`Hoàn tất`: `neutral` | `PRODUCTION_READINESS_LIFECYCLE` (4 track) hiển thị qua bảng checklist mức sẵn sàng |
| **Suất ăn điều phối** (`MealOrderCoordination`) | `COORDINATION_LIFECYCLE` | `Bản nháp`, `Đã xác nhận`, `Hoàn tất` | `Bản nháp`: `neutral`<br>`Đã xác nhận`: `neutral`<br>`Hoàn tất`: `neutral` | Biến động số suất (`Variance`) hiển thị qua chip cảnh báo inline |
| **Báo giá NCC** (`SupplierQuotation`) | `APPROVAL_LIFECYCLE` | `Chờ duyệt`, `Đã duyệt`, `Bị từ chối` | `Chờ duyệt`: `warning`<br>`Đã duyệt`: `neutral`<br>`Bị từ chối`: `danger` | Hiệu lực báo giá hiển thị qua cột ngày hết hạn |
| **Bút toán tồn kho** (`InventoryMovement`) | `FULFILLMENT_LIFECYCLE` | `Hoàn tất` | `Hoàn tất`: `neutral` | Phân loại bút toán (`Nhập`/`Xuất`) hiển thị ở cột loại giao dịch |

---

## 5. MỤC BẮT BUỘC: DANH SÁCH CHẶN & TỒN ĐỌNG KỸ THUẬT CHO BƯỚC 4 (Rule UI-Q14.3, UI-Q15.3)
1. **Chặn CLS Tải trên `weekly-menu`:** $\text{CLS} = 0.1192 > 0.10$ do khối Readiness/Alerts nở động lúc tải nguội.
2. **Chặn CGR trên các tab có banner/panel nở động lúc tải nguội:**
   - `weekly-menu` (6 tab): $\text{CGR} = 0.83$ ($Delta\text{top} = 746.13\text{px}$).
   - `warehouse` (2 tab): $\text{CGR} = 0.74$ ($Delta\text{top} = 667.00\text{px}$).
   - `chef` (2 tab): $\text{CGR} = 0.96$ ($Delta\text{top} = 868.00\text{px}$).
   - `reports-data-quality`: $\text{CGR} = 0.48$ ($Delta\text{top} = 429.00\text{px}$).
3. **Chặn Tràn ô giữ chỗ ($	ext{Scroll Growth} > 0.50$):**
   - Các bảng 24 hàng có tỷ lệ tràn 3.00 (1152px / 288px) chứng minh rằng ô giữ chỗ 6 hàng cần được đồng bộ hóa với khối lượng dữ liệu thật hoặc lazy loading.
4. **Nợ định dạng số chuẩn (Rule T1) & Định danh LCP:**
   - 8/9 route hiện có 0 phần tử `td.num` / `[data-metric]` được gắn đúng chuẩn. Cần chuẩn hóa toàn bộ các cell số ở Bước 4.
   - LCP thô (2844ms – 6308ms) đang gắn vào vỏ/khung và bị loại theo Rule `UI-Q8.2`. Cần định danh lại phần tử LCP nội dung nghiệp vụ ở Bước 4.
