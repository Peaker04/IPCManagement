using FluentAssertions;

namespace IPCManagement.Api.Tests;

// Migrated from the retired aggregate runner: this guards the retained archive executable,
// not campaign status, historical receipts or an orchestration gate specification.
public class ArchiveSafetyContractTests
{
    [Fact]
    public void Archive_tool_should_keep_key_material_out_of_commands_environment_and_receipts()
    {
        var tool = File.ReadAllText(Path.Combine(FindRepositoryRoot(), "backend", "tools",
            "IPCManagement.Phase42ArchiveTool", "Program.cs"));
        tool.Should().Contain("CryptProtectData");
        tool.Should().Contain("CryptUnprotectData");
        tool.Should().Contain("UiForbidden");
        tool.Should().Contain("RandomNumberGenerator.GetBytes(64)");
        tool.Should().Contain("CryptographicOperations.ZeroMemory");
        tool.Should().Contain("AES-256-CBC/HMAC-SHA256");
        tool.Should().Contain("WindowsCurrentUserDPAPI");
        tool.Should().Contain("icacls.exe");
        tool.Should().Contain("rawKeyInCommandLine = false");
        tool.Should().Contain("rawKeyInEnvironment = false");
        tool.Should().NotContain("IPC_BACKUP_ENCRYPTION_PASSWORD");
        tool.Should().NotContain("Environment.SetEnvironmentVariable");
        tool.Should().Contain("RestoreApprovedArchiveAsync");
        tool.Should().Contain("targetAbsentBefore");
        tool.Should().Contain("finally");
        tool.Should().Contain("FindRestoreOracleMismatches");
    }

    [Fact]
    public void Archive_restore_should_require_ordered_migration_identity_and_exact_approval_target()
    {
        var tool = File.ReadAllText(Path.Combine(FindRepositoryRoot(), "backend", "tools",
            "IPCManagement.Phase42ArchiveTool", "Program.cs"));
        tool.Should().Contain("evidenceRunId");
        tool.Should().Contain("archiveRunId");
        tool.Should().Contain("migrationIds = actual.MigrationIds");
        tool.Should().Contain("approvalReceiptSha256");
        tool.Should().Contain("expectedRestoreTargetSource = \"IMMUTABLE_APPROVAL_RECEIPT\"");
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "package.json")))
            directory = directory.Parent;
        return directory?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }
}
