# Báo cáo đầu đo — 2026-08-21T11:05:55.065Z

```json
{
  "startedAt": "2026-08-21T11:05:55.065Z",
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
  "load": [],
  "inp": [
    {
      "route": "warehouse",
      "interaction": "control",
      "value": null,
      "verdict": "N/A",
      "naReason": "không có entry tương tác"
    },
    {
      "route": "warehouse",
      "interaction": "tab-switch",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: [role=\"tab\"]:not([aria-selected=\"true\"])"
    },
    {
      "route": "warehouse",
      "interaction": "scope-change",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: [data-scope-control] button, [data-scope-control] [role=\"combobox\"]"
    },
    {
      "route": "warehouse",
      "interaction": "table-sort",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: thead th button, thead th [role=\"button\"], thead th[aria-sort]"
    },
    {
      "route": "warehouse",
      "interaction": "search-keystroke",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: input[type=\"search\"], input[role=\"searchbox\"]"
    },
    {
      "route": "warehouse",
      "interaction": "modal-open",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: [data-modal-trigger], [aria-haspopup=\"dialog\"]"
    },
    {
      "route": "warehouse",
      "interaction": "row-action",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: tbody tr button, tbody tr [role=\"button\"], tbody tr a[href]"
    },
    {
      "route": "warehouse",
      "interaction": "sidebar-toggle",
      "value": null,
      "verdict": "N/A",
      "naReason": "selector không khớp: [data-sidebar-toggle], nav button[aria-expanded][aria-controls]"
    }
  ],
  "overflow": [],
  "integrityViolations": [],
  "counts": {
    "loadRows": 0,
    "loadGradable": 0,
    "inpCells": 8,
    "inpValueBearing": 0,
    "overflowRuns": 0,
    "overflowFailing": 0
  }
}
```
