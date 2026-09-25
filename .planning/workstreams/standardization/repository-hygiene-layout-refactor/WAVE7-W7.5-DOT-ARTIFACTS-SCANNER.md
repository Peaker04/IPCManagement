# Wave 7.5 — `.artifacts` lineage and corrected scanner

Date: 2026-09-24

No indexed evidence bytes or hashes were changed during lineage analysis.

## Thirteen raw mismatches

| Disposition | Count | Result |
|---|---:|---|
| `INDEX_VALID_WORKTREE_EOL_FALSE_POSITIVE` | 5 | Indexed hash equals the `HEAD`/introducing Git blob and LF-normalized checkout. |
| `STALE_DUPLICATE_INDEX_ROW` | 1 | Line 106 and 107 index the same overwritten path with different hashes; current bytes match line 107 exactly. |
| `INLINE_REFERENCE_HASH_PAIRING_FALSE_POSITIVE` | 1 | The old scanner paired an inline screenshot path with the report hash in the table's SHA column; the screenshot matches its inline SHA exactly. |
| `BLOCKED_INDEXED_BYTES_UNAVAILABLE_CURRENT_PATH_OVERWRITTEN` | 6 | Untracked retained paths contain different current bytes; indexed bytes are absent from Git history and no immutable sibling with the indexed hash was found. Do not reseal silently. |

The six blocked paths are:

- `.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/cleanup/canonical-import-readback.json`
- `.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/stage1-diagnostic/result.json`
- `.artifacts/shipyard-live/daily-lifecycle-e2e-20260812/browser/service-run-close.json`
- `.artifacts/shipyard-live/menu-amendment-e2e-20260807/manager-reconciliation-probe.json`
- `.artifacts/shipyard-live/menu-amendment-e2e-20260807/manager-reconciliation-1440x900.png`
- `.artifacts/shipyard-live/ui-phase03-wave2-table-performance/manifest.json`

These are explained lineage blockers, not permission to regenerate, restore from an unknown source, or replace indexed hashes. Resolution requires an owner decision to restore known indexed bytes, retire the stale claim, or explicitly reseal current bytes after semantic review.

## Scanner correction

Added `scripts/evidence_index_scan.py` and `scripts/test_evidence_index_scan.py`. The scanner now:

1. hashes `HEAD` Git blob bytes for tracked evidence, avoiding Windows checkout EOL false positives;
2. records declared evidence roots as directories and checks them with `is_dir()`;
3. resolves table child paths under the section's declared `Evidence root`;
4. reads path/hash only from the first two Markdown table columns, so inline reviewer references are not mispaired;
5. preserves duplicate table rows instead of silently deduplicating conflicting historical claims.

Regression tests: 3/3 PASS.

## Corrected denominator

Output: `wave-7-evidence-lineage-corrected.json`.

- 358 total references;
- 355 indexed file rows;
- 3 declared directory roots;
- 0 missing references;
- 9 hash mismatches.

The denominator increased from 336 because 23 section-relative child hashes are now scanned, while the old scanner's inline screenshot pseudo-row is no longer counted and duplicate historical rows remain visible.

The nine mismatches are:

- 6 blocked overwritten `.artifacts` paths;
- 1 stale duplicate `.artifacts` index row;
- 2 Golden XLSX fixtures blocked on deterministic builder/reseal.

All prior CRLF mismatches and all directory false-missing results are closed by scanner policy rather than by changing evidence bytes.
