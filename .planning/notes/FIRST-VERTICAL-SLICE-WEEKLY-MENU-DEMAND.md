# First production vertical slice — Weekly Menu Material Demand

Status: APPROVED_FOR_READINESS (Kỳ: “Duyệt”); production reconstruction NOT_STARTED. Branch: `refactor/design-system-maturity-pass-20260929`. This is the single GSD checkpoint for this objective; Phase 36 Warehouse and MRX remain paused. Source/runtime outrank the 2026-09-29 ChatGPT Web ZIP, which is an intake, not a completion receipt.

## Goal and boundary

Implement one controlled DEFAULT `/weekly-menu?view=demand` presentation slice after the design-kit readiness gate. Daily Material Demand is the work object; keep `docs/domain/weekly-menu-contract.md` state ordering, shift-grain editing, 6-decimal BOM arithmetic, auth/mutation guards and API/DB lineage. Do not bring back demand-preview; do not migrate all six views to sidebar routes in this slice, switch mode, seed data, change protected DB, or treat specimen screenshots as product acceptance. The target sidebar architecture in DESIGN §7 remains an independent follow-up decision/plan.

## Gate C — bounded implementation checkpoint (uncommitted)

DEFAULT demand only: `MaterialDemandSection` separates its identity/status header from the day command and uses the existing primary Button for authorized generate; `styles/redesign/demand.css` binds target action/focus/form/status/subtle-surface tokens under `.ipc-demand-workspace` without touching global `index.css`. Day/source/material/document state order and query/action ownership are unchanged. Focused `MaterialDemandSection.presentation`, `demandModel`, `materialDemandErrorState`: 51/51 PASS; app TypeScript and scoped section ESLint PASS; `git diff --check` PASS. No new test: existing presentation owner cases cover the preserved DOM/state contracts; color and focus require actual browser measurement, not a source assertion.

Runtime gate: no FE/BE listeners on the checked standard ports at checkpoint; no authenticated aligned runtime or approved credential source established. Headed browser at 1366/1440/1920, natural generated/403/error states, keyboard/focus, screenshots, and FE→BE→persist→reload mutation remain `NEEDS_EVIDENCE`. No DB record created, no mode switched, no mutation attempted. **Gate C acceptance BLOCKED** pending legitimate runtime and natural state evidence; do not call focused tests whole-route PASS.

## Gate C acceptance retry (uncommitted, 2026-09-29)

Corrected demand generate icon from `Scale` to DESIGN §14 `Calculator` (`aria-hidden`); no action handler changed. Scoped CSS now excludes shared Button/Input focus rings, retains visible focus for native controls, excludes `aria-invalid=true` from strong-border override, and binds 36px CTA geometry to actual `[data-slot="button"]`. Focused 3 files/51 tests, TypeScript, section ESLint and diff check PASS.

Task-owned local Vite `127.0.0.1:3001` + ASP.NET Development `127.0.0.1:5262`, local configured DB, existing `K6_PASSWORD` credential source. Production configuration **rejected startup** (deployment validator); Development started without switching operation mode. Scoped headed Chrome helper run `.artifacts/shipyard-live/gate-c-demand-20260929-2125/manifest.json` selected demand route and 3 viewports but captured **only unrelated admin screenshots**: its `passed` is not demand acceptance. Bounded follow-up `.artifacts/gate-c-demand-acceptance/bounded-review.mjs` obtained authenticated admin, 200 mode query and demand GET, and captured/individually opened 1366/1440/1920 screenshots with scoped tokens. First natural view showed customer ANV, a prior week with incomplete shifts, KHSX before empty material, 36px CTA and no horizontal overflow; subsequent fresh week selection displayed **no committed menu** and uninitialized demand despite visible selected customer/week. Do not promote transient earlier KHSX or helper summary to stable acceptance. No eligible natural generated/locked or invalid/readonly/error/403 actor seen. No data writes or mutation attempts. Desktop authenticated DEFAULT response mode/capabilities require explicit verified response assertion before acceptance. **BLOCKED**: natural stable state and focused browser keyboard/focus/error/403/invalid/readonly/disabled/mutation evidence incomplete; Development runtime cannot certify production performance.

## Gate C read-only natural-state closure (2026-09-29; no business writes)

API-only discovery via existing admin session (`.artifacts/gate-c-discovery/discovery.json`): `/api/system-operation-mode` 200 `DEFAULT`, version 129; capabilities `weekly-menu` navigation and `demand` tab. Customer `b1e40f3e-bda5-4c16-be27-ea7146e10d37`, week `2026-09-14`: generated/locked 14 Sep (`f39763dc-12a2-4af0-8f05-47ac4d97e4e3`, approved, `canRegenerate=false`) and 15 Sep (`def6ee27-2202-42fa-b910-6307592ef691`); generated draft/stale 16 Sep (`ebbb2bce-8c84-4a05-b8ee-f68988d3c870`, `canRegenerate=true`). Week `2026-09-21`, 21 Sep same customer: committed menu 120 rows, zero completed meal plans, no demand. A writable-looking draft **is not authorization to mutate**; user explicitly prohibited all writes. Discovery was authenticated GET only, not DB mutation.

Immutable after-capture `.artifacts/gate-c-discovery-verified/browser.json` and six individually reviewed 1366×768 / 1440×900 / 1920×1080 PNGs: selected day/date oracle 14 Sep locked and 16 Sep draft, material first / source secondary, lock notice, generated rows, day scope and no page overflow. The earlier `.artifacts/gate-c-discovery/browser.json` had a **transient 21 Sep first screenshot while week control displayed 14 Sep**; not accepted. `.artifacts/gate-c-discovery-verified/incomplete.json` and its PNG certify 21 Sep source-first 0/2 shifts. One actual focus defect was observed: global `:focus-visible` outline combined with the shared Button ring; scoped `demand.css` now removes the extra outline for shared Button/Input controls (Input not independently browser-measured), and the inventory `InfoNote` ring was separately rechecked after its scoped exclusion. `.artifacts/gate-c-focus-final/keyboard.json` + `focused.png` show Tab from day navigation → regenerate → help → table → disclosure, visible single ring on regenerate and help, no second outline. Target scoped tokens computed as `#164e87`, `#2d7acf`, `#64748b`, `#f8fafc`; generated CTA height 36px. Disabled navigation naturally present, readonly/invalid inputs absent. No legitimate lower-permission credential or natural 403/error was used; existing focused error/403 regressions remain owner. No HTTP business POST, no DB seed/change, no backend/config change. Development runtime functional only, not production-performance certification. Focused 3 files/51 tests, TypeScript, scoped ESLint and diff check PASS. Mutation runtime acceptance remains NEEDS_EVIDENCE by explicit no-write instruction.

Classification for **this bounded read-only reference**: PRESENTATION_ACCEPTANCE=PASS; READ_STATE_ACCEPTANCE=PASS; ACCESSIBILITY_BROWSER_ACCEPTANCE=PASS for observed controls (readonly/invalid N/A absent); MUTATION_RUNTIME_ACCEPTANCE=NEEDS_EVIDENCE. READY_FOR_FIRST_SLICE_REFERENCE, **not** whole-route or production performance acceptance.

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

Verdict of Wave 1 (historical): **NEEDS_EVIDENCE**; Gate A governance/readiness follow-up below supersedes this next-step note. Baseline `run-1790674818715` retained.

## Gate A final scope and token mapping

A7 categories: `REFERENCE_GALLERY` = harness and Typography/ColorSurface/OperationalTable/SidebarNavigation/Iconography/Motion/MaterialDemandWorkspace specimens. These are the adopted visual reference: no `shadow-2xs`, `transition-all` or `text-[9|10|11px]` remains in their TSX at this checkpoint. `DIAGNOSTIC_EVIDENCE_LAB` = EvidenceLaboratorySpecimen: tiny telemetry labels and numerical `12/12` are deliberately machine-facing, not product typography. `INTENTIONAL_STRESS_SAMPLE` = AccessibilityStressSpecimen: controls, overlay and 320px simulation deliberately demonstrate failure/success states; do not copy their styles into production. A8: gallery Motion wording now limits no-layout-shift claim to unmeasured production; OperationalTable's “100% định mức” is a business quantity, zoom “100%” is a setting, and Evidence Lab's 100% is only the measured contrast subset (12/12), not global WCAG compliance. No blanket deletion of factual ratios.

### First-slice token mapping ONLY — planning, not current CSS changes

`DESIGN` target ≠ mounted legacy; binding below is proposed for **DEFAULT `/weekly-menu?view=demand` only**, subject to Gate B owner/consumer review and Gate C browser/a11y verification. Owner means future executable binding at `frontend/src/styles/index.css` + reused shared primitives, not a new global theme. `NEEDS_GATE_C` is not an admission that target values are already mounted.

| Semantic token | DESIGN target | Legacy mounted value (`index.css`) | First-slice target binding | Owner | Status |
|---|---|---|---|---|---|
| canvas-default | `#f1f5f9` | `--ipc-slate-100: #f1f5f9` | reuse scoped slate-100 | style token | MAPPED_VALUE; needs Gate C |
| surface-base | `#ffffff` | `--ipc-color-surface: #ffffff` | reuse scoped surface | style token | MAPPED_VALUE; needs Gate C |
| surface-subtle | `#f8fafc` | `--ipc-color-surface-subtle: #eef3f8` | bind scoped target, no global rewrite | style token/table header | NEEDS_GATE_C |
| border-default | `#cbd5e1` | `--ipc-slate-300: #cbd5e1` | reuse scoped border | style token/panel | MAPPED_VALUE; needs Gate C |
| border-strong (form) | `#64748b` | `--ipc-color-border-strong: #c9d6e6` | scoped target with computed 3:1 check | style token/Input/Select | NEEDS_GATE_C |
| border-focus | `#2d7acf` | `--ipc-focus-ring: #2f6fed` | scoped target with visible focus test | style token/shared controls | NEEDS_GATE_C |
| text-primary | `#0f172a` | `--ipc-slate-900: #0f172a` | reuse scoped slate-900 | style token | MAPPED_VALUE; needs Gate C |
| text-secondary | `#334155` | `--ipc-slate-700: #334155` | reuse scoped slate-700 | style token | MAPPED_VALUE; needs Gate C |
| text-muted | `#475569` | `--ipc-color-text-muted: var(--ipc-slate-600)` = `#475569` | reuse scoped muted | style token | MAPPED_VALUE; needs Gate C |
| action-primary-bg/hover/fg | `#164e87` / `#113c69` / `#ffffff` | `--ipc-primary: #1a56a8` / `--ipc-primary-hover: #134080` / shared white | scoped semantic action; retain authorization guards | style token/Button | NEEDS_GATE_C |
| status-warning-fg | `#92400e` | `--ipc-warning: #c05621` (not equivalent) | scoped target when warning is actionable | style token/StatusBadge | NEEDS_GATE_C |
| status-danger-fg | `#b91c1c` | `--ipc-danger: #c53030` (not equivalent) | scoped target only for blocker/error | style token/InlineAlert | NEEDS_GATE_C |
| compact/standard control | 32px / 36px | `--ipc-control-height-xs: 32px` / `--ipc-control-height-sm: 36px` | reuse existing size per control grain | style token/Button/Input | MAPPED_VALUE; needs Gate C |
| radius-sm/md/lg | 2px / 3px / 6px | `--ipc-radius-sm/md/lg: 2px/3px/4px` | input/button reuse, overlay scope only if present | style token/shared overlay | overlay NEEDS_GATE_C |
| motion micro/component | 100ms / 150ms | `--ipc-transition-fast: 120ms ease`, `--ipc-transition-normal: 200ms ease` | explicit property scoped to changed controls; reduced-motion | style token/shared controls | NEEDS_GATE_C |

### Final Design Kit completeness matrix (Gate A, not product acceptance)

| Area | Verdict | Reason / follow-up |
|---|---|---|
| Foundations | READY_WITH_FIRST_SLICE | Target specified and subset measured; legacy differences mapped above; binding and consumer proof belong to first slice, not Gate A. |
| Components | READY_WITH_FIRST_SLICE | Existing primitives and anatomy; actual controls need bounded owner verification. |
| Data Display | READY_WITH_FIRST_SLICE | BOM/tabular specimen; domain precision and production grain retained. |
| Navigation | DEFERRED | Six-route sidebar and Compact Rail not prerequisites; mounted DEFAULT tabs stay. |
| Interaction | READY_WITH_FIRST_SLICE | State vocabulary defined; real focus/mutation oracles remain slice-owned. |
| Motion | DEFERRED | Three computed transitions measured only; numeric CLS/all patterns not first-slice gate. |
| Page Patterns | READY | Ten grammars specified; pick only applicable demand workspace grammar in slice. |
| Async/Feedback | READY_WITH_FIRST_SLICE | Defined; verify real loading/error/403/day lifecycle in slice. |
| Accessibility | READY_WITH_FIRST_SLICE | Gallery text floor and semantics; actual slice keyboard, contrast, target and focus need production proof. Shadows/transition scope alone are **not** accessibility failures. |
| Responsive | READY_WITH_FIRST_SLICE | Specimen overflow probes only; desktop first-slice viewports and real flow remain. Mobile polish deferred. |
| Localization | READY_WITH_FIRST_SLICE | Vietnamese probes and date/unit guidance; test actual demand content. |
| Governance | READY | Domain → DESIGN → executable → feature → verification; historic reports not live authority. |
| Design Consistency | READY | Reference Gallery A7/A8 scoped fixes; diagnostic/stress examples explicitly excluded. |

**Gate A verdict: READY_FOR_FIRST_SLICE (readiness only; not authorization to start Gate B/C in this task).** Final isolated `.artifacts/design-system-specimen/run-1790680220052/`: 23 PNG/23 evidence rows, zero runner failures, motion PARTIAL; all 23 PNG opened individually at native resolution. Active nav/content match by visual review; 390px image is above-fold only and 320px reflow sample is simulation, not mobile workflow/native zoom acceptance. At 1024 the dense table wraps, but screenshot alone does not establish a defect without DOM/action oracle; retain in first-slice scope only if applicable. Focused unit 2 files/8 tests, app tsc, changed-doc link check and `git diff --check` PASS. Scoped ESLint over all Gallery specimens reports 21 errors/1 warning (unused imports, refresh-only exports and pre-existing effect/setState in Typography/Sidebar); not an A7 visual PASS or whole-repo lint PASS; do not erase or relabel it. No true Gate A blocker from token differences alone; scope mapping becomes executable only after first-slice implementation and gates. Existing runs retained. Production reconstruction remains NOT_STARTED; no backend/API/DB or `frontend/src/**` edits.
