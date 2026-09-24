import type { AppRole } from '@/lib/auth/roleUtils';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: AppRole;
  roleCode?: string;
  roleName?: string;
  isAdminFullAccess: boolean;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
