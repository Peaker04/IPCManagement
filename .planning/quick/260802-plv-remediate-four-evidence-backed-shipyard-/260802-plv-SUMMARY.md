---
quick_id: 260802-plv
status: complete
date: 2026-08-02
source_commit: c8667f2
---

# Evidence-backed Shipyard presentation remediation summary

Four presentation defects proven by the data-rich Shipyard baseline were corrected without changing behavior, API, policy, cache, lifecycle or route access.

## Changes

- Allocated all ten Reports price-line columns. At 1280 px the table scroll width fell from 1,128 px to 983 px and row density improved substantially; at 1440 and 1920 the table now fits its local owner.
- Allocated all seven Admin Audit columns and bounded complete old/new/reason values in local scroll regions. At 1440 px the table now fits its 1,126 px owner; at 1280 px local overflow fell from 113 px to 74 px.
- Removed the populated-table fixed height from a true empty Purchasing state while retaining stable loading/populated heights.
- Rendered Admin current stock through the canonical quantity/unit formatter (`0 Kilogram` becomes `0 kg`).

## Evidence disposition

- The first post-change matrix exposed cold lazy-compile noise only in its first 1920 px pass; it is retained as a non-authoritative diagnostic run.
- The controlled warm matrix is authoritative: 250/250 canonical cells and screenshots, 966 successful API responses, 190 tab interactions with p95 156.5 ms and max 216 ms, zero over-budget switch, CLS, duplicate read, browser error or escaped mutation.
- Warm sidebar navigation covered 20 cold/warm samples with p95 124.9 ms and max 138.9 ms; every budget/error/mutation gate passed.
- UI/action completeness remains 87/87 with zero selected missing-control failure, so no speculative FE action was added.

## Verification

- Focused regressions: 9/9.
- Full frontend: 124 files / 729 tests; ESLint, dependency-cruiser (376 modules / 1,348 dependencies, zero violation), production build and UI completeness pass.
- GitNexus full-analysis final detect: 7 files, 3 production component symbols, one affected presentation process, MEDIUM; HIGH-rigor review APPROVE, Deferred none.
- `ipc_lane1` was not seeded, imported, reset, restored, sanitized or otherwise mutated.
