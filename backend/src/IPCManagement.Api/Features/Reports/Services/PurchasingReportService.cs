using IPCManagement.Api.Data;
using IPCManagement.Api.Features.Purchasing.Contracts;
using IPCManagement.Api.Features.Reports.Contracts;
using IPCManagement.Api.Helpers;
using IPCManagement.Api.Models.Entities;
using IPCManagement.Api.Shared.Contracts;
using Microsoft.EntityFrameworkCore;

namespace IPCManagement.Api.Features.Reports.Services;

public class PurchasingReportService : IPurchasingReportService
{
    private readonly IpcManagementContext _context;

    public PurchasingReportService(IpcManagementContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<PurchasePlanReportDto>> GetPurchasePlanAsync(WorkflowReportQueryDto query)
    {
        var rows = await BuildPurchasePlanRowsAsync(query, NormalizeLimit(query.Limit <= 0 ? 500 : query.Limit));
        return rows
            .Take(NormalizeLimit(query.Limit <= 0 ? 500 : query.Limit))
            .ToList();
    }

    private async Task<IReadOnlyList<PurchasePlanReportDto>> BuildPurchasePlanRowsAsync(WorkflowReportQueryDto query, int? sourceLimit)
    {
        var groupBy = string.Equals(query.GroupBy, "week", StringComparison.OrdinalIgnoreCase) ? "week" : "day";
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom) ?? ParseDateOnly(query.ServiceDate);
        var dateTo = ParseDateOnly(query.DateTo) ?? dateFrom;
        decimal? priceTier = query.PriceTier is null ? null : PurchasingReportPolicy.NormalizePriceTier(query.PriceTier.Value);

        // Không Include entity graph: chỉ project các cột cần dùng và tính
        // PendingReceiptQty bằng subquery ngay ở database. Aggregate qua double
        // vì SQLite (test) không hỗ trợ Sum trên decimal.
        var linesQuery = _context.Materialrequestlines
            .AsNoTracking()
            .Where(line => line.Request.Status != "CANCELLED")
            .AsQueryable();

        if (dateFrom is not null)
        {
            linesQuery = linesQuery.Where(line => line.Request.RequestDate >= dateFrom);
        }
        if (dateTo is not null)
        {
            linesQuery = linesQuery.Where(line => line.Request.RequestDate <= dateTo);
        }
        if (ingredientId is not null)
        {
            linesQuery = linesQuery.Where(line => line.IngredientId == ingredientId);
        }
        if (customerId is not null)
        {
            linesQuery = linesQuery.Where(line => line.PlanLine.CustomerId.SequenceEqual(customerId));
        }
        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            linesQuery = linesQuery.Where(line => line.PlanLine.ShiftName == shiftName);
        }
        if (priceTier is not null)
        {
            linesQuery = linesQuery.Where(line => line.PriceTierAmount == priceTier.Value);
        }

        var projectedLines = linesQuery
            .OrderBy(line => line.Request.RequestDate)
            .ThenBy(line => line.Ingredient.IngredientName)
            .Select(line => new PurchasePlanLineRow
            {
                RequestDate = line.Request.RequestDate,
                IngredientId = line.IngredientId,
                IngredientName = line.Ingredient.IngredientName,
                ReferencePrice = line.Ingredient.ReferencePrice,
                UnitId = line.UnitId,
                UnitName = line.Unit.UnitName,
                TotalRequiredQty = line.TotalRequiredQty,
                CurrentStockQty = line.CurrentStockQty,
                SuggestedPurchaseQty = line.SuggestedPurchaseQty,
                PendingReceiptQty = line.Purchaserequestlines
                    .Where(purchaseLine => purchaseLine.PurchaseRequest != null && purchaseLine.PurchaseRequest.Status != "CANCELLED")
                    .Sum(purchaseLine =>
                        (double)purchaseLine.PurchaseQty - (purchaseLine.Inventoryreceiptlines.Sum(receipt => (double?)receipt.Quantity) ?? 0.0) > 0.0
                            ? (double)purchaseLine.PurchaseQty - (purchaseLine.Inventoryreceiptlines.Sum(receipt => (double?)receipt.Quantity) ?? 0.0)
                            : 0.0)
            });
        if (sourceLimit is not null)
        {
            projectedLines = projectedLines.Take(sourceLimit.Value);
        }
        var lines = await projectedLines.ToListAsync();
        if (lines.Count == 0)
        {
            return [];
        }

        var ingredientIds = lines.Select(line => line.IngredientId).Distinct(ByteArrayComparer.Instance).ToList();
        var today = ServiceCalendar.Today();
        var quotations = await _context.Supplierquotations
            .AsNoTracking()
            .Include(item => item.Supplier)
            .Where(item => item.IsActive ?? true)
            .Where(item => ingredientIds.Contains(item.IngredientId))
            .Where(item => item.EffectiveFrom <= today && (item.EffectiveTo == null || item.EffectiveTo >= today))
            .OrderByDescending(item => item.EffectiveFrom)
            .ToListAsync();
        var quotationByIngredient = quotations
            .GroupBy(item => Convert.ToBase64String(item.IngredientId))
            .ToDictionary(group => group.Key, group => group.First());

        return lines
            .GroupBy(line =>
            {
                var period = PurchasingReportPolicy.ResolvePeriod(line.RequestDate, groupBy);
                return new
                {
                    PeriodStart = period.Start,
                    PeriodEnd = period.End,
                    IngredientKey = Convert.ToBase64String(line.IngredientId),
                    UnitKey = Convert.ToBase64String(line.UnitId)
                };
            })
            .Select(group =>
            {
                var first = group.First();
                var quotationByKey = quotationByIngredient.GetValueOrDefault(Convert.ToBase64String(first.IngredientId));
                var pendingReceiptQty = group.Sum(line => (decimal)line.PendingReceiptQty);
                var requiredQty = DecimalPolicy.RoundQuantity(group.Sum(line => line.TotalRequiredQty));
                var currentStockQty = DecimalPolicy.RoundQuantity(group.Sum(line => line.CurrentStockQty));
                var suggestedPurchaseQty = DecimalPolicy.RoundQuantity(group.Sum(line => line.SuggestedPurchaseQty));
                var shortageQty = DecimalPolicy.RoundQuantity(Math.Max(0m, suggestedPurchaseQty - pendingReceiptQty));
                var unitPrice = quotationByKey?.UnitPrice ?? first.ReferencePrice;
                var warnings = new List<string>();
                if (suggestedPurchaseQty > 0 && quotationByKey is null)
                {
                    warnings.Add("Chưa có báo giá NCC đang hiệu lực.");
                }
                if (pendingReceiptQty > 0)
                {
                    warnings.Add("Có lượng đang chờ nhập kho, cần đối chiếu trước khi đặt mua thêm.");
                }
                if (shortageQty > 0)
                {
                    warnings.Add("Còn thiếu so với demand sau khi trừ pending receipt.");
                }

                return new PurchasePlanReportDto
                {
                    PeriodKey = groupBy == "week"
                        ? $"{group.Key.PeriodStart:yyyy-MM-dd}/{group.Key.PeriodEnd:yyyy-MM-dd}"
                        : $"{group.Key.PeriodStart:yyyy-MM-dd}",
                    GroupBy = groupBy,
                    PeriodStart = group.Key.PeriodStart,
                    PeriodEnd = group.Key.PeriodEnd,
                    IngredientId = GuidHelper.ToGuidString(first.IngredientId),
                    IngredientName = first.IngredientName,
                    UnitId = GuidHelper.ToGuidString(first.UnitId),
                    UnitName = first.UnitName,
                    RequiredQty = requiredQty,
                    CurrentStockQty = currentStockQty,
                    PendingReceiptQty = DecimalPolicy.RoundQuantity(pendingReceiptQty),
                    ShortageQty = shortageQty,
                    SuggestedPurchaseQty = suggestedPurchaseQty,
                    EstimatedUnitPrice = DecimalPolicy.RoundMoney(unitPrice),
                    EstimatedAmount = DecimalPolicy.CalculateLineAmount(shortageQty, unitPrice),
                    SupplierId = quotationByKey is null ? null : GuidHelper.ToGuidString(quotationByKey.SupplierId),
                    SupplierName = quotationByKey?.Supplier.SupplierName,
                    ExpectedDeliveryDate = group.Key.PeriodStart,
                    Warnings = warnings
                };
            })
            .OrderBy(item => item.PeriodStart)
            .ThenBy(item => item.IngredientName)
            .ToList();
    }

    public async Task<PurchasePlanPageDto> GetPurchasePlanPageAsync(PurchasePlanPageQueryDto query)
    {
        var rows = await BuildPurchasePlanRowsAsync(query, null);
        var totalCount = rows.Count;
        var items = rows
            .Skip((query.PageNumber - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToList();

        return new PurchasePlanPageDto
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = query.PageNumber,
            PageSize = query.PageSize,
            TotalShortageQty = rows.Sum(row => row.ShortageQty),
            TotalEstimatedAmount = rows.Sum(row => row.EstimatedAmount),
        };
    }

    public async Task<IReadOnlyList<PurchaseDemandReportDto>> GetPurchaseDemandAsync(WorkflowReportQueryDto query)
    {
        var ingredientId = GuidHelper.ParseFilterIdOrThrow(query.IngredientId, "nguyên liệu");
        var supplierId = GuidHelper.ParseFilterIdOrThrow(query.SupplierId, "nhà cung cấp");
        var customerId = ParseCustomerId(query.CustomerId);
        var shiftName = NormalizeShiftName(query.ShiftName);
        var dateFrom = ParseDateOnly(query.DateFrom);
        var dateTo = ParseDateOnly(query.DateTo);

        var lines = _context.Purchaserequestlines
            .AsNoTracking()
            .Include(item => item.PurchaseRequest)
            .Include(item => item.Ingredient)
            .Include(item => item.Supplier)
            .Include(item => item.Unit)
            .Include(item => item.MaterialRequestLine)
                .ThenInclude(item => item.PlanLine)
            .AsQueryable();

        if (ingredientId is not null)
        {
            lines = lines.Where(item => item.IngredientId == ingredientId);
        }

        if (supplierId is not null)
        {
            lines = lines.Where(item => item.SupplierId == supplierId);
        }

        if (dateFrom is not null)
        {
            lines = lines.Where(item => item.PurchaseRequest.PurchaseForDate >= dateFrom);
        }

        if (dateTo is not null)
        {
            lines = lines.Where(item => item.PurchaseRequest.PurchaseForDate <= dateTo);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.PurchaseRequest.ShiftName == shiftName);
        }

        if (customerId is not null)
        {
            lines = lines.Where(item => item.MaterialRequestLine.PlanLine.CustomerId.SequenceEqual(customerId));
        }

        var purchaseLines = await lines
            .OrderByDescending(item => item.PurchaseRequest.PurchaseForDate)
            .ThenBy(item => item.Supplier == null ? string.Empty : item.Supplier.SupplierName)
            .Take(NormalizeLimit(query.Limit))
            .ToListAsync();

        var latestReceiptPrices = await LoadLatestReceiptPriceLookupAsync(purchaseLines);

        return purchaseLines
            .Select(item => new PurchaseDemandReportDto
            {
                PurchaseRequestId = GuidHelper.ToGuidString(item.PurchaseRequestId),
                PurchaseRequestLineId = GuidHelper.ToGuidString(item.PurchaseRequestLineId),
                PurchaseRequestCode = item.PurchaseRequest.PurchaseRequestCode,
                PurchaseForDate = item.PurchaseRequest.PurchaseForDate,
                ShiftName = item.PurchaseRequest.ShiftName,
                Status = item.PurchaseRequest.Status,
                IngredientId = GuidHelper.ToGuidString(item.IngredientId),
                IngredientName = item.Ingredient.IngredientName,
                SupplierId = item.SupplierId is null ? null : GuidHelper.ToGuidString(item.SupplierId),
                SupplierName = item.Supplier?.SupplierName,
                UnitId = GuidHelper.ToGuidString(item.UnitId),
                UnitName = item.Unit.UnitName,
                RequiredQty = DecimalPolicy.RoundQuantity(item.RequiredQty),
                CurrentStockQty = DecimalPolicy.RoundQuantity(item.CurrentStockQty),
                PurchaseQty = DecimalPolicy.RoundQuantity(item.PurchaseQty),
                EstimatedUnitPrice = DecimalPolicy.RoundMoney(item.EstimatedUnitPrice),
                EstimatedAmount = DecimalPolicy.CalculateLineAmount(item.PurchaseQty, item.EstimatedUnitPrice),
                ReferenceUnitPrice = ResolvePurchaseReferencePrice(item, latestReceiptPrices),
                PriceVariancePercent = WorkflowReportCalculator.CalculateVariancePercent(
                    ResolvePurchaseReferencePrice(item, latestReceiptPrices),
                    item.EstimatedUnitPrice),
                IsPriceWarning = WorkflowReportCalculator.IsPriceIncreaseWarning(
                    WorkflowReportCalculator.CalculateVariancePercent(
                        ResolvePurchaseReferencePrice(item, latestReceiptPrices),
                        item.EstimatedUnitPrice)),
                ExpectedDeliveryDate = item.ExpectedDeliveryDate,
                Note = item.Note
            })
            .ToList();
    }

    private async Task<Dictionary<string, decimal>> LoadLatestReceiptPriceLookupAsync(IReadOnlyCollection<PurchaseRequestLine> purchaseLines)
    {
        if (purchaseLines.Count == 0)
        {
            return [];
        }

        var ingredientIds = purchaseLines.Select(item => item.IngredientId).Distinct(ByteArrayComparer.Instance).ToList();
        var supplierIds = purchaseLines
            .Where(item => item.SupplierId is not null)
            .Select(item => item.SupplierId!)
            .Distinct(ByteArrayComparer.Instance)
            .ToList();
        var unitIds = purchaseLines.Select(item => item.UnitId).Distinct(ByteArrayComparer.Instance).ToList();

        var receiptLines = await _context.Inventoryreceiptlines
            .AsNoTracking()
            .Include(item => item.Receipt)
            .Where(item =>
                ingredientIds.Contains(item.IngredientId) &&
                supplierIds.Contains(item.Receipt.SupplierId) &&
                unitIds.Contains(item.UnitId) &&
                item.UnitPrice > 0)
            .OrderByDescending(item => item.Receipt.ReceiptDate)
            .ToListAsync();

        return receiptLines
            .GroupBy(item => BuildPurchasePriceKey(item.IngredientId, item.Receipt.SupplierId, item.UnitId))
            .ToDictionary(group => group.Key, group => DecimalPolicy.RoundMoney(group.First().UnitPrice));
    }

    private static decimal ResolvePurchaseReferencePrice(
        PurchaseRequestLine line,
        IReadOnlyDictionary<string, decimal> latestReceiptPrices)
    {
        if (line.SupplierId is null)
        {
            return DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice);
        }

        var key = BuildPurchasePriceKey(line.IngredientId, line.SupplierId, line.UnitId);
        return latestReceiptPrices.TryGetValue(key, out var latestPrice) && latestPrice > 0
            ? latestPrice
            : DecimalPolicy.RoundMoney(line.Ingredient.ReferencePrice);
    }

    private static string BuildPurchasePriceKey(byte[] ingredientId, byte[] supplierId, byte[] unitId)
        => $"{Convert.ToBase64String(ingredientId)}:{Convert.ToBase64String(supplierId)}:{Convert.ToBase64String(unitId)}";

    // Dòng projection cho purchase plan: chỉ giữ scalar cần dùng, không kéo entity graph.
    private sealed class PurchasePlanLineRow
    {
        public DateOnly RequestDate { get; init; }
        public required byte[] IngredientId { get; init; }
        public required string IngredientName { get; init; }
        public decimal ReferencePrice { get; init; }
        public required byte[] UnitId { get; init; }
        public required string UnitName { get; init; }
        public decimal TotalRequiredQty { get; init; }
        public decimal CurrentStockQty { get; init; }
        public decimal SuggestedPurchaseQty { get; init; }
        public double PendingReceiptQty { get; init; }
    }

    public async Task<IReadOnlyList<OrderExportReportRowDto>> GetOrderExportAsync(WorkflowReportQueryDto query)
    {
        var serviceDate = ParseDateOnly(query.ServiceDate) ?? ParseDateOnly(query.DateFrom);
        var shiftName = NormalizeShiftName(query.ShiftName);

        var lines = _context.Mealquantityplanlines
            .AsNoTracking()
            .Include(item => item.QuantityPlan)
            .Include(item => item.Customer)
            .Include(item => item.Menu)
            .Include(item => item.MenuSchedule)
            .AsQueryable();

        if (serviceDate is not null)
        {
            lines = lines.Where(item => item.QuantityPlan.ServiceDate == serviceDate);
        }

        if (!string.IsNullOrWhiteSpace(shiftName))
        {
            lines = lines.Where(item => item.ShiftName == shiftName);
        }

        return await lines
            .OrderBy(item => item.Customer.CustomerCode)
            .ThenBy(item => item.ShiftName)
            .Take(NormalizeLimit(query.Limit))
            .Select(item => new OrderExportReportRowDto
            {
                QuantityPlanLineId = GuidHelper.ToGuidString(item.QuantityPlanLineId),
                ServiceDate = item.QuantityPlan.ServiceDate,
                ShiftName = item.ShiftName,
                CustomerName = item.Customer.CustomerName,
                MenuName = item.Menu.MenuName,
                ForecastServings = item.ForecastServings,
                ConfirmedServings = item.ConfirmedServings,
                FinalServings = item.FinalServings,
                MenuPrice = item.MenuSchedule.MenuPrice,
                BomRatePercent = item.MenuSchedule.BomRatePercent
            })
            .ToListAsync();
    }

    private static byte[]? ParseCustomerId(string? value)
        => GuidHelper.ParseFilterIdOrThrow(value, "khách hàng");

    private static DateOnly? ParseDateOnly(string? value)
        => DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static int NormalizeLimit(int limit)
        => Math.Clamp(limit <= 0 ? 100 : limit, 1, 500);

    private static string? NormalizeShiftName(string? shift)
        => (shift ?? string.Empty).Trim().ToUpperInvariant() switch
        {
            "MORNING" or "CA SANG" or "CA SÁNG" => "MORNING",
            "AFTERNOON" or "CA CHIEU" or "CA CHIỀU" => "AFTERNOON",
            _ => null
        };

    private sealed class ByteArrayComparer : IEqualityComparer<byte[]>
    {
        public static readonly ByteArrayComparer Instance = new();

        public bool Equals(byte[]? x, byte[]? y)
            => ReferenceEquals(x, y) || (x is not null && y is not null && x.SequenceEqual(y));

        public int GetHashCode(byte[] obj)
        {
            var hash = new HashCode();
            foreach (var value in obj)
            {
                hash.Add(value);
            }

            return hash.ToHashCode();
        }
    }
}
