# Preparation groups: raw-source research and scoped review

Date: 2026-11-15. Scope: FR-CAT / FR-PUR / FR-WH, research only. No application code or database writes. Existing workbook acceptance remains PARTIAL. This report proposes a replacement for name-only classification; it does not authorize a migration.

## Verified sources

- `.docs/IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx`: SHA256 `4a91f9ea847068abeb147eff7ed7401b029d698f73e495641099dd9fa552bc88`; 34 sheets: SUMMARY, NGUỒN and 32 supplier sheets. SUMMARY maps 31 sheet codes to supplier labels; Vịt a Việt is the extra supplier sheet. Downloads copy has the same hash.
- `.docs/IPC. Định lượng 07.2026.xlsx`: SHA256 `a1459b87292514adff234c6ec8258b7ff54f68319a96533b0ba489e0b57bf403`; six sheets, including three BOM tiers with Supplier columns. Downloads copy has the same hash.
- NGUỒN has 28 populated headings and 575 named entries / 516 distinct names under case/whitespace normalization. 395 database ingredient names occur there. Headings include Rau, Gia vị, Thịt tươi, Cá Phây, ĐL THUÝ, ĐL TUYẾN TÂM, Chay, Gạo, Tôm, Bao bì and others. These are mixed supplier/category labels, not an already approved group taxonomy.
- A read-only transaction against `ipcmanagement` exported 773 ingredient codes/names and canonical units. No new group column was required or migrated.

## Evidence discovery coverage

Diagnostic extraction kept only names, units, supplier labels and workbook/hash/sheet/row references. 21,966 named source rows were discovered across recognized supplier sheets and BOM tiers; this is NOT a count of valid transactions. No dates, prices, eligibility, merged-cell expansion or importer acceptance were certified by this extraction.

| Check | Result |
| --- | ---: |
| Database ingredient names matched in order/BOM sources | 765 / 773 |
| Names matched in order sheets | 711 |
| Names matched in BOM sheets | 222 |
| Order name matches with one normalized supplier label | 639 |
| Order name matches with multiple normalized supplier labels | 72 |
| Previously unresolved proposals now having raw name evidence | 517 / 519 |
| Names without direct matches, including NGUỒN | 8 |

Matching preserves accents, normalizes Unicode NFC, case and whitespace only. It does not establish ingredient identity, unit compatibility, supplier identity or an approved group assignment. No fuzzy match or source row was applied to the database. Counts overlap where stated and must not be added together. Multiple suppliers can be legitimate; they are not automatically identity conflicts.

The eight unmatched names are Chả quét, Chả cá lát đồng tiền, Gà DL, Rau sống and four names containing test markers. Do not delete or label the latter synthetic without tracing their creation and references.

Evidence files under `.artifacts/workbook-acceptance/`: `raw-source-lineage.csv`, `raw-source-master-list.csv`, `raw-source-ingredient-crosswalk.csv`, `raw-source-research-summary.json`, `raw-research-ingredient-units.tsv`. Originals were opened read-only and never saved by openpyxl.

## Review findings

1. **Must fix before classification: the previous proposal omits authoritative raw context.** `.artifacts/propose-preparation-groups.py` uses ingredient-name patterns only. It leaves 519 unresolved although 517 of those have raw name evidence. Example: Gạo is under the order supplier Gạo but the BOM Supplier column says NL Rau. Consuming either the old proposal or BOM Supplier alone can route it incorrectly. Replace the review input with a source crosswalk; retain the old proposal as an unapproved historical artifact.

2. **Must fix before applying: names are insufficient to reconcile units or storage.** Ngũ vị hương occurs at `2.G.Vi` row 55 with Hộp, row 445 with gói, and `21.TH.Thái` row 266 with Gói; its current canonical unit is HOP. No package conversion may be inferred. Frozen versus fresh must follow the already approved frozen-priority rule using confirmed preservation information; a supplier abbreviation ĐL alone does not prove storage state. Case-only supplier variants must not inflate conflict counts.

3. **Coverage gap in inherited parser: two source layouts are skipped.** `PurchaseHistorySourceParser.cs` requires Tên hàng and skips NGUỒN intentionally. `29.CHUỐI` and `28.ĐÁ DIỆU HƯƠNG` contain delivery/unit/quantity headers without Tên hàng, so they are skipped. This is not proof that those items were never imported by another path. Add explicit, source-reviewed sheet-layout handling in the proposed group analysis; changing the purchase-history parser itself requires updating its audited hash/count acceptance baseline and dedicated regression evidence.

4. **Import semantics differ from the proposed group model.** `SampleBomImportService.cs:165` ensures a Supplier exists, but does not create an ingredient–supplier quotation/link from that row. `EnsureIngredient` matches names or stable codes, and imports with updateUnit=false. Therefore a Supplier column or existing supplier row alone does not prove the current quotation relationship or canonical unit is correct. Reconcile actual SupplierIds and existing references separately; do not manufacture quotations from BOM labels.

## Approaches and recommendation

A. **Recommended: source crosswalk plus exception review.** Reuse the existing purchase-history normalization policy and blockers when applicable; supplement with NGUỒN membership and explicitly supported special layouts. Keep every decision traceable to workbook hash / sheet / row / rule version. Review a compact source-column-to-group policy first; then validate all 773 automatically, exposing only conflicts and unsupported cases. No automatic winner by last row, first supplier or lowest price.

B. **Supplier-sheet-only grouping.** Faster, but rejects cross-supplier goods and storage differences and mishandles generic BOM labels. Not sufficient for acceptance.

C. **Manual review of all 773/name-only suggestions.** High user burden and discards available evidence. Not recommended.

Proposed design for A:

1. Separate real supplier identity, source supplier alias, ingredient canonical identity/unit and preparation group. Never rename actual suppliers into commodity group labels.
2. Establish explicit reviewed rules for source headings. Rau + Trái cây can propose PRODUCE; supplier labels for frozen goods require preservation confirmation. General-goods and vegetarian suppliers need ingredient-level exceptions. Gạo/bún/trứng/sữa/bao bì must have an explicit policy for OTHER or approved further groups, rather than be silently forced into existing groups.
3. Classify outcomes as supported, conflicting, missing evidence or unsupported layout; record all evidence and conflicts even when a recommendation exists. Use aliases already confirmed by existing normalization owners. Keep accents and require unit/package checks. Name-only counts above are discovery coverage, not apply coverage.
4. Show the user source-group policy and exception summaries with representative evidence. Do not require reading 773 rows; retain the complete crosswalk for audit. Do not promise that only eight need review: supplier, unit and preservation conflicts may increase that set.
5. After design approval, update the existing acceptance spec/plan, rehearse the concrete mapping on a disposable clone, compare ingredient counts/IDs, supplier references, totals and units, export/open the resulting workbook, and verify rollback/cleanup. Source mutation requires an explicitly reviewed concrete mapping. Future create/edit/import paths must preserve approved group assignments and leave unsupported new items UNCLASSIFIED.

## Verdict

Research PASS for source discovery and direct-name crosswalk. Group/identity/unit mapping NEEDS_EVIDENCE. Existing 773-row proposal is not an approved migration. No code, source workbook or database changes were made during this review.

Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact: using-superpowers/brainstorming/ponytail-review/ipc-code-review; raw supplier classification review; previous proposal ignored raw workbooks and mixed supplier/group meanings; source hashes, full sheet inventory, read-only DB crosswalk and concrete owner findings; yes within discovery limits; openpyxl reports unsupported validation extension but files were not saved, diagnostic matching is not importer acceptance; recommend source-policy and exception review before applying groups.
