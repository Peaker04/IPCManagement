using System.Globalization;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Catalog.Services;

public static class DishBomPolicy
{
    public const string Draft = "DRAFT";
    public const string Published = "PUBLISHED";
    public const string Archived = "ARCHIVED";

    public static readonly decimal[] SupportedPriceTiers = [25000m, 30000m, 34000m];

    public static decimal NormalizePriceTier(decimal tier)
    {
        var normalized = decimal.Round(tier, 0);
        return normalized switch
        {
            25000m or 30000m or 34000m => normalized,
            _ => throw new ArgumentException("Đơn giá BOM chỉ được là 25000, 30000 hoặc 34000.")
        };
    }

    public static bool TryNormalizeImportPriceTier(string value, out decimal normalized)
    {
        normalized = default;
        if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
        {
            return false;
        }

        try
        {
            normalized = NormalizePriceTier(parsed);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    public static string NormalizeStatus(string? status, string fallback = Published)
    {
        var value = string.IsNullOrWhiteSpace(status) ? fallback : status.Trim().ToUpperInvariant();
        return value switch
        {
            Draft => Draft,
            Published => Published,
            Archived => Archived,
            _ => throw new ArgumentException("Trạng thái BOM không hợp lệ.")
        };
    }

    public static bool IsPublished(DishBom bom) => NormalizeStatus(bom.BomStatus) == Published;

    public static string MapStatusLabel(string? status) => NormalizeStatus(status) switch
    {
        Draft => "Draft",
        Published => "Published",
        Archived => "Archived",
        _ => "Published"
    };

    public static bool MatchesCustomerScope(byte[]? left, byte[]? right)
        => left is null ? right is null : right is not null && left.SequenceEqual(right);

    public static bool DateRangesOverlap(DateOnly leftFrom, DateOnly? leftTo, DateOnly rightFrom, DateOnly? rightTo)
        => leftFrom <= (rightTo ?? DateOnly.MaxValue) && rightFrom <= (leftTo ?? DateOnly.MaxValue);

    public static string NormalizeTemplateType(string? templateType, bool hasDishFilter)
    {
        var normalized = string.IsNullOrWhiteSpace(templateType)
            ? (hasDishFilter ? "dish" : "missing")
            : templateType.Trim().ToLowerInvariant();
        return normalized switch
        {
            "missing" or "blank" or "all" or "dish" => normalized,
            _ => "missing"
        };
    }

    public static byte[]? ParseOptionalCustomerId(string? customerId)
        => string.IsNullOrWhiteSpace(customerId)
            ? null
            : GuidHelper.ParseGuidString(customerId) ?? throw new ArgumentException("Khách hàng không hợp lệ.");

    public static byte[]? ParseOptionalDishId(string? dishId)
        => string.IsNullOrWhiteSpace(dishId)
            ? null
            : GuidHelper.ParseGuidString(dishId) ?? throw new ArgumentException("Món ăn không hợp lệ.");
}
