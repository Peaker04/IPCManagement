using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class ApprovalTargetLock
{
    public static async Task AcquireAsync(IpcManagementContext context, ApprovalTargetType type, byte[] id,
        CancellationToken token = default)
    {
        if (context.Database.ProviderName != "Pomelo.EntityFrameworkCore.MySql") return;
        if (context.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Approval target lock requires its owning transaction.");
        var sql = type switch
        {
            ApprovalTargetType.MaterialDemand => "SELECT requestId FROM materialrequests WHERE requestId = {0} FOR UPDATE",
            ApprovalTargetType.PurchaseRequest => "SELECT purchaseRequestId FROM purchaserequests WHERE purchaseRequestId = {0} FOR UPDATE",
            ApprovalTargetType.PurchasePriceException => "SELECT purchasePriceExceptionId FROM purchasepriceexceptions WHERE purchasePriceExceptionId = {0} FOR UPDATE",
            ApprovalTargetType.InventoryReceipt => "SELECT receiptId FROM inventoryreceipts WHERE receiptId = {0} FOR UPDATE",
            ApprovalTargetType.InventoryIssue => "SELECT issueId FROM inventoryissues WHERE issueId = {0} FOR UPDATE",
            ApprovalTargetType.InventoryAdjustment => "SELECT adjustmentId FROM quantityadjustments WHERE adjustmentId = {0} FOR UPDATE",
            _ => throw new ArgumentOutOfRangeException(nameof(type))
        };
        // Table/column are a closed server-owned mapping; only the value is a SQL parameter.
        await context.Database.ExecuteSqlRawAsync(sql, [id], token);
    }
}
