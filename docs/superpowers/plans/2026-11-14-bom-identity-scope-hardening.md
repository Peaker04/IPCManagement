# BOM identity and scope hardening implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkboxes for tracking.

**Goal:** Make BOM recovery scope-accurate, repeatable and safe for historical MRX facts while preserving catalog-wide preparation.

**Architecture:** Catalog owns ingredient and BOM identity. MRX passes an explicit customer/week/tier to a distinct contextual template; catalog export remains available for other scopes. Preview and commit share the same existing-line decision. User-visible changes stay in the existing BOM import/editor surfaces.

**Tech Stack:** C#/.NET 10, EF Core 9, MySQL, React/TypeScript, Vitest.

**Spec:** Approved findings in the 2026-11-14 conversation and `docs/superpowers/specs/2026-11-14-mrx-menu-bom-ingredient-recovery-design.md`.

## Global constraints

- Preserve `DEFAULT != MATERIAL_RECONCILIATION`, historic stock and frozen MRX facts.
- No live database mutation, package install, unprompted deploy or inherited-diff cleanup.
- Existing styling tokens and shared primitives remain authoritative.

## Review focus

- Historical/future MRX week gets only its missing scheduled dishes for the selected customer/tier.
- General catalog file still covers another customer, global scope, tier and effective date.
- Reimport of DRAFT is repeatable and preview action matches persisted action.
- Published BOM used by MRX cannot silently lose its identity or published status.
- Case variants and ambiguous ingredient names never silently bind the wrong ID.

### Task 1: Scope-correct template

- [x] Add service tests for MRX week/date/dish scope, global fallback, and unrelated catalog dishes.
- [x] Add explicit contextual template query; keep general template with an explicit effective date and all/the-dish choices.
- [x] Verify focused backend tests.

### Task 2: Consistent BOM writes

- [x] Add failing tests for DRAFT reimport and published same-start changed/status-DRAFT rows.
- [x] Align preview/commit decision; reject unsafe published changes or version by allowed effective date.
- [x] Verify focused backend tests and frozen-contributor lineage tests.

### Task 3: Ingredient identity

- [x] Add tests for case variants, ambiguous candidates and API create/update under chosen policy.
- [x] Enforce case-folded name/unit before API create/update and import commit; manual/catalog UI blocks ambiguous results.
- [x] Verify SQLite owner tests and report missing MySQL/concurrent-create evidence explicitly in WORK.md.

### Task 4: UI scope and quality

- [x] Add network-boundary DOM tests for contextual/general file actions, scope changes and error/retry.
- [x] Apply scoped UI gate; modify existing modal/route/API owners without new styling tokens.
- [x] Run impeccable detector, DOM tests, build/lint and source review; live rendered browser evidence remains open.

### Task 5: Close

- [x] Run relevant backend/frontend tests, conformance, architecture and diff checks.
- [x] Update `.planning/WORK.md` with PASS/FAIL/NEEDS_EVIDENCE per finding and return IDLE.
