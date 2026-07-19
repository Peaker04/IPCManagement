import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Scale, Lock, Edit, Upload, ShoppingCart, X, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { updateWeeklyMenuDish, setWeeklyMenu } from '../../coordination/coordinationSlice';
import { CommandBar, ContextStrip, DemandSummary, DocumentRail, FieldRow, InlineAlert, OperationalFrame, PageStepper, PaginationBar, SectionPanel, StatusBadge, Toolbar, ViewSwitcher } from '@/components/common';
import { TableViewport } from '@/components/common';
import { useGenerateMaterialDemandMutation, useGetMaterialDemandStalenessQuery, useGetIngredientDemandAggregatePageQuery, useGetIngredientDemandQuery, useGetWorkflowDocumentsQuery } from '@/features/workflow';
import type { DemandLine, WorkflowDocument } from '@/features/workflow';
import { ActionGuard } from '@/routes/ActionGuard';
import { ROUTES } from '@/routes/routeConfig';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DAYS_OF_WEEK_WITH_DATES as DEFAULT_DAYS_OF_WEEK } from '@/lib/constants';
import { formatCurrency, formatQuantityWithUnit } from '@/lib/formatters';
import { useGetDishesCatalogQuery } from '../dishCatalogApi';
import type { CreateCustomerContractRequest, ProductionPlanDto, WeeklyMenuState } from '../../coordination/types';
import {
  useCreateCustomerContractMutation,
  useCommitWeeklyMenuImportMutation,
  useGetCoordinationCustomersQuery,
  useGetCustomerContractsQuery,
  useGetCommittedWeeklyMenuQuery,
  useGetMealQuantityPlansQuery,
  useGetMenuSchedulesQuery,
  useGetProductionPlansQuery,
  useLazyGetProductionPlansQuery,
  usePreviewWeeklyMenuImportMutation,
  useDownloadWeeklyMenuTemplateMutation,
  useSaveCustomerImportMappingMutation,
  useUpsertQuickServingsMutation,
  useUpdateWeeklyMenuBulkMutation,
  useGetWeeklyMenuImportHistoryQuery,
  useRollbackWeeklyMenuImportMutation,
} from '../../coordination/coordinationApi';
import {
  BOM_PRICE_TIERS,
  DEFAULT_BOM_PRICE_TIER,
  buildProductionDisplayDayByDate,
  buildProductionPlanPages,
  filterProductionPlansForSelection,
  formatBomTierLabel,
  getSafeProductionPlanPageIndex,
  isBomPriceTier,
  normalizeBomPriceTier,
} from '../weeklyMenuPlanning';
import type { BomPriceTier } from '../weeklyMenuPlanning';
import { ImportedLayoutMatrix } from '../components/ImportedLayoutMatrix';
import {
  formatFileSize,
  formatImportDate,
  formatMaterialDishSource,
  formatMenuDishName,
  formatQuantityVariance,
  getApiErrorMessage,
  getImportJobStatusLabel,
  getShiftLabel,
  getStoredWeekStartDate,
  getVariantLabel,
  importSlotLabels,
  isMeaningfulMenuDiff,
  isValidWeekStartDate,
  LAST_WEEKLY_MENU_CUSTOMER_KEY,
  LAST_WEEKLY_MENU_WEEK_KEY,
  normalizeDishMatchKey,
  parseDisplayDateToIso,
  summarizeImportWarnings,
  toLocalIsoDate,
} from '../weekly-menu/model/formatters';
import {
  aggregateDemandLinesByMaterial,
  buildImportedDayDates,
  buildImportedLayoutRows,
  buildPlanRowsMaterialSummary,
  calculateTotalMaterialCost,
  getNormalizedSlotType,
  getQuickServingKey,
  isWeeklyMenuRowContinuation,
  matchesCategory,
  matchesShift,
  QUICK_SERVING_SHIFTS,
  runInBatches,
  SECTIONS,
} from '../weekly-menu/model/scope';
import type {
  PurchaseSummaryMaterialEntry,
  QuickServingShiftName,
  ServingsStatus,
  WeeklyMenuImportJob,
  WeeklyMenuView,
  WeeklyPlanRow,
} from '../weekly-menu/model/types';
import {
  buildImportDuplicateGroups,
  buildImportValidationChecks,
  getBlockingImportIssues,
  getImportJobStatusClass,
  getImportWizardStep,
  getImportWizardStepClass,
  hasBlockingImportIssues,
  importWizardSteps,
} from '../weekly-menu/import/importValidation';

const tableHeadClass = 'text-center';
const tableCellClass = 'text-center';
const PURCHASE_SUMMARY_PAGE_SIZE = 10;

const WeeklyMenuPage = () => {
  const dispatch = useAppDispatch();
  const reduxWeeklyMenu = useAppSelector((state) => state.coordination.weeklyMenu);
  const orders = useAppSelector((state) => state.coordination.orders);
  const lockedShifts = useAppSelector((state) => state.coordination.lockedShifts);
  const {
    data: catalogDishes = [],
    isLoading: isCatalogLoading,
    isError: isCatalogError,
  } = useGetDishesCatalogQuery();
  const isCatalogEmpty = !isCatalogLoading && !isCatalogError && catalogDishes.length === 0;

  const {
    data: customerResponse,
    isLoading: isCustomerLoading,
    isError: isCustomerError,
    refetch: refetchCustomers,
  } = useGetCoordinationCustomersQuery();
  const customers = customerResponse?.data ?? [];
  const { data: customerContractsResponse } = useGetCustomerContractsQuery();
  const customerContracts = customerContractsResponse?.data ?? [];
  const [previewImport, { isLoading: isPreviewingImport }] = usePreviewWeeklyMenuImportMutation();
  const [downloadWeeklyMenuTemplate, { isLoading: isDownloadingWeeklyMenuTemplate }] = useDownloadWeeklyMenuTemplateMutation();
  const [commitImport, { isLoading: isCommittingImport }] = useCommitWeeklyMenuImportMutation();
  const [saveImportMapping, { isLoading: isSavingImportMapping }] = useSaveCustomerImportMappingMutation();
  const [createCustomerContract, { isLoading: isCreatingImportCustomer }] = useCreateCustomerContractMutation();
  const [updateWeeklyMenuBulk, { isLoading: isSavingEdit }] = useUpdateWeeklyMenuBulkMutation();
  const { data: importHistoryData } = useGetWeeklyMenuImportHistoryQuery();
  const importHistory = useMemo(() => importHistoryData?.data ?? [], [importHistoryData]);
  const [rollbackImport, { isLoading: isRollingBackImport }] = useRollbackWeeklyMenuImportMutation();
  const [rollbackTarget, setRollbackTarget] = useState<{ menuVersionId: string; label: string } | null>(null);

  const requestRollbackImport = (menuVersionId: string, label: string) => {
    setRollbackTarget({ menuVersionId, label });
  };

  const confirmRollbackImport = async () => {
    if (!rollbackTarget) {
      return;
    }
    const { menuVersionId, label } = rollbackTarget;
    setRollbackTarget(null);

    try {
      await rollbackImport(menuVersionId).unwrap();
      setImportFeedback({
        title: 'Đã hủy phiên import',
        message: `Lịch thực đơn của "${label}" đã bị xóa. Có thể import lại file khác cho tuần này.`,
        variant: 'info',
      });
    } catch (err: unknown) {
      setImportFeedback({
        title: 'Hủy phiên import thất bại',
        message: getApiErrorMessage(err, 'Không thể hủy phiên import này.'),
        variant: 'danger',
      });
    }
  };
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedMenuCustomerId, setSelectedMenuCustomerId] = useState(
    () => window.localStorage.getItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) ?? '',
  );
  const effectiveMenuCustomerId = selectedMenuCustomerId;
  const [committedMenuWeekStartDate, setCommittedMenuWeekStartDate] = useState(
    getStoredWeekStartDate,
  );
  const [draftImportCustomerId, setDraftImportCustomerId] = useState('');
  const [isQuickCustomerFormOpen, setIsQuickCustomerFormOpen] = useState(false);
  const [quickCustomerCode, setQuickCustomerCode] = useState('');
  const [quickCustomerName, setQuickCustomerName] = useState('');
  const [importWeekStartDate, setImportWeekStartDate] = useState('');
  const [importPriceTierAmount, setImportPriceTierAmount] = useState<BomPriceTier>(DEFAULT_BOM_PRICE_TIER);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importJobs, setImportJobs] = useState<WeeklyMenuImportJob[]>([]);
  const [selectedImportJobId, setSelectedImportJobId] = useState('');
  const [importFeedback, setImportFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const isImporting = isPreviewingImport || isCommittingImport || isCreatingImportCustomer || importJobs.some((job) => job.status === 'previewing' || job.status === 'committing');
  const {
    currentData: committedMenuResponse,
    isFetching: isCommittedMenuFetching,
  } = useGetCommittedWeeklyMenuQuery(
    {
      customerId: effectiveMenuCustomerId,
      weekStartDate: committedMenuWeekStartDate || undefined,
    },
    { skip: !effectiveMenuCustomerId },
  );
  const committedMenu = committedMenuResponse?.data;
  const displayedWeekStartDate = committedMenuWeekStartDate || committedMenu?.weekStartDate?.split('T')[0] || '';
  const menuScheduleWeekStartDate = committedMenu?.weekStartDate?.split('T')[0] ?? (committedMenuWeekStartDate || undefined);
  const {
    currentData: menuSchedulesResponse,
  } = useGetMenuSchedulesQuery(
    {
      customerId: effectiveMenuCustomerId,
      ...(menuScheduleWeekStartDate ? { weekStartDate: menuScheduleWeekStartDate } : {}),
    },
    { skip: !effectiveMenuCustomerId },
  );
  const menuSchedules = useMemo(() => menuSchedulesResponse?.data ?? [], [menuSchedulesResponse?.data]);
  const {
    currentData: mealQuantityPlansResponse,
  } = useGetMealQuantityPlansQuery(
    {
      customerId: effectiveMenuCustomerId,
      ...(menuScheduleWeekStartDate ? { weekStartDate: menuScheduleWeekStartDate } : {}),
    },
    { skip: !effectiveMenuCustomerId || !menuScheduleWeekStartDate },
  );
  const mealQuantityPlans = useMemo(() => mealQuantityPlansResponse?.data ?? [], [mealQuantityPlansResponse?.data]);
  const committedMenuDates = useMemo(
    () => (committedMenu?.rows ? buildImportedDayDates(committedMenu.rows) : {}),
    [committedMenu],
  );
  const displayDays = useMemo(
    () => DEFAULT_DAYS_OF_WEEK.map((day) => ({
      ...day,
      date: committedMenuDates[day.key] ?? day.date,
    })),
    [committedMenuDates],
  );
  const todayIso = toLocalIsoDate(new Date());
  const activeServiceDay = displayDays.find((day) => parseDisplayDateToIso(day.date) === todayIso);
  const activeServiceLabel = activeServiceDay
    ? `${activeServiceDay.label} - ${activeServiceDay.date}`
    : `Ngoài tuần menu (${formatImportDate(todayIso)})`;
  const selectedCustomer = customers.find((customer) => customer.customerId === effectiveMenuCustomerId);
  const selectedCustomerContract = customerContracts.find((contract) => contract.customerId === effectiveMenuCustomerId);
  const scheduleMenuPrices = menuSchedules
    .filter((schedule) => !effectiveMenuCustomerId || schedule.customerId === effectiveMenuCustomerId)
    .map((schedule) => schedule.menuPrice)
    .filter((price) => Number.isFinite(price) && price > 0);
  const scheduleFixedTiers = scheduleMenuPrices.filter(isBomPriceTier).map(normalizeBomPriceTier);
  const invalidScheduleMenuPrices = scheduleMenuPrices.filter((price) => !isBomPriceTier(price));
  const contractFixedTier = normalizeBomPriceTier(selectedCustomerContract?.defaultMenuPrice);
  const menuPrice = scheduleFixedTiers[0] ?? contractFixedTier;
  const menuPriceSource = scheduleFixedTiers.length > 0
    ? 'Lịch menu'
    : selectedCustomerContract?.defaultMenuPrice
      ? 'Hợp đồng'
      : 'Mặc định';
  const fixedBomRatePercent = 100;
  const draftImportCustomer = customers.find((customer) => customer.customerId === draftImportCustomerId);
  const selectedImportFileMeta = selectedImportFile
    ? `${selectedImportFile.name} • ${formatFileSize(selectedImportFile.size)}`
    : 'Chưa chọn file Excel';
  const committedLayoutRows = useMemo(
    () => buildImportedLayoutRows(committedMenu?.rows ?? []),
    [committedMenu],
  );
  const selectedImportJob = importJobs.find((job) => job.jobId === selectedImportJobId) ?? importJobs[0];
  const selectedImportPreview = selectedImportJob?.previewResult ?? null;
  const importPreviewLayoutRows = useMemo(
    () => buildImportedLayoutRows(selectedImportPreview?.rows ?? []),
    [selectedImportPreview],
  );
  const importPreviewDisplayDays = useMemo(() => {
    const previewDates = selectedImportPreview ? buildImportedDayDates(selectedImportPreview.rows) : {};
    return DEFAULT_DAYS_OF_WEEK.map((day) => ({
      ...day,
      date: previewDates[day.key] ?? displayDays.find((displayDay) => displayDay.key === day.key)?.date ?? day.date,
    }));
  }, [displayDays, selectedImportPreview]);
  const selectedImportPreviewActiveDayKey = importPreviewDisplayDays.find((day) => parseDisplayDateToIso(day.date) === todayIso)?.key;
  const importWizardStep = getImportWizardStep(importJobs);
  const selectedImportValidationChecks = useMemo(
    () => buildImportValidationChecks(selectedImportJob),
    [selectedImportJob],
  );
  const selectedImportDuplicateGroups = useMemo(
    () => buildImportDuplicateGroups(selectedImportPreview?.rows ?? []),
    [selectedImportPreview],
  );
  const selectedImportIssues = useMemo(
    () => selectedImportPreview?.validation?.issues ?? [],
    [selectedImportPreview],
  );
  const selectedImportDiffRows = useMemo(
    () => selectedImportPreview?.previewDiff.rows.filter(isMeaningfulMenuDiff) ?? [],
    [selectedImportPreview],
  );
  const selectedImportWarningSummary = useMemo(
    () => summarizeImportWarnings(selectedImportPreview?.warnings ?? []),
    [selectedImportPreview],
  );
  const selectedImportWarningMessages = selectedImportWarningSummary.slice(0, 4);
  const selectedImportBlockingIssueCount = selectedImportValidationChecks.filter((check) => check.blocking).length;
  const selectedImportProblemMessages = (() => {
    if (selectedImportIssues.length > 0) {
      return selectedImportIssues.slice(0, 5).map((issue) =>
        `${issue.cell ?? issue.column ?? issue.field ?? 'Trong file'}: ${issue.message}`,
      );
    }

    if (selectedImportDuplicateGroups.length > 0) {
      return selectedImportDuplicateGroups
        .slice(0, 3)
        .map((group) => `${group.label}: ${group.rowCount} dòng bị trùng`);
    }

    if (selectedImportJob?.error) {
      return [selectedImportJob.error];
    }

    if (selectedImportBlockingIssueCount > 0) {
      return ['Sửa lỗi trong file Excel rồi bấm Kiểm tra lại.'];
    }

    return [];
  })();
  const hiddenImportFeedbackByDetail =
    (importFeedback?.variant === 'danger' && selectedImportProblemMessages.length > 0) ||
    (importFeedback?.variant === 'warning' && selectedImportWarningMessages.length > 0);
  const readyImportJobs = importJobs.filter((job) =>
    job.status === 'previewed' &&
    job.previewResult &&
    !job.error &&
    !hasBlockingImportIssues(job.previewResult),
  );
  const workflowReportQuery = useMemo(() => ({
    limit: 100,
    customerId: effectiveMenuCustomerId,
    dateFrom: committedMenu?.weekStartDate?.split('T')[0] ?? (committedMenuWeekStartDate || undefined),
    dateTo: committedMenu?.weekEndDate?.split('T')[0] ?? undefined,
  }), [committedMenu?.weekEndDate, committedMenu?.weekStartDate, committedMenuWeekStartDate, effectiveMenuCustomerId]);

  const resetImportDialog = () => {
    setSelectedImportFile(null);
    setImportPriceTierAmount(DEFAULT_BOM_PRICE_TIER);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
    setImportJobs([]);
    setSelectedImportJobId('');
    setIsQuickCustomerFormOpen(false);
    setQuickCustomerCode('');
    setQuickCustomerName('');
    setImportFeedback(null);
  };

  const handleImportClick = () => {
    resetImportDialog();
    setDraftImportCustomerId(effectiveMenuCustomerId);
    setImportWeekStartDate(committedMenu?.weekStartDate?.split('T')[0] ?? committedMenuWeekStartDate);
    setImportPriceTierAmount(menuPrice);
    setIsImportDialogOpen(true);
  };

  const handleDownloadWeeklyMenuTemplate = async () => {
    if (!draftImportCustomer) {
      setImportFeedback({
        title: 'Chọn khách hàng',
        message: 'Vui lòng chọn hoặc tạo khách hàng trước khi tải mẫu thực đơn riêng.',
        variant: 'warning',
      });
      return;
    }

    if (!isValidWeekStartDate(importWeekStartDate)) {
      setImportFeedback({
        title: 'Chọn tuần bắt đầu',
        message: 'Vui lòng chọn ngày thứ 2 trước khi tải mẫu để file có đúng cột ngày trong tuần.',
        variant: 'warning',
      });
      return;
    }

    try {
      const blob = await downloadWeeklyMenuTemplate({
        customerId: draftImportCustomer.customerId,
        weekStartDate: importWeekStartDate,
      }).unwrap();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `weekly-menu-template-${draftImportCustomer.customerCode}-${importWeekStartDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setImportFeedback({
        title: 'Đã tải mẫu thực đơn',
        message: `File ${draftImportCustomer.customerCode} có 3 sheet 25k, 30k, 34k theo bố cục riêng của khách hàng.`,
        variant: 'info',
      });
    } catch (err: unknown) {
      setImportFeedback({
        title: 'Tải mẫu thất bại',
        message: getApiErrorMessage(err, 'Không thể tải mẫu thực đơn tuần.'),
        variant: 'danger',
      });
    }
  };

  const handleCreateQuickImportCustomer = async () => {
    const customerCode = quickCustomerCode.trim().toUpperCase();
    const customerName = quickCustomerName.trim();

    if (!customerCode || !customerName) {
      setImportFeedback({
        title: 'Thiếu thông tin khách hàng',
        message: 'Vui lòng nhập mã khách hàng và tên khách hàng trước khi tạo mới.',
        variant: 'warning',
      });
      return;
    }

    const body: CreateCustomerContractRequest = {
      customerCode,
      customerName,
      note: 'Tạo nhanh khi nhập thực đơn từ Excel',
      isActive: true,
      activeWeekDays: ['t2', 't3', 't4', 't5', 't6', 't7'],
      shiftNames: ['MORNING', 'AFTERNOON'],
      defaultMenuPrice: importPriceTierAmount,
      defaultBomRatePercent: 100,
    };

    try {
      setImportFeedback({
        title: 'Đang tạo khách hàng',
        message: `Hệ thống đang tạo ${customerCode} để nhập thực đơn.`,
        variant: 'info',
      });
      const response = await createCustomerContract(body).unwrap();
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không tạo được khách hàng.');
      }

      await refetchCustomers();
      setDraftImportCustomerId(response.data.customerId);
      setSelectedMenuCustomerId(response.data.customerId);
      resetScopedWeeklyMenuUi();
      window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, response.data.customerId);
      setQuickCustomerCode('');
      setQuickCustomerName('');
      setIsQuickCustomerFormOpen(false);
      setImportFeedback({
        title: 'Đã tạo khách hàng mới',
        message: `${response.data.customerCode} - ${response.data.customerName} đã được chọn cho file này.`,
        variant: 'info',
      });
    } catch (err: unknown) {
      setImportFeedback({
        title: 'Tạo khách hàng thất bại',
        message: getApiErrorMessage(err, 'Không thể tạo khách hàng mới.'),
        variant: 'danger',
      });
    }
  };

  const handleAddImportJob = () => {
    const customerId = draftImportCustomerId;
    const customer = customers.find((item) => item.customerId === customerId);
    if (!customer || !selectedImportFile) {
      setImportFeedback({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn khách hàng và file Excel trước khi kiểm tra.',
        variant: 'warning',
      });
      return;
    }

    if (!isValidWeekStartDate(importWeekStartDate)) {
      setImportFeedback({
        title: 'Ngày bắt đầu tuần không hợp lệ',
        message: 'Vui lòng chọn ngày thứ 2 để hệ thống đọc đúng các cột trong tuần.',
        variant: 'warning',
      });
      return;
    }

    const nextJob: WeeklyMenuImportJob = {
      jobId: `import-${customer.customerId}`,
      customerId: customer.customerId,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      weekStartDate: importWeekStartDate,
      priceTierAmount: importPriceTierAmount,
      file: selectedImportFile,
      fileName: selectedImportFile.name,
      fileSize: selectedImportFile.size,
      status: 'idle',
      previewResult: null,
      warnings: [],
      error: null,
    };

    setImportJobs((currentJobs) => {
      const exists = currentJobs.some((job) => job.customerId === nextJob.customerId);
      const nextJobs = exists
        ? currentJobs.map((job) => (job.customerId === nextJob.customerId ? nextJob : job))
        : [...currentJobs, nextJob];

      return nextJobs;
    });
    setSelectedImportJobId(nextJob.jobId);
    setSelectedImportFile(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = '';
    }
    setImportFeedback({
      title: 'Đã thêm file',
      message: `${nextJob.customerCode} - ${nextJob.customerName} đã sẵn sàng để kiểm tra. Nếu khách này đã có trong danh sách, hệ thống đã thay bằng file mới.`,
      variant: 'info',
    });
  };

  const handleRemoveImportJob = (jobId: string) => {
    setImportJobs((currentJobs) => {
      const nextJobs = currentJobs.filter((job) => job.jobId !== jobId);
      if (selectedImportJobId === jobId) {
        setSelectedImportJobId(nextJobs[0]?.jobId ?? '');
      }

      return nextJobs;
    });
  };

  const handlePreviewImportJob = async (jobId: string) => {
    const job = importJobs.find((item) => item.jobId === jobId);
    if (!job) return;

    try {
      setSelectedImportJobId(jobId);
      setImportJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === jobId
            ? { ...item, status: 'previewing', error: null, warnings: [], previewResult: null }
            : item,
        ),
      );
      setImportFeedback({
        title: 'Đang kiểm tra file',
        message: `Hệ thống đang đọc ${job.fileName} cho ${job.customerCode}.`,
        variant: 'info',
      });
      const response = await previewImport({
        file: job.file,
        customerId: job.customerId,
        weekStartDate: job.weekStartDate || undefined,
        priceTierAmount: job.priceTierAmount,
      }).unwrap();
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không đọc được file thực đơn.');
      }
      const result = response.data;
      const blockingIssues = getBlockingImportIssues(result);

      setImportJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === jobId
            ? {
              ...item,
              status: blockingIssues.length > 0 ? 'failed' : 'previewed',
              previewResult: result,
              warnings: result.warnings,
              error: blockingIssues[0] ?? null,
            }
            : item,
        ),
      );
      setImportFeedback({
        title: blockingIssues.length > 0 ? 'File có lỗi cần sửa' : 'File đã kiểm tra xong',
        message: blockingIssues[0] ?? `${result.customerCode}: tìm thấy ${result.detectedLayout.rowsImported} dòng món hợp lệ, bỏ qua ${result.detectedLayout.rowsSkipped} dòng không phải món.`,
        variant: blockingIssues.length > 0 ? 'danger' : result.warnings.length > 0 ? 'warning' : 'info',
      });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Không thể kiểm tra file thực đơn.');
      setImportJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === jobId
            ? { ...item, status: 'failed', previewResult: null, warnings: [], error: message }
            : item,
        ),
      );
      setImportFeedback({
        title: 'Kiểm tra file thất bại',
        message,
        variant: 'danger',
      });
    }
  };

  const handlePreviewAllImportJobs = async () => {
    if (importJobs.length === 0) {
      setImportFeedback({
        title: 'Chưa có file',
        message: 'Vui lòng thêm ít nhất một khách hàng và file Excel.',
        variant: 'warning',
      });
      return;
    }

    for (const job of importJobs) {
      if (job.status !== 'committed') {
        await handlePreviewImportJob(job.jobId);
      }
    }
  };

  const handleCommitImportJob = async (jobId: string) => {
    const job = importJobs.find((item) => item.jobId === jobId);
    if (!job?.previewResult) {
      setImportFeedback({
        title: 'Chưa kiểm tra file',
        message: 'Vui lòng kiểm tra file trước khi lưu.',
        variant: 'warning',
      });
      return;
    }

    const blockingIssues = getBlockingImportIssues(job.previewResult);
    if (blockingIssues.length > 0) {
      setImportFeedback({
        title: 'File chưa thể lưu',
        message: blockingIssues[0],
        variant: 'danger',
      });
      return;
    }

    try {
      setSelectedImportJobId(jobId);
      setImportJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === jobId
            ? { ...item, status: 'committing', error: null }
            : item,
        ),
      );
      setImportFeedback({
        title: 'Đang lưu thực đơn',
        message: `Hệ thống đang ghi thực đơn cho ${job.customerCode}.`,
        variant: 'info',
      });
      const response = await commitImport({
        file: job.file,
        customerId: job.customerId,
        weekStartDate: job.weekStartDate || undefined,
        priceTierAmount: job.priceTierAmount,
      }).unwrap();
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không lưu được thực đơn.');
      }
      const result = response.data;

      setImportJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === jobId
            ? {
              ...item,
              status: 'committed',
              previewResult: result,
              warnings: result.warnings,
              error: null,
            }
            : item,
        ),
      );

      const shouldFocusCommittedCustomer = importJobs.length === 1 || result.customerId === effectiveMenuCustomerId;
      if (shouldFocusCommittedCustomer) {
        window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, result.customerId);
        setSelectedMenuCustomerId(result.customerId);
        resetScopedWeeklyMenuUi();
        if (result.weekStartDate) {
          window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, result.weekStartDate);
          setCommittedMenuWeekStartDate(result.weekStartDate);
        }
        dispatch(setWeeklyMenu(result.importedWeeklyMenu));
      }
      setImportFeedback({
        title: result.warnings.length > 0 ? 'Đã lưu thực đơn (có cảnh báo)' : 'Đã lưu thực đơn',
        message: `${result.customerCode}: đã lưu ${result.detectedLayout.rowsImported} dòng món, bỏ qua ${result.detectedLayout.rowsSkipped} dòng không phải món.`,
        variant: result.warnings.length > 0 ? 'warning' : 'info',
      });
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Không thể lưu thực đơn.');
      setImportJobs((currentJobs) =>
        currentJobs.map((item) =>
          item.jobId === jobId
            ? { ...item, status: 'failed', error: message }
            : item,
        ),
      );
      setImportFeedback({
        title: 'Lưu thực đơn thất bại',
        message,
        variant: 'danger',
      });
    }
  };

  const handleSaveImportMapping = async () => {
    if (!selectedImportPreview || !selectedImportJob) {
      return;
    }

    try {
      await saveImportMapping({
        customerId: selectedImportJob.customerId,
        sheetNameHint: selectedImportPreview.detectedLayout.sheetName,
        labelColumn: selectedImportPreview.detectedLayout.labelColumn,
      }).unwrap();
      setImportFeedback({
        title: 'Đã ghi nhớ cách đọc file',
        message: `Lần sau của ${selectedImportJob.customerCode}, hệ thống sẽ đọc file theo mẫu này nhanh hơn.`,
        variant: 'info',
      });
    } catch (err: unknown) {
      setImportFeedback({
        title: 'Chưa ghi nhớ được cách đọc file',
        message: getApiErrorMessage(err, 'Không thể lưu cách đọc file cho khách hàng này.'),
        variant: 'danger',
      });
    }
  };

  const handleCommitReadyImportJobs = async () => {
    const jobsToCommit = importJobs.filter((job) => job.status === 'previewed' && job.previewResult && !job.error);
    if (jobsToCommit.length === 0) {
      setImportFeedback({
        title: 'Chưa có dòng hợp lệ để lưu',
        message: 'Chỉ những file đã kiểm tra xong và không có lỗi mới được lưu.',
        variant: 'warning',
      });
      return;
    }

    for (const job of jobsToCommit) {
      await handleCommitImportJob(job.jobId);
    }
  };

  useEffect(() => {
    if (!committedMenu?.importedWeeklyMenu || Object.keys(committedMenu.importedWeeklyMenu).length === 0) {
      dispatch(setWeeklyMenu({}));
      return;
    }

    dispatch(setWeeklyMenu(committedMenu.importedWeeklyMenu));
  }, [committedMenu, dispatch]);

  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [activeView, setActiveView] = useState<WeeklyMenuView>('schedule');
  const [selectedCostDayKey, setSelectedCostDayKey] = useState<string | null>(null);
  const [selectedDemandDayKey, setSelectedDemandDayKey] = useState<string | null>(null);
  const [activeDemandAggregatePageNumber, setActiveDemandAggregatePageNumber] = useState(1);
  const [purchaseSummaryPageIndex, setPurchaseSummaryPageIndex] = useState(0);
  const [productionPlanPageIndex, setProductionPlanPageIndex] = useState(0);
  const [weeklyProductionPlans, setWeeklyProductionPlans] = useState<ProductionPlanDto[]>([]);
  const [isLoadingWeeklyProductionPlans, setIsLoadingWeeklyProductionPlans] = useState(false);
  const [warehouseExportFeedback, setWarehouseExportFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const [demandFeedback, setDemandFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const [quickServingInputs, setQuickServingInputs] = useState<Record<string, string>>({});

  const resetScopedWeeklyMenuUi = () => {
    dispatch(setWeeklyMenu({}));
    setSelectedCostDayKey(null);
    setSelectedDemandDayKey(null);
    setActiveDemandAggregatePageNumber(1);
    setPurchaseSummaryPageIndex(0);
    setProductionPlanPageIndex(0);
    setSelectedDishId('');
    setWarehouseExportFeedback(null);
    setDemandFeedback(null);
    setQuickServingInputs({});
  };

  const { currentData: demandLines = [] } = useGetIngredientDemandQuery(workflowReportQuery, { skip: !effectiveMenuCustomerId });
  const [fetchProductionPlansForDate] = useLazyGetProductionPlansQuery();
  const selectedProductionPlanServiceDate = useMemo(() => {
    if (!selectedDemandDayKey) return undefined;
    return parseDisplayDateToIso(displayDays.find((day) => day.key === selectedDemandDayKey)?.date);
  }, [displayDays, selectedDemandDayKey]);
  const { currentData: productionPlansData } = useGetProductionPlansQuery(
    { customerId: effectiveMenuCustomerId, serviceDate: selectedProductionPlanServiceDate },
    { skip: !effectiveMenuCustomerId || !selectedProductionPlanServiceDate }
  );
  const productionPlanWeekDates = useMemo(
    () => displayDays
      .map((day) => parseDisplayDateToIso(day.date))
      .filter((date): date is string => Boolean(date)),
    [displayDays],
  );

  useEffect(() => {
    if (!effectiveMenuCustomerId || selectedProductionPlanServiceDate || productionPlanWeekDates.length === 0) {
      return;
    }

    let isCancelled = false;
    queueMicrotask(() => {
      if (!isCancelled) {
        setIsLoadingWeeklyProductionPlans(true);
      }
    });

    void (async () => {
      try {
        const responses = await Promise.all(
          productionPlanWeekDates.map((serviceDate) =>
            fetchProductionPlansForDate(
              { customerId: effectiveMenuCustomerId, serviceDate },
              true,
            ).unwrap().catch(() => null),
          ),
        );

        if (!isCancelled) {
          setWeeklyProductionPlans(responses.flatMap((response) => response?.data ?? []));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingWeeklyProductionPlans(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [effectiveMenuCustomerId, fetchProductionPlansForDate, productionPlanWeekDates, selectedProductionPlanServiceDate]);

  const productionPlans = useMemo(() => {
    if (!effectiveMenuCustomerId) return [];
    const plans = selectedProductionPlanServiceDate ? (productionPlansData?.data ?? []) : weeklyProductionPlans;
    return filterProductionPlansForSelection(plans, productionPlanWeekDates, selectedProductionPlanServiceDate);
  }, [effectiveMenuCustomerId, productionPlansData?.data, productionPlanWeekDates, selectedProductionPlanServiceDate, weeklyProductionPlans]);
  const productionDisplayDayByDate = useMemo(
    () => buildProductionDisplayDayByDate(displayDays, parseDisplayDateToIso),
    [displayDays],
  );
  const productionPlanPages = useMemo(
    () => buildProductionPlanPages(productionPlans, productionDisplayDayByDate),
    [productionDisplayDayByDate, productionPlans],
  );
  const safeProductionPlanPageIndex = getSafeProductionPlanPageIndex(
    productionPlanPages.length,
    productionPlanPageIndex,
  );
  const activeProductionPlanPage = productionPlanPages[safeProductionPlanPageIndex];
  const aggregatedDemandLines = useMemo(() => aggregateDemandLinesByMaterial(demandLines), [demandLines]);
  const { currentData: workflowDocuments = [] } = useGetWorkflowDocumentsQuery(workflowReportQuery, { skip: !effectiveMenuCustomerId });
  const [generateMaterialDemand, { isLoading: isGeneratingDemand }] = useGenerateMaterialDemandMutation();
  const [upsertQuickServings, { isLoading: isSavingQuickServings }] = useUpsertQuickServingsMutation();
  const dishesById = useMemo(() => new Map(catalogDishes.map((dish) => [dish.id, dish])), [catalogDishes]);
  const dishesByName = useMemo(
    () => new Map(catalogDishes.map((dish) => [normalizeDishMatchKey(dish.name), dish])),
    [catalogDishes],
  );

  const getSectionDishes = (section: (typeof SECTIONS)[number]) =>
    catalogDishes.filter((dish) => matchesShift(dish, section.shift) && matchesCategory(dish, section.category));

  const getSectionDefaultDish = (section: (typeof SECTIONS)[number]) =>
    getSectionDishes(section)[0] ?? catalogDishes[0];

  // Modal state for bulk editing the entire menu
  const [isEditingMenu, setIsEditingMenu] = useState<boolean>(false);
  const [tempWeeklyMenu, setTempWeeklyMenu] = useState<WeeklyMenuState>({});

  const handleOpenEdit = () => {
    const clone: WeeklyMenuState = {};
    displayDays.forEach((day) => {
      clone[day.key] = {
        morningSavory: { ...weeklyMenu[day.key]?.morningSavory },
        morningVegetarian: { ...weeklyMenu[day.key]?.morningVegetarian },
        afternoonSavory: { ...weeklyMenu[day.key]?.afternoonSavory },
        afternoonVegetarian: { ...weeklyMenu[day.key]?.afternoonVegetarian },
      };
    });
    setTempWeeklyMenu(clone);
    setIsEditingMenu(true);
  };

  function getServiceDateIso(dayKey: string) {
    const row = committedMenu?.rows?.find((r) => r.dayKey === dayKey);
    if (row?.serviceDate) {
      return row.serviceDate.split('T')[0];
    }
    return '';
  }

  const activeCustomerOrders = useMemo(
    () => orders.filter((order) => order.customerId === effectiveMenuCustomerId),
    [effectiveMenuCustomerId, orders],
  );

  const quantityPlanByDateShift = useMemo(() => {
    const map = new Map<string, { servings: number; status: ServingsStatus; statusLabel: string }>();

    mealQuantityPlans.forEach((plan) => {
      const serviceDate = plan.serviceDate.split('T')[0];
      const planStatus = plan.status.toUpperCase();
      const isConfirmedPlan = planStatus === 'CONFIRMED' || planStatus === 'COMPLETED';

      plan.lines
        .filter((line) => !effectiveMenuCustomerId || line.customerId === effectiveMenuCustomerId)
        .forEach((line) => {
          const key = `${serviceDate}|${line.shiftName}`;
          const current = map.get(key);
          const servings = line.finalServings || line.confirmedServings || line.adjustedServings || line.forecastServings || 0;
          const lineConfirmed = isConfirmedPlan && servings > 0;
          const status: ServingsStatus = lineConfirmed ? 'confirmed' : servings > 0 ? 'draft' : 'missing';
          const nextServings = (current?.servings ?? 0) + servings;
          const nextStatus: ServingsStatus = current?.status === 'confirmed' || status === 'confirmed'
            ? 'confirmed'
            : current?.status === 'draft' || status === 'draft'
              ? 'draft'
              : 'missing';

          map.set(key, {
            servings: nextServings,
            status: nextStatus,
            statusLabel: nextStatus === 'confirmed' ? 'Đã chốt suất' : `Chưa chốt (${plan.status})`,
          });
        });
    });

    return map;
  }, [effectiveMenuCustomerId, mealQuantityPlans]);

  const getShiftServingInfo = (dayKey: string, shiftName: 'MORNING' | 'AFTERNOON') => {
    const serviceDate = getServiceDateIso(dayKey);
    const quantityInfo = serviceDate ? quantityPlanByDateShift.get(`${serviceDate}|${shiftName}`) : undefined;
    if (quantityInfo && quantityInfo.servings > 0) {
      return quantityInfo;
    }

    const shiftLabel = shiftName === 'MORNING' ? 'Ca Sáng' : 'Ca Chiều';
    const isShiftLocked = !!lockedShifts[`${dayKey}-${shiftLabel}`];
    const draftOrders = activeCustomerOrders.filter((order) => order.dayOfWeek === dayKey && order.shift === shiftLabel);
    const draftServings = draftOrders.reduce(
      (sum, order) => sum + (isShiftLocked ? order.actualQuantity : order.forecastQuantity),
      0,
    );

    if (draftServings > 0) {
      return {
        servings: draftServings,
        status: 'draft' as ServingsStatus,
        statusLabel: 'Dự kiến điều phối',
      };
    }

    return {
      servings: 0,
      status: 'missing' as ServingsStatus,
      statusLabel: 'Chưa có số suất',
    };
  };

  const getSlotServingInfo = (
    dayKey: string,
    slotType: 'morningSavory' | 'morningVegetarian' | 'afternoonSavory' | 'afternoonVegetarian',
  ) => {
    const isMorning = slotType.startsWith('morning');
    const shiftInfo = getShiftServingInfo(dayKey, isMorning ? 'MORNING' : 'AFTERNOON');
    const savoryPortions = Math.round(shiftInfo.servings * 0.85);
    const vegetarianPortions = shiftInfo.servings - savoryPortions;
    const calculatedPortions = slotType.endsWith('Vegetarian') ? vegetarianPortions : savoryPortions;
    const importedPortions = reduxWeeklyMenu[dayKey]?.[slotType]?.portions ?? 0;

    if (shiftInfo.servings > 0) {
      return {
        portions: calculatedPortions,
        importedPortions,
        status: shiftInfo.status,
        statusLabel: shiftInfo.statusLabel,
        hasConfirmedServings: shiftInfo.status === 'confirmed',
      };
    }

    return {
      portions: importedPortions,
      importedPortions,
      status: importedPortions > 0 ? 'import-default' as ServingsStatus : 'missing' as ServingsStatus,
      statusLabel: importedPortions > 0 ? 'Suất tạm từ import' : 'Chưa có số suất',
      hasConfirmedServings: importedPortions > 0,
    };
  };

  const scheduleByDateShift = useMemo(() => {
    const schedules = new Map<string, (typeof menuSchedules)[number]>();
    menuSchedules
      .filter((schedule) => !effectiveMenuCustomerId || schedule.customerId === effectiveMenuCustomerId)
      .forEach((schedule) => {
        schedules.set(`${schedule.serviceDate.split('T')[0]}|${schedule.shiftName}`, schedule);
      });
    return schedules;
  }, [effectiveMenuCustomerId, menuSchedules]);

  const getLinePricing = (serviceDate: string, shiftName: string) => {
    const schedule = scheduleByDateShift.get(`${serviceDate.split('T')[0]}|${shiftName}`);
    const lineMenuPrice = normalizeBomPriceTier(schedule?.menuPrice ?? menuPrice);
    return {
      menuPrice: lineMenuPrice,
      bomRatePercent: fixedBomRatePercent,
      quantityFactor: 1,
    };
  };

  const handleGenerateDemand = async () => {
    if (!effectiveMenuCustomerId) {
      setDemandFeedback({
        title: 'Chưa chọn khách hàng',
        message: 'Vui lòng chọn khách hàng trước khi tạo nhu cầu nguyên liệu.',
        variant: 'warning',
      });
      return;
    }

    const serviceDates = Array.from(
      new Set(weeklyPlanRows.map((row) => row.serviceDate).filter(Boolean)),
    );

    if (serviceDates.length === 0) {
      setDemandFeedback({
        title: 'Chưa có ngày để tạo demand',
        message: 'Vui lòng import hoặc tải kế hoạch tuần trước khi tạo nhu cầu nguyên liệu.',
        variant: 'warning',
      });
      return;
    }

    if (invalidScheduleMenuPrices.length > 0) {
      setDemandFeedback({
        title: 'Định mức không hợp lệ',
        message: 'Có lịch menu dùng giá ngoài 25k, 30k hoặc 34k. Vui lòng import lại menu với định mức cố định trước khi tạo demand.',
        variant: 'danger',
      });
      return;
    }

    if (weeklyRowsMissingOperationalServings.length > 0) {
      const affectedDates = Array.from(new Set(weeklyRowsMissingOperationalServings.map((row) => row.date))).slice(0, 4);
      setDemandFeedback({
        title: 'Chưa tạo được demand',
        message: `Hiện còn ${weeklyRowsMissingOperationalServings.length} dòng KHSX chưa có số suất vận hành${affectedDates.length > 0 ? ` (${affectedDates.join(', ')})` : ''}. Cần có số suất chốt hoặc suất default import trước khi sinh demand.`,
        variant: 'danger',
      });
      return;
    }

    const serviceDateSet = new Set(serviceDates);
    const quickServingRowsToComplete = quickServingRows
      .filter((row) => serviceDateSet.has(row.serviceDate) && !row.isCompleted)
      .map((row) => ({
        ...row,
        nextServings: Math.round(Number.parseFloat(row.inputValue)),
      }))
      .filter((row) => Number.isFinite(row.nextServings) && row.nextServings > 0);

    if (quickServingRowsToComplete.length > 0) {
      setDemandFeedback({
        title: 'Đang hoàn tất số suất',
        message: `Đang lưu và chốt ${quickServingRowsToComplete.length} ca trước khi tạo nhu cầu nguyên liệu.`,
        variant: 'info',
      });

      try {
        await runInBatches(quickServingRowsToComplete, 3, async (row) => {
          const response = await upsertQuickServings({
            customerId: effectiveMenuCustomerId,
            serviceDate: row.serviceDate,
            shiftName: row.shiftName,
            servings: row.nextServings,
            complete: true,
          }).unwrap();

          if (!response.success) {
            throw new Error(response.message || 'Không hoàn tất được số suất.');
          }
        });

        setQuickServingInputs((current) => {
          const next = { ...current };
          quickServingRowsToComplete.forEach((row) => {
            delete next[row.key];
          });
          return next;
        });
      } catch (error) {
        setDemandFeedback({
          title: 'Chưa hoàn tất được số suất',
          message: getApiErrorMessage(error, 'Không lưu/chốt được số suất đang nhập. Vui lòng kiểm tra lại ngày, ca và khách hàng.'),
          variant: 'danger',
        });
        return;
      }
    }

    setDemandFeedback({
      title: 'Đang tạo demand',
      message: `Đang sinh nhu cầu nguyên liệu cho ${serviceDates.length} ngày trong tuần.`,
      variant: 'info',
    });
    const results = await runInBatches(serviceDates, 2, async (serviceDate) => {
      try {
        const response = await generateMaterialDemand({ serviceDate, customerId: effectiveMenuCustomerId, scope: 'FULLDAY' }).unwrap();
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Không tạo được nhu cầu nguyên liệu.');
        }

        return { serviceDate, response };
      } catch (error) {
        return { serviceDate, error };
      }
    });

    const succeeded = results.filter((result): result is { serviceDate: string; response: NonNullable<(typeof result)['response']> } => 'response' in result);
    const skipped = results.length - succeeded.length;
    const demandLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.lines.length, 0);
    const shortageLineCount = succeeded.reduce(
      (sum, result) => sum + result.response.data!.lines.filter((line) => line.suggestedPurchaseQty > 0).length,
      0,
    );
    const missingBomCount = succeeded.reduce((sum, result) => sum + result.response.data!.missingBomDishes.length, 0);
    const planLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.productionPlanLineCount, 0);
    if (succeeded.length === 0) {
      const firstError = results.find((result) => 'error' in result)?.error;
      setDemandFeedback({
        title: 'Chưa tạo được demand',
        message: getApiErrorMessage(firstError, 'Không tìm thấy số suất đã chốt cho các ngày trong tuần.'),
        variant: 'danger',
      });
      return;
    }

    setDemandFeedback({
      title: skipped > 0 ? 'Đã tạo demand cho ngày đã chốt' : 'Đã tạo demand cho tuần',
      message: `Tạo thành công ${succeeded.length}/${results.length} ngày, ${planLineCount} dòng KHSX, ${demandLineCount} dòng nguyên liệu, ${shortageLineCount} dòng thiếu. ${shortageLineCount > 0 ? 'Kế hoạch thu mua dự kiến sẽ lấy trực tiếp từ demand, tồn kho và pending receipt.' : 'Không phát sinh dòng thiếu để mua thêm.'} ${missingBomCount > 0 ? `${missingBomCount} món chưa có BOM cần bổ sung.` : 'BOM đã đủ cho các dòng sinh demand.'}`,
      variant: missingBomCount > 0 || skipped > 0 ? 'warning' : 'info',
    });
  };

  const saveQuickServingRow = async (row: (typeof quickServingRows)[number]) => {
    if (row.isConfirmed) {
      throw new Error('Ca đã chốt. Điều chỉnh sau chốt cần thực hiện ở Điều phối đơn.');
    }

    if (!effectiveMenuCustomerId) {
      throw new Error('Vui lòng chọn khách hàng trước khi lưu số suất.');
    }

    const nextServings = Number(row.inputValue);
    if (!Number.isFinite(nextServings) || nextServings < 0) {
      throw new Error('Số suất phải lớn hơn hoặc bằng 0.');
    }

    await upsertQuickServings({
      customerId: effectiveMenuCustomerId,
      serviceDate: row.serviceDate,
      shiftName: row.shiftName,
      servings: Math.round(nextServings),
      complete: false,
    }).unwrap();

    setQuickServingInputs((current) => {
      const next = { ...current };
      delete next[row.key];
      return next;
    });
  };

  const handleSaveQuickServings = async (row: (typeof quickServingRows)[number]) => {
    if (!row.hasDraftChange) return;

    try {
      await saveQuickServingRow(row);
      setDemandFeedback({
        title: 'Đã lưu số suất',
        message: `${row.dayLabel} ${row.date} - ${row.shiftLabel}: đã cập nhật số suất dự kiến.`,
        variant: 'info',
      });
    } catch (error) {
      setDemandFeedback({
        title: 'Chưa lưu được số suất',
        message: error instanceof Error ? error.message : 'Vui lòng kiểm tra lại số suất.',
        variant: 'danger',
      });
    }
  };

  const handleLockQuickServings = async (row: (typeof quickServingRows)[number]) => {
    try {
      const nextServings = Number(row.inputValue);
      const finalServings = Number.isFinite(nextServings) && nextServings >= 0
        ? Math.round(nextServings)
        : row.currentServings;
      if (finalServings <= 0) {
        throw new Error('Cần nhập số suất lớn hơn 0 trước khi hoàn tất ca.');
      }

      if (!effectiveMenuCustomerId) {
        throw new Error('Vui lòng chọn khách hàng trước khi hoàn tất ca.');
      }

      await upsertQuickServings({
        customerId: effectiveMenuCustomerId,
        serviceDate: row.serviceDate,
        shiftName: row.shiftName,
        servings: finalServings,
        complete: true,
      }).unwrap();

      setQuickServingInputs((current) => {
        const next = { ...current };
        delete next[row.key];
        return next;
      });

      setDemandFeedback({
        title: 'Đã hoàn tất suất cho KHSX',
        message: `${row.dayLabel} ${row.date} - ${row.shiftLabel}: đã hoàn tất kế hoạch suất. Có thể tạo demand nguyên liệu.`,
        variant: 'info',
      });
    } catch (error) {
      setDemandFeedback({
        title: 'Chưa hoàn tất được suất',
        message: error instanceof Error ? error.message : 'Vui lòng kiểm tra kế hoạch suất trước khi hoàn tất.',
        variant: 'danger',
      });
    }
  };

  const handleSaveEdit = async () => {
    const slotsToUpdate: Array<{ serviceDate: string; shiftName: string; slotType: string; dishId: string }> = [];

    displayDays.forEach((day) => {
      SECTIONS.forEach((sec) => {
        const isLocked = !!lockedShifts[`${day.key}-${sec.slotType.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'}`];
        if (isLocked) return;

        const currentDishId = weeklyMenu[day.key]?.[sec.slotType]?.dishId || getSectionDefaultDish(sec)?.id;
        const newDishId = tempWeeklyMenu[day.key]?.[sec.slotType]?.dishId;
        if (newDishId && newDishId !== currentDishId) {
          const serviceDateIso = getServiceDateIso(day.key);
          if (serviceDateIso) {
            slotsToUpdate.push({
              serviceDate: serviceDateIso,
              shiftName: sec.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
              slotType: sec.slotType,
              dishId: newDishId,
            });
          }
        }
      });
    });

    if (slotsToUpdate.length === 0) {
      setIsEditingMenu(false);
      return;
    }

    try {
      setWarehouseExportFeedback({
        title: 'Đang lưu chỉnh sửa',
        message: 'Hệ thống đang ghi các thay đổi thực đơn vào backend...',
        variant: 'info',
      });

      const response = await updateWeeklyMenuBulk({
        customerId: effectiveMenuCustomerId,
        slots: slotsToUpdate,
      }).unwrap();

      if (!response.success) {
        throw new Error(response.message || 'Không thể lưu chỉnh sửa thực đơn.');
      }

      slotsToUpdate.forEach((slot) => {
        const dayKey = displayDays.find((d) => getServiceDateIso(d.key) === slot.serviceDate)?.key;
        if (dayKey) {
          dispatch(updateWeeklyMenuDish({
            day: dayKey,
            slotType: slot.slotType as 'morningSavory' | 'morningVegetarian' | 'afternoonSavory' | 'afternoonVegetarian',
            dishId: slot.dishId,
          }));
        }
      });

      if (response.data && response.data.length > 0) {
        setWarehouseExportFeedback({
          title: 'Lưu thành công (Có cảnh báo)',
          message: `${response.message}\nCảnh báo:\n` + response.data.map(w => `- ${w}`).join('\n'),
          variant: 'warning',
        });
      } else {
        setWarehouseExportFeedback({
          title: 'Cập nhật thực đơn thành công',
          message: response.message || 'Thay đổi đã được lưu vào database.',
          variant: 'info',
        });
      }

      setIsEditingMenu(false);
    } catch (err: unknown) {
      setWarehouseExportFeedback({
        title: 'Chỉnh sửa thực đơn thất bại',
        message: getApiErrorMessage(err, 'Không thể lưu thay đổi vào backend.'),
        variant: 'danger',
      });
    }
  };

  // Merge dishId from Redux with servings from confirmed quantity plans.
  const weeklyMenu = (() => {
    const merged: WeeklyMenuState = {};

    displayDays.forEach(({ key: day }) => {
      const slots = reduxWeeklyMenu[day];
      if (!slots) return;
      const morningSavoryServing = getSlotServingInfo(day, 'morningSavory');
      const morningVegetarianServing = getSlotServingInfo(day, 'morningVegetarian');
      const afternoonSavoryServing = getSlotServingInfo(day, 'afternoonSavory');
      const afternoonVegetarianServing = getSlotServingInfo(day, 'afternoonVegetarian');

      merged[day] = {
        morningSavory: {
          dishId: slots.morningSavory?.dishId || getSectionDefaultDish(SECTIONS[0])?.id || '',
          portions: morningSavoryServing.portions,
          customComponents: slots.morningSavory?.customComponents,
        },
        morningVegetarian: {
          dishId: slots.morningVegetarian?.dishId || getSectionDefaultDish(SECTIONS[1])?.id || '',
          portions: morningVegetarianServing.portions,
          customComponents: slots.morningVegetarian?.customComponents,
        },
        afternoonSavory: {
          dishId: slots.afternoonSavory?.dishId || getSectionDefaultDish(SECTIONS[2])?.id || '',
          portions: afternoonSavoryServing.portions,
          customComponents: slots.afternoonSavory?.customComponents,
        },
        afternoonVegetarian: {
          dishId: slots.afternoonVegetarian?.dishId || getSectionDefaultDish(SECTIONS[3])?.id || '',
          portions: afternoonVegetarianServing.portions,
          customComponents: slots.afternoonVegetarian?.customComponents,
        },
      };
    });

    return merged;
  })();

  const weeklyPlanRows: WeeklyPlanRow[] = committedMenu?.rows?.length ? committedMenu.rows
    .filter((row, index, rows) => !isWeeklyMenuRowContinuation(row, index, rows))
    .map((row, index) => {
    const catalogDish = (row.dishId ? dishesById.get(row.dishId) : undefined) ?? dishesByName.get(normalizeDishMatchKey(row.dishName));
    const day = displayDays.find((item) => item.key === row.dayKey);
    const slotType = getNormalizedSlotType(row);
    const servingsInfo = getSlotServingInfo(row.dayKey, slotType);
    const calculatedPortions = weeklyMenu[row.dayKey]?.[slotType]?.portions ?? servingsInfo.portions;
    const portions = calculatedPortions > 0 ? calculatedPortions : servingsInfo.importedPortions;
    const serviceDate = row.serviceDate.split('T')[0];
    const linePricing = getLinePricing(serviceDate, row.dbShiftName);

    return {
      key: `import-${row.serviceDate}-${row.sourceSection}-${row.slot}-${index}`,
      dayKey: row.dayKey,
      dayLabel: day?.label ?? row.dayKey.toUpperCase(),
      date: formatImportDate(row.serviceDate),
      serviceDate,
      sectionLabel: row.sourceSection,
      shiftLabel: getShiftLabel(row.dbShiftName),
      menuTypeLabel: getVariantLabel(row.variant),
      slotLabel: row.slotLabel || importSlotLabels[row.slot] || row.slot,
      dishId: catalogDish?.id ?? row.dishId ?? '',
      dishName: formatMenuDishName(row.dishName),
      portions,
      importedPortions: servingsInfo.importedPortions,
      servingsStatus: servingsInfo.status,
      servingsStatusLabel: servingsInfo.statusLabel,
      hasConfirmedServings: servingsInfo.hasConfirmedServings,
      hasCatalogBom: Boolean(catalogDish?.ingredients.length),
      menuPrice: linePricing.menuPrice,
      bomRatePercent: linePricing.bomRatePercent,
      quantityFactor: linePricing.quantityFactor,
    };
  }) : displayDays.flatMap((day) => {
    const rows: WeeklyPlanRow[] = [];

    SECTIONS.forEach((section) => {
      const slot = weeklyMenu[day.key]?.[section.slotType];
      if (!slot) return;

      const importedMainDish = slot.customComponents?.main?.trim();
      const catalogDish = dishesById.get(slot.dishId) ?? dishesByName.get(normalizeDishMatchKey(importedMainDish));
      const dishName = formatMenuDishName(importedMainDish || catalogDish?.name || 'Chưa có món');

      if (dishName === 'Chưa có món') return;
      const serviceDate = getServiceDateIso(day.key) || parseDisplayDateToIso(day.date) || day.date;
      const shiftName = section.shift === 'morning' ? 'MORNING' : 'AFTERNOON';
      const linePricing = getLinePricing(serviceDate, shiftName);
      const servingsInfo = getSlotServingInfo(day.key, section.slotType);
      const portions = servingsInfo.portions > 0 ? servingsInfo.portions : servingsInfo.importedPortions;

      rows.push({
        key: `${day.key}-${section.slotType}`,
        dayKey: day.key,
        dayLabel: day.label,
        date: day.date,
        serviceDate,
        sectionLabel: section.label,
        shiftLabel: section.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
        menuTypeLabel: section.category === 'vegetarian' ? 'Chay' : 'Mặn',
        slotLabel: 'Món chính',
        dishId: catalogDish?.id ?? slot.dishId,
        dishName,
        portions,
        importedPortions: servingsInfo.importedPortions,
        servingsStatus: servingsInfo.status,
        servingsStatusLabel: servingsInfo.statusLabel,
        hasConfirmedServings: servingsInfo.hasConfirmedServings,
        hasCatalogBom: Boolean(catalogDish?.ingredients.length),
        menuPrice: linePricing.menuPrice,
        bomRatePercent: linePricing.bomRatePercent,
        quantityFactor: linePricing.quantityFactor,
      });
    });

    return rows;
  });

  const weeklyRowsWithBom = weeklyPlanRows.filter((row) => row.hasCatalogBom);
  const weeklyRowsMissingBom = weeklyPlanRows.filter((row) => !row.hasCatalogBom);
  const weeklyRowsUsingImportDefault = weeklyPlanRows.filter((row) => row.servingsStatus === 'import-default');
  const weeklyRowsMissingOperationalServings = weeklyPlanRows.filter((row) => row.portions <= 0);
  const invalidBomTierCount = invalidScheduleMenuPrices.length;
  const workflowStepItems: Array<{ label: string; value: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = [
    { label: 'Menu', value: weeklyPlanRows.length.toString(), tone: weeklyPlanRows.length ? 'success' : 'neutral' },
    { label: 'Số lượng khách', value: weeklyRowsMissingOperationalServings.length ? `${weeklyRowsMissingOperationalServings.length} thiếu` : 'Đủ', tone: weeklyRowsMissingOperationalServings.length ? 'warning' : 'success' },
    { label: 'Định lượng', value: weeklyRowsMissingBom.length ? `${weeklyRowsMissingBom.length} thiếu BOM` : 'Đủ BOM', tone: weeklyRowsMissingBom.length ? 'danger' : 'success' },
    { label: 'Đề xuất mua', value: demandLines.length ? `${aggregatedDemandLines.length} dòng` : 'Chờ demand', tone: demandLines.length ? 'info' : 'neutral' },
    { label: 'Tồn kho/cảnh báo', value: invalidBomTierCount ? `${invalidBomTierCount} sai tier` : 'OK', tone: invalidBomTierCount ? 'danger' : 'success' },
  ];
  const quickServingRows = displayDays
    .flatMap((day) => {
      const serviceDate = getServiceDateIso(day.key) || parseDisplayDateToIso(day.date);
      if (!serviceDate) return [];

      return QUICK_SERVING_SHIFTS.map((shift) => {
        const matchingPlans = mealQuantityPlans.filter((plan) => plan.serviceDate.split('T')[0] === serviceDate);
        const planLines = matchingPlans.flatMap((plan) =>
          plan.lines
            .filter((line) => line.shiftName === shift.shiftName && (!effectiveMenuCustomerId || line.customerId === effectiveMenuCustomerId))
            .map((line) => {
              const servings = line.finalServings || line.confirmedServings || line.adjustedServings || line.forecastServings || 0;
              return {
                planStatus: plan.status,
                quantityPlanId: plan.quantityPlanId,
                quantityPlanLineId: line.quantityPlanLineId,
                servings,
              };
            }),
        );
        const currentServings = planLines.reduce((sum, line) => sum + line.servings, 0);
        const importedServings = Math.max(
          0,
          ...weeklyPlanRows
            .filter((row) => row.dayKey === day.key && (
              shift.shiftName === 'MORNING'
                ? row.shiftLabel.toLowerCase().includes('sáng')
                : row.shiftLabel.toLowerCase().includes('chiều')
            ))
            .map((row) => row.importedPortions || row.portions || 0),
        );
        const key = getQuickServingKey(serviceDate, shift.shiftName);
        const inputValue = quickServingInputs[key] ?? String(currentServings > 0 ? currentServings : importedServings || '');
        const normalizedStatuses = Array.from(new Set(planLines.map((line) => line.planStatus.toUpperCase())));
        const isConfirmed = normalizedStatuses.some((status) => ['CONFIRMED', 'COMPLETED', 'ADJUSTED'].includes(status));
        const isCompleted = normalizedStatuses.includes('COMPLETED');
        const hasDraftChange = quickServingInputs[key] !== undefined && Number(quickServingInputs[key]) !== currentServings;

        return {
          key,
          dayKey: day.key,
          dayLabel: day.label,
          date: day.date,
          serviceDate,
          shiftName: shift.shiftName,
          shiftLabel: shift.shiftLabel,
          quantityPlanId: planLines[0]?.quantityPlanId,
          quantityPlanIds: Array.from(new Set(planLines.map((line) => line.quantityPlanId).filter(Boolean))),
          lines: planLines.map((line) => ({
            quantityPlanLineId: line.quantityPlanLineId,
            servings: line.servings,
          })),
          currentServings,
          importedServings,
          inputValue,
          hasPlanLines: planLines.length > 0,
          hasDraftChange,
          isConfirmed,
          isCompleted,
          statusLabel: planLines.length === 0
            ? 'Chưa có kế hoạch suất'
            : isCompleted
              ? 'Đã hoàn tất'
              : isConfirmed
                ? 'Đã chốt'
                : currentServings > 0
                  ? 'Chưa chốt'
                  : 'Chưa nhập suất',
        };
      });
    });
  const getQuickServingRowForPlanRow = (row: WeeklyPlanRow) => {
    const shiftName: QuickServingShiftName = row.shiftLabel.toLowerCase().includes('sáng')
      ? 'MORNING'
      : 'AFTERNOON';

    return quickServingRows.find((servingRow) =>
      servingRow.serviceDate === row.serviceDate &&
      servingRow.shiftName === shiftName);
  };
  const demandStalenessServiceDate = weeklyPlanRows[0]?.serviceDate;
  const { data: demandStalenessData } = useGetMaterialDemandStalenessQuery(
    { serviceDate: demandStalenessServiceDate ?? '', customerId: effectiveMenuCustomerId, scope: 'FULLDAY' },
    { skip: !demandStalenessServiceDate || !effectiveMenuCustomerId },
  );
  const demandStaleness = demandStalenessData?.data;
  const weeklyPlanCatalogDishIds = new Set(weeklyRowsWithBom.map((row) => row.dishId));
  const demandDayPages = displayDays
    .map((day) => ({
      ...day,
      rows: weeklyPlanRows.filter((row) => row.dayKey === day.key),
    }))
    .filter((day) => day.rows.length > 0);
  const selectedDemandDayIndex = selectedDemandDayKey
    ? demandDayPages.findIndex((day) => day.key === selectedDemandDayKey)
    : -1;
  const todayDemandDayIndex = activeServiceDay
    ? demandDayPages.findIndex((day) => day.key === activeServiceDay.key)
    : -1;
  const safeDemandDayPageIndex = demandDayPages.length === 0
    ? 0
    : selectedDemandDayIndex >= 0
      ? selectedDemandDayIndex
      : todayDemandDayIndex >= 0
        ? todayDemandDayIndex
        : 0;
  const activeDemandDay = demandDayPages[safeDemandDayPageIndex];
  const activeDemandDate = activeDemandDay
    ? getServiceDateIso(activeDemandDay.key) || parseDisplayDateToIso(activeDemandDay.date)
    : '';
  const activeDemandReportQuery = {
    customerId: effectiveMenuCustomerId,
    dateFrom: activeDemandDate || undefined,
    dateTo: activeDemandDate || undefined,
    pageNumber: activeDemandAggregatePageNumber,
    pageSize: 20,
  };
  const {
    currentData: activeDemandAggregatePage,
    isFetching: isFetchingActiveDemandLines,
  } = useGetIngredientDemandAggregatePageQuery(activeDemandReportQuery, { skip: !effectiveMenuCustomerId || !activeDemandDate });
  const selectDemandDay = (dayKey: string | null) => {
    setSelectedDemandDayKey(dayKey);
    setActiveDemandAggregatePageNumber(1);
    setProductionPlanPageIndex(0);
  };
  const activeDemandQuickServingRows = activeDemandDay
    ? QUICK_SERVING_SHIFTS
      .map((shift) => quickServingRows.find((servingRow) =>
        servingRow.serviceDate === activeDemandDate &&
        servingRow.shiftName === shift.shiftName))
      .filter((row): row is (typeof quickServingRows)[number] => Boolean(row))
    : [];
  const activeDemandAggregatedLines = activeDemandAggregatePage?.items ?? [];
  const activeDemandWarningCount = activeDemandAggregatedLines.filter((line) => line.tone === 'warning').length;
  const activeDemandShortageCount = activeDemandAggregatePage?.shortageCount ?? activeDemandAggregatedLines.filter((line) => {
    const availableAfterReserve = line.available - line.reserved;
    return Math.max(line.required - availableAfterReserve, 0) > 0;
  }).length;
  const activeDemandEnoughCount = (activeDemandAggregatePage?.totalCount ?? activeDemandAggregatedLines.length) - activeDemandShortageCount - activeDemandWarningCount;
  const activeDemandTone: DemandLine['tone'] = activeDemandAggregatedLines.length === 0
    ? 'neutral'
    : activeDemandWarningCount > 0
      ? 'warning'
      : activeDemandShortageCount > 0
        ? 'danger'
        : 'success';
  const activeDemandStatus = activeDemandAggregatedLines.length === 0
    ? 'Chưa kiểm tồn'
    : activeDemandWarningCount > 0
      ? 'Cần tính lại'
      : activeDemandShortageCount > 0
        ? 'Thiếu nguyên liệu'
        : 'Đủ nguyên liệu';
  const demandPageRows = activeDemandDay?.rows ?? [];
  const khsxDraftDocument: WorkflowDocument | null = (() => {
    if (!activeDemandDay || weeklyPlanRows.length === 0) return null;

    const customerCode = selectedCustomer?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN';
    const serviceDates = Array.from(new Set(weeklyPlanRows.map((row) => row.serviceDate).filter(Boolean)));
    const totalPortions = activeDemandDay.rows.reduce((sum, row) => sum + row.portions, 0);
    const missingBomInDay = activeDemandDay.rows.filter((row) => !row.hasCatalogBom).length;

    return {
      id: `KHSX-DRAFT-${customerCode}-${activeDemandDay.key}`,
      type: 'KHSX',
      title: 'KHSX theo menu đang xem',
      status: demandLines.length > 0 ? 'Đã sinh demand' : 'DRAFT',
      owner: 'Bếp trưởng',
      summary: demandLines.length > 0
        ? 'Demand nguyên liệu đã được sinh từ KHSX của khách hàng đang chọn.'
        : 'Bản KHSX tạm từ menu tuần; bấm Tạo demand từ KHSX để sinh nhu cầu nguyên liệu backend.',
      route: '/weekly-menu',
      tone: demandLines.length > 0 ? 'success' : missingBomInDay > 0 ? 'warning' : 'neutral',
      lines: [
        { label: 'Khách hàng', value: selectedCustomer ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}` : customerCode },
        { label: 'Ngày', value: `${activeDemandDay.label} ${activeDemandDay.date}` },
        { label: 'Ngày tuần', value: serviceDates.length.toString() },
        { label: 'Dòng KHSX', value: activeDemandDay.rows.length.toString() },
        { label: 'Tổng suất ngày', value: totalPortions.toLocaleString('vi-VN') },
        { label: 'Thiếu BOM ngày', value: missingBomInDay.toString(), tone: missingBomInDay > 0 ? 'warning' : 'success' },
      ],
    };
  })();
  const khsxBackendDocuments = workflowDocuments.filter((document) =>
    ['KHSX', 'Đơn mua', 'Phiếu xuất'].includes(document.type),
  );
  const khsxWorkflowDocuments = khsxDraftDocument ? [khsxDraftDocument, ...khsxBackendDocuments] : khsxBackendDocuments;
  const costDayPages = displayDays
    .map((day) => ({
      ...day,
      rows: weeklyPlanRows.filter((row) => row.dayKey === day.key),
    }))
    .filter((day) => day.rows.length > 0);
  const selectedCostDayIndex = selectedCostDayKey
    ? costDayPages.findIndex((day) => day.key === selectedCostDayKey)
    : -1;
  const todayCostDayIndex = activeServiceDay
    ? costDayPages.findIndex((day) => day.key === activeServiceDay.key)
    : -1;
  const safeCostDayPageIndex = costDayPages.length === 0
    ? 0
    : selectedCostDayIndex >= 0
      ? selectedCostDayIndex
      : todayCostDayIndex >= 0
        ? todayCostDayIndex
        : 0;
  const activeCostDay = costDayPages[safeCostDayPageIndex];
  const costPageRows = activeCostDay?.rows ?? [];

  const handleExportWarehouseReport = () => {
    // Collect active materials
    const activeMaterials = Object.entries(materialSummary)
      .map(([name, data]) => {
        if (data.theory === 0) return null;
        const cost = data.actual * data.referencePrice;
        return {
          name,
          unit: data.unit,
          theory: data.theory.toFixed(2),
          actual: data.actual.toFixed(2),
          supplier: 'Catalog backend',
          price: data.referencePrice,
          cost,
        };
      })
      .filter(Boolean);

    if (activeMaterials.length === 0) {
      setWarehouseExportFeedback({
        title: 'Chưa có nguyên liệu để gửi kho',
        message: 'Các ca trong tuần đang có số suất bằng 0 nên chưa sinh nhu cầu xuất kho.',
        variant: 'warning',
      });
      return;
    }

    // Build CSV content
    const customerCode = customers.find((c) => c.customerId === effectiveMenuCustomerId)?.customerCode ?? committedMenu?.customerCode ?? 'UNKNOWN';
    const weekStr = committedMenuWeekStartDate || '2026-06-15';

    let csvContent = '\uFEFF'; // Add BOM for UTF-8 in Excel
    csvContent += 'Tuần,Khách hàng,Nguyên liệu,Số lượng LT,Số lượng TT,Đơn vị,Đơn giá (đ),Thành tiền (đ)\n';

    activeMaterials.forEach((m) => {
      if (!m) return;
      csvContent += `"${weekStr}","${customerCode}","${m.name.replace(/"/g, '""')}","${m.theory}","${m.actual}","${m.unit}","${m.price}","${Math.round(m.cost)}"\n`;
    });

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_cao_gui_kho_${customerCode}_tuan_${weekStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setWarehouseExportFeedback({
      title: 'Đã xuất báo cáo gửi kho thành công',
      message: `Tệp báo cáo 'Bao_cao_gui_kho_${customerCode}_tuan_${weekStr}.csv' đã được tải xuống máy tính của bạn.`,
      variant: 'info',
    });
  };

  const getDishUnitCost = (dishId: string, quantityFactor = 1) => {
    const dish = dishesById.get(dishId);
    if (!dish || !dish.ingredients.length) return 0;
    const cost = dish.ingredients.reduce((sum, ing) => {
      const actualQty = ing.grossQtyPerServing * quantityFactor;
      return sum + actualQty * ing.referencePrice;
    }, 0);
    return Math.round(cost);
  };
  const activeDayRowsWithBom = costPageRows.filter((row) => row.hasCatalogBom);
  const activeDayRowsMissingBom = costPageRows.filter((row) => !row.hasCatalogBom);
  const activeDayCostTotal = activeDayRowsWithBom.reduce(
    (sum, row) => sum + getDishUnitCost(row.dishId, row.quantityFactor) * row.portions,
    0,
  );

  // Portion cost analysis logic (Step 2)
  const analyzedDish =
    catalogDishes.find((d) => d.id === selectedDishId) ||
    weeklyRowsWithBom.map((row) => dishesById.get(row.dishId)).find(Boolean) ||
    catalogDishes[0];

  const analyzedIngredients = analyzedDish
    ? analyzedDish.ingredients.map((ing) => {
      const theoryQty = ing.grossQtyPerServing;
      const actualQty = theoryQty;
      const supplierPrice = ing.referencePrice;
      const cost = actualQty * supplierPrice;
      return {
        name: ing.name,
        unit: ing.unit,
        theoryQty,
        actualQty,
        supplierPrice,
        cost,
      };
    })
    : [];

  const totalTrayCost = analyzedIngredients.reduce((sum, ing) => sum + ing.cost, 0);
  const foodCostPercent = menuPrice <= 0 ? 0 : (totalTrayCost / menuPrice) * 100;
  const grossProfit = menuPrice - totalTrayCost;

  const materialSummary = buildPlanRowsMaterialSummary(weeklyPlanRows, dishesById, dishesByName);
  const activeDayMaterialSummary = buildPlanRowsMaterialSummary(costPageRows, dishesById, dishesByName);
  const activeDayMaterialCost = calculateTotalMaterialCost(activeDayMaterialSummary);
  const totalCostInfo = calculateTotalMaterialCost(materialSummary);
  const materialSummaryEntries = Object.entries(materialSummary).filter(([, data]) => data.theory > 0);
  const purchaseSummaryUsesDemand = demandLines.length > 0;
  const purchaseSummaryTotalItems = purchaseSummaryUsesDemand ? aggregatedDemandLines.length : materialSummaryEntries.length;
  const purchaseSummaryTotalPages = Math.max(1, Math.ceil(purchaseSummaryTotalItems / PURCHASE_SUMMARY_PAGE_SIZE));
  const safePurchaseSummaryPageIndex = Math.min(purchaseSummaryPageIndex, purchaseSummaryTotalPages - 1);
  const purchaseSummaryPageStartIndex = safePurchaseSummaryPageIndex * PURCHASE_SUMMARY_PAGE_SIZE;
  const purchaseDemandPageRows: DemandLine[] = purchaseSummaryUsesDemand
    ? aggregatedDemandLines.slice(purchaseSummaryPageStartIndex, purchaseSummaryPageStartIndex + PURCHASE_SUMMARY_PAGE_SIZE)
    : [];
  const purchaseSummaryMaterialPageRows: PurchaseSummaryMaterialEntry[] = purchaseSummaryUsesDemand
    ? []
    : materialSummaryEntries.slice(purchaseSummaryPageStartIndex, purchaseSummaryPageStartIndex + PURCHASE_SUMMARY_PAGE_SIZE);
  const purchaseSummaryShortageCount = aggregatedDemandLines.filter((line) => {
    const availableAfterReserve = line.available - line.reserved;
    return Math.max(line.required - availableAfterReserve, 0) > 0;
  }).length;
  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button
                type="button"
                onClick={handleOpenEdit}
                className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap"
              >
                <Edit size={14} className="text-[var(--ipc-slate-500)]" />
                Chỉnh sửa thực đơn
              </button>

              <button
                type="button"
                onClick={handleImportClick}
                disabled={isImporting}
                className="ipc-button ipc-button-ghost font-semibold whitespace-nowrap"
              >
                <Upload size={14} className="text-[var(--ipc-slate-500)]" />
                {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
              </button>

              <button
                type="button"
                onClick={handleExportWarehouseReport}
                className="ipc-button ipc-button-success whitespace-nowrap"
              >
                Xuất báo cáo gửi kho
              </button>
            </>
          }
        >
          <FieldRow label="Khách hàng">
            <select
              value={selectedMenuCustomerId}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedMenuCustomerId(cid);
                setCommittedMenuWeekStartDate('');
                resetScopedWeeklyMenuUi();
                if (cid) {
                  window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, cid);
                } else {
                  window.localStorage.removeItem(LAST_WEEKLY_MENU_CUSTOMER_KEY);
                }
                window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
              }}
              className="ipc-select min-w-[200px]"
              disabled={isCustomerLoading}
            >
              <option value="">Chọn khách hàng</option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerCode} - {c.customerName}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Tuần bắt đầu">
            <input
              type="date"
              value={displayedWeekStartDate}
              onChange={(e) => {
                const date = e.target.value;
                setCommittedMenuWeekStartDate(date);
                resetScopedWeeklyMenuUi();
                if (date) {
                  window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, date);
                } else {
                  window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
                }
              }}
              className="ipc-input"
            />
          </FieldRow>
        </CommandBar>
      }
      context={
        <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50/70 p-3 shadow-sm lg:grid-cols-3">
          <FieldRow label="Định mức BOM cố định" className="[&_.ipc-field-label]:min-h-[18px]">
            <div className="ipc-input flex h-10 items-center justify-between bg-white text-sm font-semibold text-blue-700">
              <span>{formatBomTierLabel(menuPrice)}</span>
              <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase text-blue-600">
                Đang dùng
              </span>
            </div>
          </FieldRow>
          <FieldRow label="Nguồn định mức" className="[&_.ipc-field-label]:min-h-[18px]">
            <div className="ipc-input flex h-10 items-center bg-white text-sm font-semibold text-slate-800">
              {menuPriceSource}
            </div>
          </FieldRow>
          <FieldRow label="BOM áp dụng" className="[&_.ipc-field-label]:min-h-[18px]">
            <div className="ipc-input flex h-10 items-center bg-white text-sm font-semibold text-emerald-700">
              Theo tier cố định, 100%
            </div>
          </FieldRow>
        </div>
      }
    >
      <ViewSwitcher
        ariaLabel="Chọn góc nhìn kế hoạch tuần"
        tabs={[
          { id: 'schedule', label: 'Kế hoạch tuần' },
          { id: 'demand', label: 'Nhu cầu' },
          { id: 'production-plan', label: 'Kế hoạch sản xuất' },
          { id: 'purchase-summary', label: 'Tổng hợp mua' },
          { id: 'cost', label: 'Giá vốn' },
          { id: 'dish-materials', label: 'Nguyên liệu món' },
        ]}
        activeTab={activeView}
        onTabChange={(tabId) => setActiveView(tabId as WeeklyMenuView)}
      />
      <ContextStrip items={workflowStepItems} />
      {invalidBomTierCount > 0 && (
        <InlineAlert title="Đơn giá chưa khớp tier BOM" variant="danger">
          Có {invalidBomTierCount} lịch/ca không thuộc 25k, 30k hoặc 34k. Hệ thống sẽ chặn sinh demand để tránh dùng sai định lượng.
        </InlineAlert>
      )}
      {warehouseExportFeedback && (
        <InlineAlert title={warehouseExportFeedback.title} variant={warehouseExportFeedback.variant}>
          {warehouseExportFeedback.message}
        </InlineAlert>
      )}
      {isCatalogLoading && (
        <InlineAlert title="Đang tải catalog món ăn" variant="info">
          Hệ thống đang lấy danh sách món và định lượng BOM từ API.
        </InlineAlert>
      )}
      {isCatalogError && (
        <InlineAlert title="Chưa tải được catalog món ăn" variant="warning">
          Kiểm tra backend hoặc quyền truy cập catalog trước khi phân tích giá vốn.
        </InlineAlert>
      )}
      {isCommittedMenuFetching && effectiveMenuCustomerId && (
        <InlineAlert title="Đang tải thực đơn khách hàng" variant="info">
          Hệ thống đang lấy menu, KHSX và giá vốn theo khách hàng đang chọn.
        </InlineAlert>
      )}
      {isCatalogEmpty && (
        <InlineAlert title="Catalog món ăn đang trống" variant="warning">
          Chưa có món ăn hoạt động nào từ API, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
        </InlineAlert>
      )}

      {activeView === 'schedule' && (
        <div className="flex flex-col gap-4">
          <SectionPanel title="Bố cục menu theo file khách hàng" icon={<Calendar size={18} color="var(--ipc-slate-600)" />}>
            <div className="flex flex-col gap-3">
              <ContextStrip
                items={[
                  {
                    label: 'Khách hàng',
                    value: selectedCustomer ? `${selectedCustomer.customerCode} - ${selectedCustomer.customerName}` : committedMenu?.customerCode ?? 'Chưa chọn',
                    tone: 'neutral',
                  },
                  {
                    label: 'Tuần',
                    value: committedMenu?.weekStartDate ? `${formatImportDate(committedMenu.weekStartDate)} - ${formatImportDate(committedMenu.weekEndDate)}` : 'Chưa có menu',
                    tone: committedMenu?.weekStartDate ? 'info' : 'neutral',
                  },
                  {
                    label: 'Đang thực hiện',
                    value: activeServiceLabel,
                    tone: activeServiceDay ? 'success' : 'warning',
                  },
                ]}
              />
              <ImportedLayoutMatrix rows={committedLayoutRows} displayDays={displayDays} activeDayKey={activeServiceDay?.key} />
            </div>
          </SectionPanel>
        </div>
      )}

      {activeView === 'production-plan' && (
        <SectionPanel title="Kế hoạch sản xuất chi tiết" icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[auto_minmax(220px,1fr)] items-center gap-3">
              <span className="whitespace-nowrap text-sm font-semibold text-slate-700">Ngày phục vụ:</span>
              <select
                className="ipc-input min-h-9 w-full text-sm"
                value={selectedDemandDayKey || ''}
                onChange={(e) => selectDemandDay(e.target.value || null)}
              >
                <option value="">Cả tuần</option>
                {displayDays.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {!selectedProductionPlanServiceDate && isLoadingWeeklyProductionPlans ? (
              <div className="py-8 text-center text-slate-500">Đang tải kế hoạch sản xuất cả tuần...</div>
            ) : productionPlanPages.length === 0 ? (
              <div className="py-8 text-center text-slate-500">Chưa có kế hoạch sản xuất nào.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">
                      {activeProductionPlanPage?.label} - {activeProductionPlanPage?.dateLabel}
                    </span>
                    <span className="text-slate-500">
                      {activeProductionPlanPage?.plans.length ?? 0} KHSX / {activeProductionPlanPage?.totalLines ?? 0} dòng / {(activeProductionPlanPage?.totalServings ?? 0).toLocaleString('vi-VN')} suất
                    </span>
                  </div>
                  <PageStepper
                    page={safeProductionPlanPageIndex + 1}
                    totalPages={productionPlanPages.length}
                    label="Kế hoạch sản xuất"
                    ariaLabel="Điều hướng kế hoạch sản xuất"
                    onPageChange={(nextPage) => setProductionPlanPageIndex(nextPage - 1)}
                  />
                </div>

                {activeProductionPlanPage?.plans.map((plan) => (
                  <div key={plan.planId} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2">
                      <h3 className="font-semibold text-slate-800">Mã KHSX: {plan.planCode}</h3>
                      <StatusBadge variant={plan.status === 'DRAFT' ? 'warning' : 'success'}>
                        {plan.status}
                      </StatusBadge>
                    </div>
                    <div className="mb-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="whitespace-nowrap font-medium">Ngày phục vụ:</span>
                        <span>{new Date(plan.planDate).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="whitespace-nowrap font-medium">Khách hàng:</span>
                        <span className="truncate" title={`${plan.customerName} (${plan.customerCode})`}>
                          {plan.customerName} ({plan.customerCode})
                        </span>
                      </div>
                    </div>
                    <TableViewport caption="Chi tiết kế hoạch sản xuất theo ca và món ăn" ariaLabel="Bảng chi tiết kế hoạch sản xuất">
                      <table className="ipc-data-table">
                        <thead>
                          <tr>
                            <th className="w-[20%] text-left">Ca</th>
                            <th className="w-[50%] text-left">Món ăn</th>
                            <th className="w-[30%] text-right">Số lượng (suất)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.lines.map((line) => (
                            <tr key={line.planLineId}>
                              <td>{getShiftLabel(line.shiftName)}</td>
                              <td>{line.dishName ?? '-'}</td>
                              <td className="text-right font-medium">{line.totalServings}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </TableViewport>
                  </div>
                ))}
              </>
            )}
          </div>
        </SectionPanel>
      )}

      {activeView === 'demand' && (
        <SectionPanel title="KHSX, kiểm tồn kho và nhu cầu xuất" icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
          <div className="flex flex-col gap-3">
            <ContextStrip
              items={[
                {
                  label: 'Nguồn menu',
                  value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                  tone: 'neutral',
                },
                { label: 'Dòng KHSX', value: weeklyPlanRows.length.toString(), tone: 'neutral' },
                { label: 'Đã có BOM/catalog', value: weeklyRowsWithBom.length.toString(), tone: 'success' },
                {
                  label: 'Chưa tính được BOM',
                  value: weeklyRowsMissingBom.length.toString(),
                  tone: weeklyRowsMissingBom.length > 0 ? 'warning' : 'success',
                },
                { label: 'Nguyên liệu tổng hợp', value: Object.keys(materialSummary).length.toString(), tone: 'info' },
              ]}
            />

            {weeklyRowsMissingBom.length > 0 && (
              <InlineAlert title="Một số món import chưa có BOM catalog" variant="warning">
                Các món này vẫn được đưa vào KHSX theo tên món trong Excel, nhưng chưa sinh định lượng nguyên liệu cho đến khi được gắn với món/BOM trong catalog.
              </InlineAlert>
            )}
            {weeklyRowsUsingImportDefault.length > 0 && (
              <InlineAlert title="Đang dùng số suất default từ import" variant="warning">
                Tạm thời hệ thống dùng số suất mặc định trong file import để chạy luồng KHSX, demand và mua thêm. Khi có dữ liệu suất chuẩn, Meal Quantity Plan đã chốt sẽ tự được ưu tiên.
              </InlineAlert>
            )}
            {demandFeedback && (
              <InlineAlert title={demandFeedback.title} variant={demandFeedback.variant}>
                {demandFeedback.message}
              </InlineAlert>
            )}
            {demandStaleness?.isStale && (
              <InlineAlert title="Demand đã lỗi thời, cần tính lại" variant="warning">
                {demandStaleness.reasons.join(' | ')}
              </InlineAlert>
            )}

            <Toolbar className="justify-end">
              <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['demand.generate']}>
                <button
                  className="ipc-button ipc-button-primary"
                  type="button"
                  onClick={() => void handleGenerateDemand()}
                  disabled={isGeneratingDemand || isSavingQuickServings || weeklyPlanRows.length === 0}
                >
                  <Scale size={16} />
                  {isSavingQuickServings
                    ? 'Đang lưu suất...'
                    : isGeneratingDemand
                    ? 'Đang tạo demand...'
                    : demandStaleness?.isStale
                      ? 'Tính lại demand (dữ liệu đã thay đổi)'
                      : 'Tạo demand từ KHSX'}
                </button>
              </ActionGuard>
              <Link className="ipc-button ipc-button-warning" to={`${ROUTES.REPORTS}?view=purchase`}>
                <ShoppingCart size={16} />
                Xem kế hoạch thu mua
              </Link>
            </Toolbar>

            <TableViewport caption="Kế hoạch sản xuất sinh từ kế hoạch tuần" className="h-[560px] max-h-[560px]" ariaLabel="Bảng KHSX sinh từ kế hoạch tuần">
              <table className="ipc-data-table table-fixed w-full">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Ngày</th>
                    <th style={{ width: '9%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Ca</th>
                    <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Nhóm</th>
                    <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Dòng</th>
                    <th style={{ width: '27%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món theo kế hoạch tuần</th>
                    <th style={{ width: '18%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Suất</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>BOM</th>
                  </tr>
                </thead>
                <tbody>
                  {demandPageRows.map((row) => {
                    const quickServingRow = getQuickServingRowForPlanRow(row);
                    const isServingBusy = isSavingQuickServings;

                    return (
                      <tr key={row.key} className="table-row">
                        <td className={`${tableCellClass} text-left font-semibold`}>
                          {row.dayLabel}
                          <div className="text-[12px] font-normal text-slate-500">{row.date}</div>
                        </td>
                        <td className={tableCellClass}>{row.shiftLabel}</td>
                        <td className={tableCellClass}>{row.menuTypeLabel}</td>
                        <td className={`${tableCellClass} text-left`}>{row.slotLabel}</td>
                        <td className={`${tableCellClass} text-left font-semibold text-slate-900`}>
                          {row.dishName}
                        </td>
                        <td className={tableCellClass} title={quickServingRow?.statusLabel ?? row.servingsStatusLabel}>
                          {quickServingRow ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <input
                                type="number"
                                min="0"
                                value={quickServingRow.inputValue}
                                onChange={(event) => setQuickServingInputs((current) => ({
                                  ...current,
                                  [quickServingRow.key]: event.target.value,
                                }))}
                                onBlur={() => {
                                  if (quickServingRow.hasDraftChange) {
                                    void handleSaveQuickServings(quickServingRow);
                                  }
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    event.currentTarget.blur();
                                  }
                                  if (event.key === 'Escape') {
                                    setQuickServingInputs((current) => {
                                      const next = { ...current };
                                      delete next[quickServingRow.key];
                                      return next;
                                    });
                                  }
                                }}
                                disabled={quickServingRow.isConfirmed}
                                className="ipc-input h-8 w-[96px] text-center"
                              />
                              <span className={cn(
                                'text-[11px] font-medium',
                                quickServingRow.isCompleted ? 'text-emerald-700' : quickServingRow.hasDraftChange ? 'text-blue-700' : quickServingRow.hasPlanLines ? 'text-amber-700' : 'text-slate-500',
                              )}>
                                {quickServingRow.isCompleted
                                  ? 'Đã hoàn tất'
                                  : isServingBusy
                                    ? 'Đang lưu'
                                    : quickServingRow.hasDraftChange
                                      ? 'Chưa lưu'
                                  : quickServingRow.hasPlanLines
                                    ? quickServingRow.statusLabel
                                    : row.servingsStatus === 'import-default'
                                      ? 'Tạm từ import'
                                      : 'Chưa có kế hoạch'}
                              </span>
                            </div>
                          ) : row.servingsStatus === 'missing' ? (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span className="font-semibold text-amber-700">Chưa chốt</span>
                            </span>
                          ) : (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span>{row.portions.toLocaleString('vi-VN')}</span>
                              {row.servingsStatus === 'import-default' && (
                                <span className="text-[11px] font-normal text-amber-700">Tạm từ import</span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>
                          {row.hasCatalogBom ? 'Đã có' : 'Chưa gắn'}
                        </td>
                      </tr>
                    );
                  })}
                  {demandPageRows.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                        Chưa có kế hoạch ngày để sinh KHSX.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <div className="flex min-h-[38px] flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {activeDemandQuickServingRows.map((row) => {
                  const isServingBusy = isSavingQuickServings;
                  const disabled = isServingBusy || row.isCompleted || Number(row.inputValue) <= 0;

                  return (
                    <ActionGuard key={`complete-${row.key}`} allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['orders.lock']}>
                      <button
                        type="button"
                        className={cn(
                          'ipc-button min-w-[132px] whitespace-nowrap',
                          row.isCompleted ? 'ipc-button-ghost' : 'ipc-button-primary',
                        )}
                        disabled={disabled}
                        onClick={() => void handleLockQuickServings(row)}
                      >
                        {row.isCompleted ? `Đã hoàn tất ${row.shiftLabel}` : `Hoàn tất ${row.shiftLabel}`}
                      </button>
                    </ActionGuard>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="mr-2 text-sm font-medium text-slate-600">
                  {activeDemandDay
                    ? `${activeDemandDay.label} ${activeDemandDay.date} (${safeDemandDayPageIndex + 1}/${demandDayPages.length})`
                    : 'Chưa có ngày'}
                </span>
                <button
                  type="button"
                  className="ipc-button ipc-button-ghost"
                  disabled={safeDemandDayPageIndex <= 0}
                  onClick={() => selectDemandDay(demandDayPages[Math.max(0, safeDemandDayPageIndex - 1)]?.key ?? null)}
                >
                  Ngày trước
                </button>
                <button
                  type="button"
                  className="ipc-button ipc-button-primary"
                  disabled={safeDemandDayPageIndex >= demandDayPages.length - 1}
                  onClick={() => selectDemandDay(demandDayPages[Math.min(demandDayPages.length - 1, safeDemandDayPageIndex + 1)]?.key ?? null)}
                >
                  Ngày sau
                </button>
              </div>
            </div>

            {demandLines.length > 0 || activeDemandAggregatedLines.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex min-h-[34px] items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-slate-800">
                      Nguyên liệu ngày {activeDemandDay ? `${activeDemandDay.label} ${activeDemandDay.date}` : 'đang xem'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      Đủ {activeDemandEnoughCount}, thiếu {activeDemandShortageCount}, tổng {activeDemandAggregatedLines.length} nguyên liệu
                    </span>
                  </div>
                  <StatusBadge variant={activeDemandTone} className="shrink-0 whitespace-nowrap">
                    {activeDemandStatus}
                  </StatusBadge>
                </div>
                {isFetchingActiveDemandLines && !activeDemandAggregatePage ? (
                  <div className="ipc-demand-summary is-empty">Đang tải nguyên liệu ngày đang xem...</div>
                ) : (
                  <DemandSummary lines={activeDemandAggregatedLines} />
                )}
                {activeDemandAggregatePage && (
                  <PaginationBar
                    page={activeDemandAggregatePage.pageNumber}
                    pageSize={activeDemandAggregatePage.pageSize}
                    totalItems={activeDemandAggregatePage.totalCount}
                    onPageChange={setActiveDemandAggregatePageNumber}
                  />
                )}
              </div>
            ) : (
              <InlineAlert title="Chưa sinh nhu cầu nguyên liệu backend" variant={weeklyPlanRows.length > 0 ? 'warning' : 'info'}>
                {weeklyPlanRows.length > 0
                  ? 'Bảng KHSX phía trên đã có dữ liệu từ menu. Bấm Tạo demand từ KHSX để sinh dòng nguyên liệu; kế hoạch thu mua sẽ lấy trực tiếp từ demand, tồn kho và pending receipt.'
                  : 'Chưa có dòng KHSX từ menu đang chọn.'}
              </InlineAlert>
            )}
            <DocumentRail
              documents={khsxWorkflowDocuments}
              title="KHSX và chứng từ đầu ra"
            />
          </div>
        </SectionPanel>
      )}

      {/* Phân tích định lượng & giá vốn 1 khay ăn (Step 2) */}
      {activeView === 'cost' && (
        <>
          <SectionPanel
            title="Giá vốn theo ngày từ kế hoạch tuần"
            icon={<Scale size={18} color="var(--ipc-slate-600)" />}
          >
            <div className="mb-6 mt-4">
              <ContextStrip
                items={[
                  {
                    label: 'Nguồn tính',
                    value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                    tone: 'neutral',
                  },
                  {
                    label: 'Ngày đang tính',
                    value: activeCostDay ? `${activeCostDay.label} ${activeCostDay.date}` : 'Chưa có ngày',
                    tone: activeCostDay ? 'info' : 'neutral',
                  },
                  { label: 'Dòng trong ngày', value: costPageRows.length.toString(), tone: 'neutral' },
                  { label: 'Đã có BOM', value: activeDayRowsWithBom.length.toString(), tone: 'success' },
                  {
                    label: 'Chờ gắn BOM',
                    value: activeDayRowsMissingBom.length.toString(),
                    tone: activeDayRowsMissingBom.length > 0 ? 'warning' : 'success',
                  },
                  { label: 'Đơn giá bán/suất', value: formatCurrency(menuPrice), tone: 'neutral' },
                  { label: 'Tổng giá vốn ngày', value: formatCurrency(activeDayCostTotal), tone: activeDayCostTotal > 0 ? 'success' : 'neutral' },
                ]}
              />
            </div>

            <TableViewport caption="Món trong kế hoạch tuần và giá vốn liên kết" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng món kế hoạch tuần liên kết giá vốn">
              <table className="ipc-data-table ipc-cost-table table-fixed w-full">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Ngày</th>
                    <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Ca</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Dòng</th>
                    <th style={{ width: '24%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Suất</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá vốn</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái giá vốn</th>
                  </tr>
                </thead>
                <tbody>
                  {costPageRows.map((row) => {
                    const unitCost = getDishUnitCost(row.dishId, row.quantityFactor);
                    const totalCost = unitCost * row.portions;
                    return (
                      <tr key={`cost-${row.key}`} className="table-row">
                        <td className={`${tableCellClass} text-left font-semibold`}>
                          {row.dayLabel}
                          <div className="text-[12px] font-normal text-slate-500">{row.date}</div>
                        </td>
                        <td className={tableCellClass}>{row.shiftLabel}</td>
                        <td className={`${tableCellClass} text-left`}>{row.slotLabel}</td>
                        <td className={`${tableCellClass} text-left font-semibold`}>{row.dishName}</td>
                        <td className={tableCellClass}>{row.portions.toLocaleString('vi-VN')}</td>
                        <td className={tableCellClass}>
                          {row.hasCatalogBom ? formatCurrency(unitCost) : '-'}
                        </td>
                        <td className={`${tableCellClass} font-semibold`}>
                          {row.hasCatalogBom ? formatCurrency(totalCost) : '-'}
                        </td>
                        <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>
                          {row.hasCatalogBom ? 'Tính bằng BOM catalog' : 'Chờ gắn BOM'}
                        </td>
                      </tr>
                    );
                  })}
                  {costPageRows.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={8}>
                        Chưa có kế hoạch ngày để liên kết giá vốn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <div className="mb-5 mt-3 flex min-h-[38px] items-center justify-end gap-2">
              <span className="mr-2 text-sm font-medium text-slate-600">
                {activeCostDay
                  ? `${activeCostDay.label} ${activeCostDay.date} (${safeCostDayPageIndex + 1}/${costDayPages.length})`
                  : 'Chưa có ngày'}
              </span>
              <button
                type="button"
                className="ipc-button ipc-button-ghost"
                disabled={safeCostDayPageIndex <= 0}
                onClick={() => setSelectedCostDayKey(costDayPages[Math.max(0, safeCostDayPageIndex - 1)]?.key ?? null)}
              >
                Ngày trước
              </button>
              <button
                type="button"
                className="ipc-button ipc-button-primary"
                disabled={safeCostDayPageIndex >= costDayPages.length - 1}
                onClick={() => setSelectedCostDayKey(costDayPages[Math.min(costDayPages.length - 1, safeCostDayPageIndex + 1)]?.key ?? null)}
              >
                Ngày sau
              </button>
            </div>

            <TableViewport caption="Nguyên liệu theo món đang hiển thị trong ngày" className="ipc-cost-table-shell h-[360px] max-h-[360px]" ariaLabel="Bảng nguyên liệu ngày theo món đang hiển thị">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Nguyên liệu</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>ĐV</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>LT ngày</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>TT ngày</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Món trong kế hoạch</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Đơn giá</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Thành tiền ngày</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(activeDayMaterialSummary).map(([name, data]) => {
                    if (data.theory === 0) return null;

                    const rowCost = data.actual * data.referencePrice;
                    const dishSource = formatMaterialDishSource(data.dishNames);

                    return (
                      <tr key={`day-material-${name}`} className="table-row">
                        <td className={`${tableCellClass} text-left font-bold`}>{name}</td>
                        <td className={tableCellClass}>{data.unit}</td>
                        <td className={tableCellClass}>{data.theory.toFixed(2)}</td>
                        <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>
                          {data.actual.toFixed(2)}
                        </td>
                        <td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>
                          {dishSource}
                        </td>
                        <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td>
                        <td className={`${tableCellClass} font-bold`}>{formatCurrency(rowCost)}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(activeDayMaterialSummary).length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                        Chưa có nguyên liệu cho ngày này. Kiểm tra các món đã gắn BOM catalog.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <div className="mt-3 flex min-h-[32px] items-center justify-end text-sm font-medium text-slate-600">
              Tổng nguyên liệu ngày: <span className="ml-2 text-lg font-bold text-green-800">{formatCurrency(activeDayMaterialCost)}</span>
            </div>
          </SectionPanel>

        </>
      )}

      {activeView === 'purchase-summary' && (
        <SectionPanel
          title="Bảng Tính Định Lượng Tổng Hợp & Đề Xuất Mua Hàng"
          icon={<ShoppingCart size={18} color="var(--ipc-slate-600)" />}
          badge={
            <Toolbar>
              <div className="text-sm font-medium text-slate-600">
                Tổng chi phí tối ưu: <span className="text-lg font-bold text-green-800">{formatCurrency(totalCostInfo)}</span>
              </div>
              <button
                onClick={handleExportWarehouseReport}
                className="ipc-button ipc-button-success ipc-button-bounded"
              >
                Xuất Báo Cáo Gửi Kho
              </button>
            </Toolbar>
          }
        >
          <div className="mb-4">
            <ContextStrip
              items={[
                {
                  label: 'Khách hàng',
                  value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                  tone: 'neutral',
                },
                {
                  label: 'Tuần',
                  value: committedMenu?.weekStartDate ? `${formatImportDate(committedMenu.weekStartDate)} - ${formatImportDate(committedMenu.weekEndDate)}` : 'Chưa có menu',
                  tone: committedMenu?.weekStartDate ? 'info' : 'neutral',
                },
                {
                  label: 'Nguyên liệu',
                  value: purchaseSummaryUsesDemand
                    ? aggregatedDemandLines.length.toString()
                    : Object.keys(materialSummary).length.toString(),
                  tone: 'info',
                },
                {
                  label: 'Thiếu sau kiểm tồn',
                  value: purchaseSummaryUsesDemand ? purchaseSummaryShortageCount.toString() : '-',
                  tone: purchaseSummaryShortageCount > 0 ? 'danger' : purchaseSummaryUsesDemand ? 'success' : 'neutral',
                },
              ]}
            />
          </div>

          {!purchaseSummaryUsesDemand && (
            <InlineAlert title="Chưa có số thiếu/đủ sau kiểm tồn" variant="warning" className="mb-3">
              Bảng dưới đây mới là định lượng theo BOM. Bấm Tạo demand từ KHSX ở tab KHSX và nhu cầu để backend kiểm tồn kho và trả ra Cần, Tồn khả dụng, Thiếu/Đủ.
            </InlineAlert>
          )}

          <TableViewport caption="Định lượng tổng hợp và đề xuất mua hàng" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng định lượng tổng hợp và đề xuất mua hàng">
            <table className={cn('ipc-data-table ipc-cost-table table-fixed w-full', purchaseSummaryUsesDemand && 'ipc-status-action-table')}>
              <thead>
                {purchaseSummaryUsesDemand ? (
                  <tr>
                    <th style={{ width: '15%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
                    <th style={{ width: '25%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguồn</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Cần</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Tồn khả dụng</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Chênh lệch</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-center whitespace-nowrap`}>Tiếp theo</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ width: '20%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
                    <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>ĐV</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>LT</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>TT</th>
                    <th style={{ width: '30%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
                    <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá</th>
                    <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {purchaseDemandPageRows.map((line, index) => {
                  const availableAfterReserve = line.available - line.reserved;
                  const variance = availableAfterReserve - line.required;

                  return (
                    <tr key={`${line.id}-${safePurchaseSummaryPageIndex}-${index}`} className="table-row">
                      <td className={`${tableCellClass} text-left font-bold`}>{line.material}</td>
                      <td className={`${tableCellClass} text-left font-medium text-slate-800`}>{line.source}</td>
                      <td className={tableCellClass}>{formatQuantityWithUnit(line.required, line.unit)}</td>
                      <td className={tableCellClass}>{formatQuantityWithUnit(availableAfterReserve, line.unit)}</td>
                      <td className={`${tableCellClass} font-bold ${variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {formatQuantityVariance(variance, line.unit)}
                      </td>
                      <td className="ipc-badge-cell">
                        <StatusBadge variant={line.tone} className="ipc-table-badge ipc-table-badge--status">
                          {line.status}
                        </StatusBadge>
                      </td>
                      <td className={`${tableCellClass} text-left`}>{line.nextAction}</td>
                    </tr>
                  );
                })}
                {purchaseSummaryMaterialPageRows.map(([name, data]) => {
                  const rowCost = data.actual * data.referencePrice;
                  const dishSource = formatMaterialDishSource(data.dishNames);

                  return (
                    <tr key={name} className="table-row">
                      <td className={`${tableCellClass} text-left font-bold`}>{name}</td>
                      <td className={tableCellClass}>{data.unit}</td>
                      <td className={tableCellClass}>{data.theory.toFixed(2)}</td>
                      <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>
                        {data.actual.toFixed(2)}
                      </td>
                      <td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>
                        {dishSource}
                      </td>
                      <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td>
                      <td className={`${tableCellClass} font-bold`}>{formatCurrency(rowCost)}</td>
                    </tr>
                  );
                })}
                {purchaseSummaryTotalItems === 0 && (
                  <tr>
                    <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                      Chưa có nguyên liệu tổng hợp. Kiểm tra menu tuần và BOM catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            className="mt-3"
            page={safePurchaseSummaryPageIndex + 1}
            pageSize={PURCHASE_SUMMARY_PAGE_SIZE}
            totalItems={purchaseSummaryTotalItems}
            onPageChange={(nextPage) => setPurchaseSummaryPageIndex(nextPage - 1)}
          />
        </SectionPanel>
      )}

      {activeView === 'dish-materials' && (
        <>
          {foodCostPercent > 85 && (
            <InlineAlert
              title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!"
              variant="danger"
              className="mb-4"
            >
              Tỉ lệ giá vốn hiện tại đạt <b>{foodCostPercent.toFixed(1)}%</b>, vượt ngưỡng an toàn tối đa (85%). Kiểm tra lại BOM theo tier, giá nguyên liệu hoặc đơn giá bán suất ăn của ca này.
            </InlineAlert>
          )}
          <SectionPanel
            title="Nguyên liệu món phân tích"
            icon={<Scale size={18} color="var(--ipc-slate-600)" />}
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-slate-600 whitespace-nowrap">Món phân tích:</span>
                <select
                  value={analyzedDish?.id ?? ''}
                  onChange={(e) => setSelectedDishId(e.target.value)}
                  className="ipc-select w-[280px] text-[13.5px]"
                  disabled={catalogDishes.length === 0}
                >
                  <optgroup label="Ca Sáng">
                    {catalogDishes.filter(d => matchesShift(d, 'morning')).map((d, index) => (
                      <option key={`morning-${d.id}-${index}`} value={d.id}>
                        {d.name}{weeklyPlanCatalogDishIds.has(d.id) ? ' - trong KH tuần' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ca Chiều">
                    {catalogDishes.filter(d => matchesShift(d, 'afternoon')).map((d, index) => (
                      <option key={`afternoon-${d.id}-${index}`} value={d.id}>
                        {d.name}{weeklyPlanCatalogDishIds.has(d.id) ? ' - trong KH tuần' : ''}
                      </option>
                    ))}
                  </optgroup>
                  {catalogDishes.length === 0 && <option value="">Chưa có catalog</option>}
                </select>
              </div>
            }
          >
            <div className="mb-6 mt-4">
              <ContextStrip
                items={[
                  {
                    label: 'Nguồn tính',
                    value: selectedCustomer ? selectedCustomer.customerCode : committedMenu?.customerCode ?? 'Chưa chọn',
                    tone: 'neutral',
                  },
                  {
                    label: 'Món trong kế hoạch',
                    value: analyzedDish?.name ?? 'Chưa chọn',
                    tone: analyzedDish ? 'info' : 'neutral',
                  },
                  { label: 'Đơn giá bán/suất', value: formatCurrency(menuPrice), tone: 'neutral' },
                  { label: 'Giá vốn nguyên liệu / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
                  {
                    label: 'Tỷ lệ giá vốn (Food Cost %)',
                    value: `${foodCostPercent.toFixed(1)}%`,
                    tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'success',
                  },
                  {
                    label: 'Lợi nhuận gộp / khay (Dự kiến)',
                    value: formatCurrency(Math.round(grossProfit)),
                    tone: grossProfit >= 0 ? 'success' : 'danger',
                  },
                ]}
              />
            </div>

            <TableViewport caption="Giá vốn nguyên liệu cho một khay" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng giá vốn nguyên liệu một khay">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Nguyên liệu</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>ĐV</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>LT / suất</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>TT / suất</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left`}>Món trong kế hoạch</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Đơn giá</th>
                    <th className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100`}>Thành tiền / khay</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedIngredients.map((ing) => (
                    <tr key={ing.name} className="table-row">
                      <td className={`${tableCellClass} text-left font-bold`}>{ing.name}</td>
                      <td className={tableCellClass}>{ing.unit}</td>
                      <td className={tableCellClass}>{ing.theoryQty.toFixed(3)}</td>
                      <td className={`${tableCellClass} font-bold text-blue-600`}>
                        {ing.actualQty.toFixed(3)}
                      </td>
                      <td className={`${tableCellClass} text-left font-medium text-slate-800`}>
                        {analyzedDish?.name ?? 'Chưa chọn'}
                      </td>
                      <td className={tableCellClass}>{formatCurrency(ing.supplierPrice)}</td>
                      <td className={`${tableCellClass} font-bold text-slate-950`}>
                        {formatCurrency(Math.round(ing.cost))}
                      </td>
                    </tr>
                  ))}
                  {analyzedIngredients.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                        Chưa có nguyên liệu cho món đang chọn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
          </SectionPanel>
        </>
      )}

      {isImportDialogOpen && (
        <Dialog
          open={isImportDialogOpen}
          onOpenChange={(open) => {
            setIsImportDialogOpen(open);
            if (!open) {
              resetImportDialog();
            }
          }}
        >
          <DialogContent aria-label="Nhập thực đơn từ Excel" className="ipc-weekly-dialog max-w-6xl overflow-hidden">
            <DialogHeader className="sticky top-0 z-20 flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white/95 pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900">
                Nhập thực đơn từ Excel
              </DialogTitle>
              <button
                type="button"
                onClick={() => setIsImportDialogOpen(false)}
                className="ipc-button ipc-button-ghost ipc-button-bounded"
                aria-label="Đóng modal nhập thực đơn"
                title="Đóng"
              >
                <X size={16} />
                <span>Đóng</span>
              </button>
            </DialogHeader>

            <div className="mt-5 flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 p-0.5 md:grid-cols-3">
                {importWizardSteps.map((step, index) => (
                  <div key={step.key} className={getImportWizardStepClass(step.key, importWizardStep)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-slate-500">Bước {index + 1}</span>
                      {step.key === importWizardStep && (
                        <span className="rounded border border-blue-200 bg-white px-2 py-0.5 text-[11px] font-bold text-blue-700">
                          Đang xử lý
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-bold">{step.label}</div>
                    <div className="text-xs font-medium text-slate-500">{step.hint}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(220px,1fr)_minmax(165px,190px)_minmax(210px,240px)_minmax(250px,1.25fr)_130px]">
                  <FieldRow label="Khách hàng" hint="Chọn khách hàng trong file" className="[&_.ipc-field-label]:min-h-[34px]">
                    <select
                      aria-label="Khách hàng"
                      value={draftImportCustomerId}
                      onChange={(event) => {
                        setDraftImportCustomerId(event.target.value);
                        setImportFeedback(null);
                      }}
                      className="ipc-select h-9 min-h-9"
                      disabled={isCustomerLoading || customers.length === 0}
                    >
                      <option value="">Chọn khách hàng</option>
                      {customers.map((customer) => (
                        <option key={customer.customerId} value={customer.customerId}>
                          {customer.customerCode} - {customer.customerName}
                        </option>
                      ))}
                      {customers.length === 0 && <option value="">Chưa có khách hàng</option>}
                    </select>
                  </FieldRow>
                  <FieldRow label="Tuần bắt đầu" hint="Chọn thứ 2 của tuần" className="[&_.ipc-field-label]:min-h-[34px]">
                    <input
                      aria-label="Tuần bắt đầu"
                      type="date"
                      value={importWeekStartDate}
                      onChange={(event) => {
                        setImportWeekStartDate(event.target.value);
                        setImportFeedback(null);
                      }}
                      className="ipc-input h-9 min-h-9"
                    />
                  </FieldRow>
                  <FieldRow label="Định mức BOM" hint="Chọn tier cho file" className="[&_.ipc-field-label]:min-h-[34px]">
                    <select
                      aria-label="Định mức BOM"
                      value={importPriceTierAmount}
                      onChange={(event) => {
                        setImportPriceTierAmount(normalizeBomPriceTier(Number(event.target.value)));
                        setImportFeedback(null);
                      }}
                      className="ipc-select h-9 min-h-9"
                      disabled={isImporting}
                    >
                      {BOM_PRICE_TIERS.map((tier) => {
                        return (
                          <option
                            key={tier}
                            value={tier}
                          >
                            {formatBomTierLabel(tier)}
                          </option>
                        );
                      })}
                    </select>
                  </FieldRow>
                  <FieldRow label="File Excel" hint="Chọn file thực đơn" className="[&_.ipc-field-label]:min-h-[34px]">
                    <input
                      id="weekly-menu-import-file"
                      ref={importFileInputRef}
                      type="file"
                      accept=".xlsx,.xlsm,.xls"
                      onChange={(event) => {
                        setSelectedImportFile(event.target.files?.[0] ?? null);
                        setImportFeedback(null);
                      }}
                      className="sr-only"
                      aria-describedby="weekly-menu-import-file-meta"
                      disabled={isImporting}
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <button
                        type="button"
                        onClick={() => void handleDownloadWeeklyMenuTemplate()}
                        disabled={isDownloadingWeeklyMenuTemplate || isImporting || !draftImportCustomer}
                        className="ipc-button ipc-button-ghost h-9 min-h-9 w-full justify-center gap-2 px-3 py-0"
                      >
                        <Download size={16} />
                        {isDownloadingWeeklyMenuTemplate ? 'Đang tải...' : 'Tải mẫu theo khách'}
                      </button>
                      <button
                        type="button"
                        onClick={() => importFileInputRef.current?.click()}
                        disabled={isImporting}
                        className="ipc-button ipc-button-ghost h-9 min-h-9 w-full justify-center px-3 py-0"
                      >
                        Chọn file Excel
                      </button>
                    </div>
                  </FieldRow>
                  <div className="flex flex-col gap-1.5 md:pt-[40px]">
                    <button
                      type="button"
                      onClick={handleAddImportJob}
                      disabled={isImporting || !selectedImportFile || !draftImportCustomer}
                      className="ipc-button ipc-button-primary h-9 min-h-9 w-full whitespace-nowrap px-3 py-0"
                    >
                      Thêm file
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickCustomerFormOpen((open) => !open);
                      setImportFeedback(null);
                    }}
                    className="ipc-button ipc-button-ghost ipc-button-bounded"
                    disabled={isImporting}
                  >
                    {isQuickCustomerFormOpen ? 'Đóng thêm khách hàng' : 'Thêm khách hàng mới'}
                  </button>
                  <span id="weekly-menu-import-file-meta" className="text-xs font-medium text-slate-500">
                    {selectedImportFileMeta}
                  </span>
                </div>
              </div>

              {isQuickCustomerFormOpen && (
                <div className="grid grid-cols-1 gap-4 rounded-md border border-blue-200 bg-blue-50/60 p-4 md:grid-cols-[180px_minmax(220px,1fr)_auto]">
                  <FieldRow label="Mã khách hàng" hint="VD: ANV, DAV">
                    <input
                      type="text"
                      value={quickCustomerCode}
                      onChange={(event) => setQuickCustomerCode(event.target.value.toUpperCase())}
                      className="ipc-input"
                      placeholder="ANV"
                      disabled={isCreatingImportCustomer}
                    />
                  </FieldRow>
                  <FieldRow label="Tên khách hàng" hint="Tên đơn vị sẽ hiển thị trong danh sách">
                    <input
                      type="text"
                      value={quickCustomerName}
                      onChange={(event) => setQuickCustomerName(event.target.value)}
                      className="ipc-input"
                      placeholder="Tên khách hàng"
                      disabled={isCreatingImportCustomer}
                    />
                  </FieldRow>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void handleCreateQuickImportCustomer()}
                      className="ipc-button ipc-button-primary w-full whitespace-nowrap"
                      disabled={isCreatingImportCustomer || !quickCustomerCode.trim() || !quickCustomerName.trim()}
                    >
                      {isCreatingImportCustomer ? 'Đang tạo...' : 'Tạo và chọn'}
                    </button>
                  </div>
                </div>
              )}

              {isCustomerError && (
                <InlineAlert title="Chưa tải được danh sách khách hàng" variant="warning">
                  Kiểm tra kết nối hoặc quyền truy cập trước khi nhập thực đơn.
                </InlineAlert>
              )}
              {importFeedback && !hiddenImportFeedbackByDetail && (
                <InlineAlert title={importFeedback.title} variant={importFeedback.variant}>
                  {importFeedback.message}
                </InlineAlert>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">File cần kiểm tra</h3>
                    <p className="text-sm font-medium text-slate-500">Kiểm tra lỗi ngày, món ăn hoặc dòng trùng trước khi lưu thực đơn.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePreviewAllImportJobs}
                      disabled={isImporting || importJobs.length === 0}
                      className="ipc-button ipc-button-ghost"
                    >
                      {isPreviewingImport ? 'Đang kiểm tra...' : 'Kiểm tra tất cả'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCommitReadyImportJobs}
                      disabled={isImporting || readyImportJobs.length === 0}
                      className="ipc-button ipc-button-primary"
                    >
                      {isCommittingImport ? 'Đang lưu...' : 'Lưu file hợp lệ'}
                    </button>
                  </div>
                </div>

                <TableViewport caption="Danh sách file thực đơn chờ kiểm tra" className="max-h-[260px]" ariaLabel="Danh sách file thực đơn chờ kiểm tra">
                  <table className="ipc-data-table min-w-[980px]">
                    <thead>
                      <tr>
                        <th className="text-left whitespace-nowrap">Khách hàng</th>
                        <th className="text-left whitespace-nowrap">Tuần</th>
                        <th className="text-center whitespace-nowrap">Định mức</th>
                        <th className="text-left whitespace-nowrap">File</th>
                        <th className="text-center whitespace-nowrap">File đọc</th>
                        <th className="text-center whitespace-nowrap">Dòng món</th>
                        <th className="text-center whitespace-nowrap">Trạng thái</th>
                        <th className="text-right whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importJobs.map((job) => {
                        const preview = job.previewResult;
                        const isSelected = selectedImportJob?.jobId === job.jobId;
                        return (
                          <tr key={job.jobId} className={cn(isSelected && 'bg-blue-50/70')}>
                            <td className="text-left min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => setSelectedImportJobId(job.jobId)}
                                className="text-left font-bold text-slate-900 hover:text-blue-700"
                              >
                                {job.customerCode} - {job.customerName}
                              </button>
                            </td>
                            <td className="text-left font-medium whitespace-nowrap">{job.weekStartDate ? formatImportDate(job.weekStartDate) : 'Tự nhận theo file'}</td>
                            <td className="text-center whitespace-nowrap">
                              <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                                {formatBomTierLabel(job.priceTierAmount)}
                              </span>
                            </td>
                            <td className="text-left min-w-[280px]">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 whitespace-nowrap">{job.fileName}</span>
                                <span className="text-xs text-slate-500">{formatFileSize(job.fileSize)}</span>
                              </div>
                            </td>
                            <td className="text-center whitespace-nowrap">
                              {preview ? `${preview.detectedLayout.sections.length} phần / ${preview.detectedLayout.dayColumns.length} ngày` : '-'}
                            </td>
                            <td className="text-center whitespace-nowrap">
                              {preview ? preview.detectedLayout.rowsImported.toLocaleString('vi-VN') : '-'}
                            </td>
                            <td className="text-center whitespace-nowrap">
                              <span className={cn(getImportJobStatusClass(job.status), 'whitespace-nowrap')}>
                                {getImportJobStatusLabel(job.status)}
                              </span>
                            </td>
                            <td className="text-right min-w-[220px]">
                              <div className="flex flex-nowrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handlePreviewImportJob(job.jobId)}
                                  disabled={isImporting || job.status === 'committed'}
                                  className="ipc-button ipc-button-ghost min-w-[76px] whitespace-nowrap"
                                >
                                  Kiểm tra
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleCommitImportJob(job.jobId)}
                                  disabled={isImporting || job.status !== 'previewed'}
                                  className="ipc-button ipc-button-primary min-w-[52px] whitespace-nowrap"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImportJob(job.jobId)}
                                  disabled={isImporting}
                                  className="ipc-button ipc-button-ghost min-w-[52px] whitespace-nowrap"
                                >
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {importJobs.length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-5 text-center text-sm font-medium text-slate-500">
                            Chưa có file nào. Chọn khách hàng, tuần, định mức và file Excel rồi bấm Thêm file.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableViewport>
              </div>

              <SectionPanel title="Lịch sử import thực đơn tuần">
                <TableViewport caption="Lịch sử import thực đơn tuần" className="max-h-[260px]" ariaLabel="Lịch sử import thực đơn tuần">
                  <table className="ipc-data-table">
                    <thead>
                      <tr>
                        <th className="text-left">Khách hàng</th>
                        <th className="text-left">Tuần</th>
                        <th className="text-center">Phiên bản</th>
                        <th className="text-center">Trạng thái</th>
                        <th className="text-center">Dòng</th>
                        <th className="text-left">Người tạo</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.map((item) => {
                        const label = `${item.customerCode} - tuần ${formatImportDate(item.weekStartDate)} (v${item.versionNo})`;
                        return (
                          <tr key={item.menuVersionId}>
                            <td>{item.customerCode} - {item.customerName}</td>
                            <td>{formatImportDate(item.weekStartDate)}</td>
                            <td className="text-center">v{item.versionNo}</td>
                            <td className="text-center">
                              <StatusBadge
                                variant={item.status === 'DRAFT' ? 'success' : item.status === 'ROLLED_BACK' ? 'danger' : 'neutral'}
                              >
                                {item.status}
                              </StatusBadge>
                            </td>
                            <td className="text-center text-xs">
                              {item.successRowCount} thành công
                              {item.errorRowCount > 0 ? ` / ${item.errorRowCount} lỗi` : ''}
                              {item.warningRowCount > 0 ? ` / ${item.warningRowCount} cảnh báo` : ''}
                            </td>
                            <td>{item.createdByName ?? '-'}</td>
                            <td className="text-right">
                              <button
                                type="button"
                                onClick={() => requestRollbackImport(item.menuVersionId, label)}
                                disabled={!item.canRollback || isRollingBackImport}
                                title={item.canRollback ? undefined : item.cannotRollbackReason ?? 'Không thể rollback'}
                                className="ipc-button ipc-button-ghost ipc-button-bounded"
                              >
                                Rollback
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {importHistory.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-5 text-center text-sm font-medium text-slate-500">
                            Chưa có lịch sử import thực đơn tuần.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </TableViewport>
              </SectionPanel>

              {selectedImportJob && (
                <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Kết quả kiểm tra {selectedImportJob.customerCode}
                      </h3>
                      <p className="text-sm font-medium text-slate-500">{selectedImportJob.fileName}</p>
                    </div>
                    <span className={getImportJobStatusClass(selectedImportJob.status)}>
                      {getImportJobStatusLabel(selectedImportJob.status)}
                    </span>
                  </div>

                  {selectedImportProblemMessages.length > 0 && (
                    <InlineAlert title="Cần sửa file Excel" variant="danger">
                      <ul className="list-disc space-y-1 pl-4">
                        {selectedImportProblemMessages.map((message, index) => (
                          <li key={`${message}-${index}`}>{message}</li>
                        ))}
                      </ul>
                      {selectedImportIssues.length > selectedImportProblemMessages.length && (
                        <p className="mt-1 font-medium">
                          Còn {selectedImportIssues.length - selectedImportProblemMessages.length} mục khác. Sửa các lỗi đầu rồi bấm Kiểm tra lại.
                        </p>
                      )}
                    </InlineAlert>
                  )}

                  {selectedImportPreview && (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <ContextStrip
                          items={[
                            { label: 'Tuần trong file', value: `${formatImportDate(selectedImportPreview.weekStartDate)} - ${formatImportDate(selectedImportPreview.weekEndDate)}`, tone: 'info' },
                            { label: 'Số món đọc được', value: selectedImportPreview.detectedLayout.rowsImported.toString(), tone: 'success' },
                          ]}
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveImportMapping()}
                          disabled={isSavingImportMapping}
                          className="ipc-button ipc-button-ghost ipc-button-bounded"
                          title="Ghi nhớ cách đọc file này cho khách hàng, dùng lại cho lần sau"
                        >
                          {isSavingImportMapping ? 'Đang ghi nhớ...' : 'Ghi nhớ cách đọc file'}
                        </button>
                      </div>

                      {selectedImportDiffRows.length > 0 && (
                        <InlineAlert title={`${selectedImportJob.customerCode}: file Excel khác thực đơn đang lưu`} variant="info">
                          <div className="space-y-1">
                            <p>Nếu bấm Lưu, các món trong file Excel sẽ thay cho các món đang lưu ở những vị trí này.</p>
                            <ul className="list-disc space-y-1 pl-4">
                              {selectedImportDiffRows
                                .slice(0, 3)
                                .map((row, index) => (
                                  <li key={`${row.serviceDate}-${row.shiftName}-${row.slot}-${index}`}>
                                    {formatImportDate(row.serviceDate)} {row.shiftName}: đang lưu "{formatMenuDishName(row.currentDishName)}", file Excel "{formatMenuDishName(row.importedDishName)}"
                                  </li>
                                ))}
                            </ul>
                            {selectedImportDiffRows.length > 3 && (
                              <p className="font-medium">Còn {selectedImportDiffRows.length - 3} vị trí khác.</p>
                            )}
                          </div>
                        </InlineAlert>
                      )}

                      {selectedImportWarningMessages.length > 0 && (
                        <InlineAlert
                          title={selectedImportJob.status === 'committed' ? 'Đã lưu thực đơn, cần chú ý' : 'Cần chú ý khi đọc file'}
                          variant="warning"
                        >
                          <ul className="list-disc space-y-1 pl-4">
                            {selectedImportWarningMessages.map((message, index) => (
                              <li key={`${message}-${index}`}>{message}</li>
                            ))}
                          </ul>
                          {selectedImportWarningSummary.length > selectedImportWarningMessages.length && (
                            <p className="mt-1 font-medium">
                              Còn {selectedImportWarningSummary.length - selectedImportWarningMessages.length} nhắc nhở khác.
                            </p>
                          )}
                        </InlineAlert>
                      )}

                      <ImportedLayoutMatrix
                        rows={importPreviewLayoutRows}
                        displayDays={importPreviewDisplayDays}
                        activeDayKey={selectedImportPreviewActiveDayKey}
                        maxBodyHeight="max-h-[300px]"
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="text-sm font-medium text-slate-600">
                {importJobs.length === 0
                  ? 'Thêm ít nhất một khách hàng và file Excel để bắt đầu'
                  : `${readyImportJobs.length}/${importJobs.length} file đã kiểm tra xong`}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportDialogOpen(false)}
                className="ipc-button ipc-button-ghost"
              >
                Đóng
              </button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog for global menu edit */}
      {isEditingMenu && (
        <Dialog open={isEditingMenu} onOpenChange={(open) => !open && setIsEditingMenu(false)}>
          <DialogContent aria-label="Chỉnh sửa thực đơn tuần" className="ipc-weekly-dialog max-w-5xl overflow-hidden">
            <DialogHeader className="sticky top-0 z-20 flex flex-row items-center justify-between gap-3 border-b border-slate-100 bg-white/95 pb-3">
              <DialogTitle className="text-slate-900 font-bold text-lg">
                Chỉnh sửa Thực đơn tuần (T2 - T7)
              </DialogTitle>
              <button
                type="button"
                onClick={() => setIsEditingMenu(false)}
                className="ipc-button ipc-button-ghost ipc-button-bounded"
                aria-label="Đóng modal chỉnh sửa thực đơn"
                title="Đóng"
              >
                <X size={16} />
                <span>Đóng</span>
              </button>
            </DialogHeader>

            <div className="mt-4 flex max-h-[68vh] flex-col gap-6 overflow-y-auto pr-1">
              {SECTIONS.map((sec) => (
                <div key={sec.label} className="border-b border-slate-200 pb-5 last:border-0 last:pb-0">
                  <h3 className="mb-3 rounded bg-slate-50 px-3 py-1.5 text-[13px] font-bold uppercase text-slate-800">
                    {sec.label}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {displayDays.map((day) => {
                      const isLocked = !!lockedShifts[`${day.key}-${sec.slotType.startsWith('morning') ? 'Ca Sáng' : 'Ca Chiều'}`];
                      const slot = tempWeeklyMenu[day.key]?.[sec.slotType];

                      return (
                        <div key={day.key} className="p-2 border border-slate-200 rounded-md bg-white flex flex-col gap-1.5 shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-semibold text-slate-700">{day.label}</span>
                            <span className="text-[10px] text-slate-400">{day.date}</span>
                          </div>

                          {isLocked ? (
                            <div className="flex h-9 items-center justify-center gap-1.5 rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
                              <Lock size={10} className="text-slate-400" />
                              <span>Đã khóa</span>
                            </div>
                          ) : (
                            <select
                              value={slot?.dishId || getSectionDefaultDish(sec)?.id || ''}
                              onChange={(e) => {
                                setTempWeeklyMenu((prev) => ({
                                  ...prev,
                                  [day.key]: {
                                    ...prev[day.key],
                                    [sec.slotType]: {
                                      ...prev[day.key]?.[sec.slotType],
                                      portions: prev[day.key]?.[sec.slotType]?.portions ?? 0,
                                      dishId: e.target.value,
                                    },
                                  },
                                }));
                              }}
                              className="ipc-select text-[12px] h-9 p-1 w-full"
                              disabled={getSectionDishes(sec).length === 0}
                            >
                              {getSectionDishes(sec).map((d, index) => (
                                <option key={`${sec.slotType}-${d.id}-${index}`} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                              {getSectionDishes(sec).length === 0 && <option value="">Chưa có catalog</option>}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsEditingMenu(false)}
                className="ipc-button ipc-button-ghost"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="ipc-button ipc-button-primary"
              >
                {isSavingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={rollbackTarget !== null} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <DialogContent aria-label="Xác nhận hủy phiên import" className="ipc-weekly-dialog max-w-md">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">Xác nhận hủy phiên import</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm font-medium text-slate-600">
            Hủy phiên import <span className="font-bold text-slate-900">"{rollbackTarget?.label}"</span>? Lịch thực đơn của tuần đó sẽ bị xóa và không thể khôi phục.
          </div>
          <DialogFooter className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setRollbackTarget(null)}
              className="ipc-button ipc-button-ghost"
            >
              Không hủy
            </button>
            <button
              type="button"
              onClick={() => void confirmRollbackImport()}
              disabled={isRollingBackImport}
              className="ipc-button ipc-button-danger"
            >
              {isRollingBackImport ? 'Đang hủy...' : 'Xác nhận hủy'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationalFrame>
  );
};

export default WeeklyMenuPage;
