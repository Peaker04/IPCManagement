using System.Globalization;

namespace IPCManagement.Api.Helpers;

internal static class TemplateFileNames
{
    private static string Part(string value) => new(value.Trim().Select(character =>
        char.IsLetterOrDigit(character) || character is '-' or '_' ? character : '_').ToArray());

    public static string WeeklyMenu(string customerCode, DateOnly weekStart) =>
        $"IPC_MauThucDon_{Part(customerCode)}_{weekStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)}.xlsx";

    public static string Bom(string? customerCode, decimal priceTier, string scope) =>
        $"IPC_MauDinhLuong_{Part(customerCode ?? "Chung")}_{priceTier.ToString("0", CultureInfo.InvariantCulture)}_{Part(scope)}.xlsx";
}
