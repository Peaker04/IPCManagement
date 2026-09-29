# First production vertical slice — Weekly Menu Material Demand

Status: APPROVED_FOR_READINESS (Kỳ: “Duyệt”); production reconstruction NOT_STARTED. Branch: `refactor/design-system-maturity-pass-20260929`. This is the single GSD checkpoint for this objective; Phase 36 Warehouse and MRX remain paused. Source/runtime outrank the 2026-09-29 ChatGPT Web ZIP, which is an intake, not a completion receipt.

## Goal and boundary

Implement one controlled DEFAULT `/weekly-menu?view=demand` presentation slice after the design-kit readiness gate. Daily Material Demand is the work object; keep `docs/domain/weekly-menu-contract.md` state ordering, shift-grain editing, 6-decimal BOM arithmetic, auth/mutation guards and API/DB lineage. Do not bring back demand-preview; do not migrate all six views to sidebar routes in this slice, switch mode, seed data, change protected DB, or treat specimen screenshots as product acceptance. The target sidebar architecture in DESIGN §7 remains an independent follow-up decision/plan.

## Gate A — kit readiness; no production edits

Intake: `C:/Users/Administrator/Downloads/IPCManagement_session_handoff_2026-09-29.zip` (`CURRENT_FINDINGS.md`, `AGENT_TASK.md`, `KIT_COMPLETENESS_REVIEW.md`). Baseline artifact `.artifacts/design-system-specimen/specimen-validation-report.json` identifies `run-1790674818715` with 23 listed and 23 present PNGs. Do not overwrite this accepted run: current runner deletes `.artifacts/design-system-specimen` before executing; route a new run to its own immutable directory first.

| ZIP finding | Source-first intake | Required closeout |
|---|---|---|
| A1 capture active identity | Runner checks `data-active-section`, not `aria-current`, active styling or rendered specimen at capture | Add capture-time oracle across all four identities; capture fresh screenshots. BLOCKER_BEFORE_PRODUCTION. |
| A2 count | Report lists 23 files, actual directory has 23; runner currently reports in-memory array length, not directory contents | Derive count from actual PNG directory in fresh run. FIX_IN_READINESS. |
| A3 icon strokes | DESIGN §5.11 says 1.5–1.75 while §11/§20.6 say 2.0 | Resolve canonical size/stroke by role in DESIGN and specimen; no blanket unmeasured claims. BLOCKER_BEFORE_PRODUCTION. |
| A4 checkbox motion | DESIGN §14 says scale .5→1; specimen needs source/measured comparison | Align restrained behavior, docs and copy; validate computed CSS. FIX_IN_READINESS. |
| A5 motion evidence | Runner marks `motion_system` PASS from limited measured patterns | Label only measured patterns mechanically validated, others defined/provisional. FIX_IN_READINESS. |
| A6 CTA locus | Specimen has “Nổ định mức ca” in header while DESIGN §6 assigns command to Zone 2 | Move in specimen unless source-backed exception; do not conflate specimen with production generate action. FIX_IN_READINESS. |
| A7 hygiene | Specimen still uses `h-8.5`, ordinary `shadow-2xs`, `transition-all` | Remove contract-violating uses only, not broad re-style; verify visual after-images. FIX_IN_READINESS. |
| A8 absolute claims | DESIGN/specimen still contain unbounded wording (e.g. Gallery “100%” and reduced-motion “100%”) | Bound claims to actual measurement; retain genuine exact numerical facts. FIX_IN_READINESS. |

Read complete specimen components and runner before edit; audit tests with `test-audit` before changing tests. Crosswalk design rules with `docs/DASHBOARD-UI-RULES.md` and the project Front-End Checklist adapter; external 385-rule MCP coverage is not assumed. Fresh run, inspect every after screenshot in declared specimen envelope, reconcile machine report with actual files. Kit completeness matrix from ZIP: `BLOCKER_BEFORE_PRODUCTION | FIX_IN_FIRST_SLICE | DEFERRED_ENHANCEMENT | NOT_NEEDED`, with explicit READY_FOR_FIRST_SLICE/BLOCKED verdict. Numeric CLS and unmeasured motion stay NEEDS_EVIDENCE; do not inflate acceptance.

## Gate B — lock production brief before JSX

Claim envelope: DEFAULT, selected service day in Weekly Menu demand; actors Admin/Điều phối plus denied actor when source permissions permit verification; 1366×768, 1440×900, 1920×1080; no tablet/mobile without request. Source owners: `WeeklyMenuPage` → `WeeklyMenuViewContent` → `MaterialDemandSection`/`useMaterialDemand` → existing query/action/API owners. Read `docs/domain/weekly-menu-contract.md`, current mode/capability route and tests; map entry → selected customer/week/day → readiness → generate or inspect → document handoff → recovery. Record DESIGN §9 14-field brief and actor | mode | grain | entity state | action | BE guard | FE eligibility | block reason | destination | next owner | evidence in this checkpoint. Choose existing ownership and smallest composition diff, not specimen JSX transplant.

Required states: ready-generated → material first/source optional; ready-empty-incomplete → shift source first; ready-empty-complete → explanatory material then source; prerequisite/loading/refresh/error/403/stale/locked/pending mutation/confirmation/success where applicable. No manufactured natural populated/locked evidence. For each cell: PASS, FAIL/OPEN, NEEDS_EVIDENCE, NOT_APPLICABLE or BLOCKED with reason. Before any page-redesign edit inventory all screenshots/states of the declared page lock and map candidates to source/DOM oracle per `docs/UI-UX-EXECUTION-HARNESS.md`.

## Gate C — execution and verification (only after A and B)

One red-capable owner regression per changed observable contract, not source-string mirrors or duplicate matrices. Preserve mutation semantics/authorization. Focused suite → typecheck/lint/checklist → aligned FE/BE runtime headed Chrome on real app URL with authenticated mode/version/capabilities. Same-state before/after DOM, action, API, focus and screenshots individually inspected; write flows require FE control → request → DB transition → reload and separate explicit authorization/legitimate task-owned lineage. Maintain Week Menu other-five-view smoke as affected consumers; MRX is NOT_CLAIMED. Do not promote green unit tests or empty natural weeks to whole-route PASS.

## Checkpoint 2026-09-29 intake

Branch and working tree clean at intake, HEAD `18fb17f3`. Gate A inspection shows A1/A3/A4/A6/A7/A8 still have source contradictions; A2 actual count matches but mechanism is not file-derived. No files in `frontend/src/**` edited in this objective; no runtime, DB action, screenshot rerun, or new production claim. Next exact step: inspect `frontend/tests/fixtures/specimens/*.tsx`, `DesignSystemSpecimenHarness.tsx`, `frontend/scripts/run-specimen-validation.mjs` and focused test owner in full; fix Gate A in bounded wave, preserving baseline artifact, then run fresh evidence and completeness matrix.

## Gate A wave 1 execution (supersedes intake next step)

A1: capture function now checks gallery section, unique `aria-current`, active class/computed color, expected rendered specimen root, and lab-only identity before each screenshot. A2: `screenshotCount` from actual directory; mismatches fail the run. A3: DESIGN §5.11 aligns stroke 2.0/viewBox24 with §11/icon specimen, visual role still provisional. A4: checkbox contract now describes press 0.9→1, matching `active:scale-90` (computed duration only, not full interaction trace). A5: runner returns `PARTIAL_MECHANICALLY_VALIDATED`, nine unmeasured patterns remain provisional. A6: CTA moved to specimen command bar. A7: scoped demand/motion specimen `h-8.5` and ordinary action shadow removed; OTHER specimen `shadow-2xs`, `transition-all`, and sub-12px text remain OPEN and require a bounded rule/visual audit before calling kit fully consistent. A8: bounded two unsupported absolutes; other specimen claims still need sweep.

Fresh isolated final run `.artifacts/design-system-specimen/run-1790676733885/specimen-validation-report.json`: 23 files = 23 reported = 23 matrix rows, zero recorded failures, contrast/diacritics/overflow and narrow mechanics PASS; motion PARTIAL. Earlier failed attempts `run-1790676472767` and `run-1790676490077` preserved, not silently reused. Final 23 screenshots reviewed in contact sheet `.artifacts/design-system-specimen/contact-sheet-run-1790676733885.jpg` for active nav and composition; this is not per-image full-resolution visual certification. Focused 2 files/8 unit tests PASS; three touched specimens targeted ESLint PASS; app TS check and `git diff --check` PASS. Runner uses headless Chrome; headed production acceptance and numeric CLS NOT_CLAIMED. Test-audit: no tests changed; existing browser runner is capture-boundary owner, further test only if regression at independent behavior boundary.

Verdict: **NEEDS_EVIDENCE for full kit review; NOT READY for production edit yet.** Next exact step: finish scoped specimen-wide A7/A8 consistency and per-image visual review, completeness matrix; then source-backed Gate B brief. No database/business mutation and no `frontend/src/**` edit. Baseline `run-1790674818715` retained.
