using System.Globalization;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static partial class ReconciliationSourceChangeQuery
{
    // Two bounded merge cursors retain at most 100 records per source. Counting scans
    // the filtered history so legacy audit/BOM duplicates never inflate page totals.
    internal static async Task<PagedResponseDto<ReconciliationSourceChangeDto>> PageAsync(
        IpcManagementContext context, string id, PagedRequestDto page, CancellationToken token)
    {
        var sources = await BuildSourcesAsync(context, id, token);
        var auditQuery = await MrxAuditSearch.ApplyAsync(context, sources.Audits, page.SearchKeyword, token);
        var adjustmentQuery = FilterAdjustments(context, sources.Adjustments, page.SearchKeyword);
        var auditCursor = new HistoryCursor<AuditLog>(auditQuery.OrderByDescending(log => log.ChangedAt).ThenByDescending(log => log.AuditId));
        var adjustmentCursor = new HistoryCursor<BomAdjustment>(adjustmentQuery.OrderByDescending(row => row.AdjustedAt).ThenByDescending(row => row.BomAdjustmentId));
        var selectedAudits = new List<AuditLog>();
        var selectedAdjustments = new List<BomAdjustment>();
        var skip = (long)(page.PageNumber - 1) * page.PageSize;
        var total = 0;
        while (true)
        {
            token.ThrowIfCancellationRequested();
            var audit = await auditCursor.PeekAsync(token);
            var adjustment = await adjustmentCursor.PeekAsync(token);
            if (audit is null && adjustment is null) break;
            var takeAudit = audit is not null && (adjustment is null || audit.ChangedAt > adjustment.AdjustedAt
                || (audit.ChangedAt == adjustment.AdjustedAt && string.CompareOrdinal(Convert.ToHexString(audit.AuditId), Convert.ToHexString(adjustment.BomAdjustmentId)) >= 0));
            if (takeAudit)
            {
                auditCursor.Advance();
                if (sources.InMemoryPredicate is not null && !sources.InMemoryPredicate(audit!)) continue;
                if (await HasCanonicalAdjustmentAsync(sources.Adjustments, audit!, token)) continue;
                if (total >= skip && selectedAudits.Count + selectedAdjustments.Count < page.PageSize) selectedAudits.Add(audit!);
            }
            else
            {
                adjustmentCursor.Advance();
                if (total >= skip && selectedAudits.Count + selectedAdjustments.Count < page.PageSize) selectedAdjustments.Add(adjustment!);
            }
            total += 1;
        }
        var rows = (await MapAsync(context, selectedAudits, selectedAdjustments, token))
            .OrderByDescending(row => row.ChangedAt)
            .ThenByDescending(row => Convert.ToHexString(GuidHelper.ParseGuidString(row.ChangeId)!), StringComparer.Ordinal).ToList();
        return PagedResponseDto<ReconciliationSourceChangeDto>.Create(rows, total, page.PageNumber, page.PageSize);
    }

    private static IQueryable<BomAdjustment> FilterAdjustments(IpcManagementContext context, IQueryable<BomAdjustment> query, string? search)
    {
        foreach (var word in (search ?? "").Trim().ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (MrxAuditSearch.LabelMatches(nameof(BomAdjustment), word) || MrxAuditSearch.LabelMatches("QuantityAndWaste", word)) continue;
            var actors = context.Model.FindEntityType(typeof(User)) is null
                ? context.Auditlogs.Where(log => false).Select(log => log.ChangedBy)
                : context.Users.Where(user => (user.FullName ?? user.Username).ToLower().Contains(word)).Select(user => user.UserId);
            query = query.Where(row => (row.Reason != null && row.Reason.ToLower().Contains(word))
                || row.OldGrossQtyPerServing.ToString().Contains(word) || row.NewGrossQtyPerServing.ToString().Contains(word)
                || row.OldWasteRatePercent.ToString().Contains(word) || row.NewWasteRatePercent.ToString().Contains(word)
                || actors.Contains(row.AdjustedBy));
        }
        return query;
    }

    private static async Task<bool> HasCanonicalAdjustmentAsync(IQueryable<BomAdjustment> adjustments, AuditLog audit, CancellationToken token)
    {
        if (audit.BusinessArea != "BOM" || audit.EntityName is not (nameof(DishBom) or nameof(BomAdjustment)) || audit.FieldName != "QuantityAndWaste"
            || !TryParseBomValue(audit.OldValue, out var oldQty, out var oldWaste)
            || !TryParseBomValue(audit.NewValue, out var newQty, out var newWaste)) return false;
        return await adjustments.AnyAsync(row => row.BomId == audit.EntityId && row.AdjustedBy == audit.ChangedBy
            && row.OldGrossQtyPerServing == oldQty && row.NewGrossQtyPerServing == newQty
            && row.OldWasteRatePercent == oldWaste && row.NewWasteRatePercent == newWaste && row.Reason == audit.Reason, token);
    }

    private static bool TryParseBomValue(string? value, out decimal quantity, out decimal waste)
    {
        quantity = 0; waste = 0;
        var parts = (value ?? "").Split(" / hao hụt ", StringSplitOptions.None);
        return parts.Length == 2 && decimal.TryParse(parts[0], NumberStyles.Number, CultureInfo.InvariantCulture, out quantity)
            && decimal.TryParse(parts[1].TrimEnd('%'), NumberStyles.Number, CultureInfo.InvariantCulture, out waste);
    }

    private sealed class HistoryCursor<T>(IQueryable<T> query) where T : class
    {
        private const int ChunkSize = 100;
        private List<T> buffer = [];
        private int index;
        private int offset;
        private bool exhausted;

        internal async Task<T?> PeekAsync(CancellationToken token)
        {
            if (index < buffer.Count) return buffer[index];
            if (exhausted) return null;
            buffer = await query.Skip(offset).Take(ChunkSize).ToListAsync(token);
            offset += buffer.Count;
            index = 0;
            exhausted = buffer.Count < ChunkSize;
            return buffer.Count == 0 ? null : buffer[0];
        }
        internal void Advance() => index += 1;
    }
}
