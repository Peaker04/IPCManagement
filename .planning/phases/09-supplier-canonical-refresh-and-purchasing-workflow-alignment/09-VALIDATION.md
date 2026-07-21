---
phase: 9
slug: supplier-canonical-refresh-and-purchasing-workflow-alignment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit (.NET 9), Vitest 4.1.10, Playwright 1.60.0 |
| **Config file** | `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`, `backend/coverage.runsettings`, `frontend/playwright.config.ts` |
| **Quick run command** | `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --no-restore --filter "FullyQualifiedName~PurchaseHistoryReconciliationTests|FullyQualifiedName~MaterialDemandAndPriceExceptionApprovalTests|FullyQualifiedName~SupplierDecisionWorkflowTests|FullyQualifiedName~WarehousePurchaseReceivingTests"` plus the impacted focused frontend Vitest files |
| **Full suite command** | `npm run test:be && npm run lint --workspace frontend && npm run build --workspace frontend && npm run test:unit --workspace frontend && npm run test:smoke --workspace frontend && npm run test:ui-audit --workspace frontend && npm run test:visual --workspace frontend` |
| **Estimated runtime** | Quick target under 60 seconds; full suite measured during execution |

## Sampling Rate

- **After every task commit:** Run the impacted Phase 9 backend filter and/or focused frontend Vitest, plus GitNexus `detect_changes()`.
- **After every plan wave:** Run all Phase 9 backend tests and the frontend lint/build/unit/smoke gates relevant to that wave.
- **Before `$gsd-verify-work`:** Full suite, disposable-clone reconciliation evidence and cross-role Playwright flow must be green.
- **Max feedback latency:** 60 seconds for the per-task focused command.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-W0-01 | 01 | 0 | SUP-01..SUP-04 | T-09-01 | Preview is read-only; apply is drift-gated and atomic | unit + integration | Phase 9 backend quick filter | ❌ W0 | ⬜ pending |
| 09-W0-02 | 01 | 0 | PUR-01..PUR-05 | T-09-02 | Server authorization and durable decision history gate transitions | unit + integration | Phase 9 backend quick filter | ❌ W0 | ⬜ pending |
| 09-W0-03 | 01 | 0 | WHR-01 | T-09-03 | Warehouse-only receipt updates receipt, stock and PO atomically | authorization + integration | Phase 9 backend quick filter | ❌ W0 | ⬜ pending |
| 09-W0-04 | 01 | 0 | PUI-01 | — | Accessible route handoff and server-authoritative state | Vitest + Playwright | Focused Phase 9 frontend tests | ❌ W0 | ⬜ pending |

## Wave 0 Requirements

- [ ] `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs` — canonical suppliers, normalization/blockers, preview purity, drift, retention and no-op.
- [ ] `backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs` — demand approval, permission/history, 15.00/15.01 boundary and recovery.
- [ ] `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs` — evidence eligibility, no fallback, explicit confirmation and submit gate.
- [ ] `backend/tests/IPCManagement.Api.Tests/WarehousePurchaseReceivingTests.cs` — Warehouse authorization, partial/final quantities, lot/date snapshot, ledger/PO atomicity and idempotency.
- [ ] Focused frontend model/hook tests for six stages, URL restoration, confirmation, exception action and read-only receipt progress.
- [ ] Focused Playwright Phase 9 fixture covering demand approval through Warehouse partial/final receipt.
- [ ] Disposable database clone fixture and operator-owned backup/restore evidence checkpoint; reconciliation tests never target a live lane.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backup/restore evidence acceptance before apply | SUP-03, SUP-04 | Operator owns the backup artifact and restoration rehearsal | On a disposable clone, record backup ID, restore it, compare the pre-apply fingerprint, then attach evidence to the accepted preview. |
| Workbook reconciliation gate | SUP-01..SUP-04 | Uses the audited `.docs` workbook and clone-only operational evidence | Preview the 20.7 workbook, resolve/block diagnostics, apply once, apply again, run post-apply preview, and prove both repeats have zero eligible mutations. |

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
