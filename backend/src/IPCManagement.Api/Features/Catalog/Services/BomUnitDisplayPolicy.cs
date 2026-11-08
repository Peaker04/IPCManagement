using System.Globalization;
using IPCManagement.Api.Models.Entities;

namespace IPCManagement.Api.Features.Catalog.Services;

internal static class BomUnitDisplayPolicy
{
    private static readonly IReadOnlyDictionary<string, string> VietnameseNames =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["KG"] = "Kilôgam",
            ["KILOGRAM"] = "Kilôgam",
            ["G"] = "Gam",
            ["GRAM"] = "Gam",
            ["L"] = "Lít",
            ["LITER"] = "Lít",
            ["LITRE"] = "Lít",
            ["ML"] = "Mililít",
            ["MILLILITER"] = "Mililít",
            ["MILLILITRE"] = "Mililít",
            ["BO"] = "Bó",
            ["BO_BUNCH"] = "Bó",
            ["BO_SET"] = "Bộ",
            ["HOP"] = "Hộp",
            ["HU"] = "Hũ",
            ["CAI"] = "Cái",
            ["CHAI"] = "Chai",
            ["CON"] = "Con",
            ["GOI"] = "Gói",
            ["QUA"] = "Quả",
            ["LAT"] = "Lát",
            ["BICH"] = "Bịch",
            ["BINH"] = "Bình",
            ["CAN"] = "Can",
            ["CAP"] = "Cặp",
            ["CAY"] = "Cây",
            ["CHIEC"] = "Chiếc",
            ["CUC"] = "Cục",
            ["DOI"] = "Đôi",
            ["LOC"] = "Lốc",
            ["CANH"] = "Cành",
            ["DONVI"] = "Đơn vị",
            ["K"] = "Khay (K)",
            ["KH"] = "Khay (KH)",
            ["VIT"] = "Vít"
        };

    public static string Format(Unit unit) => Format(unit.UnitCode, unit.UnitName);

    public static string Format(string unitCode, string unitName)
    {
        var code = unitCode.Trim();
        var name = unitName.Trim();
        if (VietnameseNames.TryGetValue(code, out var byCode))
        {
            return byCode;
        }

        if (VietnameseNames.TryGetValue(name, out var byName))
        {
            return byName;
        }

        return CultureInfo.GetCultureInfo("vi-VN").TextInfo.ToTitleCase(name.ToLowerInvariant());
    }
}
