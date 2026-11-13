# Operations — release, health and recovery

This runbook is not execution authorization or recovery certification. Read [AGENTS](../AGENTS.md), exact script/source guards, immutable lineage and the relevant [domain contract](DOMAIN.md) before any separately authorized action. DEFAULT and MRX records remain separate. Never assume a local database is disposable.

## Release and hosting

Frontend: [vercel.json](../vercel.json) owns Vite workspace build, frontend/dist, SPA rewrites and security headers (CSP/HSTS/nosniff/frame/referrer policy). Confirm current provider Root Directory ./, build/include settings, domain/origins/DNS/region and secret injection before release; repository files and old deployments do not attest account settings.

Backend: [Dockerfile](../Dockerfile), backend project and appsettings environment examples support a direct-host .NET/MySQL deployment; there is no backend GitHub Actions deployment workflow/provider manifest. Backend release requires separately approved host/image/artifact. Runtime is direct-host, not forwarded-header trusting; reverse proxy/TLS termination needs trusted-proxy allowlist, integration/HTTPS/cookie validation before promotion. Frontend uses VITE_API_BASE_URL if API is separate-origin; mock login stays off. [ENGINEERING](ENGINEERING.md) owns setting shapes and local setup.

[verify.yml](../.github/workflows/verify.yml) is quality CI, not deployment authority: main/dev PR/push/manual, root SDK/lockfile, focused/static/build/contract/migration/MySQL and frontend checks. Independent frontend, Linux backend/MySQL and native Windows contract jobs feed the stable `verify` check; failure, cancellation or unexpected skip fails that aggregate. `npm run verify:quick` is shared with local verification and includes conformance. Integration runs separately from core selection; every selected fresh/upgrade migration case must appear once and pass in its TRX. Migration phases and schema comparison remain sequential. Advisory architecture/route budgets do not override fail-closed behavior/security gates. CodeQL is separate and covers main/dev plus its weekly scan. Diagnose the first failure by product/generated/schema/diagnostic category; reproduce the actual manifest/workflow command. Rerun only evidenced infrastructure faults, not deterministic failures; do not inflate baselines/thresholds merely to hide warning.

GitHub main protection now requires `verify`, `Phân tích csharp` and `Phân tích javascript-typescript` from GitHub Actions app15368 with strict up-to-date checks and admin enforcement; PR integration is required. Confirm the live rule and successful same-commit checks before squash merge. Automatic Git deployment is disabled in vercel.json for every branch while MRX qualification remains blocked. This changes repository Git-deployment policy, not Vercel account settings or a running service; no release was performed. Re-enabling deployment requires explicitly approved release scope and verified provider promotion/approval enforcement.

CI artifacts are split into frontend JUnit, backend TRX/schema shapes and native Windows contract TRX, retained seven days. Only selected diagnostics are uploaded; never archive the entire `.artifacts` tree, source DB dumps, customer workbooks or secrets. Compare hosted job durations/cache hits on equivalent commits before claiming performance savings.

### Runtime support upgrade prerequisite

Runtime/SDK/targets and Docker configuration now use .NET10; ASP.NET/test packages10.0.12 and Swashbuckle/CLI10.2.3 are aligned. MySqlConnector2.6.2 addresses GHSA-473q-m89c-ghf8. Development `/swagger/v1/swagger.json` and `/openapi/v1.json` use one Swagger document authority; the duplicate native OpenAPI generator was removed.

EF Core9.0.23/Pomelo9.0.0 are retained for existing migration compatibility. EF9 is out of support from 2026-11-10; upgrading the runtime does not close that dependency support debt. A stable compatible Pomelo EF10 provider is not published; switching to another provider changes migration annotations and SQL generation and requires a reviewed compatibility design plus authorized fresh/populated MySQL qualification. Do not force EF10 onto Pomelo9, rewrite historical migrations, or claim .NET10 proves DB recovery/qualification. See [EF support](https://learn.microsoft.com/en-us/ef/core/what-is-new/) and [provider compatibility](https://github.com/PomeloFoundation/Pomelo.EntityFrameworkCore.MySql#compatibility).

### MRX replica gate

**Current restriction: run one API instance for the full MRX workflow.** Multiple customers do not require multiple instances. The Excel-import preview store (`WeeklyMenuImportPreviewTicketStore`) still uses process-local memory; a preview on A cannot be committed on B, and a restart loses pending previews. Sticky sessions do not solve restarts or failover. Readiness does not check replica topology; this is an operator promotion gate, not an enforced cluster-wide limit.

Quantity-import previews (`ReconciliationQuantityImportService`) use signed, 15-minute tokens with a dedicated audience. Instances must use the same protected `JwtSettings:SecretKey` and issuer, and synchronized clocks. Signature, purpose, expiry, fingerprint, current source, mode, transaction and idempotency checks remain enforced. No sticky session or preview DB migration is needed for this endpoint. An old in-memory quantity-preview token is invalid after upgrading; users must preview again. Coordinate backend replacement and notify users with pending previews; rotating the signing key also invalidates them. Do not expose keys in logs or source control.

Before lifting the one-instance restriction: replace the Excel-import memory ticket authority, prove preview/commit and replay across independently constructed instances, then run authorized load-balancer/failover and MySQL concurrency qualification. Passing unit tests for quantity-import alone does not qualify the whole application for replicas. This change does not alter deployed instance count, hosting settings or database schema.

### CURRENT / TARGET / NEEDS_EVIDENCE promotion

| Level | Evidence and boundary |
|---|---|
| CURRENT | Quality CI and separate CodeQL configuration; Vercel build/SPA configuration disables automatic Git deployment while release qualification is blocked; Docker builds the API for direct hosting. These establish recipes/triggers, not successful recent runs, a live dev/staging/production environment or backend deployment automation |
| TARGET | `CODE → CI → DEV → STAGING → HUMAN APPROVAL → PRODUCTION`; validate the same identified artifact, environment, actor/mode and business-flow acceptance before promotion. Human approval is explicit current authorization, not a branch name or old permission |
| NEEDS_EVIDENCE | Actual provider/project/domain/TLS/origins, environment isolation/data access, immutable artifact identity/retention, CI result, staging and promotion mechanism, approver identity, secrets/private-file exclusion, representative persisted acceptance and rollback rehearsal |

No staging provider/promotion workflow is established in the inspected repository. Repository Git deployment is disabled; no provider promotion or staging authority is established by that setting. Do not invent infrastructure from branch names, package versions or comments. Deployment, migration/seed/restore/delete and auth/mode changes remain separately authorized; passing CI cannot authorize them. After a confirmed release, update [CHANGELOG](../CHANGELOG.md) only for identified release-relevant behavior/security/operational changes under [ENGINEERING](ENGINEERING.md#release-history-ownership); documentation cleanup alone is not an entry.

Rollback: stop promotion, retain failed/prior artifacts; redeploy prior frontend build and backend artifact/image, then verify health/auth and an authorized representative workflow. Schema compatibility is reviewed separately; an older artifact does not authorize migration reversal, data loss or editing migration history. Provider artifact retention/official rollback procedure must be confirmed by operators.

## Health, monitoring and selected targets

- Service window: 05:00–22:00 Asia/Ho_Chi_Minh daily.
- Internal monthly qualification SLO: 99.5% successful eligible requests in that window; no customer/legal SLA implied.
- Watchdog target: /health/live and /health/ready at least each minute; alert after two consecutive ready failures; primary acknowledgement 5 minutes, backup escalation 10 minutes.
- Live answers 200 while process responds; ready maps Healthy/Degraded to 200, Unhealthy to 503. DB unavailable/pending migrations are Unhealthy. Outbox disabled or aged backlog is Degraded; any POISON is Unhealthy. A status-code-only watchdog misses Degraded; inspect the JSON status/checks without inventing another critical threshold.
- Encrypted operational-backup target every <=4 hours, 14-day retention, RPO <=4 hours, RTO <=30 minutes. This short recovery window is separate from the MRX evidence contract: queryable operational MRX history and an encrypted immutable off-host archive must each cover at least five calendar years from archive creation. Quarterly restore drill and after material DB/recovery changes.
- These are targets, **NEEDS_EVIDENCE** until authorized staging/provider drills prove alert delivery, outage handling, independent retention, business oracle and timed encrypted restore.

Program logging owns console/rolling JSONL (`logs/ipc-.jsonl`); retained-file count does not prove elapsed retention. Repository does not establish current production aggregation/uptime/alert dashboard or Sentry/Datadog/New Relic/OpenTelemetry integration. Confirm operators' actual monitoring rather than infer certification.

### Technical and business signals

CURRENT means inspected implementation, not active monitoring. Read-only observation still requires the right actor/target; replay and recovery are mutations, not observation.

| Signal | CURRENT source boundary | TARGET / NEEDS_EVIDENCE |
|---|---|---|
| Health/logs | [Program](../backend/src/IPCManagement.Api/Program.cs) health registrations, correlation/request logging and rolling JSONL; [health writer](../backend/src/IPCManagement.Api/HealthChecks/HealthResponseWriter.cs) returns status/check descriptions/durations | Authorized URL/build check, log access/redaction/central retention, actual watchdog and alert-delivery/on-call incident rehearsal. No deployed dashboard established |
| Latency/errors/timeouts/resources | Request timing and health durations implemented; k6 diagnostic checks exist | Measured p95/p99/error/timeout rate, CPU/RAM saturation, host limits, DB pool usage/wait/connections and alert thresholds/retention. DB readiness is not capacity proof; no metrics exporter/resource dashboard established in inspected runtime owners |
| Jobs/outbox | [health check](../backend/src/IPCManagement.Api/HealthChecks/LifecycleOutboxHealthCheck.cs) computes pending/processing/failed/poison and oldest age internally; ordering/leases/retries/consumer receipts implemented | Public health JSON **omits entry.Data**, so it is not a count/age metrics endpoint. Confirm effective worker settings/processing and authorized Admin inspection. Current payload-validation consumer proves no external notification delivery |
| Replay/idempotency | Admin FAILED/POISON replay requires actor/reason and appends audit; transaction runner verifies uncertain commit against caller-specific DB predicate | Approved replay scope and business-state/replay oracle; no blanket exactly-once guarantee or fleet reconciliation metric inferred |
| Approval/stock/source readiness | Approval target/assignment/actor guards, warehouse identity resolver, source-line/ledger and DEFAULT/MRX daily readiness logic exist | Authorized pending/stuck approval observation and exact request-line/stock/movement/net-ledger oracle. These are business diagnostic candidates, not deployed health alerts; one ready date/warehouse is not whole-week stock integrity |
| Backup/restore/rollback | Script/adapter guards and limited comparator below; rollback procedure is conditional | Actual approved provider/adapter, independent immutable off-host retention/key recovery, artifact retention and timed business-oracle drill proving RPO/RTO. No scheduler or real drill qualification established |

Choose signals against the affected [flow](FLOWS.md) and keep technical health separate from business completion. Incidents/user feedback return to fresh WORK intake; owner-approved outcome changes route to ROADMAP, release history to CHANGELOG, stable corrections to their existing owner. Do not create a second incident/task-memory framework.

## Before database mutation

1. Confirm exact target/database identity, source checkout, mode, current migration lineage/schema and authorization; script switches/force are not permission.
2. Preserve independently recoverable backup and immutable pre-state rows/IDs/FKs/ledger/schema integrity. Rehearse first on an approved disposable target.
3. Review exact SQL/bundle, pre/post checks, rollback and loss acceptance. SQL USE can override CLI target; inspect destructive statements and temporary-table charset/collation.
4. Stop on ambiguous provenance; nullable lineage/source FK existence does not prove ingredient/unit/customer compatibility. No name/header/first-candidate mapping or invented source evidence.
5. Apply only reviewed scope; never clone/restore an entire rehearsal DB over production as promotion.

Tools: [database utilities](../tools/db/), [immutable migration lineage](../tools/db/migration-lineage.json), [backend database tool](../backend/tools/IPCManagement.DatabaseTool/), [encrypted recovery script](../scripts/database-recovery/Invoke-DatabaseRecovery.ps1). Historically named exact-target/hash SQL and schema in tools/db/phase-04.2 are retained technical safety contracts, not task state. Stock movements/balance chains cannot be reconstructed from UI projections/master data.

### Main-database forward migration cutover

Repository/model parity and disposable migration success do not certify the main schema. Before cutover, inspect exact server UUID/host/port/database and runtime target/build, the complete ordered migration history, and actual affected columns/types/precision/nullability/defaults, generated expressions, indexes, FK columns/actions and checks. History/schema disagreement stops execution; never insert synthetic history rows or choose a historical winner automatically.

Generate and review only the explicit applied-head-to-target-head forward SQL in private storage; bind its SHA-256 to a separately approved cutover packet. Require a fresh encrypted/hash-verified no-prune backup, snapshot-bound schema/data/ledger comparisons and actual recovery into an explicitly authorized absent restore target. Existing ZIP/mirror or clone G1 is not this recovery proof. Confirm private destination/key reference and writer-maintenance scope; do not put keys or dumps in Git.

**STOP for final Owner confirmation** naming exact identity, build, range/SQL hash, backup/recovery proof and confirmed writers/window before either main writes or writer shutdown. Once confirmed, quiesce only those writers, recheck drift and bind the final backup to that cutover pre-state. Apply only the approved forward range; never startup auto-migrate, seed/reset, downgrade or promote a clone over main. MySQL DDL can partially commit despite transaction markers: on failure keep writers stopped, inspect actual history/schema and obtain reviewed forward recovery; no blind rerun, Down or automatic restore. Postflight verifies actual schema/history and preserved row IDs/data/stock/lot/lifecycle invariants before resuming the confirmed writers and checking readiness/non-mutating reloads. Report repository, clone, main and immutable-provider verdicts separately.

### Migration safeguards

- IDs immutable. Handwritten EF migration needs Designer or inline Migration attribute; absent metadata omits EF discovery. Do not migrations-remove against missing final metadata: snapshot can collapse and later migrations recreate schema.
- Compare every owned schema change before baseline claims. No-op retired seed names do not authorize mutation.
- Clone fidelity needs SHOW CREATE TABLE, FK, trigger and history comparison; CREATE TABLE LIKE plus counts is insufficient.
- Startup never auto-activates warehouse/repairs data or migrates from multiple API instances; pending migration/DB failures are readiness failures.
- Durable lifecycle/outbox/idempotency evidence is append-only; destructive down is not recovery. Use forward recovery/compensating commands.
- Legacy nullable provenance only through reviewed proposal → different actor → approved apply, exact source/unit recheck, no stock rewrite.
- Open supplemental uniqueness uses nullable generated key/named fence; terminal history remains. Duplicate groups need disposition, not winner selection/upsert. Exact-target concurrency probes are separately authorized.

### Operational warehouse activation

Migration 20260824161853_EnforceSingleOperationalWarehouse adds FALSE-default IsOperationalActive, generated nullable OperationalSingletonKey and unique at-most-one fence; it does not choose/activate a warehouse. Automated execution stops before migration/data application unless separately approved.

Capture target/lineage, all warehouse ID/code/flags and per-FK-table/current-stock/lot/snapshot/movement counts/checksums. Resolver normally needs exactly one active row without pinning; if explicitly pinning, require an existing byte-exact 16-byte ID matching active. Use application GuidHelper/new Guid(bytes) representation, not incompatible BIN_TO_UUID byte order. Never choose by label/order/First, create, merge or reassign warehouses.

Operator-opened transaction: lock relevant rows, verify zero active and intended ID exists once, activate only that row. Before commit verify exactly-one/configured-byte-match, key=1 only there, inactive keys NULL, all IDs/FK/stock/history counts/checksums unchanged. Mismatch/unique error → ROLLBACK, never try another ID/repair/consolidate. After explicitly confirmed commit start observation-only resolver; zero/multiple/missing/mismatch fail closed. Activation rollback is separately authorized transaction returning only that row FALSE and verifying zero active/pre-state history. Schema/deploy rollback is separate.

## MRX disposable MySQL evidence rehearsal

[`Invoke-MrxDisposableEvidence.ps1`](../scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1) is the single lifecycle owner for the approved full-clone rehearsal. `Preflight` validates the exact `ipcmanagement` source, absent run-owned `ipc_mrx_evidence_<run-id>` target, credential-safe MySQL defaults file and tool availability without database mutation. `Execute` takes a consistent full dump, restores only into the absent target, applies the migration chain, uses a separate run-owned subordinate schema for mutation-owning integration tests, captures seven read-only MySQL query plans, runs G1 in prepared-database mode, checks source migration/schema identity, and attempts exact target/subordinate/listener/temp cleanup independently in `finally`. The typed-audit plan is generated from the real EF `MrxAuditScopeQuery` during the run; a shortened handwritten audit query is not acceptable plan evidence.

Set `IPC_MRX_SOURCE_CONNECTION_STRING` only in the operator process environment; never put it on the command line or in evidence. Playwright prepared mode requires matching `MRX_E2E_DATABASE`, `MRX_EVIDENCE_RUN_ID`, `IPC_MRX_MYSQL_DEFAULTS_FILE` and `IPC_MRX_TARGET_CONNECTION_STRING`; Playwright must not clone or drop that database. A pre-existing/mismatched target, incomplete plan set, failed G1 persisted-provision assertion, or source identity change is FAIL. Any cleanup error is `BLOCKED_CLEANUP` even if preceding gates passed. An index is permitted only after a captured representative plan proves an unbounded retained-history scan; otherwise record `NOT_NEEDED` and create no migration. Ignored `.artifacts/mrx-evidence/<run-id>/` is bounded runtime evidence, not task state or provider archive proof.

## Local dump/restore and PITR

[Backup-Database.ps1](../tools/db/Backup-Database.ps1) uses single-transaction/routines/triggers/events/GTID-purged-OFF. Require final dump-completed marker; manifest counts derive from the same dump snapshot, not racy live queries. Extended INSERT parsing preserves escaped strings/tuple boundaries. Partial dumps are invalid. ZIP/manifest is **unencrypted** and privacy-sensitive. Different-volume hash-verified mirror is not offsite/independent-physical-disk proof. Use least-privilege identity; Scheduler credentials/session and restore rehearsal need operator evidence.

[Restore-Database.ps1](../tools/db/Restore-Database.ps1) verifies SQL hash and manifest table/ledger/migration counts; manifest-less archive requires independent full comparison. Restore into a new approved temporary target first. Extra schema objects may survive table-based restore; command success is not exact fidelity. Production replacement requires loss acceptance, full schema/row/FK/trigger/ledger oracle and exact authorization, not manual DROP to evade comparison.

PITR preserves original binlogs before intervention. Recovery coordinate is from dump contents/real transaction positions, not file creation or CREATE DATABASE time; idle binlog proves nothing. GTID-enabled standalone rehearsal may require reviewed mysqlbinlog --skip-gtids to prevent silently skipped events. --rewrite-db precedes --database filtering; filter rewritten target. Start position binds first file, stop last. Inspect replay for unrevised protected/production targets and GTID directives before applying. Compare unaffected tables to independent incident pre-state. Enabling binlog/server restart/replay is not cleanup. GTID-purged-OFF standalone restore is not replica bootstrap.

After direct restore clear/restart catalog/BOM cache (potentially thirty minutes), invalidate client cache/refetch before comparing. Never erase committed audit/stock/document history. Same-host ciphertext/mirror does not prove independent off-host immutable recovery. Backup tables/evidence-only subjects need explicit retention/business disposition, not documentation deletion.

## Encrypted provider recovery

Invoke-DatabaseRecovery.ps1 fails closed without real credentials and approved external provider adapter. Adapter implements Upload-ProviderObjectVersion, Read-ProviderObjectMetadata and Download-ProviderObjectVersion using official provider API/CLI. Local directories/archives or hand-entered receipt strings are not offsite proof. Read parameter definitions at source; docs do not duplicate shell command implementations or supply credentials. The runner restricts the temporary MySQL defaults file to the run owner and sends the 7-Zip archive password through redirected standard input; neither database nor archive credentials may appear in process arguments or evidence.

Backup encrypts dump and manifest including headers before upload; the provider receipt must bind the archive publication timestamp and prove `retainUntilUtc >= archiveCreatedAtUtc.AddYears(5)`. Live metadata must match archive creation, exact retention and lock fields before a restore database can be created. RestoreDrill downloads the exact receipt/object version into run-owned temporary storage and validates archive/inner manifest; its result records provider object identity, creation/retention, lock state, download request identity and restored-target MRX summary. Runtime qualification remains NEEDS_EVIDENCE. Only newly absent ipc_restore_* target is allowed. Existing databases, ipcmanagement, ipc_lane1, ipc_lane9 and templates are forbidden; teardown is optional authorized scope. Seven dated backup_* tables remain blocked pending real provider restore and business/rehearsal gates.

**CURRENT comparator scope:** [RestoreOracle](../scripts/database-recovery/RestoreOracle.ps1) compares migration IDs/head, table name/engine/collation, FK table/constraint/referenced-table metadata, trigger definitions, row counts, CHECKSUM TABLE results and hash of the supplied external DCR closure file. It additionally compares a bounded restored-target MRX count/identity-digest summary for batches, daily lines, contributors, source revisions/deltas, linked issues/movements, dispositions and typed MRX audits. This MRX summary is not a second ledger and does not claim semantic equivalence beyond those fields. The comparator still does **not** compare full column/index/default/generated/check semantics or FK columns/actions, and the external-file hash is not a recomputed restored business oracle. The provider-script manifest is collected after dump, not bound to its snapshot. GTID/binlog fields are checked for presence, not meaningful snapshot-bound provenance or restored-target equivalence.

Comparator success/RESTORE_VERIFIED does not certify full schema/business fidelity, dump snapshot time/coordinate, meaningful binlog provenance, operator duration/RPO/RTO or provider/off-host recovery. An authorized runtime drill with independent schema/ledger/business/snapshot/provider/timing oracles remains required; do not silently expand the comparator or bypass its guards. Keys, dumps and closure receipts stay outside Git.

Retained PurchaseHistoryReconciliationService has a fail-closed reader of legacy protected safety evidence. Missing evidence is not permission to reconstruct proof or execute the guarded operation. Parameterized DB runbook validators can have external callers; absence of a fixed in-repo caller never makes their private inputs disposable.

## Performance operations

Method and browser measurement: [ENGINEERING](ENGINEERING.md). Tool-local contract: [performance runbook](../tools/perf/RUNBOOK.md). k6 requires authorized URL/credentials, release build and approved dataset; no account creation/seed implied. SQL diagnostics can change server-global settings and need target/admin approval plus restoration plan. Smoke before load; 429 is rate-limit evidence, not successful throughput; never disable security or change limits to manufacture PASS. Unique ignored outputs are not permanent memory or certification. Single-identity read-only probes cannot prove multi-user/write/import correctness, p99, stock integrity, RPO/RTO or achieved production SLOs.
