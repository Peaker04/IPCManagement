# MRX Production Qualification — Five-User Release Design

## Intent and authority

Qualify the existing MRX workflow for **five simultaneously active users** on laptop/desktop. Stop module expansion. Reproduce operational failures through the actual web interface, repair proven defects at existing owners, and simplify ERP presentation without replacing the product or its design system.

Owner decisions:
- MRX only (`MATERIAL_RECONCILIATION`), not DEFAULT; no mobile/mobile-web qualification.
- Isolated clone from read-only `ipcmanagement`, private local web/API, business-flow test-data creation and exact run-owned cleanup authorized by `cho phép`.
- Peak workload is five simultaneous users, supplied by `chỉ 5 người`.
- No implicit deployment, main writes, commit/push, package installation, new worktree or delegation.

This design was **approved by Owner (`duyệt`)**. The test parameters below define the approved scope, not execution evidence. `.planning/WORK.md` alone owns task status; this document is the test-design contract.

## Approaches and selected direction

The preceding discussion proposed reuse of the existing runner, Playwright and installed k6, with actual lifecycle/persistence proof, measured performance and minimal FE fixes. This is the recommended direction under the agreed scope:
1. **Reuse and repair existing evidence owners:** preserves clone/cleanup fences and existing behavior coverage; requires removing vacuous assertions and DEV-only measurement assumptions. Recommended.
2. **Audit-only/report-only:** cheaper, but cannot prove mutation, concurrency, durable stock effects or memory stability; insufficient for the requested release decision.
3. **New test platform or module redesign:** duplicates current tools and enlarges risk; rejected by the scope freeze.

No new orchestration framework, business module, production telemetry endpoint, generic test-only export or design-system family is part of this work.

## Canonical contracts and source findings

Authority: `docs/DOMAIN.md`, `docs/domain/material-reconciliation.md`, `docs/FLOWS.md`, `docs/DESIGN.md`, `docs/ENGINEERING.md`, `docs/OPERATIONS.md`, `tools/perf/RUNBOOK.md` and relevant source/DTOs.

Requirements: FR-MENU/WH/CHEF/RECON/REP and only MRX-exposed supporting catalog/auth; DOM-MODE-1, BR-MRX-EDIT-1–9, BR-MRX-SERV-1–2, BR-MRX-TRUTH-1–2, BR-MRX-HIST-1–2, NFR-PERF-01/02, NFR-REL-01, NFR-SEC-01, NFR-UI-01–05 and UXR-01–05.

Existing owners to extend rather than duplicate:
- `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` and `MrxEvidenceSafety.ps1`: exact source/absent clone/subordinate ownership, manifests, migration/query evidence and independent cleanup.
- `frontend/tests/e2e-mrx/{core,fixtures,specs}`: real role sessions, MySQL oracle, G1–G6 and source-edit lifecycle.
- `frontend/scripts/perf-probe*.mjs`, `tools/perf/k6/*`: measurement primitives and authenticated HTTP diagnostics, not an authority for MRX routes or fake data.
- Existing route registry, MRX workbenches, shared primitives, `styles/index.css` and owner contract tests: production behavior/presentation.

Observed harness gaps (not claims of reproduced production defects):
- G3 supplemental/disposition tests can merely open/cancel dialogs; G5 overdue SQL timestamp manipulation does not test automatic closure.
- `globalSetup.ts` currently launches DEV Vite/debug API and deletes a fixed golden week with FK checks disabled.
- Role contexts hardcode 1440×900; config-only viewports do not cover those contexts. Auth helper writes local mode/version and has no separate Manager fixture.
- Generic perf defaults include `mock=huge`, stale/non-MRX targets and unbounded observer arrays; do not run that configuration as live MRX qualification or let measurement instrumentation create the apparent leak.
- Installed k6 is available. `dotnet-counters` and `dotnet-gcdump` were not found on PATH; do not silently install them or invent managed-heap evidence.
- Impeccable resolves `frontend/PRODUCT.md` with inherited `docs/DESIGN.md`; canonical T8 is locked despite stale wording in PRODUCT. No taste-named skill was found in searched installed locations. No implicit install or false claim of invoking it.

## Environment, data and cleanup

1. Bind run ID, checkout plus working-tree/source identity, built FE/API artifact identity, server UUID/DB/history, MRX mode/version, actual actor permissions, dataset cardinalities and browser version. HEAD alone cannot identify this dirty checkout.
2. Source remains read-only. Create only absent `ipc_mrx_evidence_<run-id>` and approved exact subordinate names already supported by the runner. Reject pre-existing/mismatched targets. Prepared Playwright never clones/drops independently.
3. Use one runner lifecycle for setup, phases and finalization. Do not copy/paste privileged clone commands into tests. Do not run legacy fixed-sandbox reset/drop paths.
4. Preserve the cloned historical dataset. Find an unused customer/week/business scope and create new documents through actual supported import/UI/API operations; retain run-bound document identities for assertions. Do not delete a golden week, disable FK checks, fabricate completed receipts/lineage or directly update protected business records to make a case pass.
5. Fixture workbooks may be created/populated only for this authorized test scope, with schema-compatible declared test values. Keep private input workbooks local; do not publish raw customer, recipe, credential or stock data. Master/start-stock bootstrap is separately declared in clone evidence, never claimed as browser-created business history. If a prerequisite requires DEFAULT workflow, stop that scenario rather than switch modes.
6. Build FE static assets and API Release once per candidate; serve the assets against the clone API using supported private runtime configuration. Validate actual served mode and network destination; `vite dev`, mocked login/data or an old API binary cannot qualify release performance. Preserve production authentication/rate-limiting/security behavior; no startup migration or seed.
7. Dedicated headed Chrome, fresh separate profile/contexts; no user tabs/profile reuse. Confirm credential sources privately and verify actual authenticated identities/permissions. Do not infer Manager evidence from Admin or localStorage. If a required role is unavailable, its gate is BLOCKED rather than passed by a substitute.
8. Clone shares MySQL resources with main. No saturation/stress, server-global diagnostics, restart or configuration mutation. Sample existing host headroom before and during the bounded five-user run; stop if health fails, connection/resource exhaustion appears or baseline host contention makes results uninterpretable. On suspected shared-server contention stop the run and report; do not increase load to force a number.
9. Capture permitted source before/after fingerprints and exact cleanup evidence. External source drift is not permission to restore it; stop and identify the discrepancy. In independent `finally` steps stop only run-owned processes/listeners and remove exact owned clone/subordinate/private dump/defaults/temp. Any cleanup failure is BLOCKED_CLEANUP, regardless of test success. Never prune retained encrypted backups.

## Behavioral acceptance lanes

Each contract has one primary owner test. Extend existing cases instead of copying the same matrix across unit/API/browser layers. MySQL business evidence and a real user-visible denial are distinct from unit policy coverage. No conditional no-op assertions, `test.skip`, exemption padding, component-under-test mocks or API success fallbacks.

| Lane | Actual web behavior and operational alternatives | Independent outcome |
|---|---|---|
| Source/readiness | Import/select menu, missing/invalid file recovery, missing split servings/BOM, fix prerequisites, preview, approve/reject/direct change, reimport | Correct variants/grains and quantities; required reasons/permissions; persisted import/menu/revision evidence after reload |
| Handoff | Draft → READY → transfer → daily operations; inspect partial/blocked states and repeated commands | Correct owner/status/version, canonical batch identity and frozen lineage; no duplicate batch/receipt |
| Source versus issue | Edit open dates; attempt locked/completed edits; source apply races first issue; stale browser scope | One valid winner; atomic losing branch; locked dates unchanged; draft preserved and actionable conflict |
| Warehouse | Initial manual actual quantities, positive completeness/retained-zero lines, convertible units, stock/lot shortage, supplemental issue, coordinated issue for shared ingredients | Exact issue-line/provision identity; correct physical stock/lot/movements; all-or-nothing group and retry semantics |
| Kitchen/returns | Exact authorized acknowledgement/cooking/export/return actions actually exposed by MRX; pending versus received returns | Preserve actual domain authority; net issued subtracts only received linked returns; no invented kitchen step or DEFAULT entry |
| Reconciliation | Shortage, equal issue, overage, accepted variance, repeated correction, source/ledger invalidation, complete/reload | Shortage cannot be waived by disposition; retained predecessor + one active winner; completion requires evidence; actual nonzero accepted variance remains truthful |
| Reports/history | Daily/weekly/completed detail, typed audit, pagination/filter/scope and CSV/export/cancel | Persisted exact notes/IDs, readable legacy evidence without guessed assignments, bounded page reads and full scoped export equality |
| Authorization | Five separate identities: Coordinator, Storekeeper, Head Chef, Manager, Admin; appropriate allowed/denied navigation/action/deep-link/API paths | Real bearer/middleware authorization and no extra effects; no role substitution or permission weakening |
| Recovery/concurrency | Two clients on same aggregate; double-click; retry after lost response; offline before submit; expire session; navigate/back/reload with unsaved draft | Zero duplicate stock/decisions; distinguish committed-but-response-lost from not committed; honest UI and correct draft recovery |

Successful paths use real backend responses. Fault injection may delay/drop a real request or response at the transport boundary and must be labeled; never fabricate successful business payloads. When an expected conflict/401/403 occurs, assert its exact intended reason and no unintended side effects, not merely an HTTP status.

After every mutation checkpoint assert control → request/response (or recorded response-loss point) → persisted status/version/lineage/stock changes → reload/read projection. Expected quantities derive independently from declared inputs and linked issues/received returns, not from the same projection being tested. SQL is read-only for the business oracle; setup bootstrap must be clearly separated and authorized.

## Five-user performance and endurance proposal

These are proposed engineering parameters, not additional Owner-provided facts:
- One functional smoke/lifecycle run first. Collect idle host/process/DB baselines and warm up before measuring.
- Five authenticated, separate role sessions on the web. Keep work actively circulating across source, warehouse, kitchen, reconciliation and review/report tasks; natural 2–5 second think time is a declared model, not claimed measured user behavior. Use distinct fresh document scope for repeated terminal operations. Include controlled same-document contention as its own labeled scenario.
- Run a **60-minute five-user endurance pass**, with per-minute resource/error samples and early/middle/late comparable checkpoints. This is a bounded endurance qualification, not an entire work-shift or five-year-volume certification. Longer runs are conditional on evidence, not automatic expansion.
- Browser workflow phase and HTTP k6 phase run separately; do not accidentally add five VUs to five browser users and call the result five users. k6 diagnostic ceiling is five authenticated VUs with defined safe MRX read/report requests. This HTTP phase is not proof of concurrent business writes; those belong to real browser sessions.
- Report achieved distinct active sessions, duration, completed workflow/action counts, request rate, think time, data/response sizes and per-class latency/error/timeout/conflict/429 counts. Five requests or idle logged-in sessions are not five active users. Do not suppress rate-limit failures or retry them invisibly.
- Separate cold full navigation, warm navigation and interaction measurements. At least 20 measured observations per compared representative action/class; report sample counts and small-sample limitations. Do not combine sparse write timings into a percentile that hides a slow report/import. Missing samples are NEEDS_EVIDENCE.
- Keep instrumentation bounded and avoid retaining DOM nodes, responses, every frame or screenshots indefinitely. Detailed traces/heap snapshots are captured in separate diagnostic repetitions, not used to claim uninstrumented latency.

Existing acceptance budgets remain authoritative:
- NFR-PERF-01: p75 API ≤300ms, initial FE frame <100ms and screen data complete <1s, with measurement start/end declared for reproducibility.
- DESIGN F1–F6: p75 lab LCP ≤2.5s, interaction latency target ≤200ms; CLS ≤0.1 (initial-load skeleton target ≤0.05 where applicable).
- Tools/perf diagnostic budgets: list p95 <800ms, search <500ms, grouped list <1s, report <3s, individual query <1s. These are diagnostic review budgets, not replacement product SLOs.
- Report p95/p99 as supporting diagnostics with sample sizes. Expected denial/conflict scenarios remain visible and separated from unexpected 5xx/timeouts; unexpected correctness/data-integrity failures block release regardless of average speed.
- Lab Event Timing/interaction measurements are not field INP/CrUX certification. Record unsupported metrics as unavailable, not zero. Local-host results qualify only the measured environment and dataset; deployment-host verification remains distinct.

## Memory diagnostics

FE: on a warmed reference scope repeat at least 30 cycles of route changes, scope/filter changes, dialog open/close, cancel/Escape and report/export cancellation. At cycle 0/10/20/30 settle outstanding work and compare post-GC heap snapshots through installed Chrome/CDP, including retained-object paths and detached DOM. Collect DOM/listener/document counts as supporting evidence, not universal fixed thresholds. Close all run-owned contexts and check cleanup. Compare equivalent settled states and account for bounded caches and instrumentation retention; heap size alone is not a leak diagnosis.

BE/host: sample API working set/private bytes, handles/threads, health, request failures and existing DB connection observations through the endurance run and recovery idle period. Do not equate process RSS with managed retained heap. If a sustained-growth suspicion needs allocation/root analysis unavailable through installed tools, record NEEDS_EVIDENCE and seek narrowly scoped tool authorization rather than add production seams or claim no leak.

A PASS may say **no leak observed in the declared cycles/duration and inspected retaining paths**. It must never say globally leak-free. Confirmed unbounded growth, unreleased contexts/streams/connections or reproducible resource exhaustion blocks release; mere GC sawtooth or bounded warm caches is not automatically a defect.

## ERP desktop refinement and responsive checks

Impeccable **Operate/refine**, not redesign. Preserve incumbent Vietnamese ERP identity, data semantics and functional affordances. Existing UI primitives/shadcn/Base UI take precedence; no CLI generation/new dependency unless independently necessary and authorized. Taste is unavailable; source it only if the Owner later identifies an installed skill, otherwise report the limitation.

Viewports: 1280×720, 1366×768, 1440×900 and 1920×1080. Exercise layout-sensitive read/write/error/dialog states on the smallest and reference viewports, then confirm remaining widths; do not repeat every lifecycle at every resolution. Set actual role-context viewport, not only configuration. Separately verify **actual Chrome zoom** 125%, 150%, 200% on representative dense/edit states and the smallest laptop; record outer/inner geometry and DPR, not CSS scale or viewport emulation advertised as zoom. No mobile/device-touch certification.

Inspect clipping, Vietnamese text/diacritics, sticky header/identifier column, controlled table horizontal scroll, primary-action reachability, focus order/trap/return, dirty draft, reduced motion and all six states. A horizontally scrolling dense table is not itself a failure; lost headers/identity/actions or page-level clipping is. Minimum type 12px; compact rows 36–40px and inline-edit 44px, according to locked canonical T8.

Before TSX/CSS edits publish the scoped pre-code UI gate in WORK and load Impeccable craft-floor plus the applicable refinement references. Fix only reproduced usability/accessibility/performance defects or evidenced noise at existing owners. Keep all styling tokens in `styles/index.css`, one primary work object/action, one blocking modal and canonical sidebar navigation. Do not hide blockers, reasons, evidence, required fields or permissions in the name of simplicity.

Capture one batched baseline across selected desktop states, apply one coherent refinement batch and confirm once. A failing functional regression is repaired explicitly, not treated as permission for endless visual polishing. Run the Impeccable mechanical detector once on final changed UI targets, verify findings, and retain independent behavior/a11y checks.

## Delivery, verification and release decision

Deliver one reproducible procedure through existing runner/test/performance owners and an OPERATIONS qualification section, not a second task system. Unique ignored runtime artifacts bind build/source/mode/actors/dataset to scenario outcomes, traces, measurements and cleanup. Keep private dumps, raw sensitive screenshots/heap/token material and credentials outside Git and do not upload externally. No secrets in process args or logs; redact request headers and sensitive response bodies.

Baseline and final test-audit inventory records in-scope declarations, R/F/C/D classification, keeper boundary and meaningful assertions; do not expand into an unrelated repo-wide test purge. New bug tests must fail pre-fix for the intended reason. Preserve previously retained behavior when consolidating tests; no exemption padding. Defect fixes load debugging/code-review gates, then focused tests and relevant broader gates. UI changes require operational-page and owner contract tests, lint/build and actual browser confirmation. Final repository verify is separate from real MySQL/browser/endurance results.

Release summary uses PASS/FAIL/NEEDS_EVIDENCE/BLOCKED independently for:
1. MRX lifecycle/exception and physical stock/history integrity.
2. Five-role authorization and actual five-user concurrency.
3. Laptop/desktop/zoom/a11y and bounded ERP refinements.
4. Production-build five-user latency/endurance and FE/BE memory evidence.
5. Source preservation and exact environment cleanup.
6. Deployment-host readiness, monitoring/on-call/rollback and immutable off-host recovery prerequisites.

No unresolved P0/P1 correctness, security, data-loss, blocking UI or confirmed resource leak is acceptable. A missing gate is not PASS; repository-green or local five-user speed alone is not an unconditional production GO. Known provider/capacity/deployment evidence remains explicit. Do not invent off-host certification, full-history scale, RPO/RTO or deployment activity from the previously successful main schema cutover.

## Research and self-review

Primary sources fetched during intake:
- Playwright best practices: https://playwright.dev/docs/best-practices — user-visible behavior, isolation and reliable locators.
- Chrome memory diagnostics: https://developer.chrome.com/docs/devtools/memory-problems — heap/allocation evidence, detached trees and retained references.
- Web Vitals: https://web.dev/articles/vitals — LCP/INP/CLS targets and p75; lab versus actual-user evidence remains separate.
- Grafana soak methodology: https://grafana.com/docs/k6/latest/testing-guides/test-types/soak-testing/ — sustained resource/performance stability; a 60-minute local pass is shorter than multi-hour/day soak guidance.

Parent self-review only, respecting the no-delegation instruction. Review checks: no guessed Manager/kitchen authority, no fixed-week erasure, no DEV-to-release equivalence, no viewport-only zoom claim, no hidden >5 total load, no RSS-only leak certificate, no co-host stress, no provider/deployment claims and no new status owner. Source inspection establishes the proposed repair points; actual execution results remain pending.
