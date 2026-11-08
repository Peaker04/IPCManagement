import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  bomApi,
  type BomCoverageReport,
  type BomImportCommitResult,
  type BomImportPreviewResult,
  type DishBomLine,
} from '../api/bomApi';
import * as clientModule from '../api/client';

describe('BomApi Contract Tests (Rule TA-1 & TA-5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getBomCoverage invokes /Dishes/bom-coverage and returns coverage report', async () => {
    const mockReport: BomCoverageReport = {
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

    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockReport);

    const result = await bomApi.getBomCoverage();

    expect(spy).toHaveBeenCalledWith('/Dishes/bom-coverage', { signal: undefined });
    expect(result.totalDishes).toBe(195);
    expect(result.missingBomDishes).toBe(15);
    expect(result.dishes).toHaveLength(1);
  });

  it('getDishBomLines invokes /Dishes/{id}/bom and returns list of BOM lines', async () => {
    const mockLines: DishBomLine[] = [
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
        priceTierAmount: 25000,
        bomScope: 'global',
        grossQtyPerServing: 0.15,
        wasteRatePercent: 5,
        bomStatus: 'PUBLISHED',
        bomStatusLabel: 'Đang áp dụng',
        effectiveFrom: '2026-01-01',
        referencePrice: 120000,
      },
    ];

    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockLines);

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

    const mockCreated: DishBomLine = {
      bomId: 'b-2',
      dishId: 'd-1',
      dishCode: 'MON-01',
      dishName: 'Cơm sườn',
      ingredientId: 'ing-2',
      ingredientCode: 'NL-TOI',
      ingredientName: 'Tỏi',
      unitId: 'u-1',
      unitCode: 'KG',
      unitName: 'kg',
      priceTierAmount: 25000,
      bomScope: 'global',
      grossQtyPerServing: 0.05,
      wasteRatePercent: 0,
      bomStatus: 'PUBLISHED',
      bomStatusLabel: 'Đang áp dụng',
      effectiveFrom: '2026-01-01',
      referencePrice: 45000,
    };

    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockCreated);

    const result = await bomApi.addDishBomLine('d-1', payload);

    expect(spy).toHaveBeenCalledWith('/Dishes/d-1/bom', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result.bomId).toBe('b-2');
  });

  it('closeDishBomLine invokes DELETE /Dishes/{id}/bom/{bomId}', async () => {
    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce({ success: true });

    await bomApi.closeDishBomLine('d-1', 'b-1');

    expect(spy).toHaveBeenCalledWith('/Dishes/d-1/bom/b-1', {
      method: 'DELETE',
    });
  });

  it('previewBomImport invokes POST /Dishes/bom-import/preview with FormData', async () => {
    const formData = new FormData();
    const mockPreview: BomImportPreviewResult = {
      generatedAt: '2026-10-28T12:00:00Z',
      priceTier: 25000,
      bomScope: 'global',
      canCommit: true,
      totalRows: 10,
      validRows: 10,
      errorRows: 0,
      warningRows: 0,
      rows: [],
      warnings: [],
    };
    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockPreview);

    const result = await bomApi.previewBomImport(formData);

    expect(spy).toHaveBeenCalledWith('/Dishes/bom-import/preview', {
      method: 'POST',
      body: formData,
    });
    expect(result.canCommit).toBe(true);
  });

  it('commitBomImport invokes POST /Dishes/bom-import/commit with FormData', async () => {
    const formData = new FormData();
    const mockCommit: BomImportCommitResult = {
      generatedAt: '2026-10-28T12:00:00Z',
      priceTier: 25000,
      bomScope: 'global',
      totalRows: 10,
      validRows: 10,
      errorRows: 0,
      warningRows: 0,
      canCommit: true,
      rows: [],
      warnings: [],
      createdRows: 10,
      updatedRows: 0,
      archivedRows: 0,
      auditBatchCode: 'BOM-01',
    };
    const spy = vi.spyOn(clientModule, 'apiClient').mockResolvedValueOnce(mockCommit);

    const result = await bomApi.commitBomImport(formData);

    expect(spy).toHaveBeenCalledWith('/Dishes/bom-import/commit', {
      method: 'POST',
      body: formData,
    });
    expect(result.createdRows).toBe(10);
    expect(result.updatedRows).toBe(0);
    expect(result.archivedRows).toBe(0);
  });
});
