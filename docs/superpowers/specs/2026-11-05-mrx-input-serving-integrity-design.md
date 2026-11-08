# MRX input-serving integrity gate — approved short design

Date: 2026-11-05. Owner approved the proposal to strengthen the existing G6 input boundary. This document is a static design; `.planning/WORK.md` remains the sole live task ledger.

## Purpose and scope

Reject a false end-to-end PASS where downstream calculations consistently consume duplicated, misplaced or incorrect serving counts. Extend the incumbent `@G6-Menu-Coverage`, not a parallel campaign. This approval covers the input-gate design, not another disposable-clone execution, session policy changes or speculative production repairs.

The workbook currently supplies dishes/slots; the scenario enters split servings through UI controls afterwards. Evidence must distinguish **Excel-authored menu facts** from **UI-authored serving facts**. Do not claim that serving counts were imported from this workbook.

## Independent input contract

- Freeze the existing manifest's six-day/two-shift savory/vegetarian values before entry. Retain distinguishable, unequal counts and the existing increase/decrease revisions; do not replace these expectations with a server readback.
- Logical input identity: customer + week + date + shift + variant. Preserve menu-version/schedule/quantity-line identities as lineage, not as additional people to sum.
- Check raw request fields, persisted current rows, actual read DTO and visible controls after reload against that independent table. Check exact row multiplicity as well as values and `FinalServings = SavoryServings + VegetarianServings`.
- Current storage is schedule-linked: `mealquantityplanlines.menuScheduleId`. Determine the expected active schedule set from authored source and declared import/version contracts, then require exactly one applicable quantity line per expected schedule. Missing/extra schedules or multiple lines per schedule fail. Never assume a universal one-row-per-date rule, select the first match, or hide duplicates with DISTINCT/grouped totals.
- Historical version rows are legitimate history. Pin the exact accepted version at each checkpoint; assert predecessor preservation separately. Latest-version selection alone cannot establish correct lineage.
- Multiple dishes/merged slot members may share a serving count; that is not another serving cohort. Do not sum headcounts over menu items or BOM contributors.

## Checkpoints and failure conditions

1. After source/serving acceptance and before any quantity-preview/freeze/transfer: validate accepted request identities/values and raw persisted serving multiplicity. Integrate at the existing source-acceptance stage, not only after `createTransferredBatch` returns.
2. After reload: validate complete read DTO and each visible input against the same expected table. An unloaded/empty editor is not a passing absence check.
3. After every existing source revision: assert changed cells equal the declared replacement values, all other cells remain unchanged, current storage multiplicity remains correct, and predecessor facts are retained. For dish-only changes, every serving value is unchanged.
4. After repeated read/reload: raw counts/identities/values remain unchanged; reads cannot create new quantity lines. This is not permission to replay a mutation under invented idempotency semantics.
5. Only then run the existing independent material oracle and downstream checks. An input mismatch fails immediately with expected/actual key, value, multiplicity and checkpoint; do not run unsafe dependent commands.

Small negative controls must prove the actual gate rejects: a duplicate row with otherwise correct values, missing row, wrong split with unchanged final total, and two dates whose errors cancel in a grand total. Controls operate on in-memory snapshots only, never corrupt the clone DB or fabricate business evidence. Keep helper logic test-side with a real G6 consumer and no test-only production export.

## Non-goals and acceptance

No global schema/uniqueness migration, new UI, new formatter, production seed, timeout increase, G5 policy rewrite or performance certification. Existing actor/mode/version/freeze/stock safeguards remain unchanged. Runtime work requires a separately admitted fresh target; previous one-shot authority is consumed.

PASS requires independent input-to-request-to-persistence-to-readback proof at every declared checkpoint, followed by the existing downstream checks. Local gate tests and historical 20-revision runs cannot certify the new runtime assertions. Remaining import/reimport/export/performance coverage stays explicitly open.
