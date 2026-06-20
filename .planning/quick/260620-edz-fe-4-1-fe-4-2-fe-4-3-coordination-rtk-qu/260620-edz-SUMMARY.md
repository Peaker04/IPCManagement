# Summary: FE-4.1/FE-4.2/FE-4.3 Coordination API Integration

## Outcome

- FE-4.1 complete for the backend APIs currently available: Coordination page reads active orders through `useGetCoordinationOrdersQuery`, locks orders through `useLockCoordinationOrdersMutation`, and exports through `useExportCoordinationOrdersMutation`.
- FE-4.2 complete for locked serving adjustments: actual servings update optimistically and roll back with an inline error if the adjust API fails.
- FE-4.3 complete for available states: banner now reflects syncing, draft, and locked states from query/loading and lock state.
- Critical blocker captured: Completed/signoff state is not implemented because BE-4.3 `POST /api/coordination/orders/{id}/signoff` and the status state machine/SDS are absent.

## Changes

- Code commit: `87bb829`.
- `frontend/src/features/coordination/pages/CoordinationPage.tsx`
  - Uses `useGetCoordinationOrdersQuery` and syncs query results into Redux for existing selectors.
  - Passes a real `syncing` / `draft` / `locked` banner state.
- `frontend/src/features/coordination/components/action-toolbar.tsx`
  - Uses RTK Query mutation hooks for lock and export actions.
  - Updates Redux lock state after backend lock success.
- `frontend/src/features/coordination/components/order-table.tsx`
  - Allows actual serving edits after lock.
  - Applies optimistic updates and rolls back on API failure.
- `frontend/src/features/coordination/components/order-status-banner.tsx`
  - Shows real syncing/draft/locked status copy.
- `frontend/src/features/coordination/coordinationSlice.ts` and `types.ts`
  - Added reducers/payloads for query syncing, lock marking, and optimistic actual-serving edits.

## Verification

- `npm run build --workspace frontend` passed.
- `npm run lint --workspace frontend` passed.
- `npm run test:smoke --workspace frontend` passed: 7/7 tests.

## Blocker

- FE-4.3 cannot truthfully display `Đã chốt`/Completed from API until BE-4.3 signoff and BE-4.4 status state machine are implemented or an SDS contract is approved.
