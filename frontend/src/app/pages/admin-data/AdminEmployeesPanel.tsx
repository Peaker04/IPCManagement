import { useRef, useState } from 'react';
import { Pencil, Power, Search, UserPlus, Users } from 'lucide-react';
import { ConfirmDialog, FieldRow, KeepAliveTabPanel, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge, InlineAlert } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';
import { formatDateOnly } from '@/lib/formatters';
import { typography } from '@/lib/typography';

type AdminEmployeesPanelProps = { model: AdminDataPageModel };

const EMPTY_EMPLOYEE_ROLE_VALUE = '__empty_employee_role__';

export function AdminEmployeesPanel({ model }: AdminEmployeesPanelProps) {
  const { canManageEmployees, editingEmployeeId, effectiveActiveView, employeeForm, employeeMeta, employeeNotice, employeeRoles, employeeRows, employeeSearch, handleEditEmployee, handleEmployeeStatusToggle, handleEmployeeSubmit, isEmployeeLoading, isRolesLoading, isSavingEmployee, isUpdatingStatus, queryViews, resetEmployeeForm, setEmployeeForm, setEmployeePage, setEmployeeSearch } = model;
  const [statusTarget, setStatusTarget] = useState<{
    employee: AdminDataPageModel['employeeRows'][number];
    nextActive: boolean;
    source: 'row' | 'form';
  } | null>(null);
  const employeeFormRef = useRef<HTMLFormElement>(null);
  const skipNextStatusConfirmation = useRef(false);

  const selectedRole = employeeRoles.find((role) => role.roleId === employeeForm.roleId);

  const onFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (editingEmployeeId && !skipNextStatusConfirmation.current) {
      const editingEmployee = employeeRows.find((item) => item.userId === editingEmployeeId);
      if (editingEmployee && editingEmployee.isActive !== employeeForm.isActive) {
        event.preventDefault();
        setStatusTarget({
          employee: editingEmployee,
          nextActive: employeeForm.isActive,
          source: 'form',
        });
        return;
      }
    }
    skipNextStatusConfirmation.current = false;
    handleEmployeeSubmit(event);
  };

  return (
    <>
      <KeepAliveTabPanel id="admin-employees" active={Boolean(canManageEmployees && effectiveActiveView === 'employees')} className="flex flex-col gap-4">
        <AdminQueryBoundary queries={[
          { label: 'danh sách nhân viên', view: queryViews.employees },
          { label: 'danh sách vai trò', view: queryViews.roles },
        ]}>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
            <SectionPanel
              title={editingEmployeeId ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}
              icon={<UserPlus size={18} />}
              description="Thiết lập thông tin tài khoản, mật khẩu và phân quyền vai trò nhân viên."
            >
              <form ref={employeeFormRef} className="flex flex-col gap-3" onSubmit={onFormSubmit}>
                {employeeNotice && (
                  <div role="alert">
                    <InlineAlert title="Thông báo" variant="info">
                      {employeeNotice}
                    </InlineAlert>
                  </div>
                )}

                <FieldRow label="Họ và tên" htmlFor="employee-full-name">
                  <Input
                    id="employee-full-name"
                    value={employeeForm.fullName}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Nguyễn Văn A"
                  />
                </FieldRow>

                <FieldRow label="Tên đăng nhập" htmlFor="employee-username">
                  <Input
                    id="employee-username"
                    value={employeeForm.username}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="nguyenvana"
                  />
                </FieldRow>

                <FieldRow label="Mật khẩu" htmlFor="employee-password">
                  <Input
                    id="employee-password"
                    type="password"
                    value={employeeForm.password}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={editingEmployeeId ? '•••••••• (Để trống nếu không đổi)' : 'Nhập mật khẩu ban đầu'}
                  />
                </FieldRow>

                <FieldRow label="Vai trò" htmlFor="employee-role">
                  <Select
                    value={employeeForm.roleId || EMPTY_EMPLOYEE_ROLE_VALUE}
                    onValueChange={(value) => setEmployeeForm((current) => ({ ...current, roleId: value === EMPTY_EMPLOYEE_ROLE_VALUE ? '' : (value ?? '') }))}
                    disabled={isRolesLoading}
                  >
                    <SelectTrigger id="employee-role">
                      <SelectValue>{selectedRole ? `${selectedRole.roleName} - ${selectedRole.roleCode}` : 'Chọn vai trò'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_EMPLOYEE_ROLE_VALUE}>Chọn vai trò</SelectItem>
                      {employeeRoles.map((role) => (
                        <SelectItem key={role.roleId} value={role.roleId}>
                          {role.roleName} - {role.roleCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer">
                  <Checkbox
                    checked={employeeForm.isActive}
                    onCheckedChange={(checked) => setEmployeeForm((current) => ({ ...current, isActive: checked === true }))}
                  />
                  Đang hoạt động
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="default" disabled={isSavingEmployee}>
                    {editingEmployeeId ? 'Cập nhật' : 'Tạo tài khoản'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => resetEmployeeForm()} disabled={isSavingEmployee}>
                    Hủy / làm mới
                  </Button>
                </div>
              </form>
            </SectionPanel>

            <SectionPanel
              title="Danh sách nhân viên"
              icon={<Users size={18} />}
              description="Quản lý trạng thái hoạt động và quyền truy cập của nhân viên trên hệ thống."
              actions={
                <div className="relative w-64 max-w-full">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="employee-search"
                    className="h-8 pl-8 text-xs bg-slate-50 border-slate-300 focus:bg-white"
                    value={employeeSearch}
                    onChange={(event) => {
                      setEmployeeSearch(event.target.value);
                      setEmployeePage(1);
                    }}
                    placeholder="Tìm theo tên, tài khoản, vai trò..."
                    aria-label="Tìm kiếm nhân viên"
                  />
                </div>
              }
            >
              <div className="flex flex-col gap-3">
                <PaginatedTableFrame ariaLabel="Bảng nhân viên" className="ipc-admin-employee-shell">
                  <table className="ipc-erp-grid-table ipc-admin-employee-table w-full text-sm">
                    <thead>
                      <tr>
                        <th className="min-w-[150px] text-left">Họ tên</th>
                        <th className="w-[120px] text-left">Tài khoản</th>
                        <th className="w-[110px] text-left">Vai trò</th>
                        <th className="w-[150px] text-center whitespace-nowrap">Trạng thái</th>
                        <th className="w-[110px] text-center">Ngày tạo</th>
                        <th className="w-[130px] text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isEmployeeLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Đang tải danh sách nhân viên...
                          </td>
                        </tr>
                      ) : employeeRows.length === 0 ? (
                        <EmptyRow colSpan={6} />
                      ) : (
                        employeeRows.map((employee) => (
                          <tr key={employee.userId} className="align-top">
                            <td className="text-left font-semibold text-slate-900">{employee.fullName}</td>
                            <td className={`${typography.code} text-left text-slate-600`}>{employee.username}</td>
                            <td className="text-left">
                              <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                {employee.roleName}
                              </span>
                            </td>
                            <td className="text-center whitespace-nowrap">
                              <StatusBadge variant={employee.isActive ? 'success' : 'neutral'} size="sm">
                                {employee.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                              </StatusBadge>
                            </td>
                            <td className="text-center tabular-nums text-slate-500">
                              {employee.createdAt ? formatDateOnly(employee.createdAt) : '—'}
                            </td>
                            <td className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  textWrap="wrap"
                                  onClick={() => handleEditEmployee(employee)}
                                >
                                  <Pencil size={14} />
                                  Sửa
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  textWrap="wrap"
                                  onClick={() => setStatusTarget({ employee, nextActive: !employee.isActive, source: 'row' })}
                                  disabled={isUpdatingStatus}
                                >
                                  <Power size={14} />
                                  {employee.isActive ? 'Khóa' : 'Mở'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </PaginatedTableFrame>

                {employeeMeta && (
                  <PaginationBar
                    page={employeeMeta.pageNumber ?? 1}
                    pageSize={employeeMeta.pageSize ?? 8}
                    totalItems={employeeMeta.totalCount ?? 0}
                    onPageChange={setEmployeePage}
                  />
                )}
              </div>
            </SectionPanel>
          </div>
        </AdminQueryBoundary>

        {statusTarget !== null && (
          <ConfirmDialog
            open={statusTarget !== null}
            title={statusTarget?.nextActive ? 'Mở lại tài khoản nhân viên?' : 'Khóa tài khoản nhân viên?'}
            description={statusTarget
              ? statusTarget.nextActive
                ? `${statusTarget.employee.fullName} (${statusTarget.employee.username}) sẽ có thể đăng nhập lại theo vai trò hiện tại.`
                : `${statusTarget.employee.fullName} (${statusTarget.employee.username}) sẽ không thể đăng nhập cho tới khi tài khoản được mở lại.`
              : ''}
            confirmLabel={statusTarget?.nextActive ? 'Mở tài khoản' : 'Khóa tài khoản'}
            busy={isUpdatingStatus}
            busyLabel="Đang cập nhật..."
            onConfirm={() => {
              const target = statusTarget;
              setStatusTarget(null);
              if (target?.source === 'row') void handleEmployeeStatusToggle(target.employee);
              if (target?.source === 'form') {
                skipNextStatusConfirmation.current = true;
                employeeFormRef.current?.requestSubmit();
              }
            }}
            onOpenChange={(open) => !open && setStatusTarget(null)}
          />
        )}
      </KeepAliveTabPanel>
    </>
  );
}
