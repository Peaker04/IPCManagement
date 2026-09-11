import { describe, expect, it } from 'vitest';
import { boundedTimerMinutes } from './idleSessionPolicy';

describe('idle session timer policy', () => {
  it.each([undefined, '', '0', '-1', 'NaN', 'Infinity', '40000'])('falls back for invalid or overflowing value %s', (value) => {
    expect(boundedTimerMinutes(value, 60)).toBe(60);
  });

  it('accepts a positive duration within the browser timer range', () => {
    expect(boundedTimerMinutes('90', 60)).toBe(90);
  });
});
