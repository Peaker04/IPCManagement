using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services;
using IPCManagement.Api.Services.Admin;
using IPCManagement.Api.Services.Approvals;
using IPCManagement.Api.Services.SampleData;
using IPCManagement.Api.Services.Workflow;
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

        // Configurations
        services.Configure<PaginationOptions>(configuration.GetSection(PaginationOptions.SectionName));

        // Unit of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Security
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ITokenService, JwtTokenService>();

        // Repositories
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IIngredientRepository, IngredientRepository>();
        services.AddScoped<IDishRepository, DishRepository>();
        services.AddScoped<IWarehouseRepository, WarehouseRepository>();
        services.AddScoped<IInventoryReceiptRepository, InventoryReceiptRepository>();
        services.AddScoped<IInventoryIssueRepository, InventoryIssueRepository>();
        services.AddScoped<IInventoryReturnRepository, InventoryReturnRepository>();
        services.AddScoped<IProductionPlanRepository, ProductionPlanRepository>();
        services.AddScoped<ICurrentStockRepository, CurrentStockRepository>();
        services.AddScoped<IStockMovementRepository, StockMovementRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

        // Services
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAdminEmployeeService, AdminEmployeeService>();
        services.AddScoped<IApprovalInboxService, ApprovalInboxService>();
        services.AddScoped<IApprovalWorkflowService, ApprovalWorkflowService>();
        services.AddScoped<IApprovalTargetHandler, PurchaseRequestApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, InventoryReceiptApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, InventoryIssueApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, InventoryAdjustmentApprovalHandler>();
        services.AddScoped<IIngredientService, IngredientService>();
        services.AddScoped<IDishService, DishService>();
        services.AddScoped<IWarehouseService, WarehouseService>();
        services.AddScoped<IInventoryReceiptService, InventoryReceiptService>();
        services.AddScoped<IInventoryIssueService, InventoryIssueService>();
        services.AddScoped<IInventoryReturnService, InventoryReturnService>();
        services.AddScoped<IProductionPlanService, ProductionPlanService>();
        services.AddScoped<IStockLedgerService, StockLedgerService>();
        services.AddScoped<ICoordinationService, CoordinationService>();
        services.AddScoped<ISampleDataImportService, SampleDataImportService>();
        services.AddScoped<IMaterialDemandService, MaterialDemandService>();
        services.AddScoped<IPurchaseRequestWorkflowService, PurchaseRequestWorkflowService>();
        services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
        services.AddScoped<IWorkflowReportService, WorkflowReportService>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<ISupplierQuotationService, SupplierQuotationService>();

        return services;
    }
}
