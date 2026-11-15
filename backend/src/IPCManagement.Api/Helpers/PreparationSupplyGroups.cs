namespace IPCManagement.Api.Helpers;

public static class PreparationSupplyGroups
{
    public const string Unclassified = "UNCLASSIFIED";
    public static readonly IReadOnlyDictionary<string, string> Labels = new Dictionary<string, string>(StringComparer.Ordinal)
    {
        ["PRODUCE"] = "Rau củ quả", ["FRESH_MEAT"] = "Thịt tươi",
        ["FRESH_SEAFOOD"] = "Thủy hải sản", ["FROZEN"] = "Đông lạnh",
        ["SEASONING"] = "Gia vị", ["RICE"] = "Gạo", ["NOODLES"] = "Bún, mỳ & phở",
        ["EGGS"] = "Trứng", ["DAIRY"] = "Sữa & chế phẩm", ["BAKERY"] = "Bánh",
        ["BEVERAGES"] = "Nước giải khát", ["PACKAGING"] = "Bao bì", ["ICE"] = "Nước đá",
        ["OTHER"] = "Khác", [Unclassified] = "Chưa phân nhóm"
    };
}
