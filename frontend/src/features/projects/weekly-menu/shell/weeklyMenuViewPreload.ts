import type { WeeklyMenuView } from '../model/types';

export const loadMenuCostSection = () => import('../cost/MenuCostSection');
export const loadPurchaseSummarySection = () => import('../purchasing/PurchaseSummarySection');
export const loadDishMaterialsSection = () => import('../dish-materials/DishMaterialsSection');
export const loadProductionPlanSection = () => import('../production-plan/ProductionPlanSection')
  .then((module) => ({ default: module.ProductionPlanSection }));
export const loadMaterialDemandSection = () => import('../demand/MaterialDemandSection')
  .then((module) => ({ default: module.MaterialDemandSection }));

const viewPreloaders: Partial<Record<WeeklyMenuView, () => Promise<unknown>>> = {
  demand: loadMaterialDemandSection,
  'production-plan': loadProductionPlanSection,
  'purchase-summary': loadPurchaseSummarySection,
  cost: loadMenuCostSection,
  'dish-materials': loadDishMaterialsSection,
};

export const preloadWeeklyMenuView = (view: WeeklyMenuView) => viewPreloaders[view]?.();
