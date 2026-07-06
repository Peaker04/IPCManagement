import { useEffect, useMemo, useState, Fragment } from 'react';
import { Calendar, Scale, Lock, Edit, Upload, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { updateWeeklyMenuDish, setMenuPrice, setLossRate, setWeeklyMenu } from '../../coordination/coordinationSlice';
import { CommandBar, ContextStrip, DataTableShell, DemandSummary, DocumentRail, FieldRow, InlineAlert, OperationalFrame, SectionPanel, Toolbar, ViewSwitcher } from '@/components/common';
import { useGenerateMaterialDemandMutation, useGeneratePurchaseRequestFromDemandMutation, useGetIngredientDemandQuery, useGetWorkflowDocumentsQuery } from '@/features/workflow';
import { ActionGuard } from '@/routes/ActionGuard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DAYS_OF_WEEK_WITH_DATES as DEFAULT_DAYS_OF_WEEK } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { useGetDishesCatalogQuery } from '../dishCatalogApi';
import type { CatalogDish } from '../dishCatalogApi';
import type { WeeklyMenuState } from '../../coordination/types';
import {
  useCommitWeeklyMenuImportMutation,
  useGetCoordinationCustomersQuery,
  useGetCommittedWeeklyMenuQuery,
  usePreviewWeeklyMenuImportMutation,
  useUpdateWeeklyMenuBulkMutation,
} from '../../coordination/coordinationApi';
import type { WeeklyMenuImportResult } from '../../coordination/coordinationApi';

interface MaterialSummaryEntry {
  theory: number;
  actual: number;
  unit: string;
  referencePrice: number;
}

type MaterialSummary = Record<string, MaterialSummaryEntry>;

type GeneratedMaterialRequest = {
  materialRequestId: string;
  requestCode: string;
  serviceDate: string;
  shortageLineCount: number;
};

const tableHeadClass = 'text-center';
const tableCellClass = 'text-center';
type ScheduleRowKey = 'main' | 'sub1' | 'sub2' | 'rau' | 'canh' | 'fruit';
type WeeklyPlanRow = {
  key: string;
  dayKey: string;
  dayLabel: string;
  date: string;
  sectionLabel: string;
  shiftLabel: string;
  menuTypeLabel: string;
  dishId: string;
  dishName: string;
  portions: number;
  hasCatalogBom: boolean;
};

const importSlotLabels: Record<string, string> = {
  main: 'Món chính',
  sub1: 'Phụ 1',
  sub2: 'Phụ 2',
  rau: 'Rau',
  canh: 'Canh',
  fruit: 'Tráng miệng',
};

const getDishSearchText = (dish: CatalogDish): string =>
  [
    dish.name,
    dish.code,
    dish.dishType,
    dish.dishGroup,
    ...dish.menuSlots,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const matchesShift = (dish: CatalogDish, shift: 'morning' | 'afternoon') => {
  const text = getDishSearchText(dish);
  if (shift === 'morning') {
    return text.includes('sáng') || text.includes('morning') || !text.includes('chiều');
  }

  return text.includes('chiều') || text.includes('afternoon') || !text.includes('sáng');
};

const matchesCategory = (dish: CatalogDish, category: 'savory' | 'vegetarian') => {
  const text = getDishSearchText(dish);
  const isVegetarian = text.includes('chay') || text.includes('vegetarian');
  return category === 'vegetarian' ? isVegetarian : !isVegetarian;
};

const SECTIONS = [
  { label: 'MENU MẶN CA SÁNG', slotType: 'morningSavory' as const, category: 'savory' as const, shift: 'morning' as const },
  { label: 'MENU CHAY CA SÁNG', slotType: 'morningVegetarian' as const, category: 'vegetarian' as const, shift: 'morning' as const },
  { label: 'MENU MẶN - CA CHIỀU', slotType: 'afternoonSavory' as const, category: 'savory' as const, shift: 'afternoon' as const },
  { label: 'MENU CHAY - CA CHIỀU', slotType: 'afternoonVegetarian' as const, category: 'vegetarian' as const, shift: 'afternoon' as const }
] as const;

const getDishComponents = (dish?: CatalogDish): { sub1: string; sub2: string; rau: string; canh: string; fruit: string } => {
  const names = dish?.ingredients.map((ingredient) => ingredient.name).filter(Boolean) ?? [];
  return {
    sub1: names[0] ?? 'Theo catalog',
    sub2: names[1] ?? 'Theo catalog',
    rau: names[2] ?? 'Theo catalog',
    canh: names[3] ?? 'Theo catalog',
    fruit: 'Theo thực đơn',
  };
};

const getSectionRowTypes = (category: 'savory' | 'vegetarian') => [
  { key: 'main', label: category === 'savory' ? 'Món mặn chính' : 'Món chay chính' },
  { key: 'sub1', label: 'Phụ 1' },
  { key: 'sub2', label: 'Phụ 2' },
  { key: 'rau', label: 'Rau' },
  { key: 'canh', label: 'Canh' },
  { key: 'fruit', label: 'Trái cây' },
] as const satisfies ReadonlyArray<{ key: ScheduleRowKey; label: string }>;

const normalizeMergedCellValue = (value: string) =>
  value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN');

const normalizeDishMatchKey = (value?: string) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'd')
    .replace(/\b\d+\s*(g|gram)\b/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('vi-VN');

const buildRowSpans = (values: string[]) => {
  const rowSpans = Array(values.length).fill(1);
  let rowIndex = 0;

  while (rowIndex < values.length) {
    const value = normalizeMergedCellValue(values[rowIndex] ?? '');
    if (!value) {
      rowIndex += 1;
      continue;
    }

    let span = 1;
    while (
      rowIndex + span < values.length &&
      normalizeMergedCellValue(values[rowIndex + span] ?? '') === value
    ) {
      span += 1;
    }

    rowSpans[rowIndex] = span;
    for (let skippedIndex = rowIndex + 1; skippedIndex < rowIndex + span; skippedIndex += 1) {
      rowSpans[skippedIndex] = 0;
    }

    rowIndex += span;
  }

  return rowSpans;
};

type WeeklyMenuView = 'schedule' | 'demand' | 'cost';

const buildMaterialSummary = (
  weeklyMenu: WeeklyMenuState,
  dishesById: Map<string, CatalogDish>,
  dishesByName: Map<string, CatalogDish>,
  priceRatio: number,
  lossRate: number,
): MaterialSummary => {
  const summary: MaterialSummary = {};

  Object.values(weeklyMenu).forEach((slots) => {
    const activeSlots = [
      slots.morningSavory,
      slots.morningVegetarian,
      slots.afternoonSavory,
      slots.afternoonVegetarian,
    ];

    activeSlots.forEach((slot) => {
      if (!slot) return;
      const dish = dishesById.get(slot.dishId) ?? dishesByName.get(normalizeDishMatchKey(slot.customComponents?.main));
      if (!dish) {
        return;
      }

      dish.ingredients.forEach((ingredient) => {
        if (!summary[ingredient.name]) {
          summary[ingredient.name] = {
            theory: 0,
            actual: 0,
            unit: ingredient.unit,
            referencePrice: ingredient.referencePrice,
          };
        }
        summary[ingredient.name].theory += ingredient.grossQtyPerServing * slot.portions;
      });
    });
  });

  return Object.fromEntries(
    Object.entries(summary).map(([name, data]) => [
      name,
      {
        theory: data.theory,
        actual: data.theory * priceRatio * (1 + lossRate / 100),
        unit: data.unit,
        referencePrice: data.referencePrice,
      },
    ]),
  ) as MaterialSummary;
};

const calculateTotalMaterialCost = (materialSummary: MaterialSummary): number =>
  Object.values(materialSummary).reduce((total, data) => total + data.actual * data.referencePrice, 0);

const formatImportDate = (value?: string) => {
  if (!value) return 'Chưa xác định';
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnlyMatch) {
    return `${Number(dateOnlyMatch[3])}/${Number(dateOnlyMatch[2])}/${dateOnlyMatch[1]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('vi-VN');
};

const LAST_WEEKLY_MENU_CUSTOMER_KEY = 'ipc.weeklyMenu.lastCustomerId';
const LAST_WEEKLY_MENU_WEEK_KEY = 'ipc.weeklyMenu.lastWeekStartDate';

const isValidWeekStartDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return true;

  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return parsed.getDay() === 1;
};

const getStoredWeekStartDate = () => {
  const stored = window.localStorage.getItem(LAST_WEEKLY_MENU_WEEK_KEY) ?? '';
  if (stored && !isValidWeekStartDate(stored)) {
    window.localStorage.removeItem(LAST_WEEKLY_MENU_WEEK_KEY);
    return '';
  }

  return stored;
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  const error = err as { data?: { message?: string }, message?: string };
  return error.data?.message || error.message || fallback;
};

const buildImportedDayDates = (rows: WeeklyMenuImportResult['rows']) =>
  rows.reduce<Record<string, string>>((dates, row) => {
    if (!dates[row.dayKey]) {
      dates[row.dayKey] = formatImportDate(row.serviceDate);
    }

    return dates;
  }, {});

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
  } = useGetCoordinationCustomersQuery();
  const customers = customerResponse?.data ?? [];
  const [previewImport, { isLoading: isPreviewingImport }] = usePreviewWeeklyMenuImportMutation();
  const [commitImport, { isLoading: isCommittingImport }] = useCommitWeeklyMenuImportMutation();
  const [updateWeeklyMenuBulk, { isLoading: isSavingEdit }] = useUpdateWeeklyMenuBulkMutation();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedImportCustomerId, setSelectedImportCustomerId] = useState(
    () => window.localStorage.getItem(LAST_WEEKLY_MENU_CUSTOMER_KEY) ?? '',
  );
  const effectiveImportCustomerId = selectedImportCustomerId || customers[0]?.customerId || '';
  const [committedMenuWeekStartDate, setCommittedMenuWeekStartDate] = useState(
    getStoredWeekStartDate,
  );
  const [importWeekStartDate, setImportWeekStartDate] = useState('');
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<WeeklyMenuImportResult | null>(null);
  const [importedMenuDates, setImportedMenuDates] = useState<Record<string, string>>({});
  const [importFeedback, setImportFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const isImporting = isPreviewingImport || isCommittingImport;
  const { data: committedMenuResponse } = useGetCommittedWeeklyMenuQuery(
    {
      customerId: effectiveImportCustomerId,
      weekStartDate: committedMenuWeekStartDate || undefined,
    },
    { skip: !effectiveImportCustomerId },
  );
  const committedMenu = committedMenuResponse?.data;
  const committedMenuDates = useMemo(
    () => (committedMenu?.rows ? buildImportedDayDates(committedMenu.rows) : {}),
    [committedMenu],
  );
  const displayDays = useMemo(() => {
    const baseDate = new Date(committedMenuWeekStartDate);
    const dayOffsets: Record<string, number> = {
      t2: 0,
      t3: 1,
      t4: 2,
      t5: 3,
      t6: 4,
      t7: 5,
      cn: 6,
    };

    return DEFAULT_DAYS_OF_WEEK.map((day) => {
      let calcDate = '';
      if (!isNaN(baseDate.getTime())) {
        const offset = dayOffsets[day.key] ?? 0;
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + offset);
        const dayVal = d.getDate();
        const monthVal = d.getMonth() + 1;
        const yearVal = d.getFullYear();
        calcDate = `${dayVal}/${monthVal}/${yearVal}`;
      }

      return {
        ...day,
        date: (importedMenuDates[day.key] ?? committedMenuDates[day.key] ?? calcDate) || day.date,

      };
    });
  }, [committedMenuWeekStartDate, committedMenuDates, importedMenuDates]);


  const resetImportDialog = () => {
    setSelectedImportFile(null);
    setImportPreview(null);
    setImportFeedback(null);
  };

  const handleImportClick = () => {
    resetImportDialog();
    setIsImportDialogOpen(true);
  };

  const handleImportPreview = async () => {
    if (!selectedImportFile || !effectiveImportCustomerId) {
      setImportFeedback({
        title: 'Thiếu thông tin import',
        message: 'Vui lòng chọn khách hàng và file Excel trước khi xem trước.',
        variant: 'warning',
      });
      return;
    }

    if (!isValidWeekStartDate(importWeekStartDate)) {
      setImportFeedback({
        title: 'Ngày bắt đầu tuần không hợp lệ',
        message: 'Vui lòng chọn ngày thứ 2 để backend gắn đúng cột Thứ 2 - Thứ 7.',
        variant: 'warning',
      });
      return;
    }

    try {
      setImportFeedback({
        title: 'Đang phân tích file',
        message: `Backend đang đọc bảng thực đơn trong ${selectedImportFile.name}.`,
        variant: 'info',
      });
      const response = await previewImport({
        file: selectedImportFile,
        customerId: effectiveImportCustomerId,
        weekStartDate: importWeekStartDate || undefined,
      }).unwrap();
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không đọc được file thực đơn.');
      }

      setImportPreview(response.data);
      setImportFeedback({
        title: 'Đã tạo bản xem trước',
        message: `Tìm thấy ${response.data.detectedLayout.rowsImported} dòng món hợp lệ, bỏ qua ${response.data.detectedLayout.rowsSkipped} dòng trên sheet ${response.data.detectedLayout.sheetName}.`,
        variant: response.data.warnings.length > 0 ? 'warning' : 'info',
      });
    } catch (err: unknown) {
      setImportPreview(null);
      setImportFeedback({
        title: 'Xem trước thất bại',
        message: getApiErrorMessage(err, 'Không thể phân tích file thực đơn.'),
        variant: 'danger',
      });
    }
  };

  const handleImportCommit = async () => {
    if (!selectedImportFile || !effectiveImportCustomerId || !importPreview) {
      setImportFeedback({
        title: 'Chưa có bản xem trước',
        message: 'Vui lòng xem trước file trước khi lưu vào hệ thống.',
        variant: 'warning',
      });
      return;
    }

    if (!isValidWeekStartDate(importWeekStartDate)) {
      setImportFeedback({
        title: 'Ngày bắt đầu tuần không hợp lệ',
        message: 'Vui lòng chọn ngày thứ 2 rồi xem trước lại trước khi lưu.',
        variant: 'warning',
      });
      return;
    }

    try {
      setImportFeedback({
        title: 'Đang lưu thực đơn',
        message: 'Hệ thống đang ghi thực đơn, món ăn và lịch phục vụ vào backend.',
        variant: 'info',
      });
      const response = await commitImport({
        file: selectedImportFile,
        customerId: effectiveImportCustomerId,
        weekStartDate: importWeekStartDate || undefined,
      }).unwrap();
      if (!response.success || !response.data) {
        throw new Error(response.message || 'Không lưu được thực đơn.');
      }

      window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, response.data.customerId);
      if (response.data.weekStartDate) {
        window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, response.data.weekStartDate);
        setCommittedMenuWeekStartDate(response.data.weekStartDate);
      }
      setSelectedImportCustomerId(response.data.customerId);
      dispatch(setWeeklyMenu(response.data.importedWeeklyMenu));
      setImportedMenuDates(buildImportedDayDates(response.data.rows));
      setImportPreview(response.data);
      setIsImportDialogOpen(false);
      setWarehouseExportFeedback({
        title: response.data.warnings.length > 0 ? 'Import thực đơn thành công (có cảnh báo)' : 'Import thực đơn thành công',
        message: [
          `Đã lưu ${response.data.detectedLayout.rowsImported} dòng món cho ${response.data.customerCode}; bỏ qua ${response.data.detectedLayout.rowsSkipped} dòng không phải món.`,
          ...response.data.warnings.slice(0, 4),
        ].join('\n'),
        variant: response.data.warnings.length > 0 ? 'warning' : 'info',
      });
    } catch (err: unknown) {
      setImportFeedback({
        title: 'Lưu import thất bại',
        message: getApiErrorMessage(err, 'Không thể lưu thực đơn vào backend.'),
        variant: 'danger',
      });
    }
  };

  useEffect(() => {
    if (!committedMenu?.importedWeeklyMenu || Object.keys(committedMenu.importedWeeklyMenu).length === 0) {
      dispatch(setWeeklyMenu({}));
      return;
    }

    dispatch(setWeeklyMenu(committedMenu.importedWeeklyMenu));
  }, [committedMenu, dispatch]);

  // Đơn giá chuẩn là 35,000 đ
  const standardPrice = 35000;
  const menuPrice = useAppSelector((state) => state.coordination.menuPrice);
  const lossRate = useAppSelector((state) => state.coordination.lossRate);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [activeView, setActiveView] = useState<WeeklyMenuView>('schedule');
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
  const [generatedMaterialRequests, setGeneratedMaterialRequests] = useState<GeneratedMaterialRequest[]>([]);
  const [dismissedBoms, setDismissedBoms] = useState<Record<string, string>>({});
  const [dismissingDish, setDismissingDish] = useState<{ id: string; name: string } | null>(null);
  const [dismissReason, setDismissReason] = useState('Món ăn phụ không cần định lượng');
  const { data: demandLines = [] } = useGetIngredientDemandQuery({ limit: 100 });
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const [generateMaterialDemand, { isLoading: isGeneratingDemand }] = useGenerateMaterialDemandMutation();
  const [generatePurchaseRequestFromDemand, { isLoading: isGeneratingPurchaseRequest }] = useGeneratePurchaseRequestFromDemandMutation();
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

  const getServiceDateIso = (dayKey: string) => {
    const row = committedMenu?.rows?.find((r) => r.dayKey === dayKey);
    if (row?.serviceDate) {
      return row.serviceDate.split('T')[0];
    }
    return '';
  };

  const handleGenerateDemand = async () => {
    const serviceDates = Array.from(
      new Set(weeklyPlanRows.map((row) => row.date).filter(Boolean)),
    );

    if (serviceDates.length === 0) {
      setDemandFeedback({
        title: 'Chưa có ngày để tạo demand',
        message: 'Vui lòng import hoặc tải kế hoạch tuần trước khi tạo nhu cầu nguyên liệu.',
        variant: 'warning',
      });
      return;
    }

    setDemandFeedback(null);
    const results = await Promise.all(serviceDates.map(async (serviceDate) => {
      try {
        const response = await generateMaterialDemand({ serviceDate, scope: 'FULLDAY' }).unwrap();
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Không tạo được nhu cầu nguyên liệu.');
        }

        return { serviceDate, response };
      } catch (error) {
        return { serviceDate, error };
      }
    }));

    const succeeded = results.filter((result): result is { serviceDate: string; response: NonNullable<(typeof result)['response']> } => 'response' in result);
    const skipped = results.length - succeeded.length;
    const demandLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.lines.length, 0);
    const shortageLineCount = succeeded.reduce(
      (sum, result) => sum + result.response.data!.lines.filter((line) => line.suggestedPurchaseQty > 0).length,
      0,
    );
    const missingBomCount = succeeded.reduce((sum, result) => sum + result.response.data!.missingBomDishes.length, 0);
    const planLineCount = succeeded.reduce((sum, result) => sum + result.response.data!.productionPlanLineCount, 0);
    const generatedRequests = succeeded.map((result) => ({
      materialRequestId: result.response.data!.materialRequestId,
      requestCode: result.response.data!.requestCode,
      serviceDate: result.response.data!.serviceDate,
      shortageLineCount: result.response.data!.lines.filter((line) => line.suggestedPurchaseQty > 0).length,
    }));

    if (succeeded.length === 0) {
      const firstError = results.find((result) => 'error' in result)?.error;
      setDemandFeedback({
        title: 'Chưa tạo được demand',
        message: getApiErrorMessage(firstError, 'Không tìm thấy số suất đã chốt cho các ngày trong tuần.'),
        variant: 'danger',
      });
      return;
    }

    setGeneratedMaterialRequests(generatedRequests);
    setDemandFeedback({
      title: skipped > 0 ? 'Đã tạo demand cho ngày đã chốt' : 'Đã tạo demand cho tuần',
      message: `Tạo thành công ${succeeded.length}/${results.length} ngày, ${planLineCount} dòng KHSX, ${demandLineCount} dòng nguyên liệu, ${shortageLineCount} dòng thiếu. ${shortageLineCount > 0 ? 'Thu mua có thể sinh danh sách mua thêm bằng nút riêng.' : 'Không phát sinh dòng thiếu để mua thêm.'} ${missingBomCount > 0 ? `${missingBomCount} món chưa có BOM cần bổ sung.` : 'BOM đã đủ cho các dòng sinh demand.'}`,
      variant: missingBomCount > 0 || skipped > 0 ? 'warning' : 'info',
    });
  };

  const handleGeneratePurchaseRequests = async () => {
    const candidateMap = new Map<string, GeneratedMaterialRequest>();
    generatedMaterialRequests
      .filter((request) => request.shortageLineCount > 0)
      .forEach((request) => candidateMap.set(request.materialRequestId, request));
    demandLines
      .filter((line) => line.tone === 'danger' && line.materialRequestId)
      .forEach((line) => {
        if (!line.materialRequestId) return;
        candidateMap.set(line.materialRequestId, {
          materialRequestId: line.materialRequestId,
          requestCode: line.sourceDocumentCode ?? line.source,
          serviceDate: '',
          shortageLineCount: 1,
        });
      });

    const candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) {
      setDemandFeedback({
        title: 'Chưa có demand thiếu hàng',
        message: 'Hãy tạo demand trước hoặc kiểm tra báo cáo nhu cầu nguyên liệu để có dòng thiếu cần mua thêm.',
        variant: 'warning',
      });
      return;
    }

    setDemandFeedback(null);
    const purchaseResults = await Promise.all(candidates.map(async (request) => {
        try {
          const response = await generatePurchaseRequestFromDemand({
            materialRequestId: request.materialRequestId,
          }).unwrap();
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Không tạo được danh sách mua thêm.');
          }

          return { request, response };
        } catch (error) {
          return { request, error };
        }
      }));
    const purchaseSuccessCount = purchaseResults.filter((result) => 'response' in result).length;
    const purchaseLineCount = purchaseResults.reduce(
      (sum, result) => ('response' in result ? sum + (result.response?.data?.lines.length ?? 0) : sum),
      0,
    );
    const failed = purchaseResults.length - purchaseSuccessCount;

    setDemandFeedback({
      title: failed > 0 ? 'Sinh danh sách mua thêm chưa đủ' : 'Đã sinh danh sách mua thêm',
      message: `Xử lý ${purchaseSuccessCount}/${purchaseResults.length} demand thiếu hàng, tạo/cập nhật ${purchaseLineCount} dòng mua thêm.${failed > 0 ? ' Một số demand cần kiểm tra lại nhà cung cấp hoặc dữ liệu nguyên liệu.' : ''}`,
      variant: failed > 0 ? 'warning' : 'info',
    });
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
        customerId: effectiveImportCustomerId,
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

  // Merge dishId from Redux with portions calculated from active customer orders
  const weeklyMenu = (() => {
    const merged: WeeklyMenuState = {};

    displayDays.forEach(({ key: day }) => {
      const slots = reduxWeeklyMenu[day];
      if (!slots) return;

      // Morning portions
      const morningOrders = orders.filter((o) => o.dayOfWeek === day && o.shift === 'Ca Sáng');
      const isMorningLocked = !!lockedShifts[`${day}-Ca Sáng`];
      const morningPortions = morningOrders.reduce(
        (sum, o) => sum + (isMorningLocked ? o.actualQuantity : o.forecastQuantity),
        0,
      );

      // Afternoon portions
      const afternoonOrders = orders.filter((o) => o.dayOfWeek === day && o.shift === 'Ca Chiều');
      const isAfternoonLocked = !!lockedShifts[`${day}-Ca Chiều`];
      const afternoonPortions = afternoonOrders.reduce(
        (sum, o) => sum + (isAfternoonLocked ? o.actualQuantity : o.forecastQuantity),
        0,
      );

      // Savory is 85%, Vegetarian is 15%
      const morningSavoryPortions = Math.round(morningPortions * 0.85);
      const morningVegetarianPortions = morningPortions - morningSavoryPortions;

      const afternoonSavoryPortions = Math.round(afternoonPortions * 0.85);
      const afternoonVegetarianPortions = afternoonPortions - afternoonSavoryPortions;

      merged[day] = {
        morningSavory: {
          dishId: slots.morningSavory?.dishId || getSectionDefaultDish(SECTIONS[0])?.id || '',
          portions: morningSavoryPortions || slots.morningSavory?.portions || 0,
          customComponents: slots.morningSavory?.customComponents,
        },
        morningVegetarian: {
          dishId: slots.morningVegetarian?.dishId || getSectionDefaultDish(SECTIONS[1])?.id || '',
          portions: morningVegetarianPortions || slots.morningVegetarian?.portions || 0,
          customComponents: slots.morningVegetarian?.customComponents,
        },
        afternoonSavory: {
          dishId: slots.afternoonSavory?.dishId || getSectionDefaultDish(SECTIONS[2])?.id || '',
          portions: afternoonSavoryPortions || slots.afternoonSavory?.portions || 0,
          customComponents: slots.afternoonSavory?.customComponents,
        },
        afternoonVegetarian: {
          dishId: slots.afternoonVegetarian?.dishId || getSectionDefaultDish(SECTIONS[3])?.id || '',
          portions: afternoonVegetarianPortions || slots.afternoonVegetarian?.portions || 0,
          customComponents: slots.afternoonVegetarian?.customComponents,
        },
      };
    });

    return merged;
  })();

  const weeklyPlanRows: WeeklyPlanRow[] = displayDays.flatMap((day) => {
    const rows: WeeklyPlanRow[] = [];

    SECTIONS.forEach((section) => {
      const slot = weeklyMenu[day.key]?.[section.slotType];
      if (!slot) return;

      const importedMainDish = slot.customComponents?.main?.trim();
      const catalogDish = dishesById.get(slot.dishId) ?? dishesByName.get(normalizeDishMatchKey(importedMainDish));
      const dishName = importedMainDish || catalogDish?.name || 'Chưa có món';

      if (dishName === 'Chưa có món') return;

      rows.push({
        key: `${day.key}-${section.slotType}`,
        dayKey: day.key,
        dayLabel: day.label,
        date: day.date,
        sectionLabel: section.label,
        shiftLabel: section.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
        menuTypeLabel: section.category === 'vegetarian' ? 'Chay' : 'Mặn',
        dishId: catalogDish?.id ?? slot.dishId,
        dishName,
        portions: slot.portions ?? 0,
        hasCatalogBom: Boolean(catalogDish?.ingredients.length),
      });
    });

    return rows;
  });

  const weeklyRowsWithBom = weeklyPlanRows.filter((row) => row.hasCatalogBom);
  const weeklyRowsMissingBom = weeklyPlanRows.filter((row) => !row.hasCatalogBom);
  const visibleMissingBomDishes = useMemo(() => {
    const map = new Map<string, string>();
    weeklyRowsMissingBom.forEach((row) => {
      if (!dismissedBoms[row.dishId]) {
        map.set(row.dishId, row.dishName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [weeklyRowsMissingBom, dismissedBoms]);
  const weeklyPlanCatalogDishIds = new Set(weeklyRowsWithBom.map((row) => row.dishId));

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
    const customerCode = customers.find((c) => c.customerId === effectiveImportCustomerId)?.customerCode ?? 'DAV';
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

  // Tính hệ số đơn giá suất ăn (Giảm giá giảm định lượng theo tỉ lệ: 35k = 100%)
  const priceRatio = useMemo(() => {
    return Math.max(0.1, Math.min(1.5, menuPrice / standardPrice));
  }, [menuPrice]);

  const getDishUnitCost = (dishId: string) => {
    const dish = dishesById.get(dishId);
    if (!dish || !dish.ingredients.length) return 0;
    const cost = dish.ingredients.reduce((sum, ing) => {
      const actualQty = ing.grossQtyPerServing * priceRatio * (1 + lossRate / 100);
      return sum + actualQty * ing.referencePrice;
    }, 0);
    return Math.round(cost);
  };

  // Portion cost analysis logic (Step 2)
  const analyzedDish =
    catalogDishes.find((d) => d.id === selectedDishId) ||
    weeklyRowsWithBom.map((row) => dishesById.get(row.dishId)).find(Boolean) ||
    catalogDishes[0];

  const analyzedIngredients = analyzedDish
    ? analyzedDish.ingredients.map((ing) => {
      const theoryQty = ing.grossQtyPerServing;
      const actualQty = theoryQty * priceRatio * (1 + lossRate / 100);
      const supplierPrice = ing.referencePrice;
      const cost = actualQty * supplierPrice;
      return {
        name: ing.name,
        unit: ing.unit,
        theoryQty,
        actualQty,
        supplierName: 'Catalog backend',
        supplierPrice,
        cost,
      };
    })
    : [];

  const totalTrayCost = analyzedIngredients.reduce((sum, ing) => sum + ing.cost, 0);
  const foodCostPercent = menuPrice <= 0 ? 0 : (totalTrayCost / menuPrice) * 100;
  const grossProfit = menuPrice - totalTrayCost;

  const materialSummary = buildMaterialSummary(weeklyMenu, dishesById, dishesByName, priceRatio, lossRate);
  const totalCostInfo = calculateTotalMaterialCost(materialSummary);


  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <div className="ipc-weekly-command-actions flex items-center gap-2">
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
                {isImporting ? 'Đang import...' : 'Import Excel'}
              </button>

              <button
                type="button"
                onClick={handleExportWarehouseReport}
                className="ipc-button ipc-button-success whitespace-nowrap"
              >
                Xuất báo cáo gửi kho
              </button>
            </div>
          }
        >
          <FieldRow label="Khách hàng">
            <select
              value={selectedImportCustomerId || (customers[0]?.customerId ?? '')}
              onChange={(e) => {
                const cid = e.target.value;
                setSelectedImportCustomerId(cid);
                window.localStorage.setItem(LAST_WEEKLY_MENU_CUSTOMER_KEY, cid);
              }}
              className="ipc-select min-w-[200px]"
              disabled={isCustomerLoading}
            >
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
              value={committedMenuWeekStartDate}
              onChange={(e) => {
                const date = e.target.value;
                setCommittedMenuWeekStartDate(date);
                window.localStorage.setItem(LAST_WEEKLY_MENU_WEEK_KEY, date);
              }}
              className="ipc-input"
            />
          </FieldRow>
          <FieldRow label="Đơn giá suất ăn bình quân (đ)" hint="Định mức 35K = 100% định lượng">
            <input
              type="number"
              value={menuPrice}
              onChange={(e) => dispatch(setMenuPrice(Math.max(5000, Number(e.target.value))))}
              className="ipc-input"
              step="1000"
            />
          </FieldRow>
          <FieldRow label="Tỷ lệ hao hụt sơ chế (%)" hint="Bù lượng hao hụt khi làm sạch">
            <input
              type="number"
              value={lossRate}
              onChange={(e) => dispatch(setLossRate(Math.max(0, Number(e.target.value))))}
              className="ipc-input"
              min="0"
              max="50"
            />
          </FieldRow>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-5 text-slate-700 self-end h-[38px] flex items-center">
            Hệ số thực tế: &nbsp;<b>{(priceRatio * (1 + lossRate / 100) * 100).toFixed(1)}%</b>
          </div>
        </CommandBar>
      }
    >
      <ViewSwitcher
        ariaLabel="Chọn góc nhìn kế hoạch tuần"
        tabs={[
          { id: 'schedule', label: 'Kế hoạch tuần' },
          { id: 'demand', label: 'KHSX và nhu cầu' },
          { id: 'cost', label: 'Giá vốn' },
        ]}
        activeTab={activeView}
        onTabChange={(tabId) => setActiveView(tabId as WeeklyMenuView)}
      />
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
      {isCatalogEmpty && (
        <InlineAlert title="Catalog món ăn đang trống" variant="warning">
          Chưa có món ăn hoạt động nào từ API, nên thực đơn tuần và bảng định lượng chưa thể chọn món.
        </InlineAlert>
      )}

      {activeView === 'schedule' && (
        <div className="flex flex-col gap-4">
          <SectionPanel title="Bảng Lên Thực Đơn & Nhập Suất Ăn Tuần" icon={<Calendar size={18} color="#475569" />}>
            <DataTableShell className="ipc-weekly-menu-shell" ariaLabel="Bảng thực đơn tuần có thể cuộn">
              <table className="ipc-data-table ipc-schedule-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} w-[120px] min-w-[120px] max-w-[120px] border-r border-slate-200 bg-slate-100`}>Buổi / Ca</th>
                    {displayDays.map((day, idx) => (
                      <th
                        key={day.key}
                        className={cn(
                          tableHeadClass,
                          'border-r border-slate-200 transition-colors',
                          idx % 2 === 1 ? 'bg-slate-100' : 'bg-slate-50'
                        )}
                      >
                        <div className="flex flex-col items-center justify-center gap-0.5 py-1">
                          <span className="font-bold text-slate-800 text-[13px]">{day.label}</span>
                          <span className="text-[10.5px] text-slate-500 font-medium">{day.date}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SECTIONS.map((section) => {
                    const rowTypes = getSectionRowTypes(section.category);
                    const cellsByDay = displayDays.map((day) => {
                      const slot = weeklyMenu[day.key]?.[section.slotType];
                      const dish = dishesById.get(slot?.dishId ?? '') ?? getSectionDefaultDish(section);
                      const components = getDishComponents(dish);
                      const importedComponents = slot?.customComponents;
                      const values = rowTypes.map((row) => {
                        if (row.key === 'main') {
                          return importedComponents?.main ?? dish?.name ?? 'Chưa có catalog';
                        }

                        if (row.key === 'fruit') {
                          return importedComponents ? importedComponents.fruit ?? '' : components.fruit;
                        }

                        return importedComponents
                          ? importedComponents[row.key] ?? ''
                          : components[row.key];
                      });

                      return {
                        dayKey: day.key,
                        values,
                        rowSpans: buildRowSpans(values),
                      };
                    });

                    return (
                      <Fragment key={section.label}>
                        {/* Clean neutral section header row with thick divider */}
                        <tr>
                          <td
                            colSpan={7}
                            className={cn(
                              'bg-slate-200 py-2.5 text-center text-[12.5px] font-bold uppercase tracking-wide text-slate-900 border-r border-b border-slate-300',
                              section.slotType !== 'morningSavory' && 'border-t-2 border-t-slate-500'
                            )}
                          >
                            {section.label}
                          </td>
                        </tr>

                        {rowTypes.map((row, rowIndex) => (
                          <tr key={`${section.label}-${row.key}`}>
                            {/* Label Column */}
                            <td className="border-r border-slate-200 bg-slate-50 align-middle font-semibold text-slate-800 text-[12px] p-2 text-center w-[120px] min-w-[120px] max-w-[120px]">
                              {row.label}
                            </td>

                            {/* Day Columns */}
                            {displayDays.map((_, idx) => {
                              const cell = cellsByDay[idx];
                              const rowSpan = cell.rowSpans[rowIndex];
                              if (rowSpan === 0) {
                                return null;
                              }

                              const value = cell.values[rowIndex];
                              const isEvenCol = idx % 2 === 1;
                              const textClass = row.key === 'main'
                                ? 'font-semibold text-slate-800'
                                : row.key === 'fruit'
                                  ? 'font-medium text-slate-600'
                                  : 'text-slate-700';

                              return (
                                <td
                                  key={`${cell.dayKey}-${row.key}`}
                                  rowSpan={rowSpan}
                                  className={cn(
                                    'border-r border-slate-200 text-center align-middle p-2 text-[12.5px]',
                                    textClass,
                                    isEvenCol ? 'bg-slate-50/60' : 'bg-white'
                                  )}
                                >
                                  {value}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </DataTableShell>
          </SectionPanel>
        </div>
      )}

      {activeView === 'demand' && (
        <SectionPanel title="KHSX, kiểm tồn kho và nhu cầu xuất" icon={<Scale size={18} color="#475569" />}>
          <div className="flex flex-col gap-3">
            <ContextStrip
              items={[
                { label: 'Dòng KHSX từ kế hoạch tuần', value: weeklyPlanRows.length.toString(), tone: 'neutral' },
                { label: 'Đã có BOM/catalog', value: weeklyRowsWithBom.length.toString(), tone: 'success' },
                {
                  label: 'Chưa tính được BOM',
                  value: weeklyRowsMissingBom.length.toString(),
                  tone: weeklyRowsMissingBom.length > 0 ? 'warning' : 'success',
                },
                { label: 'Nguyên liệu tổng hợp', value: Object.keys(materialSummary).length.toString(), tone: 'info' },
              ]}
            />

            {visibleMissingBomDishes.length > 0 && (
              <InlineAlert title="Một số món import chưa có BOM catalog" variant="warning">
                <div className="flex flex-col gap-2 mt-1">
                  <div>Các món này vẫn được đưa vào KHSX theo tên món trong Excel, nhưng chưa sinh định lượng nguyên liệu cho đến khi được gắn với món/BOM trong catalog.</div>
                  <div className="text-xs font-semibold text-amber-900 mt-1">Danh sách món chưa khớp:</div>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {visibleMissingBomDishes.map((dish) => (
                      <li key={dish.id} className="flex items-center justify-between gap-4">
                        <span className="font-semibold text-amber-950">{dish.name}</span>
                        <div className="flex items-center gap-2">
                          <Link to="/admin-data" className="text-blue-600 hover:underline">Gắn định lượng / map catalog</Link>
                          <span className="text-slate-400">|</span>
                          <button
                            type="button"
                            onClick={() => setDismissingDish(dish)}
                            className="text-slate-600 hover:text-slate-900 font-semibold"
                          >
                            Bỏ qua
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </InlineAlert>
            )}
            {demandFeedback && (
              <InlineAlert title={demandFeedback.title} variant={demandFeedback.variant}>
                {demandFeedback.message}
              </InlineAlert>
            )}

            <Toolbar className="justify-end">
              <ActionGuard allowedRoles={['quanly', 'dieuphoi']} requiredPermissions={['demand.generate']}>
                <button
                  className="ipc-button ipc-button-primary"
                  type="button"
                  onClick={() => void handleGenerateDemand()}
                  disabled={isGeneratingDemand || weeklyPlanRows.length === 0}
                >
                  <Scale size={16} />
                  {isGeneratingDemand ? 'Đang tạo demand...' : 'Tạo demand từ KHSX'}
                </button>
              </ActionGuard>
              <ActionGuard allowedRoles={['quanly', 'thumua']} requiredPermissions={['purchase.generate']}>
                <button
                  className="ipc-button ipc-button-warning"
                  type="button"
                  onClick={() => void handleGeneratePurchaseRequests()}
                  disabled={isGeneratingPurchaseRequest || (generatedMaterialRequests.length === 0 && !demandLines.some((line) => line.tone === 'danger' && line.materialRequestId))}
                >
                  <ShoppingCart size={16} />
                  {isGeneratingPurchaseRequest ? 'Đang sinh mua thêm...' : 'Sinh danh sách mua thêm'}
                </button>
              </ActionGuard>
            </Toolbar>

            <DataTableShell ariaLabel="Bảng KHSX sinh từ kế hoạch tuần">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} text-left`}>Ngày</th>
                    <th className={tableHeadClass}>Ca</th>
                    <th className={tableHeadClass}>Nhóm</th>
                    <th className={`${tableHeadClass} text-left`}>Món theo kế hoạch tuần</th>
                    <th className={tableHeadClass}>Suất</th>
                    <th className={tableHeadClass}>BOM</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyPlanRows.map((row) => (
                    <tr key={row.key} className="table-row">
                      <td className={`${tableCellClass} text-left font-semibold`}>
                        {row.dayLabel}
                        <div className="text-[12px] font-normal text-slate-500">{row.date}</div>
                      </td>
                      <td className={tableCellClass}>{row.shiftLabel}</td>
                      <td className={tableCellClass}>{row.menuTypeLabel}</td>
                      <td className={`${tableCellClass} text-left font-semibold text-slate-900`}>
                        {row.dishName}
                      </td>
                      <td className={tableCellClass}>{row.portions.toLocaleString('vi-VN')}</td>
                      <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>
                        {row.hasCatalogBom ? 'Đã có' : 'Chưa gắn'}
                      </td>
                    </tr>
                  ))}
                  {weeklyPlanRows.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={6}>
                        Chưa có kế hoạch tuần để sinh KHSX.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>

            <DemandSummary lines={demandLines} />
            <DocumentRail
              documents={workflowDocuments.filter((document) =>
                ['KHSX', 'Danh sách mua thêm', 'Phiếu xuất'].includes(document.type),
              )}
              title="KHSX và chứng từ đầu ra"
            />
          </div>
        </SectionPanel>
      )}

      {/* Phân tích định lượng & giá vốn 1 khay ăn (Step 2) */}
      {activeView === 'cost' && (
        <>
          {foodCostPercent > 85 && (
            <InlineAlert
              title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!"
              variant="danger"
              className="mb-4"
            >
              Tỉ lệ giá vốn hiện tại đạt <b>{foodCostPercent.toFixed(1)}%</b>, vượt ngưỡng an toàn tối đa (85%). Nhân viên điều phối hoặc Bếp trưởng cần điều chỉnh giảm hao hụt sơ chế hoặc xem xét tăng đơn giá bán suất ăn của ca này.
            </InlineAlert>
          )}
          <SectionPanel
            title="Phân Tích Định Lượng & Giá Vốn 1 Khay Ăn"
            icon={<Scale size={18} color="#475569" />}
            badge={
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-slate-600">Món phân tích:</span>
                <select
                  value={analyzedDish?.id ?? ''}
                  onChange={(e) => setSelectedDishId(e.target.value)}
                  className="ipc-select w-[220px] text-[13.5px]"
                  disabled={catalogDishes.length === 0}
                >
                  <optgroup label="Ca Sáng">
                    {catalogDishes.filter(d => matchesShift(d, 'morning')).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}{weeklyPlanCatalogDishIds.has(d.id) ? ' - trong KH tuần' : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ca Chiều">
                    {catalogDishes.filter(d => matchesShift(d, 'afternoon')).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}{weeklyPlanCatalogDishIds.has(d.id) ? ' - trong KH tuần' : ''}
                      </option>
                    ))}
                  </optgroup>
                  {catalogDishes.length === 0 && <option value="">Chưa có catalog</option>}
                </select>
              </div>
            }
          >
            {/* Khối thống kê biên lợi nhuận */}
            <div className="mb-6 mt-4">
              <ContextStrip
                items={[
                  { label: 'Đơn giá bán/suất', value: formatCurrency(menuPrice), tone: 'neutral' },
                  { label: 'Giá vốn nguyên liệu / khay', value: formatCurrency(Math.round(totalTrayCost)), tone: 'info' },
                  {
                    label: 'Tỷ lệ giá vốn (Food Cost %)',
                    value: `${foodCostPercent.toFixed(1)}%`,
                    tone: foodCostPercent > 85 ? 'danger' : foodCostPercent > 70 ? 'warning' : 'success'
                  },
                  {
                    label: 'Lợi nhuận gộp / khay (Dự kiến)',
                    value: formatCurrency(Math.round(grossProfit)),
                    tone: grossProfit >= 0 ? 'success' : 'danger'
                  },
                ]}
              />
            </div>

            <DataTableShell className="ipc-cost-table-shell mb-5" ariaLabel="Bảng món kế hoạch tuần liên kết giá vốn">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} text-left`}>Ngày</th>
                    <th className={tableHeadClass}>Ca</th>
                    <th className={`${tableHeadClass} text-left`}>Món trong kế hoạch</th>
                    <th className={tableHeadClass}>Suất</th>
                    <th className={tableHeadClass}>Đơn giá vốn</th>
                    <th className={tableHeadClass}>Thành tiền</th>
                    <th className={tableHeadClass}>Trạng thái giá vốn</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyPlanRows.map((row) => {
                    const unitCost = getDishUnitCost(row.dishId);
                    const totalCost = unitCost * row.portions;
                    return (
                      <tr key={`cost-${row.key}`} className="table-row">
                        <td className={`${tableCellClass} text-left font-semibold`}>
                          {row.dayLabel}
                          <div className="text-[12px] font-normal text-slate-500">{row.date}</div>
                        </td>
                        <td className={tableCellClass}>{row.shiftLabel}</td>
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
                  {weeklyPlanRows.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-sm text-slate-500" colSpan={7}>
                        Chưa có kế hoạch tuần để liên kết giá vốn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </DataTableShell>

        {/* Bảng chi tiết định lượng và chi phí từng nguyên liệu trong khay */}
        <DataTableShell className="ipc-cost-table-shell" ariaLabel="Bảng giá vốn nguyên liệu một khay">
          <table className="ipc-data-table ipc-cost-table">
            <thead>
              <tr>
                <th className={`${tableHeadClass} text-left`}>Nguyên liệu</th>
                <th className={tableHeadClass}>ĐV</th>
                <th className={tableHeadClass}>LT / suất</th>
                <th className={tableHeadClass}>TT / suất</th>
                <th className={tableHeadClass}>Nguồn giá</th>
                <th className={tableHeadClass}>Đơn giá</th>
                <th className={tableHeadClass}>Thành tiền / khay</th>
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
                  <td className={`${tableCellClass} font-medium text-green-800`}>{ing.supplierName}</td>
                  <td className={tableCellClass}>{formatCurrency(ing.supplierPrice)}</td>
                  <td className={`${tableCellClass} font-bold text-slate-950`}>
                    {formatCurrency(Math.round(ing.cost))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableShell>
          </SectionPanel>

          {/* Bảng tính định lượng tổng hợp nguyên liệu */}
          <SectionPanel
            title="Bảng Tính Định Lượng Tổng Hợp & Đề Xuất Mua Hàng"
            icon={<Scale size={18} color="#475569" />}
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
            <DataTableShell className="ipc-cost-table-shell" ariaLabel="Bảng định lượng tổng hợp và đề xuất mua hàng">
              <table className="ipc-data-table ipc-cost-table">
                <thead>
                  <tr>
                    <th className={`${tableHeadClass} text-left`}>Nguyên liệu</th>
                    <th className={tableHeadClass}>ĐV</th>
                    <th className={tableHeadClass}>LT</th>
                    <th className={tableHeadClass}>TT</th>
                    <th className={tableHeadClass}>Nguồn giá</th>
                    <th className={tableHeadClass}>Đơn giá</th>
                    <th className={tableHeadClass}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(materialSummary).map(([name, data]) => {
                    if (data.theory === 0) return null;

                    const rowCost = data.actual * data.referencePrice;

                    return (
                      <tr key={name} className="table-row">
                        <td className={`${tableCellClass} text-left font-bold`}>{name}</td>
                        <td className={tableCellClass}>{data.unit}</td>
                        <td className={tableCellClass}>{data.theory.toFixed(2)}</td>
                        <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>
                          {data.actual.toFixed(2)}
                        </td>
                        <td className={`${tableCellClass} font-medium text-green-800`}>Catalog backend</td>
                        <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td>
                        <td className={`${tableCellClass} font-bold`}>{formatCurrency(rowCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DataTableShell>
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
          <DialogContent className="ipc-weekly-dialog max-w-6xl">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-slate-900 font-bold text-lg">
                Import thực đơn Excel
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(180px,1fr)_minmax(160px,220px)_minmax(220px,1.2fr)]">
                <FieldRow label="Khách hàng" hint="Bắt buộc chọn trước khi đọc file">
                  <select
                    value={effectiveImportCustomerId}
                    onChange={(event) => {
                      setSelectedImportCustomerId(event.target.value);
                      setCommittedMenuWeekStartDate('');
                      setImportPreview(null);
                    }}
                    className="ipc-select"
                    disabled={isCustomerLoading || customers.length === 0}
                  >
                    {customers.map((customer) => (
                      <option key={customer.customerId} value={customer.customerId}>
                        {customer.customerCode} - {customer.customerName}
                      </option>
                    ))}
                    {customers.length === 0 && <option value="">Chưa có khách hàng</option>}
                  </select>
                </FieldRow>
                <FieldRow label="Ngày bắt đầu tuần" hint="Dùng khi file chỉ có Thứ 2 - Thứ 7">
                  <input
                    type="date"
                    value={importWeekStartDate}
                    onChange={(event) => {
                      setImportWeekStartDate(event.target.value);
                      setImportPreview(null);
                    }}
                    className="ipc-input"
                  />
                </FieldRow>
                <FieldRow label="File Excel" hint="Chỉ xử lý dữ liệu bảng, bỏ qua logo/ảnh">
                  <input
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    onChange={(event) => {
                      setSelectedImportFile(event.target.files?.[0] ?? null);
                      setImportPreview(null);
                      setImportFeedback(null);
                    }}
                    className="ipc-input"
                  />
                </FieldRow>
              </div>

              {isCustomerError && (
                <InlineAlert title="Chưa tải được danh sách khách hàng" variant="warning">
                  Kiểm tra backend hoặc quyền truy cập trước khi import thực đơn.
                </InlineAlert>
              )}
              {importFeedback && (
                <InlineAlert title={importFeedback.title} variant={importFeedback.variant}>
                  {importFeedback.message}
                </InlineAlert>
              )}

              {importPreview && (
                <div className="flex flex-col gap-3">
                  <ContextStrip
                    items={[
                      { label: 'Sheet', value: importPreview.detectedLayout.sheetName, tone: 'neutral' },
                      { label: 'Cột nhãn', value: importPreview.detectedLayout.labelColumn, tone: 'neutral' },
                      { label: 'Ngày', value: `${formatImportDate(importPreview.weekStartDate)} - ${formatImportDate(importPreview.weekEndDate)}`, tone: 'info' },
                      { label: 'Hợp lệ', value: importPreview.detectedLayout.rowsImported.toString(), tone: 'success' },
                      {
                        label: 'Bỏ qua',
                        value: importPreview.detectedLayout.rowsSkipped.toString(),
                        tone: importPreview.detectedLayout.rowsSkipped > 0 ? 'warning' : 'neutral',
                      },
                      {
                        label: 'Thêm',
                        value: importPreview.previewDiff.addedSlots.toString(),
                        tone: importPreview.previewDiff.addedSlots > 0 ? 'info' : 'neutral',
                      },
                      {
                        label: 'Đổi món',
                        value: importPreview.previewDiff.changedSlots.toString(),
                        tone: importPreview.previewDiff.changedSlots > 0 ? 'warning' : 'neutral',
                      },
                      {
                        label: 'Bỏ khỏi tuần',
                        value: importPreview.previewDiff.removedSlots.toString(),
                        tone: importPreview.previewDiff.removedSlots > 0 ? 'danger' : 'neutral',
                      },
                    ]}
                  />

                  {importPreview.previewDiff.rows.some((row) => row.changeType !== 'unchanged') && (
                    <InlineAlert title="Diff so với thực đơn đang lưu" variant="info">
                      {importPreview.previewDiff.rows
                        .filter((row) => row.changeType !== 'unchanged')
                        .slice(0, 4)
                        .map((row) => `${formatImportDate(row.serviceDate)} ${row.shiftName}: ${row.currentDishName ?? '-'} -> ${row.importedDishName ?? '-'}`)
                        .join(' | ')}
                    </InlineAlert>
                  )}

                  {importPreview.warnings.length > 0 && (
                    <InlineAlert title="Cảnh báo khi đọc file" variant="warning">
                      {importPreview.warnings.slice(0, 4).join(' | ')}
                    </InlineAlert>
                  )}

                  <DataTableShell className="max-h-[360px]" ariaLabel="Bảng xem trước thực đơn import">
                    <table className="ipc-data-table">
                      <thead>
                        <tr>
                          <th className="text-left">Ngày</th>
                          <th className="text-left">Section</th>
                          <th className="text-left">Dòng</th>
                          <th className="text-left">Món</th>
                          <th className="text-center">Catalog</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows.slice(0, 60).map((row, index) => (
                          <tr key={`${row.serviceDate}-${row.sourceSection}-${row.slot}-${row.dishName}-${index}`}>
                            <td className="text-left font-medium">{formatImportDate(row.serviceDate)}</td>
                            <td className="text-left">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-800">{row.sourceSection}</span>
                                <span className="text-xs text-slate-500">{row.dbShiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'} / {row.variant}</span>
                              </div>
                            </td>
                            <td className="text-left">{importSlotLabels[row.slot] ?? row.slotLabel}</td>
                            <td className="text-left font-semibold text-slate-800">{row.dishName}</td>
                            <td className="text-center">
                              {row.existingDish ? 'Đã có' : 'Món mới'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </DataTableShell>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsImportDialogOpen(false)}
                className="ipc-button ipc-button-ghost"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleImportPreview}
                disabled={isImporting || !selectedImportFile || !effectiveImportCustomerId}
                className="ipc-button ipc-button-ghost"
              >
                Xem trước
              </button>
              <button
                type="button"
                onClick={handleImportCommit}
                disabled={isImporting || !importPreview}
                className="ipc-button ipc-button-primary"
              >
                Lưu vào hệ thống
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog for global menu edit */}
      {isEditingMenu && (
        <Dialog open={isEditingMenu} onOpenChange={(open) => !open && setIsEditingMenu(false)}>
          <DialogContent className="ipc-weekly-dialog max-w-5xl">
            <DialogHeader className="border-b border-slate-100 pb-3">
              <DialogTitle className="text-slate-900 font-bold text-lg">
                Chỉnh sửa Thực đơn tuần (T2 - T7)
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-6">
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
                              {getSectionDishes(sec).map((d) => (
                                <option key={d.id} value={d.id}>
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
      {/* Dialog Bỏ qua cảnh báo thiếu BOM */}
      <Dialog open={Boolean(dismissingDish)} onOpenChange={(open) => !open && setDismissingDish(null)}>
        <DialogContent className="max-w-md bg-slate-900 text-slate-100 border border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white">Bỏ qua cảnh báo thiếu BOM</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 my-4">
            <p className="text-sm text-slate-300">
              Bạn đang chọn bỏ qua cảnh báo thiếu định lượng cho món: <strong className="text-white">{dismissingDish?.name}</strong>.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Lý do bỏ qua</label>
              <select
                aria-label="Lý do bỏ qua cảnh báo"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                className="ipc-select bg-slate-800 text-slate-100 border border-slate-700 rounded-md p-2 text-sm"
              >
                <option value="Món ăn phụ không cần định lượng">Món ăn phụ không cần định lượng</option>
                <option value="Sẽ cập nhật định lượng sau">Sẽ cập nhật định lượng sau</option>
                <option value="Khách hàng tự chuẩn bị">Khách hàng tự chuẩn bị</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 col-reverse sm:row">
            <button
              type="button"
              onClick={() => setDismissingDish(null)}
              className="ipc-button ipc-button-ghost text-slate-400 hover:text-white"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                if (dismissingDish) {
                  setDismissedBoms(prev => ({ ...prev, [dismissingDish.id]: dismissReason }));
                  setDismissingDish(null);
                }
              }}
              className="ipc-button ipc-button-primary bg-amber-600 hover:bg-amber-700 text-white"
            >
              Xác nhận bỏ qua
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationalFrame>
  );
};

export default WeeklyMenuPage;
