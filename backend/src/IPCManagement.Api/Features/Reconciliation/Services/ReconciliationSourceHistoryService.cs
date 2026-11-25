using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

/// <summary>MRX source history: one request or standalone revision per list item.</summary>
public sealed class ReconciliationSourceHistoryService(IpcManagementContext context)
{
    public async Task<PagedResponseDto<ReconciliationSourceHistoryEventDto>> GetPageAsync(
        ReconciliationSourceHistoryPageQuery request, CancellationToken token = default)
    {
        var batches = from batch in context.Reconciliationbatches.AsNoTracking()
            join version in context.Menuversions.AsNoTracking() on batch.MenuVersionId equals version.MenuVersionId
            select new { batch.BatchId, version.CustomerId, version.WeekStartDate };
        if (!string.IsNullOrWhiteSpace(request.BatchId))
        {
            var batchId = GuidHelper.ParseGuidString(request.BatchId.Trim());
            batches = batches.Where(item => item.BatchId == batchId);
        }
        var scopes = batches.Select(item => new { item.CustomerId, item.WeekStartDate });
        var amendments = context.Menuamendments.AsNoTracking()
            .Where(item => item.BaseMenuVersionId != null &&
                scopes.Any(scope => scope.CustomerId == item.CustomerId && scope.WeekStartDate == item.WeekStartDate) &&
                (context.Reconciliationsourcerevisions.Any(revision => revision.MenuAmendmentId == item.MenuAmendmentId) ||
                 item.ImpactSnapshotJson.Contains("\"MaterialImpact\":[{")));
        var standalone = from revision in context.Reconciliationsourcerevisions.AsNoTracking()
            join batch in batches on revision.BatchId equals batch.BatchId
            where revision.MenuAmendmentId == null
            select new { Revision = revision, batch.CustomerId, batch.WeekStartDate };
        if (!string.IsNullOrWhiteSpace(request.CustomerCode))
        {
            var code = request.CustomerCode.Trim();
            var customers = context.Customers.AsNoTracking().Where(item => item.CustomerCode == code).Select(item => item.CustomerId);
            amendments = amendments.Where(item => customers.Contains(item.CustomerId));
            standalone = standalone.Where(item => customers.Contains(item.CustomerId));
        }
        if (request.ServiceDate is { } date)
        {
            var dateText = date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);
            amendments = amendments.Where(item => item.Lines.Any(line => line.ServiceDate == date) ||
                item.ImpactSnapshotJson.Contains(dateText) ||
                context.Reconciliationsourcerevisions.Any(revision => revision.MenuAmendmentId == item.MenuAmendmentId &&
                    context.Reconciliationsourcedeltas.Any(delta => delta.SourceRevisionId == revision.SourceRevisionId && delta.ServiceDate == date)));
            standalone = standalone.Where(item => context.Reconciliationsourcedeltas.Any(delta =>
                delta.SourceRevisionId == item.Revision.SourceRevisionId && delta.ServiceDate == date));
        }

        var total = await amendments.CountAsync(token) + await standalone.CountAsync(token);
        var offset = PageOffset(total, request.PageNumber, request.PageSize);
        if (offset == total)
            return PagedResponseDto<ReconciliationSourceHistoryEventDto>.Create([], total, request.PageNumber, request.PageSize);
        var limit = (int)Math.Min(total, (long)request.PageNumber * request.PageSize);
        var amendmentRows = await amendments.Include(item => item.Customer).Include(item => item.CreatedByNavigation)
            .Include(item => item.ReviewedByNavigation).Include(item => item.ExecutedByNavigation)
            .Include(item => item.Lines)
            .OrderByDescending(item => item.ExecutedAt ?? item.ReviewedAt ?? item.CreatedAt)
            .ThenBy(item => item.MenuAmendmentId).Take(limit).ToListAsync(token);
        var revisionRows = await standalone.OrderByDescending(item => item.Revision.AppliedAt)
            .ThenBy(item => item.Revision.SourceRevisionId).Take(limit).ToListAsync(token);
        var amendmentIds = amendmentRows.Select(item => item.MenuAmendmentId).ToList();
        var sourceRevisions = await context.Reconciliationsourcerevisions.AsNoTracking()
            .Where(item => item.MenuAmendmentId != null && amendmentIds.Contains(item.MenuAmendmentId))
            .Select(item => new { item.MenuAmendmentId, item.SourceRevisionId, item.ApplyMode }).ToListAsync(token);
        var selectedRevisionIds = sourceRevisions.Select(item => item.SourceRevisionId)
            .Concat(revisionRows.Select(item => item.Revision.SourceRevisionId)).ToList();
        var deltaCounts = await context.Reconciliationsourcedeltas.AsNoTracking()
            .Where(item => selectedRevisionIds.Contains(item.SourceRevisionId))
            .Select(item => item.SourceRevisionId).ToListAsync(token);
        var deltaCountMap = deltaCounts.GroupBy(Convert.ToHexString).ToDictionary(group => group.Key, group => group.Count());
        var counts = sourceRevisions.Select(item => new { item.MenuAmendmentId,
            Count = deltaCountMap.GetValueOrDefault(Convert.ToHexString(item.SourceRevisionId)) }).ToList();
        var countMap = counts.GroupBy(item => Convert.ToHexString(item.MenuAmendmentId!))
            .ToDictionary(group => group.Key, group => group.Sum(item => item.Count));
        var modeMap = sourceRevisions.GroupBy(item => Convert.ToHexString(item.MenuAmendmentId!))
            .ToDictionary(group => group.Key, group => group.Select(item => item.ApplyMode).FirstOrDefault(mode => mode != null));
        var customerIds = revisionRows.Select(item => item.CustomerId).ToList();
        var customersById = await context.Customers.AsNoTracking().Where(item => customerIds.Contains(item.CustomerId))
            .ToDictionaryAsync(item => Convert.ToHexString(item.CustomerId), token);
        var actorIds = revisionRows.Select(item => item.Revision.AppliedBy).ToList();
        var actors = await context.Users.AsNoTracking().Where(item => actorIds.Contains(item.UserId))
            .ToDictionaryAsync(item => Convert.ToHexString(item.UserId), item => item.FullName, token);
        var revisionAmendmentIds = sourceRevisions.Select(item => Convert.ToHexString(item.MenuAmendmentId!)).ToHashSet();
        var events = amendmentRows.Select(item => ToEvent(item, countMap.GetValueOrDefault(Convert.ToHexString(item.MenuAmendmentId)),
                modeMap.GetValueOrDefault(Convert.ToHexString(item.MenuAmendmentId)),
                revisionAmendmentIds.Contains(Convert.ToHexString(item.MenuAmendmentId))))
            .Concat(revisionRows.Select(item => new ReconciliationSourceHistoryEventDto(
                $"revision:{GuidHelper.ToGuidString(item.Revision.SourceRevisionId)}",
                customersById.GetValueOrDefault(Convert.ToHexString(item.CustomerId))?.CustomerCode ?? string.Empty,
                customersById.GetValueOrDefault(Convert.ToHexString(item.CustomerId))?.CustomerName ?? string.Empty,
                item.WeekStartDate, item.Revision.AppliedAt,
                actors.GetValueOrDefault(Convert.ToHexString(item.Revision.AppliedBy)) ?? GuidHelper.ToGuidString(item.Revision.AppliedBy),
                item.Revision.Status, "NOT_REQUIRED", item.Revision.ApplyMode ?? "REIMPORT", item.Revision.Reason,
                deltaCountMap.GetValueOrDefault(Convert.ToHexString(item.Revision.SourceRevisionId)))))
            .OrderByDescending(item => item.OccurredAt).ThenBy(item => item.EventId, StringComparer.Ordinal)
            .Skip(offset).Take(request.PageSize).ToList();
        return PagedResponseDto<ReconciliationSourceHistoryEventDto>.Create(events, total, request.PageNumber, request.PageSize);
    }

    public async Task<ReconciliationSourceHistoryDetailDto?> GetDetailAsync(string eventId, int pageNumber = 1, int pageSize = 25, CancellationToken token = default)
    {
        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, 100);
        if (eventId.StartsWith("amendment:", StringComparison.Ordinal))
        {
            var id = GuidHelper.ParseGuidString(eventId[10..]);
            if (id == null) return null;
            var amendment = await context.Menuamendments.AsNoTracking().Include(item => item.Customer)
                .Include(item => item.CreatedByNavigation).Include(item => item.ReviewedByNavigation)
                .Include(item => item.ExecutedByNavigation).FirstOrDefaultAsync(item => item.MenuAmendmentId == id, token);
            if (amendment == null || amendment.BaseMenuVersionId == null) return null;
            var mrxScope = await (from scopedBatch in context.Reconciliationbatches.AsNoTracking()
                join version in context.Menuversions.AsNoTracking() on scopedBatch.MenuVersionId equals version.MenuVersionId
                where version.CustomerId == amendment.CustomerId && version.WeekStartDate == amendment.WeekStartDate
                select scopedBatch.BatchId).AnyAsync(token);
            if (!mrxScope) return null;
            var revisions = await context.Reconciliationsourcerevisions.AsNoTracking()
                .Where(item => item.MenuAmendmentId == id).OrderBy(item => item.AppliedAt).ToListAsync(token);
            if (revisions.Count == 0 && !amendment.ImpactSnapshotJson.Contains("\"MaterialImpact\":[{", StringComparison.Ordinal)) return null;
            var amendmentMaterials = revisions.Count == 0
                ? Page(ParseProposed(amendment.ImpactSnapshotJson), pageNumber, pageSize)
                : await AppliedMaterialsPageAsync(revisions.Select(item => item.SourceRevisionId).ToList(), pageNumber, pageSize, token);
            var revisionDtos = revisions.Select(item => new ReconciliationSourceHistoryRevisionDto(
                GuidHelper.ToGuidString(item.SourceRevisionId), GuidHelper.ToGuidString(item.BatchId), item.RevisionNumber, item.AppliedAt)).ToList();
            return new ReconciliationSourceHistoryDetailDto(ToEvent(amendment, amendmentMaterials.TotalCount,
                    revisions.FirstOrDefault()?.ApplyMode, revisions.Count > 0),
                amendment.CreatedByNavigation.FullName, amendment.CreatedAt,
                amendment.ReviewedByNavigation?.FullName, amendment.ReviewedAt,
                amendment.ExecutedByNavigation?.FullName, amendment.ExecutedAt,
                revisionDtos, amendmentMaterials);
        }
        if (!eventId.StartsWith("revision:", StringComparison.Ordinal)) return null;
        var revisionId = GuidHelper.ParseGuidString(eventId[9..]);
        if (revisionId == null) return null;
        var revision = await context.Reconciliationsourcerevisions.AsNoTracking()
            .FirstOrDefaultAsync(item => item.SourceRevisionId == revisionId && item.MenuAmendmentId == null, token);
        if (revision == null) return null;
        var batch = await (from item in context.Reconciliationbatches.AsNoTracking()
            join version in context.Menuversions.AsNoTracking() on item.MenuVersionId equals version.MenuVersionId
            join customer in context.Customers.AsNoTracking() on version.CustomerId equals customer.CustomerId
            where item.BatchId == revision.BatchId
            select new { customer.CustomerCode, customer.CustomerName, version.WeekStartDate }).FirstOrDefaultAsync(token);
        if (batch == null) return null;
        var actor = await context.Users.AsNoTracking().Where(item => item.UserId == revision.AppliedBy)
            .Select(item => item.FullName).FirstOrDefaultAsync(token) ?? GuidHelper.ToGuidString(revision.AppliedBy);
        var materials = await AppliedMaterialsPageAsync([revisionId], pageNumber, pageSize, token);
        var evt = new ReconciliationSourceHistoryEventDto(eventId, batch.CustomerCode, batch.CustomerName,
            batch.WeekStartDate, revision.AppliedAt, actor, revision.Status, "NOT_REQUIRED",
            revision.ApplyMode ?? "REIMPORT", revision.Reason, materials.TotalCount);
        return new ReconciliationSourceHistoryDetailDto(evt, null, null, null, null, actor, revision.AppliedAt,
            [new ReconciliationSourceHistoryRevisionDto(GuidHelper.ToGuidString(revisionId), GuidHelper.ToGuidString(revision.BatchId), revision.RevisionNumber, revision.AppliedAt)],
            materials);
    }

    private async Task<PagedResponseDto<ReconciliationSourceHistoryMaterialDto>> AppliedMaterialsPageAsync(
        List<byte[]> revisionIds, int pageNumber, int pageSize, CancellationToken token)
    {
        var scoped = context.Reconciliationsourcedeltas.AsNoTracking()
            .Where(item => revisionIds.Contains(item.SourceRevisionId));
        var total = await scoped.CountAsync(token);
        var offset = PageOffset(total, pageNumber, pageSize);
        if (offset == total)
            return PagedResponseDto<ReconciliationSourceHistoryMaterialDto>.Create([], total, pageNumber, pageSize);
        var rows = await (from delta in scoped
            join ingredient in context.Ingredients.AsNoTracking() on delta.IngredientId equals ingredient.IngredientId
            join unit in context.Units.AsNoTracking() on delta.CanonicalUnitId equals unit.UnitId
            orderby delta.ServiceDate, ingredient.IngredientName, delta.SourceDeltaId
            select new ReconciliationSourceHistoryMaterialDto(delta.ServiceDate, ingredient.IngredientCode,
                ingredient.IngredientName, unit.UnitName, delta.PreviousRequiredQuantity,
                delta.NewRequiredQuantity, delta.DeltaQuantity, true))
            .Skip(offset).Take(pageSize).ToListAsync(token);
        return PagedResponseDto<ReconciliationSourceHistoryMaterialDto>.Create(rows, total, pageNumber, pageSize);
    }

    private static List<ReconciliationSourceHistoryMaterialDto> ParseProposed(string json)
    {
        try
        {
            var preview = JsonSerializer.Deserialize<MenuAmendmentResultDto>(json);
            return preview?.MaterialImpact?.Select(item => new ReconciliationSourceHistoryMaterialDto(item.ServiceDate,
                item.IngredientCode, item.IngredientName, item.UnitName, item.PreviousQuantity,
                item.NewQuantity, item.NewQuantity - item.PreviousQuantity, false)).ToList() ?? [];
        }
        catch (JsonException) { return []; }
    }

    private static ReconciliationSourceHistoryEventDto ToEvent(MenuAmendment item, int affectedCount, string? revisionMode = null, bool hasSourceRevision = false)
    {
        string? mode = null;
        try { mode = JsonSerializer.Deserialize<MenuAmendmentResultDto>(item.ImpactSnapshotJson)?.SourceChangeMode; }
        catch (JsonException) { /* Old snapshots may use another shape. */ }
        var approval = item.Status switch
        {
            "PENDING_REVIEW" => "PENDING",
            "REJECTED" => "REJECTED",
            _ when item.ReviewedAt != null => "APPROVED",
            _ => "NOT_REQUIRED"
        };
        return new ReconciliationSourceHistoryEventDto($"amendment:{GuidHelper.ToGuidString(item.MenuAmendmentId)}",
            item.Customer.CustomerCode, item.Customer.CustomerName, item.WeekStartDate,
            item.ExecutedAt ?? item.ReviewedAt ?? item.CreatedAt,
            (item.ExecutedByNavigation ?? item.ReviewedByNavigation ?? item.CreatedByNavigation)?.FullName ?? GuidHelper.ToGuidString(item.CreatedBy),
            item.Status == "EXECUTED" && hasSourceRevision ? "APPLIED" : item.Status,
            approval, mode ?? revisionMode ?? (item.Status is "PENDING_REVIEW" or "REJECTED" ? "REQUEST" : item.ReviewedAt == null ? "DIRECT" : "APPROVED"), item.Reason,
            affectedCount == 0 ? Math.Max(item.Lines.Count, ParseProposed(item.ImpactSnapshotJson).Count) : affectedCount);
    }

    private static PagedResponseDto<ReconciliationSourceHistoryMaterialDto> Page(List<ReconciliationSourceHistoryMaterialDto> rows, int page, int size)
        => PagedResponseDto<ReconciliationSourceHistoryMaterialDto>.Create(rows.Skip(PageOffset(rows.Count, page, size)).Take(size), rows.Count, page, size);

    private static int PageOffset(int count, int page, int size) => (int)Math.Min(count, ((long)page - 1) * size);
}
