# MRX Source History Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wide ingredient delta list with a responsive event list and read-only detail that explains approvals and quantities.

**Architecture:** Add a ReconciliationOnly read projection over MRX menu amendments and standalone revisions, paged before detail loading. Keep decision writes in weekly menu. The frontend uses existing workbench, Modal, state and pagination primitives.

**Tech Stack:** ASP.NET Core, EF Core, React, TypeScript, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-mrx-source-history-events.md`

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; no cross-mode workflow or audit joins.
- No new styling tokens or ad-hoc colors outside `frontend/src/styles/index.css`.
- Preserve existing dirty work and existing source-delta API consumers.

## Review Focus

- One amendment affecting two batches appears once, with both revisions in detail.
- Pending/rejected requests have no fabricated applied quantities.
- Concurrent decision after initial load is reflected on refresh; list never presents APPLIED as approval.
- Invalid batch scope cannot leak another customer's requests.
- Long names and IDs stay readable and keyboard usable on narrow screens.

---

### Task 1: Backend read model

**Files:** Create `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationSourceHistoryService.cs`; modify bounded contracts/controller; add backend tests.

- [ ] Add failing tests for event grouping, review statuses, filters, paging and detail lineage.
- [ ] Implement a ReconciliationOnly summary and detail API with server paging, stable sort and explicit absence semantics.
- [ ] Run focused backend tests and source review.

### Task 2: Frontend workbench

**Files:** Modify `frontend/src/api/mrxApi.ts`, `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`, bounded branch files; create detail modal; add behavior tests.

- [ ] Add failing tests for summary rendering, detail, pending/rejected/direct labels and narrow layout.
- [ ] Replace the wide list with responsive event summaries, then add modal detail with independent loading/error states.
- [ ] Run focused unit/browser tests, lint and build; inspect one batched desktop/mobile screenshot round using Impeccable.

### Task 3: Integrated verification

- [ ] Run MRX clone workflow for real populated history, inspect screenshot and cleanup receipt.
- [ ] Run relevant contract tests, code review, update `.planning/WORK.md` and report scoped verdicts.
