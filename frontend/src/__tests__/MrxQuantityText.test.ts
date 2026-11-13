import { expect, it } from 'vitest';
import { parseMrxQuantityText, formatMrxQuantityText } from '../features/warehouse/mrxQuantity';
it.each([['79,773','79.773'],['2048,92','2048.92'],['0,000001','0.000001'],['79.773','79.773'],['1.234','1.234']])('parses %s without changing magnitude', (input, expected) => expect(parseMrxQuantityText(input)).toBe(expected));
it.each(['','1,','1.','2.048,92','1e3','Infinity','-1','1 000'])('rejects incomplete, grouped or non-decimal: %s', input => expect(parseMrxQuantityText(input)).toBeNull());
it('formats canonical drafts without grouping', () => expect(formatMrxQuantityText('2048.92')).toBe('2048,92'));

it('preserves existing owner rounding input', () => expect(parseMrxQuantityText('0,30000000000000004')).toBe('0.30000000000000004'));
