using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationActualService(IpcManagementContext context)
{
    public async Task UpsertAsync(string lineId, string side, UpsertReconciliationActualRequest request, string actorId, CancellationToken token = default)
    {
        side = side.ToUpperInvariant();
        if (side is not ("PURCHASED" or "ISSUED")) throw new ArgumentException("Bên nhập số liệu không hợp lệ.");
        if (request.Quantity < 0) throw new ArgumentException("Số lượng không được âm.");
        if (request.Quantity == 0 && !request.ConfirmZero) throw new ArgumentException("Cần xác nhận rõ số lượng bằng 0.");
        var lineBytes = ReconciliationBatchService.RequiredId(lineId);
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var line = await context.Reconciliationbatchlines.Include(x => x.Batch).SingleOrDefaultAsync(x => x.BatchLineId == lineBytes, token) ?? throw new KeyNotFoundException();
        if (line.Batch.Status is not ("READY" or "IN_PROGRESS")) throw new InvalidOperationException("Lô không cho phép nhập số liệu.");
        var actual = await context.Reconciliationactuals.SingleOrDefaultAsync(x => x.BatchLineId == lineBytes && x.Side == side, token);
        if (actual is null)
        {
            if (request.ExpectedVersion.HasValue) throw new DbUpdateConcurrencyException("Dòng số liệu đã thay đổi.");
            actual = new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = lineBytes, Side = side, Quantity = request.Quantity, Version = 1, EnteredBy = actor, EnteredAt = DateTime.UtcNow };
            context.Reconciliationactuals.Add(actual);
        }
        else
        {
            if (actual.Version != request.ExpectedVersion || string.IsNullOrWhiteSpace(request.CorrectionReason)) throw new DbUpdateConcurrencyException("Số liệu hiện tại đã thay đổi hoặc thiếu lý do điều chỉnh.");
            context.Reconciliationactualrevisions.Add(new ReconciliationActualRevision { RevisionId = GuidHelper.NewId(), ActualId = actual.ActualId, OldQuantity = actual.Quantity, NewQuantity = request.Quantity, Reason = request.CorrectionReason.Trim(), ChangedBy = actor, ChangedAt = DateTime.UtcNow });
            actual.Quantity = request.Quantity; actual.Version++; actual.EnteredBy = actor; actual.EnteredAt = DateTime.UtcNow;
        }
        if (line.Batch.Status == "READY") { line.Batch.Status = "IN_PROGRESS"; line.Batch.Version++; }
        await context.SaveChangesAsync(token);
    }

    public async Task SetDispositionAsync(string lineId, SetReconciliationDispositionRequest request, string actorId, CancellationToken token = default)
    {
        if (string.IsNullOrWhiteSpace(request.Category) || string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần chọn hướng xử lý và nhập lý do.");
        var line = ReconciliationBatchService.RequiredId(lineId); var actor = ReconciliationBatchService.RequiredId(actorId);
        var current = await context.Reconciliationdispositions.SingleOrDefaultAsync(x => x.BatchLineId == line, token);
        if (current is null) context.Reconciliationdispositions.Add(new ReconciliationDisposition { DispositionId = GuidHelper.NewId(), BatchLineId = line, Category = request.Category.Trim(), Reason = request.Reason.Trim(), Version = 1, DisposedBy = actor, DisposedAt = DateTime.UtcNow });
        else { if (current.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Hướng xử lý đã thay đổi."); current.Category = request.Category.Trim(); current.Reason = request.Reason.Trim(); current.Version++; current.DisposedBy = actor; current.DisposedAt = DateTime.UtcNow; }
        await context.SaveChangesAsync(token);
    }
}
