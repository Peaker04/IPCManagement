using FluentAssertions;
using IPCManagement.Api.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

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
}
