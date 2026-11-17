using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed class OperationalApprovalHistoryReader(IpcManagementContext context)
{
    public async Task<(IReadOnlyList<ApprovalInboxItemDto> Items, bool HasMore)> ReadAsync(
        IReadOnlyList<OperationalApprovalTarget> targets, ApprovalInboxQueryDto query, CancellationToken token, int offset = 0, int limit = 100)
    {
        var types = targets.Select(target => target.TargetType).ToArray();
        var targetId = string.IsNullOrWhiteSpace(query.TargetId) ? null : GuidHelper.ParseGuidString(query.TargetId)
            ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        var history = context.Approvalhistories.AsNoTracking().Where(row => types.Contains(row.TargetType) &&
            (string.IsNullOrEmpty(query.TargetType) || row.TargetType == query.TargetType) && (targetId == null || row.TargetId == targetId));
        // Bound exact target identities before choosing their latest event. Ordering the grouped
        // First() projection is not translated by EF's relational providers.
        var keys = history.Select(row => new { row.TargetType, row.TargetId }).Distinct()
            .OrderBy(row => row.TargetType).ThenBy(row => row.TargetId).Skip(offset).Take(limit);
        var hasMore = await history.Select(row => new { row.TargetType, row.TargetId }).Distinct()
            .OrderBy(row => row.TargetType).ThenBy(row => row.TargetId).Skip(offset + limit).Take(1).AnyAsync(token);
        var last = await history.Where(row => keys.Any(key => key.TargetType == row.TargetType && key.TargetId == row.TargetId))
            .GroupBy(row => new { row.TargetType, row.TargetId })
            .Select(group => group.OrderByDescending(row => row.ActionAt).ThenByDescending(row => row.ApprovalHistoryId).First())
            .ToListAsync(token);
        var actorIds = last.Select(row => row.ActionBy).ToArray();
        var names = await context.Users.AsNoTracking().Where(user => actorIds.Contains(user.UserId))
            .Select(user => new { user.UserId, user.FullName }).ToListAsync(token);
        var namesById = names.ToDictionary(user => Convert.ToBase64String(user.UserId), user => user.FullName);
        var ids = last.Select(row => row.TargetId).ToArray();
        var codes = new Dictionary<string, string>();
        foreach (var type in types)
        {
            var values = type switch
            {
                "material-demand" => await context.Materialrequests.AsNoTracking().Where(row => ids.Contains(row.RequestId)).Select(row => new Code(row.RequestId, row.RequestCode)).ToListAsync(token),
                "purchase-request" => await context.Purchaserequests.AsNoTracking().Where(row => ids.Contains(row.PurchaseRequestId)).Select(row => new Code(row.PurchaseRequestId, row.PurchaseRequestCode)).ToListAsync(token),
                "purchase-price-exception" => await context.Purchasepriceexceptions.AsNoTracking().Where(row => ids.Contains(row.PurchasePriceExceptionId)).Select(row => new Code(row.PurchasePriceExceptionId, row.PurchaseLineSupplierDecision.PurchaseRequestLine.PurchaseRequest.PurchaseRequestCode)).ToListAsync(token),
                "inventory-issue" => await context.Inventoryissues.AsNoTracking().Where(row => ids.Contains(row.IssueId) && row.ReconciliationBatchId == null).Select(row => new Code(row.IssueId, row.IssueCode)).ToListAsync(token),
                "inventory-receipt" => await context.Inventoryreceipts.AsNoTracking().Where(row => ids.Contains(row.ReceiptId)).Select(row => new Code(row.ReceiptId, row.ReceiptCode)).ToListAsync(token),
                "order-adjustment" => await context.Quantityadjustments.AsNoTracking().Where(row => ids.Contains(row.AdjustmentId)).Select(row => new Code(row.AdjustmentId, row.QuantityPlanLine.Customer.CustomerCode)).ToListAsync(token),
                _ => []
            };
            foreach (var value in values) codes[$"{type}:{Convert.ToBase64String(value.Id)}"] = value.Value;
        }
        var items = last.Where(row => codes.ContainsKey($"{row.TargetType}:{Convert.ToBase64String(row.TargetId)}"))
            .Select(row => new ApprovalInboxItemDto
            {
                InboxItemId = $"DEFAULT:{row.TargetType}:{GuidHelper.ToGuidString(row.TargetId)}",
                TargetId = GuidHelper.ToGuidString(row.TargetId), TargetType = row.TargetType,
                TargetCode = codes[$"{row.TargetType}:{Convert.ToBase64String(row.TargetId)}"],
                Title = targets.Single(target => target.TargetType == row.TargetType).Label,
                SubmittedBy = namesById.GetValueOrDefault(Convert.ToBase64String(row.ActionBy), ""),
                SubmittedAt = row.ActionAt, Status = row.Decision == "STEP_APPROVED" ? "STEP_APPROVED" : row.NewStatus ?? row.Decision,
                Reason = row.Reason ?? string.Empty, Source = "Lịch sử quyết định", Route = $"/approvals?targetType={row.TargetType}&targetId={GuidHelper.ToGuidString(row.TargetId)}&state=PROCESSED"
            }).ToList();
        return (items, hasMore);
    }

    private sealed record Code(byte[] Id, string Value);
}
