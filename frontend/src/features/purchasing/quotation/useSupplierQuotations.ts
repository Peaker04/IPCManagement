import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/common';
import { useGetIngredientsQuery } from '@/api/dishCatalogApi';
import { useCreateSupplierQuotationMutation, useDeactivateSupplierQuotationMutation, useGetSupplierQuotationsByIngredientPageQuery, useGetSuppliersQuery, useUpdateSupplierQuotationMutation, type SupplierQuotationDto } from '@/api/workflowApi';
import { toQueryView } from '@/lib/queryView';
import { getPurchasingErrorMessage } from '../purchasingModel';

const EMPTY_FORM = { supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' };

export function useSupplierQuotations(enabled = true) {
  const { toast } = useToast();
  const [ingredientSearch, setIngredientSearch] = useState('');
  const normalizedIngredientSearch = ingredientSearch.trim();
  const ingredientQuery = useGetIngredientsQuery(
    normalizedIngredientSearch ? { searchKeyword: normalizedIngredientSearch } : undefined,
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
  };

  const selectIngredient = (ingredientId: string) => {
    setSelectedIngredientId(ingredientId);
    setPage(1);
    resetForm();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedIngredientId) {
      toast({ title: 'Thiếu nguyên liệu', description: 'Vui lòng chọn nguyên liệu trước khi nhập báo giá.', variant: 'warning' });
      return;
    }
    if (!editingId && !form.supplierId) {
      toast({ title: 'Thiếu nhà cung cấp', description: 'Vui lòng chọn nhà cung cấp cho báo giá.', variant: 'warning' });
      return;
    }
    const unitPrice = Number(form.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      toast({ title: 'Đơn giá chưa hợp lệ', description: 'Vui lòng nhập đơn giá lớn hơn 0.', variant: 'warning' });
      return;
    }
    if (!form.effectiveFrom) {
      toast({ title: 'Thiếu ngày bắt đầu', description: 'Vui lòng chọn ngày bắt đầu hiệu lực của báo giá.', variant: 'warning' });
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
      toast({ title: 'Chưa thể lưu báo giá', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
    }
  };

  const edit = (quotation: SupplierQuotationDto) => {
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
      toast({ title: 'Đã ngừng báo giá', variant: 'success' });
    } catch (error) {
      toast({ title: 'Chưa thể ngừng báo giá', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
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
    deactivateTargetId,
    setDeactivateTargetId,
    confirmDeactivate,
  };
}
