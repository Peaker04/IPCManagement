# Feature Research

**Domain:** SAP Fiori conformance and trustworthy visual evidence for an enterprise operations UI
**Researched:** 2026-08-02
**Confidence:** HIGH

## Required Capabilities

| Capability | Why required | Complexity | Acceptance direction |
|---|---|---:|---|
| Canonical route/state inventory | Handwritten samples silently omit tabs and nested states | HIGH | Exact-set equality with production routes and declared states |
| Semantic floorplan declaration | Conformance is impossible without saying what a screen should be | HIGH | Task rationale plus current official SAP source per state |
| Floorplan capability contract | Prevents labels such as ALP without required interactions | MEDIUM | Mandatory capabilities rendered and exercised |
| One PNG per matrix cell | Route visits are not visual evidence | HIGH | Fresh content hash for every state × viewport × declared variant |
| Computed geometry | Clipping, overlap, target size and alignment are measurable | HIGH | Owner/region/control rows, not document overflow alone |
| DOM-to-source ownership | Findings must identify an editable source location | MEDIUM | Opaque production IDs resolved by a test-owned manifest |
| Independent image judgment | A PNG must become machine input, not only a human artifact | HIGH | Exactly one structured verdict per image hash |
| Judge/fixer/rejudge separation | Prevents self-approval and confirmation bias | HIGH | Immutable role-specific inputs, outputs and run IDs |
| Fresh full rejudge | A local fix can regress another state or viewport | HIGH | Re-capture and rejudge the complete expected set |
| Permanent no-gap gate | New routes/states must not bypass conformance | MEDIUM | Fail on missing, stale, duplicate, orphan or unjudged cells |

## Valuable Differentiators

| Capability | Value | Complexity | Scope decision |
|---|---|---:|---|
| Source-linked finding IDs | Turns visual diagnosis into an actionable edit queue | MEDIUM | Include in v1.4 |
| Geometry-to-image reconciliation | Reveals gaps in both measurement and visual rules | HIGH | Include in v1.4 |
| Data/API/state fingerprints | Proves images represent the declared scenario | HIGH | Include in v1.4 |
| Official-rule provenance | Keeps floorplan and judgment criteria reviewable | MEDIUM | Include in v1.4 |
| Judge model/version provenance | Makes non-deterministic evidence auditable | LOW | Include in v1.4 |

## Anti-Features

| Anti-feature | Why it is tempting | Why rejected | Correct approach |
|---|---|---|---|
| Screenshot count as pass | Easy aggregate metric | Counts files without reading them | Hash-to-verdict exact-set closure |
| One “golden” page per viewport | Cheap visual sample | Hides route/tab/state defects | One image per canonical matrix cell |
| Floorplan inferred from appearance | Fast classification | Repeats the current author’s assumptions | Declare from task semantics with SAP provenance |
| Universal pixel thresholds | Makes tests look objective | Invents unsupported design law | Use sourced thresholds; keep unresolved values explicit |
| Automatic fix from judge output | Shortens workflow | Lets one context observe, rationalize and rewrite | Separate immutable judge, scoped fixer and fresh rejudge |
| Database reseed for pretty states | Makes screenshots predictable | Violates protected lane and erases lineage | Read-only fixtures or verified live-state fingerprints |
| SAPUI5 rewrite | Appears to guarantee Fiori | Changes stack and business risk radically | Conform existing React composition |

## Dependency Order

```text
Production route/state scope
  -> floorplan registry + capability contracts
  -> opaque owner/region vocabulary + test-owned source manifest
  -> deterministic state navigation
  -> PNG + geometry capture
  -> independent image verdict ledger
  -> source-scoped fixes
  -> fresh full re-capture and rejudge
  -> permanent exact-set gate
```

No production styling fix is authorized before a finding exists against an image hash and
declared floorplan. The final gate depends on all earlier manifests but must remain deterministic;
it checks closure and provenance, not whether an AI would always issue the same aesthetic verdict.

## Milestone Boundary

### In v1.4

- Every existing route, tab and nested state in the approved desktop scope.
- Five viewports from `MEMORY.md`.
- Read-only canonical fixtures and verified live-lane evidence where needed.
- Geometry, screenshot, judge, fixes and fresh full rejudge.

### Deferred or excluded

- Tablet/mobile default coverage.
- New business actions, routes, panels or customer template workbench.
- Backend authorization, lifecycle, API or cache changes made solely for visual results.
- Replacing React/Tailwind with SAPUI5.

## Sources

- https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplans/when-to-use-which-floorplan
- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- https://playwright.dev/docs/next/browser-contexts
- `.planning/PROJECT.md`, `MEMORY.md`, and `.planning/research/PITFALLS.md`

---
*Feature research for milestone v1.4.*
