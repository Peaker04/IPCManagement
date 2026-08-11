# UI/UX Project Audit

Updated: 2026-08-11
Status: baseline complete; interaction matrix pending

## Scope and evidence

The audit covers the nine protected routes, five desktop viewports, table/tab/modal source inventory, and read-only headed runtime. Screenshots are reviewer evidence only; verdicts use DOM/runtime/source evidence.

| Surface | Inventory | Coverage now | Verdict |
|---|---:|---|---|
| Protected routes | 9 | 5 desktop viewports = 45 headed route probes | PARTIAL |
| Table owners | 35 files | global-overflow/control gate + source inventory | PARTIAL |
| Tab/view-switcher owners | 10 files | default route states only | NEEDS_EVIDENCE |
| Dialog/modal owners | 24 files | shared dialog contract only | NEEDS_EVIDENCE |
| Loading/empty/error/permission states | route-specific | selected fixture states only | NEEDS_EVIDENCE |

## Measured baseline

- `npm run test:ui-measurements -w frontend`: 10/10 passed. It proves no global page overflow or clipped controls under its fixture; it does not prove task hierarchy, action semantics, tab states, or modal owner behavior.
- Headed Chrome, current source `501789a5`, `ipc_lane9`: 45 route probes, zero overflow, console/page/request error, or escaped mutation.
- Runtime CLS exceeds the 0.1 lab threshold at Warehouse/1920 (`0.23392082403435271`) and at multiple Approvals probes (`0.101–0.152`). These are runtime findings, not screenshot judgments.

## Confirmed gaps

| ID | Scope | Verdict | Evidence | Root cause |
|---|---|---|---|---|
| UX-01 | Reports › Biến động giá › Theo dòng nhập | GAP | `ReportsPricePanel.tsx` uses a fixed 10-column table; column 10 is 8% wide while `ipc-report-action-cell` permits `overflow-wrap:anywhere`. | A workflow instruction is rendered as cell text beneath the misleading header `Xử lý`, so it wraps into an unreadable pseudo-action. |
| UX-02 | Reports › Biến động giá › Theo dòng nhập | GAP | Current live screen shows 6 of 17,194 records (`Trang 1/2866`); page size and jump-to-page are the only navigation. | Pagination is used as primary discovery instead of a constrained query/filter/detail workflow. |
| UX-03 | Warehouse and Approvals | GAP | Headed manifest above reports CLS > 0.1. | Route data/layout settles after initial render; trace is required before choosing a fix. |
| UX-04 | Whole project | GAP in assurance | Current UI measurement suite visits route defaults plus one Admin stress table, not every tab/dialog/state owner. | Existing gate proves geometry only, not complete interactive-surface coverage. |

## Required next audit matrix

For every tab owner: activate each permitted tab at all five desktop viewports and record DOM overflow, row/header alignment, focus, console/page/request state, and CLS/long-task sample. For each dialog owner: open only a non-mutating/read-only instance where available; otherwise classify `NEEDS_EVIDENCE`, not PASS. Exercise loading, empty, error and permission states from existing fixtures. Record one structured result per surface as PASS, GAP, NOT_APPLICABLE, or NEEDS_EVIDENCE.

## Planning constraint

Do not implement the above gaps from this baseline. After the interaction matrix is complete, group only evidence-backed GAPs by shared owner into one implementation phase with at most three waves.
