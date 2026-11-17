using IPCManagement.Api.Features.Inventory.Services;
using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationCompletionService(
    IpcManagementContext context,
    ReconciliationBatchService batches,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    public async Task<ReconciliationBatchDto> CompleteAsync(string id, CompleteReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        var batchId = ReconciliationBatchService.RequiredId(id);
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var protection = RequiredProtection();
        await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var batch = await context.Reconciliationbatches.Include(x => x.Lines).SingleOrDefaultAsync(x => x.BatchId == batchId, operationToken) ?? throw new KeyNotFoundException();
                context.Entry(batch).Property(x => x.Version).OriginalValue = request.ExpectedVersion;
                if (batch.Status != "IN_PROGRESS" || batch.Version != request.ExpectedVersion || batch.Lines.Count == 0) throw new DbUpdateConcurrencyException("Lô chưa sẵn sàng hoàn tất hoặc đã thay đổi.");
                var dailyProjection = await batches.GetWarehouseDailyAsync(id, operationToken);
                await ReconciliationCompletionEligibility.RequireAsync(context, batch, dailyProjection, operationToken);
                batch.Status = "COMPLETED"; batch.Version++; batch.CompletedBy = actor; batch.CompletedAt = DateTime.UtcNow;
                await context.SaveChangesAsync(operationToken);
                return true;
            },
            verifySucceeded: verifyToken => context.Reconciliationbatches.AsNoTracking().AnyAsync(x => x.BatchId == batchId && x.Status == "COMPLETED" && x.Version == request.ExpectedVersion + 1, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
        return (await batches.GetAsync(id, token))!;
    }

    private (string OperationKey, long ExpectedVersion) RequiredProtection() =>
        (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } key, long version) => (key, version),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành.")
        };
}
