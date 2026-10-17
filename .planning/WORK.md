
### GF-R19 — Coordination / Meal Orders recovery

- Removed synthetic coordination defaults and projections: fixed date/customer, `844`, `25000`, fake lock state, fake status, fallback meal/dish names and fabricated final servings.
- `coordinationApi.ts` now maps the actual `CoordinationOrderDto` shape, filters exact selected customer, and computes only totals from authoritative `ForecastQuantity`/`ActualQuantity` values.
- `MealOrdersPage.tsx` now loads customers from API, defaults date in `Asia/Ho_Chi_Minh`, protects against stale responses, and displays only persisted menu/dish/order facts.
- Removed unsupported lock, adjustment, print/export actions because the prior frontend payloads did not match the Backend contracts and `CoordinationOrderDto` does not expose enough persisted lifecycle state to safely enable them.
- Shift tabs remain as filter scope, not route-level work navigation.
- Tests: `MealOrders.test.tsx` 2/2 PASS; full frontend unit 17 files / 86 tests PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Browser/persistence/role-mode evidence remains BLOCKED pending Owner-authorized isolated runtime.

### GF-R20 — Reports contract recovery and N6 navigation

- Removed the fabricated meal-cost transformation of ingredient demand, fixed servings/prices/cost ratios, synthetic identifiers, fixed telemetry, fake stock availability and fake Excel success.
- Reports now use authoritative paged contracts: `ingredient-demand/aggregate/page`, `receipt-price-variance/page`, and `current-stock/page`, with exact month `dateFrom/dateTo` and `customerId` where supported.
- Route-level report work objects moved to N6 leaves: `/reports?view=demand|prices|stock`; duplicate page tabs were removed.
- Customer options come from API, current month uses `Asia/Ho_Chi_Minh`, and stale responses cannot overwrite a newer scope.
- Focused Reports/AppShell verification passed after updating N6 assertions. Full frontend unit: 17 files / 82 tests PASS; lint PASS; production build PASS; diff check PASS with line-ending warnings.
- No meal-cost report is claimed because Backend exposes no authoritative dish-cost report contract. Browser/persistence evidence remains BLOCKED.

### Scoped Pre-Code UI Gate Block — Cross-FE Audit Batch 1
- Routes: `/approvals`, `/purchasing`, `/warehouse`, `/reports`
- Single Primary Work Object: existing `OperationalFrame` per route
- Server Mode: preserve current route mode; DEFAULT data never merged with MRX
- RBAC Guards: preserve route/navigation/action guards and backend policies
- 6 UI States: loading, empty, error, permission-denied, partial, write-reconciliation
- Primitives & Composites: existing `WorkspaceHeader`, `TelemetrySubbar`, `StateBoundary`, `DataGrid`, `VietnameseDateInput`, `Num`, `IdentifierText`
- Compliance: D6, D7, T7, T8, M1.2, N6; no new tokens or primitives
- Acceptance: remove fixed operational dates, format report timestamps in Vietnamese business timezone, preserve stale-response and fail-closed behavior, and add only regression tests with observable contract value.

### GF-R21 — Cross-FE audit batch 1: operational date and timestamp authority
- Replaced fixed operational dates on `/approvals`, `/purchasing`, and `/warehouse` with `Asia/Ho_Chi_Minh` business-date authority via `todayInBusinessTimezone`.
- Added Vietnamese business-time formatting for report `lastUpdated`; raw UTC/ISO timestamps are no longer rendered directly.
- Focused component verification: 4 files / 19 tests PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Audit found next P0/P1 owner defects: `adminApi` fabricates category/unit/reference price/activity defaults; create-ingredient sends `unitName` instead of required `unitId`; approval-rule frontend model/payload does not match `ApprovalRule`/`ApprovalRuleRequest`; admin routes use blocking `alert()` and Advanced Settings exposes terminal mode/cache actions without proper confirm/feedback ownership. These remain ACTIVE, not accepted.

### Continuous Execution Plan — Owner-authorized direct parent
1. Admin contracts: remove catalog defaults, fail-close unsupported create forms, align approval-rule DTO/payload, replace alerts.
2. Navigation: migrate Admin Data and Advanced Settings route-level views to N6 URL leaves; retain only filter/detail tabs.
3. Shared state safety: implement dirty-navigation owner for route/query/history/unload and scope changes without overriding drafts.
4. State/accessibility: standardize 403/409/partial/write reconciliation and audit labels/focus/keyboard/table formatting.
5. Verification: focused red-green tests per owner, full unit/lint/build/diff/detector; browser/persistence remains blocked until authorized runtime exists.
Execution remains ACTIVE; do not stop for per-batch approval and do not mark COMPLETED.

### Scoped Pre-Code UI Gate Block — Admin Contracts
- Routes: `/admin-data`, `/settings/approval-rules`, `/settings/advanced`
- Single Primary Work Object: `OperationalFrame` for catalog/rules; `SplitWorkbench` only where existing detail panel remains justified
- Server Mode: shared catalog only where Backend allows; mode transition remains strictly DOM-MODE-1 guarded
- RBAC Guards: route/navigation `ADMIN`; action guard plus Backend Catalog/Approval/SystemOperation policies
- 6 UI States: loading, empty, error, permission-denied, partial, write-reconciliation
- Primitives: existing Button/Input/Select/Badge/Num/IdentifierText/Modal and workbench composites
- Compliance: D6, D7, T7, T8, M1.2, N6; no new styling tokens or duplicate primitives
- Acceptance: exact C# DTO mapping, no catalog fallback facts, no `alert()`, no unsupported ingredient write without authoritative unitId, and URL-owned route-level views.

### GF-R22 — Admin contract and N6 recovery
- Removed fabricated catalog defaults and unsupported ingredient/rule create mutations whose payloads did not match Backend contracts.
- Approval Rules now renders persisted `ApprovalRule` fields read-only and fails visibly on API errors.
- Admin Data and Advanced Settings route-level work views moved to N6 URL leaves; duplicate page tablists removed.
- Mode transition and cache cleanup now require an accessible confirmation modal and report inline `aria-live` feedback instead of `alert()`. Mode actions are absent outside the mode view and unchanged mode cannot be submitted.
- Full frontend unit after contract recovery: 17 files / 73 tests PASS. Focused N6/Admin verification, lint, build and detector rerun selected after final batch edits.

### GF-R23 — Shared accessibility/state hardening
- DataGrid interactive rows now support focus plus Enter/Space activation and expose `aria-selected`; visible focus ring added.
- StateBoundary now derives distinct 403/409 states from HTTP-shaped errors, exposes alert/live-region semantics, and preserves conflict messages instead of flattening them into generic errors.
- Advanced diagnostics no longer claims localhost/proxy/auth runtime health without an authorized health measurement.
- Regression coverage added at shared primitive boundary. Full frontend unit: 17 files / 75 tests PASS; lint PASS; build PASS; detector `[]`; diff check PASS with line-ending warnings.

### GF-R24 — Scope-control and accessible-label hardening
- Removed inert date controls from Approvals, Purchasing and Warehouse; they previously implied filtering but never affected requests or rendered rows.
- Removed fabricated approval fallback quantity `1275.5 kg`; absent value now stays unavailable, while authoritative amounts use `Num`.
- Approval submitted/deadline timestamps now render in Vietnamese business timezone.
- Added accessible names to customer, warehouse, supplier, shift and service-date scope controls across operational routes.
- Full frontend unit 17 files / 75 tests PASS; lint PASS; build PASS; Impeccable detector `[]`.

### GF-R25 — Weekly demand status authority
- Material-demand handoff status now maps exact Backend `MISSING | IN_PROGRESS | FULFILLED` instead of inferring procurement/readiness semantics from quantities.
- Removed fabricated `scheduleDays.isReady = true`; the weekly-menu import contract has no readiness field and the UI did not own such a claim.
- Material Demand badges now translate persisted fulfillment status into Vietnamese operational labels.
- Focused Weekly Menu/API 10/10 PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.

### GF-R26 — AppShell operational-mode and navigation authorization
- Removed direct `DEFAULT ↔ MATERIAL_RECONCILIATION` mutation from the AppShell footer; the mode badge now links to the guarded `/settings/advanced?view=mode` workflow.
- AppShell navigation now filters canonical route links and nested leaves through `CANONICAL_ROUTES.allowedRoles` using the same `hasRole` authority as `RoleGuard`; empty parent groups are omitted.
- The operational-mode badge is visible only to Admin actors; non-admin user profile and logout controls remain available.
- TDD evidence: both regression tests failed against the previous shell behavior, then passed after the owner-level repair. Full frontend unit 17 files / 76 tests PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Residual: navigation permission-token filtering and operational-mode route eligibility still require an exact canonical route contract before adding stricter filtering.

### GF-R27 — Reports server pagination authority
- Preserved Backend page metadata (`totalCount`, `pageNumber`, `pageSize`, `totalPages`, `hasPrev`, `hasNext`) instead of discarding it and presenting the first 100 records as complete.
- Reports demand, receipt-price variance and current-stock requests now accept explicit server page parameters with a compact page size of 25.
- `/reports` renders authoritative total count and accessible previous/next controls; period/customer scope changes reset to page 1 and stale response sequencing remains intact.
- TDD evidence: API metadata/query regression and report next-page behavior both failed before implementation and passed after repair. Full frontend unit 17 files / 78 tests PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- `OWNER_DECISION_REQUIRED`: canonical routes contain role lists only. No route-level permission token or mode-eligibility metadata exists, so stricter sidebar filtering was not invented from frontend assumptions.

### GF-R28 — Weekly demand completeness and Chef issue pagination
- Weekly Menu demand loading now follows Backend `totalCount` across all aggregate pages rather than silently treating the first 100 rows as the complete weekly handoff set. Empty follow-up pages terminate safely.
- Chef DEFAULT inventory issues now preserve Backend page metadata and request explicit page/page-size values; the issue work view exposes accessible previous/next server pagination at 25 rows per page.
- Customer, service-date and shift scope changes reset Chef issue pagination to page 1; stale response sequencing remains active.
- TDD evidence: multi-page weekly demand, Chef page metadata/query and Chef next-page interaction each failed before implementation and passed after repair.
- Full frontend unit 17 files / 81 tests PASS; focused API/Weekly Menu/Chef 17/17 PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.

### GF-R29 — Shared dirty-navigation owner (sidebar/query/beforeunload)
- Added a single dirty-state registry under the router and connected dirty modals to it without changing standalone primitive behavior.
- AppShell route and nested `?view=` links now defer navigation when any registered draft is dirty and present one accessible `alertdialog`; “Tiếp tục chỉnh sửa” stays on the current route, while “Hủy thay đổi” clears the registry and performs the pending navigation.
- Active dirty state installs a native `beforeunload` guard for refresh/close-tab protection and removes it after the draft is cleared.
- Modified-click behavior remains native; clean navigation remains owned by `NavLink`. No `window.confirm` or ad-hoc styling was introduced.
- TDD evidence: sidebar navigation protection failed before the shared owner existed, then passed with cancellation, discard-and-navigate and `beforeunload` assertions.
- Full frontend unit 17 files / 82 tests PASS; AppShell/Primitives focused 20/20 PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Residual: browser back/forward is not yet intercepted. `useBlocker` cannot be safely used with the current declarative `BrowserRouter`; history-loop behavior requires a separate tested owner or an authorized router migration.

### GF-R30 — HTTP state propagation and approval telemetry authority
- Approval, Admin Data, Purchasing, Dashboard and Warehouse pages now retain `Error`/`ApiError` objects instead of flattening them to strings, allowing shared `StateBoundary` to distinguish 403 permission denial and 409 write conflict.
- Added a route-level regression proving an approval inbox `ApiError(403)` renders the permission-denied state rather than a generic loading error.
- Removed fabricated Approval selector counts (`16/6/4/6`), fabricated “SLA khẩn: 2” and “Đã duyệt hôm nay: 42” telemetry because the inbox DTO does not authorize those aggregates.
- Removed fabricated “7 kho” scope copy; the warehouse selector now states only the actual scope it controls.
- Full frontend unit 17 files / 83 tests PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Residual: mutation failures in Approval currently use an inline action banner; 403/409 mutation-specific recovery remains to be standardized without replacing already-loaded read data.

### GF-R31 — Approval mutation conflict/permission recovery
- Approval decision failures now retain the mutation `ApiError` separately from read-query state, so a failed write does not remove the already-loaded inbox and selected-record context.
- HTTP 409 renders an inline write-reconciliation alert with Backend message and an explicit “Tải lại dữ liệu mới nhất” recovery action; HTTP 403 renders a distinct permission denial. Other mutation failures continue through the generic inline error banner.
- Opening a new decision clears stale mutation feedback; successful decisions clear it before reloading authoritative inbox data.
- TDD evidence: a decision conflict regression failed against the generic banner, then passed while asserting conflict semantics, recovery action and retained inbox data.
- Full frontend unit 17 files / 84 tests PASS; Approval focused 7/7 PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Runtime safety: Backend and Frontend remain running for Owner inspection; no real mutation was issued by verification.

### GF-R32 — Reconciliation completion recovery
- Reconciliation completion now owns mutation errors separately from read-query errors, so 403/409 write failures do not replace the persisted batch and daily-line evidence already loaded on screen.
- Completion 409 renders an inline write-reconciliation alert with Backend message and a “Tải lại dữ liệu mới nhất” action; completion 403 renders distinct permission feedback. Non-HTTP mutation failures remain inline.
- Completion modal closes after a failed request, preventing an overlapping blocking modal and recovery alert; successful completion clears stale mutation feedback and replaces data only with the Backend response.
- TDD evidence: completion conflict regression failed while `StateBoundary` replaced the batch, then passed while asserting retained daily line and explicit reload recovery.
- Full frontend unit 17 files / 85 tests PASS; Reconciliation focused 6/6 PASS; lint PASS; build PASS; diff check PASS with line-ending warnings.
- Runtime safety: no completion request was sent to the live Backend; running FE/BE processes remain available for Owner inspection.

### CONFORMANCE-DESIGN — Requirements-to-runtime program
- Owner approved `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`.
- Scope expands from isolated Frontend create repairs to requirements reconciliation across BR/FR/NFR/UXR/design contracts, Backend capability, workflow, FE boundary, UX/UI, and runtime evidence.
- Backend repair/capability completion is allowed after recorded Owner Decision; semantic changes require explicit decision. Migration may be proposed and source-created only after design approval; applying any migration requires separate environment/database authorization.
- Implementation is split to avoid a stale mega-plan. Foundation A plan: `docs/superpowers/plans/2026-10-17-requirements-to-runtime-foundation-a-plan.md`; later Foundation B and vertical-slice plans are created only after the inventory establishes exact contracts.
- Current phase: VERIFY — Foundation A Tasks 1–5 complete; Task 6 closure is in progress. No browser, database, migration, seed, deployment or production-readiness claim is authorized.
- Foundation A Task 1: standard-library conformance checker and fail-closed invariant tests protect duplicate/dangling IDs, owners, canonical route coverage, writable readiness, mode isolation and evidence obligations.
- Foundation A Task 2: `docs/conformance-contracts.json` inventories exactly 54 canonical requirement IDs using `title + sourceAnchor + SHA-256 statementDigest`; Markdown remains the prose authority.
- Foundation A Task 3: COMPLETE. `docs/backend-action-index.json` deterministically indexes 246/246 HTTP actions. Every action maps to exactly one source-backed operation-grain capability, and every FR maps to a capability or explicit gap. Grouped/underspecified writes remain `PARTIAL`/`BLOCKED`; no broad placeholder or readiness inflation was added.
- Foundation A Task 4: COMPLETE. Added 23 route/view surface contracts covering every canonical N6 destination. Each surface records work object, capabilities, structured write actions, six states, skeleton owner/geometry, table-contract link or explicit `TABLE_CONTRACT_GAP`, owner source and browser/persistence/actor-mode evidence obligations. Only currently rendered Backend mutations are action-linked; local cache cleanup is not misclassified as a business capability.
- Foundation A Task 5: COMPLETE. DESIGN now requires route/work-object-preserving skeleton geometry and deterministic loading resolution; ENGINEERING defines READY-write fields and evidence hierarchy; UI-KIT prohibits fake skeleton records. Contract tests bind these rules. Root `verify` now includes the conformance checker.
- Foundation A Task 6 verification evidence: conformance tests 18/18 PASS; conformance checker PASS; architecture policy tests/check PASS with six inherited debt findings and no growth; Backend build PASS; selected Backend suites PASS 49 Application + 1311 API tests. Root verification initially found `AppShell → routeRegistry` reverse dependency; route composition now injects the role resolver from `App.tsx`. Dependency cruise PASS, AppShell 7/7 PASS, lint PASS, production build PASS, and full Frontend unit 17 files / 85 tests PASS.
- Ranked closure finding: the first dependency-safe remediation slice is **Foundation B — shared route-resolved skeleton/state and guarded-action contract**, before vertical capability work. Current surface inventory deliberately records generic skeleton geometry and widespread missing table contracts; route-specific implementation without this owner would duplicate behavior and weaken loading/permission/write reconciliation guarantees.
- Remaining blockers: browser geometry/focus/zoom/responsive, actor-mode matrix and persistence/reload evidence require authorized isolated runtime; lifecycle outbox remains degraded; dirty browser Back/Forward lacks a safe router owner; authoritative dish-cost report is absent. SampleData/import, migration apply and database mutations remain unauthorized.
- Foundation A status: **CLOSED / PASS at non-mutating static and test boundaries**; program-level runtime acceptance remains `NEEDS_EVIDENCE`/`BLOCKED` as listed above.
- Foundation B status: **CLOSED / PASS at static, component and build boundaries**. Tasks 1–5 implemented under `docs/superpowers/plans/2026-10-17-requirements-to-runtime-foundation-b-plan.md`; lifecycle returned to `IDLE`.
- Ruling: `SkeletonGeometry.rows` is a geometry-only placeholder count and is permitted; the anti-synthetic gate rejects row payload/content and business-looking fields, not the numeric placeholder count. This resolves the plan's interface/test wording conflict without weakening the no-fake-data invariant.
- Runtime surface foundation: 23 route/view definitions now resolve through `frontend/src/routes/workbenchSurfaceRegistry.ts`; conformance parity checks route/view/kind/full geometry and rejects duplicate keys or business-looking geometry fields. Unknown views fall back only within their canonical route.
- Loading/state foundation: `WorkbenchSkeleton` is the single geometry-only owner for table/matrix/split/form loading; `StateBoundary` delegates loading to it and preserves explicit HTTP/state precedence. Lazy Suspense loading now resolves from the current URL through `RouteWorkbenchLoadingFallback`.
- Guarded mutation foundation: the existing `ActionGuard` now requires `capabilityId`, supports exact permission and operational-mode eligibility, and uses a disabled accessible fieldset for explained blockers. Existing Approval, MRX completion and System mode actions map respectively to `APPR.DECISION`, `RECON.BATCH.LIFECYCLE`, and `SYS.MODE.WRITE`; no new action was exposed. Approval/System shared-mode actions do not invent a current-mode restriction; MRX completion requires `MATERIAL_RECONCILIATION` plus `ReconciliationWriteAccess`.
- TDD evidence: runtime registry RED on missing module → GREEN; skeleton/state RED on missing owner → GREEN; URL fallback RED on missing component → GREEN; ActionGuard RED on activatable blocked button → GREEN; Reconciliation wrong-mode RED on enabled completion → GREEN; stale frontend mapping gap RED → GREEN.
- Verification: conformance 20/20 PASS; checker PASS; architecture tests 6/6 PASS; strict architecture check PASS with six unchanged inherited findings; lint PASS; dependency cruise PASS (68 modules / 256 dependencies); production build PASS; Frontend unit 17 files / 94 tests PASS; `git diff --check` PASS with LF→CRLF warnings only.
- Review gate: `ipc-test-audit; contract/component regression; generic loading and mode blocker lacked behavioral owners; added network-boundary/page and shared-owner RED→GREEN tests; yes; low noise; prevented fake geometry and mutation activation`.
- Review gate: `ipc-ui-review; loading/accessibility/state review; generic fallback lost route geometry and blocked actions were not semantically disabled; added aria-busy geometry and explained disabled group; correct at jsdom/static boundary; browser geometry remains noise-free unclaimed evidence; decision keeps browser status NEEDS_EVIDENCE`.
- Review gate: `ipc-code-review; scoped Foundation B diff; route/shared ownership could have reintroduced reverse dependency; placed route fallback under routes and kept workbench primitive route-agnostic; yes; inherited broad working-tree diff noted; dependency gate passed`.
- PASS: deterministic route/view geometry, no synthetic skeleton evidence, explicit state precedence, capability-linked current writes, wrong-mode MRX request prevention, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: real browser geometry, focus, 200% zoom, tablet overflow, actor/mode matrix and persistence/reload on an authorized isolated runtime.
- BLOCKED: Approval exact permission token/expected-version semantics; per-command MRX lifecycle split/concurrency; System mode concurrency/idempotency; lifecycle outbox runtime degradation; browser Back/Forward dirty-draft owner.
- Auth/System status: **CLOSED / PASS at contract, component, build and focused Backend-test boundaries** under `docs/superpowers/plans/2026-10-17-auth-system-capability-conformance-plan.md`; lifecycle returned to `IDLE`.
- Capability reconciliation: grouped `AUTH.SESSION` is split into `AUTH.LOGIN`, `AUTH.REFRESH`, `AUTH.LOGOUT`, `AUTH.REVOKE`; grouped `SYS.MODE.WRITE` is split into Backend-only `SYS.MODE.INITIALIZE` and versioned UI action `SYS.MODE.CHANGE`. `SYS.MODE.CHANGE` is `READY` against `SystemOperationModeService` optimistic-concurrency owner; other Auth/System operations retain explicit `PARTIAL` gaps rather than inflated readiness.
- Login recovery: removed all hardcoded sample usernames/passwords, default credentials and Development quick-login controls. Login fields start empty; tests supply credentials only inside test scope.
- Auth boundary: logout transport failures now propagate from `authApi`; `AuthProvider` still clears local session in its existing `finally`, so local security cleanup remains guaranteed without fabricating network success.
- Mode authority: Frontend DTO now matches Backend `SystemOperationModeDto`; PUT requires the latest fetched `version`, carries explicit confirmation/reason, and no longer writes localStorage before success or defaults version to `1`. AuthProvider applies only Backend-returned snapshots. Advanced Settings handles Backend `reasonRequired`, retains current mode on 409 and exposes authoritative reload.
- TDD evidence: capability split RED on `AUTH.SESSION` owner → GREEN; Login empty/no-shortcut RED on embedded credentials → GREEN; mode API RED on optimistic local write → GREEN; logout RED on swallowed offline failure → GREEN. Mode reason/409 rendered regression passes against the repaired owner.
- Verification: conformance 21/21 PASS; checker PASS; ZeroFake gate 2/2 PASS; focused Auth/System Frontend 51/51 PASS before final additions; full Frontend 17 files / 97 tests PASS; focused Backend Auth/SystemOperation 38/38 PASS; lint PASS; dependency cruise PASS (68 modules / 258 dependencies); production build PASS; `git diff --check` PASS with LF→CRLF warnings only. Final Advanced Settings regression 4/4, lint and build re-run PASS after selection-state synchronization.
- Review gate: `ipc-test-audit; Auth/System contract and mutation tests; embedded credentials and swallowed logout made fake-safe paths; added DOM/network-boundary and real Backend-owner assertions; yes; low noise; removed synthetic credential evidence and fake logout success`.
- Review gate: `ipc-ui-review; login/mode interaction; Login exposed credentials and mode UI lacked reason/conflict recovery; removed shortcuts and added required reason plus 409 reload; correct at jsdom/static boundary; real cookie/focus/browser behavior unmeasured; runtime remains NEEDS_EVIDENCE`.
- Review gate: `ipc-code-review; AuthProvider/systemApi ownership; fixed expectedVersion=1 and optimistic state, preserved Backend concurrency authority; yes; one lint-detected effect ownership issue repaired; no Backend semantic change`.
- PASS: no credential shortcuts, operation-grain action ownership, exact mode DTO/body, failed PUT state preservation, reason-required UI, 409 reload, no live mutation.
- NEEDS_EVIDENCE: real login/cookie rotation/logout, browser focus/autofill, Admin actor mode transition, concurrent 409 and persistence/reload on authorized isolated runtime.
- BLOCKED: refresh rotation/replay concurrency and initialization concurrency remain `PARTIAL`; no database or live credential authorization.
- Next dependency-safe slice: **Catalog/Admin contract completion**; it requires a separate bounded plan before any create/edit surface or Backend semantic change.

### GF-R33 — Catalog/Admin capability conformance and view-isolated pagination
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-catalog-admin-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-catalog-admin-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability disaggregation: Grouped capabilities (`CAT.INGREDIENT.WRITE`, `CAT.DISH.WRITE`, `CAT.BOM.WRITE`, `ADMIN.EMPLOYEE.WRITE`, `ADMIN.OUTBOX`, `APPR.RULES`) disaggregated into 18 operation-grain capabilities. `CAT.INGREDIENT.CREATE` is explicitly classified as `BLOCKED` due to missing `UnitsController` lookup authority in Backend; soft-delete and update capabilities remain `PARTIAL`; `APPR.RULES.READ` is verified `READY` mapped to `admin.approval-rules`.
- Ground truth DTO alignment: `adminApi.ts` now preserves C# `PagedResponseDto<T>` metadata (`totalCount`, `pageNumber`, `pageSize`, `totalPages`, `hasPrev`, `hasNext`), passes query parameters (`pageNumber`, `pageSize`, `searchKeyword`), and completely removes the fabricated `categoryName` property from `IngredientItem`.
- 3-Zone Workbench UI & View Isolation: `AdminDataPage.tsx` refactored to execute queries isolated to the active URL view (`?view=ingredients` loads only ingredients; `?view=dishes` loads only dishes) with cancellation guard `ignore` against stale in-flight responses. Implements accessible server pagination navigation (`<nav aria-label="Phân trang danh mục">`) using standard `<Button variant="outline" size="xs">` primitives. 100% existing UI Kit components used (`WorkspaceHeader`, `TelemetrySubbar`, `StateBoundary`, `DataGrid`, `Num`, `IdentifierText`, `Badge`, `Button`); zero custom primitives or ad-hoc styles. Write surface remains strictly closed (`READ_ONLY_BY_CONTRACT`).
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing operation-grain owners → GREEN (22/22 PASS).
  - `ApiContracts.test.ts`: RED on missing query parameters and metadata → GREEN (2/2 new tests PASS).
  - `AdminData.test.tsx`: RED on array-only contract and missing view-isolation → GREEN (5/5 tests PASS covering full 4-scenario Rule TA-4).
- Verification:
  - Conformance checker & tests: 22/22 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 102 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (zero warnings, zero errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 258 dependencies, zero violations).
  - Git diff check: PASS (clean).
- Review gate: `ipc-test-audit; Catalog/Admin contract and component regression; old tests used short IDs, lacked pagination boundaries and view isolation; added full 4-scenario testing with exact C# DTO fixtures, real DOM execution, and zero allowlist padding; yes; low noise; proved C# DTO truth and eliminated synthetic categoryName`.
- Review gate: `ipc-ui-review; 3-Zone Workbench & Server Pagination Review; previous page called both APIs and lacked pagination; enforced view isolation, semantic pagination nav, D6 typography, D7 single primary hierarchy (0 primary, 1 outline), T7 frozen header, and T8 compact density (36-40px); yes; low noise; conformed to 3-Zone Workbench without duplicate primitives`.
- Review gate: `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; adminApi stripped metadata; added PagedResult<T> mapping with C# PagedResponseDto parity, strict TypeScript types without categoryName, zero new dependencies, and clean ESLint compliance; yes; low noise; kept write surfaces safely locked`.
- PASS: Operation-grain disaggregation, C# DTO truth on DOM, server pagination navigation, view-isolated queries, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: `CAT.INGREDIENT.CREATE` remains BLOCKED pending Backend `UnitsController` endpoint; Catalog and Employee mutations lack optimistic concurrency tokens.

### GF-R34 — Weekly Menu and Coordination capability conformance and telemetry authority
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-weekly-menu-coordination-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-weekly-menu-coordination-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability disaggregation: Disaggregated 46 bundled Planning and Coordination actions into operation-grain capabilities (`COORD.ORDER.*`, `COORD.MENU_SCHEDULE.*`, `PLAN.DEMAND.*`, `COORD.CUSTOMER_CONTRACT.*`, `COORD.PORTION_RULE.*`, `PLAN.SERVICE_RUN.*`, `MENU.IMPORT.*`, `MENU.AMENDMENT.*`). Retained explicit `PARTIAL` delivery class on mutations where concurrency or authorization surfaces remain to be proven.
- Telemetry & contract authority: `WeeklyScheduleView.tsx` now renders dynamic `mealTargetPrice` via `<Num format="currency">` when price exists, or `Theo ca / Chưa chốt` when price is 0; the static hardcoded string `25.000 ₫` is eliminated.
- DTO truth & type alignment: `MenuCostView.tsx` and `types/index.ts` updated to use `dishType` and `dishGroup` from Backend C# DTOs instead of fabricated `categoryName`.
- Meal Orders error retry accessibility: `MealOrdersPage.tsx` now passes a `loadOrders` retry handler to `StateBoundary` and adds a standard outline "Làm mới" action button in `WorkspaceHeader`.
- 100% existing UI kit reuse: Used standard primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Tabs`, `Button`, `Badge`, `Num`, `IdentifierText`); zero custom components or ad-hoc CSS written.
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing operation-grain owners → GREEN (23/23 PASS).
  - `WeeklyMenu.test.tsx`: RED on hardcoded `25.000 ₫` → GREEN (8/8 PASS).
  - `MealOrders.test.tsx`: RED on missing empty state and retry button → GREEN (4/4 PASS covering full 4-scenario Rule TA-4).
- Verification:
  - Conformance checker & tests: 23/23 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 106 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gate: `ipc-test-audit; Weekly Menu and Coordination contract regression; previous tests lacked dynamic meal target assertions and error retry verification; added dynamic price assertions and 4-scenario testing; yes; low noise; proved telemetry authority and eliminated hardcoded numbers`.
- Review gate: `ipc-ui-review; 3-Zone Workbench layout & accessibility review; added missing error retry button and header refresh action to MealOrdersPage, rendered dynamic target price with Num; yes; low noise; maintained 100% existing UI kit primitives`.
- Review gate: `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; disaggregated 46 capabilities, cleaned up DishCostSummaryItem types, and protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Operation-grain disaggregation, dynamic telemetry authority, error retry recovery, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: Order locking and service run lifecycle mutations remain guarded pending live concurrency/permission authorization; dish cost report remains a `BACKEND_CAPABILITY_GAP`.

### GF-R35 — Purchasing and Approvals capability conformance and supplier telemetry authority
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-purchasing-approvals-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-purchasing-approvals-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability disaggregation: Disaggregated 23 bundled Purchasing and Approvals actions into operation-grain capabilities (`APPR.INBOX.READ`, `APPR.HISTORY.READ`, `PUR.WORKFLOW.GENERATE`, `PUR.WORKFLOW.CONFIRM_SUPPLIER`, `PUR.WORKFLOW.SUBMIT`, `PUR.ORDER.CREATE_FROM_REQUEST`, `PUR.ORDER.CANCEL`, `PUR.QUOTATION.CREATE`, `PUR.QUOTATION.UPDATE`, `PUR.QUOTATION.DEACTIVATE`, `PUR.RECEIPT.*` [6 capabilities], `WH.SUPPLEMENTAL.*` [6 capabilities]).
- Telemetry & contract authority: `PurchasingPage.tsx` now computes dynamic supplier partner counts (`suppliers.length` instead of hardcoded `(35 đối tác)`).
- Approvals single primary action hierarchy (`D7`), decision conflict recovery (409 reload), and mandatory rejection reason validation (`BR-GLOBAL-03`).
- 100% existing UI kit reuse: Used standard primitives (`WorkspaceHeader`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `Select`, `Tabs`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`). Zero custom components or ad-hoc styles written.
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing operation-grain owners → GREEN (24/24 PASS).
  - `Purchasing.test.tsx`: RED on hardcoded `35 đối tác` → GREEN (7/7 PASS).
  - `Approvals.test.tsx`: RED on rejection reason missing validation → GREEN (8/8 PASS).
- Verification:
  - Conformance checker & tests: 24/24 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 109 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Purchasing and Approvals contract regression; previous tests lacked dynamic partner count and rejection reason assertions; added dynamic assertions and 4-scenario testing; yes; low noise; proved supplier telemetry authority and BR-GLOBAL-03 compliance`.
  - `ipc-ui-review; 3-Zone SplitWorkbench layout review; verified 60/40 split, D6 font size >= 12px, D7 single primary on approvals header (0 on purchasing), T7 frozen header, T8 compact density (36-40px); yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; disaggregated 23 capabilities, cleaned up partner count, and protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Operation-grain disaggregation, dynamic supplier telemetry, BR-GLOBAL-03 rejection reason enforcement, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: Direct PO creation remains prohibited (PO must originate from approved PR); warehouse receipt and supplemental request mutations remain guarded.

### GF-R36 — Warehouse capability conformance and empty-state resiliency
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-warehouse-inventory-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-warehouse-inventory-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability disaggregation: Disaggregated 26 bundled Warehouse and Inventory actions into operation-grain capabilities (`WH.ISSUE.READ`, `WH.ISSUE.CREATE`, `WH.ISSUE.CONFIRM`, `WH.RECEIPT.READ`, `WH.RECEIPT.CREATE`, `WH.RECEIPT.CREATE_FROM_PURCHASE`, `WH.RETURN.*` [4 capabilities], `WH.STOCKTAKE.*` [6 capabilities], `WH.LEGACY_LINEAGE.*` [4 capabilities]).
- Empty state resiliency: `WarehousePage.tsx` repaired from non-resilient `isEmpty={false}` to dynamic empty state handling with domain-accurate `emptyTitle` and `emptyDescription` for both issues and receipts views.
- 100% existing UI kit reuse: Used standard primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `IdentifierText`). Zero custom components or ad-hoc styles written.
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing operation-grain owners → GREEN (25/25 PASS).
  - `Warehouse.test.tsx`: RED on empty state handling → GREEN (9/9 PASS covering full 4-scenario Rule TA-4).
- Verification:
  - Conformance checker & tests: 25/25 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 111 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Warehouse contract and component regression; previous tests lacked empty state resiliency assertions; added empty issues and receipts assertions; yes; low noise; proved empty state accessibility and Rule TA-4 compliance`.
  - `ipc-ui-review; 3-Zone OperationalFrame layout review; verified D6 font size >= 12px, D7 zero primary buttons, T7 frozen header, T8 compact density (36-40px), N6 URL-leaf navigation; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; disaggregated 26 capabilities, repaired isEmpty logic, and protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Operation-grain disaggregation, empty state resiliency, refusal to fabricate stock, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: Direct source-less issue creation remains prohibited; return and stocktake mutations remain guarded pending live authority.

### GF-R37 — Chef capability conformance and operational plan authority
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-chef-production-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-chef-production-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability verification: Verified that all 25 actions associated with `FR-CHEF` are disaggregated into operation-grain single-action capabilities in `docs/conformance-contracts.json`.
- Operational plan authority: `ChefDashboardPage.tsx` strictly adheres to 3-Zone OperationalFrame layout, compact row density (`T8`), frozen headers (`T7`), and N6 URL-leaf navigation (`?view=plans` and `?view=issues`).
- Empty state resiliency & error recovery: `Chef.test.tsx` audited and enhanced to cover clean empty state when `plans: []` (`Chưa có kế hoạch sản xuất`) under `Rule TA-4`.
- 100% existing UI kit reuse: Used standard primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Button`, `Badge`, `Num`, `IdentifierText`). Zero custom primitives or ad-hoc styles written.
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing verification assertion → GREEN (26/26 PASS).
  - `Chef.test.tsx`: RED on missing empty state coverage → GREEN (5/5 PASS covering full 4-scenario Rule TA-4).
- Verification:
  - Conformance checker & tests: 26/26 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 112 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Chef contract and component regression; previous tests lacked empty state resiliency assertions; added empty plan assertions and verified 4 scenarios; yes; low noise; proved empty state accessibility and Rule TA-4 compliance`.
  - `ipc-ui-review; 3-Zone OperationalFrame layout review; verified D6 font size >= 12px, D7 zero primary buttons, T7 frozen header, T8 compact density (36-40px), N6 URL-leaf navigation; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; verified 25 capabilities, ensured zero synthetic telemetry, and protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Operation-grain capability verification, empty state resiliency, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: Kitchen completion and variance waiver mutations remain guarded pending live authority.





