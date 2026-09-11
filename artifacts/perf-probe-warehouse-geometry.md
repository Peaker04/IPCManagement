# Báo cáo đầu đo — 2026-08-21T11:04:28.756Z

```json
{
  "startedAt": "2026-08-21T11:04:28.756Z",
  "baseUrl": "http://127.0.0.1:4173",
  "profile": "mock=huge",
  "navigation": "context nguội theo route; tab được kích hoạt và xác minh aria-selected trước t_0",
  "throttle": {
    "cpuRate": 4,
    "downKbps": 500,
    "upKbps": 500,
    "latencyMs": 400
  },
  "thresholds": {
    "CGR_MAX": 0.1,
    "CLS_MAX": 0.1,
    "SCROLL_GROWTH_MAX_RATIO": 0.5,
    "INP_MAX": 200,
    "INP_MAX_LAB_4X": 500,
    "OVERFLOW_TOLERANCE_PX": 1,
    "PRESENTATION_DOMINANT_SHARE": 0.6,
    "REPEATS": 5
  },
  "load": [
    {
      "id": "warehouse-movement",
      "route": "warehouse",
      "tab": "warehouse-movement",
      "url": "http://127.0.0.1:4173/warehouse?mock=huge",
      "notes": [],
      "t0": {
        "t": 7908.200000000186,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#warehouse-movement-panel .ipc-table-viewport",
        "anchorSelector": "#warehouse-movement-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 1731.1875,
        "anchorHeight": 49,
        "clientHeight": 429,
        "scrollHeight": 429,
        "overflowY": "auto",
        "rowsData": 8,
        "rowsSkeleton": 0,
        "rowHeights": [
          49,
          49,
          49,
          49,
          49,
          49,
          49,
          49
        ],
        "innerHeight": 900
      },
      "settled": {
        "t": 8794.100000000093,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#warehouse-movement-panel .ipc-table-viewport",
        "anchorSelector": "#warehouse-movement-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 1731.1875,
        "anchorHeight": 49,
        "clientHeight": 429,
        "scrollHeight": 429,
        "overflowY": "auto",
        "rowsData": 8,
        "rowsSkeleton": 0,
        "rowHeights": [
          49,
          49,
          49,
          49,
          49,
          49,
          49,
          49
        ],
        "innerHeight": 900
      },
      "rowsDataSettled": 8,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0,
      "clsWindow": 0,
      "clsSources": [],
      "lcp": {
        "startTime": 7652,
        "element": "p.font-sans.mt-1.text-slate-600",
        "size": 12036
      },
      "deltaTop": 0,
      "cgrDenominator": 900,
      "cgr": 0,
      "growthDenominator": 429,
      "growthRatio": 0,
      "growthFrameSelector": "#warehouse-movement-panel .ipc-table-viewport",
      "gradable": true,
      "verdicts": {
        "cgr": "DAT",
        "cls": "DAT",
        "growth": "DAT"
      }
    }
  ],
  "inp": [],
  "overflow": [],
  "integrityViolations": [],
  "counts": {
    "loadRows": 1,
    "loadGradable": 1,
    "inpCells": 0,
    "inpValueBearing": 0,
    "overflowRuns": 0,
    "overflowFailing": 0
  }
}
```
