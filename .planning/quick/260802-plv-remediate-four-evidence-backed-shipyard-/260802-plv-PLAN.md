---
quick_id: 260802-plv
status: complete
mode: validate
date: 2026-08-02
lane: full-analysis
---

# Remediate four evidence-backed Shipyard presentation defects

## Goal

Correct only the four presentation defects proven by the current-source headed baseline while preserving all business behavior, API, policy, cache, lifecycle and route-access contracts.

## Must haves

- The Reports price-lines table allocates all ten columns coherently; long receipt identifiers no longer force abnormally tall rows and horizontal scrolling is locally owned.
- The Admin Audit table allocates all seven columns and bounds long raw values/reasons without hiding their complete accessible content.
- The Purchasing workbench keeps a stable viewport for loading/populated data but a true empty state sizes to its message.
- Admin current-stock quantities use the existing canonical quantity/unit formatter.
- Existing tab and sidebar timing remain within their current budgets; no database mutation or escaped frontend mutation occurs.

## Tasks

1. Add focused render/source-contract regressions for the four observed failures.
2. Apply surgical CSS/markup/formatting corrections in the four source-owned presentation components.
3. Run focused and full frontend gates, explicit-branch GitNexus change detection/review, then rerun headed Shipyard evidence at all five viewports and compare the affected geometries against baseline.

## Constraints

- Do not alter API calls, query/cache behavior, permissions, routes, lifecycle transitions or business labels/actions.
- Do not add or remove FE controls without operational evidence that a source-owned control is missing.
- Do not seed, import, reset, restore, sanitize or mutate `ipc_lane1`.
- Do not open a roadmap phase or use long waves; do not push.

## Verification

- Focused regressions pass before and after the implementation as RED/GREEN where practical.
- Full unit, lint, dependency-cruiser and production build gates pass.
- Headed screenshots and JSON show the four target states improved, with no regressions in API/errors/CLS/tab/navigation/mutation gates.
- Final `detect_changes` is reconciled with the pre-edit two-way impact evidence; raw CRITICAL dependency fan-in remains fully dispositioned with Deferred none.
