import { describe, expect, it } from 'vitest';

import { resolvePurchasingRouteState } from './purchasingModel';

describe('purchasing week boundary on the vietnam calendar', () => {
  it('opens the current week from the first hours of Monday morning', () => {
    // 00:30 ICT thứ Hai 27/07 = 17:30Z chủ nhật 26/07 — trước đây rơi về tuần trước
    expect(resolvePurchasingRouteState({}, [], new Date('2026-07-27T00:30:00+07:00')).week)
      .toBe('2026-07-27');
    expect(resolvePurchasingRouteState({}, [], new Date('2026-07-27T06:59:00+07:00')).week)
      .toBe('2026-07-27');
    expect(resolvePurchasingRouteState({}, [], new Date('2026-07-27T08:00:00+07:00')).week)
      .toBe('2026-07-27');
  });

  it('keeps Sunday inside the week that started the previous Monday', () => {
    expect(resolvePurchasingRouteState({}, [], new Date('2026-07-26T23:30:00+07:00')).week)
      .toBe('2026-07-20');
  });

  it('falls back to the vietnam week when the URL state is unusable', () => {
    expect(resolvePurchasingRouteState(
      { week: 'not-a-date', date: 'also-invalid', stage: 'unknown' },
      [],
      new Date('2026-07-27T00:30:00+07:00'),
    )).toEqual({
      week: '2026-07-27',
      date: undefined,
      stage: 'demand',
      scope: 'FULLDAY',
    });
  });
});
