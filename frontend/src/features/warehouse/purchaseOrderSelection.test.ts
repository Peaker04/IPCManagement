import { describe, expect, it } from 'vitest';
import { togglePurchaseOrderSelection } from './purchaseOrderSelection';

describe('togglePurchaseOrderSelection', () => {
  it('opens an order on the first user click even when its ID was supplied by a deep link', () => {
    expect(togglePurchaseOrderSelection({ purchaseOrderId: 'po-fixture', detailsOpen: false }, 'po-fixture'))
      .toEqual({ purchaseOrderId: 'po-fixture', detailsOpen: true });
  });

  it('closes only details already opened for the same order', () => {
    expect(togglePurchaseOrderSelection({ purchaseOrderId: 'po-fixture', detailsOpen: true }, 'po-fixture'))
      .toEqual({ purchaseOrderId: '', detailsOpen: false });
  });
});
