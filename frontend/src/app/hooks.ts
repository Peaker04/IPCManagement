import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './store';

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Coordination-specific selectors
export const useCoordinationState = () =>
  useAppSelector((state) => state.coordination)

export const useOrders = () =>
  useAppSelector((state) => state.coordination.orders)

export const useCurrentShift = () =>
  useAppSelector((state) => state.coordination.currentShift)

export const useIsLocked = () =>
  useAppSelector((state) => state.coordination.isLocked)

export const useAuditLogs = () =>
  useAppSelector((state) => state.coordination.auditLogs)

export const useLoading = () =>
  useAppSelector((state) => state.coordination.loading)

export const useError = () =>
  useAppSelector((state) => state.coordination.error)
