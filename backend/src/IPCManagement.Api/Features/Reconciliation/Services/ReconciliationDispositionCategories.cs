using System.Collections.Frozen;
using IPCManagement.Api.Features.Reconciliation.Contracts;

namespace IPCManagement.Api.Features.Reconciliation.Services;

public static class ReconciliationDispositionCategories
{
    public const string AcceptedVariance = "ACCEPTED_VARIANCE";
    public const string CorrectionRequired = "CORRECTION_REQUIRED";
    public const string FollowUpRequired = "FOLLOW_UP_REQUIRED";

    public static readonly IReadOnlyList<ReconciliationDispositionCategoryDto> Options =
    [
        new(AcceptedVariance, "Chấp nhận chênh lệch"),
        new(CorrectionRequired, "Cần điều chỉnh số liệu"),
        new(FollowUpRequired, "Cần theo dõi thêm")
    ];

    private static readonly FrozenSet<string> AllowedTokens = Options
        .Select(option => option.Value)
        .ToFrozenSet(StringComparer.Ordinal);

    public static string RequireValid(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        if (normalized is null || !AllowedTokens.Contains(normalized))
            throw new ArgumentException("Hướng xử lý không hợp lệ.");
        return normalized;
    }
}
