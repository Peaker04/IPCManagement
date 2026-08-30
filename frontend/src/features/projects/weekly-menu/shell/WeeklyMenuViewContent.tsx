import { lazy, Suspense } from 'react';
import { TabContentSkeleton } from '@/components/common';
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
    return <div {...panelProps('schedule')}><Suspense fallback={<TabContentSkeleton minHeight="min-h-[480px]" columns={7} rows={7} message="Đang tải kế hoạch thực đơn tuần..." />}><WeeklyScheduleSection scope={scope} customerValue={scope.customerLabel} weekValue={scope.weekLabel} hasCommittedWeek={hasCommittedWeek} rows={committedRows} dishNamesById={dishNamesById} /></Suspense></div>;
  }
  if (activeView === 'production-plan') {
    return <div {...panelProps('production-plan')}><Suspense fallback={<TabContentSkeleton minHeight="min-h-[480px]" columns={6} rows={6} message="Đang tải kế hoạch sản xuất..." />}><ProductionPlanSection workflow={productionPlanWorkflow} /></Suspense></div>;
  }
  if (activeView === 'demand') {
    return <div {...panelProps('demand')}><Suspense fallback={<TabContentSkeleton minHeight="min-h-[480px]" columns={6} rows={6} message="Đang tải nhu cầu nguyên liệu..." />}><MaterialDemandSection workflow={demandWorkflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={servingFeedback} /></Suspense></div>;
  }
  if (activeView === 'cost') {
    return <div {...panelProps('cost')}><Suspense fallback={<TabContentSkeleton minHeight="min-h-[480px]" columns={5} rows={5} message="Đang tải bảng giá vốn..." />}><MenuCostSection workflow={menuCostWorkflow} /></Suspense></div>;
  }
  if (activeView === 'purchase-summary') {
    return <div {...panelProps('purchase-summary')}><Suspense fallback={<TabContentSkeleton minHeight="min-h-[480px]" columns={6} rows={6} message="Đang tải tổng hợp mua..." />}><PurchaseSummarySection workflow={purchaseSummaryWorkflow} /></Suspense></div>;
  }
  return <div {...panelProps('dish-materials')}><Suspense fallback={<TabContentSkeleton minHeight="min-h-[480px]" columns={5} rows={5} message="Đang tải nguyên liệu món..." />}><DishMaterialsSection workflow={dishMaterialsWorkflow} /></Suspense></div>;
}
