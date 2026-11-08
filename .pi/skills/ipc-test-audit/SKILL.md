---
name: ipc-test-audit
description: Audit, author, and eliminate tautological/fake-green tests across IPCManagement. Enforces backend-grounded fixtures, full 6-state and RBAC verification, zero exemption padding, zero fake API fallbacks, and single-owner behavioral contracts.
---

# IPC Test Audit & Anti-Tautology Gate

Advisory capability under [AGENTS](../../../AGENTS.md); [WORK](../../../.planning/WORK.md) remains the only task-state owner.

This skill governs test value, realism, and behavioral integrity across frontend and integration suites. It prevents tautological tests, synthetic-evidence fabrications, exemption padding, and silent fake API fallbacks.

## 5 Invariant Rules of IPC Test Audit

- **Rule TA-1 (Backend-Grounded Fixtures Only):**
  - Mọi dữ liệu fixture/mock cho API trong test Frontend BẮT BUỘC phải khớp 100% tên trường, kiểu dữ liệu (camelCase vs PascalCase theo cấu hình JSON), enum giá trị, và cấu trúc phân trang (`PageResponse<T>` / `CursorPagedResponse<T>`) từ C# Backend (`backend/src/IPCManagement.Api/Features/*`, `backend/src/IPCManagement.Api/Models/`, `docs/table-contracts.json`).
  - Cấm tự bịa trường không tồn tại trong backend schema để ép test pass.

- **Rule TA-2 (No Tautological / Self-Mocking Tests):**
  - Cấm mock chính component, hook nghiệp vụ (custom hooks, view models), hoặc state boundary (`StateBoundary`) đang được kiểm thử.
  - Mock duy nhất được phép là ở ranh giới mạng (HTTP fetch / `apiClient`) để kiểm tra toàn bộ chuỗi render thật: `API DTO → Transform/Reducer → Component DOM (<DataGrid>, <Num>, <IdentifierText>, <VietnameseDateInput>, <ActionGuard>)`.

- **Rule TA-3 (Zero Allowlist / Exemption Padding):**
  - Tuyệt đối cấm sử dụng `test.skip`, `test.todo`, hoặc tự tiện bổ sung file/route vào các mảng `allowlist`, `exemptions`, `unclassified`, `legacyList` trong các file contract tests hoặc test scripts để lách lỗi.

- **Rule TA-4 (Full 4-Scenario Behavioral Coverage):**
  - Mỗi phân hệ vận hành bắt buộc phải có test kiểm thử hành vi thực tế bao phủ đủ 4 kịch bản:
    1. *Kịch bản Có Dữ Liệu (`Success`)*: Render đúng các cột từ DTO Backend, định dạng `<Num>`, `<IdentifierText>`, ngày `dd/MM/yyyy`.
    2. *Kịch bản Không Có Dữ Liệu / Bị Chặn Bước Trước (`Empty / Blocked`)*: Khi API trả về mảng rỗng `[]` hoặc trạng thái thiếu điều kiện tiên quyết, `<StateBoundary>` phải hiển thị đúng màn hình hướng dẫn và ẩn bảng trống.
    3. *Kịch bản Lỗi API (`Error 400/500 + Retry`)*: Khi API reject lỗi HTTP, `<StateBoundary>` phải hiển thị thông báo lỗi kèm nút `[Thử lại]` (bấm vào gọi lại API).
    4. *Kịch bản Phân Quyền RBAC & Gửi Mutation (`ActionGuard` + `POST/PUT/PATCH`)*: Kiểm chứng tài khoản không đủ quyền thì nút thao tác bị khóa/ẩn; tài khoản đủ quyền khi bấm submit sẽ gửi đúng endpoint và đúng body JSON xuống `apiClient`.

- **Rule TA-5 (Zero Fake API Data & Anti-Bogus Verification Gate):**
  - Toàn bộ các file trong `frontend/src/api/*.ts` TUYỆT ĐỐI KHÔNG ĐƯỢC CHỨA các hàm `getBaseline*()`, hằng số dữ liệu giả cứng (`NL-THIT-01`, `BG-260921-01`, `Trần Văn B`, `Nguyễn Văn A`, `wh-1`, `sup-1`...), hoặc các khối `try/catch` nuốt lỗi để trả về dummy data.
  - Khi API bị lỗi hoặc server offline, các hàm trong `src/api/*.ts` BẮT BUỘC phải ném lỗi (throw Error) để UI StateBoundary hiển thị trạng thái lỗi thật.
  - Cấm các hàm export trong `src/api/*.ts` giả lập thành công bằng cách `return { success: true }` mà không gọi network thật qua `apiClient`.
  - Được kiểm chứng tự động bằng test gate `ZeroFakeApiAndTestAuditGuard.test.ts`.

## Phân loại Audit (R / F / C / D)

Khi kiểm toán test suite:
- `[RETAIN (R)]`: Test kiểm thử hành vi thật tại ranh giới công khai, bắt đúng lỗi hồi quy và bám sát backend.
- `[FIX / REWRITE (F)]`: Test có ý nghĩa nghiệp vụ nhưng đang mock hời hợt, dùng regex bề nổi, hoặc mock sai DTO backend -> Viết lại bám sát DTO thật.
- `[CONSOLIDATE (C)]`: Test trùng lặp nhiều tầng -> Gộp về tầng mạnh nhất.
- `[DELETE (D)]`: Test tự bịa (tautological), kiểm tra code chết, hoặc chỉ tồn tại để thỏa mãn danh sách exemption nhân tạo -> Xóa bỏ.
