# MRX Compact Scope and Inspection Follow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Owner method is direct-parent/current checkout; no delegated implementers/reviewers, new worktree or automatic commits.

**Goal:** Deliver approved compact multi-customer selection A, all five new screenshot/navigation requests, and the still-open earlier MRX remedies without confusing source/test completion with owner acceptance.

**Architecture:** Reuse existing preparation selection callbacks, workbench/formatting primitives and installed Base UI popover. Keep confirmed weekly-menu context as a dedicated field in the existing workspaceSessionStore; AppShell emits explicit scoped re-entry URLs. Inspection and frozen presentation stay at existing feature/dialog owners; backend quantity/frozen/mutation authority is unchanged.

**Tech Stack:** React19/TypeScript, existing @base-ui/react/popover, Tailwind semantic tokens in index.css, Vitest/Testing Library, installed headed Chrome/Playwright; existing .NET9 contracts only for fixture/requirement grounding.

**Spec:** `docs/superpowers/specs/2026-11-07-mrx-followup-compact-scope-and-inspection-design.md`; original `2026-11-07-mrx-uat-complete-remediation-design.md` still owns R01–R15/U00–U12.

## Global Constraints

- `.planning/WORK.md` is sole live task/acceptance ledger; checkbox steps here describe planned work, not completed state.
- Approved A is binding. R17–R21 expanded design awaits owner review; this request adds requirements to plan, not permission to implement before that review.
- Preserve DOM-MODE-1, existing RBAC, exact batch identity, frozen date/rate/unit facts, pending/outcome-unknown and dirty navigation.
- No new dependencies, synthetic production data, seeds/migrations, business writes, runtime restart, credential use, staging/commit or delegation inferred here.
- All FE tasks require scoped pre-code UI gate + Impeccable craft-floor/design assessment before code; post-code actual rendered layout assessment and detector. No self-invented design system or detector-only PASS.
- Typography>=12px, regular operational rows36–40px, one primary command, proper sticky header/identifier for horizontally scrolling tables, one blocking overlay/one dialog vertical owner.
- HTTP failures must not turn into data-empty; no first-customer/current-week/BOM/servings fallback; URL identity wins and late source results cannot replace current scope.
- Existing fourteen canonical routes remain fourteen; sidebar remains sole view navigation authority. Do not recreate embedded tabs/quantity summary.

## Review Focus

1. Two batches for one customer and disabled/already-issued batches: selection by batchId, no merged identities or silently dropped hidden choices (Task1).
2. Weekly scope → non-weekly route with another service date → either inspection leaf: restore confirmed weekly pair, not unrelated generic scope; explicit URL/cold/no scope/logout remain correct (Task2).
3. Repeated “Xem” actions must still identify/open the exact row by date/shift without visible generated plan codes (Task3).
4. Same ingredient at different frozen dates/units/rates must remain distinct after hierarchy changes; long names/headings must not hide key numbers (Task4).
5. A clean source scan/test aggregate must not close visual/real-data acceptance; genuine200% and print/actor checks have separate authority/evidence (Tasks6/7).

## File map / existing owners

- Create `frontend/src/features/warehouse/branches/MrxPrepCustomerSelector.tsx`: feature-local anchored selection panel, no generic primitive family.
- Modify `features/warehouse/branches/MrxPrepAllocationsBranch.tsx`: replace oversized fieldset with selector + compact scope/find composition; remove superseded customer-slab markup.
- Modify `store/workspaceSessionStore.ts`, `components/workbench/AppShell.tsx`, `features/weekly-menu/MrxQuantityInspectionPage.tsx`, and `features/weekly-menu/hooks/useMrxBatchWorkspace.ts` / its real `MrxBatchWorkbench.tsx` consumer: remember only confirmed weekly scope and generate explicit return links. Use existing owner, not another store/context or automatic mount-time URL rewrite.
- Modify `features/weekly-menu/MrxQuantityInspectionPage.tsx`: provenance, plan list code/action and column geometry.
- Modify `components/workbench/MrxBatchDishesModal.tsx`: frozen daily section/date/table hierarchy.
- Shared slot presentation, if extracted: `constants/mrxConstants.ts` plus actual `MrxShiftDishesModal.tsx` and inspection consumers; no test-only export or inferred unknown-as-main rule.
- Modify real metadata owners only: `docs/conformance-contracts.json`, consumed table/surface contracts if geometry changes; no baseline/allowlist/exemption padding.
- Tests: existing `Warehouse.test.tsx`, `WeeklyMenu.test.tsx`, `AppShell.test.tsx`, `Reconciliation.test.tsx`, `Primitives.test.tsx` only where relevant, and `frontend/tests/browser/mrx-menu-remediation.spec.ts` under the existing launchless config. Retain strongest tests, no duplicate fixture matrix.

### Task1 — Approved A: compact searchable multi-customer selection (R16/R14)

**Interfaces:** `MrxPrepCustomerSelector({ batches, selectedBatchIds, scopeLocked, onToggleBatch })`, where batches is `MrxPreparation['batches']`, selectedBatchIds is `string[]`, onToggleBatch is `(batchId: string) => void`. No API or new selection state; only panel open/search state is local. Consumes existing preparation callbacks; produces same exact selected IDs and one bounded control for layout.

- [ ] Load test-audit/ipc-test-audit and Impeccable craft-floor; declare scoped UI gate in WORK. Ground fixtures in current generated MrxPreparation DTO.
- [ ] Extend Warehouse's real preparation/export owner: open “Khách hàng”, search without changing selected scope; toggle exact batch; close/reopen retains choices; ineligible/already-issued blocked; zero selection still allows reopening; pending/outcome-unknown forbids changes. Distinct batch IDs under one customer must stay distinct. Observe intended interaction RED before owner repair; not a class-name assertion.
- [ ] Implement feature selector using installed Base UI Popover and current primitives. Keep selected-count/current-scope summary visible, no unbounded tags, no Apply button. Panel checkbox changes call existing callback immediately; disabled reason visible and labelled.
- [ ] Replace old legend/min-h slab in allocations branch. Closed control shares compact scope/search composition without an extra75px strip. Keep Excel-only utility distinct and no-selection guidance. Preserve stock/export/unknown-outcome behavior.
- [ ] Run `cd frontend && node ../node_modules/vitest/vitest.mjs run src/__tests__/Warehouse.test.tsx`; expected PASS/no skips. Extend existing browser fixture with zero/one/many/long-name cases, actual closed-control bounds and Escape/focus return, not business writes.

### Task2 — Remember the confirmed weekly pair across route exits (R20/R10/R06)

**Interfaces:** extend existing `WorkspaceSessionScope` with `weeklyMenuScope?: { customerId: string; weekStartDate: string } | null`. Existing `getScope`, `setScope(patch)`, subscription/persist and `clearScope` remain APIs. Use `setScope({ weeklyMenuScope: { customerId, weekStartDate } })` only after matching source resolves. Missing/corrupt/invalid pair normalizes null; no new store or inferred date.

- [ ] Add a behavioral regression at existing AppShell/WeeklyMenu owners: confirmed customer/week on either weekly leaf → /warehouse with a different date → sidebar materials/plans → href and rendered customer/week retained; Back/F5 respect URL. Assert explicit other pair overrides saved scope, cold-no-pair asks selection, logout clears, denied mode/actor remains denied. Observe actual cross-route missing-query RED.
- [ ] Add nested field to existing store load/persist/clear; generic warehouse serviceDate changes must not touch it. Validate Monday/customer together. Update real typed consumers affected by the optional nested field, not test-only wrappers.
- [ ] Remember matching requested source pair from both inspection and batch paths. Ignore late/failed/different-pair source and avoid creating a saved scope from mere dropdown defaults.
- [ ] Update AppShell weekly MRX leaf href generation: current valid explicit weekly URL pair first, otherwise confirmed weeklyMenuScope when returning from other routes. Never propagate action/batchId, combine partial mismatched pairs, use generic serviceDate, or expose remembered MRX context in DEFAULT. Keep dirty navigation owner and active-leaf rules.
- [ ] Run `cd frontend && node ../node_modules/vitest/vitest.mjs run src/__tests__/AppShell.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/WorkspaceScopeContext.test.tsx`; expected behavioral PASS/no skips. Extend existing launchless browser test with route detour then return, explicit deep link and reload.

### Task3 — Provenance formatting, no plan code, “Xem” only (R17/R18/R19)

**Interfaces:** existing inspection page props/view, query DTOs and PlansTable rows unchanged. `planCode` remains data/row context, just not list rendering. Open detail receives same PlanSummaryItem; visible action “Xem”, accessible identity contains actual row date/known shift.

- [ ] Apply Impeccable decision table in spec: title/scope → labelled provenance and distinct preparation link → search/table. Write scoped UI gate; retain all six states and source-fingerprint notices.
- [ ] Extend existing plans owner assertions: menuName visible, generated planCode absent from list; each visible “Xem” opens the correct day/shift dishes. Update browser expectation currently concatenating “Thực đơn tuần đã chọn KH01” to menu-only identity. No new test for copy alone unless it protects this real row-detail action.
- [ ] Remove only list IdentifierText(planCode), remove visible numeric dish count/separator, add contextual accessible action name. Keep identifiers in DTO/API/exports and modal data; do not broaden to removing all ingredient/document codes.
- [ ] Compose shared materials/plans provenance from actual source fields with visible label/value hierarchy and secondary preparation navigation. Bound search separately, wrap by group on tablet/zoom. Preserve empty/error/403/partial/reload states; do not add another banner or primary command.
- [ ] Address narrow contributor headings and raw slot presentation within same inspection owner: use canonical known slot labels or explicit unknown label, not a new guessed taxonomy. If sharing resolver, move real existing consumer too; preserve raw keys and fixture/schema identity. Ensure headers/values can be read via appropriate width/wrap and table scrolling.
- [ ] Run `cd frontend && node ../node_modules/vitest/vitest.mjs run src/__tests__/WeeklyMenu.test.tsx src/__tests__/FullMrxModernizationSmoke.test.tsx`; expected PASS. Use actual browser bounds/screenshots for hierarchy/spacing, not CSS string tests.

### Task4 — Frozen material hierarchy, not frozen-data rewriting (R21/R13)

**Interfaces:** MrxBatchDishesModal props and MrxBatchDishSummary facts unchanged. ingredientCount uses ingredient+canonical-unit identity; materialDates uses actual serviceDate. No endpoint or persistence change.

- [ ] Read retained Reconciliation/frozen-rate owner tests and source. Use Impeccable hierarchy: section title primary, count supporting, service-date subgroup next, table headings quiet, ingredient primary/code secondary and rate right-aligned.
- [ ] Update actual caption/heading/table composition using semantic tokens, consistent column alignment, six decimals and one dialog vertical scroll owner. Keep distinct dates/rates/units/lineage, unknown facts, filters/search/error/403/retry and focus return. Do not deduplicate daily evidence or remove ingredient codes under R18's list-only request.
- [ ] Run `cd frontend && node ../node_modules/vitest/vitest.mjs run src/__tests__/Reconciliation.test.tsx src/__tests__/Primitives.test.tsx`; expected retained precision/date/unit/access contracts PASS. Pure hierarchy/spacing changes need rendered evidence, not another class test.
- [ ] Browser-check two dates with same ingredient/different rate, long names/units, keyboard selection and modal close/focus. Mark real frozen lineage/request-reload separately from fixtures.

### Task5 — Close real conformance gaps, not exemptions

**Interfaces:** actual workbenchSurfaceRegistry admin.bom geometry and canonical DOMAIN BR-MRX EDIT/TRUTH/HIST/SERV requirements are inputs. Conformance records must resolve to real capabilities, source/tests and evidence readiness; no false READY.

- [ ] Run `node --test scripts/check-conformance-contracts.test.mjs scripts/extract-backend-action-index.test.mjs`; confirm current27/29 failures are admin.bom missing surface and canonical MRX requirement ownership, not assume history.
- [ ] Read actual admin.bom registry/feature/capability/table and each missing canonical requirement statement; add the real owning surface/requirement mappings and correct statement digests using established contract format. Do not add arbitrary evidence paths, empty owners, exemptions, duplicate capability IDs or lower tests.
- [ ] Update consumed inspection/preparation geometry metadata only where Tasks1–4 change actual geometry. Run validator and extended tests; expected PASS or explicit substantive remaining defect, not suppression.

### Task6 — Finish/recheck earlier R01–R15 without rebuilding green work

- [ ] Use original spec/plan and WORK to map every remaining R to its actual owner/evidence: R01/R02/R11 importer recovery/queue/current-new/completed; R03 preview full week; R04/R05 early servings/reason; R06 dirty/pending/Back; R07/R08 true merge/group editing; R09 short shifts; R10 independent pages; R12 correct batch command; R13 frozen facts; R14 compact scope; R15 cooking rows/detail/export/print.
- [ ] Run affected owner suites and inspect actual UI scenarios. Fix only demonstrated remaining source defects at existing owners; each nontrivial bug requires intended RED→GREEN, not a test that fails at unrelated setup. Do not recreate already-proven logic to manufacture RED.
- [ ] For real actor/customer/week, file recovery and persistence: confirm identity/credential/target/authority before any authenticated read or write; U12 remains separately authorized. Record blockers precisely. No sample data or automatic issue/import/source apply for screenshot success.
- [ ] Keep whole-batch export versus filtered full-set printing, unchanged frozen days and unknown-outcome/no-resend protections. Native print preview/cancel and true browser200% are acceptance tasks, not merely beforeprint events or smaller viewport.

### Task7 — Final Impeccable, automated gates and evidence closure

- [ ] Inspect final diff with ipc-code-review + ipc-ui-review/test-audit; distinguish inherited dirty changes. No delegated reviewer unless newly authorized.
- [ ] Run `npm run test:fe:unit` (canonical heap/serial launcher), `npm run build -w frontend`, `npm run lint -w frontend`, `npm run depcruise -w frontend`, `npm run check:architecture-growth`, `npm run check:conformance-contracts`, `npm run test:conformance-contracts`. Record actual counts/skips/warnings and nonzero failures.
- [ ] Run installed Impeccable layout scan on changed TSX owners; keep its findings separate from visual judgment. Dedicated browser command: `IPC_REMEDIATION_BASE_URL=http://127.0.0.1:5173 node node_modules/@playwright/test/cli.js test --config=frontend/tests/config/playwright.mrx-remediation.config.ts --headed --workers=1`. It must not start servers or use generic mock-login/global DB setup.
- [ ] One batched1440×900/1024×768 pass across changed surfaces and affected prior cases; inspect actual screenshots, keyboard/focus, panel dismissal, no-selection and long labels. Actual200% requires verified browser zoom; failed shortcut/unchanged zoom remains unverified, never substituted by viewport/CDP scaling. Product fixes from batch → at most one confirmation round; environment failures described separately.
- [ ] Update WORK table for R01–R21 and U00–U12: source, automated, rendered, real actor/request/reload, owner acceptance. No row closes merely by existing test totals. Record conformance/zoom/print/auth limitations honestly. `git diff --check`, HEAD/index preserved; no commit/stage/runtime action as part of close. Return IDLE with explicit per-scope PASS/FAIL/NEEDS_EVIDENCE/BLOCKED.

## Coverage/self-review

R16→Task1; R20→Task2; R17/R18/R19 plus old inspection presentation residuals→Task3; R21→Task4; inherited metadata gaps→Task5; all old R01–R15→Task6; all evidence/Impeccable/UI gates→Task7. Original U00–U12 stay binding. Tasks1 and3 meet at scope/find composition only; Task2 supplies URL scope without coupling to selection state. Task4 does not consume current-source projection. Task5 must describe actual delivered geometry/readiness from Tasks1–4. No independent new business API, data store, classifier, styling authority or runtime permission.

Execution handoff: preserve the already selected inline method. Owner reviews this expanded plan/design before implementation; approval of A alone is not acceptance of remaining screenshot outcomes.
