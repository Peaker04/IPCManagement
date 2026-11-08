import { describe, expect, it } from 'vitest';
import { summarizeSamples } from '../qualificationMetrics';

describe('qualification sample reporting', () => {
  it('reports unavailable percentiles for no observations and nearest-rank percentiles without changing input', () => {
    expect(summarizeSamples([])).toEqual({ count: 0, median: null, p75: null, p95: null, p99: null });
    const samples = [4, 1, 3, 2];
    expect(summarizeSamples(samples)).toEqual({ count: 4, median: 2.5, p75: 3, p95: 4, p99: 4 });
    expect(samples).toEqual([4, 1, 3, 2]);
  });
});
