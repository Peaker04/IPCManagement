using System.Linq.Expressions;
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

    private sealed record ApprovalInboxCursor(DateOnly DueDate, string TargetCode, string InboxItemId);

    private readonly IpcManagementContext _context;
    private readonly IApprovalRoutingService _routingService;

    public ApprovalInboxService(IpcManagementContext context, IApprovalRoutingService routingService)
    {
        _context = context;
        _routingService = routingService;
    }

    private sealed record SlaTarget(ApprovalInboxItemDto Item, byte[] TargetId, DateTime? DocCreationTime, decimal? Amount = null);

    private bool IsInMemoryProvider => string.Equals(
        _context.Database.ProviderName,
        "Microsoft.EntityFrameworkCore.InMemory",
        StringComparison.Ordinal);

    // SLA được tính theo LÔ cho cả trang inbox: một truy vấn rule cho mỗi loại chứng từ
    // và một truy vấn submit-time cho toàn bộ target, thay vì 2-3 truy vấn mỗi chứng từ.
    private async Task PopulateSlaBatchAsync(
        string targetType,
        IReadOnlyList<SlaTarget> targets,
        CancellationToken cancellationToken)
    {
        if (targets.Count == 0)
        {
            return;
        }

        var rules = await _routingService.GetActiveRulesAsync(targetType) ?? [];
        if (rules.All(rule => !rule.SlaHours.HasValue))
        {
            return;
        }

        var submitByTarget = await LoadSubmitTimesAsync(
            targetType,
            targets.Select(target => target.TargetId).ToList(),
            cancellationToken);

        foreach (var target in targets)
        {
            var rule = ApprovalRoutingService.MatchRule(rules, target.Amount);
            if (rule?.SlaHours is null)
            {
                continue;
            }

            var baseTime = submitByTarget.TryGetValue(Convert.ToBase64String(target.TargetId), out var submitTime)
                ? submitTime
                : target.DocCreationTime ?? DateTime.UtcNow;
            target.Item.SlaHours = rule.SlaHours;
            target.Item.SlaDeadline = baseTime.AddHours(rule.SlaHours.Value);
        }
    }

    private async Task<Dictionary<string, DateTime>> LoadSubmitTimesAsync(
        string targetType,
        IReadOnlyList<byte[]> targetIds,
        CancellationToken cancellationToken)
    {
        var query = _context.Approvalhistories
            .AsNoTracking()
            .Where(h => h.TargetType == targetType && (h.Decision == "SUBMIT" || h.Decision == "Submit"));

        if (IsInMemoryProvider)
        {
            // InMemory không so sánh byte[] theo giá trị trong Contains — lọc phía client.
            var wanted = targetIds.Select(Convert.ToBase64String).ToHashSet(StringComparer.Ordinal);
            var allRows = await query
                .Select(h => new { h.TargetId, h.ActionAt })
                .ToListAsync(cancellationToken);
            return allRows
                .Where(row => wanted.Contains(Convert.ToBase64String(row.TargetId)))
                .GroupBy(row => Convert.ToBase64String(row.TargetId), StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.Min(row => row.ActionAt), StringComparer.Ordinal);
        }

        var ids = targetIds.ToList();
        var rows = await query
            .Where(h => ids.Contains(h.TargetId))
            .Select(h => new { h.TargetId, h.ActionAt })
            .ToListAsync(cancellationToken);
        return rows
            .GroupBy(row => Convert.ToBase64String(row.TargetId), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Min(row => row.ActionAt), StringComparer.Ordinal);
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
            inbox.AddRange(await BuildMaterialDemandItemsAsync(limit, cursor, cancellationToken));
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
        if (requests.Count == 0)
        {
            return [];
        }

        // Nạp trước theo LÔ: plans, users, lines và danh mục tên — 5 truy vấn cho cả trang
        // thay vì 3+ truy vấn cho mỗi request (N+1 cũ).
        var planById = (await LoadByIdsAsync(
                _context.Productionplans.AsNoTracking(),
                plan => plan.PlanId,
                requests.Select(item => item.PlanId).ToList(),
                cancellationToken))
            .GroupBy(plan => Convert.ToBase64String(plan.PlanId), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.Ordinal);
        var userNameById = (await LoadByIdsAsync(
                _context.Users.AsNoTracking(),
                user => user.UserId,
                requests.Select(item => item.CreatedBy).ToList(),
                cancellationToken))
            .GroupBy(user => Convert.ToBase64String(user.UserId), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().FullName, StringComparer.Ordinal);
        var linesByRequest = (await LoadByIdsAsync(
                _context.Materialrequestlines.AsNoTracking(),
                line => line.RequestId,
                requests.Select(item => item.RequestId).ToList(),
                cancellationToken))
            .GroupBy(line => Convert.ToBase64String(line.RequestId), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.ToList(), StringComparer.Ordinal);
        var allLines = linesByRequest.Values.SelectMany(lines => lines).ToList();
        var ingredientNames = (await LoadByIdsAsync(
                _context.Ingredients.AsNoTracking(),
                item => item.IngredientId,
                allLines.Select(line => line.IngredientId).DistinctBy(Convert.ToBase64String).ToList(),
                cancellationToken))
            .GroupBy(item => Convert.ToBase64String(item.IngredientId), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().IngredientName, StringComparer.Ordinal);
        var unitNames = (await LoadByIdsAsync(
                _context.Units.AsNoTracking(),
                item => item.UnitId,
                allLines.Select(line => line.UnitId).DistinctBy(Convert.ToBase64String).ToList(),
                cancellationToken))
            .GroupBy(item => Convert.ToBase64String(item.UnitId), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().UnitName, StringComparer.Ordinal);

        var result = new List<ApprovalInboxItemDto>();
        var slaTargets = new List<SlaTarget>();
        foreach (var request in requests)
        {
            var plan = planById[Convert.ToBase64String(request.PlanId)];
            var submittedBy = userNameById[Convert.ToBase64String(request.CreatedBy)];
            var requestLines = linesByRequest.GetValueOrDefault(Convert.ToBase64String(request.RequestId)) ?? [];

            var materials = requestLines
                .GroupBy(line => new
                {
                    IngredientId = Convert.ToBase64String(line.IngredientId),
                    UnitId = Convert.ToBase64String(line.UnitId)
                })
                .Select(group => new ApprovalInboxMaterialDto
                {
                    Name = ingredientNames[group.Key.IngredientId],
                    Quantity = DecimalPolicy.RoundQuantity(group.Sum(line => line.SuggestedPurchaseQty)),
                    Unit = unitNames[group.Key.UnitId]
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
                SourceDocumentCode = plan.PlanCode,
                Materials = materials
            };
            slaTargets.Add(new SlaTarget(itemDto, request.RequestId, plan.CreatedAt));
            result.Add(itemDto);
        }

        await PopulateSlaBatchAsync(MaterialDemandTargetType, slaTargets, cancellationToken);
        return result;
    }

    // Tải entity theo danh sách khóa nhị phân trong MỘT truy vấn. Provider quan hệ dùng
    // Contains (dịch thành IN); InMemory so sánh byte[] theo tham chiếu nên lọc phía client.
    private async Task<List<TEntity>> LoadByIdsAsync<TEntity>(
        IQueryable<TEntity> source,
        Expression<Func<TEntity, byte[]>> idSelector,
        IReadOnlyCollection<byte[]> ids,
        CancellationToken cancellationToken) where TEntity : class
    {
        if (ids.Count == 0)
        {
            return [];
        }

        if (IsInMemoryProvider)
        {
            var wanted = ids.Select(Convert.ToBase64String).ToHashSet(StringComparer.Ordinal);
            var selector = idSelector.Compile();
            return (await source.ToListAsync(cancellationToken))
                .Where(entity => wanted.Contains(Convert.ToBase64String(selector(entity))))
                .ToList();
        }

        var idList = ids.ToList();
        var containsCall = Expression.Call(
            typeof(Enumerable),
            nameof(Enumerable.Contains),
            [typeof(byte[])],
            Expression.Constant(idList),
            idSelector.Body);
        var predicate = Expression.Lambda<Func<TEntity, bool>>(containsCall, idSelector.Parameters[0]);
        return await source.Where(predicate).ToListAsync(cancellationToken);
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
        var slaTargets = new List<SlaTarget>();
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
            slaTargets.Add(new SlaTarget(itemDto, request.PurchaseRequestId, baseDocDate, amount));
            result.Add(itemDto);
        }

        await PopulateSlaBatchAsync(PurchaseRequestTargetType, slaTargets, cancellationToken);
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
        var slaTargets = new List<SlaTarget>();
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
                slaTargets.Add(new SlaTarget(itemDto, priceException.PurchasePriceExceptionId, baseDocDate));
                result.Add(itemDto);
            }
        }

        await PopulateSlaBatchAsync(PurchasePriceExceptionTargetType, slaTargets, cancellationToken);
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
        var slaTargets = new List<SlaTarget>();
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
            slaTargets.Add(new SlaTarget(itemDto, item.IssueId, item.CreatedAt));
            resultList.Add(itemDto);
        }
        await PopulateSlaBatchAsync(InventoryIssueTargetType, slaTargets, cancellationToken);
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
        var slaTargets = new List<SlaTarget>();
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
            slaTargets.Add(new SlaTarget(itemDto, item.AdjustmentId, item.AdjustedAt));
            resultList.Add(itemDto);
        }
        await PopulateSlaBatchAsync(OrderAdjustmentTargetType, slaTargets, cancellationToken);
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
