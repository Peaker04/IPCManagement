import { useDeferredValue, useMemo, useState, type FormEvent } from 'react';
import {
  useAddDishBomLineMutation,
  useCloseDishBomLineMutation,
  useCommitBomImportMutation,
  useDownloadBomTemplateMutation,
  useGetAdminDishCatalogQuery,
  useGetIngredientsQuery,
  usePreviewBomImportMutation,
  useUpdateDishBomLineMutation,
  type BomImportPreview,
  type CatalogIngredient,
} from '@/api/dishCatalogApi';
import { usePaginatedRows } from '@/lib/usePaginatedRows';
import {
  createDefaultBomForm,
  getBomTemplateTypeLabel,
  getMutationErrorMessage,
  getNextDayInputValue,
  getTodayInputValue,
  type AdminView,
  type BomFormState,
  type BomPanelMode,
  type BomTemplateType,
} from './adminDataPageTypes';
import { EMPTY_ADMIN_LIST, toAdminView } from './adminDataPageModelShared';

export function useAdminBomPanelModel(
  activeView: AdminView,
  bomTemplateDishId: string | undefined,
) {
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
  const dishCatalogQuery = useGetAdminDishCatalogQuery(undefined, { skip: !isBomView });
  const dishCatalogView = toAdminView(dishCatalogQuery, 'danh mục BOM');
  const dishCatalog = dishCatalogView.phase === 'ready' ? dishCatalogView.data : EMPTY_ADMIN_LIST;
  const isDishCatalogLoading = dishCatalogView.phase === 'uninitialized' || dishCatalogView.phase === 'loading';
  const ingredientCatalogQuery = useGetIngredientsQuery(undefined, { skip: !isBomView });
  const ingredientCatalogView = toAdminView(ingredientCatalogQuery, 'danh mục nguyên liệu');
  const ingredientCatalog = ingredientCatalogView.phase === 'ready' ? ingredientCatalogView.data : EMPTY_ADMIN_LIST;
  const isIngredientCatalogLoading = ingredientCatalogView.phase === 'uninitialized' || ingredientCatalogView.phase === 'loading';
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
  const currentBomPagination = usePaginatedRows(currentBomRows, 8);
  const bomPreviewPagination = usePaginatedRows(bomImportPreview?.rows ?? [], 20);

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

  return {
    queryViews: { dishCatalog: dishCatalogView, ingredientCatalog: ingredientCatalogView },
    bomForm,
    bomImportCustomerId,
    bomImportEffectiveFrom,
    bomImportFeedback,
    bomImportFile,
    bomImportPreview,
    bomImportTier,
    bomPanelMode,
    bomPreviewPagination,
    bomSearch,
    bomTemplateDishId,
    closeDishBomLineState,
    closingBom,
    commitBomImportState,
    currentBomPagination,
    currentBomRows,
    dishCatalog,
    downloadBomTemplateState,
    editingBom,
    handleCloseBomLine,
    handleCommitBomImport,
    handleDownloadBomTemplate,
    handlePreviewBomImport,
    handleSaveBomLine,
    ingredientCatalog,
    isBomDialogOpen,
    isDishCatalogLoading,
    isIngredientCatalogLoading,
    isSavingBom,
    openCreateBomDialog,
    openEditBomDialog,
    previewBomImportState,
    setBomForm,
    setBomImportCustomerId,
    setBomImportEffectiveFrom,
    setBomImportFile,
    setBomImportPreview,
    setBomImportTier,
    setBomPanelMode,
    setBomSearch,
    setClosingBom,
    setIsBomDialogOpen,
  };
}
