using System.Globalization;
using IPCManagement.Api.Features.Approvals.Contracts;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class ApprovalInboxQueryPolicy
{
    public static bool ShouldBuildTarget(string? requestedTargetType, string targetType)
        => string.IsNullOrWhiteSpace(requestedTargetType) ||
           string.Equals(requestedTargetType.Trim(), targetType, StringComparison.OrdinalIgnoreCase);

    public static IEnumerable<ApprovalInboxItemDto> Apply(
        IEnumerable<ApprovalInboxItemDto> items,
        ApprovalInboxQueryDto query)
    {
        var serviceDate = ParseOptionalDate(query.Date, nameof(query.Date));
        var weekStart = ParseOptionalDate(query.Week, nameof(query.Week));
        if (weekStart?.DayOfWeek is not null and not DayOfWeek.Monday)
        {
            throw new ArgumentException("Tuần duyệt phải bắt đầu vào thứ Hai.", nameof(query.Week));
        }

        var weekEnd = weekStart?.AddDays(6);
        var searchKeyword = query.SearchKeyword?.Trim();
        return items.Where(item =>
            (string.IsNullOrWhiteSpace(query.TargetType) ||
             string.Equals(item.TargetType, query.TargetType.Trim(), StringComparison.OrdinalIgnoreCase)) &&
            (string.IsNullOrWhiteSpace(query.TargetId) ||
             string.Equals(item.TargetId, query.TargetId.Trim(), StringComparison.OrdinalIgnoreCase)) &&
            (serviceDate is null || item.ServiceDate == serviceDate || item.DueDate == serviceDate) &&
            (weekStart is null || IsWithinWeek(item, weekStart.Value, weekEnd!.Value)) &&
            (string.IsNullOrWhiteSpace(searchKeyword) || MatchesSearch(item, searchKeyword)));
    }

    private static DateOnly? ParseOptionalDate(string? value, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var parsed))
        {
            throw new ArgumentException("Ngày phải có định dạng yyyy-MM-dd.", parameterName);
        }

        return parsed;
    }

    private static bool IsWithinWeek(ApprovalInboxItemDto item, DateOnly weekStart, DateOnly weekEnd)
        => item.WeekStartDate == weekStart ||
           item.ServiceDate is not null && item.ServiceDate >= weekStart && item.ServiceDate <= weekEnd ||
           item.DueDate is not null && item.DueDate >= weekStart && item.DueDate <= weekEnd;

    private static bool MatchesSearch(ApprovalInboxItemDto item, string keyword)
        => Contains(item.TargetCode, keyword) ||
           Contains(item.Title, keyword) ||
           Contains(item.Source, keyword) ||
           Contains(item.SubmittedBy, keyword) ||
           Contains(item.SupplierName, keyword) ||
           Contains(item.SourceDocumentCode, keyword) ||
           item.Materials.Any(material => Contains(material.Name, keyword));

    private static bool Contains(string? value, string keyword)
        => value?.Contains(keyword, StringComparison.OrdinalIgnoreCase) == true;
}
