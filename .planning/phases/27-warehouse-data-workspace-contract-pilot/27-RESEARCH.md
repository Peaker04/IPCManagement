# Phase 27: Warehouse Data Workspace contract pilot - Research

**Researched:** 2026-08-22
**Domain:** Warehouse-only Playwright evidence collection and deterministic UI contracts
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Pilot surface and hierarchy
- **D-01:** Apply the detailed Data Workspace contract only to the `Luân chuyển` tab. Contract `Tồn kho hiện tại`, `Luân chuyển kho`, `Phiếu kho`, search, pagination, query states, detail rail and responsive split.
- **D-02:** Apply only a minimal shell contract across all three Warehouse tabs: tab strip, active-tab semantics, accessible names, keyboard/focus behavior, preserve-visited lifecycle, shell geometry, no overflow and no clipping.
- **D-03:** `Tồn kho hiện tại` is the primary dataset. `Luân chuyển kho` is supporting history with its own search, query-state, table and pagination owner. Do not merge them or add a switcher.
- **D-04:** `Phiếu kho` is a supporting document rail for the whole tab and remains independent of row selection. Do not add selection behavior.

### Responsive behavior
- **D-05:** On wide desktop, dataset workspace and document rail remain side by side. On narrow desktop, the rail may move below the dataset workspace.
- **D-06:** Responsive transformation must preserve DOM, semantic and focus order. Do not duplicate the rail or use CSS reorder that diverges from reading order.
- **D-07:** When the rail moves below, region ownership, headings and contracted spacing remain intact. Deterministic checks cover overflow, overlap, clipping, DOM/focus order, rail visibility and breakpoint transformation.

### Evidence matrix
- **D-08:** Use a warehouse keeper for the happy path and one actor without read permission for forbidden presentation. Do not add Admin or receiving/mutation roles to the detailed matrix.
- **D-09:** Run `ready`, `mixed-empty` and `forbidden` browser evidence at all five current desktop viewports. Cover `loading`, `refreshing`, `error` and all-empty semantics with structural/component contracts. Escalate another state to multi-viewport browser evidence only when a deterministic check proves viewport-dependent geometry.
- **D-10:** The `ready` fixture is one representative upper-bound, domain-valid fixture reused at every viewport. It has stable record identities, eight rows sufficient to activate table/pagination behavior, valid short and long labels, valid small and large values, varied states and multiple rail documents. Do not use impossible values or meaningless stress strings.
- **D-11:** The browser empty scenario is mixed: primary current stock is empty while supporting history and the document rail retain data. This proves independent region ownership without multiplying browser scenarios.

### Deterministic rule boundary
- **D-12:** The blocking core contract covers exactly one H1 and heading order, required regions and accessible names, component-region ownership, overflow/overlap/clipping, DOM/focus order, responsive rail transformation, primary-action count and console/page errors.
- **D-13:** A deterministic rule may block only when it has a known expected value, machine-readable evidence and an explicit owner. Otherwise it yields `NEEDS_EVIDENCE` or `UNRESOLVED`.
- **D-14:** Resolve ownership in this order: stable semantic locator; test-owned region-to-owner manifest; source-aware mapping; local production metadata only when the first three cannot establish a stable mapping.
- **D-15:** Check only spacing declared by the Warehouse region contract: primary-to-history gap, workspace-to-rail gap, spacing after rail stacking, region-boundary padding and other explicitly contracted layout-level values. Use tolerance for browser rounding. Existing source scans own hardcoded token violations; internal Base UI/shadcn spacing outside the pilot does not block.
- **D-16:** Every deterministic violation inside the declared contract produces `FAIL` and makes the Phase 27 gate fail. Severity only orders remediation.

### AI review boundary
- **D-17:** Preserve all 15 browser captures in the evidence manifest. Send AI a reasoned selection: `ready` at wide/transition/narrow, `mixed-empty` at narrow, `forbidden` at one representative viewport, plus captures near geometry thresholds, with notable rail transformation or needing context for a deterministic finding. Every selected capture records its selection reason. AI cannot expand beyond the selection manifest.
- **D-18:** If an AI hypothesis depends on an unreviewed viewport or state, return `NEEDS_EVIDENCE`, not `FAIL`.
- **D-19:** AI may identify hierarchy, grouping, balance and information-architecture issues, state a concrete expected outcome and identify owner level (`token`, `primitive`, `shared-component`, `layout`, `route`). It may not select replacement components, write CSS/layout solutions, change tokens, auto-fix or turn a recommendation into a default implementation plan.
- **D-20:** AI `FAIL` requires selected-manifest evidence, concrete expected and actual, identified owner level, no dependency on an unreviewed state/viewport and confidence `>= 0.8`. A plausible hypothesis lacking evidence is `NEEDS_EVIDENCE`; missing trusted expected outcome, owner or business contract is `UNRESOLVED`.
- **D-21:** AI `FAIL` makes the phase gate fail and enters the planning/refactor queue, but never edits production automatically.
- **D-22:** Post-refactor review uses a fresh reviewer that receives only the current contract, selection manifest, new evidence, old finding IDs and expected outcomes. Hide implementation rationale, solution diff and implementer explanation. Allowed re-review verdicts are `RESOLVED`, `STILL_FAILING`, `REGRESSED`, `NEEDS_EVIDENCE` and `UNRESOLVED`.

### the agent's Discretion
- Choose technical file boundaries, JSON serialization details and test helper structure while preserving the minimal pilot scope and existing ownership seams.
- Choose exact breakpoint from measured current layout behavior; do not invent or change the viewport matrix.
- Choose reasonable numeric tolerance for browser rounding and document it next to the relevant deterministic rule.

### Deferred Ideas (OUT OF SCOPE)
- Admin Data contract validation is locked until Phase 27 closes.
- Purchasing adoption and Workflow-boundary research remain locked until Admin Data validation completes.
- A broad archetype renderer, UI DSL, generic framework, component-library replacement and redesign mockup are explicitly deferred/out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| UIC-01 | Declared archetype, object, grain, regions, owners, responsive invariants | Region manifest and responsibility map below |
| UIC-02 | Unified screenshot/ARIA/geometry/style/runtime evidence | Capture-record pattern below |
| UIC-03 | Deterministic rules precede AI | Two-stage collector/evaluator architecture below |
| UIC-04 | Schema-valid AI findings | Closed verdict/finding schemas below |
| UIC-05 | Preserve shadcn/Base UI foundation | No package or component-stack change recommended |
| WHP-01 | Minimal Warehouse contract, no framework | Warehouse-local contracts and fixture modules only |
| WHP-02 | Baseline before refactor; every edit traces to finding | Immutable run IDs and before/after reconciliation |
| WHP-03 | Preserve behavior/API/cache/permissions/identity | Read-only interception and non-GET guard |
| WHP-04 | Ordered closeout gate | Exact command ladder below |
</phase_requirements>

## Summary

The smallest viable pilot is an extension of `frontend/tests/ui-audit.spec.ts`, not a second runner. The current audit already owns the canonical five viewports, API interception, console/page/non-read request capture, geometry, JSON report writing, tab traversal and a Warehouse forbidden case. [VERIFIED: frontend/tests/ui-audit.spec.ts:44-108 — `measurementViewports` is exactly `1920x1080`, `1440x900`, `1366x768`, `1365x900`, `1280x900`; interaction evidence contains `geometry`, `focus`, `consoleErrors`, `pageErrors`, `nonReadRequests`.] Add Warehouse-focused fixture/contract/collector helpers beside it, while leaving the generic protected-route loop intact.

The first baseline is expected to fail the responsive contract: `SplitWorkbench` is explicitly implemented and styled as column-only, so the rail is below at every width. [VERIFIED: frontend/src/components/common/SplitWorkbench.tsx:13-30 — “`SplitWorkbench — bố cục dọc`”; DOM is primary then one `aside`.] [VERIFIED: frontend/src/styles/components/operations.css:211-239 — `.ipc-split-workbench` has `flex-direction: column`; `.ipc-split-detail-strip-body` is a grid.] This is a useful pilot finding, not a reason to pre-edit production. Measure adjacent canonical viewports first, write the expected transition into the baseline contract, then make the smallest owner-level change only after a deterministic `FAIL` exists.

**Primary recommendation:** Build one Warehouse-local evidence fixture + contract manifest + deterministic evaluator around the current `ui-audit.spec.ts`; capture all 15 records, fail before AI, and refactor only the proven `SplitWorkbench`/Warehouse owner seam.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Fixture state/actor interception | Browser test harness | API boundary | Read-only route interception controls deterministic responses without backend changes. [VERIFIED: frontend/tests/ui-audit.spec.ts:76-116] |
| Screenshot/ARIA/geometry/style/runtime capture | Browser test harness | — | All signals describe one rendered browser state. |
| Contract and ownership manifests | Test/contract boundary | Source-aware mapping | Existing source ownership is test-owned. [VERIFIED: frontend/tests/uiSourceOwnershipManifest.ts:25-35,63-71] |
| Query ownership and pagination behavior | Frontend route | RTK Query API layer | `WarehousePage` owns searches/pages/cursors and passes presentation into the panel. [VERIFIED: frontend/src/features/warehouse/pages/WarehousePage.tsx:69-82,129-135] |
| Primary/history/rail composition | Frontend feature layout | Shared primitives | `WarehouseMovementPanel` composes independent datasets and one rail. [VERIFIED: frontend/src/features/warehouse/pages/WarehouseMovementPanel.tsx:68-124] |
| Responsive side/stack transform | Shared `SplitWorkbench` layout | Warehouse feature class/contract | The shared primitive owns DOM placement; scope any behavior so other consumers are not silently changed. |
| AI review | Read-only review stage | Evidence manifest | It consumes selected evidence only and never writes production. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| `@playwright/test` | `^1.60.0` | Browser capture/assertions | Already installed and owns the measurement gate. [VERIFIED: frontend/package.json:47-50] |
| Vitest | `^4.1.10` | Structural/component contracts | Existing unit runner. [VERIFIED: frontend/package.json:11-15,47-55] |
| React | `^19.2.6` | Existing production UI | Preserve current implementation. [VERIFIED: frontend/package.json:39-41] |
| Base UI/local shadcn | `@base-ui/react ^1.5.0`, `shadcn ^4.11.0` | Existing controls | Locked foundation; no replacement. [VERIFIED: frontend/package.json:31-45] |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| Node `fs`/`path` | runtime built-ins | Deterministic artifact writing | Reuse current report writer; no package needed. [VERIFIED: frontend/tests/ui-audit.spec.ts:1-3,64-73] |
| Testing Library | `@testing-library/react ^16.3.2`, `user-event ^14.6.1` | Shell keyboard/state tests | Structural loading/refreshing/error/all-empty and tab lifecycle. [VERIFIED: frontend/package.json:51-53] |

**Installation:** none. This phase should install no external package.

## Package Legitimacy Audit

Not applicable: no package installation is recommended.

## Architecture Patterns

### System Architecture Diagram

```text
Warehouse contract + versioned fixture
              |
              v
Playwright route interception (GET-only; actor/state fixed)
              |
              v
Real /warehouse UI in Chrome
              |
              +--> screenshot
              +--> AI-mode ARIA snapshot + boxes
              +--> explicit region/element geometry
              +--> whitelisted computed styles
              +--> focus/DOM order
              +--> console/page/non-GET request signals
              |
              v
Capture manifest (15 immutable records)
              |
              v
Deterministic evaluator ---- FAIL ---> finding queue (owner + selector + metric)
              |
              +---- no machine FAIL ---> selection manifest ---> read-only AI review
                                                        |
                                                        v
                                          schema validation / verdict gate
                                                        |
                                                        v
                                      authorized minimal owner-level refactor
                                                        |
                                                        v
                                           fresh capture + reconciliation
```

### Recommended Project Structure

```text
frontend/tests/
├── ui-audit.spec.ts                         # existing runner; add focused describe/imports
├── warehouseDataWorkspaceContract.ts        # constants, regions, rules, verdict/finding types
├── warehouseDataWorkspaceFixture.ts         # one fixture version; ready/mixed-empty/forbidden handlers
├── warehouseEvidenceCollector.ts            # capture one record; serialization only
├── warehouseDeterministicRules.ts            # pure record -> findings evaluator
├── warehouseDataWorkspaceContract.test.ts    # schema/rule/structural-state unit tests
└── test-results/                             # generated run manifest/screenshots; never source baseline
```

Do not create `DataWorkspacePage`, a generic archetype registry, a generic renderer, or a second Playwright config. [VERIFIED: .planning/phases/27-warehouse-data-workspace-contract-pilot/27-UI-SPEC.md — Adoption boundary explicitly prohibits these.]

### Pattern 1: Capture first, evaluate second

**What:** Collection returns facts only; pure rules compare those facts to a versioned contract. Never let capture code infer visual quality.

```ts
// Project-prescribed skeleton; exact field names beyond locked values are planner discretion.
const record = await collectWarehouseEvidence(page, scenario, viewport);
const deterministic = evaluateWarehouseContract(contract, record);
if (deterministic.some((finding) => finding.verdict === 'FAIL')) throw new Error('warehouse contract failed');
```

The locked deterministic violation token is verbatim `FAIL`; missing oracle/evidence/owner is verbatim `NEEDS_EVIDENCE` or `UNRESOLVED`. [VERIFIED: .planning/phases/27-warehouse-data-workspace-contract-pilot/27-CONTEXT.md, D-13/D-16]

### Pattern 2: One capture identity

Use a stable composite key `contractVersion/fixtureVersion/actor/state/viewport`. Each record must contain route, tab, actor, state, viewport, fixture record IDs, screenshot path, ARIA text, geometry probes, computed-style whitelist, DOM/focus order and runtime errors. Write each record atomically after all probes finish; top-level manifest lists exactly 15 browser records (3 states × 5 viewports). [VERIFIED: 27-UI-SPEC.md, Evidence and State Contract]

### Pattern 3: Representative fixture, not stress garbage

Use eight current-stock rows and eight movement rows with stable IDs, multiple rail documents, real Vietnamese labels of varying length, positive domain-valid quantities, and varied document/movement states. Keep the same ready payload at every viewport. `mixed-empty` changes only current stock to empty; movement/history and rail remain populated. [VERIFIED: 27-CONTEXT.md, D-10/D-11]

Recommended fixture invariants:
- freeze a literal `fixtureVersion`;
- assert IDs unique and all expected record IDs occur in the manifest;
- assert exactly eight rows for each paged dataset and more total records/`hasNext` as needed to activate controls;
- assert every document route is read-only navigation and the capture never clicks `Mở phiếu`;
- forbid random UUIDs, current time and locale-dependent generation in fixture data.

### Pattern 4: Existing owner-resolution seam

Create a Warehouse region manifest rather than production `data-*` metadata. Resolve `warehouse-current-stock`, `warehouse-movement-history`, and `warehouse-document-rail` by stable accessible region/name first, then map to `WarehouseMovementPanel`, `SectionPanel`/`TableViewport`/`StockMovementTable`, and `SplitWorkbench`/`DocumentRail`. The existing manifest already models source file, symbol and source fragment at the test boundary. [VERIFIED: frontend/tests/uiSourceOwnershipManifest.ts:10-35]

### Pattern 5: Breakpoint discovery without baseline laundering

Run the unmodified baseline at all five widths, classify rail relation from bounding boxes (`side-by-side` when horizontal separation exists with vertical overlap; `stacked` when rail top follows workspace bottom), and record the observed adjacent transition pair. Because current source is column-only, expect no valid wide state and emit `FAIL`, rather than inventing a breakpoint or editing the expectation. [VERIFIED: frontend/src/styles/components/operations.css:211-239]

### Anti-Patterns to Avoid

- **Second audit framework:** forks viewport/auth/stub/report policy and creates conflicting verdicts.
- **Generic contract DSL:** one route cannot justify framework vocabulary or renderer machinery.
- **Production instrumentation first:** ownership metadata is last resort; semantic/test/source mappings already exist.
- **Screenshot oracle:** pixels are reviewer evidence, not a deterministic PASS/FAIL source.
- **One giant fixture stub:** current `stubAuditApi` is broad; add Warehouse-specific handlers/builders with endpoint-shape assertions, not more unrelated branching.
- **Threshold editing after failure:** contract, fixture version and expected responsive relation must be frozen before production edits.
- **Global `SplitWorkbench` change without consumer checks:** it is shared; add a scoped mode/class or prove all consumers share the need before changing default behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Browser automation | custom Chrome/CDP runner | existing Playwright config and test | Chrome channel, web server and trace retention already configured. [VERIFIED: frontend/playwright.config.ts:13-34] |
| Accessibility tree | custom DOM-to-text serializer | Playwright ARIA snapshot API required by contract | Avoid divergent accessible-name logic. |
| Component system | SAP/Carbon components or new wrappers | existing local shadcn/Base UI owners | Locked stack and identity. |
| Table overflow | route-local scrolling CSS | `TableViewport` | It is the canonical `role="region"`, `overflow-auto`, focusable table boundary. [VERIFIED: frontend/src/components/common/TableViewport.tsx:52-72] |
| Tab lifecycle/keyboard | Warehouse-only tabs | `ViewSwitcher` + `KeepAliveTabPanel` | Existing tests already lock roving tab stop and Arrow/End keyboard behavior. [VERIFIED: frontend/src/components/common/ViewSwitcher.test.tsx]
| AI auto-remediation | prompt-driven CSS edits | schema-valid read-only findings and explicit queue | Prevents qualitative guesses from becoming production changes. |

## Common Pitfalls

### Pitfall 1: Forbidden at wrong boundary (HIGH)
**What goes wrong:** The existing audit proves route-level redirect to `/403`, while the detailed UI spec names dataset-specific forbidden headings. [VERIFIED: frontend/tests/ui-audit.spec.ts, test “warehouse route renders the named forbidden state”.]
**How to avoid:** Treat route-forbidden as the locked browser scenario unless product routing allows the detailed panel to render; cover dataset-specific forbidden presentation structurally. Do not weaken `RoleGuard` or fabricate partial permission behavior to make browser fixtures convenient.

### Pitfall 2: Existing `PASS` vocabulary is too weak (HIGH)
**What goes wrong:** Current `InteractionOutcome` is verbatim `'PASS' | 'GAP' | 'NOT_APPLICABLE' | 'NEEDS_EVIDENCE'` and converts runtime issues to `GAP`; Phase 27 requires `FAIL` and `UNRESOLVED`. [VERIFIED: frontend/tests/ui-audit.spec.ts:18-31,92-108]
**How to avoid:** Add a Phase-27 finding schema without silently changing historical schema v1 reports. Bump the Warehouse manifest schema independently.

### Pitfall 3: Current collector lacks required evidence (HIGH)
**What goes wrong:** It captures only document geometry and a focus label; no screenshot path, ARIA snapshot, element boxes, style whitelist, DOM/focus sequence, fixture identity or region owner. [VERIFIED: frontend/tests/ui-audit.spec.ts:20-31,92-108]
**How to avoid:** Add one atomic Warehouse capture record containing every required field, then validate it before evaluation.

### Pitfall 4: Responsive baseline already contradicts contract (BLOCKER after baseline)
**What goes wrong:** Rail is always below, including wide desktop. [VERIFIED: frontend/src/components/common/SplitWorkbench.tsx:13-30; frontend/src/styles/components/operations.css:211-239]
**How to avoid:** Preserve baseline failure, then remediate at the lowest demonstrated layout owner; do not update expected mode to “stacked everywhere.”

### Pitfall 5: Heading/region semantics may not be directly locatable (HIGH)
**What goes wrong:** `SectionPanel` titles and the rail label need explicit semantic inspection; class selectors alone cannot prove accessible region names or heading order.
**How to avoid:** Structural test and ARIA snapshot must prove exactly one H1, heading levels and required named regions before geometry checks run. Missing semantics is `FAIL` when the expected owner is known.

### Pitfall 6: Shared-seam blast radius (HIGH)
**What goes wrong:** `SplitWorkbench` and common CSS are shared, so a default responsive change can alter other routes.
**How to avoid:** Inventory direct consumers with source search, add focused regressions for each, and prefer an explicit existing-primitive mode consumed only by Warehouse until Admin validates promotion. This remains anti-framework because it is a bounded prop/class, not an archetype renderer.

### Pitfall 7: Non-determinism from capture mechanics (MEDIUM)
**What goes wrong:** animations, async queries, fonts, timestamps or random IDs shift boxes and screenshots.
**How to avoid:** Reuse `stabilize`, fixed fixture timestamps/IDs, reduced motion, settled network/state assertions, and ±0.5 CSS-px only for contracted spacing. [VERIFIED: frontend/tests/ui-audit.spec.ts:425-435; frontend/playwright.config.ts:18]

## Code Examples

### Explicit geometry probe

```ts
const geometry = await page.getByRole('region', { name: 'Bảng tồn kho hiện tại trong kho' }).evaluate((node) => {
  const rect = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  return {
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    scroll: { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth },
    style: { display: style.display, overflowX: style.overflowX, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight },
  };
});
```

Only whitelist styles tied to the declared contract; do not dump all computed styles.

### Overlap/clipping oracle

```ts
const overlaps = (a: DOMRect, b: DOMRect, tolerance = 0.5) =>
  a.left < b.right - tolerance && a.right > b.left + tolerance &&
  a.top < b.bottom - tolerance && a.bottom > b.top + tolerance;

const clipped = (child: DOMRect, owner: DOMRect, tolerance = 0.5) =>
  child.left < owner.left - tolerance || child.right > owner.right + tolerance ||
  child.top < owner.top - tolerance || child.bottom > owner.bottom + tolerance;
```

The exact tolerance `±0.5 CSS px` is locked by the UI spec. [VERIFIED: 27-UI-SPEC.md, Contracted layout spacing]

### Finding validation shape

```ts
type WarehouseVerdict = 'PASS' | 'FAIL' | 'NEEDS_EVIDENCE' | 'UNRESOLVED';
type WarehouseFinding = {
  id: string;
  rule: string;
  verdict: Exclude<WarehouseVerdict, 'PASS'>;
  evidence: string[];
  expected: string;
  actual: string;
  severity: 'blocker' | 'high' | 'medium' | 'low';
  owner: { level: 'token' | 'primitive' | 'shared-component' | 'layout' | 'route'; source?: string };
  confidence: number;
};
```

All shown verdict and owner-level values are quoted verbatim from the locked context. [VERIFIED: 27-CONTEXT.md, D-13/D-19/D-20]

## State of the Art

| Old/current approach | Phase 27 approach | Impact |
|---|---|---|
| schema-v1 route audit with C1/C2/C4/A1 and interaction records | bounded Warehouse capture schema + pure deterministic rules | Adds evidence without replacing historical gate. [VERIFIED: docs/UI-UX-MEASUREMENT-PROTOCOL.md] |
| screenshot on failure/reviewer visual snapshots | screenshot in every selected Warehouse capture, never oracle | Meets evidence manifest while preserving verdict policy. |
| top-level route owner mapping | region-to-owner manifest for three detailed regions | Enables actionable lowest-owner findings. |
| column-only `SplitWorkbench` | measured side/stack contract | Proves the pilot’s responsive rule rather than assuming it. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Playwright 1.60 exposes the exact requested `ariaSnapshot({ mode: "ai", boxes: true })` call shape in this installed runtime. [ASSUMED] | Don't Hand-Roll / collector | Planner should add a Wave 0 compile/probe; if API shape differs, use the installed Playwright-supported equivalent without a custom serializer. |
| A2 | A Warehouse-scoped mode/prop on `SplitWorkbench` is safer than changing its default. [ASSUMED] | Pitfall 6 | Consumer inventory may show the same responsive need elsewhere; still do not promote until Admin gate. |

## Planning Dispositions

1. **Exact responsive breakpoint — RESOLVED AS MEASUREMENT-FIRST PLAN DECISION**
   - Current layout never transitions and the five canonical widths are fixed.
   - Plan 27-02 must measure the adjacent canonical viewports, record the minimum usable dataset/rail boxes, and freeze the transition before Plan 27-03 edits production. No breakpoint may be guessed or laundered from the current always-stacked implementation.

2. **Dataset-forbidden versus route-forbidden evidence — RESOLVED**
   - Existing browser coverage redirects a user lacking Warehouse access to `/403`; no proven partial-access role exists.
   - Keep route-forbidden browser evidence and structural dataset-forbidden tests. Do not invent a role or weaken `RoleGuard`.

3. **H1 owner — RESOLVED AS WAVE-0 ASSERTION**
   - `OperationalFrame` renders an H2 only when `title` exists, and Warehouse does not pass one. [VERIFIED: frontend/src/components/common/OperationalFrame.tsx:31-47]
   - Plan 27-01 must identify and record the shell H1 owner through the real DOM before enabling the heading rule. Missing owner/evidence remains fail-closed rather than inferred.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---:|---|
| Node.js | frontend tooling | ✓ | `v24.13.0` | — |
| npm | workspace commands | ✓ | `11.6.2` | — |
| Playwright CLI | collector | ✓ | `1.60.0` | — |
| Google Chrome | configured browser project | configured | version not probed | Playwright must fail closed; do not switch to screenshot-only review |

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Unit/structural | Vitest `^4.1.10` |
| Browser | Playwright `^1.60.0`, Chrome channel |
| Config | `frontend/playwright.config.ts` |
| Quick run | `npm run test:unit -w frontend -- --run tests/warehouseDataWorkspaceContract.test.ts src/features/warehouse/pages/WarehouseMovementPanel.test.tsx --maxWorkers=1` |
| Focused browser | `npm exec -w frontend playwright test tests/ui-audit.spec.ts --grep "Warehouse Data Workspace contract" --workers=1` |
| Existing measurement gate | `NODE_OPTIONS=--max-old-space-size=4096 npm run test:ui-measurements -w frontend -- --workers=1` |
| Full frontend unit | `npm run test:fe:unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| UIC-01/WHP-01 | Contract schema, exact regions/owners/invariants | unit | quick run above | ❌ Wave 0 |
| UIC-02/WHP-02 | 15 complete capture records and immutable fixture identity | Playwright | focused browser above | ❌ Wave 0 |
| UIC-03 | deterministic rule coverage and fail-closed verdicts | unit + Playwright | quick + focused browser | ❌ Wave 0 |
| UIC-04 | reject malformed/PASS AI findings; confidence threshold | unit | quick run above | ❌ Wave 0 |
| UIC-05/WHP-03 | no package/stack/API/cache/permission mutation | source + browser | `npm run lint:fe && npm run depcruise:fe && npm run build:fe` plus non-GET guard | existing gates; phase assertions ❌ |
| WHP-04 | ordered before/after reconciliation | gate script/test | focused browser then existing measurement gate | ❌ Wave 0 |

### Required validation order

```bash
# 1. Contract/schema/structural states
npm run test:unit -w frontend -- --run tests/warehouseDataWorkspaceContract.test.ts src/features/warehouse/pages/WarehouseMovementPanel.test.tsx --maxWorkers=1

# 2. Warehouse structural + accessibility + 15-capture evidence + responsive rules
npm exec -w frontend playwright test tests/ui-audit.spec.ts --grep "Warehouse Data Workspace contract" --workers=1

# 3. Existing cross-route measurement regression
NODE_OPTIONS=--max-old-space-size=4096 npm run test:ui-measurements -w frontend -- --workers=1

# 4. Existing visual evidence (reviewer only; never update snapshots to pass)
npm run test:visual -w frontend -- --grep "warehouse" --workers=1

# 5. Static/build gates
npm run lint:fe
npm run depcruise:fe
npm run build:fe

git diff --check
```

AI review runs only after commands 1–3 produce no deterministic failure. Phase closeout additionally runs `npm run test:fe:unit`; do not claim full-project `npm run verify` until the known architecture-growth baseline blocker in `MEMORY.md` is separately dispositioned. [VERIFIED: MEMORY.md, “Còn mở”]

### Sampling Rate
- **Per task commit:** quick unit command.
- **Per collector/rule change:** focused browser command.
- **Per wave merge:** existing measurement + lint + dependency-cruiser + build.
- **Phase gate:** full command ladder, fresh after evidence, AI re-review, `git diff --check`.

### Wave 0 Gaps
- [ ] `frontend/tests/warehouseDataWorkspaceContract.ts`
- [ ] `frontend/tests/warehouseDataWorkspaceFixture.ts`
- [ ] `frontend/tests/warehouseEvidenceCollector.ts`
- [ ] `frontend/tests/warehouseDeterministicRules.ts`
- [ ] `frontend/tests/warehouseDataWorkspaceContract.test.ts`
- [ ] focused Warehouse describe in `frontend/tests/ui-audit.spec.ts`
- [ ] structural test for `WarehouseMovementPanel` states and region semantics
- [ ] compile/probe exact installed ARIA snapshot API shape

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---:|---|
| V2 Authentication | yes, fixture boundary | Reuse existing login/profile interception; no credentials in artifacts |
| V3 Session Management | yes, fixture boundary | isolated browser context and fixed synthetic user |
| V4 Access Control | yes | retain `RoleGuard` forbidden behavior; never weaken permission to expose panel |
| V5 Input Validation | yes | runtime schema guards for fixture, capture and findings; reject malformed evidence |
| V6 Cryptography | no | no cryptographic feature in scope |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Fixture accidentally sends mutation | Tampering | intercept/log all non-GET API requests and fail capture |
| Evidence path traversal | Tampering | generate artifact paths from controlled run/scenario IDs, never AI/user text |
| Credentials/PII in manifest | Information disclosure | synthetic actors/records; scan output; never persist token/storage state |
| AI prompt/evidence injection | Spoofing/Tampering | treat screenshot/ARIA/copy as untrusted data; schema validate output and deny tools/production writes |
| Stale baseline authorizes change | Tampering | contract/fixture version + fresh run ID + before/after reconciliation |

## Project Constraints (from AGENTS.md)

- GitNexus is opt-in only; this task explicitly says no GitNexus, so the diff is graph-free and no graph calls are allowed.
- GSD is the sole planning/state/verification owner.
- Preserve unrelated working-tree changes; do not reset, overwrite or commit them.
- UI work follows `docs/UI-UX-EXECUTION-HARNESS.md`; screenshots are reviewer artifacts, not PASS/FAIL oracles.
- Browser evidence uses real headed Chrome and the canonical viewport matrix; do not hardcode credentials or mutate/reset/seed a database lane.
- Verdicts must come from DOM/test/API/focus/trace evidence and target the lowest owner.
- End with relevant checks, `git diff --check`, secret/stub scan and evidence index discipline; this research task itself changes only `27-RESEARCH.md`.

## Findings for Planning

1. **BLOCKER (expected baseline):** `frontend/src/components/common/SplitWorkbench.tsx:13-30` and `frontend/src/styles/components/operations.css:211-239` implement an always-stacked rail, contradicting wide side-by-side D-05. Collect the failure before remediation.
2. **HIGH:** `frontend/tests/ui-audit.spec.ts:18-31,92-108` cannot express Phase-27 `FAIL`/`UNRESOLVED` or complete evidence. Add a separate Warehouse schema version rather than rewriting historical audit output.
3. **HIGH:** `frontend/tests/ui-audit.spec.ts:44-108` already provides the correct extension seam (viewports, runtime signals, report writing); a second collector framework would duplicate policy.
4. **HIGH:** `frontend/tests/uiSourceOwnershipManifest.ts:25-35,63-71` proves test-owned source ownership is established, but only at route level; add three Warehouse region mappings locally.
5. **MEDIUM:** `frontend/src/features/warehouse/pages/WarehouseMovementPanel.tsx:18-25` defines the exact query phase union verbatim as `'uninitialized' | 'loading' | 'ready' | 'error' | 'forbidden'`; refreshing is a flag on ready, so fixtures/tests must not invent a separate production phase token.
6. **HIGH:** current forbidden browser evidence is route-level `/403`, not panel-level dataset denial; preserve access control and test panel forbidden structurally unless an existing partial permission is proven.

## Residual Risks

- Exact responsive transition remains `UNRESOLVED` until baseline geometry is measured; this is deliberate planner work, not permission to guess.
- Exact installed Playwright AI-mode ARIA snapshot call must be compiled/probed in Wave 0.
- The full repository verify command has a pre-existing architecture-growth blocker documented in `MEMORY.md`; Phase 27 should use exact focused/static gates and report that unrelated residual honestly.
- Shared `SplitWorkbench` consumers may regress if its default behavior changes; source-search inventory and focused consumer tests are mandatory before production edits.

## Sources

### Primary (HIGH confidence)
- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, Phase 27 `CONTEXT.md` and `UI-SPEC.md` — locked scope/contracts.
- `docs/UI-UX-EXECUTION-HARNESS.md`, `docs/UI-UX-MEASUREMENT-PROTOCOL.md` — canonical evidence/verdict process.
- `frontend/tests/ui-audit.spec.ts` — current collector, fixture and viewport seam.
- `frontend/tests/uiSourceOwnershipManifest.ts` — current test-owned ownership seam.
- Warehouse page/panel and shared component/CSS source cited inline — current implementation truth.

### Tertiary (LOW confidence)
- Exact Playwright AI-mode ARIA API call shape is marked `[ASSUMED]` pending local compile probe.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — read from current package/config source; no package changes.
- Architecture: HIGH — mapped directly from current collector and production owner seams.
- Pitfalls: HIGH — major risks are observable source/contract mismatches.

**Research date:** 2026-08-22
**Valid until:** 2026-09-21, or until Warehouse/measurement harness source changes.
