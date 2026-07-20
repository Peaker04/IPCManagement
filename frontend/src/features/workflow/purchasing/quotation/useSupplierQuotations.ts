import { useState, type FormEvent } from 'react';
import { useToast } from '@/components/common';
import { useGetIngredientsQuery } from '@/features/projects/dishCatalogApi';
import {
  useCreateSupplierQuotationMutation,
  useDeactivateSupplierQuotationMutation,
  useGetSupplierQuotationsByIngredientPageQuery,
  useGetSuppliersQuery,
  useUpdateSupplierQuotationMutation,
  type SupplierQuotationDto,
} from '@/features/workflow';
import { getPurchasingErrorMessage } from '../purchasingModel';

const EMPTY_FORM = { supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' };

export function useSupplierQuotations() {
  const { toast } = useToast();
  const { data: ingredients = [] } = useGetIngredientsQuery();
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivateTargetId, setDeactivateTargetId] = useState<string | null>(null);
  const { data: response, isFetching } = useGetSupplierQuotationsByIngredientPageQuery({
    ingredientId: selectedIngredientId,
    pageNumber: page,
    pageSize: 8,
  }, { skip: !selectedIngredientId });
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
    suppliers,
    selectedIngredientId,
    selectIngredient,
    page,
    setPage,
    response,
    isFetching,
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
