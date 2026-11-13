using System.Text;
using FluentAssertions;

namespace IPCManagement.Api.Tests;

public class MrxDisposableEvidenceContractTests
{
    private const string RunId = "20261101t120000z_a1b2c3";
    private const string Target = $"ipc_mrx_evidence_{RunId}";

    [Fact]
    public async Task Checked_process_drains_both_pipes_without_waiting_for_child_exit()
    {
        var root = FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal);
        var output = Path.Combine(Path.GetTempPath(), $"ipc-pipe-{Guid.NewGuid():N}.txt");
        var script = $$"""
            $ErrorActionPreference='Stop'; $repoRoot='{{root}}'
            . (Join-Path $repoRoot 'scripts/mrx-evidence/MrxEvidenceSafety.ps1')
            $tokens=$null; $errors=$null
            $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1'),[ref]$tokens,[ref]$errors)
            $owner=$ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Invoke-CheckedProcess' }
            . ([scriptblock]::Create($owner.Extent.Text))
            Invoke-CheckedProcess -FilePath 'powershell.exe' -Arguments @('-NoProfile','-NonInteractive','-Command',"[Console]::Out.Write(('o'*262144)); [Console]::Error.Write(('e'*262144))") -StandardOutputPath '{{output.Replace("'", "''", StringComparison.Ordinal)}}'
            """;
        using var process = System.Diagnostics.Process.Start(NewPowerShellInfo(script))!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        var exited = false;
        try
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            try { await process.WaitForExitAsync(deadline.Token); exited = true; }
            catch (OperationCanceledException) { }
            finally
            {
                if (!process.HasExited) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(); }
            }
            Assert.True(exited, "The checked process deadlocked while the child filled redirected stdout and stderr.");
            Assert.True(process.ExitCode == 0, await stderr);
            Assert.Equal(new string('o', 262144), (await File.ReadAllTextAsync(output)).TrimEnd('\r', '\n'));
        }
        finally
        {
            await stdout; await stderr;
            if (File.Exists(output)) File.Delete(output);
        }
    }

    [Fact]
    public void Campaign_private_credentials_survive_reopen_but_corruption_and_active_lock_are_rejected()
    {
        InvokeGuard("""
            $root=Join-Path ([IO.Path]::GetTempPath()) ('ipc-campaign-contract-'+[Guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory $root | Out-Null
            $secret=Join-Path $root 'credentials.dpapi'
            $lockPath=Join-Path $root 'campaign.lock'
            $lock=$null
            try {
                Protect-MrxCampaignCredentials -Path $secret -Credentials @{ password='test-only-secret'; username='test-actor' }
                if ([Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($secret)).Contains('test-only-secret')) { throw 'Plaintext secret persisted.' }
                $read=Unprotect-MrxCampaignCredentials -Path $secret
                if ($read.password -cne 'test-only-secret' -or $read.username -cne 'test-actor') { throw 'Credential round-trip failed.' }
                $refused=$false
                try { Protect-MrxCampaignCredentials -Path $secret -Credentials @{ password='replacement' } } catch { $refused=$true }
                if (-not $refused -or (Unprotect-MrxCampaignCredentials -Path $secret).password -cne 'test-only-secret') { throw 'Existing credential overwritten.' }
                $bytes=[IO.File]::ReadAllBytes($secret); $bytes[0]=$bytes[0] -bxor 255; [IO.File]::WriteAllBytes($secret,$bytes)
                $refused=$false
                try { Unprotect-MrxCampaignCredentials -Path $secret | Out-Null } catch { $refused=$true }
                if (-not $refused) { throw 'Corrupt credentials admitted.' }
                $lock=Enter-MrxCampaignLock -Path $lockPath
                $refused=$false
                try { $second=Enter-MrxCampaignLock -Path $lockPath; $second.Dispose() } catch { $refused=$true }
                if (-not $refused) { throw 'Concurrent campaign writer admitted.' }
                $lock.Dispose(); $lock=$null
                $reopened=Enter-MrxCampaignLock -Path $lockPath; $reopened.Dispose()
            } finally { if ($null -ne $lock) { $lock.Dispose() }; Remove-Item -LiteralPath $root -Recurse -Force }
            """).Should().Be(0);
    }

    [Fact]
    public void Campaign_receipt_rejects_foreign_identity_and_escaped_private_paths()
    {
        InvokeGuard($$"""
            $root=Join-Path ([IO.Path]::GetTempPath()) ('ipc-campaign-contract-'+[Guid]::NewGuid().ToString('N'))
            $paths=Get-MrxCampaignPaths -RepoRoot $root -CampaignId '{{RunId}}'
            New-Item -ItemType Directory $paths.root | Out-Null
            $receipt=[ordered]@{
                schemaVersion=1; campaignId='{{RunId}}'; database='{{Target}}'
                ownerSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
                serverIdentity='local-server-uuid:3306'; createdAtUtc='2026-11-01T12:00:00Z'
                schemaHash=('A'*64); migrationIds=@('20261101124531_RetainWeeklyMenuImportSnapshots')
                principalName='mrx_{{RunId}}'; sourceManifestPath=(Join-Path $paths.root 'source-manifest.json')
                encryptedCredentialsPath=$paths.credentials; prerequisiteReceiptPaths=@()
            }
            try {
                $receipt | ConvertTo-Json | Set-Content -LiteralPath $paths.receipt -Encoding utf8
                $read=Read-MrxCampaignReceipt -Path $paths.receipt -CampaignId '{{RunId}}' -Database '{{Target}}'
                if ($read.database -cne '{{Target}}') { throw 'Owned receipt rejected.' }
                foreach ($change in @(
                    @{key='database';value='ipcmanagement'}, @{key='campaignId';value='20261101t120000z_other1'},
                    @{key='ownerSid';value='S-1-0-0'}, @{key='schemaVersion';value=2},
                    @{key='schemaHash';value='invalid'}, @{key='serverIdentity';value=''},
                    @{key='principalName';value='operator'},
                    @{key='encryptedCredentialsPath';value=(Join-Path $root 'foreign.dpapi')},
                    @{key='sourceManifestPath';value=(Join-Path $root 'source-manifest.json')},
                    @{key='prerequisiteReceiptPaths';value=@((Join-Path $root 'foreign.json'))}
                )) {
                    $original=$receipt[$change.key]; $receipt[$change.key]=$change.value
                    $receipt | ConvertTo-Json | Set-Content -LiteralPath $paths.receipt -Encoding utf8
                    $refused=$false
                    try { Read-MrxCampaignReceipt -Path $paths.receipt -CampaignId '{{RunId}}' -Database '{{Target}}' | Out-Null } catch { $refused=$true }
                    if (-not $refused) { throw ('Unsafe receipt admitted: '+$change.key) }
                    $receipt[$change.key]=$original
                }
                $refused=$false
                try { Get-MrxCampaignPaths -RepoRoot $root -CampaignId '../escape' | Out-Null } catch { $refused=$true }
                if (-not $refused) { throw 'Campaign path traversal admitted.' }
            } finally { Remove-Item -LiteralPath $root -Recurse -Force }
            """).Should().Be(0);
    }

    [Fact]
    public void Campaign_build_keys_follow_product_inputs_not_tests_or_docs_and_storage_refuses_over_budget()
    {
        InvokeGuard("""
            $root=Join-Path ([IO.Path]::GetTempPath()) ('ipc-build-contract-'+[Guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path (Join-Path $root 'frontend/src'),(Join-Path $root 'frontend/public'),(Join-Path $root 'backend/src/Api'),(Join-Path $root 'docs'),(Join-Path $root 'evidence') | Out-Null
            try {
                Set-Content (Join-Path $root 'frontend/src/app.ts') 'product'
                Set-Content (Join-Path $root 'frontend/vite.config.ts') 'config'
                Set-Content (Join-Path $root 'frontend/public/icon.svg') 'asset'
                Set-Content (Join-Path $root 'backend/src/Api/service.cs') 'product'
                Set-Content (Join-Path $root 'Directory.Build.props') 'config'
                $fe=(Get-MrxBuildInputs -RepoRoot $root -Kind Frontend).key
                $be=(Get-MrxBuildInputs -RepoRoot $root -Kind Backend).key
                Set-Content (Join-Path $root 'frontend/src/app.test.ts') 'test change'
                Set-Content (Join-Path $root 'docs/design.md') 'doc change'
                if ((Get-MrxBuildInputs -RepoRoot $root -Kind Frontend).key -cne $fe -or (Get-MrxBuildInputs -RepoRoot $root -Kind Backend).key -cne $be) { throw 'Test/docs invalidated product build.' }
                Set-Content (Join-Path $root 'frontend/public/icon.svg') 'changed asset'
                if ((Get-MrxBuildInputs -RepoRoot $root -Kind Frontend).key -ceq $fe) { throw 'Changed served asset reused stale build.' }
                Set-Content (Join-Path $root 'Directory.Build.props') 'changed build configuration'
                if ((Get-MrxBuildInputs -RepoRoot $root -Kind Backend).key -ceq $be) { throw 'Changed build configuration reused stale build.' }
                $evidence=Join-Path $root 'evidence'
                [IO.File]::WriteAllBytes((Join-Path $evidence 'keeper.bin'),[byte[]](1,2,3,4))
                $longDirectory='\\?\'+$evidence+'\'+('a'*100)+'\'+('b'*100)
                [IO.Directory]::CreateDirectory($longDirectory) | Out-Null
                [IO.File]::WriteAllBytes(($longDirectory+'\role-trace.zip'),[byte[]](5,6,7))
                $storage=Get-MrxCampaignStorage -Root $evidence -ReserveBytes 0
                if ($storage.bytes -ne 7 -or $storage.fileCount -ne 2) { throw 'Storage accounting differs from actual file bytes, including long trace paths.' }
                $refused=$false
                try { Get-MrxCampaignStorage -Root $evidence -ReserveBytes 4294967296 | Out-Null } catch { $refused=$true }
                if (-not $refused -or -not (Test-Path (Join-Path $evidence 'keeper.bin'))) { throw 'Hard cap failed or retired retained evidence.' }
            } finally { [IO.Directory]::Delete(('\\?\'+$root),$true) }
            """).Should().Be(0);
    }

    [Fact]
    public void Campaign_build_reuses_only_unchanged_inputs_and_verified_output_bytes()
    {
        InvokeGuard($$"""
            $tokens=$null; $errors=$null
            $ast=[Management.Automation.Language.Parser]::ParseFile('{{FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal)}}/scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1',[ref]$tokens,[ref]$errors)
            foreach ($name in @('Invoke-MrxCampaignBuild','Write-EvidenceJson')) {
                $owner=$ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq $name }
                if ($null -eq $owner) { throw ('Missing build owner: '+$name) }
                . ([scriptblock]::Create($owner.Extent.Text))
            }
            $repoRoot=Join-Path ([IO.Path]::GetTempPath()) ('ipc-build-cache-'+[Guid]::NewGuid().ToString('N'))
            $CampaignId='{{RunId}}'; $paths=Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $CampaignId
            New-Item -ItemType Directory -Path (Join-Path $repoRoot 'frontend/src'),$paths.root | Out-Null
            $script:builds=0
            function Invoke-Npm { param($Arguments)
                $script:builds++
                New-Item -ItemType Directory -Force (Join-Path $repoRoot 'frontend/dist') | Out-Null
                [IO.File]::WriteAllText((Join-Path $repoRoot 'frontend/dist/index.html'),'built-content-'+$script:builds)
            }
            try {
                [IO.File]::WriteAllText((Join-Path $repoRoot 'frontend/src/app.ts'),'product')
                Invoke-MrxCampaignBuild -Kind Frontend
                Invoke-MrxCampaignBuild -Kind Frontend
                if ($script:builds -ne 1) { throw 'Unchanged product rebuilt.' }
                [IO.File]::WriteAllText((Join-Path $repoRoot 'frontend/dist/index.html'),'tampered-output')
                Invoke-MrxCampaignBuild -Kind Frontend
                if ($script:builds -ne 2) { throw 'Changed output bytes reused.' }
                [IO.File]::WriteAllText((Join-Path $repoRoot 'frontend/src/app.ts'),'changed-product')
                Invoke-MrxCampaignBuild -Kind Frontend
                if ($script:builds -ne 3) { throw 'Changed product inputs reused.' }
            } finally { Remove-Item -LiteralPath $repoRoot -Recurse -Force }
            """).Should().Be(0);
    }

    [Fact]
    public void Campaign_invocation_refuses_legacy_fallback_and_unadmitted_phase_defaults()
    {
        InvokeGuard($$"""
            Assert-MrxCampaignInvocation -Mode Start -Profile Qualification -CampaignId '{{RunId}}'
            Assert-MrxCampaignInvocation -Mode Run -Profile Qualification -CampaignId '{{RunId}}' -Diagnostic LifecycleAcceptance
            Assert-MrxCampaignInvocation -Mode Run -Profile Qualification -CampaignId '{{RunId}}' -Diagnostic RepairCheck
            $env:MRX_COORDINATED_TAIL_RECEIPT='retained-proof.json'
            try {
                Assert-MrxCampaignInvocation -Mode Run -Profile Qualification -CampaignId '{{RunId}}' -Diagnostic RepairCheck
                $refused=$false
                try { Assert-MrxCampaignInvocation -Mode Run -Profile Qualification -CampaignId '{{RunId}}' -Diagnostic LifecycleAcceptance } catch { $refused=$true }
                if (-not $refused) { throw 'Diagnostic tail resume could masquerade as complete lifecycle proof.' }
            } finally { Remove-Item Env:MRX_COORDINATED_TAIL_RECEIPT -ErrorAction SilentlyContinue }
            foreach ($case in @(
                @{Mode='Execute';Profile='Qualification';CampaignId='{{RunId}}'},
                @{Mode='Run';Profile='Qualification';CampaignId='{{RunId}}'},
                @{Mode='Start';Profile='G1';CampaignId='{{RunId}}'},
                @{Mode='Run';Profile='Qualification';CampaignId=''},
                @{Mode='Start';Profile='Qualification';CampaignId='../escape'},
                @{Mode='Run';Profile='Qualification';CampaignId='{{RunId}}';Diagnostic='Quantitative'},
                @{Mode='Start';Profile='Qualification';CampaignId='{{RunId}}';Diagnostic='Golden'}
            )) {
                $refused=$false
                try { Assert-MrxCampaignInvocation @case } catch { $refused=$true }
                if (-not $refused) { throw 'Unsafe campaign invocation admitted.' }
            }
            """).Should().Be(0);
    }

    [Theory]
    [InlineData("Finish", false, false)]
    [InlineData("Finish", true, false)]
    [InlineData("Abort", false, false)]
    [InlineData("Abort", false, true)]
    public void Campaign_start_run_failure_resume_retains_one_database(string disposition, bool failDrop, bool failStart)
    {
        var root = FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal);
        InvokeGuard($$"""
            $repoRoot='{{root}}'
            $tokens=$null; $errors=$null
            $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1'),[ref]$tokens,[ref]$errors)
            foreach ($name in @('Write-EvidenceJson','Assert-CloneManifest','Initialize-MrxCampaign','Invoke-MrxCampaignAttempt','Assert-MrxCampaignOwnership','Complete-MrxCampaign','Invoke-MrxCampaignCommand','New-RunOwnedDefaultsFile','Get-RequiredConnectionValue','ConvertTo-DefaultsValue')) {
                $owner=$ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq $name }
                if ($null -eq $owner) { throw ('Missing lifecycle owner: '+$name) }
                . ([scriptblock]::Create($owner.Extent.Text))
            }
            $private=Join-Path ([IO.Path]::GetTempPath()) ('ipc-campaign-lifecycle-'+[Guid]::NewGuid().ToString('N'))
            $repoRoot=$private; $runId='{{RunId}}'; $targetDatabase='{{Target}}'; $runtimePrincipal='mrx_{{RunId}}'
            $paths=Get-MrxCampaignPaths -RepoRoot $repoRoot -CampaignId $runId
            $evidenceRoot=$paths.root; $tempRoot=Join-Path $private $runId; $runtimeDirectory=Join-Path $tempRoot 'runtime'
            $defaultsFile=Join-Path $tempRoot 'mysql.defaults.cnf'; $dumpPath=Join-Path $tempRoot 'source.sql'
            New-Item -ItemType Directory -Path $evidenceRoot,$tempRoot | Out-Null
            $mysql='mysql-boundary'; $mysqldump='dump-boundary'; $automaticActors=$true; $Diagnostic='SourceCustomer'
            $script:creates=0; $script:dumps=0; $script:restores=0; $script:bootstraps=0; $script:drops=0; $script:attempts=0
            $script:wrongServer=$false; $script:wrongSchema=$false; $script:starts=0; $script:failDrop=$false; $script:principalExists=$true
            $script:sourceChecks=0; $script:failSource=$false; $script:candidate=('B'*64); $script:failStart={{(failStart ? "$true" : "$false")}}
            function Get-CandidateManifest { return @{workingTreeSha256=$script:candidate;head='test-only-head'} }
            function Resolve-MySqlExecutable { param($Name) return ($Name+'-boundary') }
            function Assert-SourceAfterEvidence { param($SourceBefore,[switch]$StableSchema) $script:sourceChecks++; if ($script:failSource) { throw 'Controlled source drift.' } }
            function Invoke-MySqlQuery {
                param($Sql,$Database)
                if ($Sql -like '*@@server_uuid*') { if ($script:wrongServer) { return 'foreign-server:3306' }; return 'local-server:3306' }
                if ($Sql -like '*DEFAULT_COLLATION_NAME*') { return 'utf8mb4_unicode_ci' }
                if ($Sql -like '*information_schema.schemata*') { return $script:creates }
                if ($Sql -like 'CREATE DATABASE*') { $script:creates++; return }
                if ($Sql -like 'DROP DATABASE*') { $script:drops++; if ($script:failDrop) { throw 'Controlled database drop failure.' }; $script:creates=0; return }
                if ($Sql -like 'DROP USER*') { $script:drops++; $script:principalExists=$false; return }
                if ($Sql -like '*COUNT(*) FROM mysql.user*') { return [int]$script:principalExists }
                if ($Sql -like '*systemoperationmodes*') { return 'MATERIAL_RECONCILIATION' }
                if ($Sql -like '*User_attributes*') { if ($script:principalExists) { return '{{RunId}}' }; return @() }
                if ($Sql -like 'SHOW GRANTS*') { return 'GRANT SELECT, INSERT, UPDATE, DELETE ON `{{Target}}`.* TO `mrx_{{RunId}}`@`127.0.0.1`' }
                throw ('Unexpected SQL: '+$Sql)
            }
            function Invoke-CheckedProcess {
                param($FilePath,$Arguments,$StandardInputPath)
                if ($FilePath -eq 'dump-boundary') { $script:dumps++; if ($script:failStart) { throw 'Controlled dump interruption.' }; Set-Content -LiteralPath $dumpPath -Value '-- Dump completed' }
                elseif ($FilePath -eq 'mysql-boundary' -and $StandardInputPath -eq $dumpPath) { $script:restores++ }
                else { throw 'Unexpected external process.' }
            }
            function Get-DatabaseManifest { param($DatabaseName,[switch]$StableSchema)
                return @{ tableCount=1; rowCounts=@{roles=5}; tableChecksums=@{roles='1234'}; schemaChecksums=@{columns=$(if ($script:wrongSchema) { 'changed' } else { 'same' })}; migrationIds=@('20261101124531_RetainWeeklyMenuImportSnapshots') }
            }
            function Initialize-QualificationCredentials { param($SourceBuilder)
                $script:bootstraps++; $script:qualificationCredentialsFile=Join-Path $tempRoot 'qualification-credentials.json'
                $script:qualificationTargetConnection='Server=127.0.0.1;Database={{Target}};Uid=actor;Pwd=test-only;'
                New-Item -ItemType Directory $runtimeDirectory | Out-Null
                Set-Content -LiteralPath $qualificationCredentialsFile -Value '{"admin":{"username":"test-actor","password":"test-only"} }'
                Set-Content -LiteralPath (Join-Path $runtimeDirectory 'appsettings.json') -Value '{"privateSetting":"test-only"}'
            }
            function Assert-EvidencePortsFree { }
            function Stop-RunOwnedE2eProcesses { }
            function Invoke-PreparedG1Evidence { param($SourceBuilder)
                $script:starts++; $script:attempts++
                if ($script:attempts -eq 1) { throw 'Controlled browser-boundary failure.' }
            }
            try {
                if ($script:failStart) {
                    foreach ($attempt in @(1,2)) {
                        $refused=$false
                        try { Initialize-MrxCampaign -CampaignId $runId -SourceBuilder @{} | Out-Null } catch { $refused=$true }
                        if (-not $refused) { throw 'Interrupted Start silently retried.' }
                    }
                    if ($script:dumps -ne 1 -or $script:creates -ne 0 -or $script:drops -ne 0) { throw 'Partial Start repeated resource acquisition.' }
                    return
                }
                Initialize-MrxCampaign -CampaignId $runId -SourceBuilder @{} | Out-Null
                $refused=$false
                try { Initialize-MrxCampaign -CampaignId $runId -SourceBuilder @{} | Out-Null } catch { $refused=$true }
                if (-not $refused) { throw 'Start collision admitted.' }
                $failed=$false
                try { Invoke-MrxCampaignAttempt -CampaignId $runId -Diagnostic 'SourceCustomer' -SourceBuilder @{} | Out-Null } catch { $failed=$true }
                if (-not $failed) { throw 'Attempt failure swallowed.' }
                $previousConnection=$env:IPC_MRX_SOURCE_CONNECTION_STRING
                $script:tempRoot=Join-Path $private 'command-private'; $script:runtimeDirectory=Join-Path $tempRoot 'runtime'; $script:defaultsFile=Join-Path $tempRoot 'mysql.defaults.cnf'
                $script:Mode='Run'; $script:SourceSettings='unused'; $env:IPC_MRX_SOURCE_CONNECTION_STRING='Server=localhost;Database=ipcmanagement;Uid=operator-fixture;Pwd=test-only;'
                try { $outcome=Invoke-MrxCampaignCommand -CampaignId $runId }
                finally { $env:IPC_MRX_SOURCE_CONNECTION_STRING=$previousConnection }
                if ($outcome.status -cne 'DIAGNOSTIC_PASS' -or (Test-Path $tempRoot)) { throw 'Command dispatch or private cleanup failed.' }
                if ($outcome.resourceDisposition -cne 'RETAINED_AUTHORIZED' -or $outcome.cleanupCompleted -ne $false) { throw 'Retained resource mislabeled cleaned.' }
                if ($script:sourceChecks -ne 2) { throw 'Run did not check main before and after browser work.' }
                $script:failSource=$true
                $previousConnection=$env:IPC_MRX_SOURCE_CONNECTION_STRING
                $env:IPC_MRX_SOURCE_CONNECTION_STRING='Server=localhost;Database=ipcmanagement;Uid=operator-fixture;Pwd=test-only;'
                try { $drifted=Invoke-MrxCampaignCommand -CampaignId $runId }
                finally { $env:IPC_MRX_SOURCE_CONNECTION_STRING=$previousConnection; $script:failSource=$false }
                if ($drifted.status -cne 'NEEDS_EVIDENCE' -or $script:starts -ne 2 -or $script:drops -ne 0) { throw 'Source drift admitted browser work or dropped retained resources.' }
                foreach ($mismatch in @('wrongServer','wrongSchema')) {
                    Set-Variable -Scope Script -Name $mismatch -Value $true; $refused=$false
                    try { Invoke-MrxCampaignAttempt -CampaignId $runId -Diagnostic 'SourceCustomer' -SourceBuilder @{} | Out-Null } catch { $refused=$true }
                    Set-Variable -Scope Script -Name $mismatch -Value $false
                    if (-not $refused) { throw ('Ownership mismatch admitted: '+$mismatch) }
                }
                if ($script:creates -ne 1 -or $script:dumps -ne 1 -or $script:restores -ne 1 -or $script:bootstraps -ne 1 -or $script:drops -ne 0 -or $script:starts -ne 2) { throw 'Campaign resource or admission counters differ.' }
                if (Test-Path -LiteralPath $runtimeDirectory) { throw 'Plaintext runtime retained after attempt.' }
                $acceptance=Join-Path $paths.root 'acceptance'; New-Item -ItemType Directory $acceptance | Out-Null
                Set-Content -LiteralPath (Join-Path $acceptance 'lifecycle.json') -Value '{"status":"PASS"}'
                $refused=$false
                try { Complete-MrxCampaign -CampaignId $runId -Disposition Finish -SourceBuilder @{} | Out-Null } catch { $refused=$true }
                if (-not $refused -or $script:drops -ne 0) { throw 'Child lifecycle packet authorized parent cleanup.' }
                $gates=@()
                foreach ($id in @('LifecycleAcceptance','Desktop','Memory','Endurance','HttpHost','RepositoryVerify')) {
                    $file=Join-Path $acceptance ($id+'.json')
                    @{id=$id;campaignId=$runId;database=$targetDatabase;status='PASS';candidateSha256=('B'*64)} | ConvertTo-Json | Set-Content -LiteralPath $file -Encoding utf8
                    $gates+=@{id=$id;path=$file;sha256=(Get-FileHash -LiteralPath $file).Hash}
                }
                @{schemaVersion=1;campaignId=$runId;database=$targetDatabase;parentTask=8;candidateSha256=('B'*64);gates=$gates} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $acceptance 'final-package.json') -Encoding utf8
                $script:candidate=('C'*64); $refused=$false
                try { Complete-MrxCampaign -CampaignId $runId -Disposition Finish -SourceBuilder @{} | Out-Null } catch { $refused=$true }
                if (-not $refused -or $script:drops -ne 0) { throw 'Stale final packet authorized cleanup.' }
                $script:candidate=('B'*64)
                $gateFile=$gates[0].path; $validProof=[IO.File]::ReadAllText($gateFile)
                foreach ($mismatch in @('id','campaignId','database')) {
                    $proof=$validProof | ConvertFrom-Json
                    $proof.$mismatch='foreign-proof'
                    Write-EvidenceJson -Path $gateFile -Value $proof
                    $gates[0].sha256=(Get-FileHash -LiteralPath $gateFile).Hash
                    @{schemaVersion=1;campaignId=$runId;database=$targetDatabase;parentTask=8;candidateSha256=('B'*64);gates=$gates} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $acceptance 'final-package.json') -Encoding utf8
                    $refused=$false
                    try { Complete-MrxCampaign -CampaignId $runId -Disposition Finish -SourceBuilder @{} | Out-Null } catch { $refused=$true }
                    if (-not $refused -or $script:drops -ne 0) { throw ('Unrelated gate proof authorized cleanup: '+$mismatch) }
                }
                [IO.File]::WriteAllText($gateFile,$validProof)
                $gates[0].sha256=(Get-FileHash -LiteralPath $gateFile).Hash
                @{schemaVersion=1;campaignId=$runId;database=$targetDatabase;parentTask=8;candidateSha256=('B'*64);gates=$gates} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $acceptance 'final-package.json') -Encoding utf8
                $script:failDrop={{(failDrop ? "$true" : "$false")}}
                $closed=Complete-MrxCampaign -CampaignId $runId -Disposition '{{disposition}}' -SourceBuilder @{}
                if ($script:drops -ne 2 -or $script:principalExists) { throw 'Independent exact database/principal cleanup not attempted.' }
                if ({{(failDrop ? "$true" : "$false")}}) {
                    if ($closed.cleanupCompleted -ne $false -or $closed.status -cne 'BLOCKED_CLEANUP' -or -not (Test-Path $paths.credentials)) { throw 'Cleanup failure mislabeled complete or recovery credential lost.' }
                } else {
                    if (-not $closed.cleanupCompleted -or (Test-Path $paths.credentials)) { throw 'Completed cleanup retained private credentials.' }
                    if ('{{disposition}}' -eq 'Abort' -and $closed.status -cne 'ABORTED') { throw 'Abort presented as acceptance.' }
                    if ('{{disposition}}' -eq 'Finish' -and $closed.status -cne 'PASS') { throw 'Verified parent cleanup not completed.' }
                }
            } finally { Remove-Item -LiteralPath $private -Recurse -Force }
            """).Should().Be(0);
    }

    [Fact]
    public void Menu_integrity_diagnostic_selects_only_bounded_owners_and_never_applies_migrations()
    {
        InvokeGuard($$"""
            foreach ($mode in @('Preflight','Execute')) {
                Assert-MrxCampaignInvocation -Mode $mode -Profile Qualification -Diagnostic MenuIntegrityPerformance
            }
            try { Assert-MrxCampaignInvocation -Mode Execute -Profile G1 -Diagnostic MenuIntegrityPerformance; throw 'Unsafe G1 admitted.' }
            catch { if ($_.Exception.Message -notlike '*fresh Qualification*') { throw } }
            $phases=Get-MrxMenuIntegrityPerformancePhases
            if (@($phases.Keys).Count -ne 3 -or @($phases.Keys)[0] -cne 'functional' -or $phases.functional -cne '@G6-Menu-Coverage') { throw 'New four-menu coverage must precede legacy owners.' }
            if (-not $phases.Contains('adversarial') -or -not $phases.Contains('data-path-performance')) { throw 'Missing bounded phases.' }
            foreach ($name in @('@G6-Direct-Source-Edit','@G4-Race','@G5-Recovery Committed initial','@G5-Recovery Committed supplemental','@G5-Session')) {
                if ($name -notmatch $phases.adversarial) { throw ('Missing selected owner '+$name) }
            }
            foreach ($name in @('@G8-Five-User','@G8-HTTP','@G7-Memory','@G7-Desktop','@G6-Merged-Customer')) {
                if ($name -match $phases.functional -or $name -match $phases.adversarial -or $name -match $phases['data-path-performance']) { throw 'Unapproved endurance/master provisioning admitted.' }
            }
            if ('@G7-Data-Path' -notmatch $phases['data-path-performance']) { throw 'Performance case not selected.' }
            $tokens=$null;$errors=$null
            $repoRoot='{{FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal)}}'
            $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1'),[ref]$tokens,[ref]$errors)
            $owner=$ast.EndBlock.Statements|Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Invoke-MigrationAndRelationalEvidence' }
            . ([scriptblock]::Create($owner.Extent.Text))
            $Profile='Qualification';$Diagnostic='MenuIntegrityPerformance';$targetDatabase='{{Target}}';$subordinateDatabase='{{Target}}_integration'
            $tempRoot=[IO.Path]::GetTempPath();$evidenceRoot=$tempRoot;$defaultsFile='test-only';$mysql='mysql-boundary';$mysqldump='dump-boundary'
            $script:migrations=0
            function Invoke-CheckedProcess { param($FilePath,$Arguments,$Environment,$StandardInputPath)
                if (($Arguments -join ' ') -match 'ef database update') {$script:migrations++}
            }
            function Write-EvidenceJson { param($Path,$Value) }
            function Invoke-MySqlQuery { param($Sql,$Database)
                if ($Sql -like '*__EFMigrationsHistory*') { return @('20261101112409_RetainMrxDecisionAndContributorHistory','20261101124531_RetainWeeklyMenuImportSnapshots') }
                if ($Sql -like '*information_schema.schemata*') { return '0' }
            }
            Invoke-MigrationAndRelationalEvidence -SourceBuilder (ConvertFrom-MrxConnectionString 'Server=localhost;Database=ipcmanagement;Uid=test;Pwd=test;')
            if ($script:migrations -ne 0) { throw 'Verification diagnostic applied a migration.' }
            function Invoke-MySqlQuery { param($Sql,$Database) return @() }
            try { Invoke-MigrationAndRelationalEvidence -SourceBuilder (ConvertFrom-MrxConnectionString 'Server=localhost;Database=ipcmanagement;Uid=test;Pwd=test;'); throw 'Missing prerequisite admitted.' }
            catch { if ($_.Exception.Message -notlike '*Required migration*') { throw } }
            exit 0
            """).Should().Be(0);
    }

    [Fact]
    public void Menu_integrity_bootstrap_creates_only_declared_actors_not_master_fixtures()
    {
        InvokeGuard($$"""
            $tokens=$null;$errors=$null;$repoRoot='{{FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal)}}'
            $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1'),[ref]$tokens,[ref]$errors)
            $owner=$ast.EndBlock.Statements|Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Initialize-QualificationCredentials' }
            . ([scriptblock]::Create($owner.Extent.Text))
            $Diagnostic='MenuIntegrityPerformance';$targetDatabase='{{Target}}';$runId='{{RunId}}';$targetCreated=$true
            $runtimePrincipal='test-principal';$automaticActors=$true;$mysql='process-boundary';$defaultsFile='test-boundary'
            $tempRoot=Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString('N'))
            $evidenceRoot=$tempRoot;$runtimeDirectory=Join-Path $tempRoot 'runtime';$SourceSettings='source.json';$repoRoot=$tempRoot
            New-Item -ItemType Directory $tempRoot|Out-Null
            try {
                '{"ConnectionStrings":{"DefaultConnection":"test"},"JwtSettings":{"SecretKey":"test"},"Cors":{"AllowedOrigins":[]},"AllowedHosts":"test"}'|Set-Content -LiteralPath (Join-Path $tempRoot $SourceSettings)
                function Get-RequiredConnectionValue {param($Builder,$Keys) return 'localhost'}
                function New-MrxQualificationAccounts {param($DatabaseName,$RunId,$PrivateDirectory)
                    '{"username":"test","password":"test","jwtSecret":"test"}'|Set-Content -LiteralPath (Join-Path $PrivateDirectory 'qualification-db.json')
                }
                $script:processCalls=0
                function Invoke-CheckedProcess {param($FilePath,$Arguments,$StandardInputPath) $script:processCalls++}
                function Write-EvidenceJson {param($Path,$Value)}
                function Invoke-MySqlQuery {param($Database,$Sql)
                    if ($Sql -like '*FROM roles*') {return 5}
                    if ($Sql -like '*FROM mysql.user*') {return 0}
                    if ($Sql -like '*FROM users*') {return @('a','b','c','d','e')}
                    throw ('Unauthorized bootstrap query: '+$Sql)
                }
                Initialize-QualificationCredentials -SourceBuilder (ConvertFrom-MrxConnectionString 'Server=localhost;Database=ipcmanagement;Uid=test;Pwd=test;')
                if ($script:processCalls -ne 2) {throw 'Expected only principal and declared actor SQL boundaries.'}
                $runtime=Get-Content -Raw (Join-Path $runtimeDirectory 'appsettings.json')|ConvertFrom-Json
                $connection=ConvertFrom-MrxConnectionString $runtime.ConnectionStrings.DefaultConnection
                if ($connection['Database'] -cne $targetDatabase) {throw 'Runtime escaped clone.'}
            } finally { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
            """).Should().Be(0);
    }

    [Theory]
    [InlineData("CustomerWorstCase", "@G6-Merged-Customer onboarding", "@G6-Customer-Concurrency independent scopes")]
    [InlineData("SourceAtomicity", "@G6-Direct-Source-Edit issue-first", "@G6-Direct-Source-Edit apply-first")]
    [InlineData("ExportConsistency", "@T7-Export-Consistency setup", "@T7-Export-Consistency setup")]
    public void Bounded_diagnostic_runs_only_its_functional_owners(string diagnostic, string firstOwner, string secondOwner)
    {
        InvokeGuard($$"""
            if ('{{diagnostic}}' -in @('SourceAtomicity','ExportConsistency')) {
                foreach ($mode in @('Preflight','Execute')) { Assert-MrxCampaignInvocation -Mode $mode -Profile Qualification -Diagnostic '{{diagnostic}}' }
                foreach ($invocation in @(@{Mode='Execute';Profile='G1'},@{Mode='Run';Profile='Qualification';CampaignId='{{RunId}}'})) {
                    $refused=$false
                    try { Assert-MrxCampaignInvocation @invocation -Diagnostic '{{diagnostic}}' } catch { $refused=$true }
                    if (-not $refused) { throw 'Diagnostic escaped fresh Qualification admission.' }
                }
            }
            $repoRoot='{{FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal)}}'
            $tokens=$null; $errors=$null
            $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repoRoot 'scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1'),[ref]$tokens,[ref]$errors)
            if ($errors.Count) { throw 'Runner parse failed.' }
            $owner=$ast.EndBlock.Statements | Where-Object { $_ -is [Management.Automation.Language.FunctionDefinitionAst] -and $_.Name -eq 'Invoke-PreparedG1Evidence' }
            . ([scriptblock]::Create($owner.Extent.Text))
            $repoRoot=Join-Path ([IO.Path]::GetTempPath()) ('ipc-customer-selector-'+[Guid]::NewGuid().ToString('N'))
            $evidenceRoot=Join-Path $repoRoot 'evidence'; $tempRoot=$repoRoot
            $Profile='Qualification'; $Diagnostic='{{diagnostic}}'; $CampaignId=$null; $runId='{{RunId}}'; $targetDatabase='{{Target}}'
            $defaultsFile='test-only'; $processFile='test-only'; $runtimeDirectory='test-only'
            $qualificationCredentialsFile='test-only'; $qualificationTargetConnection='test-only'
            $candidateManifest=@{head='test-only';workingTreeSha256=('A'*64)}
            $api=Join-Path $repoRoot '.artifacts/dotnet/bin/IPCManagement.Api/release'
            $fe=Join-Path $repoRoot 'frontend/dist'
            New-Item -ItemType Directory -Path $evidenceRoot,$api,$fe | Out-Null
            Set-Content (Join-Path $api 'IPCManagement.Api.dll') 'test-only'
            Set-Content (Join-Path $fe 'index.html') 'test-only'
            $script:selections=@(); $script:exportOwners=0
            function Invoke-Npm { param($Arguments,$Environment)
                if ($Arguments[1] -eq 'test:e2e:mrx') {
                    $index=[Array]::IndexOf($Arguments,'--grep')
                    if ($index -lt 0 -or -not $Arguments[$index+1]) { throw 'Customer diagnostic has no bounded selection.' }
                    $script:selections+=@{pattern=$Arguments[$index+1];phase=$Environment['MRX_E2E_PHASE']}
                } elseif ($Arguments[1] -ne 'build:fe') { throw 'Unadmitted command.' }
            }
            function Invoke-CheckedProcess { param($FilePath,$Arguments,$Environment)
                if ($Arguments[0] -eq 'build') { return }
                if ($Diagnostic -cne 'ExportConsistency' -or $Arguments[0] -cne 'test') { throw 'Unadmitted process.' }
                $filter=[Array]::IndexOf($Arguments,'--filter'); $hang=[Array]::IndexOf($Arguments,'--blame-hang-timeout')
                if ($filter -lt 0 -or $Arguments[$filter+1] -cne 'FullyQualifiedName~IPCManagement.Api.Tests.Integration.MrxExportConsistencyMySqlTests' -or $hang -lt 0) { throw 'Export worker escaped bounded owner.' }
                $dump=[Array]::IndexOf($Arguments,'--blame-hang-dump-type'); $results=[Array]::IndexOf($Arguments,'--results-directory')
                if ($dump -lt 0 -or $Arguments[$dump+1] -cne 'none' -or $results -lt 0 -or $Arguments[$results+1] -cne (Join-Path $evidenceRoot 'native-export-test-results')) { throw 'Export timeout diagnostics escaped safe owned storage.' }
                if ($Environment['IPC_MRX_TARGET_CONNECTION_STRING'] -cne $qualificationTargetConnection -or $Environment['MRX_EVIDENCE_RUN_ID'] -cne $runId) { throw 'Export worker lost clone identity.' }
                $script:exportOwners++
            }
            function Write-EvidenceJson { param($Path,$Value) }
            function Assert-EvidencePortsFree { }
            function Stop-RunOwnedE2eProcesses { }
            try {
                Invoke-PreparedG1Evidence -SourceBuilder (ConvertFrom-MrxConnectionString 'Server=localhost;Database=ipcmanagement;Uid=test;Pwd=test;')
                if ($script:selections.Count -ne 1 -or $script:selections[0].phase -cne 'functional') { throw 'Customer diagnostic escaped one functional phase.' }
                if ($Diagnostic -ceq 'ExportConsistency' -and $script:exportOwners -ne 1) { throw 'Expected exactly one bounded MySQL export owner.' }
                $pattern=$script:selections[0].pattern
                foreach ($name in @('{{firstOwner}}','{{secondOwner}}')) {
                    if ($name -notmatch $pattern) { throw ('Missing customer owner: '+$name) }
                }
                $otherOwners=if ($Diagnostic -ceq 'SourceAtomicity') { @('@G6-Merged-Customer','@G6-Customer-Concurrency') } else { @('@G6-Direct-Source-Edit') }
                foreach ($name in (@('@G1-Golden','@G4-Race','@G5-Recovery','@G7-Desktop','@G8-Five-User','@G6-Menu-Coverage')+$otherOwners)) {
                    if ($name -match $pattern) { throw ('Unadmitted owner selected: '+$name) }
                }
            } finally { Remove-Item -LiteralPath $repoRoot -Recurse -Force }
            """).Should().Be(0);
    }

    [Fact]
    public void Lifecycle_acceptance_selects_required_business_owners_without_quantitative_fallthrough()
    {
        InvokeGuard("""
            $phases = Get-MrxLifecycleAcceptancePhases
            if (@($phases.Keys).Count -ne 1 -or -not $phases.Contains('functional')) { exit 1 }
            $selection = $phases['functional']
            foreach ($case in @('@G1-Golden lifecycle','Stock oracle rejects missing evidence','@G2-Admission actors','@G2-RBAC source rights','@G3-Submitted shortage','@G4-Race valid clients','@G5-Recovery Committed initial','@G5-Recovery Committed supplemental','@G5-Session scoped draft','@G5-Coordinated shared ingredients','@G6-Direct-Source-Edit locks','@G6-Merged-Customer source output')) {
                if ($case -notmatch $selection) { throw "Missing business owner: $case" }
            }
            foreach ($case in @('@G7-Memory','@G7-Desktop','@G8-Five-User','@G8-HTTP','@G6-Actual-Zoom','@G6-Keyboard-Measurement')) {
                if ($case -match $selection) { throw "Unadmitted quantitative owner: $case" }
            }
            """).Should().Be(0);
    }

    [Fact]
    public void Evidence_policy_accepts_only_the_exact_source_and_run_owned_target()
    {
        InvokeGuard($"Assert-MrxEvidenceSource -DatabaseName 'ipcmanagement'; Assert-MrxEvidenceTarget -DatabaseName '{Target}' -RunId '{RunId}'")
            .Should().Be(0);

        foreach (var source in new[] { "ipc_lane9", Target, "ipcmanagement_backup" })
        {
            InvokeGuard($"Assert-MrxEvidenceSource -DatabaseName '{source}'")
                .Should().NotBe(0, $"{source} is not the approved read-only source");
        }

        foreach (var target in new[]
                 {
                     "ipcmanagement", "ipc_lane9", "ipc_e2e_template", "ipc_mrx_e2e_sandbox",
                     "ipc_mrx_evidence_20261101t120000z_other1", $"{Target}_extra",
                 })
        {
            InvokeGuard($"Assert-MrxEvidenceTarget -DatabaseName '{target}' -RunId '{RunId}'")
                .Should().NotBe(0, $"{target} is not owned by this evidence run");
        }
    }

    [Fact]
    public void Qualification_account_bootstrap_creates_five_private_distinct_credentials_with_verifiable_hashes()
    {
        InvokeGuard($$"""
            $directory = Join-Path ([IO.Path]::GetTempPath()) ('ipc-mrx-account-test-' + [Guid]::NewGuid().ToString('N'))
            $private = Join-Path $directory '{{RunId}}'
            try {
                New-MrxQualificationAccounts -DatabaseName '{{Target}}' -RunId '{{RunId}}' -PrivateDirectory $private
                $records = Get-Content -Raw (Join-Path $private 'qualification-credentials.json') | ConvertFrom-Json
                $sql = Get-Content -Raw (Join-Path $private 'qualification-users.sql')
                $expected = @('ADMIN','COORDINATOR','WAREHOUSESTAFF','CHEF','MANAGER')
                if (@($records.PSObject.Properties).Count -ne 5 -or @($records.PSObject.Properties.Value.password | Select-Object -Unique).Count -ne 5) { exit 1 }
                foreach ($role in @('admin','dieuphoi','thukho','beptruong','manager')) {
                    $record = $records.$role
                    if ($record.username -cne 'mrx_{{RunId}}_' + $role -or $record.password.Length -lt 40) { exit 2 }
                    $line = @($sql -split "`n" | Where-Object { $_.Contains($record.username) })
                    if ($line.Count -ne 1) { exit 3 }
                    $hash = [regex]::Match($line[0], '\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}').Value
                    if (-not [BCrypt.Net.BCrypt]::Verify($record.password, $hash, $false, [BCrypt.Net.HashType]::SHA384)) { exit 4 }
                }
                foreach ($code in $expected) { if (-not $sql.Contains("roleCode = '$code'")) { exit 5 } }
                if (-not $sql.StartsWith('USE `{{Target}}`;') -or $sql -match '(?im)^\s*(UPDATE|DELETE|REPLACE|CREATE|ALTER)\b') { exit 6 }
                $db = Get-Content -Raw (Join-Path $private 'qualification-db.json') | ConvertFrom-Json
                $dbSql = Get-Content -Raw (Join-Path $private 'qualification-db.sql')
                if ($db.username -cne 'mrx_{{RunId}}' -or $db.password.Length -lt 40 -or $db.jwtSecret.Length -lt 40) { exit 9 }
                if (-not $dbSql.Contains('GRANT SELECT, INSERT, UPDATE, DELETE ON `{{Target}}`.*') -or $dbSql -match 'GRANT ALL|GRANT OPTION|ipcmanagement') { exit 10 }
                $original = [IO.File]::ReadAllText((Join-Path $private 'qualification-credentials.json'))
                try { New-MrxQualificationAccounts -DatabaseName '{{Target}}' -RunId '{{RunId}}' -PrivateDirectory $private; exit 7 } catch { }
                if ($original -cne [IO.File]::ReadAllText((Join-Path $private 'qualification-credentials.json'))) { exit 8 }
            } finally { if (Test-Path $directory) { Remove-Item -Recurse -Force $directory } }
            """).Should().Be(0);
    }

    [Theory]
    [InlineData("ipcmanagement")]
    [InlineData("ipc_mrx_evidence_20261101t120000z_other1")]
    public void Qualification_account_bootstrap_refuses_non_owned_databases_before_writing(string database)
    {
        InvokeGuard($"New-MrxQualificationAccounts -DatabaseName '{database}' -RunId '{RunId}' -PrivateDirectory ([IO.Path]::GetTempPath())")
            .Should().NotBe(0);
    }

    [Fact]
    public void Scenario_workbook_moves_actual_date_cells_without_modifying_the_canonical_fixture()
    {
        InvokeGuard($$"""
            $root=Join-Path ([IO.Path]::GetTempPath()) ('ipc-workbook-'+[Guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory $root | Out-Null
            $source=Join-Path '{{FindRepositoryRoot().Replace("'", "''", StringComparison.Ordinal)}}' 'backend/tests/IPCManagement.Api.Tests/Fixtures/weekly-menu-template-ANV-canonical-25k.xlsx'
            $before=(Get-FileHash $source).Hash
            $target=Join-Path $root 'scenario.xlsx'
            try {
                New-MrxScenarioWorkbook -TemplatePath $source -OutputPath $target -WeekStartDate '2027-01-04'
                Add-Type -AssemblyName System.IO.Compression.FileSystem
                $zip=[IO.Compression.ZipFile]::OpenRead($target)
                try {
                    $reader=[IO.StreamReader]::new($zip.GetEntry('xl/sharedStrings.xml').Open())
                    try { $text=$reader.ReadToEnd() } finally { $reader.Dispose() }
                    if (-not $text.Contains('04/01/2027') -or -not $text.Contains('09/01/2027') -or $text.Contains('20/07/2026')) { exit 1 }
                } finally { $zip.Dispose() }
                if ((Get-FileHash $source).Hash -cne $before) { exit 2 }
                try { New-MrxScenarioWorkbook -TemplatePath $source -OutputPath $target -WeekStartDate '2027-01-04'; exit 3 } catch { }
                try { New-MrxScenarioWorkbook -TemplatePath $source -OutputPath (Join-Path $root 'wrong.xlsx') -WeekStartDate '2027-01-05'; exit 4 } catch { }
            } finally { Remove-Item -LiteralPath $root -Recurse -Force }
            """).Should().Be(0);
    }

    [Theory]
    [InlineData("plain", "plain")]
    [InlineData("two words", "\"two words\"")]
    [InlineData("a\"b", "\"a\\\"b\"")]
    public void Native_argument_quoting_is_windows_powershell_compatible(string value, string expected)
    {
        var escapedValue = value.Replace("'", "''", StringComparison.Ordinal);
        var escapedExpected = expected.Replace("'", "''", StringComparison.Ordinal);
        InvokeGuard($"if ((ConvertTo-MrxNativeArgument '{escapedValue}') -cne '{escapedExpected}') {{ exit 1 }}")
            .Should().Be(0);
    }

    [Fact]
    public void Evidence_connection_parser_exposes_real_connection_keys_instead_of_a_wrapper_entry()
    {
        InvokeGuard("$builder = ConvertFrom-MrxConnectionString -ConnectionString 'server=localhost;port=3306;database=ipcmanagement;user=test;password=secret'; if ($builder['database'] -ne 'ipcmanagement' -or $builder.ContainsKey('ConnectionString')) { exit 1 }")
            .Should().Be(0);
    }

    [Fact]
    public void Evidence_absence_guard_treats_the_mysql_string_zero_as_zero()
    {
        InvokeGuard($"Assert-MrxEvidenceTargetAbsent -DatabaseName '{Target}' -ReadDatabaseCount {{ param($DatabaseName) '0' }}")
            .Should().Be(0);
    }

    [Fact]
    public void Evidence_policy_rejects_a_pre_existing_target()
    {
        InvokeGuard($"Assert-MrxEvidenceTargetAbsent -DatabaseName '{Target}' -ReadDatabaseCount {{ param($DatabaseName) 0 }}")
            .Should().Be(0);
        InvokeGuard($"Assert-MrxEvidenceTargetAbsent -DatabaseName '{Target}' -ReadDatabaseCount {{ param($DatabaseName) 1 }}")
            .Should().NotBe(0);
    }

    [Fact]
    public void Evidence_policy_accepts_only_a_subordinate_schema_owned_by_the_same_run()
    {
        InvokeGuard($"Assert-MrxEvidenceSubordinateTarget -DatabaseName '{Target}_integration' -ParentDatabaseName '{Target}' -Purpose 'integration'")
            .Should().Be(0);
        InvokeGuard($"Assert-MrxEvidenceSubordinateTarget -DatabaseName 'ipc_mrx_evidence_20261101t120000z_other1_integration' -ParentDatabaseName '{Target}' -Purpose 'integration'")
            .Should().NotBe(0);
        InvokeGuard($"Assert-MrxEvidenceSubordinateTarget -DatabaseName '{Target}' -ParentDatabaseName '{Target}' -Purpose 'integration'")
            .Should().NotBe(0);
    }

    [Fact]
    public void Evidence_runner_clones_without_target_reuse_or_credential_arguments_and_makes_cleanup_mandatory()
    {
        var runnerPath = Path.Combine(
            FindRepositoryRoot(), "scripts", "mrx-evidence", "Invoke-MrxDisposableEvidence.ps1");
        File.Exists(runnerPath).Should().BeTrue();
        var runner = File.ReadAllText(runnerPath);

        runner.Should().Contain("--defaults-extra-file");
        runner.Should().Contain("--single-transaction");
        runner.Should().Contain("--routines");
        runner.Should().Contain("--triggers");
        runner.Should().Contain("--events");
        runner.Should().Contain("--hex-blob");
        runner.Should().Contain("--set-gtid-purged=OFF");
        runner.Should().Contain("CHECKSUM TABLE");
        runner.Should().Contain("tableChecksums");
        runner.Should().Contain("Dump completed");
        runner.Should().Contain("finally");
        runner.Should().Contain("BLOCKED_CLEANUP");
        runner.Should().NotContain(")[0]", because: "single-row mysql output is a scalar string and indexing returns its first character");
        runner.Should().NotContain("CREATE DATABASE IF NOT EXISTS", because: "an evidence target must never be reused");
        runner.Should().NotContain("-p$", because: "passwords must not be passed in process arguments");
    }

    [Fact]
    public void Evidence_runner_requires_current_migrations_and_complete_read_only_query_plans()
    {
        var runner = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "mrx-evidence", "Invoke-MrxDisposableEvidence.ps1"));
        var queries = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "mrx-evidence", "MrxRetainedHistoryQueries.sql"));

        runner.Should().Contain("20261101112409_RetainMrxDecisionAndContributorHistory");
        runner.Should().Contain("20261101124531_RetainWeeklyMenuImportSnapshots");
        runner.Should().Contain("ConnectionStrings__DefaultConnection");
        runner.Should().Contain("IPC_TEST_CONNECTION_STRING");
        runner.Should().Contain("has-pending-model-changes");
        runner.Should().Contain("query-plans.json");
        runner.Should().Contain("indexDecision");
        runner.Should().Contain("MRX_AUDIT_PLAN_SQL_OUTPUT");
        runner.Should().Contain("MrxAuditQueryPlanCaptureTests");
        runner.Should().Contain("$matches.Count -ne 6");

        foreach (var plan in new[]
                 {
                     "transaction_issue_page", "transaction_return_page", "provision_lookup",
                     "active_contributor", "active_disposition", "net_issued",
                 })
        {
            queries.Should().Contain($"-- PLAN: {plan}");
        }
        queries.Should().NotContain("-- PLAN: typed_audit_scope");
        queries.Should().Contain("EXPLAIN FORMAT=JSON");
        queries.Should().NotContain("INSERT ");
        queries.Should().NotContain("UPDATE ");
        queries.Should().NotContain("DELETE ");
    }

    [Fact]
    public void Prepared_e2e_uses_outer_database_ownership_and_credential_safe_mysql_processes()
    {
        var setup = File.ReadAllText(Path.Combine(FindRepositoryRoot(), "frontend", "tests", "e2e-mrx", "core", "globalSetup.ts"));
        var teardown = File.ReadAllText(Path.Combine(FindRepositoryRoot(), "frontend", "tests", "e2e-mrx", "core", "globalTeardown.ts"));
        var verifier = File.ReadAllText(Path.Combine(FindRepositoryRoot(), "frontend", "tests", "e2e-mrx", "core", "mysqlVerifier.ts"));
        var goldenPath = File.ReadAllText(Path.Combine(FindRepositoryRoot(), "frontend", "tests", "e2e-mrx", "specs", "g1-golden-path.spec.ts"));
        var combined = setup + teardown + verifier;

        combined.Should().Contain("IPC_MRX_MYSQL_DEFAULTS_FILE");
        combined.Should().NotContain("-p123456789");
        combined.Should().NotContain("CREATE DATABASE IF NOT EXISTS");
        setup.Should().Contain("database.prepared");
        setup.Should().Contain("pids: listenerPids()", because: "Vite and Kestrel launcher PIDs may differ from their listener child PIDs");
        teardown.Should().Contain("database.prepared");
        verifier.Should().Contain("execFileSync");
        goldenPath.Should().Contain("StockMovementId");
        goldenPath.Should().Contain("stockMovementId");
        goldenPath.Should().Contain("waitForResponse");
        goldenPath.Should().NotContain("const createDraftBtn", because: "G1 lifecycle transitions must not be silently skipped");
    }

    [Fact]
    public void Query_plan_capture_supports_mysql_nine_json_shape()
    {
        var runner = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "mrx-evidence", "Invoke-MrxDisposableEvidence.ps1"));
        runner.Should().Contain("'--raw'");
        runner.Should().Contain("'query', 'query_block'");
        runner.Should().Contain("estimated_rows");
        runner.Should().Contain("@($examined | Where-Object", because: "Windows PowerShell unwraps a one-item pipeline result");
    }

    [Fact]
    public void Outer_runner_owns_prepared_g1_source_recheck_and_cleanup_status()
    {
        var runner = File.ReadAllText(Path.Combine(
            FindRepositoryRoot(), "scripts", "mrx-evidence", "Invoke-MrxDisposableEvidence.ps1"));

        runner.Should().Contain("MRX_E2E_PREPARED_DATABASE");
        runner.Should().Contain("MRX_E2E_DATABASE");
        runner.Should().Contain("MRX_EVIDENCE_RUN_ID");
        runner.Should().Contain("IPC_MRX_TARGET_CONNECTION_STRING");
        runner.Should().Contain("Resolve-NpmCli");
        runner.Should().Contain("-Arguments (@($npm.Cli) + $Arguments)");
        runner.Should().Contain("test:e2e:mrx:g1");
        runner.Should().Contain("source-after-manifest.json");
        runner.Should().Contain("npm run verify");
        runner.Should().Contain("Get-NetTCPConnection");
        runner.Should().Contain("$cleanupErrors", because: "one cleanup failure must not prevent attempts on the other exact run-owned resources");
        runner.Should().Contain("Write-Status -Status 'PASS'");
        runner.Should().Contain("BLOCKED_CLEANUP");
        runner.IndexOf("Invoke-QueryPlanEvidence", StringComparison.Ordinal)
            .Should().BeLessThan(runner.IndexOf("test:e2e:mrx:g1", StringComparison.Ordinal));
    }

    private static int InvokeGuard(string assertion)
    {
        var scriptPath = Path.Combine(
                FindRepositoryRoot(), "scripts", "mrx-evidence", "MrxEvidenceSafety.ps1")
            .Replace("'", "''", StringComparison.Ordinal);
        var command = $"$ErrorActionPreference='Stop'; . '{scriptPath}'; {assertion}";

        using var process = System.Diagnostics.Process.Start(NewPowerShellInfo(command))
            ?? throw new InvalidOperationException("Could not start Windows PowerShell.");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        if (!process.WaitForExit(30_000))
        {
            process.Kill(entireProcessTree: true);
            process.WaitForExit();
            throw new TimeoutException("PowerShell evidence contract exceeded its 30-second owner-test budget.");
        }
        stdout.GetAwaiter().GetResult();
        var error = stderr.GetAwaiter().GetResult();
        if (process.ExitCode != 0) Console.Error.WriteLine(error);
        return process.ExitCode;
    }

    private static System.Diagnostics.ProcessStartInfo NewPowerShellInfo(string command)
    {
        var info = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -NonInteractive -EncodedCommand {Convert.ToBase64String(Encoding.Unicode.GetBytes(command))}",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        // PowerShell 7 module paths are incompatible with the Windows PowerShell
        // 5.1 child used by these Windows contract tests. Let it load its defaults.
        info.Environment.Remove("PSModulePath");
        return info;
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
    }
}
