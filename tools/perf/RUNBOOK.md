# Runbook kiểm thử hiệu năng (NFR) — IPCManagement

Bộ kit này gồm hai phần bổ trợ nhau, đặt tại `tools/perf/`:

- `k6/` — kịch bản load test đo từ phía API (end-to-end qua HTTP, đúng đường đi frontend gọi backend gọi MySQL).
- `sql/` — script chẩn đoán MySQL để tìm nguyên nhân gốc khi một endpoint vượt ngưỡng.

Ngưỡng mục tiêu lấy từ `.docs/ipc-hieu-nang-mysql.md` mục 5: màn hình danh sách p95 < 800ms, tìm kiếm < 500ms, danh sách nhóm < 1s, báo cáo < 3s, không truy vấn nào vượt 1s.

---

## 0. Các điểm nóng đã phát hiện khi đọc code (đọc trước khi đo)

Khi khảo sát backend, những chỗ sau nhiều khả năng là nguyên nhân chậm — hãy đối chiếu với kết quả đo:

1. ~~**Báo cáo aggregate kéo toàn bộ dữ liệu về RAM.**~~ **ĐÃ SỬA 26/07/2026 (commit `110e3c0`):** ba báo cáo price-variance (by-supplier/by-period/by-dish-group và các bản `/page`) đã chuyển `GroupBy` dịch xuống SQL, aggregate qua `double` để tương thích SQLite trong test. Đo trước/sau bằng chính kit này: baseline price-variance 256 ms → 75 ms; stress 60 RPS p95 danh sách 2,8 s → 18 ms, báo cáo 4,3 s → ≤165 ms, dropped 163 → 0. `BuildPurchasePlanRowsAsync` (nguồn của `GetPurchasePlanPageAsync`) cũng đã bỏ 6 nhánh `Include`, chuyển sang projection scalar + `PendingReceiptQty` tính bằng subquery ở database (cùng ngày, đợt sửa thứ hai).
2. ~~**Phân trang thiếu `OrderBy`.**~~ **ĐÃ SỬA 26/07/2026:** `GenericRepository.GetPagedAsync` sắp ổn định theo toàn bộ cột khóa chính (`ApplyStableOrdering`) — thứ tự trang xác định và MySQL cắt trang bằng chỉ mục PK. Các override riêng (Dish/Ingredient) vốn đã có OrderBy riêng.
3. **Đếm chính xác ở mọi trang.** Mẫu `CountAsync()` + `Skip/Take` chạy 2 truy vấn mỗi lần mở danh sách; càng nhiều dòng, `COUNT` càng chậm (InnoDB phải quét chỉ mục). Tài liệu hiệu năng mục 2.8 đã khuyến nghị chuyển sang phân trang con trỏ.
4. ~~**N+1 ở inbox duyệt.**~~ **ĐÃ SỬA 26/07/2026:** material-demand builder nạp trước plans/users/lines/tên nguyên liệu/đơn vị theo lô (5 truy vấn cho cả trang thay vì 3+ mỗi request); SLA tính theo lô (`PopulateSlaBatchAsync`): một truy vấn rule mỗi loại chứng từ + một truy vấn submit-time cho toàn bộ target, giá trị đơn mua tính từ lines đã Include thay vì `SumAsync` riêng. Lưu ý ngữ nghĩa: submit-time giờ lấy **sớm nhất** (Min) thay vì "dòng đầu tiên" không xác định như cũ.
5. **`DishService` đếm 7–10 bảng tuần tự** (`GetSampleImportStatus`, dòng ~249–316): mỗi `CountAsync` là một round-trip; màn hình nào gọi endpoint này sẽ cộng dồn toàn bộ.
6. **Rate limiter sẽ bóp méo kết quả đo tải** — xem mục 2 dưới đây.

---

## 1. Chuẩn bị

1. Cài k6 trên Windows: `winget install k6 --source winget` (hoặc `choco install k6`).
2. Backend chạy ở `http://localhost:8001` (hoặc đặt `BASE_URL` khác), MySQL local có dữ liệu gần với thực tế (~50k bản ghi — dùng lane DB đã seed của Shipyard là hợp lý nhất).
3. Đo trên bản **Release** để số liệu không bị nhiễu bởi debug: `dotnet run -c Release --project backend/src/IPCManagement.Api`.
4. Đóng các tiến trình nặng khác trên máy khi đo.

## 2. Nới rate limit khi đo tải (bắt buộc cho load/stress)

`Program.cs` giới hạn `api-general` = **100 request/phút cho mỗi user** và `auth-strict` = **5 login/phút theo IP**. Load test dùng chung một tài khoản nên chỉ ~2 VU là dính 429 — kết quả đo sẽ toàn lỗi rate limit chứ không phải hiệu năng thật.

**ĐÃ TRIỂN KHAI 26/07/2026:** `Program.cs` đọc `RateLimiting:ApiPermitLimit` từ config (mặc định 100 = production) và `appsettings.Development.json` đang đặt `100000`. Muốn đo lại hành vi rate limit thật thì xóa khối `RateLimiting` khỏi appsettings Development.

`smoke.js` (1 VU, ~45 request rải trong ~10s) chạy được mà không cần nới. Kịch bản k6 đã tự check và báo riêng nếu gặp 429.

Lưu ý: login chỉ được gọi **một lần trong `setup()`** của mỗi kịch bản, nên không đụng `auth-strict`.

## 3. Trình tự đo

Chạy từ thư mục `tools/perf/k6/`. Đặt biến môi trường (PowerShell):

```powershell
$env:BASE_URL   = 'http://localhost:8001'
$env:K6_USERNAME = 'admin'
$env:K6_PASSWORD = '<mật khẩu tài khoản demo>'
```

### Bước 1 — Baseline (bắt buộc chạy trước)

```powershell
k6 run smoke.js
```

1 người dùng, không tải. Console in bảng ĐẠT/VƯỢT theo từng endpoint. **Nếu baseline đã VƯỢT thì không cần load test** — vấn đề nằm ở truy vấn/code, sang mục 4 chẩn đoán ngay. Load test chỉ có ý nghĩa khi baseline đã ĐẠT.

### Bước 2 — Load test (tải làm việc thực tế)

```powershell
k6 run load.js                      # mặc định 20 VU
$env:K6_MAX_VUS = '50'; k6 run load.js   # thử mức cao hơn
```

Mô phỏng nhân viên thao tác có think-time 0.5–2s. PASS khi mọi threshold p95 đạt và tỷ lệ lỗi < 1%.

### Bước 3 — Stress test (tìm điểm gãy)

```powershell
k6 run stress.js                    # 5 → 60 request/giây trong 6 phút
$env:K6_PEAK_RATE = '120'; k6 run stress.js
```

Quan sát mức RPS mà tỷ lệ lỗi vượt 1% hoặc p95 danh sách vượt 800ms — đó là năng lực tối đa hiện tại, ghi vào báo cáo NFR.

Kết quả mỗi lần chạy được lưu `results-*.json` cạnh script.

## 4. Chẩn đoán nguyên nhân gốc khi có endpoint VƯỢT

Chạy song song với phiên đo (MySQL client, quyền root):

1. **Trước khi đo:** chạy `sql/01-enable-diagnostics.sql` — bật slow log ngưỡng 0.5s, reset bộ đếm thống kê.
2. **Tái hiện:** chạy lại kịch bản k6 có endpoint bị chậm (hoặc thao tác tay trên UI).
3. **Sau khi đo:** chạy từng khối trong `sql/02-diagnose.sql`:
   - Khối A cho biết truy vấn nào tốn thời gian nhất và tỷ lệ `rows_examined/rows_sent` (tỷ lệ > 100 = thiếu chỉ mục).
   - Khối B liệt kê truy vấn full table scan; khối C là truy vấn tạo bảng tạm trên đĩa.
   - Lấy câu SQL chậm nhất, chạy `EXPLAIN ANALYZE <câu đó>;` để xem bước nào ăn thời gian thật.
4. **Kết thúc:** chạy `sql/03-disable-diagnostics.sql` để tắt log tránh phình.

Đối chiếu thêm phía EF Core: `appsettings.Development.json` đã bật `Microsoft.EntityFrameworkCore.Database.Command: Information` — đếm số dòng SQL log ra khi mở một màn hình; nếu một lần mở màn hình sinh hàng chục truy vấn thì là N+1 (tài liệu hiệu năng mục 3.1 yêu cầu đưa việc đếm này vào test tự động).

## 5. Mẫu bảng kết quả NFR (điền vào báo cáo)

Kết quả đo ngày 26/07/2026 (backend Release cổng 8001, DB `ipcmanagement`, sau fix price-variance `110e3c0`):

| Kịch bản | Điều kiện | Chỉ tiêu | Ngưỡng | Kết quả đo | Đạt? |
|---|---|---|---|---|---|
| Baseline | 1 VU, warm | p95 màn hình danh sách | < 800 ms | 6–21 ms | Đạt |
| Baseline | 1 VU, warm | p95 tìm kiếm món | < 500 ms | 8 ms | Đạt |
| Baseline | 1 VU, warm | p95 báo cáo biến động giá | < 3000 ms | 75 ms (trước fix: 256 ms) | Đạt |
| Load | 20 VU, 5 phút | p95 màn hình danh sách | < 800 ms | 16–32 ms | Đạt |
| Load | 20 VU, 5 phút | Tỷ lệ lỗi | < 1% | 0.00% (2.817 request, 9.3 RPS) | Đạt |
| Stress trước fix | ramp → 60 RPS | RPS tại điểm gãy | ghi nhận | ~25 RPS (p95 danh sách >800 ms); bão hòa ~55 RPS; 0% lỗi | — |
| Stress sau fix | ramp → 60 RPS | RPS tại điểm gãy | ghi nhận | Không gãy trong phạm vi 60 RPS (p95 danh sách 16–18 ms, 0 dropped) | — |
| DB | trong phiên load | Truy vấn chậm nhất | < 1 s | chưa đo (mục 4 chưa chạy) | — |

Cold-run đầu tiên sau khi khởi động backend cho số cao hơn ~2× (JIT + connection pool) — ghi rõ điều kiện warm/cold khi đưa số vào báo cáo.

Kèm minh chứng: `results-smoke.json`, `results-load.json`, `results-stress.json`, ảnh chụp khối A của `02-diagnose.sql`.

## 6. Thứ tự sửa đề xuất (khớp với điểm nóng mục 0)

1. ~~Thêm `OrderBy` ổn định vào mọi `Skip/Take`~~ **ĐÃ LÀM 26/07/2026** — `GenericRepository.ApplyStableOrdering` theo khóa chính.
2. ~~Chuyển các báo cáo `price-variance/*` và các bản `/page` của chúng sang `GroupBy` dịch xuống SQL~~ **ĐÃ LÀM 26/07/2026** (commit `110e3c0`, số liệu ở mục 5). `BuildPurchasePlanRowsAsync` cũng đã bỏ Include, dùng projection + subquery. KPI `/operational-kpis` đã có cache controller TTL 15 s + single-flight (cold 123 ms → hit 4–5 ms).
3. Gộp các `CountAsync` tuần tự trong `DishService` thành một truy vấn `UNION ALL`/một lần round-trip, hoặc cache kết quả. (Còn mở — điểm nóng cuối cùng của danh sách này.)
4. ~~Sửa N+1 trong `ApprovalInboxService`~~ **ĐÃ LÀM 26/07/2026** — nạp theo lô + SLA batch (xem mục 0.4).
5. Sau mỗi thay đổi, chạy lại `smoke.js` để so p95 trước/sau — giữ `results-*.json` cũ làm bằng chứng cải thiện.
