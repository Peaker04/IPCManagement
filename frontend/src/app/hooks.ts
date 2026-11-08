import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from './store';

export { useHasRole } from '@/lib/useHasRole'
export { useHasPermission } from '@/lib/useHasPermission'
export {
  useAuditLogs,
  useCoordinationState,
  useCurrentShift,
  useError,
  useIsLocked,
  useLoading,
  useOrders,
} from '@/features/coordination/coordinationHooks'

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Auth-specific selectors
export const useIsAdmin = () =>
  useAppSelector((state) => state.auth.user?.isAdminFullAccess ?? false)

export const useCurrentRole = () =>
  useAppSelector((state) => state.auth.user?.role ?? null)
