using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Admin.Services;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Auth.Services;
using IPCManagement.Api.Features.Catalog.Services;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;

namespace IPCManagement.Api;

public static class DependencyInjection
{
    public static IServiceCollection AddBackendServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

        // Query dài nhất hiện tại là các báo cáo workflow; 30s đủ rộng mà vẫn chặn được
        // câu lệnh treo giữ kết nối vô hạn.
        var commandTimeoutSeconds = configuration.GetValue<int?>("Database:CommandTimeoutSeconds") ?? 30;

        services.AddDbContext<IpcManagementContext>(options =>
            options.UseMySql(
                connectionString,
                ServerVersion.AutoDetect(connectionString),
                mySqlOptions => mySqlOptions
                    // Manual transactions are centralized in EfTransactionRunner, which
                    // executes them through the provider execution strategy.
                    .EnableRetryOnFailure()
                    .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    .CommandTimeout(commandTimeoutSeconds)));

        // Configurations
        services.Configure<PaginationOptions>(configuration.GetSection(PaginationOptions.SectionName));

        // Unit of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IEfTransactionRunner>(serviceProvider =>
            new EfTransactionRunner(serviceProvider.GetRequiredService<IpcManagementContext>()));

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
        services.AddScoped<IApprovalHistoryQueryService, ApprovalHistoryQueryService>();
        services.AddScoped<IApprovalWorkflowService, ApprovalWorkflowService>();
        services.AddScoped<IApprovalRoutingService, ApprovalRoutingService>();
        services.AddScoped<IApprovalTargetHandler, MaterialDemandApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, PurchasePriceExceptionApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, PurchaseRequestApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, InventoryReceiptApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, InventoryIssueApprovalHandler>();
        services.AddScoped<IApprovalTargetHandler, InventoryAdjustmentApprovalHandler>();
        services.AddScoped<IIngredientService, IngredientService>();
        services.AddScoped<IDishCatalogService, DishCatalogService>();
        services.AddScoped<IDishCatalogDiagnosticsService, DishCatalogDiagnosticsService>();
        services.AddScoped<IDishBomTemplateService, DishBomTemplateService>();
        services.AddScoped<IDishBomImportService, DishBomImportService>();
        services.AddScoped<IDishBomService, DishBomService>();
        services.AddScoped<IWarehouseService, WarehouseService>();
        services.AddScoped<IInventoryReceiptService, InventoryReceiptService>();
        services.AddScoped<IInventoryIssueService, InventoryIssueService>();
        services.AddScoped<ISupplementalMaterialRequestService, SupplementalMaterialRequestService>();
        services.AddScoped<IInventoryReturnService, InventoryReturnService>();
        services.AddScoped<IProductionPlanService, ProductionPlanService>();
        services.AddScoped<IServiceRunService, ServiceRunService>();
        services.AddScoped<IStockLedgerService, StockLedgerService>();
        services.AddScoped<ICustomerContractService, CustomerContractService>();
        services.AddScoped<IPortionRuleService, PortionRuleService>();
        services.AddScoped<IMenuScheduleService, MenuScheduleService>();
        services.AddScoped<IMealQuantityPlanService, MealQuantityPlanService>();
        services.AddScoped<IOrderPlanService, OrderPlanService>();
        services.AddScoped<IOrderAdjustmentService, OrderAdjustmentService>();
        services.AddScoped<IOrderSignoffService, OrderSignoffService>();
        services.AddScoped<WeeklyMenuCustomerResolver>();
        services.AddScoped<WeeklyMenuAuditActorResolver>();
        services.AddScoped<WeeklyMenuImportResultBuilder>();
        services.AddScoped<IWeeklyMenuImportPersistence, WeeklyMenuImportPersistence>();
        services.AddScoped<WeeklyMenuImportPreviewTicketStore>();
        services.AddScoped<IWeeklyMenuQueryService, WeeklyMenuQueryService>();
        services.AddScoped<IWeeklyMenuTemplateService, WeeklyMenuTemplateService>();
        services.AddScoped<ICustomerImportMappingService, CustomerImportMappingService>();
        services.AddScoped<IWeeklyMenuImportService, WeeklyMenuImportService>();
        services.AddScoped<IWeeklyMenuImportHistoryService, WeeklyMenuImportHistoryService>();
        services.AddScoped<IWeeklyMenuBulkEditService, WeeklyMenuBulkEditService>();
        services.AddScoped<ISampleBomImportService, SampleBomImportService>();
        services.AddScoped<IPurchaseHistoryReconciliationService, PurchaseHistoryReconciliationService>();
        services.AddScoped<IMaterialDemandService, MaterialDemandService>();
        services.AddScoped<IPurchaseRequestQueryService, PurchaseRequestQueryService>();
        services.AddScoped<IPurchaseWorkbenchService, PurchaseWorkbenchService>();
        services.AddScoped<IPurchaseRequestGenerationService, PurchaseRequestGenerationService>();
        services.AddScoped<IPurchaseSupplierDecisionService, PurchaseSupplierDecisionService>();
        services.AddScoped<IPurchaseRequestSubmissionService, PurchaseRequestSubmissionService>();
        services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
        services.AddScoped<IPurchaseReceivingService, PurchaseReceivingService>();
        services.AddScoped<IDemandReportService, DemandReportService>();
        services.AddScoped<IPriceVarianceReportService, PriceVarianceReportService>();
        services.AddScoped<IPurchasingReportService, PurchasingReportService>();
        services.AddScoped<IStockSnapshotReportService, StockSnapshotReportService>();
        services.AddScoped<IInventoryOperationsReportService, InventoryOperationsReportService>();
        services.AddScoped<IStockMovementReportService, StockMovementReportService>();
        services.AddScoped<IAuditReportService, AuditReportService>();
        services.AddScoped<IStockLedgerReportService, StockLedgerReportService>();
        services.AddScoped<IDataQualityReportService, DataQualityReportService>();
        services.AddScoped<IDataQualityCommandService, DataQualityCommandService>();
        services.AddScoped<IOperationalKpiReportService, OperationalKpiReportService>();
        services.AddSingleton<IWorkflowReportAggregateCache, WorkflowReportAggregateCache>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<ISupplierQuotationService, SupplierQuotationService>();
        services.AddScoped<IStocktakeRepository, StocktakeRepository>();
        services.AddScoped<IStocktakeService, StocktakeService>();

        return services;
    }
}
