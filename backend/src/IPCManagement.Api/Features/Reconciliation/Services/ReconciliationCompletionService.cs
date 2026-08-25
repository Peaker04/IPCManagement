using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationCompletionService(IpcManagementContext context, ReconciliationBatchService batches)
{
    public async Task<ReconciliationBatchDto> CompleteAsync(string id, CompleteReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        var batchId = ReconciliationBatchService.RequiredId(id);
        var batch = await context.Reconciliationbatches.Include(x => x.Lines).SingleOrDefaultAsync(x => x.BatchId == batchId, token) ?? throw new KeyNotFoundException();
        if (batch.Status != "IN_PROGRESS" || batch.Version != request.ExpectedVersion || batch.Lines.Count == 0) throw new DbUpdateConcurrencyException("Lô chưa sẵn sàng hoàn tất hoặc đã thay đổi.");
        var lineIds = batch.Lines.Select(x => x.BatchLineId).ToList();
        var actuals = await context.Reconciliationactuals.Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        foreach (var line in batch.Lines)
        {
            var comparison = ReconciliationComparisonService.Map(line, actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(), dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)));
            if (comparison.PurchasedQuantity is null || comparison.IssuedQuantity is null) throw new InvalidOperationException("Mọi dòng phải có số lượng mua và xuất.");
            if (comparison.Triggers.Count > 0 && comparison.Disposition is null) throw new InvalidOperationException("Mọi dòng cần kiểm tra phải có hướng xử lý và lý do.");
        }
        batch.Status = "COMPLETED"; batch.Version++; batch.CompletedBy = ReconciliationBatchService.RequiredId(actorId); batch.CompletedAt = DateTime.UtcNow;
        await context.SaveChangesAsync(token);
        return (await batches.GetAsync(id, token))!;
    }
}
