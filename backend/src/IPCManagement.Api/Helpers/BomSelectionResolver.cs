using IPCManagement.Api.Exceptions;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Helpers;

public static class BomSelectionResolver
{
    public static IReadOnlyList<DishBom> Resolve(
        IEnumerable<DishBom> lines,
        byte[] customerId,
        decimal menuPrice,
        DateOnly serviceDate)
    {
        var priceTier = NormalizePriceTier(menuPrice);
        var effectiveLines = lines
            .Where(bom => bom.BomStatus == "PUBLISHED")
            .Where(bom => bom.EffectiveFrom <= serviceDate && (bom.EffectiveTo is null || bom.EffectiveTo >= serviceDate))
            .Where(bom => bom.PriceTierAmount == priceTier)
            .ToList();
        var customerLines = effectiveLines
            .Where(bom => bom.CustomerId is not null && bom.CustomerId.AsSpan().SequenceEqual(customerId))
            .ToList();

        return customerLines.Count > 0
            ? customerLines
            : effectiveLines.Where(bom => bom.CustomerId is null).ToList();
    }

    public static decimal NormalizePriceTier(decimal menuPrice)
    {
        var normalized = decimal.Round(menuPrice, 0);
        return normalized switch
        {
            25000m or 30000m or 34000m => normalized,
            _ => throw new BusinessRuleException($"Đơn giá thực đơn {menuPrice:0.##} không thuộc tier BOM 25000/30000/34000.")
        };
    }
}
