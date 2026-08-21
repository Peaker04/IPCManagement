# Wave 1A — Table primitive audit

Ngày: 2026-08-21

## Scope

Đã rà `DataTableShell`, `TableViewport`, `PaginatedTableFrame`, `PaginationBar`, `TablePreferencesControl`, `tablePreferences.ts` và `styles/components/tables.css`.

## Findings

| Finding | Severity | Disposition |
|---|---|---|
| `TableViewport`/`DataTableShell` đã có sticky header, frozen identifier, 3 density và table preference boundary | baseline | Giữ làm canonical primitive |
| Density code dùng `compact/standard/comfortable`, label UI là `Gọn/Tiêu chuẩn/Thoáng`, khớp rule 3 mức | pass | Không đổi tên để tránh migration storage |
| `scrollbar-gutter: stable` đã có ở base/layout và table shells | pass | Giữ; Wave 1C đo CLS |
| CSS admin quality vẫn theo table schema 9 cột sau refactor JSX còn 6 cột | high | Đã sửa ở `93714501` |
| `.ipc-table-skeleton-row`, `.ipc-table-skeleton-cell`, `ipc-skeleton-pulse` không còn consumer; project dùng `SkeletonTableRow` | medium | Đã xoá ở `4b15c8e1`, `93adf388` |
| Common table components có consumer-dependent ownership | review | Không xoá; giữ trong inventory và truy consumer ở Wave 1B |

## Wave 1A close checklist

- [x] Primitive canonical đã được xác định.
- [x] Density/scroll/sticky baseline đã đối chiếu rule.
- [x] CSS schema mismatch đã sửa trong cùng wave.
- [x] Legacy skeleton selector/animation đã source-scan và xoá.
- [x] Build và table contract test pass.
- [x] Commit-scoped diff checks pass.
- [ ] Visual/perf probe chưa chạy; thuộc Wave 1C, không dùng để giả mạo gate Wave 1A.

## Decision

**WAVE 1A CLOSED — GO TO WAVE 1B.** Wave 1B chỉ được bổ sung contract/test hoặc migrate consumer; không tạo table primitive song song.

