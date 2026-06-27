import { useMemo, useState, type FormEvent } from 'react';
import { Bell, Database, History, PencilLine, Power, Search, ShieldCheck, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSelector, useAuditLogs } from '@/app/hooks';
import { selectCurrentUser } from '@/features/auth';
import {
  ApprovalQueue,
  CommandBar,
  ContextStrip,
  DocumentRail,
  FieldRow,
  OperationalFrame,
  RoleInbox,
  PaginationBar,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  DataTableShell,
  EmptyState,
  StatusBadge,
  ViewSwitcher,
  type ViewTab,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  approvalRecords,
  getDocumentByType,
  getRoleInboxByLane,
  getStockMovementsByType,
} from '@/features/workflow';
import {
  type AdminEmployee,
  useCreateAdminEmployeeMutation,
  useGetAdminEmployeesQuery,
  useGetAdminRolesQuery,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} from '@/features/admin/adminApi';

type AdminView = 'adjustments' | 'inventory' | 'audit' | 'employees';

type EmployeeFormState = {
  fullName: string;
  username: string;
  password: string;
  roleId: string;
  isActive: boolean;
};

const defaultEmployeeForm: EmployeeFormState = {
  fullName: '',
  username: '',
  password: '',
  roleId: '',
  isActive: true,
};

export default function AdminDataPage() {
  const currentUser = useAppSelector(selectCurrentUser);
  const isAdmin = currentUser?.role === 'admin';

  const [activeView, setActiveView] = useState<AdminView>('adjustments');
  const [auditPage, setAuditPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(defaultEmployeeForm);
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);
  const auditPageSize = 8;
  const logs = useAuditLogs();
  const adjustmentDocuments = getDocumentByType('Điều chỉnh');
  const adminInbox = getRoleInboxByLane('admin');
  const adjustmentMovements = getStockMovementsByType('adjustment');
  const employeeQuery = useMemo(
    () => ({
      pageNumber: employeePage,
      pageSize: 8,
      searchKeyword: employeeSearch.trim() || undefined,
    }),
    [employeePage, employeeSearch],
  );

  const { data: employeeResponse, isFetching: isEmployeeLoading } = useGetAdminEmployeesQuery(employeeQuery, {
    skip: !isAdmin || activeView !== 'employees',
  });
  const { data: rolesResponse, isFetching: isRolesLoading } = useGetAdminRolesQuery(undefined, {
    skip: !isAdmin || activeView !== 'employees',
  });
  const [createEmployee, { isLoading: isCreatingEmployee }] = useCreateAdminEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdatingEmployee }] = useUpdateAdminEmployeeMutation();
  const [updateEmployeeStatus, { isLoading: isUpdatingStatus }] = useUpdateAdminEmployeeStatusMutation();

  const defaultAuditLogs = [
    {
      id: 'aud-01',
      timestamp: '2026-06-13T08:30:12.000Z',
      actor: 'Quản lý Bếp trưởng (Đặng Ánh Vàng)',
      fieldAffected: 'Khóa định mức',
      oldValue: 'Chưa khóa',
      newValue: 'Đã khóa',
      reason: 'Chốt số suất ăn phục vụ ca trưa ngày 13/06',
      orderId: 'KHSX-0613-TRUA',
      shiftType: 'Ca Sáng' as const,
    },
    {
      id: 'aud-02',
      timestamp: '2026-06-13T09:12:45.000Z',
      actor: 'Admin Hệ Thống',
      fieldAffected: 'BOM / Định lượng cá kho tiêu',
      oldValue: '120g/suất',
      newValue: '110g/suất',
      reason: 'Điều chỉnh lượng cá theo yêu cầu của bếp trưởng để tránh hao hụt',
      orderId: 'BOM-FISH-01',
      shiftType: 'Ca Sáng' as const,
    },
    {
      id: 'aud-03',
      timestamp: '2026-06-13T09:40:00.000Z',
      actor: 'Quản lý vận hành (DAV)',
      fieldAffected: 'Giá thu mua hành lá',
      oldValue: '35.000 đ/kg',
      newValue: '42.000 đ/kg (+18%)',
      reason: 'Duyệt giá tăng đột xuất từ NCC Minh An do khan hiếm thị trường',
      orderId: 'MUA-0613-01',
      shiftType: 'Ca Sáng' as const,
    },
  ];

  const displayLogs = [...logs, ...defaultAuditLogs];
  const totalAuditPages = Math.max(1, Math.ceil(displayLogs.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const pagedAuditLogs = displayLogs.slice((safeAuditPage - 1) * auditPageSize, safeAuditPage * auditPageSize);
  const employeeRoles = rolesResponse?.data ?? [];
  const employeeRows = employeeResponse?.data?.items ?? [];
  const employeeMeta = employeeResponse?.data;
  const defaultRoleId = employeeRoles[0]?.roleId ?? '';
  const effectiveActiveView: AdminView = isAdmin ? activeView : activeView === 'employees' ? 'adjustments' : activeView;

  const resetEmployeeForm = (roleId = defaultRoleId) => {
    setEditingEmployeeId(null);
    setEmployeeForm({
      ...defaultEmployeeForm,
      roleId,
    });
  };

  const handleEmployeeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedRoleId = employeeForm.roleId || defaultRoleId;

    if (!employeeForm.fullName.trim() || !employeeForm.username.trim() || !selectedRoleId) {
      setEmployeeNotice('Vui lòng nhập đầy đủ họ tên, tài khoản và vai trò.');
      return;
    }

    if (!selectedRoleId) {
      setEmployeeNotice('Vui lòng chọn vai trò hợp lệ.');
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
      const message = error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object' && 'message' in error.data
        ? String(error.data.message)
        : 'Không thể lưu tài khoản nhân viên.';
      setEmployeeNotice(message);
    }
  };

  const handleEditEmployee = (employee: AdminEmployee) => {
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
    try {
      const response = await updateEmployeeStatus({
        id: employee.userId,
        isActive: !employee.isActive,
      }).unwrap();

      setEmployeeNotice(response.message || 'Đã cập nhật trạng thái nhân viên.');
    } catch {
      setEmployeeNotice('Không thể cập nhật trạng thái nhân viên.');
    }
  };

  const employeeTabs: ViewTab[] = [
    { id: 'admin-adjustments', label: 'Điều chỉnh' },
    { id: 'admin-inventory', label: 'Tồn kho' },
    { id: 'admin-audit', label: 'Audit' },
    ...(isAdmin ? [{ id: 'admin-employees', label: 'Nhân viên' }] : []),
  ];

  return (
    <OperationalFrame
      title="Quản trị dữ liệu"
      eyebrow="Luồng Admin"
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button">Điều chỉnh BOM</button>
              <button className="ipc-button ipc-button-ghost" type="button">
                <Bell size={16} />
                Gửi thông báo vận hành
              </button>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.WEEKLY_MENU}>
                <Database size={16} />
                Xem KHSX/BOM
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.DASHBOARD}>
                Về bàn điều hành
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <SlidersHorizontal size={16} />
            Phạm vi: BOM và tồn kho
          </span>
          <span className="ipc-command-meta">Yêu cầu có lý do điều chỉnh</span>
          {isAdmin && <span className="ipc-command-meta">Admin có thể quản lí nhân viên</span>}
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'BOM chờ kiểm tra', value: 'Cá kho tiêu', tone: 'warning' },
            { label: 'Điều chỉnh tồn', value: 'Hành lá +3 kg', tone: 'success' },
            { label: 'Thông báo', value: 'Chưa gửi cho ca trưa', tone: 'warning' },
            { label: 'Audit', value: 'Có lý do thay đổi', tone: 'neutral' },
            ...(isAdmin ? [{ label: 'Nhân viên', value: `${employeeMeta?.totalCount ?? 0} tài khoản`, tone: 'info' as const }] : []),
          ]}
        />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn quản trị dữ liệu"
        tabs={employeeTabs}
        activeTab={`admin-${effectiveActiveView}`}
        onTabChange={(id) => setActiveView(id.replace('admin-', '') as AdminView)}
      />

      {effectiveActiveView === 'adjustments' && (
        <div id="admin-adjustments-panel" role="tabpanel" aria-labelledby="admin-adjustments-tab">
          <SplitWorkbench
            detailLabel="Chứng từ"
            detail={
              <DocumentRail
                documents={adjustmentDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Mở điều chỉnh
                  </Link>
                )}
              />
            }
          >
            <SectionPanel title="Hàng đợi điều chỉnh" icon={<Database size={18} />}>
              <ApprovalQueue records={approvalRecords.filter((record) => record.type === 'adjustment')} title={null} />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {effectiveActiveView === 'inventory' && (
        <SectionPanel title="Điều chỉnh tồn và thông báo">
          <div id="admin-inventory-panel" role="tabpanel" aria-labelledby="admin-inventory-tab">
          <StockMovementTable movements={adjustmentMovements} />
          <div className="mt-4">
            <RoleInbox
              items={adminInbox}
              title={null}
              actionForItem={(item) => (
                <Link className="ipc-button ipc-button-ghost" to={item.route}>
                  {item.nextAction}
                </Link>
              )}
            />
          </div>
          </div>
        </SectionPanel>
      )}

      {effectiveActiveView === 'audit' && (
        <SectionPanel title="Nhật ký thay đổi hệ thống (Audit Trail)" icon={<History size={18} />}>
          <div id="admin-audit-panel" role="tabpanel" aria-labelledby="admin-audit-tab" className="flex flex-col gap-4">
            <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4">
              <div className="text-[13px] font-bold text-slate-700 flex items-center gap-1.5">
                <Bell size={15} className="text-blue-600" />
                <span>Nội dung thông báo vận hành ca</span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                BOM <b>Cá kho tiêu</b> đã chờ kiểm tra. Khi duyệt xong, gửi thông báo cho Điều phối, KHSX và Bếp trưởng trước ca tiếp theo để đồng bộ thông tin định lượng.
              </p>
              <button className="ipc-button ipc-button-ghost mt-3 shadow-sm bg-white" type="button">
                <Bell size={15} />
                Gửi thông báo vận hành
              </button>
            </div>

            <DataTableShell ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell">
              <table className="ipc-data-table ipc-admin-audit-table text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Đối tượng/Trường ảnh hưởng</th>
                    <th>Giá trị cũ</th>
                    <th>Giá trị mới</th>
                    <th className="text-left">Lý do thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-mono text-slate-500 text-left">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')} {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="font-semibold text-slate-800">{log.actor}</td>
                      <td className="font-medium text-blue-700">{log.fieldAffected}</td>
                      <td className="text-slate-500 font-mono">{log.oldValue}</td>
                      <td className="font-bold text-slate-900 font-mono">{log.newValue}</td>
                      <td className="ipc-admin-audit-reason text-left text-slate-600">
                        <span>{log.reason}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
            <PaginationBar page={safeAuditPage} pageSize={auditPageSize} totalItems={displayLogs.length} onPageChange={setAuditPage} />
          </div>
        </SectionPanel>
      )}

      {isAdmin && effectiveActiveView === 'employees' && (
        <div id="admin-employees-panel" role="tabpanel" aria-labelledby="admin-employees-tab" className="flex flex-col gap-4">
          <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <SectionPanel
              title={editingEmployeeId ? 'Cập nhật nhân viên' : 'Tạo tài khoản nhân viên'}
              icon={<UserPlus size={18} />}
            >
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
                    value={employeeForm.roleId || defaultRoleId}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, roleId: event.target.value }))}
                    disabled={isRolesLoading}
                  >
                    <option value="">Chọn vai trò</option>
                    {employeeRoles.map((role) => (
                      <option key={role.roleId} value={role.roleId}>
                        {role.roleName} · {role.roleCode}
                      </option>
                    ))}
                  </select>
                </FieldRow>
                <p className="-mt-2 text-xs leading-5 text-slate-500">
                  Vai trò được lấy trực tiếp từ bảng auth roles, bao gồm Head Chef, Manager và Procurement Staff.
                </p>

                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={employeeForm.isActive}
                    onChange={(event) => setEmployeeForm((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  Đang hoạt động
                </label>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="ipc-button ipc-button-primary" disabled={isCreatingEmployee || isUpdatingEmployee}>
                    {editingEmployeeId ? 'Cập nhật' : 'Tạo tài khoản'}
                  </button>
                  <button
                    type="button"
                    className="ipc-button ipc-button-ghost"
                    onClick={() => resetEmployeeForm()}
                    disabled={isCreatingEmployee || isUpdatingEmployee}
                  >
                    Hủy / làm mới
                  </button>
                </div>
              </form>
            </SectionPanel>

            <SectionPanel
              title="Danh sách nhân viên"
              icon={<Users size={18} />}
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[260px] flex-1">
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
                  </div>
                </div>

                <DataTableShell ariaLabel="Bảng nhân viên" className="ipc-admin-employee-shell">
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
                        <tr>
                          <td colSpan={6} className="py-8">
                            <EmptyState
                              title="Chưa có nhân viên nào"
                              description="Hãy tạo tài khoản đầu tiên để phân quyền và quản lý nhân viên trong công ty."
                            />
                          </td>
                        </tr>
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
                              <StatusBadge variant={employee.isActive ? 'success' : 'warning'} className="ipc-table-badge ipc-table-badge--status">
                                {employee.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                              </StatusBadge>
                            </td>
                            <td className="text-slate-500">
                              {new Date(employee.createdAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="ipc-button ipc-button-ghost ipc-button-bounded"
                                  onClick={() => handleEditEmployee(employee)}
                                >
                                  <PencilLine size={14} />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="ipc-button ipc-button-bounded"
                                  onClick={() => handleEmployeeStatusToggle(employee)}
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
                </DataTableShell>

                {employeeMeta && (
                  <PaginationBar
                    page={employeeMeta.pageNumber}
                    pageSize={employeeMeta.pageSize}
                    totalItems={employeeMeta.totalCount}
                    onPageChange={setEmployeePage}
                  />
                )}
              </div>
            </SectionPanel>
          </div>

          <SectionPanel
            title="Quyền quản trị"
            icon={<ShieldCheck size={18} />}
          >
            <p className="text-sm leading-6 text-slate-600">
              Chỉ tài khoản có role <b>Admin</b> mới nhìn thấy tab này và có thể tạo, sửa, khóa hoặc mở tài khoản nhân viên.
            </p>
          </SectionPanel>
        </div>
      )}
    </OperationalFrame>
  );
}
