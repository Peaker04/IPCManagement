**Design System Maturity Pass & Dual-Surface Specimen (2026-09-29):** transformed non-production specimen harness (`/tests/fixtures/specimen.html`) into two distinct surfaces: Surface 1 (Design System Gallery — clean, calm, zero QA chrome, real operational layouts, composed Material Demand Workbench) and Surface 2 (Technical Evidence Laboratory — automated WCAG 2.2 contrast engine, diacritic scrollHeight DOM probes, tabular numeric variance meter, 200% zoom reflow simulator, machine-readable telemetry JSON). Codified 16 canonical interaction states (ST-01 to ST-16) and 6 state precedence conflict rules, Motion System (4 duration tokens 0/100/150/200ms, 3 easing curves, zero-reflow CSS Grid accordion, reduced-motion reset), Two-Tier Iconography Architecture (Tier 1 System Mechanics 16px/20px + Tier 2 Domain Pictograms 1-to-1, resolved ChefHat brand vs CookingPot route collision, de-overloaded Scale 6-ways strictly to Material Variance Reconciliation, Flaticon metaphor research only), Component Anatomy (Zones 1-5), and 6 visual separation strategies in `docs/DESIGN.md`. 21 screenshots captured via Chrome 153 (`.artifacts/design-system-specimen/screenshots/`), 7/7 Vitest unit tests PASS, zero production code modified in `frontend/src/` (`Frontend Reconstruction -> NOT_STARTED`).

**Demand preview removed (owner decision, 2026-09-29):** separate `/weekly-menu/demand-preview` experiment and `Nhu cầu · Preview` tab removed with their route registration, component/CSS and tests. Current `Nhu cầu` remains. Historical evidence stays recorded only in Phase 36 checklist; MRX PAUSED.

**Latest Nhu cầu state-aware correction (2026-09-29):** prior universal material-first order superseded: ready/generated day → material first; ready/empty/incomplete day → guarded KHSX source and completion controls first; ready/empty/complete → explanatory material then collapsed KHSX. Error/loading/403 not flattened. Same demand-local composition only, no shared shell/tab/API/permission changes. Red owner→green, 41 files/206 tests, tsc/lint/check:frontend-checklist PASS. User requested no more screenshots; natural generated/locked visual acceptance NEEDS_EVIDENCE. See bottom Phase 36 checklist, MRX PAUSED.

**Latest Nhu cầu multi-day follow-up (2026-09-29):** same scoped redesign, source disclosure keyed by selected activeDate so manual close of incomplete day does not persist onto next incomplete day. Owner regression, 41 files/206 tests, tsc/lint/frontend-checklist check PASS. Per-day API/DOM generated/approved-locked visual acceptance remains NEEDS_EVIDENCE (historical headed probe timed out; no completed result/owned process match); user requested no further screenshots. See bottom Phase 36 checklist. MRX PAUSED.

**Newest Nhu cầu-only composition redesign (2026-09-29):** local operational header merges date/approval/KHSX/shift/handoff/action; material worklist DOM precedes optional KHSX and docs, locked reason retained. Natural empty-material surface top moved ~580→430 at 1366, ~386 at 1440/1920; Admin/Điều phối × ANV/DAV × 3 widths read-only no writes/errors. Five other tabs settled 1440 smoke. Owner red→green, 41 files/205 tests, tsc/lint PASS. Real generated-material/locked visual acceptance NEEDS_EVIDENCE: selected natural weeks have zero material rows, no fixture or mutation. See last Phase 36 checklist; MRX PAUSED.

**Weekly Menu Nhu cầu-only density audit (2026-09-29):** local `MaterialDemandSection` + `demand.css`: with material rows KHSX source defaults closed but remains openable; KHSX page-flow viewport removes nested vertical scroll; compact local warning/exception framing and duplicate metadata. Shared shell/components and five other tab implementations untouched. Admin/Điều phối × 2 natural customers × 3 widths read-only; five other tabs settled 1440 smoke; 41 files/205 tests, tsc/lint PASS. Natural generated-material/locked state not available: owner test only, NEEDS_EVIDENCE. See last 36-CHECKLIST; MRX PAUSED.

**Latest Weekly Menu DEFAULT demand correction (2026-09-29):** user rejected grouped Thao tác tuần/Điều kiện and redundant next-step/detail headers. Now commands/prerequisites visible, day shift status at top, no cross-role approval/purchasing CTA, local generate guard retained, one day/week document rail and no action column in mixed-role demand view. Headed Admin/Điều phối × 3 widths zero writes/errors; 41 files/205 tests, tsc/ESLint PASS. See last 36-CHECKLIST for scope/remaining actor-column assessment. MRX PAUSED.

**Weekly Menu upper shell follow-up (2026-09-29):** screenshot-scoped DEFAULT redesign merges price with customer/week, replaces two-tier nav with six direct tabs, moves commands/checkpoints into labelled disclosures while retaining readiness status and guards. Headed Admin/Điều phối × 3 widths six tabs/menu/checkpoints, no writes/errors; 40 files/186 tests, tsc/lint PASS. See last 36-CHECKLIST checkpoint; other route/overlay/mutation states remain open, MRX PAUSED.

**Weekly Menu DEFAULT Nhu cầu redesign (2026-09-29):** before/after 24 natural cells Admin/Điều phối × ANV completed/DAV incomplete × 3 widths × disclosure states; next-step strip, optional metrics/documents, one shift-level editor instead of 20 duplicates; Chay row displays 150 (not shared 840). After DOM/2 screenshots click/open/day-navigation, owner 25/25, broad 40 files/186 tests, tsc/lint/check:frontend-checklist PASS. No writes. Mutation/approval/error visual denominator still pending; MRX PAUSED. Checklist bottom is current pointer.

**Weekly Menu remaining-view actor batch (2026-09-29):** 16 read-only cells Admin/Điều phối × ANV/DAV × demand/purchase-summary/production-plan/dish at 1440; 16 images opened. Independent raw BOM week estimates ANV 11,112,310 / DAV 184,560,013 đ match UI, separate from rounded per-row cost. Điều phối natural production-plan GET 403 both customers; removed false “Chưa có kế hoạch” header when forbidden, 2×3 headed after-images, owner red→green, broader 40 files/184 tests, tsc/lint PASS. No writes, MRX paused. Next demand day/overlays and other read-only states; checklist bottom.

**Weekly Menu query recovery (2026-09-29):** simulated meal-plan GET 503 exposed overlapping error banner and false “ready” despite unverified servings. WeeklyMenuPage now uses inline query notice; readiness owner marks serving source failure danger, retry GET 200/[] restores. Three widths error/recovery screenshots opened, 33/33 owner suites, app tsc/lint PASS, no writes. Cost natural weeks 160/160 row/serving/BOM parity after Chay mapping fix; checklist bottom. Other views/actors/overlays and mutation/MRX still pending or blocked.

**Weekly Menu full natural week cost/variant (2026-09-29):** fixed imported `Chay` being counted as savory (red [102,102] vs [102,18]); source-based 2 customers × 6 days = 160/160 rows/servings/BOM unit and line parity, 12/12 daily totals at 1440, 12 images opened, variant day2 three widths. Corrected day2 ANV 1,312,692 đ, DAV 34,518,840 đ; old totals superseded. Focused tests 4/4, tsc/lint PASS. Other views/query states/actors and mutation still due, MRX PAUSED. Checklist bottom.

**Weekly Menu day-2 cost verified (2026-09-29):** catalog raw BOM independent crosswalk 24/24 unit + line arithmetic (ANV 4, DAV 20) matches rendered totals 1,749,912/59,797,050 đ at UI servings grain. ANV completed plans 120 per shift→savory 102; DAV no plans, imported savory 840/870. Full per-variant servings/other-day parity and query states pending. Same-value selectOption caused old warning false oracle. No writes/MRX; checklist bottom.

**Weekly Menu second-customer oracle corrected (2026-09-29):** prior 1440/1920 missing-serving warning was caused by Playwright re-selecting an already-selected customer: onChange clears Redux imported portions without new committed-response effect. Corrected guarded selection produces consistent ready state 1366/1440/1920; two customers day-2 cost × three widths read-only validated (ANV 4 rows/1,749,912 đ, DAV 20 rows/59,797,050 đ). Six day-2 and three corrected readiness images inspected. Checklist bottom supersedes previous warning. Next whole-day source parity/query states. No DB writes or MRX switch.

**Weekly Menu BOM display precision (2026-09-29):** fixed dish-materials quantity display from 3 to up to 6 decimals so raw 0.064777 kg and 12,000 đ align with 777 đ rounded cost. Three headed after-images reviewed; owner 3/3, tsc/lint PASS; no writes. Second customer readiness rerun timeout remains NEEDS_EVIDENCE (checklist bottom).

**Weekly Menu second customer intake (2026-09-29):** existing customer GET 200 week 2026-08-17/120 rows/six days, UI week matches; 1366 readiness screenshot transitioning, excluded. 1440/1920 settled incomplete-serving badge; publish control NOT clicked. Next readiness API/DOM and second-customer cost/demand; checklist bottom.

**Weekly Menu cost/BOM first-row parity (2026-09-29):** catalog GET 200 raw qty 0.064777×12,000=777.324→display 777 đ; qty displayed rounded 0.065, not pricing input. Cost first dish 777×102=79,254; nine Admin three-view×width after-images reviewed, no writes. No numeric defect. Other days/customer/error/lifecycle NEEDS_EVIDENCE; checklist bottom.

**Weekly Menu production empty scoped close (2026-09-29):** clone runtime relaunched on task-owned DB/ports after offline error; natural GET production-plan 200/0, three settled widths show corrected guidance, zero writes. Scoped PASS only. Next cost/dish source-derived numeric parity; checklist bottom.

**Weekly Menu production-plan empty copy (2026-09-29):** selected natural customer/week but old text asked to select them again; corrected owner scope guidance, mounted 3/3 + tsc/lint PASS. Headed after-image and GET 200/empty oracle still due; cost/dish projections not API claims. Checklist bottom.

**Weekly Menu slot parity (2026-09-28):** natural Monday source main row maps through normalized slot label to “Món mặn 1” Monday DOM cell; first raw-label probe false was invalid oracle. 40 source lines vs 20 slot rows + 4 section headers, distinct grain. Next production-plan/cost/dish-materials crosswalk; checklist bottom.

**Weekly Menu schedule scope (2026-09-28):** first customer committed GET 200 week 2026-09-21/40 source rows across six service days; UI week and Sep 21–26 headings agree, matrix 24 layout rows (different grain). Clean first six actor×width images reviewed; later metadata rerun had Admin runner error, excluded. No code edit, next source-row→slot parity. Checklist bottom.

**Weekly Menu purchase-summary fact grain (2026-09-28):** natural weekly demand aggregate GET 200/0 while BOM estimate nonzero; scoped label/empty-copy fix, owner 7/7, tsc PASS, Admin/Điều phối ×3 widths after-images. Populated handoff unverified. Next schedule committed-week source/date geometry; checklist bottom.

**Phase 36 Weekly Menu DEFAULT resumed (2026-09-28):** Kỳ batch request moved from blocked Warehouse; customer GET 200/2 options on clone. No-customer nav+selected panel scoped fix, Admin/Điều phối ×3, owner 9/9/tsc/lint PASS; six-view first-customer 1366 intake, purchase-summary zero-row/valuation candidate needs source/API oracle. MRX still PAUSED, no writes. Checklist bottom owns next crosswalk.

**Phase 36 Warehouse DEFAULT batch gate (2026-09-28):** four tabs reconciled with open lifecycle claims; zero whole-route PASS. No eligible task-owned mutation records; MRX mode and Weekly Menu paused. Do not repeat ready-cell audits; next action needs owner authorization to unpause next page or legitimate new lineage. See bottom of 36-CHECKLIST.md.

---
updated: 2026-09-27
branch: refactor/large-refactor-20260924
observed_head: 7f8c148058820ef435bda2739ce9ff880ae53cc6
active_objective: phase-36-page-locked-ui-ux-reconstruction
active_checklist: .planning/phases/36-page-locked-whole-product-ui-ux-reconstruction/36-CHECKLIST.md
active_handover: .planning/notes/PHASE36-OWNER-UI-REAUDIT-HANDOVER.md
runtime_ports:
  task_frontend: 3001
  task_api: 8001
---
# Working memory hiện hành

**WH-INFO-06 rail scope (2026-09-28):** report caps 20 documents across types, Warehouse filters 10 natural docs and locally shows four/page (previous “four” was page count). Rail now labels recent/sample scope explicitly; owner 7/7, tsc/lint PASS, Admin 3-width copy checked. 1440 stock table after-image transitional, not visual certification. Checklist bottom.

**WH-INFO-04 demand actor/grain (2026-09-28):** Admin/Thủ kho/Điều phối × three widths, candidate 1 versus aggregate 444, role command correctly gated; candidate has no allocatable stock, so no misleading “1 ready” badge. Nine images reviewed, zero writes. Next owner receiving remaining statuses or read-only movement/exceptions; checklist bottom.

**WH-INFO-03/06 receipt actor (2026-09-28):** Thủ kho receipt rail ID→GET→focused matching detail→Back at three widths, no Admin correction control; no writes, scoped read-only PASS. Demand candidate actor/state crosswalk next; see checklist bottom.

**WH-INFO-06 Chef auth resolved (2026-09-28):** aligned owned runtime, Chef headed login/mode/report 200 but same-browser natural issue-by-ID 401, Admin issue-by-ID 200; controller requires production-only actor warehouse assignment. Do not grant scope or add issue/return ID link. Resume Warehouse demand/receiving audit; checklist bottom.

**WH-INFO-06 Chef ID intake (2026-09-28):** BE issue/return by-ID endpoints exist, Chef current date/shift page does not consume document ID. Admin natural issue GET 200; Chef Playwright request 401/session auth inconclusive, stopped retries. Return natural ID unverified. No Chef deep-link added; checklist bottom owns next preflight.

**WH-INFO-06 follow-up (2026-09-28):** V5 stale footprint tests reconciled (owner suites 16/16 PASS); off-page PO route proved only with verified page-list response omission, natural page 2 unavailable. Chef issue/return selected-ID consumers remain open. Active checklist bottom owns details.

**WH-INFO-06 receipt destination (2026-09-28):** Receipt rail now resolves authenticated receipt→PO ID→PO GET→same receipt detail with focus; Admin 3 widths and mismatch denial read-only PASS scoped. Off-page PO and actor matrix still NEEDS_EVIDENCE; receipt panel footprint suite has 2 inherited stale min-height failures, owner rail suite 7/7 and tsc PASS. See active checklist bottom.

**WH-INFO-06 ID consumer crosswalk (2026-09-28):** Receipt rail ID exists in BE, but receiving mounts receipt detail only under selected PO from current page; `receiptId` alone cannot resolve off-page PO. Chef has no issue/return ID consumer. Source-only diagnosis in active checklist bottom; no pseudo-link or business write.

**WH-INFO-06 rail permission/label (2026-09-28):** Thủ kho natural issue link led `/403`; rail now displays Chef owner instead of inaccessible link, and generic authorized link says “Đến phân hệ”. Admin/Thủ kho × three widths checked, owner test 7/7, tsc PASS; selected-ID still open. See active checklist bottom.

**WH-INFO-02 task destination (2026-09-28):** generic Chef shortcut now opens existing `?view=production&task=materials` after settled Admin three-width click/Back; Điều phối exceptions GETs 403 diagnosed (not row-load bug). Evidence in active checklist bottom; no writes, no per-ID destination or whole-route PASS.

**WH-INFO-05 placement visual closeout (2026-09-28):** Admin filter adjacent to table and Thukho owner copy in settled (i) verified ×3; six final images reviewed, no writes/errors; scoped visual PASS only. Active `36-CHECKLIST.md` bottom. Return to main Warehouse audit; MRX/Weekly Menu paused.

**Approved multi-role scope (2026-09-28):** Warehouse Chef shortcut now reads “Xem bàn giao tại Bếp”, gated by `production.read`/admin; no per-ID link. Admin allocation defaults to BE-authorized `allowedActions` filter with all-history toggle; Thukho sees all history. Focused 27 tests, lint/build pass, six Admin/Thukho three-width images reviewed; dieuphoi query cell timed out, NEEDS_EVIDENCE, zero writes. Active `36-CHECKLIST.md` bottom. No whole-route PASS or MRX/Weekly Menu switch.

**WH-INFO-07 overlay inventory (2026-09-28):** active `36-CHECKLIST.md` bottom inventories all 12 DEFAULT Warehouse overlay families (0 full-flow PASS / 12 NEEDS_EVIDENCE) and grouped shell/receiving/demand/exceptions/movement proposals awaiting Kỳ approval. No production change or historical write; MRX/Weekly Menu paused.

**WH-INFO-05 settled crosswalk (2026-09-28):** Admin+Thukho three subviews × three widths, 18/18 images reviewed, GET 200, zero writes; first allocation row actor-specific allowedActions matches CTA presence, supplemental/returns naturally empty. See active `36-CHECKLIST.md` bottom. Candidate action ownership semantics and table density remain proposals, not defects; no whole-route PASS.

**WH-INFO-05 owner correction (2026-09-28):** Admin/Thukho × three exceptions views × three widths read-only GET 200/zero writes, but 1440/1920 images and transient Thukho allocation image need triage. BE returns actor-specific `allowedActions`, so Thukho “Chưa cần thao tác” is not yet a proven copy defect; tentative production change reverted. See active `36-CHECKLIST.md` bottom.

**Five-role gate closed (2026-09-28):** Thumua/Beptruong denied Warehouse by `warehouse.read` -> browser `/403` (NOT_APPLICABLE shortcut), Thukho stock shortcut three-width DOM+settled stock images PASS scoped; ledger screenshots transitional, do not cite as visual PASS. Evidence at active `36-CHECKLIST.md` bottom. No production edits/writes, MRX/Weekly Menu paused.

**Five-role read-only checkpoint (2026-09-28):** all five approved existing role credentials authenticate on clone DEFAULT/25 (one try each); quanly/dieuphoi/thukho 1366 stock link works/no self-link/ledger link returns; thumua/beptruong stock link absent, authorization reason still to classify. Evidence at bottom of active `36-CHECKLIST.md`; no secret logged, business writes, password rotation, whole-route PASS or mode switch.

**Approved stock shortcut fix (2026-09-28):** Warehouse “Xem tồn kho” now targets own stock subview and disappears on that subview; three-width headed after images and scoped gate at bottom of `36-CHECKLIST.md`. Admin observed; other role browser identities still NEEDS_EVIDENCE. No writes/whole-route PASS; MRX/Weekly Menu paused.

**Latest shell destination discovery (2026-09-28):** Warehouse “Xem tồn kho” currently opens Reports price view, not stock; three-width browser/DOM evidence and owner-choice proposals at bottom of active `36-CHECKLIST.md`. Chef screenshot transitions are not settled evidence. No production edit/write or whole-route PASS. MRX/Weekly Menu paused.

**Latest owner decision gate (2026-09-28):** Kỳ approved DEFAULT Warehouse business-information audit; MRX/Weekly Menu paused. `36-CHECKLIST.md` bottom records WH-INFO-01 selector-owned header fix (red 0/5→green 5/5, 21 after images, lint/build PASS), business-fact wave 2, and selected overlay read-only wave (`warehouse-overlay-info-settled-20260928`): 12 images reviewed across allocation/issue initial+selected/receipt detail at three widths, GET 200, zero writes. Allocation quantity/max and four compatible destination options match source; confirm enabled before required fields is a candidate, not yet defect. Issue selected historical candidate has no allocatable stock, submit disabled; posted receipt ID and line count match GET, exact label/eligibility still OPEN. Earlier 1366 disabled command was transient capture. Next bounded status/eligibility/destination check, no historical submit or MRX switch; no stage/commit. Older pointers below historical.

## Active objective

Chuẩn hóa lại quy trình FE UI/UX trước mọi production edit:

- Ponytail `full` cho BE và FE non-visual logic; đề xuất `lite` cho FE component/layout/visual work.
- Tách rõ một design authority và ba lens: SAP Fiori workbench, shadcn/Base UI mechanics, bounded Taste anti-slop review.
- Loại `ui-ux-pro-max` khỏi IPC routing; mặc định giữ source hidden cho đến khi có quyết định xóa riêng.
- Reconcile original master-plan status; dùng `test-audit` cho cleanup theo owner thay vì tiếp tục sinh source/mock tests.

**State owner:** `.planning/notes/FE-UI-UX-PROCESS-RECALIBRATION-CHECKLIST.md`

**Fresh-session packet:** `.planning/notes/FE-UI-UX-PROCESS-RECALIBRATION-HANDOVER.md`

**Prior test audit:** `.planning/notes/FE-DESIGN-SYSTEM-TEST-AUDIT.md`

**Current R1 pointer (2026-09-28):** DEFAULT receiving tab **reconciled with open claims**, not whole-flow PASS. Per-image visual assessment `.planning/phases/36-page-locked-whole-product-ui-ux-reconstruction/36-RECEIVING-VISUAL-INTAKE.md`; bounded lifecycle V5 min-height and detail GET retry fixes verified at three widths, build/lint PASS. Historical receipt mutations/denied actors remain NEEDS_EVIDENCE, no business writes. Next serial tab is DEFAULT **demand** per `36-CHECKLIST.md` “Exact next step”; Wave 4 retains overlay lifecycle. Owned ports clear, clone DEFAULT/25 preserved.

**Current approval checkpoint (2026-09-28):** DEFAULT receiving **and demand** reconciled with open claims, neither whole-flow nor Warehouse PASS. Approved demand batch finished: three-width initial loading/held page-2 GET visibility/focus and issue-dialog initial/selected/error read-only inventory; pending screenshot inconsistency disproved by targeted visible-rect rerun. Demand faux-button V7/L5 Warehouse-only fix verified ×3; no business writes. `36-DEMAND-VISUAL-INTAKE.md` owns detailed verdict; `36-CHECKLIST.md` “Approval queue” now proposes DEFAULT **exceptions** as next bounded batch. **Wait for Kỳ approval** before exceptions. Owned ports clear.

**Current approval checkpoint (2026-09-28, supersedes earlier R1 pointers):** DEFAULT receiving, demand **and exceptions** reconciled with open claims, none whole-flow PASS. Exceptions three subviews × three widths, 27 held-loading/GET-503→retry images, route history, allocation dialog/page2, E2 filtered-empty owner fix × six after-images; details `36-EXCEPTIONS-VISUAL-INTAKE.md`. Lint/build PASS, zero business writes; clone DEFAULT/25, owned ports clear. `36-CHECKLIST.md` bottom “Exact next step” now requests Kỳ approval for DEFAULT **movement** (stock/ledger/rail); do not start movement automatically. Actor/legitimate task-owned mutation lineage remains NEEDS_EVIDENCE. Weekly Menu paused.

## Exact next step

Warehouse screenshot intake reconciled: `.planning/phases/36-page-locked-whole-product-ui-ux-reconstruction/36-WAREHOUSE-SCREENSHOT-RULE-CANDIDATES.md` records **154/154** originals opened at full resolution, 0 unreviewed/missing. WH-V01–WH-V15 are provisional candidates (not 15 confirmed live defects); WH-V15 flags misleading no-records copy after unmatched ledger search, WH-V02 exceptions search adjacency, WH-V06 receiving float precision, WH-V08 intermediate allocation clipping. Next root-owner batch: rule/source/callsite sweep → red DOM/action/API oracle → bounded fix → test/lint/build → same-state headed screenshots and original after-image review. Weekly Menu remains paused.

**Latest owner correction:** R0 drifted into cross-tab single-defect probes. Return to `36-01-PLAN.md` serial page lock; active `36-CHECKLIST.md` R1 and footer direct one complete DEFAULT receiving tab batch before demand/exceptions/movement, then MRX/overlays. Scoped evidence is retained, not whole-tab PASS. Weekly Menu paused.

**Current 2026-09-28 checkpoint:** `.planning/notes/PHASE36-OWNER-UI-REAUDIT-HANDOVER.md` top section and active `36-CHECKLIST.md` bottom “Exact next step” supersede older wave summaries below. Clone DEFAULT/25 retained, owned ports clear. B7 jump/date-week/error/next-step semantics and B3 ledger error recovery are scoped only; ledger cursor page 2 blocked by natural 31-day data window. Overlay ledger now 0 full-flow PASS / 14 NEEDS_EVIDENCE; no task-owned eligible mutation. No mode switch, business write, commit or push. Earlier Phase 36 snapshots remain historical evidence only.

**Current 2026-09-28 correction:** User-provided screenshot showed that the visible 31-day scope sentence added above ledger search broke the heading/control rhythm. `WarehouseMovementPanel.tsx` now reuses `SectionPanel.description` → existing (i) `InfoNote` beside title and retains scoped empty copy. Three-width headed click/Escape/focus + settled closed/open images: `.artifacts/phase36-clone-runtime/wh-b3-ledger-info-settled-20260928/result.json`; lint/build PASS. Historical 154 screenshots are **not exhaustive**: the active checklist now requires proactive route/tab/state/action discovery as well as image-candidate resolution. Fresh returns-tab click × three widths found no pending returns, so receipt mutation remains NEEDS_EVIDENCE. Current pointers: active `36-CHECKLIST.md` “Exact next step” and top of Phase 36 handover. No mode switch, business write, commit or push; owned ports clear. Older notes below are historical.

Phase 36 Warehouse re-audit active; Weekly Menu paused. Clone `ipc_phase36_ui_20260927_001` migrated to 82, mode DEFAULT/25. Scoped headed evidence: DEFAULT 21 geometry cells, demand next-page GET/focus; MRX two tab clicks × three desktop widths and legacy recovery action→history→Back→Forward red→green; DEFAULT receiving natural PO detail click→focus→Back/Forward, region bounded at three widths. No business writes; historical pending request not task-owned. Remaining overlay, transient, shared-consumer browser, full→short→full and legitimate mutation cells open. Owned ports 3001/8001 clear, clone retained; protected lane7 untouched, no commit/push.

## Current repository facts

- Local commit `7f8c1480 refactor(frontend): converge design system ownership`; branch ahead origin 1; no push.
- Phase A owner confirmation and Phase B harness/design-governance update completed on 2026-09-27. Harness check, self-test and scoped diff check passed; live Pi discovery requires `/reload` or a fresh process.
- Phase C truth mapping completed: design authority/kit is `DONE` at the accepted source boundary; physical stylesheet/folder migration is `PARTIAL`; five redesign-named live-owner files and unavailable runtime cells remain separate `OPEN_RESIDUAL`; prior campaign stays closed.
- Phase D read-only baseline completed: full inventory `.planning/notes/FE-TEST-AUDIT-PHASE-D-BASELINE.md`; 18-file declaration ledger `.planning/notes/FE-TEST-AUDIT-PHASE-D-COHORT.md`; focused 18 files / 39 tests PASS.
- Phase E complete: 15/18 raw-source presentation files retired through serialized owner lanes; cumulative frontend test diff 74 additions / 302 deletions (net -228 lines). Three `F/R` files remain intentionally: Admin cleanup, weekly cost, mixed Warehouse page contracts.
- Phase F pilot complete: Approvals initial loading surface no longer reserves arbitrary 32rem workspace height; mounted regression was red pre-fix and green post-fix; Approvals 6 files / 45 tests PASS.
- Phase F2 closed at `PASS_BOUNDED_WITH_NEEDS_EVIDENCE`; route lazy fallbacks remained the only runtime evidence family.
- Phase 36 Warehouse W4 route geometry remains historical evidence only; whole-page UI/UX verdict was withdrawn after screenshot/action review. Live headed red DOM oracle confirms the allocation row action clips beyond its panel owner, with zero business writes; see active Phase 36 checklist and W4 correction.
- Weekly Menu prerequisite source correction: `QueryViewBoundary` mounts children but renders them `invisible`/`inert`/`aria-hidden` while blocked; the older description that children do not mount is inaccurate. Its page lock is paused behind Warehouse re-audit.
- Final gates: Coordination/Purchasing/Chef `37 files / 229 tests`, Warehouse `15 files / 108 tests`, ESLint, frontend production build and scoped diff-check PASS. No unexpected browser writes/page errors; owned runtime stopped and ports `3001/8001` clear.
- Task-owned Phase B–F paths: prior harness/design docs, closed browser checklist/handover, Phase D ledgers, frontend test cleanup diff, bounded fallback geometry fixes, `ApprovalQueryPanels.tsx`, and mounted Approval regression. No commit/push.
- Prior FE design-system campaign closed at `OWNER_ACCEPTED / CLOSED_WITH_DOCUMENTED_RESIDUALS`; ledger §§68–69.
- Index clean at intake. Preserve inherited untracked paths: `.agents/skills/diagram-design/`, `docs/diagrams/`, `scripts/diagram_tool.py`.
- No owned runtime; browser objective teardown proved ports `3001/8001` clear.
- Browser measurement authorized four bounded fallback corrections; no package mutation, mode switch, seed, DB/business mutation, evidence reseal, commit or push occurred.

## Historical pointer

The pre-compaction working memory was preserved verbatim at:

`docs/archive/agent-memory/MEMORY-pre-fe-ui-ux-process-recalibration-20260927.md`

Do not auto-load it. Use `HISTORY.md`, closed ledgers and evidence index only when investigating a specific prior claim.

Phase 36 latest Warehouse DEFAULT read-only receipt/status/correction and rail destination crosswalk: see the last checkpoint in `.planning/phases/36-page-locked-whole-product-ui-ux-reconstruction/36-CHECKLIST.md` and local `warehouse-status-destinations-settled-20260928` artifact. No historical writes; rail document-ID destination absent, no whole-route PASS. MRX/Weekly Menu paused.
