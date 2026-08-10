using System.Security.Claims;
using System.Text;
using System.Text.Json;
using IPCManagement.Api.Data;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Security;
using Microsoft.EntityFrameworkCore;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.Purchasing.Services;

namespace IPCManagement.Api.Features.Approvals.Services;

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
    private const string PurchasePriceExceptionTargetType = "purchase-price-exception";
    private const string MaterialDemandTargetType = "material-demand";
    private const string InventoryIssueTargetType = "inventory-issue";
    private const string OrderAdjustmentTargetType = "order-adjustment";
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 50;

    private readonly IpcManagementContext _context;
    private readonly ApprovalInboxSlaEnricher _slaEnricher;
    private readonly ApprovalInboxDemandSource _demandSource;
    private readonly ApprovalInboxAdjustmentSource _adjustmentSource;

    public ApprovalInboxService(IpcManagementContext context, IApprovalRoutingService routingService)
    {
        _context = context;
        _slaEnricher = new ApprovalInboxSlaEnricher(context, routingService);
        _demandSource = new ApprovalInboxDemandSource(context, _slaEnricher);
        _adjustmentSource = new ApprovalInboxAdjustmentSource(context, _slaEnricher);
    }

    public async Task<IReadOnlyList<ApprovalInboxItemDto>> GetPendingAsync(
        ClaimsPrincipal user,
        ApprovalInboxQueryDto query,
        CancellationToken cancellationToken = default)
    {
        var limit = NormalizeLimit(query.Limit, 100, 200);
        return ApprovalInboxQueryPolicy.Apply(
                await BuildPendingItemsAsync(user, limit, null, query.TargetType, cancellationToken),
                query)
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
        var hasFilters = !string.IsNullOrWhiteSpace(query.TargetType) ||
            !string.IsNullOrWhiteSpace(query.TargetId) ||
            !string.IsNullOrWhiteSpace(query.Week) ||
            !string.IsNullOrWhiteSpace(query.Date) ||
            !string.IsNullOrWhiteSpace(query.SearchKeyword);
        var candidateLimit = hasFilters ? 200 : Math.Min(limit * 4 + 1, 200);
        var candidates = await BuildPendingItemsAsync(
            user,
            candidateLimit,
            cursor,
            query.TargetType,
            cancellationToken);
        var ordered = ApprovalInboxQueryPolicy.Apply(candidates, query)
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
        string? targetType,
        CancellationToken cancellationToken)
    {
        var permissions = ApprovalInboxUserPolicy.ResolvePermissions(user);
        var inbox = new List<ApprovalInboxItemDto>();

        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(targetType, MaterialDemandTargetType) &&
            permissions.Contains(AuthorizationPolicies.MaterialDemandApprove))
        {
            inbox.AddRange(await _demandSource.BuildItemsAsync(limit, cursor, cancellationToken));
        }

        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(targetType, PurchaseRequestTargetType) &&
            permissions.Contains(AuthorizationPolicies.PurchaseRequestApprove))
        {
            inbox.AddRange(await BuildPurchaseRequestItemsAsync(limit, cursor, cancellationToken));
        }

        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(targetType, PurchasePriceExceptionTargetType) &&
            permissions.Contains(AuthorizationPolicies.PurchasePriceExceptionApprove))
        {
            inbox.AddRange(await BuildPriceAlertItemsAsync(limit, cursor, cancellationToken));
        }

        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(targetType, InventoryIssueTargetType) &&
            permissions.Contains(AuthorizationPolicies.InventoryIssueApprove))
        {
            inbox.AddRange(await BuildInventoryIssueItemsAsync(limit, cursor, cancellationToken));
        }

        if (ApprovalInboxQueryPolicy.ShouldBuildTarget(targetType, OrderAdjustmentTargetType) &&
            permissions.Contains(AuthorizationPolicies.InventoryAdjustmentApprove))
        {
            inbox.AddRange(await _adjustmentSource.BuildItemsAsync(limit, cursor, cancellationToken));
        }

        return inbox;
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
            .Include(item => item.Purchaserequestlines)
                .ThenInclude(line => line.SupplierDecisions)
                    .ThenInclude(decision => decision.Purchasepriceexceptions)
            .Where(item =>
                item.Status == "SENTTOSUPPLIER" &&
                !_context.Approvalhistories.Any(history =>
                    history.TargetType == PurchaseRequestTargetType &&
                    history.TargetId == item.PurchaseRequestId &&
                    (history.Decision == "APPROVE" || history.Decision == "REJECT")));
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
        var slaTargets = new List<ApprovalInboxSlaTarget>();
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
                    .Select(ApprovalInboxPurchaseMapper.MapMaterial)
                    .ToList()
            };
            var baseDocDate = new DateTime(request.RequestDate.Year, request.RequestDate.Month, request.RequestDate.Day, 0, 0, 0, DateTimeKind.Utc);
            // Giá trị đơn tính từ lines đã Include — không cần SumAsync riêng theo từng request.
            var amount = request.Purchaserequestlines.Sum(line => line.PurchaseQty * line.EstimatedUnitPrice);
            slaTargets.Add(new ApprovalInboxSlaTarget(itemDto, request.PurchaseRequestId, baseDocDate, amount));
            result.Add(itemDto);
        }

        await _slaEnricher.PopulateAsync(PurchaseRequestTargetType, slaTargets, cancellationToken);
        return result;
    }

    private async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildPriceAlertItemsAsync(
        int limit,
        ApprovalInboxCursor? cursor,
        CancellationToken cancellationToken)
    {
        var exceptionQuery = _context.Purchasepriceexceptions
            .AsNoTracking()
            .Include(item => item.PurchaseLineSupplierDecision)
                .ThenInclude(decision => decision.Supplier)
            .Include(item => item.PurchaseLineSupplierDecision)
                .ThenInclude(decision => decision.PurchaseRequestLine)
                    .ThenInclude(line => line.PurchaseRequest)
                        .ThenInclude(request => request.CreatedByNavigation)
            .Include(item => item.PurchaseLineSupplierDecision)
                .ThenInclude(decision => decision.PurchaseRequestLine)
                    .ThenInclude(line => line.Ingredient)
            .Include(item => item.PurchaseLineSupplierDecision)
                .ThenInclude(decision => decision.PurchaseRequestLine)
                    .ThenInclude(line => line.Unit)
            .AsQueryable();
        var isInMemoryProvider = string.Equals(
            _context.Database.ProviderName,
            "Microsoft.EntityFrameworkCore.InMemory",
            StringComparison.Ordinal);
        if (!isInMemoryProvider)
        {
            exceptionQuery = exceptionQuery.Where(item =>
                item.Status == "PENDING" &&
                item.PurchaseLineSupplierDecision.Status == "CURRENT" &&
                item.ProposalFingerprint == item.PurchaseLineSupplierDecision.DecisionFingerprint &&
                item.ProposalVersion == item.PurchaseLineSupplierDecision.Version);
            if (cursor is not null)
            {
                exceptionQuery = exceptionQuery.Where(item =>
                    item.PurchaseLineSupplierDecision.PurchaseRequestLine.PurchaseRequest.PurchaseForDate >= cursor.DueDate);
            }
        }

        var queriedExceptions = await exceptionQuery
            .Take(Math.Min(limit * 4 + 1, 200))
            .ToListAsync(cancellationToken);
        var exceptions = (isInMemoryProvider
                ? _context.ChangeTracker.Entries<PurchasePriceException>()
                    .Select(entry => entry.Entity)
                    .Concat(queriedExceptions)
                    .DistinctBy(item => Convert.ToBase64String(item.PurchasePriceExceptionId))
                : queriedExceptions)
            .Where(item =>
                item.Status == "PENDING" &&
                item.PurchaseLineSupplierDecision.Status == "CURRENT" &&
                string.Equals(
                    item.ProposalFingerprint,
                    item.PurchaseLineSupplierDecision.DecisionFingerprint,
                    StringComparison.Ordinal) &&
                item.ProposalVersion == item.PurchaseLineSupplierDecision.Version &&
                (cursor is null ||
                    item.PurchaseLineSupplierDecision.PurchaseRequestLine.PurchaseRequest.PurchaseForDate >= cursor.DueDate))
            .OrderBy(item => item.PurchaseLineSupplierDecision.PurchaseRequestLine.PurchaseRequest.PurchaseForDate)
            .ThenBy(item => item.PurchaseLineSupplierDecision.PurchaseRequestLine.PurchaseRequest.PurchaseRequestCode)
            .ThenBy(item => item.ProposalVersion)
            .ToList();
        var result = new List<ApprovalInboxItemDto>(exceptions.Count);
        var slaTargets = new List<ApprovalInboxSlaTarget>();
        foreach (var priceException in exceptions)
        {
            var decision = priceException.PurchaseLineSupplierDecision;
            var line = decision.PurchaseRequestLine;
            var request = line.PurchaseRequest;
            var targetId = GuidHelper.ToGuidString(priceException.PurchasePriceExceptionId);
            var itemDto = new ApprovalInboxItemDto
            {
                InboxItemId = $"price-exception-{targetId}",
                TargetType = PurchasePriceExceptionTargetType,
                TargetId = targetId,
                TargetCode = $"{request.PurchaseRequestCode}-{line.Ingredient.IngredientCode}-V{priceException.ProposalVersion}",
                ItemType = "price-exception",
                Title = "Duyệt ngoại lệ giá mua",
                Source = request.PurchaseRequestCode,
                OwnerRole = "Quản lý",
                SubmittedBy = request.CreatedByNavigation.FullName,
                DueDate = request.PurchaseForDate,
                Status = priceException.Status,
                Reason = priceException.Reason,
                NextAction = "Duyệt hoặc từ chối ngoại lệ giá",
                Tone = "danger",
                Route = $"/approvals?targetType={PurchasePriceExceptionTargetType}&targetId={targetId}",
                ReferencePrice = priceException.ReferencePrice,
                ProposedPrice = priceException.ProposedPrice,
                VariancePercent = priceException.VariancePercent,
                EvidenceType = priceException.EvidenceType,
                EvidenceId = GuidHelper.ToGuidString(priceException.EvidenceId),
                EvidenceDate = priceException.EvidenceDate,
                ProposalFingerprint = priceException.ProposalFingerprint,
                ProposalVersion = priceException.ProposalVersion,
                SupplierName = decision.Supplier.SupplierName,
                Materials =
                [
                    new ApprovalInboxMaterialDto
                    {
                        Name = line.Ingredient.IngredientName,
                        Quantity = DecimalPolicy.RoundQuantity(line.PurchaseQty),
                        Unit = line.Unit.UnitName
                    }
                ]
            };
            var baseDocDate = new DateTime(
                request.RequestDate.Year,
                request.RequestDate.Month,
                request.RequestDate.Day,
                0,
                0,
                0,
                DateTimeKind.Utc);
            if (cursor is null || IsAfterCursor(itemDto, cursor))
            {
                slaTargets.Add(new ApprovalInboxSlaTarget(itemDto, priceException.PurchasePriceExceptionId, baseDocDate));
                result.Add(itemDto);
            }
        }

        await _slaEnricher.PopulateAsync(PurchasePriceExceptionTargetType, slaTargets, cancellationToken);
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
                    history.TargetId == item.IssueId &&
                    (history.Decision == "APPROVE" || history.Decision == "REJECT")));
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
        var slaTargets = new List<ApprovalInboxSlaTarget>();
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
            slaTargets.Add(new ApprovalInboxSlaTarget(itemDto, item.IssueId, item.CreatedAt));
            resultList.Add(itemDto);
        }
        await _slaEnricher.PopulateAsync(InventoryIssueTargetType, slaTargets, cancellationToken);
        return resultList;
    }

    private Task<bool> HasPriceWarningAsync(PurchaseRequest request, CancellationToken cancellationToken)
        => Task.FromResult(request.Purchaserequestlines.Any(line => HasUnapprovedPriceException(line)));

    private Task<bool> IsPriceWarningAsync(PurchaseRequestLine line, CancellationToken cancellationToken)
        => Task.FromResult(HasUnapprovedPriceException(line));

    private static bool HasUnapprovedPriceException(PurchaseRequestLine line)
    {
        var currentDecision = line.SupplierDecisions.SingleOrDefault(decision =>
            string.Equals(decision.Status, "CURRENT", StringComparison.Ordinal));
        if (currentDecision is null)
        {
            return true;
        }

        var variance = PurchasePricePolicy.CalculateVariancePercent(
            currentDecision.EvidenceReferencePrice,
            currentDecision.ProposedUnitPrice);
        return PurchasePricePolicy.RequiresException(variance) &&
               !currentDecision.Purchasepriceexceptions.Any(priceException =>
                   string.Equals(priceException.ProposalFingerprint, currentDecision.DecisionFingerprint, StringComparison.Ordinal) &&
                   priceException.ProposalVersion == currentDecision.Version &&
                   string.Equals(priceException.Status, "APPROVED", StringComparison.Ordinal));
    }

}
