namespace IPCManagement.Api.Helpers;

public static class MenuPriceTierPolicy
{
    public static readonly decimal[] SupportedPriceTiers = [25000m, 30000m, 34000m];

    public static decimal Normalize(decimal tier)
    {
        var normalized = decimal.Round(tier, 0);
        if (!SupportedPriceTiers.Contains(normalized))
            throw new ArgumentException($"Đơn giá BOM chỉ được là {string.Join(", ", SupportedPriceTiers.SkipLast(1))} hoặc {SupportedPriceTiers[^1]}.");
        return normalized;
    }
}
