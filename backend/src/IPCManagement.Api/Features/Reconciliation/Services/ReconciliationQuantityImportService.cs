using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using IPCManagement.Api.Data;
using IPCManagement.Api.Data.Transactions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Exceptions;
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
    IMemoryCache cache,
    ReconciliationBatchService batchService)
{
    internal const int CurrentFingerprintFormatVersion = 2;
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
        return new(previewToken, expiresAt, fingerprint, CurrentFingerprintFormatVersion, snapshot.Plans.Select(Map).ToList(), []);
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
                        FingerprintFormatVersion = CurrentFingerprintFormatVersion,
                        ImportedBy = actor,
                        ImportedAt = now,
                        Status = "CONFIRMED"
                    };
                    context.Quantityimportbatches.Add(import);
                    foreach (var plan in snapshot.Plans) plan.Entity.ImportBatchId = importId;
                    context.Auditlogs.Add(new AuditLog
                    {
                        AuditId = GuidHelper.NewId(), ChangedAt = now, ChangedBy = actor, BusinessArea = "Reconciliation",
                        EntityName = nameof(QuantityImportBatch), EntityId = importId, FieldName = "Commit",
                        NewValue = currentFingerprint, Reason = "Cam kết nguồn số suất đối chiếu"
                    });
                    await context.SaveChangesAsync(operationToken);
                    await batchService.MaterializeDraftAsync(reconciliationId, ticket.MenuVersionId, importId, actor, operationToken);
                    await context.SaveChangesAsync(operationToken);
                    return new(GuidHelper.ToGuidString(importId), GuidHelper.ToGuidString(reconciliationId), currentFingerprint, false);
                },
                verifySucceeded: verifyToken => context.Quantityimportbatches.AsNoTracking().AnyAsync(x => x.ContentFingerprint == ticket.Fingerprint, verifyToken),
                isolationLevel: IsolationLevel.Serializable,
                cancellationToken: token);
        }
        catch (DbUpdateException error) when (IsContentFingerprintDuplicate(error))
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
            throw new BusinessRuleException("Phiên bản thực đơn chưa được phát hành.");

        var plans = await context.Mealquantityplans
            .Where(plan => plan.Mealquantityplanlines.Any(line => line.MenuSchedule.MenuVersionId == menuVersionId))
            .OrderBy(plan => plan.ServiceDate)
            .ThenBy(plan => plan.PlanCode)
            .ToListAsync(token);
        if (plans.Count == 0) throw new BusinessRuleException("Phiên bản thực đơn chưa có nguồn số suất.");
        if (plans.Any(plan => !string.Equals(plan.Status, "COMPLETED", StringComparison.OrdinalIgnoreCase)))
            throw new BusinessRuleException("Mọi kế hoạch số suất phải hoàn tất trước khi cam kết.");
        var planIds = plans.Select(plan => plan.QuantityPlanId).ToList();
        var sourceLines = await context.Mealquantityplanlines
            .Where(line => planIds.Contains(line.QuantityPlanId))
            .Include(line => line.QuantityPlan)
            .Include(line => line.MenuSchedule)
            .Include(line => line.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Unit)
            .Include(line => line.Menu).ThenInclude(menu => menu.Menuitems).ThenInclude(item => item.Dish).ThenInclude(dish => dish.Dishboms).ThenInclude(bom => bom.Ingredient).ThenInclude(ingredient => ingredient.Unit)
            .AsSplitQuery()
            .ToListAsync(token);
        if (sourceLines.Count == 0 || sourceLines.Any(line => line.MenuSchedule.MenuVersionId is null || !line.MenuSchedule.MenuVersionId.AsSpan().SequenceEqual(menuVersionId)))
            throw new BusinessRuleException("Nguồn số suất chứa nhiều phiên bản thực đơn hoặc dòng không hợp lệ.");
        var projected = ReconciliationMaterialProjection.Project(sourceLines);
        return new(menuVersionId, plans.Select(plan => new CanonicalPlan(
            plan,
            projected.Where(line => line.Source.QuantityPlanId.AsSpan().SequenceEqual(plan.QuantityPlanId)).ToList())).ToList());
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
        var builder = new StringBuilder().Append("v2|").Append(GuidHelper.ToGuidString(snapshot.MenuVersionId));
        foreach (var plan in snapshot.Plans)
        {
            builder.Append("|p:").Append(GuidHelper.ToGuidString(plan.Entity.QuantityPlanId)).Append(':')
                .Append(plan.Entity.PlanCode).Append(':')
                .Append(plan.Entity.RowVersion.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture)).Append(':')
                .Append(plan.Entity.Status).Append(':').Append(plan.Entity.ServiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            foreach (var projectedLine in plan.Lines)
            {
                var line = projectedLine.Source;
                builder.Append("|l:").Append(GuidHelper.ToGuidString(line.QuantityPlanLineId)).Append(':')
                    .Append(GuidHelper.ToGuidString(line.MenuScheduleId)).Append(':').Append(GuidHelper.ToGuidString(line.CustomerId)).Append(':')
                    .Append(GuidHelper.ToGuidString(line.MenuId)).Append(':').Append(line.ShiftName).Append(':')
                    .Append(line.FinalServings.ToString(CultureInfo.InvariantCulture)).Append(':')
                    .Append(line.MenuSchedule.MenuPrice.ToString(CultureInfo.InvariantCulture)).Append(':')
                    .Append(line.MenuSchedule.ServiceDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                foreach (var dish in projectedLine.Dishes)
                {
                    var item = dish.MenuItem;
                    builder.Append("|d:").Append(GuidHelper.ToGuidString(item.MenuItemId)).Append(':')
                        .Append(GuidHelper.ToGuidString(item.DishId)).Append(':').Append(item.DisplayOrder).Append(':').Append(item.DishSlot);
                    foreach (var material in dish.Materials)
                    {
                        var bom = material.Bom;
                        builder.Append("|b:").Append(GuidHelper.ToGuidString(bom.BomId)).Append(':')
                            .Append(GuidHelper.ToGuidString(bom.IngredientId)).Append(':').Append(GuidHelper.ToGuidString(bom.UnitId)).Append(':')
                            .Append(GuidHelper.ToGuidString(bom.Ingredient.UnitId)).Append(':')
                            .Append(bom.GrossQtyPerServing.ToString(CultureInfo.InvariantCulture)).Append(':')
                            .Append(bom.Unit.ConvertRateToBase.ToString(CultureInfo.InvariantCulture)).Append(':')
                            .Append(bom.Ingredient.Unit.ConvertRateToBase.ToString(CultureInfo.InvariantCulture)).Append(':')
                            .Append(bom.PriceTierAmount.ToString(CultureInfo.InvariantCulture)).Append(':')
                            .Append(bom.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append(':')
                            .Append(bom.EffectiveTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)).Append(':')
                            .Append(bom.CustomerId is null ? "GLOBAL" : GuidHelper.ToGuidString(bom.CustomerId)).Append(':')
                            .Append(material.RequiredQuantity.ToString(CultureInfo.InvariantCulture));
                    }
                }
            }
        }
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(builder.ToString())));
    }

    private static QuantityImportPlanDto Map(CanonicalPlan plan) => new(
        GuidHelper.ToGuidString(plan.Entity.QuantityPlanId), plan.Entity.PlanCode, plan.Entity.ServiceDate, plan.Entity.Status,
        plan.Entity.RowVersion, plan.Lines.Select(projectedLine => {
            var line = projectedLine.Source;
            return new QuantityImportPlanLineDto(
                GuidHelper.ToGuidString(line.QuantityPlanLineId), GuidHelper.ToGuidString(line.MenuScheduleId), GuidHelper.ToGuidString(line.CustomerId),
                GuidHelper.ToGuidString(line.MenuId), line.ShiftName, line.FinalServings, line.Menu.MenuCode, line.Menu.MenuName,
                projectedLine.Dishes.Select(dish => new QuantityImportDishDto(
                    GuidHelper.ToGuidString(dish.MenuItem.DishId), dish.MenuItem.Dish.DishCode, dish.MenuItem.Dish.DishName,
                    dish.MenuItem.DishSlot, dish.MenuItem.DisplayOrder,
                    dish.Materials.Select(material => new QuantityImportMaterialContributionDto(
                        GuidHelper.ToGuidString(material.Bom.BomId), GuidHelper.ToGuidString(material.Bom.IngredientId),
                        material.Bom.Ingredient.IngredientCode, material.Bom.Ingredient.IngredientName,
                        material.Bom.GrossQtyPerServing, GuidHelper.ToGuidString(material.Bom.UnitId), material.Bom.Unit.UnitName,
                        material.RequiredQuantity, GuidHelper.ToGuidString(material.Bom.Ingredient.UnitId), material.Bom.Ingredient.Unit.UnitName)).ToList())).ToList());
        }).ToList());

    private (string OperationKey, long ExpectedVersion) RequiredProtection() =>
        (requestContext.OperationKey, requestContext.ExpectedModeVersion) switch
        {
            ({ Length: > 0 } key, long version) => (key, version),
            _ => throw new InvalidOperationException("Thiếu ngữ cảnh bảo vệ chế độ vận hành.")
        };

    private static string NormalizeSourceLabel(string? value) => string.IsNullOrWhiteSpace(value) ? "Nguồn số suất chuẩn" : value.Trim();
    internal static bool IsContentFingerprintDuplicate(DbUpdateException error)
    {
        var message = error.InnerException?.Message ?? error.Message;
        return (error.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry }
                && message.Contains("ux_quantityimportbatches_contentFingerprint", StringComparison.OrdinalIgnoreCase))
            || message.Contains("ux_quantityimportbatches_contentFingerprint", StringComparison.OrdinalIgnoreCase)
            || message.Contains("quantityimportbatches.contentFingerprint", StringComparison.OrdinalIgnoreCase);
    }

    private sealed record PreviewTicket(byte[] MenuVersionId, string Fingerprint, DateTimeOffset ExpiresAt);
    private sealed record CanonicalSnapshot(byte[] MenuVersionId, IReadOnlyList<CanonicalPlan> Plans);
    private sealed record CanonicalPlan(MealQuantityPlan Entity, IReadOnlyList<ProjectedSourceLine> Lines);
}
