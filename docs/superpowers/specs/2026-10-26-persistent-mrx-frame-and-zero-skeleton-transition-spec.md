# Đặc Tả Kỹ Thuật Khóa Cứng: Kiến Trúc Khung Vận Hành Thường Trực & Triệt Tiêu Hoàn Toàn Skeleton Chớp Nháy Khi Chuyển Route Chế Độ MRX

> **Mã đặc tả:** `SPEC-PERSISTENT-MRX-FRAME-ZERO-SKELETON-20261026-LOCKED`  
> **Thẩm quyền:** `AGENTS.md` (Bất biến `DOM-MODE-1`, Kiến trúc quản trị 5 tầng) & `docs/DESIGN.md`  
> **Mục tiêu tối thượng:**  
> 1. Triệt tiêu 100% hiện tượng chớp nháy Skeleton toàn trang khi người dùng bấm chuyển giữa các route menu chính trên Sidebar (`/reconciliation` $\leftrightarrow$ `/warehouse?view=mrx-daily` $\leftrightarrow$ `/weekly-menu?view=mrx-batch`).  
> 2. Đưa trải nghiệm chuyển route về chuẩn mực như khi chuyển subview (`?view=variances` $\leftrightarrow$ `?view=transactions`): Hoán đổi tức thì trong 0ms (Instant Swap), không unmount sụp đổ màn hình.  
> 3. Kiểm chứng trực tiếp trên web thật (`http://localhost:5173`) kết nối backend thật (`http://localhost:5262`), đo đạc thông số thực tế, tuyệt đối không dùng số liệu mock để làm đẹp kết quả.

---

## 1. CÁC QUY TẮC BẤT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Khóa Cứng: Điều Hướng Đồng Bộ Concurrent Navigation (`RULE-CONCURRENT-NAV-01`)
- Mọi thao tác điều hướng click trên Sidebar `AppShell.tsx` **BẮT BUỘC** được thực thi bên trong `startTransition(() => navigate(to))`.
- Cơ chế Concurrent Mode của React 18 bảo đảm giữ nguyên màn hình cũ đang hiển thị cho đến khi màn hình mới chuẩn bị xong dữ liệu trong RAM, sau đó hoán đổi trong đúng 1 frame trình duyệt.
- Tuyệt đối không xóa trắng DOM hay để lộ khoảng trống trung gian trong lúc chuyển đổi URL.

### 1.2. Khóa Cứng: Cấm Skeleton Toàn Trang Trong Phiên Vận Hành (`RULE-FORBID-FULL-SKELETON-OPERATIONAL`)
- Trong `StateBoundary.tsx`:
  - `WorkbenchSkeleton` (bảng xám 12 dòng) **CHỈ ĐƯỢC PHÉP HIỆN DIỆN ĐÚNG 1 LẦN DUY NHẤT** khi người dùng F5 tải lại toàn bộ trang web từ đầu (Cold Boot) mà chưa có bất kỳ dữ liệu nào trong RAM.
  - Khi người dùng đang ở trong một phiên làm việc và thao tác chuyển menu: **CẤM TUYỆT ĐỐI** biến cả trang thành Skeleton.
  - Nếu route mới cần gọi mạng lần đầu (chưa có cache): Giữ nguyên nền phẳng, hiển thị thanh tiến trình hairline 2px thanh lịch ở đỉnh bảng, tuyệt đối không ném bảng skeleton xám xịt 12 dòng ra đập vào mắt người dùng.

### 1.3. Khóa Cứng: Bộ Nhớ Đệm SWR Lưu Trữ Mọi Trạng Thái Cuối Cùng (`RULE-SWR-COMPLETE-SNAPSHOT`)
- `serverStateCache` lưu trữ trọn vẹn cả 3 loại trạng thái:
  + Dữ liệu thành công: `{ status: 'SUCCESS', data: [...] }`.
  + Trạng thái rỗng: `{ status: 'EMPTY', data: null }`.
  + Trạng thái tương thích 409 (`LEGACY_LINEAGE_MISSING`): `{ status: 'COMPATIBILITY_BLOCKED', data: null, reason: '...' }`.
- Khi người dùng chuyển qua lại giữa các menu: `serverStateCache.get(...)` hit cache ngay ở frame 0 $\rightarrow$ `isLoading = false` ngay từ mili-giây đầu tiên $\rightarrow$ **0ms nạp dữ liệu, zero skeleton**.

### 1.4. Khóa Cứng: Đo Kiểm Thực Tế Trên Web Thật (Zero Synthetic Pass)
- Mọi thông số đo kiểm phải chạy trực tiếp trên Chrome thật kết nối Backend ASP.NET Core đang chạy ở port 5262.
- Ghi lại toàn bộ nhật ký F12 Console, F12 Network, thời gian chuyển đổi (ms) và chụp ảnh màn hình làm bằng chứng độc lập.

---

## 2. MA TRẬN KIỂM SOÁT DÒNG CODE VẬT LÝ (< 600 DÒNG)

- `frontend/src/components/workbench/StateBoundary.tsx`: < 380 dòng.
- `frontend/src/components/workbench/AppShell.tsx`: < 390 dòng.
- `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`: < 595 dòng.
- `frontend/src/features/reconciliation/ReconciliationPage.tsx`: < 595 dòng.
- `frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx`: < 535 dòng.

Bản đặc tả kỹ thuật này là căn cứ tối cao cho việc triệt tiêu hoàn toàn sự cố chớp nháy skeleton.
