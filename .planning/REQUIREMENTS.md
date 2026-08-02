# Requirements: IPCManagement v1.4

**Defined:** 2026-08-02
**Core Value:** Every permitted operational action is reachable, and equivalent declared business state produces an equivalent, predictable UI.

## v1.4 Requirements

### Floorplan and scope

- [x] **FLOOR-01**: A machine-readable registry has exact-set coverage of every production route, tab, nested view and declared role/data state in the milestone scope.
- [x] **FLOOR-02**: Every canonical state declares a SAP Fiori floorplan or an explicitly named custom dynamic-page composition, with task rationale and a current official SAP source.
- [x] **FLOOR-03**: Every named floorplan declares testable mandatory capabilities; Analytical List Page classification fails unless real analytical drilldown and chart/table interaction are rendered and exercised.
- [x] **FLOOR-04**: Table-bearing states declare semantic column data types, key/identifier preservation and intended responsive/scroll behavior.

### DOM-to-source ownership

- [ ] **SOURCE-01**: Every judged region and meaningful control exposes stable opaque owner/floorplan/region identifiers sufficient to join browser evidence to the registry.
- [x] **SOURCE-02**: A test-owned manifest maps every opaque owner/region identifier to an exact source file, symbol and fragment, and exact-set checks reject missing, duplicate, orphan or stale mappings.
- [ ] **SOURCE-03**: Production DOM and bundles expose no repository path or absolute source path from the test-owned manifest.

### Capture and state provenance

- [ ] **CAP-01**: Every canonical state × five approved desktop viewports × declared role/data variant produces one fresh, content-hashed PNG with no missing, duplicate-key, stale or orphan artifact.
- [ ] **CAP-02**: Every capture proves its canonical state with visible anchors and immutable role, route, tab/state, fixture/API and selected-object/date fingerprints.
- [ ] **CAP-03**: Every capture record includes source commit, browser version, run ID, request/response evidence, console/page/request errors, CLS and long tasks from headed Chrome.
- [ ] **CAP-04**: Capture and re-capture do not reset, seed, import or restore `ipc_lane1`; fixtures are read-only and live-lane evidence preserves lineage.

### Computed geometry and accessibility

- [ ] **GEOM-01**: Every visible declared owner, region and meaningful control has computed bounding box, viewport intersection, client/scroll dimensions, overflow, clipping ancestry and intended scroll owner evidence.
- [ ] **GEOM-02**: Geometry detects local clipping, overlap, occlusion and sticky/fixed obstruction instead of relying only on document-level overflow.
- [ ] **GEOM-03**: Evidence records typography, spacing/grid inputs, contrast inputs, pointer target size/spacing, focus visibility/obscuration and table header/body alignment wherever those values are measurable.
- [ ] **GEOM-04**: Every binary threshold has SAP, WCAG or approved project provenance; unsupported values remain explicitly unresolved and cannot be invented as conformance law.

### Independent image judgment

- [ ] **JUDGE-01**: An image-capable judge in a context separate from capture receives and reads every immutable PNG, and every image hash receives exactly one initial PASS or structured finding verdict.
- [ ] **JUDGE-02**: Every finding has an immutable ID, screenshot hash, severity, observable defect, owner/region, declared floorplan and source-linked SAP/WCAG/project rule.
- [ ] **JUDGE-03**: Screenshot baselines remain regression evidence only; neither first-run baseline generation nor `--update-snapshots` can approve SAP Fiori conformance.
- [ ] **JUDGE-04**: Judge, fixer and rejudge have distinct run/context identities and write boundaries; the fixer cannot mutate registry, initial evidence or finding ledgers.

### Remediation and fresh rejudge

- [ ] **FIX-01**: Every production UI edit traces to one or more verified finding IDs and an exact source owner, with no unrelated presentation refactor.
- [ ] **FIX-02**: Fixes preserve backend authorization, lifecycle, API, cache, route and business behavior and retain all approved PB contextual exceptions.
- [ ] **REGATE-01**: A fresh headed-Chrome run re-captures and independently rejudges the complete expected matrix after fixes, using new browser/run/evidence hashes and equivalent canonical state fingerprints.
- [ ] **REGATE-02**: Every initial finding is closed, retained with an unresolved verdict, or superseded by a source-linked new finding; milestone closeout permits no unresolved finding or coverage gap.
- [ ] **REGATE-03**: Permanent deterministic verification fails on any undeclared production route/state, missing geometry, missing/unread PNG, stale hash, orphan record or absent judge verdict.

### Quality and documentation

- [ ] **QUAL-01**: Existing application, API and frontend tests remain green and discovered test counts do not decrease.
- [ ] **QUAL-02**: Shared harness/checker changes pass the lightweight GitNexus lane; every production symbol edit passes complete branch-aware two-way impact, affected-process disposition and final change detection.
- [ ] **QUAL-03**: `docs/UI-CONFORMANCE-MATRIX.md`, `docs/EVIDENCE-INDEX.md`, `MEMORY.md` and GSD verification/closeout artifacts agree with current code and immutable evidence.

## Deferred Requirements

### Future viewport scope

- **VIEW-01**: Add tablet/mobile to the permanent visual-conformance matrix after explicit approval and canonical state design for those breakpoints.

### Future product scope

- **PROD-01**: Build the customer-specific weekly-menu template workbench as a separate product milestone.

## Out of Scope

| Feature | Reason |
|---|---|
| SAPUI5 migration or second UI kit | Existing React stack supports the required conformance work; migration changes architecture and behavior |
| New business action, route, panel or lifecycle | Milestone fixes presentation and evidence only |
| Backend policy/API/cache changes for visual results | Business behavior is an invariant, not a design variable |
| Database reset/seed/import/restore | Protected `ipc_lane1` lineage must be preserved |
| Automatic snapshot update as approval | Pixel stability does not establish SAP Fiori conformance |
| One universal spacing/pixel threshold without provenance | Unsupported numeric rules would be invented canon |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| FLOOR-01 | Phase 26 | Complete |
| FLOOR-02 | Phase 26 | Complete |
| FLOOR-03 | Phase 26 | Complete |
| FLOOR-04 | Phase 26 | Complete |
| SOURCE-01 | Phase 26 | Pending |
| SOURCE-02 | Phase 26 | Complete |
| SOURCE-03 | Phase 26 | Pending |
| CAP-01 | Phase 27 | Pending |
| CAP-02 | Phase 27 | Pending |
| CAP-03 | Phase 27 | Pending |
| CAP-04 | Phase 27 | Pending |
| GEOM-01 | Phase 27 | Pending |
| GEOM-02 | Phase 27 | Pending |
| GEOM-03 | Phase 27 | Pending |
| GEOM-04 | Phase 27 | Pending |
| JUDGE-01 | Phase 28 | Pending |
| JUDGE-02 | Phase 28 | Pending |
| JUDGE-03 | Phase 28 | Pending |
| JUDGE-04 | Phase 28 | Pending |
| FIX-01 | Phase 29 | Pending |
| FIX-02 | Phase 29 | Pending |
| REGATE-01 | Phase 30 | Pending |
| REGATE-02 | Phase 30 | Pending |
| REGATE-03 | Phase 30 | Pending |
| QUAL-01 | Phase 30 | Pending |
| QUAL-02 | Phase 30 | Pending |
| QUAL-03 | Phase 30 | Pending |

**Coverage:**
- v1.4 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-02*
*Last updated: 2026-08-02 after approved research synthesis and direct five-phase mapping*
