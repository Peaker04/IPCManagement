using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationWarehouseDailyQuery
{
    internal static async Task<IReadOnlyDictionary<string, ReconciliationWarehouseDailyDto>> GetManyAsync(
        IpcManagementContext context,
        IReadOnlyCollection<string> ids,
        IReadOnlyList<ReconciliationBatch>? preloadedBatches,
        IReadOnlyList<ReconciliationBatchLine>? preloadedWeeklyLines,
        IReadOnlyDictionary<string, DateOnly>? preloadedWeekByVersionId,
        List<ReconciliationDailyDisposition>? dailyDispositionsSink,
        CancellationToken token = default,
        bool includeMetadata = true)
    {
        var result = new Dictionary<string, ReconciliationWarehouseDailyDto>(StringComparer.Ordinal);
        if (ids.Count == 0) return result;
        var batchIds = ids.Select(ReconciliationBatchService.RequiredId).DistinctBy(Convert.ToHexString).ToList();
        var batchHexes = batchIds.Select(Convert.ToHexString).ToHashSet(StringComparer.Ordinal);
        var inMemory = string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
        var batches = preloadedBatches
            ?? (inMemory
                ? (await context.Reconciliationbatches.AsNoTracking().ToListAsync(token)).Where(item => batchHexes.Contains(Convert.ToHexString(item.BatchId))).ToList()
                : await context.Reconciliationbatches.AsNoTracking().Where(item => batchIds.Contains(item.BatchId)).ToListAsync(token));
        if (batches.Count == 0) return result;
        if (context.Model.FindEntityType(typeof(ReconciliationBatchDailyLine)) is null)
            return batches.ToDictionary(batch => GuidHelper.ToGuidString(batch.BatchId), batch => new ReconciliationWarehouseDailyDto(
                GuidHelper.ToGuidString(batch.BatchId), batch.Status, batch.Version, "LEGACY_INCOMPATIBLE",
                new ReconciliationDailyCompatibilityDto(true, false, "LEGACY_DAILY_LINEAGE_MISSING"), []), StringComparer.Ordinal);

        var allDailyLines = inMemory
            ? (await context.Reconciliationbatchdailylines.AsNoTracking().ToListAsync(token))
                .Where(line => batchHexes.Contains(Convert.ToHexString(line.BatchId)) && line.RequiredQuantity > 0).ToList()
            : await context.Reconciliationbatchdailylines.AsNoTracking()
                .Where(line => batchIds.Contains(line.BatchId) && line.RequiredQuantity > 0).ToListAsync(token);
        var weeklyLines = preloadedWeeklyLines
            ?? (inMemory
                ? await context.Reconciliationbatchlines.AsNoTracking().ToListAsync(token)
                : includeMetadata
                    ? await context.Reconciliationbatchlines.AsNoTracking()
                        .Include(line => line.Ingredient).Include(line => line.CanonicalUnit)
                        .Where(line => batchIds.Contains(line.BatchId)).ToListAsync(token)
                    : await context.Reconciliationbatchlines.AsNoTracking()
                        .Where(line => batchIds.Contains(line.BatchId)).ToListAsync(token));
        var weeklyById = weeklyLines.ToDictionary(line => Convert.ToHexString(line.BatchLineId), StringComparer.Ordinal);
        var dailyLineIds = allDailyLines.Select(line => line.DailyLineId).ToList();
        var ledgerByDailyLine = await new ReconciliationNetIssueProjection(context).LoadByDailyLineIdsAsync(dailyLineIds, token);
        var dailyDispositions = inMemory
            ? (await context.Reconciliationdailydispositions.AsNoTracking().ToListAsync(token)).Where(item => item.InvalidatedAt == null
                && dailyLineIds.Any(idValue => idValue.SequenceEqual(item.DailyLineId))).ToList()
            : await context.Reconciliationdailydispositions.AsNoTracking().Where(item => item.InvalidatedAt == null && dailyLineIds.Contains(item.DailyLineId)).ToListAsync(token);
        dailyDispositionsSink?.AddRange(dailyDispositions);
        var disposedDailyIds = dailyDispositions.Where(item => !string.IsNullOrWhiteSpace(item.Reason)
                && (!ledgerByDailyLine.TryGetValue(Convert.ToHexString(item.DailyLineId), out var fact) || fact.LatestReturnReceivedAt is not { } returnedAt || returnedAt < item.DisposedAt))
            .Select(item => Convert.ToHexString(item.DailyLineId)).ToHashSet(StringComparer.Ordinal);
        IReadOnlyDictionary<string, DateOnly> weekByVersionId;
        if (preloadedWeekByVersionId is not null)
        {
            weekByVersionId = preloadedWeekByVersionId;
        }
        else
        {
            var versionIds = batches.Select(batch => batch.MenuVersionId).ToList();
            var versions = inMemory
                ? (await context.Menuversions.AsNoTracking().ToListAsync(token)).Where(version => versionIds.Any(id => id.SequenceEqual(version.MenuVersionId))).ToList()
                : await context.Menuversions.AsNoTracking().Where(version => versionIds.Contains(version.MenuVersionId)).ToListAsync(token);
            weekByVersionId = versions.ToDictionary(version => Convert.ToHexString(version.MenuVersionId), version => version.WeekStartDate, StringComparer.Ordinal);
        }
        var revisionsByBatch = includeMetadata
            ? await new ReconciliationWarehouseRevisionQuery(context).GetLatestByBatchAsync(batchIds, token)
            : new Dictionary<string, IReadOnlyDictionary<DateOnly, ReconciliationWarehouseRevisionStamp>>();
        var dailyByBatch = allDailyLines.ToLookup(line => Convert.ToHexString(line.BatchId), StringComparer.Ordinal);
        foreach (var batch in batches)
        {
            token.ThrowIfCancellationRequested();
            var batchKey = Convert.ToHexString(batch.BatchId);
            var storedDailyLines = dailyByBatch[batchKey].ToList();
            var dailyLines = storedDailyLines.Select(daily => (Daily: daily, Weekly: weeklyById[Convert.ToHexString(daily.BatchLineId)])).ToList();
            var compatibility = ReconciliationDailyIssuePolicy.ResolveCompatibility(dailyLines.Count > 0, batch.Status);
            DateOnly? weekStart = weekByVersionId.TryGetValue(Convert.ToHexString(batch.MenuVersionId), out var week) ? week : null;
            weekStart ??= dailyLines.Count == 0 ? null : StartOfWeek(dailyLines.Min(item => item.Daily.ServiceDate));
            var latestRevisionByDate = revisionsByBatch.GetValueOrDefault(batchKey);

            var dates = new List<ReconciliationWarehouseDayDto>();
            if (weekStart is { } start)
            {
                // Historical Sunday facts remain readable and keep their original totals; no synthetic Sunday for new weeks.
                var days = storedDailyLines.Any(line => !ServiceCalendar.IsServiceDay(line.ServiceDate)) ? 7 : ServiceCalendar.ServiceDaysPerWeek;
                for (var offset = 0; offset < days; offset++)
                {
                    var serviceDate = start.AddDays(offset);
                    var sources = dailyLines.Where(item => item.Daily.ServiceDate == serviceDate).ToList();
                    var lineDtos = sources.Select(item =>
                    {
                        var key = Convert.ToHexString(item.Daily.DailyLineId);
                        var hasLedger = ledgerByDailyLine.TryGetValue(key, out var ledger);
                        var issued = hasLedger ? ledger!.NetIssuedQuantity : (decimal?)null;
                        var returned = hasLedger ? ledger!.ReceivedReturnQuantity : 0m;
                        var hasDisposition = disposedDailyIds.Contains(key);
                        var status = ReconciliationDailyIssuePolicy.ResolveLineStatus(item.Daily.RequiredQuantity, issued, hasDisposition);
                        return new ReconciliationWarehouseDailyLineDto(
                            GuidHelper.ToGuidString(item.Daily.DailyLineId), GuidHelper.ToGuidString(item.Weekly.BatchLineId),
                            GuidHelper.ToGuidString(item.Weekly.IngredientId), item.Weekly.Ingredient?.IngredientCode, item.Weekly.Ingredient?.IngredientName,
                            GuidHelper.ToGuidString(item.Weekly.CanonicalUnitId), item.Weekly.CanonicalUnit?.UnitName,
                            item.Daily.RequiredQuantity, issued, returned,
                            DecimalPolicy.RoundQuantity(item.Daily.RequiredQuantity - (issued ?? 0m)), status.QuantityStatus, status.HasValidDisposition);
                    }).OrderBy(line => line.IngredientName).ThenBy(line => line.DailyLineId, StringComparer.Ordinal).ToList();
                    var lineStatuses = lineDtos.Select(line => new ReconciliationDailyLineStatus(line.QuantityStatus, line.HasValidDisposition)).ToList();
                    var dayStatus = ReconciliationDailyIssuePolicy.ResolveDailyStatus(lineStatuses);
                    var latestRevision = latestRevisionByDate?.GetValueOrDefault(serviceDate);
                    dates.Add(new ReconciliationWarehouseDayDto(
                        serviceDate, dayStatus, lineDtos.Count > 0,
                        lineDtos.Sum(line => line.RequiredQuantity), lineDtos.Sum(line => line.IssuedQuantity ?? 0m),
                        lineDtos.Sum(line => line.ReturnedQuantity), lineDtos.Sum(line => line.RemainingQuantity), lineDtos)
                    {
                        LastRevisionAt = latestRevision?.AppliedAt,
                        LastRevisionByName = latestRevision?.AppliedByName,
                        LastRevisionByRole = latestRevision?.AppliedByRole
                    });
                }
            }
            var weeklyStatus = compatibility.CanIssueByDate
                ? ReconciliationDailyIssuePolicy.ResolveWeeklyStatus(dates.Select(date => new ReconciliationDailySummary(date.Status, date.IsApplicable)).ToList())
                : compatibility.ReasonCode == "BATCH_READ_ONLY"
                    ? ReconciliationDailyIssuePolicy.ResolveWeeklyStatus(dates.Select(date => new ReconciliationDailySummary(date.Status, date.IsApplicable)).ToList())
                    : "LEGACY_INCOMPATIBLE";
            var batchId = GuidHelper.ToGuidString(batch.BatchId);
            result.Add(batchId, new ReconciliationWarehouseDailyDto(
                batchId, batch.Status, batch.Version, weeklyStatus,
                new ReconciliationDailyCompatibilityDto(compatibility.CanRead, compatibility.CanIssueByDate, compatibility.ReasonCode), dates));
        }
        return result;
    }

    private static DateOnly StartOfWeek(DateOnly date)
    {
        var offset = ((int)date.DayOfWeek + 6) % 7;
        return date.AddDays(-offset);
    }

}
