import { describe, expect, it } from 'vitest';
import { buildCsv } from './reportCsv';

describe('reportCsv', () => {
  it('preserves the UTF-8 BOM and escapes commas and quotes', () => {
    const csv = buildCsv(
      [{ name: 'Gạo, tẻ', note: 'Giá "mới"' }],
      [['Tên', (row) => row.name], ['Ghi chú', (row) => row.note]],
    );

    expect(csv).toBe('\uFEFFTên,Ghi chú\r\n"Gạo, tẻ","Giá ""mới"""');
  });
});
