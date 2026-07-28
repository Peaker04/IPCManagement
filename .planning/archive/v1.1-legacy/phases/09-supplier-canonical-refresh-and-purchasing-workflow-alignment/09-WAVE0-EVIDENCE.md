# Phase 09 Wave 0 Safety Evidence

**Captured:** 2026-07-22  
**Scope:** disposable databases only (`ipc_lane1`, `ipc_e2e_template`)  
**Mutation authorization:** no shared or live database mutation

## Repository and GitNexus baseline

```text
BaselineCommit=5d3f80e1c6f8e3178f47b53897f82baf6eb21919
GitNexusIndexedCommit=5d3f80e
GitNexusStatus=up-to-date
GitNexusSymbols=7,631
GitNexusRelationships=21,645
GitNexusExecutionFlows=300
GitNexusAccess=local fallback: node .gitnexus/run.cjs (MCP tools were not exposed)
```

The index was rebuilt from a forced clean because `clean` without `--force` only printed the confirmation guidance. The forced clean removed the project runner together with `.gitnexus`; the installed `gitnexus analyze` command recreated the index and runner once, after which all status, query, context, impact, and change-scope checks used `node .gitnexus/run.cjs`.

The initial user-owned dirty paths were kept out of task staging. At the final Task 1 pre-commit check they were:

```text
 M README.md
 M frontend/README.md
?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql
```

## Protected SQL invariant

```text
ProtectedSqlSha256=B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53
ProtectedSqlPorcelain=?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql
ProtectedSqlTracked=false
```

Commands:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath 'backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql'
git status --porcelain=v1 --untracked-files=all -- 'backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql'
git ls-files --error-unmatch -- 'backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql'
```

The final command exited non-zero as required. The file was not edited, staged, renamed, or tracked.

## Workbook identity and deterministic-key audit

```text
WorkbookSha256=4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88
LegacyWorkbookSha256=AD7C13972F41E99780106F23BC54A1B4D7AB204862DBED493C5700BCD2C4CA33
WorkbookSheetCount=34
SummarySupplierPolicyCount=31
RecognizedPurchaseDataSheetCount=30
LegacyUniqueNormalizedDateIngredientKeys=14,532
CurrentUniqueNormalizedDateIngredientKeys=17,739
SourceKeyCount=3,207
SourceKeyComparison=case-insensitive
```

### Reproducible XML audit algorithm

The audit uses only .NET ZIP/XML APIs from PowerShell; it does not open or save either workbook:

1. Open each XLSX as a ZIP archive and resolve `xl/workbook.xml`, workbook relationships, and `xl/sharedStrings.xml`.
2. Count every workbook sheet. For purchase rows, exclude `SUMMARY` and `NGUỒN`.
3. Find the first row containing all five headers: `Ngày Giao hàng`, `Tên hàng`, `Đơn vị tính`, `Số lượng`, and `Đơn giá`.
4. For each later row, apply the existing importer boundary: delivery date parses as an Excel OA date or Vietnamese/invariant date, ingredient is nonblank, and quantity and unit price parse invariantly above zero.
5. Normalize ingredient with `Trim()`, collapse internal whitespace using `Regex.Replace(value, @"\s+", " ")`, and compare with `StringComparer.OrdinalIgnoreCase`.
6. Construct the business key as `yyyy-MM-dd|normalized ingredient`, insert it into a case-insensitive `HashSet<string>`, then subtract the 19.5 set count from the 20.7 set count.

Auditable invocation shape:

```powershell
$legacy = Get-NormalizedDateIngredientKeys '.docs/IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx'
$current = Get-NormalizedDateIngredientKeys '.docs/IPC. Theo dõi đặt hàng ngày 20.7.2026.xlsx'
"Legacy=$($legacy.Count);Current=$($current.Count);Delta=$($current.Count - $legacy.Count)"
# Legacy=14532;Current=17739;Delta=3207
```

### Correction record

The earlier `3,209` value existed only as an unsupported statement in `09-CONTEXT.md`; no generating command or key definition existed in the discussion log, research, Git history, or prior execution memory. Direct audits produced `3,513` for complete raw field rows and `3,503` for positive importable rows, while the approved deterministic projection above reproducibly produces `3,207`. The user approved correcting Phase 09 artifacts to the reproduced `3,207` invariant on 2026-07-22.

## Disposable clone and restore proof

### Clone-tool correction

GitNexus upstream impact for `ReadPhysicalColumnsAsync` was exact LOW risk: one direct caller (`CloneDatabaseAsync`), two impacted symbols total, zero affected execution processes, and one module. The original predicate `extra NOT LIKE '%GENERATED%'` incorrectly excluded MySQL `DEFAULT_GENERATED` temporal columns. It was changed to `COALESCE(generation_expression, '') = ''`, which preserves default timestamps and excludes only true computed expressions.

```text
DatabaseToolBuild=PASS (0 warnings, 0 errors)
DisposableDatabaseIdentity=ipc_lane1,ipc_e2e_template
BackupIdentity=wave0-ipc_lane1-to-ipc_e2e_template-20260722
CloneDirection=ipc_lane1->ipc_e2e_template
TableCount=56
TotalRowCount=54,039
CloneVerify=PASS
ExcludedGeneratedColumnCount=1
ExcludedGeneratedColumn=inventoryreceiptlines.amount=(quantity * unitPrice)
PreMutationFingerprint=7813E4A8814A9DA4AAD8FA52D5EC3ED9868242950AD5DEB4BF45716FEBA25E41
BackupFingerprint=7813E4A8814A9DA4AAD8FA52D5EC3ED9868242950AD5DEB4BF45716FEBA25E41
MutationFingerprint=90B925F775B32F86479184D367F9F64C5FD25BE233191E683A212B2E7BCEB73B
PostRestoreFingerprint=7813E4A8814A9DA4AAD8FA52D5EC3ED9868242950AD5DEB4BF45716FEBA25E41
RestoreMatch=true
```

Commands used for the two guarded transitions:

```powershell
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj -c Release -- clone --settings backend/src/IPCManagement.Api/appsettings.json --source ipc_lane1 --target ipc_e2e_template
dotnet run --project backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj -c Release -- clone --settings backend/src/IPCManagement.Api/appsettings.json --source ipc_e2e_template --target ipc_lane1
```

Before each command, both names were asserted against `^ipc_(?:e2e_template|lane[1-9])$`. The deliberate mutation created only `ipc_lane1.wave0_restore_probe` with one row. Restore ran in a `finally` block and removed the probe by replacing the disposable lane from the verified template.

### Stable fingerprint definition

For every base table ordered by name, the fingerprint payload contains:

- table name;
- ordered primary-key column inventory;
- ordered column schema (`ordinal`, name, type, nullability, default, `extra`, and generation expression);
- exact row count;
- every full row serialized in column order, with null markers and hex encoding, then sorted ordinally.

SHA-256 is computed over the UTF-8 payload. This covers default-generated temporal values and the value of the single computed column after MySQL recalculates it. Source and backup matched before mutation; the probe changed the hash; the restored source matched the original hash exactly.

## Wave 0 conclusion

Both corrected gates are satisfied without a live/shared mutation: the workbook delta is reproducibly `3,207`, and the disposable clone preserves all non-computed fields while full schema/PK/row data returns to the exact pre-mutation fingerprint.
