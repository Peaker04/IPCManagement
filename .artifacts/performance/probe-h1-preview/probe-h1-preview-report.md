# Báo cáo đầu đo — 2026-08-20T17:17:39.985Z

```json
{
  "startedAt": "2026-08-20T17:17:39.985Z",
  "baseUrl": "http://127.0.0.1:3048",
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
      "url": "http://127.0.0.1:3048/weekly-menu?mock=huge",
      "notes": [],
      "t0": {
        "t": 8309,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#schedule-panel .ipc-table-viewport",
        "anchorSelector": "#schedule-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 430.6875,
        "clientHeight": 97,
        "scrollHeight": 97,
        "rowsData": 1,
        "rowsSkeleton": 0,
        "innerHeight": 900
      },
      "settled": {
        "t": 9193.699999999255,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#schedule-panel .ipc-table-viewport",
        "anchorSelector": "#schedule-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 430.6875,
        "clientHeight": 97,
        "scrollHeight": 97,
        "rowsData": 1,
        "rowsSkeleton": 0,
        "innerHeight": 900
      },
      "rowsDataSettled": 1,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0,
      "clsWindow": 0,
      "clsSources": [
        {
          "value": 0.000026056737075617283,
          "startTime": 7181.199999999255,
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
        "startTime": 8244,
        "element": "td.p-4.text-center.text-sm",
        "size": 5925
      },
      "deltaTop": 0,
      "cgrDenominator": 900,
      "cgr": 0,
      "growthDenominator": 97,
      "growthRatio": 0,
      "gradable": true,
      "verdicts": {
        "cgr": "DAT",
        "cls": "DAT",
        "growth": "DAT"
      }
    },
    {
      "id": "reports-price",
      "route": "reports",
      "tab": "reports-price",
      "url": "http://127.0.0.1:3048/reports?mock=huge",
      "notes": [
        "mốc neo vắng tại t_0",
        "khung cuộn vắng tại t_0"
      ],
      "t0": {
        "t": 7307.599999997765,
        "scopeFound": true,
        "frameFound": false,
        "frameSelector": "#reports-price-panel .ipc-table-viewport",
        "anchorSelector": "#reports-price-panel tbody tr:first-child",
        "anchorFound": false,
        "anchorTop": null,
        "clientHeight": null,
        "scrollHeight": null,
        "rowsData": 0,
        "rowsSkeleton": 0,
        "innerHeight": 900
      },
      "settled": {
        "t": 8546.699999999255,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#reports-price-panel .ipc-table-viewport",
        "anchorSelector": "#reports-price-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 624.1875,
        "clientHeight": 352,
        "scrollHeight": 352,
        "rowsData": 6,
        "rowsSkeleton": 0,
        "innerHeight": 900
      },
      "rowsDataSettled": 6,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0.0025,
      "clsWindow": 0.0025,
      "clsSources": [
        {
          "value": 0.002526491769547325,
          "startTime": 7088.099999997765,
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
              "node": "div.ipc-command-bar-actions.flex.shrink-0",
              "from": {
                "x": 1124.015625,
                "y": 90.359375,
                "w": 268.984375,
                "h": 36
              },
              "to": {
                "x": 1119.875,
                "y": 90.359375,
                "w": 273.125,
                "h": 36
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
        "startTime": 7696,
        "element": "td",
        "size": 4719
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
      "url": "http://127.0.0.1:3048/admin-data?mock=huge",
      "notes": [
        "mốc neo vắng tại t_0",
        "khung cuộn vắng tại t_0"
      ],
      "t0": {
        "t": 8132.699999999255,
        "scopeFound": true,
        "frameFound": false,
        "frameSelector": "#admin-audit-panel .ipc-table-viewport",
        "anchorSelector": "#admin-audit-panel tbody tr:first-child",
        "anchorFound": false,
        "anchorTop": null,
        "clientHeight": null,
        "scrollHeight": null,
        "rowsData": 0,
        "rowsSkeleton": 0,
        "innerHeight": 900
      },
      "settled": {
        "t": 9720.5,
        "scopeFound": true,
        "frameFound": true,
        "frameSelector": "#admin-audit-panel .ipc-table-viewport",
        "anchorSelector": "#admin-audit-panel tbody tr:first-child",
        "anchorFound": true,
        "anchorTop": 478.1875,
        "clientHeight": 518,
        "scrollHeight": 856,
        "rowsData": 8,
        "rowsSkeleton": 0,
        "innerHeight": 900
      },
      "rowsDataSettled": 8,
      "rowsSkeletonAtT0": 0,
      "clsSum": 0.0007,
      "clsWindow": 0.0007,
      "clsSources": [
        {
          "value": 0.0006803423595036008,
          "startTime": 9712.79999999702,
          "sources": [
            {
              "node": "div.ipc-command-bar-actions.flex.shrink-0",
              "from": {
                "x": 792.625,
                "y": 80.59375,
                "w": 600.375,
                "h": 36
              },
              "to": {
                "x": 775.703125,
                "y": 80.59375,
                "w": 617.296875,
                "h": 36
              }
            },
            {
              "node": "div.ipc-header-context",
              "from": {
                "x": 909.625,
                "y": 12.796875,
                "w": 504.375,
                "h": 30
              },
              "to": {
                "x": 894.515625,
                "y": 12.796875,
                "w": 519.484375,
                "h": 30
              }
            },
            {
              "node": "div.flex.gap-2.items-end",
              "from": {
                "x": 1207.0625,
                "y": 313.09375,
                "w": 182.9375,
                "h": 32
              },
              "to": {
                "x": 1196.921875,
                "y": 313.09375,
                "w": 193.078125,
                "h": 32
              }
            },
            {
              "node": "button#base-ui-_r_8_.group/button.inline-flex.max-w-full",
              "from": {
                "x": 1267.890625,
                "y": 375.59375,
                "w": 135.109375,
                "h": 36
              },
              "to": {
                "x": 1262.03125,
                "y": 375.59375,
                "w": 140.96875,
                "h": 36
              }
            },
            {
              "node": "button#admin-audit-tab.ipc-view-tab.is-active",
              "from": {
                "x": 744.375,
                "y": 199.59375,
                "w": 130.3125,
                "h": 36
              },
              "to": {
                "x": 752.59375,
                "y": 199.59375,
                "w": 132.46875,
                "h": 36
              }
            }
          ]
        },
        {
          "value": 0.000025444878472222224,
          "startTime": 7135.79999999702,
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
        "startTime": 7756,
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
