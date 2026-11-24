# Approved two-sheet preparation workbook

**Approved:** preparation materials first, menu comparison second. Preserve exact selected scope, frozen menus and customer identities. Retained includeMenus=false clients keep legacy summary/detail output. Empty full exports must still contain a menu comparison sheet. No supplier renaming or guessed ingredient classification: existing models have no supply-group mapping. Category normalization requires its own authoritative mapping and migration scope.

Implementation: repair SpreadsheetML element ordering; render full exports as two named sheets; add scope and print layout to summary; preserve supplier sections using available supplier data. Update domain and tests, verify actual XLSX package/order, unit quantities and full/legacy exports. No database mutation.
