using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Shared.Contracts;

namespace IPCManagement.Api.Features.Reports.Services;

internal static class ReportCursorPageBuilder
{
    public static CursorPageDto<T> Build<T>(
        IReadOnlyList<T> rows,
        int limit,
        Func<T, DateTime> getCursorDate,
        Func<T, string> getCursorId,
        WorkflowReportQueryDto query)
    {
        var items = rows.Take(limit).ToList();
        var hasNext = rows.Count > limit;
        var cursorItem = hasNext ? items.LastOrDefault() : default;
        var nextCursorOffset = 0;
        if (cursorItem is not null)
        {
            var boundaryDate = getCursorDate(cursorItem);
            nextCursorOffset = items.Count(item => getCursorDate(item) == boundaryDate);
            if (ParseCursorDateTime(query.CursorDate) == boundaryDate)
            {
                nextCursorOffset += query.CursorOffset ?? 0;
            }
        }

        return new CursorPageDto<T>
        {
            Items = items,
            Limit = limit,
            HasNext = hasNext,
            NextCursorDate = cursorItem is null ? null : getCursorDate(cursorItem).ToString("O"),
            NextCursorId = cursorItem is null ? null : getCursorId(cursorItem),
            NextCursorOffset = nextCursorOffset
        };
    }

    private static DateTime? ParseCursorDateTime(string? value)
        => DateTime.TryParse(value, out var dateTime)
            ? dateTime
            : DateOnly.TryParse(value, out var date)
                ? date.ToDateTime(TimeOnly.MinValue)
                : null;
}
