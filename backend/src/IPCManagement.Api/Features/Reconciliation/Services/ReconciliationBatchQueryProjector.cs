using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Reconciliation.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reconciliation.Services;

internal static class ReconciliationBatchQueryProjector
{
    public static async Task<PagedResponseDto<ReconciliationBatchSummaryDto>> GetPageAsync(
        IpcManagementContext context,
        ReconciliationBatchPageQuery request,
        Func<string, byte[]> requiredId,
        CancellationToken token = default)
    {
        var customerId = string.IsNullOrWhiteSpace(request.CustomerId) ? null : requiredId(request.CustomerId);
        var status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim().ToUpperInvariant();
        var query =
            from batch in context.Reconciliationbatches.AsNoTracking()
            join menuVersion in context.Menuversions.AsNoTracking()
                on batch.MenuVersionId equals menuVersion.MenuVersionId
            where customerId == null || menuVersion.CustomerId == customerId
            where request.WeekStartDate == null || menuVersion.WeekStartDate == request.WeekStartDate
            where status == null || batch.Status == status
            select new { Batch = batch, menuVersion.CustomerId, menuVersion.WeekStartDate };

        var totalCount = await query.CountAsync(token);
        var rows = await query
            .OrderByDescending(item => item.Batch.CreatedAt)
            .ThenBy(item => item.Batch.BatchId)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(token);
        var customerById = new Dictionary<string, (string CustomerCode, string CustomerName)>(StringComparer.Ordinal);
        if (context.Model.FindEntityType(typeof(Customer)) is not null)
        {
            var customerIds = rows.Select(item => item.CustomerId).Distinct().ToList();
            var customers = await context.Customers.AsNoTracking()
                .Where(item => customerIds.Contains(item.CustomerId))
                .Select(item => new { item.CustomerId, item.CustomerCode, item.CustomerName })
                .ToListAsync(token);
            customerById = customers.ToDictionary(
                item => Convert.ToHexString(item.CustomerId),
                item => (item.CustomerCode, item.CustomerName),
                StringComparer.Ordinal);
        }
        var items = rows.Select(item =>
        {
            customerById.TryGetValue(Convert.ToHexString(item.CustomerId), out var customer);
            return new ReconciliationBatchSummaryDto(
                GuidHelper.ToGuidString(item.Batch.BatchId), item.Batch.Status, item.Batch.Version,
                item.Batch.CreatedAt, item.Batch.ReadyAt, item.Batch.CompletedAt,
                GuidHelper.ToGuidString(item.CustomerId), customer.CustomerCode, customer.CustomerName,
                item.WeekStartDate, item.WeekStartDate.AddDays(6));
        }).ToList();
        return PagedResponseDto<ReconciliationBatchSummaryDto>.Create(
            items, totalCount, request.PageNumber, request.PageSize);
    }

    public static async Task<IReadOnlyList<ReconciliationBatchDishSummaryDto>> ListDishesAsync(
        IpcManagementContext context,
        string id,
        Func<string, byte[]> requiredId,
        CancellationToken token = default)
    {
        var batchId = requiredId(id);
        var linesQuery = context.Reconciliationbatchlines.AsNoTracking()
            .Include(line => line.Ingredient)
            .Include(line => line.CanonicalUnit)
            .Include(line => line.Contributors);
        var lines = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? context.ChangeTracker.Entries<ReconciliationBatchLine>().Select(entry => entry.Entity).Where(line => line.BatchId.AsSpan().SequenceEqual(batchId) && line.RequiredQuantity > 0).ToList()
            : await linesQuery.Where(line => line.BatchId == batchId && line.RequiredQuantity > 0).ToListAsync(token);
        if (lines.Count == 0) throw new KeyNotFoundException("Không tìm thấy lô đối chiếu.");

        var dailyLines = context.Database.ProviderName == "Microsoft.EntityFrameworkCore.InMemory"
            ? context.ChangeTracker.Entries<ReconciliationBatchDailyLine>().Select(entry => entry.Entity).Where(line => line.BatchId.AsSpan().SequenceEqual(batchId) && line.RequiredQuantity > 0).ToList()
            : await context.Reconciliationbatchdailylines.AsNoTracking().Where(line => line.BatchId == batchId && line.RequiredQuantity > 0).ToListAsync(token);
        var dailyLinesById = dailyLines.ToDictionary(line => Convert.ToHexString(line.DailyLineId), StringComparer.Ordinal);
        var contributors = lines.SelectMany(line => line.Contributors.Select(contributor => new { Line = line, Contributor = contributor })).ToList();
        if (contributors.Any(item => item.Contributor.DailyLineId is null || !dailyLinesById.ContainsKey(Convert.ToHexString(item.Contributor.DailyLineId)) || item.Contributor.DishId is null
            || string.IsNullOrWhiteSpace(item.Contributor.FrozenDishCode) || string.IsNullOrWhiteSpace(item.Contributor.FrozenDishName)
            || string.IsNullOrWhiteSpace(item.Contributor.FrozenShiftName) || item.Contributor.FrozenServings is null || item.Contributor.FrozenBomQuantityPerServing is null))
            throw new BusinessRuleException("KITCHEN_FROZEN_LINEAGE_MISSING");

        return contributors
            .GroupBy(item => Convert.ToHexString(item.Contributor.DishId!))
            .Select(dishGroup =>
            {
                var first = dishGroup.First().Contributor;
                var materials = dishGroup
                    .GroupBy(item => new { Daily = Convert.ToHexString(item.Contributor.DailyLineId!), Line = Convert.ToHexString(item.Line.BatchLineId) })
                    .Select(group =>
                    {
                        var facts = group.Select(item => new { item.Contributor.FrozenBomQuantityPerServing, item.Contributor.FrozenWasteRatePercent }).Distinct().ToList();
                        if (facts.Count != 1) throw new BusinessRuleException("KITCHEN_FROZEN_LINEAGE_AMBIGUOUS");
                        var item = group.First();
                        return new ReconciliationBatchDishMaterialDto(
                            GuidHelper.ToGuidString(item.Line.BatchLineId), GuidHelper.ToGuidString(item.Line.IngredientId), item.Line.Ingredient?.IngredientCode,
                            item.Line.Ingredient?.IngredientName, GuidHelper.ToGuidString(item.Line.CanonicalUnitId), item.Line.CanonicalUnit?.UnitName,
                            facts[0].FrozenBomQuantityPerServing!.Value, GuidHelper.ToGuidString(item.Contributor.DailyLineId!), dailyLinesById[Convert.ToHexString(item.Contributor.DailyLineId!)].ServiceDate.ToString("yyyy-MM-dd"));
                    }).OrderBy(material => material.ServiceDate).ThenBy(material => material.IngredientName).ToList();
                var scopes = dishGroup
                    .GroupBy(item => new { ServiceDate = dailyLinesById[Convert.ToHexString(item.Contributor.DailyLineId!)].ServiceDate, item.Contributor.FrozenShiftName, item.Contributor.FrozenServings })
                    .Select(group => new ReconciliationBatchDishScopeDto(group.Key.ServiceDate.ToString("yyyy-MM-dd"), group.Key.FrozenShiftName!, group.Key.FrozenServings!.Value, group.Key.FrozenServings.Value, 0))
                    .OrderBy(scope => scope.ServiceDate).ThenBy(scope => scope.ShiftName).ToList();
                return new ReconciliationBatchDishSummaryDto(GuidHelper.ToGuidString(first.DishId!), first.FrozenDishCode!, first.FrozenDishName!, materials, scopes);
            })
            .OrderBy(dish => dish.DishName)
            .ToList();
    }
}
