# MRX preparation summary implementation plan

> Execute inline using superpowers:executing-plans; no delegation.

**Goal:** Implement approved option A for the MRX preparation workbench.
**Architecture:** Retain existing preparation GET and export owners. Replace dynamic batch columns with a fixed summary and a read-only allocation modal derived from current filtered DTO data.
**Tech Stack:** React, TypeScript, existing DataGrid/Modal/Num, Vitest, Playwright.
**Spec:** ../specs/2026-11-15-mrx-preparation-summary.md

- [x] Update Warehouse behavioral regression for fixed columns, selected totals and allocation detail.
- [x] Replace columns in MrxMultiCustomerPreparationWorkbench.tsx; add MrxPreparationAllocationModal.tsx; own responsive CSS in index.css.
- [x] Verify exact-batch grouping, same customer multiple batches, scope invalidation, unchanged export behavior.
- [x] Run focused Warehouse tests, lint/build, isolated browser desktop/mobile evidence; review and update WORK.
