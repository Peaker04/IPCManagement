# MRX end-to-end render continuity — design specification

## Status and intent
Proposed for operator review. Covers all seven findings in the latest MRX deep audit; supersedes incomplete no-flash acceptance in earlier continuity plans, not their independent fixes. This document is not execution evidence. Native parent implementation remains the selected method; no automatic delegated reviewers.

## Problem and source truth
A stable DOM in StateBoundary did not fix independent report opacity, LocalizedBoundary replacement, source/editScope two-phase loading, cross-view fallback tables or modal geometry. Latest focused audit baseline: 194 tests in four suites passed; browser was not run. Existing repeated green suites do not certify rendered continuity.

### Scope
FR-DASH, FR-MENU, FR-WH, FR-CHEF, FR-RECON, shared FR-CAT/FR-SYS surfaces and NFR-UI. DOM-MODE-1 remains mandatory.
- MRX dashboard `/`.
- `/weekly-menu?view=mrx-batch|mrx-materials|mrx-plans`, source edit/review/inbox and import/history/snapshot.
- `/warehouse?view=mrx-daily|mrx-preparation|mrx-issues`, demand/history and detail/supplemental dialogs.
- `/chef?view=mrx-cooking`, shift/search/master-detail.
- `/reconciliation?view=lines|variances|transactions|audit|completed`, warehouse/source audit subtabs, filters/pages/customer/month/batch/day, detail/disposition/completion/picker.
- MRX-accessible `/admin-data` leaves and `/settings/advanced?view=mode`; login/denial/session overlays are shared regression surfaces. DEFAULT-only routes are denial checks, not MRX workflow coverage.

## Decisions
Use current owners, no new query framework or universal controller. Keep previous data only for the same kind of work object; present it explicitly as previous scope while read-only. Changing view schema is different from changing page/scope. No blanket delay, minimum duration, opacity fade or delayed state commit. Immediate geometry-matched cold skeleton is canonical DESIGN section8 behavior. Intentional navigation to another screen may replace its body; it must not briefly show the wrong view or unlabelled foreign data.

## Contracts and acceptance criteria
### AC1 Report brightness / finding1
All report views keep full content brightness during same-view pending. Keep inert, aria-busy and stable progress indicator. No whole-report opacity70 branch remains. Real DOM identity and controlled computed-style browser assertions are distinct evidence.
### AC2 Same-scope recovery / finding2
The exact report key includes actor/mode, tab/subtab, batch and page. Same-key recoverable read500 preserves table, local query, focus and scroll with inline retry/error; new-key failure never promotes old rows as current. True403/mode409/lineage/conflict remain blocking according to current owner contracts; don't preserve sensitive content under denial. Returning from error must not remount a same-key workspace. No blanket weakening of the existing report failure test.
### AC3 Source readiness / finding3
On a cold source scope, reserve the actual source matrix geometry until editScope is ready. Never transition through a centered loading sentence between skeleton and grid. Edit-scope/dish errors settle to truthful error/retry; no endless skeleton. Do not postpone a usable read-only matrix solely for unrelated catalog work unless its cells genuinely require that catalog. Retain source draft and dirty-navigation behavior on warm recovery.
### AC4 Schema-correct view transitions / finding4
Switching report tabs or materials/plans immediately selects the target schema and target toolbar. Retained payload may drive rendering only when its view/subtab matches that schema. Same-view pagination/scope changes retain shell/query while pending. New schema may use its own immediate skeleton, not the previous view's columns. Clear or preserve local state deliberately by view/scope; never accidentally carry a disposition/draft into another batch. Late responses cannot replace the selected target.
### AC5 Detail modal geometry / finding5
Issue detail has bounded viewport-aware height and one scroll owner, using the existing frozen-dishes dialog pattern. Loading, error, empty and populated payload share the frame, fixed title/footer positions and accessible focus trap. Do not clip long Vietnamese metadata, touch controls or large row sets at390x844 and1440x900.
### AC6 Import history geometry / finding6
History has persistent target table header, bounded body and count placeholder while loading; error and empty are distinct. Do not show zero as a known count before response. Customer changes and stale snapshot replies cannot display another customer's payload. Keep rollback/import dirty state and focus intact. Mock fixtures only in tests; live acceptance must not import/rollback business data.
### AC7 Evidence / finding7
Each repaired behavioral contract has one strongest owner RED→GREEN regression with backend-grounded DTOs, no mocked subject/test seams/skips/allowlist padding. Replace tests that demand a wrong-schema fallback; keep meaningful no-white-gap, same-scope identity, permission and latest-response checks. Pure CSS class tests are not temporal proof.
### AC8 Whole-MRX acceptance
A route/view matrix records PASS/FAIL/BLOCKED/NEEDS_EVIDENCE per interaction. Each eligible leaf gets cold entry, warm return, back/forward, available filter/scope/page changes, empty and error/retry journeys; each named dialog gets loading/success/error/close/focus checks. Source edits/import/apply/issue/complete/rollback live writes are not authorized by this spec: use controlled HTTP owner tests for those transitions and mark persisted live write acceptance blocked.

## Browser protocol and thresholds
Dedicated contexts with confirmed local DEV and preview URLs/build identifiers, actual actor/mode and environment credentials; no user profile, fake auth, seed, process restart, installation or mode switch. Run desktop1440x900/mobile390x844 × normal/reduced motion. Capture bounded frame samples beginning before action through GET settlement and two painted frames: no blank work surface; header/badge/toolbar/table top plus modal rectangle and scroll/focus identity. Same-workspace anchors within1CSSpx, general CLS<=0.1 and cold work-object CLS<=0.05; include recent-input shifts. Intentional different-schema/modal navigation is judged against its target frame, not a false requirement that unrelated screens have equal geometry. Redact URLs/IDs as needed; no bearer/password traces or request-body artifacts.

## Closure and exclusions
Code gates: full FE unit/contracts, lint, production build, standalone browser types, diff check, direct scoped code/UI/test review. Evidence must distinguish controlled DOM, controlled browser and live authorized reads. No 'triệt để' closure unless AC1–AC8 have actual evidence; missing credentials/preview/data yields BLOCKED, not PASS. No backend/business/parser/security redesign, dependencies, auto-commits, deploys, DB mutations or delegated execution. WORK.md is sole task-status owner.
