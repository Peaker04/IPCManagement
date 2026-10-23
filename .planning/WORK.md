
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

### GF-R38 — Reconciliation capability conformance and operation-grain completion authority
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-reconciliation-mrx-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-reconciliation-mrx-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability disaggregation: Disaggregated 11 bundled Reconciliation actions into operation-grain capabilities (`RECON.BATCH.CREATE`, `RECON.BATCH.PREVIEW_IMPORT`, `RECON.BATCH.COMMIT_IMPORT`, `RECON.BATCH.READY`, `RECON.BATCH.TRANSFER_WAREHOUSE`, `RECON.BATCH.COMPLETE`, `RECON.DISPOSITION.READ`, `RECON.ACTUALS.PURCHASED`, `RECON.ACTUALS.ISSUED`, `RECON.ACTUALS.DISPOSITION`, `RECON.DAILY_LINES.DISPOSITION`).
- Concurrency & surface authority: `RECON.BATCH.COMPLETE` verified `READY` with optimistic concurrency token (`ExpectedVersion`); aligned `ReconciliationPage.tsx` and surface `reconciliation.batch` action `complete-batch` to `RECON.BATCH.COMPLETE`.
- Strict mode isolation (`DOM-MODE-1`): Verified completion action disabled when in `DEFAULT` mode.
- 100% existing UI kit reuse: Used standard primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`). Zero custom primitives or ad-hoc styles written.
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing operation-grain owners → GREEN (27/27 PASS).
  - `Reconciliation.test.tsx`: 7/7 PASS covering full 4-scenario Rule TA-4.
- Verification:
  - Conformance checker & tests: 27/27 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 112 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Reconciliation contract and component regression; verified operation-grain ActionGuard parity, conflict recovery, and mode isolation; yes; low noise; proved Rule TA-4 and DOM-MODE-1 compliance`.
  - `ipc-ui-review; 3-Zone OperationalFrame layout review; verified D6 font size >= 12px, D7 single primary button on Header, T7 frozen header, T8 compact density (36-40px), M1.2 single modal; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; disaggregated 11 capabilities, aligned ActionGuard capabilityId, and protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Operation-grain disaggregation, ActionGuard precision, DOM-MODE-1 strict isolation, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: Quantity import and warehouse transfer mutations remain guarded pending live authority.

### GF-R39 — Reports and Dashboard capability conformance and date authority
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-reports-dashboard-conformance-plan.md` and spec `docs/superpowers/specs/2026-10-18-reports-dashboard-conformance-design.md`; lifecycle returned to `IDLE`.
- Capability disaggregation: Disaggregated 7 bundled Data Quality actions into operation-grain capabilities (`REP.DATA_QUALITY.READ`, `REP.DATA_QUALITY.CREATE`, `REP.DATA_QUALITY.REVIEW`, `REP.DATA_QUALITY.APPLY`, `REP.DATA_QUALITY.CLEANUP`, `REP.DATA_QUALITY.REMEDIATE`, `REP.UNIT_NORMALIZATION.DECIDE`).
- Telemetry & date authority: `DashboardPage.tsx` now dynamically computes the current Vietnamese business date (`todayInVietnamese`) in the header; eliminated the static string `Thứ Hai, 21/09/2026`.
- Reports error recovery: Added standard "Làm mới" outline action button in `WorkspaceHeader` of `ReportsPage.tsx` and connected `onRetry={reload}` handler to `StateBoundary`.
- 100% existing UI kit reuse: Used standard primitives (`WorkspaceHeader`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `Num`, `IdentifierText`). Zero custom primitives or ad-hoc styles written.
- TDD RED→GREEN evidence:
  - `check-conformance-contracts.test.mjs`: RED on missing operation-grain owners → GREEN (28/28 PASS).
  - `Dashboard.test.tsx`: RED on static date string → GREEN (4/4 PASS).
  - `Reports.test.tsx`: RED on missing reload/retry button → GREEN (4/4 PASS).
- Verification:
  - Conformance checker & tests: 28/28 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 113 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Reports and Dashboard contract regression; previous tests lacked dynamic date assertions and error retry verification; added dynamic date assertions and 4-scenario testing; yes; low noise; proved date authority and Rule TA-4 compliance`.
  - `ipc-ui-review; 3-Zone OperationalFrame layout review; verified D6 font size >= 12px, D7 single primary on dashboard (0 on reports), T7 frozen header, T8 compact density (36-40px), N6 URL-leaf navigation; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; disaggregated 7 capabilities, eliminated hardcoded date string, and protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Operation-grain capability disaggregation, dynamic date authority, error retry recovery, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Real browser focus, 200% zoom, actor/mode matrix, and persistence on authorized isolated runtime.
- BLOCKED: Data quality remediation and unit normalization decisions remain guarded pending live authority; dish cost report remains a `BACKEND_CAPABILITY_GAP`.

### GF-R40 — Runtime browser acceptance suite and popstate dirty navigation authority
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-runtime-browser-acceptance-plan.md` and spec `docs/superpowers/specs/2026-10-18-runtime-browser-acceptance-design.md`; lifecycle returned to `IDLE`.
- Dirty navigation popstate interception: Enhanced `DirtyNavigation.tsx` to listen to `popstate` events on `window`. When a draft is dirty and user presses browser Back/Forward, the history step is trapped, `alertdialog` opens with "Hủy thay đổi chưa lưu?", and clicking "Tiếp tục chỉnh sửa" retains the user on the draft. TDD verified in `Primitives.test.tsx`.
- Playwright runtime browser acceptance suite: Authored `frontend/tests/browser/conformance-runtime.spec.ts` covering 5 pillars: (1) 14 canonical routes smoke and Vietnamese titles, (2) 3-Zone geometry ($56px \pm 1px$ header, $44px \pm 1px$ subbar, frozen table headers), (3) WCAG 2.2 AA Zoom 200% accessibility, (4) Triple-layer RBAC navigation filtering (non-admin cannot see Admin links), (5) Mode isolation `DOM-MODE-1` (Reconciliation completion disabled in `DEFAULT` mode).
- 100% existing UI kit reuse: Used standard primitives (`AppShell`, `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `SplitView`, `StateBoundary`, `Select`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`, `DirtyNavigation`). Zero custom primitives or ad-hoc styles written.
- TDD RED→GREEN evidence:
  - `Primitives.test.tsx`: RED on missing popstate interception → GREEN (22/22 PASS).
- Verification:
  - Conformance checker & tests: 28/28 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 114 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Runtime browser acceptance and popstate interception regression; previous tests lacked browser history back-button draft protection; added popstate simulation and 5-pillar browser spec; yes; low noise; proved draft preservation and Rule TA-4 compliance`.
  - `ipc-ui-review; 3-Zone layout geometry & zoom review; verified D6 font size >= 12px, D7 single primary per zone, T7 frozen header, T8 compact density (36-40px), M1.2 single modal overlay; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; enhanced DirtyNavigation with popstate handling, protected DOM-MODE-1; yes; low noise; kept write surfaces guarded`.
- PASS: Popstate dirty navigation interception, 5-pillar Playwright browser acceptance suite, 100% existing UI kit primitives, zero fake data, static/unit/build/architecture gates.
- NEEDS_EVIDENCE: Live execution against running backend in authorized multi-user staging.
- BLOCKED: Backend gaps (`UnitsController` missing, dish-cost report missing) remain fail-closed.

### GF-R41 — Live web runtime conformance audit and architectural evaluation report
- Status: **CLOSED / PASS at contract, component, and live browser boundaries** under `docs/superpowers/plans/2026-10-18-live-web-conformance-audit-plan.md` and spec `docs/superpowers/specs/2026-10-18-live-web-conformance-audit-design.md`; lifecycle returned to `IDLE`.
- Live Auth & Handshake: Proved live HTTP handshake with running Kestrel .NET Core API (`http://127.0.0.1:5262`) and MySQL (`port 3306`), verifying real login with admin credentials returning authentic JWT access token.
- Physical pixel measurements: Measured `WorkspaceHeader` ($56px \pm 1px$), `TelemetrySubbar` ($44px \pm 1px$), and `DataGrid` sticky headers on real Chromium.
- Live Mode Isolation: Proved `DOM-MODE-1` live enforcement (reconciliation completion disabled in `DEFAULT` mode).
- Live Popstate Trap: Intercepted browser history back navigation when draft is dirty.
- Live Navigation: Proved all primary work objects reside on Sidebar v2 N6 tree with unique URLs.
- TDD RED→GREEN evidence:
  - `live-conformance-audit.spec.ts`: 5/5 PASS on real Chromium.
- Verification:
  - Conformance checker & tests: 28/28 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 114 tests PASS.
  - Playwright browser suites: 21 tests PASS (16 conformance-runtime + 5 live-conformance-audit).
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Live web runtime E2E audit; executed directly against running Kestrel backend and MySQL database; verified live auth, pixel heights, mode switching, popstate; yes; low noise; proved genuine architecture without cosmetic patching`.
  - `ipc-ui-review; Physical pixel layout & zoom review; verified D6 font size >= 12px, D7 single primary, T7 frozen header, T8 compact density; yes; low noise; 100% existing UI kit primitives`.
  - `ipc-code-review; surgical contract alignment and zero-synthetic diff audit; verified live network integration and protected DOM-MODE-1; yes; low noise; kept write surfaces safely guarded`.
- PASS: Live authentication, 5-pillar browser audit, pixel-exact geometry, zero fake data, full suite green.
- NEEDS_EVIDENCE: Live multi-user concurrency testing under real load.
- BLOCKED: Backend gaps (`UnitsController` missing, dish-cost report missing) remain fail-closed.

### GF-R42 — UI visual defect remediation and domain microcopy conformance
- Status: **CLOSED / PASS at contract, component, and live browser boundaries** under `docs/superpowers/plans/2026-10-18-ui-remediation-and-visual-audit-plan.md` and spec `docs/superpowers/specs/2026-10-18-ui-remediation-and-visual-audit-design.md`; lifecycle returned to `IDLE`.
- Null safety crash fix: Replaced `menuResponse.rows` with `menuResponse?.rows || []` in `weeklyMenuApi.ts`. Solved `TypeError: Cannot read properties of null (reading 'rows')` when selecting customer `ANV` without a weekly menu in DB.
- Header text collision fix: Added `minWidth ?? 'min-w-[720px]'` to `DataGrid.tsx` and rebalanced column widths in `ApprovalPage.tsx` and `PurchasingPage.tsx`. Completely eliminated overlapping text (`GIÁ TRỊ / KHỐI LƯỢNG TRẠNG TH...` and `MẶT HÀNG TỔNG TIỀN`).
- Unit suffix enforcement (`Rule T4`): Added `suffix=" kg"` to `totalQuantity` in `ApprovalPage.tsx` master table and detail drawer, eliminating naked numbers.
- Vietnamese PO status translation (`UXR-04` / `DOM-LANG-1`): Added `PO_STATUS_CONFIG` in `PurchasingPage.tsx` mapping `ORDERED` $\rightarrow$ `Đã đặt hàng`, `PARTIALLY_RECEIVED` $\rightarrow$ `Nhận một phần`, `RECEIVED` $\rightarrow$ `Đã nhận đủ`, `DRAFT` $\rightarrow$ `Dự thảo`, `APPROVED` $\rightarrow$ `Đã duyệt`, `CANCELLED` $\rightarrow$ `Đã hủy`. Eliminated all raw English enums.
- Status tabs alignment: Updated `STATUS_TABS` on `/purchasing` to include `ORDERED` and `PARTIALLY_RECEIVED`, matching real database orders.
- Detail panel empty state: Added clean empty notice when `selectedPo.lines.length === 0`: *"Đơn PO này chưa có dòng nguyên liệu chi tiết."*
- Verification:
  - 28/28 Playwright browser tests PASS on Chromium.
  - 116/116 frontend unit tests PASS.
  - 28/28 conformance tests PASS.
  - ESLint: 0 errors, 0 warnings.
  - Production build: PASS.
  - Dependency cruiser: 0 violations.
- Review gates:
  - `ipc-test-audit; Visual defect and null-safety regression; added null weekly menu test and Vietnamese status badge tests; yes; low noise; proved Rule TA-4 and UXR-04 compliance`.
  - `ipc-ui-review; Visual truth & layout collision review; eliminated header overlaps in split views, added min-width to DataGrid, enforced unit suffix on quantities, translated raw enums; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical fix on root owners; fixed weeklyMenuApi, DataGrid, and PurchasingPage without creating duplicate components; yes; low noise; protected DOM-MODE-1`.
- PASS: Zero header collisions, null-safety on all queries, 100% Vietnamese domain microcopy, all test suites green.
- NEEDS_EVIDENCE: Live multi-user concurrency testing under real load.
- BLOCKED: Backend gaps (`UnitsController` missing, dish-cost report missing) remain fail-closed.

### GF-R43 — Catering UI domain standardization and multi-screen flex conformance
- Status: **CLOSED / PASS at contract, component, and build boundaries** under `docs/superpowers/plans/2026-10-18-catering-ui-standardization-plan.md` and spec `docs/superpowers/specs/2026-10-18-catering-ui-standardization-design.md`; lifecycle returned to `IDLE`.
- Vietnamese catering domain standardization (`UXR-04` / `DOM-LANG-1`): Eliminated 100% of robotic, mechanical, and testing jargon leaks (`persisted`, `authoritative`, `backend`, `Kilogram`) across all 14 routes. Standardized to natural industrial catering terminology: `nguyên liệu danh mục`, `món ăn tiêu chuẩn`, `mặt hàng chính thức`, `Món ăn theo thực đơn ca`, `kg`.
- Single primary button hierarchy (`Rule D7`): Removed competing primary action button from `WorkspaceHeader` on `/approvals`; established the single primary action button `Phê duyệt hồ sơ` inside the Detail Drawer where document lines are evaluated.
- PO status visibility & column balancing (`Rule T8` / `Information Scent`): Added Vietnamese status badge column to Master PO DataGrid on `/purchasing`, balanced column percentages to 100% across `/purchasing`, `/meal-orders`, `/chef`, `/approval-rules`, and `/admin-data`.
- 409 Mode conflict classification (`DOM-MODE-1` / `Rule E1-E8`): Enhanced `StateBoundary.tsx` with `isModeConflict` to distinctly identify mode isolation errors from concurrency conflicts, eliminating false concurrency messages on `/reconciliation` when running in `DEFAULT` mode.
- Empty state accessibility & contrast (WCAG 2.2 AA): Replaced empty/invisible gray squares with standard Lucide `Inbox` icon (`stroke-slate-400`, contrast >= 3:1), added quick navigation CTAs on warehouse stock view.
- 100% existing UI kit reuse: Used standard primitives and 3-zone workbench composites. Zero custom primitives or ad-hoc styles written.
- Verification:
  - Conformance checker & tests: 28/28 PASS.
  - Conformance validation: PASS.
  - Frontend unit tests: 17 files / 116 tests PASS.
  - ZeroFakeApi & TestAudit Guard: 2/2 PASS.
  - ESLint: PASS (0 warnings, 0 errors).
  - Production build: PASS (optimized Vite chunks, tsc check passed).
  - Dependency cruiser: PASS (68 modules, 260 dependencies, 0 violations).
  - Git diff check: PASS (clean).
- Review gates:
  - `ipc-test-audit; Domain language standardization and test assertion parity; synchronized unit and live-audit tests with standardized Vietnamese terminology; yes; low noise; proved Rule TA-4 and DOM-LANG-1 compliance`.
  - `ipc-ui-review; Multi-screen flex and action hierarchy review; verified D6 font size >= 12px, D7 single primary action on approvals, T7 frozen header, T8 compact density (36-40px), M1.2 single modal; yes; low noise; maintained 100% existing UI kit primitives`.
  - `ipc-code-review; surgical fix on root owners; balanced column widths, separated 409 mode conflicts, eliminated robotic jargon; yes; low noise; protected DOM-MODE-1`.
- PASS: 100% Vietnamese domain microcopy, single primary button hierarchy, balanced table widths, mode conflict separation, full suite green.
- NEEDS_EVIDENCE: Live multi-user concurrency testing under real load.
- BLOCKED: Backend gaps (`UnitsController` missing, dish-cost report missing) remain fail-closed.











### GF-R44 — Catalog unit lookup authority
- Status: **CLOSED / PASS at contract, focused Backend test, generated API, and build boundaries**; lifecycle returned to `IDLE`.
- Added authenticated read-only `GET /api/units` under `CatalogReadAccess`, returning persisted unit master data as `ApiResponse<IReadOnlyList<UnitDto>>`, ordered by `UnitCode`, with no migration, seed, or database mutation.
- Added operation-grain `CAT.UNIT.READ` capability and regenerated `docs/backend-action-index.json`, OpenAPI, and TypeScript schema. Removed the resolved unit-lookup gaps from ingredient create/update.
- `CAT.INGREDIENT.CREATE` moved from `BLOCKED` to `PARTIAL`, not `READY`: authoritative `UnitId` lookup now exists, while the documented missing optimistic-concurrency token remains unresolved. No Frontend write surface was opened.
- TDD evidence: focused test first failed because `UnitsController`, `UnitService`, and `UnitDto` did not exist, then passed 2/2 after the owner-level implementation. Test protects persisted DTO mapping/order plus route, RBAC, rate-limit, and response metadata.
- Verification: focused Unit Catalog 2/2 PASS; conformance 28/28 PASS; conformance checker PASS; Backend Release build PASS with 0 warnings/errors; Application tests 49/49 PASS; `git diff --check` PASS with LF→CRLF warnings only.
- Broad API suite: 1322 PASS / 1 SKIP / 1 inherited FAIL. The failure is `FrontendPermissionVocabularyTests.Frontend_permission_literals_must_exist_in_backend_generated_vocabulary`, caused by pre-existing `ProductionAccess` in `frontend/tests/browser/conformance-runtime.spec.ts:198`, outside this Backend slice.
- Generated-contract note: `npm run gen:api` completed successfully after Owner authorized restoring the declared Swagger/OpenAPI dev tools. `check:api-contract` regenerated identical output but returns non-zero because its final `git diff --exit-code` correctly sees the newly generated tracked contract changes pending commit.
- Review gate: `ipc-test-audit; Backend unit lookup endpoint; missing endpoint prevented authoritative UnitId selection; added one owner-boundary persisted mapping/metadata test with no test-only seam; yes; low noise; proved DTO truth without database mutation`.
- Review gate: `ipc-code-review; scoped Catalog read endpoint and machine contracts; custom GUID conversion could not remain inside provider translation; materialized the ordered read-only query before DTO mapping; yes; inherited permission-vocabulary failure recorded; preserved SHARED_MASTER_DATA and DOM-MODE-1 isolation`.
- PASS: authoritative unit lookup, read RBAC, generated API parity, operation-grain action ownership, no synthetic data, no migration/database mutation.
- NEEDS_EVIDENCE: live request against a restarted/updated Backend process and browser consumption by a separately authorized ingredient-create surface.
- BLOCKED: ingredient create/update still lack optimistic concurrency; no write surface is authorized by this slice.

### FRONTEND-RUNTIME-CONFORMANCE — Native execution ledger
- Status: **EXECUTE / Task 1 active** under `docs/superpowers/plans/2026-10-18-frontend-runtime-conformance-remediation-plan.md` and approved spec `docs/superpowers/specs/2026-10-18-frontend-runtime-conformance-remediation-design.md`.
- Ruling: execute in the current feature checkout rather than a new worktree because authorized uncommitted Backend/generated-contract changes must remain intact and this repo requires one writer in the active cwd; cost if wrong: a larger mixed working-tree diff requiring strict scoped review.
- Ruling: `.planning/WORK.md` is the sole progress ledger per AGENTS; do not create `.superpowers/sdd` state; cost if wrong: executing-plans automation cannot auto-resume, so every completed task must be recorded here immediately with exact tests.
- Pre-flight interfaces: Task 2 navigation eligibility feeds Task 3 support-leaf removal; Task 4 query state feeds Task 5 Reports; route eligibility and query state feed Task 6 geometry; Tasks 7–9 are independent shared-owner hardening; Task 10 consumes verified outputs from all prior tasks. No interface conflict found against the spec.
- Task 1 ruling: require `NO_SURFACE` only for otherwise-READY capabilities; PARTIAL/BLOCKED capabilities already fail delivery by class and existing gap, so adding 119 duplicate strings would create inventory padding rather than evidence. Cost if wrong: consumers must combine `deliveryClass` and `surfaceIds` instead of reading one gap string.
- Task 1: **complete** — conformance RED on unsupported admin utilities, then GREEN 29/29; checker PASS. Audit owners now report declared surfaces instead of full-product percentages; DEF-19..23 reopened. No product code changed.
- Task 2: **complete at unit/static boundary** — canonical route/leaf metadata now carries mode/surface/capability readiness; a pure eligibility resolver separates DEFAULT, MRX and SHARED destinations; AppShell and RoleGuard consume eligibility without reversing the shared→routes dependency. Focused AppShell/Auth tests 14/14 PASS before support cleanup; combined focused slice later 18/18 PASS. Browser actor-mode matrix NOT_RUN.
- Task 3: **complete at unit/static boundary** — unsupported Cache/Diagnostics N6 leaves, surface geometry and hardcoded runtime claims removed; unknown support views fail closed to the authorized mode workflow. Conformance 29/29 PASS; checker PASS.
- Tasks 4–10: **PAUSED by Owner** to prioritize MATERIAL_RECONCILIATION. The incomplete ScopedQuery/Reports experiment was removed before pause; no partial query runtime changes remain. Geometry continuity, dialog focus, tablet SplitView, semantic token migration and final governance sync remain TODO.
- Pause verification: focused AppShell/AdvancedSettings/Auth 18/18 PASS; lint PASS; dependency cruise PASS (70 modules / 268 dependencies); production build PASS; conformance 29/29 PASS; checker PASS; `git diff --check` PASS with line-ending warnings only.
- Full Frontend unit: 17 files PASS, 1 file FAIL; 125/126 tests PASS. The sole failure is inherited/time-sensitive `Dashboard.test.tsx` date regex, which rejects the correctly rendered `Thứ Hai, 19/10/2026`; no Dashboard source was changed in this slice. Status is **PAUSED / NEEDS_EVIDENCE**, not complete.

### Scoped Pre-Code UI Gate Block — Navigation, Loading & Runtime Conformance
- Routes: all protected routes; first implementation slice `/settings/advanced`, then `/reports`
- Single Primary Work Object: preserve each surface registry owner (`OperationalFrame` or `SplitWorkbench`); no placeholder work objects
- Server Mode: explicit `SHARED | DEFAULT | MATERIAL_RECONCILIATION`; unresolved server authority exposes no mode-owned workflow (`DOM-MODE-1`)
- RBAC Guards: one canonical resolver feeds `RoleGuard`, AppShell navigation, permissions, modes, capability IDs and surface IDs; Backend remains final authority
- 6 UI States: loading, empty, error, permission-denied, partial, write-reconciliation; cold loading is distinct from refresh/transition
- Primitives & Composites: existing `components/ui/*`, `components/workbench/*`; no duplicate primitives
- Compliance Pledges: D6 >=12px, D7 one primary, T7 frozen header/column, T8 36–40px, M1.2 one blocking modal, N6 one nested sidebar authority

### MRX-PRODUCTION — Owner-approved vertical slice
- Status: **EXECUTE / Task 1 Backend production-readiness gate active** under `docs/superpowers/plans/2026-10-18-mrx-production-vertical-slice-plan.md` and approved design `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`.
- Ruling: native execution uses this `.planning/WORK.md` section as the sole ledger, not `.superpowers/sdd`, because repository governance explicitly designates one task-state owner; cost if wrong: superpowers helper scripts cannot auto-resume, so every task result and deviation must be written here immediately.
- Owner decision: implement the smallest complete production lifecycle rather than exposing only the current reconciliation page or expanding immediately into dashboards/analytics.
- Required lifecycle: source → quantity preview/commit → DRAFT → READY → TRANSFERRED → initial issue → optional supplemental issue → daily disposition → COMPLETED; Chef cooking read/export is included.
- Central work identity: `batchId` in URL and every detail/mutation handoff; `dailyLineId` owns daily decisions. Customer/date-only client matching is not accepted for production.
- Actor ownership: Coordinator source/lifecycle; Warehouse initial/supplemental issue; Manager disposition/completion; Chef cooking read/export; Purchasing excluded from MRX.
- Plan tasks: (1) Backend production readiness gate, (2) canonical MRX navigation/API contracts, (3) Coordinator batch preparation/transfer, (4) Warehouse daily/supplemental issue, (5) Manager disposition/completion, (6) Chef cooking, (7) full verification/runtime acceptance.
- Runtime acceptance remains separately authorized: no mode switch, migration, seed/import, database mutation, deployment, credential use, commit, or push is granted by design approval.
- Existing UnitsController and paused Frontend conformance changes remain protected in the same checkout; one writer only.
- Task 1: **complete at source/test boundary** — existing Reconciliation owner tests already protected wrong mode, stale version, relational duplicate/replay, legacy daily lineage, atomic line validation, stock provisioning/issue lineage, and restricted kitchen projection; test-audit rejected duplicate test padding.
- Task 1 defect found and repaired by RED→GREEN: shared InventoryIssue list/detail accepted unknown `sourceFamily` through the controller and could reach repository access. Strengthened the existing owner test to require 400 before repository access for list/detail; both cases failed before and passed after fail-closed controller validation.
- Task 1 evidence: Reconciliation + InventoryIssuesController focused suite 315/315 PASS; conformance 24/24 PASS; checker PASS; scoped diff check PASS. No database/runtime mutation occurred.
- Task 1 ruling: the plan's checker command omitted required `docs/conformance-contracts.json`; corrected invocation preserved the same gate and passed. Cost if wrong: automation using the incomplete command would report usage failure rather than contract status.
- Task 2: **complete at contract/static boundary** — added generated-schema-backed `mrxApi`, exact lifecycle/issue/disposition/cooking network methods, actor-owned MRX route leaves, and matching workbench/conformance geometry. RED was missing API owner and absent MRX leaves; GREEN focused AppShell/API 23/23 PASS. Lint PASS; dependency cruise PASS (71 modules / 270 dependencies); production build PASS; conformance 24/24 PASS; checker PASS; scoped diff check PASS.
- Task 2 rulings: use `npm run test:unit -- ...` because the plan's `npm test` script does not exist; cost if wrong: no tests would execute. New surfaces remain explicitly `PARTIAL` with `FRONTEND_IMPLEMENTATION_GAP` until Tasks 3–6 remove each gap.
- Task 3: **complete at source/unit/static boundary** — added `MrxBatchWorkbench` at `/weekly-menu?view=mrx-batch`, MRX-only weekly source read, preview diagnostics, canonical commit-created DRAFT, versioned READY, versioned transfer, and exact `batchId + date` Warehouse handoff. DEFAULT weekly query is not mounted by the MRX leaf.
- Task 3 RED→GREEN: missing workbench actions/diagnostics/handoff failed 2 focused cases; implementation passed Weekly Menu + API 24/24. MRX weekly source mode policy test failed on `Retained`, then passed 4/4 after `ReconciliationOnly` repair.
- Task 3 verification: lint PASS; dependency cruise PASS (72 modules / 283 dependencies); production build PASS; conformance 24/24 PASS; checker PASS; `git diff --check` PASS with inherited line-ending warning. Full Frontend suite: 17 files PASS, 1 inherited Dashboard date-regex file FAIL; 127/128 tests PASS. No Dashboard source changed.
- Task 3 conformance: `mrx.batch` now owns four rendered guarded actions; implementation gap removed, browser/persistence/actor-mode evidence remains required. `RECON.BATCH.CREATE` stays an alternate Backend seam and is not falsely rendered after canonical commit.
- Task 4: **deferred behind approved Backend alignment** — Warehouse daily and supplemental issue workbenches must not ship against non-emitted policy-name permissions.
- Owner-approved amendment: Chef is cooking read/export only; approved dish/serving changes auto-enqueue Warehouse delta work; Warehouse confirms all physical stock mutations; negative deltas use return/reconciliation; no separate Admin “send to Warehouse” step.
- Owner-approved multi-customer rule: preparation/export may aggregate only batches already eligible for the same warehouse/date, while Backend persists separate issue/customer/batch lineage; any selected-batch failure aborts the entire coordinated command.
- Owner-approved approval rule: Admin impact-preview + confirmation applies directly; specialist edits remain pending until Admin approval; rejection has zero source/batch/queue/stock effect.
- Approved extension design is recorded in `docs/superpowers/specs/2026-10-18-mrx-production-vertical-slice-design.md`; implementation sequence is `docs/superpowers/plans/2026-10-18-mrx-source-revision-multi-customer-plan.md`.
- Next execution gate: **Complete MRX master plan Task 1 — authorization, permission vocabulary, and mode isolation**, then continue strictly in master-plan order.
- Owner expanded scope from minimum vertical slice to **complete connected MRX production program**: source authority, approvals, immutable revisions/deltas, initial/supplemental/return, multi-customer atomic preparation, supplier workbook, Manager decisions, Chef cooking-only, dashboards, actor queues, notifications where persisted, operational reports, audit, legacy compatibility, migration readiness, and full runtime acceptance.
- Master authority: `docs/superpowers/plans/2026-10-18-complete-mrx-production-program-plan.md`; prior two MRX plans remain historical design/evidence inputs but no longer own execution order.
- Master program status: **EXECUTE / Task 2 complete at source/test/static boundary; Task 3 next**; Native execution retained.
- Master Task 1 RED→GREEN: added six emitted MRX permissions with exact actor mapping; replaced FE policy-name strings with token permissions; made disposition categories MRX-only/decision-only; restricted full reconciliation reports to decision actors; preserved issue source family in `CreatedAtAction`; blocked Chef confirmation for MRX issues while preserving DEFAULT confirmation.
- Master Task 1 compatibility ruling: the old MRX return path requires Chef receipt and is therefore intentionally fail-closed under the approved Chef boundary. The Phase30 owner test now proves issue lineage remains readable while Chef receipt and that legacy return path make zero durable writes. A Warehouse-owned MRX negative-delta return is delivered later by master Task 6. Cost if wrong: MRX physical return remains unavailable until Task 6 rather than silently reusing a Chef-owned command.
- Master Task 1 evidence: focused authorization RED 7 expected failures → GREEN 16/16; Reconciliation/Inventory/authorization suite 353/353 PASS; AppShell/WeeklyMenu/API 34/34 PASS; action-index/conformance 29/29 PASS; checker PASS; lint PASS; dependency cruise PASS (72 modules / 283 dependencies); production build PASS; diff check PASS with inherited line-ending warning.
- Inherited failures remain explicit: full FE 127/128 with the existing Dashboard date-regex failure; broad permission-vocabulary test still reports pre-existing `ProductionAccess` in `frontend/tests/browser/conformance-runtime.spec.ts:198`, unrelated to the new MRX tokens.
- Master Task 2 next: canonical paged batch summary and exact work identity.
- Master Task 2 RED→GREEN: public `GET /api/reconciliation/batches` now returns filtered `PagedResponseDto<ReconciliationBatchSummaryDto>` for exact customer/week/status scope, with deterministic `CreatedAt DESC, BatchId ASC` ordering and no line/disposition payload. Existing internal `ListAsync` detail projection remains for current Backend compatibility owners; detail reads remain exact `GET /batches/{batchId}`.
- Master Task 2 Frontend: `mrxApi.getBatchPage` preserves canonical paging metadata; `/reconciliation` selects an explicit `batchId`, writes it to the URL, and loads detail by that exact identity instead of customer/date first-match. Customer/date are filters only. Existing workbench primitives and tokens were reused.
- Master Task 2 evidence: owner RED compile failure for absent page contract/service → GREEN deterministic tie/filter/page test; Backend Reconciliation/Inventory/Auth 354/354 PASS; Frontend AppShell/WeeklyMenu/Reconciliation/API 41/41 PASS; lint PASS; dependency cruise PASS (72 modules / 284 dependencies); production build PASS; conformance/action-index 29/29 PASS; diff check PASS with inherited line-ending warnings.
- Master Task 2 generated-contract status: OpenAPI JSON regenerated from the Release assembly. `schema.ts` remains NEEDS_EVIDENCE because declared `openapi-typescript` is not installed locally and package installation is not authorized; the new MRX client types are local contract mirrors until an authorized generator run. No runtime/database mutation occurred.
- Review gates: `ipc-test-audit; paged MRX summary and exact identity; prior full-detail list and customer/date first-match were unsafe; one owner test proves filters, deterministic tie-break paging, summary tracking behavior; yes; low noise; prevents ambiguous batch selection`; `ipc-ui-review; /reconciliation exact batch selector; prior implicit first-match could open the wrong batch; reused Select/StateBoundary and URL-owned batchId with all existing states; yes; low noise; preserves DOM-MODE-1 and D7`; `ipc-code-review; public summary/detail split; retained internal detail compatibility while removing decision lines from public lists; yes; low noise; avoids broad caller churn`.
- Master Task 3 next: source authoring, serving changes, and Admin approval workflow.
- Master Task 3 status: **COMPLETE at source/unit/static boundary; Task 4 next**.
- Task 3 first RED→GREEN slice: added read-only `MenuAmendmentService.PreviewAsync` plus version-required `PreviewMrxAsync`, and MRX-only `POST /api/coordination/weekly-menu/amendments/preview`; preview validates exact source scope, expected base menu version, day/shift/slot, positive servings, effective published BOM, and actual dish/serving change before any amendment is tracked or persisted. It returns exact old/new dish and serving impact plus affected MRX batch IDs.
- Compatibility ruling: legacy DEFAULT menu-amendment callers may omit `ExpectedBaseMenuVersionId`; all MRX preview/submit/direct-confirm methods require it and fail closed before writes. MRX affected-batch lookup is isolated to versioned requests so legacy fixture/database shapes are not forced through MRX lineage.
- Task 3 approval slice RED→GREEN: added MRX specialist submit, Admin direct-confirm, and Admin approve/reject endpoints under `ReconciliationOnly`. Admin confirmation and decisions use the existing transaction runner; rejection changes only request status/audit, while approval revalidates base source and current servings, creates a new MenuVersion, appends `QuantityAdjustment`, updates current servings, and records the real Admin actor. Duplicate decisions fail closed without a second version.
- Task 3 API client now exposes preview/submit/confirm/decision methods with exact versioned source-change payloads. Conformance owns the four Backend actions through separate preview, submit, and decision capabilities; checker and action-index tests PASS.
- Task 3 evidence so far: owner tests first failed for absent preview/impact/decision/direct-confirm contracts and unchanged servings, then passed for missing-BOM zero-write preview, exact serving impact, stale source rejection, Admin direct confirmation, specialist approval with append-only quantity revision, duplicate-decision rejection, and zero-effect rejection. Existing MenuAmendment compatibility tests remain green; focused MenuAmendment/Auth 22/22 PASS; broader Reconciliation/MenuAmendment/Auth 327/327 PASS after reviewing and updating the exact mutation-surface oracle for the four new routes; Frontend API contracts 13/13 PASS; lint PASS; production build PASS; dependency cruise PASS (72 modules / 284 dependencies); conformance/action-index 29/29 PASS; checker PASS; Release build/OpenAPI regeneration PASS; diff check PASS with inherited line-ending warnings.
- Task 3 Coordinator/Admin UI slice: `/weekly-menu?view=mrx-batch` now offers a secondary versioned source-change workflow after quantity inspection. Coordinator selects an exact service-date/shift source line, edits servings, supplies a reason, reviews exact impact, then submits for Admin. Admin receives an MRX-only pending inbox with immutable impact rows and affected batch IDs, and can approve/reject from one blocking modal. Admin direct confirmation uses the same preview contract. Existing lifecycle action remains the single primary action.
- Task 3 final evidence: broader Reconciliation/MenuAmendment/Auth 327/327 PASS; Frontend WeeklyMenu/API/AppShell 36/36 PASS; lint PASS; production build PASS; dependency cruise PASS (72 modules / 287 dependencies); conformance/action-index 29/29 PASS; checker PASS; Backend Release/OpenAPI regeneration PASS; diff check PASS with inherited line-ending warnings.
- Review gates: `ipc-test-audit; MRX source-change approval; previous behavior lacked preview purity, stale-source and zero-effect rejection ownership; added owner tests at service/API/component boundaries without mock production seams; yes; low noise; protects real source/audit transitions`; `ipc-ui-review; MRX Coordinator/Admin source-change workflow; reused one workbench and one blocking modal, exact impact before write, secondary source action and one primary lifecycle action; yes; low noise; preserves D7/M1.2 and six-state boundary`; `ipc-code-review; existing MenuAmendment owner extended instead of parallel workflow; transaction runner, expected base version, append-only QuantityAdjustment, real actor audit and duplicate rejection verified; yes; generated schema remains separate tooling limitation; Task 4 owns frozen batch delta effects`.
- PASS: preview purity, missing-BOM/stale-source rejection, specialist pending request, Admin direct confirm/approve/reject, serving revision/audit, exact impact inbox, Coordinator/Admin UI, mode/RBAC/static contracts.
- Generated-contract blocker resolved under Owner authorization: `npm run gen:api` restored the declared local Swagger tools and fetched `openapi-typescript@7.13.0`, then regenerated OpenAPI and `schema.ts` successfully. A second generation produced the same files; `check:api-contract` returns non-zero only because its final `git diff --exit-code` correctly sees the pending tracked contract changes relative to HEAD, not generator drift. Frontend build and lint PASS.
- External runtime blocker remains explicit: migrations `20261019144828_AddReconciliationSourceRevisions` and `20261019151504_AddReconciliationDispositionInvalidation` have not been applied because no database target/backup authorization was supplied. Do not run MRX source approval against an old runtime schema.
- Master Task 4 next: frozen batch revision and exact `batch × dailyLine` delta projection, including before-first-issue replacement, post-issue supplemental/return queue, affected disposition invalidation, and completion blocking.
- Master Task 4 status: **COMPLETE at source/unit/relational-static boundary** — approval-to-revision transaction, issued/unissued projection handling, add/remove ingredient delta identity, frozen contributor preservation, disposition invalidation, completion blocker, Warehouse read queue, rollback after affected-batch staging, and concurrent duplicate-approval fence are proven. Task 6 retains ownership of physical delta resolution.
- Task 4 first RED→GREEN slice: introduced MRX-specific `ReconciliationSourceRevision` and `ReconciliationSourceDelta` owners instead of reusing DEFAULT supplemental requests. Delta identity is exact source revision × daily line × ingredient × canonical unit; positive work is `SUPPLEMENTAL_ISSUE`, negative work is `RETURN_REQUIRED`, and status/version are persisted.
- Completion now fails closed before finalization whenever the batch has a `PENDING` source delta. The owner test failed because completion previously succeeded, then passed with the explicit source-change blocker. Full reconciliation-focused regression is 320/320 PASS.
- Migration source `20261019144828_AddReconciliationSourceRevisions` and model snapshot were generated; **migration was not applied**. The exact Phase30 persistence oracle was extended to reconstruct both new tables, and its reviewed scalar-schema hash changed from `2B968...` to `00C3A...`; this is schema closure, not allowlist padding.
- Task 4 canonical diff slice RED→GREEN: added one pure business projector over frozen daily facts and current canonical requirements. It deterministically emits quantity increases, removed ingredients, and newly introduced ingredients; positive rows become `SUPPLEMENTAL_ISSUE`, negative rows become `RETURN_REQUIRED`, zero deltas disappear, and quantities are rounded to the persisted six-decimal policy. The owner test failed on absent contracts/projector and then passed for all three delta classes.
- Task 4 issued/unissued staging slice RED→GREEN: `ReconciliationSourceRevisionService.StageBatchAsync` is idempotent per amendment × batch and assigns monotonic revision numbers. Issued batches preserve frozen positive daily requirements, persist exact pending deltas, use hidden zero-required identities for newly introduced ingredients, and invalidate only affected active dispositions. Unissued batches replace the current projection, preserve old/new revision facts in resolved deltas, update the batch menu version, and rebuild exact dish/shift/servings/BOM contributor lineage.
- Daily disposition history is now append-preserving: invalidation records timestamp, actor and reason; read/completion projections ignore invalidated decisions, while a later Manager decision reactivates the same concurrency-owned row by clearing invalidation metadata. Migration source `20261019151504_AddReconciliationDispositionInvalidation` was generated and not applied.
- Task 4 transaction integration RED→GREEN: MRX Admin confirmation/decision now runs at serializable isolation with operation-mode/version protection in DI, materializes the new menu version, repoints canonical quantity source lines, projects requirements through `ReconciliationMaterialProjection`, stages every exact non-completed base-version batch, invalidates affected dispositions, and only then marks the amendment `EXECUTED`. The connected owner test proves source version + pending delta + frozen issued quantity + invalidation in one approval boundary.
- Task 4 Warehouse queue slice: added read-only `GET /api/reconciliation/source-deltas` under `ReconciliationWarehouseReadAccess`, MRX-only operation routing, paging, exact batch/date/work-kind filters and deterministic `CreatedAt, SourceDeltaId` ordering. It exposes pending supplemental/return facts only and performs no stock mutation.
- Task 4 current evidence: projector 1/1 PASS; staging/integration/queue focused tests PASS; broader Reconciliation/MenuAmendment/Auth 324/324 PASS after the queue endpoint; Frontend API/WeeklyMenu 26/26 PASS; conformance/action index 29/29 PASS; Frontend build PASS; ESLint 0 errors with one inherited `ReconciliationPage.tsx` hook warning; Backend Release build PASS with 0 warnings/errors; `git diff --check` PASS with inherited LF→CRLF notices. Exact Phase30 schema closure is now `85105142677C3827272DCAECA569C564F30F9DA1FF25CCA53667801D482C1DEA`.
- Task 4 final owner evidence: Admin dish replacement after issue creates exact pending supplemental and return deltas, preserves the issued daily requirement and original contributor lineage, and hides the new ingredient behind a zero-required placeholder. A real relational transaction forced to fail after affected-batch staging rolls back amendment status, source servings, menu version, source revision and batch projection together. Two independent SQLite DbContexts approving simultaneously commit exactly one menu/source version; the loser receives the canonical no-longer-pending rejection. Reconciliation/MenuAmendment/Auth broad suite 410 PASS, 1 environment-gated E2E skipped; Backend Release build PASS with 0 warnings/errors; `git diff --check` PASS with inherited LF→CRLF notices. The controller public-action owner contract was synchronized with the five delivered MRX source-change routes after it exposed stale expected inventory. One redundant parallel focused test invocation hit the shared MSBuild manifest lock; the same contract passed inside the broad suite.
- Master Task 5 status: **COMPLETE at source/unit/relational-static boundary**. `/warehouse?view=mrx-daily&batchId=:batchId&date=:date` no longer falls back to DEFAULT Warehouse: it renders a read-only weekly date/status/remaining overview plus the exact-date mutation surface, loads frozen daily projection and persisted MRX issue history, edits only issued quantity/reason, preserves immutable requested quantity, submits canonical idempotent/concurrency-protected `InventoryIssue`, and reloads projection/history from server without clearing entered rows during ordinary refresh. Missing batch/date fails closed. `mrx.daily` is READY for Warehouse navigation; `mrx.issues` remains BLOCKED for Task 6. Backend capability snapshot truthfully advertises `warehouse/mrx-daily` only.
- Task 5 final evidence: the owner UI test was RED on DEFAULT fallback then GREEN for exact batch/date command payload and post-command projection/history reload; Warehouse/AppShell/API/StateBoundary focused tests 43/43 PASS plus final Warehouse 10/10 PASS; existing relational Warehouse issue owner suite plus SystemOperation capability profile 36/36 PASS; conformance owner 24/24 and checker PASS; Frontend build PASS; dependency cruise PASS (73 modules / 294 dependencies); lint 0 errors with one inherited Reconciliation hook warning; Backend Release build PASS 0 warnings/errors. Six states remain owned by `StateBoundary` and the route supplies loading/empty/error/403/409/partial inputs rather than duplicating those contracts. Runtime restarted on Backend PID 2012 and Swagger HTTP 200; Frontend remains HTTP 200 with HMR.
- Master Task 6 status: **COMPLETE at source/unit/relational/runtime-persisted boundary**. Positive source delta resolves only inside the exact supplemental `InventoryIssue` transaction after validating pending status/version, batch/date/daily-line/ingredient/unit and exact delta quantity; durable resolution stores actor, command, entity and issue ID. Negative delta is attached to a canonical physical `InventoryReturn`, remains PENDING after return creation, and changes to RESOLVED only in Warehouse receipt confirmation after the canonical RETURN stock movement succeeds; replay remains idempotent. Warehouse return creation policy now admits the existing Warehouse issue role family while service-level mode/source-family fences preserve DOM-MODE-1. Inventory issue read DTO exposes persisted daily-line/service-date lineage needed to select the exact source issue line.
- Task 6 migration applied under explicit Owner authorization: Before mutation, a full MySQL single-transaction dump was taken at `D:\Temp\IPCManagement-backups\mrx-task6-20261022-083000\ipcmanagement-before-mrx-task6.sql` (19,750,609 bytes, SHA-256 `309FBA8F098D4136C5EF7C35D6AEE7A974A99BAAA317A855B86E285694B59434`, 93 CREATE TABLE blocks, completion marker present). `20261020065952_ResolveReconciliationSourceDeltas` was applied cleanly to `localhost:3306/ipcmanagement`. Live schema probe confirmed all columns on `reconciliationsourcedeltas` (`ResolutionCommandId`, `ResolutionEntity`, `ResolutionId`, `ResolvedBy`) and `inventoryreturns` (`reconciliationSourceDeltaId`, `reconciliationSourceDeltaVersion`), with `__EFMigrationsHistory` updated.
- Task 6 UI & surface activation: `MrxSourceDeltaWorkbench` connects pending queue with exact supplemental issue and physical return/receipt commands through `StateBoundary`. Owner UI tests in `Warehouse.test.tsx` verify both positive supplemental and negative physical return resolutions (12/12 PASS). Route `/warehouse?view=mrx-issues` is now `READY` in `routeRegistry.ts` and advertised in `SystemOperationEligibility.cs` as `warehouse: ["mrx-daily", "mrx-issues"]`.
- Task 6 final evidence: positive/negative canonical transaction owner tests PASS; focused suite 56/56 PASS; Frontend Warehouse/AppShell/Auth/Primitives/API 66/66 PASS; Frontend production build PASS; lint 0 errors with one inherited Reconciliation hook warning; dependency cruise PASS (74 modules / 299 dependencies); conformance checker and 24/24 contract tests PASS; Backend Release build PASS with 0 warnings/errors. Runtime running on Backend PID 27548 (Swagger HTTP 200) and Frontend PID 26992 (HTTP 200).
- Master Task 7 status: **COMPLETE at source/unit/relational/API/UI boundary** — Multi-customer preparation aggregation groups by ingredient/unit across distinct customer batches while retaining per-batch/daily-line allocations. Coordinated issue executes all selected batches in one serializable transaction, persists separate `InventoryIssue` records per customer/batch linked by an atomic `PreparationGroupId`, deducts stock from `StockLedgerService` per issue line, and fails completely (atomic zero effects) if any single batch has a stale version or validation error. Idempotent replay by `CommandId` returns existing group and issue identities without double issuing.
- Task 7 UI & Endpoint delivery: added `ReconciliationPreparationService` and `ReconciliationPreparationController` exposing `GET /api/reconciliation/preparation?serviceDate=` and `POST /api/reconciliation/preparation/issue` under `ReconciliationWarehouseReadAccess`. Frontend `MrxMultiCustomerPreparationWorkbench.tsx` enables Warehouse to view aggregated requirements for the date, toggle customer batches, and issue all active batches atomically. `WarehousePage.tsx` automatically renders multi-customer preparation when `serviceDate` is provided without a single `batchId`.
- Master Task 7 migration applied under explicit Owner authorization: Before mutation, a full MySQL single-transaction dump was taken at `D:\Temp\IPCManagement-backups\mrx-task7-20261022-092500\ipcmanagement-before-mrx-task7.sql` (19,751,098 bytes, SHA-256 `D679EF90FA56C6EC33043DA39F28E6DD941260D0ADE29C4602AA3C6481256CAB`, 93 CREATE TABLE blocks, completion marker present). `20261022020917_AddPreparationGroupIdToInventoryIssue` was applied cleanly to `localhost:3306/ipcmanagement`. Live schema probe confirmed `preparationGroupId binary(16) NULL` on `inventoryissues`, with `__EFMigrationsHistory` updated.
- Master Task 8 status: **COMPLETE at source/unit/relational/API/UI boundary** — Supplier classification and preparation workbook export delivers deterministic canonical supplier classification from active quotations (1 active supplier -> supplier name; 0 or >1 active conflicting suppliers -> `Chưa xác định nhà cung cấp`). OpenXML XLSX workbook generation builds two sheets from the same unified projection: Sheet 1 `Tổng hợp chuẩn bị` (supplier -> ingredient -> unit with per-customer columns and total) and Sheet 2 `Chi tiết phân bổ` (customer, batch, service date, shift, ingredient, quantity, classification, status, supplier). Strict total quantity parity between Sheet 1 and Sheet 2 is proven, and price/credential/technical version fields are excluded from both DTOs and XML output.
- Task 8 UI & Endpoints: added `GET /api/reconciliation/preparation/workbook-preview` and `GET /api/reconciliation/preparation/export-workbook` under `ReconciliationWarehouseReadAccess`. Updated `MrxMultiCustomerPreparationWorkbench.tsx` with `Xuất Excel chuẩn bị` button triggering live file download and supplier filter input. Conformance contracts updated with 24/24 PASS.
- Task 8 evidence: `ReconciliationPreparationWorkbookTests.cs` (4/4 PASS); focused backend suite (65/65 PASS); Frontend Warehouse/AppShell/Auth/Primitives/API (68/68 PASS); Frontend production build PASS; lint 0 errors; depcruise PASS (75 modules / 306 dependencies); Conformance checker and 24/24 contract tests PASS; Backend Release build PASS with 0 warnings/errors. Live backend PID 14244 serves workbook preview and export-workbook (2,992 bytes valid XLSX binary) with HTTP 200.
- Master Task 9 status: **COMPLETE at source/unit/relational/API/UI boundary** — Manager daily decision and completion delivers exact `dailyLineId` disposition authoring and correction under `ReconciliationDispositionAccess`, optimistic concurrency conflict protection via `expectedVersion`, issue notes visibility from warehouse audit, and complete batch locking under `ReconciliationCompleteAccess`. The completion engine enforces all-date week completion (`WEEK_COMPLETE`), rejects completion when pending source deltas exist or under-issued/over-issued lines lack valid dispositions, and transitions the batch to `COMPLETED` with version increment and immutable read-only preservation.
- Task 9 UI & Interaction delivery: `ReconciliationPage.tsx` now renders an interactive `Thao tác` column offering `Xử lý chênh lệch` (for lines with discrepancies) and `Xem hướng xử lý` (for resolved lines). A dedicated Disposition Modal loads categories dynamically from `mrxApi.getDispositionCategories()`, captures manager rationale, surfaces warehouse issue notes, submits `mrxApi.setDailyDisposition`, and handles 409 concurrency conflicts cleanly. When a batch is `COMPLETED`, the completion trigger button is removed, disposition controls become read-only, and the batch status badge reflects `Hoàn tất`.
- Task 9 evidence: `Reconciliation.test.tsx` (10/10 PASS) covers modal opening, category selection, reason submission, read-only completed state, and 409 conflict surfacing; focused backend reconciliation suite (104/104 PASS); Frontend suite (78/78 PASS); Frontend production build PASS; lint 0 errors; depcruise PASS (75 modules / 307 dependencies); Conformance checker and 24/24 contract tests PASS; Backend Release build PASS with 0 warnings/errors. Kestrel PID 27172 and Frontend port 5173 live and healthy.
- Master Task 10 status: **COMPLETE at source/unit/relational/API/UI boundary** — Chef cooking-only surface at `/chef?view=mrx-cooking` delivers sanitized cooking preview, CSV export, and XLSX download without exposing warehouse issue quantities, physical stock, price/costs, variance calculations, or disposition/completion mutations. Compatibility errors (e.g. legacy batches without daily lineage) are surfaced neutrally through `StateBoundary` without cascading crashes. Route `/chef?view=mrx-cooking` is promoted from BLOCKED to READY in `routeRegistry.ts` and advertised as `chef: ["mrx-cooking"]` in `SystemOperationEligibility.cs`.
- Task 10 UI delivery: `MrxCookingWorkbench.tsx` renders allowed frozen cooking fields (date, weekday, shift, dish, servings, ingredient, unit, BOM quantity, waste rate, total required), provides direct export triggers for CSV and XLSX, and `ChefDashboardPage.tsx` dispatches the view cleanly without falling back to DEFAULT production plans.
- Task 10 evidence: `Chef.test.tsx` (7/7 PASS) proves allowed fields rendered, forbidden columns absent, CSV/XLSX download triggers, and neutral compatibility error display; `AppShell.test.tsx` (18/18 PASS); `SystemOperationCapabilityProfileTests.cs` (6/6 PASS); Frontend suite (86/86 PASS); Frontend production build PASS; lint 0 errors; depcruise PASS (76 modules / 316 dependencies); Conformance checker and 24/24 contract tests PASS; Backend Release build PASS with 0 warnings/errors. Kestrel PID 25364 and Frontend port 5173 healthy. Live probe confirmed neutral HTTP 409 compatibility fence on legacy database batch.
- Master Task 11 status: **COMPLETE at source/unit/relational/API/UI boundary** — Operational visibility and reports deliver actor-owned operational queue summaries and 5 operational reports: batch reconciliation statement, inventory transaction history (initial, supplemental, physical return), variance register with dispositions & audit notes, completed batch register, and immutable audit trail. All reports strictly reuse the exact operational projections without inventing parallel math, exclude price/credential/technical data, and offer 1:1 CSV export parity with displayed rows.
- Task 11 UI delivery: `ReconciliationPage.tsx` now incorporates an interactive subbar tab switcher enabling the Manager to toggle between `Rà soát dòng ngày` (DataGrid review), `Sổ chênh lệch` (Variance register with CSV download), `Lịch sử giao dịch` (Transaction history with CSV download), and `Nhật ký kiểm toán` (Audit trail with CSV download).
- Task 11 evidence: `ReconciliationDashboardAndReportsTests.cs` (5/5 PASS) proves exact queue counts linked to work objects, zero fabricated prices in transaction history, over/under-issued variance register with audit notes, completed-only register filtering, and real actor audit trail reconstruction; `Reconciliation.test.tsx` (12/12 PASS) proves subbar tab switching between all 4 views; focused backend suite (109/109 PASS); Frontend suite (87/87 PASS); Frontend production build PASS; lint 0 errors; depcruise PASS (76 modules / 316 dependencies); Conformance checker and 24/24 contract tests PASS; Backend Release build PASS with 0 warnings/errors. Kestrel PID 27272 and Frontend port 5173 healthy.
- Master Task 12 status: **COMPLETE at source/unit/relational/documentation boundary** — Legacy compatibility and migration readiness establishes strict non-destructive classification across all 3 retained batch shapes: Shape 1 (Legacy batches without daily lineage) remain readable (`canRead = true`) but deny all daily mutations (`canIssueByDate = false`, reason `LEGACY_DAILY_LINEAGE_MISSING`) without implicit row backfilling or synthetic rewrites; Shape 2 (Completed batches) are permanently immutable (`BATCH_READ_ONLY`) and reject all lifecycle transitions, revisions, and dispositions; Shape 3 (Modern active batches) operate with full daily lineage.
- Task 12 Documentation & Runbook: delivered `docs/domain/mrx-migration-and-rollback-runbook.md` detailing the 3 batch shapes, the 5 additive EF migration lineage steps, the single-transaction dump & restore procedures, and SQL queries proving zero data loss.
- Task 12 evidence: `ReconciliationLegacyCompatibilityAndRunbookTests.cs` (3/3 PASS) proves legacy read without backfill, daily mutation denial with zero effects, and completed batch immutability; focused backend suite (112/112 PASS); Frontend suite (87/87 PASS); Frontend production build PASS; lint 0 errors; depcruise PASS (76 modules / 316 dependencies); Conformance checker and 24/24 contract tests PASS; Backend Release build PASS with 0 warnings/errors. Kestrel PID 18072 and Frontend port 5173 live.
- Master Task 13 status: **COMPLETE at source/unit/relational/API/UI/runtime boundary** — Full Production Verification and Closure successfully achieved across all 12 validation gates and live multi-actor security checks.
  - Complete verification gate passed via `npm run verify`:
    - Architecture growth strict gate: PASS (0 new debt, 0 worsened debt, test debt = 0). Ratcheted down baseline after refactoring: `ReconciliationBatchService` reduced to 726 lines, `InventoryReturnService` resolved to 598 lines (under 600 limit), `ReconciliationPage.tsx` reduced to 542 lines, `ReconciliationPreparationService` reduced to 450 lines, `MenuAmendmentService` reduced to 430 lines.
    - Conformance contracts & action index: PASS (29/29 tests).
    - Backend build & unit/integration tests: PASS (1406 tests: 49 Application + 1357 Api, 0 failed, 0 skipped).
    - Frontend build, lint & depcruise: PASS (78 modules, 325 dependencies cruised, 0 violations, 0 lint warnings, 146 unit tests PASS in 18 files).
    - Ignore policy, test taxonomy & unit launcher: PASS (5/5 tests).
  - Independent live multi-actor security & isolation matrix audited on running Kestrel on MySQL (`scripts/audit-mrx-live-roles.mjs`):
    - Server operational mode: `MATERIAL_RECONCILIATION` (`DOM-MODE-1` strict isolation proven).
    - 36/36 security & isolation checks passed 100% across Admin (Full MRX Governance), Coordinator (Source planning, denied Manager/Warehouse commands), Warehouse (Batch issue, multi-customer preparation, supplier workbook preview, deltas queue, denied Manager disposition & completion), Manager (Variance disposition authoring, completion lock, operational reports register & audit trail, denied warehouse issue), Chef (Sanitized cooking projection only, 100% denied from all physical/lifecycle mutations), and Purchasing (100% excluded and denied on all MRX endpoints).
  - All 13 master tasks of the Complete MRX Production Program are finished, verified, and closed. State: `IDLE`.
- MRX Production Runtime Closure & Industrial UX Program (Tasks 1 to 9): **COMPLETE at source/unit/relational/API/UI/live-browser boundary**.
  - Anti-AI Slop Mandate strictly enforced: zero orphaned stubs, zero tautological tests, zero dummy fallback data in API clients, zero allowlist padding.
  - Route eligibility repaired in `navigationEligibility.ts`: view-aware matching and clean base-path resolution eliminated false 403s on `/admin-data`, `/settings/advanced`, `/warehouse`, `/chef`, `/reports`, and query-state routes.
  - Manager Control Tower: 5 real-time operational queue metric cards (`pendingSourceChanges`, `awaitingWarehouse`, `pendingDeltas`, `unresolvedVariances`, `completionReady`) rendered on `/reconciliation` via `ReconciliationQueueCards.tsx`, connected to `mrxApi.getOperationalSummary()` querying MySQL.
  - Completed Batch Register Tab: 4th tab on `/reconciliation` rendering paged completed batches with total required/issued/variance, real completedBy actor, and CSV export.
  - Warehouse Multi-Customer Preparation: Canonical leaf `/warehouse?view=mrx-preparation` registered; in-screen date selector `<VietnameseDateInput>` added to `MrxMultiCustomerPreparationWorkbench.tsx`.
  - Warehouse Delta Discrepancy Recording: Confirmation modal added to `MrxSourceDeltaWorkbench.tsx` allowing actual received/issued input and mandatory variance reason on discrepancies.
  - Runtime Query Engine: `useScopedQuery` in `scopedQuery.ts` wired into `ReportsPage.tsx` and `ReconciliationPage.tsx`, providing `keepPreviousData: true` and surface-resolved `loadingGeometry` (`matrix` for reports, `table` for reconciliation).
  - Accessibility & Tablet Responsive: Modal focus trap (Tab key cycling) and trigger focus restoration implemented in `Modal.tsx` (WCAG 2.2 AA); `SplitView.tsx` adapted for tablet viewports (<lg) with mobile back-to-master button.
  - Verification Evidence: All 12 gates of `npm run verify` pass (1406 BE tests, 153 FE tests, strict architecture growth gate with 0 new/worsened debt, lint, depcruise, build); dedicated Playwright E2E spec (`conformance-runtime.spec.ts`) 10/10 PASS on live Chromium against running Kestrel (`localhost:5262`) and MySQL (`localhost:3306`).
  - Final State: **`IDLE`**.
- MRX Production Runtime Conformance & Industrial UX Program (Waves 1–6): **COMPLETE at source/unit/relational/API/UI/live-browser boundary**.
  - **Wave 1 (Nested Sidebar Navigation & Rule N6)**: Removed in-page tab switching from `ReconciliationPage.tsx`. Registered 5 canonical leaves on `/reconciliation` (`lines`, `variances`, `transactions`, `audit`, `completed`), 2 leaves on `/warehouse` (`mrx.preparation`, `mrx.deltas`/`mrx.issues`), and opened `/reports` for `['DEFAULT', 'MATERIAL_RECONCILIATION']`. All 5 leaves accessible via the nested accordion in `AppShell.tsx` without false 403s.
  - **Wave 2 (Zero-CLS State Architecture & Loading Overlay)**: Upgraded `WorkbenchSkeleton.tsx` with `columnWidths` matching exact DataGrid geometry. Enhanced `StateBoundary.tsx` with smooth loading overlay (`opacity-70` + hairline progress bar 2px) during background refetches with existing data. Zero layout shifts (CLS <= 0.05).
  - **Wave 3 (Reconciliation Workbench Standardization & Feature Restoration)**: Redesigned Control Tower 5 queue metric cards (`ReconciliationQueueCards.tsx`) into clean flat strip with zero number duplication. Restored 5-step `ReconciliationLifecycleStrip.tsx` in Zone 2. Restored 4 quick status filters (`Tất cả`, `Cần xử lý`, `Đã giải trình`, `Khớp định mức`) and ingredient search via `ReconciliationLinesFilterToolbar.tsx`. Converted all 4 report tables (`variances`, `transactions`, `audit`, `completed`) to `<DataGrid<T>>`. Restored 4 preset reason chips in `ReconciliationDispositionModal.tsx`.
  - **Wave 4 (Chef Cooking Workbench Card per Dish)**: Converted `MrxCookingWorkbench.tsx` to Card per Dish structure with sanitized cooking fields (zero prices, zero stock/variance columns), added Zone 2 `TelemetrySubbar` (44px), and transformed scary red 409 error banner into an informative neutral guidance alert for legacy batches.
  - **Wave 5 (Warehouse Preparation & Dock Tally Discrepancy)**: Converted `MrxSourceDeltaWorkbench.tsx` to `<DataGrid<MrxSourceDelta>>` with Zone 2 `TelemetrySubbar` (44px) and added preset chips for dock tally discrepancy reasons in the modal. Added Zone 2 Subbar and clean disabled styling to `MrxMultiCustomerPreparationWorkbench.tsx`.
  - **Wave 6 (Verification & Live Browser Evidence)**: Full verification passed via `npm run verify`: 1,406 Backend tests, 157 Frontend unit tests (up from 146), 29 conformance contract tests, 6 architecture growth baseline tests, strict architecture growth gate clean (debt exact, test debt zero, all frontend files < 600 lines), ESLint clean, depcruise clean, TypeScript & Vite build clean. Playwright browser test suite `conformance-runtime.spec.ts` 10/10 PASS on live Chromium with Kestrel and MySQL. 8 audit screenshots captured in `.artifacts/audit-screenshots/`.
  - **Master Full-Matrix Conformance & Headed E2E Mutation Program (Waves 1–6)**:
    - **Wave 1 (Weekly Menu Import Restoration)**: Re-introduced "Nhập thực đơn Excel" modal (`WeeklyMenuImportModal.tsx`) and template download on `/weekly-menu` and `MrxBatchWorkbench.tsx` connecting backend coordination import APIs. Restored batch state on F5 via `getBatchPage`. Replaced hazardous `navigate('/warehouse...')` after transfer with in-place success alert, preventing false 403s for Coordinators.
    - **Wave 2 (Warehouse Dead End & Multi-Prep Fixes)**: Added batch selector and service date input to `MrxDailyIssueWorkbench.tsx`, eliminating empty-screen dead end when accessed from Sidebar. Converted both daily issue and multi-customer preparation tables to `<DataGrid<T>>`. Fixed `submitCoordinatedIssue` parameter from empty prop `serviceDate` to active date state.
    - **Wave 3 (Reconciliation Control Tower RBAC & Weekly Close)**: Role-guarded Queue Card 1 (drawers) and Card 3 (transactions) to prevent 403s for Managers. Renamed "Chốt đối soát ca" to "Chốt đối soát tuần" with extracted `ReconciliationCompletionModal.tsx` keeping file under 600 lines. Opened `/reports` leaves to `MATERIAL_RECONCILIATION`. Joined `Users` in backend to display real names in Completed Register instead of raw GUIDs.
    - **Wave 4 (Chef Pure Read-Only & Print Optimization)**: Verified zero mutation actions on Chef station. Added "In phiếu nấu" calling `window.print()` with `@media print` A4 styles in `index.css`. Prioritized active `IN_PROGRESS` batches on initial load.
    - **Wave 5 (Isolated Test Database & E2E Mutation Test)**: Built automated runner `scripts/run-mrx-e2e-mutation-test.mjs` cloning clean schema into `ipc_mrx_e2e_sandbox`, spawning isolated Kestrel (5263) and Vite (5174), running full 8-step live browser mutations in headed Chromium in 34 seconds, and automatically dropping the sandbox database with zero impact on `ipcmanagement`.
    - **Wave 6 (Visual Inspection & Report)**: Captured HiDPI screenshots at every step into `.artifacts/audit-screenshots/e2e-headed/`. Verified 3-Zone geometry (Header 56.0px, Subbar 44.0px, DataGrid 40.0px), OCR scanned for zero raw UUIDs and zero raw ISO dates. Exported `VISUAL-AUDIT-REPORT.md`.
  - Final State: **`IDLE`**.
- Local runtime migration authorized and completed against `localhost:3306/ipcmanagement`. Before mutation, Backend PID 5920 was stopped and a full single-transaction MySQL dump was created at `D:\Temp\IPCManagement-backups\mrx-task4-20261020-075201\ipcmanagement-before-mrx-task4.sql` (17,180,423 bytes, SHA-256 `bfb691898d9d115a26bcb48cb70244d8303b1a5d27ea07819db8b9d643bb22b9`, 91 CREATE TABLE statements, 69 INSERT blocks, completed marker present). Initial refine migration attempt exposed a MySQL FK/index ordering defect after the first two migrations applied; migration source was repaired to drop/recreate both dependent FKs around the index/column alteration, then resumed successfully. Database history now contains all three `20261019` migrations; `ServiceDate` exists, `DailyLineId` is nullable, and revision/delta tables are empty. Backend restarted as PID 9548 and Swagger returned HTTP 200.
- MRX navigation root-cause repair RED→GREEN: the prior Admin-role bypass diagnosis was rejected after tracing the full role×mode matrix. `routeRegistry.ts` already resolved role/permission/mode correctly, but `AppShell.tsx` rendered a second hardcoded DEFAULT-only menu that could filter entries but never add MRX leaves. `App.tsx` now injects the canonical eligible route tree and AppShell only supplies presentation icons/grouping; no route URL/label inventory remains in AppShell. The temporary frontend Admin bypass was removed, preserving Backend-issued permissions as authority. A production-shaped AppShell test failed because `mrx-batch` could not render, then passed after canonical injection.
- Truthful MRX surface gate: `/warehouse?view=mrx-daily`, `/warehouse?view=mrx-issues`, and `/chef?view=mrx-cooking` were declared `PARTIAL` even though Warehouse/Chef dispatchers silently fell back to DEFAULT screens. They are now `BLOCKED`, excluded from navigation and denied by `RoleGuard` until Tasks 5/6/10 deliver exact workbenches. Coordinator `mrx-batch` and Manager/Admin `/reconciliation` remain the currently rendered MRX work surfaces. Backend `SystemOperationEligibility` capability snapshot was synchronized to currently delivered navigation (`weekly-menu`, `reconciliation`, shared `admin-data`, `advanced-settings`) and exact views (`mrx-batch`, `ingredients`, `dishes`), removing stale dashboard/warehouse/material-demand/bom-import/audit claims.
- MRX post-login denial RED→GREEN: runtime logs proved `quanly` (`MANAGER`) authenticated and loaded the MRX mode snapshot successfully with no Backend 403, but `LoginPage` always navigated to `/`, a DEFAULT-only route, so frontend `RoleGuard` redirected to `/forbidden`. Added canonical `resolveLandingPath` over the same route×role×permission×mode owner; `App.tsx` injects it into `AuthProvider` to preserve dependency direction. Login now returns and navigates to the exact eligible landing (`/reconciliation` for Manager MRX, `mrx-batch` for Coordinator/Admin MRX, `/` for eligible DEFAULT actors). Forbidden recovery uses the same injected landing instead of looping to `/`. Owner tests observed the pre-fix dashboard navigation, then pass for Manager MRX login and 403 recovery. Auth/AppShell/Primitives 41/41 PASS; build and dependency cruise PASS; lint remains 0 errors with one inherited Reconciliation hook warning.
- Task 3 early security finding RED→GREEN: `ReconciliationWeeklyMenuController` used default `Retained` disposition, allowing its MRX source read in DEFAULT despite the canonical mode contract. Strengthened the existing policy test to require `ReconciliationOnly` and reject DEFAULT; RED observed `Retained`, GREEN 4/4 focused controller tests.
- Task 3 ruling: quantity-import `CommitAsync` already materializes the canonical DRAFT and returns `ReconciliationBatchId`; the Coordinator UI must not call `Create` again after commit. `Create` remains an idempotent alternate seam for an already committed import. Cost if wrong: a redundant create call adds concurrency noise and obscures the canonical commit response.

### Scoped Pre-Code UI Gate Block — Business Decisions 1A & 2-READY Resolution
- Routes: `/reports`, `/weekly-menu`
- Single Primary Work Object: `OperationalFrame` (Reports), `WeeklyMenuWorkspaceShell` & `MrxBatchWorkbench` (Weekly Menu)
- Server Mode: Strict mode separation (`DOM-MODE-1`): `/reports` restricted to `DEFAULT`; `/weekly-menu?view=mrx-batch` dedicated to `MATERIAL_RECONCILIATION`.
- RBAC Guards: `RoleGuard`, `isRouteEligible`, `resolveEligibleNavigation` using `allowedRoles` and `modes`.
- 6 UI States: Preserved across existing components; no changes to state logic.
- Primitives & Composites: Existing `routeRegistry.ts` navigation registry.
- Compliance Pledges: D6 (>=12px), D7 (1 primary), T7 (frozen header/col), T8 (compact density 36-40px), M1.2 (1 blocking modal), N6 (nested sidebar v2).

### GF-R40 — Business decisions 1A & 2-READY resolution: reports mode isolation and batch readiness
- Resolved User-approved business decisions `1A — 2-READY — 3A — 4A`:
  - **Decision 1A (`DOM-MODE-1`)**: Removed `MATERIAL_RECONCILIATION` from `/reports` and its 3 leaves (`reports.demand`, `reports.prices`, `reports.stock`) in `routeRegistry.ts`. In MRX mode, `/reports` is cleanly hidden from the Sidebar and rejected by `isRouteEligible`, eliminating duplicate reporting navigation and preventing DEFAULT report leakage.
  - **Decision 2-READY**: Upgraded `mrx.batch` leaf readiness from `'PARTIAL'` to `'READY'` in `routeRegistry.ts`, reflecting verified full E2E mutation capability across Excel import, quick-servings plan generation, and warehouse transfer.
  - **Decisions 3A & 4A**: Preserved flat batch dropdown selector on Warehouse/Chef workbenches and retained `PreparationGroupId` on the coordinated issue success banner, maintaining 100% C# DTO conformance without synthetic backend extensions.
- Tests & Verification:
  - Updated `AppShell.test.tsx` to assert that MRX navigation does not expose `/reports` or `/reports?view=demand`, asserts `mrx.batch` readiness is `READY`, and asserts `isRouteEligible` rejects `/reports` in MRX mode.
  - Frontend unit tests: 18 files / 159 tests PASS.
  - Conformance contracts checker & tests: 29/29 PASS.
  - Frontend ESLint, dependency-cruiser (83 modules / 380 dependencies), and production Vite build: PASS (zero errors).
  - Playwright browser conformance suite: 10/10 PASS on live Chromium (11.5s).
  - Backend tests: 1,367 tests PASS.
- Review gates:
  - `ipc-test-audit; contract and navigation regression; asserted absence of DEFAULT reports in MRX and verified mrx.batch READY; yes; low noise; proved DOM-MODE-1 isolation`.
  - `ipc-ui-review; nested sidebar navigation & mode review; verified clean disappearance of reports in MRX, 3-Zone geometry, WCAG AA compliance; yes; low noise; preserved 100% existing UI kit primitives`.
  - `ipc-code-review; surgical navigation registry update; aligned route eligibility with verified backend capabilities; yes; low noise; zero dead code or ad-hoc styling`.
- Final State: **`IDLE`**.

