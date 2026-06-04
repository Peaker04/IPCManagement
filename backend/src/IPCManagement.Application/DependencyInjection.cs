using IPCManagement.Application.Interfaces.Services;
using IPCManagement.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace IPCManagement.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
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
