import type { DemandLine } from '@/features/workflow';
import type {
  PurchaseRequestResult,
  PurchaseWorkbenchServiceDate,
  PurchaseWorkflowStageCounts,
  WarehouseDto,
} from '../workflowApi';

export type PurchasingStageId =
  | 'demand'
  | 'supplier-price'
  | 'exception'
  | 'submitted'
  | 'approved-order'
  | 'receiving';

export const PURCHASING_STAGES = [
  {
    id: 'demand',
    label: 'Nhu cầu đã duyệt',
    countKey: 'demand',
    blockedReason: 'Cần có nhu cầu nguyên liệu đã được duyệt.',
  },
  {
    id: 'supplier-price',
    label: 'Chọn nhà cung cấp và giá',
    countKey: 'supplierPrice',
    blockedReason: 'Cần tạo đề xuất mua từ nhu cầu đã duyệt.',
  },
  {
    id: 'exception',
    label: 'Xử lý ngoại lệ giá',
    countKey: 'exception',
    blockedReason: 'Cần xác nhận nhà cung cấp, giá và ngày giao cho từng dòng.',
  },
  {
    id: 'submitted',
    label: 'Gửi đề xuất mua',
    countKey: 'submittedRequest',
    blockedReason: 'Cần xử lý xong mọi ngoại lệ giá.',
  },
  {
    id: 'approved-order',
    label: 'Duyệt và tạo đơn',
    countKey: 'approvedOrder',
    blockedReason: 'Đề xuất mua phải được gửi và quản lí duyệt.',
  },
  {
    id: 'receiving',
    label: 'Theo dõi nhập kho',
    countKey: 'receivingProgress',
    blockedReason: 'Cần tạo ít nhất một đơn đặt hàng.',
  },
] as const satisfies ReadonlyArray<{
  id: PurchasingStageId;
  label: string;
  countKey: keyof PurchaseWorkflowStageCounts;
  blockedReason: string;
}>;

const purchasingStageIds = new Set<PurchasingStageId>(PURCHASING_STAGES.map((stage) => stage.id));

const parseIsoDate = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return parsed;
};

const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const toIsoMonday = (value: Date) => {
  const monday = new Date(value);
  const weekday = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return toIsoDate(monday);
};

export const isPurchasingStage = (value?: string | null): value is PurchasingStageId =>
  Boolean(value && purchasingStageIds.has(value as PurchasingStageId));

const stageIndex = (stage: PurchasingStageId) =>
  PURCHASING_STAGES.findIndex((candidate) => candidate.id === stage);

type RouteServiceDate = Pick<
  PurchaseWorkbenchServiceDate,
  'serviceDate' | 'currentStage' | 'receivingLineCount' | 'fullyReceivedLineCount'
>;

export function resolvePurchasingRouteState(
  input: { week?: string | null; date?: string | null; stage?: string | null },
  serviceDates: readonly RouteServiceDate[],
  now = new Date(),
) {
  const requestedWeek = parseIsoDate(input.week);
  const requestedDate = parseIsoDate(input.date);
  const week = requestedWeek
    ? toIsoMonday(requestedWeek)
    : requestedDate
      ? toIsoMonday(requestedDate)
      : toIsoMonday(now);
  const weekStart = parseIsoDate(week)!;
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const inWeekDates = serviceDates
    .filter((serviceDate) => {
      const parsed = parseIsoDate(serviceDate.serviceDate);
      return parsed && parsed >= weekStart && parsed <= weekEnd;
    })
    .toSorted((left, right) => left.serviceDate.localeCompare(right.serviceDate));
  const requestedDateText = requestedDate ? toIsoDate(requestedDate) : undefined;
  const requestedServiceDate = inWeekDates.find(
    (serviceDate) => serviceDate.serviceDate === requestedDateText,
  );
  const actionableServiceDate = inWeekDates.find(
    (serviceDate) =>
      serviceDate.currentStage !== 'receiving' ||
      serviceDate.receivingLineCount === 0 ||
      serviceDate.fullyReceivedLineCount < serviceDate.receivingLineCount,
  );
  const selectedServiceDate = requestedServiceDate ?? actionableServiceDate ?? inWeekDates[0];
  const authoritativeStage = isPurchasingStage(selectedServiceDate?.currentStage)
    ? selectedServiceDate.currentStage
    : 'demand';
  const requestedStage = isPurchasingStage(input.stage) ? input.stage : undefined;
  const stage = requestedStage && stageIndex(requestedStage) <= stageIndex(authoritativeStage)
    ? requestedStage
    : authoritativeStage;

  return {
    week,
    date: selectedServiceDate?.serviceDate,
    stage,
    scope: 'FULLDAY' as const,
  };
}

type NextActionServiceDate = Pick<
  PurchaseWorkbenchServiceDate,
  | 'currentStage'
  | 'approvedDemandCount'
  | 'shortageLineCount'
  | 'supplierReadyLineCount'
  | 'blockingExceptionCount'
  | 'purchaseRequestStatus'
  | 'orderCount'
  | 'receivingLineCount'
  | 'fullyReceivedLineCount'
>;

interface NextActionOptions {
  serverBlocker?: string | null;
  conflict?: boolean;
  loadError?: boolean;
}

export type PurchasingNextAction = {
  kind: 'action' | 'blocked' | 'complete' | 'recovery';
  label?: string;
  message?: string;
};

export function resolveNextPurchasingAction(
  serviceDate?: NextActionServiceDate,
  options: NextActionOptions = {},
): PurchasingNextAction {
  if (options.loadError) {
    return {
      kind: 'recovery',
      label: 'Thử lại',
      message: 'Không tải được quy trình thu mua. Kiểm tra kết nối và thử lại. Các lựa chọn chưa được lưu.',
    };
  }
  if (options.conflict) {
    return {
      kind: 'recovery',
      label: 'Tải lại dữ liệu',
      message: 'Dữ liệu đã thay đổi trên máy chủ. Tải lại trước khi tiếp tục.',
    };
  }
  if (options.serverBlocker) {
    return { kind: 'blocked', message: options.serverBlocker };
  }
  if (!serviceDate) {
    return {
      kind: 'blocked',
      label: undefined,
      message: 'Chưa có nhu cầu đã duyệt trong tuần này.',
    };
  }

  switch (serviceDate.currentStage) {
    case 'demand':
      return serviceDate.approvedDemandCount > 0
        ? { kind: 'action', label: 'Tạo đề xuất mua', message: undefined }
        : {
            kind: 'blocked',
            label: 'Mở phê duyệt nhu cầu',
            message: 'Nhu cầu nguyên liệu chưa được duyệt.',
          };
    case 'supplier-price':
      if (serviceDate.shortageLineCount === 0) {
        return { kind: 'complete', label: undefined, message: 'Không cần mua.' };
      }
      return serviceDate.supplierReadyLineCount >= serviceDate.shortageLineCount
        ? { kind: 'action', label: 'Gửi đề xuất mua', message: undefined }
        : { kind: 'action', label: 'Xác nhận nhà cung cấp', message: undefined };
    case 'exception':
      return serviceDate.blockingExceptionCount > 0
        ? { kind: 'action', label: 'Gửi duyệt ngoại lệ giá', message: undefined }
        : { kind: 'action', label: 'Gửi đề xuất mua', message: undefined };
    case 'submitted':
      return serviceDate.purchaseRequestStatus?.toUpperCase() === 'REJECTED'
        ? {
            kind: 'recovery',
            label: 'Sửa đề xuất mua',
            message: 'Đề xuất mua đã bị từ chối.',
          }
        : { kind: 'action', label: 'Mở phê duyệt đề xuất', message: undefined };
    case 'approved-order':
      return { kind: 'action', label: 'Tạo đơn đặt hàng', message: undefined };
    case 'receiving':
      return serviceDate.receivingLineCount > 0 &&
        serviceDate.fullyReceivedLineCount >= serviceDate.receivingLineCount
        ? { kind: 'complete', label: undefined, message: 'Đã nhận đủ.' }
        : { kind: 'action', label: 'Mở màn hình nhập kho', message: undefined };
    default:
      return {
        kind: 'blocked',
        label: undefined,
        message: 'Trạng thái máy chủ chưa được hỗ trợ. Tải lại dữ liệu trước khi tiếp tục.',
      };
  }
}

export const getPurchasingErrorMessage = (error: unknown) =>
  (error as { data?: { message?: string }; message?: string })?.data?.message ??
  (error as { message?: string })?.message ??
  'Đã xảy ra lỗi không xác định.';

export function mapPurchasePlanLines(
  rows: Array<{
    periodKey: string;
    periodStart: string;
    ingredientId: string;
    ingredientName?: string | null;
    requiredQty: number;
    currentStockQty: number;
    pendingReceiptQty: number;
    unitName?: string | null;
    supplierName?: string | null;
    estimatedUnitPrice?: number | null;
    shortageQty: number;
    warnings: string[];
  }>,
): DemandLine[] {
  return rows.map((row) => ({
    id: `${row.periodKey}-${row.ingredientId}`,
    ingredientId: row.ingredientId,
    sourceDocumentCode: row.periodKey,
    serviceDate: row.periodStart,
    material: row.ingredientName ?? row.ingredientId,
    required: row.requiredQty,
    available: row.currentStockQty + row.pendingReceiptQty,
    reserved: 0,
    unit: row.unitName ?? '',
    source: row.supplierName ?? 'Chưa có nhà cung cấp',
    estimatedUnitPrice: row.estimatedUnitPrice ?? undefined,
    status: row.warnings.length > 0 ? row.warnings.join(', ') : row.shortageQty > 0 ? 'Thiếu hàng' : 'Đủ hàng',
    nextAction: row.shortageQty > 0 ? 'Đề xuất mua' : 'Không cần mua',
    tone: row.warnings.length > 0 ? 'danger' : row.shortageQty > 0 ? 'warning' : 'success',
  }));
}

export function mapPurchaseRequestLines(requests: PurchaseRequestResult[]): DemandLine[] {
  return requests.flatMap((request) =>
    request.lines.map((line) => ({
      id: line.purchaseRequestLineId,
      materialRequestId: request.materialRequestId,
      purchaseRequestId: request.purchaseRequestId,
      purchaseRequestLineId: line.purchaseRequestLineId,
      supplierId: line.supplierId,
      ingredientId: line.ingredientId,
      estimatedUnitPrice: line.estimatedUnitPrice,
      expectedDeliveryDate: line.expectedDeliveryDate,
      note: line.note,
      sourceDocumentCode: request.purchaseRequestCode,
      serviceDate: request.purchaseForDate,
      material: line.ingredientName,
      required: line.requiredQty,
      available: line.currentStockQty,
      reserved: line.purchaseQty,
      unit: line.unitName,
      source: line.supplierName || 'Chưa chọn nhà cung cấp',
      status: request.status,
      nextAction: request.status === 'APPROVED' ? 'Tạo đơn mua hàng' : request.status === 'DRAFT' ? 'Chọn nhà cung cấp' : 'Theo dõi đơn mua',
      tone: request.status === 'APPROVED' ? 'success' : request.status === 'SENTTOSUPPLIER' ? 'warning' : 'neutral',
    })),
  );
}

export function getActionableDraftPurchaseRequests(requests: PurchaseRequestResult[]) {
  return requests.filter((request) => request.status === 'DRAFT' && request.lines.length > 0);
}

export function mapWarehouseOptions(warehouses: WarehouseDto[]) {
  return warehouses.map((warehouse) => ({
    warehouseId: warehouse.warehouseId,
    warehouse: warehouse.warehouseName,
  }));
}

export function getSelectedReceiptWarehouseId(
  receiveWarehouseByOrder: Record<string, string>,
  purchaseOrderId: string,
) {
  return receiveWarehouseByOrder[purchaseOrderId] ?? '';
}

export function formatPurchaseRequestCandidate(candidate: {
  materialRequestCode: string;
  requestDate: string;
  actionableLineCount: number;
  hasExistingPurchaseRequest: boolean;
}) {
  return `${candidate.materialRequestCode} | ${candidate.requestDate} | ${candidate.actionableLineCount} dòng thiếu${candidate.hasExistingPurchaseRequest ? ' | Đã có đề xuất' : ''}`;
}
