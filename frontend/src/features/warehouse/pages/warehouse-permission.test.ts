import { describe, expect, it } from 'vitest';
import warehousePageSource from './WarehousePage.tsx?raw';

describe('WarehousePage permission contract', () => {
  it('uses the normalized thukho role for warehouse mutations', () => {
    expect(warehousePageSource).toContain("useHasRole(['thukho'])");
    expect(warehousePageSource).not.toContain("useHasRole(['warehouse'])");
  });
});
