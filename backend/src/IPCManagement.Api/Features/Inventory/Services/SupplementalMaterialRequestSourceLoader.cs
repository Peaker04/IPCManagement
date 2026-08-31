using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class SupplementalMaterialRequestSourceLoader
{
    internal static async Task<string?> ResolveShiftNameAsync(IpcManagementContext context, InventoryIssueLine source)
    {
        if (source.MaterialRequestLineId is null) return source.Issue.ShiftName;
        var materialLine = source.MaterialRequestLine ?? await context.Materialrequestlines.AsNoTracking()
            .FirstOrDefaultAsync(item => item.RequestLineId == source.MaterialRequestLineId);
        if (materialLine is null) return source.Issue.ShiftName;
        var trackedPlanLine = context.ChangeTracker.Entries<ProductionPlanLine>().Select(entry => entry.Entity)
            .FirstOrDefault(item => item.PlanLineId.SequenceEqual(materialLine.PlanLineId));
        var sourceShift = trackedPlanLine?.ShiftName;
        if (sourceShift is null && !IsInMemory(context))
        {
            sourceShift = await context.Productionplanlines.AsNoTracking()
                .Where(item => item.PlanLineId == materialLine.PlanLineId)
                .Select(item => item.ShiftName).FirstOrDefaultAsync();
        }
        return string.IsNullOrWhiteSpace(sourceShift) ? source.Issue.ShiftName : sourceShift;
    }

    internal static async Task<InventoryIssueLine> LoadForCreateAsync(IpcManagementContext context, byte[] issueLineId)
    {
        var source = IsInMemory(context)
            ? await context.Inventoryissuelines.FindAsync(issueLineId)
            : await context.Inventoryissuelines.Include(line => line.Issue).Include(line => line.Ingredient).Include(line => line.Unit)
                .FirstOrDefaultAsync(line => line.IssueLineId == issueLineId);
        if (source is null) throw new BusinessRuleException("Không tìm thấy dòng nguyên liệu trên phiếu xuất.");
        if (source.Issue is null) await context.Entry(source).Reference(line => line.Issue).LoadAsync();
        if (source.Ingredient is null) await context.Entry(source).Reference(line => line.Ingredient).LoadAsync();
        if (source.Unit is null) await context.Entry(source).Reference(line => line.Unit).LoadAsync();
        EnsureDefaultSourceFamily(source);
        return source;
    }

    internal static void EnsureDefaultSourceFamily(InventoryIssueLine source)
    {
        var exactDefaultHeader = source.Issue.MaterialRequestId is not null && source.Issue.ReconciliationBatchId is null;
        var exactDefaultLine = source.MaterialRequestLineId is not null && source.ReconciliationBatchLineId is null;
        if (!exactDefaultHeader || !exactDefaultLine)
            throw new BusinessRuleException("Yêu cầu bổ sung chỉ áp dụng cho dòng xuất thuộc đúng nguồn nhu cầu DEFAULT.");
    }

    private static bool IsInMemory(IpcManagementContext context) =>
        string.Equals(context.Database.ProviderName, "Microsoft.EntityFrameworkCore.InMemory", StringComparison.Ordinal);
}
