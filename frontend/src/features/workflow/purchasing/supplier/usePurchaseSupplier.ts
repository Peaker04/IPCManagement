import { useState } from 'react';
import {
  useGetPurchaseRequestsPageQuery,
  useGetSuppliersQuery,
  useUpdatePurchaseRequestLineSupplierMutation,
} from '@/features/workflow';
import { mapPurchaseRequestLines } from '../purchasingModel';

const PAGE_SIZE = 8;

export function usePurchaseSupplier(enabled = true) {
  const [page, setPage] = useState(1);
  const { data: response } = useGetPurchaseRequestsPageQuery(
    { pageNumber: page, pageSize: PAGE_SIZE },
    { skip: !enabled },
  );
  const { data: suppliers = [] } = useGetSuppliersQuery(undefined, { skip: !enabled });
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const lines = mapPurchaseRequestLines(response?.items ?? []).filter((line) => Boolean(line.purchaseRequestId));

  return { page, setPage, response, suppliers, updateSupplier, lines };
}
