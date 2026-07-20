import { AlertCircle } from 'lucide-react'
import { EmptyState, SplitWorkbench } from '@/components/common'
import type { ExcessMaterial, ProductionPlan, SupplementalRequest } from '@/lib/types'
import { HeadChefDashboard } from '../components/head-chef-dashboard'
import { ShiftJournal } from '../journal/ShiftJournal'

type Props = {
  productionPlan: ProductionPlan
  returns: ExcessMaterial[]
  isSubmittingSupplemental: boolean
  onSupplementalRequest: (data: SupplementalRequest) => Promise<boolean>
  onExcessMaterialReturn: (data: ExcessMaterial) => Promise<void>
  onMaterialSignoff: (materialId: string, signed: boolean) => Promise<void>
}

export function KitchenReceiptSection({
  productionPlan,
  returns,
  isSubmittingSupplemental,
  onSupplementalRequest,
  onExcessMaterialReturn,
  onMaterialSignoff,
}: Props) {
  return (
    <SplitWorkbench detailLabel="Nhật ký ca" detail={<ShiftJournal returns={returns} />} className="ipc-chef-split-workbench">
      {productionPlan.totalMeals === 0 ? (
        <EmptyState
          icon={<AlertCircle className="size-12 text-slate-400" />}
          title="Không có suất ăn nào được lên lịch cho ca này."
          description="Vui lòng điều phối suất dự kiến tại trang Điều phối trước. Bạn vẫn có thể xem chứng từ và nhật ký của ca ở tab bên cạnh."
          className="ipc-chef-empty-state !min-h-0 py-8 text-slate-500"
        />
      ) : (
        <HeadChefDashboard
          productionPlan={productionPlan}
          isSubmittingSupplementalRequest={isSubmittingSupplemental}
          onSupplementalRequest={onSupplementalRequest}
          onExcessMaterialReturn={(data) => void onExcessMaterialReturn(data)}
          onMaterialSignoff={(materialId, signed) => void onMaterialSignoff(materialId, signed)}
        />
      )}
    </SplitWorkbench>
  )
}
