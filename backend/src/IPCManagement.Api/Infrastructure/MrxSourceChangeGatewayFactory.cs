using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Services;
using IPCManagement.Api.Features.SampleData.Services;
using IPCManagement.Api.Features.SystemOperation.Services;

namespace IPCManagement.Api.Infrastructure;

internal static class MrxSourceChangeGatewayFactory
{
    public static IMrxSourceChangeGateway Create(
        IpcManagementContext context,
        IEfTransactionRunner? transactionRunner,
        SystemOperationRequestContext? operationContext)
        => new MrxSourceChangeGateway(context, transactionRunner, operationContext);
}
