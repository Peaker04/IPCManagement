using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Infrastructure.Lifecycle;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseReceivingService : IPurchaseReceivingService
{
    private readonly PurchaseReceiptDraftWorkflow _draftWorkflow;
    private readonly ReceiptLifecycleWorkflow _lifecycleWorkflow;

    public PurchaseReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        Func<string, CancellationToken, Task>? faultInjector = null)
        : this(context, stockLedgerService, transactionRunner, faultInjector, new LifecycleTransitionRecorder(context))
    {
    }

    public PurchaseReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        Func<string, CancellationToken, Task>? faultInjector,
        ILifecycleTransitionRecorder lifecycleRecorder)
    {
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

    public Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _draftWorkflow.RecordAsync(request, userId, cancellationToken);

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
