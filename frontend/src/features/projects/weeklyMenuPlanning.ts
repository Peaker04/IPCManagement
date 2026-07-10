export const BOM_PRICE_TIERS = [25000, 30000, 34000] as const;
export type BomPriceTier = (typeof BOM_PRICE_TIERS)[number];
export const DEFAULT_BOM_PRICE_TIER = BOM_PRICE_TIERS[0];

export const isBomPriceTier = (value: number): value is BomPriceTier => {
  const rounded = Math.round(value);
  return BOM_PRICE_TIERS.some((tier) => tier === rounded);
};

export const normalizeBomPriceTier = (value?: number | null): BomPriceTier => {
  const rounded = Math.round(Number(value ?? DEFAULT_BOM_PRICE_TIER));
  return BOM_PRICE_TIERS.find((tier) => tier === rounded) ?? DEFAULT_BOM_PRICE_TIER;
};

export const formatBomTierLabel = (value: number) => `${Math.round(value / 1000)}k`;

interface ProductionPlanLineLike {
  totalServings?: number | null;
}

interface ProductionPlanLike {
  planDate: string;
  lines: ProductionPlanLineLike[];
}

interface ProductionDisplayDayLike {
  label: string;
  date: string;
}

export interface ProductionPlanPage<TPlan extends ProductionPlanLike> {
  key: string;
  label: string;
  dateLabel: string;
  plans: TPlan[];
  totalLines: number;
  totalServings: number;
}

export const getProductionPlanDateKey = (planDate: string) => planDate.split('T')[0];

export function filterProductionPlansForSelection<TPlan extends ProductionPlanLike>(
  plans: TPlan[],
  weekDates: string[],
  selectedServiceDate?: string,
): TPlan[] {
  const weekDateSet = new Set(weekDates);
  return plans.filter((plan) => {
    const planDate = getProductionPlanDateKey(plan.planDate);
    return selectedServiceDate ? planDate === selectedServiceDate : weekDateSet.has(planDate);
  });
}

export function buildProductionDisplayDayByDate<TDay extends ProductionDisplayDayLike>(
  displayDays: TDay[],
  parseDisplayDateToIso: (date: string) => string | undefined,
): Map<string, TDay> {
  const map = new Map<string, TDay>();
  displayDays.forEach((day) => {
    const serviceDate = parseDisplayDateToIso(day.date);
    if (serviceDate) {
      map.set(serviceDate, day);
    }
  });
  return map;
}

export function buildProductionPlanPages<TPlan extends ProductionPlanLike>(
  productionPlans: TPlan[],
  productionDisplayDayByDate: Map<string, ProductionDisplayDayLike>,
): ProductionPlanPage<TPlan>[] {
  const pageMap = new Map<string, ProductionPlanPage<TPlan>>();

  productionPlans.forEach((plan) => {
    const dateKey = getProductionPlanDateKey(plan.planDate);
    const displayDay = productionDisplayDayByDate.get(dateKey);
    const current = pageMap.get(dateKey) ?? {
      key: dateKey,
      label: displayDay?.label ?? 'Ngày phục vụ',
      dateLabel: new Date(plan.planDate).toLocaleDateString('vi-VN'),
      plans: [],
      totalLines: 0,
      totalServings: 0,
    };

    current.plans = [...current.plans, plan];
    current.totalLines += plan.lines.length;
    current.totalServings += plan.lines.reduce((sum, line) => sum + (line.totalServings ?? 0), 0);
    pageMap.set(dateKey, current);
  });

  return Array.from(pageMap.values()).sort((left, right) => left.key.localeCompare(right.key));
}

export const getSafeProductionPlanPageIndex = (pageCount: number, pageIndex: number) =>
  pageCount === 0 ? 0 : Math.min(pageIndex, pageCount - 1);
