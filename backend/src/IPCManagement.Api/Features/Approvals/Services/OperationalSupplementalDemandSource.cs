using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed class OperationalSupplementalDemandSource(IpcManagementContext context)
{
    internal async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)> ReadAsync(ApprovalInboxQueryDto query, CancellationToken token, int offset = 0, int limit = 100, DateTime? cursorAt = null)
    {
        if (!ApprovalInboxQueryPolicy.ShouldBuildTarget(query.TargetType, "mrx-supplemental-demand")) return ([], false);
        var id = string.IsNullOrWhiteSpace(query.TargetId) ? null : GuidHelper.ParseGuidString(query.TargetId)
            ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        var customerCode = query.CustomerCode?.Trim().ToUpperInvariant();
        var records = await (from demand in context.Reconciliationsupplementaldemands.AsNoTracking()
            join batch in context.Reconciliationbatches on demand.BatchId equals batch.BatchId
            join menu in context.Menuversions on batch.MenuVersionId equals menu.MenuVersionId
            join customer in context.Customers on menu.CustomerId equals customer.CustomerId
            join user in context.Users on demand.CreatedBy equals user.UserId
            where (query.State == "PENDING" ? demand.Status == "PENDING" : demand.Status == "APPROVED" || demand.Status == "REJECTED" || demand.Status == "CANCELLED")
                && (id == null || demand.DemandId == id)
                && (cursorAt == null || (demand.SubmittedAt ?? demand.CreatedAt) >= cursorAt)
                && (string.IsNullOrEmpty(customerCode) || customer.CustomerCode.ToUpper() == customerCode)
            select new { Demand = demand, customer.CustomerCode, customer.CustomerName, menu.WeekStartDate, user.FullName })
            .OrderBy(x => x.Demand.CreatedAt).ThenBy(x => x.Demand.DemandId).Skip(offset).Take(limit + 1).ToListAsync(token);
        var hasMore = records.Count > limit;
        records = records.Take(limit).ToList();
        var ids = records.Select(x => x.Demand.DemandId).ToArray();
        var materialRows = ids.Length == 0 ? [] : await context.Reconciliationsupplementaldemandmaterials.AsNoTracking()
            .Where(x => ids.Contains(x.DemandId))
            .OrderBy(x => x.DailyLine.BatchLine.Ingredient.IngredientName).ThenBy(x => x.DemandMaterialId)
            .Select(x => new { x.DemandId, Material = new ApprovalInboxMaterialDto { Name = x.DailyLine.BatchLine.Ingredient.IngredientName,
                Unit = x.DailyLine.BatchLine.CanonicalUnit.UnitName, Quantity = x.RequiredQuantity } }).ToListAsync(token);
        var materialsByDemand = materialRows.GroupBy(x => Convert.ToBase64String(x.DemandId))
            .ToDictionary(x => x.Key, x => x.Select(row => row.Material).ToList());
        var result = new List<ApprovalInboxItemDto>();
        foreach (var record in records)
        {
            var demand = record.Demand;
            var materials = materialsByDemand.GetValueOrDefault(Convert.ToBase64String(demand.DemandId), []);
            var idText = GuidHelper.ToGuidString(demand.DemandId);
            result.Add(new ApprovalInboxItemDto { InboxItemId = $"MATERIAL_RECONCILIATION:mrx-supplemental-demand:{idText}",
                TargetType = "mrx-supplemental-demand", TargetId = idText, CustomerCode = record.CustomerCode, TargetCode = $"PS-{idText[..8].ToUpperInvariant()}",
                Title = "Nhu cầu suất phát sinh", Source = $"{record.CustomerCode} · {record.CustomerName}",
                OwnerRole = "Manager/Admin", SubmittedBy = record.FullName, SubmittedAt = demand.SubmittedAt ?? demand.CreatedAt,
                Status = demand.Status, Reason = demand.Reason, ServiceDate = demand.ServiceDate, WeekStartDate = record.WeekStartDate,
                LineCount = materials.Count, Materials = materials,
                Route = $"/approvals?targetType=mrx-supplemental-demand&targetId={idText}&state={query.State}" });
        }
        return (result, hasMore);
    }
}
