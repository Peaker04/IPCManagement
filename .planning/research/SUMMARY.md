# Project Research Summary

**Project:** IPCManagement
**Domain:** SAP Fiori visual conformance and evidence intelligence
**Researched:** 2026-08-02
**Confidence:** HIGH

## Executive Summary

IPCManagement already has the right runtime stack and a stable compact enterprise component
canon. The missing capability is an evidence architecture: current browser runs visit only a
sample, save five final-state screenshots, do not send those PNGs to an image-capable judge and
measure little beyond document overflow, CLS and runtime errors. The milestone should therefore
add contracts and observability before changing presentation.

SAP Fiori floorplans must be declared from each state’s task semantics. A list report, worklist,
object page, overview page, analytical list page or custom dynamic-page composition is valid only
when its required capabilities are present. Capture then produces one hash-addressed PNG and one
geometry record per canonical state and viewport. An isolated judge must read each PNG and write
an immutable rule-linked verdict. Only those findings authorize production edits, followed by a
fresh full rejudge.

## Key Findings

### Stack

No package or framework migration is needed. React 19, TypeScript 6 and Playwright 1.60 already
support the required DOM instrumentation, isolated contexts, screenshots, bounding boxes, ARIA
snapshots and computed-style evaluation. Native Node hashing and typed JSON/JSONL ledgers avoid
new dependencies. SAPUI5 or a second UI kit would expand risk without solving evidence quality.

### Must-have capabilities

- Exact production route/tab/nested-state scope closure.
- Floorplan rationale and official SAP provenance for every canonical state.
- Opaque DOM owner/region IDs plus a test-owned source manifest.
- Fresh five-viewport PNG and geometry evidence for every matrix cell.
- Independent image verdicts with immutable finding IDs.
- Strict capture/judge/fixer/rejudge separation.
- Full re-capture/rejudge and permanent no-gap closure gates.

### Critical pitfalls

1. **Choosing a floorplan by resemblance** — use task semantics and capability tests.
2. **Calling KPI cards plus a table an ALP** — require real analytical drilldown and chart/table interaction.
3. **Producing write-only PNGs** — every image hash must have exactly one independent verdict.
4. **Measuring only document overflow** — record owner/region/control clipping, overlap and scroll ownership.
5. **Sharing judge/fixer context** — freeze evidence and separate roles, inputs, outputs and run IDs.
6. **Sampling routes or stale fixture states** — require exact-set closure and state/API fingerprints.

## Roadmap Implications

### Phase 26: Floorplan and ownership contracts

Close the route/state scope, declare semantic floorplans with required capabilities, define opaque
DOM ownership and a test-owned source manifest. This must precede styling so the project knows what
each screen should be and where a finding can be fixed.

### Phase 27: Deterministic capture and geometry

Build matrix-aware headed Chrome capture for all five viewports, bind each image to state/API/run
provenance and measure every declared owner/region/control. Reuse current Playwright audit work.

### Phase 28: Independent judge and initial full census

Provide actual immutable PNGs to an image-capable judge in a separate context, require one verdict
per hash and run the complete initial matrix. Freeze findings before production styling changes.

### Phase 29: Source-linked Fiori remediation

Fix every verified finding only, grouped by disjoint owners and guarded by full branch-aware impact
analysis. Preserve business, authorization, lifecycle, API and cache behavior.

### Phase 30: Fresh rejudge and permanent gate

Re-capture and independently rejudge the entire matrix from fresh contexts, reconcile every original
finding and install deterministic exact-set/hash/schema/no-unjudged gates. Update authoritative
evidence and close the milestone only when no unresolved finding or coverage gap remains.

## Confidence and Gaps

| Area | Confidence | Remaining issue |
|---|---|---|
| Stack | HIGH | None; versions verified from repository |
| Floorplan semantics | HIGH | Each concrete state still needs classification and SAP URL pinned |
| Matrix scope | MEDIUM-HIGH | Approx. 42 states known; registry must establish exact identities |
| Geometry | HIGH | Numeric threshold must have SAP/WCAG/project provenance; do not invent one |
| Judge process | MEDIUM-HIGH | Exact model/version and structured schema will be locked in Phase 28 planning |
| Canonical data | MEDIUM | Must derive state fingerprints without mutating `ipc_lane1` |

## Primary Sources

- https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplans/when-to-use-which-floorplan
- https://playwright.dev/docs/test-snapshots
- https://playwright.dev/docs/api/class-browsercontext
- https://playwright.dev/docs/api/class-locator
- https://www.w3.org/TR/WCAG22/
- `.planning/research/PITFALLS.md` and current project source/evidence files named there.

---
*Research complete; ready for requirements and roadmap.*
