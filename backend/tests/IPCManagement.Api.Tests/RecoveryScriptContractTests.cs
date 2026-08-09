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
                     "lockState", "retainUntilUtc", "legalHoldState", "uploadRequestId",
                     "metadataRequestId", "downloadRequestId",
                 })
        {
            provider.Should().Contain(field);
        }

        provider.Should().Contain("Get-LiveImmutableObjectMetadata");
        provider.Should().Contain("Provider adapter is not configured");
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

    private static int InvokeRestoreTargetGuard(string target, bool exists)
    {
        var providerPath = Path.Combine(
                FindRepositoryRoot(), "scripts", "database-recovery", "ImmutableObjectProvider.ps1")
            .Replace("'", "''", StringComparison.Ordinal);
        var command =
            $". '{providerPath}'; try {{ Assert-NewRestoreTarget -DatabaseName '{target}' " +
            $"-TestDatabaseExists {{ param($DatabaseName) ${exists.ToString().ToLowerInvariant()} }} | Out-Null; exit 0 }} " +
            "catch { exit 1 }";
        using var process = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = $"-NoProfile -NonInteractive -Command \"{command.Replace("\"", "\\\"", StringComparison.Ordinal)}\"",
            UseShellExecute = false,
            CreateNoWindow = true,
        }) ?? throw new InvalidOperationException("Could not start Windows PowerShell.");
        process.WaitForExit();
        return process.ExitCode;
    }
}
