# Iter1 Workflow Performance Benchmark

## Command

```powershell
npm run benchmark:workflow
```

## Representative Dataset

- 12 customers.
- 7 service days.
- 12 ingredients in one effective BOM.
- 1,008 generated demand lines.
- 1,008 generated purchase lines.
- SQLite integration database to keep the regression gate deterministic.

## Gates

- Fewer than 120 `SELECT` commands for the complete week.
- Complete demand and purchase generation in less than 10 seconds.
- Output line counts must match the expected 1,008 demand and 1,008 purchase lines.

The query-count gate is the primary LAN safeguard. It detects per-line database
lookups even when a fast local machine hides their latency.

## 2026-07-09 Result

| Version | SELECT count | Elapsed |
| --- | ---: | ---: |
| Baseline per-line lookup | 4,102 | about 3 seconds |
| Batched quotation/supplier/receipt lookup | 91 | 1,048 ms |

The optimized workflow loads quotations, active suppliers, and latest receipt
context in bounded batches before creating purchase lines. Existing quotation
priority, latest active receipt supplier, reference-price fallback, and unit
conversion rules remain covered by the full backend test suite.
