using FluentAssertions;
using IPCManagement.Api.Exceptions;
using NSubstitute;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using System.Diagnostics;
using System.Reflection;
using System.Security.Claims;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Approvals.Services;
using IPCManagement.Api.Features.Coordination.Contracts;
using IPCManagement.Api.Features.Coordination.Services;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Planning.Contracts;
using IPCManagement.Api.Features.Planning.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Features.Reports.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Tests;

public partial class WorkflowGenerationTests
{
    private static async Task<MaterialRequest> SeedReportDocumentsAsync(IpcManagementContext context, WorkflowFixture fixture)
    {
        var materialRequest = new MaterialRequest
        {
            RequestId = GuidHelper.NewId(),
            RequestCode = "MR-20260615-FULLDAY",
            PlanId = fixture.ProductionPlanId,
            RequestDate = new DateOnly(2026, 6, 15),
            RequestScope = "FULLDAY",
            Status = "DRAFT",
            CreatedBy = fixture.UserId
        };

        context.Materialrequests.Add(materialRequest);
        context.Quantityimportbatches.Add(new QuantityImportBatch
        {
            ImportBatchId = GuidHelper.NewId(),
            BatchCode = "IMP-DEMO",
            SourceCompanyName = "Demo customer",
            SourceType = "EXCEL",
            ImportedBy = fixture.UserId,
            ImportedAt = DateTime.UtcNow.AddMinutes(-20),
            Status = "COMMITTED"
        });
        context.Approvalhistories.Add(new ApprovalHistory
        {
            ApprovalHistoryId = GuidHelper.NewId(),
            TargetType = nameof(MaterialRequest),
            TargetId = materialRequest.RequestId,
            Decision = "APPROVE",
            OldStatus = "DRAFT",
            NewStatus = "MANAGERAPPROVED",
            Reason = "Demo approval",
            ActionBy = fixture.UserId,
            ActionAt = DateTime.UtcNow.AddMinutes(-15)
        });
        context.Inventoryreceipts.Add(new InventoryReceipt
        {
            ReceiptId = fixture.ReceiptId,
            ReceiptCode = "NK-DEMO",
            ReceiptDate = new DateOnly(2026, 6, 15),
            WarehouseId = fixture.WarehouseId,
            SupplierId = fixture.SupplierId,
            CreatedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            Inventoryreceiptlines =
            [
                new InventoryReceiptLine
                {
                    ReceiptLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    Quantity = 10,
                    UnitPrice = 1000,
                    Amount = 10000
                }
            ]
        });
        context.Inventoryissues.Add(new InventoryIssue
        {
            IssueId = fixture.IssueId,
            IssueCode = "PX-DEMO",
            IssueDate = new DateOnly(2026, 6, 15),
            ShiftName = "MORNING",
            WarehouseId = fixture.WarehouseId,
            MaterialRequestId = materialRequest.RequestId,
            IssuedBy = fixture.UserId,
            CreatedAt = DateTime.UtcNow.AddMinutes(-5),
            Inventoryissuelines =
            [
                new InventoryIssueLine
                {
                    IssueLineId = GuidHelper.NewId(),
                    IngredientId = fixture.IngredientId,
                    UnitId = fixture.UnitId,
                    RequestedQty = 4,
                    IssuedQty = 4
                }
            ]
        });

        await context.SaveChangesAsync();
        return materialRequest;
    }

    private static ClaimsPrincipal BuildPrincipal(string roleName)
        => new(new ClaimsIdentity([new Claim(ClaimTypes.Role, roleName)], "TestAuth"));

    private static WeeklyMenuImportPersistence CreateWeeklyMenuImportPersistence(IpcManagementContext context)
    {
        var resultBuilder = new WeeklyMenuImportResultBuilder(context);
        var actorResolver = new WeeklyMenuAuditActorResolver(context);
        return new WeeklyMenuImportPersistence(context, resultBuilder, actorResolver);
    }

    private static PurchaseRequestWorkflowService CreatePurchaseRequestWorkflowService(IpcManagementContext context)
        => new(context, new SupplierQuotationService(context));

    private static async Task ApproveDemandAsync(IpcManagementContext context, string materialRequestId)
    {
        var requestId = GuidHelper.ParseGuidString(materialRequestId)
            ?? throw new InvalidOperationException("Mã nhu cầu test không hợp lệ.");
        var materialRequest = await context.Materialrequests.FindAsync(requestId)
            ?? throw new InvalidOperationException("Không tìm thấy nhu cầu test.");
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();
    }

    private static async Task SelectDefaultSupplierAsync(
        IpcManagementContext context,
        WorkflowFixture fixture,
        PurchaseRequestWorkflowResultDto purchase,
        decimal estimatedUnitPrice = 1000m)
    {
        var service = CreatePurchaseRequestWorkflowService(context);
        foreach (var line in purchase.Lines)
        {
            await ConfirmSupplierFromQuotationAsync(
                context,
                fixture.UserIdString,
                purchase.PurchaseRequestId,
                line.PurchaseRequestLineId,
                fixture.SupplierId,
                estimatedUnitPrice,
                service: service);
        }
    }

    private static async Task ConfirmSupplierFromQuotationAsync(
        IpcManagementContext context,
        string actorUserId,
        string purchaseRequestId,
        string purchaseRequestLineId,
        byte[] supplierId,
        decimal proposedUnitPrice,
        DateOnly? proposedDeliveryDate = null,
        string? note = null,
        PurchaseRequestWorkflowService? service = null)
    {
        var requestId = GuidHelper.ParseGuidString(purchaseRequestId)
            ?? throw new InvalidOperationException("Mã đề xuất mua test không hợp lệ.");
        var lineId = GuidHelper.ParseGuidString(purchaseRequestLineId)
            ?? throw new InvalidOperationException("Mã dòng mua test không hợp lệ.");
        var line = await context.Purchaserequestlines
            .Include(item => item.PurchaseRequest)
            .Include(item => item.Ingredient)
            .Include(item => item.SupplierDecisions)
            .SingleAsync(item =>
                item.PurchaseRequestId == requestId &&
                item.PurchaseRequestLineId == lineId);
        var quotation = new SupplierQuotation
        {
            QuotationId = GuidHelper.NewId(),
            SupplierId = supplierId,
            IngredientId = line.IngredientId,
            UnitPrice = DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice),
            EffectiveFrom = line.PurchaseRequest.PurchaseForDate.AddDays(-1),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Supplierquotations.Add(quotation);
        await context.SaveChangesAsync();

        service ??= CreatePurchaseRequestWorkflowService(context);
        await service.ConfirmLineSupplierAsync(
            purchaseRequestId,
            purchaseRequestLineId,
            new ConfirmPurchaseLineSupplierRequest
            {
                EvidenceType = SupplierEvidenceType.EffectiveQuotation,
                EvidenceId = GuidHelper.ToGuidString(quotation.QuotationId),
                SupplierId = GuidHelper.ToGuidString(supplierId),
                ProposedUnitPrice = proposedUnitPrice,
                ProposedDeliveryDate = (proposedDeliveryDate ?? line.PurchaseRequest.PurchaseForDate.AddDays(1))
                    .ToString("yyyy-MM-dd"),
                ExpectedDecisionVersion = line.SupplierDecisions
                    .Where(item => item.Status == "CURRENT")
                    .Select(item => item.Version)
                    .SingleOrDefault(),
                Note = note ?? (proposedUnitPrice > line.Ingredient.ReferencePrice * 1.15m
                    ? "Ngoại lệ giá cho fixture workflow"
                    : null)
            },
            actorUserId);
    }

    private static PurchaseOrderService CreatePurchaseOrderService(IpcManagementContext context)
        => new(
            context,
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            new EfTransactionRunner(context));

    private static PurchaseReceivingService CreatePurchaseReceivingService(IpcManagementContext context)
        => new(
            context,
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            new EfTransactionRunner(context));

    private static RecordWarehousePurchaseReceiptRequest CreatePurchaseReceiptRequest(
        WorkflowFixture fixture,
        string purchaseOrderId,
        string purchaseOrderLineId,
        decimal quantity,
        string idempotencyKey)
        => new()
        {
            PurchaseOrderId = purchaseOrderId,
            IdempotencyKey = idempotencyKey,
            WarehouseId = GuidHelper.ToGuidString(fixture.WarehouseId),
            ReceiptDate = new DateOnly(2026, 6, 2),
            Lines =
            [
                new WarehousePurchaseReceiptLineRequest
                {
                    PurchaseOrderLineId = purchaseOrderLineId,
                    ActualQuantity = quantity,
                    ActualUnitId = GuidHelper.ToGuidString(fixture.UnitId),
                    ActualUnitPrice = 1000m,
                    LotNumber = "LOT-WORKFLOW-01"
                }
            ]
        };

    private static InventoryIssueService CreateInventoryIssueService(IpcManagementContext context)
        => new(
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            new EfTransactionRunner(context),
            context);

    private static InventoryReceiptService CreateInventoryReceiptService(IpcManagementContext context)
        => new(
            new InventoryReceiptRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            new EfTransactionRunner(context),
            context);

    private static InventoryReturnService CreateInventoryReturnService(IpcManagementContext context)
        => new(
            new InventoryReturnRepository(context),
            new InventoryIssueRepository(context),
            new UnitOfWork(context),
            new StockLedgerService(
                new CurrentStockRepository(context),
                new StockMovementRepository(context)),
            new EfTransactionRunner(context),
            context);

    private static async Task<string> SeedSubmittedPurchaseRequestAsync(WorkflowFixture fixture)
    {
        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        await context.SaveChangesAsync();

        var purchaseService = CreatePurchaseRequestWorkflowService(context);
        var purchase = await purchaseService.GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await SelectDefaultSupplierAsync(context, fixture, purchase!);
        await purchaseService.SubmitAsync(purchase!.PurchaseRequestId, fixture.UserIdString);

        return purchase.PurchaseRequestId;
    }

    private sealed class CoordinationConfigurationTestHarness
    {
        private readonly CustomerContractService _contracts;
        private readonly PortionRuleService _portionRules;
        private readonly MenuScheduleService _menuSchedules;

        public CoordinationConfigurationTestHarness(IpcManagementContext context)
        {
            _contracts = new CustomerContractService(context);
            _portionRules = new PortionRuleService(context);
            _menuSchedules = new MenuScheduleService(context, new EfTransactionRunner(context));
        }

        public Task<IReadOnlyList<CustomerContractDto>> GetCustomerContractsAsync()
            => _contracts.GetCustomerContractsAsync();

        public Task<CustomerContractDto> CreateCustomerContractAsync(
            CreateCustomerContractRequest request,
            string? userId)
            => _contracts.CreateCustomerContractAsync(request, userId);

        public Task<CustomerContractDto?> UpdateCustomerContractAsync(
            string customerId,
            UpdateCustomerContractRequest request,
            string? userId,
            string? correlationId = null)
            => _contracts.UpdateCustomerContractAsync(customerId, request, userId, correlationId);

        public Task<PortionRuleDto> CreatePortionRuleAsync(CreatePortionRuleRequest request, string? userId)
            => _portionRules.CreatePortionRuleAsync(request, userId);

        public Task<IReadOnlyList<PortionRuleDto>> GetPortionRulesAsync(PortionRuleQueryDto query)
            => _portionRules.GetPortionRulesAsync(query);

        public Task<ResolvedPortionRuleDto?> ResolvePortionRuleAsync(ResolvePortionRuleRequest request)
            => _portionRules.ResolvePortionRuleAsync(request);

        public Task<MenuScheduleDto?> UpdateMenuScheduleRulesAsync(
            string id,
            UpdateMenuScheduleRulesRequest request,
            string? userId,
            string? correlationId = null)
            => _menuSchedules.UpdateMenuScheduleRulesAsync(id, request, userId, correlationId);

        public Task<MenuScheduleDto?> UpdateMenuScheduleVersionAsync(
            string id,
            UpdateMenuScheduleVersionRequest request,
            string? userId,
            string? correlationId = null)
            => _menuSchedules.UpdateMenuScheduleVersionAsync(id, request, userId, correlationId);

        public Task<MenuVersionRollbackResultDto> RollbackMenuVersionAsync(
            RollbackMenuVersionRequest request,
            string? userId)
            => _menuSchedules.RollbackMenuVersionAsync(request, userId);
    }

    private sealed class SelectCommandCounter : DbCommandInterceptor
    {
        public int SelectCount { get; private set; }
        public List<string> SelectCommands { get; } = [];

        public void Reset()
        {
            SelectCount = 0;
            SelectCommands.Clear();
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            {
                SelectCount++;
                SelectCommands.Add(command.CommandText);
            }

            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private static async Task SeedApprovedDemandWithPurchaseRequestAsync(
        WorkflowFixture fixture,
        string purchaseStatus)
    {
        await using var context = fixture.CreateContext();
        var demand = await new MaterialDemandService(context).GenerateAsync(
            new GenerateMaterialDemandRequest { ServiceDate = "2026-06-15", Scope = "FULLDAY" },
            fixture.UserIdString);
        var materialRequest = await context.Materialrequests.SingleAsync();
        materialRequest.Status = "MANAGERAPPROVED";
        var purchase = await CreatePurchaseRequestWorkflowService(context).GenerateFromDemandAsync(
            new GeneratePurchaseRequestFromDemandRequest { MaterialRequestId = demand!.MaterialRequestId },
            fixture.UserIdString);
        await SelectDefaultSupplierAsync(context, fixture, purchase!);
        var purchaseRequest = await context.Purchaserequests
            .SingleAsync(request => request.PurchaseRequestId == GuidHelper.ParseGuidString(purchase!.PurchaseRequestId)!);
        purchaseRequest.Status = purchaseStatus;
        var quantityLine = await context.Mealquantityplanlines.SingleAsync();
        quantityLine.FinalServings = 120;
        await context.SaveChangesAsync();
    }

}
