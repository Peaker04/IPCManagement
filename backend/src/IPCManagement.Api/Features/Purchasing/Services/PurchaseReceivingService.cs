using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Infrastructure.Lifecycle;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseReceivingService : IPurchaseReceivingService
{
    private readonly PurchaseReceiptDraftWorkflow _draftWorkflow;
    private readonly ReceiptLifecycleWorkflow _lifecycleWorkflow;
    private readonly IOperationalWarehouseResolver _operationalWarehouseResolver;

    public PurchaseReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        Func<string, CancellationToken, Task>? faultInjector = null)
        : this(context, stockLedgerService, transactionRunner, operationalWarehouseResolver, faultInjector, new LifecycleTransitionRecorder(context))
    {
    }

    public PurchaseReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        Func<string, CancellationToken, Task>? faultInjector,
        ILifecycleTransitionRecorder lifecycleRecorder)
    {
        _operationalWarehouseResolver = operationalWarehouseResolver;
        var queries = new PurchaseReceivingQueries(context);
        var validator = new PurchaseReceivingValidator(queries);

        _draftWorkflow = new PurchaseReceiptDraftWorkflow(
            context,
            transactionRunner,
            lifecycleRecorder,
            queries,
            validator,
            faultInjector);
        _lifecycleWorkflow = new ReceiptLifecycleWorkflow(
            context,
            stockLedgerService,
            transactionRunner,
            lifecycleRecorder,
            queries);
    }

    public async Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
    {
        var canonicalId = await _operationalWarehouseResolver.ResolveAsync(cancellationToken);
        if (request.WarehouseId is not null)
        {
            var suppliedId = GuidHelper.ParseGuidString(request.WarehouseId)
                ?? throw new ArgumentException("Kho nhận hàng không hợp lệ.");
            if (!suppliedId.AsSpan().SequenceEqual(canonicalId))
                throw new BusinessRuleException("Kho nhận hàng không khớp kho vận hành của hệ thống.");
        }
        request.WarehouseId = GuidHelper.ToGuidString(canonicalId);
        return await _draftWorkflow.RecordAsync(request, userId, cancellationToken);
    }

    public Task<WarehousePurchaseReceiptResultDto> AcceptQualityAsync(
        string receiptId,
        ReceiptQualityDecisionRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _lifecycleWorkflow.AcceptQualityAsync(receiptId, request, userId, cancellationToken);

    public Task<WarehousePurchaseReceiptResultDto> PostAsync(
        string receiptId,
        ReceiptPostRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _lifecycleWorkflow.PostAsync(receiptId, request, userId, cancellationToken);

    public Task<WarehousePurchaseReceiptResultDto> ReworkAsync(
        string receiptId,
        ReceiptReworkRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _lifecycleWorkflow.ReworkAsync(receiptId, request, userId, cancellationToken);

    public Task<WarehousePurchaseReceiptResultDto> VoidAsync(
        string receiptId,
        ReceiptVoidRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _lifecycleWorkflow.VoidAsync(receiptId, request, userId, cancellationToken);

    public Task<ReceiptCorrectionResultDto> CreateCorrectionAsync(
        string receiptId,
        CreateReceiptCorrectionRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _lifecycleWorkflow.CreateCorrectionAsync(receiptId, request, userId, cancellationToken);
}
