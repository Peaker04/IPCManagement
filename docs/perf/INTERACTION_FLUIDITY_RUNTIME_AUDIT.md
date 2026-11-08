---
title: IPCManagement interaction fluidity runtime audit
status: completed-evidence-ledger
owner: GSD
scope: frontend-runtime-interactions
execution_plan: ../../.planning/notes/INTERACTION-FLUIDITY-OPTIMIZATION-PLAN.md
---

# Interaction fluidity runtime audit

This is the durable finding ledger for measured interaction fluidity. Execution state and checkboxes remain in the GSD plan. Canonical measurement rules remain in [`../UI-UX-MEASUREMENT-PROTOCOL.md`](../UI-UX-MEASUREMENT-PROTOCOL.md); this file must not become a second workflow.

## 1. Project constraints and NFR

- Project rules win over the supplied audit brief.
- Field targets remain LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 where `DASHBOARD-UI-RULES.md` declares p75; local lab runs are not field p75.
- 8.33ms/16.67ms frame references are diagnostic, not an implicit 120/60 FPS acceptance contract.
- Browser/profile traces, React profiles and large screenshots are scratch unless selectively promoted.
- No seed, mode switch, protected mutation, schema/data/index change or telemetry deployment is authorized by this audit.

## 2. Current architecture to preserve unless evidence disproves it

React 19, React Router lazy routes, intent-driven route/code/data preload, RTK Query, resource-specific invalidation, canonical query-view boundaries, scoped Warehouse reads, owner-level pagination, retained tabs and accessible shared overlays remain intentional architecture.

## 3. Required environment comparison

Every actionable finding must state one of:

- `DEVELOPMENT_ONLY`
- `DEVELOPMENT_DOMINANT`
- `PERSISTS_IN_PRODUCTION`

DEV and production preview use the same browser, machine, actor, lane, viewport, route/state and interaction sequence. Cold compilation, warm navigation and application interaction are reported separately.

## 4. Interaction matrix status

| Family | Declared coverage | Status |
|---|---|---|
| Navigation | Dashboard → Warehouse → Reports plus browser back/forward on preview | `BOUNDED_RUNTIME_PASS`; 3 repeats, CLS 0, no app task >16ms in CDP trace |
| Tabs | Warehouse and Approvals repeated transitions; Reports only one naturally actionable member | `PARTIAL`; Warehouse/Approvals pass, Reports remains `NEEDS_EVIDENCE` |
| Tables | Warehouse rapid search; pagination/row mutation excluded | `PARTIAL / MEASURED_NOT_ACTIONABLE`; 7 successful GETs, max frame 6.2ms, no LoAF/CLS |
| Forms | Search typing/focus only; validation/safe-submit unavailable without mutation | `PARTIAL`; remaining cells `NEEDS_EVIDENCE` |
| Overlays | Warehouse guidance dialog open/focus/close/restore | `BOUNDED_RUNTIME_PASS`; CLS 0, no LoAF, focus restored |
| Shell | Sidebar and browser-history route navigation | `BOUNDED_RUNTIME_PASS` for measured desktop cells |
| Continuous | 30 Warehouse tab actions, 30 Approval actions, repeated route history; long-list scroll unavailable | `PARTIAL`; measured cells pass, long-scroll `NEEDS_EVIDENCE` |

## 5. Measurement schema

Each result records source/runtime identity, environment, browser/version, viewport/throttle, actor/mode/state, route/view/action, repeats, preload state, event phases, frame distribution, LoAF support/results, long tasks, CLS sources, DOM/retained nodes, request timing, errors and applicable React/browser attribution.

Unsupported observer/profile capability is `NEEDS_EVIDENCE`, not zero.

## 6. Known evidence entering this audit

| ID | Evidence | Disposition |
|---|---|---|
| IF-BASE-01 | Warehouse Exceptions historical owner pagination: 592 → 22 rows, ~10,368 → ~700 DOM nodes, ~381ms long task → 0 | Retain; proves DOM volume can be actionable, not a universal virtualization mandate |
| IF-BASE-02 | Corrected production-preview matrix on 2026-09-16 found Warehouse Exceptions CLS `0.1749/0.1637`; lifecycle probe attributed it to the 20-row allocation panel expanding and pushing the following return panel | Owner-specific loading-footprint fix measured `0/0.0000983` in the same two cells; final seven-route matrix passed bounded thresholds |
| IF-BASE-03 | Approval history query-string budget cell measured CLS `0.1106139` at 1440×900 during the interrupted post-evidence Wave B | Superseded by IF-001 root-owner attribution and same-condition `0` CLS evidence at two viewports |
| IF-BASE-04 | Weekly Menu lacks exact React commit/effect/subscription attribution | `NEEDS_PROFILER_EVIDENCE`; no speculative split/memoization |
| IF-BASE-05 | Field CWV/RUM and deployment dashboards are unavailable in this lane | `CONFIRMED_BUT_AUTHORITY_BLOCKED` |

These are bounded inputs, not a whole-system fluidity verdict.

## 7. Finding ledger

| ID | Severity | Journey/cell | Environment | Dominant cost | Root owner | Before/after | Verdict |
|---|---|---|---|---|---|---|---|
| IF-001 | P1 resolved | Approvals history direct route, Admin/DEFAULT, 1440×900 + 1366×768 | Preview | Loading-to-ready collection expansion | Premature `SplitWorkbench` detail rail during collection loading | 0.1112163 → 0 / 0; repeated tab CLS 0; keyboard detail focus/restore pass | `PASS_FOCUSED` |
| IF-002 | — | Reports Price tab switch | DEV + preview | Presentation delay candidate | Unclassified | 32ms DEV (3/3) → observed 16ms preview (1/3) | `NEEDS_EVIDENCE` |
| IF-003 | — | Reports Price search keystroke | DEV + preview | Presentation delay candidate | Unclassified | 32ms DEV (3/3) → observed 16ms preview (2/3) | `NEEDS_EVIDENCE` |
| IF-004 | P2 | Warehouse Exceptions search keystroke | DEV + preview | Presentation delay | Development runtime | 32ms DEV → 16ms preview median; both 3/3; preview zero LoAF/frame >8.33ms in interaction windows | `DEVELOPMENT_DOMINANT / MEASURED_NOT_ACTIONABLE` |
| IF-005 | P2 | Warehouse Exceptions tab switch | Preview | Below Event Timing reporting floor | Retained view measured cheap | IF-C: 30 real alternating actions, CLS/LoAF 0, max frame 6.4ms | `MEASURED_NOT_ACTIONABLE` |
| IF-006 | P2 | Approvals queue↔history repeated tabs | Preview | Retained view measured cheap | Approval tabs | 30 actions per viewport, repeated CLS/LoAF 0; keyboard detail focus/restore pass | `MEASURED_NOT_ACTIONABLE` |
| IF-007 | — | Approvals History search | DEV + preview | N/A | N/A | No natural search owner in active history view | `NOT_APPLICABLE` |
| IF-008 | P2 | Preview route navigation + back/forward | Preview | Browser/frame scheduling | No application owner found | 3/3 CLS 0; one 52.1–65.7ms LoAF/run, blocking=0; current-source CDP longest Layout 11.692ms, FunctionCall 5.779ms | `MEASURED_NOT_ACTIONABLE` |
| IF-009 | P2 | Warehouse rapid search typing | Preview | Network-bound query refresh | Warehouse query owner | 7 keystrokes/7 successful GETs; CLS 0, max frame 6.7ms, no LoAF/long task | `MEASURED_NOT_ACTIONABLE` |
| IF-010 | — | Warehouse guidance dialog open/close | Preview | Overlay lifecycle | Shared dialog + guidance owner | 3/3 CLS 0, no LoAF/long task; initial focus on close control and trigger focus restored | `BOUNDED_RUNTIME_PASS` |

## 8. React, browser pipeline, DOM, motion and loading findings

Wave IF-C receipts:

- `.artifacts/perf/interaction-fluidity-if-c-20260916/approval-final-1440x900.json`
- `.artifacts/perf/interaction-fluidity-if-c-20260916/approval-final-1366x768.json`
- `.artifacts/perf/interaction-fluidity-if-c-20260916/system-matrix.json`
- `.artifacts/perf/interaction-fluidity-if-c-20260916/summary.json`

Approval History root owner was the detail rail mounting before its purchase-request collection was stable. The ready transition inserted up to eight cards and moved `aside.ipc-split-detail-strip` from y=229.0 to y=719.1, producing CLS `0.1112163`. `SplitWorkbench` now omits unavailable detail content, and Approval History defers its rail during collection loading instead of reserving page-sized whitespace. Same-condition preview evidence is `0` at `1440×900` and `0` at `1366×768`; 15 queue↔history cycles produced zero CLS after settlement. Keyboard request activation focuses and scrolls the detail into view, and closing restores focus to the originating request at both viewports.

Bounded warm navigation control had zero CLS/LoAF, with longest frames 6.3–24.2ms across Dashboard, Warehouse, Reports and Approvals. Thirty Warehouse tab actions had max frame 6.4ms, zero CLS/LoAF; the Reports script only clicked one naturally actionable tab and therefore did not close Reports transition evidence. IF-C initially left the overlay cell open; IF-D later measured the Warehouse guidance dialog.

Wave IF-D closeout receipts:

- `.artifacts/perf/interaction-fluidity-closeout-20260916/summary.json`
- `.artifacts/perf/interaction-fluidity-closeout-20260916/history-pipeline-summary.json`
- `.artifacts/perf/interaction-fluidity-closeout-20260916/approval-keyboard.json`

The current-source repeated browser-history sequence produced one 52.1–65.7ms LoAF per run; all entries reported zero blocking duration, with script attribution `[1,0,0]`. The bounded current-source CDP pipeline trace found no single application task over 16ms: longest Layout 11.692ms and FunctionCall 5.779ms. This does not expose an actionable React or JavaScript owner. React Profiler is therefore not justified for this cell. Weekly Menu remains separately `NEEDS_PROFILER_EVIDENCE`; no claim is promoted without the missing profiler capability.

Warehouse rapid search remained visually fluid despite one request per typed character: three current-source runs had CLS 0, no LoAF/long task and max frames 6.3–6.7ms, with all seven GETs succeeding. Debounce is not authorized without a measurable interaction or backend-load requirement. The Warehouse guidance dialog passed open/focus/close/restore in three runs with CLS 0 and no LoAF/long task.

Wave IF-B bounded DEV-versus-preview receipts:

- `.artifacts/perf/interaction-fluidity-if-b-20260916/dev-final.json`
- `.artifacts/perf/interaction-fluidity-if-b-20260916/preview-final.json`
- `.artifacts/perf/interaction-fluidity-if-b-20260916/dev-load.json`
- `.artifacts/perf/interaction-fluidity-if-b-20260916/preview-load.json`
- `.artifacts/perf/interaction-fluidity-if-b-20260916/summary.json`

Only Warehouse Exceptions search currently has a complete 3/3 comparison: it is presentation-dominated at 32ms DEV versus 16ms preview, with no processing debt/LoAF in preview, so it is `DEVELOPMENT_DOMINANT / MEASURED_NOT_ACTIONABLE`. Reports Price tab/search show the same observed direction but preview sets are partial (1/3 and 2/3), therefore remain `NEEDS_EVIDENCE`. Cold-load traces remain `NEEDS_BROWSER_TRACE`: preview start-of-document samples contain 164–193ms initial context intervals with zero scripts, while DEV module startup contains smaller script-attributed intervals. They are not post-input latency and require a controlled navigation trace before owner attribution.

This campaign closes with bounded route/view/state/actor/viewport claims only. Reports transition/Event Timing, Weekly Menu profiler attribution, long-list scroll, field CWV/RUM and all-role/all-mode acceptance remain explicit residuals; none blocks the measured-cell closeout or authorizes speculative optimization.

## 9. Confirmed fixes

- **IF-BASE-02 — Warehouse Exceptions:** same-condition lifecycle attribution and before/after evidence retained (`0.1749/0.1637` → `0/0.0000983`).
- **IF-001 — Approval History:** same-condition production-preview attribution and before/after evidence retained (`0.1112163` → `0` at `1440×900` and `1366×768`, repeated-tab CLS `0`); no page-sized blank region is retained, and keyboard detail focus/restore passes.

Both remain part of the inherited dirty worktree until separately committed; do not attribute either to a clean commit.

## 10. Non-actionable hypotheses and residual risk

- Reports Price inactive-to-active tab remains `NEEDS_EVIDENCE`; IF-C's single actionable tab did not constitute a transition.
- Reports Price search remains `NEEDS_EVIDENCE` because preview Event Timing was partial 2/3 below the reporting floor.
- Weekly Menu remains `NEEDS_PROFILER_EVIDENCE`; no reproduced React-owner regression or production profiling capability was available.
- Long-list scroll and mutation-bearing form/table actions were not fabricated; they require naturally available data and authority.
- Field CWV/RUM, production p75, all-role/all-mode, mobile/tablet and deployment telemetry remain authority-bounded.
- Supply Line, ServiceRun volume and Return Allocation transfer size remain separate backend/data-volume work unless causal interaction evidence links them.
