import { lazy } from 'react';
import { WeeklyScheduleSection } from '../schedule/WeeklyScheduleSection';
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
    return <div {...panelProps('cost')}><MenuCostSection workflow={menuCostWorkflow} /></div>;
  }
  if (activeView === 'purchase-summary') {
    return <div {...panelProps('purchase-summary')}><PurchaseSummarySection workflow={purchaseSummaryWorkflow} /></div>;
  }
  return <div {...panelProps('dish-materials')}><DishMaterialsSection workflow={dishMaterialsWorkflow} /></div>;
}
