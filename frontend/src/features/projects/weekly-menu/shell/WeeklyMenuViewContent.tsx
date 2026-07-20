import { lazy, Suspense } from 'react';
import { WeeklyScheduleSection } from '../schedule/WeeklyScheduleSection';
import type { ImportedLayoutRow } from '../../components/ImportedLayoutMatrix';
import type { WeeklyMenuView } from '../model/types';
import type { WeeklyMenuScope, WeeklyScheduleEditorWorkflow, WeeklyScheduleFeedback } from '../schedule/types';
import type { WeeklyProductionPlanWorkflow } from '../production-plan/useWeeklyProductionPlan';
import type { MaterialDemandWorkflow } from '../demand/useMaterialDemand';
import type { MenuCostWorkflow } from '../cost/useMenuCost';
import type { PurchaseSummaryWorkflow } from '../purchasing/usePurchaseSummary';
import type { DishMaterialsWorkflow } from '../dish-materials/useDishMaterials';
import { ProductionPlanSection } from '../production-plan/ProductionPlanSection';
import { MaterialDemandSection } from '../demand/MaterialDemandSection';

const MenuCostSection = lazy(() => import('../cost/MenuCostSection'));
const PurchaseSummarySection = lazy(() => import('../purchasing/PurchaseSummarySection'));
const DishMaterialsSection = lazy(() => import('../dish-materials/DishMaterialsSection'));

const ReadOnlySectionFallback = ({ label }: { label: string }) => (
  <section aria-busy="true" aria-live="polite" className="min-h-[560px] rounded-lg border border-slate-200 bg-white p-6">
    <span className="text-sm font-medium text-slate-600">Đang tải {label}...</span>
  </section>
);

interface WeeklyMenuViewContentProps {
  activeView: WeeklyMenuView;
  scope: WeeklyMenuScope;
  hasCommittedWeek: boolean;
  committedRows: ImportedLayoutRow[];
  scheduleWorkflow: WeeklyScheduleEditorWorkflow;
  productionPlanWorkflow: WeeklyProductionPlanWorkflow;
  demandWorkflow: MaterialDemandWorkflow;
  servingFeedback: WeeklyScheduleFeedback | null;
  menuCostWorkflow: MenuCostWorkflow;
  purchaseSummaryWorkflow: PurchaseSummaryWorkflow;
  dishMaterialsWorkflow: DishMaterialsWorkflow;
}

const panelProps = (id: WeeklyMenuView) => ({
  id: `${id}-panel`,
  role: 'tabpanel',
  'aria-labelledby': `${id}-tab`,
});

export function WeeklyMenuViewContent({
  activeView,
  scope,
  hasCommittedWeek,
  committedRows,
  scheduleWorkflow,
  productionPlanWorkflow,
  demandWorkflow,
  servingFeedback,
  menuCostWorkflow,
  purchaseSummaryWorkflow,
  dishMaterialsWorkflow,
}: WeeklyMenuViewContentProps) {
  if (activeView === 'schedule') {
    return <div {...panelProps('schedule')}><WeeklyScheduleSection scope={scope} customerValue={scope.customerLabel} weekValue={scope.weekLabel} hasCommittedWeek={hasCommittedWeek} rows={committedRows} /></div>;
  }
  if (activeView === 'production-plan') {
    return <div {...panelProps('production-plan')}><ProductionPlanSection workflow={productionPlanWorkflow} /></div>;
  }
  if (activeView === 'demand') {
    return <div {...panelProps('demand')}><MaterialDemandSection workflow={demandWorkflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={servingFeedback} /></div>;
  }
  if (activeView === 'cost') {
    return <div {...panelProps('cost')}><Suspense fallback={<ReadOnlySectionFallback label="giá vốn" />}><MenuCostSection workflow={menuCostWorkflow} /></Suspense></div>;
  }
  if (activeView === 'purchase-summary') {
    return <div {...panelProps('purchase-summary')}><Suspense fallback={<ReadOnlySectionFallback label="tổng hợp mua" />}><PurchaseSummarySection workflow={purchaseSummaryWorkflow} /></Suspense></div>;
  }
  return <div {...panelProps('dish-materials')}><Suspense fallback={<ReadOnlySectionFallback label="nguyên liệu món" />}><DishMaterialsSection workflow={dishMaterialsWorkflow} /></Suspense></div>;
}
