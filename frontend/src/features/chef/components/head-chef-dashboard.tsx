'use client'

import { useState } from 'react'
import { ChefHeader } from './chef-header'
import { ActiveDishesGrid } from './active-dishes-grid'
import { MaterialChecklist } from './material-checklist'
import { OperationalActions } from './operational-actions'
import type { ExcessMaterial, ProductionPlan, SupplementalRequest } from '@/lib/types'

interface HeadChefDashboardProps {
  productionPlan: ProductionPlan
  isSubmittingSupplementalRequest?: boolean
  onSupplementalRequest?: (data: SupplementalRequest) => Promise<boolean>
  onExcessMaterialReturn?: (data: ExcessMaterial) => void
  onMaterialSignoff?: (materialId: string, signed: boolean) => void
}

export function HeadChefDashboard({
  productionPlan,
  isSubmittingSupplementalRequest,
  onSupplementalRequest,
  onExcessMaterialReturn,
  onMaterialSignoff,
}: HeadChefDashboardProps) {
  const [expandedDishId, setExpandedDishId] = useState<string | null>(null)

  return (
    <main className="ipc-chef-workbench text-slate-700">
      {/* Production Header Summary */}
      <ChefHeader productionPlan={productionPlan} />

      {/* Main Content Grid */}
      <div className="ipc-chef-workbench-grid mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left Column: Dishes and Materials */}
        <div className="ipc-chef-workbench-main space-y-5 xl:col-span-2">
          {/* Active Dishes Section */}
          <ActiveDishesGrid
            dishes={productionPlan.activeDishes}
            expandedDishId={expandedDishId}
            onDishExpand={setExpandedDishId}
          />

          {/* Kitchen Material Checklist */}
          <MaterialChecklist
            materials={productionPlan.receivedMaterials}
            onMaterialSignoff={onMaterialSignoff}
          />
        </div>

        {/* Right Column: Operational Actions */}
        <div className="ipc-chef-workbench-side xl:col-span-1">
          <OperationalActions
            materials={productionPlan.receivedMaterials}
            isSubmittingSupplementalRequest={isSubmittingSupplementalRequest}
            onSupplementalRequest={onSupplementalRequest}
            onExcessMaterialReturn={onExcessMaterialReturn}
          />
        </div>
      </div>
    </main>
  )
}
