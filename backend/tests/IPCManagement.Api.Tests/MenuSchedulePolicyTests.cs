using FluentAssertions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Tests;

public class MenuSchedulePolicyTests
{
    [Theory]
    [InlineData("published", "ACTIVE")]
    [InlineData(" archived ", "SUPERSEDED")]
    [InlineData("LOCKED", "LOCKED")]
    [InlineData("unknown", null)]
    public void NormalizeMenuScheduleStatus_Should_NormalizeSupportedAliases(string? value, string? expected)
        => MenuSchedulePolicy.NormalizeMenuScheduleStatus(value).Should().Be(expected);

    [Fact]
    public void ResolveRollbackTarget_Should_UseExplicitVersionNumber()
    {
        var versions = CreateVersions();
        var request = new RollbackMenuVersionRequest { TargetVersionNo = 1 };

        var result = MenuSchedulePolicy.ResolveRollbackTarget(versions, versions[2], request);

        result.Should().BeSameAs(versions[0]);
    }

    [Fact]
    public void ResolveRollbackTarget_Should_PreferLatestPublishedPreviousVersion()
    {
        var versions = CreateVersions();

        var result = MenuSchedulePolicy.ResolveRollbackTarget(
            versions,
            versions[2],
            new RollbackMenuVersionRequest());

        result.Should().BeSameAs(versions[1]);
    }

    [Fact]
    public void ResolveRollbackTarget_Should_RejectMalformedExplicitId()
    {
        var versions = CreateVersions();
        var request = new RollbackMenuVersionRequest { TargetMenuVersionId = "not-a-guid" };

        var action = () => MenuSchedulePolicy.ResolveRollbackTarget(versions, versions[2], request);

        action.Should().Throw<BusinessRuleException>();
    }

    private static IReadOnlyList<MenuVersion> CreateVersions()
        =>
        [
            new MenuVersion
            {
                MenuVersionId = Guid.NewGuid().ToByteArray(),
                CustomerId = Guid.NewGuid().ToByteArray(),
                VersionNo = 1,
                Status = "SUPERSEDED"
            },
            new MenuVersion
            {
                MenuVersionId = Guid.NewGuid().ToByteArray(),
                CustomerId = Guid.NewGuid().ToByteArray(),
                VersionNo = 2,
                Status = "PUBLISHED",
                PublishedAt = new DateTime(2026, 7, 20, 0, 0, 0, DateTimeKind.Utc)
            },
            new MenuVersion
            {
                MenuVersionId = Guid.NewGuid().ToByteArray(),
                CustomerId = Guid.NewGuid().ToByteArray(),
                VersionNo = 3,
                Status = "PUBLISHED",
                PublishedAt = new DateTime(2026, 7, 27, 0, 0, 0, DateTimeKind.Utc)
            }
        ];
}
