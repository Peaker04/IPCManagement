import { useMemo, useState, type FormEvent } from 'react';
import { BarChart3, Bell, CalendarCheck, Database, Download, History, PackageCheck, Pencil, PlusCircle, Power, Save, Search, SlidersHorizontal, TrendingUp, Upload, UserPlus, Users, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { TableViewport } from '@/components/common/TableViewport';
import {
  CommandBar,
  ContextStrip,
  CursorPaginationBar,
  FieldRow,
  InlineAlert,
  OperationalFrame,
  RoleInbox,
  PaginationBar,
  PaginatedTableFrame,
  SectionPanel,
  StatusBadge,
  StockMovementTable,
  DataTableShell,
  ViewSwitcher,
  type ViewTab,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import { usePaginatedRows } from '@/lib/usePaginatedRows';
import { selectCurrentUser } from '@/features/auth';
import {
  useGetAuditChangePageQuery,
  useGetCurrentStockQuery,
  useGetDataQualityQuery,
  useGetIngredientDemandQuery,
  useGetIssueVsReturnUsageQuery,
  useGetKitchenIssuesQuery,
  useGetOperationalKpisQuery,
  useGetPriceVarianceQuery,
  useGetPurchasePlanQuery,
  useGetStockMovementsQuery,
  useUpdateDataQualityIssueRemediationMutation,
  useWorkflowOverview,
  type DataQualityIssueRow,
} from '@/features/workflow';
import {
  useDownloadBomTemplateMutation,
  useCommitBomImportMutation,
  usePreviewBomImportMutation,
  type BomImportPreview,
} from '@/features/projects/dishCatalogApi';
import {
  useCreateCustomerContractMutation,
  useGetCustomerContractsQuery,
  useGetMenuSchedulesQuery,
  useUpdateCustomerContractMutation,
  useUpdateMenuScheduleRulesMutation,
  useUpdateMenuScheduleVersionMutation,
} from '@/features/coordination/coordinationApi';
import type {
  ApiShiftName,
  CreateCustomerContractRequest,
  CustomerContractDto,
  MenuScheduleDto,
  UpdateCustomerContractRequest,
  UpdateMenuScheduleRulesRequest,
  UpdateMenuScheduleVersionRequest,
} from '@/features/coordination/types';
import {
  type AdminEmployee,
  useCreateAdminEmployeeMutation,
  useGetAdminEmployeesQuery,
  useGetAdminRolesQuery,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} from '@/features/admin/adminApi';

type AdminView = 'bom-import' | 'contracts' | 'cleanup' | 'inventory' | 'audit' | 'statistics' | 'employees';

type ContractFormState = {
  customerCode: string;
  customerName: string;
  note: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  activeWeekDays: string;
  shiftNames: string;
  defaultMenuPrice: string;
  defaultBomRatePercent: string;
};

type ScheduleRuleFormState = {
  menuPrice: string;
  bomRatePercent: string;
  status: string;
  reason: string;
};

const defaultContractForm: ContractFormState = {
  customerCode: '',
  customerName: '',
  note: '',
  isActive: true,
  effectiveFrom: '',
  effectiveTo: '',
  activeWeekDays: '',
  shiftNames: '',
  defaultMenuPrice: '',
  defaultBomRatePercent: '',
};

const defaultScheduleRuleForm: ScheduleRuleFormState = {
  menuPrice: '',
  bomRatePercent: '100',
  status: 'ACTIVE',
  reason: '',
};

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

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

const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data && typeof data === 'object' && 'message' in data) {
      return String(data.message);
    }
  }

  return fallback;
};

const isAdminView = (value: string | null): value is AdminView =>
  value === 'bom-import' ||
  value === 'contracts' ||
  value === 'cleanup' ||
  value === 'inventory' ||
  value === 'audit' ||
  value === 'statistics' ||
  value === 'employees';

export default function AdminDataPage() {
  const currentUser = useAppSelector(selectCurrentUser);
  const [searchParams] = useSearchParams();
  const canManageEmployees = currentUser?.role === 'admin' || currentUser?.isAdminFullAccess;
  const initialView = isAdminView(searchParams.get('view')) && (searchParams.get('view') !== 'employees' || canManageEmployees)
    ? searchParams.get('view') as AdminView
    : 'bom-import';
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const [auditCursors, setAuditCursors] = useState<Array<{ cursorDate: string; cursorId?: string }>>([]);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(defaultEmployeeForm);
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);
  const [selectedContractCustomerId, setSelectedContractCustomerId] = useState('');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [contractForm, setContractForm] = useState<ContractFormState>(defaultContractForm);
  const [scheduleRuleForm, setScheduleRuleForm] = useState<ScheduleRuleFormState>(defaultScheduleRuleForm);
  const [contractFeedback, setContractFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dataQualityFeedback, setDataQualityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [bomImportTier, setBomImportTier] = useState(25000);
  const [bomImportCustomerId, setBomImportCustomerId] = useState('');
  const [bomImportEffectiveFrom, setBomImportEffectiveFrom] = useState(getTodayInputValue());
  const [bomImportFile, setBomImportFile] = useState<File | null>(null);
  const [bomImportPreview, setBomImportPreview] = useState<BomImportPreview | null>(null);
  const [bomImportFeedback, setBomImportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [downloadBomTemplate, downloadBomTemplateState] = useDownloadBomTemplateMutation();
  const [previewBomImport, previewBomImportState] = usePreviewBomImportMutation();
  const [commitBomImport, commitBomImportState] = useCommitBomImportMutation();
  const { data: contractResponse } = useGetCustomerContractsQuery();
  const customerContracts = useMemo(() => contractResponse?.data ?? [], [contractResponse?.data]);
  const selectedContract = useMemo(
    () => customerContracts.find((customer) => customer.customerId === selectedContractCustomerId) ?? customerContracts[0],
    [customerContracts, selectedContractCustomerId],
  );
  const { data: scheduleResponse } = useGetMenuSchedulesQuery(
    { customerId: selectedContract?.customerId, serviceDate: selectedContract?.latestServiceDate ?? undefined },
    { skip: !selectedContract?.customerId },
  );
  const menuSchedules = useMemo(() => scheduleResponse?.data ?? [], [scheduleResponse?.data]);
  const selectedSchedule = useMemo(
    () => menuSchedules.find((schedule) => schedule.menuScheduleId === selectedScheduleId) ?? menuSchedules[0],
    [menuSchedules, selectedScheduleId],
  );
  const [createCustomerContract, createCustomerContractState] = useCreateCustomerContractMutation();
  const [updateCustomerContract, updateCustomerContractState] = useUpdateCustomerContractMutation();
  const [updateMenuScheduleRules, updateMenuScheduleRulesState] = useUpdateMenuScheduleRulesMutation();
  const [updateMenuScheduleVersion, updateMenuScheduleVersionState] = useUpdateMenuScheduleVersionMutation();
  const [auditActor, setAuditActor] = useState('');
  const [auditArea, setAuditArea] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [auditField, setAuditField] = useState('');
  const authToken = useAppSelector((state) => state.auth.token);

  const auditQuery = useMemo(
    () => ({
      limit: 100,
      actor: auditActor.trim() || undefined,
      businessArea: auditArea.trim() || undefined,
      entityName: auditEntity.trim() || undefined,
      fieldName: auditField.trim() || undefined,
    }),
    [auditActor, auditArea, auditEntity, auditField]
  );

  const auditCursor = auditCursors.at(-1);
  const auditResult = useGetAuditChangePageQuery({
    ...auditQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'audit' });

  const handleExportAuditCsv = async () => {
    const params = new URLSearchParams();
    if (auditActor) params.append('actor', auditActor.trim());
    if (auditArea) params.append('businessArea', auditArea.trim());
    if (auditEntity) params.append('entityName', auditEntity.trim());
    if (auditField) params.append('fieldName', auditField.trim());

    try {
      const response = await fetch(`/api/workflow-reports/audit-changes/csv?${params.toString()}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!response.ok) throw new Error('Không thể xuất CSV');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Lỗi khi tải file CSV: ' + err);
    }
  };
  const { data: dataQualityReport } = useGetDataQualityQuery({ limit: 100 });
  const { data: operationalKpis } = useGetOperationalKpisQuery();
  const [updateDataQualityIssueRemediation, updateDataQualityIssueRemediationState] = useUpdateDataQualityIssueRemediationMutation();
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: ingredientDemandRows = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: purchasePlanRows = [] } = useGetPurchasePlanQuery({ groupBy: 'day', limit: 500 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 100 });
  const { data: priceVarianceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });
  const { data: kitchenIssueRows = [] } = useGetKitchenIssuesQuery({ limit: 100 });
  const { data: usageRows = [] } = useGetIssueVsReturnUsageQuery({ limit: 100 });
  const { roleInboxItems } = useWorkflowOverview();
  const employeeQuery = useMemo(
    () => ({
      pageNumber: employeePage,
      pageSize: 8,
      searchKeyword: employeeSearch.trim() || undefined,
    }),
    [employeePage, employeeSearch],
  );
  const { data: employeeResponse, isFetching: isEmployeeLoading } = useGetAdminEmployeesQuery(employeeQuery, {
    skip: !canManageEmployees || activeView !== 'employees',
  });
  const { data: rolesResponse, isFetching: isRolesLoading } = useGetAdminRolesQuery(undefined, {
    skip: !canManageEmployees || activeView !== 'employees',
  });
  const [createEmployee, { isLoading: isCreatingEmployee }] = useCreateAdminEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdatingEmployee }] = useUpdateAdminEmployeeMutation();
  const [updateEmployeeStatus, { isLoading: isUpdatingStatus }] = useUpdateAdminEmployeeStatusMutation();
  const adminInbox = roleInboxItems.filter((item) => item.laneId === 'admin');
  const adjustmentMovements = stockMovements.filter((movement) => movement.type === 'adjustment');
  const shortageRows = ingredientDemandRows.filter((row) => row.tone === 'danger');
  const priceWarnings = priceVarianceRows.filter((row) => row.warning);
  const currentStockPagination = usePaginatedRows(currentStockRows, 8);
  const priceWarningPagination = usePaginatedRows(priceWarnings, 8);
  const totalPurchaseQty = purchasePlanRows.reduce((total, row) => total + row.shortageQty, 0);
  const totalIssuedQty = kitchenIssueRows.reduce((total, row) => total + row.issuedQty, 0);
  const totalUsedQty = usageRows.reduce((total, row) => total + row.usedQty, 0);
  const totalReturnedQty = usageRows.reduce((total, row) => total + row.returnedQty, 0);
  const dataQualityIssues = dataQualityReport?.issues ?? [];
  const dataQualityErrors = dataQualityIssues.filter((issue) => issue.severity === 'error');
  const bomPreviewPagination = usePaginatedRows(bomImportPreview?.rows ?? [], 20);
  const qualityPagination = usePaginatedRows(dataQualityIssues, 8);
  const isSavingContract = createCustomerContractState.isLoading || updateCustomerContractState.isLoading || updateMenuScheduleRulesState.isLoading || updateMenuScheduleVersionState.isLoading;
  const employeeRoles = rolesResponse?.data ?? [];
  const employeeRows = employeeResponse?.data?.items ?? [];
  const employeeMeta = employeeResponse?.data;
  const isSavingEmployee = isCreatingEmployee || isUpdatingEmployee;
  const effectiveActiveView: AdminView = canManageEmployees ? activeView : activeView === 'employees' ? 'bom-import' : activeView;
  const adminTabs: ViewTab[] = [
    { id: 'admin-bom-import', label: 'BOM theo đơn giá' },
    { id: 'admin-contracts', label: 'Contract' },
    { id: 'admin-cleanup', label: 'Dữ liệu lỗi' },
    { id: 'admin-inventory', label: 'Tồn kho' },
    { id: 'admin-statistics', label: 'Thống kê' },
    { id: 'admin-audit', label: 'Audit' },
    ...(canManageEmployees ? [{ id: 'admin-employees', label: 'Nhân viên' }] : []),
  ];

  const displayLogs = auditLogs;
  const totalAuditPages = Math.max(1, Math.ceil(displayLogs.length / auditPageSize));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const pagedAuditLogs = displayLogs.slice((safeAuditPage - 1) * auditPageSize, safeAuditPage * auditPageSize);

  const handleDownloadBomTemplate = async () => {
    try {
      const blob = await downloadBomTemplate({
        priceTier: bomImportTier,
        customerId: bomImportCustomerId.trim() || undefined,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bom-template-${bomImportTier}-${bomImportCustomerId.trim() || 'global'}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBomImportFeedback({ type: 'success', message: 'Đã tải file mẫu BOM mở được bằng Excel.' });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa tải được file mẫu BOM.') });
    }
  };

  const handlePreviewBomImport = async () => {
    if (!bomImportFile) {
      setBomImportFeedback({ type: 'error', message: 'Vui lòng chọn file CSV/Excel-compatible trước khi preview.' });
      return;
    }

    try {
      const result = await previewBomImport({
        file: bomImportFile,
        priceTier: bomImportTier,
        customerId: bomImportCustomerId.trim() || undefined,
        effectiveFrom: bomImportEffectiveFrom || undefined,
      }).unwrap();
      setBomImportPreview(result);
      setBomImportFeedback({
        type: result.canCommit ? 'success' : 'error',
        message: result.canCommit
          ? `Preview hợp lệ: ${result.validRows}/${result.totalRows} dòng có thể commit.`
          : `Preview còn ${result.errorRows} dòng lỗi, cần sửa trước khi commit.`,
      });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Preview import BOM thất bại.') });
    }
  };

  const handleCommitBomImport = async () => {
    if (!bomImportFile || !bomImportPreview?.canCommit) {
      setBomImportFeedback({ type: 'error', message: 'Chỉ commit khi preview đã hợp lệ.' });
      return;
    }

    try {
      const result = await commitBomImport({
        file: bomImportFile,
        priceTier: bomImportTier,
        customerId: bomImportCustomerId.trim() || undefined,
        effectiveFrom: bomImportEffectiveFrom || undefined,
      }).unwrap();
      setBomImportPreview(result);
      setBomImportFeedback({
        type: 'success',
        message: `Đã import BOM: tạo ${result.createdRows}, cập nhật ${result.updatedRows}, archive ${result.archivedRows}.`,
      });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Commit import BOM thất bại.') });
    }
  };

  const loadContractForm = (contract: CustomerContractDto | undefined) => {
    setIsCreatingContract(false);
    setContractForm(contract ? {
      customerCode: contract.customerCode,
      customerName: contract.customerName,
      note: contract.note ?? '',
      isActive: contract.isActive,
      effectiveFrom: contract.effectiveFrom ?? '',
      effectiveTo: contract.effectiveTo ?? '',
      activeWeekDays: contract.activeWeekDays.join(','),
      shiftNames: contract.shiftNames.join(','),
      defaultMenuPrice: contract.defaultMenuPrice != null ? String(contract.defaultMenuPrice) : '',
      defaultBomRatePercent: contract.defaultBomRatePercent != null ? String(contract.defaultBomRatePercent) : '',
    } : defaultContractForm);
    setContractFeedback(null);
  };

  const startNewContract = () => {
    setIsCreatingContract(true);
    setSelectedContractCustomerId('');
    setSelectedScheduleId('');
    setContractForm({
      ...defaultContractForm,
      isActive: true,
      activeWeekDays: 't2,t3,t4,t5,t6,t7',
      shiftNames: 'MORNING,AFTERNOON',
      defaultMenuPrice: '25000',
      defaultBomRatePercent: '100',
    });
    loadScheduleRuleForm(undefined);
    setContractFeedback(null);
  };

  const loadScheduleRuleForm = (schedule: MenuScheduleDto | undefined) => {
    setScheduleRuleForm(schedule ? {
      menuPrice: String(schedule.menuPrice),
      bomRatePercent: String(schedule.bomRatePercent),
      status: schedule.status,
      reason: '',
    } : defaultScheduleRuleForm);
    setContractFeedback(null);
  };

  const handleSaveCustomerContract = async () => {
    if (!isCreatingContract && !selectedContract) {
      setContractFeedback({ type: 'error', message: 'Chưa chọn khách hàng.' });
      return;
    }

    const nextCustomerCode = contractForm.customerCode.trim().toUpperCase();
    const nextCustomerName = contractForm.customerName.trim() || selectedContract?.customerName;
    const nextNote = contractForm.customerName || contractForm.note
      ? contractForm.note.trim()
      : selectedContract?.note ?? '';
    const nextIsActive = contractForm.customerName || contractForm.note || selectedContractCustomerId
      ? contractForm.isActive
      : selectedContract?.isActive ?? true;

    if (isCreatingContract && !nextCustomerCode) {
      setContractFeedback({ type: 'error', message: 'Mã khách hàng không được trống.' });
      return;
    }
    if (!nextCustomerName) {
      setContractFeedback({ type: 'error', message: 'Tên khách hàng không được trống.' });
      return;
    }

    const defaultMenuPrice = contractForm.defaultMenuPrice.trim()
      ? Number(contractForm.defaultMenuPrice)
      : undefined;
    const defaultBomRatePercent = contractForm.defaultBomRatePercent.trim()
      ? Number(contractForm.defaultBomRatePercent)
      : undefined;

    if (defaultMenuPrice != null && (!Number.isFinite(defaultMenuPrice) || defaultMenuPrice < 0)) {
      setContractFeedback({ type: 'error', message: 'Đơn giá mặc định không hợp lệ.' });
      return;
    }
    if (defaultBomRatePercent != null && (!Number.isFinite(defaultBomRatePercent) || defaultBomRatePercent <= 0 || defaultBomRatePercent > 300)) {
      setContractFeedback({ type: 'error', message: 'Tỷ lệ BOM mặc định phải trong khoảng 0-300%.' });
      return;
    }

    const activeWeekDays = contractForm.activeWeekDays
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const shiftNames: ApiShiftName[] = contractForm.shiftNames
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean) as ApiShiftName[];
    if (activeWeekDays.length === 0) {
      setContractFeedback({ type: 'error', message: 'Ngày làm việc contract không được trống.' });
      return;
    }
    if (shiftNames.length === 0) {
      setContractFeedback({ type: 'error', message: 'Ca phục vụ contract không được trống.' });
      return;
    }

    const body: UpdateCustomerContractRequest = {
      customerName: nextCustomerName,
      note: nextNote || null,
      isActive: nextIsActive,
      effectiveFrom: contractForm.effectiveFrom || undefined,
      effectiveTo: contractForm.effectiveTo || undefined,
      activeWeekDays,
      shiftNames,
      defaultMenuPrice,
      defaultBomRatePercent,
    };

    try {
      if (isCreatingContract) {
        const createBody: CreateCustomerContractRequest = {
          customerCode: nextCustomerCode,
          ...body,
          customerName: nextCustomerName,
        };
        const response = await createCustomerContract(createBody).unwrap();
        if (!response.data) {
          throw new Error('Không nhận được contract vừa tạo.');
        }

        setSelectedContractCustomerId(response.data.customerId);
        setIsCreatingContract(false);
        loadContractForm(response.data);
        setContractFeedback({ type: 'success', message: 'Đã tạo khách hàng và contract.' });
        return;
      }

      await updateCustomerContract({ customerId: selectedContract!.customerId, body }).unwrap();
      setContractFeedback({ type: 'success', message: 'Đã lưu contract khách hàng.' });
    } catch (error) {
      setContractFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa lưu được contract khách hàng.') });
    }
  };

  const handleSaveScheduleRules = async () => {
    if (!selectedSchedule) {
      setContractFeedback({ type: 'error', message: 'Chưa chọn lịch thực đơn/ca phục vụ.' });
      return;
    }

    const menuPrice = Number(scheduleRuleForm.menuPrice || selectedSchedule.menuPrice);
    const bomRatePercent = Number(scheduleRuleForm.bomRatePercent || selectedSchedule.bomRatePercent);
    if (!Number.isFinite(menuPrice) || menuPrice < 0) {
      setContractFeedback({ type: 'error', message: 'Đơn giá menu không hợp lệ.' });
      return;
    }
    if (!Number.isFinite(bomRatePercent) || bomRatePercent <= 0 || bomRatePercent > 300) {
      setContractFeedback({ type: 'error', message: 'Tỷ lệ BOM phải trong khoảng 0-300%.' });
      return;
    }

    const body: UpdateMenuScheduleRulesRequest = {
      menuPrice,
      bomRatePercent,
      status: scheduleRuleForm.status,
      reason: scheduleRuleForm.reason.trim() || undefined,
    };

    try {
      await updateMenuScheduleRules({ menuScheduleId: selectedSchedule.menuScheduleId, body }).unwrap();
      setContractFeedback({ type: 'success', message: 'Đã lưu quy tắc suất ăn cho ca/ngày.' });
    } catch (error) {
      setContractFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa lưu được quy tắc suất ăn.') });
    }
  };

  const handleUpdateScheduleVersion = async (status: string) => {
    if (!selectedSchedule) {
      setContractFeedback({ type: 'error', message: 'Chưa chọn lịch thực đơn để cập nhật version.' });
      return;
    }

    const body: UpdateMenuScheduleVersionRequest = {
      status,
      reason: scheduleRuleForm.reason.trim() || undefined,
    };

    try {
      await updateMenuScheduleVersion({ menuScheduleId: selectedSchedule.menuScheduleId, body }).unwrap();
      setScheduleRuleForm((prev) => ({ ...prev, status }));
      setContractFeedback({ type: 'success', message: `Đã chuyển version thực đơn sang ${status}.` });
    } catch (error) {
      setContractFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa cập nhật được version thực đơn.') });
    }
  };

  const resetEmployeeForm = () => {
    setEditingEmployeeId(null);
    setEmployeeForm(defaultEmployeeForm);
  };

  const handleDataQualityRemediation = async (issue: DataQualityIssueRow, action: 'resolve' | 'reopen') => {
    try {
      await updateDataQualityIssueRemediation({
        issueId: issue.id,
        action,
        note: action === 'resolve'
          ? 'Đánh dấu đã xử lý từ màn Quản trị dữ liệu.'
          : 'Mở lại issue từ màn Quản trị dữ liệu.',
      }).unwrap();
      setDataQualityFeedback({
        type: 'success',
        message: action === 'resolve'
          ? 'Đã đánh dấu issue là resolved. Nếu lỗi gốc vẫn còn, issue vẫn nằm trong bảng để xử tiếp.'
          : 'Đã mở lại issue để tiếp tục xử lý.',
      });
    } catch (error) {
      setDataQualityFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa cập nhật được trạng thái data-quality issue.') });
    }
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

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button className="ipc-button ipc-button-primary" type="button" onClick={() => setActiveView('bom-import')}>
                <PackageCheck size={16} />
                BOM theo đơn giá
              </button>
              <button className="ipc-button ipc-button-ghost" type="button">
                <Bell size={16} />
                Gửi thông báo vận hành
              </button>
              {canManageEmployees && (
                <button className="ipc-button ipc-button-ghost" type="button" onClick={() => setActiveView('employees')}>
                  <Users size={16} />
                  Nhân viên
                </button>
              )}
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
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Thiếu nguyên liệu', value: shortageRows.length.toString(), tone: shortageRows.length ? 'danger' : 'success' },
            { label: 'Dữ liệu lỗi', value: `${dataQualityReport?.totalIssues ?? 0} mục`, tone: dataQualityErrors.length ? 'danger' : dataQualityIssues.length ? 'warning' : 'success' },
            { label: 'Cảnh báo giá', value: priceWarnings.length.toString(), tone: priceWarnings.length ? 'danger' : 'success' },
            { label: 'Tồn kho', value: `${currentStockRows.length} dòng`, tone: 'neutral' },
            { label: 'Audit', value: `${displayLogs.length} thay đổi`, tone: 'neutral' },
            ...(canManageEmployees ? [{ label: 'Nhân viên', value: `${employeeMeta?.totalCount ?? 0} tài khoản`, tone: 'info' as const }] : []),
          ]}
        />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn quản trị dữ liệu"
        tabs={adminTabs}
        activeTab={`admin-${effectiveActiveView}`}
        onTabChange={(id) => setActiveView(id.replace('admin-', '') as AdminView)}
      />

      {effectiveActiveView === 'bom-import' && (
        <div id="admin-bom-import-panel" role="tabpanel" aria-labelledby="admin-bom-import-tab" className="flex flex-col gap-4">
          <SectionPanel title="Import BOM theo đơn giá" icon={<Upload size={18} />}>
            <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
              <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <FieldRow label="Đơn giá BOM">
                  <div className="grid grid-cols-3 gap-2">
                    {[25000, 30000, 34000].map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        className={`ipc-button ${bomImportTier === tier ? 'ipc-button-primary' : 'ipc-button-ghost'}`}
                        onClick={() => {
                          setBomImportTier(tier);
                          setBomImportPreview(null);
                        }}
                      >
                        {(tier / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>
                </FieldRow>

                <FieldRow label="Khách hàng">
                  <select
                    className="ipc-select w-full"
                    value={bomImportCustomerId}
                    onChange={(event) => {
                      setBomImportCustomerId(event.target.value);
                      setBomImportPreview(null);
                    }}
                  >
                    <option value="">BOM global</option>
                    {customerContracts.map((contract) => (
                      <option key={contract.customerId} value={contract.customerId}>
                        {contract.customerCode} - {contract.customerName}
                      </option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Hiệu lực từ">
                  <input
                    className="ipc-input w-full"
                    type="date"
                    value={bomImportEffectiveFrom}
                    onChange={(event) => setBomImportEffectiveFrom(event.target.value)}
                  />
                </FieldRow>

                <FieldRow label="File import">
                  <input
                    className="ipc-input w-full"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => {
                      setBomImportFile(event.target.files?.[0] ?? null);
                      setBomImportPreview(null);
                    }}
                  />
                </FieldRow>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    className="ipc-button ipc-button-ghost"
                    type="button"
                    disabled={downloadBomTemplateState.isLoading}
                    onClick={() => void handleDownloadBomTemplate()}
                  >
                    <Download size={15} />
                    Tải mẫu
                  </button>
                  <button
                    className="ipc-button ipc-button-primary"
                    type="button"
                    disabled={previewBomImportState.isLoading || !bomImportFile}
                    onClick={() => void handlePreviewBomImport()}
                  >
                    <Search size={15} />
                    Preview
                  </button>
                  <button
                    className="ipc-button ipc-button-primary"
                    type="button"
                    disabled={commitBomImportState.isLoading || !bomImportPreview?.canCommit}
                    onClick={() => void handleCommitBomImport()}
                  >
                    <Save size={15} />
                    Commit
                  </button>
                </div>

                {bomImportFeedback && (
                  <InlineAlert title={bomImportFeedback.type === 'success' ? 'BOM import' : 'Cần kiểm tra'} variant={bomImportFeedback.type === 'success' ? 'info' : 'danger'}>
                    {bomImportFeedback.message}
                  </InlineAlert>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <ContextStrip
                  items={[
                    { label: 'Tier', value: `${(bomImportTier / 1000).toFixed(0)}k`, tone: 'info' },
                    { label: 'Scope', value: bomImportCustomerId ? 'Customer override' : 'Global', tone: bomImportCustomerId ? 'warning' : 'neutral' },
                    { label: 'Dòng hợp lệ', value: `${bomImportPreview?.validRows ?? 0}/${bomImportPreview?.totalRows ?? 0}`, tone: bomImportPreview?.errorRows ? 'danger' : bomImportPreview ? 'success' : 'neutral' },
                    { label: 'Lỗi', value: String(bomImportPreview?.errorRows ?? 0), tone: bomImportPreview?.errorRows ? 'danger' : 'success' },
                  ]}
                />

                <PaginatedTableFrame ariaLabel="Preview import BOM theo đơn giá">
                  <table className="ipc-data-table">
                    <thead>
                      <tr>
                        <th>Dòng</th>
                        <th>Món</th>
                        <th>Nguyên liệu</th>
                        <th>ĐVT</th>
                        <th>Qty/suất</th>
                        <th>Hao hụt</th>
                        <th>Action</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomPreviewPagination.rows.map((row) => (
                        <tr key={`${row.rowNumber}-${row.dishCode}-${row.ingredientCode}`}>
                          <td>{row.rowNumber}</td>
                          <td>
                            <div className="font-semibold text-slate-900">{row.dishName || row.dishCode}</div>
                            <div className="text-xs text-slate-500">{row.dishCode}</div>
                          </td>
                          <td>
                            <div className="font-semibold text-slate-900">{row.ingredientName || row.ingredientCode}</div>
                            <div className="text-xs text-slate-500">{row.ingredientCode}</div>
                          </td>
                          <td>{row.unitCode}</td>
                          <td>{row.grossQtyPerServing}</td>
                          <td>{row.wasteRatePercent}%</td>
                          <td>{row.action}</td>
                          <td>
                            <StatusBadge variant={row.status === 'error' ? 'danger' : row.status === 'warning' ? 'warning' : 'success'}>
                              {row.errors[0] ?? row.warnings[0] ?? 'Hợp lệ'}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                      {(!bomImportPreview || bomImportPreview.rows.length === 0) && <EmptyRow colSpan={8} />}
                    </tbody>
                  </table>
                </PaginatedTableFrame>
                <PaginationBar page={bomPreviewPagination.page} pageSize={bomPreviewPagination.pageSize} totalItems={bomPreviewPagination.totalItems} onPageChange={bomPreviewPagination.setPage} />
              </div>
            </div>
          </SectionPanel>
        </div>
      )}

      {effectiveActiveView === 'contracts' && (
        <div id="admin-contracts-panel" role="tabpanel" aria-labelledby="admin-contracts-tab" className="flex flex-col gap-4">
          <SectionPanel title="Customer contract và quy tắc suất ăn" icon={<CalendarCheck size={18} />}>
            <ContextStrip
              items={[
                { label: 'Khách hàng', value: customerContracts.length.toString(), tone: 'neutral' },
                { label: 'Đang dùng', value: customerContracts.filter((item) => item.isActive).length.toString(), tone: 'success' },
                { label: 'Ca phục vụ', value: selectedContract?.shiftNames.join(', ') || '-', tone: 'info' },
                { label: 'BOM mặc định', value: selectedContract?.defaultBomRatePercent != null ? `${selectedContract.defaultBomRatePercent}%` : '-', tone: 'neutral' },
                { label: 'Lịch version', value: menuSchedules.length.toString(), tone: 'neutral' },
              ]}
            />

            {contractFeedback && (
              <div
                className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium ${
                  contractFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {contractFeedback.message}
              </div>
            )}

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)]">
              <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-customer">
                  Khách hàng
                </label>
                <select
                  id="admin-contract-customer"
                  className="ipc-select"
                  value={isCreatingContract ? '' : selectedContract?.customerId ?? ''}
                  onChange={(event) => {
                    const contract = customerContracts.find((item) => item.customerId === event.target.value);
                    setIsCreatingContract(false);
                    setSelectedContractCustomerId(event.target.value);
                    setSelectedScheduleId('');
                    loadContractForm(contract);
                    loadScheduleRuleForm(undefined);
                  }}
                >
                  <option value="" disabled>
                    {isCreatingContract ? 'Đang tạo khách hàng mới' : 'Chọn khách hàng'}
                  </option>
                  {customerContracts.map((customer) => (
                    <option key={customer.customerId} value={customer.customerId}>
                      {customer.customerCode} - {customer.customerName}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button className="ipc-button ipc-button-ghost justify-center" type="button" onClick={() => loadContractForm(selectedContract)}>
                    <Pencil size={15} />
                    Nạp
                  </button>
                  <button className="ipc-button ipc-button-ghost justify-center" type="button" onClick={startNewContract}>
                    <PlusCircle size={15} />
                    Tạo mới
                  </button>
                </div>

                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-code">
                  Mã khách hàng
                </label>
                <input
                  id="admin-contract-code"
                  className="ipc-input"
                  value={contractForm.customerCode}
                  disabled={!isCreatingContract}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, customerCode: event.target.value.toUpperCase() }))}
                  placeholder={isCreatingContract ? 'VD: DAV' : selectedContract?.customerCode ?? 'Mã khách hàng'}
                />

                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-name">
                  Tên khách hàng
                </label>
                <input
                  id="admin-contract-name"
                  className="ipc-input"
                  value={contractForm.customerName}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, customerName: event.target.value }))}
                  placeholder={selectedContract?.customerName ?? 'Tên khách hàng'}
                />

                <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-contract-note">
                  Ghi chú contract
                </label>
                <textarea
                  id="admin-contract-note"
                  className="ipc-input min-h-[86px]"
                  value={contractForm.note}
                  onChange={(event) => setContractForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={selectedContract?.note ?? 'Ca phục vụ, ngày làm việc, ràng buộc menu'}
                />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-effective-from">
                    Hiệu lực từ
                    <input
                      id="admin-contract-effective-from"
                      className="ipc-input"
                      type="date"
                      value={contractForm.effectiveFrom}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-effective-to">
                    Hiệu lực đến
                    <input
                      id="admin-contract-effective-to"
                      className="ipc-input"
                      type="date"
                      value={contractForm.effectiveTo}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-week-days">
                    Ngày làm việc
                    <input
                      id="admin-contract-week-days"
                      className="ipc-input"
                      value={contractForm.activeWeekDays}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, activeWeekDays: event.target.value }))}
                      placeholder="t2,t3,t4,t5,t6,t7"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-shifts">
                    Ca phục vụ
                    <input
                      id="admin-contract-shifts"
                      className="ipc-input"
                      value={contractForm.shiftNames}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, shiftNames: event.target.value }))}
                      placeholder="MORNING,AFTERNOON"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-default-price">
                    Đơn giá mặc định
                    <input
                      id="admin-contract-default-price"
                      className="ipc-input"
                      type="number"
                      min="0"
                      step="1000"
                      value={contractForm.defaultMenuPrice}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, defaultMenuPrice: event.target.value }))}
                      placeholder={selectedContract?.defaultMenuPrice?.toString() ?? '25000'}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-default-bom-rate">
                    BOM mặc định (%)
                    <input
                      id="admin-contract-default-bom-rate"
                      className="ipc-input"
                      type="number"
                      min="1"
                      max="300"
                      step="1"
                      value={contractForm.defaultBomRatePercent}
                      onChange={(event) => setContractForm((prev) => ({ ...prev, defaultBomRatePercent: event.target.value }))}
                      placeholder={selectedContract?.defaultBomRatePercent?.toString() ?? '100'}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={contractForm.isActive}
                    onChange={(event) => setContractForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Khách hàng đang hoạt động
                </label>

                <button className="ipc-button ipc-button-primary justify-center" type="button" disabled={isSavingContract || (!isCreatingContract && !selectedContract)} onClick={() => void handleSaveCustomerContract()}>
                  <Save size={15} />
                  {isCreatingContract ? 'Tạo contract' : 'Lưu contract'}
                </button>
              </div>

              <div className="grid gap-4">
                <TableViewport caption="Danh sách contract khách hàng" ariaLabel="Bảng contract khách hàng">
                  <table className="ipc-data-table text-sm">
                    <thead>
                      <tr>
                        <th>Khách hàng</th>
                        <th>Ngày làm việc</th>
                        <th>Ca</th>
                        <th>Hiệu lực</th>
                        <th>Đơn giá TB</th>
                        <th>BOM TB</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerContracts.length === 0 ? <EmptyRow colSpan={7} /> : customerContracts.map((contract) => (
                        <tr key={contract.customerId}>
                          <td>
                            <div className="font-semibold text-slate-900">{contract.customerCode}</div>
                            <div className="text-xs text-slate-500">{contract.customerName}</div>
                          </td>
                          <td>{contract.activeWeekDays.join(', ') || '-'}</td>
                          <td>{contract.shiftNames.join(', ') || '-'}</td>
                          <td>
                            <div>{contract.effectiveFrom ?? '-'}</div>
                            <div className="text-xs text-slate-500">{contract.effectiveTo ? `đến ${contract.effectiveTo}` : contract.contractStatus}</div>
                          </td>
                          <td className="ipc-numeric-cell">{contract.defaultMenuPrice?.toLocaleString('vi-VN') ?? '-'}</td>
                          <td className="ipc-numeric-cell">{contract.defaultBomRatePercent != null ? `${contract.defaultBomRatePercent}%` : '-'}</td>
                          <td>
                            <StatusBadge variant={contract.isActive ? 'success' : 'warning'}>
                              {contract.isActive ? 'Đang dùng' : 'Đã khóa'}
                            </StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableViewport>

                <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(110px,0.5fr))]">
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600" htmlFor="admin-contract-schedule">
                      Lịch thực đơn
                      <select
                        id="admin-contract-schedule"
                        className="ipc-select"
                        value={selectedSchedule?.menuScheduleId ?? ''}
                        onChange={(event) => {
                          const schedule = menuSchedules.find((item) => item.menuScheduleId === event.target.value);
                          setSelectedScheduleId(event.target.value);
                          loadScheduleRuleForm(schedule);
                        }}
                      >
                        {menuSchedules.map((schedule) => (
                          <option key={schedule.menuScheduleId} value={schedule.menuScheduleId}>
                            {schedule.serviceDate} / {schedule.shift} / {schedule.menuName}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] font-medium text-slate-500">
                        {selectedSchedule?.sourceImportBatch
                          ? `Batch ${selectedSchedule.sourceImportBatch} / V${selectedSchedule.menuVersionNo ?? '-'} / ${selectedSchedule.menuVersionStatus ?? selectedSchedule.status}`
                          : `Version ${selectedSchedule?.status ?? '-'}`}
                      </span>
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Đơn giá
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        value={scheduleRuleForm.menuPrice}
                        onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, menuPrice: event.target.value }))}
                        placeholder={selectedSchedule?.menuPrice.toString() ?? '0'}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      BOM %
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        type="number"
                        min="1"
                        max="300"
                        value={scheduleRuleForm.bomRatePercent}
                        onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, bomRatePercent: event.target.value }))}
                        placeholder={selectedSchedule?.bomRatePercent.toString() ?? '100'}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Version
                      <select
                        className="ipc-select"
                        value={scheduleRuleForm.status}
                        onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, status: event.target.value }))}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUPERSEDED">SUPERSEDED</option>
                        <option value="LOCKED">LOCKED</option>
                      </select>
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                    Lý do
                    <input
                      className="ipc-input"
                      value={scheduleRuleForm.reason}
                      onChange={(event) => setScheduleRuleForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Cập nhật contract/version"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button className="ipc-button ipc-button-primary" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleSaveScheduleRules()}>
                      <Save size={15} />
                      Lưu quy tắc
                    </button>
                    <button className="ipc-button ipc-button-ghost" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleUpdateScheduleVersion('ACTIVE')}>
                      Publish
                    </button>
                    <button className="ipc-button ipc-button-ghost" type="button" disabled={isSavingContract || !selectedSchedule} onClick={() => void handleUpdateScheduleVersion('SUPERSEDED')}>
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </SectionPanel>
        </div>
      )}

      {effectiveActiveView === 'cleanup' && (
        <div id="admin-cleanup-panel" role="tabpanel" aria-labelledby="admin-cleanup-tab" className="flex flex-col gap-4">
          <SectionPanel title="Kiểm tra dữ liệu lỗi" icon={<XCircle size={18} />}>
            <ContextStrip
              items={[
                { label: 'Tổng lỗi', value: `${dataQualityReport?.totalIssues ?? 0}`, tone: dataQualityErrors.length ? 'danger' : dataQualityIssues.length ? 'warning' : 'success' },
                { label: 'Thiếu BOM', value: `${dataQualityReport?.missingBomCount ?? 0}`, tone: (dataQualityReport?.missingBomCount ?? 0) ? 'danger' : 'success' },
                { label: 'Unit/quy đổi', value: `${(dataQualityReport?.invalidUnitCount ?? 0) + (dataQualityReport?.missingConversionCount ?? 0)}`, tone: ((dataQualityReport?.invalidUnitCount ?? 0) + (dataQualityReport?.missingConversionCount ?? 0)) ? 'danger' : 'success' },
                { label: 'Tồn âm', value: `${dataQualityReport?.negativeStockCount ?? 0}`, tone: (dataQualityReport?.negativeStockCount ?? 0) ? 'danger' : 'success' },
                { label: 'Phiếu orphan', value: `${dataQualityReport?.orphanDocumentCount ?? 0}`, tone: (dataQualityReport?.orphanDocumentCount ?? 0) ? 'warning' : 'success' },
                { label: 'SLA gấp', value: `${dataQualityReport?.urgentIssueCount ?? 0}`, tone: (dataQualityReport?.urgentIssueCount ?? 0) ? 'danger' : 'success' },
                { label: 'Resolved còn lỗi', value: `${dataQualityReport?.resolvedIssueCount ?? 0}`, tone: (dataQualityReport?.resolvedIssueCount ?? 0) ? 'warning' : 'success' },
              ]}
            />

            {dataQualityFeedback && (
              <InlineAlert title={dataQualityFeedback.type === 'success' ? 'Đã cập nhật data-quality issue' : 'Chưa cập nhật được issue'} variant={dataQualityFeedback.type === 'success' ? 'info' : 'danger'}>
                {dataQualityFeedback.message}
              </InlineAlert>
            )}

            <PaginatedTableFrame ariaLabel="Bảng vấn đề dữ liệu cần xử lý" className="mt-4">
              <table className="ipc-data-table ipc-admin-quality-table text-sm">
                <thead>
                  <tr>
                    <th>Nhóm lỗi</th>
                    <th>Mức</th>
                    <th>SLA</th>
                    <th>Trạng thái xử lý</th>
                    <th>Owner</th>
                    <th>Đối tượng</th>
                    <th className="text-left">Mô tả</th>
                    <th className="text-left">Cách xử lý</th>
                    <th>Đi tới</th>
                    <th>Resolve</th>
                  </tr>
                </thead>
                <tbody>
                  {qualityPagination.rows.length === 0 ? <EmptyRow colSpan={10} /> : qualityPagination.rows.map((issue, index) => (
                    <tr key={`${issue.id}-${index}`}>
                      <td className="font-semibold">{issue.category}</td>
                      <td>
                        <StatusBadge variant={issue.severity === 'error' ? 'danger' : 'warning'}>
                          {issue.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{issue.slaLabel}</div>
                        <div className="text-xs text-slate-500">Priority {issue.priorityRank}</div>
                      </td>
                      <td>
                        <StatusBadge variant={issue.remediationStatus === 'resolved' ? 'warning' : issue.remediationStatus === 'reopened' ? 'danger' : 'neutral'}>
                          {issue.remediationStatus === 'resolved' ? 'Resolved còn lỗi' : issue.remediationStatus === 'reopened' ? 'Reopened' : 'Open'}
                        </StatusBadge>
                        {issue.remediationAt && (
                          <div className="text-xs text-slate-500">
                            {new Date(issue.remediationAt).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td>{issue.owner}</td>
                      <td>
                        <div className="font-semibold text-slate-900">{issue.entityCode}</div>
                        <div className="text-xs text-slate-500">{issue.entityName} / {issue.entityLabel}</div>
                      </td>
                      <td className="ipc-quality-description-cell text-left text-slate-700">{issue.message}</td>
                      <td className="ipc-quality-action-guidance-cell text-left text-slate-600">{issue.suggestedAction}</td>
                      <td className="ipc-row-action-cell">
                        <Link
                          className="ipc-button ipc-button-ghost ipc-button-bounded ipc-table-action-control"
                          to={issue.category === 'missing_bom' ? `${ROUTES.ADMIN_DATA}?view=bom-import` : issue.route || ROUTES.ADMIN_DATA}
                          onClick={() => {
                            if (issue.category === 'missing_bom' && issue.entityId) {
                              setActiveView('bom-import');
                            }
                          }}
                        >
                          Sửa
                        </Link>
                      </td>
                      <td className="ipc-row-action-cell">
                        <button
                          className="ipc-button ipc-button-ghost ipc-button-bounded ipc-table-action-control"
                          type="button"
                          disabled={updateDataQualityIssueRemediationState.isLoading}
                          onClick={() => void handleDataQualityRemediation(issue, issue.remediationStatus === 'resolved' ? 'reopen' : 'resolve')}
                        >
                          {issue.remediationStatus === 'resolved' ? 'Reopen' : 'Resolve'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PaginatedTableFrame>
            <PaginationBar page={qualityPagination.page} pageSize={qualityPagination.pageSize} totalItems={qualityPagination.totalItems} onPageChange={qualityPagination.setPage} />
          </SectionPanel>
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
            <TableViewport caption="Chỉ số thống kê vận hành cho Admin" ariaLabel="Bảng chỉ số thống kê vận hành">
              <table className="ipc-data-table ipc-status-action-table">
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
                    <td className="font-semibold">Workflow thất bại</td>
                    <td className="ipc-numeric-cell">{operationalKpis?.failedWorkflowCount ?? 0} bản ghi</td>
                    <td className="text-left">Import, nhu cầu hoặc mua hàng đang ở trạng thái FAILED/IMPORT_FAILED.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={(operationalKpis?.failedWorkflowCount ?? 0) ? 'danger' : 'success'}>
                        {(operationalKpis?.failedWorkflowCount ?? 0) ? 'Cần điều tra' : 'Ổn định'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Data quality critical</td>
                    <td className="ipc-numeric-cell">{operationalKpis?.criticalDataQualityCount ?? 0} lỗi</td>
                    <td className="text-left">Issue mức error cần xử lý trước khi tiếp tục luồng production.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={(operationalKpis?.criticalDataQualityCount ?? 0) ? 'danger' : 'success'}>
                        {(operationalKpis?.criticalDataQualityCount ?? 0) ? 'Đang chặn' : 'Đạt'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={`${ROUTES.ADMIN_DATA}?view=cleanup`}>Mở data quality</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Approval chờ lâu</td>
                    <td className="ipc-numeric-cell">{operationalKpis?.overdueApprovalCount ?? 0} phiếu</td>
                    <td className="text-left">Phiếu chưa có quyết định sau 24 giờ hoặc đã qua ngày yêu cầu.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={(operationalKpis?.overdueApprovalCount ?? 0) ? 'warning' : 'success'}>
                        {(operationalKpis?.overdueApprovalCount ?? 0) ? 'Quá SLA' : 'Trong SLA'}
                      </StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.APPROVALS}>Mở phê duyệt</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Nhu cầu nguyên liệu</td>
                    <td className="ipc-numeric-cell">{shortageRows.length} dòng thiếu</td>
                    <td className="text-left">Tổng hợp sau bước hệ thống tính nhu cầu trước khi kiểm tồn.</td>
                    <td className="ipc-badge-cell">
                      <StatusBadge variant={shortageRows.length ? 'danger' : 'success'}>{shortageRows.length ? 'Cần xử lý' : 'Đủ tồn'}</StatusBadge>
                    </td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Mở mua thêm</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Mua hàng</td>
                    <td className="ipc-numeric-cell">{totalPurchaseQty.toLocaleString('vi-VN')} đơn vị</td>
                    <td className="text-left">Kế hoạch thu mua dự kiến theo ngày từ demand, tồn kho và pending receipt.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={totalPurchaseQty > 0 ? 'warning' : 'success'}>{totalPurchaseQty > 0 ? 'Có phát sinh' : 'Không phát sinh'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.PURCHASING}>Theo dõi thu mua</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Xuất bếp</td>
                    <td className="ipc-numeric-cell">{totalIssuedQty.toLocaleString('vi-VN')} đơn vị</td>
                    <td className="text-left">Theo phiếu xuất kho cho bếp, phục vụ kiểm tra luồng thủ kho.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={kitchenIssueRows.length ? 'neutral' : 'warning'}>{kitchenIssueRows.length ? 'Đã ghi nhận' : 'Chưa có phiếu'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.WAREHOUSE}>Mở kho</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Sử dụng thực tế</td>
                    <td className="ipc-numeric-cell">{totalUsedQty.toLocaleString('vi-VN')} dùng / {totalReturnedQty.toLocaleString('vi-VN')} hoàn</td>
                    <td className="text-left">Ghép xuất kho và hoàn kho để tránh tách trùng bước kiểm nguyên liệu dư.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={usageRows.length ? 'success' : 'neutral'}>{usageRows.length ? 'Có đối chiếu' : 'Chưa có dữ liệu'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.CHEF_DASHBOARD}>Mở bếp trưởng</Link></td>
                  </tr>
                  <tr>
                    <td className="font-semibold">Biến động giá</td>
                    <td className="ipc-numeric-cell">{priceWarnings.length} cảnh báo</td>
                    <td className="text-left">So giá nhập từ phiếu nhập với giá tham chiếu để admin theo dõi rủi ro.</td>
                    <td className="ipc-badge-cell"><StatusBadge variant={priceWarnings.length ? 'danger' : 'success'}>{priceWarnings.length ? 'Vượt ngưỡng' : 'Ổn định'}</StatusBadge></td>
                    <td><Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={ROUTES.REPORTS}>Mở báo cáo</Link></td>
                  </tr>
                </tbody>
              </table>
            </TableViewport>
          </SectionPanel>

          <SectionPanel title="Theo dõi tồn kho và xuất bếp" icon={<PackageCheck size={18} />}>
            <PaginatedTableFrame ariaLabel="Bảng tồn kho ưu tiên">
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
                  {currentStockPagination.rows.length === 0 ? <EmptyRow colSpan={4} /> : currentStockPagination.rows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td>{row.warehouse}</td>
                      <td>{row.ingredient}</td>
                      <td className="ipc-numeric-cell">{row.currentQty} {row.unit}</td>
                      <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PaginatedTableFrame>
            <PaginationBar page={currentStockPagination.page} pageSize={currentStockPagination.pageSize} totalItems={currentStockPagination.totalItems} onPageChange={currentStockPagination.setPage} />
          </SectionPanel>

          <SectionPanel title="Cảnh báo cần admin theo dõi" icon={<TrendingUp size={18} />}>
            <PaginatedTableFrame ariaLabel="Bảng cảnh báo biến động giá">
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
                  {priceWarningPagination.rows.length === 0 ? <EmptyRow colSpan={5} /> : priceWarningPagination.rows.map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
                      <td>{row.name}</td>
                      <td>{row.supplier}</td>
                      <td className="ipc-numeric-cell">{row.pricePrev.toLocaleString('vi-VN')} đ</td>
                      <td className="ipc-numeric-cell">{row.priceCurrent.toLocaleString('vi-VN')} đ</td>
                      <td className="ipc-numeric-cell font-bold text-[var(--ipc-danger)]">+{row.change.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PaginatedTableFrame>
            <PaginationBar page={priceWarningPagination.page} pageSize={priceWarningPagination.pageSize} totalItems={priceWarningPagination.totalItems} onPageChange={priceWarningPagination.setPage} />
          </SectionPanel>
        </div>
      )}

      {canManageEmployees && effectiveActiveView === 'employees' && (
        <div id="admin-employees-panel" role="tabpanel" aria-labelledby="admin-employees-tab" className="flex flex-col gap-4">
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
                            <td className="text-slate-500">{new Date(employee.createdAt).toLocaleDateString('vi-VN')}</td>
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
                    page={employeeMeta.pageNumber}
                    pageSize={employeeMeta.pageSize}
                    totalItems={employeeMeta.totalCount}
                    onPageChange={setEmployeePage}
                  />
                )}
              </div>
            </SectionPanel>
          </div>
        </div>
      )}

      {effectiveActiveView === 'audit' && (
        <SectionPanel title="Nhật ký thay đổi hệ thống (Audit Trail)" icon={<History size={18} />}>
          <div id="admin-audit-panel" role="tabpanel" aria-labelledby="admin-audit-tab" className="flex flex-col gap-4">
            
            {/* Bộ lọc Audit log */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Người thực hiện</label>
                <input
                  type="text"
                  value={auditActor}
                  onChange={(e) => { setAuditActor(e.target.value); setAuditCursors([]); }}
                  placeholder="Họ tên / tài khoản..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-48 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mảng nghiệp vụ</label>
                <select
                  value={auditArea}
                  onChange={(e) => { setAuditArea(e.target.value); setAuditCursors([]); }}
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-40 bg-white focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  <option value="Signoff">Hoàn thành ca</option>
                  <option value="Coordination">Điều phối</option>
                  <option value="MaterialRequest">Yêu cầu nguyên liệu</option>
                  <option value="PurchaseRequest">Đề xuất mua hàng</option>
                  <option value="InventoryReceipt">Nhập kho</option>
                  <option value="InventoryIssue">Xuất kho</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên bảng/Thực thể</label>
                <input
                  type="text"
                  value={auditEntity}
                  onChange={(e) => { setAuditEntity(e.target.value); setAuditCursors([]); }}
                  placeholder="Ví dụ: Mealquantityplan..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-44 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên cột/Trường</label>
                <input
                  type="text"
                  value={auditField}
                  onChange={(e) => { setAuditField(e.target.value); setAuditCursors([]); }}
                  placeholder="Ví dụ: Status..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-40 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 items-end h-8 mt-4 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setAuditActor('');
                    setAuditArea('');
                    setAuditEntity('');
                    setAuditField('');
                    setAuditCursors([]);
                  }}
                  className="ipc-button ipc-button-ghost py-1 px-3 text-xs"
                >
                  Xóa bộ lọc
                </button>
                <button
                  type="button"
                  onClick={handleExportAuditCsv}
                  className="ipc-button ipc-button-primary py-1 px-3 text-xs bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 border-0"
                >
                  Xuất CSV
                </button>
              </div>
            </div>

            <PaginatedTableFrame ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell">
              <table className="ipc-data-table ipc-admin-audit-table text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Thời gian</th>
                    <th>Người thực hiện</th>
                    <th>Mảng nghiệp vụ</th>
                    <th>Đối tượng/Trường ảnh hưởng</th>
                    <th>Giá trị cũ</th>
                    <th>Giá trị mới</th>
                    <th className="text-left">Lý do thay đổi</th>
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="font-mono text-slate-500 text-left">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')} {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="font-semibold text-slate-800">{log.actor}</td>
                      <td>{log.businessArea}</td>
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
            </PaginatedTableFrame>
            <CursorPaginationBar
              page={auditCursors.length + 1}
              hasNext={auditResult.data?.hasNext ?? false}
              onPrevious={() => setAuditCursors((current) => current.slice(0, -1))}
              onNext={() => {
                const nextCursorDate = auditResult.data?.nextCursorDate;
                if (nextCursorDate) {
                  setAuditCursors((current) => [...current, { cursorDate: nextCursorDate, cursorId: auditResult.data?.nextCursorId }]);
                }
              }}
              ariaLabel="Phân trang nhật ký thay đổi"
            />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
