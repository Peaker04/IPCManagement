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

    public async Task<byte[]> BuildAsync(BomTemplateQueryDto query, CancellationToken cancellationToken = default)
    {
        var priceTier = DishBomPolicy.NormalizePriceTier(query.PriceTier);
        var customerId = DishBomPolicy.ParseOptionalCustomerId(query.CustomerId);
        var dishId = DishBomPolicy.ParseOptionalDishId(query.DishId);
        var templateType = DishBomPolicy.NormalizeTemplateType(query.TemplateType, dishId is not null);
        var customerCode = await ResolveCustomerCodeAsync(customerId, cancellationToken);
        var rows = new List<IReadOnlyList<string>>();
        var today = ServiceCalendar.Today();

        if (templateType != "blank")
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
                    ? dish.Dishboms
                        .Where(line => line.PriceTierAmount == priceTier)
                        .Where(line => DishBomPolicy.MatchesCustomerScope(line.CustomerId, customerId))
                        .Where(DishBomPolicy.IsPublished)
                        .Where(line => line.EffectiveFrom <= today && (line.EffectiveTo is null || line.EffectiveTo >= today))
                        .OrderBy(line => line.Ingredient.IngredientName)
                        .ToList()
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
                        line.Unit.UnitCode,
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

        var scope = customerCode is null ? "Global" : $"Customer {customerCode}";
        return BomTemplateWorkbookBuilder.Build(priceTier, $"{scope} / {templateType}", today, rows);
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
        string effectiveFrom)
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
                string.Empty,
                DishBomPolicy.Published,
                string.Empty
            ]);
        }
    }
}
