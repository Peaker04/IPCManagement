using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Repositories;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Inventory.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using NSubstitute;

namespace IPCManagement.Api.Tests;

internal static class InventoryIssueServiceTestFactory
{
    internal static InventoryIssueService Create(
        IInventoryIssueRepository issueRepository,
        IUnitOfWork unitOfWork,
        IStockLedgerService stockLedgerService,
        IEfTransactionRunner transactionRunner,
        IOperationalWarehouseResolver operationalWarehouseResolver,
        IpcManagementContext? context = null,
        SystemOperationRequestContext? requestContext = null,
        SystemOperationModeGuard? modeGuard = null,
        IInventoryIssuePreWriteGate? preWriteGate = null,
        IMaterialRequestCompletionTransitionService? completionTransition = null)
    {
        var requiredTransition = completionTransition
            ?? (context is null
                ? Substitute.For<IMaterialRequestCompletionTransitionService>()
                : new MaterialRequestCompletionTransitionService(context));

        return new InventoryIssueService(
            issueRepository,
            unitOfWork,
            stockLedgerService,
            transactionRunner,
            operationalWarehouseResolver,
            requiredTransition,
            context,
            requestContext,
            modeGuard,
            preWriteGate);
    }
}
