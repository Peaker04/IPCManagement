# Architecture Research

**Domain:** Capture, geometry and independent visual judgment for an existing React UI
**Researched:** 2026-08-02
**Confidence:** HIGH

## Recommended Architecture

```text
production routes + state inventory
              |
              v
  floorplan/scenario registry ---- official SAP provenance
              |
              +---- owner manifest ---- source file/symbol/fragment
              |
              v
      headed capture worker
       |       |       |
       |       |       +-- network/errors/CLS/long tasks
       |       +---------- geometry ledger
       +------------------ hash-addressed PNG ledger
                              |
                              v
                    isolated image judge
                              |
                     immutable findings ledger
                              |
                              v
                 source-scoped production fixer
                              |
                              v
                fresh capture + isolated rejudge
                              |
                              v
              deterministic exact-set/permanent gate
```

## Component Responsibilities

| Component | Owns | Must not own |
|---|---|---|
| Scope registry | Route, tab/nested state, role/data scenario, floorplan and required capabilities | Production authorization or business lifecycle |
| Owner manifest | Opaque owner/region ID to source file, symbol and fragment | Rendered absolute paths |
| Capture worker | Navigation, state fingerprint, PNG, geometry and runtime telemetry | Visual PASS/FAIL |
| Image judge | Reading actual immutable PNGs and emitting source/rule-linked verdicts | Source edits or baseline updates |
| Fixer | Production visual changes authorized by finding IDs | Judge ledger, registry or evidence mutation |
| Rejudge | Fresh evidence and closure of original finding IDs | Fixer rationale or reused browser state |
| Permanent gate | Set equality, schemas, hashes, provenance and test counts | Pretending AI judgment is deterministic |

## Data Contracts

### Matrix cell key

Every cell needs stable dimensions: route, view/tab/nested state, declared data state, role,
viewport and optional variant. Counts are informative only; identity uses exact keys.

### Production DOM

Production markup may expose only opaque attributes such as `data-ui-owner`,
`data-ui-floorplan` and `data-ui-region`. Values identify stable concepts, not repository paths.
The source manifest is test-owned so source locations do not leak into rendered HTML or bundles.

### Capture record

Each record binds matrix key, PNG path/hash, geometry path/hash, source commit, browser version,
run ID, state/API fingerprint, console/page/request errors, CLS and long tasks. Screenshot success
without a matching geometry record is incomplete.

### Judge record

Each record binds image hash, judge identity/version, floorplan rule source, owner/region, severity,
observable defect and either PASS or findings. A finding has an immutable ID. One image hash gets
exactly one initial verdict in a judge run.

### Rejudge record

Rejudge references original finding IDs and fresh post-fix image hashes. It may close a finding,
retain it or emit a new finding; it never overwrites initial evidence.

## Geometry Model

For every visible declared owner/region and meaningful control, capture:

- bounding box and viewport intersection;
- client/scroll dimensions and computed overflow;
- clipping ancestors and intended scroll owner;
- overlap/occlusion candidates, including sticky/fixed layers;
- font size, line height, weight, text alignment and clamp/ellipsis state;
- foreground/background colors sufficient to calculate contrast where resolvable;
- pointer target box and spacing to neighboring targets;
- table data type and header/body alignment contract.

Global `documentElement.scrollWidth` remains one signal, never the complete geometry verdict.

## Isolation and Write Boundaries

- Capture, judge, fixer and rejudge use distinct run IDs and contexts.
- Judge inputs are immutable and include actual image content.
- Fixer has no write path to registry, findings or baseline evidence.
- Rejudge starts from a fresh browser context and receives findings, not author/fixer reasoning.
- Read-only canonical fixtures may be used, but fixture/API hashes and visible anchors must prove
  which state was captured.

## Build Order

1. Close production route/state scope and floorplan contracts.
2. Add opaque ownership vocabulary and test-owned source mapping.
3. Build deterministic state navigation, PNG capture and geometry ledger.
4. Prove every expected image is actually read by an isolated judge.
5. Run the complete initial matrix and freeze findings.
6. Fix only verified findings with full impact analysis and behavior regression.
7. Re-capture and rejudge the complete matrix; install permanent closure gates.

## Key Anti-Patterns

- Separate handwritten route arrays with no source closure.
- One persistent browser profile shared across capture and rejudge.
- Human-readable filenames without hashes or source/run provenance.
- A judge that receives counters or DOM text but not PNG bytes.
- A fixer that can rewrite findings, floorplans or snapshots.
- Source paths rendered into production DOM.
- Geometry checks limited to page overflow or arbitrary universal spacing numbers.

## Integration Points

| Existing area | Integration |
|---|---|
| `frontend/src/routes/AppRouter.tsx` and route config | Production scope closure |
| Existing page/tab components | Opaque owner/floorplan/region instrumentation |
| `frontend/tests/ui-audit.spec.ts` | Reuse geometry and target checks |
| `frontend/tests/visual-routes.spec.ts` | Retain regression role; do not make it conformance approval |
| `.artifacts/shipyard-live/live-visual-audit.mjs` | Extend or replace route probe with matrix-aware headed capture |
| `docs/UI-CONFORMANCE-MATRIX.md` | Human-readable contract/evidence projection, not duplicated authority |
| `docs/EVIDENCE-INDEX.md` | Artifact hashes and authoritative pointers |

## Sources

- https://playwright.dev/docs/api/class-browsercontext
- https://playwright.dev/docs/api/class-locator
- https://playwright.dev/docs/test-snapshots
- https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplans/when-to-use-which-floorplan
- https://www.w3.org/TR/WCAG22/
- `.planning/research/PITFALLS.md`

---
*Architecture research for milestone v1.4.*
