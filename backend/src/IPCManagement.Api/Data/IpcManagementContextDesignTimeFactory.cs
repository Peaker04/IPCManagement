using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Pomelo.EntityFrameworkCore.MySql.Infrastructure;

namespace IPCManagement.Api.Data;

public sealed class IpcManagementContextDesignTimeFactory : IDesignTimeDbContextFactory<IpcManagementContext>
{
    public IpcManagementContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Server=localhost;Port=3306;Database=ipcmanagement;User=root;Password=design-time-only;";
        var options = new DbContextOptionsBuilder<IpcManagementContext>()
            .UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36)))
            .Options;

        return new IpcManagementContext(options);
    }
}
