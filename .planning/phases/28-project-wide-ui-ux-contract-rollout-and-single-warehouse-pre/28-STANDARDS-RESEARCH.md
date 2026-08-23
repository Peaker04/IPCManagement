# Research: Enterprise UI/UX standards for dense operational dashboards

## Summary
Dense operational dashboards should optimize scanability and task completion rather than maximize the number of visible widgets: establish a stable page hierarchy, use a tokenized spacing/type system, reserve cards for genuinely grouped content, and use semantic data tables with deliberate responsive alternatives. WCAG 2.2 supplies the normative accessibility floor; SAP Fiori, IBM Carbon, Atlassian, Shopify Polaris, and web.dev provide implementation patterns. For a single-warehouse product, remove warehouse selection from the routine workflow and show warehouse identity once as passive context, while preserving scope in exports, audit records, URLs, and APIs.

## Findings

1. **[High] Accessibility is the release gate, not a visual preference.** Target WCAG 2.2 AA. Automated checks should assert: text contrast `>= 4.5:1` (or `>= 3:1` for large text); non-text UI/focus indicators `>= 3:1`; keyboard operation without traps; visible focus not fully obscured; targets at least `24×24 CSS px` or meeting the spacing/equivalent exceptions; no information conveyed by color alone; reflow at `320 CSS px` width without two-dimensional scrolling except content that genuinely requires it (data tables qualify); status updates exposed programmatically without moving focus; and accessible names matching visible labels where labels exist. WCAG’s `24×24` target criterion is AA, while `44×44` is the stronger AAA target and should not be misrepresented as an AA requirement. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) [Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) [Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

2. **[High] Use semantic, testable table structure for operational data.** Render real `<table>`, `<thead>`, `<tbody>`, `<th scope="col|row">`, and `<caption>` (or an equivalent programmatic label); associate sortable state with `aria-sort` on the active header; preserve keyboard access to all interactive controls; announce asynchronous result/status changes. Do not add ARIA roles when native HTML already supplies the semantics. A machine check should fail if a data grid is built only from generic `div` elements without a complete, tested ARIA grid interaction model. [W3C Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/) [ARIA Authoring Practices: Table](https://www.w3.org/WAI/ARIA/apg/patterns/table/) [ARIA Authoring Practices: Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)

3. **[High] Dense tables need deliberate responsive behavior, not universal column stacking.** Assign every column a priority: `essential`, `secondary`, or `detail`. At narrow widths, keep essential identifiers/status/actions, hide secondary columns behind a user-invoked disclosure, and move long detail into a row detail view; retain horizontal scrolling for genuinely tabular comparisons rather than crushing values or turning every cell into an unlabeled card. Make the scroll region keyboard-focusable and labeled. Test at 320 CSS px and at the application’s declared breakpoints: no page-level horizontal overflow; table-region overflow is allowed only when documented as essential under WCAG reflow. SAP explicitly distinguishes responsive tables (few columns, mobile) from grid/analytical tables (desktop, many columns), and recommends limiting columns for responsiveness. [SAP Fiori Table Overview](https://experience.sap.com/fiori-design-web/table-overview/) [SAP Responsive Table](https://experience.sap.com/fiori-design-web/responsive-table/) [WCAG Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

4. **[Medium] Establish one unambiguous information hierarchy.** A recommended testable page order is: one `h1`; passive scope/context; critical status and exceptions; primary actions; key metrics; filters; primary operational table; supporting detail. Heading levels must not skip for styling purposes, and each region should have an accessible name. Keep the primary action visually unique; demote or place infrequent actions in an overflow menu. SAP’s dynamic page pattern formalizes a title/header/content hierarchy, while Carbon recommends hierarchy through type, spacing, and layout rather than decorative containers. [SAP Dynamic Page](https://experience.sap.com/fiori-design-web/dynamic-page-layout/) [Carbon UI Shell/Page Structure](https://carbondesignsystem.com/components/UI-shell-header/usage/) [W3C Headings](https://www.w3.org/WAI/tutorials/page-structure/headings/)

5. **[Medium] Use a spacing scale and density modes; prohibit arbitrary local spacing.** Adopt a documented token scale based on a 4 px sub-grid (for example `4, 8, 12, 16, 24, 32, 48`) and permit only token values in product CSS except documented one-off geometry. Use smaller gaps within a group and larger gaps between groups. If the product offers compact density, change it at the component/system level—especially row height and control padding—not by ad hoc negative margins. A stylelint/custom AST rule can reject raw margin/padding/gap values outside tokens. Carbon’s 2x Grid uses a 16 px base with mini-units, and Atlassian exposes spacing as semantic design tokens; these are system-specific implementations, not universal WCAG mandates. [Carbon 2x Grid](https://carbondesignsystem.com/guidelines/2x-grid/overview/) [Carbon Spacing](https://carbondesignsystem.com/elements/spacing/overview/) [Atlassian Spacing](https://atlassian.design/foundations/spacing/)

6. **[Medium] Typography should favor tabular scanning.** Use a small, finite token set for page title, section title, body, label, and helper text; do not encode hierarchy solely with font size or weight. Recommended product checks: body text `>= 14 CSS px` in dense desktop UI, critical explanatory text `>= 16 CSS px`, line-height `>= 1.4` for prose, and no clipped text at 200% text zoom. Use tabular numerals (`font-variant-numeric: tabular-nums`) and right alignment for comparable numeric table columns; keep units in headers or consistently beside values. The numeric thresholds above are product recommendations—not WCAG font-size requirements; WCAG instead requires resize/reflow and contrast. [Carbon Typography](https://carbondesignsystem.com/elements/typography/overview/) [Atlassian Typography](https://atlassian.design/foundations/typography/) [WCAG Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)

7. **[Medium] Cards are optional grouping containers, not the default surface for every datum.** A card should have one purpose, a clear title, and a coherent content/action group. Avoid cards nested in cards, repeated borders/shadows, or converting each table row into a desktop card. Machine-testable product rules can cap nesting depth at one, require every card region to have an accessible name, and flag adjacent cards whose only content is a label/value pair that could be a compact metric group. Carbon cautions that contained components should group related information and actions; Polaris cards similarly represent a single topic. [Carbon Contained List](https://carbondesignsystem.com/components/contained-list/usage/) [Shopify Polaris Card](https://polaris.shopify.com/components/layout-and-structure/card)

8. **[High] Filters, sort, selection, and bulk actions must remain understandable under density.** Label every input; keep filter state visible; provide an explicit clear/reset mechanism; report result counts/status changes; maintain selection across only the documented scope; and place bulk actions adjacent to the selection summary. Tests should verify keyboard-only filter/apply/clear/sort/select flows, accessible names, `aria-sort`, focus retention after updates, and an announced result count. Avoid placeholder-only labels. [Carbon Data Table](https://carbondesignsystem.com/components/data-table/usage/) [W3C Form Labels](https://www.w3.org/WAI/tutorials/forms/labels/) [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

9. **[Medium] Responsive design must follow content breakpoints and preserve task priority.** Do not infer “mobile” from a device name. Let layout change where content ceases to fit: multi-column metric groups collapse; secondary actions enter overflow; nonessential table columns disclose into row details; sticky regions must not obscure focused elements. Validate at minimum 320 CSS px, 200% zoom, landscape/portrait where supported, and browser text-only zoom. Use CSS container/media queries and intrinsic layout rather than JavaScript user-agent branching. [web.dev Responsive Design](https://web.dev/learn/design/) [web.dev Responsive Images/Layout](https://web.dev/articles/responsive-web-design-basics) [WCAG Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

10. **[High] Simplify the single-warehouse context by removing false choice, not by erasing scope.** If an authorized user can operate exactly one warehouse, do not show an enabled warehouse picker or require a warehouse-selection step. Display warehouse name/code once in the page context (and on confirmation for destructive or irreversible operations); bind the warehouse server-side from authorization/session context rather than trusting an editable hidden client field. Preserve warehouse ID/name in exports, print views, audit events, deep links where needed, and API authorization checks. A machine test should assert: one permitted warehouse → no interactive selector and correct passive label; multiple permitted warehouses → labeled selector; zero → blocked empty/error state; tampered warehouse ID → server rejection. This is a task-simplification recommendation inferred from progressive disclosure and error-prevention principles, not a WCAG requirement. [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) [WCAG Error Prevention](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)

11. **[Medium] Loading, empty, error, and stale-data states are first-class dashboard states.** Every data container should define: initial loading without layout shift, no-results (filters active), truly empty (no records yet), partial/error with retry, and stale/last-updated state. Automated tests should assert these states do not remove the table’s accessible name, errors are programmatically associated with the affected region/control, and live updates do not unexpectedly steal focus. [Carbon Data Table](https://carbondesignsystem.com/components/data-table/usage/) [Shopify Polaris Empty State](https://polaris.shopify.com/components/feedback-indicators/empty-state) [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

## Actionable verification matrix

| Area | Automated assertion | Suggested severity |
|---|---|---|
| Page hierarchy | Exactly one visible `h1`; headings have nonempty names and logical levels | Medium |
| Contrast | axe-core WCAG 2.2 AA plus token-level contrast tests | High |
| Keyboard/focus | All actions reachable; no trap; focus visible and not obscured | High |
| Targets | Interactive target or spacing satisfies WCAG 2.2 SC 2.5.8 exceptions | High |
| Tables | Native table semantics or fully tested ARIA grid; labeled; headers scoped; active sort has `aria-sort` | High |
| Reflow | At 320 CSS px, no page-level two-axis overflow; documented table exception only | High |
| Zoom | At 200% text zoom, content/actions remain available and unclipped | High |
| Tokens | No undeclared color/type/spacing literals in component styles | Medium |
| Cards | Accessible name; no nested cards; one coherent purpose | Low/Medium |
| Filters | Persistent labels, clear/reset, announced result status, focus retained | High |
| Single warehouse | No false selector; passive scope visible; server rejects scope tampering | High |
| Async states | Loading/empty/error/stale states covered; no unexpected focus movement | Medium |

## Caveats

- WCAG is normative for accessibility conformance; Carbon, Fiori, Atlassian, and Polaris are product design systems. Their exact pixels, breakpoints, and component rules should not be mixed indiscriminately. Choose one host system and translate the principles into local tokens.
- “Dense” must not mean targets below WCAG minimum, hidden focus, illegible text, or removal of necessary labels. Compact density is safest for pointer-heavy desktop workflows only when keyboard and target-size requirements still pass.
- A wide operational table may use WCAG’s essential two-dimensional-layout exception, but the exception should be documented per table; it is not permission for the whole page to overflow.
- ARIA grids impose substantial keyboard interaction obligations. Prefer native tables unless cell-level navigation/editing genuinely requires a grid.
- The one-warehouse recommendation assumes authorization truly limits the user to one scope. Do not remove explicit context from audit-sensitive actions or weaken server-side tenant/warehouse enforcement.

## Sources

### Kept
- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) — normative accessibility requirements.
- [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/) — primary semantic-table guidance.
- [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) — primary interaction patterns and caveats for table/grid widgets.
- [SAP Fiori Table Overview](https://experience.sap.com/fiori-design-web/table-overview/) and [Responsive Table](https://experience.sap.com/fiori-design-web/responsive-table/) — enterprise operational table selection and responsiveness.
- [SAP Fiori Dynamic Page](https://experience.sap.com/fiori-design-web/dynamic-page-layout/) — enterprise page hierarchy pattern.
- [IBM Carbon Design System](https://carbondesignsystem.com/) — primary enterprise spacing, typography, and data-table guidance.
- [Atlassian Design System](https://atlassian.design/) — primary tokenized spacing/type guidance for dense work-management UIs.
- [Shopify Polaris](https://polaris.shopify.com/) — primary card and empty-state component guidance.
- [web.dev Learn Design](https://web.dev/learn/design/) — first-party web-platform responsive design guidance.
- [Nielsen Norman Group: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — established usability rationale for removing infrequent/irrelevant controls from the primary flow.

### Dropped
- Generic dashboard-template galleries — visual examples without normative or testable rationale.
- SEO “best dashboard design” roundups — secondary, frequently unsourced, and often optimized for marketing dashboards rather than operational work.
- Framework-specific table libraries — implementation choices, not authoritative standards; evaluate only after interaction and accessibility requirements are fixed.

## Gaps

Live web retrieval was not available in this execution environment, so URLs and guidance are based on the publishers’ canonical documentation locations and should be link-checked before being frozen into project policy. No primary source defines a universal minimum body font size, universal dashboard breakpoint, maximum card count, or mandatory 4/8 px spacing grid; those must remain local, testable product decisions. The best next step is to map these rules onto the project’s existing tokens/components and run axe-core, keyboard, 320 px reflow, 200% zoom, and server-side warehouse-scope tests.

## Review findings

- **High — `research.md` — accessibility/reflow/table/single-warehouse rules:** treat the High items above as release-blocking when implementing or reviewing an operational dashboard.
- **Medium — `research.md` — hierarchy/tokens/type/responsive/state rules:** enforce through component contracts, visual/DOM tests, and style linting.
- **Residual risk:** source pages were not live-fetched in this run; links and version-specific component wording require a final link check. Product-specific thresholds (font size, breakpoints, card linting) are recommendations rather than standards.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "review-findings: research.md contains concrete High/Medium findings and a machine-testable verification matrix; residual-risks: Gaps and Review findings identify source-link and product-threshold caveats."
    }
  ],
  "changedFiles": [
    "research.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "Live web search/link validation",
      "result": "not-run",
      "summary": "No web-search or web-fetch tool was available in this execution environment."
    }
  ],
  "validationOutput": [
    "Research brief includes authoritative URLs, severity-tagged findings, machine-testable assertions, caveats, dropped sources, and residual risks."
  ],
  "residualRisks": [
    "Canonical source URLs and current page wording were not live-validated.",
    "Local font, breakpoint, density, and card thresholds require product validation because no universal standard mandates them."
  ],
  "noStagedFiles": true,
  "diffSummary": "Created research.md only; no production or test files changed.",
  "reviewFindings": [
    "high: research.md - WCAG AA, table semantics, reflow, keyboard/focus, and server-enforced warehouse scope should be release gates.",
    "medium: research.md - hierarchy, spacing/type tokens, card discipline, responsive priority, and async states should be component-level quality gates."
  ],
  "manualNotes": "The requested artifact was written to the authoritative runtime path. No application files were edited."
}
```
