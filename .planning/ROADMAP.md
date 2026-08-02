# Roadmap: IPCManagement SAP Fiori Visual Conformance & Evidence Intelligence

## Milestone v1.4

**Goal:** Make every existing route, tab and declared canonical state measurably conform to its
declared SAP Fiori floorplan, with independently machine-read screenshots and source-linked
findings, while preserving business behavior.

**Foundation:** Milestone v1.3 is archived and complete through Phase 25. v1.4 continues at Phase
26. These five phases map directly to the five gaps approved by the user: floorplan declaration,
geometry, DOM-to-source actionability, independent image judgment, and fix plus fresh rejudge.

## Phase Overview

- [ ] **Phase 26: Floorplan Scope & Source Ownership** — close the route/state set, declare SAP
  floorplans and capabilities, and establish opaque DOM owner/region IDs with a test-owned source manifest.
- [ ] **Phase 27: Deterministic Capture & Computed Geometry** — produce complete five-viewport,
  state-provenanced PNG and geometry evidence from headed Chrome.
- [ ] **Phase 28: Independent Image Judge & Initial Census** — make every PNG actual input to an
  isolated judge and freeze the complete source/rule-linked finding ledger.
- [ ] **Phase 29: Verified SAP Fiori Remediation** — fix every verified finding, source owner by
  source owner, without changing business behavior or evidence oracles.
- [ ] **Phase 30: Fresh Rejudge & Permanent Closure Gate** — re-capture and independently rejudge
  the full matrix, install exact-set gates, synchronize evidence/docs and close v1.4.

### Phase 26: Floorplan Scope & Source Ownership

**Goal:** Define exactly what every existing screen is expected to be and make every future visual
finding resolve to an editable source owner.

**Requirements:** FLOOR-01, FLOOR-02, FLOOR-03, FLOOR-04, SOURCE-01, SOURCE-02, SOURCE-03

**Success criteria:**

1. Production routes, tabs, nested views and declared role/data states equal the registry set;
   missing, duplicate, orphan and stale keys fail a source-aware test.
2. Every state has a task-based floorplan/custom-composition declaration, official SAP URL and
   testable capability contract; ALP cannot pass without analytical drilldown and chart/table interaction.
3. Every table-bearing state declares semantic alignment, key preservation and scroll/responsive intent.
4. Opaque owner/floorplan/region IDs join rendered DOM to a complete test-owned source manifest,
   while source-path leakage checks prove paths are absent from production DOM/bundles.
5. Production instrumentation changes complete full GitNexus analysis and preserve rendered behavior.

### Phase 27: Deterministic Capture & Computed Geometry

**Goal:** Replace route sampling and document-only overflow with one reproducible screenshot and a
complete owner/region/control geometry record for every expected matrix cell.

**Requirements:** CAP-01, CAP-02, CAP-03, CAP-04, GEOM-01, GEOM-02, GEOM-03, GEOM-04

**Success criteria:**

1. Every registry state across `1920×1080`, `1440×900`, `1366×768`, `1365×900` and `1280×900`
   produces exactly one fresh hash-addressed PNG and geometry record.
2. Visible anchors plus role, route, tab/state, selected object/date and fixture/API fingerprints
   prove the intended canonical state before capture.
3. Geometry covers bounding boxes, local clipping, overlaps, occlusion, scroll ownership,
   typography, contrast inputs, target size/spacing, focus and semantic table alignment.
4. Headed Chrome evidence includes source/browser/run provenance, requests/responses,
   console/page/request errors, CLS and long tasks.
5. Capture is read-only with respect to `ipc_lane1`; no reset, seed, import or restore occurs.

### Phase 28: Independent Image Judge & Initial Census

**Goal:** Ensure every captured image is actually read in an independent context and convert the
complete initial matrix into an immutable, actionable conformance ledger.

**Requirements:** JUDGE-01, JUDGE-02, JUDGE-03, JUDGE-04

**Success criteria:**

1. Exact-set equality holds across expected matrix cells, PNG hashes, geometry records, judge
   inputs and judge verdicts; an unjudged screenshot is a hard failure.
2. The judge receives actual immutable PNG content and emits exactly one initial PASS or finding
   list per hash, with model/version and run provenance.
3. Every finding identifies severity, observable defect, owner/region, floorplan and an official
   SAP/WCAG or approved project rule; unsupported conclusions remain unresolved rather than guessed.
4. Judge inputs/outputs are immutable and isolated from capture/fixer; pixel baselines remain
   regression evidence only and cannot grant conformance approval.
5. The full initial matrix is judged before any production remediation begins.

### Phase 29: Verified SAP Fiori Remediation

**Goal:** Resolve every verified initial finding through the mapped source owner while preserving
all business, permission, lifecycle, API, cache and route behavior.

**Requirements:** FIX-01, FIX-02

**Success criteria:**

1. Every changed production fragment traces to one or more immutable finding IDs and no change
   exists outside the verified finding set.
2. Each production symbol receives complete branch-aware two-way GitNexus impact, affected-process
   disposition and risk-appropriate regression before editing and final change detection afterward.
3. Fixes follow SAP Fiori first, approved project canon second, and generic UI heuristics only when
   non-conflicting; no SAPUI5 migration or second UI kit is introduced.
4. Existing authorization, actions, route access, lifecycle, API/cache contracts and PB contextual
   exceptions remain unchanged and regression tests stay green without count reduction.
5. Fixer write boundaries prevent changes to registry, initial PNGs, judge verdicts or finding IDs.

### Phase 30: Fresh Rejudge & Permanent Closure Gate

**Goal:** Prove the complete post-fix UI from fresh evidence and prevent any future route/state/image
coverage regression.

**Requirements:** REGATE-01, REGATE-02, REGATE-03, QUAL-01, QUAL-02, QUAL-03

**Success criteria:**

1. A new headed-Chrome run re-captures every expected cell with fresh context, run IDs and hashes
   while proving equivalent canonical state fingerprints.
2. An isolated rejudge reads every new PNG, reconciles every original finding ID and leaves zero
   unresolved finding, missing verdict, orphan artifact or geometry gap.
3. Permanent deterministic verification enforces production/registry/capture/geometry/judge exact-set
   equality, immutable hashes/schemas and no-unjudged-screenshot closure.
4. Application, API, frontend, accessibility, lint, dependency and build gates pass with discovered
   test counts not lower than the v1.3 baseline.
5. `UI-CONFORMANCE-MATRIX`, evidence index, memory, GSD verification and milestone closeout agree;
   runtime created by the work is torn down and protected database lineage remains unchanged.

## Execution Rules

- Execute Phases 26 → 30 in order. Do not create another phase unless the user explicitly changes scope.
- Phase 26 contracts precede presentation edits; Phase 28 initial findings are the sole authorization
  source for Phase 29 production styling changes.
- SAP Fiori for Web is oracle level 1. Local design skills supplement accessibility and React implementation
  only where they do not conflict with SAP or an approved project decision.
- Graph-free planning uses no GitNexus; shared harness/source-aware checker work uses lightweight graph;
  production UI symbols use complete full analysis under `AGENTS.md`.
- Browser evidence uses headed Chrome and the five viewports in `MEMORY.md`. Do not reset, seed, import
  or restore `ipc_lane1`; do not push.
- One actor does not capture, judge, fix and rejudge in one mutable context. Findings and evidence are
  append-only inputs to later roles.

## Historical Milestones

- **v1.3 — UI Completeness & Conformance:** archived and complete through Phase 25.
- **v1.2 — Architecture workflow:** complete before v1.3; retained as historical evidence.
- **v1.1 — Legacy BOM/supplier roadmap:** archived and not executable.
