import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  logOut,
  selectAuthToken,
  selectIsAuthenticated,
  selectIsAuthLoading,
  setAuthLoading,
  setCredentials,
  useGetCurrentUserQuery,
} from '../features/auth';
import { normalizeUserRole } from '../features/auth/roleUtils';
import { ROUTES } from '@/lib/routeConfig';

export const ProtectedRoute = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectAuthToken);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isAuthLoading = useAppSelector(selectIsAuthLoading);
  const shouldVerifyToken = Boolean(token && !isAuthenticated);
  const { data, error, isFetching } = useGetCurrentUserQuery(undefined, {
    skip: !shouldVerifyToken,
  });

  useEffect(() => {
    if (!shouldVerifyToken || !token) {
      return;
    }

    const user = data?.data;
    if (data?.success && user?.userId && user.username && user.fullName) {
      dispatch(
        setCredentials({
          user: {
            id: user.userId,
            username: user.username,
            fullName: user.fullName,
            role: normalizeUserRole(user.roleCode, user.roleName),
            roleCode: user.roleCode,
            roleName: user.roleName,
            isAdminFullAccess: user.isAdminFullAccess ?? false,
            permissions: [...(user.permissions ?? [])],
          },
          token,
        })
      );
      return;
    }

    if (data?.success) {
      dispatch(logOut());
      return;
    }

    if (error) {
      const status = typeof error === 'object' && error && 'status' in error ? error.status : undefined;

      if (status !== 401) {
        dispatch(logOut());
      }
      return;
    }

    dispatch(setAuthLoading(isFetching));
  }, [data, dispatch, error, isFetching, shouldVerifyToken, token]);

  if (shouldVerifyToken || isAuthLoading) {
    return <div>Đang xác thực...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <Outlet />;
};
