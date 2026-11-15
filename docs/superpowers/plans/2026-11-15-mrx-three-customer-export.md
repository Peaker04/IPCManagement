# MRX three-customer export implementation plan

> Execute inline with superpowers:executing-plans.

Spec: ../specs/2026-11-15-mrx-three-customer-export.md

- [ ] Add failing regression for three selected customers with shared demand, a third-only item and exact frozen servings. Assert the new headers and numeric layout.
- [ ] Update the full workbook builder and consumer assertions. Preserve the legacy layout. Run Release workbook and Open XML tests.
- [ ] Prepare three transferred batches in the same week on an owned disposable clone and download day/week workbooks from the browser. Compare individual, combined and deselected quantities and menus.
- [ ] Validate the exact artifact with Open XML and Excel, review print settings, record cleanup and outstanding cases in WORK.
