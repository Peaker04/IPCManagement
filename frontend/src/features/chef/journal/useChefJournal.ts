import { useMemo } from 'react'
import { useGetStockMovementsQuery } from '@/api/reportsApi'
import { useGetWorkflowDocumentsQuery } from '@/api/workflowDocumentsApi'
import { toChefView } from '../chefQueryView'

const EMPTY_CHEF_LIST: never[] = []

export function useChefJournal(enabled = true) {
  const documentsQuery = useGetWorkflowDocumentsQuery({ limit: 20 }, { skip: !enabled })
  const movementsQuery = useGetStockMovementsQuery({ limit: 20 }, { skip: !enabled })
  const documentsView = toChefView(documentsQuery, 'chứng từ bếp', {
    getTruncation: (documents) => documents.length >= 20 ? { shown: documents.length } : null,
  })
  const movementsView = toChefView(movementsQuery, 'luân chuyển kho của bếp', {
    getTruncation: (movements) => movements.length >= 20 ? { shown: movements.length } : null,
  })
  const documents = documentsView.phase === 'ready' ? documentsView.data : EMPTY_CHEF_LIST
  const movements = movementsView.phase === 'ready' ? movementsView.data : EMPTY_CHEF_LIST
  const returnDocuments = useMemo(
    () => documents.filter((document) => document.type === 'Phiếu trả'),
    [documents],
  )
  const kitchenMovements = useMemo(
    () => movements.filter((movement) =>
      movement.type === 'issue' || movement.type === 'supplemental' || movement.type === 'return'),
    [movements],
  )
  return {
    returnDocuments,
    kitchenMovements,
    queryViews: {
      documents: documentsView,
      movements: movementsView,
    },
  }
}
