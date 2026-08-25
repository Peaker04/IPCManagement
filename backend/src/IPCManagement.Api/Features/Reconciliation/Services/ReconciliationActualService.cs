using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationActualService(
    IpcManagementContext context,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext)
{
    public async Task UpsertAsync(string lineId, string side, UpsertReconciliationActualRequest request, string actorId, CancellationToken token = default)
    {
        side = side.ToUpperInvariant();
        if (side is not ("PURCHASED" or "ISSUED")) throw new ArgumentException("Bên nhập số liệu không hợp lệ.");
        if (request.Quantity < 0) throw new ArgumentException("Số lượng không được âm.");
        if (request.Quantity == 0 && !request.ConfirmZero) throw new ArgumentException("Cần xác nhận rõ số lượng bằng 0.");
        var lineBytes = ReconciliationBatchService.RequiredId(lineId);
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var protection = RequiredProtection();
        var resultingVersion = request.ExpectedVersion.GetValueOrDefault() + 1;

        await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var line = await context.Reconciliationbatchlines.Include(x => x.Batch).SingleOrDefaultAsync(x => x.BatchLineId == lineBytes, operationToken) ?? throw new KeyNotFoundException();
                if (line.Batch.Status is not ("READY" or "IN_PROGRESS")) throw new InvalidOperationException("Lô không cho phép nhập số liệu.");
                var actual = await context.Reconciliationactuals.SingleOrDefaultAsync(x => x.BatchLineId == lineBytes && x.Side == side, operationToken);
                if (actual is null)
                {
                    if (request.ExpectedVersion.HasValue) throw new DbUpdateConcurrencyException("Dòng số liệu đã thay đổi.");
                    actual = new ReconciliationActual { ActualId = GuidHelper.NewId(), BatchLineId = lineBytes, Side = side, Quantity = request.Quantity, Version = 1, EnteredBy = actor, EnteredAt = DateTime.UtcNow };
                    context.Reconciliationactuals.Add(actual);
                }
                else
                {
                    if (actual.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Số liệu hiện tại đã thay đổi.");
                    if (string.IsNullOrWhiteSpace(request.CorrectionReason)) throw new ArgumentException("Cần nhập lý do điều chỉnh.");
                    context.Entry(actual).Property(x => x.Version).OriginalValue = request.ExpectedVersion!.Value;
                    context.Reconciliationactualrevisions.Add(new ReconciliationActualRevision { RevisionId = GuidHelper.NewId(), ActualId = actual.ActualId, OldQuantity = actual.Quantity, NewQuantity = request.Quantity, Reason = request.CorrectionReason.Trim(), ChangedBy = actor, ChangedAt = DateTime.UtcNow });
                    actual.Quantity = request.Quantity; actual.Version++; actual.EnteredBy = actor; actual.EnteredAt = DateTime.UtcNow;
                }
                resultingVersion = actual.Version;
                if (line.Batch.Status == "READY")
                {
                    var originalBatchVersion = line.Batch.Version;
                    context.Entry(line.Batch).Property(x => x.Version).OriginalValue = originalBatchVersion;
                    line.Batch.Status = "IN_PROGRESS";
                    line.Batch.Version++;
                }
                await context.SaveChangesAsync(operationToken);
                return true;
            },
            verifySucceeded: verifyToken => context.Reconciliationactuals.AsNoTracking().AnyAsync(x => x.BatchLineId == lineBytes && x.Side == side && x.Version == resultingVersion && x.Quantity == request.Quantity, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
    }

    public async Task SetDispositionAsync(string lineId, SetReconciliationDispositionRequest request, string actorId, CancellationToken token = default)
    {
        if (string.IsNullOrWhiteSpace(request.Category) || string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần chọn hướng xử lý và nhập lý do.");
        var lineBytes = ReconciliationBatchService.RequiredId(lineId);
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var protection = RequiredProtection();
        var resultingVersion = request.ExpectedVersion.GetValueOrDefault() + 1;

        await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var line = await context.Reconciliationbatchlines.Include(x => x.Batch).SingleOrDefaultAsync(x => x.BatchLineId == lineBytes, operationToken) ?? throw new KeyNotFoundException();
                if (line.Batch.Status is not ("READY" or "IN_PROGRESS")) throw new InvalidOperationException("Chỉ lô đang đối chiếu mới được cập nhật hướng xử lý.");
                var current = await context.Reconciliationdispositions.SingleOrDefaultAsync(x => x.BatchLineId == lineBytes, operationToken);
                if (current is null)
                {
                    if (request.ExpectedVersion.HasValue) throw new DbUpdateConcurrencyException("Hướng xử lý đã thay đổi.");
                    current = new ReconciliationDisposition { DispositionId = GuidHelper.NewId(), BatchLineId = lineBytes, Category = request.Category.Trim(), Reason = request.Reason.Trim(), Version = 1, DisposedBy = actor, DisposedAt = DateTime.UtcNow };
                    context.Reconciliationdispositions.Add(current);
                }
                else
                {
                    if (current.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Hướng xử lý đã thay đổi.");
                    context.Entry(current).Property(x => x.Version).OriginalValue = request.ExpectedVersion!.Value;
                    current.Category = request.Category.Trim(); current.Reason = request.Reason.Trim(); current.Version++; current.DisposedBy = actor; current.DisposedAt = DateTime.UtcNow;
                }
                resultingVersion = current.Version;
                await context.SaveChangesAsync(operationToken);
                return true;
            },
            verifySucceeded: verifyToken => context.Reconciliationdispositions.AsNoTracking().AnyAsync(x => x.BatchLineId == lineBytes && x.Version == resultingVersion, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
    }

    private (string OperationKey, long ExpectedVersion) RequiredProtection() =>
        (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } key, long version) => (key, version),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành.")
        };
}
