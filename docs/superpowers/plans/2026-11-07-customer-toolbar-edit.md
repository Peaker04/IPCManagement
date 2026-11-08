# Customer Toolbar Editing Implementation Plan

> Execute inline with executing-plans. Project WORK.md alone owns task state; no subagents/worktrees/staging/commits.

**Goal:** Replace customer row action with selected-row note/status editing and investigate unchanged BOM tier quantities without inventing real-data evidence.
**Architecture:** Existing AdminCustomersBranch/DataGrid/Modal and metadata-only customerApi PUT. Preserve create form and BE metadata-only semantics.
**Tech Stack:** React/TypeScript, installed Vitest/Playwright.
**Spec:** ../specs/2026-11-07-customer-toolbar-edit-design.md

## Global constraints
No name editing/locking policy, price control, schema/API change, installation, restart/login/real business write. Impeccable incumbent Operate UI and existing tokens/primitives. Preserve dirty tree.

## Review focus
Selection hidden by search cannot be edited; identity must stay exact. Save only changed metadata, no implicit status inversion/repricing. Cancel/pending/error/denial retain real guards. Empty note is explicit empty string. Equal real BOM quantities are not evidence of failure; distinguish different-tier rendering from actual data.

## T1 selected-row customer edit
Files: frontend/src/features/admin/branches/AdminCustomersBranch.tsx; frontend/src/__tests__/AdminCustomersBranch.test.tsx; frontend/tests/browser/mrx-menu-remediation.spec.ts.
Interface: existing DataGrid selectedKey/onRowClick; customerApi.updateCustomerContract(id,{note?,isActive?}).
- Extend existing status owner to select row, toolbar edit, note/status save, cancel/dirty/pending/error/restore; assert absent action column, no name input and no hidden-selection edit. Keep Chef denial and minimal-create contracts.
- Run intended RED, implement single existing modal draft with dirty/pending guard; update returned row only. No new component family.
- Run focused tests; migrate existing bounded GET-only browser cancel/form workflow to toolbar selection.

## T2 BOM diagnostic
Files: frontend/src/__tests__/AdminBomBranch.test.tsx; existing browser remediation owner.
- Extend actual read-only name-modal case with 25k quantity0.123456 and30k quantity0.25; switch25→30→34(empty)→25 and assert source-specific values, no mutation.
- If failing, trace actual owner first. If green, report UI filter passes controlled distinct-data case, real dish remains unresolved without actual payload/identity.

## Verify
Relevant unit owners, FE build/lint/full suite, conformance/dependency checks. One batched desktop/tablet browser run plus at most one correction confirmation. Parent scoped code/UI review and WORK close with source/fixture/live limits; no BE rerun for unchanged backend.
