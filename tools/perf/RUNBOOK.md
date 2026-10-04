# Performance tools

Method/measurement owner: [TESTING](../../docs/TESTING.md); production targets: [DEPLOYMENT](../../docs/DEPLOYMENT.md). Historical result files do not certify current performance.

- `k6/`: authenticated HTTP smoke/load/stress and read-only throughput probes. Supply actual authorized `BASE_URL`, `K6_USERNAME`, `K6_PASSWORD` privately, not in source/reports. Release build and a known approved dataset are required. No seed/account creation is implied.
- `sql/`: diagnostic SQL. Enable/disable scripts can change server-global settings; exact target/admin authorization and restoration plan are mandatory. Do not run them for repository cleanup.
- Run smoke before load, then diagnose measured latency/queries. A 429 is rate-limit evidence, not successful throughput; changing rate limits requires separate authorization and must be reported. Never disable product security to create PASS.
- Read-only single-identity throughput does not prove 50 authenticated users, 20 active workers, 80/20 read/write or multi-user write/import correctness, p99, RPO/RTO or zero duplicate stock effects. Qualification needs aligned source/build/mode, achieved load, cold/warm separation, error/timeout rates, class metrics and business invariants.
- Store results in unique ignored output. Run only an explicitly scoped probe, avoid stopping user processes and do not promote DEV measurements to production guarantees.

Diagnostic budgets for review (not measured SLOs): list p95 <800ms, search <500ms, grouped list <1s, report <3s and individual query <1s. Index/query-plan decisions require current `EXPLAIN` and timing evidence, not old hotspot lists.
