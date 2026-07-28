using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.SampleData.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

using IPCManagement.Api.Exceptions;

namespace IPCManagement.Api.Features.SampleData.Services;

internal sealed class WeeklyMenuCustomerResolver(IpcManagementContext context)
{
    public async Task<Customer> ResolveAsync(string customerId, CancellationToken cancellationToken)
    {
        var customerBytes = GuidHelper.ParseGuidString(customerId)
            ?? throw new ArgumentException("Khách hàng import không hợp lệ.");
        var customer = await context.Customers.FirstOrDefaultAsync(
            item => item.CustomerId.SequenceEqual(customerBytes) && item.IsActive != false,
            cancellationToken);
        return customer ?? throw new KeyNotFoundException(
            "Không tìm thấy khách hàng đang hoạt động để import thực đơn.");
    }

    public async Task<Customer?> TryResolveAsync(string customerId, CancellationToken cancellationToken)
    {
        var customerBytes = GuidHelper.ParseGuidString(customerId);
        if (customerBytes is null)
        {
            return null;
        }

        return await context.Customers.FirstOrDefaultAsync(
            item => item.CustomerId.SequenceEqual(customerBytes) && item.IsActive != false,
            cancellationToken);
    }
}

internal sealed class WeeklyMenuAuditActorResolver(IpcManagementContext context)
{
    public async Task<byte[]> ResolveAsync(string? actorUserId, CancellationToken cancellationToken)
    {
        var requestedActorId = GuidHelper.ParseGuidString(actorUserId);
        if (requestedActorId is not null)
        {
            var exists = await context.Users
                .AsNoTracking()
                .AnyAsync(user => user.UserId.SequenceEqual(requestedActorId), cancellationToken);
            if (exists)
            {
                return requestedActorId;
            }
        }

        var actor = await context.Users
            .AsNoTracking()
            .OrderByDescending(user => user.Role != null && EF.Functions.Like(user.Role.RoleName, "%admin%"))
            .ThenBy(user => user.Username)
            .FirstOrDefaultAsync(cancellationToken);

        return actor?.UserId
            ?? throw new BusinessRuleException("Không tìm thấy user để ghi audit import thực đơn.");
    }
}

internal static class WeeklyMenuImportProjection
{
    private static readonly string[] MenuDayKeys = ["t2", "t3", "t4", "t5", "t6", "t7", "cn"];

    public static void BuildImportedWeeklyMenu(
        WeeklyMenuImportResultDto result,
        IReadOnlyList<ParsedWeeklyMenuItem> parsedItems)
    {
        foreach (var dayKey in MenuDayKeys)
        {
            result.ImportedWeeklyMenu[dayKey] = new ImportedDayMenuDto();
        }

        foreach (var item in parsedItems)
        {
            var dayMenu = result.ImportedWeeklyMenu[item.DayKey];
            var slotDto = GetImportedSlot(dayMenu, item.DbShiftName, item.VariantKey);
            if (slotDto.Portions == 0)
            {
                slotDto.Portions = DefaultImportPortions(item.DbShiftName, item.VariantKey);
            }

            if (item.Slot == "main" && !string.IsNullOrWhiteSpace(item.DishId))
            {
                slotDto.DishId = item.DishId;
            }

            ApplyImportedComponent(slotDto.CustomComponents, item.Slot, item.DishName);
        }
    }

    public static void ApplyCommittedDishIds(
        WeeklyMenuImportResultDto result,
        IReadOnlyList<ParsedWeeklyMenuItem> parsedItems)
    {
        var idsByKey = parsedItems
            .Where(item => !string.IsNullOrWhiteSpace(item.DishId))
            .GroupBy(item => $"{item.ServiceDate:yyyyMMdd}|{item.DbShiftName}|{item.VariantKey}|{item.Slot}|{NormalizeDishMatchKey(item.DishName)}")
            .ToDictionary(group => group.Key, group => group.First().DishId);

        foreach (var row in result.Rows)
        {
            var variantKey = row.Variant == "Chay" ? "vegetarian" : "savory";
            var key = $"{row.ServiceDate:yyyyMMdd}|{row.DbShiftName}|{variantKey}|{row.Slot}|{NormalizeDishMatchKey(row.DishName)}";
            if (idsByKey.TryGetValue(key, out var dishId))
            {
                row.DishId = dishId;
            }
        }

        result.ImportedWeeklyMenu.Clear();
        BuildImportedWeeklyMenu(result, parsedItems);
    }

    public static void ApplyMenuVersion(WeeklyMenuImportResultDto result, MenuVersion? version)
    {
        if (version is null)
        {
            return;
        }

        result.MenuVersionId = GuidHelper.ToGuidString(version.MenuVersionId);
        result.MenuVersionNo = version.VersionNo;
        result.MenuVersionStatus = version.Status;
        result.PublishedBy = version.PublishedBy is null ? null : GuidHelper.ToGuidString(version.PublishedBy);
        result.PublishedAt = version.PublishedAt?.ToString("O");
        result.SourceImportBatch = version.SourceImportBatch;
    }

    public static (string VariantKey, string VariantLabel, string Slot, string SlotLabel) ParsePersistedDishSlot(
        string? dishSlot)
    {
        var parts = (dishSlot ?? string.Empty).Split('-', 2, StringSplitOptions.TrimEntries);
        var variantKey = parts.Length > 0 &&
            string.Equals(parts[0], "vegetarian", StringComparison.OrdinalIgnoreCase)
                ? "vegetarian"
                : "savory";
        var slot = parts.Length > 1 && !string.IsNullOrWhiteSpace(parts[1])
            ? parts[1]
            : "main";
        var slotLabel = slot switch
        {
            "sub1" => "Phụ 1",
            "sub2" => "Phụ 2",
            "rau" => "Rau",
            "canh" => "Canh",
            "fruit" => "Trái cây",
            "dessert" => "Sữa chua",
            _ => "Món chính"
        };

        return (variantKey, variantKey == "vegetarian" ? "Chay" : "Mặn", slot, slotLabel);
    }

    public static string NormalizeDishMatchKey(string? value)
    {
        var normalized = RemoveDiacritics(value ?? string.Empty)
            .Replace('Đ', 'D')
            .Replace('đ', 'd')
            .Trim()
            .ToUpperInvariant();
        normalized = Regex.Replace(normalized, @"\b\d+\s*(G|GRAM)\b", " ", RegexOptions.IgnoreCase);
        normalized = Regex.Replace(normalized, @"\s+", " ");
        return normalized.Trim();
    }

    public static Dish SelectPreferredImportedDish(IEnumerable<Dish> dishes)
        => dishes
            .OrderByDescending(HasPublishedBom)
            .ThenBy(dish => HasPortionSuffix(dish.DishName))
            .ThenBy(dish => dish.DishName.Length)
            .First();

    public static bool HasPublishedBom(Dish dish)
        => dish.Dishboms.Any(bom =>
            string.Equals(bom.BomStatus, "PUBLISHED", StringComparison.OrdinalIgnoreCase));

    public static bool HasPortionSuffix(string? value)
        => Regex.IsMatch(value ?? string.Empty, @"\b\d+\s*(g|gram)\b", RegexOptions.IgnoreCase);

    public static string DayKey(DayOfWeek dayOfWeek)
        => dayOfWeek switch
        {
            DayOfWeek.Monday => "t2",
            DayOfWeek.Tuesday => "t3",
            DayOfWeek.Wednesday => "t4",
            DayOfWeek.Thursday => "t5",
            DayOfWeek.Friday => "t6",
            DayOfWeek.Saturday => "t7",
            DayOfWeek.Sunday => "cn",
            _ => "t2"
        };

    private static ImportedMenuSlotDto GetImportedSlot(
        ImportedDayMenuDto day,
        string dbShiftName,
        string variantKey)
        => (dbShiftName, variantKey) switch
        {
            ("MORNING", "vegetarian") => day.MorningVegetarian,
            ("AFTERNOON", "vegetarian") => day.AfternoonVegetarian,
            ("AFTERNOON", _) => day.AfternoonSavory,
            _ => day.MorningSavory
        };

    private static void ApplyImportedComponent(
        ImportedCustomComponentsDto components,
        string slot,
        string dishName)
    {
        switch (slot)
        {
            case "main": components.Main = dishName; break;
            case "sub1": components.Sub1 = dishName; break;
            case "sub2": components.Sub2 = dishName; break;
            case "rau": components.Rau = dishName; break;
            case "canh": components.Canh = dishName; break;
            case "fruit": components.Fruit = dishName; break;
            case "dessert": components.Dessert = dishName; break;
        }
    }

    private static int DefaultImportPortions(string dbShiftName, string variantKey)
        => (dbShiftName, variantKey) switch
        {
            ("MORNING", "vegetarian") => 150,
            ("AFTERNOON", "vegetarian") => 150,
            ("AFTERNOON", _) => 870,
            _ => 840
        };

    private static string RemoveDiacritics(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        foreach (var character in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Normalize(NormalizationForm.FormC);
    }
}
