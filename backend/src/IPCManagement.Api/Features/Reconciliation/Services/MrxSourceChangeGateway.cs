using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal sealed class MrxSourceChangeGateway(
    IpcManagementContext context,
    IEfTransactionRunner? transactionRunner = null,
    SystemOperationRequestContext? operationContext = null) : IMrxSourceChangeGateway
{
    private IEfTransactionRunner Runner => transactionRunner ?? new EfTransactionRunner(context);
    private MrxSourceChangeApplier Applier => new(context, transactionRunner, operationContext);

    public Task<MenuAmendmentResultDto> PreviewAsync(
        CreateMenuAmendmentRequest request,
        CancellationToken cancellationToken)
        => Applier.PreviewAsync(request, cancellationToken);

    public Task<MenuAmendmentResultDto> ApplyAsync(
        MenuAmendment amendment,
        byte[] actorId,
        IReadOnlyCollection<string> actorRoles,
        string applyMode,
        long? expectedBatchVersion,
        CancellationToken cancellationToken)
        => Applier.ApplyAsync(
            amendment,
            actorId,
            MrxSourceChangeApplier.ResolveActorRole(actorRoles),
            applyMode,
            expectedBatchVersion,
            cancellationToken);

    public Task<IReadOnlySet<DateOnly>> GetLockedDatesAsync(byte[] batchId, CancellationToken cancellationToken)
        => MrxDayLockReader.GetLockedDatesAsync(context, batchId, cancellationToken);

    public Task<T> RunTransactionAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        Func<CancellationToken, Task<bool>> verifySucceeded,
        CancellationToken cancellationToken)
        => MrxSourceChangeApplier.RunMrxTransactionAsync(
            Runner,
            operationContext,
            operation,
            verifySucceeded,
            cancellationToken);
}
