import { useMemo, useState, type FormEvent } from 'react';
import { BarChart3, Bell, CalendarCheck, Database, History, PackageCheck, Pencil, PlusCircle, Power, Save, Search, SlidersHorizontal, TrendingUp, UserPlus, Users, XCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import {
  ApprovalQueue,
  CommandBar,
  ContextStrip,
  DocumentRail,
  FieldRow,
  InlineAlert,
  OperationalFrame,
  RoleInbox,
  PaginationBar,
  SectionPanel,
  SplitWorkbench,
  StatusBadge,
  StockMovementTable,
  DataTableShell,
  ViewSwitcher,
  type ViewTab,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import { selectCurrentUser } from '@/features/auth';
import {
  useGetApprovalRecordsQuery,
  useGetAuditChangesQuery,
  useGetCurrentStockQuery,
  useGetDataQualityQuery,
  useGenerateMaterialDemandMutation,
  useGetIngredientDemandQuery,
  useGetIssueVsReturnUsageQuery,
  useGetKitchenIssuesQuery,
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useUpdateDataQualityIssueRemediationMutation,
  useWorkflowOverview,
  type DataQualityIssueRow,
} from '@/features/workflow';
import {
  useAddDishBomLineMutation,
  useCloseDishBomLineMutation,
  useCreateDishMutation,
  useDeactivateDishMutation,
  useGetAdminDishCatalogQuery,
  useGetIngredientsQuery,
  useUpdateDishMutation,
  useUpdateDishBomLineMutation,
  type CatalogIngredient,
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

type AdminView = 'adjustments' | 'contracts' | 'cleanup' | 'inventory' | 'audit' | 'statistics' | 'employees';

type BomFormState = {
  ingredientId: string;
  unitId: string;
  grossQtyPerServing: string;
  wasteRatePercent: string;
  bomStatus: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

type DishFormState = {
  dishCode: string;
  dishName: string;
  dishType: string;
  dishGroup: string;
  isActive: boolean;
};

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

const defaultDishForm: DishFormState = {
  dishCode: '',
  dishName: '',
  dishType: '',
  dishGroup: '',
  isActive: true,
};

const bomStatusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const getBomStatusBadgeVariant = (status: string): 'neutral' | 'success' | 'warning' => {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'neutral';
  return 'warning';
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
  value === 'adjustments' ||
  value === 'contracts' ||
  value === 'cleanup' ||
  value === 'inventory' ||
  value === 'audit' ||
  value === 'statistics' ||
  value === 'employees';

const getDemandScope = (value: string | null): 'FULLDAY' | 'MORNING' | 'AFTERNOON' => {
  const normalized = (value ?? '').trim().toUpperCase();
  if (normalized === 'MORNING' || normalized === 'AFTERNOON') return normalized;
  return 'FULLDAY';
};

export default function AdminDataPage() {
  const currentUser = useAppSelector(selectCurrentUser);
  const [searchParams] = useSearchParams();
  const canManageEmployees = currentUser?.role === 'admin' || currentUser?.isAdminFullAccess;
  const initialView = isAdminView(searchParams.get('view')) && (searchParams.get('view') !== 'employees' || canManageEmployees)
    ? searchParams.get('view') as AdminView
    : 'adjustments';
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const [auditPage, setAuditPage] = useState(1);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(defaultEmployeeForm);
  const [employeeNotice, setEmployeeNotice] = useState<string | null>(null);
  const [selectedDishId, setSelectedDishId] = useState(searchParams.get('dishId') ?? '');
  const [editingDishId, setEditingDishId] = useState<string | null>(null);
  const [dishForm, setDishForm] = useState<DishFormState>(defaultDishForm);
  const [selectedContractCustomerId, setSelectedContractCustomerId] = useState('');
  const [isCreatingContract, setIsCreatingContract] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [contractForm, setContractForm] = useState<ContractFormState>(defaultContractForm);
  const [scheduleRuleForm, setScheduleRuleForm] = useState<ScheduleRuleFormState>(defaultScheduleRuleForm);
  const [contractFeedback, setContractFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dataQualityFeedback, setDataQualityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [bomForm, setBomForm] = useState<BomFormState>({
    ingredientId: '',
    unitId: '',
    grossQtyPerServing: '',
    wasteRatePercent: '0',
    bomStatus: 'PUBLISHED',
    effectiveFrom: getTodayInputValue(),
    effectiveTo: '',
    reason: '',
  });
  const [dishFeedback, setDishFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [bomFeedback, setBomFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const auditPageSize = 8;
  const { data: catalogDishes = [], isLoading: isCatalogLoading } = useGetAdminDishCatalogQuery();
  const { data: ingredientLookup = [] } = useGetIngredientsQuery();
  const [createDish, createDishState] = useCreateDishMutation();
  const [updateDish, updateDishState] = useUpdateDishMutation();
  const [deactivateDish, deactivateDishState] = useDeactivateDishMutation();
  const [addDishBomLine, addDishBomLineState] = useAddDishBomLineMutation();
  const [updateDishBomLine, updateDishBomLineState] = useUpdateDishBomLineMutation();
  const [closeDishBomLine, closeDishBomLineState] = useCloseDishBomLineMutation();
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
  const { data: approvalRecords = [] } = useGetApprovalRecordsQuery({ limit: 100 });
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
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

  const { data: auditLogs = [] } = useGetAuditChangesQuery(auditQuery);

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
  const [updateDataQualityIssueRemediation, updateDataQualityIssueRemediationState] = useUpdateDataQualityIssueRemediationMutation();
  const [generateMaterialDemand, generateMaterialDemandState] = useGenerateMaterialDemandMutation();
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: ingredientDemandRows = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: purchaseDemandRows = [] } = useGetPurchaseDemandQuery({ limit: 100 });
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
  const adjustmentDocuments = workflowDocuments.filter((document) => document.type === 'Điều chỉnh');
  const adminInbox = roleInboxItems.filter((item) => item.laneId === 'admin');
  const adjustmentMovements = stockMovements.filter((movement) => movement.type === 'adjustment');
  const shortageRows = ingredientDemandRows.filter((row) => row.tone === 'danger');
  const priceWarnings = priceVarianceRows.filter((row) => row.warning);
  const totalPurchaseQty = purchaseDemandRows.reduce((total, row) => total + row.reserved, 0);
  const totalIssuedQty = kitchenIssueRows.reduce((total, row) => total + row.issuedQty, 0);
  const totalUsedQty = usageRows.reduce((total, row) => total + row.usedQty, 0);
  const totalReturnedQty = usageRows.reduce((total, row) => total + row.returnedQty, 0);
  const remediationType = searchParams.get('remediate');
  const remediationDishId = searchParams.get('dishId');
  const remediationServiceDate = searchParams.get('serviceDate') || getTodayInputValue();
  const remediationCustomerId = searchParams.get('customerId') || undefined;
  const remediationScope = getDemandScope(searchParams.get('scope'));
  const isMissingBomRemediation = remediationType === 'missing_bom' && Boolean(remediationDishId);
  const selectedDish = useMemo(
    () => catalogDishes.find((dish) => dish.id === selectedDishId) ?? catalogDishes[0],
    [catalogDishes, selectedDishId],
  );
  const selectedDishBomLines = useMemo(() => selectedDish?.ingredients ?? [], [selectedDish]);
  const activeBomCount = selectedDishBomLines.filter((line) => line.bomStatus === 'PUBLISHED' && !line.effectiveTo).length;
  const selectedIngredient = ingredientLookup.find((ingredient) => ingredient.ingredientId === bomForm.ingredientId);
  const unitOptions = useMemo(() => {
    const options = new Map<string, string>();
    ingredientLookup.forEach((ingredient) => {
      if (ingredient.unitId) {
        options.set(ingredient.unitId, ingredient.unitName ?? 'Đơn vị mặc định');
      }
    });
    selectedDishBomLines.forEach((line) => {
      options.set(line.unitId, line.unit);
    });
    return Array.from(options, ([unitId, unitName]) => ({ unitId, unitName }));
  }, [ingredientLookup, selectedDishBomLines]);
  const dataQualityIssues = dataQualityReport?.issues ?? [];
  const dataQualityErrors = dataQualityIssues.filter((issue) => issue.severity === 'error');
  const isSavingBom = addDishBomLineState.isLoading || updateDishBomLineState.isLoading || closeDishBomLineState.isLoading;
  const isSavingDish = createDishState.isLoading || updateDishState.isLoading || deactivateDishState.isLoading;
  const isSavingContract = createCustomerContractState.isLoading || updateCustomerContractState.isLoading || updateMenuScheduleRulesState.isLoading || updateMenuScheduleVersionState.isLoading;
  const employeeRoles = rolesResponse?.data ?? [];
  const employeeRows = employeeResponse?.data?.items ?? [];
  const employeeMeta = employeeResponse?.data;
  const isSavingEmployee = isCreatingEmployee || isUpdatingEmployee;
  const effectiveActiveView: AdminView = canManageEmployees ? activeView : activeView === 'employees' ? 'adjustments' : activeView;
  const adminTabs: ViewTab[] = [
    { id: 'admin-adjustments', label: 'Điều chỉnh' },
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

  const resetBomForm = () => {
    setEditingBomId(null);
    setBomForm({
      ingredientId: ingredientLookup[0]?.ingredientId ?? '',
      unitId: ingredientLookup[0]?.unitId ?? '',
      grossQtyPerServing: '',
      wasteRatePercent: '0',
      bomStatus: 'PUBLISHED',
      effectiveFrom: getTodayInputValue(),
      effectiveTo: '',
      reason: '',
    });
  };

  const resetDishForm = () => {
    setEditingDishId(null);
    setDishForm(defaultDishForm);
  };

  const startEditDish = () => {
    if (!selectedDish) return;
    setEditingDishId(selectedDish.id);
    setDishForm({
      dishCode: selectedDish.code,
      dishName: selectedDish.name,
      dishType: selectedDish.dishType ?? '',
      dishGroup: selectedDish.dishGroup ?? '',
      isActive: selectedDish.isActive,
    });
    setDishFeedback(null);
  };

  const handleSaveDish = async () => {
    if (!dishForm.dishName.trim()) {
      setDishFeedback({ type: 'error', message: 'Vui lòng nhập tên món ăn.' });
      return;
    }

    if (!editingDishId && !dishForm.dishCode.trim()) {
      setDishFeedback({ type: 'error', message: 'Vui lòng nhập mã món ăn khi tạo mới.' });
      return;
    }

    try {
      if (editingDishId) {
        await updateDish({
          dishId: editingDishId,
          body: {
            dishName: dishForm.dishName.trim(),
            dishType: dishForm.dishType.trim() || null,
            dishGroup: dishForm.dishGroup.trim() || null,
            isActive: dishForm.isActive,
          },
        }).unwrap();
        setDishFeedback({ type: 'success', message: 'Đã cập nhật món ăn.' });
      } else {
        await createDish({
          dishCode: dishForm.dishCode.trim(),
          dishName: dishForm.dishName.trim(),
          dishType: dishForm.dishType.trim() || null,
          dishGroup: dishForm.dishGroup.trim() || null,
        }).unwrap();
        setDishFeedback({ type: 'success', message: 'Đã tạo món ăn mới.' });
      }

      resetDishForm();
    } catch (error) {
      setDishFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa lưu được món ăn. Kiểm tra mã trùng hoặc dữ liệu nhập.') });
    }
  };

  const handleToggleDishActive = async () => {
    if (!selectedDish) return;

    try {
      if (selectedDish.isActive) {
        await deactivateDish(selectedDish.id).unwrap();
        setDishFeedback({ type: 'success', message: `Đã khóa món ${selectedDish.name}.` });
      } else {
        await updateDish({
          dishId: selectedDish.id,
          body: {
            dishName: selectedDish.name,
            dishType: selectedDish.dishType ?? null,
            dishGroup: selectedDish.dishGroup ?? null,
            isActive: true,
          },
        }).unwrap();
        setDishFeedback({ type: 'success', message: `Đã mở lại món ${selectedDish.name}.` });
      }
      resetDishForm();
    } catch (error) {
      setDishFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa cập nhật được trạng thái món ăn.') });
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

  const startEditBomLine = (line: CatalogIngredient) => {
    setEditingBomId(line.bomId);
    setBomForm({
      ingredientId: line.ingredientId,
      unitId: line.unitId,
      grossQtyPerServing: String(line.grossQtyPerServing),
      wasteRatePercent: String(line.wasteRatePercent),
      bomStatus: line.bomStatus,
      effectiveFrom: line.effectiveFrom,
      effectiveTo: line.effectiveTo ?? '',
      reason: '',
    });
    setBomFeedback(null);
  };

  const handleSaveBomLine = async () => {
    if (!selectedDish) {
      setBomFeedback({ type: 'error', message: 'Chưa có món ăn để cập nhật BOM.' });
      return;
    }

    const ingredientId = bomForm.ingredientId || ingredientLookup[0]?.ingredientId;
    const unitId = bomForm.unitId || selectedIngredient?.unitId;
    const grossQtyPerServing = Number(bomForm.grossQtyPerServing);
    const wasteRatePercent = Number(bomForm.wasteRatePercent || 0);
    if (!ingredientId || !unitId || !Number.isFinite(grossQtyPerServing) || grossQtyPerServing <= 0) {
      setBomFeedback({ type: 'error', message: 'Vui lòng chọn nguyên liệu, đơn vị và nhập định lượng lớn hơn 0.' });
      return;
    }
    if (!Number.isFinite(wasteRatePercent) || wasteRatePercent < 0 || wasteRatePercent > 100) {
      setBomFeedback({ type: 'error', message: 'Tỷ lệ hao hụt phải nằm trong khoảng 0-100%.' });
      return;
    }

    const request = {
      dishId: selectedDish.id,
      ingredientId,
      unitId,
      grossQtyPerServing,
      wasteRatePercent,
      bomStatus: bomForm.bomStatus,
      effectiveFrom: bomForm.effectiveFrom || undefined,
      effectiveTo: bomForm.effectiveTo || null,
      reason: bomForm.reason.trim() || undefined,
    };

    try {
      if (editingBomId) {
        await updateDishBomLine({ ...request, bomId: editingBomId }).unwrap();
        setBomFeedback({ type: 'success', message: 'Đã cập nhật dòng BOM.' });
      } else {
        await addDishBomLine(request).unwrap();
        setBomFeedback({
          type: 'success',
          message: isMissingBomRemediation ? 'Đã thêm BOM. Có thể chạy lại demand cho context đang xử lý.' : 'Đã thêm dòng BOM cho món ăn.',
        });
      }
      resetBomForm();
    } catch {
      setBomFeedback({ type: 'error', message: 'Chưa lưu được BOM. Kiểm tra trùng nguyên liệu hoặc dữ liệu nhập.' });
    }
  };

  const handleRerunRemediationDemand = async () => {
    try {
      const response = await generateMaterialDemand({
        serviceDate: remediationServiceDate,
        customerId: remediationCustomerId,
        scope: remediationScope,
      }).unwrap();
      if (!response.success) {
        throw new Error(response.message || 'Không tạo lại được demand.');
      }

      const missingBomCount = response.data?.missingBomDishes.length ?? 0;
      setBomFeedback({
        type: missingBomCount > 0 ? 'error' : 'success',
        message: missingBomCount > 0
          ? `Đã chạy lại demand nhưng vẫn còn ${missingBomCount} món thiếu BOM.`
          : 'Đã chạy lại demand, không còn missing BOM trong context này.',
      });
    } catch (error) {
      setBomFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa chạy lại được demand.') });
    }
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

  const handleCloseBomLine = async (line: CatalogIngredient) => {
    if (!selectedDish) return;

    try {
      await closeDishBomLine({ dishId: selectedDish.id, bomId: line.bomId }).unwrap();
      setBomFeedback({ type: 'success', message: `Đã ngừng áp dụng ${line.name} trong BOM.` });
      if (editingBomId === line.bomId) {
        resetBomForm();
      }
    } catch {
      setBomFeedback({ type: 'error', message: 'Chưa ngừng áp dụng được dòng BOM này.' });
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
              <button className="ipc-button ipc-button-primary" type="button" onClick={() => setActiveView('adjustments')}>
                <PackageCheck size={16} />
                Điều chỉnh BOM
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

      {effectiveActiveView === 'adjustments' && (
        <div id="admin-adjustments-panel" role="tabpanel" aria-labelledby="admin-adjustments-tab" className="flex flex-col gap-4">
          <SectionPanel title="Quản trị BOM món ăn" icon={<PackageCheck size={18} />}>
            <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.8fr)]">
              <div className="flex flex-col gap-3">
                <label className="text-[13px] font-bold text-slate-700" htmlFor="admin-bom-dish">
                  Món ăn
                </label>
                <select
                  id="admin-bom-dish"
                  className="ipc-select w-full"
                  value={selectedDish?.id ?? ''}
                  disabled={isCatalogLoading || catalogDishes.length === 0}
                  onChange={(event) => {
                    setSelectedDishId(event.target.value);
                    resetBomForm();
                    setBomFeedback(null);
                  }}
                >
                  {catalogDishes.map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name}{dish.isActive ? '' : ' - đã khóa'}
                    </option>
                  ))}
                </select>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <div className="font-bold text-slate-900">{selectedDish?.name ?? 'Chưa có món'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {selectedDish ? `${activeBomCount} dòng BOM đang áp dụng / ${selectedDishBomLines.length} tổng dòng` : 'Chọn món để cập nhật định lượng'}
                  </div>
                  {selectedDish && (
                    <div className="mt-2">
                      <StatusBadge variant={selectedDish.isActive ? 'success' : 'warning'}>
                        {selectedDish.isActive ? 'Đang dùng' : 'Đã khóa'}
                      </StatusBadge>
                    </div>
                  )}
                </div>

                {isMissingBomRemediation && selectedDish && (
                  <InlineAlert
                    title="Đang xử lý thiếu BOM"
                    variant="warning"
                    action={(
                      <button
                        className="ipc-button ipc-button-primary"
                        type="button"
                        disabled={generateMaterialDemandState.isLoading}
                        onClick={() => void handleRerunRemediationDemand()}
                      >
                        <CalendarCheck size={15} />
                        Chạy lại demand
                      </button>
                    )}
                  >
                    {selectedDish.name} / {remediationServiceDate} / {remediationScope}
                  </InlineAlert>
                )}

                {dishFeedback && (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      dishFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {dishFeedback.message}
                  </div>
                )}

                <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-bold text-slate-800">
                      {editingDishId ? 'Sửa món ăn' : 'Tạo món ăn'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="ipc-button ipc-button-ghost" type="button" onClick={startEditDish} disabled={!selectedDish || isSavingDish}>
                        <Pencil size={15} />
                        Nạp món
                      </button>
                      <button className="ipc-button ipc-button-ghost" type="button" onClick={resetDishForm} disabled={isSavingDish}>
                        <PlusCircle size={15} />
                        Món mới
                      </button>
                    </div>
                  </div>

                  <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-dish-code">
                    Mã món
                  </label>
                  <input
                    id="admin-dish-code"
                    className="ipc-input"
                    value={dishForm.dishCode}
                    disabled={!!editingDishId}
                    onChange={(event) => setDishForm((prev) => ({ ...prev, dishCode: event.target.value }))}
                    placeholder="Ví dụ: DISH-NEW"
                  />

                  <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-dish-name">
                    Tên món
                  </label>
                  <input
                    id="admin-dish-name"
                    className="ipc-input"
                    value={dishForm.dishName}
                    onChange={(event) => setDishForm((prev) => ({ ...prev, dishName: event.target.value }))}
                    placeholder="Tên món ăn"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-dish-type">
                        Loại
                      </label>
                      <input
                        id="admin-dish-type"
                        className="ipc-input mt-1"
                        value={dishForm.dishType}
                        onChange={(event) => setDishForm((prev) => ({ ...prev, dishType: event.target.value }))}
                        placeholder="Mặn / Chay / Canh"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-dish-group">
                        Nhóm
                      </label>
                      <input
                        id="admin-dish-group"
                        className="ipc-input mt-1"
                        value={dishForm.dishGroup}
                        onChange={(event) => setDishForm((prev) => ({ ...prev, dishGroup: event.target.value }))}
                        placeholder="Sáng / Trưa / Tối"
                      />
                    </div>
                  </div>

                  {editingDishId && (
                    <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={dishForm.isActive}
                        onChange={(event) => setDishForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      Món đang được dùng trong catalog
                    </label>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button className="ipc-button ipc-button-primary" type="button" onClick={() => void handleSaveDish()} disabled={isSavingDish}>
                      <Save size={15} />
                      {editingDishId ? 'Lưu món' : 'Tạo món'}
                    </button>
                    <button className="ipc-button ipc-button-ghost" type="button" onClick={() => void handleToggleDishActive()} disabled={!selectedDish || isSavingDish}>
                      <Power size={15} />
                      {selectedDish?.isActive ? 'Khóa món' : 'Mở lại món'}
                    </button>
                  </div>
                </div>

                {bomFeedback && (
                  <div
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      bomFeedback.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {bomFeedback.message}
                  </div>
                )}

                <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[13px] font-bold text-slate-800">
                      {editingBomId ? 'Sửa dòng BOM' : 'Thêm nguyên liệu vào BOM'}
                    </div>
                    <button className="ipc-button ipc-button-ghost" type="button" onClick={resetBomForm}>
                      <PlusCircle size={15} />
                      Dòng mới
                    </button>
                  </div>

                  <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-bom-ingredient">
                    Nguyên liệu
                  </label>
                  <select
                    id="admin-bom-ingredient"
                    className="ipc-select w-full"
                    value={bomForm.ingredientId}
                    onChange={(event) => {
                      const nextIngredient = ingredientLookup.find((ingredient) => ingredient.ingredientId === event.target.value);
                      setBomForm((prev) => ({
                        ...prev,
                        ingredientId: event.target.value,
                        unitId: nextIngredient?.unitId ?? prev.unitId,
                      }));
                    }}
                  >
                    <option value="">Chọn nguyên liệu</option>
                    {ingredientLookup.map((ingredient) => (
                      <option key={ingredient.ingredientId} value={ingredient.ingredientId}>
                        {ingredient.ingredientName} ({ingredient.unitName ?? 'đơn vị'})
                      </option>
                    ))}
                  </select>

                  <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-bom-unit">
                    Đơn vị tính
                  </label>
                  <select
                    id="admin-bom-unit"
                    className="ipc-select w-full"
                    value={bomForm.unitId}
                    onChange={(event) => setBomForm((prev) => ({ ...prev, unitId: event.target.value }))}
                  >
                    <option value="">Chọn đơn vị</option>
                    {unitOptions.map((unit) => (
                      <option key={unit.unitId} value={unit.unitId}>
                        {unit.unitName}
                      </option>
                    ))}
                  </select>

                  <label className="text-[12px] font-bold text-slate-600" htmlFor="admin-bom-status">
                    Trạng thái version
                  </label>
                  <select
                    id="admin-bom-status"
                    className="ipc-select w-full"
                    value={bomForm.bomStatus}
                    onChange={(event) => setBomForm((prev) => ({ ...prev, bomStatus: event.target.value }))}
                  >
                    {bomStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Định lượng/suất
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        min="0"
                        type="number"
                        value={bomForm.grossQtyPerServing}
                        onChange={(event) => setBomForm((prev) => ({ ...prev, grossQtyPerServing: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Hao hụt (%)
                      <input
                        className="ipc-input"
                        inputMode="decimal"
                        max="100"
                        min="0"
                        type="number"
                        value={bomForm.wasteRatePercent}
                        onChange={(event) => setBomForm((prev) => ({ ...prev, wasteRatePercent: event.target.value }))}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Hiệu lực từ
                      <input
                        className="ipc-input"
                        type="date"
                        value={bomForm.effectiveFrom}
                        onChange={(event) => setBomForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                      Hiệu lực đến
                      <input
                        className="ipc-input"
                        type="date"
                        value={bomForm.effectiveTo}
                        onChange={(event) => setBomForm((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-[12px] font-bold text-slate-600">
                    Lý do điều chỉnh
                    <input
                      className="ipc-input"
                      value={bomForm.reason}
                      onChange={(event) => setBomForm((prev) => ({ ...prev, reason: event.target.value }))}
                      placeholder="Ví dụ: cập nhật định lượng theo test bếp"
                    />
                  </label>

                  <button
                    className="ipc-button ipc-button-primary justify-center"
                    type="button"
                    disabled={isSavingBom || !selectedDish}
                    onClick={() => void handleSaveBomLine()}
                  >
                    <Save size={15} />
                    {editingBomId ? 'Lưu thay đổi BOM' : 'Thêm vào BOM'}
                  </button>
                </div>
              </div>

              <DataTableShell ariaLabel="Bảng BOM món ăn">
                <table className="ipc-data-table">
                  <thead>
                    <tr>
                      <th>Nguyên liệu</th>
                      <th>Định lượng/suất</th>
                      <th>Hao hụt</th>
                      <th>Trạng thái</th>
                      <th>Hiệu lực</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDishBomLines.length === 0 ? <EmptyRow colSpan={6} /> : selectedDishBomLines.map((line) => (
                      <tr key={line.bomId}>
                        <td className="font-semibold text-slate-900">{line.name}</td>
                        <td className="ipc-numeric-cell">
                          {line.grossQtyPerServing.toLocaleString('vi-VN')} {line.unit}
                        </td>
                        <td className="ipc-numeric-cell">{line.wasteRatePercent.toLocaleString('vi-VN')}%</td>
                        <td className="ipc-badge-cell">
                          <StatusBadge variant={getBomStatusBadgeVariant(line.bomStatus)}>{line.bomStatusLabel}</StatusBadge>
                        </td>
                        <td>
                          <div className="flex flex-col items-center gap-1 text-xs text-slate-600">
                            <span>Từ {new Date(line.effectiveFrom).toLocaleDateString('vi-VN')}</span>
                            {line.effectiveTo ? (
                              <StatusBadge variant="neutral">Đến {new Date(line.effectiveTo).toLocaleDateString('vi-VN')}</StatusBadge>
                            ) : (
                              <StatusBadge variant="success">Đang áp dụng</StatusBadge>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap justify-center gap-2">
                            <button className="ipc-button ipc-button-ghost ipc-button-bounded" type="button" onClick={() => startEditBomLine(line)}>
                              <Pencil size={14} />
                              Sửa
                            </button>
                            {!line.effectiveTo && (
                              <button
                                className="ipc-button ipc-button-ghost ipc-button-bounded"
                                type="button"
                                disabled={isSavingBom}
                                onClick={() => void handleCloseBomLine(line)}
                              >
                                <XCircle size={14} />
                                Ngừng
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            </div>
          </SectionPanel>

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
                <DataTableShell ariaLabel="Bảng contract khách hàng">
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
                </DataTableShell>

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

            <DataTableShell ariaLabel="Bảng vấn đề dữ liệu cần xử lý" className="mt-4">
              <table className="ipc-data-table text-sm">
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
                  {dataQualityIssues.length === 0 ? <EmptyRow colSpan={10} /> : dataQualityIssues.map((issue, index) => (
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
                      <td className="text-left text-slate-700">{issue.message}</td>
                      <td className="text-left text-slate-600">{issue.suggestedAction}</td>
                      <td>
                        <Link
                          className="ipc-button ipc-button-ghost ipc-button-bounded"
                          to={issue.route || ROUTES.ADMIN_DATA}
                          onClick={() => {
                            if (issue.category === 'missing_bom' && issue.entityId) {
                              setActiveView('adjustments');
                              setSelectedDishId(issue.entityId);
                              setEditingBomId(null);
                              setBomFeedback({ type: 'error', message: 'Đang mở form BOM cho món thiếu định lượng.' });
                            }
                          }}
                        >
                          Sửa
                        </Link>
                      </td>
                      <td>
                        <button
                          className="ipc-button ipc-button-ghost ipc-button-bounded"
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
            </DataTableShell>
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
            <DataTableShell ariaLabel="Bảng chỉ số thống kê vận hành">
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
                    <td className="text-left">Nhu cầu mua theo nhà cung cấp, ngày và ca từ danh sách mua.</td>
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
                  {currentStockRows.slice(0, 8).length === 0 ? <EmptyRow colSpan={4} /> : currentStockRows.slice(0, 8).map((row, index) => (
                    <tr key={`${row.id}-${index}`}>
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
                  {priceWarnings.slice(0, 8).length === 0 ? <EmptyRow colSpan={5} /> : priceWarnings.slice(0, 8).map((row, index) => (
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
            </DataTableShell>
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
                  onChange={(e) => { setAuditActor(e.target.value); setAuditPage(1); }}
                  placeholder="Họ tên / tài khoản..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-48 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mảng nghiệp vụ</label>
                <select
                  value={auditArea}
                  onChange={(e) => { setAuditArea(e.target.value); setAuditPage(1); }}
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
                  onChange={(e) => { setAuditEntity(e.target.value); setAuditPage(1); }}
                  placeholder="Ví dụ: Mealquantityplan..."
                  className="h-8 px-2 border border-slate-200 rounded text-xs w-44 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tên cột/Trường</label>
                <input
                  type="text"
                  value={auditField}
                  onChange={(e) => { setAuditField(e.target.value); setAuditPage(1); }}
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
                    setAuditPage(1);
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

            <DataTableShell ariaLabel="Bảng nhật ký thay đổi hệ thống" className="ipc-admin-audit-shell">
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
                  {pagedAuditLogs.map((log) => (
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
            </DataTableShell>
            <PaginationBar page={safeAuditPage} pageSize={auditPageSize} totalItems={displayLogs.length} onPageChange={setAuditPage} />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
