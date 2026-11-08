# Đặc Tả Kỹ Thuật Khóa Cứng: Kiến Trúc Bộ Nhớ Đệm SWR Toàn Diện, Triệt Tiêu 100% Skeleton Flash Khi Chuyển Route Chế Độ MRX

> **Mã đặc tả:** `SPEC-MRX-ZERO-STROBE-SWR-CACHE-20261026-LOCKED`  
> **Thẩm quyền:** `AGENTS.md` (Bất biến `DOM-MODE-1`, Kiến trúc quản trị 5 tầng) & `docs/DESIGN.md`  
> **Mục tiêu tối thượng:**  
> 1. Triệt tiêu hoàn toàn cú chớp Skeleton 15ms - 35ms khi người dùng bấm chuyển giữa các route trên Sidebar (`action1_frame_15ms.png`).  
> 2. Chuẩn hóa bộ nhớ đệm `serverStateCache` (Tầng 4) lưu trữ toàn diện cả trạng thái thành công, trạng thái rỗng và trạng thái tương thích (404 / 409).  
> 3. Khóa cứng quy tắc "Không có ID thì không bật Skeleton" (`RULE-NO-ID-NO-SKELETON`).

---

## 1. CÁC QUY TẮC BẮT BIẾN KHÓA CỨNG (LOCKED RULES)

### 1.1. Khóa Cứng: Không Có ID Hợp Lệ Thì Cấm Bật Skeleton (`RULE-NO-ID-NO-SKELETON`)
- Tại toàn bộ 4 trạm MRX (`MrxBatchWorkbench`, `MrxDailyIssueWorkbench`, `MrxCookingWorkbench`, `ReconciliationPage`):
  - Khởi tạo cờ `loading` / `isLoading`:
    ```tsx
    const [loading, setLoading] = useState(() => Boolean(targetId && !initialCache));
    ```
  - Nếu `!targetId` (chưa có ID khách hàng, ID lô hoặc tuần rỗng): `loading` **bắt buộc phải là `false` ngay tại mili-giây thứ 0**.
  - `<StateBoundary>` **CẤM TUYỆT ĐỐI** render Skeleton khi không có đối tượng ID để nạp. Giao diện phải ở trạng thái Neutral / Empty State ngay lập tức trong 0ms.

### 1.2. Khóa Cứng: Bộ Nhớ Đệm SWR Lưu Trữ Trạng Thái Đầy Đủ (`RULE-SWR-ENVELOPE-CACHE`)
- `serverStateCache` lưu trữ cấu trúc phong bì trạng thái (Envelope):
  + Khi API trả về dữ liệu thành công: Lưu `{ data, status: 'SUCCESS' }`.
  + Khi API trả về 404 (chưa có thực đơn phát hành): Lưu `{ data: null, status: 'NOT_FOUND' }`.
  + Khi API trả về 409 (lô cũ chưa phân rã ngày `LEGACY_DAILY_LINEAGE_MISSING`): Lưu `{ data: null, status: 'COMPATIBILITY_BLOCKED', reason: '...' }`.
- Khi người dùng bấm chuyển qua lại giữa các menu và quay lại lô đó:
  + `serverStateCache.get(...)` hit cache ngay ở Frame 0 (miligiây đầu tiên).
  + Khôi phục ngay trạng thái cảnh báo / empty mà **không cần gửi lại request mạng và KHÔNG BẬT LẠI SKELETON**.

### 1.3. Khóa Cứng: Khóa Cache Động Chống Stale Closure (`RULE-DYNAMIC-CACHE-KEY`)
- Mọi hàm tải dữ liệu (`load(targetId, targetDate)`) bắt buộc phải tạo khóa cache trực tiếp từ tham số đầu vào:
  `const key = \`mrx_daily_\${targetId}\`;`
- Nghiêm cấm sử dụng biến `cacheKey` đóng băng từ scope ngoài của component.

### 1.4. Khóa Cứng: Giữ Vững Trần Kiến Trúc (< 600 Dòng)
- Mọi file sau khi refactor đều phải đảm bảo < 600 dòng để thỏa mãn script `check-architecture-growth.mjs`.

---

## 2. MA TRẬN 5 TẦNG KIẾN TRÚC ÁP DỤNG CHO 4 TRẠM MRX

| Phân hệ MRX | Khóa SWR Cache | Xử lý Cache Hit 0ms | Xử lý Không có ID |
|---|---|---|---|
| **Lập lô MRX** (`/weekly-menu?view=mrx-batch`) | `mrx_source_${customerId}_${weekStartDate}` | Nạp `source` & `batch` trong 0ms | `loading = false`, render empty CTA |
| **Kho xuất ngày** (`/warehouse?view=mrx-daily`) | `mrx_daily_${batchId}` | Nạp `daily` & `history` trong 0ms, cache cả 409 | `loading = false`, render banner 0ms |
| **Bếp ca** (`/chef?view=mrx-cooking`) | `mrx_cooking_${batchId}` | Nạp `kitchenCooking` trong 0ms, cache cả 409 | `loading = false`, render hướng dẫn 0ms |
| **Giám sát đối soát** (`/reconciliation`) | `mrx_recon_${batchId}_${serviceDate}` | Nạp `summary` trong 0ms | `loading = false`, render empty trung thực |

Bản đặc tả kỹ thuật này là căn cứ tối cao cho việc loại bỏ triệt để hiện tượng chớp nháy skeleton.
