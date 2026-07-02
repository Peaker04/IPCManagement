using System.Security.Claims;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.DTOs.Approvals;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using IPCManagement.Api.Services.Workflow;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Services.Approvals;

public interface IApprovalInboxService
{
    Task<IReadOnlyList<ApprovalInboxItemDto>> GetPendingAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default);
}

public sealed class ApprovalInboxService : IApprovalInboxService
{
    private const string PurchaseRequestTargetType = "purchase-request";
    private const string InventoryIssueTargetType = "inventory-issue";
    private const string OrderAdjustmentTargetType = "order-adjustment";

    private readonly IpcManagementContext _context;

    public ApprovalInboxService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ApprovalInboxItemDto>> GetPendingAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var permissions = ResolveUserPermissions(user);
        var limit = Math.Clamp(query.Limit <= 0 ? 100 : query.Limit, 1, 200);
        var inbox = new List<ApprovalInboxItemDto>();

        if (permissions.Contains(AuthorizationPolicies.PurchaseRequestApprove))
        {
            inbox.AddRange(await BuildPurchaseRequestItemsAsync(limit, cancellationToken));
            inbox.AddRange(await BuildPriceAlertItemsAsync(limit, cancellationToken));
        }

        if (permissions.Contains(AuthorizationPolicies.InventoryIssueApprove))
        {
            inbox.AddRange(await BuildInventoryIssueItemsAsync(limit, cancellationToken));
        }

        if (permissions.Contains(AuthorizationPolicies.InventoryAdjustmentApprove))
        {
            inbox.AddRange(await BuildOrderAdjustmentItemsAsync(limit, cancellationToken));
        }

        return inbox
            .OrderBy(item => item.DueDate ?? DateOnly.MaxValue)
            .ThenBy(item => item.TargetCode)
            .Take(limit)
            .ToList();
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildPurchaseRequestItemsAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var requests = await _context.Purchaserequests
            .AsNoTracking()
            .Include(item => item.CreatedByNavigation)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .Where(item =>
                item.Status == "SENTTOSUPPLIER" &&
                !_context.Approvalhistories.Any(history =>
                    history.TargetType == PurchaseRequestTargetType &&
                    history.TargetId == item.PurchaseRequestId))
            .OrderBy(item => item.PurchaseForDate)
            .ThenBy(item => item.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var result = new List<ApprovalInboxItemDto>();
        foreach (var request in requests)
        {
            if (await HasPriceWarningAsync(request, cancellationToken))
            {
                continue;
            }

            result.Add(new ApprovalInboxItemDto
            {
                InboxItemId = $"purchase-{GuidHelper.ToGuidString(request.PurchaseRequestId)}",
                TargetType = PurchaseRequestTargetType,
                TargetId = GuidHelper.ToGuidString(request.PurchaseRequestId),
                TargetCode = request.PurchaseRequestCode,
                ItemType = "purchase",
                Title = "Duyệt đơn mua",
                Source = request.PurchaseRequestCode,
                OwnerRole = "Thu mua / Quản lý",
                SubmittedBy = request.CreatedByNavigation.FullName,
                DueDate = request.PurchaseForDate,
                Status = "PENDING",
                Reason = "Đơn mua đã gửi, chờ duyệt trước khi mua hàng.",
                NextAction = "Duyệt đơn mua",
                Tone = "warning",
                Route = "/approvals",
                Materials = request.Purchaserequestlines
                    .OrderBy(line => line.Ingredient.IngredientName)
                    .Select(MapPurchaseMaterial)
                    .ToList()
            });
        }

        return result;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildPriceAlertItemsAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var requests = await _context.Purchaserequests
            .AsNoTracking()
            .Include(item => item.CreatedByNavigation)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.Unit)
            .Where(item =>
                (item.Status == "DRAFT" || item.Status == "SENTTOSUPPLIER") &&
                !_context.Approvalhistories.Any(history =>
                    history.TargetType == PurchaseRequestTargetType &&
                    history.TargetId == item.PurchaseRequestId))
            .OrderBy(item => item.PurchaseForDate)
            .ThenBy(item => item.PurchaseRequestCode)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var result = new List<ApprovalInboxItemDto>();
        foreach (var request in requests)
        {
            var warningLines = new List<Purchaserequestline>();
            foreach (var line in request.Purchaserequestlines)
            {
                if (await IsPriceWarningAsync(line, cancellationToken))
                {
                    warningLines.Add(line);
                }
            }

            if (warningLines.Count == 0)
            {
                continue;
            }

            result.Add(new ApprovalInboxItemDto
            {
                InboxItemId = $"price-alert-{GuidHelper.ToGuidString(request.PurchaseRequestId)}",
                TargetType = PurchaseRequestTargetType,
                TargetId = GuidHelper.ToGuidString(request.PurchaseRequestId),
                TargetCode = request.PurchaseRequestCode,
                ItemType = "price-alert",
                Title = "Kiểm tra giá mua",
                Source = request.PurchaseRequestCode,
                OwnerRole = "Thu mua / Quản lý",
                SubmittedBy = request.CreatedByNavigation.FullName,
                DueDate = request.PurchaseForDate,
                Status = "PENDING",
                Reason = "Có dòng mua vượt ngưỡng giá, cần xử lý trước khi duyệt.",
                NextAction = "Xử lý cảnh báo giá",
                Tone = "danger",
                Route = "/approvals",
                Materials = warningLines
                    .OrderBy(line => line.Ingredient.IngredientName)
                    .Select(MapPurchaseMaterial)
                    .ToList()
            });
        }

        return result;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildInventoryIssueItemsAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var issues = await _context.Inventoryissues
            .AsNoTracking()
            .Include(item => item.IssuedByNavigation)
            .Include(item => item.MaterialRequest)
            .Include(item => item.Inventoryissuelines)
                .ThenInclude(line => line.Ingredient)
            .Include(item => item.Inventoryissuelines)
                .ThenInclude(line => line.Unit)
            .Where(item =>
                item.MaterialRequest.Status == "SENTTOWAREHOUSE" &&
                !_context.Approvalhistories.Any(history =>
                    history.TargetType == InventoryIssueTargetType &&
                    history.TargetId == item.IssueId))
            .OrderBy(item => item.IssueDate)
            .ThenBy(item => item.IssueCode)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return issues.Select(item => new ApprovalInboxItemDto
            {
                InboxItemId = "issue-" + GuidHelper.ToGuidString(item.IssueId),
                TargetType = InventoryIssueTargetType,
                TargetId = GuidHelper.ToGuidString(item.IssueId),
                TargetCode = item.IssueCode,
                ItemType = "issue",
                Title = "Duyệt phiếu xuất kho",
                Source = item.MaterialRequest.RequestCode,
                OwnerRole = "Kho / Quản lý",
                SubmittedBy = item.IssuedByNavigation.FullName,
                DueDate = item.IssueDate,
                Status = "PENDING",
                Reason = "Phiếu xuất kho đang chờ xác nhận.",
                NextAction = "Duyệt phiếu xuất",
                Tone = "warning",
                Route = "/approvals",
                Materials = item.Inventoryissuelines
                    .OrderBy(line => line.Ingredient.IngredientName)
                    .Select(line => new ApprovalInboxMaterialDto
                    {
                        Name = line.Ingredient.IngredientName,
                        Quantity = DecimalPolicy.RoundQuantity(line.IssuedQty),
                        Unit = line.Unit.UnitName
                    })
                    .ToList()
            })
            .ToList();
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildOrderAdjustmentItemsAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var adjustments = await _context.Quantityadjustments
            .AsNoTracking()
            .Include(item => item.AdjustedByNavigation)
            .Include(item => item.QuantityPlanLine)
                .ThenInclude(line => line.Customer)
            .Include(item => item.QuantityPlanLine)
                .ThenInclude(line => line.Menu)
            .Where(item => !_context.Approvalhistories.Any(history =>
                history.TargetType == OrderAdjustmentTargetType &&
                history.TargetId == item.AdjustmentId))
            .OrderBy(item => item.AdjustedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return adjustments.Select(item => new ApprovalInboxItemDto
            {
                InboxItemId = "adjustment-" + GuidHelper.ToGuidString(item.AdjustmentId),
                TargetType = OrderAdjustmentTargetType,
                TargetId = GuidHelper.ToGuidString(item.AdjustmentId),
                TargetCode = item.QuantityPlanLine.Customer.CustomerCode + "-" + item.QuantityPlanLine.ShiftName,
                ItemType = "adjustment",
                Title = "Duyệt điều chỉnh suất ăn",
                Source = item.QuantityPlanLine.Customer.CustomerName,
                OwnerRole = "Kho / Quản lý",
                SubmittedBy = item.AdjustedByNavigation.FullName,
                DueDate = DateOnly.FromDateTime(item.AdjustedAt),
                Status = "PENDING",
                Reason = item.Reason ?? "Điều chỉnh số suất cần duyệt.",
                NextAction = "Duyệt điều chỉnh",
                Tone = "warning",
                Route = "/approvals",
                Materials =
                [
                    new ApprovalInboxMaterialDto
                    {
                        Name = item.QuantityPlanLine.Menu.MenuName,
                        Quantity = item.NewServings,
                        Unit = "suất"
                    }
                ]
            })
            .ToList();
    }

    private static HashSet<string> ResolveUserPermissions(ClaimsPrincipal user)
    {
        var roleNames = user.FindAll(ClaimTypes.Role)
            .Select(claim => claim.Value)
            .Where(role => !string.IsNullOrWhiteSpace(role))
            .ToList();

        return roleNames
            .SelectMany(AuthorizationPolicies.ResolvePermissions)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private async Task<bool> HasPriceWarningAsync(Purchaserequest request, CancellationToken cancellationToken)
    {
        foreach (var line in request.Purchaserequestlines)
        {
            if (await IsPriceWarningAsync(line, cancellationToken))
            {
                return true;
            }
        }

        return false;
    }

    private async Task<bool> IsPriceWarningAsync(Purchaserequestline line, CancellationToken cancellationToken)
    {
        var latestReceiptPrice = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Where(item =>
                item.IngredientId.SequenceEqual(line.IngredientId) &&
                item.Receipt.SupplierId.SequenceEqual(line.SupplierId) &&
                item.UnitId.SequenceEqual(line.UnitId) &&
                item.UnitPrice > 0)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .Select(item => item.UnitPrice)
            .FirstOrDefaultAsync(cancellationToken);

        var referencePrice = latestReceiptPrice > 0 ? latestReceiptPrice : DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice);
        var variance = WorkflowReportCalculator.CalculateVariancePercent(referencePrice, line.EstimatedUnitPrice);
        return WorkflowReportCalculator.IsPriceIncreaseWarning(variance);
    }

    private static ApprovalInboxMaterialDto MapPurchaseMaterial(Purchaserequestline line)
        => new()
        {
            Name = line.Ingredient.IngredientName,
            Quantity = DecimalPolicy.RoundQuantity(line.PurchaseQty),
            Unit = line.Unit.UnitName
        };
}
