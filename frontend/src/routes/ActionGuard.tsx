import type { ReactNode } from 'react';
import { useAppSelector } from '../app/hooks';

interface ActionGuardProps {
  /** Danh sách role được phép thấy action này. Admin luôn được thấy. */
  allowedRoles: string[];
  children: ReactNode;
  /** Nội dung dự phòng nếu không đủ quyền (mặc định là ẩn đi) */
  fallback?: ReactNode;
}

/**
 * Bọc các thành phần UI (ví dụ: nút bấm) để ẩn/hiện theo role.
 * - Admin (isAdminFullAccess) → luôn thấy
 * - Role phù hợp → thấy
 * - Không đủ quyền → hiển thị fallback (mặc định là null/ẩn)
 */
export const ActionGuard = ({ allowedRoles, children, fallback = null }: ActionGuardProps) => {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) return <>{fallback}</>;

  if (user.isAdminFullAccess || allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
};
