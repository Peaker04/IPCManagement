# Phase 3 Pattern Mapping — Contract, provenance & safety baseline

**Mapped:** 2026-07-16  
**Scope:** Repository analogs only; no source implementation or production data mutation  
**Inputs:** `03-CONTEXT.md`, `03-RESEARCH.md`, milestone `research/SUMMARY.md`, `AGENTS.md`

## 1. Pattern summary

Phase 3 should follow existing repository conventions (net9.0, EF Core/Pomelo, binary(16) IDs, partial entity classes, monolithic `IpcManagementContext`, scoped DI, xUnit/FluentAssertions, PowerShell evidence artifacts) while correcting three current weaknesses:

1. BOM contract/policy is currently private and duplicated inside `SampleDataImportService` and `DishService`; the new contract and invariant types must be internal/public typed records/services that tests can call directly.
2. Import provenance exists in fragments (`Menuversion`, `Quantityimportbatch`, `Auditlog`) but there is no race-safe BOM run idempotency entity or source linkage on `Dishbom`.
3. Release scripts create timestamped evidence, but there is no real baseline checksum runner or backup/restore rehearsal. Those are new deliverables, not extensions of `ReplaceBomCatalog` or `Clean_Legacy_Imported_Bom.sql`.

GitNexus `context DishService` returned an **epistemic lower-bound** because interface/DI calls are not fully resolved, and the index did not resolve the partial `SampleDataImportService`. Treat source inspection and focused tests as authoritative for planning; re-run per-symbol `impact` immediately before implementation edits.

## 2. Typed canonical contract and policy records

### Target role and data flow

```text
workbook metadata/raw cells
  -> canonical contract/policy validation
  -> typed normalized rows with source trace
  -> Phase 4 parser/reconciliation (not EF entities)

manual CRUD DTO
  -> same tier/scope/effective/unit invariants
  -> DishService persistence/versioning
```

Suggested Phase 3 ownership (names may vary, but boundaries should not):

- `Services/Bom/CanonicalBomContract.cs`: contract version, exactly three sheet definitions, required headers, supported tiers.
- `Services/Bom/CanonicalBomModels.cs`: `CanonicalBomRow`, `BomSourceTrace`, technical-unit decision/result, duplicate/collision result.
- `Services/Bom/BomPolicy.cs`: versioned technical-unit aliases and ingredient-level customer overlay key.
- `Services/Bom/IBomInvariantValidator.cs` + implementation: pure tier/scope/date/quantity/unit validation shared by bulk and manual flows.

### Closest analogs and concrete signatures

| Concern | Closest analog | Concrete excerpt/signature | Convention to keep |
| --- | --- | --- | --- |
| Low-level typed XLSX row | `Services/SampleData/XlsxWorkbookReader.cs:369-383` | `internal sealed record XlsxRowData(int RowNumber, IReadOnlyDictionary<string,string> Cells, IReadOnlyDictionary<string,XlsxMergedCellInfo> MergeInfo)` | Internal immutable records; retain source row and merge metadata instead of returning EF entities. |
| Sheet/tier contract | `SampleDataImportService.cs:20-35` | `BomRequiredHeaders`; `PresetBomSheets = [("định lượng suất 25k", 25000m), ...]` | Use ordinal-ignore-case sheet/header matching and explicit supported tiers. Promote these from service-private constants to a versioned policy. |
| Typed source row | `SampleDataImportService.cs:1385-1388` | `private sealed record PresetBomSourceRow(string SheetName, decimal PriceTier, IReadOnlyDictionary<string,string> Row)` | Record shape is correct, but add source row/cell trace and return a normalized model rather than a dictionary. |
| Versioned import plan | `SampleDataImportService.CustomMenu.cs:2005-2040` | `WeeklyMenuImportPlan` owns file name, sheet, requested/effective week, rows scanned/skipped, checksum, warnings and typed items. | Keep parse result state together; prefer immutable constructor properties and explicit result collections. Do not place EF entities in the model. |
| Validation issue DTO | `SampleDataImportDto.cs:52-71` | `Severity`, `Code`, `Message`, `SheetName`, `RowNumber`, `Column`, `Cell`, `Field` | Reuse this location-aware error shape for canonical contract failures/blockers. |
| Duplicate calculation | `SampleDataImportService.cs:1320-1388` | `ValidateAndDeduplicatePresetBomRows(...)`; `CalculateWeightedGrossQty(...)` | Keep deterministic grouping and `DecimalPolicy.RoundQuantity`; change fallback behavior so missing serving basis blocks rather than unweighted-averages. |
| Technical unit mapping | `SampleDataImportService.cs:37-54`, `946-958` | `PresetBomUnitByIngredient`; `ResolvePresetBomUnit(...)` | Keep code/name tuple and case-insensitive alias lookup; add policy version and explicit `Resolved/Ambiguous/Unknown` outcome. |
| Decimal semantics | `Helpers/DecimalPolicy.cs` | `QuantityScale = 6`; `RoundQuantity(... AwayFromZero)` | All normalized quantities and weighted results must use the shared policy. |

### Landmines

- `ResolvePresetBomUnit` currently falls back to `KG` for every unknown ingredient. This directly violates D-03-04; the new policy must return a blocking result, never a silent unit.
- `CalculateWeightedGrossQty` currently averages rows when no positive serving count exists. D-03-03 requires a blocker when weighted dedupe lacks serving basis.
- `ParseGrossQtyPerServing` interprets values `> 5` as grams and `<= 5` as kilograms. This is only a legacy heuristic; do not encode it into the canonical technical-unit contract.
- `SampleDataImportService.ImportAsync` accepts/returns `SourceDirectory` and looks for a hard-coded local filename. Production canonical contracts must use bounded upload/object metadata and must not expose `D:\...` paths.
- Private records and reflection-only tests make the contract hard to share. The project already has `<InternalsVisibleTo Include="IPCManagement.Api.Tests" />`; prefer directly testable `internal` types over reflection.
- Phase 3 defines types/policy and characterization only. The actual pure workbook parser/preview belongs to Phase 4.

## 3. Dependency injection and service ownership

### Closest analog

`backend/src/IPCManagement.Api/DependencyInjection.cs` is the single backend composition root. `Program.cs` calls:

```csharp
builder.Services.AddBackendServices(builder.Configuration);
```

Service registrations use interface-to-implementation scoped bindings, for example:

```csharp
services.AddScoped<IDishService, DishService>();
services.AddScoped<ISampleDataImportService, SampleDataImportService>();
services.AddScoped<IMaterialDemandService, MaterialDemandService>();
```

### Target convention

- Put new registrations in the existing `// Services` section of `AddBackendServices`; do not register ad hoc in `Program.cs`.
- Use `AddScoped<IBomInvariantValidator, BomInvariantValidator>()` initially because it will be consumed by scoped services and may need database-backed unit existence checks later. If Phase 3 keeps the validator strictly immutable/pure, a singleton policy can be justified, but the repository's default is scoped.
- Do not construct the new service with `new` inside `DishService` or `SampleDataImportService`; constructor-inject the interface so both flows genuinely share invariants.
- `XlsxWorkbookReader` is currently instantiated as `private readonly ... = new();`; do not copy this ownership for the canonical parser if it needs independent unit tests and upload limits. Register its interface/service at the composition root in Phase 4.

### Landmines

- Adding only a concrete registration defeats replacement in integration tests and preserves duplicated policy.
- GitNexus reports interface/DI callers as a lower-bound. Impact analysis must cover both interface and concrete symbols before changing constructors.
- No new Excel, ORM, state-management or job-runner dependency is needed.

## 4. EF entity, configuration, and forward migration

### Target role and data flow

```text
BomReconciliationRun (run/provenance aggregate)
  <- optional/required actor User
  <- source hash + contract/policy/effective date + backup ID
  <- unique idempotency key/fingerprint
  <- before/after/action counts + status/timestamps/reason
        |
        +---- Dishbom.SourceRunId / SourceKind
```

Likely changed/generated files:

- `Models/Entities/Bomreconciliationrun.cs` (partial entity, binary ID).
- `Models/Entities/Dishbom.cs` (`SourceRunId`, `SourceKind`, navigation).
- Related navigation owners such as `User.cs`, only if the relationship is modeled bidirectionally.
- `Data/IpcManagementContext.cs` (`DbSet` + fluent configuration).
- A new timestamped forward migration and its `.Designer.cs`.
- `Migrations/IpcManagementContextModelSnapshot.cs`.

### Closest analogs

#### A. `Menuversion`: source fingerprint, lifecycle and counts

`Models/Entities/Menuversion.cs` already models:

```csharp
SourceFileName, SourceChecksum, SourceImportBatch,
CreatedBy, CreatedAt, PublishedBy, PublishedAt, UpdatedAt,
Status, SuccessRowCount, ErrorRowCount, WarningRowCount
```

Its context configuration (`IpcManagementContext.cs:1448-1517`) uses:

- binary(16), fixed-length IDs;
- lower-case table/column names;
- `varchar`/max-length status rather than a C# enum conversion;
- explicit default timestamps/counts;
- composite unique/index definitions;
- `DeleteBehavior.ClientSetNull` for retained ownership relations.

This is the closest aggregate analog for `BomReconciliationRun`.

#### B. `Quantityimportbatch`: import actor and unique batch identity

`Models/Entities/Quantityimportbatch.cs` + context lines 2058-2099 provide:

```csharp
ImportBatchId, BatchCode, SourceCompanyName, SourceType,
ImportedBy, ImportedAt, Status
```

and `HasIndex(e => e.BatchCode, "batchCode").IsUnique()`.

Use the unique-index pattern, but do not use a timestamp batch code alone as idempotency.

#### C. `Dishbom`: effective/tier/scope and non-cascading historical links

`IpcManagementContext.cs:496-571` configures:

```csharp
HasIndex(e => new { e.DishId, e.CustomerId, e.PriceTierAmount,
                    e.EffectiveFrom, e.EffectiveTo }, "ixDishBomTierEffective");
```

with decimal precision `(18,2)` for tier, `(18,6)` for quantity, `(5,2)` for waste, and `SetNull`/`ClientSetNull` instead of cascade deletes. New provenance links must also avoid cascade deletion of run/history.

#### D. Forward migration pattern

`Migrations/20260709103000_AddBomTierWorkflow.cs` is the closest hand-authored forward migration: add columns, create indexes, add FKs with explicit MySQL types, then reverse schema in dependency order in `Down`. `20260702061320_AddImportAuditFields.cs` shows adding import counters and source linkage without rewriting prior migrations.

### Recommended schema conventions

- ID: `byte[]`, `binary(16)`, fixed length, generated with `GuidHelper.NewId()`.
- Hash: SHA-256 uppercase hex (`64` chars) or a bounded binary representation; existing `ComputeFileChecksum` uses `Convert.ToHexString(SHA256.HashData(...))`.
- Status: bounded `varchar` (for example max 24/32), not MySQL `enum`, because lifecycle may gain states in Phase 4/5.
- Counts: explicit non-negative integer columns for required summary/action counts, following `Menuversion`; a JSON/text detail is supplementary, not the only auditable count.
- Idempotency: database-enforced unique fingerprint derived from source hash + contract version + policy version + effective date + scope. Check-then-insert alone is race-prone.
- Source kind: bounded code such as `CANONICAL`, `MANUAL`, `LEGACY_UNKNOWN`; never store a local server path.
- FK from BOM to run: nullable for existing legacy/manual rows; non-cascading (`SetNull` or restrictive policy selected explicitly). Run/audit rows are retained.
- Migration must be a new forward migration. Never edit/delete `20260626043000_SeedTemporaryBomData`, `20260716090000_CleanLegacyPortionData`, or any applied file.

### Landmines

- `IpcManagementContext` is scaffold-like and monolithic. Entity class, `DbSet`, fluent mapping, relationship navigations, migration designer and model snapshot must agree; updating only the entity compiles but does not create schema.
- Some migrations have explicit `[DbContext]`/`[Migration]` attributes and others rely on generated designer metadata. Generate with EF tooling and inspect the produced migration rather than hand-inventing an inconsistent pair.
- MySQL DDL can implicitly commit. Schema migration and future cleanup DML cannot be treated as one rollback transaction.
- A nullable actor would weaken SAFE-04. Prefer required actor for canonical runs; if system actor is allowed, model it explicitly rather than omitting attribution.
- `Menuversion.SourceChecksum` is not unique. Copying it alone does not provide idempotency.
- Avoid cascade from run to BOM and from actor to run; retention requires provenance/history survival.

## 5. Idempotency and audit-run behavior

### Closest analogs

| Capability | Analog | What to reuse | What is missing |
| --- | --- | --- | --- |
| SHA-256 source fingerprint | `SampleDataImportService.CustomMenu.cs:1964-1965` | `Convert.ToHexString(SHA256.HashData(...))` | Current helper reads the entire temp file; Phase 4 upload limits/streaming remain separate. |
| Transactional import | `CommitWeeklyMenuImportAsync` | Parse/validate, begin EF transaction, save, commit, delete temp in `finally`. | No preview token/DB fingerprint/idempotent run. |
| Version run metadata | `Menuversion` | Source checksum/batch, actor, status, counts, timestamps. | No backup ID/reason/policy version/action matrix. |
| Unique import identity | `Quantityimportbatch.BatchCode` | Unique DB index and import actor relationship. | Timestamp/code is not content idempotency. |
| Generic audit trail | `Auditlog` | binary ID, changed actor/time, business area, entity/field, old/new values, reason. | Bulk `DishService` audit currently uses `EntityId = actor` and a formatted string; it is not a first-class run relation. |
| Field-level BOM adjustment | `Bomadjustment` | old/new quantity/waste, reason, actor/time, BOM FK. | Only written when quantity/waste changes and actor parses; does not cover no-op/idempotency or all run actions. |
| Unique sensitive hash | `Refreshtoken` context mapping around 2612 | DB unique index on a hash, not only an application pre-check. | Different domain, but good race-safety pattern. |

### Target behavior

- Create one `BomReconciliationRun` per unique canonical fingerprint/policy/effective/scope contract.
- Persist actor, reason, source hash, contract/policy version, backup ID, status and before/after/action counts as typed fields.
- Add generic `Auditlog` entries pointing to the run ID/entity for human audit, but keep the run entity as the machine-readable source of truth.
- Enforce idempotency with a unique database index. If two requests race, handle the unique constraint by returning the existing completed/in-progress run rather than producing duplicate writes.
- No-op runs must not create BOM versions or `Bomadjustment` rows. Whether a zero-mutation invocation records a run attempt is a policy decision, but it must be distinguishable and counts must remain accurate.

### Landmines

- `DishService.CommitBomImportAsync` builds `BOM-{tier}-{timestamp}` and writes counts into `Auditlog.NewValue`. Do not copy this as the new idempotency mechanism.
- `AddBomAdjustmentIfNeeded` silently skips audit when `userId` is absent/unparseable. Canonical apply must reject missing server-resolved actor instead.
- Do not trust actor/reason/hash/counts supplied by a client; actor comes from authenticated server context, hash/counts from server parsing/classification.
- Phase 3 creates schema/contract and tests only; actual apply semantics are Phase 5.

## 6. Shared BOM invariant validation

### Closest analog

The canonical logic currently lives as private methods/constants in `DishService.cs`:

```csharp
private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];
private static bool MatchesBomCustomerScope(byte[]? left, byte[]? right);
private static bool DateRangesOverlap(DateOnly leftFrom, DateOnly? leftTo,
                                      DateOnly rightFrom, DateOnly? rightTo);
private static decimal NormalizePriceTier(decimal tier);
private Task<bool> HasOverlappingBomLineAsync(..., byte[]? excludeBomId = null);
```

These are used by manual create/update and old preview/import. Manual versioning closes the old published row at `targetEffectiveFrom.AddDays(-1)`, creates a new `Dishbom`, and calls `AddBomAdjustmentIfNeeded`.

### Target split

- Pure value invariants: supported tier, quantity `> 0`, waste bounds, date order, customer-scope equality, overlay identity `(dish, ingredient, unit, tier, customer scope)`, date overlap.
- Database invariant query: whether another published BOM overlaps, excluding the current version.
- Technical-unit policy result: known/ambiguous/unknown plus policy version; never defaults unknown to KG.
- One result/error-code vocabulary consumed by both manual CRUD and bulk preview, so messages may differ at the transport layer but acceptance criteria do not.

### Conventions and landmines

- Use `DecimalPolicy.RoundQuantity/RoundPercent` before comparisons/persistence.
- Preserve inclusive effective intervals: overlap is `leftFrom <= rightTo && rightFrom <= leftTo`, with null end as `DateOnly.MaxValue`.
- Customer overlay is ingredient/unit-level. A customer row overrides only its matching global ingredient/unit key; it does not replace the whole dish BOM.
- The current `ixDishBomTierEffective` omits ingredient and unit, while application overlap checks include both. Do not assume that index itself enforces the invariant; Phase 3 should characterize database/application behavior and plan any supporting index separately.
- `DishService` compares byte-array IDs using both `==` inside EF expressions and `SequenceEqual` for scope. Keep database-translatable expressions in repository/query code and pure equality in the value layer; test against MySQL as well as SQLite.
- Published version edits require reason/actor under CRUD-03, but current methods can accept null reason/user. Characterization tests should capture the current behavior before later tightening it.

## 7. xUnit fixtures and characterization tests

### Closest analogs

#### A. In-memory XLSX fixture

`backend/tests/IPCManagement.Api.Tests/XlsxWorkbookReaderTests.cs` creates a minimal `.xlsx` with `ZipArchive`, explicit workbook relationships, shared strings and worksheet XML, then deletes the temp file in `finally`. This is the preferred fixture pattern for exact sheet/header/row/cell tests without adding a spreadsheet dependency.

Use it to build canonical fixtures for:

- exactly three Vietnamese sheet names;
- missing/renamed sheet and header;
- Unicode/diacritic/case normalization;
- row number/source trace;
- weighted duplicate and missing serving basis;
- all technical-unit aliases plus unknown/ambiguous cases.

#### B. Pure policy tests

`SampleDataImportServiceTests` uses `[Theory]` + `[InlineData]` and FluentAssertions for unit/date/tier behavior. Reuse the table-driven style, but call new internal contract/policy APIs directly.

Do **not** copy `InvokePrivateStatic` reflection. The project grants `InternalsVisibleTo`, so new internal types can be tested without brittle private-method names.

#### C. Relational BOM fixture

`DishCatalogTests.CreateCatalogFixtureAsync` opens SQLite `Data Source=:memory:`, manually creates minimal tables, seeds binary IDs with `GuidHelper.NewId()`, and returns an `IAsyncDisposable` fixture. It already covers:

- price tier separation;
- global/customer BOM;
- published overlap errors;
- manual update creating a new effective version;
- preview errors causing commit all-or-nothing.

Reuse this fixture style for fast invariant characterization, while adding new run/provenance tables/columns to the minimal schema when Phase 3 lands.

#### D. MySQL integration fixture

`Infrastructure/CustomWebApplicationFactory.cs` removes the production `IpcManagementContext` registration and binds Pomelo to `IPC_TEST_CONNECTION_STRING`, explicitly preferring an isolated MySQL/Testcontainers-like database. Use this path for unique-index, binary ID, collation, migration and transaction semantics that SQLite cannot prove.

### Required test layers for Phase 3

- `CanonicalBomContractTests`: three sheets/headers/tier mapping, normalized key/source trace, unit policy version and blockers.
- `BomInvariantValidatorTests`: date interval, tier, quantity, global/customer overlay identity, overlap.
- `DishCatalogCharacterizationTests`: current manual create/version/close and old bulk behavior frozen before extraction.
- `BomReconciliationRunPersistenceTests`: required metadata, unique idempotency constraint, no local path, audit relationship.
- Fresh-to-latest and representative-upgrade-to-latest migration tests on MySQL, plus snapshot/model diff evidence.

### Test landmines

- SQLite manual DDL can drift from MySQL/model snapshot and does not reproduce MySQL enum/collation/implicit-commit semantics. It is a fast test, not migration proof.
- InMemory provider must not be used to prove FK/unique/transaction behavior.
- `UnitTest1.ForceRegisterMigrations` is an anti-pattern: it silently returns when no connection exists, manually inserts migration history, has no meaningful assertion, and can hide unapplied schema. Do not reuse it. Replace proof with actual `Database.Migrate`/`dotnet ef database update` against isolated fresh and upgrade fixtures.
- Tests must not use the operator workbook path as the sole fixture. Keep a deterministic small fixture in test ownership and optionally validate the real workbook separately as development evidence.

## 8. Baseline, repository manifest, release gate, and recovery scripts

### Closest analogs

#### A. Timestamped gate evidence

`scripts/Invoke-Iter1QualityGate.ps1` establishes the repository pattern:

- parameterized `OutputRoot`;
- `$ErrorActionPreference = "Stop"`;
- timestamped run directory;
- one log plus Markdown summary;
- structured result objects with `PASS/FAIL/BLOCKED`, command, evidence and reason;
- non-zero exit when blocked;
- audit-only mode that verifies prerequisites without mutation.

The summary contract in `.artifacts/release-gates/<timestamp>/quality-gate-summary.md` is concise and auditable.

#### B. Migration audit/apply separation

`scripts/Invoke-Iter1MigrationPlan.ps1` resolves required paths, lists latest local migration, redacts connection details in displayed commands, defaults to audit-only behavior, and requires `-Apply` plus connection/config before mutation.

#### C. Destructive target guard

`scripts/Invoke-Iter1SeedMode.ps1` separates `DemoReset` from `ProductionBaseline`, blocks public targets by default, and records mode/URL/audit/dry-run in a timestamped summary. Reuse the explicit mode/target safety concept for restore rehearsal.

### New scripts/artifacts required (no complete analog exists)

- `scripts/Invoke-BomSafetyBaseline.ps1`
  - inputs: environment/connection via secure env or operator parameter, output root, optional compare-to manifest;
  - emits deterministic JSON plus readable Markdown under `.artifacts/bom-safety-baselines/<runId>/`;
  - captures active BOM by tier/scope, overlap, unknown unit, invalid quantity, TMP rows, catalog orphan/reference, stock-bearing ingredients, draft/open dependencies, and immutable-history counts/checksums;
  - returns non-zero on query failure or comparison drift.
- `scripts/Invoke-BomBackupRestoreRehearsal.ps1`
  - requires explicit source and isolated restore target, backup ID/output path, and confirmation that target is non-production;
  - creates identified backup, restores to clone, runs the same baseline script, compares immutable checksums exactly, records elapsed time and cleanup disposition;
  - returns non-zero unless dump, restore and equality all pass.
- A dirty-worktree manifest artifact (script or documented command) under the Phase 3 evidence run containing `git status --short`, `git diff --stat`, untracked paths and expected ownership. It must not reset/stash/checkout.
- Extend the final release gate later to consume these artifacts rather than merely checking that a marker string exists.

### Script conventions and landmines

- Never print or persist raw connection strings/passwords. Store only redacted target identity and backup ID.
- Restore only to an explicitly isolated clone; verify resolved target/database before any drop/create. The existing private-host check is useful but insufficient by itself because a private host can still be production.
- Prefer argument arrays and native PowerShell invocation for credentials/paths. `Invoke-Iter1QualityGate.ps1` uses `cmd.exe /c $Command`; do not copy that string-composition pattern for database commands or secrets.
- Baseline checksum inputs must be stable: explicitly ordered rows, canonical serialization, invariant culture and SHA-256. Avoid database-dependent unordered concatenation.
- Separate schema migration from baseline/backup/restore operations. MySQL DDL is not an atomic rollback boundary with cleanup DML.
- `Down()` is schema rollback only; operational data rollback is restoring the tested backup plus compatible code.
- `Clean_Legacy_Imported_Bom.sql` and `ReplaceBomCatalog` are diagnostic/anti-pattern references, not runners called by any Phase 3 script.

## 9. Target-to-analog checklist for the planner

| Planned target | Role/data flow | Closest analog(s) | Mandatory convention | Stop condition / landmine |
| --- | --- | --- | --- | --- |
| Canonical contract/policy records | Raw workbook metadata -> normalized typed contract | `XlsxRowData`, `PresetBomSourceRow`, `WeeklyMenuImportPlan` | Internal immutable records, source row/cell trace, version fields | Stop if unknown unit or duplicate lacks serving basis; no EF entity output. |
| Shared invariant service | Bulk + manual inputs -> same validation result | `DishService.NormalizePriceTier`, `DateRangesOverlap`, `HasOverlappingBomLineAsync`, `DecimalPolicy` | Pure value checks separated from EF query; inclusive intervals; ingredient/unit overlay | Stop if manual and bulk acceptance rules diverge. |
| DI registration | Consumers -> shared service | `DependencyInjection.AddBackendServices` | Interface/concrete registration in existing service section | Stop if constructed manually or registered only in `Program.cs`. |
| `BomReconciliationRun` entity | Fingerprint/actor/reason/backup/counts/status -> auditable run | `Menuversion`, `Quantityimportbatch` | binary(16), lower-case mapping, bounded strings, explicit counts/timestamps | Stop if idempotency is timestamp-only or source path stored. |
| `Dishbom` provenance | Canonical/manual/legacy row -> source run | `Dishbom` tier/scope/effective mapping | Nullable forward-compatible fields, non-cascading FK, indexed source link | Stop if applied migration edited or run deletion cascades to history. |
| Forward migration/snapshot | Current schema -> provenance schema | `AddBomTierWorkflow`, `AddImportAuditFields` | New migration + designer + snapshot; explicit MySQL types/FKs/indexes | Stop if old migration or `__EFMigrationsHistory` is rewritten. |
| Persistence/idempotency tests | Duplicate/racing fingerprint -> one run | `CustomWebApplicationFactory`, refresh-token unique hash pattern | Isolated MySQL proof for unique/FK/transaction semantics | SQLite-only proof is insufficient. |
| XLSX/policy tests | Fixture workbook -> exact typed/error result | `XlsxWorkbookReaderTests`, theory tests | Minimal ZipArchive fixture, direct internal API calls, FluentAssertions | No reflection private method, no real-path-only fixture. |
| Baseline runner | DB -> counts/checksums JSON+Markdown | `Invoke-Iter1QualityGate.ps1` | Timestamped evidence, PASS/FAIL/BLOCKED, audit/compare mode, non-zero drift | Stop if query/checksum is unordered or missing immutable domains. |
| Backup/restore rehearsal | Source -> backup ID -> isolated clone -> checksum equality | `Invoke-Iter1MigrationPlan.ps1`, seed target guard | Explicit apply/rehearse flag, redaction, isolated target proof, exact comparison | Marker-only backup is failure; no production target cleanup. |
| Dirty-worktree manifest | Current working tree -> ownership evidence | AGENTS.md + existing artifact style | Record status/stat/untracked before edits; preserve unrelated changes | Never reset, checkout, stash or stage unrelated user files. |

## 10. Phase 3 implementation boundaries

Allowed in Phase 3:

- contract/policy/normalized model definitions;
- shared invariant extraction with characterization coverage;
- forward provenance/run schema and persistence tests;
- baseline/dirty-manifest/backup-restore rehearsal tooling and evidence;
- fresh/upgrade migration proof.

Deferred:

- pure canonical parser, upload security and read-only preview/classifier (Phase 4);
- transactional apply, cleanup and downstream regeneration (Phase 5);
- shadcn Admin workbench (Phase 6);
- old endpoint/template/UI retirement (Phase 7).

No Phase 3 task may execute broad BOM deletion, call `ReplaceBomCatalog`, run `Clean_Legacy_Imported_Bom.sql` as production cleanup, rewrite an applied migration, or mutate locked/completed/audit/stock history.

