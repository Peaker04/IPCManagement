# Báo cáo đầu đo — 2026-08-21T10:20:32.608Z

```json
{
  "startedAt": "2026-08-21T10:20:32.608Z",
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
  "inp": [],
  "overflow": [
    {
      "id": "schedule",
      "viewport": "1280x720",
      "scope": "toàn trang",
      "scopeFound": true,
      "pageOverflowX": -10,
      "findings": [
        {
          "kind": "thu gọn",
          "element": "strong.truncate.text-xs.font-bold",
          "text": "Chọn khách hàng để bắt đầu",
          "dx": 21,
          "dy": 0,
          "overflowX": "hidden",
          "overflowY": "hidden"
        },
        {
          "kind": "thu gọn",
          "element": "small.hidden.truncate.text-xs",
          "text": "Chưa xác định phạm vi thực đơn tuần.",
          "dx": 27,
          "dy": 0,
          "overflowX": "hidden",
          "overflowY": "hidden"
        },
        {
          "kind": "có thanh cuộn",
          "element": "div.font-sans.text-body.ipc-table-viewport",
          "text": "Bố cục thực đơn theo file khách hàngBố cục / dòngThứ HaiThứ BaThứ TưThứ NămThứ SáuThứ BảyChưa có dữ liệu thực đơn từ fil",
          "dx": 14,
          "dy": 0,
          "overflowX": "hidden",
          "overflowY": "auto"
        }
      ],
      "verdict": "DAT"
    },
    {
      "id": "schedule",
      "viewport": "1366x768",
      "scope": "toàn trang",
      "scopeFound": true,
      "pageOverflowX": -10,
      "findings": [],
      "verdict": "DAT"
    },
    {
      "id": "schedule",
      "viewport": "1440x900",
      "scope": "toàn trang",
      "scopeFound": true,
      "pageOverflowX": -10,
      "findings": [],
      "verdict": "DAT"
    },
    {
      "id": "schedule",
      "viewport": "1920x1080",
      "scope": "toàn trang",
      "scopeFound": true,
      "pageOverflowX": -10,
      "findings": [],
      "verdict": "DAT"
    }
  ],
  "integrityViolations": [],
  "counts": {
    "loadRows": 0,
    "loadGradable": 0,
    "inpCells": 0,
    "inpValueBearing": 0,
    "overflowRuns": 4,
    "overflowFailing": 0
  }
}
```
