import { useMemo } from 'react'
import { useGetStockMovementsQuery, useGetWorkflowDocumentsQuery } from '@/features/workflow'

export function useChefJournal() {
  const documentsQuery = useGetWorkflowDocumentsQuery({ limit: 20 })
  const movementsQuery = useGetStockMovementsQuery({ limit: 20 })
  const returnDocuments = useMemo(
    () => (documentsQuery.data ?? []).filter((document) => document.type === 'Phiếu trả'),
    [documentsQuery.data],
  )
  const kitchenMovements = useMemo(
    () => (movementsQuery.data ?? []).filter((movement) =>
      movement.type === 'issue' || movement.type === 'supplemental' || movement.type === 'return'),
    [movementsQuery.data],
  )
  return { returnDocuments, kitchenMovements }
}
