import { useState } from 'react';
import {
  useGetPurchaseRequestsPageQuery,
  useGetSuppliersQuery,
  useUpdatePurchaseRequestLineSupplierMutation,
} from '@/features/workflow';
import { getActionableDraftPurchaseRequests, mapPurchaseRequestLines } from '../purchasingModel';

const PAGE_SIZE = 8;

export function usePurchaseSupplier(enabled = true) {
  const [page, setPage] = useState(1);
  const {
    data: response,
    isError: isRequestError,
    isFetching: isFetchingRequests,
    refetch: refetchRequests,
  } = useGetPurchaseRequestsPageQuery(
    { status: 'DRAFT', pageNumber: page, pageSize: PAGE_SIZE },
    { skip: !enabled },
  );
  const { data: suppliers = [], isError: isSupplierError } = useGetSuppliersQuery(undefined, { skip: !enabled });
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const lines = mapPurchaseRequestLines(getActionableDraftPurchaseRequests(response?.items ?? []));

  return {
    page, setPage, response, suppliers, updateSupplier, lines,
    // Bảng rỗng vì lỗi tải khác hẳn với "không còn dòng nào chờ chọn nhà cung cấp".
    isError: isRequestError || isSupplierError,
    isRetrying: isFetchingRequests,
    retry: () => refetchRequests(),
  };
}
