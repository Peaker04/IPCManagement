using System.Linq.Expressions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed class ApprovalInboxDemandSource
{
    private const string MaterialDemandTargetType = "material-demand";

    private readonly IpcManagementContext _context;
    private readonly ApprovalInboxSlaEnricher _slaEnricher;

    public ApprovalInboxDemandSource(
        IpcManagementContext context,
        ApprovalInboxSlaEnricher slaEnricher)
    {
        _context = context;
        _slaEnricher = slaEnricher;
    }

    private bool IsInMemoryProvider => string.Equals(
        _context.Database.ProviderName,
        "Microsoft.EntityFrameworkCore.InMemory",
        StringComparison.Ordinal);

    public async Task<IReadOnlyList<ApprovalInboxItemDto>> BuildItemsAsync(
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
        var slaTargets = new List<ApprovalInboxSlaTarget>();
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
            slaTargets.Add(new ApprovalInboxSlaTarget(itemDto, request.RequestId, plan.CreatedAt));
            result.Add(itemDto);
        }

        await _slaEnricher.PopulateAsync(MaterialDemandTargetType, slaTargets, cancellationToken);
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
}
