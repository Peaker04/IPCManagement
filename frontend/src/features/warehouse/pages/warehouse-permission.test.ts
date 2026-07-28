import { describe, expect, it } from 'vitest';
import warehousePageSource from './WarehousePage.tsx?raw';

describe('WarehousePage permission contract', () => {
  it('uses the normalized thukho role for warehouse mutations', () => {
    expect(warehousePageSource).toContain("useHasRole(['thukho'])");
    expect(warehousePageSource).not.toContain("useHasRole(['warehouse'])");
  });

  it('does not crash when supplemental request data is missing its page items', () => {
    expect(warehousePageSource).toContain('supplementalRequests?.items?.find(');
  });
});
