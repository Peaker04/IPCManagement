using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Inventory.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Inventory.Services;

internal static class SupplementalMaterialRequestMapper
{
    private const string PendingStatus = "PENDING_WAREHOUSE_REVIEW";
    private const string FulfilledStatus = "FULFILLED";
    private const string RejectedStatus = "REJECTED";
    private const string MovementRefTable = "supplementalmaterialrequests";
    private const string PurchaseRequestAuditField = "PurchaseRequestId";

    internal static async Task<SupplementalMaterialRequestDto> MapAsync(
        IpcManagementContext context,
        SupplementalMaterialRequest entity,
        InventoryIssueLine source)
    {
        var fulfilledQty = await GetFulfilledQuantityAsync(context, entity);
        var remainingQty = DecimalPolicy.RoundQuantity(Math.Max(entity.RequestedQty - fulfilledQty, 0));
        var availableQty = await GetAvailableQuantityAsync(context, entity.WarehouseId, entity.IngredientId, source.Unit);
        var purchaseLink = await GetPurchaseLinkAsync(context, entity.RequestId);
        var lastSequence = await context.Lifecycletransitions.AsNoTracking()
            .Where(item => item.AggregateType == nameof(SupplementalMaterialRequest) && item.AggregateId == entity.RequestId)
            .MaxAsync(item => (int?)item.AggregateSequence);
        var concurrencyVersion = lastSequence is null ? 0 : checked(lastSequence.Value + 1L);
        var status = NormalizeStatus(entity.Status);
        var terminal = status is RejectedStatus or FulfilledStatus;

        return new SupplementalMaterialRequestDto
        {
            RequestId = GuidHelper.ToGuidString(entity.RequestId),
            RequestCode = entity.RequestCode,
            IssueId = GuidHelper.ToGuidString(entity.IssueId),
            IssueCode = source.Issue.IssueCode,
            IssueLineId = GuidHelper.ToGuidString(entity.IssueLineId),
            WarehouseId = GuidHelper.ToGuidString(entity.WarehouseId),
            IngredientId = GuidHelper.ToGuidString(entity.IngredientId),
            IngredientName = source.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(entity.UnitId),
            UnitName = source.Unit.UnitName,
            RequestedQty = DecimalPolicy.RoundQuantity(entity.RequestedQty),
            FulfilledQty = fulfilledQty,
            RemainingQty = remainingQty,
            AvailableQty = availableQty,
            Reason = entity.Reason,
            Status = status,
            RequestedAt = entity.RequestedAt,
            PurchaseRequestId = purchaseLink.RequestId,
            PurchaseRequestCode = purchaseLink.RequestCode,
            PurchaseRequestStatus = purchaseLink.Status,
            CanFulfill = !terminal && remainingQty > 0 && availableQty > 0,
            CanRouteToPurchasing = !terminal && remainingQty > availableQty && purchaseLink.RequestId is null,
            CanReject = !terminal && fulfilledQty <= 0 && purchaseLink.RequestId is null,
            ActionDisabledReason = ResolveDisabledReason(status, remainingQty, availableQty, purchaseLink.RequestCode),
            ConcurrencyVersion = concurrencyVersion,
        };
    }

    private static async Task<decimal> GetFulfilledQuantityAsync(
        IpcManagementContext context,
        SupplementalMaterialRequest entity)
    {
        decimal fulfilledQty;
        if (IsInMemory(context))
        {
            fulfilledQty = (await context.Stockmovements.AsNoTracking().ToListAsync())
                .Where(item => item.RefTable == MovementRefTable && item.RefId is not null && item.RefId.SequenceEqual(entity.RequestId))
                .Sum(item => item.QuantityOut);
        }
        else
        {
            fulfilledQty = await context.Stockmovements
                .AsNoTracking()
                .Where(item => item.RefTable == MovementRefTable && item.RefId == entity.RequestId)
                .SumAsync(item => (decimal?)item.QuantityOut) ?? 0;
        }

        return DecimalPolicy.RoundQuantity(fulfilledQty);
    }

    private static async Task<decimal> GetAvailableQuantityAsync(
        IpcManagementContext context,
        byte[] warehouseId,
        byte[] ingredientId,
        Unit targetUnit)
    {
        var stockQuery = context.Currentstocks
            .AsNoTracking()
            .Include(item => item.Unit);
        var stock = IsInMemory(context)
            ? context.ChangeTracker.Entries<CurrentStock>()
                .Select(entry => entry.Entity)
                .FirstOrDefault()
            : await stockQuery.FirstOrDefaultAsync(item => item.WarehouseId == warehouseId && item.IngredientId == ingredientId);
        if (stock is null)
        {
            return 0;
        }
        if (stock.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            return DecimalPolicy.RoundQuantity(stock.CurrentQty);
        }
        if (stock.Unit.ConvertRateToBase <= 0 || targetUnit.ConvertRateToBase <= 0 ||
            !string.Equals(BaseUnit(stock.Unit), BaseUnit(targetUnit), StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }
        return DecimalPolicy.RoundQuantity(stock.CurrentQty * stock.Unit.ConvertRateToBase / targetUnit.ConvertRateToBase);
    }

    private static async Task<(string? RequestId, string? RequestCode, string? Status)> GetPurchaseLinkAsync(
        IpcManagementContext context,
        byte[] requestId)
    {
        var audit = await context.Auditlogs
            .AsNoTracking()
            .Where(item => item.EntityName == nameof(SupplementalMaterialRequest) &&
                item.EntityId == requestId &&
                item.FieldName == PurchaseRequestAuditField)
            .OrderByDescending(item => item.ChangedAt)
            .FirstOrDefaultAsync();
        var purchaseRequestId = GuidHelper.ParseGuidString(audit?.NewValue);
        if (purchaseRequestId is null)
        {
            return (null, null, null);
        }
        var purchaseRequest = await context.Purchaserequests
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.PurchaseRequestId == purchaseRequestId);
        return purchaseRequest is null
            ? (GuidHelper.ToGuidString(purchaseRequestId), null, null)
            : (GuidHelper.ToGuidString(purchaseRequest.PurchaseRequestId), purchaseRequest.PurchaseRequestCode, purchaseRequest.Status);
    }

    private static bool IsInMemory(IpcManagementContext context)
        => string.Equals(
            context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);

    private static string NormalizeStatus(string? status)
        => string.Equals(status, "PENDING", StringComparison.OrdinalIgnoreCase)
            ? PendingStatus
            : status?.Trim().ToUpperInvariant() ?? PendingStatus;

    private static string BaseUnit(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode) ? unit.UnitCode : unit.BaseUnitCode;

    private static string? ResolveDisabledReason(
        string status,
        decimal remainingQty,
        decimal availableQty,
        string? purchaseRequestCode)
    {
        if (status == RejectedStatus) return "Yêu cầu đã bị từ chối.";
        if (status == FulfilledStatus) return "Yêu cầu đã được cấp đủ và bếp đã xác nhận.";
        if (remainingQty <= 0) return "Kho đã cấp đủ; đang chờ bếp kiểm đếm và ký nhận.";
        if (availableQty <= 0 && purchaseRequestCode is not null) return $"Đang chờ nhập hàng theo {purchaseRequestCode}.";
        if (availableQty <= 0) return "Kho không còn hàng; chuyển phần thiếu sang thu mua để tiếp tục.";
        if (availableQty < remainingQty) return $"Kho chỉ đủ cấp một phần {availableQty}; phần còn lại cần chuyển thu mua.";
        return null;
    }
}
