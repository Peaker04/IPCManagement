const percentile = (values, fraction) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]
}

const round = (value, digits = 2) => value == null ? null : Math.round(value * 10 ** digits) / 10 ** digits

export function detectServedMode(contentType, viteClientBody) {
  return contentType?.includes('javascript') && viteClientBody.includes('createHotContext') ? 'dev' : 'preview'
}

export function summarizeFrameMetrics(frameEntries, loafEntries, loafSupported, window = {}) {
  const overlapsWindow = (entry) => {
    const entryStart = entry.startTime ?? null
    if (entryStart == null) return true
    const entryEnd = entryStart + entry.duration
    return (window.startTime == null || entryEnd >= window.startTime) && (window.endTime == null || entryStart <= window.endTime)
  }
  const frameTimes = frameEntries
    .map((entry) => typeof entry === 'number' ? { startTime: null, duration: entry } : entry)
    .filter((entry) => Number.isFinite(entry.duration))
    .filter(overlapsWindow)
    .map(({ duration }) => duration)
  const validFrames = frameTimes.filter((value) => value >= 0)
  const loafs = loafEntries
    .filter((entry) => Number.isFinite(entry.duration))
    .filter(overlapsWindow)
  return {
    frameObserver: 'requestAnimationFrame',
    frameCount: validFrames.length,
    medianFrameMs: round(percentile(validFrames, 0.5)),
    p95FrameMs: round(percentile(validFrames, 0.95)),
    framesOver8_33Ms: validFrames.filter((value) => value > 8.33).length,
    framesOver16_67Ms: validFrames.filter((value) => value > 16.67).length,
    framesOver33_3Ms: validFrames.filter((value) => value > 33.3).length,
    longestFrameMs: round(validFrames.length ? Math.max(...validFrames) : null),
    loaf: loafSupported
      ? {
          supported: true,
          count: loafs.length,
          longestDurationMs: round(loafs.length ? Math.max(...loafs.map(({ duration }) => duration)) : null),
          totalBlockingDurationMs: round(loafs.reduce((sum, entry) => sum + (entry.blockingDuration ?? 0), 0)),
          entries: loafs,
        }
      : { supported: false, count: null, longestDurationMs: null, totalBlockingDurationMs: null, entries: [] },
  }
}
