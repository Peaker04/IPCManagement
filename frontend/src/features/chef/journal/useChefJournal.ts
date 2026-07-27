import { useMemo } from 'react'
import { useGetStockMovementsQuery, useGetWorkflowDocumentsQuery } from '@/api/workflowApi'

export function useChefJournal(enabled = true) {
  const documentsQuery = useGetWorkflowDocumentsQuery({ limit: 20 }, { skip: !enabled })
  const movementsQuery = useGetStockMovementsQuery({ limit: 20 }, { skip: !enabled })
  const returnDocuments = useMemo(
    () => (documentsQuery.data ?? []).filter((document) => document.type === 'Phiếu trả'),
    [documentsQuery.data],
  )
  const kitchenMovements = useMemo(
    () => (movementsQuery.data ?? []).filter((movement) =>
      movement.type === 'issue' || movement.type === 'supplemental' || movement.type === 'return'),
    [movementsQuery.data],
  )
  return {
    returnDocuments,
    kitchenMovements,
    // Sổ chứng từ rỗng vì lỗi tải khác hẳn với ca chưa phát sinh chứng từ nào.
    isError: documentsQuery.isError || movementsQuery.isError,
    isRetrying: documentsQuery.isFetching || movementsQuery.isFetching,
    retry: () => Promise.all([documentsQuery.refetch(), movementsQuery.refetch()]),
  }
}
