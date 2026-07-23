---
phase: 06-admin-shadcn-cutover-manual-crud
status: planned
nyquist_compliant: true
wave0_plan: 06-02
gate: D
---

# Phase 6 Validation: Admin shadcn cutover & manual CRUD

## Validation strategy

Phase 6 is validated from the server contract outward: Phase 5/Gate C and ownership readiness, canonical RTK/state authority, compile-clean Wave-0 contracts, workbench extraction, stable table/search/actions, manual dialogs, destructive apply, then integration/browser/visual Gate D. No Phase 7 removal is part of this phase.

Every source-changing task must:

1. Re-run GitNexus upstream impact for every existing and future symbol named by that task. A future/not-found result is recorded as a lower bound.
2. Compare the Phase 6 pre-edit ownership/hash manifest before editing and before commit.
3. Treat `DataTableShell` CRITICAL and `DialogContent` HIGH as protected. Phase 6 uses BOM-specific wrappers/styles instead.
4. Run `node .gitnexus/run.cjs detect_changes -r IPCManagement --scope all`; unexpected or unresolved HIGH/CRITICAL blocks.
5. Preserve old API/hooks until Phase 7 and never stage unrelated dirty work.

## Requirement matrix

| Requirement | Plans | Automated evidence | Blocking condition |
|---|---|---|---|
| CRUD-01 | 06-01, 06-02, 06-03, 06-05, 06-07 | API payload tests; global/customer add/version/stop component and Playwright flows; backend Phase 5 integration | Missing reason/server actor contract, hard-delete/overwrite history, lost manual action |
| UI-01 | 06-01, 06-02, 06-03, 06-06, 06-07 | Adapter equality tests; summary component tests; search-before/after E2E request inspection | Any total/token/payload/eligibility derived from filtered rows |
| UI-02 | 06-01, 06-02, 06-06, 06-07 | Apply prerequisite matrix, DTO payload allowlist, keyboard/dismissal tests | Missing hash/date/count/backup/Gate C, unsafe enabled CTA, client authority |
| UI-03 | 06-02, 06-04, 06-07 | Component colgroup/state tests; Playwright box/header-width matrix | More than 1px same-viewport drift, wrong 520/440 height, page overflow |
| UI-04 | 06-02, 06-04, 06-07 | Search computed padding/icon geometry; same-top nowrap action assertions | Icon overlaps text or Sửa/Ngừng wraps/shrinks at 1365/1280 |
| UI-05 | 06-02, 06-03, 06-04, 06-05, 06-06, 06-07 | Testing Library dialog naming/focus/live states; Playwright keyboard/focus/contrast-aware text states | Unnamed dialog, missing focus return, color-only feedback, unsafe dismissal |

## Decision coverage

| Decisions | Primary plan/test |
|---|---|
| D-06-01, D-06-05, D-06-11 | 06-03 workbench/summary tests |
| D-06-02 | 06-01 no-install gate; 06-05 BOM-specific Base UI wrapper |
| D-06-03, D-06-04, D-06-06, D-06-07 | 06-04 table/toolbar tests and 06-07 geometry audit |
| D-06-08 | 06-05 manual dialogs and 06-07 both-scope E2E |
| D-06-09, D-06-10 | 06-06 apply dialog and 06-07 safety/keyboard E2E |
| D-06-12, D-06-13, D-06-14 | 06-07 visual/a11y/geometry Gate D |

## Wave-0 contract

Plan 06-02 creates four compile-clean failing-first files. Tests must be discovered normally and fail only with `PHASE6_MISSING_BEHAVIOR:` until the owning implementation plan turns them green. Compile, type resolution, test discovery, jsdom/dependency, fixture and timeout failures are invalid red states.

| Test file | Turned green by |
|---|---|
| `BomMigrationWorkbench.test.tsx` | 06-03 |
| `BomTableViewport.test.tsx` | 06-04 |
| `BomManualDialogs.test.tsx` | 06-05 |
| `BomApplyDialog.test.tsx` | 06-06 |

## Automated gate order

```powershell
powershell -File scripts/Test-BomPhase6Prerequisites.ps1 -EvidenceDirectory .artifacts/bom-v1.1/gate-d/phase6-preedit -RequireGateC -RequireBackup -RequireDtoInventory
npm run test:unit --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
npm run test:controls --workspace frontend
npm run test:smoke --workspace frontend
npm run test:ui-audit --workspace frontend
npm run test:visual --workspace frontend
powershell -File scripts/Test-BomPhase6Compatibility.ps1 -EvidenceDirectory .artifacts/bom-v1.1/gate-d -RequireGateC -RequireBackendIntegration -RequireFrontendFull -RequireOldWriterRuntimeConsumersZero
node .gitnexus/run.cjs detect_changes -r IPCManagement --scope all
git diff --check
```

## Geometry fixtures

At 1365x900 and 1280x900, record toolbar, table shell and every header box for full, searched, loading, error, dataset-empty and search-empty. Same-viewport x/y/width/height delta is at most 1px. Desktop table height is 520px. At 390x844 the table height is 440px and horizontal overflow is table-local. Document scroll width exceeds viewport by no more than 2px.

Search input computed padding-left is at least 36px and text begins at least 8px after the 16px icon. Sửa/Ngừng have equal top coordinates within 1px, do not wrap/clip and remain at least 68px/76px wide at both desktop targets.

## Gate D entry conditions for Phase 7

Gate D is PASS only when:

- Gate A/B/C, backup and Gate C evidence ID remain valid.
- Backend canonical preview/apply/manual integration and all frontend suites pass without skips.
- Search does not change server totals, manifest token, payload or eligibility.
- Add/version/stop works for global and customer fixtures and preserves history.
- Apply is disabled for stale preview, blocker, missing backup, missing Gate C or disabled server feature.
- Canonical UI makes zero runtime calls to the old writer. Old hooks/endpoints remain inventoried for Phase 7 removal.
- No protected dirty file/snapshot changes, package install, generic DataTableShell/DialogContent edit or unexpected GitNexus flow exists.

Any failed condition writes BLOCKED and prevents Phase 7; no snapshot weakening, production enablement or legacy deletion is an accepted workaround.

