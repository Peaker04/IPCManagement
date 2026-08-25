using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationBatchService(IpcManagementContext context)
{
    public async Task<IReadOnlyList<ReconciliationBatchDto>> ListAsync(CancellationToken token = default)
    {
        var batches = await context.Reconciliationbatches.AsNoTracking().Include(x => x.Lines).OrderByDescending(x => x.CreatedAt).ToListAsync(token);
        var lineIds = batches.SelectMany(x => x.Lines).Select(x => x.BatchLineId).ToList();
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => lineIds.Contains(x.BatchLineId)).ToListAsync(token);
        return batches.Select(batch => Map(batch, actuals, dispositions)).ToList();
    }

    public async Task<ReconciliationBatchDto?> GetAsync(string id, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var batch = await context.Reconciliationbatches.AsNoTracking().Include(x => x.Lines).SingleOrDefaultAsync(x => x.BatchId == bytes, token);
        if (batch is null) return null;
        var actuals = await context.Reconciliationactuals.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        var dispositions = await context.Reconciliationdispositions.AsNoTracking().Where(x => x.BatchLine.BatchId == bytes).ToListAsync(token);
        return Map(batch, actuals, dispositions);
    }

    public async Task<ReconciliationBatchDto> CreateDraftAsync(CreateReconciliationDraftRequest request, string actorId, CancellationToken token = default)
    {
        var batch = new ReconciliationBatch { BatchId = GuidHelper.NewId(), MenuVersionId = RequiredId(request.MenuVersionId), QuantityImportBatchId = RequiredId(request.QuantityImportBatchId), Status = "DRAFT", Version = 1, CreatedBy = RequiredId(actorId), CreatedAt = DateTime.UtcNow };
        context.Reconciliationbatches.Add(batch);
        await context.SaveChangesAsync(token);
        return Map(batch, [], []);
    }

    public async Task<ReconciliationBatchDto> ReadyAsync(string id, ReadyReconciliationBatchRequest request, string actorId, CancellationToken token = default)
    {
        var bytes = RequiredId(id);
        var batch = await context.Reconciliationbatches.Include(x => x.Lines).SingleOrDefaultAsync(x => x.BatchId == bytes, token) ?? throw new KeyNotFoundException();
        if (batch.Status != "DRAFT" || batch.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Lô đối chiếu đã thay đổi.");
        if (batch.Lines.Count == 0 || batch.Lines.Any(x => x.RequiredQuantity < 0 || x.FrozenTolerance < 0)) throw new InvalidOperationException("Lô chưa có đủ dòng nguyên liệu hợp lệ để sẵn sàng đối chiếu.");
        batch.Status = "READY"; batch.Version++; batch.ReadyBy = RequiredId(actorId); batch.ReadyAt = DateTime.UtcNow;
        await context.SaveChangesAsync(token);
        return Map(batch, [], []);
    }

    private static ReconciliationBatchDto Map(ReconciliationBatch batch, IReadOnlyList<ReconciliationActual> actuals, IReadOnlyList<ReconciliationDisposition> dispositions) =>
        new(GuidHelper.ToGuidString(batch.BatchId), GuidHelper.ToGuidString(batch.MenuVersionId), GuidHelper.ToGuidString(batch.QuantityImportBatchId), batch.Status, batch.Version, batch.CreatedAt, batch.ReadyAt, batch.CompletedAt,
            batch.Lines.Select(line => ReconciliationComparisonService.Map(line, actuals.Where(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)).ToList(), dispositions.FirstOrDefault(x => x.BatchLineId.AsSpan().SequenceEqual(line.BatchLineId)))).ToList());

    internal static byte[] RequiredId(string id) => GuidHelper.ParseGuidString(id) ?? throw new ArgumentException("ID không hợp lệ.");
}
