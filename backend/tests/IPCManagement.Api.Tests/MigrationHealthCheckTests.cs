using FluentAssertions;
using IPCManagement.Api.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Logging.Abstractions;

namespace IPCManagement.Api.Tests;

public sealed class MigrationHealthCheckTests
{
    [Fact]
    public void BuildResult_Should_BlockReadiness_WhenDatabaseHasPendingMigrations()
    {
        var result = MigrationHealthCheck.BuildResult(
        [
            "20260803193000_AddDishImportProvenance",
            "20260803203000_AddAuditCorrelationId",
            "20260803210000_AddCustomerWeekMenuTier"
        ]);

        result.Status.Should().Be(HealthStatus.Unhealthy);
        result.Description.Should().Contain("Database thiếu 3 migration chưa chạy");
        result.Description.Should().Contain("dotnet ef database update");
    }

    [Fact]
    public async Task EnsurePendingMigrationsAppliedAsync_Should_ApplyMigrations_WhenPendingExists()
    {
        var migrateCalls = 0;

        var applied = await MigrationHealthCheck.EnsurePendingMigrationsAppliedAsync(
            _ => Task.FromResult<IEnumerable<string>>(["20261107183023_FreezeMrxBomConversionRates"]),
            _ =>
            {
                migrateCalls++;
                return Task.CompletedTask;
            },
            NullLogger.Instance);

        migrateCalls.Should().Be(1);
        applied.Should().Equal("20261107183023_FreezeMrxBomConversionRates");
    }

    [Fact]
    public async Task EnsurePendingMigrationsAppliedAsync_Should_SkipMigrate_WhenNoPendingMigrations()
    {
        var migrateCalls = 0;

        var applied = await MigrationHealthCheck.EnsurePendingMigrationsAppliedAsync(
            _ => Task.FromResult<IEnumerable<string>>([]),
            _ =>
            {
                migrateCalls++;
                return Task.CompletedTask;
            },
            NullLogger.Instance);

        migrateCalls.Should().Be(0);
        applied.Should().BeEmpty();
    }
}
