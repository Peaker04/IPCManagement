# Đặc Tả Kỹ Thuật: Bộ Khung Kiểm Thử E2E Toàn Diện Phân Hệ MRX (Horizontal & Vertical Topology Across 5 Scenario Groups)

## 1. Bối cảnh, Mục đích & Lý do (Intent & The Why)
- **Mã phân hệ**: `FR-RECON` (Reconciliation), `FR-MENU` (Planning/Batch), `FR-WH` (Warehouse Daily/Preparation), `FR-CHEF` (Cooking), `FR-CAT` (BOM & Catalog).
- **Vấn đề cần giải quyết**:
  Các kịch bản kiểm thử E2E trước đây chủ yếu tập trung vào luồng hạnh phúc (Golden Path) và một số tình huống kiểm tra cơ bản. Hệ thống còn thiếu vắng các kịch bản kiểm thử thực tế đa vai trò (Multi-Role Handoff), các luồng nghiệp vụ rẽ nhánh có bồi hoàn/rollback (Cancellation & Compensation), xung đột dữ liệu đồng thời thật (Optimistic Concurrency 409 với 2 trình duyệt song song), cơ chế offline queue, token hết hạn giữa chừng và kiểm tra bất biến tầng đáy bằng truy vấn SQL trực tiếp.
- **Mục đích**:
  Xây dựng **Harness E2E Playwright chuyên sâu kết hợp Command Suite chuẩn** (`npm run test:e2e:mrx`), bao phủ 2 chiều Topology (Horizontal xuyên phòng ban và Vertical xuyên thấu 5 tầng kiến trúc) qua 5 nhóm kịch bản nghiệp vụ khắt khe, tuân thủ tuyệt đối các quy tắc chống giả mạo kiểm thử Rule TA-1 đến TA-5.

---

## 2. Bất Biến An Toàn & Ràng Buộc Cốt Lõi (Hard Guardrails & Invariants)

1. **Hard Database Guardrail (Bảo vệ tuyệt đối Database chính)**:
   - Trong `globalSetup.ts`, `dbGuardrail.ts` và mọi helper thực thi SQL: Bắt buộc assert tên schema CSDL mục tiêu phải là `ipc_mrx_e2e_sandbox` và cổng backend là `5263`.
   - **FATAL ERROR INTERCEPTOR**: Nếu phát hiện chuỗi kết nối chứa tên `ipcmanagement` hoặc cổng `5262`, ném ngoại lệ dừng toàn bộ tiến trình ngay lập tức.
2. **`DOM-MODE-1` Isolation**:
   - Toàn bộ các bước kiểm thử chạy trong chế độ `MATERIAL_RECONCILIATION`. Không rò rỉ sang `DEFAULT`.
3. **Quy tắc TA-1 đến TA-5 (Zero Synthetic Mocks trong E2E)**:
   - Tuyệt đối KHÔNG dùng `page.route` để giả lập mã lỗi 409, 400 hoặc rollback ở Nhóm 4. Mọi xung đột phải được kích hoạt thật bằng 2 `BrowserContext` đồng thời gọi vào backend Kestrel trên cổng 5263.
   - Mọi thao tác xuất kho bổ sung, hủy ca và nhập trả nguyên liệu bắt buộc phải kiểm chứng bất biến số học trực tiếp trong MySQL:
     $$\text{Tồn cuối kỳ} = \text{Tồn đầu kỳ} - \text{Tổng lượng thực xuất} + \text{Tổng lượng nhập trả}$$
4. **Auto-Cleanup & Teardown Verification**:
   - Khi kết thúc toàn bộ suite hoặc sau mỗi test group: Dọn dẹp sạch sẽ 100% bản ghi test và assert số lượng bản ghi dư thừa = `0`. Xóa bỏ hoàn toàn database sandbox.

---

## 3. Cấu Trúc Thư Mục & Tổ Chức Mã Nguồn

```text
frontend/tests/e2e-mrx/
├── config/
│   └── playwright.mrx.config.ts          # Playwright config chuyên biệt cho MRX E2E (port 5174/5263, trace, video)
├── core/
│   ├── dbGuardrail.ts                    # Guardrail kiểm tra chuỗi kết nối (chặn ipcmanagement)
│   ├── mysqlVerifier.ts                  # SQL Verifier (chọc trực tiếp MySQL query tồn kho, trạng thái chứng từ)
│   ├── globalSetup.ts                    # Clone sandbox DB, khởi động Kestrel 5263, Vite 5174
│   └── globalTeardown.ts                 # Dọn dẹp dữ liệu, assert 0 rác, drop sandbox DB, tắt tiến trình
├── fixtures/
│   ├── mrxTest.ts                        # Extended Playwright test fixture tích hợp 4 vai trò & dbVerifier
│   └── authHelpers.ts                    # Helper đăng nhập và thiết lập mode MATERIAL_RECONCILIATION
└── specs/
    ├── g1-golden-path.spec.ts            # @G1-Golden: Luồng hạnh phúc khép kín từ lập lô -> hoàn tất
    ├── g2-multi-role-handoff.spec.ts     # @G2-RBAC: Bàn giao 4 vai trò (Điều phối -> Kho -> Bếp -> Quản lý)
    ├── g3-alternative-flows.spec.ts      # @G3-Alt: Biến động nguồn, xuất bù ca, bổ sung BOM thiếu
    ├── g4-concurrency-rollback.spec.ts   # @G4-Rollback: 2 Context song song, 409 thật, nhập trả, invariant tồn
    └── g5-async-timeout.spec.ts          # @G5-Async: Offline queue, token hết hạn, auto-close quá hạn
```

---

## 4. Thiết Kế Chi Tiết 5 Nhóm Kịch Bản Nghiệp Vụ

### Nhóm 1: Golden Path (`@G1-Golden`)
- **Mục tiêu**: Kiểm chứng luồng vận hành chuẩn không có sai sót từ đầu tuần đến cuối tuần.
- **Kịch bản chi tiết**:
  1. *Lập lô*: Điều phối viên chọn khách hàng `ANV`, tuần `2026-07-20`. Nạp thực đơn Excel chuẩn $\rightarrow$ Bấm *Kiểm tra định lượng* $\rightarrow$ Đạt 100% hợp lệ $\rightarrow$ Bấm *Đóng băng lô* (chuyển sang `READY`).
  2. *Bàn giao*: Bấm *Chuyển sang Kho nguyên liệu* $\rightarrow$ Lô chuyển trạng thái `TRANSFERRED`.
  3. *Xuất kho 7 ngày*: Thủ kho vào `/warehouse?view=mrx-daily`, chọn lô. Duyệt qua từng ngày (T2 $\rightarrow$ CN), bấm *Điền đủ toàn bộ* $\rightarrow$ Bấm *Xác nhận xuất kho* cho đủ 7 ngày. Lô chuyển sang `IN_PROGRESS` và `WEEK_COMPLETE`.
  4. *Bếp xác nhận*: Bếp trưởng vào `/chef?view=mrx-cooking`, kiểm tra phiếu nấu 7 ngày khớp 100%.
  5. *Khóa sổ đối soát*: Quản lý vào `/reconciliation`, kiểm tra bảng đối soát chênh lệch = 0 (tất cả dòng `MATCHED`), bấm *Chốt đối soát tuần* $\rightarrow$ Xác nhận hoàn tất. Lô chuyển trạng thái `COMPLETED`.
  6. *Vertical DB Assertion*: Query MySQL bảng `reconciliationbatches`, kiểm tra `Status = 'COMPLETED'`, `Version = 6`, `CompletedAt IS NOT NULL`.

### Nhóm 2: Multi-Role Handoff Cases (`@G2-RBAC`)
- **Mục tiêu**: Kiểm chứng sự chuyển giao trách nhiệm giữa 4 vai trò và ranh giới bảo mật không bị vượt quyền.
- **Kịch bản chi tiết**:
  1. *Bếp trưởng không thể xuất kho*: Đăng nhập tài khoản `beptruong`, truy cập `/warehouse?view=mrx-daily`. Nút *Xác nhận xuất kho* và *Điền đủ* bị ẩn/khóa bởi `ActionGuard`.
  2. *Thủ kho không thể sửa thực đơn*: Đăng nhập `thukho`, truy cập `/weekly-menu?view=mrx-batch`. Nút *Chỉnh sửa lịch tuần* và *Nhập thực đơn Excel* bị vô hiệu hóa.
  3. *Điều phối viên không thể tự khóa sổ*: Đăng nhập `dieuphoi`, truy cập `/reconciliation`. Nút *Chốt đối soát tuần* bị chặn bởi policy quyền Quản lý.
  4. *Quản lý thẩm định toàn quyền*: Đăng nhập `admin`/`manager`, có đầy đủ thẩm quyền duyệt thay đổi nguồn và khóa sổ.

### Nhóm 3: Alternative Business Flows (`@G3-Alt`)
- **Mục tiêu**: Xử lý các tình huống rẽ nhánh và biến động trong thực tế vận hành.
- **Kịch bản chi tiết**:
  1. *Thiếu định mức BOM khi tạo lô*: Import thực đơn có món mới chưa có định mức $\rightarrow$ Hệ thống chặn tạo lô, hiển thị danh sách cảnh báo $\rightarrow$ Bấm *Nhập BOM Excel cho các món thiếu* $\rightarrow$ Modal mở với context món thiếu $\rightarrow$ Tải template `missing` $\rightarrow$ Nạp file BOM bổ sung $\rightarrow$ Kiểm tra định lượng lại thành công.
  2. *Xuất bổ sung nguyên liệu trong ca*: Trong ca trưa phát sinh 50 suất đột xuất $\rightarrow$ Thủ kho mở modal *Xuất bổ sung ca*, chọn nguyên liệu và số lượng $\rightarrow$ Xác nhận xuất bổ sung thành công $\rightarrow$ Dòng ngày cập nhật số thực xuất tăng lên.
  3. *Giải trình sai lệch 2 chiều*: Dòng nguyên liệu có chênh lệch giữa Kho và Định mức $\rightarrow$ Quản lý mở `ReconciliationDispositionModal`, chọn danh mục *Hao hụt sơ chế thực tế* và điền lý do $\rightarrow$ Lưu giải trình thành công $\rightarrow$ Trạng thái dòng chuyển sang `DISPOSED`.

### Nhóm 4: Cancellation, Real Concurrency 409 & Compensating Rollback (`@G4-Rollback`)
- **Mục tiêu**: Kiểm chứng xung đột đồng thời thật giữa 2 người dùng và tính toàn vẹn số học của kho dữ liệu tầng đáy.
- **Kịch bản chi tiết**:
  1. *Real Concurrency 409 Collision (2 Contexts song song)*:
     - Khởi tạo 2 BrowserContext: Context 1 (`dieuphoiPage`), Context 2 (`thukhoPage`).
     - `dieuphoiPage` mở điều chỉnh nguồn (thay đổi số suất ca T4).
     - Cùng lúc đó, `thukhoPage` bấm *Xác nhận xuất kho* ca T4 với phiên bản nguồn cũ.
     - Backend cổng 5263 bắt xung đột phiên bản và trả về **HTTP 409 Conflict thật**.
     - `thukhoPage` hiển thị banner xung đột kèm nút *Tải lại dữ liệu mới nhất*, không bị crash giao diện.
  2. *Hủy ca & Nhập trả kho nguyên liệu thừa*:
     - Khách hàng báo hủy ca ăn đột xuất $\rightarrow$ Điều phối viên kích hoạt điều chỉnh giảm suất về 0.
     - Kho lập phiếu nhập trả kho nguyên liệu thừa đã xuất về lại kho.
  3. *Vertical SQL Invariant Assertion*:
     - Query trực tiếp bảng `inventorystocks`, `inventoryissues`, `inventoryreceipts` trong `ipc_mrx_e2e_sandbox`.
     - Khẳng định bất biến số học:
       `EndingQuantity == InitialQuantity - TotalIssuedQuantity + TotalReturnedQuantity`
     - Khẳng định không có bản ghi mồ côi (orphan records).

### Nhóm 5: Asynchronous, Offline Queue & Timeout Auto-Close (`@G5-Async`)
- **Mục tiêu**: Kiểm thử tính chịu lỗi mạng, tính Idempotency và tự động khóa sổ khi hết hạn.
- **Kịch bản chi tiết**:
  1. *Offline Mutation Queue & Idempotency*:
     - Thủ kho đang nhập số lượng thực xuất $\rightarrow$ Kích hoạt `context.setOffline(true)`.
     - Bấm *Xác nhận xuất kho* $\rightarrow$ Hệ thống chuyển sang trạng thái pending/offline banner, bảo toàn nguyên vẹn form.
     - Kích hoạt `context.setOffline(false)` $\rightarrow$ Hệ thống tự động đồng bộ lại yêu cầu.
     - Query CSDL: Khẳng định chỉ có duy nhất **1 phiếu xuất kho** được tạo (nhờ header Idempotency Key), không bị nhân bản phiếu xuất (zero duplication).
  2. *Token Timeout & Draft Preservation*:
     - Người dùng đang mở form giải trình chênh lệch dài 200 ký tự.
     - Xóa token khỏi `localStorage` (giả lập token hết hạn).
     - Bấm *Lưu hướng xử lý* $\rightarrow$ Hệ thống bắt lỗi 401/403, giữ nguyên vẹn nội dung lý do trên form, hiển thị thông báo yêu cầu gia hạn phiên làm việc.
  3. *Auto-Close Quá Hạn Đối Soát*:
     - Dùng SQL can thiệp lùi ngày `CreatedAt` của lô đối soát về quá 14 ngày trước trong sandbox DB.
     - Gọi worker/endpoint kiểm toán kỳ đối soát $\rightarrow$ Hệ thống tự động đóng sổ lô, chuyển trạng thái sang `COMPLETED`.
     - Khẳng định các role dưới không còn quyền chỉnh sửa dòng ngày của lô này nữa.

---

## 5. Thiết Kế DB Guardrail & SQL Verifier

### `dbGuardrail.ts`
```typescript
export function assertSafeSandboxDatabase(connectionString: string): void {
  const normalized = connectionString.toLowerCase();
  if (normalized.includes('ipcmanagement') || normalized.includes('5262')) {
    throw new Error('FATAL SECURITY VIOLATION: Test connection is targeting production database "ipcmanagement" or port 5262! Aborting immediately.');
  }
  if (!normalized.includes('ipc_mrx_e2e_sandbox') || !normalized.includes('5263')) {
    throw new Error('FATAL CONFIGURATION ERROR: Test must target sandbox database "ipc_mrx_e2e_sandbox" on port 5263.');
  }
}
```

### `mysqlVerifier.ts`
```typescript
export class MySQLVerifier {
  // Query trực tiếp database sandbox bằng CLI mysql.exe
  query(sql: string): any[];
  assertStockInvariant(ingredientId: string): void;
  assertZeroResidualTestData(prefix: string): void;
}
```

---

## 6. Đóng Gói Lối Vào `package.json`

```json
{
  "scripts": {
    "test:e2e:mrx": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts",
    "test:e2e:mrx:g1": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G1-Golden",
    "test:e2e:mrx:g2": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G2-RBAC",
    "test:e2e:mrx:g3": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G3-Alt",
    "test:e2e:mrx:g4": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G4-Rollback",
    "test:e2e:mrx:g5": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G5-Async"
  }
}
```

---

## 7. Đánh Giá Khả Thi (Builder Self-Check)
1. *Liệu việc chạy 2 BrowserContext song song trong Nhóm 4 có làm chậm quá trình kiểm thử không?*
   - Không, Playwright hỗ trợ khởi tạo multiple contexts cực nhanh trong cùng 1 instance browser.
2. *Liệu cơ chế bắt 409 thật có phụ thuộc vào timing không?*
   - Không, vì `ReconciliationCompletionService.cs` và `ReconciliationSourceDeltasController.cs` kiểm tra `Version` khóa lạc quan cấp dòng. Chỉ cần context 1 commit tăng version trước khi context 2 gửi request, backend chắc chắn trả về 409 Conflict.
3. *Liệu DB Guardrail có bảo vệ 100% không?*
   - Có, guardrail chạy ngay từ `globalSetup.ts` trước bất kỳ kết nối mạng hay truy vấn nào.

---

Bản đặc tả thiết kế kỹ thuật chi tiết đã hoàn tất. Xin bạn cho biết: **Bạn có đồng ý phê duyệt bản đặc tả này không?**
Sau khi bạn duyệt, tôi sẽ kích hoạt kỹ năng `superpowers:writing-plans` để lập kế hoạch chi tiết từng bước và triển khai!
