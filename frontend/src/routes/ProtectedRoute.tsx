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
import { ROUTES } from './routeConfig';

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

    if (data?.success && data.data) {
      dispatch(
        setCredentials({
          user: {
            id: data.data.userId,
            username: data.data.username,
            fullName: data.data.fullName,
            role: data.data.roleName.toLowerCase(),
          },
          token,
        })
      );
      return;
    }

    if (error) {
      dispatch(logOut());
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
