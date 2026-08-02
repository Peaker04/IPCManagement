# Stack Research

**Domain:** SAP Fiori visual conformance and browser evidence intelligence for an existing React operations workbench
**Researched:** 2026-08-02
**Confidence:** HIGH

## Recommendation

Keep the current frontend and test stack. React 19, Vite 8, TypeScript 6, Playwright 1.60,
Vitest 4 and native browser APIs already provide route rendering, isolated browser contexts,
PNG capture, ARIA snapshots with boxes, bounding boxes and computed styles. The milestone does
not need SAPUI5, a second component library, a visual SaaS or a new screenshot package.

## Existing Core Technologies

| Technology | Current version | Milestone purpose | Decision |
|---|---:|---|---|
| React | 19.2.6 | Existing production UI and opaque DOM ownership attributes | Keep |
| Vite | 8.0.12 | Existing build/runtime | Keep |
| TypeScript | ~6.0.2 | Typed registry, manifests, geometry and judge ledgers | Keep |
| Playwright | 1.60.0 | Headed Chrome capture, contexts, locators, screenshots and geometry | Keep |
| Vitest | 4.1.10 | Source-aware closure and schema/ledger gates | Keep |
| Tailwind CSS | 4.3.0 | Existing visual implementation | Keep; do not introduce a parallel token system |

## Native Capabilities to Prefer

| Capability | Source | Use |
|---|---|---|
| `browser.newContext()` | Playwright | Fresh capture and rejudge state; no persistent cross-role profile |
| `page.screenshot()` / locator screenshot | Playwright | One hash-addressed PNG per canonical matrix cell |
| `locator.boundingBox()` and ARIA snapshot boxes | Playwright | Viewport-relative owner/control geometry |
| `getComputedStyle`, `getBoundingClientRect` | Browser | Typography, contrast inputs, clipping ancestry, overflow and alignment |
| Node `crypto` | Runtime | SHA-256 image/manifest provenance without a dependency |
| JSON/JSONL plus schema checks | Runtime + TypeScript | Immutable capture and judge ledgers |

## Tools Already Worth Reusing

- `frontend/tests/ui-audit.spec.ts` contains useful bounding-box and tab-target checks.
- `frontend/tests/visual-routes.spec.ts` demonstrates screenshot capture but is regression evidence,
  not a conformance oracle.
- `.artifacts/shipyard-live/live-visual-audit.mjs` already launches headed Chrome and records
  network, console/page errors, CLS and long tasks; it needs matrix and image-judge closure.
- The local `ui-ux-pro-max` database supplements accessibility and implementation heuristics only.
  Its generated palette/font suggestions do not override the existing app or SAP Fiori guidance.

## What Not to Add

| Avoid | Reason | Use instead |
|---|---|---|
| SAPUI5 migration | Changes the application architecture and behavior far beyond conformance work | Existing React components plus declared SAP contracts |
| A second UI kit | Creates competing component and token vocabularies | Existing primitives and approved PB canon |
| A copied frontend SAP vocabulary | Recreates the drift class already addressed for permissions | Test-owned registry with official URLs and source closure |
| Automatic `--update-snapshots` in the fix loop | Lets current defects become self-approved baselines | Independent image verdicts; pixel snapshots only for regression |
| A deterministic rule pretending to replace visual judgment | Geometry cannot prove hierarchy, composition or floorplan fitness | Deterministic coverage gate plus independent image-capable judge |

## Compatibility and Cost

No package installation is required. Playwright 1.60 in the repository supports ARIA snapshots
with optional bounding boxes, while locator bounding boxes and screenshots are long-established
APIs. Native APIs minimize lock-in and keep the new infrastructure within the existing test lane.
The main cost is evidence volume: approximately 42 canonical states times five desktop viewports,
plus declared role/data variants, so artifact naming, hashing and exact-set checks are mandatory.

## Sources

- `frontend/package.json` — installed versions and scripts.
- https://playwright.dev/docs/api/class-browsercontext — isolated browser contexts.
- https://playwright.dev/docs/api/class-locator — bounding boxes, ARIA snapshots and screenshots.
- https://playwright.dev/docs/test-snapshots — baseline generation/update semantics.
- `.planning/research/PITFALLS.md` — project-specific failure modes and existing evidence review.

---
*Stack research for milestone v1.4; no stack migration recommended.*
