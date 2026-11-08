using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Approvals.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed record ApprovalInboxSlaTarget(
    ApprovalInboxItemDto Item,
    byte[] TargetId,
    DateTime? DocCreationTime,
    decimal? Amount = null);

internal sealed class ApprovalInboxSlaEnricher
{
    private readonly IpcManagementContext _context;
    private readonly IApprovalRoutingService _routingService;

    public ApprovalInboxSlaEnricher(
        IpcManagementContext context,
        IApprovalRoutingService routingService)
    {
        _context = context;
        _routingService = routingService;
    }

    private bool IsInMemoryProvider => string.Equals(
        _context.Database.ProviderName,
        "Microsoft.EntityFrameworkCore.InMemory",
        StringComparison.Ordinal);

    // SLA được tính theo LÔ cho cả trang inbox: một truy vấn rule cho mỗi loại chứng từ
    // và một truy vấn submit-time cho toàn bộ target, thay vì 2-3 truy vấn mỗi chứng từ.
    public async Task PopulateAsync(
        string targetType,
        IReadOnlyList<ApprovalInboxSlaTarget> targets,
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
            .Where(history => history.TargetType == targetType &&
                (history.Decision == "SUBMIT" || history.Decision == "Submit"));

        if (IsInMemoryProvider)
        {
            // InMemory không so sánh byte[] theo giá trị trong Contains — lọc phía client.
            var wanted = targetIds.Select(Convert.ToBase64String).ToHashSet(StringComparer.Ordinal);
            var allRows = await query
                .Select(history => new { history.TargetId, history.ActionAt })
                .ToListAsync(cancellationToken);
            return allRows
                .Where(row => wanted.Contains(Convert.ToBase64String(row.TargetId)))
                .GroupBy(row => Convert.ToBase64String(row.TargetId), StringComparer.Ordinal)
                .ToDictionary(group => group.Key, group => group.Min(row => row.ActionAt), StringComparer.Ordinal);
        }

        var ids = targetIds.ToList();
        var rows = await query
            .Where(history => ids.Contains(history.TargetId))
            .Select(history => new { history.TargetId, history.ActionAt })
            .ToListAsync(cancellationToken);
        return rows
            .GroupBy(row => Convert.ToBase64String(row.TargetId), StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Min(row => row.ActionAt), StringComparer.Ordinal);
    }
}
