using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
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
                    .UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)
                    // CHƯA bật EnableRetryOnFailure — xem P1.5b.
                    // Retry khiến MỌI BeginTransaction thủ công ném InvalidOperationException
                    // ("execution strategy does not support user-initiated transactions") nếu
                    // không được bọc trong Database.CreateExecutionStrategy().ExecuteAsync(...).
                    // Đo ngày 26/07/2026: 26 chỗ BeginTransactionAsync ở 15 file, 0 chỗ đã bọc —
                    // trong đó UnitOfWork.BeginTransactionAsync là wrapper dùng chung cho 7 service.
                    // Unit test mock IUnitOfWork nên vẫn xanh, lỗi chỉ lộ khi chạy thật.
                    // Chỉ bật lại sau khi đã bọc đủ cả 26 chỗ trong một đợt riêng.
                    .CommandTimeout(commandTimeoutSeconds)));

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
        services.AddScoped<IDishService, DishService>();
        services.AddScoped<IWarehouseService, WarehouseService>();
        services.AddScoped<IInventoryReceiptService, InventoryReceiptService>();
        services.AddScoped<IInventoryIssueService, InventoryIssueService>();
        services.AddScoped<ISupplementalMaterialRequestService, SupplementalMaterialRequestService>();
        services.AddScoped<IInventoryReturnService, InventoryReturnService>();
        services.AddScoped<IProductionPlanService, ProductionPlanService>();
        services.AddScoped<IStockLedgerService, StockLedgerService>();
        services.AddScoped<ICoordinationService, CoordinationService>();
        services.AddScoped<ISampleDataImportService, SampleDataImportService>();
        services.AddScoped<IPurchaseHistoryReconciliationService, PurchaseHistoryReconciliationService>();
        services.AddScoped<IMaterialDemandService, MaterialDemandService>();
        services.AddScoped<IPurchaseRequestQueryService, PurchaseRequestQueryService>();
        services.AddScoped<IPurchaseRequestWorkflowService, PurchaseRequestWorkflowService>();
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
        services.AddScoped<IWorkflowReportService, WorkflowReportService>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<ISupplierQuotationService, SupplierQuotationService>();
        services.AddScoped<IStocktakeRepository, StocktakeRepository>();
        services.AddScoped<IStocktakeService, StocktakeService>();

        return services;
    }
}
