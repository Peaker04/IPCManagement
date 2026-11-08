using FluentAssertions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Query;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IPCManagement.Api.Tests;

public class DependencyInjectionDatabaseRegistrationTests
{
    [Fact]
    public void ResolvingDbContext_Should_Not_OpenDatabaseConnection()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] =
                    "Server=127.0.0.1;Port=1;Database=unreachable;User=test;Password=test;Connection Timeout=1"
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddBackendServices(configuration);

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var resolve = () => scope.ServiceProvider.GetRequiredService<IpcManagementContext>();

        resolve.Should().NotThrow("EF registration must not perform network I/O");
        var context = resolve();
        context.GetService<IQueryCompilationContextFactory>().Create(async: true).IsBuffering.Should().BeTrue(
            "the production retrying provider prebuffers results even with AsAsyncEnumerable");
        using var export = MrxReportExportContext.Create(context);
        export.GetService<IQueryCompilationContextFactory>().Create(async: true).IsBuffering.Should().BeFalse();
        export.Database.CreateExecutionStrategy().RetriesOnFailure.Should().BeFalse();
        context.Database.CreateExecutionStrategy().RetriesOnFailure.Should().BeTrue();
        export.Database.GetConnectionString().Should().Be(context.Database.GetConnectionString());
        export.Database.GetCommandTimeout().Should().Be(context.Database.GetCommandTimeout());
        export.Database.GetDbConnection().Should().NotBeSameAs(context.Database.GetDbConnection());
    }
}
