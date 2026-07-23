# Phase 4 Pattern Mapping — Canonical parser, preview & dependency classifier

**Mapped:** 2026-07-16  
**Scope:** Exact repository analogs and implementation boundaries; no source edit or runtime mutation  
**Inputs:** `04-CONTEXT.md`, `04-RESEARCH.md`, milestone `research/SUMMARY.md`, Phase 3 plans/patterns, `04-VALIDATION.md`, `AGENTS.md`

## 1. Mapping status and provenance

GitNexus index `IPCManagement` is up to date at commit `a342945`. Its concept queries returned only weak process matches for BOM preview/XLSX/data-quality because the index does not resolve several large/private/partial symbols (`XlsxWorkbookReader`, `BuildBomImportPreviewAsync`, `GetDataQualityAsync`, `CleanupDataQualityAsync`, `ClearCatalogCache`). `context CurrentUserService` and `context AddBackendServices` were exact. Treat GitNexus results as an epistemic lower-bound; the line-level source and test excerpts below are authoritative for Phase 4 planning. Re-run required upstream `impact` on each exact symbol immediately before implementation edits.

### Existing now versus planned later

| Status | Artifact/symbol | Meaning for Phase 4 |
| --- | --- | --- |
| **EXISTING** | `Services/SampleData/XlsxWorkbookReader.cs` | Reusable low-level OpenXML ZIP/XML ideas, but currently path-based and unbounded. |
| **EXISTING** | `DishService.PreviewBomImportAsync` / `BuildBomImportPreviewAsync` / `ParseBomImportRowsAsync` | Closest read-only preview/query analog for the old flat `BOM` contract. Do not extend it into the canonical parser. |
| **EXISTING** | `DishesController` multipart actions, `AdminEmployeesController` authorization, `ICurrentUserService` | Transport/auth/actor conventions to combine in a new Admin-only controller. |
| **EXISTING** | `WorkflowReportService.GetDataQualityAsync` and `CleanupDataQualityAsync` | Dependency-query and dry-run/action-shape analogs only. They mix policy/query/mutation and are not the target classifier boundary. |
| **EXISTING** | `ApiResponse`, `ApiResponseModelStateFactory`, weekly-menu validation DTOs | Existing response envelope and location-aware issue vocabulary. |
| **EXISTING** | `IMemoryCache` catalog cache, `DependencyInjection.AddBackendServices` | Existing cache and scoped service composition conventions. |
| **EXISTING** | SQLite relational fixtures, `CustomWebApplicationFactory`, one authenticated E2E flow | Test infrastructure analogs; there is no current multipart abuse/auth matrix or preview checksum-purity test. |
| **PHASE 3 PLANNED, NOT SOURCE YET** | `CanonicalBomContract`, `CanonicalBomModels`, `BomPolicy`, `IBomInvariantValidator`, `BomReconciliationRunContract`, `Bomreconciliationrun`, `Dishbom.SourceRunId/SourceKind`, `03-LIFECYCLE-POLICY.md` | Phase 4 must depend on these outputs after Gate A. As of mapping, all checked production paths are absent and `03-LIFECYCLE-POLICY.md` is not created. Do not declare or duplicate them as existing. |
| **PHASE 4 TO CREATE** | `IPresetBomWorkbookParser`, `PresetBomWorkbookParser`, bounded workbook input/reader ownership, canonical preview DTOs/controller, `IBomCatalogReconciliationService` preview implementation, `IBomLegacyCleanupClassifier`, manifest store/fingerprint helper and focused tests | These are new artifacts. No apply mutation, cleanup DML, frontend RTK/UI or legacy retirement belongs here. |

The Phase 4 executor must stop if final Phase 3 Gate A is not PASS or the Phase 3 contract/policy/provenance artifacts differ from the assumptions in the Phase 3 plans.

## 2. XLSX reader and source-trace pattern

### Exact existing analogs

`XlsxWorkbookReader.ReadRowsWithMetadata` (`XlsxWorkbookReader.cs:80-115`) already carries the essential physical trace:

```csharp
return rows
    .Select(row => new XlsxRowData(
        row.RowNumber,
        row.Cells,
        mergeInfo
            .Where(item => item.Key.Row == row.RowNumber)
            .ToDictionary(item => item.Key.Column, item => item.Value,
                StringComparer.OrdinalIgnoreCase)))
    .ToList();
```

The immutable records at lines 371-381 preserve `RowNumber`, column-keyed cells and merged-cell origin/span. `ReadRow` at lines 185-223 derives the real row number from the worksheet `r` attribute, maps A/B/C columns, and supports shared strings, inline strings and scalar values. `ResolveSheetPath` at lines 149-182 resolves workbook relationship targets and sheet names case-insensitively. `ReadTable` at lines 37-67 finds a header row by all required headers, maps physical columns to logical header names, and trims cell values.

`XlsxWorkbookReaderTests.cs:66-148` builds a deterministic minimal XLSX via `ZipArchive` and exact XML parts. This is the correct fixture ownership pattern: small repo fixture, no operator drive path, no new Excel package. The assertions at lines 10-55 prove detected header mapping, Unicode values, sheet enumeration and physical column values.

`DishService.ReadBomImportWorkbookRows` (`DishService.cs:1288-1333`) shows how old preview maps metadata rows after a detected header and retains `row.RowNumber` in `BomImportSourceRow`. It is useful as a trace-mapping example, not as the new parser.

### Target Phase 4 adaptation

```text
bounded upload copy/hash
  -> bounded XLSX package reader
  -> physical sheet/row/column/cell records
  -> IPresetBomWorkbookParser (pure contract/normalize/dedupe)
  -> CanonicalBomRow + structured issues with BomSourceTrace
```

- Keep physical `sheet + row + column/cell` before header normalization. A canonical issue must not lose the original address when it attaches a logical field name.
- Preserve deterministic workbook order: canonical sheet order from Phase 3 contract, then physical row, then stable reconciliation key. Do not depend on ZIP entry order or dictionary enumeration.
- Make the parser accept a bounded stream/object, never a local filename. The Development sample orchestrator may create the bounded object internally, but the production API must not expose `SourceDirectory` or `D:\...`.
- Keep parser output free of EF entities. Database identity resolution and dependency lookup belong to reconciliation/classifier services.

### Reader landmines that must not be copied unchanged

- `XlsxWorkbookReader` opens a filesystem path with `ZipFile.OpenRead` and calls `XDocument.Load`; it has no byte, ZIP-entry, uncompressed-size, XML-node, shared-string, sheet, row or cell limit.
- `ReadSharedStrings` at lines 133-146 materializes every shared string. `ReadRowsWithMetadata` materializes every worksheet row before applying `maxRows`; `maxRows` therefore is not a resource bound.
- `ResolveSheetPath` normalizes a relationship target but does not reject external relationships, traversal/absolute targets or unexpected package parts.
- Old `DishService.ReadBomImportSourceRowsAsync` (`1233-1249`) copies the entire request to a `MemoryStream`/byte array and treats any `PK` prefix as XLSX. `ReadBomImportWorkbookRows` then writes all bytes to a temp file. Renamed/corrupt ZIP input and compressed amplification are not bounded.
- `SampleDataImportService.CustomMenu.ComputeFileChecksum` (`1964-1965`) calls `File.ReadAllBytes`; it is a hash analog, not a bounded upload implementation.
- `XlsxWorkbookReaderTests` currently has no malicious ZIP/XML/external relationship/cancellation coverage. Phase 4 must add those fixtures rather than interpreting the current tests as security proof.

## 3. Multipart upload, Admin authorization and server actor

### Exact existing analogs

Old BOM multipart preview (`DishesController.cs:85-102`) uses:

```csharp
[HttpPost("bom-import/preview")]
[Consumes("multipart/form-data")]
public async Task<IActionResult> PreviewBomImport(
    [FromForm] BomImportPreviewRequestDto request,
    [FromForm] IFormFile file,
    CancellationToken cancellationToken)
{
    if (file.Length == 0)
        return BadRequest(ApiResponse.FailResult("File import BOM trống."));

    await using var stream = file.OpenReadStream();
    var result = await _service.PreviewBomImportAsync(stream, request, cancellationToken);
    return Ok(ApiResponse<BomImportPreviewDto>.SuccessResult(result));
}
```

Weekly-menu preview (`CoordinationController.cs:340-378`) adds the repository's established `try`/`catch` mapping of `InvalidOperationException` and `ArgumentException` to a safe `ApiResponse` 400, passes `file.FileName` only as metadata, and forwards cancellation.

Admin boundary is exact in `AdminEmployeesController.cs:12-16`:

```csharp
[Route("api/admin/employees")]
[Authorize(Policy = AuthorizationPolicies.AdminAccess)]
[EnableRateLimiting("api-general")]
```

`Program.cs:96-100` defines `AdminAccess` as authenticated + `RequireRole(AuthorizationPolicies.AdminRoles)`. This is stronger and correct for canonical preview; the existing `DishesController` only has `CatalogAccess` and `WorkflowReportsController` only `[Authorize]`.

Server actor convention is `ICurrentUserService.GetUserId(ClaimsPrincipal)` (`ICurrentUserService.cs:5-10`) and `CurrentUserService.cs:8-10`, which reads `ClaimTypes.NameIdentifier` then JWT `sub`. `DishesController.CommitBomImport` lines 118-120 and `WorkflowReportsController.CleanupDataQuality` lines 175-181 demonstrate resolving actor from `User` and passing it down rather than accepting an actor field.

### Target controller convention

- Create a thin `api/admin/...` canonical BOM controller with class/action `AdminAccess`, `api-general` rate limit, `[Consumes("multipart/form-data")]`, explicit response types and cancellation.
- Bind only the workbook, caller-selected effective date and allowed preview policy inputs. Never bind actor, filesystem path, candidate IDs, action counts, hash or DB fingerprint from the client.
- Resolve actor server-side and reject a missing/unparseable actor before service invocation. Admin role alone does not make a missing actor auditable.
- Validate `file is not null`, `Length > 0`, declared maximum length and allowed media/extension as early rejection only; the bounded reader must still validate package content and uncompressed limits.
- Convert expected contract/security failures to structured 400/413/415 responses without exception stack, temp path, package path or server path. Cancellation should remain cancellation, not be reported as a parse blocker.

### Security gaps/new work

There is no repository `RequestSizeLimit`, `MultipartBodyLengthLimit`, `MaxRequestBodySize` or bounded stream helper. Phase 4 must create/configure this deliberately. The only current IFormFile paths check empty files. There is also no multipart API test covering unauthenticated, non-Admin, oversized, corrupt/renamed ZIP, external relationship, too many sheets/rows/cells/shared strings, cancellation or path leakage.

## 4. DTO validation and structured issue vocabulary

### Existing conventions to reuse

The common envelope (`Helpers/ApiResponse.cs:6-17,23-33`) is:

```csharp
public bool Success { get; set; }
public string Message { get; set; } = string.Empty;
public T? Data { get; set; }
public object? Errors { get; set; }
```

`ApiResponseModelStateFactory.cs:7-21` converts DataAnnotations model-state errors to a field-keyed dictionary inside `ApiResponse.FailResult`; `Program.cs:145-148` installs it globally. Existing request DTOs use `[Required]`, `[Range]`, `[MaxLength]` (for example `DishDto.cs:177-233`). Use these for simple transport bounds such as effective date/reason length, but not for workbook semantic validation.

The best structured workbook issue analog is `WeeklyMenuImportValidationIssueDto` (`SampleDataImportDto.cs:61-71`):

```csharp
Severity, Code, Message,
SheetName, RowNumber, Column, Cell, Field
```

Its container (`52-59`) exposes `IsValid`, `HasCriticalErrors`, counts and issues. `WeeklyMenuImportRowDto` (`91-108`) separately preserves source row/column/section and parsed identity. This split maps directly to canonical normalized rows plus structured issues.

Old `BomImportPreviewRowDto` (`DishDto.cs:281-297`) has row action/errors/warnings, while `BomImportPreviewDto` (`266-279`) has counts and `CanCommit`. Reuse the concept of whole-dataset counts plus row details, not the old flat-contract DTO or free-form-only `List<string>` errors.

`DataQualityIssueDto` (`WorkflowReportDto.cs:298-319`) and `BuildDataQualityIssue` (`WorkflowReportService.cs:2624-2648`) provide stable issue IDs, category, severity, entity identity, message and suggested action. `DataQualityCleanupActionDto` (`382-390`) provides entity/action/reason shape. Canonical preview should add typed action enum/code, reason/blocker codes and source trace, while keeping display messages as supplementary fields.

### Target DTO rules

- Stable machine codes are authoritative; Vietnamese messages are display text. Do not make future apply depend on message parsing.
- Separate parse issues from reconciliation actions/blockers. A source cell problem has source trace; a dependency blocker has entity type/id/code and reference evidence; an action has action code/reason and immutable-history flag.
- Manifest summary counts must cover the entire dataset and explicit buckets: `keep`, `create/version`, `archive`, `deactivate`, `regenerate`, `delete`, `block`, plus history kept and parse errors. Do not use UI/search filters or query `limit` to change totals.
- Missing sheet/header, unsupported tier, invalid quantity, identity collision and ambiguous/unknown unit are blocking codes. Unknown dependency/lifecycle/stock evidence maps to `block`, never an omitted row.

## 5. Read-only preview and EF query patterns

### Closest existing preview

`DishService.PreviewBomImportAsync` (`412-416`) only delegates to `BuildBomImportPreviewAsync`. The builder (`917-1007`) parses, detects duplicate/overlap rows, creates DTOs and returns aggregate counts. Database reconciliation inside `ParseBomImportRowsAsync` uses only `AsNoTracking` projections:

- active dishes: `1022-1025`;
- ingredients + unit: `1026-1042`;
- warehouse existence: `1046-1048`;
- units: `1049-1051`;
- existing BOM in exact tier/customer scope: `1052-1056`.

No `SaveChangesAsync`, `Add`, `Remove` or transaction occurs on that preview path. `GetBomValidationAsync` and `WorkflowReportService.GetDataQualityAsync` likewise demonstrate composing multiple `AsNoTracking` dependency queries before building issue DTOs.

`DishCatalogTests.cs:676-717` verifies an invalid old preview blocks commit and the existing BOM remains unchanged. `WorkflowGenerationTests.cs:2729-2820` verifies existing data-quality `DryRun=true` reports actions while material request, purchase request and inventory issue still exist.

### Required stronger Phase 4 pattern

- Make every preview query explicitly `AsNoTracking`; project only the identifiers/status/count/quantity/timestamp fields required by the classifier instead of loading mutation-ready aggregates.
- Read desired state, current BOM state and dependency evidence in a stable, deterministic snapshot boundary appropriate to the provider. A sequence of unrelated queries without a consistency strategy can produce a manifest from mixed DB states.
- Build candidate projections first, then call a pure classifier. The classifier must not receive `DbContext`, EF entity instances or lazy-loading navigations.
- The preview service must have no `SaveChangesAsync`, no `Add/Update/Remove`, no audit insertion and no cleanup call. Phase 4 may cache the immutable manifest, but that cache is outside domain DML and must be actor/scope-bound with TTL.
- Relational purity test must use a fresh verification context and compare ordered counts/checksums of BOM/catalog/dependency/history tables before and after preview, plus assert the preview context has no Added/Modified/Deleted tracker entries. Existing tests do not yet prove this.

### Query landmines

- `GetDataQualityAsync` applies `.Take(limit)` independently and finally to the combined issue list (`1542-1558`, `1933-1939`). This is appropriate for a report page, not for full-scope preview/action counts.
- `WorkflowReportService.CleanupDataQualityAsync` mixes classification and destructive changes and calls `SaveChangesAsync` within category branches. It is an anti-boundary for Phase 4 even when `DryRun=true` currently avoids the guarded mutations.
- Old BOM preview generates a new ingredient code in memory and warns that commit will create it (`DishService.cs:1102-1143`). Canonical preview must classify creation explicitly and apply must later recompute; preview must not attach/create an EF entity.
- Current tests often verify with the same tracking context. Phase 4 purity proof must verify from a separate context and include checksums, not only `AnyAsync` on selected IDs.

## 6. File hash, DB fingerprint, TTL and idempotency patterns

### Existing hash/provenance analogs

- `SampleDataImportService.CustomMenu.ComputeFileChecksum` (`1964-1965`) returns uppercase SHA-256 hex with `Convert.ToHexString(SHA256.HashData(...))`.
- `JwtTokenService.HashRefreshToken` (`63-67`) returns a 64-character SHA-256 hex string. `IpcManagementContext.cs:2612-2628` enforces a unique, fixed-length database index/column on that hash. This is the repository's strongest existing database-enforced uniqueness analog.
- `Menuversion` mapping (`IpcManagementContext.cs:1448-1511`) combines source checksum/file metadata, status, version, actor/timestamps and success/error/warning counts. It does not make `SourceChecksum` unique and is not an idempotency mechanism.
- `MaterialDemandService` staleness (`237-280`) uses `UpdatedAt`/`CreatedAt` comparisons across quantity lines, menu versions and stock. This is a change-detection analog, not a complete DB fingerprint.

### Phase 3 planned dependency

Phase 3 Plan 03 will create `BomReconciliationRunContract` with a deterministic fingerprint factory and a database-unique reconciliation fingerprint, plus the run entity/provenance columns. Those symbols do **not** exist at mapping time. Phase 4 should consume the actual delivered contract/version fields and must not create a competing idempotency format.

### Phase 4 target pattern

- Hash the bounded workbook bytes while copying/validating the upload so the parser and manifest refer to exactly the same content. Use one documented hex casing/format everywhere.
- Compute a deterministic bounded DB fingerprint from ordered scalar projections covering all current BOM/catalog rows and dependency/version evidence that can change classification. Serialize with invariant culture and explicit null/date/decimal formats, then SHA-256.
- Manifest identity includes preview ID, file hash, contract version, policy version, effective date, actor/scope, DB fingerprint, issued/expires timestamps and action/blocker counts. Never let the client submit a replacement actor/hash/count/candidate set.
- Store an immutable server-owned manifest with an absolute TTL and actor/scope binding. Existing `DishService` cache (`47-70`) shows `IMemoryCache.TryGetValue` + `MemoryCacheEntryOptions` + `Set`, but uses a 30-minute catalog key. A preview needs an unguessable ID, short absolute TTL, explicit eviction semantics and no mutable DTO reuse. If deployment is multi-instance, in-process memory alone is insufficient; the plan must either require sticky/single-instance Phase 4 or use a shared server store.
- Future apply will reparse/reclassify and compare all hashes/versions. Phase 4 only creates/tests the preview manifest and stale decision; it must expose no destructive apply endpoint.

### Gaps to plan explicitly

There is no existing generic canonical serializer, DB fingerprint helper, preview-token store, actor-bound cache entry or BOM idempotency implementation. These are new Phase 4 artifacts except for the Phase 3 run fingerprint contract. Do not claim reuse where only a SHA-256 primitive exists.

## 7. Dependency and data-quality classifier pattern

### Existing dependency-query analogs

`WorkflowReportService.GetDataQualityAsync` is the most complete read-side inventory:

- active dishes missing an effective supported-tier BOM via correlated `Any` (`1548-1558`);
- invalid ingredient/unit conversion (`1571-1619`);
- active legacy BOM tier (`1621-1643`);
- stock/unit mismatch and negative stock (`1645-1667`, `1717-1737`);
- inactive ingredient still referenced by active BOM (`1692-1715`);
- ledger mismatch and stock shortage audit (`1739-1775`);
- missing customer contract and inactive supplier references (`1777-1821`);
- cancelled/stale demand and purchase requests (`1823-1857`);
- orphan material requests, purchase lines and inventory issues using correlated absence checks (`1877-1931`).

Existing cleanup adds useful guard examples:

- purchase line loads receipt/order navigation and skips deletion if either exists (`WorkflowReportService.cs:2113-2151`);
- inventory issue loads lines/returns, reads stock movement references, and skips when returned, received by kitchen, or ledger-referenced (`2160-2204`);
- `WorkflowGenerationTests.cs:2729-2857` seeds mixed stale/orphan/active states, proves dry-run counts, proves active draft preservation and verifies apply/audit behavior. Reuse the mixed-fixture style, not the mutation behavior.

### Target split and pure policy

```text
bounded desired-state keys
  + current BOM/catalog projections
  + dependency evidence projection
  + Phase 3 lifecycle policy version
      -> IBomLegacyCleanupClassifier.Classify(input)
      -> keep/archive/deactivate/regenerate/delete/block + reason/evidence
```

- Query service owns EF and produces compact immutable evidence: reference counts/IDs by family, lifecycle codes, stock quantity, ledger/movement/receipt/issue/order/return flags, provenance and ambiguity flags.
- Pure classifier owns the policy mapping and is table-driven by the Phase 3 lifecycle policy. Every unsupported/unknown status, query failure, truncated evidence, missing policy version or contradictory evidence returns `block`.
- History/locked/completed/audit/approval/stock-ledger evidence can never produce hard delete. Non-zero stock, downstream order/receipt/issue/return or unresolved identity is a blocker.
- `delete` requires affirmative proof of true orphan, not merely absence from workbook/name/code. `archive/deactivate` remains the conservative default when history exists. `regenerate` is only a classification label in Phase 4; Phase 5 owns mutation.
- Produce stable reason codes and evidence counts so preview and Phase 5 apply can share the same policy version and compare decisions.

### Existing classifier landmines

- `WorkflowReportService.CleanupDataQualityAsync` hard-codes status arrays (`CANCELLED`, `FAILED`, `IMPORT_FAILED`, `DRAFT`) at lines 2001-2021, combines queries/policy/DML/audit in one service, and silently excludes unknown states instead of emitting blockers.
- Its controller is class-level `[Authorize]`, not Admin-only (`WorkflowReportsController.cs:11-15,170-186`). It is not an authorization analog for canonical preview.
- It uses caller `Limit`, so it cannot prove all-candidate classification.
- The report's issue category/action strings are free-form. Target codes need a versioned exhaustive mapping and unknown=block tests.
- Phase 4 must not invoke this cleanup method or add any delete/update path.

## 8. Cache and dependency-injection conventions

`DependencyInjection.AddBackendServices` is the sole backend composition root. At lines 52-79, services are registered interface-to-concrete with `AddScoped`; security services are registered at lines 35-37. `Program.cs:150` registers `AddMemoryCache`. `DishService` constructor-injects `IMemoryCache` (`DishService.cs:18-33`), reads/sets catalog entries (`47-70`) and removes both current catalog keys in `ClearCatalogCache` (`1580-1584`).

Phase 4 should:

- register `IPresetBomWorkbookParser`, preview reconciliation and cleanup classifier interfaces in the existing Services section, not in `Program.cs` and not with `new` inside controllers/services;
- keep the parser/classifier pure and directly unit-testable. Scoped is the repository default; a stateless singleton is only acceptable if it has no scoped dependencies or mutable policy state;
- encapsulate preview manifest storage behind an interface instead of exposing raw `IMemoryCache` keys throughout the service;
- not clear `DishCatalog` during preview. Cache invalidation after mutation belongs to Phase 5. Any preview implementation that calls `ClearCatalogCache` violates SAFE-01;
- avoid reusing mutable cached lists/DTOs as the manifest. Store immutable values and bind retrieval to actor/scope/TTL.

## 9. Relational and API/security test patterns

### Existing test infrastructure

| Concern | Existing analog | Reuse | Missing Phase 4 evidence |
| --- | --- | --- | --- |
| Exact XLSX | `XlsxWorkbookReaderTests.cs:66-148` | Construct ZIP/XML package in test ownership; FluentAssertions; cleanup temp file. | Three canonical sheets, trace/cell issues, malformed/abuse bounds, cancellation/external links. |
| Old preview relational behavior | `DishCatalogTests.cs:500-717` | In-memory SQLite catalog, realistic binary IDs, old preview action/error assertions. | Separate-context before/after checksums, ChangeTracker purity, DB drift/TTL/actor binding. |
| Mixed dependency fixture | `WorkflowGenerationTests.cs:2729-2857` | Seed multiple document/reference states; assert dry-run action counts and retained active rows. | Exhaustive `keep/archive/deactivate/regenerate/delete/block`; unknown=block; history/stock blockers; no mutation at all. |
| SQLite relational setup | `DishCatalogTests.cs:760+`, `WorkflowFixture` | `Data Source=:memory:` with real FK/query behavior, direct `AsNoTracking` verification. | SQLite is not sufficient for MySQL collation/transaction/snapshot/unique behavior. |
| MySQL/API host | `Infrastructure/CustomWebApplicationFactory.cs:10-25` | Replace production context and bind an isolated `IPC_TEST_CONNECTION_STRING`; `WebApplicationFactory<Program>`. | Test currently throws without env and E2E caller often returns early; Phase 4 gate must report BLOCKED, not silently pass. |
| Authenticated HTTP | `Integration/WorkflowLifecycleE2ETests.cs:35-88` | `CreateClient`, login, Bearer header, real middleware/policies. | Unauthenticated/non-Admin/Admin multipart matrix and safe response body/path-leak assertions. |
| Controller identity | `InventoryIssuesControllerTests.cs:14-83` | NSubstitute `ICurrentUserService`, explicit `ControllerContext`/`HttpContext`, actor/claim behavior. | Policy enforcement itself requires hosted API test; direct controller tests bypass authorization middleware. |
| Model-state envelope | `ApiResponseModelStateFactoryTests.cs:12-30` | Assert standard `ApiResponse` failure envelope. | Canonical issue codes/status mapping and 413/415/security failure envelope. |

### Required Phase 4 suites

1. `PresetBomWorkbookParserTests`
   - canonical three sheets/header case/Unicode;
   - physical sheet/row/column/cell trace;
   - deterministic order/normalization/dedupe;
   - weighted duplicate only with serving basis;
   - missing sheet/header, unsupported tier, invalid quantity, identity collision and unknown/ambiguous technical unit block;
   - parser output contains no EF entity/path.

2. `PresetBomWorkbookSecurityTests`
   - empty, renamed non-XLSX, corrupt ZIP, traversal/absolute/external relationship, oversize compressed/uncompressed entry/shared strings/XML, too many sheets/rows/cells and cancellation;
   - bounded failure is 4xx/typed issue without temp/server path; no orphan temp file.

3. `BomReconciliationPreviewTests`
   - relational desired/current diff and action counts across all tiers/global + preserved customer overlays;
   - fresh separate context proves before/after ordered checksums and counts equal;
   - tracker has zero Added/Modified/Deleted entries;
   - file/effective-date/policy/DB drift and expiry/actor mismatch return stale/conflict with zero mutation;
   - same input produces stable hash/fingerprint/order/counts.

4. `BomLegacyCleanupClassifierTests`
   - table-driven pure policy for every action and exact reason code;
   - mixed relational evidence projection for BOM, dish, ingredient, menu/production/demand/purchase/receipt/issue/return/stock/audit;
   - unknown status, unknown relationship, query truncation/failure, contradictory evidence and non-zero stock always block;
   - locked/completed/audit/approval/ledger checksums unchanged.

5. `BomCanonicalPreviewApiTests`
   - hosted API: 401 unauthenticated, 403 authenticated non-Admin, success Admin;
   - server claim actor wins over any forged form field; path/candidate/hash inputs are absent/rejected;
   - multipart length/content/security cases and cancellation;
   - response uses `ApiResponse`, structured issues and no exception/temp/local path leakage.

Use MySQL-backed hosted tests for authorization pipeline and provider-sensitive fingerprint/transaction consistency. SQLite remains fast feedback. Do not let an absent `IPC_TEST_CONNECTION_STRING` silently return green as the existing E2E test does at lines 30-33; record the integration gate as BLOCKED.

## 10. Planner target-to-analog checklist

| Phase 4 target | Existing analog | Convention to retain | Mandatory divergence/stop condition |
| --- | --- | --- | --- |
| Bounded workbook input/reader | `XlsxWorkbookReader`, old `IFormFile` paths | OpenXML ZIP/XML, source row/column, cancellation | No path contract/full buffering/unbounded `XDocument`; reject external/traversal/abuse. |
| `IPresetBomWorkbookParser` | `ReadRowsWithMetadata`, old `ParseBomImportRowsAsync` | Pure typed output, stable trace/errors/order | No EF/context/temp path/fallback KG; stop on missing Phase 3 contract/policy. |
| Canonical preview DTO/controller | Dishes multipart + AdminEmployees policy + ApiResponse | Thin controller, form upload, AdminAccess, server actor | Do not copy CatalogAccess/general `[Authorize]`; no client actor/path/candidates/hash. |
| Read-only reconciliation | old `BuildBomImportPreviewAsync` AsNoTracking queries | Scalar projections, action/blocker counts, no save | Separate-context checksum/tracker proof required; no apply endpoint. |
| Manifest/hash/fingerprint/store | SHA-256 helpers, Menuversion provenance, refresh-token unique hash, IMemoryCache | Deterministic hash, explicit versions/counts, DB uniqueness analog, TTL | Phase 3 run contract is dependency; no timestamp-only ID, client-forged values or mutable cache object. |
| Dependency evidence service | data-quality `AsNoTracking` queries | Correlated refs, stock/order/receipt/issue/return checks | Query all relevant candidates; no `Take(limit)` in classification totals. |
| Pure cleanup classifier | cleanup dry-run action/result shape | Stable action/reason/evidence DTOs, mixed fixtures | Unknown=block; no EF entity/DML/audit; do not call existing cleanup. |
| DI/cache | `AddBackendServices`, `IMemoryCache`, `ClearCatalogCache` | Interface-to-concrete scoped registration; encapsulated store | Preview never invalidates domain caches; handle multi-instance limitation explicitly. |
| Relational/API security proof | SQLite catalog/workflow fixtures + `CustomWebApplicationFactory` | FluentAssertions, isolated DB, hosted auth | No direct-controller-only auth proof, no silent integration skip, no same-context-only purity assertion. |

## 11. Phase boundary and non-goals

Allowed in Phase 4:

- bounded canonical workbook upload/read/parse;
- deterministic normalized rows and location-aware structured issues using Phase 3 contract/policy;
- Admin-only read-only preview, manifest/hash/DB fingerprint/TTL and stale checks;
- dependency evidence query + pure conservative classifier;
- parser/security/purity/drift/classifier/API test fixtures and DI.

Deferred/forbidden:

- no BOM/catalog/draft document mutation, cleanup DML, `SaveChangesAsync` on preview, audit write or cache invalidation;
- no apply/commit/destructive endpoint;
- no downstream regenerate/cancel (Phase 5);
- no frontend RTK/shadcn workbench (Phase 6);
- no old endpoint/template/DTO/UI removal (Phase 7);
- no call to `ReplaceBomCatalog`, `Clean_Legacy_Imported_Bom.sql` or `WorkflowReportService.CleanupDataQualityAsync`;
- no rewrite/delete of applied migrations and no claim that Phase 3 planned artifacts already exist.

