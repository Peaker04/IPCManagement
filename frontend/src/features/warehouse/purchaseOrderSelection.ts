export type PurchaseOrderSelection = {
  purchaseOrderId: string | null;
  detailsOpen: boolean;
};

export const togglePurchaseOrderSelection = (
  current: PurchaseOrderSelection,
  purchaseOrderId: string,
): PurchaseOrderSelection => current.purchaseOrderId === purchaseOrderId && current.detailsOpen
  ? { purchaseOrderId: '', detailsOpen: false }
  : { purchaseOrderId, detailsOpen: true };
