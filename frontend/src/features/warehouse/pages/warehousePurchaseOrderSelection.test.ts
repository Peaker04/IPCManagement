import { describe, expect, it } from 'vitest';

import { resolveSelectedPurchaseOrder } from './warehousePurchaseOrderSelection';

const purchaseOrders = [
  { purchaseOrderId: 'po-1', purchaseRequestId: 'pr-1' },
  { purchaseOrderId: 'po-2', purchaseRequestId: 'pr-2' },
];

describe('warehouse purchase-order deep-link selection', () => {
  it('prefers the canonical purchase-order identity', () => {
    expect(resolveSelectedPurchaseOrder(purchaseOrders, 'po-2', 'pr-1')).toEqual(purchaseOrders[1]);
  });

  it('resolves the order from the purchasing handoff request identity', () => {
    expect(resolveSelectedPurchaseOrder(purchaseOrders, null, 'pr-1')).toEqual(purchaseOrders[0]);
  });

  it('does not select an unrelated order without a deep-link identity', () => {
    expect(resolveSelectedPurchaseOrder(purchaseOrders, null, null)).toBeUndefined();
  });
});
