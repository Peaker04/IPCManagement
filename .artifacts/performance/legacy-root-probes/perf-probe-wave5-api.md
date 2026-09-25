# Báo cáo đầu đo — 2026-08-21T08:52:48.091Z

```json
{
  "startedAt": "2026-08-21T08:52:48.091Z",
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
        "t": 8523.099999997765,
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
        "t": 9979.29999999702,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#schedule-panel .ipc-table-viewport",
        "anchorSelector": "#schedule-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 746.6875,
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
      "clsSum": 0.1288,
      "clsWindow": 0.1287,
      "clsSources": [
        {
          "value": 0.09597646604938272,
          "startTime": 9036,
          "sources": [
            {
              "node": "div.font-sans.text-body.relative",
              "from": {
                "x": 264,
                "y": 403.140625,
                "w": 1140,
                "h": 480
              },
              "to": {
                "x": 264,
                "y": 640.140625,
                "w": 1140,
                "h": 259.859375
              }
            },
            {
              "node": "div",
              "from": {
                "x": 264,
                "y": 218.140625,
                "w": 1140,
                "h": 67
              },
              "to": {
                "x": 264,
                "y": 297.140625,
                "w": 1140,
                "h": 67
              }
            },
            {
              "node": "section.ipc-weekly-readiness-strip.flex.h-11",
              "from": {
                "x": 259,
                "y": 293.140625,
                "w": 1150,
                "h": 54
              },
              "to": {
                "x": 259,
                "y": 451.140625,
                "w": 1150,
                "h": 54
              }
            },
            {
              "node": "div.ipc-view-switcher",
              "from": {
                "x": 264,
                "y": 353.140625,
                "w": 1140,
                "h": 38
              },
              "to": {
                "x": 264,
                "y": 511.140625,
                "w": 1140,
                "h": 38
              }
            }
          ]
        },
        {
          "value": 0.03204041280864198,
          "startTime": 8984.099999997765,
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
              "node": "section.ipc-weekly-readiness-strip.flex.h-11",
              "from": {
                "x": 259,
                "y": 214.140625,
                "w": 1150,
                "h": 54
              },
              "to": {
                "x": 259,
                "y": 293.140625,
                "w": 1150,
                "h": 54
              }
            },
            {
              "node": "div.ipc-view-switcher",
              "from": {
                "x": 264,
                "y": 274.140625,
                "w": 1140,
                "h": 38
              },
              "to": {
                "x": 264,
                "y": 353.140625,
                "w": 1140,
                "h": 38
              }
            }
          ]
        },
        {
          "value": 0.0007289573889210391,
          "startTime": 9633.599999997765,
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
                "y": 761.90625,
                "w": 1126,
                "h": 15
              },
              "to": {
                "x": 266,
                "y": 761.90625,
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
                "y": 467.140625,
                "w": 480.640625,
                "h": 20
              },
              "to": {
                "x": 898.265625,
                "y": 467.140625,
                "w": 492.734375,
                "h": 20
              }
            },
            {
              "node": "span.font-sans.ipc-status-badge.inline-flex",
              "from": {
                "x": 1162.625,
                "y": 651.140625,
                "w": 226.375,
                "h": 27
              },
              "to": {
                "x": 1153.328125,
                "y": 651.140625,
                "w": 235.671875,
                "h": 27
              }
            }
          ]
        }
      ],
      "lcp": {
        "startTime": 9060,
        "element": "div.font-sans.text-body",
        "size": 8602
      },
      "deltaTop": 316,
      "cgrDenominator": 900,
      "cgr": 0.3511,
      "growthDenominator": 97,
      "growthRatio": 0,
      "growthFrameSelector": "#schedule-panel .ipc-table-viewport",
      "gradable": true,
      "verdicts": {
        "cgr": "TRUOT",
        "cls": "TRUOT",
        "growth": "DAT"
      }
    },
    {
      "id": "reports-price",
      "route": "reports",
      "tab": "reports-price",
      "url": "http://127.0.0.1:3037/reports?mock=huge",
      "notes": [
        "mốc neo vắng tại t_0",
        "khung cuộn vắng tại t_0",
        "không có dữ liệu: 0 hàng tại t_settled"
      ],
      "t0": {
        "t": 7334.60000000149,
        "scopeFound": true,
        "frameFound": false,
        "frameSelector": "#reports-price-panel .ipc-table-viewport",
        "anchorSelector": "#reports-price-panel tbody tr:first-child",
        "anchorFound": false,
        "anchorTop": null,
        "anchorHeight": null,
        "clientHeight": null,
        "scrollHeight": null,
        "overflowY": null,
        "rowsData": 0,
        "rowsSkeleton": 0,
        "rowHeights": [],
        "innerHeight": 900
      },
      "settled": {
        "t": 8157,
        "scopeFound": true,
        "frameFound": false,
        "frameSelector": "#reports-price-panel .ipc-table-viewport",
        "anchorSelector": "#reports-price-panel tbody tr:first-child",
        "anchorFound": false,
        "anchorTop": null,
        "anchorHeight": null,
        "clientHeight": null,
        "scrollHeight": null,
        "overflowY": null,
        "rowsData": 0,
        "rowsSkeleton": 0,
        "rowHeights": [],
        "innerHeight": 900
      },
      "rowsDataSettled": 0,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0.0027,
      "clsWindow": 0.0027,
      "clsSources": [
        {
          "value": 0.002666923868312757,
          "startTime": 7187.300000000745,
          "sources": [
            {
              "node": "div.ipc-field-row",
              "from": {
                "x": 489,
                "y": 80.59375,
                "w": 208,
                "h": 55.546875
              },
              "to": {
                "x": 529,
                "y": 80.59375,
                "w": 248,
                "h": 55.546875
              }
            },
            {
              "node": "div.ipc-command-bar-actions.flex.shrink-0",
              "from": {
                "x": 1034.875,
                "y": 90.359375,
                "w": 358.125,
                "h": 36
              },
              "to": {
                "x": 1029.15625,
                "y": 90.359375,
                "w": 363.84375,
                "h": 36
              }
            },
            {
              "node": "div.ipc-field-row",
              "from": {
                "x": 705,
                "y": 80.59375,
                "w": 130,
                "h": 55.546875
              },
              "to": {
                "x": 785,
                "y": 80.59375,
                "w": 130,
                "h": 55.546875
              }
            },
            {
              "node": "button#reports-data-quality-tab.ipc-view-tab",
              "from": {
                "x": 1204.25,
                "y": 219.140625,
                "w": 142.421875,
                "h": 36
              },
              "to": {
                "x": 1213.0625,
                "y": 219.140625,
                "w": 143.375,
                "h": 36
              }
            },
            {
              "node": "button#reports-audit-tab.ipc-view-tab",
              "from": {
                "x": 1074.8125,
                "y": 219.140625,
                "w": 129.4375,
                "h": 36
              },
              "to": {
                "x": 1082.75,
                "y": 219.140625,
                "w": 130.3125,
                "h": 36
              }
            }
          ]
        }
      ],
      "lcp": {
        "startTime": 7620,
        "element": "div.font-sans.text-body",
        "size": 10234
      },
      "deltaTop": null,
      "cgr": null,
      "growthDenominator": null,
      "growthRatio": null,
      "gradable": false,
      "verdicts": {
        "cgr": "N/A",
        "cls": "N/A",
        "growth": "N/A"
      }
    },
    {
      "id": "admin-audit",
      "route": "admin-data",
      "tab": "admin-audit",
      "url": "http://127.0.0.1:3037/admin-data?mock=huge",
      "notes": [
        "mốc neo vắng tại t_0",
        "khung cuộn vắng tại t_0",
        "không có dữ liệu: 0 hàng tại t_settled"
      ],
      "t0": {
        "t": 8210.300000000745,
        "scopeFound": true,
        "frameFound": false,
        "frameSelector": "#admin-audit-panel .ipc-table-viewport",
        "anchorSelector": "#admin-audit-panel tbody tr:first-child",
        "anchorFound": false,
        "anchorTop": null,
        "anchorHeight": null,
        "clientHeight": null,
        "scrollHeight": null,
        "overflowY": null,
        "rowsData": 0,
        "rowsSkeleton": 0,
        "rowHeights": [],
        "innerHeight": 900
      },
      "settled": {
        "t": 9099.300000000745,
        "scopeFound": true,
        "frameFound": false,
        "frameSelector": "#admin-audit-panel .ipc-table-viewport",
        "anchorSelector": "#admin-audit-panel tbody tr:first-child",
        "anchorFound": false,
        "anchorTop": null,
        "anchorHeight": null,
        "clientHeight": null,
        "scrollHeight": null,
        "overflowY": null,
        "rowsData": 0,
        "rowsSkeleton": 0,
        "rowHeights": [],
        "innerHeight": 900
      },
      "rowsDataSettled": 0,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0,
      "clsWindow": 0,
      "clsSources": [
        {
          "value": 0.000025444878472222224,
          "startTime": 7217,
          "sources": [
            {
              "node": "div.ipc-header-context",
              "from": {
                "x": 912.765625,
                "y": 12.796875,
                "w": 501.234375,
                "h": 30
              },
              "to": {
                "x": 909.625,
                "y": 12.796875,
                "w": 504.375,
                "h": 30
              }
            }
          ]
        }
      ],
      "lcp": {
        "startTime": 7640,
        "element": "p.text-sm.font-medium.text-slate-700",
        "size": 3604
      },
      "deltaTop": null,
      "cgr": null,
      "growthDenominator": null,
      "growthRatio": null,
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
    "loadRows": 3,
    "loadGradable": 1,
    "inpCells": 0,
    "inpValueBearing": 0,
    "overflowRuns": 0,
    "overflowFailing": 0
  }
}
```
