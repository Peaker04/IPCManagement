# Đặc Tả Kỹ Thuật Khóa Cứng: Chuẩn Hóa Toàn Diện Chế Độ MRX, Thanh Trừng Code Cũ & Khóa Cứng Kiến Trúc 5 Tầng Native

> **Mã đặc tả:** `SPEC-MRX-5LAYER-NATIVE-HARDENING-20261026-LOCKED`  
> **Thẩm quyền:** `AGENTS.md` (Bất biến `DOM-MODE-1`, Kiến trúc quản trị 5 tầng) & `docs/DOMAIN.md`  
> **Phạm vi:** Toàn bộ 4 Trạm Vận Hành MRX, các Modals, Bảng Báo Cáo và Bộ Test Suite tương ứng.

---

## 1. NGUYÊN TẮC BẤT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Bất Biến Phân Lập Vận Hành (`DOM-MODE-1`)
- Khi hệ thống ở chế độ `MATERIAL_RECONCILIATION`, tuyệt đối không gọi các endpoint hoặc render các view của chế độ `DEFAULT`.
- Mọi truy cập vào các route gốc (`/weekly-menu`, `/warehouse`, `/chef`) tự động chuyển hướng (replace) về subview MRX tương ứng (`?view=mrx-batch`, `?view=mrx-daily`, `?view=mrx-cooking`).
- Sidebar hiển thị nhánh lá active chuẩn xác dựa trên URLSearchParams `view`.

### 1.2. Bất Biến Trải Nghiệm Không Skeleton & Zero-Strobe (`RULE-SWR-ZERO-STROBE`)
- Mọi dữ liệu đã tải trong cùng phiên làm việc được lưu trong `serverStateCache`.
- Khi người dùng quay lại một tab hoặc trang đã thăm, dữ liệu hiển thị tức thì trong 0ms từ bộ nhớ RAM, **không unmount để render lại skeleton**.
- Phản hồi làm mới dữ liệu là icon quay tại chỗ (`RefreshCw` animate-spin), không nhấp nháy thanh tiến trình toàn cục.

### 1.3. Bất Biến Loại Bỏ Code Cũ, Code Thừa & Hardcode (`RULE-PURGE-LEGACY-CODE`)
- 100% các đoạn code tải dữ liệu trùng lặp (`fetchData` nằm trong `useEffect` sao chép lại `loadData`) phải bị xóa bỏ hoàn toàn.
- 100% các thẻ HTML nguyên thủy (`<select>`, `<input type="checkbox">`, `<input type="month">`) phải được thay bằng Design System Primitives (`<Select>`, `<Checkbox>`, `<Input>`).
- 100% các banner tự chế với nút `<button>Đóng</button>` phải được thay bằng `<InlineBanner>` chuẩn hóa.
- 100% mã raw enum Backend (`LEGACY_DAILY_LINEAGE_MISSING`, `KITCHEN_FROZEN_LINEAGE_MISSING`) phải được chuyển dịch sang ngôn ngữ nghiệp vụ tiếng Việt trong sáng, chuyên nghiệp.

### 1.4. Bất Biến Kiểm Thử Chống Kéo Ngược Lỗi (`RULE-TEST-ANTI-REGRESSION`)
- Tuyệt đối cấm các ca kiểm thử assert chuỗi lỗi kỹ thuật thô hoặc ép buộc UI phải giữ lại các khối rác (như khối ngày cũ `draftSources`).
- Mọi ca kiểm thử phải khởi tạo với bộ nhớ đệm RAM trong sạch (`clearAllServerCache()`), triệt tiêu hoàn toàn rò rỉ trạng thái giữa các test suite.
- Tuyệt đối cấm `test.skip`, `test.todo`, hoặc mock chính component đang kiểm thử (Tuân thủ `Rule TA-1` đến `TA-5` trong `ipc-test-audit`).

---

## 2. MA TRẬN 5 TẦNG KIẾN TRÚC ÁP DỤNG CHO 4 TRẠM MRX

| Tầng Kiến Trúc | Tiêu Chuẩn Bắt Buộc Tại 4 Trạm MRX |
|---|---|
| **Tầng 1 — Design Tokens** | Khóa cứng biến semantic CSS từ `index.css` (`--focus-ring`, `--bg-dragging`, `--border-drop-target`). Zero inline styles, zero màu hex tùy tiện (`bg-[#...]`). |
| **Tầng 2 — Component View & FSM** | - `Button` thực thi FSM 7 trạng thái với phản hồi xúc giác `active:scale-[0.98]`.<br>- `<DataGrid>` hỗ trợ roving tabindex, cell hydration ảo hóa khi danh sách lớn.<br>- Phân lập triệt để `disabled` vs `readOnly`. Header cố định không rớt dòng (`flex-nowrap overflow-x-auto no-scrollbar`). |
| **Tầng 3 — Client State** | Quản lý đồng bộ URL hai chiều (`query`, `page`, `view`, `filters`), tự động reset `page=1` khi tìm kiếm, lưu trữ nháp an toàn (`useClientDraftPersistence`). |
| **Tầng 4 — Server State & Caching** | - Toàn bộ 4 trạm MRX khởi tạo state từ `serverStateCache`.<br>- Khóa đột biến 2 lớp (`useMutationLock`) chống double-click.<br>- Hủy yêu cầu cũ khi nhập tìm kiếm (`useDebouncedAbortableQuery`). |
| **Tầng 5 — API, Domain & Bảo Mật** | - Chuyển đổi lỗi qua `rfc7807ErrorMapper` (ProblemDetails).<br>- Bảo vệ đột biến bằng Idempotency Key.<br>- Kiểm soát quyền động qua `ActionGuard`. |

---

## 3. GIỚI HẠN DÒNG CODE VẬT LÝ (< 600 DÒNG)

Toàn bộ các file Frontend được tinh chỉnh bắt buộc tuân thủ nghiêm ngặt giới hạn dòng:
- `MrxBatchWorkbench.tsx`: < 520 dòng
- `MrxDailyIssueWorkbench.tsx`: < 595 dòng
- `ReconciliationPage.tsx`: < 595 dòng
- `ReconciliationReportTables.tsx`: < 470 dòng
- `MrxCookingWorkbench.tsx`: < 360 dòng
- `MrxMultiCustomerPreparationWorkbench.tsx`: < 330 dòng
- `MrxSupplementalIssueModal.tsx`: < 310 dòng
- `MrxSourceDeltaWorkbench.tsx`: < 290 dòng
- `ReconciliationDispositionModal.tsx`: < 250 dòng
- `MrxBatchPreviewSection.tsx`: < 220 dòng

Bản đặc tả này là căn cứ khóa cứng tối cao cho toàn bộ quá trình thực thi native tiếp theo.
