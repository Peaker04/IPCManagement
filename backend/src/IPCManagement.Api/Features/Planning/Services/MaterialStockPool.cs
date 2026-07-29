using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Planning.Services;

internal static class MaterialStockPool
{
    public static void ConsumeInBomUnit(
        IReadOnlyList<CurrentStock> stocks,
        Unit bomUnit,
        decimal quantityToConsume)
    {
        var remaining = DecimalPolicy.RoundQuantity(quantityToConsume);
        foreach (var stock in stocks)
        {
            if (remaining <= 0 ||
                !TryConvertQuantity(stock.CurrentQty, stock.Unit, bomUnit, out var availableInBomUnit))
            {
                continue;
            }

            var consumedInBomUnit = Math.Min(remaining, availableInBomUnit);
            if (!TryConvertQuantity(consumedInBomUnit, bomUnit, stock.Unit, out var consumedInStockUnit))
            {
                continue;
            }

            stock.CurrentQty = DecimalPolicy.RoundQuantity(Math.Max(0, stock.CurrentQty - consumedInStockUnit));
            remaining = DecimalPolicy.RoundQuantity(Math.Max(0, remaining - consumedInBomUnit));
        }
    }

    public static bool TryConvertQuantity(decimal quantity, Unit sourceUnit, Unit targetUnit, out decimal convertedQty)
    {
        if (sourceUnit.UnitId.SequenceEqual(targetUnit.UnitId))
        {
            convertedQty = quantity;
            return true;
        }

        if (!CanConvertUnits(sourceUnit, targetUnit))
        {
            convertedQty = 0m;
            return false;
        }

        convertedQty = DecimalPolicy.RoundQuantity(quantity * sourceUnit.ConvertRateToBase / targetUnit.ConvertRateToBase);
        return true;
    }

    private static bool CanConvertUnits(Unit sourceUnit, Unit targetUnit)
        => sourceUnit.ConvertRateToBase > 0 &&
           targetUnit.ConvertRateToBase > 0 &&
           string.Equals(NormalizedBaseUnitCode(sourceUnit), NormalizedBaseUnitCode(targetUnit), StringComparison.OrdinalIgnoreCase);

    private static string NormalizedBaseUnitCode(Unit unit)
        => string.IsNullOrWhiteSpace(unit.BaseUnitCode)
            ? unit.UnitCode.Trim().ToUpperInvariant()
            : unit.BaseUnitCode.Trim().ToUpperInvariant();
}
