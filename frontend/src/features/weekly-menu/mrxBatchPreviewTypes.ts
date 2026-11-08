export interface ShiftDishDetail {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishSlot?: string | null;
  displayOrder: number;
  materials: Array<{
    ingredientCode: string;
    ingredientName: string;
    canonicalUnitName: string;
    grossQuantityPerServing: number;
    requiredQuantity: number;
  }>;
}

export interface PlanSummaryItem {
  id: string;
  planCode: string;
  serviceDate: string;
  shift: string;
  menuName: string;
  servings: number;
  dishes: string[];
  dishesDetails: ShiftDishDetail[];
  materialsCount: number;
}
