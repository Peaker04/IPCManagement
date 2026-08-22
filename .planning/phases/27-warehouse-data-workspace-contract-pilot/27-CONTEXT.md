# Phase 27: Warehouse Data Workspace contract pilot - Context

**Gathered:** 2026-08-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the evidence-first UI contract architecture on the Warehouse route without building a generic UI framework. The detailed contract covers only the `Luân chuyển` tab: primary current-stock dataset, supporting stock-movement history, tab-level document rail, search, pagination, query states and responsive split. The other two Warehouse tabs participate only in a minimal shell contract for tab semantics, accessibility, keyboard/focus behavior, preserve-visited lifecycle and shell geometry. Admin Data and Purchasing production changes remain outside this phase.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase authority
- `.planning/ROADMAP.md` — Phase 27 boundary, sequence, success criteria and locked follow-on order.
- `.planning/REQUIREMENTS.md` — UIC/WHP requirements and promotion gates.
- `.planning/notes/evidence-first-ui-contract-architecture.md` — Fiori/Carbon mapping, adoption/rejection rationale, schemas and anti-framework guardrails.
- `.planning/research/questions.md` — Purchasing Data Workspace/Workflow question remains research-locked.

### UI contracts and evidence process
- `docs/DASHBOARD-UI-RULES.md` — normative UI, accessibility, responsive and performance rules.
- `docs/UI-PHILOSOPHY.md` — project-specific owners and implementation hierarchy.
- `docs/UI-UX-EXECUTION-HARNESS.md` — evidence-first execution and browser policy.
- `docs/UI-UX-MEASUREMENT-PROTOCOL.md` — existing deterministic measurement gate and verdict semantics.
- `frontend/docs/ipc-design-tokens.md` — current token and component conventions.

### Warehouse implementation
- `frontend/src/features/warehouse/pages/WarehousePage.tsx` — route shell, tab lifecycle, query ownership and integration point.
- `frontend/src/features/warehouse/pages/WarehouseMovementPanel.tsx` — detailed pilot surface and current primary/history/rail layout.
- `frontend/src/components/common/SplitWorkbench.tsx` — current responsive workspace/rail owner.
- `frontend/src/components/common/OperationalFrame.tsx` — canonical route shell.
- `frontend/src/components/common/TableViewport.tsx` — canonical table overflow boundary.
- `frontend/tests/ui-audit.spec.ts` — current Playwright measurement collector and five-viewpoint matrix.
- `frontend/tests/uiSourceOwnershipManifest.ts` — existing test-owned source/owner mapping pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `OperationalFrame`, `ViewSwitcher`, `KeepAliveTabPanel`: existing route-shell, active-tab and preserve-visited seams.
- `SplitWorkbench`: existing dataset/detail-rail layout owner; responsive transformation should extend or verify this seam rather than add a Warehouse-only shell.
- `SectionPanel`, `TableViewport`, `PaginationBar`: current region, table-boundary and pagination owners.
- `DocumentRail`: existing tab-level supporting-document owner.
- `toQueryView`, `InlineAlert`, `EmptyState`: existing query-state and feedback contracts.
- `uiSourceOwnershipManifest`: existing test-owned ownership mapping approach.

### Established Patterns
- Five desktop viewports are canonical; tablet/mobile are not restored by this phase.
- Browser evidence is fixture-based and read-only for structural UI contracts.
- Screenshot is reviewer evidence, while DOM, geometry, focus, console and trace records determine repeatable verdicts.
- Production metadata is a last resort after semantic locator and test/source mappings.

### Integration Points
- Extend the current measurement harness rather than create a second Playwright audit framework.
- Add the Warehouse archetype/region and finding schemas at a test/contract boundary before production refactoring.
- Keep existing RTK Query, route, permission, cache and lifecycle contracts unchanged.

</code_context>

<specifics>
## Specific Ideas

- Playwright capture should combine screenshot, `ariaSnapshot({ mode: "ai", boxes: true })`, bounding boxes, whitelisted computed style, viewport and console/page errors in one evidence manifest.
- The rule engine must run before AI. AI reviews only questions the deterministic layer cannot answer.
- Warehouse proves the architecture; Admin Data later attempts to falsify Warehouse-specific assumptions before anything is promoted shared.

</specifics>

<deferred>
## Deferred Ideas

- Admin Data contract validation is locked until Phase 27 closes.
- Purchasing adoption and Workflow-boundary research remain locked until Admin Data validation completes.
- A broad archetype renderer, UI DSL, generic framework, component-library replacement and redesign mockup are explicitly deferred/out of scope.

</deferred>

---

*Phase: 27-Warehouse Data Workspace contract pilot*
*Context gathered: 2026-08-22*
