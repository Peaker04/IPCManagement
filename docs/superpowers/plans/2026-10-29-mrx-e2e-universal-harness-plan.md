# Kế Hoạch Triển Khai: Bộ Khung Kiểm Thử E2E Toàn Diện Phân Hệ MRX (Horizontal & Vertical Topology Across 5 Scenario Groups)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native execution as explicitly requested by user). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng Harness Playwright E2E chuyên sâu kết hợp NPM Command Suite (`npm run test:e2e:mrx`) bao phủ toàn diện 2 chiều Topology (Horizontal đa vai trò và Vertical xuyên thấu 5 tầng kiến trúc) qua 5 nhóm kịch bản nghiệp vụ (Golden Path, Multi-Role RBAC, Alternative Flows, Real Concurrency 409 & Rollback Invariants, Asynchronous Offline Queue & Timeout Auto-Close), tuân thủ nghiêm ngặt Rule TA-1 đến TA-5 và bảo vệ tuyệt đối CSDL chính qua Hard DB Guardrail.

**Architecture:** Tách biệt cấu hình và mã nguồn kiểm thử vào `frontend/tests/e2e-mrx/` với `playwright.mrx.config.ts`, trang bị cơ chế Hard DB Guardrail chặn truy cập `ipcmanagement`, MySQL Verifier query trực tiếp CSDL sandbox `ipc_mrx_e2e_sandbox`, Multi-Role Fixtures (4 vai trò `dieuphoi`, `thukho`, `beptruong`, `admin`), và đóng gói các command chạy tách lẻ qua tag `@G1-Golden` đến `@G5-Async` trong `package.json`. Trong quá trình thực hiện, áp dụng kỹ năng `impeccable` tinh chỉnh giao diện chuẩn ERP.

**Tech Stack:** Playwright Test 1.50+, TypeScript, Node.js (child_process, mysql.exe CLI), .NET 9 Web API (Kestrel port 5263), MySQL 9.5 (`ipc_mrx_e2e_sandbox`), Vite (port 5174/5173).

**Spec:** `docs/superpowers/specs/2026-10-29-mrx-e2e-universal-harness-spec.md`

## Global Constraints
- `DOM-MODE-1`: Chế độ vận hành `MATERIAL_RECONCILIATION`. Không làm ảnh hưởng đến luồng `DEFAULT`.
- `Hard Database Guardrail`: Bắt buộc assert kết nối chỉ được trỏ tới `ipc_mrx_e2e_sandbox` và cổng 5263. Ném Fatal Error ngay lập tức nếu phát hiện kết nối trỏ tới `ipcmanagement` hoặc cổng 5262.
- `Zero Synthetic Mocks for Rollback (TA-1 đến TA-5)`: Tuyệt đối không dùng `page.route` giả lập 409 hay lỗi rollback ở Nhóm 4. Khởi tạo 2 BrowserContext song song gọi trực tiếp vào backend Kestrel 5263 để kiểm chứng xung đột thực tế.
- `Vertical SQL Invariants`: Ở kịch bản xuất bù (G3), hủy ca & nhập trả (G4), bắt buộc assert số học trong MySQL: `Tồn cuối = Tồn đầu - Tổng xuất + Tổng nhập trả`.
- `Tree Architecture Limits`: Giới hạn cứng 0 tệp FE > 600 dòng; các sub-tree branch và modal phải $\le 350$ dòng.
- `ERP UI/UX Standards (impeccable)`: Typography thoáng đãng, phân cấp nút bấm rõ ràng, không cắt cụt chữ, bảng biểu gọn gàng, zero nhồi nhét.

## Review Focus
1. **Rò rỉ kết nối sang database chính `ipcmanagement`**: Guardrail phải ném Fatal Error và terminate tiến trình trước khi bất kỳ truy vấn hay network request nào được gửi đi.
2. **Xung đột 409 giả mạo**: Nhóm 4 phải kích hoạt xung đột phiên bản thật giữa 2 phiên trình duyệt của 2 người dùng khác nhau tác động lên cùng 1 lô đối soát trên cổng 5263.
3. **Sai lệch số học tồn kho**: Sau các thao tác xuất bù và nhập trả, query SQL trực tiếp phải khớp 100% với công thức kế toán kho, không được có sai số làm tròn hay bản ghi mồ côi.
4. **Trùng lặp bản ghi khi mất mạng (Idempotency)**: Khi bật lại mạng sau offline mutation, hệ thống không được tạo trùng 2 phiếu xuất kho cho cùng một ca.
5. **Mất dữ liệu form khi token hết hạn**: Khi token client bị xóa/hết hạn, form giải trình hoặc biểu mẫu phải giữ nguyên 100% dữ liệu đã nhập, không được tự động đóng hoặc xóa trắng.

---

## Danh Sách Nhiệm Vụ (Tasks)

### Task 1: Cấu Hình Playwright MRX, Hard DB Guardrail & MySQL Verifier Core

**Files:**
- Create: `frontend/tests/e2e-mrx/config/playwright.mrx.config.ts`
- Create: `frontend/tests/e2e-mrx/core/dbGuardrail.ts`
- Create: `frontend/tests/e2e-mrx/core/mysqlVerifier.ts`
- Test: `frontend/tests/e2e-mrx/core/__tests__/dbGuardrail.test.ts` (hoặc test tương ứng)

**Interfaces:**
- Produces:
  - `assertSafeSandboxDatabase(connectionString: string): void`
  - `class MySQLVerifier`: `query(sql: string): any[]`, `assertStockInvariant(ingredientId: string): void`, `assertZeroResidualTestData(prefix: string): void`
  - Playwright config với `baseURL: 'http://127.0.0.1:5174'`, `timeout: 60000`, `trace: 'retain-on-failure'`.

- [ ] **Step 1: Viết test kiểm tra DB Guardrail**
  - Viết test khẳng định: Truyền chuỗi kết nối chứa `ipcmanagement` hoặc `5262` $\rightarrow$ Ném Fatal Error. Truyền chuỗi kết nối chứa `ipc_mrx_e2e_sandbox` và `5263` $\rightarrow$ Cho phép chạy an toàn.

- [ ] **Step 2: Triển khai `dbGuardrail.ts` và `mysqlVerifier.ts`**
  - `dbGuardrail.ts`: Hàm kiểm tra chuỗi kết nối nghiêm ngặt.
  - `mysqlVerifier.ts`: Lớp thực thi lệnh SQL qua `mysql.exe` CLI, bọc trong guardrail kiểm tra schema trước mỗi câu query.

- [ ] **Step 3: Triển khai `playwright.mrx.config.ts`**
  - Định nghĩa config chạy trên cổng Vite 5174, kết nối backend 5263, cấu hình screenshot on failure, video và trace.

- [ ] **Step 4: Chạy test xác nhận PASS**
  - Chạy test kiểm chứng guardrail.

---

### Task 2: Triển Khai Global Setup, Global Teardown & Multi-Role Fixtures

**Files:**
- Create: `frontend/tests/e2e-mrx/core/globalSetup.ts`
- Create: `frontend/tests/e2e-mrx/core/globalTeardown.ts`
- Create: `frontend/tests/e2e-mrx/fixtures/authHelpers.ts`
- Create: `frontend/tests/e2e-mrx/fixtures/mrxTest.ts`

**Interfaces:**
- Produces:
  - `globalSetup`: Assert DB guardrail $\rightarrow$ Clone `ipc_mrx_e2e_sandbox` từ dump $\rightarrow$ Khởi động Kestrel 5263 trỏ vào sandbox $\rightarrow$ Khởi động Vite 5174.
  - `globalTeardown`: Assert 0 bản ghi rác $\rightarrow$ Drop sandbox DB $\rightarrow$ Tắt tiến trình Kestrel & Vite.
  - Fixture `mrxTest`: Cung cấp sẵn 4 Page tương ứng 4 vai trò: `adminPage`, `dieuphoiPage`, `thukhoPage`, `beptruongPage`, cùng `dbVerifier`.

- [ ] **Step 1: Triển khai `authHelpers.ts`**
  - Hàm đăng nhập cho từng vai trò (`admin`, `dieuphoi`, `thukho`, `beptruong`) với mật khẩu chuẩn, tự động gán `ipc_v3_mode = 'MATERIAL_RECONCILIATION'`.

- [ ] **Step 2: Triển khai `globalSetup.ts` và `globalTeardown.ts`**
  - Tích hợp kiểm tra cổng mạng, clone database sandbox biệt lập, chạy Kestrel 5263, kiểm tra HTTP ping.
  - Teardown: Truy vấn đếm rác trong cả Sandbox DB và Main DB, drop sandbox DB sạch sẽ.

- [ ] **Step 3: Triển khai `mrxTest.ts`**
  - Mở rộng `test` của Playwright, khởi tạo 4 context độc lập cho 4 vai trò và inject `dbVerifier`.

- [ ] **Step 4: Chạy smoke test xác nhận fixtures hoạt động**
  - Chạy smoke test đăng nhập đồng thời 4 vai trò.

---

### Task 3: Triển Khai Nhóm 1: Golden Path (`g1-golden-path.spec.ts` @G1-Golden)

**Files:**
- Create: `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts`

**Kịch bản kiểm thử (6 chặng liên hoàn):**
- [ ] **Step 1: Chặng 1 — Lập lô & Đóng băng (`dieuphoiPage`)**
  - Chọn khách hàng ANV, tuần 2026-07-20. Nạp thực đơn Excel $\rightarrow$ Bấm *Kiểm tra định lượng* $\rightarrow$ Đạt 100% $\rightarrow$ Bấm *Đóng băng lô* $\rightarrow$ Lô sang trạng thái `READY`.
- [ ] **Step 2: Chặng 2 — Bàn giao kho (`dieuphoiPage`)**
  - Bấm *Chuyển sang Kho nguyên liệu* $\rightarrow$ Lô sang trạng thái `TRANSFERRED`.
- [ ] **Step 3: Chặng 3 — Xuất kho 7 ngày (`thukhoPage`)**
  - Vào `/warehouse?view=mrx-daily`, chọn lô vừa bàn giao.
  - Duyệt qua 7 ngày (T2 $\rightarrow$ CN), bấm *Điền đủ toàn bộ* và *Xác nhận xuất kho* cho đủ cả 7 ngày.
  - Lô đạt trạng thái `IN_PROGRESS` và `WEEK_COMPLETE`.
- [ ] **Step 4: Chặng 4 — Bếp trưởng xác nhận (`beptruongPage`)**
  - Vào `/chef?view=mrx-cooking`, kiểm tra phiếu nấu 7 ngày khớp 100%.
- [ ] **Step 5: Chặng 5 — Khóa sổ đối soát (`adminPage`)**
  - Vào `/reconciliation`, kiểm tra bảng đối soát chênh lệch = 0 (tất cả dòng `MATCHED`).
  - Bấm *Chốt đối soát tuần* $\rightarrow$ Xác nhận hoàn tất $\rightarrow$ Lô chuyển trạng thái `COMPLETED`.
- [ ] **Step 6: Chặng 6 — Vertical SQL Assertion (`dbVerifier`)**
  - Query MySQL bảng `reconciliationbatches`: Khẳng định `Status = 'COMPLETED'`, `Version = 6`, `CompletedAt IS NOT NULL`.

---

### Task 4: Triển Khai Nhóm 2: Multi-Role Handoff & RBAC Guards (`g2-multi-role-handoff.spec.ts` @G2-RBAC)

**Files:**
- Create: `frontend/tests/e2e-mrx/specs/g2-multi-role-handoff.spec.ts`

**Kịch bản kiểm thử (Ranh giới quyền hạn):**
- [ ] **Step 1: Bếp trưởng bị chặn xuất kho (`beptruongPage`)**
  - Truy cập `/warehouse?view=mrx-daily`: Khẳng định nút *Xác nhận xuất kho* và *Điền đủ toàn bộ* bị ẩn hoặc vô hiệu hóa bởi `ActionGuard`.
- [ ] **Step 2: Thủ kho bị chặn sửa thực đơn (`thukhoPage`)**
  - Truy cập `/weekly-menu?view=mrx-batch`: Khẳng định nút *Chỉnh sửa lịch tuần* và *Nhập thực đơn Excel* bị vô hiệu hóa.
- [ ] **Step 3: Điều phối viên bị chặn khóa sổ (`dieuphoiPage`)**
  - Truy cập `/reconciliation`: Khẳng định nút *Chốt đối soát tuần* bị vô hiệu hóa, chỉ có Quản lý (`admin`) mới có quyền thực thi.
- [ ] **Step 4: Quản lý toàn quyền phê duyệt (`adminPage`)**
  - Có đầy đủ quyền hạn mở modal giải trình, duyệt thay đổi nguồn và khóa sổ.

---

### Task 5: Triển Khai Nhóm 3: Alternative Business Flows (`g3-alternative-flows.spec.ts` @G3-Alt)

**Files:**
- Create: `frontend/tests/e2e-mrx/specs/g3-alternative-flows.spec.ts`

**Kịch bản kiểm thử (Luồng biến động & rẽ nhánh):**
- [ ] **Step 1: Xử lý món thiếu BOM tại chỗ (`dieuphoiPage`)**
  - Import thực đơn chứa món chưa có định mức $\rightarrow$ Hệ thống cảnh báo thiếu BOM $\rightarrow$ Bấm *Nhập BOM Excel cho các món thiếu* $\rightarrow$ Modal mở với danh sách món thiếu $\rightarrow$ Tải template `missing` $\rightarrow$ Nạp file bổ sung $\rightarrow$ Kiểm tra định lượng lại thành công.
- [ ] **Step 2: Xuất bổ sung nguyên liệu trong ca (`thukhoPage`)**
  - Trong ca phát sinh suất ăn $\rightarrow$ Mở modal *Xuất bổ sung ca* $\rightarrow$ Nhập số lượng và lý do $\rightarrow$ Bấm *Xác nhận xuất bổ sung* $\rightarrow$ Dòng ngày cập nhật số lượng xuất tăng thêm.
- [ ] **Step 3: Giải trình chênh lệch 2 chiều (`adminPage`)**
  - Dòng nguyên liệu có chênh lệch $\rightarrow$ Quản lý mở `ReconciliationDispositionModal` $\rightarrow$ Chọn danh mục *Hao hụt sơ chế* và điền lý do $\rightarrow$ Bấm *Lưu hướng xử lý* $\rightarrow$ Trạng thái dòng chuyển sang `DISPOSED`.

---

### Task 6: Triển Khai Nhóm 4: Real Concurrency 409 & Compensating Rollback (`g4-concurrency-rollback.spec.ts` @G4-Rollback)

**Files:**
- Create: `frontend/tests/e2e-mrx/specs/g4-concurrency-rollback.spec.ts`

**Kịch bản kiểm thử (Xung đột đồng thời thật & Invariant tồn kho):**
- [ ] **Step 1: Xung đột khóa lạc quan đồng thời thật (2 BrowserContexts)**
  - `dieuphoiPage` mở điều chỉnh nguồn ca T4 và gửi phê duyệt (tăng version nguồn lên v2).
  - Cùng thời điểm, `thukhoPage` (vẫn đang mở ở version v1) bấm *Xác nhận xuất kho* ca T4.
  - Backend Kestrel cổng 5263 bắt xung đột phiên bản và trả về **HTTP 409 Conflict thật**.
  - Khẳng định `thukhoPage` hiển thị banner xung đột, không crash, và bấm *Tải lại dữ liệu mới nhất* để nạp lại version mới.
- [ ] **Step 2: Hủy ca & Nhập trả kho nguyên liệu thừa**
  - Khách hàng hủy ca đột xuất $\rightarrow$ Điều phối kích hoạt điều chỉnh giảm suất.
  - Kho tạo phiếu nhập trả hoàn nguyên liệu thừa về kho.
- [ ] **Step 3: Vertical SQL Invariant Assertion (`dbVerifier`)**
  - Query MySQL các bảng `inventorystocks`, `inventoryissues`, `inventoryreceipts` trong `ipc_mrx_e2e_sandbox`.
  - Khẳng định bất biến: $\text{Tồn cuối} = \text{Tồn đầu} - \text{Tổng thực xuất} + \text{Tổng nhập trả}$.
  - Khẳng định không có bản ghi mồ côi (orphan records = 0).

---

### Task 7: Triển Khai Nhóm 5: Asynchronous, Offline Queue & Timeout Auto-Close (`g5-async-timeout.spec.ts` @G5-Async)

**Files:**
- Create: `frontend/tests/e2e-mrx/specs/g5-async-timeout.spec.ts`

**Kịch bản kiểm thử (Mạng rớt, token hết hạn, auto-close):**
- [ ] **Step 1: Offline Mutation Queue & Idempotency (`thukhoPage`)**
  - Thủ kho chuẩn bị xuất kho $\rightarrow$ Kích hoạt `context.setOffline(true)`.
  - Bấm *Xác nhận xuất kho* $\rightarrow$ UI hiển thị banner offline, bảo toàn form, không nổ lỗi unhandled.
  - Kích hoạt `context.setOffline(false)` $\rightarrow$ Yêu cầu được tự động đồng bộ lại.
  - Query MySQL: Khẳng định chỉ tạo đúng **1 phiếu xuất kho duy nhất** (Idempotency Key chặn nhân bản).
- [ ] **Step 2: Token hết hạn giữa chừng & Bảo toàn dữ liệu (`adminPage`)**
  - Quản lý mở form giải trình gõ 150 ký tự lý do.
  - Xóa token khỏi `localStorage`.
  - Bấm *Lưu hướng xử lý* $\rightarrow$ Bị chặn 401, hiển thị thông báo yêu cầu gia hạn phiên làm việc, **nội dung lý do trên form được giữ nguyên 100%**.
- [ ] **Step 3: Auto-close quá hạn kỳ đối soát**
  - Can thiệp SQL lùi ngày tạo lô về quá hạn trong sandbox DB.
  - Kích hoạt worker kiểm toán $\rightarrow$ Lô được tự động đóng sổ và khóa chỉnh sửa đối với các role dưới.

---

### Task 8: Đóng Gói `package.json` Scripts & Kiểm Tra Toàn Diện Hệ Thống

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bổ sung các scripts vào `package.json`**
  - `"test:e2e:mrx": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts"`
  - `"test:e2e:mrx:g1": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G1-Golden"`
  - `"test:e2e:mrx:g2": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G2-RBAC"`
  - `"test:e2e:mrx:g3": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G3-Alt"`
  - `"test:e2e:mrx:g4": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G4-Rollback"`
  - `"test:e2e:mrx:g5": "playwright test --config=frontend/tests/e2e-mrx/config/playwright.mrx.config.ts --grep @G5-Async"`

- [ ] **Step 2: Chạy kiểm chứng toàn bộ ma trận**
  - Chạy: `npm run test:e2e:mrx`
  - Khẳng định toàn bộ 5 nhóm (G1 $\rightarrow$ G5) đều đạt **PASS 100%**.
  - Kiểm tra báo cáo teardown: khẳng định 0 bản ghi rác trong sandbox DB và database chính `ipcmanagement`.

- [ ] **Step 3: Chạy Pre-commit Gate A–E & Backend Tests**
  - Chạy: `npm run precommit:verify` (PASS 100%).
  - Chạy: `dotnet test backend/IPCManagement.slnx` (PASS 100%).
  - Cập nhật `.planning/WORK.md` và `docs/handoff/HANDOFF.md`.
