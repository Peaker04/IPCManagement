---
name: 260717-ui-ux-system-refactor-v2
status: draft-for-baseline-audit
system: existing shadcn-style local primitives
---

# UI Contract v2 — Refactor Before Migration

## Information hierarchy

Mỗi route có đúng một page title, một context/filters row, một primary action group, một content boundary và một feedback region. Không lặp lại mô tả trạng thái ở cả header, card và table nếu cùng một ý.

## Canonical surface rules

- Page shell owns width, page padding, background, global scroll and focus context.
- Route owns domain content and domain actions.
- Table viewport owns horizontal/vertical scroll, sticky header, caption/aria label and row-state geometry.
- Pagination controller owns page state only; data hook owns query/payload state.
- Status badge always has text; color is supplemental.
- Technical values use monospace only when they are identifiers, not as a substitute for labels.

## Table contracts

### Local collection

`rows[]` is already loaded. Pagination changes visible rows only and must never mutate request payload or totals.

### Server page-number

Page and page size are query state. Total count comes from server metadata; page changes trigger a request.

### Server cursor

Next/previous cursor stack is query state. The UI must show cursor semantics clearly and must not invent a numeric total.

All three contracts use the same visual `TableViewport`, but different controller adapters.

## State contract

Every long-table consumer defines loading, error, empty, no-result, mutating/stale behavior. The state occupies the same viewport boundary as the table and does not cause page-level geometry jumps.

## Copy contract

| Technical/source term | User-facing default |
|---|---|
| `Pending` | Đang chờ xử lý |
| `Owner` | Người phụ trách |
| `Reason` | Lý do |
| `Required` | Bắt buộc |
| `Error` | Lỗi |
| `Warning` | Cảnh báo |
| `Action` | Thao tác |
| `Audit` | Nhật ký thay đổi |
| `Contract` | Hợp đồng khách hàng |
| `BOM` | Định mức nguyên liệu (BOM) |

Technical code remains visible next to the semantic label where operational traceability requires it.

## Responsive contract

- Desktop: content max width and stable local table viewport.
- Tablet: action groups wrap as rows; no horizontal body overflow.
- Mobile: table remains horizontally scrollable inside its own region; actions remain reachable; no page-wide horizontal scroll.
- Compact controls have minimum 36px height; mobile controls expand to touch-safe sizing.

## Accessibility contract

- Visible keyboard focus follows the existing IPC focus token.
- Tabs expose `role=tablist/tab/tabpanel`, selected state and panel linkage.
- Table regions have an accessible name; pagination buttons have explicit previous/next labels.
- Dialogs have an accessible name and description where needed.
- `prefers-reduced-motion` disables nonessential motion.
