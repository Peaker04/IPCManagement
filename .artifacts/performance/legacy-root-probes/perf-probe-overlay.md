# Báo cáo đầu đo — 2026-08-21T09:04:47.369Z

```json
{
  "startedAt": "2026-08-21T09:04:47.369Z",
  "baseUrl": "http://127.0.0.1:3037",
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
      "url": "http://127.0.0.1:3037/weekly-menu?mock=huge",
      "notes": [],
      "t0": {
        "t": 8560.5,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#schedule-panel .ipc-table-viewport",
        "anchorSelector": "#schedule-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 430.6875,
        "anchorHeight": 48,
        "clientHeight": 97,
        "scrollHeight": 97,
        "overflowY": "auto",
        "rowsData": 1,
        "rowsSkeleton": 0,
        "rowHeights": [
          48
        ],
        "innerHeight": 900
      },
      "settled": {
        "t": 9977.400000002235,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#schedule-panel .ipc-table-viewport",
        "anchorSelector": "#schedule-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 509.6875,
        "anchorHeight": 48,
        "clientHeight": 97,
        "scrollHeight": 97,
        "overflowY": "auto",
        "rowsData": 1,
        "rowsSkeleton": 0,
        "rowHeights": [
          48
        ],
        "innerHeight": 900
      },
      "rowsDataSettled": 1,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0.0581,
      "clsWindow": 0.0581,
      "clsSources": [
        {
          "value": 0.05735918209876543,
          "startTime": 9077.20000000298,
          "sources": [
            {
              "node": "div.font-sans.text-body.relative",
              "from": {
                "x": 264,
                "y": 324.140625,
                "w": 1140,
                "h": 480
              },
              "to": {
                "x": 264,
                "y": 403.140625,
                "w": 1140,
                "h": 480
              }
            },
            {
              "node": "div.pointer-events-auto",
              "from": {
                "x": 264,
                "y": 218.140625,
                "w": 1140,
                "h": 67
              },
              "to": {
                "x": 264,
                "y": 368.140625,
                "w": 1140,
                "h": 67
              }
            }
          ]
        },
        {
          "value": 0.0007289573889210391,
          "startTime": 9644.900000002235,
          "sources": [
            {
              "node": "div.ipc-command-bar-actions.flex.shrink-0",
              "from": {
                "x": 922.5,
                "y": 90.359375,
                "w": 470.5,
                "h": 36
              },
              "to": {
                "x": 905.0625,
                "y": 90.359375,
                "w": 487.9375,
                "h": 36
              }
            },
            {
              "node": null,
              "from": {
                "x": 266,
                "y": 524.90625,
                "w": 1126,
                "h": 15
              },
              "to": {
                "x": 266,
                "y": 524.90625,
                "w": 1126,
                "h": 15
              }
            },
            {
              "node": "div.ipc-header-context",
              "from": {
                "x": 881.96875,
                "y": 12.796875,
                "w": 532.03125,
                "h": 30
              },
              "to": {
                "x": 864.0625,
                "y": 12.796875,
                "w": 549.9375,
                "h": 30
              }
            },
            {
              "node": "div.flex.shrink-0.items-center",
              "from": {
                "x": 910.359375,
                "y": 230.140625,
                "w": 480.640625,
                "h": 20
              },
              "to": {
                "x": 898.265625,
                "y": 230.140625,
                "w": 492.734375,
                "h": 20
              }
            },
            {
              "node": "span.font-sans.ipc-status-badge.inline-flex",
              "from": {
                "x": 1162.625,
                "y": 414.140625,
                "w": 226.375,
                "h": 27
              },
              "to": {
                "x": 1153.328125,
                "y": 414.140625,
                "w": 235.671875,
                "h": 27
              }
            }
          ]
        },
        {
          "value": 0.000026056737075617283,
          "startTime": 7256,
          "sources": [
            {
              "node": "div.ipc-header-context",
              "from": {
                "x": 885.015625,
                "y": 12.796875,
                "w": 528.984375,
                "h": 30
              },
              "to": {
                "x": 881.96875,
                "y": 12.796875,
                "w": 532.03125,
                "h": 30
              }
            }
          ]
        }
      ],
      "lcp": {
        "startTime": 9092,
        "element": "div.font-sans.text-body",
        "size": 8602
      },
      "deltaTop": 79,
      "cgrDenominator": 900,
      "cgr": 0.0878,
      "growthDenominator": 97,
      "growthRatio": 0,
      "growthFrameSelector": "#schedule-panel .ipc-table-viewport",
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
