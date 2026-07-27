import { Pencil, Power, Search, UserPlus, Users } from 'lucide-react';
import { FieldRow, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge } from '@/components/common';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';

type AdminEmployeesPanelProps = { model: AdminDataPageModel };

export function AdminEmployeesPanel({ model }: AdminEmployeesPanelProps) {
  const { canManageEmployees, editingEmployeeId, effectiveActiveView, employeeForm, employeeMeta, employeeNotice, employeeRoles, employeeRows, employeeSearch, handleEditEmployee, handleEmployeeStatusToggle, handleEmployeeSubmit, isEmployeeLoading, isRolesLoading, isSavingEmployee, isUpdatingStatus, queryViews, resetEmployeeForm, setEmployeeForm, setEmployeePage, setEmployeeSearch } = model;
  return (
    <>
      {canManageEmployees && effectiveActiveView === 'employees' && (
        <div id="admin-employees-panel" role="tabpanel" aria-labelledby="admin-employees-tab" className="flex flex-col gap-4">
          <AdminQueryBoundary queries={[
            { label: 'danh sách nhân viên', view: queryViews.employees },
            { label: 'vai trò nhân viên', view: queryViews.roles },
          ]}>
          <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <SectionPanel title={editingEmployeeId ? 'Cập nhật nhân viên' : 'Tạo tài khoản nhân viên'} icon={<UserPlus size={18} />}>
              <form className="flex flex-col gap-4" onSubmit={handleEmployeeSubmit}>
                {employeeNotice && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {employeeNotice}
                  </div>
                )}

                <FieldRow label="Họ và tên" htmlFor="employee-full-name">
                  <input
                    id="employee-full-name"
                    className="ipc-input"
                    value={employeeForm.fullName}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))}
                    placeholder="Ví dụ: Nguyễn Văn A"
                  />
                </FieldRow>

                <FieldRow label="Tên đăng nhập" htmlFor="employee-username">
                  <input
                    id="employee-username"
                    className="ipc-input"
                    value={employeeForm.username}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, username: event.target.value }))}
                    placeholder="Ví dụ: nguyenvana"
                  />
                </FieldRow>

                <FieldRow label={editingEmployeeId ? 'Đổi mật khẩu (không bắt buộc)' : 'Mật khẩu'} htmlFor="employee-password">
                  <input
                    id="employee-password"
                    type="password"
                    className="ipc-input"
                    value={employeeForm.password}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={editingEmployeeId ? 'Để trống nếu không đổi' : 'Nhập mật khẩu'}
                  />
                </FieldRow>

                <FieldRow label="Vai trò" htmlFor="employee-role">
                  <select
                    id="employee-role"
                    className="ipc-select"
                    value={employeeForm.roleId}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, roleId: event.target.value }))}
                    disabled={isRolesLoading}
                  >
                    <option value="">Chọn vai trò</option>
                    {employeeRoles.map((role) => (
                      <option key={role.roleId} value={role.roleId}>
                        {role.roleName} - {role.roleCode}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={employeeForm.isActive}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  Đang hoạt động
                </label>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="ipc-button ipc-button-primary" disabled={isSavingEmployee}>
                    {editingEmployeeId ? 'Cập nhật' : 'Tạo tài khoản'}
                  </button>
                  <button type="button" className="ipc-button ipc-button-ghost" onClick={() => resetEmployeeForm()} disabled={isSavingEmployee}>
                    Hủy / làm mới
                  </button>
                </div>
              </form>
            </SectionPanel>

            <SectionPanel title="Danh sách nhân viên" icon={<Users size={18} />}>
              <div className="flex flex-col gap-3">
                <FieldRow label="Tìm kiếm" htmlFor="employee-search">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="employee-search"
                      className="ipc-input pl-9"
                      value={employeeSearch}
                      onChange={(event) => {
                        setEmployeeSearch(event.target.value);
                        setEmployeePage(1);
                      }}
                      placeholder="Tìm theo tên, tài khoản, vai trò"
                    />
                  </div>
                </FieldRow>

                <PaginatedTableFrame ariaLabel="Bảng nhân viên" className="ipc-admin-employee-shell">
                  <table className="ipc-data-table ipc-admin-employee-table text-sm">
                    <thead>
                      <tr>
                        <th>Họ tên</th>
                        <th>Tài khoản</th>
                        <th>Vai trò</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                        <th>Thao tác</th>
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
                          <tr key={employee.userId} className="align-top hover:bg-slate-50">
                            <td className="font-semibold text-slate-900">{employee.fullName}</td>
                            <td className="font-mono text-slate-600">{employee.username}</td>
                            <td>
                              <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                {employee.roleName}
                              </span>
                            </td>
                            <td>
                              <StatusBadge variant={employee.isActive ? 'success' : 'warning'}>
                                {employee.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                              </StatusBadge>
                            </td>
                            <td className="text-slate-500">
                              {employee.createdAt ? new Date(employee.createdAt).toLocaleDateString('vi-VN') : '—'}
                            </td>
                            <td>
                              <div className="flex flex-wrap justify-center gap-2">
                                <button
                                  type="button"
                                  className="ipc-button ipc-button-ghost ipc-button-bounded"
                                  onClick={() => handleEditEmployee(employee)}
                                >
                                  <Pencil size={14} />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="ipc-button ipc-button-bounded"
                                  onClick={() => void handleEmployeeStatusToggle(employee)}
                                  disabled={isUpdatingStatus}
                                >
                                  <Power size={14} />
                                  {employee.isActive ? 'Khóa' : 'Mở'}
                                </button>
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
        </div>
      )}


    </>
  );
}
