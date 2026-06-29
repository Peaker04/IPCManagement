using IPCManagement.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace IPCManagement.Api.Tests.Infrastructure;

public sealed class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<IpcManagementContext>>();
            services.RemoveAll<IpcManagementContext>();

            var connectionString = Environment.GetEnvironmentVariable("IPC_TEST_CONNECTION_STRING")
                ?? throw new InvalidOperationException(
                    "Set IPC_TEST_CONNECTION_STRING to an isolated test database (preferably a MySQL Testcontainers instance).");

            services.AddDbContext<IpcManagementContext>(options =>
                options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));
        });
    }
}