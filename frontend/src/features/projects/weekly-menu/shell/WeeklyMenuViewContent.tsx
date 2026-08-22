import { lazy, Suspense } from 'react';
import type { ImportedLayoutRow } from '../../components/ImportedLayoutMatrix';
import type { WeeklyMenuView } from '../model/types';
import type { WeeklyMenuScope, WeeklyScheduleEditorWorkflow, WeeklyScheduleFeedback } from '../schedule/types';
import type { WeeklyProductionPlanWorkflow } from '../production-plan/useWeeklyProductionPlan';
import type { MaterialDemandWorkflow } from '../demand/useMaterialDemand';
import type { MenuCostWorkflow } from '../cost/useMenuCost';
import type { PurchaseSummaryWorkflow } from '../purchasing/usePurchaseSummary';
import type { DishMaterialsWorkflow } from '../dish-materials/useDishMaterials';
import {
  loadDishMaterialsSection,
  loadMaterialDemandSection,
  loadMenuCostSection,
  loadProductionPlanSection,
  loadPurchaseSummarySection,
} from './weeklyMenuViewPreload';

const WeeklyScheduleSection = lazy(() => import('../schedule/WeeklyScheduleSection').then(({ WeeklyScheduleSection: component }) => ({ default: component })));
const MenuCostSection = lazy(loadMenuCostSection);
const PurchaseSummarySection = lazy(loadPurchaseSummarySection);
const DishMaterialsSection = lazy(loadDishMaterialsSection);
const ProductionPlanSection = lazy(loadProductionPlanSection);
const MaterialDemandSection = lazy(loadMaterialDemandSection);

interface WeeklyMenuViewContentProps {
  activeView: WeeklyMenuView;
  scope: WeeklyMenuScope;
  hasCommittedWeek: boolean;
  committedRows: ImportedLayoutRow[];
  dishNamesById?: ReadonlyMap<string, string>;
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
  dishNamesById,
  scheduleWorkflow,
  productionPlanWorkflow,
  demandWorkflow,
  servingFeedback,
  menuCostWorkflow,
  purchaseSummaryWorkflow,
  dishMaterialsWorkflow,
}: WeeklyMenuViewContentProps) {
  if (activeView === 'schedule') {
    return <div {...panelProps('schedule')}><Suspense fallback={<div aria-busy="true" className="min-h-[480px] rounded-md bg-slate-50 motion-reduce:animate-none" />}><WeeklyScheduleSection scope={scope} customerValue={scope.customerLabel} weekValue={scope.weekLabel} hasCommittedWeek={hasCommittedWeek} rows={committedRows} dishNamesById={dishNamesById} /></Suspense></div>;
  }
  if (activeView === 'production-plan') {
    return <div {...panelProps('production-plan')}><ProductionPlanSection workflow={productionPlanWorkflow} /></div>;
  }
  if (activeView === 'demand') {
    return <div {...panelProps('demand')}><MaterialDemandSection workflow={demandWorkflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={servingFeedback} /></div>;
  }
  if (activeView === 'cost') {
    return <div {...panelProps('cost')}><MenuCostSection workflow={menuCostWorkflow} /></div>;
  }
  if (activeView === 'purchase-summary') {
    return <div {...panelProps('purchase-summary')}><PurchaseSummarySection workflow={purchaseSummaryWorkflow} /></div>;
  }
  return <div {...panelProps('dish-materials')}><DishMaterialsSection workflow={dishMaterialsWorkflow} /></div>;
}
