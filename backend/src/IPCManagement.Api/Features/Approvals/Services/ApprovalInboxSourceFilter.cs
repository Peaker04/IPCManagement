using System.Globalization;
using System.Linq.Expressions;
using IPCManagement.Api.Features.Approvals.Contracts;

namespace IPCManagement.Api.Features.Approvals.Services;

internal static class ApprovalInboxSourceFilter
{
    public static IQueryable<T> ByIdentity<T>(IQueryable<T> source, Expression<Func<T, byte[]>> key, ApprovalInboxQueryDto? query)
    {
        if (string.IsNullOrWhiteSpace(query?.TargetId)) return source;
        var id = Helpers.GuidHelper.ParseGuidString(query.TargetId) ?? throw new ArgumentException("Mã hồ sơ không hợp lệ.");
        Expression<Func<byte[], bool>> match = stored => stored.SequenceEqual(id);
        var equals = new ReplaceParameter(match.Parameters[0], key.Body).Visit(match.Body)!;
        return source.Where(Expression.Lambda<Func<T, bool>>(equals, key.Parameters));
    }

    public static IQueryable<T> ByDate<T>(IQueryable<T> source, Expression<Func<T, DateOnly>> date, ApprovalInboxQueryDto? query)
    {
        if (query is null) return source;
        if (!string.IsNullOrWhiteSpace(query.Date))
        {
            var exact = ReadDate(query.Date, nameof(query.Date));
            source = source.Where(Expression.Lambda<Func<T, bool>>(Expression.Equal(date.Body, Expression.Constant(exact)), date.Parameters));
        }
        if (!string.IsNullOrWhiteSpace(query.Week))
        {
            var from = ReadDate(query.Week, nameof(query.Week));
            if (from.DayOfWeek != DayOfWeek.Monday) throw new ArgumentException("Tuần duyệt phải bắt đầu vào thứ Hai.", nameof(query.Week));
            var range = Expression.AndAlso(Expression.GreaterThanOrEqual(date.Body, Expression.Constant(from)),
                Expression.LessThanOrEqual(date.Body, Expression.Constant(from.AddDays(6))));
            source = source.Where(Expression.Lambda<Func<T, bool>>(range, date.Parameters));
        }
        return source;
    }

    private static DateOnly ReadDate(string value, string parameter) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date : throw new ArgumentException("Ngày phải có định dạng yyyy-MM-dd.", parameter);

    private sealed class ReplaceParameter(ParameterExpression parameter, Expression replacement) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == parameter ? replacement : base.VisitParameter(node);
    }
}
