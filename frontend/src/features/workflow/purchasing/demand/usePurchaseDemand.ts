import { useState } from 'react';
import { useToast } from '@/components/common';
import {
  useCreatePurchaseRequestFromDemandMutation,
  useGetMaterialRequestCandidatePageQuery,
  useGetPurchasePlanPageQuery,
  useGetPurchaseRequestsPageQuery,
  useSubmitPurchaseRequestMutation,
} from '@/features/workflow';
import {
  formatPurchaseRequestCandidate,
  getPurchasingErrorMessage,
  mapPurchasePlanLines,
  mapPurchaseRequestLines,
} from '../purchasingModel';

const PAGE_SIZE = 8;

export function usePurchaseDemand(onRequestCreated: () => void) {
  const { toast } = useToast();
  const [purchasePlanPage, setPurchasePlanPage] = useState(1);
  const [purchaseRequestPage, setPurchaseRequestPage] = useState(1);
  const [purchaseCandidatePage, setPurchaseCandidatePage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedMaterialRequestId, setSelectedMaterialRequestId] = useState('');
  const { data: purchasePlanResponse } = useGetPurchasePlanPageQuery({
    groupBy: 'day',
    pageNumber: purchasePlanPage,
    pageSize: PAGE_SIZE,
  });
  const { data: candidateResponse, isFetching: isFetchingCandidates } = useGetMaterialRequestCandidatePageQuery({
    purpose: 'purchase',
    pageNumber: purchaseCandidatePage,
    pageSize: PAGE_SIZE,
  });
  const { data: purchaseRequestsResponse } = useGetPurchaseRequestsPageQuery({
    pageNumber: purchaseRequestPage,
    pageSize: PAGE_SIZE,
  });
  const [createFromDemand, { isLoading: isCreating }] = useCreatePurchaseRequestFromDemandMutation();
  const [submitRequest, { isLoading: isSubmitting }] = useSubmitPurchaseRequestMutation();

  const purchasePlanLines = mapPurchasePlanLines(purchasePlanResponse?.items ?? []);
  const purchaseRequestLines = mapPurchaseRequestLines(purchaseRequestsResponse?.items ?? []);
  const candidates = candidateResponse?.items ?? [];
  const selectedCandidate = candidates.find((candidate) => candidate.materialRequestId === selectedMaterialRequestId);
  const primaryPlan = purchasePlanLines.find((line) => line.tone === 'danger' || line.tone === 'warning') ?? purchasePlanLines[0];
  const primaryRequestLine = purchaseRequestLines.find((line) => line.purchaseRequestId) ?? purchaseRequestLines[0];
  const submitTargetId = primaryRequestLine?.purchaseRequestId;

  const openCreateDialog = () => {
    setPurchaseCandidatePage(1);
    setSelectedMaterialRequestId('');
    setIsCreateDialogOpen(true);
  };

  const changeCandidatePage = (page: number) => {
    setSelectedMaterialRequestId('');
    setPurchaseCandidatePage(page);
  };

  const createPurchaseRequest = async () => {
    if (!selectedMaterialRequestId) {
      toast({ title: 'Chưa chọn nhu cầu nguyên liệu', description: 'Chọn một chứng từ có dòng thiếu để tạo đề xuất mua.', variant: 'warning' });
      return;
    }
    try {
      const response = await createFromDemand({ materialRequestId: selectedMaterialRequestId }).unwrap();
      setIsCreateDialogOpen(false);
      onRequestCreated();
      toast({
        title: 'Đã tạo đề xuất mua',
        description: response.data?.purchaseRequestCode
          ? `${response.data.purchaseRequestCode} đã sẵn sàng để chọn nhà cung cấp.`
          : response.message || 'Đề xuất mua đã được tạo từ nhu cầu thiếu.',
        variant: 'success',
      });
    } catch (error) {
      toast({ title: 'Chưa thể tạo đề xuất mua', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
    }
  };

  const submitPurchaseRequest = async () => {
    if (!submitTargetId) {
      toast({ title: 'Chưa có đơn mua để gửi', description: 'Hãy hoàn tất đề xuất mua trước khi chuyển sang phê duyệt.', variant: 'warning' });
      return;
    }
    try {
      await submitRequest(submitTargetId).unwrap();
      toast({ title: 'Đã gửi đơn mua chính thức', description: 'Đơn mua đã chuyển sang luồng phê duyệt.', variant: 'success' });
    } catch (error) {
      toast({ title: 'Chưa thể gửi đơn mua', description: getPurchasingErrorMessage(error), variant: 'danger', durationMs: 0 });
    }
  };

  return {
    presentation: { purchasePlanLines, purchaseRequestLines, primaryPlan, primaryRequestLine },
    command: { submitTargetId, isSubmitting, openCreateDialog, submitPurchaseRequest },
    planPage: { response: purchasePlanResponse, page: purchasePlanPage, setPage: setPurchasePlanPage },
    requestPage: { response: purchaseRequestsResponse, page: purchaseRequestPage, setPage: setPurchaseRequestPage },
    dialog: {
      open: isCreateDialogOpen,
      setOpen: setIsCreateDialogOpen,
      candidates,
      selectedCandidate,
      selectedMaterialRequestId,
      setSelectedMaterialRequestId,
      candidateResponse,
      page: purchaseCandidatePage,
      setPage: changeCandidatePage,
      isFetching: isFetchingCandidates,
      isCreating,
      create: createPurchaseRequest,
      formatCandidate: formatPurchaseRequestCandidate,
    },
  };
}
