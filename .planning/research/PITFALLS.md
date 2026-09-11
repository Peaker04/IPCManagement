# Domain Pitfalls

**Domain:** SAP Fiori visual conformance and evidence intelligence for IPCManagement
**Researched:** 2026-08-02
**Overall confidence:** MEDIUM — design claims are cross-checked against current official SAP sources; project-specific gaps are verified directly in current source. Process controls are clearly marked as inferences.

## Critical Pitfalls

Mistakes that invalidate the conformance claim, permit self-approval, or leave large parts of the approved scope unjudged.

### Pitfall 1: Declaring Floorplans by Visual Resemblance

**Confidence:** HIGH for the failure mode; MEDIUM for SAP pattern interpretation.

**What goes wrong:** A route is labeled “list report”, “worklist”, “object page”, “overview page”, or “analytical list page” because it contains a table, tabs, cards, or KPIs. The declaration then becomes a circular oracle: the implementation is judged against the name chosen to resemble it.

**Why it happens:** SAP floorplans share primitives and often use the dynamic page layout, but they differ by task semantics. A worklist prioritizes processing work items; a list report prioritizes finding and acting across a large filterable dataset; an object page represents one business object; an overview page is a role-specific card hub. Dynamic page is a layout foundation, not a substitute semantic floorplan.

**Consequences:** The judge applies the wrong required regions and interactions, valid screens are “fixed” toward the wrong pattern, and conformance can be declared without satisfying the actual user task.

**Warning signs:** Floorplan rows have no official URL, no “use when / do not use when” rationale, or infer type from component names; every table page is labeled list report; every tabbed page is labeled object page; “dynamic page” is used as the complete declaration.

**Prevention:** Create one canonical registry row per route, tab, nested view, and canonical state. Require an exact SAP page type, official source, task-shape rationale, mandatory regions, allowed variants, and explicit exclusions. Where no named floorplan fits, declare a custom dynamic-page composition and list the SAP controls/patterns it adopts instead of inventing a false floorplan.

**Detection:** Independently review every declaration against current SAP “When to Use” guidance before screenshots are captured. Reject a row if its rationale can be satisfied merely by naming visible widgets.

**Preventing phase/gate:** **Phase 1 — Floorplan Registry; Floorplan Provenance Gate.** Capture cannot begin until the production route set and all tab/nested-view states have approved, source-linked declarations.

### Pitfall 2: Overclassifying KPI-and-Table Screens as Analytical List Pages

**Confidence:** MEDIUM, based on current official SAP ALP guidance.

**What goes wrong:** A dashboard or statistics screen is declared an analytical list page (ALP) solely because it shows KPI cards and a table.

**Why it happens:** “Analytical” is interpreted as a visual style rather than an interaction model. SAP’s ALP supports stepwise analysis, visual and compact filters, chart/table views, chart-to-table interaction, drilldown for root-cause investigation, and access to transactional content or object details. KPIs alone are optional ALP elements, not proof of ALP semantics.

**Consequences:** The registry promises drilldown and interdependent analytical views that the route does not provide. The judge either emits impossible findings or quietly lowers the ALP bar, making the classification meaningless.

**Warning signs:** No interactive chart, no visual-filter/filter-bar switch, no hybrid/chart/table views, no drilldown path, no object-detail or transactional action, yet the route is labeled ALP; a screenshot is cited as the only rationale.

**Prevention:** Make ALP a capability-backed classification. Require evidence for the analytical question, dimensions/measures, filter interaction, drilldown, chart/table relationship, and transactional/detail destination. Otherwise classify the screen as an overview, list report, worklist, dashboard/custom dynamic-page composition, or another pattern supported by its actual task.

**Detection:** An ALP contract test must fail when any mandatory declared capability has no rendered control and exercised interaction in the canonical state.

**Preventing phase/gate:** **Phase 1 — Floorplan Registry; ALP Capability Gate.** Do not defer this distinction to image judging.

### Pitfall 3: Producing Write-Only PNGs

**Confidence:** HIGH, verified in current project source.

**What goes wrong:** A browser run writes PNG files and reports a screenshot count, but no independent process opens each image and records a judgment. The files demonstrate that screenshot APIs ran, not that the UI was visually assessed.

**Why it happens:** Capture is treated as evidence completion. The current headed helper probes routes but takes only the final Admin Statistics screenshot per viewport; its JSON checks route text, API activity, errors, CLS, long tasks, and document overflow, but it does not inspect image content. The existing visual baseline test compares pixels, which also does not establish SAP floorplan conformance.

**Consequences:** Clipping, raw formatting, wrong hierarchy, misalignment, overlap, and incorrect floorplan composition survive a green run. This is the exact class of gap identified in `.planning/PROJECT.md`.

**Warning signs:** PNGs have no judge record; screenshot count is unrelated to the route/tab/state matrix; one screen is captured after many probes; a green JSON aggregate is used as proof that images passed; no image-read timestamp, judge identity/version, rule links, or verdict exists.

**Prevention:** Treat capture and judgment as separate ledgers. Every expected matrix cell must produce one fresh image with a content hash; every image hash must have exactly one independent judge result containing PASS or source-linked findings. A screenshot without a judgment is an error, not neutral evidence.

**Detection:** Compute `expected cells − captured hashes`, `captured hashes − judge inputs`, and `judge inputs − verdicts`; every set must be empty. Also reject duplicate hashes across states unless explicitly dispositioned as genuinely identical.

**Preventing phase/gate:** **Phase 2 — Deterministic Capture; Capture Census Gate**, followed by **Phase 3 — Independent Judge; No-Unjudged-Screenshot Gate.**

### Pitfall 4: Letting Snapshot Baselines Approve Themselves

**Confidence:** MEDIUM, based on official Playwright behavior and direct project usage.

**What goes wrong:** The same actor generates or updates a screenshot baseline and then treats a match against that baseline as approval. Existing defects become “expected”.

**Why it happens:** Playwright generates a reference on first execution and can rewrite references with `--update-snapshots`. Pixel equality answers “did rendering change?”, not “does this conform to SAP Fiori?”. Playwright explicitly recommends version-controlling and reviewing snapshot changes.

**Consequences:** A fixer can bless its own output, intentional visual changes bypass design review, and historical defects become permanent golden files.

**Warning signs:** Baselines are created in the fix command; `--update-snapshots` runs automatically; actual and expected are produced from the same run; no reviewer/judge record exists; a pixel match is the only conformance verdict.

**Prevention:** Freeze baseline inputs before judging, prohibit baseline updates in fixer/rejudge commands, and require independent review for every baseline change. Use pixel comparison as regression evidence only; use the declared SAP contract and actual screenshot as the conformance oracle.

**Detection:** Gate on immutable pre-fix hashes and audit command history/config for snapshot-update modes. Reject a verdict when the expected artifact was created after or by the same fix run.

**Preventing phase/gate:** **Phase 3 — Independent Judge; Baseline Provenance Gate**, retained in **Phase 5 — Fresh Rejudge**.

### Pitfall 5: Leaking Context Between Judge, Fixer, and Rejudge

**Confidence:** MEDIUM. Separation is a project-specific inference supported by Playwright isolation and NIST separation-of-duty principles.

**What goes wrong:** The judge sees the intended fix, source diff, or prior author narrative; the fixer can alter findings or oracle files; the rejudge reuses the fixer’s browser/profile, prompts, screenshots, or assumptions.

**Why it happens:** The workflow is implemented as one mutable script/session rather than four roles with explicit handoffs.

**Consequences:** Confirmation bias replaces independent assessment, findings disappear without remediation, and “fresh rejudge” merely repeats the fixer’s conclusion.

**Warning signs:** Shared mutable working directory or persistent profile; same run ID for capture/judge/fix/rejudge; judge output overwritten in place; rejudge receives the proposed fix explanation; fixer can write registry or baseline files; no immutable finding IDs.

**Prevention:** Use separate contexts and permissions: capture writes images/geometry only; judge reads immutable evidence and writes findings; fixer reads findings but cannot mutate them; rejudge receives the approved registry plus fresh post-fix evidence, not the fixer’s reasoning. Findings close only through a new verdict referencing the original finding ID and new artifact hash.

**Detection:** Verify role-specific input/output manifests, distinct run IDs, fresh browser contexts, immutable hashes, and append-only finding transitions. Any shared mutable evidence path fails the gate.

**Preventing phase/gate:** **Phase 3 — Judge Isolation Gate; Phase 4 — Fixer Write-Boundary Gate; Phase 5 — Fresh-Rejudge Independence Gate.**

### Pitfall 6: Measuring Only Document-Level Overflow

**Confidence:** HIGH, verified in current project source and supported by official Playwright geometry APIs.

**What goes wrong:** `documentElement.scrollWidth <= viewportWidth` is treated as proof of sound geometry. Local clipping, overlap, off-viewport elements, hidden content, nested-scroll failures, and sticky overlays remain invisible.

**Why it happens:** Global overflow is cheap to aggregate. The current headed helper uses document-level horizontal overflow; `ui-audit.spec.ts` adds useful control and tab checks, but this still is not a complete owner/region geometry model.

**Consequences:** The run reports zero overflow while a cell, status, action, filter, dialog, chart label, or table region is clipped or obscured.

**Warning signs:** Only document scroll width is recorded; no bounding boxes by owner/region; no intersection or occlusion checks; nested scroll containers are neither declared nor tested; hidden/ellipsis content is never reconciled with its semantic contract.

**Prevention:** Capture computed geometry for every visible declared region and meaningful control: bounding box, client/scroll dimensions, computed overflow, clipping ancestry, viewport intersection, overlap/occlusion, target size, text line/clamp state, and intended scroll owner. Distinguish legitimate table scrolling from accidental page escape.

**Detection:** Reconcile geometry rows against the floorplan owner manifest and image findings. A judged visual defect with no corresponding measurable region becomes a geometry-coverage defect, not an image-only exception.

**Preventing phase/gate:** **Phase 2 — Geometry Capture; Element/Region Geometry Gate.**

### Pitfall 7: Incomplete Route/Tab/Viewport Evidence Coverage

**Confidence:** HIGH, verified from `AppRouter.tsx`, `routeConfig.ts`, visual tests, and the current headed helper.

**What goes wrong:** Handwritten audit arrays omit production routes, tabs, nested views, roles, or canonical states. A route probe is counted even when its selected tab is never captured.

**Why it happens:** Route lists are copied into multiple scripts. Current visual/audit arrays do not close over every production route (for example `/403` and `/admin/rules`), and the headed helper captures one selected Admin Data tab rather than one image per route/tab state.

**Consequences:** Aggregate counts look plausible while approved scope remains uncovered. New routes or tabs silently bypass conformance.

**Warning signs:** More than one manually maintained route array; no production-to-registry closure test; screenshot names omit tab/state; counts compare only totals, not exact keys; missing, duplicate, orphan, stale, or unjudged cells are not fatal.

**Prevention:** Derive a canonical expected set from production routes plus a test-owned tab/nested-state manifest, then take the Cartesian product with the five desktop viewports declared in `MEMORY.md`. Give each cell a stable key containing route, tab/nested view, state, role/data scenario, and viewport.

**Detection:** Exact-set equality must hold between production scope, registry, capture manifest, geometry manifest, image files, and judge ledger. Totals alone never pass.

**Preventing phase/gate:** **Phase 1 — Scope Closure Gate; Phase 2 — Matrix Completeness Gate; Phase 5 — Permanent No-Gap Gate.**

### Pitfall 8: Capturing Stale or Nonrepresentative Fixture/Data States

**Confidence:** HIGH for project exposure; MEDIUM for the recommended control design.

**What goes wrong:** Screenshots reflect stale browser storage, an old persistent profile, empty catch-all API stubs, mismatched fixture dates, or live data that changed between viewports. The image is reproducible only accidentally or does not represent the declared business state.

**Why it happens:** Visual tests optimize for easy rendering. `visual-routes.spec.ts` fulfills unmatched API calls with empty arrays, while the headed helper uses a persistent profile and current runtime data. Neither mechanism alone proves that every declared canonical state was reached.

**Consequences:** Empty/loading/error states replace intended ready states, old filters select the wrong tab, screenshots across viewports are not comparable, and a later rejudge evaluates a different state. Resetting or seeding the protected database to compensate would violate project constraints.

**Warning signs:** No data-state fingerprint; catch-all empty stubs; persistent local/session storage without a declared snapshot; fixtures use dates unrelated to the declared state; viewport runs see different row IDs/counts; capture manifest lacks API/fixture provenance.

**Prevention:** Define immutable, read-only canonical scenarios with explicit fixture/API fingerprints, selected object IDs, date/week, role/permission, tab, and expected visible anchors. For live-lane evidence, verify lineage and capture API responses without reset/seed/import/restore. Start each capture in an isolated context or explicitly version the approved storage state.

**Detection:** Before screenshotting, assert the scenario fingerprint and visible anchors; after capture, bind the image to API/fixture hashes and selected state. Rejudge must use the same scenario contract with fresh evidence.

**Preventing phase/gate:** **Phase 2 — Deterministic State Gate; Phase 5 — Rejudge State-Equivalence Gate.**

## Moderate Pitfalls

### Pitfall 9: Making Compact Density Inaccessible

**Confidence:** MEDIUM, based on current SAP density guidance and WCAG 2.2.

**What goes wrong:** “SAP compact” is used to justify controls that are hard to target, clipped labels, weak focus indicators, or keyboard-inoperable interactions.

**Prevention:** Apply one consistent app-level density. For mouse/keyboard desktop, compact is appropriate, but still verify keyboard operation, focus visibility/non-obscuration, readable text, and WCAG 2.2 target size or spacing. Do not mix cozy and compact within the same page hierarchy.

**Warning signs:** Density varies by component; icon-only targets are tightly packed; controls fall below 24×24 CSS px without spacing/exception evidence; focus is clipped by sticky regions; row actions require pointer hover.

**Preventing phase/gate:** **Phase 2 — Accessibility Geometry Gate**, with keyboard checks repeated after fixes in **Phase 5**.

### Pitfall 10: Using Noncanonical Table Alignment

**Confidence:** MEDIUM, based on current official SAP responsive-table guidance.

**What goes wrong:** All columns default to left alignment, headers disagree with cells, or IDs are treated as numeric measures. Comparison-heavy operational tables become harder to scan and visibly non-Fiori.

**Prevention:** Encode data-type alignment in the floorplan/table contract: text, IDs, and statuses left; dates/times, numbers, and amounts right (IDs remain left); icons/images/avatars center; headers follow their cell content. Preserve the line-item identifier and key attribute when width is constrained, and use an intentional responsive/nested-scroll strategy rather than squeezing columns unreadably.

**Warning signs:** Amount/date columns left-aligned; ID columns right-aligned; icon headers create large whitespace; header and body alignment differ; CSS selectors align by column position without a semantic data type.

**Preventing phase/gate:** **Phase 1 — Table Semantic Contract**, measured by **Phase 2 — Alignment Geometry Gate** and judged visually in **Phase 3**.

## Minor Pitfalls

### Pitfall 11: Evidence Naming and Provenance Drift

**Confidence:** HIGH as an evidence-control risk.

**What goes wrong:** Artifact names are human-readable but not canonical, so files are overwritten, confused across runs, or detached from source commit, browser, viewport, scenario, and oracle version.

**Prevention:** Use stable matrix keys plus content hashes; keep source paths and hashes in test-owned manifests/evidence index, not in rendered DOM; reject duplicate keys and stale timestamps.

**Warning signs:** Generic names such as `final.png`; mutable `before/after` folders; no source commit or browser version; ledger entries point to paths but not hashes.

**Preventing phase/gate:** **Phase 2 — Artifact Provenance Gate** and **Phase 5 — Evidence Hash Gate.**

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation / Required Gate |
|-------------|----------------|----------------------------|
| 1. Scope and floorplan registry | Wrong floorplan, ALP overclassification, omitted route/tab, table semantics absent | Production-to-registry exact-set closure; official SAP URL and task rationale per row; ALP capability check; table data-type contract |
| 1. DOM ownership instrumentation | Repository/source paths leaked into production DOM | Render opaque owner/region IDs only; resolve IDs to source paths in a test-owned manifest; production DOM and bundle leakage scan |
| 2. Deterministic capture | Stale fixture/profile/data, one screenshot after many route probes | Scenario fingerprints, isolated/versioned state, one hash-addressed PNG per matrix cell, no database reset/seed/import/restore |
| 2. Geometry capture | Document-only overflow creates false negatives; compact density becomes inaccessible | Element/region bounding boxes, clipping/overlap/scroll ownership, keyboard/focus and target-size checks |
| 3. Independent image judge | PNGs are never read; baseline approves itself | No-unjudged exact-set gate; immutable inputs; SAP-rule-linked PASS/findings; baseline provenance review |
| 4. Fixer | Fixer changes behavior or edits oracle/findings | Read-only finding ledger and floorplan registry; production changes limited to verified visual findings; business-behavior regression gate |
| 5. Fresh rejudge | Judge/fixer context leakage; stale or partial re-capture | New browser/run/evidence hashes, same scenario contract, original finding IDs, complete matrix rejudge, no missing/orphan/stale artifact |
| Permanent CI gate | Coverage silently shrinks as routes/tabs are added | Exact production/registry/capture/geometry/judgment set equality; fail on any unjudged screenshot or undeclared route/tab |

## Sources

### Primary design and testing sources

- [SAP Fiori for Web — Floorplan Overview](https://www.sap.com/design-system/fiori-design-web/page-types/floorplan-overview) — current design-system entry point.
- [SAP Fiori for Web — List Report Floorplan](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplans/list-report-floorplan-sap-fiori-element) — task fit for finding/acting on large datasets.
- [SAP Fiori for Web — Worklist](https://www.sap.com/design-system/fiori-design-web/v1-120/page-types/floorplans/work-list/usage) — work-item processing semantics.
- [SAP Fiori for Web — Object Page](https://experience.sap.com/fiori-design-web/object-page/) — single-object semantics and ALP contrast.
- [SAP Fiori for Web — Analytical List Page](https://experience.sap.com/fiori-design-web/analytical-list-page/) — visual filters, view variants, chart/table interaction, and drilldown.
- [SAP Fiori for Web — Content Density](https://www.sap.com/design-system/fiori-design-web/v1-38/foundations/visual/cozy-compact) — compact/cozy usage and consistent app-level density.
- [SAP Fiori for Web — Responsive Table](https://www.sap.com/design-system/fiori-design-web/v1-96/ui-elements/responsive-table/usage) — responsive behavior and alignment by data type.
- [Playwright — Visual Comparisons](https://playwright.dev/docs/test-snapshots) — baseline generation/update behavior, environment stability, and review requirement.
- [Playwright — Best Practices](https://playwright.dev/docs/best-practices) and [Isolation](https://playwright.dev/docs/next/browser-contexts) — independent test state and reproducibility.
- [Playwright — Locator Geometry](https://playwright.dev/docs/api/class-locator) and [Trace Viewer](https://playwright.dev/docs/next/trace-viewer) — bounding boxes, DOM snapshots, screenshots, network, and metadata.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) — keyboard operation, focus, reflow, and pointer target requirements.
- [OWASP WSTG — Review Webpage Content for Information Leakage](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/01-Information_Gathering/05-Review_Webpage_Content_for_Information_Leakage) — risks from HTML metadata, debug information, source maps, and source paths.
- [NIST CSRC — Separation of Duty](https://csrc.nist.gov/glossary/term/separation_of_duty) — supporting principle for independent judge/fixer roles (applied here as a process inference).

### Current project evidence

- `.planning/PROJECT.md` — approved milestone scope and current write-only-image gap.
- `MEMORY.md` — authoritative five-desktop-viewport scope and no-reset/no-seed constraints.
- `frontend/src/routes/AppRouter.tsx` and `frontend/src/lib/routeConfig.ts` — production route source of truth.
- `frontend/tests/visual-routes.spec.ts` — handwritten route/viewport arrays, API stubs, screenshot baseline and direct PNG capture behavior.
- `frontend/tests/ui-audit.spec.ts` — current document/control/tab geometry checks.
- `.artifacts/shipyard-live/live-visual-audit.mjs` — current headed route probing, persistent profile, document-overflow measurement, and final-screen screenshot behavior.

## Research Gaps

- SAP’s design site is migrating from `experience.sap.com` to `sap.com/design-system`; the implementation phase should pin the exact current canonical URL/version stored in each floorplan row and fail link checks on redirects to missing content.
- The final judge schema, model/version policy, and acceptable visual tolerance need phase-specific design. No numeric pixel tolerance should be invented from generic guidance.
- Canonical data scenarios per route/tab must be derived from current product state without mutating the protected database lane.
