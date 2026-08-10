using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.Purchasing.Contracts;

namespace IPCManagement.Api.Features.Purchasing.Services;

public sealed class PurchaseReceivingService : IPurchaseReceivingService
{
    private readonly PurchaseReceiptDraftWorkflow _draftWorkflow;

    public PurchaseReceivingService(
        IpcManagementContext context,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        Func<string, CancellationToken, Task>? faultInjector = null)
    {
        var queries = new PurchaseReceivingQueries(context);
        var validator = new PurchaseReceivingValidator(queries);

        _draftWorkflow = new PurchaseReceiptDraftWorkflow(
            context,
            stockLedgerService,
            transactionRunner,
            queries,
            validator,
            faultInjector);
    }

    public Task<WarehousePurchaseReceiptResultDto> RecordAsync(
        RecordWarehousePurchaseReceiptRequest request,
        string? userId,
        CancellationToken cancellationToken = default)
        => _draftWorkflow.RecordAsync(request, userId, cancellationToken);
}
