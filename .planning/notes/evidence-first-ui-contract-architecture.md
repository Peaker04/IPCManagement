---
title: Evidence-first UI contract architecture research
context: Whole-project UI refactor process; Warehouse Data Workspace pilot
created: 2026-08-22
status: adopted-research-input
---

# Evidence-first UI contract architecture

## Decision

IPCManagement preserves its current visual identity by default. A visual language or design-system change is allowed only when audit evidence proves inconsistency, accessibility failure, broken responsive behavior, fragmented ownership, or a shared root cause that cannot be corrected safely at the existing owner.

- Implementation foundation remains **shadcn/Base UI**.
- **SAP Fiori** is the primary enterprise UX and information-architecture reference.
- **Carbon** is the secondary reference for data-intensive patterns.
- Reference systems supply reasoning and patterns, not component libraries or copied visual styling.
- Every adopted pattern must become an IPCManagement token, existing-owner component contract, page-archetype rule, or Playwright contract.

## Contract architecture

```text
Design intent
  ├─ Semantic/IA contract
  ├─ Layout/responsive contract
  ├─ Component ownership contract
  └─ Interaction/accessibility contract
                ↓
Playwright evidence collector
  ├─ screenshot (reviewer artifact)
  ├─ ariaSnapshot({ mode: "ai", boxes: true })
  ├─ bounding boxes and whitelisted computed styles
  ├─ viewport, route, state and actor
  └─ console/network/trace when applicable
                ↓
Deterministic rule engine
                ↓
Read-only AI reviewer
                ↓
Schema-valid evidence-based findings
                ↓
Vertical-slice refactor and fresh comparison
```

Playwright is the evidence collector, the design contract is the law, and AI is the reviewer. A screenshot is never an independent PASS/FAIL oracle.

## Page-archetype mapping

| IPC archetype | SAP Fiori reference | Carbon reference | IPCManagement adoption |
|---|---|---|---|
| Dashboard | Overview/analytical page patterns | dashboard/grid and status patterns | operational questions, Metric regions and exception/action queue; no decorative chart gallery |
| Data Workspace | List Report and Worklist | data table, table toolbar, filtering and batch action | header → Toolbar → active filters → Table → pagination/detail rail |
| Entity Detail | Object Page and Dynamic Page | structured detail and content switching | stable identity/lifecycle header, section landmarks, contextual actions and progressive disclosure |
| Workflow | Worklist, flexible-column and task/process patterns | progress, inline notification and side panel | work queue → selected object → decision surface → evidence/history; no forced wizard for non-linear work |
| Settings/Form | form and Object Page edit patterns | form grouping, validation and inline notification | one H1, headed field groups, validation near fields, action boundary and dirty-state protection |

## Adoption rationale

Adopt:

- explicit page intent and region semantics;
- stable title, context and action hierarchy;
- list-report/worklist distinction;
- toolbar, filter, table, selection and batch-action ownership;
- progressive disclosure and master-detail where context must persist;
- semantic landmarks, heading hierarchy and responsive priority rules;
- dense enterprise presentation that preserves anomaly detection and accessibility.

Adopt only with evidence:

- sticky/dynamic headers only when geometry and focus checks prove they do not obscure content;
- master-detail only when preserving list context is necessary;
- charts only when tied to a decision question;
- hover row actions only with an equivalent keyboard path;
- compact density only while target size, focus and readability remain valid.

Reject:

- replacing shadcn/Base UI with SAP UI5 or Carbon components;
- copying Fiori/Carbon colors, typography, icons or spacing;
- introducing parallel `DynamicPage`, `ObjectPage` or `DataWorkspacePage` frameworks;
- forcing one floorplan across all routes;
- treating screenshots, pixel equality or AI taste as truth;
- allowing AI to invent tokens, component rules or automatic fixes;
- promoting a shared abstraction from a single route.

## Minimal contract schema

```ts
type PageContract = {
  schemaVersion: 1
  routeId: string
  archetype: 'dashboard' | 'data-workspace' | 'entity-detail' | 'workflow' | 'settings-form'
  intent: {
    workObject: string
    primaryUserQuestion: string
    primaryAction: string | null
    grain: string
  }
  semantics: {
    requiredLandmarks: LandmarkContract[]
    headingOrder: HeadingContract[]
    accessibleNames: AccessibleNameContract[]
    stateVocabularyOwner: string
  }
  regions: RegionContract[]
  responsive: {
    viewports: string[]
    priorityOrder: string[]
    invariants: ResponsiveInvariant[]
    allowedTransformations: string[]
    forbiddenTransformations: string[]
  }
  accessibility: {
    standard: 'WCAG-2.2-AA'
    keyboardPaths: KeyboardPath[]
    focusRules: FocusRule[]
    liveRegions: LiveRegionRule[]
  }
  evidence: {
    screenshot: true
    ariaSnapshot: { mode: 'ai'; boxes: true }
    geometry: GeometryProbe[]
    computedStyle: StyleProbe[]
    console: 'always'
    trace: 'on-failure-or-performance'
  }
}

type RegionContract = {
  id: string
  role: string
  owner: string
  componentFamily: 'Metric' | 'Toolbar' | 'Table' | 'Alert' | 'Detail' | 'WorkflowAction' | 'FormSection'
  required: boolean
  allowedChildren: string[]
  geometryRules: string[]
  responsiveRules: string[]
}

type UiFinding = {
  findingId: string
  routeId: string
  archetype: PageContract['archetype']
  viewport: string
  state: string
  actor: string
  ruleId: string
  source: 'rule-engine' | 'ai-review'
  category: 'semantic' | 'layout' | 'component' | 'responsive' | 'accessibility' | 'hierarchy' | 'grouping' | 'balance' | 'information-architecture'
  evidence: {
    screenshot?: string
    ariaSnapshot?: string
    selectors: string[]
    boxes?: Record<string, Geometry>
    metrics?: Record<string, number | string>
    trace?: string
  }
  expected: string
  actual: string
  severity: 'blocker' | 'high' | 'medium' | 'low'
  componentOwner: string
  suggestedOwnerLevel: 'token' | 'primitive' | 'shared-component' | 'layout' | 'route'
  confidence: number
  verdict: 'FAIL' | 'NEEDS_EVIDENCE' | 'UNRESOLVED'
}
```

AI output missing evidence, expected, actual, severity or component owner is invalid and must be rejected before planning.

## Rule-engine and AI boundary

Deterministic rules own missing/multiple H1, heading order, landmark/name defects, document overflow, overlap, clipping, sticky obstruction, approved-token spacing, minimum targets, region/component mismatch, primary-action count, responsive invariants, console errors and dialog accessibility/focus contracts.

AI reviews only hierarchy, grouping, visual balance, information architecture and archetype fitness. AI remains read-only and cannot auto-fix or create a contract from taste.

## Migration order

1. Inventory route → archetype, work object, state, actor, viewport and current owner.
2. Implement only the schema and probes required by the Warehouse pilot.
3. Capture Warehouse evidence and run deterministic rules before AI review.
4. Refactor only evidence-backed Warehouse findings, then run build → structural → accessibility → screenshot → responsive → AI review.
5. Validate the same contract on Admin Data without creating route-specific exceptions or a framework.
6. Promote shared contracts only when Warehouse and Admin Data prove the same need.
7. Keep Purchasing deferred until Admin Data validation closes the Data Workspace boundary and the open Workflow-semantics research question is resolved.

## Anti-framework guardrails

- No generic page renderer, DSL or broad component registry.
- No new component family when an existing owner can carry the contract.
- No abstraction is promoted from Warehouse alone.
- No production refactor before a reproducible finding exists.
- No baseline or threshold update to hide a finding.
- Pilot success is reproducible evidence and a green regression contract, not abstraction count or visual novelty.
