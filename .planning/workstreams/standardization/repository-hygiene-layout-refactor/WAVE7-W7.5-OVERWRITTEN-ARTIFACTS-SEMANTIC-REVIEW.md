# Wave 7.5 — overwritten `.artifacts` semantic review

Date: 2026-09-24
Mode: read-only; no evidence byte, index row or hash changed.

## Result

Seven index actions were reviewed and applied in one evidence-index-only batch:

- 2 `RESEAL_CURRENT_BYTES_AFTER_SEMANTIC_REVIEW`;
- 4 `RETIRE_STALE_REFERENCE`;
- 1 `RETIRE_DUPLICATE_STALE_ROW`.

No evidence file changed.

## Current bytes still support the indexed semantic claim

### Canonical menu readback

Path:

`.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/canonical-import-readback.json`

Current evidence records:

- `status: PASS`, `mode: readback-only`, exact lane `ipc_lane7`;
- ANV and DAV week `2026-08-17`, version 1, `DRAFT`;
- both source workbooks and `successRowCount: 120`;
- DOM readback has one ANV and one DAV row;
- zero console/page/request failures;
- `protectedLaneConnectionAttempts: 0` and run-owned teardown.

This remains semantically aligned with the indexed description. Indexed bytes were unavailable, so the reviewed current hash was resealed explicitly; no evidence bytes were changed.

### Stage 1 diagnostic

Path:

`.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/stage1-diagnostic/result.json`

Current evidence records `READ_ONLY_PASS`, exact lane, zero protected-lane attempts/errors, successful customer selection, demand-tab activation/focus and a visible demand panel. The index already labels this diagnostic as old, non-Golden and superseded by physical Stage 1 PASS.

Current semantics therefore still match the bounded historical claim. The reviewed current hash was resealed while retaining the non-authoritative/superseded description.

## Current bytes contradict the indexed claim

### Daily service-run close

Indexed description: Chef login returned 401 and the run stopped before business mutation.

Current file:

- actor `beptruong`;
- `status: passed`;
- an existing closed service run renders after repeated successful GETs;
- zero mutation requests and browser failures.

The current artifact is a different read-only attempt at the same path. The stale indexed row was retired; its description was not rewritten to manufacture continuity.

### Manager reconciliation JSON and screenshot

Indexed descriptions and historical `MEMORY-pre-harness-20260908.md` describe a Manager retry.

Current JSON records `actor: admin`. The current screenshot visibly shows `Admin User / Giám đốc / Admin`, not Manager. Although both current files show the reconciliation-required surface with no unauthorized execution action, they cannot support the indexed actor/provenance claim.

Both stale indexed rows were retired. Current Admin evidence remains on disk but is not promoted under the former Manager claim.

### Table performance manifest

Indexed description claims:

- production-build headed run;
- 44 route/tab probes;
- 35 rendered table instances, all fixed layout.

Current manifest records:

- 44 route probes;
- 31 table probes/tables;
- development module URLs such as `/src/...` and `?t=...`;
- zero non-fixed tables/errors/mutations, max CLS `0.04127`, four long tasks.

The stale indexed row was retired. The current 31-table development run remains on disk but is not promoted under the former production/35-table claim.

## Duplicate stale row

Path:

`.artifacts/shipyard-live/phase-05-service-run-live-20260812-final/submit-approve-create-current-pr/api/result.json`

`docs/EVIDENCE-INDEX.md` contains two consecutive rows for the same path:

- line 106: earlier Admin-submit/Manager-401 attempt with hash `067E...16F2`;
- line 107: later Manager approval/PO-create attempt with hash `17A1...B3E`, exactly matching current bytes.

Line 106 was retired; line 107 remains unchanged. This removed the stale duplicate claim without changing evidence bytes or the valid current hash.

## Limits

A broad sibling-hash search across the large `.artifacts/shipyard-live` tree exceeded the bounded command window. Git/history analysis had already established that the six indexed byte versions are unavailable in tracked history. No absence claim beyond that proven Git lineage is added here.

## Applied mutation and denominator

The atomic evidence-index-only edit:

1. removed the four stale contradictory rows;
2. removed duplicate line 106 only;
3. resealed the two semantically aligned current hashes;
4. changed no evidence bytes.

Corrected scanner result:

- 353 total references;
- 350 indexed file rows;
- 3 declared directory roots;
- 2 hash mismatches;
- 0 missing references.

The only remaining mismatches are the two Golden XLSX deterministic-builder blockers.

Machine disposition: `wave-7-overwritten-artifacts-semantic-disposition.json`.
