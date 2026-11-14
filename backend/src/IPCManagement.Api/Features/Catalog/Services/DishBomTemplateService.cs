using System.Globalization;
using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Catalog.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Catalog.Services;

public sealed class DishBomTemplateService : IDishBomTemplateService
{
    private const int BlankBomRowsPerDish = 8;
    private readonly IpcManagementContext _context;

    public DishBomTemplateService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<(byte[] Content, string FileName)> BuildAsync(BomTemplateQueryDto query, CancellationToken cancellationToken = default)
    {
        var priceTier = DishBomPolicy.NormalizePriceTier(query.PriceTier);
        var customerId = DishBomPolicy.ParseOptionalCustomerId(query.CustomerId);
        var dishId = DishBomPolicy.ParseOptionalDishId(query.DishId);
        var templateType = DishBomPolicy.NormalizeTemplateType(query.TemplateType, dishId is not null);
        var customerCode = await ResolveCustomerCodeAsync(customerId, cancellationToken);
        var rows = new List<IReadOnlyList<string>>();
        var today = query.EffectiveDate ?? ServiceCalendar.Today();

        if (templateType == "mrx-missing")
        {
            if (customerId is null || query.WeekStartDate is null || string.IsNullOrWhiteSpace(query.MenuVersionId))
                throw new ArgumentException("Cần khách hàng, tuần và phiên bản thực đơn để tải BOM thiếu của MRX.");
            var versionId = GuidHelper.ParseGuidString(query.MenuVersionId)
                ?? throw new ArgumentException("Phiên bản thực đơn không hợp lệ.");
            var schedules = await _context.Menuschedules.AsNoTracking()
                .Where(item => item.CustomerId == customerId && item.WeekStartDate == query.WeekStartDate &&
                    item.MenuVersionId == versionId && item.MenuPrice == priceTier)
                .Select(item => new { item.MenuId, item.ServiceDate })
                .ToListAsync(cancellationToken);
            if (schedules.Count == 0)
                throw new ArgumentException("Không có lịch thực đơn thuộc khách hàng, tuần, phiên bản và mức giá đã chọn.");
            var menuIds = schedules.Select(item => item.MenuId).ToList();
            var menuItems = await _context.Menuitems.AsNoTracking()
                .Where(item => menuIds.Contains(item.MenuId))
                .Select(item => new { item.MenuId, item.DishId })
                .ToListAsync(cancellationToken);
            var dishIds = menuItems.Select(item => item.DishId).ToList();
            var scheduledDishes = await _context.Dishes.AsNoTracking()
                .Include(dish => dish.Dishboms).ThenInclude(bom => bom.Ingredient)
                .Include(dish => dish.Dishboms).ThenInclude(bom => bom.Unit)
                .Where(dish => dishIds.Contains(dish.DishId) && (dish.IsActive ?? true))
                .AsSplitQuery().ToListAsync(cancellationToken);
            foreach (var dish in scheduledDishes.OrderBy(item => item.DishCode))
            {
                var dates = schedules.Where(schedule => menuItems.Any(item => item.MenuId.SequenceEqual(schedule.MenuId) && item.DishId.SequenceEqual(dish.DishId)))
                    .Select(schedule => schedule.ServiceDate).Distinct().OrderBy(date => date).ToList();
                var missingDates = dates.Where(date => BomSelectionResolver.Resolve(dish.Dishboms, customerId, priceTier, date).Count == 0).ToList();
                for (var index = 0; index < missingDates.Count;)
                {
                    var first = missingDates[index];
                    var last = first;
                    while (++index < missingDates.Count && missingDates[index].DayNumber == last.DayNumber + 1)
                        last = missingDates[index];
                    AddBlankBomRows(rows, dish, priceTier, customerCode,
                        first.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        last.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                }
            }
        }

        if (templateType != "blank" && templateType != "mrx-missing")
        {
            var dishesQuery = _context.Dishes
                .AsNoTracking()
                .Include(dish => dish.Dishboms)
                    .ThenInclude(bom => bom.Ingredient)
                .Include(dish => dish.Dishboms)
                    .ThenInclude(bom => bom.Unit)
                .Where(dish => dish.IsActive ?? true);

            if (dishId is not null)
            {
                dishesQuery = dishesQuery.Where(dish => dish.DishId.SequenceEqual(dishId));
            }

            var dishes = await dishesQuery
                .OrderBy(dish => dish.DishCode)
                .ToListAsync(cancellationToken);
            var effectiveFrom = today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            foreach (var dish in dishes)
            {
                var currentLines = query.IncludeCurrent
                    ? (customerId is null
                        ? dish.Dishboms.Where(line => line.CustomerId is null && line.PriceTierAmount == priceTier && DishBomPolicy.IsPublished(line) && line.EffectiveFrom <= today && (line.EffectiveTo is null || line.EffectiveTo >= today)).ToList()
                        : BomSelectionResolver.Resolve(dish.Dishboms, customerId, priceTier, today).ToList())
                        .OrderBy(line => line.Ingredient.IngredientName).ToList()
                    : [];

                if (templateType == "missing" && currentLines.Count > 0)
                {
                    continue;
                }

                if (currentLines.Count == 0)
                {
                    AddBlankBomRows(rows, dish, priceTier, customerCode, effectiveFrom);
                    continue;
                }

                foreach (var line in currentLines)
                {
                    rows.Add([
                        dish.DishCode,
                        dish.DishName,
                        priceTier.ToString("0.##", CultureInfo.InvariantCulture),
                        customerCode ?? string.Empty,
                        line.Ingredient.IngredientName,
                        BomUnitDisplayPolicy.Format(line.Unit),
                        line.GrossQtyPerServing.ToString("0.######", CultureInfo.InvariantCulture),
                        line.WasteRatePercent.ToString("0.##", CultureInfo.InvariantCulture),
                        line.EffectiveFrom.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                        line.EffectiveTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
                        line.BomStatus,
                        string.Empty
                    ]);
                }
            }
        }

        var ingredientNames = await _context.Ingredients
            .AsNoTracking()
            .Where(item => item.IsActive ?? true)
            .Select(item => item.IngredientName)
            .Distinct()
            .OrderBy(name => name)
            .ToListAsync(cancellationToken);
        var units = await _context.Units
            .AsNoTracking()
            .OrderBy(item => item.UnitName)
            .ToListAsync(cancellationToken);
        var unitOptions = units
            .Select(BomUnitDisplayPolicy.Format)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(name => name, StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), ignoreCase: true))
            .ToList();

        var scope = customerCode is null ? "Dùng chung" : $"Khách hàng {customerCode}";
        var scopeLabel = templateType switch { "missing" => "CacMonThieu", "mrx-missing" => "CacMonThieuMRX", "dish" => "TheoMon", "blank" => "Trong", _ => "ToanBo" };
        var scopeDescription = templateType switch { "missing" => "Các món thiếu định lượng", "mrx-missing" => "Các món thiếu BOM trong tuần MRX", "dish" => "Theo món", "blank" => "Mẫu trống", _ => "Toàn bộ món" };
        var content = BomTemplateWorkbookBuilder.Build(
            priceTier,
            $"{scope} / {scopeDescription}",
            today,
            rows,
            ingredientNames,
            unitOptions);
        return (content, TemplateFileNames.Bom(customerCode, priceTier, scopeLabel));
    }

    private async Task<string?> ResolveCustomerCodeAsync(byte[]? customerId, CancellationToken cancellationToken)
    {
        if (customerId is null)
        {
            return null;
        }

        var customer = await _context.Customers
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CustomerId.SequenceEqual(customerId), cancellationToken);
        return customer?.CustomerCode;
    }

    private static void AddBlankBomRows(
        ICollection<IReadOnlyList<string>> rows,
        Dish dish,
        decimal priceTier,
        string? customerCode,
        string effectiveFrom,
        string? effectiveTo = null)
    {
        for (var index = 0; index < BlankBomRowsPerDish; index++)
        {
            rows.Add([
                dish.DishCode,
                dish.DishName,
                priceTier.ToString("0.##", CultureInfo.InvariantCulture),
                customerCode ?? string.Empty,
                string.Empty,
                string.Empty,
                string.Empty,
                string.Empty,
                effectiveFrom,
                effectiveTo ?? string.Empty,
                DishBomPolicy.Published,
                string.Empty
            ]);
        }
    }
}
