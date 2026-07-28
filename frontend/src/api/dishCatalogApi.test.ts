import { describe, expect, it } from 'vitest';

import { buildBomImportFormData } from './dishCatalogApi';

describe('dishCatalogApi BOM import form data', () => {
  it('sends the fixed tier, customer override, effective date, and file for BOM preview/commit', () => {
    const file = new File(['DishCode,DishName'], 'bom.csv', { type: 'text/csv' });

    const formData = buildBomImportFormData({
      file,
      priceTier: 30000,
      customerId: '  customer-1  ',
      effectiveFrom: ' 2026-07-01 ',
    });

    expect(formData.get('file')).toBe(file);
    expect(formData.get('priceTier')).toBe('30000');
    expect(formData.get('customerId')).toBe('customer-1');
    expect(formData.get('effectiveFrom')).toBe('2026-07-01');
  });

  it('omits empty optional fields so global tier imports do not send stale customer scope', () => {
    const file = new File(['DishCode,DishName'], 'bom.csv', { type: 'text/csv' });

    const formData = buildBomImportFormData({
      file,
      priceTier: 25000,
      customerId: '   ',
      effectiveFrom: '',
    });

    expect(formData.get('file')).toBe(file);
    expect(formData.get('priceTier')).toBe('25000');
    expect(formData.has('customerId')).toBe(false);
    expect(formData.has('effectiveFrom')).toBe(false);
  });
});
