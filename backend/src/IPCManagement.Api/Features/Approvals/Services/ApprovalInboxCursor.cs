using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using IPCManagement.Api.Features.Approvals.Contracts;
using IPCManagement.Api.Features.SystemOperation.Services;

namespace IPCManagement.Api.Features.Approvals.Services;

internal sealed record ApprovalInboxCursor(DateOnly DueDate, string TargetCode, string InboxItemId, string Scope)
{
    internal static bool IsAfterCursor(ApprovalInboxItemDto item, ApprovalInboxCursor cursor)
    {
        var dueDate = item.DueDate ?? DateOnly.MaxValue;
        var dateComparison = dueDate.CompareTo(cursor.DueDate);
        if (dateComparison != 0) return dateComparison > 0;

        var codeComparison = string.Compare(item.TargetCode, cursor.TargetCode, StringComparison.Ordinal);
        if (codeComparison != 0) return codeComparison > 0;

        return string.Compare(item.InboxItemId, cursor.InboxItemId, StringComparison.Ordinal) > 0;
    }

    internal static string QueryScope(ClaimsPrincipal user, ApprovalInboxQueryDto query, long modeVersion)
    {
        var claims = user.Claims.Where(c => c.Type == ClaimTypes.NameIdentifier || c.Type == ClaimTypes.Role)
            .Select(c => $"{c.Type}:{c.Value}").Order(StringComparer.Ordinal);
        var json = JsonSerializer.Serialize(new { Mode = SystemOperationEligibility.Default, modeVersion, Claims = claims, query.TargetType, query.TargetId,
            query.Week, query.Date, query.SearchKeyword });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
    }

    internal static string EncodeCursor(ApprovalInboxItemDto item, string scope)
    {
        var cursor = new ApprovalInboxCursor(item.DueDate ?? DateOnly.MaxValue, item.TargetCode, item.InboxItemId, scope);
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(cursor)));
    }

    internal static ApprovalInboxCursor? DecodeCursor(string? value, string scope)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(value));
            var cursor = JsonSerializer.Deserialize<ApprovalInboxCursor>(json);
            if (cursor is null || cursor.Scope != scope)
                throw new ArgumentException("Phạm vi duyệt đã thay đổi. Vui lòng tải lại danh sách.");
            return cursor;
        }
        catch (FormatException)
        {
            throw new ArgumentException("Con trỏ phân trang không hợp lệ.");
        }
        catch (JsonException)
        {
            throw new ArgumentException("Con trỏ phân trang không hợp lệ.");
        }
    }
}
