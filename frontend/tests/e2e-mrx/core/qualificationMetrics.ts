import type { Page } from '@playwright/test';

export function summarizeSamples(values: readonly number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  const rank = (p: number) => sorted.length ? sorted[Math.ceil(sorted.length * p) - 1] : null;
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null;
  return { count: sorted.length, median, p75: rank(0.75), p95: rank(0.95), p99: rank(0.99) };
}

export interface InteractionSamples {
  eventTimingSupported: boolean;
  loafSupported: boolean;
  interactionDurationsMs: number[];
  longTaskDurationsMs: number[];
  loafDurationsMs: number[];
  cls: number | null;
  lcpMs: number | null;
}

declare global { interface Window { __mrxMeasurements?: InteractionSamples } }

export async function installInteractionProbe(page: Page) {
  await page.addInitScript(() => {
    const supported = PerformanceObserver.supportedEntryTypes;
    const samples: InteractionSamples = { eventTimingSupported: supported.includes('event'), loafSupported: supported.includes('long-animation-frame'), interactionDurationsMs: [], longTaskDurationsMs: [], loafDurationsMs: [], cls: supported.includes('layout-shift') ? 0 : null, lcpMs: null };
    window.__mrxMeasurements = samples;
    const observe = (type: string, callback: (entry: PerformanceEntry) => void) => {
      if (supported.includes(type)) new PerformanceObserver((list) => list.getEntries().forEach(callback)).observe({ type, buffered: true });
    };
    const append = (values: number[], value: number) => { if (values.length < 2000) values.push(value); };
    observe('event', (entry) => append(samples.interactionDurationsMs, entry.duration));
    observe('longtask', (entry) => append(samples.longTaskDurationsMs, entry.duration));
    observe('long-animation-frame', (entry) => append(samples.loafDurationsMs, entry.duration));
    observe('largest-contentful-paint', (entry) => { samples.lcpMs = entry.startTime; });
    observe('layout-shift', (entry) => { const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }; if (!shift.hadRecentInput && samples.cls !== null) samples.cls += shift.value; });
  });
}

export async function collectInteractionSamples(page: Page): Promise<InteractionSamples> {
  return page.evaluate(() => {
    if (!window.__mrxMeasurements) throw new Error('Interaction probe was not installed before navigation.');
    return window.__mrxMeasurements;
  });
}
