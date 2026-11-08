import assert from 'node:assert/strict'
import test from 'node:test'
import { detectServedMode, summarizeFrameMetrics } from './perf-probe-metrics.mjs'

test('detects served Vite mode from the actual endpoint response', () => {
  assert.equal(detectServedMode('text/javascript', 'export const createHotContext = () => {}'), 'dev')
  assert.equal(detectServedMode('text/html', '<!doctype html>'), 'preview')
  assert.equal(detectServedMode('text/javascript', 'built asset'), 'preview')
})

test('summarizes frame distributions and supported LoAF entries', () => {
  const result = summarizeFrameMetrics([8, 10, 17, 40], [
    { duration: 55, blockingDuration: 5 },
    { duration: 80, blockingDuration: 20 },
  ], true)
  assert.deepEqual(result, {
    frameObserver: 'requestAnimationFrame',
    frameCount: 4,
    medianFrameMs: 10,
    p95FrameMs: 40,
    framesOver8_33Ms: 3,
    framesOver16_67Ms: 2,
    framesOver33_3Ms: 1,
    longestFrameMs: 40,
    loaf: {
      supported: true,
      count: 2,
      longestDurationMs: 80,
      totalBlockingDurationMs: 25,
      entries: [{ duration: 55, blockingDuration: 5 }, { duration: 80, blockingDuration: 20 }],
    },
  })
})

test('filters buffered frame and LoAF entries by interval overlap with the actual input window', () => {
  const result = summarizeFrameMetrics([
    { startTime: 80, duration: 10 },
    { startTime: 95, duration: 10 },
    { startTime: 110, duration: 18 },
    { startTime: 140, duration: 20 },
    { startTime: 151, duration: 50 },
  ], [
    { startTime: 70, duration: 20, blockingDuration: 5 },
    { startTime: 95, duration: 20, blockingDuration: 10 },
    { startTime: 120, duration: 60, blockingDuration: 10 },
  ], true, { startTime: 100, endTime: 150 })
  assert.equal(result.frameCount, 3)
  assert.equal(result.longestFrameMs, 20)
  assert.equal(result.loaf.count, 2)
  assert.equal(result.loaf.longestDurationMs, 60)
})

test('keeps unsupported LoAF explicit instead of reporting zero', () => {
  const result = summarizeFrameMetrics([], [], false)
  assert.equal(result.frameCount, 0)
  assert.equal(result.medianFrameMs, null)
  assert.deepEqual(result.loaf, {
    supported: false,
    count: null,
    longestDurationMs: null,
    totalBlockingDurationMs: null,
    entries: [],
  })
})
