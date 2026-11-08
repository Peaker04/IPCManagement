---
quick_id: 260802-qdk
status: complete
date: 2026-08-02
source_commit_before_closeout: 5cd7c2e
---

# Shipyard all-page/tab audit and remediation

The data-rich, read-only Shipyard audit covered all 50 canonical states across the five required headed-Chrome viewports. Evidence was read as a defect ledger, then fixes were iterated until the final rerun closed the confirmed presentation defects.

## Remediated surfaces

- Reports audit: fixed seven-column layout and bounded old/new/reason cells with local readable scroll.
- Admin BOM current: consolidated eight columns into four readable groups while preserving all values and Sửa/Ngừng controls.
- Warehouse demand: removed the redundant empty RoleInbox block when no workflow items exist; workflow actions remain when items exist.
- Admin Statistics and Chef Production: removed shared action-table width pressure and applied fixed responsive column allocation.
- Admin Cleanup, Reports Data Quality, Admin Audit, weekly purchasing and related action tables: removed excessive shared/section min-widths, preserved controls, and wrapped dense text.

## Final authoritative evidence

`.artifacts/shipyard-live/shipyard-current-e2e-20260802-after-final2/shipyard-current-e2e.json` is the final run. It records 250/250 cells, 962 successful API responses, 190 tab interactions (p95 117.8 ms, max 149.5 ms, zero over 300 ms), zero CLS, zero long tasks, zero console/page/request errors, zero duplicate reads, zero escaped mutations, zero header/body misalignment, and complete control/owner capture. The 24 local-scroll samples are vertical scrollbar gutter only (14–17 px); no content delta exceeded 20 px.

## Scope safety

No business behavior, permission/policy, API, cache, lifecycle, route access, or `ipc_lane1` data changed. GitNexus final detect reported the changed production symbols/processes; all are presentation-only and covered by focused/full regression plus final headed evidence.
