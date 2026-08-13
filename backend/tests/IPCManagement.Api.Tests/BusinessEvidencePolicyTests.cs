using System.Text.RegularExpressions;
using FluentAssertions;

namespace IPCManagement.Api.Tests;

public sealed partial class BusinessEvidencePolicyTests
{
    [Fact]
    public void DeployableModel_IsMigration70WithoutBusinessEvidencePersistence()
    {
        var root = FindWorkspaceRoot();
        var retiredPaths = new[]
        {
            "backend/src/IPCManagement.Api/Features/Reports/Contracts/BusinessEvidenceEnvelopeDto.cs",
            "backend/src/IPCManagement.Api/Features/Reports/Services/BusinessEvidencePolicy.cs",
            "backend/src/IPCManagement.Api/Features/Reports/Persistence/BusinessEvidencePackageConfiguration.cs",
            "backend/src/IPCManagement.Api/Models/Entities/BusinessEvidencePackage.cs",
            "backend/src/IPCManagement.Api/Models/Entities/BusinessEvidenceAttestation.cs",
            "backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.cs",
            "backend/src/IPCManagement.Api/Migrations/20260810120000_AddBusinessEvidenceClosure.Designer.cs"
        };

        retiredPaths.Select(path => Path.Combine(root, path))
            .Should().OnlyContain(path => !File.Exists(path));

        var contextSource = File.ReadAllText(Path.Combine(
            root, "backend/src/IPCManagement.Api/Data/IpcManagementContext.cs"));
        var snapshotSource = File.ReadAllText(Path.Combine(
            root, "backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs"));

        contextSource.Contains("BusinessEvidence", StringComparison.OrdinalIgnoreCase).Should().BeFalse();
        snapshotSource.Contains("BusinessEvidence", StringComparison.OrdinalIgnoreCase).Should().BeFalse();
        snapshotSource.Should().Contain("dataqualitydispositions");
        snapshotSource.Should().Contain("unitnormalizationreviews");

        var migrationsDirectory = Path.Combine(
            root, "backend/src/IPCManagement.Api/Migrations");
        var migrationIds = Directory.EnumerateFiles(migrationsDirectory, "*.cs")
            .Where(path => !path.EndsWith("IpcManagementContextModelSnapshot.cs", StringComparison.Ordinal))
            .SelectMany(path => MigrationIdPattern().Matches(File.ReadAllText(path))
                .Select(match => match.Groups[1].Value))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(id => id, StringComparer.Ordinal)
            .ToArray();

        migrationIds.Should().HaveCount(70);
        migrationIds[^1].Should().Be("20260813171032_AddMenuAmendmentDecisionFanRemediations");
    }

    [GeneratedRegex("\\[Migration\\(\"([^\"]+)\"\\)\\]", RegexOptions.CultureInvariant)]
    private static partial Regex MigrationIdPattern();

    private static string FindWorkspaceRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory is not null;
             directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "package.json")))
                return directory.FullName;
        }

        throw new DirectoryNotFoundException("Workspace root not found.");
    }
}
