# IPC Management

## What This Is

IPC Management là hệ thống quản lý bếp ăn công nghiệp (Industrial & Production Catering Management) với đầy đủ nghiệp vụ: lập thực đơn, tính số suất, điều phối đặt hàng, quản lý kho nguyên liệu, quy trình bếp trưởng, duyệt mua hàng, và báo cáo giá nguyên liệu.

Stack hiện tại: React 19 + Vite 8 frontend với Tailwind v4 và shadcn-style primitives, backed bởi ASP.NET Core 9 Web API và MySQL 8+. **Toàn bộ dữ liệu nghiệp vụ đã được chuyển sang live backend; không còn mock data trong frontend.**

## Core Value

Staff có thể scan trạng thái vận hành nhanh chóng và hoàn thành các tác vụ quản lý bếp mà không bị nhầm lẫn workflow hoặc friction giao diện.

## Current Milestone: v1.1 Chuẩn hóa BOM mới & loại bỏ dữ liệu legacy

**Goal:** Chuyển toàn bộ vòng đời BOM sang format định lượng 25k/30k/34k từ `IPC. Định lượng 07.2026.xlsx`, dọn sạch dữ liệu và code legacy mà không làm hỏng chứng từ lịch sử.

**Target features:**
- Chuẩn hóa contract import BOM mới, ba tier giá và đơn vị kỹ thuật theo nguyên liệu.
- Kiểm kê và dọn idempotent dữ liệu `TMP-BOM-*`, import cũ, catalog mồ côi và chứng từ nháp phụ thuộc bằng dry-run/apply có audit.
- Loại bỏ parser, template, DTO, endpoint và UI chỉ phục vụ format cũ; giữ CRUD BOM thủ công theo version.
- Đồng bộ material demand, production plan, purchasing, kho và báo cáo theo BOM mới.
- Dùng shadcn-style primitives cho preview cleanup, cảnh báo phụ thuộc, xác nhận apply và bảng kết quả ổn định.

**Retention boundary:** Giữ nguyên chứng từ đã khóa/hoàn tất và audit; chỉ dọn hoặc tái tạo dữ liệu nháp, dữ liệu đang hoạt động và bản ghi mồ côi đủ điều kiện.

## Milestone v1.0 — Đã hoàn thành (2026-07-07)

Tất cả 6 phase đã pass release gate:

| Phase | Nội dung | Trạng thái |
|-------|----------|------------|
| 1 | Frontend UI/UX Operational Refactor | ✅ Complete |
| 1.1 | Operational IA & Page Recomposition | ✅ Complete |
| 1.2 | End-to-End Kitchen Workflow IA | ✅ Complete |
| 1.3 | UI/UX Hardening & Visual Regression | ✅ Complete |
| 1.4 | UI/UX Deep Hardening All Routes | ✅ Complete |
| 2 | Data-driven Workflow Integration from IPC Sample Files | ✅ Complete |

## Context Kỹ Thuật Hiện Tại

- **Frontend stack**: React 19.2.6, Vite 8.0.12, TypeScript ~6.0, Redux Toolkit 2.12.0, RTK Query, Tailwind CSS 4.3.0, shadcn 4.11.0, Base UI 1.5.0, lucide-react, react-router-dom 7.17.0.
- **Backend stack**: ASP.NET Core 9.0, EF Core 9.0.16, Pomelo MySQL 9.0.0, FluentValidation 11.3.0, Serilog 8.0.3, Swashbuckle 7.3.1, BCrypt.Net-Next 4.2.0, JWT Bearer 9.0.16.
- **Database**: MySQL 8+ với EF Core Code-First migrations; schema trong `Migrations/`.
- **Frontend routes hiện có**: `/` (Dashboard), `/weekly-menu`, `/meal-orders`, `/chef-dashboard`, `/approvals`, `/purchasing`, `/warehouse`, `/reports`, `/admin-data`, `/admin/rules`, `/403`, `/login`.
- **Backend controllers hiện có**: Auth, Coordination, Dishes, Ingredients, InventoryIssues, InventoryReceipts, InventoryReturns, MaterialDemand, PurchaseOrders, PurchaseRequests, PurchaseWorkflow, Approvals, ApprovalHistory, ApprovalRules, WorkflowReports, SampleData, Suppliers, SupplierQuotations, Stocktakes, Warehouses, AdminEmployees, ProductionPlans.
- **API base**: `http://localhost:5262` (HTTP), `https://localhost:7004` (HTTPS); Swagger tại `/swagger`.
- **Frontend API**: RTK Query extends `apiSlice` với tag types: `User`, `Employee`, `Project`, `Coordination`, `WorkflowReports`, `DishCatalog`, `Customers`, `Ingredients`, `MaterialDemandStaleness`, `SupplierQuotations`, `PurchaseOrders`.

## Constraints

- **Tech stack**: Giữ React/Vite/Tailwind/shadcn-style — repo đã phụ thuộc vào đây.
- **Information architecture**: Giữ routes và primary navigation labels trừ khi user approve thay đổi.
- **Language**: Giữ copy UI tiếng Việt ở các màn hình dùng tiếng Việt.
- **No mock data**: Frontend không dùng mock arrays hay seed data cục bộ — tất cả đều gọi backend API thực.
- **Safety**: Không overwrite uncommitted frontend/backend work.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------| 
| Targeted UI evolution thay vì full redesign | App là operational tool với workflows và shared components đã có | Validated Phase 01 |
| Tailwind v4 + shadcn-style approach | Frontend đã dùng các dependency này | Validated Phase 01 |
| Admin/product UI audit (không áp dụng landing-page rules) | Taste skill không phải dành cho dashboards | Validated Phase 01 |
| Backend import service thay vì Excel upload UI | Ổn định data contract và API trước khi build full upload | Phase 02 |
| Material demand tính từ BOM trước khi check stock | Phù hợp với IPC swimlane workflow | Phase 02 |
| Warehouse flow: approved demand → issue document → stock movement → chef receipt | Khớp với nghiệp vụ thực tế | Phase 02 |
| Workbook `IPC. Định lượng 07.2026.xlsx` là canonical BOM source cho v1.1 | Format mới đã thay thế dữ liệu định suất cũ | — Pending |
| Bảo toàn chứng từ đã khóa/hoàn tất | Tránh mất lịch sử vận hành và audit khi cleanup | — Pending |
| Customer BOM overlay theo nguyên liệu, fallback global cho phần còn lại | Hỗ trợ CRUD riêng lẻ mà không làm mất các dòng global chưa override | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-16 — khởi tạo milestone v1.1 chuẩn hóa BOM mới và cleanup legacy*
