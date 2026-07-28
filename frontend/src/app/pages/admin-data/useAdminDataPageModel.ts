import { useDeferredValue, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { useToast, type ViewTab } from '@/components/common';
import { usePaginatedRows } from '@/lib/usePaginatedRows';
import { selectCurrentUser } from '@/features/auth';
import { useGetAuditChangePageQuery, useGetCurrentStockPageQuery, useGetDataQualityPageQuery, useGetIngredientDemandAggregatePageQuery, useGetOperationalKpisQuery, useGetPriceVariancePageQuery, useGetPurchasePlanPageQuery, useGetStockMovementPageQuery, useUpdateDataQualityIssueRemediationMutation, type DataQualityIssueRow, type ReportCursor } from '@/api/workflowApi';
import { useDownloadBomTemplateMutation, useCommitBomImportMutation, usePreviewBomImportMutation, useAddDishBomLineMutation, useCloseDishBomLineMutation, useGetAdminDishCatalogQuery, useGetIngredientsQuery, useUpdateDishBomLineMutation, type BomImportPreview, type CatalogIngredient } from '@/api/dishCatalogApi';
import { useCreateCustomerContractMutation, useGetCustomerContractsQuery, useGetMenuSchedulesQuery, useUpdateCustomerContractMutation, useUpdateMenuScheduleRulesMutation, useUpdateMenuScheduleVersionMutation } from '@/features/coordination/coordinationApi';
import type { ApiShiftName, CreateCustomerContractRequest, CustomerContractDto, MenuScheduleDto, UpdateCustomerContractRequest, UpdateMenuScheduleRulesRequest, UpdateMenuScheduleVersionRequest } from '@/features/coordination/types';
import { type AdminEmployee, useCreateAdminEmployeeMutation, useGetAdminEmployeesQuery, useGetAdminRolesQuery, useUpdateAdminEmployeeMutation, useUpdateAdminEmployeeStatusMutation } from '@/features/admin/adminApi';
import { createDefaultBomForm, defaultContractForm, defaultEmployeeForm, defaultScheduleRuleForm, getBomTemplateTypeLabel, getMutationErrorMessage, getNextDayInputValue, getTodayInputValue, isAdminView, type AdminView, type BomFormState, type BomPanelMode, type BomTemplateType, type ContractFormState, type EmployeeFormState, type ScheduleRuleFormState } from './adminDataPageTypes';
import { toQueryView, type QuerySnapshot } from '@/lib/queryView';

const EMPTY_ADMIN_LIST: never[] = [];

const toAdminView = <T,>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) => toQueryView(query, {
  instruction: `Mở mục ${label} để tải dữ liệu.`, retry: () => query.refetch(),
  errorMessage: `Không tải được ${label}.`, forbiddenMessage: `Bạn không có quyền xem ${label}.`,
});

export function useAdminDataPageModel() {
  const { toast } = useToast();
  const [isViewPending, startViewTransition] = useTransition();
  const operationalDate = getTodayInputValue();
  const currentUser = useAppSelector(selectCurrentUser);
  const [searchParams] = useSearchParams();
  const bomTemplateDishId = searchParams.get('dishId')?.trim() || undefined;
  const canManageEmployees = currentUser?.role === 'admin' || currentUser?.isAdminFullAccess;
  const initialView = isAdminView(searchParams.get('view')) && (searchParams.get('view') !== 'employees' || canManageEmployees)
    ? searchParams.get('view') as AdminView
    : 'bom-import';
  const [activeView, setActiveView] = useState<AdminView>(initialView);
  const [auditCursors, setAuditCursors] = useState<ReportCursor[]>([]);
  const [stockMovementCursors, setStockMovementCursors] = useState<ReportCursor[]>([]);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [qualityPage, setQualityPage] = useState(1);
  const [priceWarningPage, setPriceWarningPage] = useState(1);
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

  const [bomPanelMode, setBomPanelMode] = useState<BomPanelMode>('current');
  const [bomSearch, setBomSearch] = useState('');
  const deferredBomSearch = useDeferredValue(bomSearch);
  const [bomForm, setBomForm] = useState<BomFormState>(createDefaultBomForm);
  const [editingBom, setEditingBom] = useState<{ dishId: string; line: CatalogIngredient } | null>(null);
  const [closingBom, setClosingBom] = useState<{ dishId: string; dishName: string; line: CatalogIngredient } | null>(null);
  const [isBomDialogOpen, setIsBomDialogOpen] = useState(false);
  const [downloadBomTemplate, downloadBomTemplateState] = useDownloadBomTemplateMutation();
  const [previewBomImport, previewBomImportState] = usePreviewBomImportMutation();
  const [commitBomImport, commitBomImportState] = useCommitBomImportMutation();
  const [addDishBomLine, addDishBomLineState] = useAddDishBomLineMutation();
  const [updateDishBomLine, updateDishBomLineState] = useUpdateDishBomLineMutation();
  const [closeDishBomLine, closeDishBomLineState] = useCloseDishBomLineMutation();
  const isBomView = activeView === 'bom-import';
  const isContractView = activeView === 'contracts';
  const isCleanupView = activeView === 'cleanup';
  const isInventoryView = activeView === 'inventory';
  const isStatisticsView = activeView === 'statistics';
  const dishCatalogQuery = useGetAdminDishCatalogQuery(undefined, { skip: !isBomView });
  const dishCatalogView = toAdminView(dishCatalogQuery, 'danh mục BOM');
  const dishCatalog = dishCatalogView.phase === 'ready' ? dishCatalogView.data : EMPTY_ADMIN_LIST;
  const isDishCatalogLoading = dishCatalogView.phase === 'uninitialized' || dishCatalogView.phase === 'loading';
  const ingredientCatalogQuery = useGetIngredientsQuery(undefined, { skip: !isBomView });
  const ingredientCatalogView = toAdminView(ingredientCatalogQuery, 'danh mục nguyên liệu');
  const ingredientCatalog = ingredientCatalogView.phase === 'ready' ? ingredientCatalogView.data : EMPTY_ADMIN_LIST;
  const isIngredientCatalogLoading = ingredientCatalogView.phase === 'uninitialized' || ingredientCatalogView.phase === 'loading';
  const customerContractsQuery = useGetCustomerContractsQuery(undefined, { skip: !isContractView && !isBomView });
  const customerContractsView = toAdminView(customerContractsQuery, 'customer contract');
  const customerContracts = customerContractsView.phase === 'ready' ? customerContractsView.data.data ?? EMPTY_ADMIN_LIST : EMPTY_ADMIN_LIST;
  const selectedContract = useMemo(
    () => customerContracts.find((customer) => customer.customerId === selectedContractCustomerId) ?? customerContracts[0],
    [customerContracts, selectedContractCustomerId],
  );
  const currentBomRows = useMemo(() => {
    if (!isBomView) return [];
    const today = getTodayInputValue();
    const search = deferredBomSearch.trim().toLocaleLowerCase('vi-VN');

    return dishCatalog
      .filter((dish) => dish.isActive)
      .flatMap((dish) => dish.ingredients.map((line) => ({ dish, line })))
      .filter(({ line }) => line.priceTierAmount === bomImportTier)
      .filter(({ line }) => bomImportCustomerId ? line.customerId === bomImportCustomerId : !line.customerId)
      .filter(({ line }) => line.bomStatus !== 'ARCHIVED' && (!line.effectiveTo || line.effectiveTo >= today))
      .filter(({ dish, line }) => !search || `${dish.code} ${dish.name} ${line.ingredientCode} ${line.name}`.toLocaleLowerCase('vi-VN').includes(search))
      .sort((left, right) => left.dish.name.localeCompare(right.dish.name, 'vi') || left.line.name.localeCompare(right.line.name, 'vi'));
  }, [bomImportCustomerId, bomImportTier, deferredBomSearch, dishCatalog, isBomView]);
  const isSavingBom = addDishBomLineState.isLoading || updateDishBomLineState.isLoading;
  const menuSchedulesQuery = useGetMenuSchedulesQuery(
    { customerId: selectedContract?.customerId, serviceDate: selectedContract?.latestServiceDate ?? undefined },
    { skip: !isContractView || !selectedContract?.customerId },
  );
  const menuSchedulesView = toAdminView(menuSchedulesQuery, 'lịch thực đơn');
  const menuSchedules = menuSchedulesView.phase === 'ready' ? menuSchedulesView.data.data ?? EMPTY_ADMIN_LIST : EMPTY_ADMIN_LIST;
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
  const deferredAuditActor = useDeferredValue(auditActor);
  const deferredAuditArea = useDeferredValue(auditArea);
  const deferredAuditEntity = useDeferredValue(auditEntity);
  const deferredAuditField = useDeferredValue(auditField);

  const auditQuery = useMemo(
    () => ({
      limit: 100,
      actor: deferredAuditActor.trim() || undefined,
      businessArea: deferredAuditArea.trim() || undefined,
      entityName: deferredAuditEntity.trim() || undefined,
      fieldName: deferredAuditField.trim() || undefined,
    }),
    [deferredAuditActor, deferredAuditArea, deferredAuditEntity, deferredAuditField]
  );

  const auditCursor = auditCursors.at(-1);
  const auditResult = useGetAuditChangePageQuery({
    ...auditQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    cursorOffset: auditCursor?.cursorOffset,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'audit' });
  const auditView = toAdminView(auditResult, 'nhật ký audit');

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
      a.download = `audit-log-${getTodayInputValue()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: 'Chưa thể tải file CSV', description: String(err), variant: 'danger', durationMs: 0 });
    }
  };
  const dataQualityQuery = useGetDataQualityPageQuery(
    { pageNumber: qualityPage, pageSize: 8, serviceDate: operationalDate },
    { skip: !isCleanupView },
  );
  const dataQualityView = toAdminView(dataQualityQuery, 'chất lượng dữ liệu');
  const dataQualityReport = dataQualityView.phase === 'ready' ? dataQualityView.data : undefined;
  const operationalKpisQuery = useGetOperationalKpisQuery(undefined, { skip: !isStatisticsView });
  const operationalKpisView = toAdminView(operationalKpisQuery, 'KPI vận hành');
  const operationalKpis = operationalKpisView.phase === 'ready' ? operationalKpisView.data : undefined;
  const [updateDataQualityIssueRemediation, updateDataQualityIssueRemediationState] = useUpdateDataQualityIssueRemediationMutation();
  const stockMovementCursor = stockMovementCursors.at(-1);
  const stockMovementResult = useGetStockMovementPageQuery({
    movementType: 'adjustment',
    cursorDate: stockMovementCursor?.cursorDate,
    cursorId: stockMovementCursor?.cursorId,
    cursorOffset: stockMovementCursor?.cursorOffset,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: !isInventoryView });
  const stockMovementView = toAdminView(stockMovementResult, 'bút toán điều chỉnh kho');
  const ingredientDemandQuery = useGetIngredientDemandAggregatePageQuery({
    pageNumber: 1,
    pageSize: 8,
    dateFrom: operationalDate,
    dateTo: operationalDate,
  }, { skip: !isStatisticsView });
  const ingredientDemandView = toAdminView(ingredientDemandQuery, 'thống kê nhu cầu nguyên liệu');
  const ingredientDemandPage = ingredientDemandView.phase === 'ready' ? ingredientDemandView.data : undefined;
  const purchasePlanQuery = useGetPurchasePlanPageQuery(
    { groupBy: 'day', pageNumber: 1, pageSize: 8 },
    { skip: !isStatisticsView },
  );
  const purchasePlanView = toAdminView(purchasePlanQuery, 'thống kê kế hoạch thu mua');
  const purchasePlanPage = purchasePlanView.phase === 'ready' ? purchasePlanView.data : undefined;
  const currentStockQuery = useGetCurrentStockPageQuery(
    { pageNumber: currentStockPage, pageSize: 8 },
    { skip: !isInventoryView && !isStatisticsView },
  );
  const currentStockView = toAdminView(currentStockQuery, 'tồn kho hiện tại');
  const currentStockPageResponse = currentStockView.phase === 'ready' ? currentStockView.data : undefined;
  const priceVarianceQuery = useGetPriceVariancePageQuery({
    pageNumber: priceWarningPage,
    pageSize: 8,
    warningOnly: true,
    dateFrom: operationalDate,
    dateTo: operationalDate,
  }, { skip: !isStatisticsView });
  const priceVarianceView = toAdminView(priceVarianceQuery, 'thống kê cảnh báo giá');
  const priceVariancePage = priceVarianceView.phase === 'ready' ? priceVarianceView.data : undefined;
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
  const adjustmentMovements = stockMovementView.phase === 'ready' ? stockMovementView.data.items : [];
  const shortageCount = ingredientDemandPage?.shortageCount ?? 0;
  const priceWarnings = priceVariancePage?.items ?? [];
  const priceWarningCount = priceVariancePage?.totalCount ?? 0;
  const currentStockRows = currentStockPageResponse?.items ?? [];
  const totalPurchaseQty = purchasePlanPage?.totalShortageQty ?? 0;
  const totalIssuedQty = operationalKpis?.totalKitchenIssuedQty ?? 0;
  const totalUsedQty = operationalKpis?.totalKitchenUsedQty ?? 0;
  const totalReturnedQty = operationalKpis?.totalKitchenReturnedQty ?? 0;
  const dataQualityIssues = dataQualityReport?.page.items ?? [];
  const dataQualityErrorCount = dataQualityReport?.errorCount ?? 0;
  const currentBomPagination = usePaginatedRows(currentBomRows, 8);
  const bomPreviewPagination = usePaginatedRows(bomImportPreview?.rows ?? [], 20);
  const isSavingContract = createCustomerContractState.isLoading || updateCustomerContractState.isLoading || updateMenuScheduleRulesState.isLoading || updateMenuScheduleVersionState.isLoading;
  const employeeRoles = rolesResponse?.data ?? [];
  const employeeRows = employeeResponse?.data?.items ?? [];
  const employeeMeta = employeeResponse?.data;
  const isSavingEmployee = isCreatingEmployee || isUpdatingEmployee;
  const displayLogs = auditView.phase === 'ready' ? auditView.data.items : [];
  const effectiveActiveView: AdminView = canManageEmployees ? activeView : activeView === 'employees' ? 'bom-import' : activeView;
  const adminContextItems = effectiveActiveView === 'bom-import'
    ? [
        { label: 'BOM đang hiển thị', value: dishCatalogView.phase === 'ready' ? `${currentBomRows.length} dòng` : '—', tone: 'neutral' as const },
        { label: 'Đơn giá', value: `${bomImportTier / 1000}k`, tone: 'info' as const },
        { label: 'Preview', value: bomImportPreview ? `${bomImportPreview.rows?.length ?? 0} dòng` : 'Chưa kiểm tra', tone: bomImportPreview ? 'warning' as const : 'neutral' as const },
      ]
    : effectiveActiveView === 'contracts'
      ? [
          { label: 'Khách hàng', value: customerContractsView.phase === 'ready' ? customerContracts.length.toString() : '—', tone: 'neutral' as const },
          { label: 'Đang dùng', value: customerContractsView.phase === 'ready' ? customerContracts.filter((item) => item.isActive).length.toString() : '—', tone: customerContractsView.phase === 'ready' ? 'success' as const : 'neutral' as const },
          { label: 'Lịch version', value: menuSchedulesView.phase === 'ready' ? menuSchedules.length.toString() : '—', tone: 'neutral' as const },
        ]
      : effectiveActiveView === 'cleanup'
        ? [
            { label: 'Dữ liệu lỗi', value: dataQualityView.phase === 'ready' ? `${dataQualityErrorCount} mục` : '—', tone: dataQualityView.phase !== 'ready' ? 'neutral' as const : dataQualityErrorCount ? 'danger' as const : 'success' as const },
            { label: 'SLA gấp', value: dataQualityView.phase === 'ready' ? `${dataQualityView.data.urgentIssueCount}` : '—', tone: dataQualityView.phase !== 'ready' ? 'neutral' as const : dataQualityView.data.urgentIssueCount ? 'danger' as const : 'success' as const },
            { label: 'Đã xử lý', value: dataQualityView.phase === 'ready' ? `${dataQualityView.data.resolvedIssueCount}` : '—', tone: dataQualityView.phase === 'ready' ? 'success' as const : 'neutral' as const },
          ]
        : effectiveActiveView === 'inventory'
          ? [
              { label: 'Tồn kho', value: currentStockView.phase === 'ready' ? `${currentStockView.data.totalCount} dòng` : '—', tone: 'neutral' as const },
              { label: 'Điều chỉnh', value: stockMovementView.phase === 'ready' ? `${adjustmentMovements.length} bút toán` : '—', tone: stockMovementView.phase !== 'ready' ? 'neutral' as const : adjustmentMovements.length ? 'warning' as const : 'success' as const },
            ]
          : effectiveActiveView === 'statistics'
            ? [
                { label: 'Thiếu nguyên liệu', value: ingredientDemandView.phase === 'ready' ? shortageCount.toString() : '—', tone: ingredientDemandView.phase !== 'ready' ? 'neutral' as const : shortageCount ? 'danger' as const : 'success' as const },
                { label: 'Cảnh báo giá', value: priceVarianceView.phase === 'ready' ? priceWarningCount.toString() : '—', tone: priceVarianceView.phase !== 'ready' ? 'neutral' as const : priceWarningCount ? 'warning' as const : 'success' as const },
                { label: 'Đề xuất mua', value: purchasePlanView.phase === 'ready' ? totalPurchaseQty.toString() : '—', tone: purchasePlanView.phase !== 'ready' ? 'neutral' as const : totalPurchaseQty ? 'warning' as const : 'success' as const },
              ]
            : effectiveActiveView === 'audit'
              ? [{ label: 'Audit', value: auditView.phase === 'ready' ? `${displayLogs.length} thay đổi` : '—', tone: 'neutral' as const }]
              : [{ label: 'Nhân viên', value: employeesView.phase === 'ready' ? `${employeeMeta?.totalCount ?? 0} tài khoản` : '—', tone: employeesView.phase === 'ready' ? 'info' as const : 'neutral' as const }];
  const adminTabs: ViewTab[] = [
    { id: 'admin-bom-import', label: 'BOM theo đơn giá' },
    { id: 'admin-contracts', label: 'Contract' },
    { id: 'admin-cleanup', label: 'Dữ liệu lỗi' },
    { id: 'admin-inventory', label: 'Tồn kho' },
    { id: 'admin-statistics', label: 'Thống kê' },
    { id: 'admin-audit', label: 'Audit' },
    ...(canManageEmployees ? [{ id: 'admin-employees', label: 'Nhân viên' }] : []),
  ];

  const handleDownloadBomTemplate = async (templateType: BomTemplateType) => {
    if (templateType === 'dish' && !bomTemplateDishId) {
      setBomImportFeedback({ type: 'error', message: 'Chưa có món cụ thể để tải mẫu theo món đang chọn.' });
      return;
    }

    try {
      const blob = await downloadBomTemplate({
        priceTier: bomImportTier,
        customerId: bomImportCustomerId.trim() || undefined,
        dishId: templateType === 'dish' ? bomTemplateDishId : undefined,
        templateType,
      }).unwrap();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bom-template-${templateType}-${bomImportTier}-${bomImportCustomerId.trim() || 'global'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBomImportFeedback({ type: 'success', message: `Đã tải ${getBomTemplateTypeLabel(templateType).toLowerCase()}. IngredientCode có thể để trống khi nhập nguyên liệu mới.` });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa tải được file mẫu BOM.') });
    }
  };

  const handlePreviewBomImport = async () => {
    if (!bomImportFile) {
      setBomImportFeedback({ type: 'error', message: 'Vui lòng chọn file Excel BOM trước khi preview.' });
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
      setBomPanelMode('preview');
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
      setBomPanelMode('current');
      setBomImportFeedback({
        type: 'success',
        message: `Đã import BOM: tạo ${result.createdRows}, cập nhật ${result.updatedRows}, archive ${result.archivedRows}.`,
      });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Commit import BOM thất bại.') });
    }
  };

  const openCreateBomDialog = () => {
    const preferredDish = dishCatalog.find((dish) => dish.id === bomTemplateDishId && dish.isActive)
      ?? dishCatalog.find((dish) => dish.isActive);
    setEditingBom(null);
    setBomForm({
      ...createDefaultBomForm(),
      dishId: preferredDish?.id ?? '',
      ingredientId: ingredientCatalog[0]?.ingredientId ?? '',
    });
    setBomImportFeedback(null);
    setIsBomDialogOpen(true);
  };

  const openEditBomDialog = (dishId: string, line: CatalogIngredient) => {
    const today = getTodayInputValue();
    const versionEffectiveFrom = line.bomStatus === 'PUBLISHED'
      ? [today, getNextDayInputValue(line.effectiveFrom)].sort().at(-1) ?? today
      : line.effectiveFrom;
    setEditingBom({ dishId, line });
    setBomForm({
      dishId,
      ingredientId: line.ingredientId,
      grossQtyPerServing: String(line.grossQtyPerServing),
      wasteRatePercent: String(line.wasteRatePercent),
      bomStatus: line.bomStatus === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
      effectiveFrom: versionEffectiveFrom,
      effectiveTo: line.effectiveTo ?? '',
      reason: '',
    });
    setBomImportFeedback(null);
    setIsBomDialogOpen(true);
  };

  const handleSaveBomLine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ingredient = ingredientCatalog.find((item) => item.ingredientId === bomForm.ingredientId);
    const quantity = Number(bomForm.grossQtyPerServing);
    const wasteRate = Number(bomForm.wasteRatePercent);
    if (!bomForm.dishId || !ingredient?.ingredientId) {
      setBomImportFeedback({ type: 'error', message: 'Vui lòng chọn món và nguyên liệu.' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(wasteRate) || wasteRate < 0 || wasteRate > 100) {
      setBomImportFeedback({ type: 'error', message: 'Qty/suất phải lớn hơn 0 và hao hụt phải trong khoảng 0-100%.' });
      return;
    }
    if (bomForm.effectiveTo && bomForm.effectiveTo < bomForm.effectiveFrom) {
      setBomImportFeedback({ type: 'error', message: 'Ngày hết hiệu lực phải sau ngày bắt đầu.' });
      return;
    }
    if (editingBom && !bomForm.reason.trim()) {
      setBomImportFeedback({ type: 'error', message: 'Cần nhập lý do khi điều chỉnh dòng BOM.' });
      return;
    }

    const request = {
      dishId: bomForm.dishId,
      ingredientId: ingredient.ingredientId,
      unitId: ingredient.unitId,
      customerId: bomImportCustomerId || null,
      priceTierAmount: bomImportTier,
      grossQtyPerServing: quantity,
      wasteRatePercent: wasteRate,
      bomStatus: bomForm.bomStatus,
      effectiveFrom: bomForm.effectiveFrom,
      effectiveTo: bomForm.effectiveTo || null,
      reason: bomForm.reason.trim() || undefined,
    };

    try {
      if (editingBom) {
        await updateDishBomLine({ ...request, bomId: editingBom.line.bomId }).unwrap();
      } else {
        await addDishBomLine(request).unwrap();
      }
      setIsBomDialogOpen(false);
      setBomPanelMode('current');
      setBomImportFeedback({ type: 'success', message: editingBom ? 'Đã tạo version điều chỉnh cho dòng BOM.' : 'Đã thêm dòng BOM thủ công.' });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa lưu được dòng BOM.') });
    }
  };

  const handleCloseBomLine = async () => {
    if (!closingBom) return;
    try {
      await closeDishBomLine({ dishId: closingBom.dishId, bomId: closingBom.line.bomId }).unwrap();
      setClosingBom(null);
      setBomImportFeedback({ type: 'success', message: 'Đã ngừng áp dụng dòng BOM; dữ liệu lịch sử vẫn được giữ lại.' });
    } catch (error) {
      setBomImportFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa ngừng áp dụng được dòng BOM.') });
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
    });
    loadScheduleRuleForm(undefined);
    setContractFeedback(null);
  };

  const loadScheduleRuleForm = (schedule: MenuScheduleDto | undefined) => {
    setScheduleRuleForm(schedule ? {
      menuPrice: String(schedule.menuPrice),
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
    if (defaultMenuPrice != null && (!Number.isFinite(defaultMenuPrice) || defaultMenuPrice < 0)) {
      setContractFeedback({ type: 'error', message: 'Đơn giá mặc định không hợp lệ.' });
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
      defaultBomRatePercent: 100,
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
    if (!Number.isFinite(menuPrice) || menuPrice < 0) {
      setContractFeedback({ type: 'error', message: 'Đơn giá menu không hợp lệ.' });
      return;
    }

    const body: UpdateMenuScheduleRulesRequest = {
      menuPrice,
      bomRatePercent: 100,
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
      const response = await updateEmployeeStatus({
        id: employee.userId,
        isActive: !employee.isActive,
      }).unwrap();

      setEmployeeNotice(response.message || 'Đã cập nhật trạng thái nhân viên.');
    } catch {
      setEmployeeNotice('Không thể cập nhật trạng thái nhân viên.');
    }
  };
  const queryViews = {
    audit: auditView,
    contracts: customerContractsView,
    currentStock: currentStockView,
    dataQuality: dataQualityView,
    dishCatalog: dishCatalogView,
    employees: employeesView,
    ingredientCatalog: ingredientCatalogView,
    ingredientDemand: ingredientDemandView,
    menuSchedules: menuSchedulesView,
    operationalKpis: operationalKpisView,
    priceVariance: priceVarianceView,
    purchasePlan: purchasePlanView,
    roles: rolesView,
    stockMovements: stockMovementView,
  };

  return { queryViews, adjustmentMovements, adminContextItems, adminTabs, auditActor, auditArea, auditCursors, auditEntity, auditField, auditResult, bomForm, bomImportCustomerId, bomImportEffectiveFrom, bomImportFeedback, bomImportFile, bomImportPreview, bomImportTier, bomPanelMode, bomPreviewPagination, bomSearch, bomTemplateDishId, canManageEmployees, closeDishBomLineState, closingBom, commitBomImportState, contractFeedback, contractForm, currentBomPagination, currentBomRows, currentStockPage, currentStockPageResponse, currentStockRows, customerContracts, dataQualityErrorCount, dataQualityFeedback, dataQualityIssues, dataQualityReport, dishCatalog, displayLogs, downloadBomTemplateState, editingBom, editingEmployeeId, effectiveActiveView, employeeForm, employeeMeta, employeeNotice, employeeRoles, employeeRows, employeeSearch, handleCloseBomLine, handleCommitBomImport, handleDataQualityRemediation, handleDownloadBomTemplate, handleEditEmployee, handleEmployeeStatusToggle, handleEmployeeSubmit, handleExportAuditCsv, handlePreviewBomImport, handleSaveBomLine, handleSaveCustomerContract, handleSaveScheduleRules, handleUpdateScheduleVersion, ingredientCatalog, isBomDialogOpen, isCreatingContract, isDishCatalogLoading, isEmployeeLoading, isIngredientCatalogLoading, isRolesLoading, isSavingBom, isSavingContract, isSavingEmployee, isUpdatingStatus, isViewPending, loadContractForm, loadScheduleRuleForm, menuSchedules, openCreateBomDialog, openEditBomDialog, operationalKpis, previewBomImportState, priceVariancePage, priceWarningCount, priceWarningPage, priceWarnings, qualityPage, resetEmployeeForm, scheduleRuleForm, selectedContract, selectedSchedule, setActiveView, setAuditActor, setAuditArea, setAuditCursors, setAuditEntity, setAuditField, setBomForm, setBomImportCustomerId, setBomImportEffectiveFrom, setBomImportFile, setBomImportPreview, setBomImportTier, setBomPanelMode, setBomSearch, setClosingBom, setContractForm, setCurrentStockPage, setEmployeeForm, setEmployeePage, setEmployeeSearch, setIsBomDialogOpen, setIsCreatingContract, setPriceWarningPage, setQualityPage, setScheduleRuleForm, setSelectedContractCustomerId, setSelectedScheduleId, setStockMovementCursors, shortageCount, startNewContract, startViewTransition, stockMovementCursors, stockMovementResult, totalIssuedQty, totalPurchaseQty, totalReturnedQty, totalUsedQty, updateDataQualityIssueRemediationState };
}

export type AdminDataPageModel = ReturnType<typeof useAdminDataPageModel>;
