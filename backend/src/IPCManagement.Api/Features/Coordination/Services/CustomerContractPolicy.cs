namespace IPCManagement.Api.Features.Coordination.Services;

internal static class CustomerContractPolicy
{
    internal static bool DatesOverlap(
        DateOnly leftStart,
        DateOnly? leftEnd,
        DateOnly rightStart,
        DateOnly? rightEnd)
    {
        var normalizedLeftEnd = leftEnd ?? DateOnly.MaxValue;
        var normalizedRightEnd = rightEnd ?? DateOnly.MaxValue;
        return leftStart <= normalizedRightEnd && rightStart <= normalizedLeftEnd;
    }

    internal static string NormalizeCustomerCode(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? string.Empty
            : value.Trim().ToUpperInvariant();
}
