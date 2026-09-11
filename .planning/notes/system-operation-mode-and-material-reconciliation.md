---
title: System operation mode and material reconciliation discovery
date: 2026-08-25
status: locked-discovery
context: Post-Phase-28 product direction approved by Kỳ
---

# System operation mode and material reconciliation

## Decision

IPCManagement will have one **server-authoritative, system-wide operation mode**. Only an Admin may change it.

Stable internal values:

- `DEFAULT` — the current complete golden path.
- `MATERIAL_RECONCILIATION` — an early, deliberately bounded material-reconciliation branch.

The UI displays only user language: **Mặc định** and **Đối chiếu nguyên liệu**. The internal tokens must not appear in user-facing copy.

The mode is not a browser preference and must not use `localStorage` as authority. Route hiding alone is insufficient: navigation, direct-route eligibility, actions and backend operations must enforce the same mode. Existing permissions are evaluated after mode eligibility; changing mode grants no permission.

## Admin change contract

Only Admin can change the global mode. A mode change requires confirmation, actor/time audit, server persistence, frontend configuration invalidation and safe relocation of users whose current route becomes unavailable. Changing mode does not delete or rewrite data belonging to the other mode.

Direct navigation to a route excluded by the current mode uses a mode-specific unavailable state, not `/403`:

> Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu.

## Route and role matrix

`DEFAULT` retains the current project route, role and permission behavior.

`MATERIAL_RECONCILIATION` retains:

- Tổng quan
- Thực đơn tuần
- Thu mua
- Kho nguyên liệu
- Báo cáo
- Quản trị dữ liệu
- Thiết lập nâng cao — Admin only

It excludes for every role, including Admin:

- Điều phối đơn
- Duyệt vận hành
- Bếp trưởng
- Thiết lập quy trình duyệt

Within retained routes, current permission boundaries remain authoritative.

## Reconciliation workflow

The bounded workflow is:

1. Import menu and meal quantities.
2. Calculate material demand.
3. Freeze the demand version when Purchasing starts entering actual quantities.
4. Purchasing records actual purchased quantity.
5. Warehouse confirms issued quantity from the list; this early branch assumes sufficient stock and must not manufacture stock records to satisfy that assumption.
6. Compare demand, purchase and issue quantities.
7. Identify material and process gaps.

Each import creates a distinct **reconciliation batch**. Its grain is:

`reconciliation batch × ingredient identity × canonical unit`

A historical batch is immutable with respect to later menu edits. Recalculation creates a new version/batch; it does not rewrite the frozen comparison authority.

## Comparison model

For each ingredient:

- Purchase variance = purchased − required.
- Issue variance = issued − required.
- Flow gap = purchased − issued.

The UI always displays the exact variance. A row becomes **Cần kiểm tra** only when the absolute difference exceeds the applicable tolerance. Tolerance may be ingredient-specific or unit-group-specific, with a system default fallback. The batch records the tolerance/version used at freeze time so later configuration changes do not alter historical verdicts.

Default table behavior prioritizes exceptional rows and offers a secondary **Hiện tất cả** control. Normal values are neutral; shortage is danger; surplus is warning; exact/within-tolerance match uses concise **Khớp** copy.

## Project-wide content and presentation rules

These rules apply to both `DEFAULT` and `MATERIAL_RECONCILIATION`, including the current application.

### User-language rule

Each region should answer at most:

1. What is this?
2. What is its current state?
3. What should the user do next?

Remove or shorten duplicated headings, repeated status explanations, implementation vocabulary, raw enum/state/API/class names, instructions for actions unavailable to the current role, decorative badges and multi-layer empty-state prose.

### Operational identifiers

Tables show a recognizable Vietnamese document type plus a safely shortened distinguishing code, for example:

- `Phiếu bổ sung …B182`
- `Từ phiếu xuất …3531`

Full identifiers remain available through detail/tooltip and copy, searchable by full value, and unchanged in API, export and audit. Truncation is invalid when the complete value cannot be inspected/copied or when the shortened form is ambiguous.

### Tables

Prioritize decision-bearing columns; hide technical columns by default; align numbers right and text left; use one unit column instead of repeating units unnecessarily; avoid wrapping long technical IDs; move audit detail into progressive disclosure; reduce columns by priority at narrow widths instead of compressing every field.

### Empty states and notes

Use one concise state and, only when actionable and authorized, one next action. Do not stack a section description, missing-state sentence, large empty-state message and another explanatory paragraph for the same condition.

Example:

> Chưa có kế hoạch cho ca này.
>
> [Đi đến Điều phối]

If the actor lacks permission, omit the unavailable action.

### Visual hierarchy

Use one H1, short section titles, the normative `4/8/16/24/32/48/64px` spacing scale, consistent alignment/density for equivalent components, fewer unnecessary nested cards/borders, and color/status badges only when they encode decision-relevant state.

## Image findings that initiated the direction

- Full technical codes such as `SUP-20260719-105644-B182` and `ISS-20260618-213531` consume table width without helping routine review; preserve identity but shorten presentation.
- The Chef empty state repeats the same absence through section description, “Chưa có KHSX”, a second empty-state title, a long instruction and the adjacent journal label. Consolidate to one state and one valid next action.

## Non-goals for the first branch

- Replacing the existing golden path.
- Per-user or per-browser mode selection.
- Granting permissions through mode selection.
- Deleting data when switching modes.
- Pretending the warehouse stock ledger is populated merely because the early reconciliation workflow assumes material availability.
- A broad visual redesign unrelated to evidence-backed clarity, hierarchy, spacing, alignment, truncation or decision support.
