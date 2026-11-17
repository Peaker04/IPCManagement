using IPCManagement.Api.Data;
using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class ReconciliationIssueAllocationWriter
{
    internal static async Task StageAsync(IpcManagementContext context, CreateInventoryIssueRequest request, InventoryIssue issue,
        IReadOnlyList<ReconciliationBatchDailyLine> sources, bool supplemental, CancellationToken token)
    {
        if (!supplemental)
        {
            foreach (var line in issue.Inventoryissuelines)
            {
                var requested = RequestLine(request, line);
                if (requested.Allocations is { Count: > 0 }) throw new BusinessRuleException("Phiếu đầu tiên phân bổ theo nhu cầu gốc, không cấp cho hồ sơ phát sinh.");
                var source = sources.Single(x => x.DailyLineId.SequenceEqual(line.ReconciliationBatchDailyLineId!));
                var baseline = Math.Min(source.RequiredQuantity, line.IssuedQty);
                if (baseline > 0) Add(context, line, "BASELINE_SHORTAGE", baseline, null);
                var excess = DecimalPolicy.RoundQuantity(line.IssuedQty - baseline);
                if (excess > 0) Add(context, line, "UNPLANNED_EXTRA", excess, null);
            }
            return;
        }
        var hasApprovedDemand = await context.Reconciliationsupplementaldemands.AsNoTracking()
            .AnyAsync(x => x.BatchId == issue.ReconciliationBatchId && x.ServiceDate == issue.IssueDate && x.Status == "APPROVED", token);
        var hasAllocations = request.Lines.Any(x => x.Allocations is { Count: > 0 });
        // Old clients keep their original ledger semantics when no approved extras exist. Never infer their purpose from free text.
        if (!hasAllocations && !hasApprovedDemand) return;
        var fulfillment = await ReconciliationSupplementalFulfillmentQuery.GetAsync(context, issue.ReconciliationBatchId!, issue.IssueDate, token);
        foreach (var line in issue.Inventoryissuelines)
        {
            var requested = RequestLine(request, line);
            var allocations = requested.Allocations ?? [];
            if (allocations.Count == 0 || allocations.Sum(x => x.Quantity) != line.IssuedQty)
                throw new BusinessRuleException("Tổng phân bổ mục đích phải bằng lượng thực xuất của nguyên liệu.");
            if (allocations.Any(x => x.Quantity <= 0 || DecimalPolicy.RoundQuantity(x.Quantity) != x.Quantity))
                throw new BusinessRuleException("Lượng phân bổ phải dương và có tối đa 6 chữ số thập phân.");
            if (allocations.Select(x => $"{x.Purpose}:{x.DemandMaterialId}").Distinct(StringComparer.OrdinalIgnoreCase).Count() != allocations.Count)
                throw new BusinessRuleException("Mục đích và dòng nhu cầu bị phân bổ lặp trong cùng nguyên liệu.");
            var balance = fulfillment.Lines.Single(x => x.DailyLineId == GuidHelper.ToGuidString(line.ReconciliationBatchDailyLineId!));
            foreach (var allocation in allocations)
            {
                byte[]? materialId = null;
                if (allocation.Purpose == "APPROVED_EXTRA_DEMAND")
                {
                    materialId = GuidHelper.ParseGuidString(allocation.DemandMaterialId) ?? throw new BusinessRuleException("Cần chọn dòng nhu cầu đã duyệt.");
                    var material = await context.Reconciliationsupplementaldemandmaterials.AsNoTracking().Include(x => x.Demand)
                        .SingleOrDefaultAsync(x => x.DemandMaterialId == materialId, token);
                    if (material is null || material.Demand.Status != "APPROVED" || !material.BatchId.SequenceEqual(issue.ReconciliationBatchId!)
                        || material.Demand.ServiceDate != issue.IssueDate || !material.DailyLineId.SequenceEqual(line.ReconciliationBatchDailyLineId!)
                        || !material.IngredientId.SequenceEqual(line.IngredientId) || !material.CanonicalUnitId.SequenceEqual(line.UnitId))
                        throw new BusinessRuleException("Dòng nhu cầu chưa duyệt hoặc không khớp lô, ngày, nguyên liệu và đơn vị.");
                    if (material.Demand.Version != allocation.ExpectedDemandVersion)
                        throw new DbUpdateConcurrencyException("Nhu cầu phát sinh đã thay đổi. Hãy tải lại trước khi xuất.");
                    var remaining = balance.ExtraDemands.Single(x => x.DemandMaterialId == GuidHelper.ToGuidString(materialId)).RemainingQuantity;
                    RequireAvailable(remaining, allocation.Quantity);
                }
                else if (allocation.Purpose is "BASELINE_SHORTAGE" or "UNPLANNED_EXTRA")
                {
                    if (allocation.DemandMaterialId is not null || allocation.ExpectedDemandVersion is not null)
                        throw new BusinessRuleException("Chỉ mục đích cấp suất phát sinh mới được tham chiếu hồ sơ nhu cầu.");
                    if (allocation.Purpose == "BASELINE_SHORTAGE") RequireAvailable(balance.BaselineRemainingQuantity, allocation.Quantity);
                }
                else throw new BusinessRuleException("Mục đích phân bổ không hợp lệ.");
                Add(context, line, allocation.Purpose, allocation.Quantity, materialId);
            }
        }
    }

    private static CreateInventoryIssueLineRequest RequestLine(CreateInventoryIssueRequest request, InventoryIssueLine line) =>
        request.Lines.Single(x => GuidHelper.ParseGuidString(x.ReconciliationBatchDailyLineId)!.SequenceEqual(line.ReconciliationBatchDailyLineId!));
    private static void RequireAvailable(decimal? remaining, decimal quantity)
    {
        if (remaining is null) throw new BusinessRuleException("Lịch sử chưa đủ phân bổ mục đích hoặc có hoàn trả chưa rõ mục đích. Cần đối chiếu trước khi cấp tiếp.");
        if (DecimalPolicy.GreaterThanQuantity(quantity, remaining.Value))
            throw new BusinessRuleException("Lượng cấp vượt phần còn thiếu của mục đích đã chọn. Phần vượt cần ghi riêng là xuất ngoài nhu cầu.");
    }
    private static void Add(IpcManagementContext context, InventoryIssueLine line, string purpose, decimal quantity, byte[]? materialId) =>
        context.Reconciliationissueallocations.Add(new ReconciliationIssueAllocation { AllocationId = GuidHelper.NewId(), IssueLineId = line.IssueLineId,
            DailyLineId = line.ReconciliationBatchDailyLineId!, DemandMaterialId = materialId, Purpose = purpose, Quantity = quantity });
}
