# IPCManagement

## What This Is

IPCManagement is a role-based operational web workbench for industrial-kitchen planning,
coordination, purchasing, warehouse, production, approvals, reports and administration.
Its React/Vite frontend uses local shared primitives with SAP Fiori-inspired compact
enterprise interaction patterns.

## Core Value

Every permitted operational action is reachable, every prohibited action is explained or
absent, and equivalent declared business state produces an equivalent, predictable UI.

## Current State

Milestone v1.3 UI Completeness & Conformance shipped on 2026-08-02:

- 22/22 requirements, seven phases and 27 plans completed.
- State/action registries, FE/BE permission vocabulary, PB/PE component canon and
  UI=f(state) source gates are in the normal verification pipeline.
- The addendum is closed through Phase 25 and was not extended; separate milestone v1.4 begins at Phase 26.
- Phase 26 is complete: 5/5 plans and FLOOR-01..04 plus SOURCE-01..03 verified with no gaps.
- Existing screenshots and telemetry are evidence artifacts, but the authoritative headed
  run does not yet machine-read each screenshot or cover every route/tab state.

## Current Milestone: v1.4 SAP Fiori Visual Conformance & Evidence Intelligence

**Goal:** Make every existing route and tab measurably conform to its declared SAP Fiori
floorplan, with independently machine-read screenshots and source-linked findings, while
preserving business behavior.

**Target features:**

- Complete route/tab/nested-view floorplan registry with official SAP provenance.
- Five-viewport geometry capture for every canonical screen state.
- Stable DOM owner/region identifiers backed by a test-owned source manifest.
- Separate capture, judge, fixer and fresh-rejudge contexts.
- Verified Fiori fixes for every finding emitted by the independent image judge.
- Permanent coverage, geometry, evidence-hash and no-unjudged-screenshot gates.

## Requirements

### Validated

- ✓ UI completeness registry and FE/BE action disposition — v1.3.
- ✓ Approved component canon and contextual exceptions — v1.3.
- ✓ Permanent source/state conformance gates — v1.3.
- ✓ Five-desktop-viewport current-source headed evidence baseline — v1.3.
- ✓ Floorplan scope and opaque rendered-source ownership — validated in Phase 26.

### Active

- [ ] Capture, measure and independently judge every canonical screenshot.
- [ ] Fix every verified finding without changing business behavior, then rejudge all states.

### Out of Scope

- Changing backend authorization, lifecycle, API, cache or business behavior to obtain a
  visual result.
- Adding tablet/mobile to the default gate; the current matrix remains the five desktop
  viewports declared in `MEMORY.md`.
- Building the customer-specific weekly-menu template workbench; it remains a separate
  deferred product feature.
- Treating pixel snapshots or generic taste heuristics as a substitute for a declared
  SAP Fiori floorplan and source-linked conformance rule.
- Resetting, seeding, importing or restoring `ipc_lane1` for visual verification.

## Next Milestone Goals

Milestone v1.4 SAP Fiori Visual Conformance will:

- declare one SAP Fiori floorplan contract for every route, tab and nested view;
- capture every canonical screen state on all five desktop viewports;
- measure spacing, density, typography, contrast, target size, clipping, overlap and
  data-type alignment from computed geometry;
- map rendered DOM regions to stable source owners through a test-owned manifest;
- separate capture, image judge, fixer and rejudge contexts;
- require an independent judge to actually inspect every PNG and emit source-linked,
  rule-linked findings before production fixes are authorized;
- fix all verified findings without changing business behavior and rejudge the complete
  matrix from fresh evidence.

## Context

SAP Fiori for Web is the primary design oracle for v1.4. The local `ui-ux-pro-max`
database supplements accessibility and React implementation checks only when it does not
conflict with SAP guidance. The five existing Phase 25 screenshots all show Admin
Statistics and visibly miss clipping/raw-formatting issues despite green JSON, which is
the concrete reason the new image-judge architecture is required.

## Constraints

- **Process:** GSD remains the sole owner of plans, state, verification and closeout.
- **Graph:** GitNexus is opt-in and is used only when explicitly requested; otherwise
  source, tests and the applicable GSD gates are the evidence boundary.
- **Evidence:** Browser runs use headed Chrome and preserve screenshot, API, console/page
  errors, CLS and long-task evidence.
- **Source:** Code/runtime is authoritative over documentation; no inferred floorplan or
  visual pass without direct evidence.
- **Git:** Preserve unrelated work, do not push, and do not use destructive reset.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep five desktop viewports | Explicit project baseline; tablet/mobile are not in the current gate | ✓ Good |
| Keep backend authorization authoritative | Visual reconciliation must not silently rewrite business policy | ✓ Good |
| Separate capture, judge, fixer and rejudge | A writer judging its own UI and write-only PNGs cannot provide independent visual evidence | — Pending v1.4 |
| Use SAP Fiori as primary oracle | Floorplan and geometry need an external, declared enterprise design contract | — Pending v1.4 |
| Keep customer template workbench deferred | It is a product capability, not visual conformance of existing routes | — Pending |

## Evolution

This document is reviewed at phase transitions and milestone boundaries. Validated
requirements move here only after implementation, verification and commit; milestone
detail is archived rather than copied into the living project context.

---
*Last updated: 2026-08-02 after completing Phase 26 floorplan scope and source ownership*
