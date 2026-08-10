using System.Text;
using FluentAssertions;
using IPCManagement.DatabaseTool;

namespace IPCManagement.Api.Tests;

public sealed class BusinessEvidenceExportCommandTests
{
    [Fact]
    public void Exact_membership_stable_ids_traversal_and_maps_pass()
    {
        var snapshot = FixtureSnapshot();

        var issues = BusinessEvidenceExportCommand.Validate(snapshot);

        issues.Should().BeEmpty();
    }

    [Fact]
    public void Count_drift_unstable_subject_incomplete_menu_or_duplicate_map_fails_closed()
    {
        var snapshot = FixtureSnapshot();
        var incompleteMenu = snapshot.MenuWeeks[0] with
        {
            PhysicalReferences = snapshot.MenuWeeks[0].PhysicalReferences
                .Where(pair => pair.Key != "stockmovements")
                .ToDictionary()
        };
        var incompleteDuplicate = snapshot.DuplicateGroups[0] with
        {
            ConsumerReferences = snapshot.DuplicateGroups[0].ConsumerReferences
                .Where(pair => pair.Key != "dishbom")
                .ToDictionary()
        };
        snapshot = snapshot with
        {
            Movements = snapshot.Movements.Skip(1).ToArray(),
            MenuWeeks = [incompleteMenu, .. snapshot.MenuWeeks.Skip(1)],
            DuplicateGroups = [incompleteDuplicate, .. snapshot.DuplicateGroups.Skip(1)]
        };

        var issues = BusinessEvidenceExportCommand.Validate(snapshot);

        issues.Should().Contain(issue => issue.Contains("2,461", StringComparison.Ordinal));
        issues.Should().Contain(issue => issue.Contains("stockmovements", StringComparison.Ordinal));
        issues.Should().Contain(issue => issue.Contains("dishbom", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("ipc_lane1")]
    [InlineData("ipc_lane9")]
    [InlineData("ipc_restore_phase42")]
    [InlineData("ipc_rehearsal_phase42_export")]
    public void Export_target_guard_rejects_every_non_base_target(string database)
    {
        var act = () => BusinessEvidenceExportCommand.ValidateTarget(database);

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public async Task Persisted_utf8_bytes_are_hashed_exactly_without_bom()
    {
        var output = Path.Combine(Path.GetTempPath(), $"phase42-export-{Guid.NewGuid():N}.json");
        try
        {
            var receipt = await BusinessEvidenceExportCommand.WritePackageAsync(FixtureSnapshot(), output);
            var bytes = await File.ReadAllBytesAsync(output);

            bytes.Take(Encoding.UTF8.GetPreamble().Length).Should().NotEqual(Encoding.UTF8.GetPreamble());
            receipt.PackageSha256.Should().Be(Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(bytes)));
            (await File.ReadAllTextAsync(output + ".sha256")).Trim().Should().Be(receipt.PackageSha256);
            receipt.MutationStatements.Should().Be(0);
        }
        finally
        {
            File.Delete(output);
            File.Delete(output + ".sha256");
        }
    }

    private static BusinessEvidenceExportSnapshot FixtureSnapshot()
    {
        var movement = Enumerable.Range(1, 2461)
            .Select(index => new BusinessEvidenceSubject($"{index:x32}", Fingerprint(index),
                new Dictionary<string, string?>(), ["LEDGER"], ["WAREHOUSE_SOURCE_OWNER"]))
            .ToArray();
        var physical = BusinessEvidenceExportCommand.RequiredMenuReferenceSurfaces
            .ToDictionary(surface => surface, _ => (IReadOnlyList<string>)[]);
        var menus = Enumerable.Range(1, 84)
            .Select(index => new MenuEvidenceSubject($"{index:x32}", Fingerprint(index), physical,
                ["SOURCE_WORKBOOK", "DOWNSTREAM_TRAVERSAL"], ["COORDINATION_SOURCE_OWNER"]))
            .ToArray();
        var units = Enumerable.Range(1, 44)
            .Select(index => new BusinessEvidenceSubject($"{index:x32}", Fingerprint(index),
                new Dictionary<string, string?>(), ["AUTHORITATIVE_UNIT_SOURCE"], ["CATALOG_SOURCE_OWNER"]))
            .ToArray();
        var maps = BusinessEvidenceExportCommand.RequiredDuplicateConsumerSurfaces
            .ToDictionary(surface => surface, _ => (IReadOnlyList<StableConsumerReference>)[]);
        var duplicates = Enumerable.Range(1, 16)
            .Select(index => new DuplicateEvidenceGroup(Fingerprint(index), Fingerprint(index),
                [$"{index:x32}", $"{index + 100:x32}"], maps, true, true,
                ["FULL_REFERENCE_MAP"], ["CATALOG_SOURCE_OWNER"]))
            .ToArray();

        return new BusinessEvidenceExportSnapshot(
            "ipcmanagement", "head", movement, menus, units, [], [], duplicates, 0);
    }

    private static string Fingerprint(int value) => value.ToString("X64");
}
