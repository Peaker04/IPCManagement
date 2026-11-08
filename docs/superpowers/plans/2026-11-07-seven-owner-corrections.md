# Seven Owner Corrections Implementation Plan

> Execute inline using executing-plans and the owner's approved seven-item proposal. No subagents, worktrees, staging or commits. WORK.md alone tracks execution; these are static implementation instructions.

**Goal:** Complete the seven chat corrections without turning customer metadata changes into repricing or recoverable expiry into forced logout.
**Architecture:** Surgical changes to existing persistence, transport and UI owners; existing primitives/tokens and canonical dates/tiers.
**Tech Stack:** .NET/EF Core, React/TypeScript, installed xUnit/Vitest/Playwright.
**Spec:** ../specs/2026-11-07-seven-owner-corrections-design.md

## Global constraints
- Supported import tiers25000/30000/34000; no fabricated contract price, no historical rewrite or schema migration.
- Preserve DEFAULT/MRX isolation, permissions, unknown-outcome/version/replay and transaction safety.
- FE passes Impeccable/canonical DESIGN gate before edits; no new visual world or style tokens.
- No install, login, production fixture, real business write, restart, stage/commit or delegation.
- Very low C: space: run bounded checks sequentially with installed tools, isolated backend output on D:, no live-owned bin overwrite; report environmental blockers, never delete files implicitly.

## Review focus
- Status-only update of a customer with mixed imported tiers must not create/apply a priced contract (T1 relational regression).
- Invalid/revoked refresh versus transient failure, concurrent401 and session replacement must remain distinct (T3 real fetch tests).
- Dish-name inspection must not expose mutation controls or require ingredient-catalog writes (T2 DOM/network case).
- Saturday belongs to preparation week, Sunday does not; historic Sunday records are not deleted (T4 existing relational/export owner).
- Local empty-state and issued color changes must not alter global boundaries or lock eligibility (T5 rendered inspection, retained behavior owners).

## T1 — Customer-only creation, active/inactive and shifts (requests1–2)
Files: CustomerContractService.cs; AdminCustomersBranch.tsx; CreateCustomerModal.tsx; existing customer DTO/API and table metadata/docs if changed; WorkflowGenerationTests.ContractsAndProduction.cs; AdminCustomersBranch.test.tsx.
Interfaces: existing create payload omits DefaultMenuPrice; existing PUT body `{isActive:boolean}` returns CustomerContractDto. Explicit legacy create price remains supported.
- [ ] Extend existing persistence owners: omitted price creates customer/audit but no contract; unsupported explicit price still fails before tracking; mixed-tier status toggles preserve all schedules/prices and no contract creation.
- [ ] Extend existing DOM/network owner: creation without price/tier request; no price column; confirm/cancel status transition and visible failure; short known shift labels where retained.
- [ ] Run focused owners to observe intended RED.
- [ ] Remove customer price UI and nonpersistable contract controls. Create customer-only when price omitted; bypass contract resolution/application for customer-only updates. Use existing action guard, Modal confirmation, local single-flight and returned state.
- [ ] Re-run owners; preserve legacy contract tests and meaningful denial coverage.

## T2 — Name opens read-only BOM detail (request3)
Files: AdminBomBranch.tsx; DishBomEditorModal.tsx; AdminBomBranch.test.tsx.
Interface: production-consumed `readOnly?: boolean` on existing modal, name opens read-only; edit button retains default editor.
- [ ] Extend existing modal-open test to click the name and assert actual BOM data, no mutation buttons/requests, Escape/focus return; retain explicit edit path.
- [ ] Observe RED, implement semantic Button and read-only data/control gates without a second dialog component.
- [ ] Re-run AdminBomBranch and DishBomEditorModal owners.

## T3 — Refresh on authenticated401 (request4)
Files: api/client.ts; store/authContext.tsx; utils/fileDownload.ts; existing ApiContracts.test.ts and Auth.test.tsx.
Interface: reusable authenticated response transport for JSON and downloads; preserve ApiError and session-change contract.
- [ ] Add fetch-boundary cases for parallel401→one refresh→one retry each, stale refresh after replacement/logout, rejected refresh and transient refresh failure, no retries of network-failed writes. Backend-grounded LoginResponseDto only.
- [ ] Observe RED. Implement single-flight refresh directly against `/auth/refresh` with cookie and access token body; do not recurse through client. Reuse transport in fileDownload. Update provider token/user on successful refresh without clearing form/scope state.
- [ ] Re-run transport/Auth/download owners; terminal expiry must preserve existing identified MRX draft contract.

## T4 — Six-day operational week (request5)
Files: existing ServiceCalendar/date helpers; MrxPrepHeaderBranch/date-tab consumers; ReconciliationPreparationWorkbookQuery; WeeklyMenuImportValidationPolicy and daily write policy; affected display end-date owners/canonical domain docs; Warehouse, parser, preparation/workbook tests.
Interface: canonical service-day check, Monday–Saturday range; keep historic read endpoints unchanged.
- [ ] Extend existing preparation week test: Friday/Saturday included, Sunday/next week excluded; day Sunday rejected at operational boundary. Parser/daily owner rejects new Sunday service writes.
- [ ] Extend Warehouse owner: no generated CN tab, Saturday selectable, existing day/week/export params unchanged.
- [ ] Observe RED, implement source/range/admission changes; never delete historical rows or silently move URL dates.
- [ ] Migrate superseded seven-day assertions in existing owners; run parser/preparation/daily and FE date owners.

## T5 — Local empty centering and issued badge (requests6–7)
Files: ReconciliationVariancesBranch.tsx; MrxSourceEditGrid.tsx; existing browser remediation spec.
- [ ] Remove only the local variance top-alignment override; ensure content region has real flex height. Keep short copy and Warehouse placement.
- [ ] Use Badge success for known issued-day lock; preserve other neutral/warning locks and all edit restrictions. Pure presentation needs no class-mirroring unit tests.
- [ ] Include these plus customer/name/detail/six-day controls in one bounded desktop/tablet browser pass; inspect real geometry/focus/colors. At most one correction/confirmation round.

## T6 — Integrated verification and close
- [ ] Self-review actual diffs/callers using ipc-code-review and ipc-ui-review; test-audit all changed tests. No independent reviewer claim.
- [ ] Run sequential relevant FE owners, build/lint, conformance/dependency gates; backend bounded core using a fresh D: bin name with --no-restore, never bin-mrx-logical.
- [ ] Run bounded installed Impeccable source detector plus permitted browser fixtures; disclose any memory/disk/native blocker.
- [ ] Update WORK per seven requests with exact evidence and remaining limits, return IDLE; no app restart or real acceptance inferred.
