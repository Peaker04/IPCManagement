# MRX Historical Purpose Recovery Implementation Plan

> Use superpowers:executing-plans in the current session. Keep evidence status in .planning/WORK.md.

**Goal:** Resolve supported historical issue allocations by audited role decisions without changing a source document or inventory.

**Architecture:** A dedicated reconciliation proposal owns the reviewed split and status. The existing approval registry reads it and dispatches the atomic decision to the reconciliation owner. Existing fulfillment reads consume the applied allocation rows.

**Tech Stack:** EF Core/MySQL, ASP.NET Core, React, Vitest, Playwright.

**Spec:** [Phục hồi phân bổ phiếu xuất lịch sử MRX](../specs/2026-11-18-mrx-historical-purpose-recovery.md)

## Global constraints

- MRX only. Check mode, actor, exact issue line/batch/day/unit and optimistic versions. Respect the existing batch write lock and command receipts.
- Never edit the original ledger, physical stock or frozen demand. Require an explicit reason and preserve submit/review/application audit.
- Use existing workbench components, one scoped modal and current design tokens.
- Use disposable, runner-owned MySQL clones. Finish native and review before push.

## Tasks

1. Build backend validation and atomic lifecycle. Add exact-issue scope and policy tests first. Add an additive proposal persistence mapping and migration. Verify rejected, duplicate, stale, mixed return, wrong-unit/date/customer, reviewed vs direct actor, replay and no stock/source effects.
2. Connect the proposal to the existing MRX inbox/detail/history and decision endpoint. Add registry, paging, fingerprint, actor isolation and DEFAULT contract tests. Generate API metadata and client types.
3. Connect the warehouse entry point and existing Approval split. Show exact source scope, remaining quantity, split and version handling. Review with Impeccable, the local design system, and real browser screenshots at 600, 960 and 1440 px.
4. Execute native Warehouse → Manager and Admin-direct cases, including insufficient historical evidence, persisted audited attribution, scoped read-model agreement and completion eligibility. Confirm exact cleanup and run verification gates against the final candidate. Push only after finishing the approved plan, then check hosted CI/CD and deployment.
