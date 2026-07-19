---
title: Browser UAT for decomposed operational pages
date: 2026-07-19
priority: high
phase: 08-operational-page-feature-decomposition
status: pending
---

# Browser UAT for decomposed operational pages

Run after each behavior-owning extraction and again at Phase 8 closure.

## Required evidence

- `/weekly-menu`: customer/week/tier selection, all tabs, import preview/commit/rollback, schedule edit, quick servings, production plan and demand generation.
- `/purchasing`: candidate paging, quotation CRUD, submit, purchase-order creation, receive and cancel controls.
- `/chef-dashboard`: receipt confirmation, supplemental request, return/waste and shift journal.
- Keyboard: tab order, dialog focus trap, Escape/cancel and focus return.
- Responsive: 1365x900, 1280px and narrow viewport with table-local overflow.
- Backend/database: success is accepted only after live mutation persistence; no mock-only evidence.

## Completion gate

- Capture pass/fail per control and screenshot each main tab/dialog state.
- Record API/database identifiers for representative mutations.
- Any missing button, inaccessible control, false success or page-level overflow reopens the owning wave.
