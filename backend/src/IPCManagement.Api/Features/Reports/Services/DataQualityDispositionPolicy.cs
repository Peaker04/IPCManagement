using System.Text.Json;

namespace IPCManagement.Api.Features.Reports.Services;

internal static class DataQualityDispositionPolicy
{
    internal static readonly string[] IssueTypes =
    [
        "STOCK_MOVEMENT_BALANCE", "MENU_WEEK_MISMATCH", "UNIT_NORMALIZATION",
        "QUOTATION_GAP", "BOM_GAP", "DUPLICATE_INGREDIENT"
    ];

    internal static string NormalizeIssueType(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return normalized is not null && IssueTypes.Contains(normalized)
            ? normalized
            : throw new ArgumentException("IssueType data-quality không hợp lệ.");
    }

    internal static string NormalizeFingerprint(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return normalized is { Length: 64 } && normalized.All(Uri.IsHexDigit)
            ? normalized
            : throw new ArgumentException("SourceFingerprint phải là SHA-256 hex 64 ký tự.");
    }

    internal static string RequireJson(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new ArgumentException("EvidenceJson không được để trống.");
        using var document = JsonDocument.Parse(value);
        if (document.RootElement.ValueKind != JsonValueKind.Object)
            throw new ArgumentException("EvidenceJson phải là JSON object.");
        return value.Trim();
    }

    internal static string RequireText(string? value, int maxLength, string message)
        => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= maxLength
            ? value.Trim()
            : throw new ArgumentException(message);
}
