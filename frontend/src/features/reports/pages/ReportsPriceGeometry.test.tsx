import { describe, expect, it } from 'vitest';
import source from './ReportsPricePanel.tsx?raw';

describe('reports price variance geometry', () => {
  it('keeps change, status and proposal action in one flexible semantic row', () => {
    expect(source).toContain('ipc-price-variance-summary');
    expect(source).toContain('▲ +${formatPercent(item.change)}');
    expect(source).toContain('Vượt ngưỡng');
    expect(source).toContain('Xem đề xuất');
    expect(source).not.toContain('mt-1 flex items-center justify-end gap-2 whitespace-nowrap');
  });
});
