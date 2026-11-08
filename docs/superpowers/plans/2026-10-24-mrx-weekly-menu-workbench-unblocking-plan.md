# Kế Hoạch Thực Thi: Tinh Chỉnh Phân Hệ Chuẩn Bị Lô Đối Soát MRX & Xóa Bỏ Ngõ Cụt Vận Hành (MRX Weekly Menu Workbench Unblocking Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa bỏ hoàn toàn 4 ngõ cụt nghiệp vụ trên Trạm Chuẩn bị lô đối soát (`/weekly-menu?view=mrx-batch`), bổ sung nút CTA chuyển tiếp liên trạm sang Trạm Kho, thanh vòng đời 5 nấc trực quan, hoàn thiện modal điều chỉnh số suất ca và tự động nối luồng sau khi xuất bản thực đơn.

**Architecture:** Mở rộng component `MrxBatchWorkbench.tsx` theo kiến trúc 3-Zone Flat Workbench (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`). Đảm bảo nguyên tắc Single Primary Action (`Rule D7`), cách ly tuyệt đối chế độ `DOM-MODE-1`, và triệt tiêu layout shift (`CLS = 0.0000`).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vitest, Testing Library, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-10-24-mrx-weekly-menu-workbench-unblocking-spec.md`

## Global Constraints

- **Chế độ vận hành:** 100% request phải gửi qua `/api/reconciliation/*`. Cấm tuyệt đối gọi endpoint của `DEFAULT` (`DOM-MODE-1`).
- **Kiến trúc thị giác:** Không sinh token màu mới ngoài `index.css`; không sinh duplicate component primitives.
- **Quy tắc Single Primary (`Rule D7`):** Thanh Header chỉ có duy nhất 1 nút Primary (nền tối `bg-slate-900` hoặc xanh đậm).
- **Quy tắc Zero-CLS (`RULE-FEEDBACK-01..04`):** Cấm `setData(null)` khi chuyển khách hàng hoặc tuần. Giữ nguyên bảng cũ và làm mờ `opacity-70`.
- **An toàn test:** Tuân thủ `Rule TA-1..TA-5`, không mock component dưới test, fixture chuẩn DTO C#.

## Review Focus

1. **Chuyển tiếp trạm Kho khi lô đã bàn giao:** Lô ở trạng thái `TRANSFERRED` hoặc `IN_PROGRESS` phải hiển thị nút CTA rõ ràng dẫn sang `/warehouse?view=mrx-daily&batchId={id}`.
2. **Không kẹt form khi đóng modal:** Modal đổi số suất ca phải có nút Hủy, phím Escape và không làm mất dữ liệu vô lý.
3. **Xử lý xung đột phiên bản 409:** Khi có 2 người cùng sửa số suất, backend báo lỗi 409 thì giao diện phải hiển thị nút "Tải lại dữ liệu nguồn" thay vì sập trang.
4. **Nối luồng xuất bản thực đơn DRAFT:** Sau khi bấm xuất bản, giao diện tự động kiểm tra định lượng và sẵn sàng nút tạo lô nháp.
5. **Đo đạc Headed Chromium live:** Kiểm thử trực quan có cửa sổ thật, không console error, CLS $\le 0.05$.

---

### Task 1: Bổ Sung Nút CTA Chuyển Tiếp Sang Trạm Kho Khi Lô Đã Bàn Giao (`RULE-MRX-NAV-01`)

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Step 1.1**: Viết test kiểm chứng trạng thái lô `TRANSFERRED` / `IN_PROGRESS`.
  - Mở `frontend/src/__tests__/WeeklyMenu.test.tsx`.
  - Thêm test case: Khi `batch.status === 'TRANSFERRED'`, thanh WorkspaceHeader phải hiển thị nút CTA `Đi đến Trạm Kho nguyên liệu →`.
  - Khi click nút này, navigate sang `/warehouse?view=mrx-daily&batchId={batchId}`.
- [ ] **Step 1.2**: Chạy test để xác nhận FAIL (RED).
  - Lệnh: `npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx`
- [ ] **Step 1.3**: Cập nhật logic `primaryAction` trong `MrxBatchWorkbench.tsx`.
  - Bổ sung nhánh:
    ```tsx
    : batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS' ? {
        label: 'Đi đến Trạm Kho nguyên liệu →',
        action: () => navigate(`/warehouse?view=mrx-daily&batchId=${encodeURIComponent(batch.batchId)}`),
        capability: 'RECON.BATCH.READ',
        variant: 'default',
      }
    ```
  - Cập nhật banner thông báo thành công: Bổ sung nút liên kết phụ chuyển nhanh sang trạm Kho.
- [ ] **Step 1.4**: Chạy lại test để xác nhận PASS (GREEN).
- [ ] **Step 1.5**: Chạy `npm run lint:fe` và xác nhận không có lỗi cú pháp.

---

### Task 2: Triển Khai Thanh Vòng Đời Lô Liên Trạm Trực Quan (Lifecycle Step Indicator)

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Step 2.1**: Viết test kiểm chứng thanh vòng đời trong `WeeklyMenu.test.tsx`.
  - Kiểm tra các nấc: `1. Nguồn thực đơn`, `2. Đóng băng lô`, `3. Xuất kho ca`, `4. Phiếu nấu`, `5. Chốt sổ tuần`.
  - Xác nhận nấc hiện tại có aria-current hoặc badge trạng thái phù hợp.
- [ ] **Step 2.2**: Chạy test xác nhận RED.
- [ ] **Step 2.3**: Xây dựng component thanh vòng đời con `MrxBatchLifecycleStrip` bên trong `MrxBatchWorkbench.tsx` (hoặc tái sử dụng mẫu thiết kế của `ReconciliationLifecycleStrip`).
  - Sử dụng các icon chuẩn Lucide: `CheckCircle2`, `Clock`, `ArrowRight`.
  - Định dạng màu sắc WCAG AA ($\ge 4.5:1$): `text-slate-600 font-medium` cho bước chưa diễn ra, `text-emerald-700 bg-emerald-50` cho bước đã hoàn tất, `text-blue-700 bg-blue-50 ring-1 ring-blue-300` cho bước đang xử lý.
- [ ] **Step 2.4**: Tích hợp thanh vòng đời vào bên dưới `TelemetrySubbar`.
- [ ] **Step 2.5**: Chạy test xác nhận GREEN.

---

### Task 3: Tự Động Kích Hoạt Bước Tiếp Theo Sau Khi Xuất Bản Thực Đơn DRAFT

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Step 3.1**: Viết test kiểm tra luồng `publishMenu` tự động gọi `checkQuantities`.
  - Mock `weeklyMenuApi.publishMenuSchedule` và `mrxApi.previewQuantityImport`.
  - Xác nhận sau khi bấm "Xuất bản thực đơn tuần", API `previewQuantityImport` được tự động gọi.
- [ ] **Step 3.2**: Chạy test xác nhận RED.
- [ ] **Step 3.3**: Cập nhật hàm `publishMenu` trong `MrxBatchWorkbench.tsx`.
  - Sau khi xuất bản và cập nhật quick-servings thành công, gọi ngay:
    ```tsx
    const previewData = await mrxApi.previewQuantityImport({
      menuVersionId: source.menuVersionId,
      sourceLabel: `Tuần ${source.weekStartDate ?? weekStartDate}`,
    });
    setPreview(previewData);
    ```
  - Cập nhật thông báo phản hồi: "Đã xuất bản thực đơn tuần thành công và hoàn tất tính toán định lượng. Sẵn sàng tạo lô nháp."
- [ ] **Step 3.4**: Chạy test xác nhận GREEN.

---

### Task 4: Hoàn Thiện Công Thái Học & Lối Thoát Cho Modal Đổi Số Suất Ca & Review Của Admin

**Files:**
- Modify: `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

- [ ] **Step 4.1**: Viết test kiểm tra phím Escape và nút Hủy của modal `isChangeOpen`.
  - Test mở modal đổi số suất ca, bấm nút "Hủy thay đổi" hoặc phím Escape $\rightarrow$ modal đóng và không gửi request nào.
  - Test khi API `confirmSourceChange` hoặc `submitSourceChange` trả về lỗi HTTP 409 $\rightarrow$ modal giữ nguyên dữ liệu đã nhập và hiển thị nút "Tải lại dữ liệu nguồn".
- [ ] **Step 4.2**: Chạy test xác nhận RED.
- [ ] **Step 4.3**: Tinh chỉnh modal `isChangeOpen` trong `MrxBatchWorkbench.tsx`:
  - Thêm nút `<Button variant="outline" onClick={() => setIsChangeOpen(false)}>Hủy thay đổi</Button>`.
  - Đảm bảo thuộc tính `isOpen={isChangeOpen}` và `onClose={() => setIsChangeOpen(false)}` được gán đầy đủ vào `<Modal>`.
  - Bổ sung khối xử lý lỗi xung đột phiên bản 409 với nút reload: `<Button variant="outline" size="sm" onClick={loadSource}>Tải lại dữ liệu nguồn</Button>`.
- [ ] **Step 4.4**: Tinh chỉnh modal duyệt của Admin `reviewRequest`:
  - Hiển thị bảng so sánh rõ ràng: Số suất cũ $\rightarrow$ Số suất mới.
  - Ràng buộc bắt buộc nhập lý do từ chối trước khi nút "Từ chối" có thể bấm được (`rejectionReason.trim().length > 0`).
- [ ] **Step 4.5**: Chạy test xác nhận GREEN.

---

### Task 5: Chạy Kiểm Thử Định Lượng 5 Tầng & Headed Chromium Live Đo Đạc Trực Tiếp

**Files:**
- Script: `scripts/run-headed-expert-audit.mjs`
- Test suite: `npm run verify`

- [ ] **Step 5.1**: Chạy toàn bộ kiểm thử đơn vị FE:
  - Lệnh: `npm run test:fe:unit` (18 files / 166+ tests PASS).
- [ ] **Step 5.2**: Chạy kiểm tra kiến trúc nghiêm ngặt và hợp đồng:
  - Lệnh: `npm run check:architecture-growth` và `npm run check:conformance-contracts`.
- [ ] **Step 5.3**: Chạy linter và kiểm tra cấu trúc phụ thuộc:
  - Lệnh: `npm run lint:fe && npm run depcruise:fe && npm run build:fe`.
- [ ] **Step 5.4**: Chạy kiểm thử có giao diện trực tiếp (Headed Chromium live):
  - Lệnh: `node scripts/run-headed-expert-audit.mjs`.
  - Kiểm tra trực tiếp trên trình duyệt Chromium:
    - Actor `admin` và `dieuphoi` thao tác trơn tru trên `/weekly-menu?view=mrx-batch`.
    - Nút CTA chuyển sang trạm Kho hoạt động tức thì.
    - Không xuất hiện bất kỳ cảnh báo đỏ hay lỗi mạng nào.
- [ ] **Step 5.5**: Cập nhật `.planning/WORK.md` và `docs/handoff/HANDOFF.md`, đưa trạng thái về `IDLE`.
