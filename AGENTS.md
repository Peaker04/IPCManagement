# IPCManagement — Agent Governance & Governance Architecture

Read this file and [current task](.planning/WORK.md) at intake. Load only the canonical owners relevant to the task; [documentation router](docs/README.md) is optional navigation, not a full-doc preload requirement. Technical truth resides in source, tests, and machine contracts.

## 1. Hard Safety Invariants

- **No Destructive Operations**: No `git reset`, `git restore`, `git clean`, forced push, unauthorized deploy, package installation, or DB schema/data mutation without explicit current scope and user authorization.
- **Operational Mode Isolation (`DOM-MODE-1`)**: `DEFAULT != MATERIAL_RECONCILIATION`. Shared master data and physical stock never merge workflows, commands, queries, lineages, or audit logs.
- **No Synthetic Evidence**: No fabricated business evidence, mock seeds in production paths, lowered permissions, or weakened tests to manufacture PASS. Synthetic fixture creation requires its own authorized scope.
- **Single Styling Authority**: Zero ad-hoc colors, inline styles, or external CSS tokens outside `frontend/src/styles/index.css`. Redesign and preview tokens are prohibited in production.
- **Environment & Process Safety**: Dedicated browser instances (separate Chrome profile), confirmed credentials, no publishing credentials or secrets from `.docs/` or workbook rows.
- **Runtime Authority**: Pi is the runtime. Other CLI runtimes, auto-installation, indexing, or unprompted subagents require explicit user authorization.

## 2. 5-Layer Governance Architecture

Mô hình kiến trúc quản trị 5 tầng áp dụng xuyên suốt 12 phân hệ Backend và 14 Routes Frontend:

- **Layer 1 — Requirements (`BR · FR · NFR · UXR · Acceptance Criteria`)**:
  - *Chủ sở hữu*: `docs/DOMAIN.md` (nghiệp vụ, bất biến, BR/FR/NFR matrix), `docs/FLOWS.md` (luồng dữ liệu & bàn giao), `docs/DESIGN.md` (UXR/NFR-UI), `docs/ENGINEERING.md` (tiêu chuẩn kỹ thuật).
- **Layer 2 — UX Architecture (`IA · Navigation · User Flow · IxD · UI State Matrix`)**:
  - *Chủ sở hữu*: `frontend/src/routes/routeRegistry.ts` (14 canonical routes), `docs/DESIGN.md` (`N1–N6`, 6-state gate), `QueryViewBoundary.tsx`.
- **Layer 3 — UI Design (`Design System · UI Kit · Tokens · Components · Responsive`)**:
  - *Chủ sở hữu*: `docs/DESIGN.md` (`D1–D7`, `T1–T8`, `M1–M3`), catalog trong `docs/UI-KIT.md`, semantic tokens trong `frontend/src/styles/index.css`, 13 UI primitives trong `frontend/src/components/ui/`, 4 họ composites trong `frontend/src/components/common/`.
- **Layer 4 — FE Implementation (`Component Architecture · State · API · RBAC`)**:
  - *Chủ sở hữu*: Phân hệ tính năng tại `frontend/src/features/*`, hợp đồng bảng tại `docs/table-contracts.json`, kiểm soát bảo mật tại `ProtectedRoute.tsx`, `RoleGuard.tsx`, `ActionGuard.tsx`, `ActionAvailability.tsx`.
- **Layer 5 — Quality & Validation (`A11y · Performance · Usability · Contract Tests`)**:
  - *Chủ sở hữu*: Quality gates tại `.pi/skills/ipc-ui-review/SKILL.md`, `.pi/skills/ipc-code-review/SKILL.md`, `.pi/skills/ipc-test-audit/SKILL.md`, bộ kiểm thử hợp đồng `*.contract.test.tsx`, `operationalPageContracts.test.ts`, và Playwright audits.

## 3. Lifecycle & Mandatory Phase Gates

Vòng đời cố định: `IDLE → INTAKE → PLAN → EXECUTE → VERIFY → CLOSE → IDLE`. Các skill gates nâng cấp từ khuyến nghị thành **BẮT BUỘC (MANDATORY)**:

1. **INTAKE**:
   - Chạy kiểm tra workspace: `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`.
   - Đọc `.planning/WORK.md`. Xác định đúng mã `FR-*`, `BR-*`, `NFR-*` của phân hệ liên quan.
   - Bảo toàn thay đổi kế thừa; không tự ý xóa bỏ các tệp chưa theo dõi (untracked) hoặc thay đổi dở dang.
2. **PLAN (Mandatory Gate Loading)**:
   - *Architecture / Module Refactor*: BẮT BUỘC nạp `.pi/skills/ipc-codebase-design/SKILL.md`.
   - *Bug / Root-cause investigation*: BẮT BUỘC nạp `.pi/skills/ipc-debugging/SKILL.md`.
   - *UI / Frontend Work*: BẮT BUỘC xuất ra **Scoped Pre-Code UI Gate Block** trước khi sửa bất kỳ file `.tsx`/`.css` nào:
     ```markdown
     ### Scoped Pre-Code UI Gate Block
     - Route: [ví dụ: /weekly-menu]
     - Single Primary Work Object: [OperationalFrame | SplitWorkbench]
     - Server Mode: [DEFAULT | MATERIAL_RECONCILIATION] (DOM-MODE-1)
     - RBAC Guards: [RoleGuard | ActionGuard | ActionAvailability with token permission]
     - 6 UI States: [loading | empty | error | permission-denied | partial | write-reconciliation]
     - Primitives & Composites: [components/ui/*, components/common/*]
     - Compliance Pledges: D6 (>=12px), D7 (1 primary), T7 (frozen header/col), T8 (compact density 36-40px), M1.2 (1 blocking modal), N6 (nested sidebar v2)
     ```
3. **EXECUTE**:
   - Can thiệp đúng chủ sở hữu (surgical changes at existing owners). 1 writer per cwd/worktree.
   - Cấm tạo token styling ngoài `index.css`. Cấm duplicate primitive components (no BadgeV2, TableNew).
4. **VERIFY (Mandatory Verification Gates)**:
   - *Test Audit & Anti-Tautology*: BẮT BUỘC tuân thủ `.pi/skills/ipc-test-audit/SKILL.md` (Rule TA-1 đến TA-4: fixture bám sát C# DTO, không mock component dưới test, zero allowlist padding).
   - *UI / Frontend Work*: BẮT BUỘC nạp `.pi/skills/ipc-ui-review/SKILL.md` và chạy bộ contract tests (`operationalPageContracts.test.ts`, `*.contract.test.tsx`).
   - *Mọi thay đổi code*: BẮT BUỘC nạp `.pi/skills/ipc-code-review/SKILL.md` và chạy build/lint/tests liên quan.
   - Định dạng báo cáo: `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`.
5. **CLOSE**:
   - Báo cáo PASS/FAIL/NEEDS_EVIDENCE/BLOCKED theo từng tiêu chí trong scope.
   - Cập nhật `.planning/WORK.md` và đưa trạng thái về `IDLE`.

## 4. Task Routing Table (12 BE Features <-> 14 FE Routes)

| FR Code | Phân hệ Backend (`backend/.../Features/`) | Route Frontend (`frontend/.../routes/`) | Feature Frontend (`frontend/.../features/`) | Tài liệu & Phạm vi nghiệp vụ |
|---|---|---|---|---|
| `FR-AUTH` | `Auth` | `/login`, `/forbidden` | `features/auth/` | Xác thực JWT, phân quyền truy cập, trang báo lỗi 403 |
| `FR-DASH` | Aggregated (`Planning`, `Inventory`, `Approvals`) | `/` | `features/dashboard/` | Tổng quan điều hành hôm nay, điểm tắc luồng, KPI ca sản xuất |
| `FR-CAT` | `Catalog` | `/admin-data` | `features/admin/`, `features/projects/` | Danh mục nguyên liệu, món ăn, định mức BOM gốc, quy cách |
| `FR-ADMIN`| `Admin` | `/admin-data`, `/settings/approval-rules`, `/settings/advanced` | `features/admin/` | Quản trị khách hàng, quy tắc phê duyệt, cấu hình hệ thống |
| `FR-MENU` | `Planning`, `Coordination` | `/weekly-menu` | `features/planning/`, `features/coordination/` | [Weekly Menu](docs/domain/weekly-menu.md): Thực đơn, KHSX, bàn giao, giá vốn BOM |
| `FR-COORD`| `Coordination` | `/meal-orders` | `features/coordination/` | Điều phối đơn ăn khách hàng, chốt số suất, xử lý lệch suất |
| `FR-CHEF` | `Planning` | `/chef` | `features/chef/`, `features/planning/` | Bếp trưởng: KHSX ca, checklist nhận vật tư, trả hàng thừa |
| `FR-APPR` | `Approvals` | `/approvals` | `features/approvals/` | Duyệt yêu cầu mua hàng, bảng báo giá nhà cung cấp, duyệt nhập kho |
| `FR-PUR`  | `Purchasing` | `/purchasing` | `features/purchasing/` | Tổng hợp thiếu hụt, đề xuất mua hàng, PO, quản lý nhà cung cấp |
| `FR-WH`   | `Inventory` | `/warehouse` | `features/warehouse/` | [Warehouse](docs/domain/warehouse-contract.md): Tồn kho, phiếu nhập/xuất, thẻ kho |
| `FR-RECON`| `Reconciliation` | `/reconciliation` | `features/reconciliation/` | [MRX](docs/domain/material-reconciliation.md): Đối soát nguyên liệu ngày, sai lệch ca |
| `FR-REP`  | `Reports` | `/reports` | `features/reports/` | Báo cáo chi phí suất ăn, tiêu hao, biến động giá, lịch sử xuất kho |
| `FR-SYS`  | `SystemOperation`, `SampleData` | `/settings/advanced` | `features/system-operation/` | Chuyển đổi chế độ vận hành (DEFAULT / MRX), nạp dữ liệu mẫu |

## 5. Single State Owner

`.planning/WORK.md` là Single Source of Truth duy nhất cho trạng thái tác vụ. Lịch sử git là bản lưu trữ vĩnh viễn; không tạo thêm file trạng thái tạm bợ (không dùng MEMORY/STATE/CHECKPOINT ngoài luồng).
