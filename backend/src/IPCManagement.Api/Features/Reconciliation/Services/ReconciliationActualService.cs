using System.Data;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
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
                    var disposition = await context.Reconciliationdispositions.SingleOrDefaultAsync(
                        x => x.InvalidatedAt == null && x.BatchLineId == lineBytes,
                        operationToken);
                    if (disposition is not null)
                    {
                        context.Auditlogs.Add(new AuditLog
                        {
                            AuditId = GuidHelper.NewId(), ChangedAt = DateTime.UtcNow, ChangedBy = actor,
                            BusinessArea = "RECONCILIATION", EntityName = "ReconciliationDisposition", EntityId = disposition.DispositionId,
                            FieldName = "Validity", OldValue = $"{disposition.Category}|{disposition.Reason}|v{disposition.Version}", NewValue = "INVALIDATED",
                            Reason = $"Actual {side} corrected from v{actual.Version}."
                        });
                        disposition.InvalidatedAt = DateTime.UtcNow;
                        disposition.InvalidatedBy = actor;
                        disposition.InvalidationReason = $"Actual {side} corrected from v{actual.Version}.";
                    }
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

    public async Task SetDailyDispositionAsync(string dailyLineId, SetReconciliationDispositionRequest request, string actorId, CancellationToken token = default)
    {
        var category = ReconciliationDispositionCategories.RequireValid(request.Category);
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần nhập lý do xử lý chênh lệch.");
        var dailyLineBytes = ReconciliationBatchService.RequiredId(dailyLineId);
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var protection = RequiredProtection();
        var resultingVersion = request.ExpectedVersion.GetValueOrDefault() + 1;

        await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
                ReconciliationBatchDailyLine? dailyLine;
                string batchStatus;
                if (inMemory)
                {
                    dailyLine = (await context.Reconciliationbatchdailylines.ToListAsync(operationToken))
                        .SingleOrDefault(line => line.DailyLineId.SequenceEqual(dailyLineBytes));
                    if (dailyLine is null) throw new KeyNotFoundException();
                    var weeklyLine = (await context.Reconciliationbatchlines.ToListAsync(operationToken))
                        .Single(line => line.BatchLineId.SequenceEqual(dailyLine.BatchLineId));
                    batchStatus = (await context.Reconciliationbatches.ToListAsync(operationToken))
                        .Single(batch => batch.BatchId.SequenceEqual(weeklyLine.BatchId)).Status;
                }
                else
                {
                    dailyLine = await context.Reconciliationbatchdailylines.Include(line => line.BatchLine).ThenInclude(line => line.Batch)
                        .SingleOrDefaultAsync(line => line.DailyLineId == dailyLineBytes, operationToken);
                    if (dailyLine is null) throw new KeyNotFoundException();
                    batchStatus = dailyLine.BatchLine.Batch.Status;
                }
                if (batchStatus != "IN_PROGRESS")
                    throw new InvalidOperationException("Chỉ lô đang đối chiếu mới được cập nhật hướng xử lý theo ngày.");
                var netIssueFacts = await new ReconciliationNetIssueProjection(context)
                    .LoadByDailyLineIdsAsync([dailyLineBytes], operationToken);
                if (!netIssueFacts.TryGetValue(Convert.ToHexString(dailyLineBytes), out var netIssue))
                    throw new InvalidOperationException("Cần có phiếu xuất kho theo ngày liên kết trước khi xử lý chênh lệch.");
                var lineStatus = ReconciliationDailyIssuePolicy.ResolveLineStatus(
                    dailyLine.RequiredQuantity,
                    netIssue.NetIssuedQuantity,
                    false);
                if (lineStatus.QuantityStatus != "OVER_ISSUED")
                    throw new BusinessRuleException("Chỉ dòng xuất vượt định mức mới được xử lý chênh lệch; xuất thiếu phải được xuất bổ sung.");

                var current = inMemory
                    ? (await context.Reconciliationdailydispositions.ToListAsync(operationToken))
                        .SingleOrDefault(item => item.InvalidatedAt == null && item.DailyLineId.SequenceEqual(dailyLineBytes))
                    : await context.Reconciliationdailydispositions.SingleOrDefaultAsync(
                        item => item.InvalidatedAt == null && item.DailyLineId == dailyLineBytes,
                        operationToken);
                if (current is null && request.ExpectedVersion.HasValue)
                    throw new DbUpdateConcurrencyException("Hướng xử lý theo ngày đã thay đổi.");
                var nextVersion = (await context.Reconciliationdailydispositions
                    .Where(item => item.DailyLineId == dailyLineBytes)
                    .MaxAsync(item => (long?)item.Version, operationToken) ?? 0) + 1;
                var now = DateTime.UtcNow;
                if (current is not null)
                {
                    if (current.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Hướng xử lý theo ngày đã thay đổi.");
                    if (context.Database.IsRelational())
                    {
                        var changed = await context.Reconciliationdailydispositions
                            .Where(item => item.DispositionId == current.DispositionId
                                && item.Version == request.ExpectedVersion && item.InvalidatedAt == null)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(item => item.InvalidatedAt, now)
                                .SetProperty(item => item.InvalidatedBy, actor)
                                .SetProperty(item => item.InvalidationReason, "Decision corrected."), operationToken);
                        if (changed != 1) throw new DbUpdateConcurrencyException("Hướng xử lý theo ngày đã thay đổi.");
                        context.Entry(current).State = EntityState.Detached;
                    }
                    else
                    {
                        current.InvalidatedAt = now;
                        current.InvalidatedBy = actor;
                        current.InvalidationReason = "Decision corrected.";
                    }
                }
                current = new ReconciliationDailyDisposition
                {
                    DispositionId = GuidHelper.NewId(), DailyLineId = dailyLineBytes, Category = category,
                    Reason = request.Reason.Trim(), Version = nextVersion, DisposedBy = actor, DisposedAt = now
                };
                context.Reconciliationdailydispositions.Add(current);
                resultingVersion = current.Version;
                await context.SaveChangesAsync(operationToken);
                return true;
            },
            verifySucceeded: verifyToken => context.Reconciliationdailydispositions.AsNoTracking()
                .AnyAsync(item => item.InvalidatedAt == null
                    && item.DailyLineId == dailyLineBytes
                    && item.Version == resultingVersion, verifyToken),
            isolationLevel: IsolationLevel.Serializable,
            cancellationToken: token);
    }

    public async Task SetDispositionAsync(string lineId, SetReconciliationDispositionRequest request, string actorId, CancellationToken token = default)
    {
        var category = ReconciliationDispositionCategories.RequireValid(request.Category);
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Cần nhập lý do xử lý chênh lệch.");
        var lineBytes = ReconciliationBatchService.RequiredId(lineId);
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var protection = RequiredProtection();
        var resultingVersion = request.ExpectedVersion.GetValueOrDefault() + 1;

        await transactions.ExecuteProtectedAsync(
            protection.OperationKey, protection.ExpectedVersion,
            async operationToken =>
            {
                var line = await context.Reconciliationbatchlines.Include(x => x.Batch).SingleOrDefaultAsync(x => x.BatchLineId == lineBytes, operationToken) ?? throw new KeyNotFoundException();
                if (line.Batch.Status != "IN_PROGRESS") throw new InvalidOperationException("Chỉ lô đang đối chiếu mới được cập nhật hướng xử lý.");
                var issueRows = await context.Inventoryissuelines.AsNoTracking()
                    .Where(x => x.ReconciliationBatchLineId == lineBytes)
                    .Select(x => new { x.IssueLineId, x.ReconciliationBatchLineId, x.IssuedQty })
                    .ToListAsync(operationToken);
                if (issueRows.Count == 0) throw new InvalidOperationException("Cần có phiếu xuất kho liên kết trước khi xử lý chênh lệch.");
                var issueLineIds = issueRows.Select(x => x.IssueLineId).ToList();
                var returns = await context.Inventoryreturnlines.AsNoTracking()
                    .Where(x => x.SourceIssueLineId != null && issueLineIds.Contains(x.SourceIssueLineId) && x.Return.ReceivedAt != null)
                    .Select(x => new { x.SourceIssueLineId, x.Quantity })
                    .ToListAsync(operationToken);
                var linkedIssued = ReconciliationBatchService.ProjectNetIssuedQuantities(
                    issueRows.Select(x => (x.IssueLineId, x.ReconciliationBatchLineId!, x.IssuedQty)),
                    returns.Select(x => (x.SourceIssueLineId!, x.Quantity)));
                var comparison = ReconciliationComparisonService.Map(line, [], null, ReconciliationBatchService.LinkedQuantity(linkedIssued, lineBytes));
                if (comparison.Triggers.Count == 0) throw new InvalidOperationException("Dòng không có chênh lệch hiện hành cần xử lý.");
                var current = await context.Reconciliationdispositions.SingleOrDefaultAsync(
                    x => x.InvalidatedAt == null && x.BatchLineId == lineBytes,
                    operationToken);
                if (current is null && request.ExpectedVersion.HasValue)
                    throw new DbUpdateConcurrencyException("Hướng xử lý đã thay đổi.");
                var nextVersion = (await context.Reconciliationdispositions
                    .Where(item => item.BatchLineId == lineBytes)
                    .MaxAsync(item => (long?)item.Version, operationToken) ?? 0) + 1;
                var now = DateTime.UtcNow;
                if (current is not null)
                {
                    if (current.Version != request.ExpectedVersion) throw new DbUpdateConcurrencyException("Hướng xử lý đã thay đổi.");
                    if (context.Database.IsRelational())
                    {
                        var changed = await context.Reconciliationdispositions
                            .Where(item => item.DispositionId == current.DispositionId
                                && item.Version == request.ExpectedVersion && item.InvalidatedAt == null)
                            .ExecuteUpdateAsync(setters => setters
                                .SetProperty(item => item.InvalidatedAt, now)
                                .SetProperty(item => item.InvalidatedBy, actor)
                                .SetProperty(item => item.InvalidationReason, "Decision corrected."), operationToken);
                        if (changed != 1) throw new DbUpdateConcurrencyException("Hướng xử lý đã thay đổi.");
                        context.Entry(current).State = EntityState.Detached;
                    }
                    else
                    {
                        current.InvalidatedAt = now;
                        current.InvalidatedBy = actor;
                        current.InvalidationReason = "Decision corrected.";
                    }
                }
                current = new ReconciliationDisposition
                {
                    DispositionId = GuidHelper.NewId(), BatchLineId = lineBytes, Category = category,
                    Reason = request.Reason.Trim(), Version = nextVersion, DisposedBy = actor, DisposedAt = now
                };
                context.Reconciliationdispositions.Add(current);
                resultingVersion = current.Version;
                await context.SaveChangesAsync(operationToken);
                return true;
            },
            verifySucceeded: verifyToken => context.Reconciliationdispositions.AsNoTracking()
                .AnyAsync(x => x.InvalidatedAt == null
                    && x.BatchLineId == lineBytes
                    && x.Version == resultingVersion, verifyToken),
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
