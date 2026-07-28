using IPCManagement.Api.Models.Entities;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.Purchasing.Services;

internal static class PurchaseRequestGenerationPolicy
{
    private static readonly HashSet<string> ApprovedDemandStatuses =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "MANAGERAPPROVED",
            "APPROVED"
        };

    internal static void ValidateApprovedFullDayDemand(MaterialRequest materialRequest)
    {
        if (!ApprovedDemandStatuses.Contains(materialRequest.Status))
        {
            throw new BusinessRuleException("Cần duyệt nhu cầu nguyên liệu trước khi tạo đề xuất mua.");
        }

        if (!string.Equals(materialRequest.RequestScope, "FULLDAY", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("Đề xuất mua chỉ được tạo cho nhu cầu Cả ngày (FULLDAY).");
        }
    }

    internal static string BuildRequestCode(MaterialRequest materialRequest)
    {
        var shiftSegment = materialRequest.RequestScope == "FULLDAY"
            ? "FULLDAY"
            : materialRequest.RequestScope;
        return $"PR-{materialRequest.RequestDate:yyyyMMdd}-{shiftSegment}";
    }

    internal static bool BelongsToCurrentDemand(
        PurchaseRequest existing,
        MaterialRequest materialRequest)
    {
        if (existing.PurchaseForDate != materialRequest.RequestDate || existing.ShiftName is not null)
        {
            return false;
        }

        if (existing.Purchaserequestlines.Count == 0)
        {
            return true;
        }

        var currentDemandLineIds = materialRequest.Materialrequestlines
            .Select(line => Convert.ToBase64String(line.RequestLineId))
            .ToHashSet(StringComparer.Ordinal);
        return existing.Purchaserequestlines.All(line =>
            currentDemandLineIds.Contains(Convert.ToBase64String(line.MaterialRequestLineId)));
    }
}
