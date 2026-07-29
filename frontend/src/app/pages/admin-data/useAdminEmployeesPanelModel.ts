import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import {
  type AdminEmployee,
  useCreateAdminEmployeeMutation,
  useGetAdminEmployeesQuery,
  useGetAdminRolesQuery,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} from '@/features/admin/adminApi';
import {
  defaultEmployeeForm,
  getMutationErrorMessage,
  type AdminView,
  type EmployeeFormState,
} from './adminDataPageTypes';
import { toAdminView } from './adminDataPageModelShared';

export function useAdminEmployeesPanelModel(activeView: AdminView, canManageEmployees: boolean | undefined) {
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(defaultEmployeeForm);
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);
  const deferredEmployeeSearch = useDeferredValue(employeeSearch);
  const employeeQuery = useMemo(
    () => ({
      pageNumber: employeePage,
      pageSize: 8,
      searchKeyword: deferredEmployeeSearch.trim() || undefined,
    }),
    [deferredEmployeeSearch, employeePage],
  );
  const employeesQuery = useGetAdminEmployeesQuery(employeeQuery, {
    skip: !canManageEmployees || activeView !== 'employees',
  });
  const employeesView = toAdminView(employeesQuery, 'danh sách nhân viên');
  const employeeResponse = employeesView.phase === 'ready' ? employeesView.data : undefined;
  const isEmployeeLoading = employeesView.phase === 'loading';
  const rolesQuery = useGetAdminRolesQuery(undefined, {
    skip: !canManageEmployees || activeView !== 'employees',
  });
  const rolesView = toAdminView(rolesQuery, 'vai trò nhân viên');
  const rolesResponse = rolesView.phase === 'ready' ? rolesView.data : undefined;
  const isRolesLoading = rolesView.phase === 'loading';
  const [createEmployee, { isLoading: isCreatingEmployee }] = useCreateAdminEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdatingEmployee }] = useUpdateAdminEmployeeMutation();
  const [updateEmployeeStatus, { isLoading: isUpdatingStatus }] = useUpdateAdminEmployeeStatusMutation();
  const employeeRoles = rolesResponse?.data ?? [];
  const employeeRows = employeeResponse?.data?.items ?? [];
  const employeeMeta = employeeResponse?.data;
  const isSavingEmployee = isCreatingEmployee || isUpdatingEmployee;

  const resetEmployeeForm = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(defaultEmployeeForm);
  };

  const handleEmployeeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedRoleId = employeeForm.roleId;
    if (!employeeForm.fullName.trim() || !employeeForm.username.trim() || !selectedRoleId) {
      setEmployeeNotice('Vui lòng nhập đầy đủ họ tên, tài khoản và chọn vai trò.');
      return;
    }

    if (!editingEmployeeId && !employeeForm.password.trim()) {
      setEmployeeNotice('Vui lòng nhập mật khẩu cho tài khoản mới.');
      return;
    }

    try {
      if (editingEmployeeId) {
        const response = await updateEmployee({
          id: editingEmployeeId,
          body: {
            fullName: employeeForm.fullName.trim(),
            username: employeeForm.username.trim(),
            password: employeeForm.password.trim() || undefined,
            roleId: selectedRoleId,
            isActive: employeeForm.isActive,
          },
        }).unwrap();
        setEmployeeNotice(response.message || 'Cập nhật nhân viên thành công.');
      } else {
        const response = await createEmployee({
          fullName: employeeForm.fullName.trim(),
          username: employeeForm.username.trim(),
          password: employeeForm.password.trim(),
          roleId: selectedRoleId,
          isActive: employeeForm.isActive,
        }).unwrap();
        setEmployeeNotice(response.message || 'Tạo tài khoản nhân viên thành công.');
      }

      resetEmployeeForm();
      setEmployeePage(1);
    } catch (error) {
      setEmployeeNotice(getMutationErrorMessage(error, 'Không thể lưu tài khoản nhân viên.'));
    }
  };

  const handleEditEmployee = (employee: AdminEmployee) => {
    if (!employee.userId || !employee.fullName || !employee.username || !employee.roleId || typeof employee.isActive !== 'boolean') {
      setEmployeeNotice('Dữ liệu nhân viên không đầy đủ để chỉnh sửa.');
      return;
    }

    setEditingEmployeeId(employee.userId);
    setEmployeeForm({
      fullName: employee.fullName,
      username: employee.username,
      password: '',
      roleId: employee.roleId,
      isActive: employee.isActive,
    });
    setEmployeeNotice(null);
  };

  const handleEmployeeStatusToggle = async (employee: AdminEmployee) => {
    if (!employee.userId || typeof employee.isActive !== 'boolean') {
      setEmployeeNotice('Dữ liệu nhân viên không đầy đủ để đổi trạng thái.');
      return;
    }

    try {
      const response = await updateEmployeeStatus({ id: employee.userId, isActive: !employee.isActive }).unwrap();
      setEmployeeNotice(response.message || 'Đã cập nhật trạng thái nhân viên.');
    } catch {
      setEmployeeNotice('Không thể cập nhật trạng thái nhân viên.');
    }
  };

  return {
    queryViews: { employees: employeesView, roles: rolesView },
    editingEmployeeId,
    employeeForm,
    employeeMeta,
    employeeNotice,
    employeeRoles,
    employeeRows,
    employeeSearch,
    handleEditEmployee,
    handleEmployeeStatusToggle,
    handleEmployeeSubmit,
    isEmployeeLoading,
    isRolesLoading,
    isSavingEmployee,
    isUpdatingStatus,
    resetEmployeeForm,
    setEmployeeForm,
    setEmployeePage,
    setEmployeeSearch,
  };
}
