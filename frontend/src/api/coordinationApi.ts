import { apiClient } from './client';

export interface CoordinationDishItem {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishSlot?: string;
  dishGroup?: string;
  dishType?: string;
  displayOrder: number;
}

export interface CoordinationOrderItem {
  id: string;
  quantityPlanLineId: string;
  quantityPlanId: string;
  menuScheduleId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  mealType: string;
  forecastQuantity: number;
  actualQuantity: number;
  unitPrice: number;
  appliedRate: number;
  specialNotes: string;
  serviceDate: string;
  shiftName: string;
  menuId: string;
  menuCode: string;
  menuName: string;
  dishes: CoordinationDishItem[];
}

export interface CoordinationShiftSummary {
  serviceDate: string;
  shiftName: string;
  customerCode: string;
  registeredServings: number;
  actualServings: number;
  varianceServings: number;
  attendanceRatePercent: number | null;
  orders: CoordinationOrderItem[];
}

export const coordinationApi = {
  async getOrders(
    serviceDate: string,
    shiftName: 'MORNING' | 'AFTERNOON',
    customerCode: string
  ): Promise<CoordinationShiftSummary> {
    const query = new URLSearchParams({ serviceDate, shiftName });
    const response = await apiClient<CoordinationOrderItem[]>(`/coordination/orders?${query.toString()}`);
    const orders = response.filter((order) => order.customerCode === customerCode);
    const registeredServings = orders.reduce((sum, order) => sum + order.forecastQuantity, 0);
    const actualServings = orders.reduce((sum, order) => sum + order.actualQuantity, 0);

    return {
      serviceDate,
      shiftName,
      customerCode,
      registeredServings,
      actualServings,
      varianceServings: actualServings - registeredServings,
      attendanceRatePercent: registeredServings > 0
        ? Math.round((actualServings / registeredServings) * 1000) / 10
        : null,
      orders,
    };
  },
};
