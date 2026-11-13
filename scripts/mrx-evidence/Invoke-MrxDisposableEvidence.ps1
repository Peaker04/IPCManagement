[CmdletBinding()]
param(
    [ValidateSet('Preflight', 'Execute', 'Start', 'Run', 'Finish', 'Abort')]
    [string]$Mode = 'Preflight',
    [string]$CampaignId,
    [ValidateSet('G1', 'Qualification')]
    [string]$Profile = 'G1',
    [ValidateSet('Admission', 'Golden', 'Supplemental', 'Race', 'Recovery', 'Session', 'SupplementalRecovery', 'CampaignBaseline', 'RepairCheck', 'CombinedFE', 'SourceCustomer', 'RemainingFE', 'MeasurementCheck', 'Quantitative', 'LifecycleAcceptance', 'MenuIntegrityPerformance', 'CustomerWorstCase', 'SourceAtomicity', 'ExportConsistency', 'UiAcceptance', 'ModalAcceptance', 'LifecycleTail', 'Coordinated', 'MenuCoverage', 'MenuReimport')]
    [string]$Diagnostic,
    [string]$SourceSettings = 'backend/src/IPCManagement.Api/appsettings.json',
    [string]$EvidenceDirectory = '.artifacts/mrx-evidence'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'MrxEvidenceSafety.ps1')
Assert-MrxCampaignInvocation -Mode $Mode -Profile $Profile -CampaignId $CampaignId -Diagnostic $Diagnostic
if ($CampaignId -and $EvidenceDirectory -cne '.artifacts/mrx-evidence') { throw 'Campaign evidence must use the canonical owned directory.' }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$runId = if ($CampaignId) { $CampaignId } else {
    ((Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'").ToLowerInvariant()) + '_' +
        ([Guid]::NewGuid().ToString('N').Substring(0, 6))
}
$targetDatabase = "ipc_mrx_evidence_$runId"
$subordinateDatabase = "${targetDatabase}_integration"
$evidenceRoot = Join-Path (Join-Path $repoRoot $EvidenceDirectory) $runId
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) "ipc-mrx-evidence\$runId"
$defaultsFile = Join-Path $tempRoot 'mysql.defaults.cnf'
$dumpPath = Join-Path $tempRoot 'source.sql'
$statusPath = Join-Path $evidenceRoot 'status.json'
$processFile = Join-Path $evidenceRoot 'e2e-processes.json'
$targetCreated = $false
$subordinateCreated = $false
$cleanupBlocked = $false
$cleanupCompleted = $false
$terminalStatus = 'FAIL'
$runtimePrincipalAttempted = $false
$runtimePrincipal = "mrx_$runId"
$qualificationCredentialsFile = $env:MRX_E2E_CREDENTIALS_FILE
$automaticActors = [string]::IsNullOrWhiteSpace($qualificationCredentialsFile)
$qualificationTargetConnection = $null
$runtimeDirectory = Join-Path $tempRoot 'runtime'
$sourceManifest = $null
$candidateManifest = $null

function Get-CandidateManifest {
    $paths = @(& git -C $repoRoot -c core.quotepath=false ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate the actual candidate working tree.' }
    $files = [ordered]@{}
    foreach ($relative in @($paths | Sort-Object -Unique)) {
        $absolute = Join-Path $repoRoot $relative
        $files[$relative] = if (Test-Path -LiteralPath $absolute -PathType Leaf) { (Get-FileHash -LiteralPath $absolute -Algorithm SHA256).Hash } else { 'DELETED' }
    }
    return [ordered]@{
        head = ((& git -C $repoRoot rev-parse HEAD) -join '')
        dirty = @(& git -C $repoRoot status --porcelain)
        fileCount = $files.Count; fileHashes = $files
        workingTreeSha256 = Get-MrxEvidenceTextHash -Text ($files | ConvertTo-Json -Compress -Depth 3)
    }
}

function Write-EvidenceJson {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    $Value | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding utf8
}

function Write-Status {
    param([Parameter(Mandatory = $true)][string]$Status, [string]$Message = '')
    Write-EvidenceJson -Path $statusPath -Value ([ordered]@{
        runId = $runId
        sourceDatabase = 'ipcmanagement'
        targetDatabase = $targetDatabase
        mode = $Mode
        profile = $Profile
        diagnostic = $Diagnostic
        status = $Status
        cleanupCompleted = $cleanupCompleted
        message = $Message
        recordedAtUtc = (Get-Date).ToUniversalTime().ToString('O')
    })
}

function Get-RequiredConnectionValue {
    param([Parameter(Mandatory = $true)]$Builder, [Parameter(Mandatory = $true)][string[]]$Keys)
    foreach ($key in $Keys) {
        if ($Builder.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$Builder[$key])) {
            return [string]$Builder[$key]
        }
    }
    throw "Source connection string is missing '$($Keys[0])'."
}

function ConvertTo-DefaultsValue {
    param([Parameter(Mandatory = $true)][string]$Value)
    return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function New-RunOwnedDefaultsFile {
    param([Parameter(Mandatory = $true)][string]$ConnectionString)
    $builder = ConvertFrom-MrxConnectionString -ConnectionString $ConnectionString
    $database = Get-RequiredConnectionValue $builder @('Database', 'Initial Catalog')
    Assert-MrxEvidenceSource -DatabaseName $database | Out-Null
    $hostName = Get-RequiredConnectionValue $builder @('Server', 'Host', 'Data Source')
    $userName = Get-RequiredConnectionValue $builder @('User ID', 'UserID', 'Uid', 'User')
    $password = Get-RequiredConnectionValue $builder @('Password', 'Pwd')
    $port = if ($builder.ContainsKey('Port')) { [int]$builder['Port'] } else { 3306 }

    @(
        '[client]'
        "host=$(ConvertTo-DefaultsValue $hostName)"
        "port=$port"
        "user=$(ConvertTo-DefaultsValue $userName)"
        "password=$(ConvertTo-DefaultsValue $password)"
        'default-character-set=utf8mb4'
    ) | Set-Content -LiteralPath $defaultsFile -Encoding ascii

    & icacls.exe $defaultsFile '/inheritance:r' '/grant:r' "${env:USERNAME}:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not restrict the run-owned MySQL defaults file ACL.'
    }

    return $builder
}

function Resolve-MySqlExecutable {
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not [string]::IsNullOrWhiteSpace($env:MYSQL_BIN)) {
        $candidate = Join-Path $env:MYSQL_BIN "$Name.exe"
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    $command = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
    if ($null -ne $command) { return $command.Source }
    $fallback = "C:\Program Files\MySQL\MySQL Server 9.5\bin\$Name.exe"
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    throw "Required executable '$Name.exe' was not found."
}

function Invoke-CheckedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [string]$StandardInputPath,
        [string]$StandardOutputPath,
        [string]$WorkingDirectory = $repoRoot,
        [hashtable]$Environment = @{}
    )
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $FilePath
    $start.WorkingDirectory = $WorkingDirectory
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardError = $true
    $start.RedirectStandardInput = -not [string]::IsNullOrWhiteSpace($StandardInputPath)
    $start.RedirectStandardOutput = -not [string]::IsNullOrWhiteSpace($StandardOutputPath)
    $start.Arguments = ($Arguments | ForEach-Object { ConvertTo-MrxNativeArgument $_ }) -join ' '
    foreach ($entry in $Environment.GetEnumerator()) { $start.Environment[$entry.Key] = [string]$entry.Value }
    $process = [Diagnostics.Process]::Start($start)
    if ($null -eq $process) { throw "Could not start '$FilePath'." }
    $errorRead = $process.StandardError.ReadToEndAsync()
    $outputRead = if ($start.RedirectStandardOutput) { $process.StandardOutput.ReadToEndAsync() } else { $null }
    if ($start.RedirectStandardInput) {
        $input = [System.IO.StreamReader]::new($StandardInputPath)
        try { $input.BaseStream.CopyTo($process.StandardInput.BaseStream) }
        finally { $input.Dispose(); $process.StandardInput.Close() }
    }
    $process.WaitForExit()
    $errorText = $errorRead.GetAwaiter().GetResult()
    $outputText = if ($start.RedirectStandardOutput) { $outputRead.GetAwaiter().GetResult() } else { '' }
    if ($start.RedirectStandardOutput) { Set-Content -LiteralPath $StandardOutputPath -Value $outputText -Encoding utf8 }
    if ($process.ExitCode -ne 0) { throw "Command '$([IO.Path]::GetFileName($FilePath))' failed with exit code $($process.ExitCode): $errorText" }
}

function Resolve-NpmCli {
    $npmCommand = Get-Command 'npm.cmd' -ErrorAction Stop
    $cli = Join-Path (Split-Path $npmCommand.Source) 'node_modules\npm\bin\npm-cli.js'
    if (-not (Test-Path -LiteralPath $cli)) { throw 'npm-cli.js was not found beside npm.cmd.' }
    return [ordered]@{ Node = (Get-Command 'node.exe' -ErrorAction Stop).Source; Cli = $cli }
}

function Invoke-Npm {
    param([Parameter(Mandatory = $true)][string[]]$Arguments, [hashtable]$Environment = @{})
    $npm = Resolve-NpmCli
    Invoke-CheckedProcess -FilePath $npm.Node -Arguments (@($npm.Cli) + $Arguments) -Environment $Environment
}

function Invoke-MySqlQuery {
    param(
        [Parameter(Mandatory = $true)][string]$Sql,
        [string]$Database
    )
    $arguments = @("--defaults-extra-file=$defaultsFile", '--batch', '--raw', '--skip-column-names')
    if (-not [string]::IsNullOrWhiteSpace($Database)) { $arguments += $Database }
    $arguments += @('--execute', $Sql)
    $output = & $mysql @arguments
    if ($LASTEXITCODE -ne 0) { throw 'mysql query failed.' }
    return @($output)
}

function Get-DatabaseManifest {
    param([Parameter(Mandatory = $true)][string]$DatabaseName, [switch]$StableSchema)
    $tableCount = [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DatabaseName' AND table_type = 'BASE TABLE';")
    $migrationIds = @(Invoke-MySqlQuery -Database $DatabaseName -Sql 'SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;')
    $boundedTables = @(
        'reconciliationbatches', 'reconciliationbatchlines', 'reconciliationbatchdailylines',
        'reconciliationbatchcontributors', 'reconciliationdispositions', 'reconciliationdailydispositions',
        'reconciliationsourcerevisions', 'reconciliationsourcedeltas', 'inventoryissues', 'stockmovements',
        'menuversions'
    )
    if ($Profile -eq 'Qualification') {
        $boundedTables = @(Invoke-MySqlQuery -Sql "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = '$DatabaseName' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;")
    }
    $schemaDefinitions = [ordered]@{}
    $schemaChecksums = [ordered]@{}
    $rowCounts = [ordered]@{}
    $tableChecksums = [ordered]@{}
    foreach ($table in $boundedTables) {
        if ($table -notmatch '^[A-Za-z0-9_]+$') { throw 'Unexpected table identifier in source manifest.' }
        if ($Profile -eq 'Qualification') {
            $schemaDefinitions[$table] = (Invoke-MySqlQuery -Database $DatabaseName -Sql "SHOW CREATE TABLE ``$table``;") -join "`n"
        }
        $exists = [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$DatabaseName' AND table_name = '$table';")
        if ($exists -eq 1) {
            $rowCounts[$table] = [int64](Invoke-MySqlQuery -Database $DatabaseName -Sql "SELECT COUNT(*) FROM ``$table``;")
            $checksumFields = ((Invoke-MySqlQuery -Sql "CHECKSUM TABLE ``$DatabaseName``.``$table``;") -join "`n") -split "`t"
            if ($checksumFields.Count -lt 2 -or $checksumFields[-1] -notmatch '^\d+$') {
                throw "CHECKSUM TABLE did not return a numeric value for '$table'."
            }
            $tableChecksums[$table] = $checksumFields[-1]
        }
    }
    if ($Profile -eq 'Qualification') {
        $autoIncrement = if ($StableSchema) { '' } else { ',AUTO_INCREMENT' }
        $semanticQueries = [ordered]@{
            columns = "SELECT JSON_ARRAY(TABLE_NAME,COLUMN_NAME,ORDINAL_POSITION,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA,CHARACTER_SET_NAME,COLLATION_NAME,GENERATION_EXPRESSION) FROM information_schema.columns WHERE TABLE_SCHEMA = '$DatabaseName' ORDER BY TABLE_NAME,ORDINAL_POSITION;"
            tableOptions = "SELECT JSON_ARRAY(TABLE_NAME,ENGINE,ROW_FORMAT,TABLE_COLLATION,CREATE_OPTIONS,TABLE_COMMENT$autoIncrement) FROM information_schema.tables WHERE TABLE_SCHEMA = '$DatabaseName' ORDER BY TABLE_NAME;"
            indexes = "SELECT JSON_ARRAY(TABLE_NAME,INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,COLLATION,SUB_PART,NULLABLE,INDEX_TYPE,IS_VISIBLE,EXPRESSION) FROM information_schema.statistics WHERE TABLE_SCHEMA = '$DatabaseName' ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX;"
            constraints = "SELECT JSON_ARRAY(t.TABLE_NAME,t.CONSTRAINT_NAME,t.CONSTRAINT_TYPE,k.COLUMN_NAME,k.ORDINAL_POSITION,CASE WHEN k.REFERENCED_TABLE_SCHEMA=t.TABLE_SCHEMA THEN '<SELF>' ELSE k.REFERENCED_TABLE_SCHEMA END,k.REFERENCED_TABLE_NAME,k.REFERENCED_COLUMN_NAME,r.MATCH_OPTION,r.UPDATE_RULE,r.DELETE_RULE,c.CHECK_CLAUSE,t.ENFORCED) FROM information_schema.table_constraints t LEFT JOIN information_schema.key_column_usage k ON k.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND k.TABLE_NAME=t.TABLE_NAME AND k.CONSTRAINT_NAME=t.CONSTRAINT_NAME LEFT JOIN information_schema.referential_constraints r ON r.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND r.TABLE_NAME=t.TABLE_NAME AND r.CONSTRAINT_NAME=t.CONSTRAINT_NAME LEFT JOIN information_schema.check_constraints c ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA='$DatabaseName' ORDER BY t.TABLE_NAME,t.CONSTRAINT_NAME,k.ORDINAL_POSITION;"
        }
        foreach ($key in $semanticQueries.Keys) {
            $schemaChecksums[$key] = Get-MrxEvidenceTextHash -Text ((Invoke-MySqlQuery -Sql $semanticQueries[$key]) -join "`n")
        }
        $definitions = @(
            "SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_STATEMENT, SQL_MODE, DEFINER FROM information_schema.triggers WHERE TRIGGER_SCHEMA = '$DatabaseName' ORDER BY TRIGGER_NAME;",
            "SELECT TABLE_NAME, VIEW_DEFINITION, CHECK_OPTION, DEFINER, SECURITY_TYPE FROM information_schema.views WHERE TABLE_SCHEMA = '$DatabaseName' ORDER BY TABLE_NAME;",
            "SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION, SQL_MODE, DEFINER, SECURITY_TYPE FROM information_schema.routines WHERE ROUTINE_SCHEMA = '$DatabaseName' ORDER BY ROUTINE_NAME;",
            "SELECT EVENT_NAME, EVENT_DEFINITION, EVENT_TYPE, EXECUTE_AT, INTERVAL_VALUE, INTERVAL_FIELD, STARTS, ENDS, STATUS, ON_COMPLETION, DEFINER FROM information_schema.events WHERE EVENT_SCHEMA = '$DatabaseName' ORDER BY EVENT_NAME;"
        )
        for ($index = 0; $index -lt $definitions.Count; $index++) {
            $schemaChecksums["otherObjects$index"] = Get-MrxEvidenceTextHash -Text ((Invoke-MySqlQuery -Sql $definitions[$index]) -join "`n")
        }
    }
    return [ordered]@{
        database = $DatabaseName
        schemaChecksums = $schemaChecksums
        schemaDefinitions = $schemaDefinitions
        tableCount = $tableCount
        migrationIds = $migrationIds
        migrationHead = if ($migrationIds.Count -gt 0) { $migrationIds[-1] } else { $null }
        rowCounts = $rowCounts
        tableChecksums = $tableChecksums
    }
}

function Invoke-MigrationAndRelationalEvidence {
    param([Parameter(Mandatory = $true)]$SourceBuilder)

    $targetBuilder = ConvertFrom-MrxConnectionString -ConnectionString $SourceBuilder.ConnectionString
    $targetBuilder['Database'] = $targetDatabase
    $targetEnvironment = @{
        'ConnectionStrings__DefaultConnection' = $targetBuilder.ConnectionString
    }

    if ($Diagnostic -ne 'MenuIntegrityPerformance') {
        if ($Profile -eq 'G1') { Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @('tool', 'restore') }
        Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
            'build', 'backend/src/IPCManagement.Api/IPCManagement.Api.csproj', '-c', 'Release', '--no-restore'
        )
        Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
            'ef', 'database', 'update', '--configuration', 'Release', '--no-build', '--project', 'backend/src/IPCManagement.Api',
            '--startup-project', 'backend/src/IPCManagement.Api'
        ) -Environment $targetEnvironment
    }

    $migrationIds = @(Invoke-MySqlQuery -Database $targetDatabase -Sql 'SELECT MigrationId FROM __EFMigrationsHistory ORDER BY MigrationId;')
    foreach ($requiredMigration in @(
        '20261101112409_RetainMrxDecisionAndContributorHistory',
        '20261101124531_RetainWeeklyMenuImportSnapshots'
    )) {
        if ($requiredMigration -notin $migrationIds) { throw "Required migration '$requiredMigration' was not applied." }
    }
    Write-EvidenceJson -Path (Join-Path $evidenceRoot 'migration-evidence.json') -Value ([ordered]@{
        migrationIds = $migrationIds
        migrationHead = $migrationIds[-1]
    })

    Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
        'ef', 'migrations', 'has-pending-model-changes', '--configuration', 'Release', '--no-build', '--project', 'backend/src/IPCManagement.Api',
        '--startup-project', 'backend/src/IPCManagement.Api', '--', '--no-connect'
    ) -Environment $targetEnvironment

    Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
        'test', 'backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj', '-c', 'Release', '--no-restore',
        '--filter', 'FullyQualifiedName~ReconciliationNetIssueProjectionTests|FullyQualifiedName~MrxIssueProvisionQueryTests|FullyQualifiedName~MrxAuditScopeQueryTests|FullyQualifiedName~ReconciliationDashboardAndReportsTests'
    )

    Assert-MrxEvidenceSubordinateTarget -DatabaseName $subordinateDatabase -ParentDatabaseName $targetDatabase -Purpose 'integration' | Out-Null
    Assert-MrxEvidenceTargetAbsent -DatabaseName $subordinateDatabase -ReadDatabaseCount {
        param($DatabaseName)
        [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
    }
    $integrationDump = Join-Path $tempRoot 'integration.sql'
    Invoke-CheckedProcess -FilePath $mysqldump -Arguments @(
        "--defaults-extra-file=$defaultsFile", '--single-transaction', '--hex-blob', '--set-gtid-purged=OFF',
        "--result-file=$integrationDump", $targetDatabase
    )
    Invoke-MySqlQuery -Sql "CREATE DATABASE ``$subordinateDatabase`` CHARACTER SET utf8mb4;" | Out-Null
    $script:subordinateCreated = $true
    Invoke-CheckedProcess -FilePath $mysql -Arguments @("--defaults-extra-file=$defaultsFile", $subordinateDatabase) -StandardInputPath $integrationDump

    $integrationBuilder = ConvertFrom-MrxConnectionString -ConnectionString $SourceBuilder.ConnectionString
    $integrationBuilder['Database'] = $subordinateDatabase
    Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
        'test', 'backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj', '-c', 'Release', '--no-restore',
        '--filter', 'FullyQualifiedName~IPCManagement.Api.Tests.Integration.WorkflowLifecycleE2ETests'
    ) -Environment @{ 'IPC_TEST_CONNECTION_STRING' = $integrationBuilder.ConnectionString }
}

function New-MrxAuditPlanSql {
    $auditPlanPath = Join-Path $tempRoot 'typed-audit-scope.sql'
    Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
        'test', 'backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj', '-c', 'Release', '--no-restore',
        '--filter', 'FullyQualifiedName~MrxAuditQueryPlanCaptureTests'
    ) -Environment @{ 'MRX_AUDIT_PLAN_SQL_OUTPUT' = $auditPlanPath }
    if (-not (Test-Path -LiteralPath $auditPlanPath -PathType Leaf)) {
        throw 'The production typed-audit query did not produce EXPLAIN SQL.'
    }
    return $auditPlanPath
}

function Invoke-QueryPlanEvidence {
    $queryFile = Join-Path $PSScriptRoot 'MrxRetainedHistoryQueries.sql'
    $text = Get-Content -LiteralPath $queryFile -Raw
    $matches = [regex]::Matches($text, '(?ms)^-- PLAN: ([a-z_]+)\r?\n(.*?)(?=^-- PLAN:|\z)')
    if ($matches.Count -ne 6) { throw 'Every static retained-history query plan must be present before an index decision.' }

    $planInputs = [ordered]@{}
    foreach ($match in $matches) { $planInputs[$match.Groups[1].Value] = $match.Groups[2].Value }
    $auditPlanPath = New-MrxAuditPlanSql
    $planInputs['typed_audit_scope'] = Get-Content -LiteralPath $auditPlanPath -Raw

    $plans = [ordered]@{}
    $requiresMigration = $false
    foreach ($name in $planInputs.Keys) {
        $raw = (Invoke-MySqlQuery -Database $targetDatabase -Sql $planInputs[$name]) -join "`n"
        $plan = try { $raw | ConvertFrom-Json } catch { $null }
        $rootKeys = @('query', 'query_block')
        if ([string]::IsNullOrWhiteSpace($raw) -or $null -eq $plan -or
            -not ($rootKeys | Where-Object { $null -ne $plan.PSObject.Properties[$_] })) {
            throw "Query plan '$name' did not return MySQL JSON evidence."
        }
        $fullScans = [regex]::Matches($raw, '"access_type"\s*:\s*"(?:ALL|table)"').Count
        $examined = @([regex]::Matches($raw, '"(?:rows_examined_per_scan|estimated_rows)"\s*:\s*(\d+(?:\.\d+)?)') |
            ForEach-Object { [decimal]$_.Groups[1].Value })
        if ($fullScans -gt 0 -and @($examined | Where-Object { $_ -gt 5000 }).Count -gt 0) {
            $requiresMigration = $true
        }
        $plans[$name] = [ordered]@{ raw = $raw; fullScanNodes = $fullScans; rowsExaminedPerScan = $examined }
    }
    if ($plans.Count -ne 7) { throw 'All seven retained-history query plans are required for an index decision.' }
    $decision = if ($requiresMigration) { 'REQUIRES_MIGRATION' } else { 'NOT_NEEDED' }
    Write-EvidenceJson -Path (Join-Path $evidenceRoot 'query-plans.json') -Value ([ordered]@{
        indexDecision = $decision
        plans = $plans
    })
    if ($requiresMigration) { throw 'REQUIRES_MIGRATION: retained-history query plan exceeded the bounded scan threshold.' }
}

function Initialize-QualificationCredentials {
    param([Parameter(Mandatory = $true)]$SourceBuilder)
    Assert-MrxEvidenceTarget -DatabaseName $targetDatabase -RunId $runId | Out-Null
    if (-not $targetCreated) { throw 'Qualification bootstrap requires the clone created by this run.' }
    $server = Get-RequiredConnectionValue $SourceBuilder @('Server', 'Host', 'Data Source')
    if ($server -notin @('localhost', '127.0.0.1', '::1', $env:COMPUTERNAME)) { throw 'Only the authorized local MySQL host may receive disposable principals.' }
    $roles = [int64](Invoke-MySqlQuery -Database $targetDatabase -Sql "SELECT COUNT(*) FROM roles WHERE roleCode IN ('ADMIN','COORDINATOR','WAREHOUSESTAFF','CHEF','MANAGER');")
    if ($roles -ne 5) { throw 'All five existing role rows are required; bootstrap cannot create or weaken roles.' }
    $existingPrincipal = [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM mysql.user WHERE User = '$runtimePrincipal' AND Host = '127.0.0.1';")
    if ($existingPrincipal -ne 0) { throw 'Disposable service principal already exists; refusing reuse.' }
    New-MrxQualificationAccounts -DatabaseName $targetDatabase -RunId $runId -PrivateDirectory $tempRoot
    $script:runtimePrincipalAttempted = $true
    Invoke-CheckedProcess -FilePath $mysql -Arguments @("--defaults-extra-file=$defaultsFile") -StandardInputPath (Join-Path $tempRoot 'qualification-db.sql')
    if ($automaticActors) {
        Invoke-CheckedProcess -FilePath $mysql -Arguments @("--defaults-extra-file=$defaultsFile", $targetDatabase) -StandardInputPath (Join-Path $tempRoot 'qualification-users.sql')
        $actors = @(Invoke-MySqlQuery -Database $targetDatabase -Sql "SELECT u.username, r.roleCode FROM users u JOIN roles r ON r.roleId = u.roleId WHERE LEFT(u.username, $(("mrx_${runId}_").Length)) = 'mrx_${runId}_' AND u.isActive = 1 ORDER BY u.username;")
        if ($actors.Count -ne 5) { throw 'Five run-owned active application identities were not persisted.' }
        $script:qualificationCredentialsFile = Join-Path $tempRoot 'qualification-credentials.json'
        Write-EvidenceJson -Path (Join-Path $evidenceRoot 'actor-bootstrap.json') -Value ([ordered]@{
            type = 'DECLARED_CLONE_ONLY_ACTOR_FIXTURES'; runId = $runId; actors = $actors
            existingUsersUpdated = 0; rolesChanged = 0; browserCreated = $false
        })
    }
    if ([string]::IsNullOrWhiteSpace($Diagnostic) -or $Diagnostic -in @('SourceCustomer', 'CustomerWorstCase', 'LifecycleAcceptance', 'CombinedFE', 'RemainingFE', 'CampaignBaseline')) {
        # Owner-approved LC-12 prerequisite, isolated from existing G/KG and physical stock.
        Assert-MrxEvidenceTarget -DatabaseName $targetDatabase -RunId $runId | Out-Null
        $canonical = [int64](Invoke-MySqlQuery -Database $targetDatabase -Sql "SELECT COUNT(*) FROM units WHERE unitCode = 'KG' AND baseUnitCode = 'KG' AND convertRateToBase = 1;")
        if ($canonical -ne 1) { throw 'Conversion fixture requires one existing canonical KG; bootstrap cannot normalize existing masters.' }
        $fixtureCode = 'MRXG' + $runId.Substring($runId.Length - 8)
        $collision = [int64](Invoke-MySqlQuery -Database $targetDatabase -Sql "SELECT COUNT(*) FROM units WHERE unitCode = '$fixtureCode';")
        if ($collision -ne 0) { throw 'Run-owned alternate unit already exists; refusing reuse.' }
        $fixtureId = [BitConverter]::ToString([Guid]::NewGuid().ToByteArray()).Replace('-', '')
        Invoke-MySqlQuery -Database $targetDatabase -Sql "INSERT INTO units (unitId, unitCode, unitName, baseUnitCode, convertRateToBase) VALUES (UNHEX('$fixtureId'), '$fixtureCode', 'Declared acceptance gram fixture $runId', 'KG', 0.001000);" | Out-Null
        $persisted = [int64](Invoke-MySqlQuery -Database $targetDatabase -Sql "SELECT COUNT(*) FROM units WHERE unitId = UNHEX('$fixtureId') AND unitCode = '$fixtureCode' AND baseUnitCode = 'KG' AND convertRateToBase = 0.001000;")
        if ($persisted -ne 1) { throw 'Declared conversion prerequisite did not persist exactly.' }
        Write-EvidenceJson -Path (Join-Path $evidenceRoot 'conversion-prerequisite-bootstrap.json') -Value ([ordered]@{
            type = 'DECLARED_CLONE_ONLY_CONVERSION_FIXTURE'; runId = $runId; database = $targetDatabase
            unitCode = $fixtureCode; baseUnitCode = 'KG'; convertRateToBase = '0.001000'
            existingUnitsUpdated = 0; stockSeeded = $false; bomSeeded = $false; verifiedRows = $persisted
        })
    }
    $private = Get-Content -Raw (Join-Path $tempRoot 'qualification-db.json') | ConvertFrom-Json
    $builder = ConvertFrom-MrxConnectionString -ConnectionString $SourceBuilder.ConnectionString
    foreach ($key in @('User ID','UserID','Uid','User','Password','Pwd','Server','Host','Data Source','Database','Initial Catalog')) { $builder.Remove($key) | Out-Null }
    $builder['Server'] = '127.0.0.1'; $builder['Database'] = $targetDatabase
    $builder['User ID'] = $private.username; $builder['Password'] = $private.password
    $script:qualificationTargetConnection = $builder.ConnectionString
    $settings = Get-Content -Raw (Join-Path $repoRoot $SourceSettings) | ConvertFrom-Json
    $settings.ConnectionStrings.DefaultConnection = $builder.ConnectionString
    $settings.JwtSettings.SecretKey = $private.jwtSecret
    $settings.Cors.AllowedOrigins = @('http://mrx-qualification.invalid:5174')
    $settings.AllowedHosts = 'mrx-qualification.invalid;127.0.0.1;localhost'
    New-Item -ItemType Directory -Path $runtimeDirectory | Out-Null
    $settings | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'appsettings.json') -Encoding utf8
}

function Invoke-MrxCampaignBuild {
    param([Parameter(Mandatory = $true)][ValidateSet('Frontend','Backend')][string]$Kind)
    $paths = Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId
    $cachePath = Join-Path $paths.root "build-$Kind.json"
    $inputs = Get-MrxBuildInputs -RepoRoot $repoRoot -Kind $Kind
    $outputs = Get-MrxBuildOutputs -RepoRoot $repoRoot -Kind $Kind
    $cache = if (Test-Path -LiteralPath $cachePath) { [IO.File]::ReadAllText($cachePath) | ConvertFrom-Json } else { $null }
    if ($null -ne $cache -and $cache.inputKey -ceq $inputs.key -and $cache.outputKey -ceq $outputs.key -and $outputs.fileCount -gt 0) {
        Write-Host "[BUILD REUSE] $Kind input/output hashes verified (not a cached verdict)."
        return
    }
    if ($Kind -eq 'Frontend') { Invoke-Npm -Arguments @('run','build:fe') }
    else { Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @('build','backend/src/IPCManagement.Api/IPCManagement.Api.csproj','-c','Release','--no-restore') }
    $after = Get-MrxBuildInputs -RepoRoot $repoRoot -Kind $Kind
    if ($after.key -cne $inputs.key) { throw 'Product build inputs changed while building.' }
    $outputs = Get-MrxBuildOutputs -RepoRoot $repoRoot -Kind $Kind
    if ($outputs.fileCount -eq 0) { throw 'Product build did not produce outputs.' }
    Write-EvidenceJson -Path $cachePath -Value @{inputKey=$inputs.key;outputKey=$outputs.key;inputs=$inputs.files;outputs=$outputs.files}
}

function Invoke-PreparedG1Evidence {
    param([Parameter(Mandatory = $true)]$SourceBuilder)

    $targetBuilder = ConvertFrom-MrxConnectionString -ConnectionString $SourceBuilder.ConnectionString
    $targetBuilder['Database'] = $targetDatabase
    $environment = @{
        'MRX_E2E_PREPARED_DATABASE' = '1'
        'MRX_E2E_DATABASE' = $targetDatabase
        'MRX_EVIDENCE_RUN_ID' = $runId
        'IPC_MRX_MYSQL_DEFAULTS_FILE' = $defaultsFile
        'IPC_MRX_TARGET_CONNECTION_STRING' = $targetBuilder.ConnectionString
        'MRX_E2E_PROCESS_FILE' = $processFile
    }
    if ($CampaignId) {
        $environment['MRX_E2E_CAMPAIGN_ID'] = $CampaignId
        $environment['MRX_EVIDENCE_ATTEMPT_ID'] = $campaignAttemptId
    }
    if ($Profile -eq 'G1') {
        Invoke-Npm -Arguments @('run', 'test:e2e:mrx:g1') -Environment $environment
        return
    }
    if ($CampaignId) {
        Invoke-MrxCampaignBuild -Kind Frontend
        Invoke-MrxCampaignBuild -Kind Backend
    } else {
        Invoke-Npm -Arguments @('run', 'build:fe')
        Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
            'build', 'backend/src/IPCManagement.Api/IPCManagement.Api.csproj', '-c', 'Release', '--no-restore'
        )
    }
    $environment['MRX_E2E_PROFILE'] = 'qualification'
    $environment['MRX_E2E_CREDENTIALS_FILE'] = $qualificationCredentialsFile
    $environment['MRX_E2E_CONTENT_ROOT'] = $runtimeDirectory
    $environment['MRX_E2E_BASE_URL'] = 'http://127.0.0.1:5174'
    $environment['IPC_MRX_TARGET_CONNECTION_STRING'] = $qualificationTargetConnection
    $environment['MRX_E2E_ARTIFACT_DIRECTORY'] = Join-Path $evidenceRoot 'runtime'
    $environment['MRX_E2E_API_SHA256'] = (Get-FileHash -LiteralPath (Join-Path $repoRoot '.artifacts/dotnet/bin/IPCManagement.Api/release/IPCManagement.Api.dll') -Algorithm SHA256).Hash
    $environment['MRX_E2E_FE_SHA256'] = (Get-FileHash -LiteralPath (Join-Path $repoRoot 'frontend/dist/index.html') -Algorithm SHA256).Hash
    $environment['MRX_E2E_SOAK_SECONDS'] = '3600'
    $environment['MRX_E2E_PRIVATE_ARTIFACT_DIRECTORY'] = Join-Path $evidenceRoot 'private-diagnostics'
    $environment['MRX_E2E_LOGIN_BUDGET_FILE'] = Join-Path $tempRoot 'login-budget.txt'
    New-Item -ItemType Directory -Path $environment['MRX_E2E_ARTIFACT_DIRECTORY'] | Out-Null
    $builtFiles = [ordered]@{}
    foreach ($buildRoot in @('frontend/dist', '.artifacts/dotnet/bin/IPCManagement.Api/release')) {
        foreach ($file in @(Get-ChildItem -LiteralPath (Join-Path $repoRoot $buildRoot) -File -Recurse | Sort-Object FullName)) {
            $builtFiles[$file.FullName.Substring($repoRoot.Length + 1)] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        }
    }
    Write-EvidenceJson -Path (Join-Path $evidenceRoot 'build-manifest.json') -Value ([ordered]@{
        apiSha256 = $environment['MRX_E2E_API_SHA256']; frontendIndexSha256 = $environment['MRX_E2E_FE_SHA256']
        configuration = 'Release'; sourceHead = $candidateManifest.head
        workingTreeSha256 = $candidateManifest.workingTreeSha256
        files = $builtFiles; buildTreeSha256 = Get-MrxEvidenceTextHash -Text ($builtFiles | ConvertTo-Json -Compress)
    })
    $phases = [ordered]@{
        functional = '@G[1-6]-'; desktop = '@G7-Desktop'; memory = '@G7-Memory'
        'endurance-smoke' = '@G8-Five-User'; endurance = '@G8-Five-User'; 'http-host' = '@G8-HTTP'
    }
    if ($Diagnostic -and $Diagnostic -notin @('CampaignBaseline', 'RepairCheck', 'RemainingFE', 'MeasurementCheck', 'Quantitative', 'LifecycleAcceptance', 'MenuIntegrityPerformance')) {
        $diagnosticCases = @{ Admission = '@G2-'; Golden = '@G1-Golden|Stock oracle rejects'; Supplemental = '@G3-Submitted'; Race = '@G4-Race'; Recovery = '@G5-Recovery Committed initial'; SupplementalRecovery = '@G5-Recovery Committed supplemental'; Session = '@G5-Session'; CombinedFE = '@G6-Merged-Customer|@G3-Submitted'; SourceCustomer = '@G6-Merged-Customer'; CustomerWorstCase = '@G6-Merged-Customer|@G6-Customer-Concurrency'; SourceAtomicity = '@G6-Direct-Source-Edit'; ExportConsistency = '@T7-Export-Consistency'; UiAcceptance = '@MRX-UiAcceptance'; ModalAcceptance = '@MRX-ModalAcceptance'; LifecycleTail = '@G5-Coordinated|@G6-(Direct-Source-Edit|Merged-Customer)'; Coordinated = '@G5-Coordinated'; MenuCoverage = '@G6-Menu-Coverage'; MenuReimport = '@G6-Menu-Coverage reimports-and-groups' }
        $phases = [ordered]@{ functional = $diagnosticCases[$Diagnostic] }
    }
    if ($Diagnostic -eq 'RepairCheck') {
        $repairCase = if ($env:MRX_COORDINATED_TAIL_RECEIPT) { '@G5-Coordinated' } else { '@G6-Direct-Source-Edit' }
        $phases = [ordered]@{ functional=$repairCase }
    }
    if ($Diagnostic -eq 'RemainingFE') {
        $phases = [ordered]@{ functional='@G3-Submitted|@G5-Coordinated|@G6-Merged-Customer'; memory='@G7-Memory'; 'endurance-smoke'='@G8-Five-User' }
    }
    if ($Diagnostic -eq 'MeasurementCheck') {
        $phases = [ordered]@{ functional='@G1-Golden'; memory='@G7-Memory'; 'endurance-smoke'='@G8-Five-User'; desktop='@G7-Desktop' }
    }
    if ($Diagnostic -eq 'Quantitative') {
        $phases = [ordered]@{ functional='@G1-Golden'; 'endurance-smoke'='@G8-Five-User'; 'http-host'='@G8-HTTP'; endurance='@G8-Five-User'; desktop='@G7-Desktop' }
    }
    if ($Diagnostic -eq 'CampaignBaseline') {
        $phases.Remove('endurance'); $phases.Remove('http-host')
    }
    if ($Diagnostic -eq 'LifecycleAcceptance') {
        $phases = Get-MrxLifecycleAcceptancePhases
    }
    if ($Diagnostic -eq 'MenuIntegrityPerformance') {
        $phases = Get-MrxMenuIntegrityPerformancePhases
    }
    $phaseResults = [Collections.Generic.List[object]]::new()
    foreach ($phase in $phases.Keys) {
        $environment['MRX_E2E_PHASE'] = $phase
        $environment['MRX_E2E_SOAK_SECONDS'] = if ($phase -eq 'endurance-smoke') { '120' } else { '3600' }
        $budgetMs = switch ($phase) {
            'data-path-performance' { 1800000 }
            'adversarial' { 900000 }
            'functional' { if ($Diagnostic -eq 'MenuIntegrityPerformance') { 1800000 } elseif ($CampaignId -and $Diagnostic -eq 'LifecycleAcceptance') { 1200000 } else { 900000 } }
            'endurance' { 3900000 }
            'memory' { 900000 }
            'http-host' { 900000 }
            default { 420000 }
        }
        $phaseWatch = [Diagnostics.Stopwatch]::StartNew()
        Write-Host "[PHASE START] $phase UTC=$([DateTime]::UtcNow.ToString('o')) budgetMs=$budgetMs; fail-fast, no next phase after failure."
        try {
            Assert-EvidencePortsFree
            if ($CampaignId) { Get-MrxCampaignStorage -Root (Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId).root -WorkingDirectory $tempRoot | Out-Null }
            Invoke-Npm -Arguments @('run', 'test:e2e:mrx', '--', '--grep', $phases[$phase], '--headed', '--workers=1', '--max-failures=1', '--global-timeout', ([string]$budgetMs), '--output', (Join-Path $evidenceRoot "playwright-$phase")) -Environment $environment
            if ($Diagnostic -eq 'ExportConsistency') {
                $remainingSeconds = [int][Math]::Floor(($budgetMs - $phaseWatch.ElapsedMilliseconds) / 1000)
                if ($remainingSeconds -lt 1) { throw 'Export owner has no remaining phase budget.' }
                $hangBudget = ([string][Math]::Min(300, $remainingSeconds)) + 's'
                Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
                    'test', 'backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj', '-c', 'Release', '--no-build', '--no-restore',
                    '--filter', 'FullyQualifiedName~IPCManagement.Api.Tests.Integration.MrxExportConsistencyMySqlTests',
                    '--blame-hang-timeout', $hangBudget, '--blame-hang-dump-type', 'none',
                    '--results-directory', (Join-Path $evidenceRoot 'native-export-test-results')
                ) -Environment $environment
            }
            $phaseResults.Add(@{ phase=$phase; result='PASS' })
            Write-Host "[PHASE PASS] $phase UTC=$([DateTime]::UtcNow.ToString('o'))"
        } catch {
            $phaseResults.Add(@{ phase=$phase; result='FAIL'; detail='See phase process/Playwright output; no later phase started.' })
            Write-Host "[PHASE STOP] $phase failed; long-run admission denied."
            Stop-RunOwnedE2eProcesses
            Assert-EvidencePortsFree
            throw
        } finally {
            Write-EvidenceJson -Path (Join-Path $evidenceRoot 'qualification-phases.json') -Value $phaseResults.ToArray()
            if ($CampaignId) { Get-MrxCampaignStorage -Root (Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId).root -WorkingDirectory $tempRoot -ReserveBytes 0 | Out-Null }
        }
    }
    if (@($phaseResults | Where-Object { $_.result -eq 'FAIL' }).Count -gt 0) { throw 'Qualification phase failures retained; independent executable lanes were collected, no failed gate is waived.' }
}

function Invoke-RepositoryGates {
    Write-Host '[GATE START] npm run verify (functional tests may already be complete)'
    if ($Profile -eq 'G1') {
        Invoke-Npm -Arguments @('run', 'gen:api')
        Invoke-Npm -Arguments @('run', 'gen:api')
    }
    Invoke-Npm -Arguments @('run', 'verify')
    Write-Host '[GATE PASS] repository verification'
    Write-Host '[GATE START] evidence/recovery contracts; controller is still running'
    Invoke-CheckedProcess -FilePath 'dotnet' -Arguments @(
        'test', 'backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj', '-c', 'Release', '--no-restore',
        '--logger', 'console;verbosity=normal',
        '--filter', 'FullyQualifiedName~RecoveryScriptContractTests|FullyQualifiedName~MrxDisposableEvidenceContractTests'
    )
    Write-Host '[GATE PASS] evidence/recovery contracts'
    Invoke-CheckedProcess -FilePath 'git' -Arguments @('diff', '--check')
    Write-Host '[GATE PASS] diff check; source readback and exact cleanup still pending'
}

function Assert-SourceAfterEvidence {
    param([Parameter(Mandatory = $true)]$SourceBefore, [switch]$StableSchema)
    $sourceAfter = Get-DatabaseManifest -DatabaseName 'ipcmanagement' -StableSchema:$StableSchema
    if ($SourceBefore.tableCount -ne $sourceAfter.tableCount -or
        (ConvertTo-Json $SourceBefore.schemaChecksums -Compress) -cne (ConvertTo-Json $sourceAfter.schemaChecksums -Compress) -or
        ($SourceBefore.migrationIds -join '|') -ne ($sourceAfter.migrationIds -join '|')) {
        throw 'Source migration or schema identity changed during the evidence run.'
    }
    $dataChanged = (ConvertTo-Json $SourceBefore.rowCounts -Compress) -ne
        (ConvertTo-Json $sourceAfter.rowCounts -Compress) -or
        (ConvertTo-Json $SourceBefore.tableChecksums -Compress) -ne
        (ConvertTo-Json $sourceAfter.tableChecksums -Compress)
    Write-EvidenceJson -Path (Join-Path $evidenceRoot 'source-after-manifest.json') -Value ([ordered]@{
        manifest = $sourceAfter
        migrationAndSchemaIdentityUnchanged = $true
        concurrentDataChangeObserved = $dataChanged
    })
    if ($Profile -eq 'Qualification' -and $dataChanged) { throw 'Read-only source data changed; qualification cannot pass and source must not be restored automatically.' }
}

function Stop-RunOwnedE2eProcesses {
    if (-not (Test-Path -LiteralPath $processFile)) { return }
    $state = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
    if ($state.database -ne $targetDatabase -or $state.runId -ne $runId) {
        throw 'E2E process ownership record does not match this evidence run.'
    }
    if ($Profile -eq 'Qualification') {
        if ($null -eq $state.PSObject.Properties['processes'] -or @($state.processes).Count -ne @($state.pids).Count) {
            throw 'Missing qualification process creation identities; refusing PID-only shutdown.'
        }
        $errors = [Collections.Generic.List[string]]::new()
        foreach ($owned in @($state.processes)) {
            $live = $null
            try {
                if ([int]$owned.pid -le 0 -or [string]$owned.startTimeUtcTicks -notmatch '^\d+$' -or [int]$owned.pid -notin @($state.pids)) {
                    throw 'Invalid owned process identity.'
                }
                $live = Get-Process -Id ([int]$owned.pid) -ErrorAction SilentlyContinue
                if ($null -eq $live) { continue }
                $handle = $live.SafeHandle
                if ($live.StartTime.ToUniversalTime().Ticks.ToString() -cne [string]$owned.startTimeUtcTicks -or $live.Id -eq $PID) {
                    throw 'Process creation identity changed; refusing to stop a reused PID.'
                }
                $live.Kill()
                if (-not $live.WaitForExit(5000)) { throw 'Run-owned process did not stop.' }
            }
            catch { $errors.Add($_.Exception.Message) }
            finally { if ($null -ne $live) { $live.Dispose() } }
        }
        if ($errors.Count -gt 0) { throw ($errors -join '; ') }
    }
    else {
        foreach ($processId in @($state.pids)) {
            Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $processFile -Force
}

function Assert-EvidencePortsFree {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 5174, 5263 -ErrorAction SilentlyContinue)
    if ($listeners.Count -gt 0) {
        throw "Run-owned listeners remain on ports 5174/5263: $($listeners.OwningProcess -join ',')."
    }
}

function Assert-CloneManifest {
    param([Parameter(Mandatory = $true)]$Source, [Parameter(Mandatory = $true)]$Target)
    if ($Source.tableCount -ne $Target.tableCount -or
        (ConvertTo-Json $Source.schemaChecksums -Compress) -cne (ConvertTo-Json $Target.schemaChecksums -Compress) -or
        ($Source.migrationIds -join '|') -ne ($Target.migrationIds -join '|') -or
        (ConvertTo-Json $Source.rowCounts -Compress) -ne (ConvertTo-Json $Target.rowCounts -Compress) -or
        (ConvertTo-Json $Source.tableChecksums -Compress) -ne (ConvertTo-Json $Target.tableChecksums -Compress)) {
        throw 'Pre-migration clone manifest does not match the source manifest.'
    }
}

function Assert-MrxCampaignOwnership {
    param([Parameter(Mandatory = $true)][string]$CampaignId)
    $paths = Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId
    $receipt = Read-MrxCampaignReceipt -Path $paths.receipt -CampaignId $CampaignId -Database $paths.database
    $server = (Invoke-MySqlQuery -Sql "SELECT CONCAT(@@server_uuid, ':', @@port);") -join ''
    if ($server -cne $receipt.serverIdentity) { throw 'Campaign server identity changed.' }
    $count = [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$($paths.database)';")
    if ($count -ne 1) { throw 'Owned campaign database is missing; no replacement is permitted.' }
    $manifest = Get-DatabaseManifest -DatabaseName $paths.database -StableSchema
    $schemaHash = Get-MrxEvidenceTextHash -Text ($manifest.schemaChecksums | ConvertTo-Json -Compress)
    if ($schemaHash -cne $receipt.schemaHash -or ($manifest.migrationIds -join '|') -cne ($receipt.migrationIds -join '|')) { throw 'Campaign schema/migration identity changed.' }
    $mode = @(Invoke-MySqlQuery -Database $paths.database -Sql 'SELECT Mode FROM systemoperationmodes WHERE Id=1;')
    if ($mode.Count -ne 1 -or $mode[0] -cne 'MATERIAL_RECONCILIATION') { throw 'Campaign requires existing MRX mode; no mode switch is permitted.' }
    $owners = @(Invoke-MySqlQuery -Sql "SELECT JSON_UNQUOTE(JSON_EXTRACT(User_attributes, '$.metadata.mrxEvidenceRunId')) FROM mysql.user WHERE User = '$($receipt.principalName)' AND Host = '127.0.0.1';")
    if ($owners.Count -ne 1 -or $owners[0] -cne $CampaignId) { throw 'Campaign service principal ownership changed.' }
    $grants = @(Invoke-MySqlQuery -Sql "SHOW GRANTS FOR '$($receipt.principalName)'@'127.0.0.1';")
    $expected = 'GRANT SELECT, INSERT, UPDATE, DELETE ON `' + $paths.database + '`.* TO `' + $receipt.principalName + '`@`127.0.0.1`'
    if (@($grants | Where-Object { $_ -ceq $expected }).Count -ne 1 -or
        @($grants | Where-Object { $_ -cne $expected -and $_ -cne ('GRANT USAGE ON *.* TO `' + $receipt.principalName + '`@`127.0.0.1`') }).Count -ne 0) { throw 'Campaign principal grants differ from exact clone-only CRUD.' }
    return $receipt
}

function Initialize-MrxCampaign {
    param([Parameter(Mandatory = $true)][string]$CampaignId, [Parameter(Mandatory = $true)]$SourceBuilder)
    $paths = Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId
    Assert-MrxEvidenceTarget -DatabaseName $targetDatabase -RunId $CampaignId | Out-Null
    if (Test-Path -LiteralPath $paths.receipt) { throw 'Campaign already initialized; use Run, never recreate.' }
    $creationReceipt = Join-Path $paths.root 'creation-attempt.json'
    if (Test-Path -LiteralPath $creationReceipt) { throw 'Interrupted campaign Start requires ownership review; no repeated dump/create/restore.' }
    Assert-MrxEvidenceTargetAbsent -DatabaseName $targetDatabase -ReadDatabaseCount {
        param($DatabaseName)
        [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
    }
    Assert-EvidencePortsFree
    $server = (Invoke-MySqlQuery -Sql "SELECT CONCAT(@@server_uuid, ':', @@port);") -join ''
    if ([string]::IsNullOrWhiteSpace($server)) { throw 'Cannot establish campaign server identity.' }
    $source = Get-DatabaseManifest -DatabaseName 'ipcmanagement' -StableSchema
    if ('20261101124531_RetainWeeklyMenuImportSnapshots' -notin $source.migrationIds) { throw 'Source migration prerequisite missing; campaign cannot migrate main or clone.' }
    Write-EvidenceJson -Path (Join-Path $paths.root 'source-manifest.json') -Value $source
    Write-EvidenceJson -Path $creationReceipt -Value ([ordered]@{
        campaignId = $CampaignId; database = $targetDatabase; serverIdentity = $server
        ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        acquisitionAttemptedAtUtc = [DateTime]::UtcNow.ToString('o')
    })
    Invoke-CheckedProcess -FilePath $mysqldump -Arguments @("--defaults-extra-file=$defaultsFile", '--single-transaction', '--routines', '--triggers', '--events', '--hex-blob', '--set-gtid-purged=OFF', '--default-character-set=utf8mb4', "--result-file=$dumpPath", 'ipcmanagement')
    if (-not (Test-Path -LiteralPath $dumpPath) -or -not (Select-String -LiteralPath $dumpPath -Pattern 'Dump completed' -Quiet)) { throw 'Campaign source dump did not complete.' }
    if ($CampaignId) { Get-MrxCampaignStorage -Root (Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId).root -WorkingDirectory $tempRoot | Out-Null }
    $collation = (Invoke-MySqlQuery -Sql "SELECT DEFAULT_COLLATION_NAME FROM information_schema.schemata WHERE schema_name = 'ipcmanagement';") -join ''
    if ($collation -notmatch '^[A-Za-z0-9_]+$') { throw 'Source collation is unsafe.' }
    Invoke-MySqlQuery -Sql "CREATE DATABASE ``$targetDatabase`` CHARACTER SET utf8mb4 COLLATE $collation;" | Out-Null
    $script:targetCreated = $true
    Invoke-CheckedProcess -FilePath $mysql -Arguments @("--defaults-extra-file=$defaultsFile", $targetDatabase) -StandardInputPath $dumpPath
    $clone = Get-DatabaseManifest -DatabaseName $targetDatabase -StableSchema
    Assert-CloneManifest -Source $source -Target $clone
    Remove-Item -LiteralPath $dumpPath -Force
    $mode = @(Invoke-MySqlQuery -Database $targetDatabase -Sql 'SELECT Mode FROM systemoperationmodes WHERE Id=1;')
    if ($mode.Count -ne 1 -or $mode[0] -cne 'MATERIAL_RECONCILIATION') { throw 'Campaign clone is not MRX; bootstrap cannot switch its mode.' }
    Initialize-QualificationCredentials -SourceBuilder $SourceBuilder
    $credentials = @{
        actors = [IO.File]::ReadAllText($qualificationCredentialsFile)
        settings = [IO.File]::ReadAllText((Join-Path $runtimeDirectory 'appsettings.json'))
        targetConnection = $qualificationTargetConnection
    }
    Protect-MrxCampaignCredentials -Path $paths.credentials -Credentials $credentials
    Write-EvidenceJson -Path $paths.receipt -Value ([ordered]@{
        schemaVersion = 1; campaignId = $CampaignId; database = $targetDatabase
        ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        serverIdentity = $server; createdAtUtc = [DateTime]::UtcNow.ToString('o')
        schemaHash = Get-MrxEvidenceTextHash -Text ($clone.schemaChecksums | ConvertTo-Json -Compress)
        migrationIds = $clone.migrationIds; principalName = $runtimePrincipal
        sourceManifestPath = Join-Path $paths.root 'source-manifest.json'
        encryptedCredentialsPath = $paths.credentials
        prerequisiteReceiptPaths = @(Join-Path $paths.root 'conversion-prerequisite-bootstrap.json' | Where-Object { Test-Path -LiteralPath $_ })
    })
    Assert-MrxCampaignOwnership -CampaignId $CampaignId | Out-Null
    return @{ resourceDisposition = 'RETAINED_AUTHORIZED'; cleanupCompleted = $false }
}

function Invoke-MrxCampaignAttempt {
    param(
        [Parameter(Mandatory = $true)][string]$CampaignId,
        [Parameter(Mandatory = $true)][string]$Diagnostic,
        [Parameter(Mandatory = $true)]$SourceBuilder
    )
    $receipt = Assert-MrxCampaignOwnership -CampaignId $CampaignId
    $credentials = Unprotect-MrxCampaignCredentials -Path $receipt.encryptedCredentialsPath
    Assert-EvidencePortsFree
    $script:qualificationCredentialsFile = Join-Path $tempRoot 'qualification-credentials.json'
    $script:qualificationTargetConnection = $credentials.targetConnection
    try {
        New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
        [IO.File]::WriteAllText($qualificationCredentialsFile, $credentials.actors, [Text.UTF8Encoding]::new($false))
        [IO.File]::WriteAllText((Join-Path $runtimeDirectory 'appsettings.json'), $credentials.settings, [Text.UTF8Encoding]::new($false))
        Invoke-PreparedG1Evidence -SourceBuilder $SourceBuilder
        return @{ resourceDisposition = 'RETAINED_AUTHORIZED'; cleanupCompleted = $false }
    } finally {
        try { Stop-RunOwnedE2eProcesses }
        finally {
            try { Assert-EvidencePortsFree }
            finally {
                if (Test-Path -LiteralPath $qualificationCredentialsFile) { Remove-Item -LiteralPath $qualificationCredentialsFile -Force }
                if (Test-Path -LiteralPath $runtimeDirectory) { Remove-Item -LiteralPath $runtimeDirectory -Recurse -Force }
            }
        }
    }
}

function Complete-MrxCampaign {
    param(
        [Parameter(Mandatory = $true)][string]$CampaignId,
        [Parameter(Mandatory = $true)][ValidateSet('Finish','Abort')][string]$Disposition,
        [Parameter(Mandatory = $true)]$SourceBuilder
    )
    $receipt = Assert-MrxCampaignOwnership -CampaignId $CampaignId
    $paths = Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId
    if ($Disposition -eq 'Finish') {
        $packetPath = Join-Path $paths.root 'acceptance/final-package.json'
        Assert-MrxCampaignPath -Path $packetPath -Root $paths.root | Out-Null
        $packet = [IO.File]::ReadAllText($packetPath) | ConvertFrom-Json
        $candidate = Get-CandidateManifest
        if ($packet.schemaVersion -ne 1 -or $packet.parentTask -ne 8 -or $packet.campaignId -cne $CampaignId -or
            $packet.database -cne $paths.database -or $packet.candidateSha256 -cne $candidate.workingTreeSha256) { throw 'Finish requires the current candidate-bound parent Task8 packet.' }
        $required = @('LifecycleAcceptance','Desktop','Memory','Endurance','HttpHost','RepositoryVerify')
        if (@($packet.gates).Count -ne $required.Count -or @($packet.gates.id | Sort-Object -Unique).Count -ne $required.Count) { throw 'Parent packet required gates are incomplete or duplicated.' }
        foreach ($id in $required) {
            $gate = @($packet.gates | Where-Object { $_.id -ceq $id })
            if ($gate.Count -ne 1) { throw "Missing parent gate: $id" }
            $file = Assert-MrxCampaignPath -Path $gate[0].path -Root $paths.root
            if ($gate[0].sha256 -cnotmatch '^[A-Fa-f0-9]{64}$' -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -cne $gate[0].sha256) { throw 'Parent gate evidence hash does not match.' }
            $proof = [IO.File]::ReadAllText($file) | ConvertFrom-Json
            if ($proof.id -cne $id -or $proof.campaignId -cne $CampaignId -or $proof.database -cne $paths.database -or
                $proof.status -cne 'PASS' -or $proof.candidateSha256 -cne $packet.candidateSha256) { throw 'Parent gate did not pass for this gate, campaign and final candidate.' }
        }
    }
    $sourceError = $null
    try { Assert-SourceAfterEvidence -SourceBefore ([IO.File]::ReadAllText($receipt.sourceManifestPath) | ConvertFrom-Json) -StableSchema }
    catch { $sourceError = $_.Exception.Message }
    $errors = [Collections.Generic.List[string]]::new()
    try { Stop-RunOwnedE2eProcesses } catch { $errors.Add('process cleanup: ' + $_.Exception.Message) }
    try {
        Invoke-MySqlQuery -Sql "DROP DATABASE ``$($paths.database)``;" | Out-Null
        Assert-MrxEvidenceTargetAbsent -DatabaseName $paths.database -ReadDatabaseCount {
            param($DatabaseName)
            [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
        }
    } catch { $errors.Add('target cleanup: ' + $_.Exception.Message) }
    try {
        Invoke-MySqlQuery -Sql "DROP USER '$($receipt.principalName)'@'127.0.0.1';" | Out-Null
        if ([int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM mysql.user WHERE User = '$($receipt.principalName)' AND Host = '127.0.0.1';") -ne 0) { throw 'Campaign service principal remains.' }
    } catch { $errors.Add('principal cleanup: ' + $_.Exception.Message) }
    try { Assert-EvidencePortsFree } catch { $errors.Add('listener cleanup: ' + $_.Exception.Message) }
    if ($errors.Count -eq 0) {
        try { Remove-Item -LiteralPath $paths.credentials -Force } catch { $errors.Add('credential cleanup: ' + $_.Exception.Message) }
    }
    $status = if ($errors.Count -gt 0) { 'BLOCKED_CLEANUP' } elseif ($null -ne $sourceError) { 'NEEDS_EVIDENCE' } elseif ($Disposition -eq 'Abort') { 'ABORTED' } else { 'PASS' }
    $result = [ordered]@{
        campaignId = $CampaignId; disposition = $Disposition; status = $status
        cleanupCompleted = ($errors.Count -eq 0); errors = $errors.ToArray(); sourceError = $sourceError
    }
    Write-EvidenceJson -Path (Join-Path $paths.root 'campaign-cleanup.json') -Value $result
    return $result
}

function Invoke-MrxCampaignCommand {
    param([Parameter(Mandatory = $true)][string]$CampaignId)
    $paths = Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId
    $lock = $null; $ownsTemp = $false; $candidate = $null; $baseline = $null; $result = $null
    if ($Mode -eq 'Start' -and (Test-Path -LiteralPath $paths.root)) { throw 'Campaign Start requires a fresh evidence root; existing or partial resources need ownership review, never automatic retry.' }
    if ($Mode -ne 'Preflight') {
        Assert-MrxCampaignPath -Path $paths.receipt -Root $paths.root | Out-Null
        if ($Mode -eq 'Start') { New-Item -ItemType Directory -Path $paths.root | Out-Null }
        if ($Mode -ne 'Start') { Read-MrxCampaignReceipt -Path $paths.receipt -CampaignId $CampaignId -Database $paths.database | Out-Null }
        $lock = Enter-MrxCampaignLock -Path $paths.lock
    }
    try {
        if ($Mode -eq 'Preflight') {
            $script:tempRoot = Join-Path ([IO.Path]::GetTempPath()) ("ipc-mrx-preflight-" + [Guid]::NewGuid().ToString('N'))
            $script:defaultsFile = Join-Path $tempRoot 'mysql.defaults.cnf'
        }
        if (Test-Path -LiteralPath $tempRoot) { throw 'Private working directory already exists; review interrupted ownership before retry.' }
        New-Item -ItemType Directory -Path $tempRoot | Out-Null
        $ownsTemp = $true
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $directories = @($tempRoot)
        if ($Mode -ne 'Preflight') { $directories += $paths.root }
        foreach ($directory in $directories) {
            & icacls.exe $directory '/inheritance:r' '/grant:r' "*${sid}:(OI)(CI)(F)" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Cannot establish private campaign directory ACL.' }
        }
        $connection = $env:IPC_MRX_SOURCE_CONNECTION_STRING
        if ([string]::IsNullOrWhiteSpace($connection)) { $connection = ([IO.File]::ReadAllText((Join-Path $repoRoot $SourceSettings)) | ConvertFrom-Json).ConnectionStrings.DefaultConnection }
        $builder = New-RunOwnedDefaultsFile -ConnectionString $connection
        $hostName = Get-RequiredConnectionValue $builder @('Server','Host','Data Source')
        if ($hostName -notin @('localhost','127.0.0.1','::1',$env:COMPUTERNAME)) { throw 'Campaign requires the approved local MySQL server.' }
        $script:mysql = Resolve-MySqlExecutable 'mysql'
        $script:mysqldump = Resolve-MySqlExecutable 'mysqldump'
        Get-MrxCampaignStorage -Root $paths.root -WorkingDirectory $tempRoot | Out-Null
        if ($Mode -eq 'Preflight') {
            if (Test-Path -LiteralPath $paths.root) {
                $receipt = Assert-MrxCampaignOwnership -CampaignId $CampaignId
                Unprotect-MrxCampaignCredentials -Path $receipt.encryptedCredentialsPath | Out-Null
            } else {
                Assert-MrxEvidenceTargetAbsent -DatabaseName $paths.database -ReadDatabaseCount {
                    param($DatabaseName)
                    [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
                }
                Get-MrxQualificationBCryptPath | Out-Null
            }
            Assert-EvidencePortsFree
            $result = @{status='READY';cleanupCompleted=$false;resourceDisposition='UNCHANGED'}
        } else {
            $candidate = Get-CandidateManifest
            $script:candidateManifest = $candidate
            if ($Mode -eq 'Start') {
                Get-MrxQualificationBCryptPath | Out-Null
                $result = Initialize-MrxCampaign -CampaignId $CampaignId -SourceBuilder $builder
                $baseline = [IO.File]::ReadAllText((Join-Path $paths.root 'source-manifest.json')) | ConvertFrom-Json
                $result.status = 'RETAINED_AUTHORIZED'
            } elseif ($Mode -eq 'Run') {
                $receipt = Assert-MrxCampaignOwnership -CampaignId $CampaignId
                $baseline = [IO.File]::ReadAllText($receipt.sourceManifestPath) | ConvertFrom-Json
                Assert-SourceAfterEvidence -SourceBefore $baseline -StableSchema
                $script:campaignAttemptId = [DateTime]::UtcNow.ToString("yyyyMMdd't'HHmmss'z'") + '_' + [Guid]::NewGuid().ToString('N').Substring(0,6)
                $script:evidenceRoot = Join-Path $paths.root "attempts/$campaignAttemptId"
                New-Item -ItemType Directory -Path $evidenceRoot | Out-Null
                Write-EvidenceJson -Path (Join-Path $evidenceRoot 'candidate-source-manifest.json') -Value $candidate
                $result = Invoke-MrxCampaignAttempt -CampaignId $CampaignId -Diagnostic $Diagnostic -SourceBuilder $builder
                $result.status = 'DIAGNOSTIC_PASS'
                $result.attemptId = $campaignAttemptId
            } else {
                $result = Complete-MrxCampaign -CampaignId $CampaignId -Disposition $Mode -SourceBuilder $builder
            }
        }
    } catch {
        $result = @{status='BLOCKED';cleanupCompleted=$false;resourceDisposition='RETAINED_FOR_OWNERSHIP_REVIEW';message=$_.Exception.Message}
    } finally {
        try {
            if ($null -eq $baseline -and $Mode -eq 'Start' -and (Test-Path -LiteralPath (Join-Path $paths.root 'source-manifest.json'))) {
                $baseline = [IO.File]::ReadAllText((Join-Path $paths.root 'source-manifest.json')) | ConvertFrom-Json
            }
            if ($null -ne $baseline) { Assert-SourceAfterEvidence -SourceBefore $baseline -StableSchema }
            if ($null -ne $candidate) {
                $after = Get-CandidateManifest
                if ($after.workingTreeSha256 -cne $candidate.workingTreeSha256 -or $after.head -cne $candidate.head) { throw 'Campaign candidate changed during execution.' }
            }
        } catch { $result.status = 'NEEDS_EVIDENCE'; $result.message = $_.Exception.Message }
        try { if ($ownsTemp) { Remove-Item -LiteralPath $tempRoot -Recurse -Force } }
        catch { $result.status = 'BLOCKED_CLEANUP'; $result.cleanupCompleted = $false; $result.message = 'Private working-file cleanup failed.' }
        finally {
            try {
                if ($Mode -ne 'Preflight') {
                    try { Get-MrxCampaignStorage -Root $paths.root -ReserveBytes 0 | Out-Null }
                    catch { $result.status = 'BLOCKED_STORAGE'; $result.message = $_.Exception.Message }
                    Write-EvidenceJson -Path (Join-Path $paths.root 'campaign-command.json') -Value $result
                    if ($Mode -eq 'Run' -and $evidenceRoot -cne $paths.root) { Write-EvidenceJson -Path (Join-Path $evidenceRoot 'outcome.json') -Value $result }
                    if ($Mode -in @('Finish','Abort')) { Write-EvidenceJson -Path (Join-Path $paths.root 'campaign-cleanup.json') -Value $result }
                }
            } finally { if ($null -ne $lock) { $lock.Dispose() } }
        }
    }
    return $result
}

if ($CampaignId) {
    $outcome = Invoke-MrxCampaignCommand -CampaignId $CampaignId
    Write-Host "[CAMPAIGN COMPLETE] campaignId=$CampaignId mode=$Mode status=$($outcome.status) cleanupCompleted=$($outcome.cleanupCompleted)"
    if ($outcome.status -in @('READY','RETAINED_AUTHORIZED','DIAGNOSTIC_PASS','PASS','ABORTED')) { exit 0 }
    exit 1
}

New-Item -ItemType Directory -Force -Path $evidenceRoot, $tempRoot | Out-Null
Assert-MrxEvidenceTarget -DatabaseName $targetDatabase -RunId $runId | Out-Null

try {
    if ($Diagnostic -and $Profile -ne 'Qualification') { throw 'Diagnostic requires the qualification profile.' }
    if ($Profile -eq 'Qualification') {
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        foreach ($directory in @($evidenceRoot, $tempRoot)) {
            & icacls.exe $directory '/inheritance:r' '/grant:r' "*${sid}:(OI)(CI)(F)" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not restrict qualification directory ACLs.' }
        }
        Get-MrxQualificationBCryptPath | Out-Null
        if (-not $automaticActors) {
            if (-not (Test-Path -LiteralPath $qualificationCredentialsFile -PathType Leaf)) { throw 'Explicit qualification credential file does not exist; no fallback permitted.' }
            $rules = (Get-Acl -LiteralPath $qualificationCredentialsFile).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
            if (@($rules | Where-Object { $_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -ne $sid }).Count -gt 0) { throw 'Qualification credentials must have private run-user-only ACLs.' }
            $helperUrl = [Uri]::new((Join-Path $repoRoot 'frontend/tests/e2e-mrx/fixtures/authHelpers.ts')).AbsoluteUri
            Invoke-CheckedProcess -FilePath 'node' -Arguments @('--input-type=module', '--eval', "const m=await import('$helperUrl'); try { m.readQualificationCredentials(); } catch { console.error('Qualification requires five distinct usable role credentials.'); process.exit(1); }")
        }
        if ($Mode -eq 'Execute' -and -not $Diagnostic) {
            foreach ($required in @('frontend/tests/e2e-mrx/specs/g7-desktop-memory.spec.ts', 'frontend/tests/e2e-mrx/specs/g8-five-user-endurance.spec.ts', 'tools/perf/k6/mrx-five-user.js')) {
                if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $required) -PathType Leaf)) {
                    throw "Qualification phase prerequisite is not implemented yet: $required. No clone will be created."
                }
            }
        }
    }
    $sourceConnectionString = $env:IPC_MRX_SOURCE_CONNECTION_STRING
    if ([string]::IsNullOrWhiteSpace($sourceConnectionString) -and $Profile -eq 'Qualification') {
        $sourceConnectionString = (Get-Content -Raw (Join-Path $repoRoot $SourceSettings) | ConvertFrom-Json).ConnectionStrings.DefaultConnection
    }
    if ([string]::IsNullOrWhiteSpace($sourceConnectionString)) { throw 'IPC_MRX_SOURCE_CONNECTION_STRING is required.' }
    $sourceConnectionBuilder = New-RunOwnedDefaultsFile -ConnectionString $sourceConnectionString
    $mysql = Resolve-MySqlExecutable 'mysql'
    $mysqldump = Resolve-MySqlExecutable 'mysqldump'

    Assert-MrxEvidenceTargetAbsent -DatabaseName $targetDatabase -ReadDatabaseCount {
        param($DatabaseName)
        [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
    }

    if ($Mode -eq 'Preflight') {
        Write-Status -Status 'READY' -Message 'Preflight passed without database mutation.'
        $terminalStatus = 'READY'
    }
    else {
        if ($Profile -eq 'Qualification') {
            $candidateManifest = Get-CandidateManifest
            Write-EvidenceJson -Path (Join-Path $evidenceRoot 'candidate-source-manifest.json') -Value $candidateManifest
        }
        $sourceManifest = Get-DatabaseManifest -DatabaseName 'ipcmanagement'
        Write-EvidenceJson -Path (Join-Path $evidenceRoot 'source-manifest.json') -Value $sourceManifest

        $dumpArguments = @(
            "--defaults-extra-file=$defaultsFile", '--single-transaction', '--routines', '--triggers', '--events',
            '--hex-blob', '--set-gtid-purged=OFF', '--default-character-set=utf8mb4',
            "--result-file=$dumpPath", 'ipcmanagement'
        )
        Invoke-CheckedProcess -FilePath $mysqldump -Arguments $dumpArguments
        if (-not (Test-Path -LiteralPath $dumpPath) -or
            -not (Select-String -LiteralPath $dumpPath -Pattern 'Dump completed' -Quiet)) {
            throw "mysqldump output is missing the 'Dump completed' marker."
        }

        $collation = [string](Invoke-MySqlQuery -Sql "SELECT DEFAULT_COLLATION_NAME FROM information_schema.schemata WHERE schema_name = 'ipcmanagement';")
        if ($collation -notmatch '^[A-Za-z0-9_]+$') { throw 'Source collation is unsafe.' }
        Invoke-MySqlQuery -Sql "CREATE DATABASE ``$targetDatabase`` CHARACTER SET utf8mb4 COLLATE $collation;" | Out-Null
        $targetCreated = $true

        Invoke-CheckedProcess -FilePath $mysql -Arguments @("--defaults-extra-file=$defaultsFile", $targetDatabase) -StandardInputPath $dumpPath
        $targetManifest = Get-DatabaseManifest -DatabaseName $targetDatabase
        Write-EvidenceJson -Path (Join-Path $evidenceRoot 'clone-manifest.json') -Value $targetManifest
        Assert-CloneManifest -Source $sourceManifest -Target $targetManifest

        Invoke-MigrationAndRelationalEvidence -SourceBuilder $sourceConnectionBuilder
        Invoke-QueryPlanEvidence
        if ($Profile -eq 'Qualification') { Initialize-QualificationCredentials -SourceBuilder $sourceConnectionBuilder }
        Invoke-PreparedG1Evidence -SourceBuilder $sourceConnectionBuilder
        Invoke-RepositoryGates
        Assert-SourceAfterEvidence -SourceBefore $sourceManifest
        Assert-EvidencePortsFree
        Write-Status -Status 'EVIDENCE_VERIFIED' -Message 'Clone, migrations, relational tests, query plans, G1 and repository gates passed.'
        $terminalStatus = if ($Diagnostic) { 'DIAGNOSTIC_PASS' } else { 'PASS' }
    }
}
catch {
    Write-Status -Status 'FAIL' -Message $_.Exception.Message
    Write-Error $_
}
finally {
    $cleanupErrors = [System.Collections.Generic.List[string]]::new()
    try { Stop-RunOwnedE2eProcesses }
    catch { $cleanupErrors.Add("process cleanup: $($_.Exception.Message)") }

    try {
        if ($subordinateCreated) {
            Assert-MrxEvidenceSubordinateTarget -DatabaseName $subordinateDatabase -ParentDatabaseName $targetDatabase -Purpose 'integration' | Out-Null
            Invoke-MySqlQuery -Sql "DROP DATABASE ``$subordinateDatabase``;" | Out-Null
            Assert-MrxEvidenceTargetAbsent -DatabaseName $subordinateDatabase -ReadDatabaseCount {
                param($DatabaseName)
                [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
            }
        }
    }
    catch { $cleanupErrors.Add("subordinate cleanup: $($_.Exception.Message)") }

    try {
        if ($targetCreated) {
            Assert-MrxEvidenceTarget -DatabaseName $targetDatabase -RunId $runId | Out-Null
            Invoke-MySqlQuery -Sql "DROP DATABASE ``$targetDatabase``;" | Out-Null
            Assert-MrxEvidenceTargetAbsent -DatabaseName $targetDatabase -ReadDatabaseCount {
                param($DatabaseName)
                [int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name = '$DatabaseName';")
            }
        }
    }
    catch { $cleanupErrors.Add("target cleanup: $($_.Exception.Message)") }

    try {
        if ($runtimePrincipalAttempted) {
            Assert-MrxEvidenceTarget -DatabaseName $targetDatabase -RunId $runId | Out-Null
            $owners = @(Invoke-MySqlQuery -Sql "SELECT JSON_UNQUOTE(JSON_EXTRACT(User_attributes, '$.metadata.mrxEvidenceRunId')) FROM mysql.user WHERE User = '$runtimePrincipal' AND Host = '127.0.0.1';")
            if ($owners.Count -gt 1 -or ($owners.Count -eq 1 -and $owners[0] -cne $runId)) { throw 'Service principal ownership changed; refusing to drop it.' }
            if ($owners.Count -eq 1) { Invoke-MySqlQuery -Sql "DROP USER '$runtimePrincipal'@'127.0.0.1';" | Out-Null }
            if ([int64](Invoke-MySqlQuery -Sql "SELECT COUNT(*) FROM mysql.user WHERE User = '$runtimePrincipal' AND Host = '127.0.0.1';") -ne 0) { throw 'Run-owned service principal remains.' }
        }
    }
    catch { $cleanupErrors.Add("service principal cleanup: $($_.Exception.Message)") }

    try { Assert-EvidencePortsFree }
    catch { $cleanupErrors.Add("port cleanup: $($_.Exception.Message)") }

    try {
        if ($null -ne $sourceManifest) { Assert-SourceAfterEvidence -SourceBefore $sourceManifest }
    }
    catch {
        $terminalStatus = 'NEEDS_EVIDENCE'
        Write-Status -Status 'NEEDS_EVIDENCE' -Message "Source preservation not proved: $($_.Exception.Message)"
    }

    try {
        if ($null -ne $candidateManifest) {
            $candidateAfter = Get-CandidateManifest
            $unchanged = $candidateAfter.workingTreeSha256 -ceq $candidateManifest.workingTreeSha256 -and $candidateAfter.head -ceq $candidateManifest.head
            Write-EvidenceJson -Path (Join-Path $evidenceRoot 'candidate-source-after.json') -Value ([ordered]@{
                unchanged = $unchanged; head = $candidateAfter.head; workingTreeSha256 = $candidateAfter.workingTreeSha256
            })
            if (-not $unchanged) { throw 'Candidate source changed during the run; build/source attribution is invalid.' }
        }
    }
    catch {
        $terminalStatus = 'NEEDS_EVIDENCE'
        Write-Status -Status 'NEEDS_EVIDENCE' -Message $_.Exception.Message
    }

    try { if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force } }
    catch { $cleanupErrors.Add("temporary file cleanup: $($_.Exception.Message)") }

    if ($cleanupErrors.Count -eq 0) { $cleanupCompleted = $true }
    Write-EvidenceJson -Path (Join-Path $evidenceRoot 'cleanup.json') -Value ([ordered]@{
        runId = $runId; completed = $cleanupCompleted; errors = @($cleanupErrors.ToArray())
        targetWasCreated = $targetCreated; subordinateWasCreated = $subordinateCreated
        runtimePrincipalAttempted = $runtimePrincipalAttempted; temporaryDirectoryAbsent = -not (Test-Path -LiteralPath $tempRoot)
    })
    if ($cleanupErrors.Count -gt 0) {
        $cleanupBlocked = $true
        $terminalStatus = 'BLOCKED_CLEANUP'
        $cleanupMessage = $cleanupErrors -join '; '
        Write-Status -Status 'BLOCKED_CLEANUP' -Message $cleanupMessage
        Write-Error $cleanupMessage
    }
    elseif ($terminalStatus -eq 'PASS') {
        Write-Status -Status 'PASS' -Message 'Selected evidence verified; exact clone, subordinate, principal, listeners and private temporary files cleaned.'
    }
    elseif ($terminalStatus -eq 'DIAGNOSTIC_PASS') {
        Write-Status -Status 'DIAGNOSTIC_PASS' -Message 'Selected diagnostic evidence verified; exact clone, subordinate, principal, listeners and private temporary files cleaned. Not full qualification.'
    }
}

Write-Host "[RUN COMPLETE] runId=$runId status=$terminalStatus cleanupCompleted=$cleanupCompleted"
if ($terminalStatus -in @('READY', 'PASS', 'DIAGNOSTIC_PASS')) { exit 0 }
exit 1
