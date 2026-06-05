using IPCManagement.Application.Interfaces.Repositories;
using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Application.Services;
using IPCManagement.Infrastructure.Data;
using IPCManagement.Infrastructure.Repositories;
using IPCManagement.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddBackendServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

        services.AddDbContext<IpcManagementContext>(options =>
            options.UseMySql(connectionString, ServerVersion.AutoDetect(connectionString)));

        // Security
        services.AddScoped<ITokenService, JwtTokenService>();

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IIngredientRepository, IngredientRepository>();
        services.AddScoped<IDishRepository, DishRepository>();
        services.AddScoped<IWarehouseRepository, WarehouseRepository>();
        services.AddScoped<IInventoryReceiptRepository, InventoryReceiptRepository>();
        services.AddScoped<IInventoryIssueRepository, InventoryIssueRepository>();
        services.AddScoped<IProductionPlanRepository, ProductionPlanRepository>();

        // Services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IIngredientService, IngredientService>();
        services.AddScoped<IDishService, DishService>();
        services.AddScoped<IWarehouseService, WarehouseService>();
        services.AddScoped<IInventoryReceiptService, InventoryReceiptService>();
        services.AddScoped<IInventoryIssueService, InventoryIssueService>();
        services.AddScoped<IProductionPlanService, ProductionPlanService>();

        return services;
    }
}
