using System.Security.Claims;
using System.Text;
using System.Text.Json;
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
    Task<ApprovalInboxPageDto> GetPendingPageAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ApprovalInboxItemDto>> GetPendingAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default);
}

public sealed class ApprovalInboxService : IApprovalInboxService
{
    private const string PurchaseRequestTargetType = "purchase-request";
    private const string MaterialDemandTargetType = "material-demand";
    private const string InventoryIssueTargetType = "inventory-issue";
    private const string OrderAdjustmentTargetType = "order-adjustment";
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 50;

    private sealed record ApprovalInboxCursor(DateOnly DueDate, string TargetCode, string InboxItemId);

    private readonly IpcManagementContext _context;
    private readonly IApprovalRoutingService _routingService;

    public ApprovalInboxService(IpcManagementContext context, IApprovalRoutingService routingService)
    {
        _context = context;
        _routingService = routingService;
    }

    private async Task PopulateSlaAsync(ApprovalInboxItemDto item, byte[] targetIdBytes, DateTime? docCreationTime = null)
    {
        decimal? amount = null;
        if (item.TargetType == PurchaseRequestTargetType)
        {
            var prId = targetIdBytes;
            amount = await _context.Purchaserequestlines
                .Where(l => l.PurchaseRequestId.SequenceEqual(prId))
                .SumAsync(l => l.PurchaseQty * l.EstimatedUnitPrice);
        }

        var rule = await _routingService.GetMatchingRuleAsync(item.TargetType, amount);
        if (rule != null && rule.SlaHours.HasValue)
        {
            var submitTime = await _context.Approvalhistories
                .Where(h => h.TargetType == item.TargetType && h.TargetId.SequenceEqual(targetIdBytes) && (h.Decision == "SUBMIT" || h.Decision == "Submit"))
                .Select(h => h.ActionAt)
                .FirstOrDefaultAsync();

            var baseTime = submitTime != default ? submitTime : (docCreationTime ?? DateTime.UtcNow);
            item.SlaHours = rule.SlaHours;
            item.SlaDeadline = baseTime.AddHours(rule.SlaHours.Value);
        }
    }

    public async Task<IReadOnlyList<ApprovalInboxItemDto>> GetPendingAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var limit = NormalizeLimit(query.Limit, 100, 200);
        return (await BuildPendingItemsAsync(user, limit, null, cancellationToken))
            .OrderBy(item => item.DueDate ?? DateOnly.MaxValue)
            .ThenBy(item => item.TargetCode)
            .ThenBy(item => item.InboxItemId)
            .Take(limit)
            .ToList();
    }

    public async Task<ApprovalInboxPageDto> GetPendingPageAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var limit = NormalizeLimit(query.Limit, DefaultPageSize, MaxPageSize);
        var cursor = DecodeCursor(query.Cursor);
        var candidates = await BuildPendingItemsAsync(user, Math.Min(limit * 4 + 1, 200), cursor, cancellationToken);
        var ordered = candidates
            .OrderBy(item => item.DueDate ?? DateOnly.MaxValue)
            .ThenBy(item => item.TargetCode)
            .ThenBy(item => item.InboxItemId)
            .Where(item => cursor is null || IsAfterCursor(item, cursor))
            .ToList();
        var items = ordered.Take(limit).ToList();
        var hasNext = ordered.Count > limit;

        return new ApprovalInboxPageDto
        {
            Items = items,
            Limit = limit,
            HasNext = hasNext,
            NextCursor = hasNext && items.Count > 0 ? EncodeCursor(items[^1]) : null
        };
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildPendingItemsAsync(
        ClaimsPrincipal user,
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var permissions = ResolveUserPermissions(user);
        var inbox = new List<ApprovalInboxItemDto>();

        if (permissions.Contains(AuthorizationPolicies.MaterialDemandApprove))
        {
            inbox.AddRange(await BuildMaterialDemandItemsAsync(limit, cursor, cancellationToken));
        }

        if (permissions.Contains(AuthorizationPolicies.PurchaseRequestApprove))
        {
            inbox.AddRange(await BuildPurchaseRequestItemsAsync(limit, cursor, cancellationToken));
            inbox.AddRange(await BuildPriceAlertItemsAsync(limit, cursor, cancellationToken));
        }

        if (permissions.Contains(AuthorizationPolicies.InventoryIssueApprove))
        {
            inbox.AddRange(await BuildInventoryIssueItemsAsync(limit, cursor, cancellationToken));
        }

        if (permissions.Contains(AuthorizationPolicies.InventoryAdjustmentApprove))
        {
            inbox.AddRange(await BuildOrderAdjustmentItemsAsync(limit, cursor, cancellationToken));
        }

        return inbox;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildMaterialDemandItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var requestQuery = _context.Materialrequests
            .AsNoTracking()
            .Where(item => item.Status == "DRAFT");
        if (cursor is not null)
        {
            requestQuery = requestQuery.Where(item =>
                item.RequestDate > cursor.DueDate ||
                (item.RequestDate == cursor.DueDate && item.RequestCode.CompareTo(cursor.TargetCode) > 0));
        }

        var requests = await requestQuery
            .OrderBy(item => item.RequestDate)
            .ThenBy(item => item.RequestCode)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var result = new List<ApprovalInboxItemDto>();
        var ingredientNames = new Dictionary<string, string>(StringComparer.Ordinal);
        var unitNames = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var request in requests)
        {
            var plan = await _context.Productionplans
                .AsNoTracking()
                .SingleAsync(item => item.PlanId.SequenceEqual(request.PlanId), cancellationToken);
            var submittedBy = await _context.Users
                .AsNoTracking()
                .Where(item => item.UserId.SequenceEqual(request.CreatedBy))
                .Select(item => item.FullName)
                .SingleAsync(cancellationToken);
            var requestLines = await _context.Materialrequestlines
                .AsNoTracking()
                .Where(line => line.RequestId.SequenceEqual(request.RequestId))
                .ToListAsync(cancellationToken);
            var lineDetails = new List<(string IngredientId, string UnitId, string Name, string Unit, decimal Quantity)>();
            foreach (var line in requestLines)
            {
                var ingredientId = Convert.ToBase64String(line.IngredientId);
                if (!ingredientNames.TryGetValue(ingredientId, out var ingredientName))
                {
                    ingredientName = await _context.Ingredients
                        .AsNoTracking()
                        .Where(item => item.IngredientId.SequenceEqual(line.IngredientId))
                        .Select(item => item.IngredientName)
                        .SingleAsync(cancellationToken);
                    ingredientNames[ingredientId] = ingredientName;
                }

                var unitId = Convert.ToBase64String(line.UnitId);
                if (!unitNames.TryGetValue(unitId, out var unitName))
                {
                    unitName = await _context.Units
                        .AsNoTracking()
                        .Where(item => item.UnitId.SequenceEqual(line.UnitId))
                        .Select(item => item.UnitName)
                        .SingleAsync(cancellationToken);
                    unitNames[unitId] = unitName;
                }

                lineDetails.Add((ingredientId, unitId, ingredientName, unitName, line.SuggestedPurchaseQty));
            }

            var materials = lineDetails
                .GroupBy(line => new
                {
                    line.IngredientId,
                    line.UnitId
                })
                .Select(group => new ApprovalInboxMaterialDto
                {
                    Name = group.First().Name,
                    Quantity = DecimalPolicy.RoundQuantity(group.Sum(line => line.Quantity)),
                    Unit = group.First().Unit
                })
                .OrderBy(material => material.Name)
                .ToList();
            var targetId = GuidHelper.ToGuidString(request.RequestId);
            var itemDto = new ApprovalInboxItemDto
            {
                InboxItemId = $"material-demand-{targetId}",
                TargetType = MaterialDemandTargetType,
                TargetId = targetId,
                TargetCode = request.RequestCode,
                ItemType = MaterialDemandTargetType,
                Title = "Duyệt nhu cầu nguyên liệu",
                Source = request.RequestCode,
                OwnerRole = "Quản lý",
                SubmittedBy = submittedBy,
                DueDate = request.RequestDate,
                Status = "PENDING",
                Reason = "Nhu cầu nguyên liệu đã tính, chờ quản lý duyệt trước khi mua hàng.",
                NextAction = "Duyệt nhu cầu",
                Tone = "warning",
                Route = $"/approvals?targetType={MaterialDemandTargetType}&targetId={targetId}&serviceDate={request.RequestDate:yyyy-MM-dd}&scope={Uri.EscapeDataString(request.RequestScope)}",
                WeekStartDate = plan.WeekStartDate,
                ServiceDate = request.RequestDate,
                Scope = request.RequestScope,
                LineCount = requestLines.Count,
                TotalQuantity = DecimalPolicy.RoundQuantity(requestLines.Sum(line => line.SuggestedPurchaseQty)),
                TotalValue = null,
                SubmittedAt = plan.CreatedAt,
                Materials = materials
            };
            await PopulateSlaAsync(itemDto, request.RequestId, plan.CreatedAt);
            result.Add(itemDto);
        }

        return result;
    }

    private static int NormalizeLimit(int value, int fallback, int maximum)
        => Math.Clamp(value <= 0 ? fallback : value, 1, maximum);

    private static bool IsAfterCursor(ApprovalInboxItemDto item, ApprovalInboxCursor cursor)
    {
        var dueDate = item.DueDate ?? DateOnly.MaxValue;
        var dateComparison = dueDate.CompareTo(cursor.DueDate);
        if (dateComparison != 0) return dateComparison > 0;

        var codeComparison = string.Compare(item.TargetCode, cursor.TargetCode, StringComparison.Ordinal);
        if (codeComparison != 0) return codeComparison > 0;

        return string.Compare(item.InboxItemId, cursor.InboxItemId, StringComparison.Ordinal) > 0;
    }

    private static string EncodeCursor(ApprovalInboxItemDto item)
    {
        var cursor = new ApprovalInboxCursor(item.DueDate ?? DateOnly.MaxValue, item.TargetCode, item.InboxItemId);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(cursor)));
    }

    private static ApprovalInboxCursor? DecodeCursor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(value));
            return JsonSerializer.Deserialize<ApprovalInboxCursor>(json);
        }
        catch (FormatException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildPurchaseRequestItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var requestQuery = _context.Purchaserequests
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
                    history.TargetId == item.PurchaseRequestId));
        if (cursor is not null)
        {
            requestQuery = requestQuery.Where(item =>
                item.PurchaseForDate > cursor.DueDate ||
                (item.PurchaseForDate == cursor.DueDate && item.PurchaseRequestCode.CompareTo(cursor.TargetCode) > 0));
        }

        var requests = await requestQuery
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

            var itemDto = new ApprovalInboxItemDto
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
            };
            var baseDocDate = new DateTime(request.RequestDate.Year, request.RequestDate.Month, request.RequestDate.Day, 0, 0, 0, DateTimeKind.Utc);
            await PopulateSlaAsync(itemDto, request.PurchaseRequestId, baseDocDate);
            result.Add(itemDto);
        }

        return result;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildPriceAlertItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var batchSize = Math.Clamp(limit, 1, 50);
        var result = new List<ApprovalInboxItemDto>();
        var sourceDate = cursor?.DueDate;
        var sourceCode = cursor?.TargetCode;
        var firstBatch = true;

        while (result.Count < limit)
        {
            var requestQuery = _context.Purchaserequests
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
                        history.TargetId == item.PurchaseRequestId));
            if (sourceDate is not null && sourceCode is not null)
            {
                var comparison = firstBatch ? 0 : 1;
                requestQuery = requestQuery.Where(item =>
                    item.PurchaseForDate > sourceDate.Value ||
                    (item.PurchaseForDate == sourceDate.Value &&
                        item.PurchaseRequestCode.CompareTo(sourceCode) >= comparison));
            }

            var requests = await requestQuery
                .OrderBy(item => item.PurchaseForDate)
                .ThenBy(item => item.PurchaseRequestCode)
                .Take(batchSize)
                .ToListAsync(cancellationToken);
            if (requests.Count == 0)
            {
                break;
            }

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

                var itemDto = new ApprovalInboxItemDto
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
                };
                var baseDocDate = new DateTime(request.RequestDate.Year, request.RequestDate.Month, request.RequestDate.Day, 0, 0, 0, DateTimeKind.Utc);
                await PopulateSlaAsync(itemDto, request.PurchaseRequestId, baseDocDate);
                if (cursor is null || IsAfterCursor(itemDto, cursor))
                {
                    result.Add(itemDto);
                }
            }

            var last = requests[^1];
            sourceDate = last.PurchaseForDate;
            sourceCode = last.PurchaseRequestCode;
            firstBatch = false;
            if (requests.Count < batchSize)
            {
                break;
            }
        }

        return result;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildInventoryIssueItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var issueQuery = _context.Inventoryissues
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
                    history.TargetId == item.IssueId));
        if (cursor is not null)
        {
            issueQuery = issueQuery.Where(item =>
                item.IssueDate > cursor.DueDate ||
                (item.IssueDate == cursor.DueDate && item.IssueCode.CompareTo(cursor.TargetCode) > 0));
        }

        var issues = await issueQuery
            .OrderBy(item => item.IssueDate)
            .ThenBy(item => item.IssueCode)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var resultList = new List<ApprovalInboxItemDto>();
        foreach (var item in issues)
        {
            var itemDto = new ApprovalInboxItemDto
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
            };
            await PopulateSlaAsync(itemDto, item.IssueId, item.CreatedAt);
            resultList.Add(itemDto);
        }
        return resultList;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildOrderAdjustmentItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var adjustmentQuery = _context.Quantityadjustments
            .AsNoTracking()
            .Include(item => item.AdjustedByNavigation)
            .Include(item => item.QuantityPlanLine)
                .ThenInclude(line => line.Customer)
            .Include(item => item.QuantityPlanLine)
                .ThenInclude(line => line.Menu)
            .Where(item => !_context.Approvalhistories.Any(history =>
                history.TargetType == OrderAdjustmentTargetType &&
                history.TargetId == item.AdjustmentId));
        if (cursor is not null)
        {
            var cursorDateTime = cursor.DueDate.ToDateTime(TimeOnly.MinValue);
            adjustmentQuery = adjustmentQuery.Where(item =>
                item.AdjustedAt.Date > cursorDateTime.Date ||
                (item.AdjustedAt.Date == cursorDateTime.Date && item.AdjustedAt > cursorDateTime));
        }

        var adjustments = await adjustmentQuery
            .OrderBy(item => item.AdjustedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        var resultList = new List<ApprovalInboxItemDto>();
        foreach (var item in adjustments)
        {
            var itemDto = new ApprovalInboxItemDto
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
            };
            await PopulateSlaAsync(itemDto, item.AdjustmentId, item.AdjustedAt);
            resultList.Add(itemDto);
        }
        return resultList;
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
