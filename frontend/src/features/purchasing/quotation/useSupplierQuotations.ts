import { useDeferredValue, useState, type FormEvent } from 'react';
import { useToast } from '@/components/common';
import { useGetIngredientsQuery } from '@/api/dishCatalogApi';
import { useCreateSupplierQuotationMutation, useDeactivateSupplierQuotationMutation, useGetSupplierQuotationsByIngredientPageQuery, useGetSuppliersQuery, useUpdateSupplierQuotationMutation } from '@/features/purchasing/purchasingApi';
import type { SupplierQuotationDto } from '@/api/workflowApiTypes';
import { toQueryView } from '@/lib/queryView';
import { getPurchasingErrorMessage } from '../purchasingModel';

const EMPTY_FORM = { supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' };

type QuotationField = 'ingredientId' | 'supplierId' | 'unitPrice' | 'effectiveFrom';
type FieldFeedback = { title: string; message: string };
type QuotationValidationErrors = Partial<Record<QuotationField, FieldFeedback>>;

export function useSupplierQuotations(enabled = true) {
  const { toast } = useToast();
  const [ingredientSearch, setIngredientSearch] = useState('');
  const deferredIngredientSearch = useDeferredValue(ingredientSearch.trim());
  const ingredientQuery = useGetIngredientsQuery(
    deferredIngredientSearch ? { searchKeyword: deferredIngredientSearch } : undefined,
    { skip: !enabled },
  );
  const ingredientView = toQueryView(ingredientQuery, {
    instruction: 'Mở tab Báo giá nhà cung cấp để tải danh mục nguyên liệu.',
    retry: () => ingredientQuery.refetch(),
    errorMessage: 'Không tải được danh mục nguyên liệu.',
    forbiddenMessage: 'Bạn không có quyền xem danh mục nguyên liệu.',
  });
  const supplierQuery = useGetSuppliersQuery(undefined, { skip: !enabled });
  const supplierView = toQueryView(supplierQuery, {
    instruction: 'Mở tab Báo giá nhà cung cấp để tải danh mục nhà cung cấp.',
    retry: () => supplierQuery.refetch(),
    errorMessage: 'Không tải được danh mục nhà cung cấp.',
    forbiddenMessage: 'Bạn không có quyền xem danh mục nhà cung cấp.',
  });
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivateTargetId, setDeactivateTargetId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<QuotationValidationErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const quotationQuery = useGetSupplierQuotationsByIngredientPageQuery({
    ingredientId: selectedIngredientId,
    pageNumber: page,
    pageSize: 8,
  }, { skip: !enabled || !selectedIngredientId });
  const quotationView = toQueryView(quotationQuery, {
    instruction: 'Chọn một nguyên liệu để xem báo giá nhà cung cấp.',
    retry: () => quotationQuery.refetch(),
    errorMessage: 'Không tải được báo giá của nguyên liệu này.',
    forbiddenMessage: 'Bạn không có quyền xem báo giá nhà cung cấp.',
  });
  const ingredients = ingredientView.phase === 'ready' ? ingredientView.data : [];
  const suppliers = supplierView.phase === 'ready' ? supplierView.data : [];
  const response = quotationView.phase === 'ready' ? quotationView.data : undefined;
  const [createQuotation, { isLoading: isCreating }] = useCreateSupplierQuotationMutation();
  const [updateQuotation] = useUpdateSupplierQuotationMutation();
  const [deactivateQuotation] = useDeactivateSupplierQuotationMutation();

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setValidationErrors({});
    setSaveError(null);
  };

  const selectIngredient = (ingredientId: string) => {
    setSelectedIngredientId(ingredientId);
    setPage(1);
    resetForm();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setValidationErrors({});
    setSaveError(null);
    if (!selectedIngredientId) {
      setValidationErrors({ ingredientId: { title: 'Thiếu nguyên liệu', message: 'Vui lòng chọn nguyên liệu trước khi nhập báo giá.' } });
      return;
    }
    if (!editingId && !form.supplierId) {
      setValidationErrors({ supplierId: { title: 'Thiếu nhà cung cấp', message: 'Vui lòng chọn nhà cung cấp cho báo giá.' } });
      return;
    }
    const unitPrice = Number(form.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      setValidationErrors({ unitPrice: { title: 'Đơn giá chưa hợp lệ', message: 'Vui lòng nhập đơn giá lớn hơn 0.' } });
      return;
    }
    if (!form.effectiveFrom) {
      setValidationErrors({ effectiveFrom: { title: 'Thiếu ngày bắt đầu', message: 'Vui lòng chọn ngày bắt đầu hiệu lực của báo giá.' } });
      return;
    }

    try {
      if (editingId) {
        await updateQuotation({
          quotationId: editingId,
          data: { unitPrice, effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null, note: form.note || null, isActive: true },
        }).unwrap();
      } else {
        await createQuotation({
          supplierId: form.supplierId,
          ingredientId: selectedIngredientId,
          unitPrice,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          note: form.note || null,
        }).unwrap();
      }
      resetForm();
    } catch (error) {
      setSaveError(getPurchasingErrorMessage(error));
    }
  };

  const edit = (quotation: SupplierQuotationDto) => {
    setValidationErrors({});
    setSaveError(null);
    setEditingId(quotation.quotationId);
    setForm({
      supplierId: quotation.supplierId,
      unitPrice: String(quotation.unitPrice),
      effectiveFrom: quotation.effectiveFrom,
      effectiveTo: quotation.effectiveTo ?? '',
      note: quotation.note ?? '',
    });
  };

  const confirmDeactivate = async () => {
    if (!deactivateTargetId) return;
    try {
      await deactivateQuotation(deactivateTargetId).unwrap();
      setDeactivateTargetId(null);
      setDeactivateError(null);
      toast({ title: 'Đã ngừng báo giá', variant: 'success' });
    } catch (error) {
      setDeactivateError(getPurchasingErrorMessage(error));
    }
  };

  return {
    ingredients,
    ingredientSearch,
    setIngredientSearch,
    suppliers,
    selectedIngredientId,
    selectIngredient,
    page,
    setPage,
    response,
    ingredientView,
    supplierView,
    quotationView,
    isFetching: quotationQuery.isFetching,
    // Danh mục hoặc bảng báo giá rỗng vì lỗi tải khác hẳn với "nguyên liệu này
    // chưa có báo giá" — nhầm lẫn ở đây dẫn tới chọn sai nhà cung cấp và giá.
    isLookupError: ingredientView.phase === 'error' || supplierView.phase === 'error',
    isLookupForbidden: ingredientView.phase === 'forbidden' || supplierView.phase === 'forbidden',
    isQuotationError: quotationView.phase === 'error',
    isQuotationForbidden: quotationView.phase === 'forbidden',
    retryQuotations: () => quotationQuery.refetch(),
    rows: response?.items ?? [],
    form,
    setForm,
    editingId,
    resetForm,
    submit,
    edit,
    isCreating,
    validationErrors,
    saveError,
    deactivateTargetId,
    setDeactivateTargetId: (targetId: string | null) => {
      setDeactivateTargetId(targetId);
      setDeactivateError(null);
    },
    deactivateError,
    confirmDeactivate,
  };
}
