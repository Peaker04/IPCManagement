# Phase 35 Checklist — mounted frontend UI/UX conformance

Status: IN_PROGRESS
Current wave: W1 contract/foundation and RED inventories
Plan: `35-01-PLAN.md`
Context: `35-CONTEXT.md`
Brief/matrix: `35-BRIEF-AND-ACTION-MATRIX.md`
Root-cause input: `.artifacts/ui-ux-process-inventory/PHASE34-PASS-GAP-ROOT-CAUSE.md`

## Claim denominator

| Claim | Required | PASS | OPEN | NEEDS_EVIDENCE | N/A | BLOCKED | NOT_CLAIMED | Verdict |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| P35-SOURCE-OWNERSHIP | 14 mounted URLs | 14 | 0 | 0 | 0 | 0 | 0 | PASS |
| P35-RULE-APPLICABILITY | 7 mounted route families (expanded V3/select concerns mapped) | 7 | 0 | 0 | 0 | 0 | 0 | PASS_INVENTORY |
| P35-ASYNC-COMPOSITION | 7 selected systemic cells | 7 | 0 | 0 | 0 | 0 | 0 | PASS_FOCUSED |
| P35-ACTION-HIERARCHY | 3 confirmed violating command contexts | 3 | 0 | 0 | 0 | 0 | 0 | PASS_FOCUSED |
| P35-INFORMATION-UNIQUENESS.DEFAULT | 17 activated state/grain cells | 16 | 0 | 1 | 0 | 0 | 0 | NEEDS_EVIDENCE |
| P35-INFORMATION-UNIQUENESS.MATERIAL_RECONCILIATION | 5 activated state/grain cells | 4 | 0 | 1 | 0 | 0 | 0 | NEEDS_EVIDENCE |
| P35-CLOSED-VALUE-PROJECTION.DEFAULT | 74 projection cells across 37 mounted controls | 74 | 0 | 0 | 0 | 0 | 0 | PASS_SOURCE |
| P35-CLOSED-VALUE-PROJECTION.MATERIAL_RECONCILIATION | 26 projection cells across 13 mounted controls | 26 | 0 | 0 | 0 | 0 | 0 | PASS_SOURCE |
| P35-GEOMETRY | 95 stable-key production occurrences | 95 | 0 | 0 | 0 | 0 | 0 | PASS_INVENTORY_ONLY |
| P35-BROWSER-HEALTH | 147 observations (shared login 1 + DEFAULT 38 + MRX 10, each × 3) | 138 | 0 | 9 | 0 | 0 | 0 | NEEDS_EVIDENCE |
| P35-BROWSER-COMPOSITION | 147 observations (49 applicability cells × 3 viewports) | 0 | 0 | 147 | 0 | 0 | 0 | NEEDS_EVIDENCE |
| P35-SCREENSHOT-MODAL | 5 supplied screenshot cells | 3 | 0 | 2 | 0 | 0 | 0 | NEEDS_EVIDENCE |
| P35-LIFECYCLE | Changed flows only | 1 | 0 | 0 | 0 | 0 | 0 | PASS_BASELINE |
| P35-USABILITY | 0 | 0 | 0 | 0 | 0 | 0 | 1 | NOT_CLAIMED |
| P35-PERFORMANCE | 0 | 0 | 0 | 0 | 0 | 0 | 1 | NOT_CLAIMED |

No top-level PASS until every non-NOT_CLAIMED claim reconciles required cells.

## W1 — contract/foundation

- [x] P35-W1-01 Create GSD objective, context, one plan, checklist and brief/action matrix.
- [x] P35-W1-02 Record Phase 34 PASS-gap root cause and update canonical claim-envelope harness.
- [x] P35-W1-03 Freeze mounted route owner and retained-view registry from current source: 14 concrete URLs
  (login + 13 protected owners); wildcard redirect is not a page owner. MRX capability views remain the canonical
  two-view sets for Weekly/Warehouse/Admin; DEFAULT retained views come from `navigationPreferences.ts`.
- [x] P35-W1-04 Inventory shared async/query state boundaries. Shared semantic root is `QueryViewBoundary`;
  Chef/Admin/Report/manual page switches are consolidation candidates only where phase arbitration duplicates it.
  Business-specific empty/prerequisite/table skeletons remain local.
- [x] P35-W1-05 Inventory command surfaces. Confirmed D7 violations at Warehouse (3 primaries), Approvals (2) and
  Admin Data (2); lowest immediate correction is callsite emphasis because `CommandBar` cannot infer product priority.
- [x] P35-W1-06 Inventory arbitrary geometry. Confirmed defects: Admin boundary applies 420px to compact blocking
  states/dialog, and Purchasing renders an invisible 10.25rem action spacer. Purposeful table/dialog/workspace
  constraints are explicitly deferred, not mass-replaced.
- [x] P35-W1-07 RED locks: five focused files produced 5 expected failures/30 passes for mixed uninitialized,
  Chef error priority, Admin blocking geometry, Warehouse primary hierarchy and Purchasing invisible spacer.
- [x] P35-W1-08 Wave 2 root owners locked: shared QueryViewBoundary priority; Chef priority adapter; Admin boundary
  default geometry; Warehouse/Approval/Admin action emphasis; Purchasing command geometry. Remaining 108 candidate
  count is not treated as 108 defects.

## W2 — shared seams

- [x] P35-W2-01 Fix selected async composition owners: shared boundary blocks any required uninitialized dependency;
  Chef prioritizes forbidden/error before passive loading. RED→GREEN focused regressions.
- [x] P35-W2-02 Fix selected action hierarchy: Warehouse retains one primary issue action; Reports/Chef handoffs are
  secondary; Approvals keeps Duyệt primary and purchasing handoff secondary; Admin keeps BOM primary and Weekly link
  secondary.
- [x] P35-W2-03 Fix measured geometry owners: Admin blocking/default content is content-sized; Purchasing no longer
  reserves invisible action width. No table/workspace min-width/min-height was mass-edited.
- [x] P35-W2-04 Recheck affected Warehouse state ownership: current-stock error/forbidden no longer mounts a
  second false-empty table surface; MRX issue-history error now owns a retry action and never renders false empty.
  RED 2 failures/18 passes → GREEN 2 files/20 tests.
- [x] P35-W2-05 Focused tests PASS: 5 files / 35 tests; TypeScript, scoped quiet ESLint, harness checker and scoped `git diff --check` PASS.

## Goal expansion authorization — 2026-09-10

- [x] Owner expanded Phase 35 from supplied screenshots to every mounted frontend owner in both `DEFAULT` and
  `MATERIAL_RECONCILIATION`.
- [x] Explicit discovery targets: duplicate/redundant same-problem information or state surfaces; dropdown closed
  values that expose raw/hardcoded enum/id or disagree with localized options; modal/drawer/composition/geometry/
  accessibility violations supported by project rules and evidence.
- [x] Bounded brainstorming/research may clarify or extend canonical UI rules only for a proven
  `RULE_AMBIGUITY`/`RULE_GAP`, with a measurable oracle. Aesthetic preference alone remains out of scope.
- [x] Parallel read-only inventories completed and promoted to
  `.artifacts/ui-ux-process-inventory/PHASE35-INFORMATION-AND-SELECT-FINDINGS.md`: six information/state defects,
  three closed-value/mapping defect groups, one shared truncation candidate, and reviewed intentional repetition.
- [x] Canonical response: V3 clarified for semantic duplicates across adjacent surfaces; harness step 10 now requires
  selected-option ↔ closed-trigger parity. No duplicate dropdown rule ID created. Mode-specific claims reopened
  because numeric denominators are not yet frozen.
- [x] RED→GREEN implementation wave: IU-01–IU-03/IU-05/IU-06 and CVP-01–CVP-04 fixed; IU-04 not reproduced
  and was not speculatively edited.
- [x] Mode-specific denominators frozen at
  `.artifacts/ui-ux-process-inventory/phase35-denominators/`: closed-value DEFAULT 37 controls/74 projection
  cells, MRX 13/26; information uniqueness DEFAULT 17 activated state/grain cells, MRX 5.
- [ ] Headed semantic-composition receipt: 20/22 state cells PASS at all three viewports = 60/66 observations.
  - MRX 4/5: Weekly schedule/demand injected catalog failure each has one owner, Advanced Settings reset has one
    live announcement, and MRX dashboard summary/detail is intentional.
  - DEFAULT 16/17: Warehouse purchase-order error replaces false empty across 3 views; Weekly catalog error has one
    owner across 6 views; deterministic read-only approval empty has one surface; Advanced reset one announcement;
    three dashboard grains and two Chef retained-view compositions are intentional and measured.
  - Remaining: MRX all-matched and DEFAULT successful approval mutation, each ×3 viewports. Read-only preflight
    confirmed `ipc_lane7` DEFAULT v23 has zero approval inbox items; `ipc_lane9` has zero reconciliation batches;
    retained disposable lifecycle DB has three batches but no all-matched batch (best completed batch is 82 MATCHED/
    2 NEEDS_REVIEW). These cells remain `NEEDS_EVIDENCE`; no synthetic business response, record creation or
    unrelated protected mutation was used to manufacture PASS.

## Residual closure decision — council converged

- [x] Two-pass fallback council memo recorded at
  `.artifacts/ui-ux-process-inventory/PHASE35-RESIDUAL-CLOSURE-BRAINSTORM.md`.
- [x] Browser applicability denominator corrected from 138 to 147: shared `/login` once; DEFAULT 38; MRX 10
  including `/403` and `/admin/advanced-settings`; all ×3 viewports.
- [x] Semantic information uniqueness remains a separate subclaim; 20/22 does not auto-promote any general
  composition cell.
- [x] Wave A: stable-key production geometry ledger v2 generated with 95 occurrences: 61 purposeful constraints,
  7 responsive workarounds and 27 `NEEDS_BROWSER`; zero unclassified. Inventory regression reconciles every current
  production arbitrary minimum and fails on drift.
- [ ] Wave B: attempted 147-observation read-only runner produced candidate artifacts, but independent review found
  DEFAULT local-state tabs were not activated and the oracle omitted required adjacency/scroll/focus/hit-target facts.
  Runtime/source identity was recorded but not verified. No composition PASS is promoted from these artifacts.
- [ ] Wave C: geometry has 95/95 source classifications but browser-dependent claims lack stable-key evidence joins;
  retain `PASS_INVENTORY_ONLY`. Final reviewer `031a7ba9-53d3-44c4-8a45-ad0078d94668` verdict BLOCK with no
  High/Medium production-code regression, but four P1 evidence/oracle findings.

## W3 — mounted rollout/evidence

- [ ] P35-W3-01 Grouped rollout in progress: shared query/command/Admin/Purchasing/Warehouse owners corrected;
  remaining route families require browser-led findings rather than speculative source edits.
- [ ] P35-W3-01A Five supplied screenshots inventoried in
  `.artifacts/ui-ux-process-inventory/PHASE35-SCREENSHOT-MODAL-FINDINGS.md`: completion-dialog footer containment
  and audit closed-value projection are confirmed enforcement gaps; audit options and issue-detail drawer remain
  evidence cells, not speculative restyling targets. RED locked 2 expected failures/9 passes: shared footer lacked
  wrapping and the closed audit trigger rendered the raw enum. GREEN 11/11; TypeScript and scoped quiet ESLint
  PASS. P35-S01–S03 source-regression PASS; S04/S05 visual assertions are candidate evidence but need verified
  source/runtime/database identity and mutation fencing before promotion.
- [x] P35-W3-02 Full frontend production build (2,334 modules) and quiet lint PASS after expanded-goal fixes.
- [x] P35-W3-03 MRX aligned runtime identity/preflight PASS on task-owned 3001/8001 and `ipc_lane9`; runtime teardown.
- [ ] P35-W3-04 Prior aligned health remains 138/147 PASS; the added 9 observations and all 147 general composition
  observations need rerun with verified identity and real retained-view activation. Candidate runner output is not PASS.
- [ ] P35-W3-05 Denominator arithmetic is reconciled, but evidence-cell promotion remains incomplete.
- [ ] P35-W3-06 Canonical docs, MEMORY and final namespaced verdict updated.
- [x] P35-W3-07 Task-owned MRX runtime on 3001/8001 (`ipc_lane9`) aligned and torn down. Headed artifact:
  `.artifacts/shipyard-live/phase35-mrx-semantic-composition-20260910/manifest.json`. Expected console 503 entries
  are tied only to deliberate catalog-failure injection; zero unexpected browser errors.
- [x] P35-W3-08 Task-owned DEFAULT runtime on 3001/8001 (`ipc_lane7`, mode DEFAULT v23) aligned and torn down.
  Headed artifacts: `.artifacts/shipyard-live/phase35-default-semantic-composition-20260910/manifest.json` and
  `approval-empty.json`. Expected 503 console entries are deliberate read-only request failures; zero unexpected errors.

## Current evidence

- Expanded-goal ledger: `.artifacts/ui-ux-process-inventory/PHASE35-INFORMATION-AND-SELECT-FINDINGS.md`.
  First wave: CVP RED 2 failures/9 passes → GREEN; Weekly duplicate RED 1 → GREEN; Approval ready-empty RED
  1 failure/10 passes → GREEN. Consolidated 6 files/39 tests, TypeScript and scoped quiet ESLint PASS. Warehouse
  purchase-order error now replaces the false-empty panel with a source regression. MRX all-matched duplicate
  candidate was not reproduced by mounted behavior and received no speculative edit. Second focused gate removed
  duplicate live success channels and dictionary drift/unknown-as-all projection: 5 files/39 tests PASS. Shared
  Select/full-label wave removed every empty production `SelectValue`, added a zero-occurrence guard and complete
  closed-label `title`; 3 files/20 tests, TypeScript and scoped quiet ESLint PASS.
- Screenshot/modal ledger: `.artifacts/ui-ux-process-inventory/PHASE35-SCREENSHOT-MODAL-FINDINGS.md`.
  Confirmed defects P35-S01/S02 share `DialogFooter` containment; P35-S03 is raw audit enum projection.
- Geometry v2 authority: `.artifacts/ui-ux-process-inventory/phase35-denominators/phase35-geometry-denominator-v2.{json,md}`.
  Production-only stable-key denominator is 95, replacing the inclusion-ambiguous 108 raw scan. Final disposition:
  88 purposeful constraints + 7 responsive workarounds, zero defect/unclassified/evidence rows. Gate:
  `frontend/tests/phase35GeometryDenominator.test.ts`, 1/1 PASS.
- Wave 1 RED: 5 failures/30 passes. Wave 2 first GREEN: 5 files/35 tests PASS.
- Wave 2 second RED/GREEN: Warehouse duplicate state + history recovery; 2 failures/18 passes → 20/20 PASS.
- Consolidated affected feature gate: 9 files/67 tests PASS; TypeScript and scoped quiet ESLint PASS.
- Final DEFAULT headed health: `.artifacts/shipyard-live/phase35-default-mounted-green-20260909/manifest.json`,
  114 samples. Final MRX headed health: `.artifacts/shipyard-live/phase35-mrx-mounted-green-20260909/manifest.json`,
  24 samples. Both enforce max one command primary/zero invisible action spacers and have zero browser errors or
  overflow. DEFAULT disposable DB was dropped; task-owned runtimes/Chrome stopped. CLS/long-task candidates remain
  NEEDS_EVIDENCE because these are dev-navigation observations and performance is NOT_CLAIMED.
- Phase 34 functional/lifecycle baseline remains PASS; whole-mode composition remains PASS_WITH_RESIDUAL.
- Harness validation after denominator update: `AGENT HARNESS PASS`, self-test PASS, scoped `git diff --check` PASS.

## Boundaries

Preserve inherited dirty work. No business authority change, data fabrication, commit, stage or push. One writer in shared cwd.
