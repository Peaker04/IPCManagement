import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDayLabel, getTodayDayCode } from './dateUtils';
import {
  formatPercent,
  formatQuantity,
  formatQuantityWithUnit,
  formatUnit,
  roundMoney,
  roundPercent,
  roundQuantity,
} from './formatters';

describe('date utilities boundaries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps Sunday to cn and Monday to t2', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-07-12T08:00:00+07:00'));
    expect(getTodayDayCode()).toBe('cn');

    vi.setSystemTime(new Date('2026-07-13T08:00:00+07:00'));
    expect(getTodayDayCode()).toBe('t2');
  });

  it('returns the original day code when no label exists', () => {
    expect(getDayLabel('t2')).toBe('Thứ Hai');
    expect(getDayLabel('unknown')).toBe('unknown');
  });
});

describe('number formatter BVA', () => {
  it.each([
    [0.0000004, 0],
    [0.0000005, 0.000001],
    [1.2345674, 1.234567],
    [1.2345675, 1.234568],
  ])('roundQuantity(%s) -> %s', (value, expected) => {
    expect(roundQuantity(value)).toBe(expected);
  });

  it.each([
    [1.004, 1],
    [1.005, 1.01],
  ])('roundMoney(%s) -> %s', (value, expected) => {
    expect(roundMoney(value)).toBe(expected);
  });

  it.each([
    [1.234, 1.23],
    [1.235, 1.24],
  ])('roundPercent(%s) -> %s', (value, expected) => {
    expect(roundPercent(value)).toBe(expected);
  });

  it('formats normalized quantities and unit aliases', () => {
    expect(formatQuantity(1234.56789, { maximumFractionDigits: 2 })).toBe('1.234,57');
    expect(formatUnit(' Kilograms ')).toBe('kg');
    expect(formatUnit('bag')).toBe('bag');
    expect(formatQuantityWithUnit(0.0000004, 'gram')).toBe('0 g');
  });

  it('formats percentages with configurable precision', () => {
    expect(formatPercent(12.345, 2)).toBe('12,35%');
    expect(formatPercent(12.345)).toBe('12,3%');
  });
});
