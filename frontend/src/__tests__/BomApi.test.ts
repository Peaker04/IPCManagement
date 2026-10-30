import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bomApi } from '../api/bomApi';
import * as clientModule from '../api/client';

describe('BomApi Contract Tests (Rule TA-1 & TA-5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getBomCoverage invokes /Dishes/bom-coverage and returns coverage report', async () => {
    const mockReport = {
      generatedAt: '2026-10-28T12:00:00Z',
      totalDishes: 195,
      completeDishes: 180,
      missingBomDishes: 15,
      totalBomLines: 450,
      dishes: [
        {
          dishId: 'd-1',
          dishCode: 'MON-01',
          dishName: 'Cơm sườn',
          bomLineCount: 3,
          hasBom: true,
          status: 'COMPLETE',
          statusLabel: 'Đã có BOM',
        },
      ],
    };

    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockReport as any);

    const result = await bomApi.getBomCoverage();

    expect(spy).toHaveBeenCalledWith('/Dishes/bom-coverage');
    expect(result.totalDishes).toBe(195);
    expect(result.missingBomDishes).toBe(15);
    expect(result.dishes).toHaveLength(1);
  });

  it('getDishBomLines invokes /Dishes/{id}/bom and returns list of BOM lines', async () => {
    const mockLines = [
      {
        bomId: 'b-1',
        dishId: 'd-1',
        dishCode: 'MON-01',
        dishName: 'Cơm sườn',
        ingredientId: 'ing-1',
        ingredientCode: 'NL-SUON',
        ingredientName: 'Sườn heo',
        unitId: 'u-1',
        unitCode: 'KG',
        unitName: 'kg',
        grossQtyPerServing: 0.15,
        wasteRatePercent: 5,
        referencePrice: 120000,
        bomStatus: 'PUBLISHED',
      },
    ];

    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockLines as any);

    const result = await bomApi.getDishBomLines('d-1');

    expect(spy).toHaveBeenCalledWith('/Dishes/d-1/bom');
    expect(result).toHaveLength(1);
    expect(result[0].ingredientCode).toBe('NL-SUON');
    expect(result[0].grossQtyPerServing).toBe(0.15);
  });

  it('addDishBomLine invokes POST /Dishes/{id}/bom with payload', async () => {
    const payload = {
      ingredientId: 'ing-2',
      grossQtyPerServing: 0.05,
      unitId: 'u-1',
    };

    const mockCreated = {
      bomId: 'b-2',
      dishId: 'd-1',
      ingredientId: 'ing-2',
      grossQtyPerServing: 0.05,
    };

    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockCreated as any);

    const result = await bomApi.addDishBomLine('d-1', payload);

    expect(spy).toHaveBeenCalledWith('/Dishes/d-1/bom', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result.bomId).toBe('b-2');
  });

  it('closeDishBomLine invokes DELETE /Dishes/{id}/bom/{bomId}', async () => {
    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce({ success: true } as any);

    await bomApi.closeDishBomLine('d-1', 'b-1');

    expect(spy).toHaveBeenCalledWith('/Dishes/d-1/bom/b-1', {
      method: 'DELETE',
    });
  });

  it('previewBomImport invokes POST /Dishes/bom-import/preview with FormData', async () => {
    const formData = new FormData();
    const mockPreview = { canCommit: true, totalRows: 10, validRows: 10, errorRows: 0, rows: [] };
    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockPreview as any);

    const result = await bomApi.previewBomImport(formData);

    expect(spy).toHaveBeenCalledWith('/Dishes/bom-import/preview', {
      method: 'POST',
      body: formData,
    });
    expect(result.canCommit).toBe(true);
  });

  it('commitBomImport invokes POST /Dishes/bom-import/commit with FormData', async () => {
    const formData = new FormData();
    const mockCommit = { totalCommittedRows: 10, createdRows: 10, updatedRows: 0, auditBatchCode: 'BOM-01' };
    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockCommit as any);

    const result = await bomApi.commitBomImport(formData);

    expect(spy).toHaveBeenCalledWith('/Dishes/bom-import/commit', {
      method: 'POST',
      body: formData,
    });
    expect(result.totalCommittedRows).toBe(10);
  });
});
