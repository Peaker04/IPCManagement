import type { WeeklyMenuData } from '../api/weeklyMenuApi';
import type { DashboardData } from '../api/dashboardApi';
import type { CoordinationShiftSummary } from '../api/coordinationApi';
import type { ChefDashboardData } from '../api/chefApi';
import type { PurchaseOrderItem, SupplierItem } from '../api/purchasingApi';
import type { WarehouseItem, InventoryReceiptItem, InventoryIssueItem } from '../api/warehouseApi';
import type { ApprovalInboxItem } from '../api/approvalsApi';
import type { ReconciliationBatchSummary } from '../api/reconciliationApi';

export const MOCK_WEEKLY_MENU_DATA: WeeklyMenuData = {
  customerId: 'c6c0b2f4-1567-4c62-b687-e50d3e93f348',
  customerCode: 'DAV',
  customerName: 'Công ty TNHH Draxlmaier Automotive',
  weekStartDate: '2026-09-21',
  mealTargetPrice: 25000,
  scheduleDays: [
    { dayName: 'Thứ Hai', dateStr: '21/09/2026', cells: [] },
    { dayName: 'Thứ Ba', dateStr: '22/09/2026', cells: [] },
    { dayName: 'Thứ Tư', dateStr: '23/09/2026', cells: [] },
    { dayName: 'Thứ Năm', dateStr: '24/09/2026', cells: [] },
    { dayName: 'Thứ Sáu', dateStr: '25/09/2026', cells: [] },
    { dayName: 'Thứ Bảy', dateStr: '26/09/2026', cells: [] },
  ],
  matrixRows: [
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Món chính',
      days: {
        '2026-09-21': 'Khô gà lá chanh',
        '2026-09-22': 'Thịt kho trứng cút',
        '2026-09-23': 'Cá lóc kho tộ',
        '2026-09-24': 'Bò xào hành cần',
        '2026-09-25': 'Sườn non ram me',
        '2026-09-26': 'Cơm gà xối mỡ',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Phụ 1',
      days: {
        '2026-09-21': 'Chả cá sốt cà',
        '2026-09-22': 'Đậu hũ dồn thịt',
        '2026-09-23': 'Trứng chiên thịt',
        '2026-09-24': 'Xíu mại hấp',
        '2026-09-25': 'Mực xào chua ngọt',
        '2026-09-26': 'Chả lụa rim mặn',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Rau',
      days: {
        '2026-09-21': 'Bầu xào giá',
        '2026-09-22': 'Rau muống xào tỏi',
        '2026-09-23': 'Cải thìa xào nấm',
        '2026-09-24': 'Bí đỏ luộc',
        '2026-09-25': 'Đậu que xào tỏi',
        '2026-09-26': 'Su su xào cà rốt',
      },
    },
    {
      sectionTitle: 'MENU MẶN CA SÁNG',
      slotLabel: 'Canh',
      days: {
        '2026-09-21': 'Bầu nấu tôm',
        '2026-09-22': 'Canh chua cá',
        '2026-09-23': 'Canh cải xanh thịt bằm',
        '2026-09-24': 'Canh mướp mồng tơi',
        '2026-09-25': 'Canh sườn hầm bí',
        '2026-09-26': 'Canh rong biển thịt bò',
      },
    },
    {
      sectionTitle: 'MENU CHAY CA SÁNG',
      slotLabel: 'Món chính',
      days: {
        '2026-09-21': 'Bún bò chả cua chay',
        '2026-09-22': 'Đậu hũ kho nấm rơm',
        '2026-09-23': 'Nấm bào ngư chiên giòn',
        '2026-09-24': 'Sườn non chay sốt chua ngọt',
        '2026-09-25': 'Cà tím nướng mỡ hành chay',
        '2026-09-26': 'Hủ tiếu Nam Vang chay',
      },
    },
  ],
  demandRows: [
    { materialId: 'm-1', materialCode: 'NL-GA-06', materialName: 'Thịt gà phi lê tươi', unit: 'Kilogram', dishNames: ['Khô gà lá chanh'], requiredQuantity: 72.0, issuedQuantity: 72.0, remainingQuantity: 0, status: 'fulfilled' },
    { materialId: 'm-2', materialCode: 'NL-CA-02', materialName: 'Chả cá thác lác', unit: 'Kilogram', dishNames: ['Chả cá sốt cà'], requiredQuantity: 63.5, issuedQuantity: 63.5, remainingQuantity: 0, status: 'fulfilled' },
    { materialId: 'm-3', materialCode: 'NL-RAU-03', materialName: 'Bầu sao tươi', unit: 'Kilogram', dishNames: ['Bầu xào giá', 'Bầu nấu tôm'], requiredQuantity: 120.0, issuedQuantity: 100.0, remainingQuantity: 20.0, status: 'in_progress' },
    { materialId: 'm-4', materialCode: 'NL-GIA-04', materialName: 'Giá đỗ sạch', unit: 'Kilogram', dishNames: ['Bầu xào giá'], requiredQuantity: 40.0, issuedQuantity: 40.0, remainingQuantity: 0, status: 'fulfilled' },
    { materialId: 'm-5', materialCode: 'NL-TOM-05', materialName: 'Tôm thẻ bóc vỏ', unit: 'Kilogram', dishNames: ['Bầu nấu tôm'], requiredQuantity: 25.0, issuedQuantity: 15.0, remainingQuantity: 10.0, status: 'in_progress' },
  ],
  productionPlans: [
    { planId: 'pp-1', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd-1', dishName: 'Khô gà lá chanh', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-2', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd-2', dishName: 'Chả cá sốt cà', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-3', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd-3', dishName: 'Bầu xào giá', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-4', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd-4', dishName: 'Bầu nấu tôm', shiftName: 'Ca 1 (Sáng)', plannedServings: 844, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
    { planId: 'pp-5', planCode: 'KHSX-DAV-20260921-FULLDAY', dishId: 'd-5', dishName: 'Bún bò chả cua chay', shiftName: 'Ca 1 (Sáng)', plannedServings: 15, serviceDate: '2026-09-21', status: 'sent_to_kitchen' },
  ],
  dishCosts: [
    {
      dishId: 'd-1',
      dishCode: 'DISH-KHO-GA',
      dishName: 'Khô gà lá chanh',
      categoryName: 'Món mặn chính',
      servingTargetPrice: 25000,
      calculatedCost: 11450,
      bomItemsCount: 3,
      costRatioPercent: 45.8,
      bomLines: [
        { ingredientId: 'i-1', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', quantityPerServing: 0.085, grossWeight: 0.09, unitPrice: 85000, lineCost: 7225 },
        { ingredientId: 'i-2', ingredientCode: 'NL-LACHANH-07', ingredientName: 'Lá chanh tươi', unit: 'Kilogram', quantityPerServing: 0.005, grossWeight: 0.006, unitPrice: 30000, lineCost: 150 },
        { ingredientId: 'i-3', ingredientCode: 'NL-DAUAN-09', ingredientName: 'Dầu ăn Cái Lân', unit: 'Lít', quantityPerServing: 0.015, grossWeight: 0.015, unitPrice: 42000, lineCost: 630 },
      ],
    },
    {
      dishId: 'd-2',
      dishCode: 'DISH-CHA-CA',
      dishName: 'Chả cá sốt cà',
      categoryName: 'Món phụ',
      servingTargetPrice: 25000,
      calculatedCost: 8900,
      bomItemsCount: 2,
      costRatioPercent: 35.6,
      bomLines: [
        { ingredientId: 'i-4', ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', unit: 'Kilogram', quantityPerServing: 0.075, grossWeight: 0.08, unitPrice: 75000, lineCost: 5625 },
        { ingredientId: 'i-5', ingredientCode: 'NL-CACHUA-08', ingredientName: 'Cà chua Đà Lạt', unit: 'Kilogram', quantityPerServing: 0.03, grossWeight: 0.035, unitPrice: 18000, lineCost: 540 },
      ],
    },
  ],
  dailyMaterials: [
    { materialId: 'i-1', materialCode: 'NL-GA-06', materialName: 'Thịt gà phi lê tươi', unit: 'Kilogram', totalQuantity: 72.0, estimatedAmount: 6120000 },
    { materialId: 'i-4', materialCode: 'NL-CA-02', materialName: 'Chả cá thác lác', unit: 'Kilogram', totalQuantity: 63.5, estimatedAmount: 4762500 },
    { materialId: 'i-6', materialCode: 'NL-RAU-03', materialName: 'Bầu sao tươi', unit: 'Kilogram', totalQuantity: 120.0, estimatedAmount: 1800000 },
  ],
};

export const MOCK_DASHBOARD_DATA: DashboardData = {
  metrics: [
    { id: 'm1', label: 'Suất ăn theo KHSX', value: '10.290', unit: 'suất ca ngày', trend: 'Khách hàng DAV & ANV', variant: 'default' },
    { id: 'm2', label: 'Vật tư thiếu hụt', value: '823', unit: 'nguyên liệu', trend: 'Cần bổ sung PO', variant: 'warning' },
    { id: 'm3', label: 'Yêu cầu PO quá hạn', value: '4', unit: 'đề xuất', trend: 'Cần duyệt trước 11:00', variant: 'danger' },
    { id: 'm4', label: 'Phiếu nhập trễ hạn', value: '7', unit: 'phiếu kho', trend: 'Kho trung tâm', variant: 'warning' },
    { id: 'm5', label: 'Chất lượng dữ liệu', value: '7', unit: 'cảnh báo', trend: 'Kiểm soát định mức BOM', variant: 'warning' },
  ],
  tasks: [
    { id: 't-1', title: 'Ký duyệt bàn giao nguyên liệu ca nấu Draxlmaier', assignee: 'Bếp trưởng', roleCode: 'CHEF', deadline: '10:30 Hôm nay', priority: 'high', status: 'pending', actionRoute: '/weekly-menu?view=demand' },
    { id: 't-2', title: 'Xác nhận phiếu xuất kho rau củ và thịt tươi', assignee: 'Thủ kho', roleCode: 'WAREHOUSE', deadline: '11:00 Hôm nay', priority: 'high', status: 'pending', actionRoute: '/warehouse' },
    { id: 't-3', title: 'Chốt số lượng suất ăn ca chiều bổ sung', assignee: 'Điều phối viên', roleCode: 'COORDINATOR', deadline: '13:30 Hôm nay', priority: 'medium', status: 'in_progress', actionRoute: '/meal-orders' },
    { id: 't-4', title: 'Duyệt bảng báo giá nhà cung cấp thực phẩm sạch', assignee: 'Quản lý thu mua', roleCode: 'PURCHASER', deadline: '15:00 Hôm nay', priority: 'normal', status: 'pending', actionRoute: '/purchasing' },
  ],
  stages: [
    { stageNumber: 1, stageName: '1. Tiếp nhận & Chốt đơn ăn', description: 'Chốt số lượng suất ăn từ khách hàng cho cả 2 ca.', status: 'completed', completedCount: 2, totalCount: 2, actionLabel: 'Xem đơn ăn', actionRoute: '/meal-orders' },
    { stageNumber: 2, stageName: '2. Lập KHSX & Tính nhu cầu BOM', description: 'Phân rã thực đơn, tính toán nguyên liệu và phát lệnh KHSX.', status: 'completed', completedCount: 14, totalCount: 14, actionLabel: 'Xem KHSX', actionRoute: '/weekly-menu?view=production-plan' },
    { stageNumber: 3, stageName: '3. Xuất kho & Chế biến tại bếp', description: 'Bếp trưởng nhận vật tư, hoàn thành bàn giao nguyên liệu ca nấu.', status: 'in_progress', completedCount: 26, totalCount: 29, actionLabel: 'Theo dõi bếp', actionRoute: '/chef' },
    { stageNumber: 4, stageName: '4. Giao nhận suất & Đối soát', description: 'Bàn giao khay cơm tại nhà máy, ghi nhận số suất thực tế.', status: 'waiting', completedCount: 0, totalCount: 2, actionLabel: 'Đối soát ca', actionRoute: '/reconciliation' },
  ],
};

export const MOCK_COORDINATION_DATA: CoordinationShiftSummary = {
  serviceDate: '2026-09-21',
  shiftName: 'MORNING',
  customerCode: 'DAV',
  registeredServings: 850,
  actualServings: 844,
  varianceServings: -6,
  attendanceRatePercent: 99.3,
  orders: [
    {
      id: 'ord-1', quantityPlanLineId: 'qpl-1', quantityPlanId: 'qp-1', menuScheduleId: 'ms-1',
      customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier Automotive',
      mealType: 'Cơm mặn ca ngày', forecastQuantity: 850, actualQuantity: 844,
      unitPrice: 0, appliedRate: 0, specialNotes: '', serviceDate: '2026-09-21', shiftName: 'MORNING',
      menuId: 'menu-1', menuCode: 'MENU-1', menuName: 'Thực đơn persisted',
      dishes: [{ dishId: 'dish-1', dishCode: 'DISH-1', dishName: 'Khô gà lá chanh', displayOrder: 1 }],
    },
  ],
};

export const MOCK_CHEF_DATA: ChefDashboardData = {
  serviceDate: '2026-09-21',
  customerId: 'customer-1',
  customerCode: 'DAV',
  customerName: 'Draxlmaier Automotive',
  shiftName: 'MORNING',
  totalPlans: 1,
  sentPlans: 1,
  totalDishes: 1,
  totalServings: 844,
  warnings: [],
  plans: [
    {
      planLineId: 'plan-line-1',
      planId: 'plan-1',
      planCode: 'KHSX-DAV-20260921-FULLDAY',
      dishId: 'dish-1',
      dishName: 'Khô gà lá chanh',
      shiftName: 'MORNING',
      plannedServings: 844,
      serviceDate: '2026-09-21',
      planStatus: 'READY',
      sentToKitchenAt: '2026-09-21T07:00:00Z',
    },
  ],
  issues: [
    {
      issueId: 'issue-1',
      issueCode: 'ISS-20260921-01',
      issueDate: '2026-09-21',
      shiftName: 'MORNING',
      warehouseName: 'Kho trung tâm',
      lines: [
        {
          issueLineId: 'issue-line-1',
          materialRequestLineId: 'request-line-1',
          ingredientId: 'ingredient-1',
          ingredientName: 'Thịt gà phi lê tươi',
          unitId: 'unit-kg',
          unitName: 'Kilogram',
          requestedQty: 72,
          issuedQty: 72,
        },
      ],
    },
  ],
  issuePage: { totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false },
};

export const MOCK_PURCHASE_ORDERS: PurchaseOrderItem[] = [
  {
    id: 'po-1',
    code: 'PO-20260721-0858',
    purchaseRequestCode: 'PR-20260721-01',
    supplierId: 'sup-1',
    supplierName: 'Công ty CP Thực phẩm Sao Việt',
    orderDate: '2026-07-21',
    status: 'RECEIVED',
    totalAmount: 18500000,
    linesCount: 2,
    lines: [
      { lineId: 'l-1', ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unit: 'Kilogram', orderedQuantity: 120, unitPrice: 95000, lineTotal: 11400000 },
      { lineId: 'l-2', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', orderedQuantity: 70, unitPrice: 85000, lineTotal: 5950000 },
    ],
  },
];

export const MOCK_SUPPLIERS: SupplierItem[] = [
  { supplierId: 'sup-1', supplierCode: 'NCC-01', supplierName: 'Công ty CP Thực phẩm Sao Việt', contactPhone: '0901234567', isActive: true },
  { supplierId: 'sup-2', supplierCode: 'NCC-02', supplierName: 'HTX Nông sản Sạch Hải Dương', contactPhone: '0912345678', isActive: true },
];

export const MOCK_WAREHOUSES: WarehouseItem[] = [
  { warehouseId: 'wh-1', warehouseCode: 'KHO-TONG', warehouseName: 'Kho Trung tâm Bình Dương', isActive: true },
  { warehouseId: 'wh-2', warehouseCode: 'KHO-LANH', warehouseName: 'Kho Lạnh Thực phẩm Tươi', isActive: true },
];

export const MOCK_RECEIPTS: InventoryReceiptItem[] = [
  {
    receiptId: 'rcp-1',
    receiptCode: 'RCP-PO-20260721-0858',
    receiptDate: '2026-07-21',
    supplierName: 'Công ty CP Thực phẩm Sao Việt',
    warehouseName: 'Kho Lạnh Thực phẩm Tươi',
    status: 'POSTED',
    itemsCount: 1,
    lines: [
      { lineId: 'rl-1', ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unit: 'Kilogram', receivedQty: 120, unitPrice: 95000 },
    ],
  },
];

export const MOCK_ISSUES: InventoryIssueItem[] = [
  {
    issueId: 'iss-1',
    issueCode: 'ISS-20260921-0730',
    issueDate: '2026-09-21',
    shiftName: 'Ca 1 (Sáng)',
    warehouseName: 'Kho Lạnh Thực phẩm Tươi',
    status: 'ISSUED',
    itemsCount: 1,
    lines: [
      { lineId: 'il-1', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', unit: 'Kilogram', requestedQty: 72, issuedQty: 72 },
    ],
  },
];

export const MOCK_APPROVALS: ApprovalInboxItem[] = [
  {
    inboxItemId: 'app-1',
    targetType: 'material-demand',
    targetId: 'mr-dav-01',
    targetCode: 'MR-DAV-20260921-FULLDAY',
    itemType: 'Nhu cầu nguyên liệu',
    title: 'Duyệt nhu cầu nguyên liệu ca ngày Draxlmaier',
    source: 'Kế hoạch sản xuất tuần',
    ownerRole: 'QUAN_LY_SAN_XUAT',
    submittedBy: 'Điều hành sản xuất',
    dueDate: '2026-09-21',
    status: 'PENDING',
    reason: 'Phát lệnh bàn giao nguyên liệu 14 món ca ngày',
    totalQuantity: 1275.5,
    totalValue: 37445061,
    submittedAt: '07:30 21/09/2026',
    slaDeadline: '10:00 21/09/2026',
    materials: [
      { name: 'Thịt đùi heo tươi', quantity: 185.5, unit: 'Kilogram' },
    ],
  },
];

export const MOCK_RECONCILIATION: ReconciliationBatchSummary = {
  batchId: 'recon-batch-20260921-01',
  customerCode: 'DAV',
  customerName: 'Công ty TNHH Draxlmaier Automotive',
  weekStartDate: '2026-09-21',
  weekEndDate: '2026-09-27',
  status: 'IN_PROGRESS',
  version: 7,
  weeklyStatus: 'WEEK_COMPLETE',
  lines: [
    {
      id: 'rl-1',
      dailyLineId: 'daily-1',
      serviceDate: '2026-09-21',
      ingredientId: 'ingredient-1',
      materialCode: 'NL-THIT-01',
      materialName: 'Thịt đùi heo tươi',
      unitId: 'unit-kg',
      unit: 'Kilogram',
      requiredQuantity: 72,
      issuedQuantity: 71.5,
      issuedRequiredDifference: -0.5,
      status: 'WEEK_COMPLETE',
      version: 3,
      triggers: [],
      notes: [],
    },
  ],
};
