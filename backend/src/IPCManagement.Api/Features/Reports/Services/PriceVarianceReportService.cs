using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class PriceVarianceReportService : IPriceVarianceReportService
{
    private static readonly decimal[] SupportedBomPriceTiers = [25000m, 30000m, 34000m];
    private readonly IpcManagementContext _context;

    public PriceVarianceReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<ReceiptPriceVarianceReportDto>> GetReceiptPriceVarianceAsync(
        WorkflowReportQueryDto query)
    {
        var receiptLines = await BuildFilteredReceiptLinesQuery(query)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        return receiptLines.Select(MapReceiptPriceVariance).ToList();
    }

    public async Task<PagedResponseDto<ReceiptPriceVarianceReportDto>> GetReceiptPriceVariancePageAsync(
        ReceiptPriceVariancePageQueryDto query)
    {
        var filteredLines = BuildFilteredReceiptLinesQuery(query);
        if (!string.IsNullOrWhiteSpace(query.SearchKeyword))
        {
            var searchKeyword = query.SearchKeyword.Trim();
            filteredLines = filteredLines.Where(item =>
                item.Ingredient.IngredientName.Contains(searchKeyword) ||
                item.Ingredient.IngredientCode.Contains(searchKeyword) ||
                item.Receipt.Supplier.SupplierName.Contains(searchKeyword) ||
                item.Receipt.Supplier.SupplierCode.Contains(searchKeyword) ||
                item.Receipt.ReceiptCode.Contains(searchKeyword) ||
                item.Unit.UnitName.Contains(searchKeyword) ||
                item.Unit.UnitCode.Contains(searchKeyword));
        }
        var totalCount = await filteredLines.CountAsync();
        var receiptLines = await filteredLines
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ThenBy(item => item.Ingredient.IngredientName)
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync();

        return PagedResponseDto<ReceiptPriceVarianceReportDto>.Create(
            receiptLines.Select(MapReceiptPriceVariance),
            totalCount,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierAsync(
        WorkflowReportQueryDto query)
    {
        var grouped = await BuildFilteredReceiptLinesQuery(query)
            .GroupBy(item => new
            {
                item.IngredientId,
                item.Ingredient.IngredientName,
                item.Ingredient.ReferencePrice,
                item.Receipt.SupplierId,
                SupplierName = item.Receipt.Supplier.SupplierName,
                item.UnitId,
                UnitName = item.Unit.UnitName
            })
            .Select(group => new
            {
                group.Key.IngredientId,
                group.Key.IngredientName,
                group.Key.ReferencePrice,
                group.Key.SupplierId,
                group.Key.SupplierName,
                group.Key.UnitId,
                group.Key.UnitName,
                ReceiptCount = group.Count(),
                TotalQuantity = group.Sum(x => (double)x.Quantity),
                TotalAmount = group.Sum(x => (double)x.UnitPrice * (double)x.Quantity),
                SimpleAvgUnitPrice = group.Average(x => (double)x.UnitPrice),
                MinUnitPrice = group.Min(x => (double)x.UnitPrice),
                MaxUnitPrice = group.Max(x => (double)x.UnitPrice)
            })
            .ToListAsync();

        return grouped
            .Select(row =>
            {
                var avgPrice = DecimalPolicy.RoundMoney((decimal)PriceVarianceReportPolicy.ResolveWeightedUnitPrice(
                    row.TotalAmount,
                    row.TotalQuantity,
                    row.SimpleAvgUnitPrice));
                var variance = WorkflowReportCalculator.CalculateVariancePercent(row.ReferencePrice, avgPrice);

                return new PriceVarianceBySupplierDto
                {
                    IngredientId = GuidHelper.ToGuidString(row.IngredientId),
                    IngredientName = row.IngredientName,
                    SupplierId = GuidHelper.ToGuidString(row.SupplierId),
                    SupplierName = row.SupplierName,
                    UnitId = GuidHelper.ToGuidString(row.UnitId),
                    UnitName = row.UnitName,
                    ReceiptCount = row.ReceiptCount,
                    AvgUnitPrice = avgPrice,
                    MinUnitPrice = DecimalPolicy.RoundMoney((decimal)row.MinUnitPrice),
                    MaxUnitPrice = DecimalPolicy.RoundMoney((decimal)row.MaxUnitPrice),
                    ReferencePrice = DecimalPolicy.RoundMoney(row.ReferencePrice),
                    VariancePercent = variance,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
                };
            })
            .OrderByDescending(dto => dto.VariancePercent)
            .ThenBy(dto => dto.IngredientName)
            .Take(NormalizeAggregateLimit(query.Limit))
            .ToList();
    }

    public async Task<PagedResponseDto<PriceVarianceBySupplierDto>> GetPriceVarianceBySupplierPageAsync(
        PriceVarianceAggregatePageQueryDto query)
    {
        var rows = await GetPriceVarianceBySupplierAsync(CloneQuery(query, -1));
        return PagedResponseDto<PriceVarianceBySupplierDto>.Create(
            rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize),
            rows.Count,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodAsync(
        WorkflowReportQueryDto query)
    {
        var groupedRows = await BuildFilteredReceiptLinesQuery(query)
            .GroupBy(item => new
            {
                item.IngredientId,
                item.Ingredient.IngredientName,
                item.Ingredient.ReferencePrice,
                item.UnitId,
                UnitName = item.Unit.UnitName,
                item.Receipt.ReceiptDate.Year,
                item.Receipt.ReceiptDate.Month
            })
            .Select(group => new
            {
                group.Key.IngredientId,
                group.Key.IngredientName,
                group.Key.ReferencePrice,
                group.Key.UnitId,
                group.Key.UnitName,
                group.Key.Year,
                group.Key.Month,
                TotalQuantity = group.Sum(x => (double)x.Quantity),
                TotalAmount = group.Sum(x => (double)x.UnitPrice * (double)x.Quantity),
                SimpleAvgUnitPrice = group.Average(x => (double)x.UnitPrice)
            })
            .ToListAsync();

        var byIngredientAndPeriod = groupedRows
            .Select(row => new
            {
                row.IngredientId,
                row.IngredientName,
                row.ReferencePrice,
                row.UnitId,
                row.UnitName,
                PeriodStart = new DateOnly(row.Year, row.Month, 1),
                AvgUnitPrice = DecimalPolicy.RoundMoney((decimal)PriceVarianceReportPolicy.ResolveWeightedUnitPrice(
                    row.TotalAmount,
                    row.TotalQuantity,
                    row.SimpleAvgUnitPrice))
            })
            .ToList();

        var result = new List<PriceVarianceByPeriodDto>();
        foreach (var ingredientGroup in byIngredientAndPeriod
            .GroupBy(x => $"{Convert.ToBase64String(x.IngredientId)}|{Convert.ToBase64String(x.UnitId)}")
            .OrderBy(group => group.First().IngredientName))
        {
            var periods = ingredientGroup.OrderBy(item => item.PeriodStart).ToList();
            for (var index = 0; index < periods.Count; index++)
            {
                var current = periods[index];
                var varianceVsReference = WorkflowReportCalculator.CalculateVariancePercent(
                    current.ReferencePrice,
                    current.AvgUnitPrice);
                decimal? varianceVsPrevious = index > 0
                    ? WorkflowReportCalculator.CalculateVariancePercent(
                        periods[index - 1].AvgUnitPrice,
                        current.AvgUnitPrice)
                    : null;

                result.Add(new PriceVarianceByPeriodDto
                {
                    IngredientId = GuidHelper.ToGuidString(current.IngredientId),
                    IngredientName = current.IngredientName,
                    UnitId = GuidHelper.ToGuidString(current.UnitId),
                    UnitName = current.UnitName,
                    PeriodLabel = current.PeriodStart.ToString("yyyy-MM"),
                    PeriodStart = current.PeriodStart,
                    AvgUnitPrice = current.AvgUnitPrice,
                    ReferencePrice = DecimalPolicy.RoundMoney(current.ReferencePrice),
                    VariancePercentVsReference = varianceVsReference,
                    VariancePercentVsPreviousPeriod = varianceVsPrevious,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(varianceVsReference)
                });
            }
        }

        return result.Take(NormalizeAggregateLimit(query.Limit)).ToList();
    }

    public async Task<PagedResponseDto<PriceVarianceByPeriodDto>> GetPriceVarianceByPeriodPageAsync(
        PriceVarianceAggregatePageQueryDto query)
    {
        var rows = await GetPriceVarianceByPeriodAsync(CloneQuery(query, -1));
        return PagedResponseDto<PriceVarianceByPeriodDto>.Create(
            rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize),
            rows.Count,
            query.PageNumber,
            query.PageSize);
    }

    public async Task<IReadOnlyList<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupAsync(
        WorkflowReportQueryDto query)
    {
        var ingredientRows = await BuildFilteredReceiptLinesQuery(query)
            .Where(item => item.UnitId == item.Ingredient.UnitId)
            .GroupBy(item => new
            {
                item.IngredientId,
                item.Ingredient.IngredientName,
                item.Ingredient.ReferencePrice
            })
            .Select(group => new
            {
                group.Key.IngredientId,
                group.Key.IngredientName,
                group.Key.ReferencePrice,
                TotalQuantity = group.Sum(x => (double)x.Quantity),
                TotalAmount = group.Sum(x => (double)x.UnitPrice * (double)x.Quantity),
                SimpleAvgUnitPrice = group.Average(x => (double)x.UnitPrice)
            })
            .ToListAsync();

        var ingredientVariance = ingredientRows
            .Select(row =>
            {
                var avgPrice = DecimalPolicy.RoundMoney((decimal)PriceVarianceReportPolicy.ResolveWeightedUnitPrice(
                    row.TotalAmount,
                    row.TotalQuantity,
                    row.SimpleAvgUnitPrice));
                var variance = WorkflowReportCalculator.CalculateVariancePercent(row.ReferencePrice, avgPrice);

                return new
                {
                    IngredientKey = Convert.ToBase64String(row.IngredientId),
                    row.IngredientName,
                    VariancePercent = variance,
                    IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
                };
            })
            .ToDictionary(item => item.IngredientKey);

        if (ingredientVariance.Count == 0)
        {
            return [];
        }

        var today = ServiceCalendar.Today();
        var activeBomWeights = await _context.Dishboms
            .AsNoTracking()
            .Where(bom =>
                SupportedBomPriceTiers.Contains(bom.PriceTierAmount) &&
                bom.EffectiveFrom <= today &&
                (bom.EffectiveTo == null || bom.EffectiveTo >= today))
            .GroupBy(bom => new { bom.Dish.DishGroup, bom.IngredientId })
            .Select(group => new
            {
                group.Key.DishGroup,
                group.Key.IngredientId,
                Weight = group.Sum(item => (double)item.GrossQtyPerServing)
            })
            .ToListAsync();

        var groupIngredientWeights = activeBomWeights
            .Where(row => ingredientVariance.ContainsKey(Convert.ToBase64String(row.IngredientId)))
            .Select(row => new
            {
                GroupName = string.IsNullOrWhiteSpace(row.DishGroup) ? "Chưa phân nhóm" : row.DishGroup!,
                IngredientKey = Convert.ToBase64String(row.IngredientId),
                Weight = (decimal)row.Weight
            })
            .GroupBy(row => new { row.GroupName, row.IngredientKey })
            .Select(group => new
            {
                group.Key.GroupName,
                group.Key.IngredientKey,
                Weight = group.Sum(item => item.Weight)
            })
            .ToList();

        return groupIngredientWeights
            .GroupBy(item => item.GroupName)
            .Select(group =>
            {
                var items = group
                    .Select(item => new
                    {
                        item.Weight,
                        Info = ingredientVariance[item.IngredientKey]
                    })
                    .ToList();

                var totalWeight = items.Sum(item => item.Weight);
                var weightedAverage = totalWeight > 0
                    ? DecimalPolicy.RoundPercent(items.Sum(item => item.Weight * item.Info.VariancePercent) / totalWeight)
                    : 0;

                return new PriceVarianceByDishGroupDto
                {
                    DishGroup = group.Key,
                    IngredientCount = items.Count,
                    WarningIngredientCount = items.Count(item => item.Info.IsWarning),
                    WeightedAvgVariancePercent = weightedAverage,
                    TopIngredients = items
                        .OrderByDescending(item => item.Info.VariancePercent)
                        .Take(3)
                        .Select(item => new PriceVarianceDishGroupIngredientDto
                        {
                            IngredientName = item.Info.IngredientName,
                            VariancePercent = item.Info.VariancePercent,
                            Weight = DecimalPolicy.RoundQuantity(item.Weight)
                        })
                        .ToList()
                };
            })
            .OrderByDescending(dto => dto.WeightedAvgVariancePercent)
            .Take(NormalizeAggregateLimit(query.Limit))
            .ToList();
    }

    public async Task<PagedResponseDto<PriceVarianceByDishGroupDto>> GetPriceVarianceByDishGroupPageAsync(
        PriceVarianceAggregatePageQueryDto query)
    {
        var rows = await GetPriceVarianceByDishGroupAsync(CloneQuery(query, -1));
        return PagedResponseDto<PriceVarianceByDishGroupDto>.Create(
            rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize),
            rows.Count,
            query.PageNumber,
            query.PageSize);
    }

    private IQueryable<InventoryReceiptLine> BuildFilteredReceiptLinesQuery(WorkflowReportQueryDto query)
    {
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var supplierId = GuidHelper.ParseFilterIdOrThrow(query.SupplierId, "nhà cung cấp");
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
                .ThenInclude(item => item.Supplier)
            .Include(item => item.Ingredient)
            .Include(item => item.Unit)
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (supplierId is not null)
        {
            lines = lines.Where(item => item.Receipt.SupplierId == supplierId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.Receipt.ReceiptDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.Receipt.ReceiptDate <= dateTo);
        }

        if (query.WarningOnly)
        {
            lines = lines.Where(item =>
                item.Ingredient.ReferencePrice > 0 &&
                item.UnitPrice >= item.Ingredient.ReferencePrice * 1.15m);
        }

        return lines;
    }

    private static ReceiptPriceVarianceReportDto MapReceiptPriceVariance(InventoryReceiptLine item)
    {
        var variance = WorkflowReportCalculator.CalculateVariancePercent(
            item.Ingredient.ReferencePrice,
            item.UnitPrice);

        return new ReceiptPriceVarianceReportDto
        {
            ReceiptId = GuidHelper.ToGuidString(item.ReceiptId),
            ReceiptCode = item.Receipt.ReceiptCode,
            ReceiptDate = item.Receipt.ReceiptDate,
            SupplierId = GuidHelper.ToGuidString(item.Receipt.SupplierId),
            SupplierName = item.Receipt.Supplier.SupplierName,
            IngredientId = GuidHelper.ToGuidString(item.IngredientId),
            IngredientName = item.Ingredient.IngredientName,
            UnitId = GuidHelper.ToGuidString(item.UnitId),
            UnitName = item.Unit.UnitName,
            Quantity = DecimalPolicy.RoundQuantity(item.Quantity),
            UnitPrice = DecimalPolicy.RoundMoney(item.UnitPrice),
            ReferencePrice = DecimalPolicy.RoundMoney(item.Ingredient.ReferencePrice),
            VariancePercent = variance,
            IsWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(variance)
        };
    }

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private static int NormalizeAggregateLimit(int limit)
        => limit < 0 ? int.MaxValue : NormalizeLimit(limit);

    private static WorkflowReportQueryDto CloneQuery(WorkflowReportQueryDto query, int limit)
        => new()
        {
            ServiceDate = query.ServiceDate,
            DateFrom = query.DateFrom,
            DateTo = query.DateTo,
            CustomerId = query.CustomerId,
            WarehouseId = query.WarehouseId,
            IngredientId = query.IngredientId,
            SupplierId = query.SupplierId,
            ShiftName = query.ShiftName,
            Format = query.Format,
            CursorDate = query.CursorDate,
            CursorId = query.CursorId,
            CursorOffset = query.CursorOffset,
            Limit = limit,
            SortDirection = query.SortDirection,
            Actor = query.Actor,
            BusinessArea = query.BusinessArea,
            EntityName = query.EntityName,
            FieldName = query.FieldName,
            GroupBy = query.GroupBy,
            PriceTier = query.PriceTier
        };
}
