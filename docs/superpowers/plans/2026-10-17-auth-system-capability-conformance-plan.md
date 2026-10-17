# Auth/System Capability Conformance Implementation Plan

> **Execution:** Native inline execution with `executing-plans`; use TDD for every behavior change. Load `ipc-debugging` for observed failures, `ipc-codebase-design` for ownership changes, `ipc-test-audit` for tests, and mandatory UI/code review gates before closure.

**Goal:** Remove credential-like development shortcuts from Login, split the grouped Auth/System capabilities to their actual operation grains, and make operational-mode changes use the authoritative Backend version/eligibility contract without optimistic local state or fixed `expectedVersion`.

**Architecture:** Backend behavior is already authoritative for login/refresh/revoke and mode optimistic concurrency. This slice first repairs the machine inventory to reflect those distinct operations, then repairs the existing Frontend boundaries. `AuthProvider` remains session/mode state owner; `authApi` and `systemApi` remain network owners; `AdvancedSettingsPage` remains the only mode-change UI. No new Backend endpoint, policy, persistence behavior, migration, or sample data is introduced.

**Scope:** `/login`, Auth API/session state, `/settings/advanced?view=mode`, `AUTH.*` and `SYS.MODE.*` contracts. Excludes SampleData/import, lifecycle outbox replay, Catalog/Admin employee management, and all operational workflows.

## Safety constraints

- Never display or hardcode sample usernames/passwords, quick-login buttons, refresh tokens, bearer tokens, or credential hints.
- Refresh tokens remain HttpOnly-cookie authority; do not move them into localStorage or expose them in Frontend types/DOM/logs.
- A failed mode change must not update React state or `ipc_v3_mode`.
- A mode mutation must use the latest persisted `version` returned by `GET /system-operation-mode`; HTTP 409 retains current state and offers authoritative reload.
- Preserve `DEFAULT != MATERIAL_RECONCILIATION` and existing AdminAccess Backend policy.
- No package installation, database access/mutation, seed/import, migration, live login, live mode change, commit, push, or deploy.
- Backend semantic changes require a separately recorded Owner Decision; this plan expects none unless tests prove an authority defect.

## Task 1: Split machine capabilities at operation grain

**Files:** `docs/conformance-contracts.json`, `scripts/check-conformance-contracts.test.mjs`

- [ ] Add RED tests requiring separate capability owners for `Auth.Login`, `Auth.Refresh`, `Auth.Logout`, `Auth.Revoke`, `SystemOperationMode.Initialize`, and `SystemOperationMode.Change`.
- [ ] Require each action to remain exactly-once mapped and require write operations to declare their actual concurrency/idempotency rule or an explicit gap.
- [ ] Split `AUTH.SESSION` into public login, refresh rotation, idempotent logout, and authenticated revoke capabilities. Keep profile reads separate.
- [ ] Split `SYS.MODE.WRITE` into initialization and versioned change. Map only versioned change to `admin.mode`; initialization remains Backend-only unless a real UI exists.
- [ ] Source concurrency from `SystemOperationModeService.ChangeAsync` (`ExpectedVersion`, EF original value, conflict translation, transaction verification). Do not claim Auth guarantees beyond existing service/tests.
- [ ] Run conformance tests/checker to GREEN.

## Task 2: Remove credential-like Login shortcuts

**Files:** `frontend/src/features/auth/LoginPage.tsx`, existing Login/Auth tests

- [ ] Add a RED rendered test proving username/password start empty and no sample-account/password/quick-login copy or controls exist, including Development mode.
- [ ] Remove `SAMPLE_DB_ACCOUNTS`, default credentials and `handleQuickLogin`; retain accessible labels, submit pending guard and API error state.
- [ ] Ensure failed login preserves the username but never repopulates or reveals a password.
- [ ] Run focused Auth tests, ZeroFake guard, lint and build.

## Task 3: Align System Operation DTO and version ownership

**Files:** `frontend/src/api/systemApi.ts`, `frontend/src/store/authContext.tsx`, `frontend/src/types/index.ts`, `frontend/src/__tests__/ApiContracts.test.ts`, `frontend/src/__tests__/AdvancedSettings.test.tsx`

- [ ] Add RED API contract tests for the full Backend mode DTO (`mode`, `label`, `version`, `updatedAt`, `reasonRequired`, `capabilities`) and exact PUT body (`mode`, latest `expectedVersion`, `confirmed`, optional reason).
- [ ] Add RED state tests proving failed PUT does not change React mode/localStorage and a successful response stores the Backend-returned mode/version.
- [ ] Remove `expectedVersion = 1` and pre-request `localStorage.setItem` from `systemApi`.
- [ ] Let `AuthProvider` retain the latest mode snapshot from GET and pass its version to PUT; update local state/storage only from the successful response.
- [ ] Do not create a second mode store or infer eligibility from navigation.

## Task 4: Complete the mode-change UI contract

**Files:** `frontend/src/features/admin/AdvancedSettingsPage.tsx`, `frontend/src/__tests__/AdvancedSettings.test.tsx`, `frontend/src/components/ui/action-guard.tsx` only if a proven shared defect exists

- [ ] Add RED rendered tests for reason-required mode change, exact version submission, 409 retained current mode, explicit reload, and Admin-only confirmation.
- [ ] Show the Backend `reasonRequired` prerequisite and collect a reason only when required. Do not fabricate a reason string.
- [ ] On 409 keep the existing mode badge/state, close no evidence, and provide “Tải lại dữ liệu mới nhất”.
- [ ] On success display only the Backend-returned mode; do not claim a transition from request intent alone.
- [ ] Preserve one blocking modal, dirty-safe close behavior and capability-linked `SYS.MODE.CHANGE` action.

## Task 5: Non-mutating closure

- [ ] Run conformance tests/checker, focused Auth/System tests, full Frontend unit, ZeroFake guard, lint, dependency cruise, production build, architecture checks and `git diff --check`.
- [ ] Run relevant Backend Auth/SystemOperation unit/controller tests without database integration or live credentials.
- [ ] Apply `ipc-test-audit`, `ipc-ui-review`, and `ipc-code-review`; record the mandated skill report format in `.planning/WORK.md`.
- [ ] Report browser login/focus, real cookie behavior, actor-mode matrix, persistence/reload and real 409 concurrency as `NEEDS_EVIDENCE` unless an isolated runtime is separately authorized.
- [ ] Return lifecycle to `IDLE` and select only the next dependency-safe vertical slice.

**Completion:** No credential shortcut remains; Auth/System actions have operation-grain contracts; mode change uses authoritative versioned Backend state and fails closed without optimistic local success. No runtime/database mutation is used as evidence.
