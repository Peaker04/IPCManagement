# Phase 17 GitNexus callsite checklist

Updated: 2026-07-29
Scope: Plan 17-02 auth/session ownership and MainLayout path-only move.

## Policy result

- Both upstream and downstream impact were run against branch index `feature/workflow-b17-b18`.
- PDG `explain` found 0 taint findings in auth types/slice, logout session, MainLayout, and AppRouter.
- `pdg_query` verified auth/logout data/control dependencies and the unchanged MainLayout permission/preload/navigation guards.
- Cypher found 0 File or IMPORTS nodes for `frontend/src/components/layout/MainLayout.tsx` and `frontend/src/features/auth/logoutSession.ts`.
- Dependency-cruiser baseline reduced from 54 to 44 with no new violation.
- All nodes below are handled or verified; Deferred is empty.

## Symbol summary

| Symbol | Upstream | Downstream | Status |
|---|---:|---:|---|
| `apiSlice` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `store` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `authSlice` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `setCredentials` | HIGH 3/6 | LOW 2/5 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `setAuthLoading` | LOW 1/3 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `logOut` | HIGH 3/6 | LOW 1/3 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `selectCurrentUser` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `selectAuthToken` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `selectIsAuthenticated` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `selectIsAuthLoading` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `readStoredAuthSnapshot` | LOW 1/20 | MEDIUM 5/6 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `persistAuthSnapshot` | HIGH 1/6 | LOW 3/3 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `clearStoredAuth` | HIGH 1/6 | LOW 2/2 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `StoredAuthSnapshot` | LOW 2/22 | LOW 1/2 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `User` | CRITICAL 10/137 | LOW 1/1 | Verified graph name-collision: exact TS interface has 4 frontend imports; backend `User` access/type nodes are unrelated and untouched. |
| `AuthState` | MEDIUM 4/90 | LOW 1/1 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `AppRole` | UNKNOWN 0/0 | UNKNOWN 0/0 | Verified by Cypher + TypeScript build; parser emitted no node for this union type alias. |
| `normalizeUserRole` | LOW 1/2 | LOW 1/1 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `ROLE_LABELS` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `canAccessRole` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `subscribeSessionExpired` | LOW 0/0 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `notifySessionExpired` | LOW 1/1 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `resetSessionExpiredNotice` | HIGH 1/6 | LOW 0/0 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `logoutSession` | LOW 1/1 | LOW 2/5 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `MainLayout` | LOW 1/2 | HIGH 7/12 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |
| `AppRouter` | LOW 1/1 | CRITICAL 4/29 | Verified; no caller edit required because public signature/body is unchanged and compatibility imports remain valid. |

## Every returned node

Each entry is `symbol / direction / depth: node @ file [confidence] — disposition`.


- `apiSlice` / upstream: no returned node.
- `apiSlice` / downstream: no returned node.
- `store` / upstream: no returned node.
- `store` / downstream: no returned node.
- `authSlice` / upstream: no returned node.
- `authSlice` / downstream: no returned node.
- `setCredentials` / upstream / d1:setLoginData@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / upstream / d1:handleSubmit@frontend/src/features/auth/pages/LoginPage.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / upstream / d1:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / upstream / d2:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / upstream / d2:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / upstream / d3:App@frontend/src/App.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / downstream / d1:persistAuthSnapshot@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / downstream / d1:resetSessionExpiredNotice@frontend/src/lib/auth/sessionEvents.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / downstream / d2:canUseWebStorage@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / downstream / d2:clearLegacyRefreshToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setCredentials` / downstream / d2:clearLegacyPersistentAccessToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setAuthLoading` / upstream / d1:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setAuthLoading` / upstream / d2:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setAuthLoading` / upstream / d3:App@frontend/src/App.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `setAuthLoading` / downstream: no returned node.
- `logOut` / upstream / d1:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / upstream / d1:logoutSession@frontend/src/app/session/logoutSession.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / upstream / d1:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / upstream / d2:handleLogout@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / upstream / d2:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / upstream / d3:App@frontend/src/App.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / downstream / d1:clearStoredAuth@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / downstream / d2:canUseWebStorage@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logOut` / downstream / d2:clearLegacyRefreshToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `selectCurrentUser` / upstream: no returned node.
- `selectCurrentUser` / downstream: no returned node.
- `selectAuthToken` / upstream: no returned node.
- `selectAuthToken` / downstream: no returned node.
- `selectIsAuthenticated` / upstream: no returned node.
- `selectIsAuthenticated` / downstream: no returned node.
- `selectIsAuthLoading` / upstream: no returned node.
- `selectIsAuthLoading` / downstream: no returned node.
- `readStoredAuthSnapshot` / upstream / d1:authSlice.ts@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d2:store.ts@frontend/src/app/store.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d2:apiSlice.ts@frontend/src/api/apiSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d2:authSlice.ts@frontend/src/features/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d2:logoutSession.ts@frontend/src/app/session/logoutSession.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:main.tsx@frontend/src/main.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:routeDataPreloaders.ts@frontend/src/routes/routeDataPreloaders.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:guards.test.tsx@frontend/src/routes/guards.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:hooks.ts@frontend/src/app/hooks.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:workflowApi.ts@frontend/src/api/workflowApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:workflowApi.publicSurface.test.ts@frontend/src/api/workflowApi.publicSurface.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:dishCatalogApi.ts@frontend/src/api/dishCatalogApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:coordinationApi.ts@frontend/src/features/coordination/coordinationApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:index.ts@frontend/src/features/auth/index.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:authApi.ts@frontend/src/features/auth/authApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:adminApi.ts@frontend/src/features/admin/adminApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:MainLayout.tsx@frontend/src/app/layout/MainLayout.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:ReportsPage.permissions.test.tsx@frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:LoginPage.tsx@frontend/src/features/auth/pages/LoginPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / upstream / d3:useMaterialDemand.ts@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / downstream / d1:readLocalStorageValue@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / downstream / d1:readSessionStorageValue@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / downstream / d1:parseStoredUser@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / downstream / d1:clearLegacyRefreshToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / downstream / d1:clearLegacyPersistentAccessToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `readStoredAuthSnapshot` / downstream / d2:canUseWebStorage@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / upstream / d1:setCredentials@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / upstream / d2:setLoginData@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / upstream / d2:handleSubmit@frontend/src/features/auth/pages/LoginPage.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / upstream / d2:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / upstream / d3:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / upstream / d3:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / downstream / d1:canUseWebStorage@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / downstream / d1:clearLegacyRefreshToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `persistAuthSnapshot` / downstream / d1:clearLegacyPersistentAccessToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / upstream / d1:logOut@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / upstream / d2:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / upstream / d2:logoutSession@frontend/src/app/session/logoutSession.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / upstream / d2:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / upstream / d3:handleLogout@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / upstream / d3:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / downstream / d1:canUseWebStorage@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `clearStoredAuth` / downstream / d1:clearLegacyRefreshToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d1:authSlice.ts@frontend/src/lib/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d1:authStorage.ts@frontend/src/features/auth/authStorage.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d2:store.ts@frontend/src/app/store.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d2:apiSlice.ts@frontend/src/api/apiSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d2:authSlice.ts@frontend/src/features/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d2:authHelpers.test.ts@frontend/src/features/auth/authHelpers.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d2:logoutSession.ts@frontend/src/app/session/logoutSession.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:main.tsx@frontend/src/main.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:routeDataPreloaders.ts@frontend/src/routes/routeDataPreloaders.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:guards.test.tsx@frontend/src/routes/guards.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:hooks.ts@frontend/src/app/hooks.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:workflowApi.ts@frontend/src/api/workflowApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:workflowApi.publicSurface.test.ts@frontend/src/api/workflowApi.publicSurface.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:dishCatalogApi.ts@frontend/src/api/dishCatalogApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:coordinationApi.ts@frontend/src/features/coordination/coordinationApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:index.ts@frontend/src/features/auth/index.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:authApi.ts@frontend/src/features/auth/authApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:adminApi.ts@frontend/src/features/admin/adminApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:MainLayout.tsx@frontend/src/app/layout/MainLayout.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:ReportsPage.permissions.test.tsx@frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:LoginPage.tsx@frontend/src/features/auth/pages/LoginPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / upstream / d3:useMaterialDemand.ts@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / downstream / d1:authTypes.ts@frontend/src/lib/auth/authTypes.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `StoredAuthSnapshot` / downstream / d2:roleUtils.ts@frontend/src/lib/auth/roleUtils.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d1:MapStocktake@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[1] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d1:MapPlan@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[1] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d1:MapKitchenIssue@backend/src/IPCManagement.Api/Features/Reports/Services/InventoryOperationsReportService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d1:MapReceipt@backend/src/IPCManagement.Api/Helpers/Mappers/InventoryMapper.cs[1] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d1:MapIssue@backend/src/IPCManagement.Api/Helpers/Mappers/InventoryMapper.cs[1] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d1:MapReturn@backend/src/IPCManagement.Api/Helpers/Mappers/InventoryMapper.cs[1] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d1:apiSlice.ts@frontend/src/api/apiSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d1:authStorage.ts@frontend/src/lib/auth/authStorage.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d1:authSlice.ts@frontend/src/lib/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d1:authTypes.ts@frontend/src/features/auth/authTypes.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:GetPagedAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:ConfirmReceiptAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetPagedAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReceiptService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReceiptService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetPagedAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetPagedAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetPagedAsync@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetByIdAsync@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:GetFilteredAsync@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:BuildDailyDto@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d2:guards.test.tsx@frontend/src/routes/guards.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:store.ts@frontend/src/app/store.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:workflowApi.ts@frontend/src/api/workflowApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:workflowApi.publicSurface.test.ts@frontend/src/api/workflowApi.publicSurface.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:dishCatalogApi.ts@frontend/src/api/dishCatalogApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:coordinationApi.ts@frontend/src/features/coordination/coordinationApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:index.ts@frontend/src/features/auth/index.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:authStorage.ts@frontend/src/features/auth/authStorage.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:authSlice.ts@frontend/src/features/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:authApi.ts@frontend/src/features/auth/authApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:adminApi.ts@frontend/src/features/admin/adminApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:logoutSession.ts@frontend/src/app/session/logoutSession.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:ReportsPage.permissions.test.tsx@frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d2:useMaterialDemand.ts@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ProductionPlansGetById_Should_ReturnNotFoundEnvelope_WhenPlanMissing@backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ProductionPlansGetAll_Should_ReturnPagedApiResponse@backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ConfirmInventoryIssueReceipt_Should_MarkKitchenReceipt_AndCreateDiscrepancyIssue@backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ProductionPlans_Should_PageNewestFirst_WhenPlansSpanMultipleYears@backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetAllAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ConfirmReceiptAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryIssuesController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetAllAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryReceiptsController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryReceiptsController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetAllAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryReturnsController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryReturnsController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ConfirmReceiptAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/InventoryReturnsController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetPagedAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/StocktakesController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetByIdAsync@backend/src/IPCManagement.Api/Features/Inventory/Controllers/StocktakesController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:CreateAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:UpdateActualQtyAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:SubmitForApprovalAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ApproveAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:RejectAsync@backend/src/IPCManagement.Api/Features/Inventory/Services/StocktakeService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetAllAsync@backend/src/IPCManagement.Api/Features/Planning/Controllers/ProductionPlansController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetFilteredAsync@backend/src/IPCManagement.Api/Features/Planning/Controllers/ProductionPlansController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetByIdAsync@backend/src/IPCManagement.Api/Features/Planning/Controllers/ProductionPlansController.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetDailyAsync@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:SendDailyToKitchenAsync@backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ConfirmReceiptAsync_Should_UpdateReceivedAt_And_WriteAuditLog@backend/tests/IPCManagement.Api.Tests/InventoryIssueServiceTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:ConfirmReceiptAsync_Should_CloseFullyIssuedSupplementalRequest_InSameTransaction@backend/tests/IPCManagement.Api.Tests/InventoryIssueServiceTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetAll_Should_ApplyWarehouseClaim_ForKitchenRole@backend/tests/IPCManagement.Api.Tests/InventoryIssuesControllerTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:GetById_Should_ReturnForbidden_WhenKitchenWarehouseDoesNotMatchIssue@backend/tests/IPCManagement.Api.Tests/InventoryIssuesControllerTests.cs[0.85] — Verified no edit: cross-language `User` name-collision rooted in backend entity access; frontend interface shape/path move cannot affect this node.
- `User` / upstream / d3:main.tsx@frontend/src/main.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:routeDataPreloaders.ts@frontend/src/routes/routeDataPreloaders.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ProtectedRoute.tsx@frontend/src/routes/ProtectedRoute.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ActionGuard.tsx@frontend/src/routes/ActionGuard.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:purchasingHooksBehavior.test.tsx@frontend/src/app/purchasingHooksBehavior.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:hooks.ts@frontend/src/app/hooks.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:workflowApi.cacheInvalidation.test.ts@frontend/src/api/workflowApi.cacheInvalidation.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:workflowApi.approvalDecisionWire.test.ts@frontend/src/api/workflowApi.approvalDecisionWire.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:dishCatalogApi.test.ts@frontend/src/api/dishCatalogApi.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:WarehousePurchaseReceiptDialog.tsx@frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:warehouseIssueAllocation.ts@frontend/src/features/warehouse/warehouseIssueAllocation.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:warehouseIssueAllocation.test.ts@frontend/src/features/warehouse/warehouseIssueAllocation.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:WarehouseExceptionsWorkbench.tsx@frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:reportPlanning.ts@frontend/src/features/reports/reportPlanning.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:reportPlanning.test.ts@frontend/src/features/reports/reportPlanning.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:SupplementalPurchasingWorkbench.tsx@frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:purchasingModel.ts@frontend/src/features/purchasing/purchasingModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:purchasingModel.test.ts@frontend/src/features/purchasing/purchasingModel.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:PurchaseWorkflowGuide.tsx@frontend/src/features/purchasing/PurchaseWorkflowGuide.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:PurchaseServiceDateWorkbench.tsx@frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:purchaseServiceDatePresentation.test.tsx@frontend/src/features/purchasing/purchaseServiceDatePresentation.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:PurchaseDecisionPanel.tsx@frontend/src/features/purchasing/PurchaseDecisionPanel.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:index.ts@frontend/src/features/coordination/index.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:coordinationSlice.ts@frontend/src/features/coordination/coordinationSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:chefWorkflowBehavior.test.tsx@frontend/src/features/chef/chefWorkflowBehavior.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:chefReadiness.ts@frontend/src/features/chef/chefReadiness.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:authHelpers.test.ts@frontend/src/features/auth/authHelpers.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:MainLayout.tsx@frontend/src/app/layout/MainLayout.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:WarehousePage.tsx@frontend/src/features/warehouse/pages/WarehousePage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useReportsPageModel.ts@frontend/src/features/reports/pages/useReportsPageModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useSupplierQuotations.ts@frontend/src/features/purchasing/quotation/useSupplierQuotations.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:SupplierQuotationSection.tsx@frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:PurchasingPage.tsx@frontend/src/features/purchasing/pages/PurchasingPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:DashboardPage.tsx@frontend/src/features/dashboard/pages/DashboardPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ImportedLayoutMatrix.tsx@frontend/src/features/projects/components/ImportedLayoutMatrix.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:WeeklyMenuPage.tsx@frontend/src/features/projects/pages/WeeklyMenuPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:CoordinationPage.tsx@frontend/src/features/coordination/pages/CoordinationPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:order-table.tsx@frontend/src/features/coordination/components/order-table.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:dish-detail-dialog.tsx@frontend/src/features/coordination/components/dish-detail-dialog.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:action-toolbar.tsx@frontend/src/features/coordination/components/action-toolbar.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useKitchenReceipts.ts@frontend/src/features/chef/receipts/useKitchenReceipts.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useChefProductionPlan.ts@frontend/src/features/chef/production/useChefProductionPlan.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:chefProductionModel.ts@frontend/src/features/chef/production/chefProductionModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:chefProductionModel.test.ts@frontend/src/features/chef/production/chefProductionModel.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useChefJournal.ts@frontend/src/features/chef/journal/useChefJournal.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useChefExceptions.ts@frontend/src/features/chef/exceptions/useChefExceptions.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:LoginPage.tsx@frontend/src/features/auth/pages/LoginPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ApprovalQueryPanels.tsx@frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ApprovalPage.tsx@frontend/src/features/approvals/pages/ApprovalPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:ApprovalRulesPage.tsx@frontend/src/features/admin/pages/ApprovalRulesPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useAdminDataPageModel.ts@frontend/src/app/pages/admin-data/useAdminDataPageModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:AdminInventoryPanel.tsx@frontend/src/app/pages/admin-data/AdminInventoryPanel.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:WeeklyMenuViewContent.tsx@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:WeeklyMenuCommandBar.tsx@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useWeeklyScheduleEditor.ts@frontend/src/features/projects/weekly-menu/schedule/useWeeklyScheduleEditor.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:scheduleModel.ts@frontend/src/features/projects/weekly-menu/schedule/scheduleModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useWeeklyProductionPlan.ts@frontend/src/features/projects/weekly-menu/production-plan/useWeeklyProductionPlan.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useWeeklyMenuImport.ts@frontend/src/features/projects/weekly-menu/import/useWeeklyMenuImport.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:importValidation.ts@frontend/src/features/projects/weekly-menu/import/importValidation.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:importPresentation.test.ts@frontend/src/features/projects/weekly-menu/import/importPresentation.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:weeklyMenuModel.test.ts@frontend/src/features/projects/weekly-menu/model/weeklyMenuModel.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:types.ts@frontend/src/features/projects/weekly-menu/model/types.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:scope.ts@frontend/src/features/projects/weekly-menu/model/scope.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:formatters.ts@frontend/src/features/projects/weekly-menu/model/formatters.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useDishMaterials.ts@frontend/src/features/projects/weekly-menu/dish-materials/useDishMaterials.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:dishMaterialsModel.ts@frontend/src/features/projects/weekly-menu/dish-materials/dishMaterialsModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:weeklyPlanRowsModel.ts@frontend/src/features/projects/weekly-menu/cost/weeklyPlanRowsModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:useMenuCost.ts@frontend/src/features/projects/weekly-menu/cost/useMenuCost.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:costModel.ts@frontend/src/features/projects/weekly-menu/cost/costModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:MaterialDemandSection.tsx@frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:materialDemandErrorState.test.tsx@frontend/src/features/projects/weekly-menu/demand/materialDemandErrorState.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / upstream / d3:demandModel.ts@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `User` / downstream / d1:roleUtils.ts@frontend/src/lib/auth/roleUtils.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d1:apiSlice.ts@frontend/src/api/apiSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d1:authStorage.ts@frontend/src/lib/auth/authStorage.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d1:authSlice.ts@frontend/src/lib/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d1:authTypes.ts@frontend/src/features/auth/authTypes.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:guards.test.tsx@frontend/src/routes/guards.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:store.ts@frontend/src/app/store.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:workflowApi.ts@frontend/src/api/workflowApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:workflowApi.publicSurface.test.ts@frontend/src/api/workflowApi.publicSurface.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:dishCatalogApi.ts@frontend/src/api/dishCatalogApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:coordinationApi.ts@frontend/src/features/coordination/coordinationApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:index.ts@frontend/src/features/auth/index.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:authStorage.ts@frontend/src/features/auth/authStorage.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:authSlice.ts@frontend/src/features/auth/authSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:authApi.ts@frontend/src/features/auth/authApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:adminApi.ts@frontend/src/features/admin/adminApi.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:logoutSession.ts@frontend/src/app/session/logoutSession.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:ReportsPage.permissions.test.tsx@frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d2:useMaterialDemand.ts@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:main.tsx@frontend/src/main.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:routeDataPreloaders.ts@frontend/src/routes/routeDataPreloaders.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:ProtectedRoute.tsx@frontend/src/routes/ProtectedRoute.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:ActionGuard.tsx@frontend/src/routes/ActionGuard.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:purchasingHooksBehavior.test.tsx@frontend/src/app/purchasingHooksBehavior.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:hooks.ts@frontend/src/app/hooks.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:workflowApi.cacheInvalidation.test.ts@frontend/src/api/workflowApi.cacheInvalidation.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:workflowApi.approvalDecisionWire.test.ts@frontend/src/api/workflowApi.approvalDecisionWire.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:dishCatalogApi.test.ts@frontend/src/api/dishCatalogApi.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:WarehousePurchaseReceiptDialog.tsx@frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:warehouseIssueAllocation.ts@frontend/src/features/warehouse/warehouseIssueAllocation.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:warehouseIssueAllocation.test.ts@frontend/src/features/warehouse/warehouseIssueAllocation.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:WarehouseExceptionsWorkbench.tsx@frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:reportPlanning.ts@frontend/src/features/reports/reportPlanning.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:reportPlanning.test.ts@frontend/src/features/reports/reportPlanning.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:SupplementalPurchasingWorkbench.tsx@frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:purchasingModel.ts@frontend/src/features/purchasing/purchasingModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:purchasingModel.test.ts@frontend/src/features/purchasing/purchasingModel.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:PurchaseWorkflowGuide.tsx@frontend/src/features/purchasing/PurchaseWorkflowGuide.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:PurchaseServiceDateWorkbench.tsx@frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:purchaseServiceDatePresentation.test.tsx@frontend/src/features/purchasing/purchaseServiceDatePresentation.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:PurchaseDecisionPanel.tsx@frontend/src/features/purchasing/PurchaseDecisionPanel.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:index.ts@frontend/src/features/coordination/index.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:coordinationSlice.ts@frontend/src/features/coordination/coordinationSlice.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:chefWorkflowBehavior.test.tsx@frontend/src/features/chef/chefWorkflowBehavior.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:chefReadiness.ts@frontend/src/features/chef/chefReadiness.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:authHelpers.test.ts@frontend/src/features/auth/authHelpers.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:MainLayout.tsx@frontend/src/app/layout/MainLayout.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:WarehousePage.tsx@frontend/src/features/warehouse/pages/WarehousePage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useReportsPageModel.ts@frontend/src/features/reports/pages/useReportsPageModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useSupplierQuotations.ts@frontend/src/features/purchasing/quotation/useSupplierQuotations.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:SupplierQuotationSection.tsx@frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:PurchasingPage.tsx@frontend/src/features/purchasing/pages/PurchasingPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:DashboardPage.tsx@frontend/src/features/dashboard/pages/DashboardPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:ImportedLayoutMatrix.tsx@frontend/src/features/projects/components/ImportedLayoutMatrix.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:WeeklyMenuPage.tsx@frontend/src/features/projects/pages/WeeklyMenuPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:CoordinationPage.tsx@frontend/src/features/coordination/pages/CoordinationPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:order-table.tsx@frontend/src/features/coordination/components/order-table.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:dish-detail-dialog.tsx@frontend/src/features/coordination/components/dish-detail-dialog.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:action-toolbar.tsx@frontend/src/features/coordination/components/action-toolbar.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useKitchenReceipts.ts@frontend/src/features/chef/receipts/useKitchenReceipts.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useChefProductionPlan.ts@frontend/src/features/chef/production/useChefProductionPlan.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:chefProductionModel.ts@frontend/src/features/chef/production/chefProductionModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:chefProductionModel.test.ts@frontend/src/features/chef/production/chefProductionModel.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useChefJournal.ts@frontend/src/features/chef/journal/useChefJournal.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useChefExceptions.ts@frontend/src/features/chef/exceptions/useChefExceptions.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:LoginPage.tsx@frontend/src/features/auth/pages/LoginPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:ApprovalQueryPanels.tsx@frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:ApprovalPage.tsx@frontend/src/features/approvals/pages/ApprovalPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:ApprovalRulesPage.tsx@frontend/src/features/admin/pages/ApprovalRulesPage.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useAdminDataPageModel.ts@frontend/src/app/pages/admin-data/useAdminDataPageModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:AdminInventoryPanel.tsx@frontend/src/app/pages/admin-data/AdminInventoryPanel.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:WeeklyMenuViewContent.tsx@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:WeeklyMenuCommandBar.tsx@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useWeeklyScheduleEditor.ts@frontend/src/features/projects/weekly-menu/schedule/useWeeklyScheduleEditor.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:scheduleModel.ts@frontend/src/features/projects/weekly-menu/schedule/scheduleModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useWeeklyProductionPlan.ts@frontend/src/features/projects/weekly-menu/production-plan/useWeeklyProductionPlan.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useWeeklyMenuImport.ts@frontend/src/features/projects/weekly-menu/import/useWeeklyMenuImport.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:importValidation.ts@frontend/src/features/projects/weekly-menu/import/importValidation.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:importPresentation.test.ts@frontend/src/features/projects/weekly-menu/import/importPresentation.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:weeklyMenuModel.test.ts@frontend/src/features/projects/weekly-menu/model/weeklyMenuModel.test.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:types.ts@frontend/src/features/projects/weekly-menu/model/types.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:scope.ts@frontend/src/features/projects/weekly-menu/model/scope.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:formatters.ts@frontend/src/features/projects/weekly-menu/model/formatters.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useDishMaterials.ts@frontend/src/features/projects/weekly-menu/dish-materials/useDishMaterials.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:dishMaterialsModel.ts@frontend/src/features/projects/weekly-menu/dish-materials/dishMaterialsModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:weeklyPlanRowsModel.ts@frontend/src/features/projects/weekly-menu/cost/weeklyPlanRowsModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:useMenuCost.ts@frontend/src/features/projects/weekly-menu/cost/useMenuCost.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:costModel.ts@frontend/src/features/projects/weekly-menu/cost/costModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:MaterialDemandSection.tsx@frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:materialDemandErrorState.test.tsx@frontend/src/features/projects/weekly-menu/demand/materialDemandErrorState.test.tsx[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / upstream / d3:demandModel.ts@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AuthState` / downstream / d1:roleUtils.ts@frontend/src/lib/auth/roleUtils.ts[1] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRole` / upstream: no returned node.
- `AppRole` / downstream: no returned node.
- `normalizeUserRole` / upstream / d1:setLoginData@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `normalizeUserRole` / upstream / d2:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `normalizeUserRole` / downstream / d1:normalizeRoleText@frontend/src/lib/auth/roleUtils.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `ROLE_LABELS` / upstream: no returned node.
- `ROLE_LABELS` / downstream: no returned node.
- `canAccessRole` / upstream: no returned node.
- `canAccessRole` / downstream: no returned node.
- `subscribeSessionExpired` / upstream: no returned node.
- `subscribeSessionExpired` / downstream: no returned node.
- `notifySessionExpired` / upstream / d1:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `notifySessionExpired` / downstream: no returned node.
- `resetSessionExpiredNotice` / upstream / d1:setCredentials@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `resetSessionExpiredNotice` / upstream / d2:setLoginData@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `resetSessionExpiredNotice` / upstream / d2:handleSubmit@frontend/src/features/auth/pages/LoginPage.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `resetSessionExpiredNotice` / upstream / d2:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `resetSessionExpiredNotice` / upstream / d3:baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `resetSessionExpiredNotice` / upstream / d3:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `resetSessionExpiredNotice` / downstream: no returned node.
- `logoutSession` / upstream / d1:handleLogout@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logoutSession` / downstream / d1:isDevFallbackToken@frontend/src/app/session/logoutSession.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logoutSession` / downstream / d1:logOut@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logoutSession` / downstream / d2:clearStoredAuth@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logoutSession` / downstream / d3:canUseWebStorage@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `logoutSession` / downstream / d3:clearLegacyRefreshToken@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / upstream / d1:AppRouter@frontend/src/routes/AppRouter.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / upstream / d2:App@frontend/src/App.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:useAppDispatch@frontend/src/app/hooks.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:preloadNavigationTarget@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:canPreloadRoutesInBackground@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:HeaderShiftContext@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:scheduleNextRoute@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:toneFromStatus@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d1:getWorkflowContextForPath@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d2:getWorkflowStatusPresentation@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d2:preloadRoute@frontend/src/routes/routeLoaders.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d2:preloadRouteData@frontend/src/routes/routeLoaders.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d3:normalizeStatusCode@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `MainLayout` / downstream / d3:toneFromFallbackText@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / upstream / d1:App@frontend/src/App.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d1:MainLayout@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d1:SessionTimeoutModal@frontend/src/features/auth/components/SessionTimeoutModal.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d1:ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d1:RoleGuard@frontend/src/routes/RoleGuard.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:useAppDispatch@frontend/src/app/hooks.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:preloadNavigationTarget@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:canPreloadRoutesInBackground@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:HeaderShiftContext@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:scheduleNextRoute@frontend/src/app/layout/MainLayout.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:Button@frontend/src/components/ui/button.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:Dialog@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:DialogContent@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:DialogHeader@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:DialogFooter@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:DialogTitle@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:DialogDescription@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:goToLogin@frontend/src/features/auth/components/SessionTimeoutModal.tsx[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:setCredentials@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:setAuthLoading@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:logOut@frontend/src/lib/auth/authSlice.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:toneFromStatus@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d2:getWorkflowContextForPath@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:persistAuthSnapshot@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:clearStoredAuth@frontend/src/lib/auth/authStorage.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:resetSessionExpiredNotice@frontend/src/lib/auth/sessionEvents.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:cn@frontend/src/lib/utils.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:getWorkflowStatusPresentation@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:preloadRoute@frontend/src/routes/routeLoaders.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.
- `AppRouter` / downstream / d3:preloadRouteData@frontend/src/routes/routeLoaders.ts[0.85] — Verified no edit: path/owner changed only; symbol signature and executable body are unchanged, focused tests/lint/build pass.

## HIGH/CRITICAL trace review


- `setLoginData→persist`: ok; setLoginData@frontend/src/api/apiSlice.ts:52 → setCredentials@frontend/src/lib/auth/authSlice.ts:19 → persistAuthSnapshot@frontend/src/lib/auth/authStorage.ts:76; CALLS:0.85, CALLS:0.85.
- `handleSubmit→persist`: ok; handleSubmit@frontend/src/features/auth/pages/LoginPage.tsx:63 → setCredentials@frontend/src/lib/auth/authSlice.ts:19 → persistAuthSnapshot@frontend/src/lib/auth/authStorage.ts:76; CALLS:0.85, CALLS:0.85.
- `ProtectedRoute→persist`: ok; ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx:15 → setCredentials@frontend/src/lib/auth/authSlice.ts:19 → persistAuthSnapshot@frontend/src/lib/auth/authStorage.ts:76; CALLS:0.85, CALLS:0.85.
- `setLoginData→reset`: ok; setLoginData@frontend/src/api/apiSlice.ts:52 → setCredentials@frontend/src/lib/auth/authSlice.ts:19 → resetSessionExpiredNotice@frontend/src/lib/auth/sessionEvents.ts:22; CALLS:0.85, CALLS:0.85.
- `handleSubmit→reset`: ok; handleSubmit@frontend/src/features/auth/pages/LoginPage.tsx:63 → setCredentials@frontend/src/lib/auth/authSlice.ts:19 → resetSessionExpiredNotice@frontend/src/lib/auth/sessionEvents.ts:22; CALLS:0.85, CALLS:0.85.
- `ProtectedRoute→reset`: ok; ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx:15 → setCredentials@frontend/src/lib/auth/authSlice.ts:19 → resetSessionExpiredNotice@frontend/src/lib/auth/sessionEvents.ts:22; CALLS:0.85, CALLS:0.85.
- `baseQuery→clear`: ok; baseQueryWithAuthHandling@frontend/src/api/apiSlice.ts:80 → logOut@frontend/src/lib/auth/authSlice.ts:31 → clearStoredAuth@frontend/src/lib/auth/authStorage.ts:89; CALLS:0.85, CALLS:0.85.
- `logoutSession→clear`: ok; logoutSession@frontend/src/app/session/logoutSession.ts:10 → logOut@frontend/src/lib/auth/authSlice.ts:31 → clearStoredAuth@frontend/src/lib/auth/authStorage.ts:89; CALLS:0.85, CALLS:0.85.
- `ProtectedRoute→clear`: ok; ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx:15 → logOut@frontend/src/lib/auth/authSlice.ts:31 → clearStoredAuth@frontend/src/lib/auth/authStorage.ts:89; CALLS:0.85, CALLS:0.85.
- `handleLogout→clear`: ok; handleLogout@frontend/src/app/layout/MainLayout.tsx:74 → logoutSession@frontend/src/app/session/logoutSession.ts:10 → logOut@frontend/src/lib/auth/authSlice.ts:31 → clearStoredAuth@frontend/src/lib/auth/authStorage.ts:89; CALLS:0.85, CALLS:0.85, CALLS:0.85.
- `MainLayout→useAppDispatch`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → useAppDispatch@frontend/src/app/hooks.ts:7; CALLS:0.85.
- `MainLayout→preloadNavigationTarget`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → preloadNavigationTarget@frontend/src/app/layout/MainLayout.tsx:29; CALLS:0.85.
- `MainLayout→canPreload`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → canPreloadRoutesInBackground@frontend/src/app/layout/MainLayout.tsx:34; CALLS:0.85.
- `MainLayout→HeaderShiftContext`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → HeaderShiftContext@frontend/src/app/layout/MainLayout.tsx:42; CALLS:0.85.
- `MainLayout→scheduleNextRoute`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → scheduleNextRoute@frontend/src/app/layout/MainLayout.tsx:94; CALLS:0.85.
- `MainLayout→toneFromStatus`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → toneFromStatus@frontend/src/lib/workflowConfig.ts:145; CALLS:0.85.
- `MainLayout→getWorkflowContext`: ok; MainLayout@frontend/src/app/layout/MainLayout.tsx:67 → getWorkflowContextForPath@frontend/src/lib/workflowConfig.ts:156; CALLS:0.85.
- `AppRouter→MainLayout`: ok; AppRouter@frontend/src/routes/AppRouter.tsx:41 → MainLayout@frontend/src/app/layout/MainLayout.tsx:67; CALLS:0.85.
- `AppRouter→SessionTimeoutModal`: ok; AppRouter@frontend/src/routes/AppRouter.tsx:41 → SessionTimeoutModal@frontend/src/features/auth/components/SessionTimeoutModal.tsx:17; CALLS:0.85.
- `AppRouter→ProtectedRoute`: ok; AppRouter@frontend/src/routes/AppRouter.tsx:41 → ProtectedRoute@frontend/src/routes/ProtectedRoute.tsx:15; CALLS:0.85.
- `AppRouter→RoleGuard`: ok; AppRouter@frontend/src/routes/AppRouter.tsx:41 → RoleGuard@frontend/src/routes/RoleGuard.tsx:10; CALLS:0.85.

## Deferred

None.

---

# Plan 17-05 GitNexus callsite checklist

Scope: retire the final 16 frontend dependency violations and reduce the known-violation baseline to zero.

## Policy result

- Bidirectional impact ran before moving typed dispatch, coordination selectors, permission presentation and `ActionGuard` ownership.
- `useAppDispatch` was HIGH: 11 direct/13 total upstream nodes across Dashboard, Weekly Menu and Coordination processes. All callers were repointed in one coherent branch slice; app/routes retain the exact store-typed public hook.
- `ActionGuard` was LOW: 3 direct/6 total upstream and 1 downstream node. Its executable body is unchanged; the old route path is a compatibility re-export.
- Final Cypher found 0 feature→app/routes imports and 0 Reports-permission-test→Auth-feature imports. Dependency-cruiser strict mode reports 0 violations and 0 cycles.
- Staged Task 1 detect_changes was HIGH with 48 changed symbols and 6 processes; every process is traced below and covered by 428/428 frontend tests plus lint/build. Task 2 baseline audit was LOW with 0 affected processes.
- All returned nodes are handled or verified; Deferred is empty.

## Symbol summary

| Symbol | Callers found | Handled | Deferred + reason |
|---|---:|---|---|
| `useAppDispatch` | 11 direct / 13 total, HIGH | Feature callers use `lib/reduxHooks`; app/routes retain the exact store-typed hook; full tests/build pass | — |
| `useAppSelector` | 0 indexed, LOW | App/routes retain RootState typing; feature selectors moved to lower projections or feature-owned hooks | — |
| `useHasPermission` | 1 direct, LOW | Reports uses lower structural auth hook; permission tests pass | — |
| `useOrders` | 1 direct / 2 total, LOW | Coordination-owned hook; app compatibility re-export preserved | — |
| `useCurrentShift` | 3 direct, LOW | Coordination-owned hook; app compatibility re-export preserved | — |
| `ActionGuard` | 3 direct / 6 total upstream; 1 downstream, LOW | Common owner with identical body; route compatibility re-export; guard tests pass | — |
| Other app hook exports | 0 indexed, LOW | Unused public exports preserved or re-exported without behavior change | — |

## Every returned node

- `useAppDispatch` / upstream / d1: `MainLayout`, `useMaterialDemand`, `LoginPage`, `ActionToolbar`, `HeaderInfo`, `OrderTable`, `CoordinationPage`, `DashboardPage`, `WeeklyMenuPage`, `useWeeklyScheduleEditor`, `ProtectedRoute` [0.85] — all handled; feature callers repointed to the lower dispatch primitive, app/routes kept the exact existing hook.
- `useAppDispatch` / upstream / d2: `AppRouter` [0.85] — verified no edit required; app composition path unchanged.
- `useAppDispatch` / upstream / d3: `App` [0.85] — verified no edit required; app composition path unchanged.
- `useAppDispatch` / downstream: no returned node.
- `useHasPermission` / upstream / d1: `ReportsPage` [0.85] — repointed to the lower permission hook; permission and query-state tests pass.
- `useHasPermission` / downstream: no returned node.
- `useOrders` / upstream / d1: `ActionToolbar` [0.85] — repointed to the Coordination-owned selector hook.
- `useOrders` / upstream / d2: `CoordinationPage` [0.85] — verified through unchanged component composition.
- `useOrders` / downstream: no returned node.
- `useCurrentShift` / upstream / d1: `HeaderInfo`, `ActionToolbar`, `CoordinationPage` [0.85] — repointed to the Coordination-owned selector hook.
- `useCurrentShift` / downstream: no returned node.
- `ActionGuard` / upstream / d1: `ActionToolbar`, `MaterialDemandSection`, `guards.test.tsx` [0.85] — handled by common owner imports and compatibility test path.
- `ActionGuard` / upstream / d2: `CoordinationPage`, `renderSection` [0.85] — verified through focused feature tests.
- `ActionGuard` / upstream / d3: `materialDemandErrorState.test.tsx` [0.85] — test mock updated to the lower owner.
- `ActionGuard` / downstream / d1: `canAccessRole` [0.85] — verified unchanged.
- `useAppSelector`, `useIsAdmin`, `useCurrentRole`, `useCoordinationState`, `useIsLocked`, `useAuditLogs`, `useLoading`, `useError` / both directions: no returned node requiring a caller edit.

## HIGH process traces

- `ChefDashboardPage → useKitchenReceipts → toChefView → toQueryView → isQueryErrorStatus`; all CALLS 0.85.
- `ChefDashboardPage → resolveChefServiceDate → getBangkokCalendarDate → valueOf`; all CALLS 0.85.
- `ChefDashboardPage → resolveChefServiceDate → formatCalendarDate`; all CALLS 0.85.
- `ChefDashboardPage → useKitchenReceipts → countPendingKitchenReceipts`; all CALLS 0.85.
- `CoordinationPage → toLabeledQueryView → toQueryView → isQueryErrorStatus`; all CALLS 0.85.
- `WeeklyMenuPage → toLabeledQueryView → toQueryView → isQueryErrorStatus`; all CALLS 0.85.

## Deferred

None.


---

# Plan 17-03 GitNexus callsite checklist

Scope: lower coordination transport/type ownership and complete Projects→Coordination decoupling.

## Policy result

- Both upstream and downstream impact were run on the final `feature/workflow-b17-b18` PDG index.
- CRITICAL downstream risk was retained as rigor: `WeeklyMenuPage` 27 direct/88 total; `useWeeklyProductionPlan` 3/5; `useWeeklyMenuImport` 3/7; `useMaterialDemand` 13/20.
- TypeScript AST body hashes before/after are identical for all four CRITICAL functions after line-ending normalization; only import owners changed.
- `explain` found 0 taint findings. PDG totals remained queryable: WeeklyMenuPage 21 control/135 data edges; production 2/27; import 119/127; demand 44/140.
- Cross-boundary traces are intact at confidence 0.85. The import hook's nested callbacks are closure boundaries; exact `context` verified all seven nested callers of `getApiErrorMessage`.
- Cypher found 0 Projects→Coordination feature import edges, exactly one `apiSlice`, and exactly one definition for each lower action. Dependency baseline is 16; staged detect_changes was LOW with 5 symbols, 22 files and 0 affected processes.
- All returned nodes below are handled or verified; Deferred is empty.

## Symbol summary

| Symbol | Upstream | Downstream | Status |
|---|---:|---:|---|
| `setWeeklyMenu` | LOW 0/0 | LOW 0/0 | Final Const graph has no symbol edges; exact action type/reducer tests plus Cypher File imports verify all callers. |
| `updateWeeklyMenuDish` | LOW 0/0 | LOW 0/0 | Final Const graph has no symbol edges; exact action type/reducer tests plus Cypher File imports verify all callers. |
| `WeeklyMenuPage` | LOW 0/0 | CRITICAL 27/88 | Verified no caller edit required; executable body hash is unchanged and focused behavior/build gates pass. |
| `useWeeklyProductionPlan` | LOW 1/1 | CRITICAL 3/5 | Verified no caller edit required; executable body hash is unchanged and focused behavior/build gates pass. |
| `useWeeklyMenuImport` | LOW 1/1 | CRITICAL 3/7 | Verified no caller edit required; executable body hash is unchanged and focused behavior/build gates pass. |
| `useMaterialDemand` | LOW 1/1 | CRITICAL 13/20 | Verified no caller edit required; executable body hash is unchanged and focused behavior/build gates pass. |

## Every returned node

Each entry is `symbol / direction / depth: node @ file [confidence] — disposition`.

- `setWeeklyMenu` / upstream: no returned node on the final exact symbol UID. Pre-edit graph had 3 direct/4 total callers; all were repointed and verified by Cypher + tests.
- `setWeeklyMenu` / downstream: no returned node on the final exact symbol UID. Pre-edit graph had 3 direct/4 total callers; all were repointed and verified by Cypher + tests.
- `updateWeeklyMenuDish` / upstream: no returned node on the final exact symbol UID. Pre-edit graph had 1 direct caller; it was repointed and verified by Cypher + tests.
- `updateWeeklyMenuDish` / downstream: no returned node on the final exact symbol UID. Pre-edit graph had 1 direct caller; it was repointed and verified by Cypher + tests.
- `WeeklyMenuPage` / upstream: no returned node on the final exact symbol UID.
- `WeeklyMenuPage` / downstream / d1:useAppDispatch@frontend/src/app/hooks.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:useMenuCost@frontend/src/features/projects/weekly-menu/cost/useMenuCost.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:useMaterialDemand@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:useDishMaterials@frontend/src/features/projects/weekly-menu/dish-materials/useDishMaterials.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:OperationalFrame@frontend/src/components/common/OperationalFrame.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:QueryViewBoundary@frontend/src/components/common/QueryViewBoundary.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:ViewSwitcher@frontend/src/components/common/ViewSwitcher.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:resetScopedWeeklyMenuUi@frontend/src/features/projects/pages/WeeklyMenuPage.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyMenuImportDialog@frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportDialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:useWeeklyMenuImport@frontend/src/features/projects/weekly-menu/import/useWeeklyMenuImport.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:formatImportDate@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:toLocalIsoDate@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:parseDisplayDateToIso@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:buildWeeklyMenuReadiness@frontend/src/features/projects/weekly-menu/model/readiness.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:buildPlanRowsMaterialSummary@frontend/src/features/projects/weekly-menu/model/scope.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:useWeeklyProductionPlan@frontend/src/features/projects/weekly-menu/production-plan/useWeeklyProductionPlan.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:usePurchaseSummary@frontend/src/features/projects/weekly-menu/purchasing/usePurchaseSummary.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:useWeeklyScheduleEditor@frontend/src/features/projects/weekly-menu/schedule/useWeeklyScheduleEditor.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:isBomPriceTier@frontend/src/features/projects/weeklyMenuPlanning.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:normalizeBomPriceTier@frontend/src/features/projects/weeklyMenuPlanning.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:toLabeledQueryView@frontend/src/lib/labeledQueryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyScheduleEditorDialog@frontend/src/features/projects/weekly-menu/schedule/WeeklyScheduleEditorDialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyMenuAlerts@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuAlerts.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyMenuCommandBar@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyMenuPricingContext@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuCommandBar.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyMenuReadiness@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuReadiness.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d1:WeeklyMenuViewContent@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getDemandApprovalPresentation@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:buildDemandApprovalHref@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getDemandDayIndex@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getDemandInventoryStatus@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:partitionDemandLines@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:attachDemandDishSources@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:isDemandDocumentForDate@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getWeekStalenessState@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:buildKhsxDraftDocument@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:stalenessQuery@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:resolveAnalyzedDish@frontend/src/features/projects/weekly-menu/dish-materials/dishMaterialsModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:CommandBar@frontend/src/components/common/CommandBar.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:FieldRow@frontend/src/components/common/FieldRow.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:InlineAlert@frontend/src/components/common/InlineAlert.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:QueryNotice@frontend/src/components/common/QueryViewBoundary.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:StatusBadge@frontend/src/components/common/StatusBadge.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:handleKeyDown@frontend/src/components/common/ViewSwitcher.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:Dialog@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:DialogContent@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:DialogHeader@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:DialogFooter@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:DialogTitle@frontend/src/components/ui/dialog.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:WeeklyMenuImportHistory@frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportHistory.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:WeeklyMenuImportJobs@frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportJobs.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getImportWizardStep@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getImportWizardStepClass@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:hasBlockingImportIssues@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:normalizeDishMatchKey@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:checkpointState@frontend/src/features/projects/weekly-menu/model/readiness.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:addDishToMaterialSummary@frontend/src/features/projects/weekly-menu/model/scope.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:finalizeMaterialSummary@frontend/src/features/projects/weekly-menu/model/scope.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:aggregateDemandLinesByMaterial@frontend/src/features/projects/weekly-menu/model/scope.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:formatBomTierLabel@frontend/src/features/projects/weeklyMenuPlanning.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:getSafeProductionPlanPageIndex@frontend/src/features/projects/weeklyMenuPlanning.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:toQueryView@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:cn@frontend/src/lib/utils.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:WeeklyMenuImportReview@frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportReview.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:WeeklyMenuImportSetup@frontend/src/features/projects/weekly-menu/import/WeeklyMenuImportSetup.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:WeeklyScheduleSection@frontend/src/features/projects/weekly-menu/schedule/WeeklyScheduleSection.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d2:panelProps@frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:isDemandLineException@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:demandDishSourceKey@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:demandDocumentDateTokens@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:aggregateWeekStaleness@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:ContextStrip@frontend/src/components/common/ContextStrip.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:QueryErrorAlert@frontend/src/components/common/QueryErrorAlert.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:SectionPanel@frontend/src/components/common/SectionPanel.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:TableViewport@frontend/src/components/common/TableViewport.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:moveFocus@frontend/src/components/common/ViewSwitcher.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:Input@frontend/src/components/ui/input.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:ImportedLayoutMatrix@frontend/src/features/projects/components/ImportedLayoutMatrix.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:getImportJobStatusClass@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:getBlockingImportIssues@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:normalizeMaterialGroupKey@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:formatMenuDishName@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:formatMaterialDishSource@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:formatFileSize@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:getImportJobStatusLabel@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:resolveDishIngredients@frontend/src/features/projects/weekly-menu/model/scope.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:isQueryErrorStatus@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `WeeklyMenuPage` / downstream / d3:getWorkflowStatusPresentation@frontend/src/lib/workflowConfig.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyProductionPlan` / upstream / d1:WeeklyMenuPage@frontend/src/features/projects/pages/WeeklyMenuPage.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyProductionPlan` / downstream / d1:parseDisplayDateToIso@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyProductionPlan` / downstream / d1:getSafeProductionPlanPageIndex@frontend/src/features/projects/weeklyMenuPlanning.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyProductionPlan` / downstream / d1:toLabeledQueryView@frontend/src/lib/labeledQueryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyProductionPlan` / downstream / d2:toQueryView@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyProductionPlan` / downstream / d3:isQueryErrorStatus@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / upstream / d1:WeeklyMenuPage@frontend/src/features/projects/pages/WeeklyMenuPage.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d1:getImportWizardStep@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d1:hasBlockingImportIssues@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d1:toLabeledQueryView@frontend/src/lib/labeledQueryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d2:getBlockingImportIssues@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d2:toQueryView@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d3:buildImportDuplicateGroups@frontend/src/features/projects/weekly-menu/import/importValidation.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useWeeklyMenuImport` / downstream / d3:isQueryErrorStatus@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / upstream / d1:WeeklyMenuPage@frontend/src/features/projects/pages/WeeklyMenuPage.tsx[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:useAppDispatch@frontend/src/app/hooks.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:getDemandApprovalPresentation@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:buildDemandApprovalHref@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:getDemandDayIndex@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:getDemandInventoryStatus@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:partitionDemandLines@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:attachDemandDishSources@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:isDemandDocumentForDate@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:getWeekStalenessState@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:buildKhsxDraftDocument@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:stalenessQuery@frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:aggregateDemandLinesByMaterial@frontend/src/features/projects/weekly-menu/model/scope.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d1:toQueryView@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:isDemandLineException@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:demandDishSourceKey@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:demandDocumentDateTokens@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:aggregateWeekStaleness@frontend/src/features/projects/weekly-menu/demand/demandModel.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:normalizeMaterialGroupKey@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:formatMaterialDishSource@frontend/src/features/projects/weekly-menu/model/formatters.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.
- `useMaterialDemand` / downstream / d2:isQueryErrorStatus@frontend/src/lib/queryView.ts[0.85] — Verified no edit required: only import ownership changed; signature/executable body and behavior remain unchanged, focused tests/lint/build pass.

## HIGH/CRITICAL trace review

- `WeeklyMenuPage→useWeeklyProductionPlan`: direct CALLS 0.85.
- `WeeklyMenuPage→useWeeklyMenuImport`: direct CALLS 0.85.
- `WeeklyMenuPage→useMaterialDemand`: direct CALLS 0.85.
- `WeeklyMenuPage→isQueryErrorStatus`: `WeeklyMenuPage → toLabeledQueryView → toQueryView → isQueryErrorStatus`; all CALLS 0.85.
- `useWeeklyProductionPlan→isQueryErrorStatus`: `useWeeklyProductionPlan → toLabeledQueryView → toQueryView → isQueryErrorStatus`; all CALLS 0.85.
- `useMaterialDemand→isQueryErrorStatus`: `useMaterialDemand → toQueryView → isQueryErrorStatus`; all CALLS 0.85.
- `useWeeklyMenuImport→getApiErrorMessage`: top-level trace stops at closure boundaries; exact target context reports six nested import-hook callers (`downloadWeeklyMenuTemplate`, `createQuickCustomer`, `previewJob`, `commitJob`, `saveMapping`, `confirmRollback`) plus demand `generate` and schedule `saveEditor`; all were verified without body edits.

## Deferred

None.


## Plan 17-04 — workflow endpoint ownership

### Policy and tool evidence

- Branch/PDG index refreshed to the final working tree with `node .gitnexus/run.cjs analyze --branch feature/workflow-b17-b18 --pdg --force --index-only`.
- Bidirectional `impact` ran for `workflowApi`, all 75 endpoint keys, 28 helper/export symbols, 143 type/interface candidates, `adminApi`, and the dependency-rule symbols before their edits.
- CRITICAL workflow surface: `explain` returned 0 taint paths and `pdg_query` returned 0 control/data edges for the final compatibility const; absence is treated only as tool evidence, not proof of safety.
- Final Cypher found 38 exact `IMPORTS` callers of the compatibility barrel, all confidence 1.0. Rename dry-run found 103 textual references in 44 files and applied 0 edits.
- Final staged `detect_changes`: HIGH, 8 changed symbols and 8 expected dashboard/warehouse overview processes; every process below passed the 428-test frontend gate and production build.
- Deferred is empty.

### Required completion table

| Symbol | Callers found | Handled | Deferred + reason |
|---|---:|---|---|
| `workflowApi` | 38 exact file importers; 103 rename-preview refs | Stable barrel; identity is `apiSlice`; 75 endpoints/hooks characterized | — |
| 75 endpoint keys | GitNexus parser: 75 × UNKNOWN/no node | Exact owner registration + public/cache/wire tests | — |
| `useWorkflowOverview` | 2 direct callers; 8 cross-community processes | Moved with identical body; dashboard/warehouse/full FE gates pass | — |
| report/type contracts | 134 unique returned nodes contextualized | Names/shapes re-exported unchanged; TypeScript build passes | — |
| `adminApi` / `adminWorkflowApi` | 0 indexed direct callers for const | Employee endpoints excluded from 75-key workflow registration; approval rules singly owned | — |
| generated `SearchKeyword` | Not indexed (generated file >512 KB) | Existing backend contract synchronized; two consecutive SHA-256 hashes identical | — |

### Exact compatibility-barrel importers

| Caller | Confidence | Disposition |
|---|---:|---|
| `frontend/src/api/workflowApi.approvalDecisionWire.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/api/workflowApi.cacheInvalidation.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/api/workflowApi.publicSurface.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/app/pages/admin-data/AdminInventoryPanel.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/app/purchasingHooksBehavior.test.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/admin/pages/ApprovalRulesPage.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/approvals/pages/ApprovalPage.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/chefReadiness.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/chefWorkflowBehavior.test.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/exceptions/useChefExceptions.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/journal/useChefJournal.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/production/chefProductionModel.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/production/chefProductionModel.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/production/useChefProductionPlan.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/chef/receipts/useKitchenReceipts.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/dashboard/pages/DashboardPage.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/projects/weekly-menu/demand/demandModel.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/PurchaseDecisionPanel.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/PurchaseWorkflowGuide.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/pages/PurchasingPage.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/purchaseServiceDatePresentation.test.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/purchasingModel.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/purchasingModel.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/purchasing/quotation/useSupplierQuotations.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/reports/pages/useReportsPageModel.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/reports/reportPlanning.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/reports/reportPlanning.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/warehouse/pages/WarehousePage.tsx` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/warehouse/warehouseIssueAllocation.test.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/features/warehouse/warehouseIssueAllocation.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |
| `frontend/src/routes/routeDataPreloaders.ts` | 1.0 | Verified no change: compatibility import and exported name remain valid. |

### Endpoint impact inventory

Each endpoint key was queried upstream and downstream before extraction. GitNexus does not index RTK Query object-property endpoint keys, so every call returned UNKNOWN with no node; the 75-key/75-hook characterization, cache fan-out, approval wire, focused owner tests and full build are the handling evidence.

| Endpoint symbol | Upstream | Downstream | Handled | Deferred |
|---|---:|---:|---|---|
| `getWorkflowDocuments` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getSuppliers` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getWarehouses` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getWarehouseSelector` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchaseWorkbench` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getSupplierEvidence` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `confirmLineSupplier` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `recordWarehousePurchaseReceipt` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `updatePurchaseRequestLineSupplier` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getSupplierQuotationsByIngredient` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getSupplierQuotationsByIngredientPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createSupplierQuotation` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `updateSupplierQuotation` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `deactivateSupplierQuotation` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchaseOrders` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchaseOrdersPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createPurchaseOrdersFromRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `recordPurchaseOrderReceipt` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `cancelPurchaseOrder` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getIngredientDemand` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `generateMaterialDemand` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getMaterialDemandStaleness` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createPurchaseRequestFromDemand` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `submitPurchaseRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createInventoryReceiptFromPurchase` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createInventoryIssue` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createSupplementalMaterialRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getSupplementalMaterialRequests` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `fulfillSupplementalMaterialRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `routeSupplementalMaterialRequestToPurchasing` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `rejectSupplementalMaterialRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createInventoryReturn` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getInventoryReturns` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getInventoryReturnById` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `confirmInventoryReturnReceipt` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `confirmInventoryIssueReceipt` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchasePlan` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchasePlanPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getIngredientDemandPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getMaterialRequestCandidatePage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getIngredientDemandAggregatePage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getDailyProductionPlan` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `sendDailyProductionPlanToKitchen` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getApprovalRecords` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `executeApprovalDecision` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getStockMovements` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getStockMovementPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVariance` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVarianceBySupplier` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVarianceBySupplierPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVarianceByPeriod` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVarianceByPeriodPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVarianceByDishGroup` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVarianceByDishGroupPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getOperationalKpis` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getCurrentStock` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getStockLedgerReconciliation` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getKitchenIssues` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getKitchenIssuesPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getIssueVsReturnUsage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getIssueVsReturnUsagePage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getAuditChanges` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPriceVariancePage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getCurrentStockPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getAuditChangePage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getDataQuality` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getDataQualityPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `updateDataQualityIssueRemediation` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchaseRequests` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getPurchaseRequestsPage` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getApprovalHistory` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `getApprovalRules` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `createApprovalRule` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `updateApprovalRule` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |
| `deleteApprovalRule` | UNKNOWN / 0 | UNKNOWN / 0 | Owner injector + characterization gates | — |

### Helper/export impact inventory

| Symbol | Upstream | Downstream | Disposition |
|---|---:|---:|---|
| `toNextReportCursor` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `getData` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `emptyDailyProductionPlan` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapProductionPlan` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `normalizeDailyProductionPlan` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `queryWithLimit` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `normalizeDocumentType` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapDocument` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapDemandLine` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapDemandAggregateLine` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapPurchasePlanRow` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `normalizeWorkflowTone` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapApprovalInboxItem` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapStockMovement` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapPriceVariance` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapCurrentStock` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapStockLedgerReconciliation` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapKitchenIssue` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapUsageReport` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapAuditChange` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapCursorPage` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapPageNumberPage` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapDataQualityIssue` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `mapDataQualityReport` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `buildRoleInbox` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `buildWorkflowLanes` | UNKNOWN / 0 | UNKNOWN / 0 | Changed or re-exported with identical behavior; all returned processes verified. |
| `endpoints` | LOW / 0 | LOW / 2 | Changed or re-exported with identical behavior; all returned processes verified. |
| `useWorkflowOverview` | LOW / 2 | HIGH / 8 | Changed or re-exported with identical behavior; all returned processes verified. |

### Type/interface impact inventory

| Symbol | Upstream | Downstream | Disposition |
|---|---:|---:|---|
| `LowerCamelQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `MutableContract` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WorkflowReportQueryWire` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WorkflowReportPageQueryWire` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WorkflowReportQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WorkflowReportPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `DataQualityPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `MaterialRequestCandidatePageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CurrentStockPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ReceiptPriceVariancePageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PriceVarianceAggregatePageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PageNumberPage` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `CursorPage` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `ReportCursor` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `ApprovalInboxQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalInboxPage` | CRITICAL / 70 | LOW / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseRequestQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseRequestResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseWorkbenchQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseWorkflowStageCounts` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierEvidenceType` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierEvidenceCandidate` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierEvidenceResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseLineSupplierDecision` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseRequestWorkflowLine` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovedDemandSummary` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseWorkbenchServiceDate` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseWorkbenchWeek` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierEvidencePath` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierEvidenceQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmPurchaseLineSupplierData` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmPurchaseLineSupplierRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalHistoryItem` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateInventoryReceiptFromPurchaseLineRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateInventoryReceiptFromPurchaseRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WarehouseDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WarehousePageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `GeneratePurchaseRequestFromDemandRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseRequestWorkflowResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryReceiptCreatedResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateInventoryIssueLineRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateInventoryIssueRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateSupplementalMaterialRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplementalMaterialRequestResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplementalMaterialRequestPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplementalRequestPath` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplementalRequestId` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `FulfillSupplementalMaterialRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `RejectSupplementalMaterialRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryIssueCreatedResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateInventoryReturnLineRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateInventoryReturnRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryReturnCreatedResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmInventoryIssueReceiptData` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmInventoryIssueReceiptPath` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmInventoryIssueReceiptRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryIssueResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WorkflowDocumentDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `IngredientDemandReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `IngredientDemandPageResponseDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `MaterialRequestCandidate` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `IngredientDemandAggregateReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `IngredientDemandAggregatePageResponseDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchasePlanRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `PurchasePlanReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchasePlanPageResponseDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ProductionPlanLine` | CRITICAL / 117 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `ProductionPlan` | CRITICAL / 71 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `DailyProductionPlan` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `ProductionPlanDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `DailyProductionPlanDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SendDailyProductionPlanRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalInboxItemDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalRuleDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalAssignmentDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalAssignmentRequestDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalRuleRequestDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `StockMovementViewDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `StockLedgerReconciliationDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `UpdatePurchaseRequestLineSupplierDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierQuotationDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CreateSupplierQuotationDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `UpdateSupplierQuotationDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierQuotationPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `SupplierQuotationIdPath` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `UpdateSupplierQuotationArgs` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseOrderLineDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryReturnLineResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryReturnResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `InventoryReturnPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmInventoryReturnReceiptData` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmInventoryReturnReceiptPath` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ConfirmInventoryReturnReceiptRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseOrderDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseOrderQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseOrderPageQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseReceiptEvidenceRequirements` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WarehousePurchaseReceiptLineRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WarehousePurchaseReceiptRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `WarehousePurchaseReceiptResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `RecordWarehousePurchaseReceiptRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalInboxPageDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseOrderPageResponse` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `RecordPurchaseOrderReceiptLineDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `RecordPurchaseOrderReceiptDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `RecordPurchaseOrderReceiptArgs` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ReceiptPriceVarianceReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PriceVarianceBySupplierDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PriceVarianceByPeriodDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PriceVarianceDishGroupIngredientDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PriceVarianceByDishGroupDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `OperationalKpiSummaryDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CurrentStockSummaryDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `KitchenIssueReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `IssueVsReturnUsageReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `AuditChangeReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `DataQualityIssueDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `DataQualityReportDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `DataQualityPageDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `MaterialDemandResultDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `GenerateMaterialDemandWire` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `GenerateMaterialDemandRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `MaterialDemandStalenessQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `MaterialDemandStaleness` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PurchaseRequestWorkflowResultDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalDecisionRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalHistoryQuery` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `ApprovalRuleIdPath` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `UpdateApprovalRuleArgs` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PriceVarianceRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `AuditLogRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `CurrentStockRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `StockLedgerReconciliationRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `KitchenIssueRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `UsageReportRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `DataQualityIssueRow` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `DataQualityReport` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `DataQualityPageReport` | CRITICAL / 70 | MEDIUM / 16 | Neutral contract move; public name and shape unchanged. |
| `DataQualityIssueRemediationRequest` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `CursorPageDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `PageNumberPageDto` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |
| `DataQualityIssueRemediationResult` | UNKNOWN / 0 | UNKNOWN / 0 | Neutral contract move; public name and shape unchanged. |

### Every unique returned node

All 134 unique returned nodes were opened with `context`. Frontend nodes are verified by unchanged compatibility exports plus full tests/build. Backend nodes are GitNexus same-name collisions and were manually classified as unrelated; no backend file was edited.

- `File:frontend/src/routes/routeDataPreloaders.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/purchasingHooksBehavior.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/api/workflowApi.publicSurface.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/api/workflowApi.cacheInvalidation.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/api/workflowApi.approvalDecisionWire.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/warehouse/WarehousePurchaseReceiptDialog.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/warehouse/warehouseIssueAllocation.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/warehouse/warehouseIssueAllocation.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/warehouse/WarehouseExceptionsWorkbench.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/reportPlanning.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/reportPlanning.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/SupplementalPurchasingWorkbench.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/purchasingModel.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/purchasingModel.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/PurchaseWorkflowGuide.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/PurchaseServiceDateWorkbench.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/purchaseServiceDatePresentation.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/PurchaseDecisionPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/chefWorkflowBehavior.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/chefReadiness.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/useAdminDataPageModel.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminInventoryPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/warehouse/pages/WarehousePage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/pages/useReportsPageModel.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/quotation/useSupplierQuotations.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/pages/PurchasingPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/dashboard/pages/DashboardPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/receipts/useKitchenReceipts.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/production/useChefProductionPlan.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/production/chefProductionModel.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/production/chefProductionModel.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/approvals/pages/ApprovalQueryPanels.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/approvals/pages/ApprovalPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/journal/useChefJournal.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/exceptions/useChefExceptions.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/admin/pages/ApprovalRulesPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/demand/useMaterialDemand.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/demand/demandModel.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/routes/routeLoaders.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/AdminDataPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/warehouse/WarehouseExceptionsWorkbench.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/SupplementalPurchasingWorkbench.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/purchasingWeekBoundary.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/chefReadiness.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminStatisticsPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminEmployeesPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminContractsPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminCleanupPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminBomPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/pages/admin-data/AdminAuditPanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/pages/ReportsPricePanel.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/pages/ReportsPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/pages/ReportsNavigation.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/quotation/SupplierQuotationSection.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/quotation/SupplierQuotationSection.state.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/purchasing/pages/PurchasingPage.state.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/pages/WeeklyMenuPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/production/ChefProductionSection.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/pages/ChefDashboardPage.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/approvals/pages/ApprovalPage.state.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/admin/pages/ApprovalRulesPage.state.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/shell/WeeklyMenuViewContent.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/demand/MaterialDemandSection.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/demand/materialDemandErrorState.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/demand/demandModel.test.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/routes/AppRouter.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/app/layout/MainLayout.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/chef/index.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/reports/pages/ReportsPage.permissions.test.tsx` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/features/projects/weekly-menu/shell/weeklyMenuViewPreload.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/types/workflow.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/types/api.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/workflowConfig.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/formatters.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/actionEligibility.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/api/workflowCacheTags.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/api/apiSlice.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/statusPresentation.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/routeConfig.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/auth/sessionEvents.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/auth/roleUtils.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/auth/authTypes.ts` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/auth/authSlice.ts` — Verified no change: compatibility name/type shape preserved.
- `Function:frontend/src/api/workflowCacheTags.ts:workflowTag` — Verified no change: compatibility name/type shape preserved.
- `Function:frontend/src/lib/auth/authStorage.ts:readStoredAuthSnapshot` — Verified no change: compatibility name/type shape preserved.
- `File:frontend/src/lib/auth/authStorage.ts` — Verified no change: compatibility name/type shape preserved.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs:MaterialDemandService.GenerateAsync#3` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs:MaterialDemandService.EnsureProductionPlanAsync#5` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs:MaterialDemandService.PruneStaleLines#4` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs:MaterialDemandService.EnsureProductionPlanLine#3` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.MapPlan#2` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Reports/Services/InventoryOperationsReportService.cs:InventoryOperationsReportService.GetWorkflowDocumentsAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Reports/Services/PurchasingReportService.cs:PurchasingReportService.GetPurchaseDemandAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportPersistence.cs:WeeklyMenuImportPersistence.InvalidateWorkflowDocumentsForMenuReimportAsync#6` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs:WorkflowControllerContractTests.MaterialDemandGenerate_Should_ReturnConflict_WhenDomainBlocksRequest#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs:WorkflowControllerContractTests.MaterialDemandGenerate_Should_ReturnBadRequest_WhenInputIsInvalid#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs:WorkflowControllerContractTests.MaterialDemandGenerate_Should_ReturnNotFound_WhenNoCompletedQuantityPlan#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateMaterialDemandAsync_Should_RejectCompletedPlanWithDraftMenu#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_CreateDemandLines_ForHappyPath#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_ReportMissingBom_And_WriteDemandAudit#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_Ignore_Draft_BomLines#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_PruneStaleDemandAndProductionLines_OnRegenerate#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_BlockRecalculation_WhenPurchaseOrderReferencesDemand#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GeneratePurchaseRequest_Should_RemoveStalePurchaseLines_WhenDemandNoLongerShort#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_ConvertCurrentStock_ToBomUnit#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_NotDuplicateHeaderOrLines_WhenRunAgain#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_ReportMissingConversion_WhenStockUnitCannotConvertToBomUnit#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_RequireSignoffBeforeUsingLockedOrder#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.GenerateDemand_Should_ApplyDifferentPortionRules_ByShift#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.WeeklyMenuReimport_Should_CancelDownstreamDemandAndPurchase_ForCustomerWeek#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.WeeklyMenuReimport_Should_AllowDemandRegeneration_ForApprovedLineageWithoutIrreversibleDocuments#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.WeeklyMenuReimport_Should_AllowDemandRegeneration_ForDraftLineageWithoutPurchaseOrder#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.DemandAndPurchase_Should_StayBounded_ForMultiCustomerWeek#0` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Controllers/MaterialDemandController.cs:MaterialDemandController.GenerateAsync#2` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.GetPagedAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.GetByIdAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.GetFilteredAsync#5` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.BuildDailyDto#4` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Reports/Controllers/InventoryOperationsReportsController.cs:InventoryOperationsReportsController.GetWorkflowDocumentsAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Reports/Controllers/PurchasingReportsController.cs:PurchasingReportsController.GetPurchaseDemandAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportPersistence.cs:WeeklyMenuImportPersistence.CommitAsync#5` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs:WorkflowControllerContractTests.ProductionPlansGetById_Should_ReturnNotFoundEnvelope_WhenPlanMissing#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowControllerContractTests.cs:WorkflowControllerContractTests.ProductionPlansGetAll_Should_ReturnPagedApiResponse#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.ProductionPlans_Should_PageNewestFirst_WhenPlansSpanMultipleYears#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.WeeklyMenuImport_Should_PreserveExistingGlobalDishClassification#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.WeeklyMenuImport_Should_Not_ClassifyNewDishFromWorkbookSlot#0` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs:WorkflowGenerationTests.WeeklyMenuReimport_Should_RejectCompletedQuantityPlanBeforeMutation#0` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Controllers/ProductionPlansController.cs:ProductionPlansController.GetAllAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Controllers/ProductionPlansController.cs:ProductionPlansController.GetFilteredAsync#5` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Controllers/ProductionPlansController.cs:ProductionPlansController.GetByIdAsync#1` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.GetDailyAsync#4` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/Planning/Services/ProductionPlanService.cs:ProductionPlanService.SendDailyToKitchenAsync#3` — Verified no change: unrelated backend name collision.
- `Method:backend/src/IPCManagement.Api/Features/SampleData/Services/WeeklyMenuImportService.cs:WeeklyMenuImportService.CommitWeeklyMenuImportAsync#7` — Verified no change: unrelated backend name collision.
- `Method:backend/tests/IPCManagement.Api.Tests/MaterialDemandAndPriceExceptionApprovalTests.cs:MaterialDemandAndPriceExceptionApprovalTests.Inbox_ManagerSeesPendingMaterialDemandOnceWithOperationalContext#0` — Verified no change: unrelated backend name collision.

### Final affected processes

| Process | Changed chain | Disposition |
|---|---|---|
| WarehousePage → RoundToScale | useWorkflowOverview → buildRoleInbox | Handled; full FE tests/build pass. |
| DashboardPage → RoundToScale | useWorkflowOverview → buildRoleInbox | Handled; full FE tests/build pass. |
| WarehousePage → FormatUnit | useWorkflowOverview → buildRoleInbox | Handled; full FE tests/build pass. |
| DashboardPage → FormatUnit | useWorkflowOverview → buildRoleInbox | Handled; full FE tests/build pass. |
| WarehousePage → OwnerToLaneId | useWorkflowOverview → buildWorkflowLanes | Handled; full FE tests/build pass. |
| WarehousePage → FormatPercent | useWorkflowOverview → buildRoleInbox | Handled; full FE tests/build pass. |
| DashboardPage → OwnerToLaneId | useWorkflowOverview → buildWorkflowLanes | Handled; full FE tests/build pass. |
| DashboardPage → FormatPercent | useWorkflowOverview → buildRoleInbox | Handled; full FE tests/build pass. |

## Plan 17-06 pre-edit ownership checklist

PDG index: 56,526 nodes, 102,833 edges, 483 clusters, 300 flows (`feature/workflow-b17-b18` at `c1b9a32`). The active locked plan is `17-06-PLAN.md`; risk changes rigor, not scope.

| Symbol | Upstream | Downstream | Planned disposition |
|---|---:|---:|---|
| `useAdminDataPageModel` | LOW — 1 direct / 1 total | CRITICAL — 5 direct / 12 total | Keep compatibility facade and unchanged public return; compose all seven panel models. |
| `toAdminView` | LOW — 1 direct / 2 total | CRITICAL — 1 direct / 2 total | Move once to Admin model shared helper; preserve all QueryView text/retry/forbidden semantics. |
| `currentBomRows` | LOW — 0 | HIGH — 1 direct / 4 total | Move to BOM model; preserve date/search/tier/customer/status filters and sorting. |
| `handleExportAuditCsv` | LOW — 0 | HIGH — 1 direct / 4 total | Move to Audit model; preserve URL, auth header, filename, DOM download, and danger toast timing. |
| `openEditBomDialog` | LOW — 0 | HIGH — 2 direct / 6 total | Move to BOM model; preserve published-version effective-date calculation and dialog state sequence. |
| `selectedContract`, `selectedSchedule`, `authToken`, `auditQuery`, `employeeQuery` | LOW | LOW | Move with owning panel; preserve memo dependencies and selectors. |
| BOM handlers (`handleDownloadBomTemplate`, `handlePreviewBomImport`, `handleCommitBomImport`, `openCreateBomDialog`, `handleSaveBomLine`, `handleCloseBomLine`) | LOW | LOW | Move together to BOM model; preserve mutation and feedback ordering. |
| Contract handlers (`loadContractForm`, `startNewContract`, `loadScheduleRuleForm`, `handleSaveCustomerContract`, `handleSaveScheduleRules`, `handleUpdateScheduleVersion`) | LOW | LOW | Move together to Contracts model; preserve validation, mutation, and feedback ordering. |
| `handleDataQualityRemediation` | LOW | LOW | Move to Cleanup model unchanged. |
| Employee handlers (`resetEmployeeForm`, `handleEmployeeSubmit`, `handleEditEmployee`, `handleEmployeeStatusToggle`) | LOW | LOW | Move together to Employees model unchanged. |
| `EMPTY_ADMIN_LIST`, `retry`, `shortageCount`, `defaultMenuPrice`, `activeWeekDays`, `shiftNames`, `menuPrice` | LOW | LOW | Move with owning helper/panel without semantic edits. |
| `AdminDataPage` | direct facade caller | six Admin cross-cluster processes | Verify no change: same facade import/call and panel props. |
| `getTodayInputValue`, `isAdminView`, `useToast`, `usePaginatedRows`, `toQueryView` | direct downstream nodes | shared cross-cluster chains | Verify no change: same invocation semantics; targeted/full tests and build. |
| `getBangkokToday`, `getBangkokCalendarDate`, `formatCalendarDate`, `valueOf`, `useLocalPagination`, `createLocalPaginationContract`, `isQueryErrorStatus` | transitive downstream nodes | shared processes | Verify no change: no edits; trace and regression gates cover confidence-0.85 edges. |

Cross-cluster trace checklist (all confidence 0.85):

- `AdminDataPage → useAdminDataPageModel → useToast`
- `AdminDataPage → useAdminDataPageModel → isAdminView`
- `AdminDataPage → useAdminDataPageModel → getTodayInputValue → getBangkokToday → getBangkokCalendarDate → valueOf`
- `AdminDataPage → useAdminDataPageModel → getTodayInputValue → getBangkokToday → formatCalendarDate`
- `AdminDataPage → useAdminDataPageModel → toAdminView → toQueryView → isQueryErrorStatus`
- `AdminDataPage → ViewSwitcher → cn`
- `currentBomRows|handleExportAuditCsv|openEditBomDialog → getTodayInputValue → getBangkokToday → getBangkokCalendarDate|formatCalendarDate`
- `openEditBomDialog → getNextDayInputValue → addCalendarDays → formatCalendarDate`

Final Plan 17-06 audit:

| Affected process | Disposition |
|---|---|
| `AdminDataPage → ValueOf` | Handled — BOM date chain retained; Admin tests, lint and build pass. |
| `AdminDataPage → FormatCalendarDate` | Handled — BOM date formatting chain retained; trace confidence 0.85 verified. |
| `AdminDataPage → IsQueryErrorStatus` | Handled — all 14 queries still pass through the shared `toAdminView → toQueryView` contract. |
| `AdminDataPage → CreateLocalPaginationContract` | Handled — BOM pagination retains page sizes 8/20 and existing pagination hook. |
| `AdminDataPage → IsAdminView` | Handled — facade retains the same initial-view/employee permission guard. |

Cypher final: `AdminDataPage` is the sole facade caller; facade owns no moved helper definitions and calls exactly the seven panel hooks plus `getTodayInputValue`/`isAdminView`; every moved helper resolves only to its new owner file. `detect_changes(staged)`: 43 changed symbols, 11 files, 5 expected processes, MEDIUM. Deferred: none.
