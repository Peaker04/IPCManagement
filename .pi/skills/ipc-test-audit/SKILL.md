---
name: ipc-test-audit
description: Audit, author, and eliminate tautological/fake-green tests across IPCManagement. Enforces backend-grounded fixtures, full 6-state and RBAC verification, zero exemption padding, and single-owner behavioral contracts.
---

# IPC Test Audit & Anti-Tautology Gate

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner.

This skill governs test value, realism, and behavioral integrity across frontend and integration suites. It prevents tautological tests, synthetic-evidence fabrications, and exemption padding.

## 4 Invariant Rules of IPC Test Audit

- **Rule TA-1 (Backend-Grounded Fixtures Only):**
  - Mọi dữ liệu fixture/mock cho API trong test Frontend BẮT BUỘC phải khớp 100% tên trường, kiểu dữ liệu (camelCase vs PascalCase theo cấu hình JSON), enum giá trị, và cấu trúc phân trang (`PageResponse<T>` / `CursorPagedResponse<T>`) từ C# Backend (`backend/src/IPCManagement.Api/Features/*`, `backend/src/IPCManagement.Api/Models/`, `docs/table-contracts.json`).
  - Cấm tự bịa trường không tồn tại trong backend schema để ép test pass.

- **Rule TA-2 (No Tautological / Self-Mocking Tests):**
  - Cấm mock chính component, hook nghiệp vụ (custom hooks, view models), hoặc state boundary (`QueryViewBoundary`) đang được kiểm thử.
  - Mock duy nhất được phép là ở ranh giới mạng (HTTP fetch / RTK Query baseQuery / MSW) để kiểm tra toàn bộ chuỗi render thật: `API DTO → Transform/Reducer → ViewModel Hook → Component DOM (<TableViewport>, <Num>, <IdentifierText>, <VietnameseDateInput>, <ActionGuard>)`.

- **Rule TA-3 (Zero Allowlist / Exemption Padding):**
  - Tuyệt đối cấm sử dụng `test.skip`, `test.todo`, hoặc tự tiện bổ sung file/route vào các mảng `allowlist`, `exemptions`, `unclassified`, `legacyList` trong các file contract tests (`operationalPageContracts.test.ts`, `tableContracts.test.ts`, `dataGrainUiContracts.test.ts`, `uiStatePurityContract.test.ts`, `check-architecture-growth.mjs`) để lách lỗi.
  - Phải xóa bỏ các exemption cũ khi tái tạo phân hệ tương ứng.

- **Rule TA-4 (Full 6-State & RBAC Behavioral Coverage):**
  - Mỗi route vận hành bắt buộc phải có test kiểm thử hành vi thực tế bao phủ:
    1. 6 trạng thái UI: `loading`, `empty`, `error` (kèm nút thử lại retry), `permission-denied` (403), `partial` (truncation), `write-reconciliation` (chống duplicate click / pending submission).
    2. RBAC 3 lớp: `RoleGuard` (chặn route), `Navigation filtering` (ẩn hiện menu), `ActionGuard` / `ActionAvailability` (vô hiệu hoá hoặc ẩn nút bấm theo token permission).
    3. Mutation payload: Form submit gửi đúng cấu trúc DTO backend mong đợi, xử lý đúng lỗi HTTP `400 Bad Request`, `409 Conflict`, `422 Unprocessable`.

## Phân loại Audit (R / F / C / D)

Khi kiểm toán test suite:
- `[RETAIN (R)]`: Test kiểm thử hành vi thật tại ranh giới công khai, bắt đúng lỗi hồi quy và bám sát backend.
- `[FIX / REWRITE (F)]`: Test có ý nghĩa nghiệp vụ nhưng đang mock hời hợt, dùng regex bề nổi, hoặc mock sai DTO backend -> Viết lại bám sát DTO thật.
- `[CONSOLIDATE (C)]`: Test trùng lặp nhiều tầng -> Gộp về tầng mạnh nhất (`*.contract.test.tsx` hoặc feature behavior test).
- `[DELETE (D)]`: Test tự bịa (tautological), kiểm tra code chết, hoặc chỉ tồn tại để thỏa mãn danh sách exemption nhân tạo -> Xóa bỏ.
