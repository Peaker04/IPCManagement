# MRX three-customer export implementation plan

> Execute inline with superpowers:executing-plans.

Spec: ../specs/2026-11-15-mrx-three-customer-export.md

- [x] Cover three selected customers with shared demand, a third-only item and exact frozen servings. Assert the new headers and numeric layout.
- [x] Update the full workbook builder and consumer assertions. Preserve the legacy layout. Run Release workbook and Open XML tests.
- [x] Prepare three transferred batches in the same week on an owned disposable clone and download day/week workbooks from the browser. Compare individual, combined and deselected quantities and menus.
- [x] Validate the exact artifacts with Open XML and Excel, review print settings and record cleanup in WORK.

Run `20261115t153952z_e175ce` completed ExportConsistency. The source contained two active customers, so the third was created through the application on the disposable clone. All ten browser exports passed Open XML validation. Excel 16 opened and reopened both combined workbooks with alerts enabled. The exact clone and its runtime resources were cleaned.
