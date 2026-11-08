using FluentAssertions;

namespace IPCManagement.Api.Tests;

public class RecoveryScriptContractTests
{
    [Fact]
    public void Recovery_script_should_require_provider_object_identity_and_live_lock_metadata()
    {
        var script = ReadRepositoryFile("scripts", "database-recovery", "Invoke-DatabaseRecovery.ps1");
        var provider = ReadRepositoryFile("scripts", "database-recovery", "ImmutableObjectProvider.ps1");

        script.Should().Contain("ProviderReceiptPath");
        script.Should().Contain("Receive-ImmutableObjectVersion");
        script.Should().Contain("Assert-LiveRetentionMatchesReceipt");
        script.Should().Contain("Assert-RestoreOracle");
        script.Should().Contain("Assert-RestoreDatabaseAbsent");
        script.Should().NotContain("[string]$ArchivePath");
        script.Should().NotContain("IPC_BACKUP_OFFSITE_DIRECTORY");
        script.Should().NotContain("IPC_BACKUP_OFFSITE_IMMUTABLE_RECEIPT");
        script.Should().NotContain("Copy-Item");

        foreach (var field in new[]
                 {
                     "provider", "accountSecurityDomain", "objectKey", "objectVersion",
                     "archiveSha256", "archiveBytes", "encryptionKeyReference", "lockMode",
                     "lockState", "archiveCreatedAtUtc", "retainUntilUtc", "legalHoldState", "uploadRequestId",
                     "metadataRequestId", "downloadRequestId",
                 })
        {
            provider.Should().Contain(field);
        }

        provider.Should().Contain("Get-LiveImmutableObjectMetadata");
        provider.Should().Contain("Provider adapter is not configured");
    }

    [Theory]
    [InlineData("2024-02-29T00:00:00Z", "2029-02-28T00:00:00Z", true)]
    [InlineData("2024-02-29T00:00:00Z", "2029-02-27T23:59:59Z", false)]
    [InlineData("2025-01-15T12:00:00Z", "2030-01-15T12:00:00Z", true)]
    public void Provider_receipt_should_cover_five_calendar_years(
        string archiveCreatedAtUtc,
        string retainUntilUtc,
        bool expectedValid)
    {
        InvokeProviderReceiptGuard(archiveCreatedAtUtc, retainUntilUtc, includeArchiveCreatedAt: true)
            .Should().Be(expectedValid ? 0 : 1);
    }

    [Fact]
    public void Provider_receipt_should_require_archive_creation_time()
    {
        InvokeProviderReceiptGuard("2024-02-29T00:00:00Z", "2029-02-28T00:00:00Z", includeArchiveCreatedAt: false)
            .Should().NotBe(0);
    }

    [Fact]
    public void Live_provider_metadata_should_match_archive_creation_and_exact_retention()
    {
        var validReceipt = ProviderReceiptLiteral("2024-02-29T00:00:00Z", "2029-02-28T00:00:00Z", true);
        var mismatchedCreation = ProviderReceiptLiteral("2024-03-01T00:00:00Z", "2029-02-28T00:00:00Z", true);
        var mismatchedRetention = ProviderReceiptLiteral("2024-02-29T00:00:00Z", "2029-03-01T00:00:00Z", true);
        var providerPath = ProviderScriptPath();

        InvokePowerShell($". '{providerPath}'; try {{ Assert-LiveRetentionMatchesReceipt ({validReceipt}) ({mismatchedCreation}) | Out-Null; exit 0 }} catch {{ exit 1 }}")
            .Should().NotBe(0);
        InvokePowerShell($". '{providerPath}'; try {{ Assert-LiveRetentionMatchesReceipt ({validReceipt}) ({mismatchedRetention}) | Out-Null; exit 0 }} catch {{ exit 1 }}")
            .Should().NotBe(0);
    }

    [Fact]
    public void Recovery_single_row_parser_preserves_the_complete_mysql_row()
    {
        var oraclePath = Path.Combine(FindRepositoryRoot(), "scripts", "database-recovery", "RestoreOracle.ps1")
            .Replace("'", "''", StringComparison.Ordinal);
        var command = $". '{oraclePath}'; " +
            "$row = Get-RequiredSingleMySqlRow -Rows @((\"12`t345678\")) -Label 'MRX metric'; " +
            "if ($row -cne \"12`t345678\") { exit 2 }; " +
            "try { Get-RequiredSingleMySqlRow -Rows @() -Label 'empty' | Out-Null; exit 3 } catch { }; " +
            "try { Get-RequiredSingleMySqlRow -Rows @('one', 'two') -Label 'multiple' | Out-Null; exit 4 } catch { }; exit 0";

        InvokePowerShell(command).Should().Be(0);
    }

    [Fact]
    public void Recovery_processes_keep_database_and_archive_secrets_out_of_arguments_and_restrict_defaults_acl()
    {
        var script = ReadRepositoryFile("scripts", "database-recovery", "Invoke-DatabaseRecovery.ps1");

        script.Should().NotContain("-p$encryptionPassword");
        script.Should().Contain("RedirectStandardInput");
        script.Should().Contain("icacls.exe");
    }

    [Fact]
    public void Mrx_restore_oracle_should_reject_a_restored_target_summary_mismatch()
    {
        var oraclePath = Path.Combine(FindRepositoryRoot(), "scripts", "database-recovery", "RestoreOracle.ps1")
            .Replace("'", "''", StringComparison.Ordinal);
        var matching = "[pscustomobject]@{ counts=[ordered]@{ batches=1; dailyLines=2 }; digests=[ordered]@{ batches='10'; dailyLines='20' } }";
        var mismatched = "[pscustomobject]@{ counts=[ordered]@{ batches=1; dailyLines=3 }; digests=[ordered]@{ batches='10'; dailyLines='20' } }";

        InvokePowerShell($"$ErrorActionPreference='Stop'; . '{oraclePath}'; Assert-MrxRestoreOracle ({matching}) ({matching}); exit 0")
            .Should().Be(0);
        InvokePowerShell($"$ErrorActionPreference='Stop'; . '{oraclePath}'; try {{ Assert-MrxRestoreOracle ({matching}) ({mismatched}); exit 0 }} catch {{ exit 1 }}")
            .Should().NotBe(0);
    }

    [Fact]
    public void Restore_oracle_should_compare_checksum_values_without_database_names_and_keep_provenance_separate()
    {
        var oraclePath = Path.Combine(FindRepositoryRoot(), "scripts", "database-recovery", "RestoreOracle.ps1")
            .Replace("'", "''", StringComparison.Ordinal);
        var command = $". '{oraclePath}'; " +
            "$value = Get-TableChecksumValue @((\"source_db.orders`t12345\")); " +
            "$expected = [pscustomobject]@{ migrationIds=@('m1'); migrationHead='m1'; tableDefinitions=@('orders'); foreignKeyDefinitions=@(); triggerDefinitions=@(); rowCounts=@{orders=2}; rowDigests=@{orders=$value}; dcrClosureBaseline='abc'; gtidExecuted=@('g'); binaryLogChain=@('b') }; " +
            "$actual = [pscustomobject]@{ migrationIds=@('m1'); migrationHead='m1'; tableDefinitions=@('orders'); foreignKeyDefinitions=@(); triggerDefinitions=@(); rowCounts=@{orders=2}; rowDigests=@{orders=(Get-TableChecksumValue @((\"target_db.orders`t12345\")))}; dcrClosureBaseline='abc'; gtidExecuted=@('different'); binaryLogChain=@('different') }; " +
            "Assert-RecoveryProvenance $expected; Assert-RestoreOracle $expected $actual";

        InvokePowerShell(command).Should().Be(0);
        InvokePowerShell($". '{oraclePath}'; try {{ Get-TableChecksumValue @((\"db.orders`tbad\")) | Out-Null; exit 0 }} catch {{ exit 1 }}")
            .Should().NotBe(0);
        InvokePowerShell($". '{oraclePath}'; try {{ Assert-RecoveryProvenance ([pscustomobject]@{{ gtidExecuted=$null; binaryLogChain=$null }}); exit 0 }} catch {{ exit 1 }}")
            .Should().NotBe(0);
    }

    [Fact]
    public void Backup_manifest_should_cover_exact_restore_oracles_before_success()
    {
        var script = ReadRepositoryFile("scripts", "database-recovery", "Invoke-DatabaseRecovery.ps1");

        foreach (var field in new[]
                 {
                     "migrationIds", "migrationHead", "tableDefinitions", "foreignKeyDefinitions",
                     "triggerDefinitions", "rowCounts", "rowDigests", "dcrClosureBaseline",
                     "gtidExecuted", "binaryLogChain", "innerManifestSha256", "archiveSha256",
                 })
        {
            script.Should().Contain(field);
        }

        foreach (var table in new[]
                 {
                     "reconciliationbatches", "reconciliationbatchdailylines", "reconciliationbatchcontributors",
                     "reconciliationsourcerevisions", "reconciliationsourcedeltas", "inventoryissues", "stockmovements",
                     "reconciliationdispositions", "reconciliationdailydispositions", "auditlogs",
                 })
        {
            script.Should().Contain(table);
        }

        script.IndexOf("Assert-LiveRetentionMatchesReceipt", StringComparison.Ordinal)
            .Should().BeLessThan(script.IndexOf("CREATE DATABASE", StringComparison.Ordinal));
        script.IndexOf("Assert-MrxRestoreOracle", StringComparison.Ordinal)
            .Should().BeLessThan(script.IndexOf("RESTORE_VERIFIED", StringComparison.Ordinal));
        foreach (var field in new[]
                 {
                     "archiveCreatedAtUtc", "retainUntilUtc", "lockMode", "lockState", "downloadRequestId",
                 })
        {
            script.Should().Contain(field);
        }

        script.IndexOf("Assert-RestoreOracle", StringComparison.Ordinal)
            .Should().BeLessThan(script.IndexOf("RESTORE_VERIFIED", StringComparison.Ordinal));
        script.IndexOf("RESTORE_VERIFIED", StringComparison.Ordinal)
            .Should().BeLessThan(script.LastIndexOf("Remove-RunOwnedRestoreDatabase", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("ipcmanagement", false)]
    [InlineData("ipc_lane1", false)]
    [InlineData("ipc_lane9", false)]
    [InlineData("ipc_e2e_template", false)]
    [InlineData("ipc_restore_existing", true)]
    [InlineData("ipc_restore_bad-name", false)]
    public void Restore_contract_should_reject_forbidden_or_existing_targets(string target, bool exists)
    {
        var provider = ReadRepositoryFile("scripts", "database-recovery", "ImmutableObjectProvider.ps1");

        provider.Should().Contain("^ipc_restore_[a-z0-9_]+$");
        provider.Should().Contain("Assert-NewRestoreTarget");
        provider.Should().Contain("Test-DatabaseExists");

        InvokeRestoreTargetGuard(target, exists).Should().NotBe(0);
    }

    [Fact]
    public void Restore_contract_should_accept_only_new_absent_restore_target()
    {
        InvokeRestoreTargetGuard("ipc_restore_phase42_contract", exists: false).Should().Be(0);
    }

    private static string ReadRepositoryFile(params string[] segments)
        => File.ReadAllText(Path.Combine(FindRepositoryRoot(), Path.Combine(segments)));

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName ?? throw new InvalidOperationException("Workspace root not found.");
    }

    private static int InvokeProviderReceiptGuard(
        string archiveCreatedAtUtc,
        string retainUntilUtc,
        bool includeArchiveCreatedAt)
    {
        var command = $". '{ProviderScriptPath()}'; try {{ Assert-ProviderReceipt ({ProviderReceiptLiteral(archiveCreatedAtUtc, retainUntilUtc, includeArchiveCreatedAt)}) | Out-Null; exit 0 }} catch {{ exit 1 }}";
        return InvokePowerShell(command);
    }

    private static string ProviderScriptPath()
        => Path.Combine(FindRepositoryRoot(), "scripts", "database-recovery", "ImmutableObjectProvider.ps1")
            .Replace("'", "''", StringComparison.Ordinal);

    private static string ProviderReceiptLiteral(
        string archiveCreatedAtUtc,
        string retainUntilUtc,
        bool includeArchiveCreatedAt)
    {
        var archiveCreated = includeArchiveCreatedAt ? $"archiveCreatedAtUtc='{archiveCreatedAtUtc}';" : string.Empty;
        return $"[pscustomobject]@{{ provider='provider'; accountSecurityDomain='off-host'; objectKey='archive'; objectVersion='v1'; " +
               $"archiveSha256='{'a'.ToString().PadLeft(64, 'a')}'; archiveBytes=1; encryptionKeyReference='key'; " +
               $"lockMode='COMPLIANCE'; lockState='LOCKED'; {archiveCreated} retainUntilUtc='{retainUntilUtc}'; " +
               "legalHoldState='OFF'; uploadRequestId='upload-1'; metadataRequestId='metadata-1' }";
    }

    private static int InvokeRestoreTargetGuard(string target, bool exists)
    {
        var providerPath = Path.Combine(
                FindRepositoryRoot(), "scripts", "database-recovery", "ImmutableObjectProvider.ps1")
            .Replace("'", "''", StringComparison.Ordinal);
        var command =
            $". '{providerPath}'; try {{ Assert-NewRestoreTarget -DatabaseName '{target}' " +
            $"-TestDatabaseExists {{ param($DatabaseName) ${exists.ToString().ToLowerInvariant()} }} | Out-Null; exit 0 }} " +
            "catch { exit 1 }";
        return InvokePowerShell(command);
    }

    private static int InvokePowerShell(string command)
    {
        using var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -NonInteractive -EncodedCommand {Convert.ToBase64String(System.Text.Encoding.Unicode.GetBytes(command))}",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        }) ?? throw new InvalidOperationException("Could not start Windows PowerShell.");
        var output = process.StandardOutput.ReadToEnd();
        var error = process.StandardError.ReadToEnd();
        process.WaitForExit();
        if (process.ExitCode != 0)
        {
            Console.WriteLine(output);
            Console.WriteLine(error);
        }
        return process.ExitCode;
    }
}
