import { useState } from 'react';
import {
  useGetPurchaseRequestsPageQuery,
  useGetSuppliersQuery,
  useUpdatePurchaseRequestLineSupplierMutation,
} from '@/features/workflow';
import { mapPurchaseRequestLines } from '../purchasingModel';

const PAGE_SIZE = 8;

export function usePurchaseSupplier() {
  const [page, setPage] = useState(1);
  const { data: response } = useGetPurchaseRequestsPageQuery({ pageNumber: page, pageSize: PAGE_SIZE });
  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const lines = mapPurchaseRequestLines(response?.items ?? []).filter((line) => Boolean(line.purchaseRequestId));

  return { page, setPage, response, suppliers, updateSupplier, lines };
}
