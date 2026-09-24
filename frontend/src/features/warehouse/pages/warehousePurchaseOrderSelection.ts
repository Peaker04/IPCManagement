import type { PurchaseOrderDto } from '@/api/workflowApiTypes';

type PurchaseOrderIdentity = Pick<PurchaseOrderDto, 'purchaseOrderId' | 'purchaseRequestId'>;

export const resolveSelectedPurchaseOrder = <T extends PurchaseOrderIdentity>(
  purchaseOrders: T[],
  purchaseOrderId: string | null,
  purchaseRequestId: string | null,
): T | undefined => {
  if (purchaseOrderId) {
    return purchaseOrders.find((order) => order.purchaseOrderId === purchaseOrderId);
  }
  if (purchaseRequestId) {
    return purchaseOrders.find((order) => order.purchaseRequestId === purchaseRequestId);
  }
  return undefined;
};
