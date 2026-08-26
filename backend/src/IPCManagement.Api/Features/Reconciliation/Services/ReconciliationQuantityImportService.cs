using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MySqlConnector;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public sealed class ReconciliationQuantityImportService(
    IpcManagementContext context,
    IEfTransactionRunner transactions,
    SystemOperationRequestContext requestContext,
    IMemoryCache cache)
{
    private const int FingerprintFormatVersion = 1;
    private static readonly TimeSpan PreviewLifetime = TimeSpan.FromMinutes(15);
    private const string TicketPrefix = "ReconciliationQuantityImport:";

    public async Task<QuantityImportPreviewDto> PreviewAsync(PreviewQuantityImportRequest request, CancellationToken token = default)
    {
        var menuVersionId = ReconciliationBatchService.RequiredId(request.MenuVersionId);
        var snapshot = await LoadSnapshotAsync(menuVersionId, token);
        var fingerprint = Fingerprint(snapshot);
        var previewToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var expiresAt = DateTimeOffset.UtcNow.Add(PreviewLifetime);
        cache.Set(TicketPrefix + previewToken, new PreviewTicket(menuVersionId, fingerprint, expiresAt), expiresAt);
        return new(previewToken, expiresAt, fingerprint, FingerprintFormatVersion, snapshot.Plans.Select(Map).ToList(), []);
    }

    public async Task<QuantityImportCommitDto> CommitAsync(CommitQuantityImportRequest request, string actorId, CancellationToken token = default)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || !cache.TryGetValue<PreviewTicket>(TicketPrefix + request.Token, out var ticket)
            || ticket is null || ticket.ExpiresAt <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("Phiên xem trước đã hết hạn hoặc không hợp lệ.");
        if (!string.Equals(ticket.Fingerprint, request.ContentFingerprint, StringComparison.Ordinal))
            throw new InvalidOperationException("Dấu vân tay nguồn không khớp phiên xem trước.");
        var actor = ReconciliationBatchService.RequiredId(actorId);
        var protection = RequiredProtection();

        try
        {
            return await transactions.ExecuteProtectedAsync(
                protection.OperationKey,
                protection.ExpectedVersion,
                async operationToken =>
                {
                    var existing = await ExistingAsync(ticket.Fingerprint, operationToken);
                    if (existing is not null) return existing;

                    var snapshot = await LoadSnapshotAsync(ticket.MenuVersionId, operationToken);
                    var currentFingerprint = Fingerprint(snapshot);
                    if (!string.Equals(currentFingerprint, ticket.Fingerprint, StringComparison.Ordinal))
                        throw new DbUpdateConcurrencyException("Nguồn số suất đã thay đổi sau khi xem trước.");
                    if (snapshot.Plans.Any(plan => plan.Entity.ImportBatchId is not null))
                        throw new DbUpdateConcurrencyException("Nguồn số suất đã được cam kết bởi thao tác khác.");

                    var now = DateTime.UtcNow;
                    var importId = GuidHelper.NewId();
                    var reconciliationId = GuidHelper.NewId();
                    var import = new QuantityImportBatch
                    {
                        ImportBatchId = importId,
                        BatchCode = $"RCQ-{now:yyyyMMddHHmmss}-{currentFingerprint[..8]}",
                        SourceType = "API",
                        SourceCompanyName = NormalizeSourceLabel(request.SourceLabel),
                        SourceLabel = NormalizeSourceLabel(request.SourceLabel),
                        MenuVersionId = ticket.MenuVersionId,
                        ContentFingerprint = currentFingerprint,
                        FingerprintFormatVersion = FingerprintFormatVersion,
                        ImportedBy = actor,
                        ImportedAt = now,
                        Status = "CONFIRMED"
                    };
                    context.Quantityimportbatches.Add(import);
                    foreach (var plan in snapshot.Plans) plan.Entity.ImportBatchId = importId;
                    context.Reconciliationbatches.Add(new ReconciliationBatch
                    {
                        BatchId = reconciliationId,
                        MenuVersionId = ticket.MenuVersionId,
                        QuantityImportBatchId = importId,
                        Status = "DRAFT",
                        Version = 1,
                        CreatedBy = actor,
                        CreatedAt = now
                    });
                    context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actor, BusinessArea = "Reconciliation",
                        EntityName = nameof(QuantityImportBatch), EntityId = importId, FieldName = "Commit",
                        NewValue = currentFingerprint, Reason = "Cam kết nguồn số suất đối chiếu"
                    });
                    await context.SaveChangesAsync(operationToken);
                    return new(GuidHelper.ToGuidString(importId), GuidHelper.ToGuidString(reconciliationId), currentFingerprint, false);
                },
                verifySucceeded: verifyToken => context.Quantityimportbatches.AsNoTracking().AnyAsync(x => x.ContentFingerprint == ticket.Fingerprint, verifyToken),
                isolationLevel: IsolationLevel.Serializable,
                cancellationToken: token);
        }
        catch (DbUpdateException error) when (IsDuplicate(error))
        {
            context.ChangeTracker.Clear();
            return await ExistingAsync(ticket.Fingerprint, token)
                ?? throw new DbUpdateConcurrencyException("Nguồn số suất đã được cam kết đồng thời.", error);
        }
    }

    private async Task<CanonicalSnapshot> LoadSnapshotAsync(byte[] menuVersionId, CancellationToken token)
    {
        var menuVersion = await context.Menuversions.AsNoTracking().SingleOrDefaultAsync(x => x.MenuVersionId == menuVersionId, token)
            ?? throw new KeyNotFoundException("Không tìm thấy phiên bản thực đơn.");
        if (!MenuVersionStatusPolicy.PublishedCompatibleStatuses.Contains(menuVersion.Status))
            throw new InvalidOperationException("Phiên bản thực đơn chưa được phát hành.");

        var plans = await context.Mealquantityplans
            .Include(plan => plan.Mealquantityplanlines)
            .ThenInclude(line => line.MenuSchedule)
            .Where(plan => plan.Mealquantityplanlines.Any(line => line.MenuSchedule.MenuVersionId == menuVersionId))
            .AsSplitQuery()
            .ToListAsync(token);
        if (plans.Count == 0) throw new InvalidOperationException("Phiên bản thực đơn chưa có nguồn số suất.");
        if (plans.Any(plan => !string.Equals(plan.Status, "COMPLETED", StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Mọi kế hoạch số suất phải hoàn tất trước khi cam kết.");
        if (plans.Any(plan => plan.Mealquantityplanlines.Count == 0 || plan.Mealquantityplanlines.Any(line => line.MenuSchedule.MenuVersionId is null || !line.MenuSchedule.MenuVersionId.AsSpan().SequenceEqual(menuVersionId))))
            throw new InvalidOperationException("Nguồn số suất chứa nhiều phiên bản thực đơn hoặc dòng không hợp lệ.");
        return new(menuVersionId, plans.OrderBy(plan => Convert.ToHexString(plan.QuantityPlanId)).Select(plan => new CanonicalPlan(plan, plan.Mealquantityplanlines.OrderBy(line => Convert.ToHexString(line.QuantityPlanLineId)).ToList())).ToList());
    }

    private async Task<QuantityImportCommitDto?> ExistingAsync(string fingerprint, CancellationToken token)
    {
        var pair = await context.Quantityimportbatches.AsNoTracking()
            .Where(import => import.ContentFingerprint == fingerprint && import.Status == "CONFIRMED" && import.MenuVersionId != null)
            .Join(context.Reconciliationbatches.AsNoTracking(), import => import.ImportBatchId, batch => batch.QuantityImportBatchId, (import, batch) => new { import, batch })
            .SingleOrDefaultAsync(token);
        return pair is null ? null : new(GuidHelper.ToGuidString(pair.import.ImportBatchId), GuidHelper.ToGuidString(pair.batch.BatchId), fingerprint, true);
    }

    private static string Fingerprint(CanonicalSnapshot snapshot)
    {
        var builder = new StringBuilder().Append("v1|").Append(GuidHelper.ToGuidString(snapshot.MenuVersionId));
        foreach (var plan in snapshot.Plans)
        {
            builder.Append("|p:").Append(GuidHelper.ToGuidString(plan.Entity.QuantityPlanId)).Append(':')
                .Append(plan.Entity.PlanCode).Append(':')
                .Append(plan.Entity.RowVersion.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture)).Append(':')
                .Append(plan.Entity.Status).Append(':').Append(plan.Entity.ServiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            foreach (var line in plan.Lines)
                builder.Append("|l:").Append(GuidHelper.ToGuidString(line.QuantityPlanLineId)).Append(':')
                    .Append(GuidHelper.ToGuidString(line.MenuScheduleId)).Append(':').Append(GuidHelper.ToGuidString(line.CustomerId)).Append(':')
                    .Append(GuidHelper.ToGuidString(line.MenuId)).Append(':').Append(line.ShiftName).Append(':')
                    .Append(line.FinalServings.ToString(CultureInfo.InvariantCulture));
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(builder.ToString())));
    }

    private static QuantityImportPlanDto Map(CanonicalPlan plan) => new(
        GuidHelper.ToGuidString(plan.Entity.QuantityPlanId), plan.Entity.PlanCode, plan.Entity.ServiceDate, plan.Entity.Status,
        plan.Entity.RowVersion, plan.Lines.Select(line => new QuantityImportPlanLineDto(
            GuidHelper.ToGuidString(line.QuantityPlanLineId), GuidHelper.ToGuidString(line.MenuScheduleId), GuidHelper.ToGuidString(line.CustomerId),
            GuidHelper.ToGuidString(line.MenuId), line.ShiftName, line.FinalServings)).ToList());

    private (string OperationKey, long ExpectedVersion) RequiredProtection() =>
        (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } key, long version) => (key, version),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành.")
        };

    private static string NormalizeSourceLabel(string? value) => string.IsNullOrWhiteSpace(value) ? "Nguồn số suất chuẩn" : value.Trim();
    private static bool IsDuplicate(DbUpdateException error) => error.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry }
        || error.InnerException?.Message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase) == true;

    private sealed record PreviewTicket(byte[] MenuVersionId, string Fingerprint, DateTimeOffset ExpiresAt);
    private sealed record CanonicalSnapshot(byte[] MenuVersionId, IReadOnlyList<CanonicalPlan> Plans);
    private sealed record CanonicalPlan(MealQuantityPlan Entity, IReadOnlyList<MealQuantityPlanLine> Lines);
}
