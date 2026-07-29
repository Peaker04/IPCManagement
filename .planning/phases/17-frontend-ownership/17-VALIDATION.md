---
phase: 17
slug: frontend-ownership
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-29
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + React Testing Library; Playwright 1.60.0 for headed browser |
| **Config file** | `frontend/vite.config.ts`, `frontend/playwright.config.ts` |
| **Quick run command** | `npm run test:unit -w frontend -- <focused test paths>` |
| **Full suite command** | `npm run test:fe:unit` |
| **Estimated runtime** | ~90 seconds for frontend unit suite; browser/runtime gate reported separately |

---

## Sampling Rate

- **After every task commit:** Run focused Vitest files plus `npm run lint -w frontend` and the affected dependency check.
- **After every plan wave:** Run `npm run test:fe:unit`, `npm run lint:fe`, `npm run depcruise:fe`, and `npm run build:fe`.
- **Before `$gsd-verify-work`:** Root `npm run verify`, `npm run check:api-contract`, whitespace/secret checks, staged GitNexus audit, and headed-browser evidence must be green.
- **Max feedback latency:** 180 seconds for automated per-task checks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | ARCH-17 public API surface | T-17-01 | One shared authenticated base query; no duplicate endpoint registration | unit/characterization | `npm run test:unit -w frontend -- src/api/workflowApi.publicSurface.test.ts src/api/workflowApi.cacheContract.test.ts` | ✅ | ✅ green |
| 17-02-01 | 02 | 1 | ARCH-17 shared/app ownership | T-17-02 | Session refresh/logout and permission checks preserve existing behavior | unit/architecture | `npm run test:unit -w frontend -- src/features/auth && npm run depcruise:fe` | ✅ | ✅ green |
| 17-03-01 | 03 | 1 | ARCH-17 layout ownership | — | N/A | unit/navigation | `npm run test:unit -w frontend -- src/app/operationalPagePerformanceContracts.test.ts src/app/layout/MainLayout.ownership.test.tsx` | ✅ | ✅ green |
| 17-04-01 | 04 | 2 | ARCH-17 endpoint ownership/cache | T-17-01 | Endpoint names, args, hooks and cache invalidation remain unchanged | unit/integration | `npm run test:unit -w frontend -- src/api/workflowApi.publicSurface.test.ts src/api/workflowApi.cacheContract.test.ts src/api/workflowApi.cacheInvalidation.test.ts src/api/workflowApi.approvalDecisionWire.test.ts` | ✅ | ✅ green |
| 17-05-01 | 05 | 3 | ARCH-17 projects/coordination | — | N/A | architecture/unit | `npm run test:unit -w frontend -- src/features/projects/weekly-menu/coordinationQueryOwnership.test.ts src/features/coordination/coordinationQueryOwnership.test.ts src/features/projects/weekly-menu/coordinationBoundary.test.ts && npm run depcruise:fe` | ✅ | ✅ green |
| 17-06-01 | 06 | 4 | ARCH-17 zero dependency debt | T-17-02 | Auth/permission imports flow only through approved downward contracts | architecture | `npm run depcruise -w frontend` | ✅ | ✅ green |
| 17-07-01 | 07 | 5 | ARCH-17 Admin page model | — | N/A | unit/component | `npm run test:unit -w frontend -- src/app/pages/admin-data` | ✅ | ✅ green |
| 17-08-01 | 08 | 5 | ARCH-17 Reports page model | — | N/A | unit/component | `npm run test:unit -w frontend -- src/features/reports` | ✅ | ✅ green |
| 17-09-01 | 09 | 6 | ARCH-17 full parity | T-17-01 / T-17-02 | No transport/session/permission regression | full + browser | `npm run verify && npm run check:api-contract` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `frontend/src/api/workflowApi.publicSurface.test.ts` — enumerate endpoint keys, 75 hook exports, compatibility registration, and identity with the one `apiSlice`.
- [x] `frontend/src/api/workflowApi.cacheContract.test.ts` — lock query serialization and provides/invalidates descriptors for moved endpoints.
- [x] `frontend/src/app/layout/MainLayout.ownership.test.tsx` — lock app-owned path plus navigation/preload behavior.
- [x] `frontend/src/features/projects/weekly-menu/coordinationBoundary.test.ts` — forbid imports of Coordination feature internals.
- [x] Admin/Reports per-panel/view model contracts cover each extracted owner boundary.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-lane navigation, cache warm revisit, visual parity and layout stability at `1365×900`, `1280×900`, `768×1024` | ARCH-17 | Unit/snapshot tests cannot prove real backend requests, browser cache reuse, console/page errors, CLS or overflow | Verify ports/health and current source, run the headed Chrome helper from repo root with rotated credential from environment, then inspect screenshots, API responses, console/page errors, long tasks and CLS. Do not seed/reset/import or mutate the preserved lane. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated and three-viewport headed-browser Gate 17 passed on 2026-07-29;
goal-backward phase verification passed 7/7 must-haves with no gaps or Deferred item.
