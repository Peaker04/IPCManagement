using FluentAssertions;
using IPCManagement.DatabaseTool;
using MySqlConnector;

namespace IPCManagement.Api.Tests;

public sealed class BusinessEvidenceClosureCommandTests
{
    [Fact]
    public void ExactTerminalSnapshot_PassesWithZeroMutationStatements()
    {
        var snapshot = new BusinessEvidenceClosureSnapshot(
            Enumerable.Range(1, 2461).Select(index => Movement($"movement-{index}")).ToArray(),
            Enumerable.Range(1, 84).Select(index => Menu($"menu-{index}")).ToArray(),
            Enumerable.Range(1, 44).Select(index => Unit($"unit-{index}", index % 2 == 0 ? "CONFIRMED" : "RETAIN_DISTINCT")).ToArray());

        var result = BusinessEvidenceClosureCommand.Evaluate(snapshot);

        result.IsClosed.Should().BeTrue();
        result.MutationStatements.Should().Be(0);
        result.MovementCount.Should().Be(2461);
        result.MenuWeekCount.Should().Be(84);
        result.UnitReviewCount.Should().Be(44);
        result.Issues.Should().BeEmpty();
    }

    [Fact]
    public void MissingDuplicateStaleOrIncompleteRows_FailClosed()
    {
        var movements = Enumerable.Range(1, 2461).Select(index => Movement($"movement-{index}")).ToArray();
        movements[1] = movements[0] with { };
        movements[2] = movements[2] with { CurrentFingerprint = Fingerprint('B') };
        var menus = Enumerable.Range(1, 84).Select(index => Menu($"menu-{index}")).ToArray();
        menus[0] = menus[0] with { HasFullDownstreamProof = false };
        var units = Enumerable.Range(1, 43).Select(index => Unit($"unit-{index}", "CONFIRMED")).ToArray();
        units[0] = units[0] with { SourceToCatalogFactor = 0, CompatibleDimension = false };

        var result = BusinessEvidenceClosureCommand.Evaluate(new(movements, menus, units));

        result.IsClosed.Should().BeFalse();
        result.Issues.Should().Contain(issue => issue.Contains("duplicate", StringComparison.OrdinalIgnoreCase));
        result.Issues.Should().Contain(issue => issue.Contains("stale", StringComparison.OrdinalIgnoreCase));
        result.Issues.Should().Contain(issue => issue.Contains("downstream", StringComparison.OrdinalIgnoreCase));
        result.Issues.Should().Contain(issue => issue.Contains("44", StringComparison.Ordinal));
        result.Issues.Should().Contain(issue => issue.Contains("factor", StringComparison.OrdinalIgnoreCase));
    }

    [Theory]
    [InlineData("ipc_lane1")]
    [InlineData("ipc_lane9")]
    [InlineData("ipc_restore_phase42")]
    [InlineData("ipc_rehearsal_phase42_bad-name")]
    public async Task ForbiddenTarget_IsRejectedBeforeConnection(string database)
    {
        var connectionOpened = false;
        Task<MySqlConnection> OpenConnection()
        {
            connectionOpened = true;
            return Task.FromResult(new MySqlConnection());
        }

        var act = () => BusinessEvidenceClosureCommand.ExecuteAsync(OpenConnection, database);

        await act.Should().ThrowAsync<ArgumentException>();
        connectionOpened.Should().BeFalse();
    }

    private static BusinessEvidenceClosureRow Movement(string id) => new(
        id, Fingerprint('A'), Fingerprint('A'), "RESOLVED_NO_CHANGE",
        HasRequiredAttestations: true, SourceIsImmutable: true, HasFullDownstreamProof: true,
        OutcomeEntityType: null, OutcomeEntityId: null,
        SourceToCatalogFactor: null, CompatibleDimension: true, HasAuthoritativeSource: true);

    private static BusinessEvidenceClosureRow Menu(string id) => new(
        id, Fingerprint('A'), Fingerprint('A'), "SUPERSEDED",
        HasRequiredAttestations: true, SourceIsImmutable: true, HasFullDownstreamProof: true,
        OutcomeEntityType: "MenuSchedule", OutcomeEntityId: "11111111-1111-1111-1111-111111111111",
        SourceToCatalogFactor: null, CompatibleDimension: true, HasAuthoritativeSource: true);

    private static BusinessEvidenceClosureRow Unit(string id, string decision) => new(
        id, Fingerprint('A'), Fingerprint('A'), decision,
        HasRequiredAttestations: true, SourceIsImmutable: true, HasFullDownstreamProof: true,
        OutcomeEntityType: null, OutcomeEntityId: null,
        SourceToCatalogFactor: decision == "CONFIRMED" ? 1000m : null,
        CompatibleDimension: true, HasAuthoritativeSource: true);

    private static string Fingerprint(char value) => new(value, 64);
}
