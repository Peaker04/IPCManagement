# Phase 09-05 Residual Blocker Checkpoint

**Status:** `PENDING`  
**Apply status:** `NOT_RUN_BLOCKERS_PRESENT`  
**Scope:** restored disposable database `ipc_lane1` only  
**Source:** `IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx`  
**Source SHA-256:** `4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88`  
**Policy:** `purchase-history-normalization/2026-07-22/v2`

## Preview gate result

The restored lane was migrated and previewed twice. Both previews produced the same manifest hash, database fingerprint, action count, and blocker count.

```text
Restore=ipc_e2e_template->ipc_lane1
RestoreVerify=PASS
ManifestHash=8934CA22434458D17CB328FD482B92176A6E752AEBB3A3AF94A845445CEDDEAD
DatabaseFingerprint=5FBA836102CB8CE94A5FC196A472A160D4D5E35D50C9C3CE504D9165A305CCF0
PreviewReplayMatch=true
ActionCount=9442
ResidualBlockerOccurrences=418
ResidualNormalizedGroups=87
ApplyCalled=false
```

Because the residual blocker count is not zero, no subset, partial apply, or full apply was attempted.

## Approved normalization implemented

The standard unit seed now contains these independent units. The migration uses `baseUnitCode = NULL`; it does not introduce a cross-unit inventory conversion.

| Source display | Unit code | Canonical display |
|---|---|---|
| Bao | `BAO` | Bao |
| Can | `CAN` | Can |
| Cặp | `CAP` | Cặp |
| Cục | `CUC` | Cục |
| đôi | `DOI` | đôi |
| Lon | `LON` | Lon |
| Lít | `LIT` | Lít |
| Phần | `PHAN` | Phần |
| Trái | `TRAI` | Trái |
| vỉ | `VI` | vỉ |
| viên | `VIEN` | viên |
| Xấp | `XAP` | Xấp |
| bó | `BO_BUNCH` | bó |
| bộ | `BO_SET` | bộ |
| bình | `BINH` | bình |
| Chiếc | `CHIEC` | Chiếc |
| con | `CON` | con |
| bì | `BI` | bì |

Only the three approved ingredient typo aliases were added:

- `Cảithiaf` -> `Cải thìa`
- `Nấm bào ngừ` -> `Nấm bào ngư`
- `Bì ngòi xanh` -> `Bí ngòi xanh`

`Nấm bào ngừ` remains in this checkpoint: the typo is normalized, but `Nấm bào ngư` still resolves to multiple active catalog rows. No new ingredient was created.

## Residual counts

| Type | Occurrences | Decision |
|---|---:|---|
| `DATE_AFTER_AS_OF_WINDOW` | 28 | Pending source-date confirmation |
| `DATE_INVALID` | 67 | Pending source correction |
| `INGREDIENT_CATALOG_AMBIGUOUS` | 184 | Pending exact active `IngredientId` or catalog de-duplication |
| `INGREDIENT_MISSING` | 23 | Pending source correction |
| `INGREDIENT_SUPPLIER_AMBIGUOUS` | 4 | Pending explicit ingredient/supplier split |
| `UNIT_AMBIGUOUS` | 4 | Pending business meaning for `canh` and `kh` |
| `UNIT_UNKNOWN` | 108 | Pending unit approval or source correction |
| **Total** | **418** | **Apply blocked** |

The unit residual includes 68 blank values, `Bành` (28), `Bịch (10 cái)` (4), `g` (3), `k` (2), `vit` (1), `lát nhỏ` (1), and `Lẻ` (1). `Bịch (10 cái)` remains blocked because no dated package rule or cross-unit conversion was approved.

The ingredient residual retains supplier-bearing/mixed ingredient text and all unclear family variants. In particular, Cốt lết, Xương mềm, and Heo đùi mông variants were not collapsed: `inventoryreceiptlines` has no safe specification field, and `lotNumber` is not a specification destination. Mapping them would require both one exact active `IngredientId` and an approved existing per-line specification destination.

## Machine-readable review

- `09-05-RESIDUAL-BLOCKERS.json` contains all 87 normalized groups with `group_id`, `type`, raw source value, count, evidence samples, reason, recommendation, and `approval_status=pending`.
- `09-05-RESIDUAL-BLOCKERS.csv` contains the same group-level review columns for operator triage.
- JSON SHA-256: `82B30CD1FA303BDEBF05731EAB0D9F8A55979E7CA63F3EFF79125FF95E20A243`
- CSV SHA-256: `6469A8C8565295CACFE8880A7369001320D6DFA419DABD87BAE492FAB7BBD1AC`

## Safety invariants

```text
ProtectedSqlSha256=B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53
ProtectedSqlPorcelain=?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql
ProtectedSqlTracked=false
HistoryRewrite=false
PartialApply=false
RealOrSharedApply=false
```
