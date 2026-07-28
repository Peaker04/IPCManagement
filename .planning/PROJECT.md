# IPCManagement architecture hardening

## Source of truth

The active delivery workflow is **Steps 11–18** in
[`docs/ARCHITECTURE-AUDIT-2026-07-26.md`](../docs/ARCHITECTURE-AUDIT-2026-07-26.md#phần-f--workflow-kiến-trúc-duy-nhất-sau-bước-10).

The former v1.1 BOM/supplier roadmap is historical and must not be used for routing or execution.
Its roadmap, requirements and state are preserved under `.planning/archive/v1.1-legacy/`.

## Current objective

Finish the architecture workflow without changing public behavior or mutating the preserved database lane:

1. establish explicit frontend ownership in Step 17;
2. lock the result with Step 18 guardrail tests, growth gates and verified documentation.

Persistence and reliability debt closed in Step 16 at source checkpoint `59add79`; genuinely off-site
physical backup storage remains an operational concern rather than executable architecture scope.

## Non-negotiable constraints

- No push, reset, seed or import into an existing database.
- Do not rewrite, delete or move applied migrations.
- Run GitNexus upstream impact before editing symbols and staged `detect_changes` before commits.
- Preserve public API, route, cache and UI behavior unless an active step explicitly changes it.
- Use small atomic slices and close each step only after its gate is genuinely green.
