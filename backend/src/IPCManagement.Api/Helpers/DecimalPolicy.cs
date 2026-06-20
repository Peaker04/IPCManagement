namespace IPCManagement.Api.Helpers;

public static class DecimalPolicy
{
    public const int QuantityScale = 6;
    public const int MoneyScale = 2;
    public const int PercentScale = 2;

    private const decimal QuantityTolerance = 0.000001m;

    public static decimal RoundQuantity(decimal value)
        => NormalizeNearZero(Math.Round(value, QuantityScale, MidpointRounding.AwayFromZero));

    public static decimal RoundMoney(decimal value)
        => Math.Round(value, MoneyScale, MidpointRounding.AwayFromZero);

    public static decimal RoundPercent(decimal value)
        => Math.Round(value, PercentScale, MidpointRounding.AwayFromZero);

    public static decimal CalculateLineAmount(decimal quantity, decimal unitPrice)
        => RoundMoney(RoundQuantity(quantity) * RoundMoney(unitPrice));

    public static bool GreaterThanQuantity(decimal left, decimal right)
        => RoundQuantity(left - right) > 0;

    public static bool LessThanQuantity(decimal left, decimal right)
        => RoundQuantity(left - right) < 0;

    private static decimal NormalizeNearZero(decimal value)
        => Math.Abs(value) < QuantityTolerance ? 0 : value;
}
