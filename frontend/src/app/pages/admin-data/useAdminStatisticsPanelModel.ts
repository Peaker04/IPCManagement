import { useGetOperationalKpisQuery } from '@/api/dashboardApi';
import {
  useGetIngredientDemandAggregatePageQuery,
  useGetPriceVariancePageQuery,
  useGetPurchasePlanPageQuery,
} from '@/features/reports/reportsApi';
import type { AdminView } from './adminDataPageTypes';
import { toAdminView } from './adminDataPageModelShared';

export function useAdminStatisticsPanelModel(activeView: AdminView, operationalDate: string) {
  const operationalKpisQuery = useGetOperationalKpisQuery(undefined, { skip: activeView !== 'statistics' });
  const operationalKpisView = toAdminView(operationalKpisQuery, 'KPI vận hành');
  const operationalKpis = operationalKpisView.phase === 'ready' ? operationalKpisView.data : undefined;
  const ingredientDemandQuery = useGetIngredientDemandAggregatePageQuery({
    pageNumber: 1,
    pageSize: 8,
    dateFrom: operationalDate,
    dateTo: operationalDate,
  }, { skip: activeView !== 'statistics' });
  const ingredientDemandView = toAdminView(ingredientDemandQuery, 'thống kê nhu cầu nguyên liệu');
  const ingredientDemandPage = ingredientDemandView.phase === 'ready' ? ingredientDemandView.data : undefined;
  const purchasePlanQuery = useGetPurchasePlanPageQuery(
    { groupBy: 'day', pageNumber: 1, pageSize: 8 },
    { skip: activeView !== 'statistics' },
  );
  const purchasePlanView = toAdminView(purchasePlanQuery, 'thống kê kế hoạch thu mua');
  const purchasePlanPage = purchasePlanView.phase === 'ready' ? purchasePlanView.data : undefined;
  const priceVarianceQuery = useGetPriceVariancePageQuery({
    pageNumber: 1,
    pageSize: 1,
    warningOnly: true,
    dateFrom: operationalDate,
    dateTo: operationalDate,
  }, { skip: activeView !== 'statistics' });
  const priceVarianceView = toAdminView(priceVarianceQuery, 'thống kê cảnh báo giá');
  const priceVariancePage = priceVarianceView.phase === 'ready' ? priceVarianceView.data : undefined;
  const shortageCount = ingredientDemandPage?.remainingToIssueCount ?? 0;
  const priceWarningCount = priceVariancePage?.totalCount ?? 0;
  const totalPurchaseQty = purchasePlanPage?.totalShortageQty ?? 0;
  const totalIssuedQty = operationalKpis?.totalKitchenIssuedQty ?? 0;
  const totalUsedQty = operationalKpis?.totalKitchenUsedQty ?? 0;
  const totalReturnedQty = operationalKpis?.totalKitchenReturnedQty ?? 0;

  return {
    queryViews: {
      ingredientDemand: ingredientDemandView,
      operationalKpis: operationalKpisView,
      priceVariance: priceVarianceView,
      purchasePlan: purchasePlanView,
    },
    operationalKpis,
    priceWarningCount,
    shortageCount,
    totalIssuedQty,
    totalPurchaseQty,
    totalReturnedQty,
    totalUsedQty,
  };
}
