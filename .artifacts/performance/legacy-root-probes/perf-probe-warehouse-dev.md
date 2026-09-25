# Báo cáo đầu đo — 2026-08-21T10:15:58.326Z

```json
{
  "startedAt": "2026-08-21T10:15:58.326Z",
  "baseUrl": "http://127.0.0.1:3020",
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
      "id": "schedule",
      "route": "weekly-menu",
      "tab": "schedule",
      "url": "http://127.0.0.1:3020/weekly-menu?mock=huge",
      "notes": [],
      "error": "page.waitForSelector: Timeout 60000ms exceeded.\nCall log:\n\u001b[2m  - waiting for locator('.ipc-content-shell')\u001b[22m\n",
      "gradable": false,
      "verdicts": {
        "cgr": "N/A",
        "cls": "N/A",
        "growth": "N/A"
      }
    }
  ],
  "inp": [],
  "overflow": [],
  "integrityViolations": [],
  "counts": {
    "loadRows": 1,
    "loadGradable": 0,
    "inpCells": 0,
    "inpValueBearing": 0,
    "overflowRuns": 0,
    "overflowFailing": 0
  }
}
```
