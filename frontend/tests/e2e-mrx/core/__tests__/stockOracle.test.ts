import { expect, it } from 'vitest';
import { assertStockDelta, type StockSnapshot } from '../mysqlVerifier';

const before: StockSnapshot = {
  ingredientId: 'A'.repeat(32), unitId: 'B'.repeat(32), warehouseId: 'C'.repeat(32), currentQty: '9007199254.740993',
  lots: [{ lotId: 'D'.repeat(32), quantity: '9007199254.740993' }], movementIds: ['old'],
};
const after: StockSnapshot = { ...before, currentQty: '9007199252.740992',
  lots: [{ lotId: 'D'.repeat(32), quantity: '9007199252.740992' }], movementIds: ['old', 'issue'] };

it('compares independently captured stock and lot deltas at exact six-decimal precision', () => {
  expect(() => assertStockDelta(before, after, { issuedBaseQty: '2.000001', receivedReturnBaseQty: '0' })).not.toThrow();
});
it.each([
  { ...after, currentQty: '9007199252.740993' },
  { ...after, lots: [{ lotId: 'D'.repeat(32), quantity: '9007199252.740993' }] },
  { ...after, warehouseId: 'E'.repeat(32) },
  { ...after, movementIds: ['old'] },
])('rejects wrong balances, lots, scope or missing durable movements', (snapshot) => {
  expect(() => assertStockDelta(before, snapshot, { issuedBaseQty: '2.000001', receivedReturnBaseQty: '0' })).toThrow();
});
it('preserves explicitly untracked opening stock and consumes only the known FEFO lots', () => {
  const untracked = { ...before, currentQty: '10', lots: [{ lotId: 'known', quantity: '3' }] };
  const consumed = { ...untracked, currentQty: '6', lots: [{ lotId: 'known', quantity: '0' }], movementIds: ['old', 'issue'] };
  expect(() => assertStockDelta(untracked, consumed, { issuedBaseQty: '4', receivedReturnBaseQty: '0' })).not.toThrow();
});
it('received returns count as inflow; a pending return cannot be used to explain stock', () => {
  const returned = { ...before, currentQty: '9007199255.740993',
    lots: [{ lotId: 'D'.repeat(32), quantity: '9007199255.740993' }], movementIds: ['old', 'return'] };
  expect(() => assertStockDelta(before, returned, { issuedBaseQty: '0', receivedReturnBaseQty: '1', trackedReturnBaseQty: '1' })).not.toThrow();
  expect(() => assertStockDelta(before, returned, { issuedBaseQty: '0', receivedReturnBaseQty: '0' })).toThrow();
});
it('rejects invalid or negative expected quantities rather than accepting NaN', () => {
  for (const issuedBaseQty of ['NaN', '-1', '1.0000001']) {
    expect(() => assertStockDelta(before, after, { issuedBaseQty, receivedReturnBaseQty: '0' })).toThrow();
  }
});
