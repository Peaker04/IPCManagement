import { useMemo, useState, type FormEvent } from 'react';
import {
  BarChart3,
  Bell,
  Database,
  History,
  PackageCheck,
  PencilLine,
  Power,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import {
  ApprovalQueue,
  CommandBar,
  ContextStrip,
  DataTableShell,
  DocumentRail,
  EmptyState,
  FieldRow,
  OperationalFrame,
  PaginationBar,
  RoleInbox,
  SectionPanel,
  SplitWorkbench,
  StatusBadge,
  StockMovementTable,
  ViewSwitcher,
  type ContextStripItem,
  type ViewTab,
} from '@/components/common';
import { selectCurrentUser } from '@/features/auth';
import {
  type AdminEmployee,
  useCreateAdminEmployeeMutation,
  useGetAdminEmployeesQuery,
  useGetAdminRolesQuery,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} from '@/features/admin/adminApi';
import {
  useGetApprovalRecordsQuery,
  useGetAuditChangesQuery,
  useGetCurrentStockQuery,
  useGetIngredientDemandQuery,
  useGetIssueVsReturnUsageQuery,
  useGetKitchenIssuesQuery,
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
} from '@/features/workflow';
import { ROUTES } from '@/routes/routeConfig';

type AdminView = 'adjustments' | 'inventory' | 'audit' | 'statistics' | 'employees';

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

const EmptyRow = ({ colSpan }: { colSpan: number }) => (
  <tr>
    <td colSpan={colSpan} className="py-8 text-center text-slate-500">
      Chưa có dữ liệu để hiển thị
    </td>
  </tr>
);

export default function AdminDataPage() {
  const currentUser = useAppSelector(selectCurrentUser);
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  const [activeView, setActiveView] = useState<AdminView>('adjustments');
  const [auditPage, setAuditPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(defaultEmployeeForm);
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);
  const auditPageSize = 8;

  const { data: approvalRecords = [] } = useGetApprovalRecordsQuery({ limit: 100 });
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: auditLogs = [] } = useGetAuditChangesQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: ingredientDemandRows = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: purchaseDemandRows = [] } = useGetPurchaseDemandQuery({ limit: 100 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 100 });
  const { data: priceVarianceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });
  const { data: kitchenIssueRows = [] } = useGetKitchenIssuesQuery({ limit: 100 });
  const { data: usageRows = [] } = useGetIssueVsReturnUsageQuery({ limit: 100 });
  const { roleInboxItems } = useWorkflowOverview();

  const adjustmentDocuments = workflowDocuments.filter((document) => document.type === 'Điều chỉnh');
  const adminInbox = roleInboxItems.filter((item) => item.laneId === 'admin');
  const adjustmentMovements = stockMovements.filter((movement) => movement.type === 'adjustment');
  const shortageRows = ingredientDemandRows.filter((row) => row.tone === 'danger');
  const priceWarnings = priceVarianceRows.filter((row) => row.warning);
  const totalPurchaseQty = purchaseDemandRows.reduce((total, row) => total + row.reserved, 0);
  const totalIssuedQty = kitchenIssueRows.reduce((total, row) => total + row.issuedQty, 0);
  const totalUsedQty = usageRows.reduce((total, row) => total + row.usedQty, 0);
  const totalReturnedQty = usageRows.reduce((total, row) => total + row.returnedQty, 0);

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

  const displayLogs = auditLogs;
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
      const message =
        error &&
        typeof error === 'object' &&
        'data' in error &&
        error.data &&
        typeof error.data === 'object' &&
        'message' in error.data
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

  const adminTabs: ViewTab[] = [
    { id: 'admin-adjustments', label: 'Điều chỉnh' },
    { id: 'admin-inventory', label: 'Tồn kho' },
    { id: 'admin-statistics', label: 'Thống kê' },
    { id: 'admin-audit', label: 'Audit' },
    ...(isAdmin ? [{ id: 'admin-employees', label: 'Nhân viên' }] : []),
  ];

  const contextItems: ContextStripItem[] = [
    { label: 'Thiếu nguyên liệu', value: shortageRows.length.toString(), tone: shortageRows.length ? 'danger' : 'success' },
    { label: 'Cảnh báo giá', value: priceWarnings.length.toString(), tone: priceWarnings.length ? 'danger' : 'success' },
    { label: 'Tồn kho', value: `${currentStockRows.length} dòng`, tone: 'neutral' },
    { label: 'Audit', value: `${displayLogs.length} thay đổi`, tone: 'neutral' },
    ...(isAdmin ? [{ label: 'Nhân viên', value: `${employeeMeta?.totalCount ?? 0} tài khoản`, tone: 'info' as const }] : []),
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
      context={<ContextStrip items={contextItems} />}
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn quản trị dữ liệu"
        tabs={adminTabs}
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

      {effectiveActiveView === 'statistics' && (
        <div id="admin-statistics-panel" role="tabpanel" aria-labelledby="admin-statistics-tab" className="flex flex-col gap-4">
          <SectionPanel title="Thống kê vận hành cho Admin" icon={<BarChart3 size={18} />}>
            <DataTableShell ariaLabel="Bảng chỉ số thống kê vận hành">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Nhóm thống kê</th>
                    <th>Chỉ số</th>
                    <th>Ý nghĩa vận hành</th>
                    <th>Trạng thái</th>
                    <th>Handoff</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-semibold">Nhu cầu nguyên liệu</td>
                    <td className="ipc-numeric-cell">{shortageRows.length} dòng thiếu</td>
                    <td className="text-left">Tổng hợp sau bước hệ thống tính nhu cầu trước khi kiểm tồn.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={shortageRows.length ? 'danger' : 'success'}>
                        {shortageRows.length ? 'Cần xử lý' : 'Đủ tồn'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Mở mua thêm</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Mua hàng</td>
                    <td className="ipc-numeric-cell">{totalPurchaseQty.toLocaleString('vi-VN')} đơn vị</td>
                    <td className="text-left">Nhu cầu mua theo nhà cung cấp, ngày và ca từ danh sách mua.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={totalPurchaseQty > 0 ? 'warning' : 'success'}>
                        {totalPurchaseQty > 0 ? 'Có phát sinh' : 'Không phát sinh'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Theo dõi thu mua</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Xuất bếp</td>
                    <td className="ipc-numeric-cell">{totalIssuedQty.toLocaleString('vi-VN')} đơn vị</td>
                    <td className="text-left">Theo phiếu xuất kho cho bếp, phục vụ kiểm tra luồng thủ kho.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={kitchenIssueRows.length ? 'neutral' : 'warning'}>
                        {kitchenIssueRows.length ? 'Đã ghi nhận' : 'Chưa có phiếu'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Sử dụng thực tế</td>
                    <td className="ipc-numeric-cell">
                      {totalUsedQty.toLocaleString('vi-VN')} dùng / {totalReturnedQty.toLocaleString('vi-VN')} hoàn
                    </td>
                    <td className="text-left">Ghép xuất kho và hoàn kho để tránh tách trùng bước kiểm nguyên liệu dư.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={usageRows.length ? 'success' : 'neutral'}>
                        {usageRows.length ? 'Có đối chiếu' : 'Chưa có dữ liệu'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.CHEF_DASHBOARD}>Mở bếp trưởng</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Biến động giá</td>
                    <td className="ipc-numeric-cell">{priceWarnings.length} cảnh báo</td>
                    <td className="text-left">So giá nhập từ phiếu nhập với giá tham chiếu để admin theo dõi rủi ro.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={priceWarnings.length ? 'danger' : 'success'}>
                        {priceWarnings.length ? 'Vượt ngưỡng' : 'Ổn định'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                  </tr>
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>

          <SectionPanel title="Theo dõi tồn kho và xuất bếp" icon={<PackageCheck size={18} />}>
            <DataTableShell ariaLabel="Bảng tồn kho ưu tiên">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Kho</th>
                    <th>Nguyên liệu</th>
                    <th>Tồn hiện tại</th>
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {currentStockRows.slice(0, 8).length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>{row.warehouse}</td>
                      <td>{row.ingredient}</td>
                      <td className="ipc-numeric-cell">{row.currentQty} {row.unit}</td>
                      <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>

          <SectionPanel title="Cảnh báo cần admin theo dõi" icon={<TrendingUp size={18} />}>
            <DataTableShell ariaLabel="Bảng cảnh báo biến động giá">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Nhà cung cấp</th>
                    <th>Giá tham chiếu</th>
                    <th>Giá nhập</th>
                    <th>Biến động</th>
                  </tr>
                </thead>
                <tbody>
                  {priceWarnings.slice(0, 8).length === 0 ? <EmptyRow colSpan={5} /> : priceWarnings.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.supplier}</td>
                      <td className="ipc-numeric-cell">{row.pricePrev.toLocaleString('vi-VN')} đ</td>
                      <td className="ipc-numeric-cell">{row.priceCurrent.toLocaleString('vi-VN')} đ</td>
                      <td className="ipc-numeric-cell font-bold text-[var(--ipc-danger)]">+{row.change.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>
        </div>
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
