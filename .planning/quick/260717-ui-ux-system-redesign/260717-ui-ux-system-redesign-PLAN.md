---
name: 260717-ui-ux-system-redesign
date: 2026-07-17
status: in-progress
type: execute
stack: React 19 + Vite 8 + Tailwind v4 + shadcn-style local primitives
---

# UI/UX System Redesign Plan

## Design read

Đây là công cụ vận hành B2B cho điều phối, bếp, kho, thu mua và quản trị; ngôn ngữ phù hợp là operational clarity: nền trắng/slate, accent xanh IPC duy nhất, mật độ vừa, typography nhỏ gọn, trạng thái luôn có chữ, motion tối thiểu và focus rõ. Không dùng hero, gradient trang trí, glassmorphism, card dày đặc hoặc palette AI mặc định.

## Guardrails

- Giữ route, workflow và nhãn điều hướng chính; chỉ đổi copy thô/cứng thành tiếng Việt dễ hiểu.
- Giữ React/Vite/Tailwind v4 và các primitive Shadcn-style hiện có; không thêm UI kit, modal, table hoặc icon family thứ hai.
- `PaginationBar` và `DataTableShell` có blast radius CRITICAL; không sửa trực tiếp trong slice đầu. Tạo helper/adapter mới, migrate từng consumer và giữ API cũ.
- Không sửa/xóa dirty worktree ngoài allowlist. Trước mỗi symbol edit phải chạy GitNexus impact; trước commit phải chạy `detect_changes`.
- Không biến pagination hiển thị thành authority dữ liệu: server totals, cursor, filter scope và mutation payload phải độc lập với rows đang render.
- Mọi bảng dài phải có scroll cục bộ, chiều cao ổn định, header sticky, loading/error/empty state cùng geometry và pagination rõ ràng.

## Waves

### Wave 1 — Audit, tokens and shared language

Status: foundation implemented; route-by-route copy cleanup remains.

- Inventory tất cả route, bảng, nguồn dữ liệu, pagination hiện có, English/code labels, duplicate toolbar/section headings.
- Chốt semantic tokens và copy map tại `frontend/src/lib/uiCopy.ts`, `frontend/src/lib/uiSemantics.ts` hoặc file tương đương sau khi kiểm tra naming hiện tại.
- Chuẩn hóa shell/sidebar: active state, nhóm điều hướng, user card, logout, responsive mobile behavior, page context và focus states.
- Viết component/unit tests cho copy map, nav visibility và layout invariants.

### Wave 2 — Shared table/pagination helpers

Status: helper implemented and first consumer migrated; remaining consumers are intentionally serialized by impact.

- Tạo `usePaginatedRows`/`useCursorPagination` helper thuần UI, có clamping khi data/filter đổi, giữ page size ổn định và reset page có chủ đích.
- Tạo `PaginatedTableFrame` hoặc `TableViewport` Shadcn-style dùng native table semantics, sticky header, local scroll, loading/error/empty/no-result slots và aria label.
- Dùng `PaginationBar` hiện có qua adapter trước; chỉ refactor component CRITICAL sau khi có impact + regression evidence.
- Test page range, next/previous disabled state, filtering không thay đổi totals/payload, long cell wrapping và no page-level horizontal overflow.

### Wave 3 — Route migration

- Migrate theo nhóm: dashboard/work queues; weekly menu/coordination; approvals/purchasing/warehouse; chef; reports/admin.
- Mỗi route giữ presentation component và API contract; loại bỏ pagination copy-paste, repeated headings, duplicated status explanations và code-like labels.
- Ưu tiên server-side limit/cursor cho endpoint hỗ trợ; với endpoint đang trả collection thì dùng display pagination bounded, không tăng limit vô hạn.
- Dùng labels dễ hiểu: ví dụ `BOM canonical` → `BOM chuẩn`, `Unchanged/Create/Version` → `Không đổi/Tạo mới/Tạo phiên bản`, `blocker` → `Vấn đề chặn xử lý`, `reason` → `Lý do`.

### Wave 4 — Visual, accessibility and regression gate

- Browser audit ở 1365x900, 1280x900, 768x1024 và 390x844.
- Kiểm tra keyboard/focus, semantic headings, table captions/aria labels, contrast, reduced motion, icon/text spacing và no page overflow.
- Chạy unit, lint, build, controls, smoke, ui-audit và visual routes; cập nhật snapshot chỉ cho thay đổi chủ đích.
- Chạy `git diff --check`, ownership manifest và `node .gitnexus/run.cjs detect_changes --repo IPCManagement --scope all`.

## File ownership strategy

Initial allowlist dự kiến:

- `frontend/src/components/layout/MainLayout.tsx`
- `frontend/src/components/common/` chỉ thêm helper mới hoặc migrate từng consumer đã impact
- `frontend/src/components/ui/` chỉ thêm primitive nếu primitive hiện có không đáp ứng contract
- `frontend/src/lib/` cho semantic copy/pagination helper
- từng route/component trong wave migration
- route smoke/UI audit/unit test tương ứng

Protected until separately approved:

- `frontend/src/components/common/DataTableShell.tsx`
- `frontend/src/components/common/PaginationBar.tsx`
- `frontend/src/styles/index.css` vì đang dirty và là global surface
- mọi backend file và visual snapshot dirty hiện có

## Acceptance criteria

1. Không có bảng operational nào kéo dài toàn trang vì thiếu viewport/pagination; mỗi bảng dài có boundary và trạng thái ổn định.
2. Pagination hiển thị đúng `Đang xem X–Y trên tổng N`, không tạo request/payload sai và không làm mất focus.
3. Sidebar active state, user footer và copy tiếng Việt nhất quán ở mọi route được migrate.
4. Không còn duplicate heading/toolbar/status explanation trong các route thuộc allowlist.
5. English/code terms chỉ xuất hiện khi là mã kỹ thuật; đều có label giải thích gần đó.
6. Build/lint/unit/control/smoke/ui-audit/visual pass; GitNexus không phát hiện flow ngoài dự kiến.

## Execution order

Không triển khai toàn bộ route cùng lúc. Bắt đầu Wave 1, sau đó Wave 2, mỗi wave phải có test và detect_changes trước khi chuyển wave. Nếu impact trả HIGH/CRITICAL cho symbol đang định sửa, dừng wave đó và báo blast radius trước.
