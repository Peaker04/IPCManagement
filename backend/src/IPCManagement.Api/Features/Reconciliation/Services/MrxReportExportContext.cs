using IPCManagement.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class MrxReportExportContext
{
    internal static IpcManagementContext Create(IpcManagementContext source)
    {
        var options = new DbContextOptionsBuilder<IpcManagementContext>(
            (DbContextOptions<IpcManagementContext>)source.GetService<IDbContextOptions>()).UseModel(source.Model);
        if (source.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql")
            new MySqlDbContextOptionsBuilder(options)
                .ExecutionStrategy(dependencies => new NonRetryingExecutionStrategy(dependencies))
                .UseQuerySplittingBehavior(QuerySplittingBehavior.SingleQuery);
        return new IpcManagementContext(options.Options);
    }
}
